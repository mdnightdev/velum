import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Sync sessionStorage with localStorage for velum- keys to prevent PWA/tab hibernate logout
const velumKeys = ['velum-user', 'velum-sessionId', 'velum-deviceId'];
for (const key of velumKeys) {
  try {
    const localVal = localStorage.getItem(key);
    const sessionVal = sessionStorage.getItem(key);
    if (localVal && !sessionVal) {
      sessionStorage.setItem(key, localVal);
    } else if (sessionVal && !localVal) {
      localStorage.setItem(key, sessionVal);
    }
  } catch (_) {}
}

try {
  const originalSetItem = sessionStorage.setItem;
  sessionStorage.setItem = function(key, value) {
    originalSetItem.call(sessionStorage, key, value);
    if (velumKeys.includes(key)) {
      localStorage.setItem(key, value);
    }
  };

  const originalRemoveItem = sessionStorage.removeItem;
  sessionStorage.removeItem = function(key) {
    originalRemoveItem.call(sessionStorage, key);
    if (velumKeys.includes(key)) {
      localStorage.removeItem(key);
    }
  };
} catch (_) {}


// Programmatic site cache reset handler (very helpful for mobile devices)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('clear') || urlParams.has('reset')) {
  localStorage.clear();
  sessionStorage.clear();
  
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
}

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
