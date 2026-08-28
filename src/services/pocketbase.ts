import PocketBase from 'pocketbase';

let pbInstance: PocketBase | null = null;
let currentUrl: string = '';

export function getDefaultPocketBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('oficina_hp_pb_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
    
    // If running on easypanel host or production
    if (window.location.hostname.includes('easypanel.host') || window.location.protocol === 'https:') {
      return 'https://oficina-hp-pocketbase.l1mamt.easypanel.host';
    }
  }
  return 'https://oficina-hp-pocketbase.l1mamt.easypanel.host';
}

export function getPocketBase(url?: string): PocketBase {
  const rawUrl = url || getDefaultPocketBaseUrl();
  const targetUrl = rawUrl.trim().replace(/\/+$/, '');

  if (!pbInstance || currentUrl !== targetUrl) {
    currentUrl = targetUrl;
    pbInstance = new PocketBase(currentUrl);
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

export async function checkPocketBaseConnection(url?: string): Promise<{ connected: boolean; message: string }> {
  try {
    const pb = getPocketBase(url);
    const health = await pb.health.check();
    return {
      connected: health.code === 200,
      message: health.code === 200 ? 'Conectado ao PocketBase com Sucesso' : 'Servidor respondeu com erro'
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err?.message || 'PocketBase offline (A utilizar armazenamento local seguro)'
    };
  }
}
