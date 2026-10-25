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
function getItemTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const t1 = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const t2 = item.atualizadoEm ? new Date(item.atualizadoEm).getTime() : 0;
  const t3 = item.timestamp ? new Date(item.timestamp).getTime() : 0;
  const t4 = item.criadoEm ? new Date(item.criadoEm).getTime() : 0;
  return Math.max(isNaN(t1) ? 0 : t1, isNaN(t2) ? 0 : t2, isNaN(t3) ? 0 : t3, isNaN(t4) ? 0 : t4);
}

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

  // IDs to ignore/never resurrect during synchronization
  const BLACKLISTED_IDS = new Set([
    '90633d8a-9aad-4cf1-8356-a4cd0dd8a62b',
    'eq_001',
    'eq_003',
    'eq_002'
  ]);

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

  // Add cloud items first (Cloud is the primary centralized truth)
  cloudData.forEach((item: any, idx: number) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    mergedMap.set(getKey(item, idx), item);
  });

  // Merge or add local items (compare accurate timestamps)
  localData.forEach((item: any, idx: number) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    const key = getKey(item, idx);
    if (mergedMap.has(key)) {
      const cloudItem = mergedMap.get(key);
      const localTime = getItemTimestamp(item);
      const cloudTime = getItemTimestamp(cloudItem);

      if (localTime > cloudTime) {
        // Local was explicitly updated more recently on this machine: keep local item
        mergedMap.set(key, item);
      } else {
        // Cloud is newer, or timestamps are equal/missing: Cloud is the canonical source of truth
        mergedMap.set(key, cloudItem);
      }
    } else {
      // Local-only item (e.g. newly created offline)
      mergedMap.set(key, item);
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Directly pushes a specific collection or item to PocketBase cloud immediately.
 */
async function executePush(key: string, data: any): Promise<boolean> {
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
    return true;
  } catch (err: any) {
    console.warn(`[PocketBase Sync] Error syncing ${key}:`, err?.message || err);
    syncStatus.error = err?.message || 'Erro ao sincronizar com servidor';
    return false;
  }
}

/**
 * Pushes a specific collection to PocketBase cloud in background (or immediately if options.immediate is true)
 */
export async function syncPushToCloud(key: string, data: any, options?: { immediate?: boolean }): Promise<boolean> {
  // Clear any existing debounce timeout for this key
  if (pushTimeouts[key]) {
    clearTimeout(pushTimeouts[key]);
    delete pushTimeouts[key];
  }

  if (options?.immediate) {
    return executePush(key, data);
  }

  return new Promise((resolve) => {
    pushTimeouts[key] = setTimeout(async () => {
      delete pushTimeouts[key];
      const result = await executePush(key, data);
      resolve(result);
    }, 300); // 300ms debounce
  });
}

/**
 * Directly queries PocketBase for a specific key without doing a full collection pull.
 */
export async function fetchRecordFromCloud<T = any>(key: string): Promise<T | null> {
  try {
    const pb = getPocketBase();
    const record = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${key}"`);
    if (record && record.data !== undefined) {
      return record.data as T;
    }
  } catch (err: any) {
    // 404 not found or network error
  }
  return null;
}

/**
 * Pulls all data from PocketBase cloud into local storage
 */
export async function syncPullFromCloud(options?: { force?: boolean }): Promise<boolean> {
  if (syncStatus.isSyncing && !options?.force) return false;
  syncStatus.isSyncing = true;

  try {
    const pb = getPocketBase();
    // Exclude heavy photo records from full sync - photos are fetched on demand via fetchFolhaPhotos
    let records: any[] = [];
    try {
      records = await pb.collection(SYNC_COLLECTION).getFullList({
        filter: 'key !~ "folha_photos_"',
        sort: '-created'
      });
    } catch {
      // Fallback without filter if server doesn't support the operator
      records = await pb.collection(SYNC_COLLECTION).getFullList({
        sort: '-created'
      });
    }

    if (records && records.length > 0) {
      let hasChanges = false;
      for (const record of records) {
        if (record.key && record.data) {
          // Skip any photo keys if they somehow bypass the filter
          if (record.key.startsWith('folha_photos_')) continue;
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
          // Photos are managed on-demand by photoStorageService to avoid blocking main thread
          if (record.key.startsWith('folha_photos_')) return;

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

