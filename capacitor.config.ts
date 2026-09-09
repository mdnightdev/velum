import 'dotenv/config';
import { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.VITE_API_URL || process.env.API_URL || 'http://127.0.0.1:3000';

const config: CapacitorConfig = {
  appId: 'com.midnightdev.velum',
  appName: 'velum',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      iconColor: '#3B82F6'
    }
  }
};

export default config;
