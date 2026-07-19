import { useState, useRef, useEffect } from 'react';
import { initiateMicrophoneStream, terminateMicrophoneStream, cancelMicrophoneStream } from '../utils/mediaPipeline';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const secondsRef = useRef<number>(0);

  useEffect(() => {
    secondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setRecordingSeconds(0);
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      await initiateMicrophoneStream();
      setIsRecording(true);
      setMicError(null);
    } catch (err) {
      console.warn('Microphone permission check/access issue:', err);
      setMicError('Microphone permission denied or blocked by iframe container. Please click "Open in New Tab" at the top right of the screen or check your browser/system permissions.');
    }
  };

  const stopRecording = async (onRecordingComplete: (audioBase64: string, durationSeconds: number) => void) => {
    setIsRecording(false);
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
    setIsRecording(false);
  };

  return {
    isRecording,
    recordingSeconds,
    micError,
    startRecording,
    stopRecording,
    cancelRecording,
    setMicError,
  };
}
