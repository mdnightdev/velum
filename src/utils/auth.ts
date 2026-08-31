import { storage } from '../services/storageService';

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  return storage.getItem('velum-sessionId') || 
         storage.getItem('velum_sessionId') || 
         storage.getItem('session_token') ||
         sessionStorage.getItem('velum-sessionId') ||
         sessionStorage.getItem('velum_sessionId') ||
         sessionStorage.getItem('session_token') ||
         localStorage.getItem('velum-sessionId') ||
         localStorage.getItem('velum_sessionId') ||
         localStorage.getItem('session_token') ||
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
