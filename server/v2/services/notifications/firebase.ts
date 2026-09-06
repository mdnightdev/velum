import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';

const serviceAccountPath =
  process.env.FIREBASE_CONFIG_PATH ||
  path.resolve(process.cwd(), 'firebase-service-account.json');

let appInitialized = false;

if (!getApps().length) {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
    });
    appInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
  } else {
    console.warn('[Firebase] Service account file not found at:', serviceAccountPath);
  }
} else {
  appInitialized = true;
}

export const messaging = appInitialized ? getMessaging() : null;
export { getMessaging };
