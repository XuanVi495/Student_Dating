import { createHash } from 'node:crypto';
import {
  Prisma,
  ReportStatus,
  type ReportReasonCategory,
} from '@prisma/client';
import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger/logger.js';
import {
  reportEventBus,
  type ReportEvents,
} from '../../shared/events/report.events.js';
import type { EventBus } from '../../shared/events/event-bus.js';
import {
  reportRepository,
  type ReportRecord,
  type ReportRepository,
} from './report.repository.js';
import type {
  CreateReportBody,
  ListReportsQuery,
  ReviewReportBody,
} from './report.schemas.js';

function normalizeContext(context: CreateReportBody['context']): Record<string, unknown> {
  if (!context) return {};
  return {
    type: context.type,
    ...(context.id ? { id: context.id } : {}),
    ...(context.metadata ? { metadata: context.metadata } : {}),
  };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function getContextFingerprint(context: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(context)).digest('hex');
}

function toReportResponse(record: ReportRecord) {
  return {
    id: record.id,
    reporterId: record.reporterId,
    reportedStudentId: record.reportedStudentId,
    reasonCategory: record.reasonCategory,
    reasonNote: record.reasonNote,
    context: record.context,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    evidenceUrls: record.evidences.map((evidence) => evidence.url),
    history: record.histories.map((history) => ({
      id: history.id,
      reviewerId: history.reviewerId,
      fromStatus: history.fromStatus,
      toStatus: history.toStatus,
      decision: history.decision,
      action: history.action,
      note: history.note,
      processedAt: history.processedAt,
    })),
  };
}

export function createReportService(
  repository: ReportRepository = reportRepository,
  eventBus: EventBus<ReportEvents> = reportEventBus
) {
  return {
    async createReport(reporterId: string, input: CreateReportBody) {
      if (reporterId === input.reportedStudentId) {
        throw new AppError(409, 'You cannot report yourself.');
      }
      if (!(await repository.studentExists(input.reportedStudentId))) {
        throw new AppError(404, 'Reported user not found.');
      }

      const context = normalizeContext(input.context);
      const contextFingerprint = getContextFingerprint(context);
      const duplicate = await repository.findDuplicate(
        reporterId,
        input.reportedStudentId,
        contextFingerprint
      );
      if (duplicate) {
        throw new AppError(409, 'A matching report is already being reviewed.');
      }

      try {
        const report = await repository.createReport({
          reporterId,
          reportedStudentId: input.reportedStudentId,
          reasonCategory: input.reasonCategory,
          reasonNote: input.reasonNote,
          context,
          contextFingerprint,
          evidenceUrls: input.evidenceUrls,
        });

        logger.info('[Report Service] Create report success', {
          action: 'report.created',
          reportId: report.id,
          reporterId,
          reportedStudentId: input.reportedStudentId,
        });
        eventBus.publish('report.submitted', {
          reportId: report.id,
          reporterId,
        });
        return toReportResponse(report);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new AppError(409, 'A matching report is already being reviewed.');
        }
        throw error;
      }
    },

    async listReports(query: ListReportsQuery) {
      const result = await repository.listReports(query.status, query.limit, query.cursor);
      return {
        items: result.items.map(toReportResponse),
        nextCursor: result.nextCursor,
      };
    },

    async getReport(reportId: string) {
      const report = await repository.getReport(reportId);
      if (!report) throw new AppError(404, 'Report not found.');
      return toReportResponse(report);
    },

    async reviewReport(
      reviewerId: string,
      reportId: string,
      input: ReviewReportBody
    ) {
      const report = await repository.getReport(reportId);
      if (!report) throw new AppError(404, 'Report not found.');
      if (
        report.status !== ReportStatus.CHO_DUYET &&
        report.status !== ReportStatus.DANG_XU_LY
      ) {
        throw new AppError(409, 'Only active reports can be reviewed.');
      }
      if (
        report.status === ReportStatus.DANG_XU_LY &&
        input.status === ReportStatus.DANG_XU_LY
      ) {
        throw new AppError(409, 'The report is already being processed.');
      }

      const reviewed = await repository.reviewReport(reportId, reviewerId, input);
      if (!reviewed) throw new AppError(409, 'The report changed before it was reviewed.');

      logger.info('[Report Service] Review report success', {
        action: 'report.reviewed',
        reportId,
        reviewerId,
        status: input.status,
      });
      eventBus.publish('report.reviewed', {
        reportId,
        reporterId: reviewed.reporterId,
        reviewerId,
        status: reviewed.status,
      });
      return toReportResponse(reviewed);
    },
  };
}

const reportService = createReportService();

export const createReport = reportService.createReport;
export const listReports = reportService.listReports;
export const getReport = reportService.getReport;
export const reviewReport = reportService.reviewReport;
