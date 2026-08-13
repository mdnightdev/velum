import { describe, it, expect } from 'vitest';
import ProfileCard from './ProfileCard';
import React from 'react';

describe('ProfileCard Component Type Checks', () => {
  it('should export the ProfileCard component as a function', () => {
    expect(typeof ProfileCard).toBe('function');
  });
});
