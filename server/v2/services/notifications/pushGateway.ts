import { messaging } from './firebase.js';
import webpush from 'web-push';
import { db, executeWithRetry } from '../../db/client.js';
import { pushSubscriptions, loungeMuteSettings, users, fcmTokens } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { isDmPeerMuted } from '../../utils/dmMute.js';

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
    // Per-peer DM mute (recipient muted sender)
    if (payload.senderId && (!loungeId || loungeId === 0)) {
      if (await isDmPeerMuted(recipientUserId, payload.senderId)) {
        return false;
      }
    }

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

    const fcmSent = await sendFcmNotification(recipientUserId, payload);
  if (subscriptions.length === 0) return fcmSent;

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


export async function saveFcmToken(
  userId: number,
  token: string,
  deviceId?: string,
  platform: string = "android"
): Promise<void> {
  await executeWithRetry(() =>
    db.insert(fcmTokens)
      .values({
        userId,
        token,
        deviceId: deviceId || null,
        platform,
        lastUsedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: fcmTokens.token,
        set: {
          userId,
          deviceId: deviceId || null,
          platform,
          lastUsedAt: new Date(),
        },
      })
  );
}

export async function removeFcmToken(token: string): Promise<void> {
  await executeWithRetry(() =>
    db.delete(fcmTokens).where(eq(fcmTokens.token, token))
  );
}

export async function sendFcmNotification(
  recipientUserId: number,
  payload: PushNotificationPayload
): Promise<boolean> {
  if (!messaging) return false;

  const tokens = await executeWithRetry(() =>
    db.select({ token: fcmTokens.token })
      .from(fcmTokens)
      .where(eq(fcmTokens.userId, recipientUserId))
  );

  if (!tokens.length) return false;

  const registrationTokens = tokens.map((t) => t.token);

  const response = await messaging.sendEachForMulticast({
    tokens: registrationTokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url || "/v2",
      roomId: payload.roomId || "",
    },
  });

  // Clean up invalid or expired registration tokens
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      const errCode = resp.error?.code;
      if (
        errCode === "messaging/invalid-registration-token" ||
        errCode === "messaging/registration-token-not-registered"
      ) {
        removeFcmToken(registrationTokens[idx]).catch(console.error);
      }
    }
  });

  return response.successCount > 0;
}
