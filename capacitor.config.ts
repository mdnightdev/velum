import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.midnightdev.velum',
  appName: 'velum',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
