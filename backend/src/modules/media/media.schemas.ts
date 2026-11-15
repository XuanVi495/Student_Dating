import { z } from 'zod';

export const MediaUploadUrlSchema = z
  .object({
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  })
  .strict();

export type MediaUploadUrlBody = z.infer<typeof MediaUploadUrlSchema>;
