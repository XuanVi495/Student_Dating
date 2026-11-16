import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import * as ReportController from './report.controller.js';

const router = Router();

router.use(authenticate);
router.post('/', ReportController.createReport);
router.get(
  '/',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  ReportController.listReports
);
router.get(
  '/:reportId',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  ReportController.getReport
);
router.patch(
  '/:reportId/status',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  ReportController.reviewReport
);

export default router;
