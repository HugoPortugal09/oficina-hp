import { getPocketBase } from './pocketbase';
import { STORAGE_KEYS } from './dbService';
import { safeLocalStorageSet } from '../utils/storageUtils';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: Date | null;
  error: string | null;
  connected: boolean;
}

let syncStatus: SyncStatus = {
  isSyncing: false,
  lastSyncTime: null,
  error: null,
  connected: false
};

const SYNC_COLLECTION = 'app_data';

// Debounce map for sync pushes to avoid excessive network calls
const pushTimeouts: Record<string, NodeJS.Timeout> = {};

/**
 * Merges local and cloud collections safely without losing items.
 */
function mergeCollectionData(localData: any, cloudData: any): any {
  if (!cloudData) return localData;
  if (!localData) return cloudData;

  // If not arrays (e.g. configuration object), prefer cloud if available or merge objects
  if (!Array.isArray(localData) || !Array.isArray(cloudData)) {
    if (typeof localData === 'object' && typeof cloudData === 'object') {
      return { ...cloudData, ...localData };
    }
    return cloudData;
  }

  // If arrays of objects, merge by unique key
  const mergedMap = new Map<string, any>();

  const getKey = (item: any, idx: number): string => {
    if (item && typeof item === 'object') {
      if (item.id) return `id:${item.id}`;
      if (item.numero) return `num:${item.numero}`;
      if (item.codigo) return `cod:${item.codigo}`;
      if (item.matricula) return `mat:${item.matricula}`;
    }
    return `idx:${idx}`;
  };

  // Add cloud items first
  cloudData.forEach((item, idx) => {
    mergedMap.set(getKey(item, idx), item);
  });

  // Merge or add local items (compare updatedAt timestamps if available)
  localData.forEach((item, idx) => {
    const key = getKey(item, idx);
    if (mergedMap.has(key)) {
      const cloudItem = mergedMap.get(key);
      const localTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const cloudTime = cloudItem.updatedAt ? new Date(cloudItem.updatedAt).getTime() : 0;

      if (cloudTime > localTime) {
        // Cloud is newer: keep cloud fields, but preserve local non-overlapping fields
        mergedMap.set(key, { ...item, ...cloudItem });
      } else {
        // Local is newer or timestamps equal/missing: local fields take precedence
        mergedMap.set(key, { ...cloudItem, ...item });
      }
    } else {
      // Local-only item: preserve it!
      mergedMap.set(key, item);
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Pushes a specific collection to PocketBase cloud in background
 */
export async function syncPushToCloud(key: string, data: any): Promise<boolean> {
  // Clear any existing debounce timeout for this key
  if (pushTimeouts[key]) {
    clearTimeout(pushTimeouts[key]);
  }

  return new Promise((resolve) => {
    pushTimeouts[key] = setTimeout(async () => {
      try {
        const pb = getPocketBase();
        
        // Find if record already exists for this key
        let existingRecord = null;
        try {
          existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${key}"`);
        } catch (e: any) {
          // Record doesn't exist yet (404)
        }

        let payloadData = data;
        if (existingRecord && Array.isArray(data) && Array.isArray(existingRecord.data)) {
          // Merge with remote data so concurrent additions aren't wiped
          payloadData = mergeCollectionData(data, existingRecord.data);
          // If remote had items not yet in localStorage, write them back
          if (payloadData.length !== data.length && typeof localStorage !== 'undefined') {
            safeLocalStorageSet(key, JSON.stringify(payloadData));
          }
        }

        if (existingRecord) {
          await pb.collection(SYNC_COLLECTION).update(existingRecord.id, {
            data: payloadData,
            timestamp: new Date().toISOString()
          });
        } else {
          await pb.collection(SYNC_COLLECTION).create({
            key: key,
            data: payloadData,
            timestamp: new Date().toISOString()
          });
        }

        syncStatus.lastSyncTime = new Date();
        syncStatus.connected = true;
        syncStatus.error = null;
        resolve(true);
      } catch (err: any) {
        console.warn(`[PocketBase Sync] Error syncing ${key}:`, err?.message || err);
        syncStatus.error = err?.message || 'Erro ao sincronizar com servidor';
        resolve(false);
      }
    }, 300); // 300ms debounce
  });
}

/**
 * Pulls all data from PocketBase cloud into local storage
 */
export async function syncPullFromCloud(): Promise<boolean> {
  if (syncStatus.isSyncing) return false;
  syncStatus.isSyncing = true;

  try {
    const pb = getPocketBase();
    const records = await pb.collection(SYNC_COLLECTION).getFullList({
      sort: '-created'
    });

    if (records && records.length > 0) {
      let hasChanges = false;
      for (const record of records) {
        if (record.key && record.data) {
          const currentLocalStr = localStorage.getItem(record.key);
          let currentLocal = null;
          try {
            if (currentLocalStr) currentLocal = JSON.parse(currentLocalStr);
          } catch {}

          const merged = mergeCollectionData(currentLocal, record.data);
          const newCloudStr = JSON.stringify(merged);
          if (currentLocalStr !== newCloudStr) {
            safeLocalStorageSet(record.key, newCloudStr);
            hasChanges = true;
          }
        }
      }

      if (hasChanges && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { source: 'cloud_sync' } }));
      }
    }

    syncStatus.lastSyncTime = new Date();
    syncStatus.connected = true;
    syncStatus.error = null;
    syncStatus.isSyncing = false;
    return true;
  } catch (err: any) {
    syncStatus.isSyncing = false;
    syncStatus.error = err?.message || 'Servidor PocketBase não acessível';
    return false;
  }
}

/**
 * Subscribes to Real-Time SSE updates from PocketBase
 */
export function subscribeToRealtimeSync(): () => void {
  try {
    const pb = getPocketBase();
    pb.collection(SYNC_COLLECTION).subscribe('*', (e) => {
      if (e.action === 'create' || e.action === 'update') {
        const record = e.record;
        if (record.key && record.data) {
          const currentLocalStr = localStorage.getItem(record.key);
          let currentLocal = null;
          try {
            if (currentLocalStr) currentLocal = JSON.parse(currentLocalStr);
          } catch {}

          const merged = mergeCollectionData(currentLocal, record.data);
          const newCloudStr = JSON.stringify(merged);
          if (currentLocalStr !== newCloudStr) {
            safeLocalStorageSet(record.key, newCloudStr);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { source: 'realtime_event', key: record.key } }));
            }
          }
        }
      }
    }).catch((err) => {
      console.warn('[PocketBase Realtime] Subscription error:', err);
    });

    return () => {
      try {
        pb.collection(SYNC_COLLECTION).unsubscribe('*');
      } catch {}
    };
  } catch (err) {
    console.warn('[PocketBase Realtime] Init error:', err);
    return () => {};
  }
}

/**
 * Pushes entire local database to PocketBase (Initial Push/Upload)
 */
export async function uploadAllLocalToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const pb = getPocketBase();
    let count = 0;
    const keys = Object.values(STORAGE_KEYS);

    for (const key of keys) {
      const localDataStr = localStorage.getItem(key);
      if (localDataStr) {
        try {
          const parsed = JSON.parse(localDataStr);
          await syncPushToCloud(key, parsed);
          count++;
        } catch {}
      }
    }

    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Erro ao enviar dados para a cloud' };
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

