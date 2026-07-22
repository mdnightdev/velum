import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  } else {
    // In development mode, unregister any existing service worker and clear caches to prevent stale caching issues
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let needsReload = false;
      const unregisterPromises = registrations.map((registration) => {
        return registration.unregister().then((success) => {
          if (success) {
            console.log('[DEV] Service Worker unregistered successfully to prevent stale caching.');
            needsReload = true;
          }
        });
      });

      Promise.all(unregisterPromises).then(() => {
        if (window.caches) {
          caches.keys().then((keys) => {
            Promise.all(keys.map(key => caches.delete(key))).then(() => {
              if (needsReload) {
                console.log('[DEV] Caches cleared. New assets will be fetched directly.');
              }
            });
          });
        }
      });
    });
  }
}
