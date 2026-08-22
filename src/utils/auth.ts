import { storage } from '../services/storageService';

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return storage.getItem('velum-sessionId') || 
         storage.getItem('velum_sessionId') || 
         '';
}

export function getAuthHeaders(): Record<string, string> {
  const sessionId = getSessionId();
  return {
    'Authorization': `Bearer ${sessionId}`,
    'x-session-id': sessionId,
    'Content-Type': 'application/json'
  };
}
