import { storage } from '../services/storageService';

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  messageScaling: 'cozy' | 'compact';
  fontAdjustment: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
}

const STORAGE_KEY = 'velum-appearance';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  messageScaling: 'cozy',
  fontAdjustment: 'medium',
  reducedMotion: false
};

export function getStoredAppearanceSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...DEFAULT_APPEARANCE, ...parsed };
    }
  } catch {}
  return DEFAULT_APPEARANCE;
}

export function applyAppearanceSettings(settings: Partial<AppearanceSettings>): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE;

  const current = getStoredAppearanceSettings();
  const next: AppearanceSettings = { ...current, ...settings };

  // 1. Theme
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = next.theme === 'dark' || (next.theme === 'system' && prefersDark);
  
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  } else {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  }

  // 2. Message Scaling (Cozy vs Compact)
  document.documentElement.setAttribute('data-message-scaling', next.messageScaling);

  // 3. Font Size Adjustment
  document.documentElement.setAttribute('data-font-size', next.fontAdjustment);
  if (next.fontAdjustment === 'small') {
    document.documentElement.style.fontSize = '14px';
  } else if (next.fontAdjustment === 'large') {
    document.documentElement.style.fontSize = '17px';
  } else {
    document.documentElement.style.fontSize = '15px';
  }

  // 4. Reduced Motion
  document.documentElement.setAttribute('data-reduced-motion', next.reducedMotion ? 'true' : 'false');
  if (next.reducedMotion) {
    document.documentElement.classList.add('reduce-motion');
  } else {
    document.documentElement.classList.remove('reduce-motion');
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}

  window.dispatchEvent(new CustomEvent('velum-appearance-changed', { detail: next }));
  return next;
}

export function initAppearance(): AppearanceSettings {
  const current = getStoredAppearanceSettings();
  applyAppearanceSettings(current);

  // Listen for OS theme changes if on system mode
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      const active = getStoredAppearanceSettings();
      if (active.theme === 'system') {
        applyAppearanceSettings({ theme: 'system' });
      }
    };
    mediaQuery.addEventListener('change', listener);
  }

  return current;
}
