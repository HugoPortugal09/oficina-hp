import { getPocketBase } from './pocketbase';

const SYNC_COLLECTION = 'app_data';
const DB_NAME = 'oficina_hp_media_db';
const STORE_NAME = 'folha_photos';
const DB_VERSION = 1;

/**
 * Interface para registo de fotografias de uma folha de serviço
 */
export interface FolhaPhotosRecord {
  folhaId: string;
  folhaNumero?: string;
  photos: string[];
  updatedAt: string;
}

/**
 * Inicializa a base de dados local IndexedDB para armazenamento seguro e ilimitado de fotografias
 */
function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não suportado'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'folhaId' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Erro ao abrir IndexedDB'));
    };
  });
}

/**
 * Grava fotografias localmente no IndexedDB
 */
export async function savePhotosToIndexedDB(folhaId: string, photos: string[], folhaNumero?: string): Promise<boolean> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: FolhaPhotosRecord = {
        folhaId,
        folhaNumero,
        photos,
        updatedAt: new Date().toISOString()
      };
      const req = store.put(record);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        console.warn('[PhotoService] Erro ao gravar no IndexedDB:', req.error);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn('[PhotoService] Falha ao aceder ao IndexedDB:', err);
    // Fallback: guardar em sessionStorage/localStorage pontual se for pequena
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`fs_photos_${folhaId}`, JSON.stringify(photos));
      }
    } catch {}
    return false;
  }
}

/**
 * Lê fotografias do IndexedDB local
 */
export async function getPhotosFromIndexedDB(folhaId: string): Promise<string[] | null> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(folhaId);

      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result.photos)) {
          resolve(req.result.photos);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    // Fallback para sessionStorage
    try {
      if (typeof window !== 'undefined') {
        const item = sessionStorage.getItem(`fs_photos_${folhaId}`);
        if (item) return JSON.parse(item);
      }
    } catch {}
    return null;
  }
}

/**
 * Envia as fotografias de uma folha de serviço diretamente para o PocketBase (Cloud)
 * e atualiza o registo local no IndexedDB.
 */
export async function uploadFolhaPhotos(
  folhaId: string,
  folhaNumero: string | undefined,
  photos: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!folhaId) {
    return { success: false, count: 0, error: 'ID de folha inválido' };
  }

  // 1. Gravar de imediato localmente no IndexedDB (nunca se perde)
  await savePhotosToIndexedDB(folhaId, photos, folhaNumero);

  const recordKey = `folha_photos_${folhaId}`;
  const nowIso = new Date().toISOString();
  const payloadData: FolhaPhotosRecord = {
    folhaId,
    folhaNumero,
    photos,
    updatedAt: nowIso
  };

  // 2. Enviar para o Servidor Central Node.js (autoritativo)
  let serverSaved = false;
  try {
    if (typeof fetch !== 'undefined') {
      const res1 = await fetch(`/api/data/${encodeURIComponent(recordKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payloadData })
      });
      if (res1.ok) serverSaved = true;

      if (folhaNumero) {
        const numKey = `folha_photos_num_${folhaNumero}`;
        await fetch(`/api/data/${encodeURIComponent(numKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payloadData })
        });
      }
    }
  } catch (srvErr) {
    console.warn('[PhotoService] Aviso ao gravar fotos no servidor central:', srvErr);
  }

  // 3. Enviar para o PocketBase na coleção 'app_data' (backup secundário)
  try {
    const pb = getPocketBase();

    let existingRecord: any = null;
    try {
      existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${recordKey}"`);
    } catch {}

    if (!existingRecord && folhaNumero) {
      try {
        existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="folha_photos_num_${folhaNumero}"`);
      } catch {}
    }

    if (existingRecord) {
      await pb.collection(SYNC_COLLECTION).update(existingRecord.id, {
        data: payloadData,
        timestamp: nowIso
      });
    } else {
      await pb.collection(SYNC_COLLECTION).create({
        key: recordKey,
        data: payloadData,
        timestamp: nowIso
      });
    }

    if (folhaNumero) {
      try {
        const numKey = `folha_photos_num_${folhaNumero}`;
        let numRecord: any = null;
        try {
          numRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${numKey}"`);
        } catch {}

        if (numRecord) {
          await pb.collection(SYNC_COLLECTION).update(numRecord.id, {
            data: payloadData,
            timestamp: nowIso
          });
        } else {
          await pb.collection(SYNC_COLLECTION).create({
            key: numKey,
            data: payloadData,
            timestamp: nowIso
          });
        }
      } catch {}
    }

    return { success: true, count: photos.length };
  } catch (err: any) {
    if (serverSaved) {
      return { success: true, count: photos.length };
    }
    return {
      success: false,
      count: photos.length,
      error: err?.message || 'Erro ao sincronizar com servidor na nuvem'
    };
  }
}

/**
 * Procura fotografias de uma folha:
 * 1. Primeiro no Servidor Central Node.js (/api/data/folha_photos_...)
 * 2. No IndexedDB local
 * 3. Em simultâneo ou fallback, pesquisa no PocketBase Cloud
 */
export async function fetchFolhaPhotos(folhaId: string, folhaNumero?: string): Promise<string[]> {
  if (!folhaId && !folhaNumero) return [];

  // 1. Procurar localmente no IndexedDB
  let localPhotos: string[] | null = null;
  if (folhaId) {
    localPhotos = await getPhotosFromIndexedDB(folhaId);
  }

  // 2. Consultar Servidor Central Node.js
  try {
    if (typeof fetch !== 'undefined') {
      const keysToTry: string[] = [];
      if (folhaNumero) keysToTry.push(`folha_photos_num_${folhaNumero}`);
      if (folhaId) keysToTry.push(`folha_photos_${folhaId}`);

      for (const k of keysToTry) {
        const res = await fetch(`/api/data/${encodeURIComponent(k)}`);
        if (res.ok) {
          const json = await res.json();
          const srvPhotos = json?.data?.photos;
          if (Array.isArray(srvPhotos) && srvPhotos.length > 0) {
            if (folhaId) {
              savePhotosToIndexedDB(folhaId, srvPhotos, folhaNumero).catch(() => {});
            }
            return srvPhotos;
          }
        }
      }
    }
  } catch (srvErr) {
    console.warn('[PhotoService] Aviso ao consultar fotos no servidor central:', srvErr);
  }

  // 3. Consultar o PocketBase Cloud
  try {
    const pb = getPocketBase();
    let cloudRecord: any = null;

    if (folhaId) {
      try {
        cloudRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="folha_photos_${folhaId}"`);
      } catch {}
    }

    if (!cloudRecord && folhaNumero) {
      try {
        cloudRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="folha_photos_num_${folhaNumero}"`);
      } catch {}
    }

    if (cloudRecord && cloudRecord.data && Array.isArray(cloudRecord.data.photos)) {
      const cloudPhotos: string[] = cloudRecord.data.photos;
      if (folhaId && cloudPhotos.length > 0) {
        savePhotosToIndexedDB(folhaId, cloudPhotos, folhaNumero).catch(() => {});
      }
      return cloudPhotos;
    }
  } catch {}

  return localPhotos || [];
}

/**
 * Remove uma fotografia e sincroniza a alteração
 */
export async function deleteFolhaPhoto(
  folhaId: string,
  folhaNumero: string | undefined,
  photoIndex: number,
  currentPhotos: string[]
): Promise<string[]> {
  const updated = currentPhotos.filter((_, idx) => idx !== photoIndex);
  await uploadFolhaPhotos(folhaId, folhaNumero, updated);
  return updated;
}
