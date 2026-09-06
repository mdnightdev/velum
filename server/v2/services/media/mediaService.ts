import fs from 'fs';
import path from 'path';
import { eq, sql } from 'drizzle-orm';
import { db, executeWithRetry } from '../../db/client.js';
import { mediaAssets, type MediaAsset, type NewMediaAsset } from '../../db/schema/media.js';
import { logger } from '../../utils/logger.js';

export class MediaService {
  /**
   * Records a successfully stored media asset in the media_assets table.
   */
  async recordAsset(data: {
    uploaderId: number;
    storageKey: string;
    relativePath: string;
    mimeType: string;
    byteSize: number;
    category: 'avatar' | 'chat' | 'general';
    sha256?: string;
  }): Promise<MediaAsset> {
    return executeWithRetry(async () => {
      const [record] = await db
        .insert(mediaAssets)
        .values({
          uploaderId: data.uploaderId,
          storageKey: data.storageKey,
          relativePath: data.relativePath,
          mimeType: data.mimeType,
          byteSize: data.byteSize,
          category: data.category,
          sha256: data.sha256 || null
        })
        .returning();
      return record;
    });
  }

  /**
   * Deletes a physical file and its tracking record from disk and database.
   */
  async deleteAssetByPath(relativePath: string): Promise<boolean> {
    try {
      // 1. Delete physical file from public/uploads
      const cleaned = relativePath.replace(/^\/+/, '');
      const fullPath = path.join(process.cwd(), 'public', cleaned);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath).catch(err => {
          logger.warn('[MEDIA] Failed to remove physical file', { fullPath, error: (err as Error).message });
        });
      }

      // 2. Remove DB record
      await executeWithRetry(async () => {
        await db.delete(mediaAssets).where(eq(mediaAssets.relativePath, relativePath));
      });

      return true;
    } catch (err) {
      logger.error('[MEDIA] deleteAssetByPath error', { relativePath, error: (err as Error).message });
      return false;
    }
  }

  /**
   * Extracts referenced media upload paths from message text or attachment payload.
   * Matches paths like /uploads/chat/YYYY-MM/xxx or /uploads/media/xxx.
   */
  extractMediaPaths(content: string): string[] {
    if (!content || typeof content !== 'string') return [];
    const matches = content.match(/\/uploads\/(?:chat\/\d{4}-\d{2}\/|media\/|avatars\/)[a-zA-Z0-9_.-]+/g);
    return matches ? Array.from(new Set(matches)) : [];
  }
}

export const mediaService = new MediaService();
