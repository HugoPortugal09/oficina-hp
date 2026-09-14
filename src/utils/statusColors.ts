import { TipoServico } from '../types';

export interface TipoStyle {
  text: string;
  badge: string;
  dot: string;
}

/**
 * Retorna as classes visuais específicas para cada Tipo de Serviço (Oficina, Garantia, Assistência Técnica, etc.)
 */
export function getTipoStyles(tipo?: string | TipoServico): TipoStyle {
  switch (tipo) {
    case 'Oficina':
      return {
        text: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        dot: 'bg-amber-400'
      };
    case 'Assistência Técnica':
      return {
        text: 'text-sky-400',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        dot: 'bg-sky-400'
      };
    case 'Garantia':
      return {
        text: 'text-purple-400',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        dot: 'bg-purple-400'
      };
    case 'Contrato':
      return {
        text: 'text-teal-400',
        badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
        dot: 'bg-teal-400'
      };
    case 'Entrega e Formação':
      return {
        text: 'text-indigo-400',
        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        dot: 'bg-indigo-400'
      };
    default:
      return {
        text: 'text-slate-300',
        badge: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
        dot: 'bg-slate-400'
      };
  }
}

/**
 * Regra de cores do Estado:
 * - Verde: "FEITO - Faturado"
 * - Laranja: QualQuer estado que comece por "FEITO" (exceto Faturado)
 * - Amarelo: Quando não está em qualquer estado que comece por FEITO
 */
export function getStatusBadgeVariant(status?: string): 'success' | 'orange' | 'warning' {
  if (!status) return 'warning';
  const clean = status.trim();
  if (clean === 'FEITO - Faturado' || clean === 'FEITO – Faturado' || clean.toLowerCase().includes('faturado')) {
    return 'success'; // Verde
  }
  const upper = clean.toUpperCase();
  if (upper.startsWith('FEITO') || upper.includes('FEITO')) {
    return 'orange'; // Laranja
  }
  return 'warning'; // Amarelo
}

/**
 * Retorna o texto simplificado do estado sem o prefixo (ex: "OF - Em Intervenção" -> "Em Intervenção")
 */
export function getStatusLabel(status?: string): string {
  if (!status) return '';
  if (status.includes(' - ')) {
    return status.split(' - ').slice(1).join(' - ');
  }
  if (status.includes(' – ')) {
    return status.split(' – ').slice(1).join(' – ');
  }
  return status;
}
