export interface OtaManifest {
  version: string;
  buildTime: string;
  bundleHash?: string;
  bundleUrl?: string;
  sizeBytes?: number;
}

export interface OtaStatus {
  isChecking: boolean;
  updateAvailable: boolean;
  currentBuildTime: string;
  latestBuildTime?: string;
  error?: string | null;
}

const STORAGE_KEY = 'velum_installed_build_time';

export function getCurrentBuildTime(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return import.meta.env.VITE_BUILD_TIME || '2026-08-23T00:00:00.000Z';
}

export async function checkOtaUpdate(): Promise<{
  updateAvailable: boolean;
  manifest?: OtaManifest;
  error?: string;
}> {
  try {
    const res = await fetch(`/v2/ota/manifest?_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!res.ok) {
      return { updateAvailable: false, error: 'Server returned error' };
    }
    const manifest: OtaManifest = await res.json();
    const current = getCurrentBuildTime();

    if (!manifest.buildTime) {
      return { updateAvailable: false };
    }

    const isNewer = new Date(manifest.buildTime).getTime() > new Date(current).getTime();
    return { updateAvailable: isNewer, manifest };
  } catch (err) {
    return { updateAvailable: false, error: (err as Error).message };
  }
}

export async function applyOtaUpdate(manifest: OtaManifest): Promise<void> {
  try {
    // 1. Clear obsolete cache storage entries
    if (typeof window !== 'undefined' && window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    // 2. Persist new build time
    localStorage.setItem(STORAGE_KEY, manifest.buildTime);

    // 3. Trigger clean reload
    window.location.reload();
  } catch (err) {
    console.error('[OTA] Failed to apply update:', err);
    window.location.reload();
  }
}
