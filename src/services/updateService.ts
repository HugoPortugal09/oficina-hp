// Update management for Desktop PWAs and Web Browsers

let hasUpdate = false;
let listeners: Array<(updateAvailable: boolean) => void> = [];

export function isUpdateAvailable(): boolean {
  return hasUpdate;
}

export function subscribeToUpdates(listener: (updateAvailable: boolean) => void): () => void {
  listeners.push(listener);
  listener(hasUpdate);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export async function checkForAppUpdate(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) return false;

    const data = await res.json();
    const currentBuild = typeof __APP_BUILD_TIMESTAMP__ !== 'undefined' ? __APP_BUILD_TIMESTAMP__ : 'dev';

    if (data.version && data.version !== 'dev' && currentBuild !== 'dev' && data.version !== currentBuild) {
      if (!hasUpdate) {
        console.log(`[UpdateService] Nova versão detectada! Atual: ${currentBuild}, Nova: ${data.version}`);
        hasUpdate = true;
        listeners.forEach(l => l(true));
      }
      return true;
    }
  } catch (err) {
    // Silently ignore network hiccups
  }
  return false;
}

export function reloadAppWithCacheClear(): void {
  try {
    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const reg of regs) {
            reg.unregister();
          }
        }).catch(() => {});
      }
      if ('caches' in window) {
        caches.keys().then(names => {
          for (const name of names) {
            caches.delete(name);
          }
        }).catch(() => {});
      }
    }
  } catch {}

  // Force clean reload bypass
  setTimeout(() => {
    window.location.href = window.location.pathname + '?_v=' + Date.now();
  }, 100);
}
