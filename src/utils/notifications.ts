/**
 * Web Notification Utilities for Velum Chat
 */

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('Desktop notifications are not supported in this browser environment.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const sendDesktopNotification = (
  title: string,
  options?: { body?: string; icon?: string; tag?: string }
) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!document.hidden) return; // Only notify if window is inactive or tab in background

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/icon.png',
      tag: options?.tag || 'velum-chat',
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch (err) {
    console.error('Failed to trigger native notification:', err);
  }
};
