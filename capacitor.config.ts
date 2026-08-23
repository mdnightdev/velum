import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.midnightdev.velum',
  appName: 'velum',
  webDir: 'dist',
  server: {
    url: 'https://edition-approval-ranked-article.trycloudflare.com',
    cleartext: true
  }
};

export default config;
