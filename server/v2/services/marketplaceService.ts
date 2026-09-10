import { moderationService } from './moderationService.js';

/**
 * @deprecated Prefer moderationService.scanListingContent.
 * Kept as a thin wrapper so older call sites keep compiling.
 */
export function scanContent(title: string, description: string): boolean {
  return moderationService.scanListingContent(`${title} ${description || ''}`) != null;
}
