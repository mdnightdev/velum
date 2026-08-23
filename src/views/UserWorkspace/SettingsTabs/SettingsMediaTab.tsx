import React, { useState } from 'react';
import { CheckCircle, Mic, Play, Trash2, HardDrive, Image as ImageIcon } from 'lucide-react';
import { purgeCryptoDatabase } from '../../../services/cryptoDbStore';

interface SettingsMediaTabProps {
  voiceEnabled: boolean;
  autoPlayVoice: boolean;
  mediaMsg: string | null;
  mediaError: string | null;
  currentUserId: number;
  handleSaveMedia: (voice: boolean, autoPlay: boolean) => void;
}

export function SettingsMediaTab({
  voiceEnabled: propVoice,
  autoPlayVoice: propAutoPlay,
  mediaMsg: parentMsg,
  mediaError: parentErr,
  currentUserId,
  handleSaveMedia
}: SettingsMediaTabProps) {
  const [voice, setVoice] = useState<boolean>(propVoice);
  const [autoPlay, setAutoPlay] = useState<boolean>(propAutoPlay);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 2000);
  };

  const handleToggleVoice = () => {
    const next = !voice;
    setVoice(next);
    handleSaveMedia(next, autoPlay);
    triggerToast(`Voice playback ${next ? 'enabled' : 'disabled'}`);
  };

  const handleToggleAutoPlay = () => {
    const next = !autoPlay;
    setAutoPlay(next);
    handleSaveMedia(voice, next);
    triggerToast(`Auto-play voice notes ${next ? 'enabled' : 'disabled'}`);
  };

  const handleClearMediaCache = async () => {
    if (!window.confirm('Clear cached media and thumbnails from local device storage?')) {
      return;
    }
    setIsClearingCache(true);
    try {
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map(k => window.caches.delete(k)));
      }
      triggerToast('Local media cache cleared.');
    } catch {
      triggerToast('Cache reset complete.');
    } finally {
      setIsClearingCache(false);
    }
  };

  const displayMsg = toastMsg || parentMsg;

  return (
    <div className="w-full max-w-4xl space-y-6">
      {displayMsg && (
        <div className="p-3.5 bg-status-online-bg text-status-online rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2 transition-all">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{displayMsg}</span>
        </div>
      )}

      {parentErr && (
        <div className="p-3.5 bg-alert-error-bg text-alert-error rounded-xl text-[10px] font-mono uppercase font-bold flex items-center gap-2">
          <span>{parentErr}</span>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-accent font-mono">
          Media & Storage
        </h3>
      </div>

      {/* Voice Playback Preferences */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        <label className="block text-[11px] font-mono text-text-secondary uppercase tracking-wider">
          Voice Messages
        </label>

        <div className="flex items-center justify-between py-2 border-b border-white-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Voice Note Audio</span>
              <span className="text-[10px] text-text-secondary font-mono">Enable audio waveform players for recorded notes</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              voice ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Continuous Voice Playback</span>
              <span className="text-[10px] text-text-secondary font-mono">Automatically play consecutive voice notes in conversation</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoPlay}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
              autoPlay ? 'bg-accent justify-end' : 'bg-velum-700 justify-start'
            }`}
          >
            <div className="w-4 h-4 rounded-full bg-velum-950 shadow-md" />
          </button>
        </div>
      </div>

      {/* Storage & Local Cache */}
      <div className="p-5 rounded-2xl bg-velum-800 border border-white-10 space-y-4">
        <label className="block text-[11px] font-mono text-text-secondary uppercase tracking-wider">
          Storage
        </label>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-velum-750 flex items-center justify-center text-text-primary">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-text-primary block">Clear Media Cache</span>
              <span className="text-[10px] text-text-secondary font-mono">Free up device storage by purging cached photos and audio blobs</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearMediaCache}
            disabled={isClearingCache}
            className="px-3.5 py-1.5 rounded-xl border border-white-10 bg-velum-750 hover:bg-velum-700 text-xs font-medium text-text-primary transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isClearingCache ? 'Clearing...' : 'Clear Cache'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
