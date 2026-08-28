import PocketBase from 'pocketbase';

let pbInstance: PocketBase | null = null;
let currentUrl: string = 'http://127.0.0.1:8090';

export function getPocketBase(url?: string): PocketBase {
  const targetUrl = url || localStorage.getItem('oficina_hp_pb_url') || 'http://127.0.0.1:8090';
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
      message: health.code === 200 ? 'Conectado ao PocketBase' : 'Servidor respondeu com erro'
    };
  } catch (err: any) {
    return {
      connected: false,
      message: err?.message || 'PocketBase offline (A utilizar armazenamento local seguro)'
    };
  }
}
