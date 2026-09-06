import { Capacitor } from '@capacitor/core';
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

const APP_INIT_TIME = Date.now();
let lastSoundPlayedAt = 0;

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/**
 * Synthesizes a crisp chime using Web Audio API.
 */
export function playNotificationSound(): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastSoundPlayedAt < 1500) return;
  lastSoundPlayedAt = now;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const audioNow = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioNow);
    osc1.frequency.exponentialRampToValueAtTime(880, audioNow + 0.08);

    gain1.gain.setValueAtTime(0.22, audioNow);
    gain1.gain.exponentialRampToValueAtTime(0.0001, audioNow + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(audioNow);
    osc1.stop(audioNow + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, audioNow + 0.04);
    gain2.gain.setValueAtTime(0.12, audioNow + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.0001, audioNow + 0.28);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(audioNow + 0.04);
    osc2.stop(audioNow + 0.28);
  } catch {}
}

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return true;
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch {
      return false;
    }
  }

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

function stringToNotificationId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100000);
}

export const sendDesktopNotification = (
  title: string,
  options?: { body?: string; icon?: string; tag?: string; roomId?: string }
) => {
  if (typeof window === 'undefined') return;

  const tag = options?.tag || options?.roomId || 'velum-chat';
  const roomId = options?.roomId || (tag !== 'velum-chat' ? tag : undefined);
  const notifId = stringToNotificationId(tag);

  LocalNotifications.schedule({
    notifications: [
      {
        title: title,
        body: options?.body || '',
        id: notifId,
        channelId: 'velum_messages',
        sound: undefined,
        actionTypeId: '',
        extra: { tag, roomId }
      }
    ]
  }).catch(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready
          .then((registration) => {
            registration.showNotification(title, {
              body: options?.body || '',
              icon: options?.icon || '/icon.png',
              tag: tag,
            });
          })
          .catch(() => {});
        return;
      }

      const notification = new Notification(title, {
        body: options?.body || '',
        icon: options?.icon || '/icon.png',
        tag: tag,
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
 * Handles incoming WebSocket message alerts
 */
export function handleInboundMessageNotification(msg: {
  senderName?: string;
  content?: string;
  isFromMe?: boolean;
  roomId?: string;
  activeRoomId?: string;
}): void {
  if (msg.isFromMe) return;

  // Drop alerts for messages synced in the first 3 seconds of startup
  if (Date.now() - APP_INIT_TIME < 3000) return;

  const prefs = getNotificationPreferences();

  if (prefs.soundTriggers) {
    playNotificationSound();
  }

  if (prefs.desktopPopups) {
    const isBackground = typeof document !== 'undefined' && document.hidden;
    const isDifferentRoom = msg.roomId !== msg.activeRoomId;

    const cleanSender = (msg.senderName || 'Velum').replace(/^@/, '');
    const previewText = msg.content || '';

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('velum-inapp-toast', {
        detail: {
          title: cleanSender,
          body: previewText,
          roomId: msg.roomId
        }
      }));
    }

    if (isBackground || isDifferentRoom) {
      sendDesktopNotification(cleanSender, {
        body: previewText,
        tag: msg.roomId || 'velum-chat',
        roomId: msg.roomId
      });
    }
  }
}
