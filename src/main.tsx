import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SecureStorage } from './utils/SecureStorage.ts';

// Sync sessionStorage with localStorage for velum- keys securely
SecureStorage.initializeOverrides();


// Programmatic site cache reset handler (very helpful for mobile devices)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('clear') || urlParams.has('reset')) {
  localStorage.clear();
  sessionStorage.clear();
  
  const reload = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const unregisterPromises = registrations.map(reg => reg.unregister());
        Promise.all(unregisterPromises).then(() => {
          if (window.caches) {
            caches.keys().then((keys) => {
              Promise.all(keys.map(key => caches.delete(key))).then(() => {
                window.location.href = window.location.origin;
              });
            });
          } else {
            window.location.href = window.location.origin;
          }
        });
      });
    } else {
      window.location.href = window.location.origin;
    }
  };

  try {
    let completed = 0;
    const checkDone = () => {
      completed++;
      if (completed === 2) reload();
    };
    const r1 = window.indexedDB.deleteDatabase('velum_local_storage');
    const r2 = window.indexedDB.deleteDatabase('velum_crypto_vault');
    r1.onsuccess = checkDone;
    r1.onerror = checkDone;
    r1.onblocked = checkDone;
    r2.onsuccess = checkDone;
    r2.onerror = checkDone;
    r2.onblocked = checkDone;
  } catch (e) {
    console.error('Failed to delete indexedDB', e);
    reload();
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
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

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
