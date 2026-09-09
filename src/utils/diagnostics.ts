import { ClientDiagnosticLog } from '../types';
import { FULL_BUILD_VERSION } from '../version';
import { getSessionId } from './auth';
import { storage } from '../services/storageService';

type ErrorBufferEntry = {
  message: string;
  source?: string;
  lineno?: number;
  timestamp: string;
};

let buffersInstalled = false;
let autoSubmitTimer: ReturnType<typeof setTimeout> | null = null;
let lastAutoSubmitAt = 0;
const AUTO_SUBMIT_MIN_MS = 30_000;

function getErrorBuffer(): ErrorBufferEntry[] {
  if (typeof window === 'undefined') return [];
  (window as any).__velum_error_buffer = (window as any).__velum_error_buffer || [];
  return (window as any).__velum_error_buffer;
}

function pushError(entry: ErrorBufferEntry) {
  try {
    const buffer = getErrorBuffer();
    buffer.push(entry);
    if (buffer.length > 50) buffer.shift();
  } catch {
    /* ignore */
  }
}

async function probeIndexedDbOpen(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('__velum_diag_probe__');
      req.onsuccess = () => {
        try {
          req.result.close();
          indexedDB.deleteDatabase('__velum_diag_probe__');
        } catch {
          /* ignore */
        }
        resolve(true);
      };
      req.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 1500);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Install global diagnostic buffers once at app boot (main.tsx).
 * Safe to call multiple times.
 */
export function installDiagnosticBuffers(): void {
  if (typeof window === 'undefined' || buffersInstalled) return;
  buffersInstalled = true;
  getErrorBuffer();

  window.addEventListener('error', (event) => {
    pushError({
      message: event.message || 'Unknown window error',
      source: event.filename || '',
      lineno: event.lineno || 0,
      timestamp: new Date().toISOString(),
    });
    scheduleAutoDiagnosticSubmit('auto', 'CLIENT_WINDOW_ERROR');
  });

  window.addEventListener('unhandledrejection', (event) => {
    pushError({
      message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
      source: 'promise',
      timestamp: new Date().toISOString(),
    });
    scheduleAutoDiagnosticSubmit('auto', 'CLIENT_UNHANDLED_REJECTION');
  });

  const originalConsoleError = console.error;
  console.error = function (...args) {
    pushError({
      message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
      source: 'console.error',
      timestamp: new Date().toISOString(),
    });
    originalConsoleError.apply(console, args);
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    try {
      const response = await originalFetch(...args);
      if (!response.ok) {
        const url =
          typeof args[0] === 'string'
            ? args[0]
            : args[0] && (args[0] as Request).url
              ? (args[0] as Request).url
              : 'unknown';
        // Skip our own diagnostic endpoints to avoid feedback loops
        if (!String(url).includes('/support/diagnostics') && !String(url).includes('/support/client-ops')) {
          pushError({
            message: `HTTP ${response.status}: ${url}`,
            source: 'fetch',
            timestamp: new Date().toISOString(),
          });
          if (response.status === 401 && String(url).includes('/prekeys')) {
            void reportClientOpsEvent({
              severity: 'red',
              code: 'CLIENT_PREKEY_401',
              message: 'Prekey publish/fetch returned 401',
              component: 'e2ee',
            });
          }
        }
      }
      return response;
    } catch (err: any) {
      const url =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] && (args[0] as Request).url
            ? (args[0] as Request).url
            : 'unknown';
      if (!String(url).includes('/support/diagnostics') && !String(url).includes('/support/client-ops')) {
        pushError({
          message: `Fetch Error: ${err.message} on ${url}`,
          source: 'fetch',
          timestamp: new Date().toISOString(),
        });
      }
      throw err;
    }
  };
}

export async function collectClientDiagnosticsPayload(notes?: string): Promise<Partial<ClientDiagnosticLog>> {
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
    localStorageSizeKb = Math.round(((totalChars * 2) / 1024) * 10) / 10;
  } catch {
    /* ignore */
  }

  const swActive = typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
  const idbSupported = typeof window !== 'undefined' && !!window.indexedDB;
  const idbOpenOk = await probeIndexedDbOpen();
  const connectionType =
    typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || 'unknown' : 'unknown';
  const errorBuffer = getErrorBuffer().slice(-20);
  const dbg = typeof window !== 'undefined' ? window.velumDebug : undefined;

  const stateSnapshot = {
    websocket_connected: !!(dbg?.wsConnected ?? (typeof window !== 'undefined' && (window as any).__velum_ws_connected)),
    active_view: typeof window !== 'undefined' ? storage.getItem<string>('velum_active_view') || 'unknown' : 'unknown',
    auth_tier: typeof window !== 'undefined' ? storage.getItem<string>('velum_auth_tier') || 'unknown' : 'unknown',
    reconnect_count: dbg?.reconnectCount ?? 0,
    active_room_id: dbg?.activeRoomId ?? null,
    last_ws_event_ts: dbg?.lastServerEventTimestamp || dbg?.lastMessageTimestamp || null,
    indexeddb_open_ok: idbOpenOk,
    e2ee_publish_status: dbg?.e2eePublishStatus || 'unknown',
  };

  return {
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Unknown',
    screen_resolution:
      typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '0x0',
    device_pixel_ratio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    viewport_size: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '0x0',
    online_status: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connection_type: connectionType,
    storage_summary: {
      localStorage_keys_count: localStorageKeyCount,
      localStorage_approx_size_kb: localStorageSizeKb,
      serviceWorker_active: swActive,
      indexedDb_supported: idbSupported,
    },
    error_buffer: errorBuffer,
    state_snapshot: stateSnapshot,
    app_version: FULL_BUILD_VERSION,
    notes: notes || '',
  };
}

export async function submitDiagnosticLogs(
  notes?: string,
  opts?: { source?: 'manual' | 'auto' | 'error_boundary'; severity?: 'amber' | 'red' }
): Promise<{ success: boolean; log_id?: string; error?: string }> {
  try {
    const payload = await collectClientDiagnosticsPayload(notes);
    const token = getSessionId();
    if (!token) {
      return { success: false, error: 'Not authenticated.' };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-session-id': token,
    };

    const response = await fetch('/v2/support/diagnostics', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        source: opts?.source || 'manual',
        severity: opts?.severity || 'red',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error || 'Submission Failed.' };
    }

    return { success: true, log_id: data.log_id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error.' };
  }
}

function scheduleAutoDiagnosticSubmit(source: 'auto' | 'error_boundary', code: string) {
  if (autoSubmitTimer) clearTimeout(autoSubmitTimer);
  autoSubmitTimer = setTimeout(() => {
    void maybeAutoSubmit(source, code);
  }, 800);
}

async function maybeAutoSubmit(source: 'auto' | 'error_boundary', code: string) {
  const now = Date.now();
  if (now - lastAutoSubmitAt < AUTO_SUBMIT_MIN_MS) return;
  if (!getSessionId()) return;
  lastAutoSubmitAt = now;
  await submitDiagnosticLogs(`[auto] ${code}`, { source, severity: 'red' });
}

/** Called from ErrorBoundary.componentDidCatch */
export function reportErrorBoundary(error: Error, componentStack?: string) {
  pushError({
    message: error.message || 'ErrorBoundary',
    source: 'ErrorBoundary',
    timestamp: new Date().toISOString(),
  });
  if (componentStack) {
    pushError({
      message: componentStack.slice(0, 800),
      source: 'ErrorBoundary.stack',
      timestamp: new Date().toISOString(),
    });
  }
  scheduleAutoDiagnosticSubmit('error_boundary', 'CLIENT_ERROR_BOUNDARY');
}

/** Soft amber / red client ops (no message bodies). */
export async function reportClientOpsEvent(input: {
  severity: 'amber' | 'red';
  code: string;
  message: string;
  component?: string;
}): Promise<void> {
  try {
    const token = getSessionId();
    if (!token) return;
    const dbg = typeof window !== 'undefined' ? window.velumDebug : undefined;
    await fetch('/v2/support/client-ops', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-session-id': token,
      },
      body: JSON.stringify({
        ...input,
        buildVersion: FULL_BUILD_VERSION,
        reconnectCount: dbg?.reconnectCount ?? 0,
      }),
    });
  } catch {
    /* ignore */
  }
}
