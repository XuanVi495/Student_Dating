import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger/logger.js';
import {
  MEDIA_BUCKET,
  MEDIA_UPLOAD_URL_EXPIRES_IN_SECONDS,
  mediaStorage,
  type MediaStorage,
} from '../../supabase/storage.js';
import type { MediaUploadUrlBody } from './media.schemas.js';

const extensionByContentType = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export function createMediaService(
  storage: MediaStorage = mediaStorage,
  createObjectId: () => string = randomUUID
) {
  async function createUploadUrl(studentId: string, input: MediaUploadUrlBody) {
    const extension = extensionByContentType[input.contentType];
    if (!extension) {
      throw new AppError(422, 'Unsupported media content type.');
    }

    const objectPath = `${studentId}/${createObjectId()}.${extension}`;
    const upload = await storage.createSignedUploadUrl(objectPath);

    logger.info('[Media Service] Create signed upload URL success', {
      action: 'media.upload_url.created',
      studentId,
    });

    return {
      bucket: MEDIA_BUCKET,
      path: upload.path,
      signedUrl: upload.signedUrl,
      token: upload.token,
      expiresInSeconds: MEDIA_UPLOAD_URL_EXPIRES_IN_SECONDS,
    };
  }

  return { createUploadUrl };
}

const mediaService = createMediaService();

export const createUploadUrl = mediaService.createUploadUrl;
