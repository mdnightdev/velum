import { describe, it, expect, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

// Mock getUserMedia & MediaRecorder
const mockGetTracks = vi.fn(() => [{ stop: vi.fn() }]);
const mockStream = { getTracks: mockGetTracks };

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn(async () => mockStream),
  },
});

class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: any = null;
  onstop: any = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    if (this.onstop) this.onstop();
  }
}

vi.stubGlobal('MediaRecorder', MockMediaRecorder);

// Mock React hook APIs to run outside of rendering lifecycle
vi.mock('react', () => {
  let isRecordingState = false;
  let secondsState = 0;
  let errorState: string | null = null;

  return {
    useState: (initialVal: any) => {
      if (initialVal === false) {
        return [isRecordingState, (val: any) => { isRecordingState = val; }];
      }
      if (initialVal === 0) {
        return [secondsState, (val: any) => { secondsState = val; }];
      }
      return [errorState, (val: any) => { errorState = val; }];
    },
    useRef: (initialVal: any) => ({ current: initialVal }),
    useEffect: vi.fn(),
  };
});

describe('useAudioRecorder hook tests (Node environment)', () => {
  it('should start, cancel and stop recording safely', async () => {
    const hook = useAudioRecorder();
    
    // Initial state checks
    expect(hook.isRecording).toBe(false);
    expect(hook.recordingSeconds).toBe(0);
    expect(hook.micError).toBeNull();

    // Start recording checks
    await hook.startRecording();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });

    // Cancel recording checks
    expect(hook.cancelRecording).toBeDefined();
    hook.cancelRecording();

    // Stop recording checks
    expect(hook.stopRecording).toBeDefined();
  });
});
