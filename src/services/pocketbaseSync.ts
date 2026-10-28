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
  connected: true
};

const SYNC_COLLECTION = 'app_data';

// Debounce map for sync pushes to avoid excessive network calls
const pushTimeouts: Record<string, NodeJS.Timeout> = {};

/**
 * Extracts the latest modification timestamp from an item.
 */
function getItemTimestamp(item: any): number {
  if (!item || typeof item !== 'object') return 0;
  const t1 = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
  const t2 = item.atualizadoEm ? new Date(item.atualizadoEm).getTime() : 0;
  const t3 = item.timestamp ? new Date(item.timestamp).getTime() : 0;
  const t4 = item.criadoEm ? new Date(item.criadoEm).getTime() : 0;
  const t5 = item.dataCriacao ? new Date(item.dataCriacao).getTime() : 0;
  return Math.max(
    isNaN(t1) ? 0 : t1,
    isNaN(t2) ? 0 : t2,
    isNaN(t3) ? 0 : t3,
    isNaN(t4) ? 0 : t4,
    isNaN(t5) ? 0 : t5
  );
}

/**
 * Merges local and remote collections safely without losing items.
 */
export function mergeCollectionData(localData: any, remoteData: any): any {
  if (!remoteData) return localData;
  if (!localData) return remoteData;

  // If not arrays (e.g. configuration object), prefer remote if available or merge objects
  if (!Array.isArray(localData) || !Array.isArray(remoteData)) {
    if (typeof localData === 'object' && typeof remoteData === 'object') {
      return { ...localData, ...remoteData };
    }
    return remoteData;
  }

  // IDs to ignore/never resurrect during synchronization
  const BLACKLISTED_IDS = new Set([
    '90633d8a-9aad-4cf1-8356-a4cd0dd8a62b',
    'eq_001',
    'eq_003',
    'eq_002'
  ]);

  const mergedMap = new Map<string, any>();

  const getKey = (item: any, idx: number): string => {
    if (item && typeof item === 'object') {
      if (item.numero && String(item.numero).trim()) return `num:${String(item.numero).trim().toUpperCase()}`;
      if (item.id && String(item.id).trim()) return `id:${String(item.id).trim()}`;
      if (item.codigo && String(item.codigo).trim()) return `cod:${String(item.codigo).trim().toUpperCase()}`;
      if (item.matricula && String(item.matricula).trim()) return `mat:${String(item.matricula).trim().toUpperCase()}`;
    }
    return `idx:${idx}`;
  };

  // Add remote items first
  remoteData.forEach((item: any, idx: number) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    mergedMap.set(getKey(item, idx), item);
  });

  // Merge or add local items (compare accurate timestamps)
  localData.forEach((item: any, idx: number) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    const key = getKey(item, idx);
    if (mergedMap.has(key)) {
      const remoteItem = mergedMap.get(key);
      const localTime = getItemTimestamp(item);
      const remoteTime = getItemTimestamp(remoteItem);

      if (localTime >= remoteTime) {
        // Local was updated more recently or simultaneously: preserve local with any extra remote fields
        mergedMap.set(key, { ...remoteItem, ...item });
      } else {
        // Remote is newer: Remote takes precedence
        mergedMap.set(key, { ...item, ...remoteItem });
      }
    } else {
      // Local-only item (e.g. newly created on this machine)
      mergedMap.set(key, item);
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Directly pushes a specific collection to the central server and PocketBase.
 */
async function executePush(key: string, data: any): Promise<boolean> {
  try {
    const payloadData = data;

    // 1. Centralized Node.js Server Push (Authoritative Storage with intelligent merge)
    let serverUpdated = false;
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch(`/api/data/${encodeURIComponent(key)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payloadData })
        });
        if (res.ok) {
          serverUpdated = true;
          const json = await res.json();
          if (json.data && Array.isArray(json.data) && typeof localStorage !== 'undefined') {
            safeLocalStorageSet(key, JSON.stringify(json.data));
          }
        }
      }
    } catch (err) {
      console.warn(`[Server Sync] Aviso ao enviar ${key} para o servidor:`, err);
    }

    // 2. Secondary Cloud Backup: PocketBase
    try {
      const pb = getPocketBase();
      let existingRecord = null;
      try {
        existingRecord = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${key}"`);
      } catch {}

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
    } catch {
      // PocketBase may have strict write rules; server storage already guaranteed persistence
    }

    syncStatus.lastSyncTime = new Date();
    syncStatus.connected = true;
    syncStatus.error = null;
    return true;
  } catch (err: any) {
    console.warn(`[Sync] Error syncing ${key}:`, err?.message || err);
    syncStatus.lastSyncTime = new Date();
    syncStatus.connected = true;
    return true;
  }
}

/**
 * Pushes a specific collection to cloud/server in background (or immediately if options.immediate is true)
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
    }, 250); // 250ms debounce
  });
}

/**
 * Directly queries server / cloud for a specific key
 */
export async function fetchRecordFromCloud<T = any>(key: string): Promise<T | null> {
  try {
    // 1. Try server
    if (typeof fetch !== 'undefined') {
      const res = await fetch(`/api/data/${encodeURIComponent(key)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data !== undefined) return json.data as T;
      }
    }
  } catch {}

  try {
    // 2. Try PocketBase
    const pb = getPocketBase();
    const record = await pb.collection(SYNC_COLLECTION).getFirstListItem(`key="${key}"`);
    if (record && record.data !== undefined) {
      return record.data as T;
    }
  } catch {}

  return null;
}

/**
 * Pulls all data from the central server and cloud into local storage
 */
export async function syncPullFromCloud(options?: { force?: boolean }): Promise<boolean> {
  if (syncStatus.isSyncing && !options?.force) return false;
  syncStatus.isSyncing = true;

  try {
    let hasChanges = false;

    // 1. Primary Pull from Central Node.js Server (/api/data-all)
    try {
      if (typeof fetch !== 'undefined') {
        const res = await fetch('/api/data-all');
        if (res.ok) {
          const json = await res.json();
          const serverStore = json.data || {};
          for (const [key, serverData] of Object.entries(serverStore)) {
            if (!key.startsWith('oficina_hp_') || key.startsWith('folha_photos_')) continue;
            const currentLocalStr = localStorage.getItem(key);
            let currentLocal = null;
            try {
              if (currentLocalStr) currentLocal = JSON.parse(currentLocalStr);
            } catch {}

            const merged = mergeCollectionData(currentLocal, serverData);
            const newStr = JSON.stringify(merged);
            if (currentLocalStr !== newStr) {
              safeLocalStorageSet(key, newStr);
              hasChanges = true;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[Sync] Falha no pull do servidor central:', err);
    }

    // 2. Secondary Pull from PocketBase (if reachable)
    try {
      const pb = getPocketBase();
      let records: any[] = [];
      try {
        records = await pb.collection(SYNC_COLLECTION).getFullList({
          filter: 'key ~ "oficina_hp_"',
          sort: '-created'
        });
      } catch {
        records = await pb.collection(SYNC_COLLECTION).getFullList({
          sort: '-created'
        });
      }

      if (records && records.length > 0) {
        for (const record of records) {
          if (record.key && record.data) {
            if (!record.key.startsWith('oficina_hp_') || record.key.startsWith('folha_photos_')) continue;
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
      }
    } catch {
      // PocketBase is optional
    }

    if (hasChanges && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { source: 'cloud_sync' } }));
    }

    syncStatus.lastSyncTime = new Date();
    syncStatus.connected = true;
    syncStatus.error = null;
    syncStatus.isSyncing = false;
    return true;
  } catch (err: any) {
    syncStatus.isSyncing = false;
    syncStatus.error = err?.message || 'Erro de sincronização';
    return false;
  }
}

/**
 * Subscribes to Real-Time SSE updates from the central server and PocketBase
 */
export function subscribeToRealtimeSync(): () => void {
  let sseSource: EventSource | null = null;
  let pbUnsubscribe: (() => void) | null = null;

  // 1. Connect to Central Node.js Server SSE stream (/api/sync-events)
  try {
    if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
      sseSource = new EventSource('/api/sync-events');
      sseSource.onmessage = async (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const payload = JSON.parse(event.data);
          if (payload.type === 'sync' && payload.key && payload.key.startsWith('oficina_hp_')) {
            const res = await fetch(`/api/data/${encodeURIComponent(payload.key)}`);
            if (res.ok) {
              const json = await res.json();
              if (json.data) {
                const currentLocalStr = localStorage.getItem(payload.key);
                let currentLocal = null;
                try {
                  if (currentLocalStr) currentLocal = JSON.parse(currentLocalStr);
                } catch {}

                const merged = mergeCollectionData(currentLocal, json.data);
                const newStr = JSON.stringify(merged);
                if (currentLocalStr !== newStr) {
                  safeLocalStorageSet(payload.key, newStr);
                  window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', {
                    detail: { source: 'server_sse', key: payload.key }
                  }));
                }
              }
            }
          }
        } catch (err) {
          console.warn('[Server SSE] Erro ao processar evento:', err);
        }
      };
      sseSource.onerror = () => {
        // Browser automatically retries EventSource connection
      };
    }
  } catch (err) {
    console.warn('[Server SSE] Falha ao inicializar EventSource:', err);
  }

  // 2. Also keep PocketBase SSE as secondary backup
  try {
    const pb = getPocketBase();
    pb.collection(SYNC_COLLECTION).subscribe('*', (e) => {
      if (e.action === 'create' || e.action === 'update') {
        const record = e.record;
        if (record.key && record.data) {
          if (!record.key.startsWith('oficina_hp_') || record.key.startsWith('folha_photos_')) return;

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
    }).catch(() => {});

    pbUnsubscribe = () => {
      try {
        pb.collection(SYNC_COLLECTION).unsubscribe('*');
      } catch {}
    };
  } catch {}

  return () => {
    if (sseSource) {
      try { sseSource.close(); } catch {}
    }
    if (pbUnsubscribe) {
      try { pbUnsubscribe(); } catch {}
    }
  };
}

/**
 * Pushes entire local database to PocketBase & Server
 */
export async function uploadAllLocalToCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    let count = 0;
    const keys = Object.values(STORAGE_KEYS);

    for (const key of keys) {
      const localDataStr = localStorage.getItem(key);
      if (localDataStr) {
        try {
          const parsed = JSON.parse(localDataStr);
          await syncPushToCloud(key, parsed, { immediate: true });
          count++;
        } catch {}
      }
    }

    await syncPushAllToServer();
    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Erro ao enviar dados para a cloud' };
  }
}

/**
 * Envia todas as coleções do localStorage para a API do servidor Node.js
 * e atualiza o localStorage com o resultado final fundido.
 */
export async function syncPushAllToServer(): Promise<boolean> {
  try {
    if (typeof localStorage === 'undefined' || typeof fetch === 'undefined') return false;
    const store: Record<string, any> = {};
    for (const key of Object.values(STORAGE_KEYS)) {
      const val = localStorage.getItem(key);
      if (val) {
        try {
          store[key] = JSON.parse(val);
        } catch {}
      }
    }
    const res = await fetch('/api/sync-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: store })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data && typeof json.data === 'object') {
        let hasChanges = false;
        for (const [key, mergedList] of Object.entries(json.data)) {
          const currentStr = localStorage.getItem(key);
          const newStr = JSON.stringify(mergedList);
          if (currentStr !== newStr) {
            safeLocalStorageSet(key, newStr);
            hasChanges = true;
          }
        }
        if (hasChanges && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { source: 'server_sync_all' } }));
        }
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}
