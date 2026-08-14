import { useState, useEffect, useCallback } from 'react';
import { createLogger } from '../utils/logger';

const log = createLogger('useBuildVersion');

export interface BuildVersionInfo {
  version: string;
  buildNumber: number;
  fullVersion: string;
  displayVersion: string;
  status: string;
  buildStage: string;
  buildChannel: string;
  timestamp: string;
  isLoading: boolean;
}

const DEFAULT_VERSION: BuildVersionInfo = {
  version: '1.0.0',
  buildNumber: 1,
  fullVersion: 'v1.0.0.b1',
  displayVersion: 'v1.0.0.1',
  status: 'OPTIMAL',
  buildStage: 'Release Stream',
  buildChannel: 'Production',
  timestamp: new Date().toISOString(),
  isLoading: false,
};

export function useBuildVersion() {
  const [versionInfo, setVersionInfo] = useState<BuildVersionInfo>(DEFAULT_VERSION);

  const fetchVersion = useCallback(async () => {
    try {
      const res = await fetch('/v2/public/version');
      if (res.ok) {
        const data = await res.json();
        const ver = data.version || '1.0.0';
        const num = data.buildNumber || data.latestIncrement || 1;
        setVersionInfo({
          version: ver,
          buildNumber: num,
          fullVersion: data.fullVersion || `v${ver}.b${num}`,
          displayVersion: data.displayVersion || `v${ver}.${num}`,
          status: data.status || 'OPTIMAL',
          buildStage: data.buildStage || 'Release Stream',
          buildChannel: data.buildChannel || 'Production',
          timestamp: data.timestamp || new Date().toISOString(),
          isLoading: false,
        });
      }
    } catch (err) {
      log.warn('Failed to fetch build version info', { error: (err as Error).message });
      setVersionInfo(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const incrementBuildVersion = useCallback(async () => {
    try {
      const res = await fetch('/v2/public/version/increment', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setVersionInfo({
          version: data.version,
          buildNumber: data.buildNumber,
          fullVersion: data.fullVersion,
          displayVersion: data.displayVersion,
          status: data.status,
          buildStage: data.buildStage,
          buildChannel: data.buildChannel,
          timestamp: data.timestamp,
          isLoading: false,
        });
      }
    } catch (err) {
      log.warn('Failed to increment build version', { error: (err as Error).message });
    }
  }, []);

  useEffect(() => {
    fetchVersion();
  }, [fetchVersion]);

  return {
    ...versionInfo,
    refreshVersion: fetchVersion,
    incrementBuildVersion,
  };
}
