import { z } from 'zod';

/**
 * Utilitários de validação rigorosa e normalização automática de dados com Zod.
 * Garante consistência de matrículas, NIFs portugueses, contactos telefónicos e datas.
 */

/**
 * Normaliza e higieniza uma matrícula portuguesa ou número de série de equipamento.
 * Remove espaços supérfluos, converte para maiúsculas e formata adequadamente.
 */
export function cleanMatricula(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = String(raw).trim().toUpperCase();
  if (!trimmed) return '';

  // Se já tiver hífenes, remove espaços ao redor dos hífenes
  let formatted = trimmed.replace(/\s*-\s*/g, '-').replace(/\s+/g, '-');

  // Se for uma sequência de 6 caracteres alfanuméricos sem separador (ex: "AA00BB" ou "00AA00")
  const compact = formatted.replace(/[^A-Z0-9]/g, '');
  if (compact.length === 6 && !formatted.includes('-')) {
    formatted = `${compact.slice(0, 2)}-${compact.slice(2, 4)}-${compact.slice(4, 6)}`;
  }

  return formatted;
}

/**
 * Validação algorítmica do NIF português (Número de Identificação Fiscal).
 * Verifica se tem 9 dígitos, se começa por dígito válido e valida o dígito de controlo (módulo 11).
 */
export function isValidNif(nifRaw: string | number | undefined | null): boolean {
  if (!nifRaw) return false;
  const nif = String(nifRaw).replace(/\s+/g, '').trim();

  // Tem de ter exatamente 9 dígitos numéricos
  if (!/^\d{9}$/.test(nif)) return false;

  // Primeiro dígito tem de ser válido em Portugal:
  // 1 ou 2 (Pessoas singulares), 3 (Pessoas coletivas especiais),
  // 5 (Sociedades), 6 (Administração pública), 8 (Empresários individuais / entidades sem fins lucrativos), 9 (Pessoas coletivas especiais)
  const firstDigit = nif[0];
  if (!['1', '2', '3', '5', '6', '8', '9'].includes(firstDigit)) {
    return false;
  }

  // Algoritmo de validação do dígito de controlo (módulo 11)
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i], 10) * (9 - i);
  }

  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;

  return checkDigit === parseInt(nif[8], 10);
}

/**
 * Normaliza e limpa contactos telefónicos portugueses.
 */
export function cleanPhone(phoneRaw: string | undefined | null): string {
  if (!phoneRaw) return '';
  const cleaned = String(phoneRaw).replace(/[^\d+]/g, '').trim();
  return cleaned;
}

/**
 * Schema Zod para Folhas de Serviço
 */
export const FolhaServicoValidationSchema = z.object({
  id: z.string().min(1),
  numero: z.string().optional(),
  matricula: z.string().optional().transform((val) => cleanMatricula(val)),
  nSerie: z.string().optional().transform((val) => (val ? String(val).trim().toUpperCase() : '')),
  tipo: z.string().min(1),
  status: z.string().min(1),
  empresaId: z.string().optional(),
  equipamentoId: z.string().optional(),
  data: z.string().optional(),
  dataEntradaOficina: z.string().optional(),
  dataConclusao: z.string().optional(),
  dataRequisicao: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

/**
 * Schema Zod para Empresas / Clientes
 */
export const EmpresaValidationSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1, 'O nome da empresa é obrigatório').transform((val) => val.trim()),
  nif: z.string().optional().refine((val) => !val || isValidNif(val), {
    message: 'NIF português inválido'
  }),
  telefone: z.string().optional().transform((val) => cleanPhone(val)),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  updatedAt: z.string().optional(),
}).passthrough();

/**
 * Função sanitizadora de Folha de Serviço antes de gravar na base de dados
 */
export function sanitizeFolhaServico<T extends Record<string, any>>(folha: T): T {
  if (!folha || typeof folha !== 'object') return folha;

  const copy = { ...folha };

  // 1. Higienizar matrícula
  if (typeof copy.matricula === 'string') {
    copy.matricula = cleanMatricula(copy.matricula);
  }

  // 2. Higienizar número de série
  if (typeof copy.nSerie === 'string') {
    copy.nSerie = copy.nSerie.trim().toUpperCase();
  }

  // 3. Garantir carimbo temporal de atualização
  copy.updatedAt = new Date().toISOString();

  return copy;
}
