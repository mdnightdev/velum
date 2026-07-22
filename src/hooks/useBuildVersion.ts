import { useState, useEffect, useCallback } from 'react';

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
  version: '2.1.51',
  buildNumber: 1052,
  fullVersion: 'v2.1.51-b1052',
  displayVersion: 'v2.1.51.1052',
  status: 'OPTIMAL',
  buildStage: 'Release Candidate Stream',
  buildChannel: 'Production',
  timestamp: new Date().toISOString(),
  isLoading: true,
};

export function useBuildVersion() {
  const [versionInfo, setVersionInfo] = useState<BuildVersionInfo>(DEFAULT_VERSION);

  const fetchVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/public/version');
      if (res.ok) {
        const data = await res.json();
        setVersionInfo({
          version: data.version || '2.1.51',
          buildNumber: data.buildNumber || 1052,
          fullVersion: data.fullVersion || `v${data.version || '2.1.51'}-b${data.buildNumber || 1052}`,
          displayVersion: data.displayVersion || `v${data.version || '2.1.51'}.${data.buildNumber || 1052}`,
          status: data.status || 'OPTIMAL',
          buildStage: data.buildStage || 'Release Candidate Stream',
          buildChannel: data.buildChannel || 'Production',
          timestamp: data.timestamp || new Date().toISOString(),
          isLoading: false,
        });
      }
    } catch (err) {
      console.warn('Failed to fetch build version info:', err);
      setVersionInfo(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const incrementBuildVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/public/version/increment', { method: 'POST' });
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
      console.warn('Failed to increment build version:', err);
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
