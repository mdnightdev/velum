import { useState, useRef } from 'react';

const log = {
  warn: (msg: string, meta?: any) => console.warn(`[AudioPlayback] ${msg}`, meta || ''),
};

export function useAudioPlayback() {
  const [playingWaveforms, setPlayingWaveforms] = useState<Record<string, boolean>>({});
  const [waveformAudioProg, setWaveformAudioProg] = useState<Record<string, number>>({});

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioMsgIdRef = useRef<string | null>(null);

  const runSimulatedPlayback = (msgId: string, durationStr: string) => {
    const durationS = parseInt(durationStr, 10) || 5;
    let p = 0;
    const interval = setInterval(() => {
      setPlayingWaveforms(prev => {
        if (!prev[msgId]) {
          clearInterval(interval);
          return prev;
        }

        p += 5;
        if (p > 100) {
          clearInterval(interval);
          setWaveformAudioProg(v => ({ ...v, [msgId]: 0 }));
          return { ...prev, [msgId]: false };
        } else {
          setWaveformAudioProg(v => ({ ...v, [msgId]: p }));
          return prev;
        }
      });
    }, (durationS * 1000) / 20);
  };

  const handleTogglePlayWave = (
    msgId: string,
    durationStr: string,
    audioData: string,
    audioType: string = 'audio/webm'
  ) => {
    const isPlaying = !!playingWaveforms[msgId];

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
      } catch (e) {}
      currentAudioRef.current = null;
    }

    setPlayingWaveforms(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[k] = false;
      });
      return next;
    });

    if (isPlaying) {
      setPlayingWaveforms(prev => ({ ...prev, [msgId]: false }));
      setWaveformAudioProg(prev => ({ ...prev, [msgId]: 0 }));
      currentAudioMsgIdRef.current = null;
    } else {
      setPlayingWaveforms(prev => ({ ...prev, [msgId]: true }));
      currentAudioMsgIdRef.current = msgId;

      if (audioData) {
        try {
          const audioSrc = audioData.startsWith('/') ? audioData : `data:${audioType};base64,${audioData}`;
          const audio = new Audio();
          audio.preload = 'none';
          audio.src = audioSrc;
          currentAudioRef.current = audio;

          audio.onended = () => {
            setPlayingWaveforms(prev => ({ ...prev, [msgId]: false }));
            setWaveformAudioProg(prev => ({ ...prev, [msgId]: 0 }));
            if (currentAudioMsgIdRef.current === msgId) {
              currentAudioRef.current = null;
              currentAudioMsgIdRef.current = null;
            }
          };

          audio.ontimeupdate = () => {
            if (audio.duration) {
              const progress = (audio.currentTime / audio.duration) * 100;
              setWaveformAudioProg(prev => ({ ...prev, [msgId]: progress }));
            }
          };

          audio.onerror = (e) => {
            log.warn('Audio playback error, falling back to simulated playback', { error: String(e) });
            audio.onended = null;
            audio.ontimeupdate = null;
            runSimulatedPlayback(msgId, durationStr);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(err => {
              log.warn('Playback interrupted', { error: String(err) });
              audio.onended = null;
              audio.ontimeupdate = null;
              runSimulatedPlayback(msgId, durationStr);
            });
          }
        } catch (err) {
          log.warn('Audio setup failed', { error: (err as Error).message });
          runSimulatedPlayback(msgId, durationStr);
        }
      } else {
        runSimulatedPlayback(msgId, durationStr);
      }
    }
  };

  return {
    playingWaveforms,
    waveformAudioProg,
    handleTogglePlayWave,
  };
}
