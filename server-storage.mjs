import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'server_data_store.json');

// In-memory cache of stored collections
let memoryStore = {};

try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    memoryStore = JSON.parse(raw);
    console.log(`[ServerStorage] 📦 Carregadas ${Object.keys(memoryStore).length} coleções de ${DATA_FILE}`);
  }
} catch (err) {
  console.warn('[ServerStorage] Aviso ao carregar server_data_store.json:', err.message);
  memoryStore = {};
}

let saveTimeout = null;

function persistToDisk() {
  try {
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(memoryStore, null, 2), 'utf8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('[ServerStorage] ❌ Erro ao gravar no disco:', err.message);
  }
}

function schedulePersist() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    persistToDisk();
    saveTimeout = null;
  }, 200);
}

function getItemTimestamp(item) {
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

const BLACKLISTED_IDS = new Set([
  '90633d8a-9aad-4cf1-8356-a4cd0dd8a62b',
  'eq_001',
  'eq_003',
  'eq_002'
]);

function getKey(item, idx) {
  if (item && typeof item === 'object') {
    if (item.numero && String(item.numero).trim()) return `num:${String(item.numero).trim().toUpperCase()}`;
    if (item.id && String(item.id).trim()) return `id:${String(item.id).trim()}`;
    if (item.codigo && String(item.codigo).trim()) return `cod:${String(item.codigo).trim().toUpperCase()}`;
    if (item.matricula && String(item.matricula).trim()) return `mat:${String(item.matricula).trim().toUpperCase()}`;
  }
  return `idx:${idx}`;
}

export function mergeCollection(currentData, incomingData) {
  if (!incomingData) return currentData;
  if (!currentData) return incomingData;

  if (!Array.isArray(currentData) || !Array.isArray(incomingData)) {
    if (typeof currentData === 'object' && typeof incomingData === 'object') {
      return { ...currentData, ...incomingData };
    }
    return incomingData;
  }

  const mergedMap = new Map();

  // 1. Inserir dados existentes no servidor
  currentData.forEach((item, idx) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    mergedMap.set(getKey(item, idx), item);
  });

  // 2. Fundir dados recebidos (comparar carimbos temporais com precisão)
  incomingData.forEach((item, idx) => {
    if (item && item.id && BLACKLISTED_IDS.has(item.id)) return;
    const key = getKey(item, idx);
    if (mergedMap.has(key)) {
      const existingItem = mergedMap.get(key);
      const incomingTime = getItemTimestamp(item);
      const existingTime = getItemTimestamp(existingItem);

      if (incomingTime >= existingTime) {
        mergedMap.set(key, { ...existingItem, ...item });
      } else {
        mergedMap.set(key, { ...item, ...existingItem });
      }
    } else {
      mergedMap.set(key, item);
    }
  });

  return Array.from(mergedMap.values());
}

/**
 * Obtém dados de uma coleção guardada no servidor
 */
export function getServerData(key, fallback = null) {
  if (memoryStore && Object.prototype.hasOwnProperty.call(memoryStore, key)) {
    return memoryStore[key];
  }
  return fallback;
}

/**
 * Grava dados de uma coleção no servidor com merge inteligente
 */
export function setServerData(key, data) {
  const current = memoryStore[key];
  const merged = mergeCollection(current, data);
  memoryStore[key] = merged;
  schedulePersist();
  return merged;
}

/**
 * Retorna todas as chaves guardadas
 */
export function getAllServerData() {
  return memoryStore;
}
