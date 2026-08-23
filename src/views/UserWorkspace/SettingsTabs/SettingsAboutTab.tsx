import React, { useState } from 'react';
import { RefreshCw, CheckCircle, ArrowDownCircle } from 'lucide-react';
import logoSvg from '../../../assets/logo.svg?raw';
import { FULL_BUILD_VERSION } from '../../../version';
import { getCurrentBuildTime, checkOtaUpdate, applyOtaUpdate, OtaManifest } from '../../../utils/otaUpdater';

export function SettingsAboutTab() {
  const [isChecking, setIsChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<OtaManifest | null>(null);
  const currentBuild = getCurrentBuildTime();

  const handleCheckUpdate = async () => {
    setIsChecking(true);
    setStatusMsg(null);
    setAvailableUpdate(null);
    try {
      const result = await checkOtaUpdate();
      if (result.updateAvailable && result.manifest) {
        setAvailableUpdate(result.manifest);
        setStatusMsg('New update available.');
      } else {
        setStatusMsg('App is up to date.');
      }
    } catch {
      setStatusMsg('Unable to check for updates.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleApply = async () => {
    if (!availableUpdate) return;
    setStatusMsg('Applying update...');
    await applyOtaUpdate(availableUpdate);
  };

  return (
    <div className="w-full max-w-4xl space-y-8">
      <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
        About Velum
      </h3>
      <div className="p-8 rounded-xl border border-white-5 bg-velum-750/50 flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-velum-800 border border-white/10 flex items-center justify-center">
          <div 
            className="w-9 h-9 [&>svg]:w-full [&>svg]:h-full text-accent" 
            dangerouslySetInnerHTML={{ __html: logoSvg }} 
          />
        </div>
        <div>
          <div className="text-xl font-bold tracking-[0.2em] text-text-primary">VELUM</div>
          <div className="text-[10px] text-text-secondary font-mono tracking-widest mt-1">
            Secure conversations, refined.
          </div>
        </div>

        <div className="pt-2 w-full space-y-1">
          <div className="text-[10px] text-text-secondary font-mono">Version {FULL_BUILD_VERSION || '2.2.0'}</div>
          {currentBuild && (
            <div className="text-[9px] text-text-tertiary font-mono">
              Build: {new Date(currentBuild).toLocaleString()}
            </div>
          )}
          <div className="text-[10px] text-text-secondary font-mono mt-1">© 2026 Velum Network. All rights reserved.</div>
        </div>

        {/* Live OTA Update Action */}
        <div className="w-full pt-4 border-t border-white-5 flex flex-col items-center gap-3">
          {availableUpdate ? (
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-velum-900 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg cursor-pointer"
            >
              <ArrowDownCircle className="w-4 h-4" />
              <span>Update Now</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCheckUpdate}
              disabled={isChecking}
              className="px-4 py-2 bg-velum-800 hover:bg-velum-700 text-text-primary text-xs font-mono rounded-xl border border-white-10 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-accent ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking...' : 'Check for Updates'}</span>
            </button>
          )}

          {statusMsg && (
            <div className="text-[10px] font-mono text-accent flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>{statusMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
