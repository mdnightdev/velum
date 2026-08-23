import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Automatically route relative API and WebSocket requests to Termux backend when inside Capacitor APK
if (typeof window !== 'undefined') {
  const nativeFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const isCapacitorOrLocalApk =
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';

    if (isCapacitorOrLocalApk && (url.startsWith('/v2/') || url.startsWith('/api/'))) {
      const targetUrl = `https://edition-approval-ranked-article.trycloudflare.com${url.startsWith('/') ? '' : '/'}${url}`;
      if (typeof input === 'string' || input instanceof URL) {
        input = targetUrl;
      } else {
        input = new Request(targetUrl, input);
      }
    }
    return nativeFetch.call(window, input, init);
  };
}

// Programmatic site cache & storage reset handler
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('clear') || urlParams.has('reset')) {
  (async () => {
    localStorage.clear();
    sessionStorage.clear();
  
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    if (window.indexedDB && window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }
    }

    window.location.replace(window.location.origin);
  })().catch(() => {
    window.location.replace(window.location.origin);
  });
} else {
  // Service worker registration
  if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
      });
    } else {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = (rootElement as any)._reactRoot || ReactDOM.createRoot(rootElement);
    (rootElement as any)._reactRoot = root;
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}
