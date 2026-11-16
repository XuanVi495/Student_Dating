import type { Request, Response, NextFunction } from 'express';
import {
  AssignRoleSchema,
  RejectVerificationSchema,
  SubmitVerificationSchema,
  UserIdParamsSchema,
} from './user.schemas.js';
import * as UserService from './user.service.js';

export function createUserController(
  service: Pick<
    typeof UserService,
    | 'getVerification'
    | 'submitVerification'
    | 'listPendingVerifications'
    | 'assignRole'
    | 'approveVerification'
    | 'rejectVerification'
  > = UserService
) {
  return {
    async getVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const verification = await service.getVerification(req.user!.id);
        res.status(200).json({ status: 'success', data: verification });
      } catch (err) {
        next(err);
      }
    },
    async getVerificationForUser(
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const { userId } = UserIdParamsSchema.parse(req.params);
        const verification = await service.getVerification(userId);
        res.status(200).json({ status: 'success', data: verification });
      } catch (err) {
        next(err);
      }
    },
    async submitVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { cardUrl } = SubmitVerificationSchema.parse(req.body);
        const verification = await service.submitVerification(req.user!.id, cardUrl);
        res.status(200).json({ status: 'success', data: verification });
      } catch (err) {
        next(err);
      }
    },
    async listPendingVerifications(
      _req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> {
      try {
        const verifications = await service.listPendingVerifications();
        res.status(200).json({ status: 'success', data: verifications });
      } catch (err) {
        next(err);
      }
    },
    async assignRole(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { userId } = UserIdParamsSchema.parse(req.params);
        const { role } = AssignRoleSchema.parse(req.body);
        const assignment = await service.assignRole(req.user!.id, userId, role);

        res.status(200).json({
          status: 'success',
          data: assignment,
        });
      } catch (err) {
        next(err);
      }
    },
    async approveVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { userId } = UserIdParamsSchema.parse(req.params);
        const verification = await service.approveVerification(req.user!.id, userId);

        res.status(200).json({
          status: 'success',
          data: verification,
        });
      } catch (err) {
        next(err);
      }
    },
    async rejectVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const { userId } = UserIdParamsSchema.parse(req.params);
        const { rejectionReason } = RejectVerificationSchema.parse(req.body);
        const verification = await service.rejectVerification(
          req.user!.id,
          userId,
          rejectionReason
        );

        res.status(200).json({
          status: 'success',
          data: verification,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

const userController = createUserController();

export const {
  getVerification,
  getVerificationForUser,
  submitVerification,
  listPendingVerifications,
  assignRole,
  approveVerification,
  rejectVerification,
} = userController;
