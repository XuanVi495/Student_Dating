import { ReportReasonCategory, ReportStatus } from '@prisma/client';
import { z } from 'zod';

const ReportContextSchema = z
  .object({
    type: z.enum(['PROFILE', 'MESSAGE', 'CONVERSATION', 'INTERACTION', 'MATCH', 'OTHER']),
    id: z.string().uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const HttpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === 'https:', {
    message: 'Evidence URLs must use HTTPS.',
  });

export const CreateReportSchema = z
  .object({
    reportedStudentId: z.string().uuid(),
    reasonCategory: z.enum([
      ReportReasonCategory.QUAY_ROI,
      ReportReasonCategory.NOI_DUNG_KHONG_PHU_HOP,
      ReportReasonCategory.LUA_DAO,
      ReportReasonCategory.GIA_MAO,
      ReportReasonCategory.SPAM,
      ReportReasonCategory.KHAC,
    ]),
    reasonNote: z.string().trim().min(1).max(2000).optional(),
    context: ReportContextSchema.optional(),
    evidenceUrls: z.array(HttpsUrlSchema).min(1).max(5),
  })
  .strict();

export const ReportIdParamsSchema = z.object({
  reportId: z.string().uuid(),
});

export const ListReportsQuerySchema = z.object({
  status: z
    .enum([
      ReportStatus.CHO_DUYET,
      ReportStatus.DANG_XU_LY,
      ReportStatus.DA_XU_LY,
      ReportStatus.BAC_BO,
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export const ReviewReportSchema = z
  .object({
    status: z.enum([
      ReportStatus.DANG_XU_LY,
      ReportStatus.DA_XU_LY,
      ReportStatus.BAC_BO,
    ]),
    decision: z.string().trim().min(1).max(2000).optional(),
    action: z.string().trim().min(1).max(2000).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === ReportStatus.DA_XU_LY) {
      if (!value.decision) {
        context.addIssue({
          code: 'custom',
          path: ['decision'],
          message: 'A decision is required when resolving a report.',
        });
      }
      if (!value.action) {
        context.addIssue({
          code: 'custom',
          path: ['action'],
          message: 'An action is required when resolving a report.',
        });
      }
    }
  });

export type CreateReportBody = z.infer<typeof CreateReportSchema>;
export type ListReportsQuery = z.infer<typeof ListReportsQuerySchema>;
export type ReviewReportBody = z.infer<typeof ReviewReportSchema>;
