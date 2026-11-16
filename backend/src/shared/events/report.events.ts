import { EventBus } from './event-bus.js';
import type { ReportStatus } from '@prisma/client';

export interface ReportSubmittedEvent {
  reportId: string;
  reporterId: string;
}

export interface ReportReviewedEvent {
  reportId: string;
  reporterId: string;
  reviewerId: string;
  status: ReportStatus;
}

export interface ReportEvents {
  'report.submitted': ReportSubmittedEvent;
  'report.reviewed': ReportReviewedEvent;
}

export const reportEventBus = new EventBus<ReportEvents>();
