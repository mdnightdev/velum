import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import type { ServiceAccount } from 'firebase-admin';

function loadServiceAccount(): ServiceAccount | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as ServiceAccount;
    } catch (err) {
      console.error('[Firebase] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON', err);
      return null;
    }
  }

  const serviceAccountPath =
    process.env.FIREBASE_CONFIG_PATH ||
    path.resolve(process.cwd(), 'firebase-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    console.warn('[Firebase] Service account file not found at:', serviceAccountPath);
    return null;
  }

  return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')) as ServiceAccount;
}

let appInitialized = false;

if (!getApps().length) {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount),
    });
    appInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
  }
} else {
  appInitialized = true;
}

export const messaging = appInitialized ? getMessaging() : null;
export { getMessaging };
