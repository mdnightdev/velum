import webpush from 'web-push';
import { db, executeWithRetry } from '../../db/client.js';
import { pushSubscriptions, loungeMuteSettings, users } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';

let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
}

webpush.setVapidDetails(
  'mailto:support@velum.network',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

export function getVapidPublicKey(): string {
  return vapidKeys.publicKey;
}

export async function savePushSubscription(
  userId: number,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string
): Promise<void> {
  await executeWithRetry(() =>
    db.insert(pushSubscriptions)
      .values({
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || ''
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          p256dh,
          auth,
          userAgent: userAgent || ''
        }
      })
  );
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await executeWithRetry(() =>
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
  );
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  roomId?: string;
  senderId?: number;
}

export async function dispatchPushNotification(
  recipientUserId: number,
  loungeId: number | null,
  payload: PushNotificationPayload,
  messageContent?: string
): Promise<boolean> {
  try {
    if (loungeId) {
      const [muteSetting] = await executeWithRetry(() =>
        db.select()
          .from(loungeMuteSettings)
          .where(and(eq(loungeMuteSettings.userId, recipientUserId), eq(loungeMuteSettings.loungeId, loungeId)))
          .limit(1)
      );

      if (muteSetting) {
        if (muteSetting.muteRule === 'forever') {
          return false;
        }
        if (muteSetting.muteRule === 'mentions_only') {
          const [recipientUser] = await executeWithRetry(() =>
            db.select({ username: users.username }).from(users).where(eq(users.id, recipientUserId)).limit(1)
          );
          if (recipientUser && messageContent) {
            const mention = `@${recipientUser.username}`.toLowerCase();
            if (!messageContent.toLowerCase().includes(mention)) {
              return false;
            }
          } else {
            return false;
          }
        }
      }
    }

    const subscriptions = await executeWithRetry(() =>
      db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, recipientUserId))
    );

    if (subscriptions.length === 0) return false;

    const notificationData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon.png',
      data: {
        url: payload.url || '/v2',
        roomId: payload.roomId
      }
    });

    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, notificationData);
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await removePushSubscription(sub.endpoint);
        } else {
          console.error('[WebPush] Error dispatching push:', err?.message || err);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[WebPush] Dispatch error:', err);
    return false;
  }
}
