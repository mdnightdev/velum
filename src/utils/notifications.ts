import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import toast from 'react-hot-toast';
import {
  playNotificationSound as playSelectedTone,
  getSelectedNotificationSound,
  type NotificationSoundId,
} from '../constants/notificationSounds';
import { isPeerMuted } from './dmPeerPrefs';
import { getNotificationBodyText } from './messagePlaintext';
import { getCleanPreview } from './messageParser';

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
 * Plays the user-selected tone from `simple-notification-sounds`.
 */
export function playNotificationSound(soundId?: NotificationSoundId): void {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastSoundPlayedAt < 1500) return;
  lastSoundPlayedAt = now;
  playSelectedTone(soundId || getSelectedNotificationSound(), true);
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

export const dismissDeliveredNotification = async (tagOrRoomId?: string): Promise<void> => {
  if (typeof window === 'undefined') return;

  if (Capacitor.isNativePlatform()) {
    try {
      if (tagOrRoomId) {
        const notifId = stringToNotificationId(tagOrRoomId);
        const plugin = LocalNotifications as any;
        if (typeof plugin.removeDeliveredNotificationsById === 'function') {
          await plugin.removeDeliveredNotificationsById({ ids: [notifId] }).catch(() => {});
        } else if (typeof plugin.removeDeliveredNotifications === 'function') {
          await plugin.removeDeliveredNotifications({
            notifications: [{ id: notifId, title: '', body: '' }]
          }).catch(() => {});
        }
      } else {
        await LocalNotifications.removeAllDeliveredNotifications().catch(() => {});
      }
    } catch {}
    return;
  }

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      const filter = tagOrRoomId ? { tag: tagOrRoomId } : undefined;
      const notifications = await reg.getNotifications(filter);
      notifications.forEach((n) => n.close());
    }
  } catch {}
};

export const dismissAllNotifications = async (): Promise<void> => {
  await dismissDeliveredNotification();
};

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
        extra: { tag, roomId },
        ...({ isExactNotification: false, allowWhileIdle: false } as any)
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
  timestamp?: number;
  peerUserId?: number;
}): void {
  if (msg.isFromMe) return;

  // Drop alerts for messages synced before app launch or older than current session init
  if (msg.timestamp && msg.timestamp < APP_INIT_TIME) return;

  // Per-peer mute (timed) — skip sound + banners
  if (msg.peerUserId != null && isPeerMuted(Number(msg.peerUserId))) return;

  const isVisible = typeof document !== 'undefined' && !document.hidden;
  const isViewingSameRoom = isVisible && msg.roomId && msg.activeRoomId && msg.roomId === msg.activeRoomId;

  // If user is currently active and viewing the exact same conversation, suppress notification
  if (isViewingSameRoom) return;

  const prefs = getNotificationPreferences();
  const cleanSender = (msg.senderName || 'Velum').replace(/^@/, '');
  // Never decrypt here; never surface ciphertext / poison. Media → Photo/Video labels.
  const usable = getNotificationBodyText(msg.content);
  const previewText = usable ? (getCleanPreview(usable) || usable) : '';

  if (isVisible) {
    // In-app foreground: crisp Web Audio chime + single-token toast
    if (prefs.soundTriggers) {
      playNotificationSound();
    }
    if (prefs.desktopPopups && previewText) {
      toast(`${cleanSender}: ${previewText}`);
    }
  } else {
    // Out-of-app background: hand off 100% to OS ringer / vibration profile
    if (prefs.desktopPopups) {
      sendDesktopNotification(cleanSender, {
        body: previewText,
        tag: msg.roomId || 'velum-chat',
        roomId: msg.roomId
      });
    }
  }
}
