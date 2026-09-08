/**
 * Resolves the target peer user ID from a DM roomId (e.g., 'dm_1022', 'dm_1001_1022', 'dm_velum_123').
 */
export function parseDmPeerId(roomId?: string | null, currentUserId?: number | null): number | null {
  if (!roomId || typeof roomId !== 'string' || !roomId.startsWith('dm_')) return null;
  if (roomId.startsWith('dm_velum_') || roomId === 'dm_999') return 999;
  const parts = roomId.replace('dm_', '').split('_').map(Number).filter(n => !isNaN(n));
  if (parts.length === 1) return parts[0];
  if (parts.length >= 2) {
    if (currentUserId !== undefined && currentUserId !== null && parts[0] === currentUserId) {
      return parts[1];
    }
    return parts[0];
  }
  return null;
}
