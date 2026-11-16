/**
 * Utilitário para deteção inteligente de codificação (UTF-8 vs Windows-1252/ISO-8859-1)
 * e reparação automática de carateres portugueses corrompidos (mojibake e \uFFFD).
 */

const MOJIBAKE_MAP: Array<[RegExp, string]> = [
  // Dupla codificação UTF-8 -> Latin1/Windows-1252 (minúsculas e maiúsculas)
  [/Ã§/g, 'ç'],
  [/Ã‡/g, 'Ç'],
  [/Ã£/g, 'ã'],
  [/Ãƒ/g, 'Ã'],
  [/Ãµ/g, 'õ'],
  [/Ã•/g, 'Õ'],
  [/Ã¡/g, 'á'],
  [/Ã\x81/g, 'Á'],
  [/Ã /g, 'à'],
  [/Ã€/g, 'À'],
  [/Ã¢/g, 'â'],
  [/Ã‚/g, 'Â'],
  [/Ã©/g, 'é'],
  [/Ã‰/g, 'É'],
  [/Ãª/g, 'ê'],
  [/ÃŠ/g, 'Ê'],
  [/Ã­/g, 'í'],
  [/Ã\x8d/g, 'Í'],
  [/Ã³/g, 'ó'],
  [/Ã“/g, 'Ó'],
  [/Ã´/g, 'ô'],
  [/Ã”/g, 'Ô'],
  [/Ãº/g, 'ú'],
  [/Ãš/g, 'Ú'],
  [/Ã¼/g, 'ü'],
  [/Ãœ/g, 'Ü'],
  [/Âº/g, 'º'],
  [/Âª/g, 'ª'],
  [/Â°/g, '°'],
  [/â‚¬/g, '€'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€œ/g, '“'],
  [/â€\x9d/g, '”'],
  [/â€˜/g, '‘'],
  [/â€™/g, '’'],
  // Casos específicos vistos em importações do programa antigo
  [/DOBRADIÃA/g, 'DOBRADIÇA'],
  [/DobradiÃa/g, 'Dobradiça'],
  [/dobradiÃa/g, 'dobradiça'],
  [/ÃA(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]|$)/g, 'ÇA'],
];

const REPLACEMENT_CHAR_RULES: Array<[RegExp, string]> = [
  // Palavras e expressões completas com  (\uFFFD)
  [/Entrega e Forma\uFFFD+o/gi, 'Entrega e Formação'],
  [/Entrega e Forma\uFFFD+a?o/gi, 'Entrega e Formação'],
  [/Forma\uFFFD+a?o/gi, (m: string) => (m === m.toUpperCase() ? 'FORMAÇÃO' : 'Formação') as any],
  [/DOBRADI\uFFFD+A/g, 'DOBRADIÇA'],
  [/Dobradi\uFFFD+a/g, 'Dobradiça'],
  [/dobradi\uFFFD+a/g, 'dobradiça'],
  [/Manuten\uFFFD+a?o/gi, 'Manutenção'],
  [/Repara\uFFFD+a?o/gi, 'Reparação'],
  [/Verifica\uFFFD+a?o/gi, 'Verificação'],
  [/Substitui\uFFFD+a?o/gi, 'Substituição'],
  [/Inspe\uFFFD+a?o/gi, 'Inspeção'],
  [/Dire\uFFFD+a?o/gi, 'Direção'],
  [/Inje\uFFFD+a?o/gi, 'Injeção'],
  [/Fatura\uFFFD+a?o/gi, 'Faturação'],
  [/Requisi\uFFFD+a?o/gi, 'Requisição'],
  [/Observa\uFFFD+a?o/gi, 'Observação'],
  [/Valida\uFFFD+a?o/gi, 'Validação'],
  [/Prepara\uFFFD+a?o/gi, 'Preparação'],
  [/Calibra\uFFFD+a?o/gi, 'Calibração'],
  [/Configura\uFFFD+a?o/gi, 'Configuração'],
  [/Alimenta\uFFFD+a?o/gi, 'Alimentação'],
  [/Ilumina\uFFFD+a?o/gi, 'Iluminação'],
  [/Sinaliza\uFFFD+a?o/gi, 'Sinalização'],
  [/Lubrifica\uFFFD+a?o/gi, 'Lubrificação'],
  [/Fixa\uFFFD+a?o/gi, 'Fixação'],
  [/Prote\uFFFD+a?o/gi, 'Proteção'],
  [/Liga\uFFFD+a?o/gi, 'Ligação'],
  [/Solu\uFFFD+a?o/gi, 'Solução'],
  [/Revis\uFFFD+o/gi, 'Revisão'],
  [/Suspens\uFFFD+o/gi, 'Suspensão'],
  [/Transmiss\uFFFD+o/gi, 'Transmissão'],
  [/Press\uFFFD+o/gi, 'Pressão'],
  [/Conclu\uFFFD+do/gi, 'Concluído'],
  [/N\uFFFD+o\b/g, 'Não'],
  [/n\uFFFD+o\b/g, 'não'],
  [/N\uFFFD+O\b/g, 'NÃO'],
  [/Pe\uFFFD+as\b/g, 'Peças'],
  [/pe\uFFFD+as\b/g, 'peças'],
  [/PE\uFFFD+AS\b/g, 'PEÇAS'],
  [/Pe\uFFFD+a\b/g, 'Peça'],
  [/pe\uFFFD+a\b/g, 'peça'],
  [/PE\uFFFD+A\b/g, 'PEÇA'],
  [/Cabe\uFFFD+a/gi, 'Cabeça'],
  [/Bra\uFFFD+o/gi, 'Braço'],
  [/Servi\uFFFD+os/gi, 'Serviços'],
  [/Servi\uFFFD+o/gi, 'Serviço'],
  [/T\uFFFD+cnic/gi, 'Técnic'],
  [/El\uFFFD+tric/gi, 'Elétric'],
  [/Hidr\uFFFD+ulic/gi, 'Hidráulic'],
  [/N\uFFFD+mer/gi, 'Númer'],
  [/S\uFFFD+rie/gi, 'Série'],
  [/Matr\uFFFD+cul/gi, 'Matrícul'],
  [/Ve\uFFFD+cul/gi, 'Veícul'],
  [/\uFFFD+leo\b/gi, 'Óleo'],
  [/L\uFFFD+mpada/gi, 'Lâmpada'],
  [/V\uFFFD+lvula/gi, 'Válvula'],
  [/M\uFFFD+dulo/gi, 'Módulo'],
  [/Dep\uFFFD+sito/gi, 'Depósito'],
  [/C\uFFFD+mara/gi, 'Câmara'],
  [/Port\uFFFD+o/gi, 'Portão'],
  [/Bot\uFFFD+o/gi, 'Botão'],
  [/Ch\uFFFD+o/gi, 'Chão'],
  [/M\uFFFD+o\b/gi, 'Mão'],
  // Padrões genéricos restantes com \uFFFD
  [/([a-zA-Z])\uFFFD{2}o\b/g, '$1ção'],
  [/([a-zA-Z])\uFFFD{2}es\b/g, '$1ções'],
  [/([a-zA-Z])\uFFFDão\b/g, '$1ção'],
  [/([a-zA-Z])\uFFFDões\b/g, '$1ções'],
  [/([a-zA-Z])\uFFFDo\b/g, '$1ão'],
  [/([a-zA-Z])\uFFFDa\b/g, '$1ça'],
];

function preserveCaseReplace(input: string, regex: RegExp, targetTitleCase: string): string {
  return input.replace(regex, (match) => {
    if (match === match.toUpperCase()) return targetTitleCase.toUpperCase();
    if (match === match.toLowerCase()) return targetTitleCase.toLowerCase();
    return targetTitleCase;
  });
}

/**
 * Repara texto com mojibake (UTF-8 lido como Latin1) ou carateres \uFFFD ().
 */
export function sanitizePortugueseText(input: string): string {
  if (!input || typeof input !== 'string') return input;

  // Ignorar URLs, Data URLs / imagens base64
  if (
    input.startsWith('data:image/') ||
    input.startsWith('data:application/') ||
    input.startsWith('http://') ||
    input.startsWith('https://')
  ) {
    return input;
  }

  let out = input;

  // 1. Corrigir mojibake clássico (Ã§, Ã£, etc.)
  if (out.includes('Ã') || out.includes('Â') || out.includes('â€') || out.includes('â‚')) {
    for (const [pattern, replacement] of MOJIBAKE_MAP) {
      out = out.replace(pattern, replacement);
    }
  }

  // 2. Corrigir carateres de substituição \uFFFD ()
  if (out.includes('\uFFFD')) {
    out = preserveCaseReplace(out, /Entrega e Forma\uFFFD+a?o/gi, 'Entrega e Formação');
    out = preserveCaseReplace(out, /Forma\uFFFD+a?o/gi, 'Formação');
    out = preserveCaseReplace(out, /DOBRADI\uFFFD+A/gi, 'Dobradiça');
    for (const [pattern, replacement] of REPLACEMENT_CHAR_RULES) {
      if (typeof replacement === 'string') {
        out = out.replace(pattern, replacement);
      }
    }
  }

  return out;
}

/**
 * Percorre recursivamente objetos e arrays limpando todas as strings de texto.
 */
export function sanitizeObjectDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizePortugueseText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const sanitized = sanitizeObjectDeep(item);
      if (sanitized !== item) changed = true;
      return sanitized;
    });
    return (changed ? next : value) as unknown as T;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      const sanitized = sanitizeObjectDeep(v);
      if (sanitized !== v) changed = true;
      result[k] = sanitized;
    }
    return (changed ? result : value) as T;
  }
  return value;
}

/**
 * Lê um ficheiro (JSON, CSV, TXT) detetando automaticamente UTF-8 vs Windows-1252
 * para evitar perda de acentos e cedilhas em importações do programa antigo.
 */
export async function readFileWithSmartEncoding(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Remover BOM UTF-8 se existir
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;

  let decoded: string;
  if (hasUtf8Bom) {
    decoded = new TextDecoder('utf-8').decode(bytes.subarray(3));
  } else {
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      // Fallback para Windows-1252 (ANSI usado por FileMaker / Excel PT antigos)
      decoded = new TextDecoder('windows-1252').decode(bytes);
    }
  }

  return sanitizePortugueseText(decoded);
}
