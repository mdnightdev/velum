import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.midnightdev.velum',
  appName: 'velum',
  webDir: 'dist',
  server: {
    url: 'http://127.0.0.1:3000',
    cleartext: true
  }
};

export default config;
