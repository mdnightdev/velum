import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';

interface TelegramVoiceNotePlayerProps {
  content: string;
  isMe: boolean;
}

export const TelegramVoiceNotePlayer: React.FC<TelegramVoiceNotePlayerProps> = ({ content, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [audioSrc, setAudioSrc] = useState<string>('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Seed static waveform heights for visually authentic Telegram audio waves
  const waveHeights = useRef<number[]>(
    Array.from({ length: 30 }, (_, i) => {
      const seed = (i * 13 + 7) % 100;
      return Math.max(25, Math.min(95, seed));
    })
  ).current;

  useEffect(() => {
    // Parse duration and audio url or base64 from content string:
    // Format: [Voice Note duration:3s url:/media/xyz.webm]
    // or [Voice Note duration:3s data:audio/webm;base64,...]
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
      src = `data:${dataMatch[1]}`;
    }

    setAudioSrc(src);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [content]);

  const togglePlay = () => {
    if (!audioSrc) return;

    if (!audioRef.current) {
      const audio = new Audio(audioSrc);
      audio.playbackRate = playbackRate;

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setDuration(audio.duration);
        }
      };

      audio.onloadedmetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
          setDuration(audio.duration);
        }
      };

      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Failed to play voice note:", err);
      });
    }
  };

  const handleSeek = (index: number) => {
    if (!duration) return;
    const seekFraction = (index + 1) / waveHeights.length;
    const newTime = seekFraction * duration;
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
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
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressFraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const activeWaveIndex = Math.floor(progressFraction * waveHeights.length);

  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-2xl max-w-xs sm:max-w-sm ${
      isMe 
        ? 'bg-accent/20 border border-accent/40 text-text-primary' 
        : 'bg-velum-800/90 border border-white-10 text-text-primary'
    }`}>
      {/* Play / Pause Circular Button */}
      <button
        onClick={togglePlay}
        disabled={!audioSrc}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md flex-shrink-0 cursor-pointer ${
          isMe
            ? 'bg-accent text-velum-950 hover:bg-accent-light'
            : 'bg-accent/20 text-accent border border-accent/40 hover:bg-accent/30'
        }`}
        title={isPlaying ? "Pause voice note" : "Play voice note"}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Time Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Waveform Interactive Bars */}
        <div className="flex items-center gap-0.5 h-7 py-1 cursor-pointer select-none">
          {waveHeights.map((height, idx) => {
            const isActive = idx <= activeWaveIndex;
            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                className={`flex-1 rounded-full transition-all duration-150 ${
                  isActive
                    ? isMe ? 'bg-accent shadow-[0_0_4px_rgba(34,211,238,0.6)]' : 'bg-accent'
                    : 'bg-text-secondary/30 hover:bg-text-secondary/50'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {/* Bottom Bar: Duration, Mic icon, Playback rate */}
        <div className="flex items-center justify-between text-[11px] text-text-secondary font-mono px-0.5">
          <span className="flex items-center gap-1 font-medium">
            <Mic className="w-3 h-3 text-accent" />
            {isPlaying ? formatTime(currentTime) : formatTime(duration || 0)}
          </span>

          <button
            onClick={cycleSpeed}
            className="px-1.5 py-0.5 rounded bg-white-5 hover:bg-white-10 text-[10px] font-bold text-accent transition cursor-pointer"
            title="Change playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
