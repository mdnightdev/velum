type OnTypingExpiredCallback = (roomId: string, userId: number, username: string) => void;

interface TypingState {
  userId: number;
  username: string;
  roomId: string;
  timer: NodeJS.Timeout;
}

class TypingDebouncerManager {
  private activeTypers: Map<string, TypingState> = new Map();
  private expirationCallback: OnTypingExpiredCallback | null = null;

  public setExpirationCallback(cb: OnTypingExpiredCallback) {
    this.expirationCallback = cb;
  }

  private getKey(roomId: string, userId: number): string {
    return `${roomId}:${userId}`;
  }

  /**
   * Register or extend typing indicator for a user in a room.
   * Resets 3-second automatic expiration timer.
   */
  public registerTyping(roomId: string, userId: number, username: string, ttlMs = 3000): void {
    const key = this.getKey(roomId, userId);
    const existing = this.activeTypers.get(key);

    if (existing) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      this.clearTyping(roomId, userId, true);
    }, ttlMs);

    this.activeTypers.set(key, {
      userId,
      username,
      roomId,
      timer
    });
  }

  /**
   * Explicitly stop typing or clear on expiration.
   */
  public clearTyping(roomId: string, userId: number, triggeredByTimeout = false): void {
    const key = this.getKey(roomId, userId);
    const state = this.activeTypers.get(key);

    if (state) {
      clearTimeout(state.timer);
      this.activeTypers.delete(key);

      if (triggeredByTimeout && this.expirationCallback) {
        this.expirationCallback(roomId, userId, state.username);
      }
    }
  }

  /**
   * Clean up all active typing states for a user across all rooms (e.g. on socket disconnect).
   */
  public handleUserDisconnect(userId: number): { roomId: string; username: string }[] {
    const expired: { roomId: string; username: string }[] = [];

    for (const [key, state] of this.activeTypers.entries()) {
      if (state.userId === userId) {
        clearTimeout(state.timer);
        this.activeTypers.delete(key);
        expired.push({ roomId: state.roomId, username: state.username });
      }
    }

    return expired;
  }

  /**
   * Get active typers for a room.
   */
  public getActiveTypers(roomId: string): { userId: number; username: string }[] {
    const list: { userId: number; username: string }[] = [];
    for (const state of this.activeTypers.values()) {
      if (state.roomId === roomId) {
        list.push({ userId: state.userId, username: state.username });
      }
    }
    return list;
  }
}

export const typingDebouncer = new TypingDebouncerManager();
