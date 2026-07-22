import { ClientDiagnosticLog } from '../types';
import { FULL_BUILD_VERSION } from '../version';

// Global error listener to track recent uncaught exceptions
if (typeof window !== 'undefined') {
  (window as any).__velum_error_buffer = (window as any).__velum_error_buffer || [];

  window.addEventListener('error', (event) => {
    try {
      const buffer = (window as any).__velum_error_buffer;
      buffer.push({
        message: event.message || 'Unknown window error',
        source: event.filename || '',
        lineno: event.lineno || 0,
        timestamp: new Date().toISOString()
      });
      if (buffer.length > 15) buffer.shift();
    } catch (_) {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const buffer = (window as any).__velum_error_buffer;
      buffer.push({
        message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        source: 'promise',
        timestamp: new Date().toISOString()
      });
      if (buffer.length > 15) buffer.shift();
    } catch (_) {}
  });
}

export function collectClientDiagnosticsPayload(notes?: string): Partial<ClientDiagnosticLog> {
  let localStorageKeyCount = 0;
  let localStorageSizeKb = 0;

  try {
    localStorageKeyCount = localStorage.length;
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        totalChars += k.length + (localStorage.getItem(k) || '').length;
      }
    }
    localStorageSizeKb = Math.round((totalChars * 2) / 1024 * 10) / 10;
  } catch (_) {}

  const swActive = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  const idbSupported = typeof window !== 'undefined' && !!window.indexedDB;
  const connectionType = typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || 'unknown' : 'unknown';
  const errorBuffer = typeof window !== 'undefined' ? (window as any).__velum_error_buffer || [] : [];

  return {
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Unknown',
    screen_resolution: typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '0x0',
    device_pixel_ratio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    viewport_size: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '0x0',
    online_status: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connection_type: connectionType,
    storage_summary: {
      localStorage_keys_count: localStorageKeyCount,
      localStorage_approx_size_kb: localStorageSizeKb,
      serviceWorker_active: swActive,
      indexedDb_supported: idbSupported
    },
    error_buffer: errorBuffer,
    app_version: FULL_BUILD_VERSION,
    notes: notes || ''
  };
}

export async function submitDiagnosticLogs(notes?: string): Promise<{ success: boolean; log_id?: string; error?: string }> {
  try {
    const payload = collectClientDiagnosticsPayload(notes);
    const token = typeof window !== 'undefined' 
      ? (sessionStorage.getItem('velum-sessionId') || localStorage.getItem('velum_token') || localStorage.getItem('velum_admin_token') || '')
      : '';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-session-id'] = token;
    }

    const response = await fetch('/api/support/diagnostics', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to submit diagnostics.' };
    }

    return { success: true, log_id: data.log_id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network exception transmitting log payload.' };
  }
}
