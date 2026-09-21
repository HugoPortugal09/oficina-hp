import type { FolhaServico } from '../types';

/**
 * Checks if a Folha de Serviço is located at GRAUMP headquarters (Albergaria-a-Velha).
 */
export function isGraumpLocation(folha?: Partial<FolhaServico> | null): boolean {
  if (!folha) return false;
  const loc = `${folha.localizacao || ''} ${folha.moradaIntervencao || ''} ${folha.localIntervencao || ''}`.toUpperCase();
  if (
    loc.includes('GRAUMP') ||
    loc.includes('VISTA ALEGRE') ||
    loc.includes('3850-184') ||
    loc.includes('ALBERGARIA-A-VELHA') ||
    loc.includes('ALBERGARIA A VELHA')
  ) {
    return true;
  }
  // If location string is blank/empty and type is 'Oficina' or localizacaoTipo is 'oficina'
  if ((!folha.localizacao || folha.localizacao.trim() === '') && (folha.localizacaoTipo === 'oficina' || folha.tipo === 'Oficina')) {
    return true;
  }
  return false;
}

/**
 * User Rule: "O PDF Oficina (A3) devem de constar todos os serviços que sejam Oficina e todos os outros em que a morada seja GRAUMP."
 */
export function isOficinaOrGraump(folha?: Partial<FolhaServico> | null): boolean {
  if (!folha) return false;
  return folha.tipo === 'Oficina' || isGraumpLocation(folha);
}

/**
 * User Rule: "No pdf AT/Contratos (A3), deves de mudar o nome para PDF Exterior, e devem de estar todos os serviços que a morada não sejam GRAUMP."
 */
export function isExteriorService(folha?: Partial<FolhaServico> | null): boolean {
  return !isOficinaOrGraump(folha);
}

/**
 * Checks if a service is in open status (not finished / not concluded).
 */
export function isOpenService(folha?: Partial<FolhaServico> | null): boolean {
  if (!folha) return false;
  const status = (folha.status || '').trim();
  const isConcluido = status === 'Concluído' || status.startsWith('FEITO') || status === 'Feito' || !!folha.dataConclusao;
  return !isConcluido;
}
