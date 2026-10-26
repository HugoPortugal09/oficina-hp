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
 * Grava dados de uma coleção no servidor
 */
export function setServerData(key, data) {
  memoryStore[key] = data;
  schedulePersist();
  return true;
}

/**
 * Retorna todas as chaves guardadas
 */
export function getAllServerData() {
  return memoryStore;
}
