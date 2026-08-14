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

    // Fetch public VAPID key
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

    // Register subscription on backend
    const subJson = subscription.toJSON();
    const token = localStorage.getItem('velum_session_token');
    
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
    const token = localStorage.getItem('velum_session_token');
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
    const token = localStorage.getItem('velum_session_token');
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
