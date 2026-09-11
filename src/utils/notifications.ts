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
import {
  getLoungeNotificationPrefs,
  shouldAlertForLoungeMessage,
} from './loungeNotificationPrefs';

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
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    roomId?: string;
    respectDnd?: boolean;
    notificationLight?: boolean;
  }
) => {
  if (typeof window === 'undefined') return;

  const tag = options?.tag || options?.roomId || 'velum-chat';
  const roomId = options?.roomId || (tag !== 'velum-chat' ? tag : undefined);
  const notifId = stringToNotificationId(tag);
  const respectDnd = options?.respectDnd !== false;

  LocalNotifications.schedule({
    notifications: [
      {
        title: title,
        body: options?.body || '',
        id: notifId,
        channelId: 'velum_messages',
        sound: undefined,
        actionTypeId: '',
        extra: { tag, roomId, light: options?.notificationLight !== false },
        ...({
          isExactNotification: false,
          allowWhileIdle: !respectDnd,
        } as any)
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
  loungeId?: string;
  activeRoomId?: string;
  timestamp?: number;
  peerUserId?: number;
  myUsername?: string;
}): void {
  if (msg.isFromMe) return;

  if (msg.timestamp && msg.timestamp < APP_INIT_TIME) return;

  if (msg.peerUserId != null && isPeerMuted(Number(msg.peerUserId))) return;

  const loungeKey =
    msg.loungeId ||
    (msg.peerUserId == null && msg.roomId && msg.roomId !== 'notifications' ? msg.roomId : undefined);

  if (loungeKey && !shouldAlertForLoungeMessage(loungeKey, msg.content, msg.myUsername)) {
    return;
  }

  const loungePrefs = loungeKey ? getLoungeNotificationPrefs(loungeKey) : null;

  const isVisible = typeof document !== 'undefined' && !document.hidden;
  const isViewingSameRoom = isVisible && msg.roomId && msg.activeRoomId && msg.roomId === msg.activeRoomId;

  if (isViewingSameRoom) return;

  const prefs = getNotificationPreferences();
  const cleanSender = (msg.senderName || 'Velum').replace(/^@/, '');
  const usable = getNotificationBodyText(msg.content);
  const previewText = usable ? (getCleanPreview(usable) || usable) : '';
  const bodyText =
    loungePrefs && !loungePrefs.showPreview ? 'New message' : previewText;

  const allowSound = prefs.soundTriggers && (loungePrefs ? loungePrefs.sound : true);
  const allowVibrate = loungePrefs ? loungePrefs.vibrate : true;
  const style = loungePrefs?.style || 'default';
  const allowPopup = prefs.desktopPopups && style !== 'quiet';
  const forceHeadsUp = style === 'heads_up';

  if (allowVibrate && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(40);
    } catch {
      /* ignore */
    }
  }

  if (isVisible && !forceHeadsUp) {
    if (allowSound) {
      playNotificationSound();
    }
    if (allowPopup && bodyText) {
      toast(`${cleanSender}: ${bodyText}`);
    }
  } else if (allowPopup || forceHeadsUp) {
    if (allowSound && isVisible) {
      playNotificationSound();
    }
    sendDesktopNotification(cleanSender, {
      body: bodyText,
      tag: msg.roomId || 'velum-chat',
      roomId: msg.roomId,
      respectDnd: loungePrefs ? loungePrefs.respectDnd : true,
      notificationLight: loungePrefs ? loungePrefs.notificationLight : true,
    });
  }
}
