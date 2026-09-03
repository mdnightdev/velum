import { storage } from '../services/storageService';
import { registerPushNotifications } from './pushNotifications';

import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationPreferences {
  desktopPopups: boolean;
  soundTriggers: boolean;
  unreadBadges: boolean;
  pushPreferences: boolean;
}

const STORAGE_KEY = 'velum-notification-prefs';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  desktopPopups: true,
  soundTriggers: true,
  unreadBadges: true,
  pushPreferences: false
};

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
    }
  } catch {}
  return DEFAULT_NOTIFICATION_PREFS;
}

export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  const current = getNotificationPreferences();
  const next: NotificationPreferences = { ...current, ...prefs };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/**
 * Synthesizes a crisp, pleasant chime using Web Audio API (0 network assets needed).
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Primary note: high crystal chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain1.gain.setValueAtTime(0.22, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Harmonic bell shimmer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.04); // D6
    gain2.gain.setValueAtTime(0.12, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.28);
  } catch {}
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  return false;
};

export const sendDesktopNotification = (
  title: string,
  options?: { body?: string; icon?: string; tag?: string }
) => {
  if (typeof window === 'undefined') return;

  // 1. Native Mobile Notification (Capacitor)
  LocalNotifications.schedule({
    notifications: [
      {
        title: title,
        body: options?.body || '',
        id: Math.floor(Math.random() * 100000),
        channelId: 'velum_messages',
        schedule: { at: new Date(Date.now() + 100) },
        sound: undefined,
        actionTypeId: '',
        extra: { tag: options?.tag || 'velum-chat' }
      }
    ]
  }).catch(() => {
    // 2. Web Browser Fallback
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((registration) => {
            registration.showNotification(title, {
              body: options?.body || '',
              icon: options?.icon || '/icon.png',
              tag: options?.tag || 'velum-chat',
            });
          })
          .catch(() => {});
        return;
      }

      const notification = new Notification(title, {
        body: options?.body || '',
        icon: options?.icon || '/icon.png',
        tag: options?.tag || 'velum-chat',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    } catch {}
  });
};

export function updateAppBadge(unreadCount: number): void {
  if (typeof window === 'undefined') return;
  const prefs = getNotificationPreferences();
  if (!prefs.unreadBadges) {
    document.title = 'Velum';
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
    return;
  }

  if (unreadCount > 0) {
    document.title = `(${unreadCount}) Velum`;
    if ('setAppBadge' in navigator) {
      (navigator as any).setAppBadge(unreadCount).catch(() => {});
    }
  } else {
    document.title = 'Velum';
    if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }
}

/**
 * Handles incoming WebSocket message alerts (sound, desktop popup, in-app toast, app badge)
 */
export function handleInboundMessageNotification(msg: {
  senderName?: string;
  content?: string;
  isFromMe?: boolean;
  roomId?: string;
  activeRoomId?: string;
}): void {
  if (msg.isFromMe) return;

  const prefs = getNotificationPreferences();

  // 1. Audio chime
  if (prefs.soundTriggers) {
    playNotificationSound();
  }

  // 2. Desktop & In-App Popups
  if (prefs.desktopPopups) {
    const isBackground = typeof document !== 'undefined' && document.hidden;
    const isDifferentRoom = msg.roomId !== msg.activeRoomId;

    let previewText = msg.content || 'Sent a message';
    if (previewText.startsWith('e2ee:') || previewText.startsWith('VEL_E2EE[')) {
      previewText = 'New message';
    }

    // In-app visual toast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velum-inapp-toast', {
        detail: {
          title: msg.senderName || 'Velum',
          body: previewText,
          roomId: msg.roomId
        }
      }));
    }

    // System desktop banner
    if (isBackground || isDifferentRoom) {
      sendDesktopNotification(msg.senderName || 'Velum', {
        body: previewText,
        tag: msg.roomId || 'velum-chat'
      });
    }
  }
}
