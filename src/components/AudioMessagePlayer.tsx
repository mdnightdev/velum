import React, { useState, useEffect, useRef } from 'react';

interface AudioMessagePlayerProps {
  content: string;
  isMe: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({ content, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioSrc, setAudioSrc] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let src = '';
    let parsedDuration = 0;

    const durationMatch = content.match(/duration:([\d.]+)/);
    if (durationMatch) {
      parsedDuration = parseFloat(durationMatch[1]) || 0;
      setDuration(parsedDuration);
    }

    const urlMatch = content.match(/url:([^\s\]]+)/);
    const dataMatch = content.match(/data:([^\s\]]+)/);

    if (urlMatch) {
      src = urlMatch[1];
    } else if (dataMatch) {
      const rawData = dataMatch[1].trim();
      if (rawData.startsWith('data:')) {
        src = rawData;
      } else if (rawData.startsWith('audio/') || rawData.startsWith('video/') || rawData.startsWith('image/')) {
        src = `data:${rawData}`;
      } else {
        src = `data:audio/webm;base64,${rawData}`;
      }
    }

    // Resolve relative URL for Capacitor APK / local backend
    if (src && src.startsWith('/')) {
      const isCapacitor = typeof window !== 'undefined' && 
        (window.location.protocol === 'capacitor:' || (window.location.hostname === 'localhost' && !window.location.port));
      if (isCapacitor) {
        src = `http://127.0.0.1:3000${src}`;
      }
    }

    setAudioSrc(src);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [content]);

  const initAudio = () => {
    if (!audioSrc) return null;
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(audioSrc);
    audio.playbackRate = playbackRate;

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity && duration === 0) {
        setDuration(audio.duration);
      }
    };

    audio.onloadedmetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    audioRef.current = audio;
    return audio;
  };

  const togglePlay = () => {
    const audio = initAudio();
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.playbackRate = playbackRate;
      audio.play().catch((err) => {
        console.warn("Audio playback failed:", err);
        setIsPlaying(false);
      });
    }
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const fraction = clickX / rect.width;
    const activeDuration = duration || (audioRef.current?.duration || 0);
    if (!activeDuration) return;

    const newTime = fraction * activeDuration;
    setCurrentTime(newTime);
    const audio = initAudio();
    if (audio) {
      audio.currentTime = newTime;
    }
  };

  const cycleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const activeDuration = duration || (audioRef.current?.duration || 0);
  const progressFraction = activeDuration > 0 ? Math.min(1, currentTime / activeDuration) : 0;

  return (
    <div className={`flex items-center gap-2.5 py-1.5 px-3 rounded-2xl w-56 sm:w-64 select-none ${
      isMe
        ? 'bg-accent/15 border border-accent/30 text-text-primary'
        : 'bg-velum-800 border border-white-10 text-text-primary'
    }`}>
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={!audioSrc}
        className="w-8 h-8 rounded-full bg-accent hover:bg-accent-hover text-velum-950 flex items-center justify-center transition active:scale-95 shadow-sm shrink-0 cursor-pointer disabled:opacity-40"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      {/* Scrubber Track & Metadata */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Sleek Progress Track */}
        <div
          ref={progressRef}
          onClick={handleTrackClick}
          className="h-1.5 w-full bg-white-10 rounded-full cursor-pointer relative overflow-hidden my-0.5"
        >
          <div
            className="h-full bg-accent rounded-full transition-all duration-75"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>

        {/* Time and Speed */}
        <div className="flex items-center justify-between text-[10px] text-text-secondary font-mono">
          <span>
            {isPlaying ? `${formatTime(currentTime)} / ${formatTime(activeDuration)}` : formatTime(activeDuration)}
          </span>

          <button
            type="button"
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded bg-white-5 hover:bg-white-10 text-[9px] font-bold text-accent transition cursor-pointer"
            title="Speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};