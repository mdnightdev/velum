import { useState, useRef, useEffect } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setMicError(null);
    } catch (err) {
      console.warn('Microphone permission check/access issue:', err);
      setMicError('Microphone permission denied or blocked by iframe container. Please click "Open in New Tab" at the top right of the screen or check your browser/system permissions.');
    }
  };

  const stopRecording = (onRecordingComplete: (audioBase64: string, durationSeconds: number) => void) => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      setIsRecording(false);
      return;
    }

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    audioChunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
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
