import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { getSessionId } from './auth';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications(): Promise<boolean> {
  // Native Android/iOS via Capacitor
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Push] Push notification permission not granted');
        return false;
      }

      // Create notification channel for Android 8+
      await PushNotifications.createChannel({
        id: 'velum_default',
        name: 'General Notifications',
        description: 'Velum general and direct message alerts',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      // Listeners
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (token) => {
  console.log('[Push] FCM Registration Token:', token.value);
  try {
    const authToken = getSessionId();
    await fetch('/api/v2/notifications/fcm/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        token: token.value,
        platform: Capacitor.getPlatform(),
      })
    });
  } catch (err) {
    console.error('[Push] Failed to register FCM token with server:', err);
  }
});

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Notification received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification action performed:', action);
      });

      await PushNotifications.register();
      return true;
    } catch (err) {
      console.error('[Push] Failed to register native push:', err);
      return false;
    }
  }

  // Web fallback (Service Worker / VAPID)
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Push notifications not supported by browser');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied');
      return false;
    }

    const reg = await navigator.serviceWorker.ready;

    const res = await fetch('/api/v2/notifications/vapid-key');
    if (!res.ok) throw new Error('Failed to fetch VAPID key');
    const { publicKey } = await res.json();

    if (!publicKey) return false;

    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    const subJson = subscription.toJSON();
    const token = getSessionId();

    await fetch('/api/v2/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ subscription: subJson })
    });

    return true;
  } catch (err) {
    console.error('[Push] Failed to register push subscription:', err);
    return false;
  }
}

export async function setRoomMuteRule(roomId: string, muteRule: 'off' | 'mentions_only' | 'forever'): Promise<boolean> {
  try {
    const token = getSessionId();
    const res = await fetch(`/api/v2/lounges/${encodeURIComponent(roomId)}/mute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ mute_rule: muteRule })
    });
    return res.ok;
  } catch (err) {
    console.error('[Push] Failed to set room mute rule:', err);
    return false;
  }
}

export async function getRoomMuteRule(roomId: string): Promise<'off' | 'mentions_only' | 'forever'> {
  try {
    const token = getSessionId();
    const res = await fetch(`/api/v2/lounges/${encodeURIComponent(roomId)}/mute`, {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) return 'off';
    const data = await res.json();
    return data.mute_rule || 'off';
  } catch (err) {
    return 'off';
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    const authToken = getSessionId();
    await fetch('/api/v2/notifications/fcm/unregister', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      }
    });
  } catch (err) {
    console.error('[Push] Failed to unregister push notifications:', err);
  }
}
