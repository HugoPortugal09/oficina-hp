import { TipoServico, StatusFaturacao } from '../types';

export interface TipoStyle {
  text: string;
  badge: string;
  dot: string;
}

/**
 * Retorna as classes visuais específicas para cada Tipo de Serviço
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
    case 'Validação e Preparação':
      return {
        text: 'text-emerald-400',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dot: 'bg-emerald-400'
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
 * Regra de cores do Estado Operacional da Folha
 */
export function getStatusBadgeVariant(status?: string): 'success' | 'orange' | 'warning' | 'info' | 'danger' {
  if (!status) return 'warning';
  const clean = status.trim().toLowerCase();

  if (clean === 'concluído' || clean === 'concluido' || clean === 'feito' || clean.startsWith('feito - resolvido') || clean.includes('resolvido')) {
    return 'success'; // Verde
  }
  if (clean === 'a ser intervencionado' || clean.includes('intervenção') || clean.includes('intervencionado')) {
    return 'orange'; // Laranja
  }
  if (clean === 'agendado') {
    return 'info'; // Azul / Sky
  }
  if (clean === 'pedido de assistência' || clean.includes('pedido de assistência')) {
    return 'danger'; // Vermelho
  }
  if (clean.includes('orçamento') || clean.includes('orcamento') || clean.includes('proposta')) {
    return 'info'; // Indigo / Roxo
  }
  if (clean.includes('faturado')) {
    return 'success';
  }
  if (clean.startsWith('feito')) {
    return 'orange';
  }
  return 'warning'; // Amarelo (Aguardar agenda, Aguardar peças, etc.)
}

/**
 * Retorna o texto simplificado do estado sem o prefixo antigo
 */
export function getStatusLabel(status?: string): string {
  if (!status) return '';
  if (status.startsWith('AT - ') || status.startsWith('OF - ') || status.startsWith('CT - ') || status.startsWith('EF - ') || status.startsWith('FEITO - ')) {
    return status.split(' - ').slice(1).join(' - ');
  }
  if (status.includes(' – ')) {
    return status.split(' – ').slice(1).join(' – ');
  }
  return status;
}

/**
 * Cores e badges do estado de Faturação
 */
export function getFaturacaoBadgeVariant(faturacao?: StatusFaturacao | string): 'success' | 'warning' | 'purple' | 'info' | 'neutral' | 'orange' {
  switch (faturacao) {
    case 'Faturado':
      return 'success';
    case 'Faturar':
      return 'warning';
    case 'Submeter Garantia':
    case 'Garantia submetida':
      return 'purple';
    case 'Garantia recebida':
      return 'success';
    case 'Enviar proposta':
    case 'Aguardar Requisição':
      return 'info';
    case 'Pendente':
    case 'N/A':
    default:
      return 'neutral';
  }
}
