import type { NavigationTab, FolhaServico } from '../types';

export interface ParsedRoute {
  isMobile: boolean;
  tab: NavigationTab;
  folhaParam: string | null;
  conviteToken: string | null;
}

const VALID_TABS: readonly NavigationTab[] = [
  'dashboard',
  'mapa',
  'oficina',
  'kanban',
  'tarefas',
  'propostas',
  'empresas',
  'clientes',
  'equipamentos',
  'pecas',
  'pedidos-pecas',
  'guias-envio',
  'contratos',
  'atividade-semanal',
  'planeamento',
  'automacoes',
  'tempos-resposta',
  'configuracoes'
];

/**
 * Parses current window location pathname and search parameters into structured route state
 */
export function parseCurrentRoute(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): ParsedRoute {
  let conviteToken = searchParams.get('convite') || searchParams.get('token') || searchParams.get('inv');

  // Normalize path by stripping trailing slashes
  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  // Check query parameters inside hash (e.g. /#/?convite=... or /#convite=...)
  if (!conviteToken && typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash;
    const hashQueryIdx = hash.indexOf('?');
    if (hashQueryIdx !== -1) {
      const hashParams = new URLSearchParams(hash.substring(hashQueryIdx));
      conviteToken = hashParams.get('convite') || hashParams.get('token') || hashParams.get('inv');
    }
  }

  // Check path routes: /convite/:token, /invite/:token, /registo/:token
  if (!conviteToken) {
    const convitePathMatch = cleanPath.match(/^\/(?:convite|invite|registo)\/([^/?#]+)/i);
    if (convitePathMatch && convitePathMatch[1]) {
      conviteToken = decodeURIComponent(convitePathMatch[1].trim());
    }
  }

  // Clean any accidental punctuation attached by messaging apps (e.g. trailing '.', ',', '!', '?')
  if (conviteToken) {
    conviteToken = conviteToken.trim().replace(/[.,;!?]+$/, '');
  }

  // Check mobile routes
  const isMobile = cleanPath.startsWith('/mobile') || searchParams.has('mobile') || (typeof window !== 'undefined' && window.location.hash.startsWith('#/mobile'));

  let folhaParam = queryFolha || null;
  let tab: NavigationTab = 'dashboard';

  if (isMobile) {
    if (cleanPath.startsWith('/mobile/')) {
      const param = decodeURIComponent(cleanPath.replace('/mobile/', '').trim());
      if (param) folhaParam = param;
    }
  } else if (cleanPath.startsWith('/oficina/')) {
    tab = 'oficina';
    const param = decodeURIComponent(cleanPath.replace('/oficina/', '').trim());
    if (param) folhaParam = param;
  } else {
    const segment = cleanPath.replace(/^\//, '').toLowerCase() as NavigationTab;
    if (VALID_TABS.includes(segment)) {
      tab = segment;
    } else {
      tab = 'dashboard';
    }
  }

  return {
    isMobile,
    tab,
    folhaParam,
    conviteToken
  };
}

/**
 * Builds the URL path for a given tab and optional parameter
 */
export function buildPath(tab: NavigationTab, param?: string | null): string {
  if (tab === 'dashboard') {
    return '/';
  }
  if (tab === 'oficina' && param) {
    return `/oficina/${encodeURIComponent(param)}`;
  }
  return `/${tab}`;
}

/**
 * Returns a full shareable absolute link for a service sheet (e.g. for WhatsApp or Email)
 */
export function getShareableFolhaUrl(folha: { numero?: string; id?: string }, isMobile: boolean = false): string {
  if (typeof window === 'undefined') return '';
  const param = folha.numero || folha.id || '';
  const prefix = isMobile ? '/mobile/' : '/oficina/';
  return `${window.location.origin}${prefix}${encodeURIComponent(param)}`;
}

/**
 * Finds a FolhaServico by either its formatted number (e.g. FS2026-0001, O26049) or its internal ID
 */
export function findFolhaByParam(folhas: FolhaServico[], param: string | null | undefined): FolhaServico | null {
  if (!param || !folhas || folhas.length === 0) return null;
  const p = param.trim().toLowerCase();
  const pNorm = p.replace(/[^a-z0-9]/gi, '');

  return (
    folhas.find(f => {
      if (f.id && f.id.toLowerCase() === p) return true;
      if (f.numero && f.numero.toLowerCase() === p) return true;
      if (f.numero && f.numero.replace(/[^a-z0-9]/gi, '').toLowerCase() === pNorm) return true;
      return false;
    }) || null
  );
}
