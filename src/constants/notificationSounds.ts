import {
  playSuccess,
  playAttention,
  playAlert,
  playWarning,
  playError,
  ensureAudioContextStarted,
} from 'simple-notification-sounds';

/** The five tones from `simple-notification-sounds`. */
export const NOTIFICATION_SOUNDS = [
  { id: 'success', label: 'Success' },
  { id: 'attention', label: 'Attention' },
  { id: 'alert', label: 'Alert' },
  { id: 'warning', label: 'Warning' },
  { id: 'error', label: 'Error' },
] as const;

export type NotificationSoundId = (typeof NOTIFICATION_SOUNDS)[number]['id'];

const DEFAULT_SOUND: NotificationSoundId = 'attention';
const SOUND_PREF_KEY = 'velum-notification-sound';

export function getSelectedNotificationSound(): NotificationSoundId {
  if (typeof window === 'undefined') return DEFAULT_SOUND;
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    if (raw && NOTIFICATION_SOUNDS.some((s) => s.id === raw)) {
      return raw as NotificationSoundId;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SOUND;
}

export function setSelectedNotificationSound(id: NotificationSoundId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_PREF_KEY, id);
  } catch {
    /* ignore */
  }
}

export function playNotificationSound(id?: NotificationSoundId, skipThrottle = false): void {
  if (typeof window === 'undefined') return;
  const soundId = id || getSelectedNotificationSound();
  void ensureAudioContextStarted();
  switch (soundId) {
    case 'success':
      playSuccess('medium');
      break;
    case 'alert':
      playAlert('medium');
      break;
    case 'warning':
      playWarning('medium');
      break;
    case 'error':
      playError('medium');
      break;
    case 'attention':
    default:
      playAttention('medium');
      break;
  }
  void skipThrottle;
}

export const MUTE_DURATIONS = [
  { id: '24h', label: '24 hours', seconds: 24 * 60 * 60 },
  { id: '72h', label: '72 hours', seconds: 72 * 60 * 60 },
  { id: '30d', label: '30 days', seconds: 30 * 24 * 60 * 60 },
  { id: 'off', label: 'Unmute', seconds: 0 },
] as const;

export type MuteDurationId = (typeof MUTE_DURATIONS)[number]['id'];
