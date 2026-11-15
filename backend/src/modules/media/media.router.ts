import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import * as MediaController from './media.controller.js';

const router = Router();

router.use(authenticate);
router.post('/upload-url', MediaController.createUploadUrl);

export default router;
