import { Request, Response } from 'express';
import { getSecureUploadAssetConfig } from '../services/storageService.js';

export const requestMediaUploadToken = async (req: Request, res: Response) => {
  try {
    const { extension, type } = req.body; // Expectations: { extension: "m4a", type: "media" }
    const user = (req as any).user;
    if (!user || !user.user_id) {
      return res.status(401).json({ error: "Unauthorized: User session invalid" });
    }

    const userId = String(user.user_id);

    if (type !== 'avatars' && type !== 'media') {
      return res.status(400).json({ error: "Invalid storage destination scope" });
    }

    if (!extension || typeof extension !== 'string') {
      return res.status(400).json({ error: "Invalid file extension" });
    }

    const config = await getSecureUploadAssetConfig(userId, type, extension);
    return res.status(200).json(config);
  } catch (err) {
    return res.status(500).json({ error: "Failed to compile storage transaction lease ticket" });
  }
};
