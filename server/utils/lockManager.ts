import { Mutex } from './mutex.js';

const locks = new Map<number, Mutex>();

export function getLockForUser(userId: number): Mutex {
  if (!locks.has(userId)) {
    locks.set(userId, new Mutex());
  }
  return locks.get(userId)!;
}
