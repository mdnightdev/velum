import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('pauseMicrophoneStream draft blob', () => {
  let collected: Blob[];
  let recorder: {
    state: string;
    mimeType: string;
    stream: { getTracks: () => Array<{ stop: () => void }> };
    ondataavailable: ((ev: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
    start: (timeslice?: number) => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    requestData: () => void;
    addEventListener: (type: string, fn: () => void, opts?: { once?: boolean }) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  };

  beforeEach(async () => {
    vi.resetModules();
    collected = [];

    class MockMediaRecorder {
      state = 'inactive';
      mimeType = 'audio/webm';
      stream = { getTracks: () => [{ stop: vi.fn() }] };
      ondataavailable: ((ev: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      private listeners = new Map<string, Array<() => void>>();

      start(_timeslice?: number) {
        this.state = 'recording';
        // Simulate timeslice chunk shortly after start
        queueMicrotask(() => {
          const chunk = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm' });
          this.ondataavailable?.({ data: chunk });
        });
      }

      stop() {
        this.state = 'inactive';
        this.onstop?.();
      }

      pause() {
        this.state = 'paused';
      }

      resume() {
        this.state = 'recording';
      }

      requestData() {
        const chunk = new Blob([new Uint8Array([9, 9, 9])], { type: 'audio/webm' });
        this.ondataavailable?.({ data: chunk });
        const list = this.listeners.get('dataavailable') || [];
        list.forEach((fn) => fn());
      }

      addEventListener(type: string, fn: () => void) {
        const list = this.listeners.get(type) || [];
        list.push(fn);
        this.listeners.set(type, list);
      }

      removeEventListener(type: string, fn: () => void) {
        const list = (this.listeners.get(type) || []).filter((x) => x !== fn);
        this.listeners.set(type, list);
      }
    }

    vi.stubGlobal('MediaRecorder', MockMediaRecorder);
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });

    const mod = await import('../../src/utils/mediaPipeline');
    await mod.initiateMicrophoneStream();
    // Flush timeslice microtask
    await Promise.resolve();
    await mod.pauseMicrophoneStream();
    const blob = mod.getDraftAudioBlob();
    collected.push(blob || new Blob());
    (globalThis as { __voiceMod?: typeof mod }).__voiceMod = mod;
  });

  afterEach(() => {
    const mod = (globalThis as { __voiceMod?: { cancelMicrophoneStream: () => void } }).__voiceMod;
    mod?.cancelMicrophoneStream();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('yields a non-empty draft blob after pause flush', () => {
    expect(collected[0].size).toBeGreaterThan(0);
  });
});
