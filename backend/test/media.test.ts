import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaUploadUrlSchema,
  type MediaUploadUrlBody,
} from '../src/modules/media/media.schemas.js';
import { createMediaService } from '../src/modules/media/media.service.js';
import type {
  MediaStorage,
  SignedUploadUrl,
} from '../src/supabase/storage.js';

function createStorage(
  overrides: Partial<MediaStorage> = {}
): MediaStorage & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    async createSignedUploadUrl(path) {
      paths.push(path);
      return {
        signedUrl: 'https://storage.example/upload',
        path,
        token: 'upload-token',
      };
    },
    ...overrides,
  };
}

describe('Media module', () => {
  it('accepts supported image types and rejects arbitrary input', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      assert.equal(MediaUploadUrlSchema.safeParse({ contentType }).success, true);
    }

    assert.equal(
      MediaUploadUrlSchema.safeParse({ contentType: 'application/pdf' }).success,
      false
    );
    assert.equal(
      MediaUploadUrlSchema.safeParse({
        contentType: 'image/png',
        path: 'another-users/file.png',
      }).success,
      false
    );
  });

  it('creates a unique user-scoped signed upload URL', async () => {
    const storage = createStorage();
    const service = createMediaService(storage, () => 'generated-id');
    const input: MediaUploadUrlBody = { contentType: 'image/webp' };

    const upload = await service.createUploadUrl('student-id', input);

    assert.deepEqual(storage.paths, ['student-id/generated-id.webp']);
    assert.deepEqual(upload, {
      bucket: 'media-content',
      path: 'student-id/generated-id.webp',
      signedUrl: 'https://storage.example/upload',
      token: 'upload-token',
      expiresInSeconds: 7200,
    });
  });

  it('propagates storage errors instead of returning a success-shaped response', async () => {
    const storage = createStorage({
      async createSignedUploadUrl(): Promise<SignedUploadUrl> {
        throw new Error('Storage unavailable.');
      },
    });
    const service = createMediaService(storage, () => 'generated-id');

    await assert.rejects(() =>
      service.createUploadUrl('student-id', { contentType: 'image/png' })
    );
  });
});
