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

  // 2. Enviar diretamente para o PocketBase na coleção 'app_data'
  const recordKey = `folha_photos_${folhaId}`;
  const nowIso = new Date().toISOString();

  try {
    const pb = getPocketBase();

    let existingRecord: any = null;
    try {
      existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${recordKey}"`);
    } catch {
      // 404 - ainda não existe
    }

    // Se tiver folhaNumero, verificar se existe por folhaNumero caso ID seja recente
    if (!existingRecord && folhaNumero) {
      try {
        existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="folha_photos_num_${folhaNumero}"`);
      } catch {}
    }

    const payloadData: FolhaPhotosRecord = {
      folhaId,
      folhaNumero,
      photos,
      updatedAt: nowIso
    };

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

    // Se tiver número, criar ou atualizar também o backup por número para redundância total
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
      } catch (errBackup) {
        console.warn('[PhotoService] Aviso no backup por número:', errBackup);
      }
    }

    console.log(`[PhotoService] ✓ ${photos.length} fotografias sincronizadas com sucesso para a folha ${folhaNumero || folhaId}`);
    return { success: true, count: photos.length };
  } catch (err: any) {
    console.error('[PhotoService] Erro ao sincronizar fotos com a Cloud PocketBase:', err);
    return {
      success: false,
      count: photos.length,
      error: err?.message || 'Erro ao sincronizar com servidor na nuvem'
    };
  }
}

/**
 * Procura fotografias de uma folha:
 * 1. Primeiro no IndexedDB local
 * 2. Em simultâneo ou fallback, pesquisa no PocketBase Cloud
 */
export async function fetchFolhaPhotos(folhaId: string, folhaNumero?: string): Promise<string[]> {
  if (!folhaId && !folhaNumero) return [];

  // 1. Procurar localmente no IndexedDB
  let localPhotos: string[] | null = null;
  if (folhaId) {
    localPhotos = await getPhotosFromIndexedDB(folhaId);
  }

  // 2. Consultar o PocketBase Cloud
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
      // Atualizar cache local no IndexedDB
      if (folhaId && cloudPhotos.length > 0) {
        savePhotosToIndexedDB(folhaId, cloudPhotos, folhaNumero).catch(() => {});
      }
      return cloudPhotos;
    }
  } catch (err) {
    console.warn('[PhotoService] Não foi possível consultar fotos remotas na Cloud:', err);
  }

  // Se a cloud falhou ou não encontrou, retornar fotos locais se existirem
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
