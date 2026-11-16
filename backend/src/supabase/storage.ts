import { AppError } from '../shared/errors/AppError.js';
import { logger } from '../shared/logger/logger.js';
import { getSupabaseAdminClient } from './supabase.js';

export const MEDIA_BUCKET = 'media-content';
export const MEDIA_UPLOAD_URL_EXPIRES_IN_SECONDS = 7200;

export interface SignedUploadUrl {
  signedUrl: string;
  path: string;
  token: string;
}

export interface MediaStorage {
  createSignedUploadUrl(path: string): Promise<SignedUploadUrl>;
}

export const mediaStorage: MediaStorage = {
  async createSignedUploadUrl(path) {
    const { data, error } = await getSupabaseAdminClient()
      .storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(path, { upsert: false });

    if (error || !data) {
      logger.error('[Media Storage] Create signed upload URL failed', {
        action: 'media.upload_url.failed',
        error: error?.message ?? 'Supabase returned no upload URL.',
      });
      throw new AppError(502, 'Unable to create a signed upload URL.');
    }

    logger.info('[Media Storage] Create signed upload URL success', {
      action: 'media.upload_url.created',
      path,
    });
    
    return {
      signedUrl: data.signedUrl,
      path: data.path,
      token: data.token,
    };
  },
};