import { UserRole } from '@prisma/client';
import { z } from 'zod';

export const UserIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const AssignRoleSchema = z.object({
  role: z.enum([UserRole.MODERATOR, UserRole.ADMIN]),
});

export const RejectVerificationSchema = z.object({
  rejectionReason: z.string().trim().min(1),
});

export const SubmitVerificationSchema = z
  .object({
    cardUrl: z
      .string()
      .trim()
      .url()
      .refine((value) => new URL(value).protocol === 'https:', {
        message: 'cardUrl must use HTTPS.',
      }),
  })
  .strict();

export type AssignRoleBody = z.infer<typeof AssignRoleSchema>;
export type RejectVerificationBody = z.infer<typeof RejectVerificationSchema>;
export type SubmitVerificationBody = z.infer<typeof SubmitVerificationSchema>;
