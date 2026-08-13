/**
 * Decodes an audio blob and computes a normalized amplitude waveform array (e.g., 32 or 64 peak bars)
 */
export async function generateAudioWaveform(
  audioBlob: Blob,
  samplesCount = 32
): Promise<number[]> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // Left channel

    const blockSize = Math.floor(channelData.length / samplesCount);
    const waveform: number[] = [];

    for (let i = 0; i < samplesCount; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[start + j] || 0);
      }
      const avg = sum / blockSize;
      waveform.push(avg);
    }

    // Normalize peaks to 0.05 - 1.0 range
    const max = Math.max(...waveform) || 1;
    const normalized = waveform.map(val => Math.max(0.08, parseFloat((val / max).toFixed(2))));

    // Close AudioContext
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }

    return normalized;
  } catch (err) {
    console.warn('[WAVEFORM] Failed to generate audio waveform:', err);
    // Return default dummy fallback bars
    return Array.from({ length: samplesCount }, () => Math.max(0.1, parseFloat(Math.random().toFixed(2))));
  }
}
