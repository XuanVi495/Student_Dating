import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/middleware/rbac.js';
import * as UserController from './user.controller.js';

const router = Router();

router.use(authenticate);
router.get('/verification', UserController.getVerification);
router.post('/verification', UserController.submitVerification);
router.get(
  '/verification/pending',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  UserController.listPendingVerifications
);
router.get(
  '/:userId/verification',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  UserController.getVerificationForUser
);
router.put('/:userId/role', requireRole(UserRole.ADMIN), UserController.assignRole);
router.put(
  '/:userId/verification/approve',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  UserController.approveVerification
);
router.put(
  '/:userId/verification/reject',
  requireRole(UserRole.MODERATOR, UserRole.ADMIN),
  UserController.rejectVerification
);

export default router;
