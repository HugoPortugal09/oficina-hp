/**
 * Storage quota management and resilient localStorage wrapper.
 * Prevents and recovers from DOMException: QuotaExceededError when storing data.
 */
import { savePhotosToIndexedDB } from '../services/photoStorageService';

export const STORAGE_KEYS = {
  EMPRESAS: 'oficina_hp_empresas',
  CLIENTES: 'oficina_hp_clientes',
  EQUIPAMENTOS: 'oficina_hp_equipamentos',
  FOLHAS_SERVICO: 'oficina_hp_folhas_servico',
  PROPOSTAS: 'oficina_hp_propostas',
  PECAS_CATALOGO: 'oficina_hp_pecas_catalogo',
  PEDIDOS_PECAS: 'oficina_hp_pedidos_pecas',
  GUIAS_ENVIO: 'oficina_hp_guias_envio',
  CONTRATOS: 'oficina_hp_contratos',
  TAREFAS: 'oficina_hp_tarefas',
  VISITAS: 'oficina_hp_visitas',
  UTILIZADORES: 'oficina_hp_utilizadores',
  AUTOMACOES: 'oficina_hp_automacoes',
  CONFIGURACAO: 'oficina_hp_configuracao',
};

export function isQuotaError(err: any): boolean {
  if (!err) return false;
  return (
    (err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) ||
    (typeof err?.message === 'string' && err.message.toLowerCase().includes('quota'))
  );
}

/**
 * Calcula o espaço atualmente ocupado no LocalStorage.
 */
export function getStorageUsage(): { usedKB: number; totalKB: number; percent: number } {
  if (typeof localStorage === 'undefined') {
    return { usedKB: 0, totalKB: 5120, percent: 0 };
  }

  let totalChars = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const val = localStorage.getItem(key) || '';
      totalChars += key.length + val.length;
    }
  }

  // Em UTF-16 cada char ocupa ~2 bytes
  const usedKB = Math.round((totalChars * 2) / 1024);
  const totalKB = 5120; // 5MB padrão da maioria dos navegadores móveis
  const percent = Math.min(100, Math.round((usedKB / totalKB) * 100));

  return { usedKB, totalKB, percent };
}

/**
 * Otimização inteligente de quota:
 * 1. Primeiro tenta higienizar imagens desproporcionalmente pesadas (>180KB em base64).
 * 2. Em seguida, limpa fotos apenas de folhas já concluídas antigas, preservando as folhas em aberto.
 */
export function optimizeLocalStorageQuota(): boolean {
  if (typeof localStorage === 'undefined') return false;

  let spaceFreed = false;

  try {
    const keysToCheck = [
      STORAGE_KEYS.FOLHAS_SERVICO,
      STORAGE_KEYS.EQUIPAMENTOS,
      STORAGE_KEYS.PEDIDOS_PECAS,
      STORAGE_KEYS.GUIAS_ENVIO
    ];

    for (const key of keysToCheck) {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length < 50000) continue;

      try {
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) continue;

        let modified = false;

        if (key === STORAGE_KEYS.FOLHAS_SERVICO) {
          const pruned = list.map((f: any) => {
            let fChanged = false;
            let fotos = f.fotos;
            let fotosCliente = f.fotosCliente;

            // Se a folha estiver concluída e muito antiga, ou se a imagem for gigantesca (>180.000 chars)
            const isConcluded = f.estado === 'concluido' || f.fechada;

            if (Array.isArray(fotos) && fotos.length > 0) {
              const cleanedFotos = fotos.filter((photo: string) => {
                if (typeof photo === 'string') {
                  if (photo.length > 180000) {
                    fChanged = true;
                    return false;
                  }
                  if (isConcluded && photo.length > 100000) {
                    fChanged = true;
                    return false;
                  }
                }
                return true;
              });
              if (fChanged) fotos = cleanedFotos;
            }

            if (Array.isArray(fotosCliente) && fotosCliente.length > 0) {
              let fcChanged = false;
              const cleanedFotos = fotosCliente.filter((photo: string) => {
                if (typeof photo === 'string') {
                  if (photo.length > 180000) {
                    fcChanged = true;
                    return false;
                  }
                  if (isConcluded && photo.length > 100000) {
                    fcChanged = true;
                    return false;
                  }
                }
                return true;
              });
              if (fcChanged) {
                fotosCliente = cleanedFotos;
                fChanged = true;
              }
            }

            if (fChanged) {
              modified = true;
              return { ...f, fotos, fotosCliente };
            }
            return f;
          });

          if (modified) {
            localStorage.setItem(key, JSON.stringify(pruned));
            spaceFreed = true;
            console.log(`[Storage Recovery] Pruned oversized base64 images from ${key}`);
          }
        } else if (key === STORAGE_KEYS.EQUIPAMENTOS) {
          const pruned = list.map((eq: any) => {
            let eqChanged = false;
            let fotoUrl = eq.fotoUrl;
            let fotos = eq.fotos;

            if (typeof fotoUrl === 'string' && fotoUrl.length > 180000) {
              fotoUrl = '';
              eqChanged = true;
            }

            if (Array.isArray(fotos) && fotos.length > 0) {
              const cleanedFotos = fotos.filter((f: string) => {
                if (typeof f === 'string' && f.length > 180000) {
                  eqChanged = true;
                  return false;
                }
                return true;
              });
              if (eqChanged) fotos = cleanedFotos;
            }

            if (eqChanged) {
              modified = true;
              return { ...eq, fotoUrl, fotos };
            }
            return eq;
          });

          if (modified) {
            localStorage.setItem(key, JSON.stringify(pruned));
            spaceFreed = true;
            console.log(`[Storage Recovery] Pruned oversized base64 images from ${key}`);
          }
        }
      } catch (e) {
        console.warn(`[Storage Recovery] Error parsing ${key}:`, e);
      }
    }
  } catch (err) {
    console.warn('[Storage Recovery] Error in optimizeLocalStorageQuota:', err);
  }

  return spaceFreed;
}

/**
 * Aggressive purge: removes all base64 data URLs from cached media in localStorage.
 */
export function purgeAllHeavyMediaFromLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const mediaKeys = [STORAGE_KEYS.FOLHAS_SERVICO, STORAGE_KEYS.EQUIPAMENTOS];
    for (const key of mediaKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const cleared = list.map((item: any) => {
            const copy = { ...item };
            if (Array.isArray(copy.fotos) && copy.fotos.length > 0 && copy.id) {
              savePhotosToIndexedDB(copy.id, copy.fotos, copy.numero).catch(() => {});
            }
            if ('fotos' in copy) copy.fotos = [];
            if ('fotosCliente' in copy) copy.fotosCliente = [];
            if ('fotoUrl' in copy && typeof copy.fotoUrl === 'string' && copy.fotoUrl.startsWith('data:')) {
              copy.fotoUrl = '';
            }
            return copy;
          });
          localStorage.setItem(key, JSON.stringify(cleared));
          console.log(`[Storage Recovery] Aggressive purge preserved photos in IndexedDB and cleared media from ${key}`);
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[Storage Recovery] Error in purgeAllHeavyMediaFromLocalStorage:', err);
  }
}

/**
 * Safe setter for localStorage that automatically handles QuotaExceededError
 * through multi-stage quota recovery.
 */
export function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    if (isQuotaError(e)) {
      console.warn(`[Storage Recovery] Quota exceeded while setting "${key}". Optimizing storage...`);
      optimizeLocalStorageQuota();

      try {
        localStorage.setItem(key, value);
      } catch (e2: any) {
        if (isQuotaError(e2)) {
          console.warn(`[Storage Recovery] Quota still exceeded. Performing aggressive purge...`);
          purgeAllHeavyMediaFromLocalStorage();

          try {
            localStorage.setItem(key, value);
          } catch (e3: any) {
            console.warn(`[Storage Recovery] Still exceeded. Stripping media from payload for key "${key}"...`);
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) {
                const stripped = parsed.map((item: any) => {
                  const copy = { ...item };
                  if (Array.isArray(copy.fotos) && copy.fotos.length > 0 && copy.id) {
                    savePhotosToIndexedDB(copy.id, copy.fotos, copy.numero).catch(() => {});
                  }
                  if ('fotos' in copy) copy.fotos = [];
                  if ('fotosCliente' in copy) copy.fotosCliente = [];
                  if ('fotoUrl' in copy && typeof copy.fotoUrl === 'string' && copy.fotoUrl.startsWith('data:')) {
                    copy.fotoUrl = '';
                  }
                  return copy;
                });
                localStorage.setItem(key, JSON.stringify(stripped));
                return;
              }
            } catch {}
            throw e3;
          }
        } else {
          throw e2;
        }
      }
    } else {
      throw e;
    }
  }
}
