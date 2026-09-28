import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './registerServiceWorker';

// Auto-recovery when a new deployment invalidates old chunks in user's browser
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = (e?.message || '').toLowerCase();
    if (
      msg.includes('loading chunk') ||
      msg.includes('dynamically imported module') ||
      msg.includes('failed to fetch') ||
      msg.includes('chunkloaderror')
    ) {
      const lastReload = sessionStorage.getItem('oficina_hp_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('oficina_hp_chunk_reload', String(now));
        console.warn('[App] Novo deploy detetado. A recarregar ficheiros mais recentes...');
        if ('caches' in window) {
          caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Register PWA Service Worker
registerServiceWorker();
