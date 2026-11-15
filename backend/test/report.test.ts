import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ReportReasonCategory,
  ReportStatus,
} from '@prisma/client';
import { EventBus } from '../src/shared/events/event-bus.js';
import { AppError } from '../src/shared/errors/AppError.js';
import {
  CreateReportSchema,
  ReviewReportSchema,
} from '../src/modules/report/report.schemas.js';
import {
  createReportService,
} from '../src/modules/report/report.service.js';
import type {
  ReportRecord,
  ReportRepository,
} from '../src/modules/report/report.repository.js';
import type { ReportEvents } from '../src/shared/events/report.events.js';

const now = new Date('2026-01-01T00:00:00.000Z');

function createRecord(
  overrides: Partial<ReportRecord> = {}
): ReportRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    reporterId: '00000000-0000-4000-8000-000000000002',
    reportedStudentId: '00000000-0000-4000-8000-000000000003',
    reasonCategory: ReportReasonCategory.SPAM,
    reasonNote: null,
    context: {},
    contextFingerprint: 'fingerprint',
    status: ReportStatus.CHO_DUYET,
    createdAt: now,
    updatedAt: now,
    evidences: [{
      id: '00000000-0000-4000-8000-000000000004',
      reportId: '00000000-0000-4000-8000-000000000001',
      url: 'https://evidence.example/report.png',
      position: 0,
      createdAt: now,
    }],
    histories: [],
    ...overrides,
  };
}

function createRepository(overrides: Partial<ReportRepository> = {}) {
  const record = createRecord();
  const repository: ReportRepository = {
    async createReport() {
      return record;
    },
    async findDuplicate() {
      return undefined;
    },
    async listReports() {
      return { items: [], nextCursor: undefined };
    },
    async getReport() {
      return record;
    },
    async reviewReport(_reportId, _reviewerId, input) {
      return createRecord({ status: input.status });
    },
    async studentExists() {
      return true;
    },
    ...overrides,
  };
  return repository;
}

describe('Report request validation', () => {
  it('requires HTTPS evidence URLs and a valid target', () => {
    assert.equal(
      CreateReportSchema.safeParse({
        reportedStudentId: '00000000-0000-4000-8000-000000000003',
        reasonCategory: ReportReasonCategory.SPAM,
        evidenceUrls: ['https://evidence.example/report.png'],
      }).success,
      true
    );
    assert.equal(
      CreateReportSchema.safeParse({
        reportedStudentId: '00000000-0000-4000-8000-000000000003',
        reasonCategory: ReportReasonCategory.SPAM,
        evidenceUrls: ['http://evidence.example/report.png'],
      }).success,
      false
    );
  });

  it('requires decision and action when resolving a report', () => {
    const result = ReviewReportSchema.safeParse({
      status: ReportStatus.DA_XU_LY,
    });
    assert.equal(result.success, false);
  });
});

describe('Report service', () => {
  it('rejects self-reports', async () => {
    const service = createReportService(createRepository());

    await assert.rejects(
      service.createReport('00000000-0000-4000-8000-000000000003', {
        reportedStudentId: '00000000-0000-4000-8000-000000000003',
        reasonCategory: ReportReasonCategory.SPAM,
        evidenceUrls: ['https://evidence.example/report.png'],
      }),
      (error: unknown) => error instanceof AppError && error.statusCode === 409
    );
  });

  it('creates a report and publishes a submitted event', async () => {
    const eventBus = new EventBus<ReportEvents>();
    const events: ReportEvents['report.submitted'][] = [];
    eventBus.subscribe('report.submitted', (event) => events.push(event));
    const service = createReportService(createRepository(), eventBus);

    const result = await service.createReport(
      '00000000-0000-4000-8000-000000000002',
      {
        reportedStudentId: '00000000-0000-4000-8000-000000000003',
        reasonCategory: ReportReasonCategory.SPAM,
        reasonNote: 'Repeated unsolicited messages.',
        context: {
          type: 'MESSAGE',
          id: '00000000-0000-4000-8000-000000000005',
        },
        evidenceUrls: ['https://evidence.example/report.png'],
      }
    );

    assert.equal(result.status, ReportStatus.CHO_DUYET);
    assert.deepEqual(events, [{
      reportId: '00000000-0000-4000-8000-000000000001',
      reporterId: '00000000-0000-4000-8000-000000000002',
    }]);
  });

  it('does not review a terminal report', async () => {
    const service = createReportService(createRepository({
      async getReport() {
        return createRecord({ status: ReportStatus.BAC_BO });
      },
    }));

    await assert.rejects(
      service.reviewReport(
        '00000000-0000-4000-8000-000000000006',
        '00000000-0000-4000-8000-000000000001',
        { status: ReportStatus.DA_XU_LY, decision: 'Violation', action: 'Warned' }
      ),
      (error: unknown) => error instanceof AppError && error.statusCode === 409
    );
  });
});
