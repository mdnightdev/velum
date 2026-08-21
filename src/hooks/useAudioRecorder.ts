import { useState, useRef, useEffect } from 'react';
import { initiateMicrophoneStream, terminateMicrophoneStream, cancelMicrophoneStream, pauseMicrophoneStream, resumeMicrophoneStream, getDraftAudioBlob } from '../utils/mediaPipeline';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(30).fill(10));

  const secondsRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    secondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  const startRecording = async () => {
    try {
      const stream = await initiateMicrophoneStream();
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      setMicError(null);

      if (stream && stream instanceof MediaStream) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        audioCtxRef.current = audioCtx;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevels = () => {
          if (!isPaused) {
            analyser.getByteFrequencyData(dataArray);
            const levels = Array.from(dataArray.slice(0, 30)).map(
              (val) => Math.max(10, Math.min(100, (val / 255) * 100))
            );
            setAudioLevels(levels);
          }
          animationFrameRef.current = requestAnimationFrame(updateLevels);
        };
        updateLevels();
      }
    } catch (err) {
      console.warn('Microphone permission check/access issue:', err);
      setMicError('Microphone permission denied or blocked by iframe container.');
    }
  };

  const pauseRecording = () => {
    pauseMicrophoneStream();
    setIsPaused(true);
    setAudioLevels(new Array(30).fill(10));
  };

  const resumeRecording = () => {
    resumeMicrophoneStream();
    setIsPaused(false);
  };

  const cleanupAudio = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const stopRecording = async (onRecordingComplete: (audioBase64: string, durationSeconds: number) => void) => {
    setIsRecording(false);
    setIsPaused(false);
    cleanupAudio();
    try {
      const audioBlob = await terminateMicrophoneStream();
      if (audioBlob.size > 5 * 1024 * 1024) {
        alert('Voice note exceeds 5MB limit. Please record a shorter message.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const audioBase64 = (reader.result as string).split(',')[1];
        const seconds = secondsRef.current > 0 ? secondsRef.current : 4;
        onRecordingComplete(audioBase64, seconds);
      };
      reader.onerror = () => {
        alert('Failed to process voice note. Please try again.');
      };
      reader.readAsDataURL(audioBlob);
    } catch (err) {
      console.error('Failed to stop voice recording:', err);
    }
  };

  const cancelRecording = () => {
    cancelMicrophoneStream();
    cleanupAudio();
    setIsRecording(false);
    setIsPaused(false);
  };

  return {
    isRecording,
    isPaused,
    recordingSeconds,
    micError,
    audioLevels,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    getDraftAudioBlob,
    setMicError,
  };
}
