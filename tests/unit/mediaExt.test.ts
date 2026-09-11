import { describe, it, expect } from 'vitest';
import {
  sanitizeMediaExtension,
  generateAnonymousFilename,
} from '../../src/utils/mediaPipeline';

describe('sanitizeMediaExtension', () => {
  it('strips codecs from audio/webm MIME', () => {
    expect(sanitizeMediaExtension('audio/webm;codecs=opus', 'webm')).toBe('webm');
    expect(sanitizeMediaExtension('webm;codecs=opus', 'webm')).toBe('webm');
  });

  it('recovers when codecs were concatenated into the extension', () => {
    expect(sanitizeMediaExtension('webmcodecsopus', 'webm')).toBe('webm');
  });

  it('handles image and video MIME subtypes', () => {
    expect(sanitizeMediaExtension('image/jpeg', 'webp')).toBe('jpg');
    expect(sanitizeMediaExtension('video/mp4', 'mp4')).toBe('mp4');
    expect(sanitizeMediaExtension('image/webp', 'webp')).toBe('webp');
  });
});

describe('generateAnonymousFilename', () => {
  it('builds aud_*.webm for opus webm voice MIME', () => {
    const name = generateAnonymousFilename('audio/webm;codecs=opus', 'audio/webm;codecs=opus');
    expect(name).toMatch(/^aud_[a-f0-9]+\.webm$/);
  });

  it('uses sanitized extension even when raw subtype is dirty', () => {
    const name = generateAnonymousFilename('webm;codecs=opus', 'audio/webm');
    expect(name.endsWith('.webm')).toBe(true);
    expect(name.includes('codecs')).toBe(false);
  });
});
