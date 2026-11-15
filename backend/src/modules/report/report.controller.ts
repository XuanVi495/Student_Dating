import type { NextFunction, Request, Response } from 'express';
import {
  CreateReportSchema,
  ListReportsQuerySchema,
  ReportIdParamsSchema,
  ReviewReportSchema,
} from './report.schemas.js';
import * as ReportService from './report.service.js';

export function createReportController(
  service: Pick<
    typeof ReportService,
    'createReport' | 'listReports' | 'getReport' | 'reviewReport'
  > = ReportService
) {
  return {
    async createReport(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const input = CreateReportSchema.parse(req.body);
        const report = await service.createReport(req.user!.id, input);
        res.status(201).json({ status: 'success', data: report });
      } catch (error) {
        next(error);
      }
    },

    async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = ListReportsQuerySchema.parse(req.query);
        const reports = await service.listReports(query);
        res.status(200).json({ status: 'success', data: reports });
      } catch (error) {
        next(error);
      }
    },

    async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { reportId } = ReportIdParamsSchema.parse(req.params);
        const report = await service.getReport(reportId);
        res.status(200).json({ status: 'success', data: report });
      } catch (error) {
        next(error);
      }
    },

    async reviewReport(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { reportId } = ReportIdParamsSchema.parse(req.params);
        const input = ReviewReportSchema.parse(req.body);
        const report = await service.reviewReport(req.user!.id, reportId, input);
        res.status(200).json({ status: 'success', data: report });
      } catch (error) {
        next(error);
      }
    },
  };
}

const reportController = createReportController();

export const {
  createReport,
  listReports,
  getReport,
  reviewReport,
} = reportController;
