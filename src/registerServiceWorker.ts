// Register Service Worker for PWA Offline & Install support
export function registerServiceWorker(onUpdate?: (registration: ServiceWorkerRegistration) => void) {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[PWA] New content is available; please refresh.');
                  if (onUpdate) {
                    onUpdate(registration);
                  }
                } else {
                  console.log('[PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });
    });
  }
}
