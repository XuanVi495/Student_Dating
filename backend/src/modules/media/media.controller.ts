import type { NextFunction, Request, Response } from 'express';
import { MediaUploadUrlSchema } from './media.schemas.js';
import * as MediaService from './media.service.js';

export async function createUploadUrl(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = MediaUploadUrlSchema.parse(req.body);
    const upload = await MediaService.createUploadUrl(req.user!.id, body);
    res.status(200).json({ status: 'success', data: upload });
  } catch (error) {
    next(error);
  }
}
