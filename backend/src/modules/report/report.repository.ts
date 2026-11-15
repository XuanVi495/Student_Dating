import {
  ReportReasonCategory,
  ReportStatus,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma as defaultPrisma } from '../../database/prisma.js';
import type { CreateReportBody, ListReportsQuery, ReviewReportBody } from './report.schemas.js';

const reportInclude = {
  evidences: {
    orderBy: { position: 'asc' },
  },
  histories: {
    orderBy: { processedAt: 'asc' },
  },
} satisfies Prisma.ReportInclude;

export type ReportRecord = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

export interface ReportRepository {
  createReport(input: {
    reporterId: string;
    reportedStudentId: string;
    reasonCategory: CreateReportBody['reasonCategory'];
    reasonNote?: string;
    context: Record<string, unknown>;
    contextFingerprint: string;
    evidenceUrls: readonly string[];
  }): Promise<ReportRecord>;
  findDuplicate(
    reporterId: string,
    reportedStudentId: string,
    contextFingerprint: string
  ): Promise<ReportRecord | undefined>;
  listReports(
    status: ListReportsQuery['status'],
    limit: number,
    cursor?: string
  ): Promise<{ items: readonly ReportRecord[]; nextCursor?: string }>;
  getReport(reportId: string): Promise<ReportRecord | undefined>;
  reviewReport(
    reportId: string,
    reviewerId: string,
    input: ReviewReportBody
  ): Promise<ReportRecord | undefined>;
  studentExists(studentId: string): Promise<boolean>;
}

export function createReportRepository(
  db: PrismaClient = defaultPrisma
): ReportRepository {
  return {
    async createReport(input) {
      return db.report.create({
        data: {
          reporterId: input.reporterId,
          reportedStudentId: input.reportedStudentId,
          reasonCategory: input.reasonCategory as ReportReasonCategory,
          reasonNote: input.reasonNote,
          context: input.context as Prisma.InputJsonValue,
          contextFingerprint: input.contextFingerprint,
          evidences: {
            create: input.evidenceUrls.map((url, position) => ({ url, position })),
          },
        },
        include: reportInclude,
      });
    },

    async findDuplicate(reporterId, reportedStudentId, contextFingerprint) {
      return (await db.report.findFirst({
        where: {
          reporterId,
          reportedStudentId,
          contextFingerprint,
          status: {
            in: [ReportStatus.CHO_DUYET, ReportStatus.DANG_XU_LY],
          },
        },
        include: reportInclude,
      })) ?? undefined;
    },

    async listReports(status, limit, cursor) {
      const records = await db.report.findMany({
        where: {
          status: status ?? {
            in: [ReportStatus.CHO_DUYET, ReportStatus.DANG_XU_LY],
          },
        },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: reportInclude,
      });
      const hasMore = records.length > limit;
      const items = hasMore ? records.slice(0, limit) : records;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : undefined,
      };
    },

    async getReport(reportId) {
      return (await db.report.findUnique({
        where: { id: reportId },
        include: reportInclude,
      })) ?? undefined;
    },

    async reviewReport(reportId, reviewerId, input) {
      return db.$transaction(async (transaction) => {
        const current = await transaction.report.findUnique({
          where: { id: reportId },
          select: { status: true },
        });
        if (!current) {
          return undefined;
        }
        if (
          current.status !== ReportStatus.CHO_DUYET &&
          current.status !== ReportStatus.DANG_XU_LY
        ) {
          return undefined;
        }

        const updated = await transaction.report.updateMany({
          where: {
            id: reportId,
            status: current.status,
          },
          data: { status: input.status },
        });
        if (updated.count === 0) return undefined;

        await transaction.reportHistory.create({
          data: {
            reportId,
            reviewerId,
            fromStatus: current.status,
            toStatus: input.status,
            decision: input.decision,
            action: input.action,
            note: input.note,
          },
        });

        const report = await transaction.report.findUnique({
          where: { id: reportId },
          include: reportInclude,
        });
        return report ?? undefined;
      });
    },

    async studentExists(studentId) {
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: { id: true },
      });
      return student !== null;
    },
  };
}

export const reportRepository = createReportRepository();
