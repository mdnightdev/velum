import express from 'express';
import { authenticateUser } from '../middleware.js';
import { requestMediaUploadToken } from '../controllers/storage.js';

export const storageRouter = express.Router();

storageRouter.post('/storage/upload-token', authenticateUser, requestMediaUploadToken);
