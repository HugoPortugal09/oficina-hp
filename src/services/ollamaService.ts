import type {
  VisionScanResult,
  FolhaServico,
  ServicoItem,
  PecaItem,
  PecaCatalogo,
  Equipamento,
  Empresa,
  TipoServico
} from '../types';
import { db, STORAGE_KEYS } from './dbService';
import { runLocalOCROnImage } from './ocrEngine';

export function normalizePlate(plate: string): string {
  if (!plate) return '';
  return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatPlate(raw: string): string {
  const clean = normalizePlate(raw);
  if (clean.length === 6) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4, 6)}`;
  }
  return raw.trim().toUpperCase();
}

export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function findBestMatchingEquipment(
  rawDetected: string,
  equipments?: Equipamento[]
): Equipamento | undefined {
  if (!rawDetected) return undefined;
  const list = equipments && equipments.length > 0 ? equipments : db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
  if (!list || list.length === 0) return undefined;

  const clean = normalizePlate(rawDetected);
  if (!clean) return undefined;

  // 1. Exact normalized match
  const exact = list.find(e => normalizePlate(e.matricula) === clean);
  if (exact) return exact;

  // 2. Substring match
  const sub = list.find(e => {
    const norm = normalizePlate(e.matricula);
    return norm.includes(clean) || (clean.length >= 5 && clean.includes(norm));
  });
  if (sub) return sub;

  // 3. Levenshtein fuzzy match (distance <= 2 for 6-char plates)
  let bestMatch: Equipamento | undefined = undefined;
  let minDistance = 999;
  for (const eq of list) {
    const norm = normalizePlate(eq.matricula);
    const dist = levenshtein(clean, norm);
    if (dist <= 2 && dist < minDistance) {
      minDistance = dist;
      bestMatch = eq;
    }
  }
  return bestMatch;
}

export function findBestMatchingPart(
  rawRef?: string,
  rawName?: string,
  catalog?: PecaCatalogo[]
): PecaCatalogo | undefined {
  const list = catalog && catalog.length > 0 ? catalog : db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);
  if (!list || list.length === 0) return undefined;

  const cleanRef = rawRef ? rawRef.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
  const cleanName = rawName ? rawName.toLowerCase().trim() : '';

  if (cleanRef && cleanRef.length >= 3) {
    const exactRef = list.find(p => p.referencia.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanRef);
    if (exactRef) return exactRef;

    const subRef = list.find(p => {
      const pRef = p.referencia.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return pRef.includes(cleanRef) || cleanRef.includes(pRef);
    });
    if (subRef) return subRef;
  }

  if (cleanName && cleanName.length >= 3) {
    const exactName = list.find(p =>
      p.designacao.toLowerCase().includes(cleanName) || cleanName.includes(p.designacao.toLowerCase())
    );
    if (exactName) return exactName;

    const words = cleanName.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      const matchWords = list.find(p => {
        const pName = p.designacao.toLowerCase();
        return words.every(w => pName.includes(w));
      });
      if (matchWords) return matchWords;
    }
  }

  return undefined;
}

export async function compressImageForAI(base64Str: string, maxDimension = 1024, quality = 0.85): Promise<string> {
  if (typeof window === 'undefined' || !base64Str || !base64Str.startsWith('data:image')) {
    return base64Str;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

export async function processImageWithOllama(
  base64Image: string,
  mode: 'matricula' | 'odometro' | 'peca' | 'geral' = 'geral'
): Promise<VisionScanResult> {
  const startTime = Date.now();
  const config = db.getConfig();
  const ollamaUrl = (config.ollamaUrl || 'https://oficina-hp-ollama.l1mamt.easypanel.host').trim().replace(/\/+$/, '');
  const model = config.ollamaModel || 'llama3.2-vision';

  // Downscale and compress image to avoid server timeouts and tensor memory exhaustion
  const readyImage = await compressImageForAI(base64Image, 1024, 0.85);
  const cleanBase64 = readyImage.replace(/^data:image\/[a-z]+;base64,/, '');

  const knownEquipments = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
  const knownPlates = knownEquipments.map(e => e.matricula).filter(Boolean);
  const knownCatalog = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);
  const knownParts = knownCatalog.slice(0, 40).map(p => `${p.referencia} (${p.designacao})`);

  let prompt = '';
  if (mode === 'matricula') {
    prompt = `És um leitor OCR de alta precisão especializado em matrículas de veículos em Portugal e Europa.
Analisa a fotografia e extrai a matrícula exata visível.

Matrículas registadas na base de dados da oficina:
[${knownPlates.join(', ')}]

Instruções:
- Formato comum em Portugal: XX-XX-XX (ex: 00-AA-00, AA-00-AA, 00-00-AA).
- Se a matrícula na imagem corresponder ou for idêntica a uma das matrículas da base de dados, usa exatamente a matrícula oficial registada.
- Extrai também a marca e modelo se forem visíveis.

Responde ESTRITAMENTE em formato JSON:
{
  "matricula": "XX-XX-XX",
  "marca": "Nome da marca se visível",
  "modelo": "Nome do modelo se visível",
  "tipo": "Ligeiro/Pesado/Máquina/Outro",
  "confianca": 0.95
}`;
  } else if (mode === 'odometro') {
    prompt = `Analisa a imagem do painel, mostrador ou contador do veículo/máquina.
Extrai o valor numérico de quilómetros (Km) e/ou horas de trabalho (Horas) visível no visor.
Responde estritamente em formato JSON:
{
  "odometroKm": 123450,
  "odometroHoras": 2340,
  "confianca": 0.90
}`;
  } else if (mode === 'peca') {
    prompt = `És um especialista em peças mecânicas e industriais de oficina.
Analisa a imagem da peça, embalagem ou etiqueta de referência.

Catálogo de peças registadas na oficina:
[${knownParts.join(', ')}]

Instruções:
- Lê com precisão qualquer código, referência gravada (ex: Bosch, Mahle, Valeo, OEM) ou etiqueta.
- Se a peça na imagem corresponder a um item do catálogo acima, utiliza exatamente a referência e designação do catálogo.

Responde ESTRITAMENTE em formato JSON:
{
  "referencia": "REF123",
  "designacao": "Nome da peça",
  "categoria": "Motor/Travagem/Filtração/Hidráulica/Outro",
  "anomaliasVisuais": ["Dano visível se existir"]
}`;
  } else {
    prompt = `És um perito mecânico de oficina e frotas. Analisa a fotografia detalhadamente.
Base de dados de matrículas conhecidas: [${knownPlates.join(', ')}]
Catálogo de peças conhecidas: [${knownParts.slice(0, 20).join(', ')}]

Extrai qualquer informação relevante: matrícula visível, marca/modelo, leitura de odómetro/horas, código/referência de peça ou anomalias/danos visíveis.
Responde estritamente em formato JSON válido:
{
  "matricula": "XX-XX-XX",
  "marcaModelo": "Marca e Modelo",
  "tipoEquipamento": "Tipo de máquina ou viatura",
  "odometroKm": 0,
  "odometroHoras": 0,
  "numeroSerie": "",
  "pecasSugeridas": [],
  "referenciaPeca": "",
  "designacaoPeca": "",
  "anomaliasVisuais": [],
  "textoExtraido": "Todo o texto legível",
  "confianca": 0.9
}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        images: [cleanBase64],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.0,
          num_predict: 400
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama Server HTTP ${response.status}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.response || '{}');

    let rawPlate = parsed.matricula || parsed.plate || '';
    let matchedEq: Equipamento | undefined = undefined;
    if (rawPlate) {
      matchedEq = findBestMatchingEquipment(rawPlate, knownEquipments);
      if (matchedEq) {
        rawPlate = matchedEq.matricula;
      } else {
        rawPlate = formatPlate(rawPlate);
      }
    }

    let refPeca = parsed.referencia || parsed.referenciaPeca;
    let desPeca = parsed.designacao || parsed.designacaoPeca;
    const matchedPart = findBestMatchingPart(refPeca, desPeca, knownCatalog);
    if (matchedPart) {
      refPeca = matchedPart.referencia;
      desPeca = matchedPart.designacao;
    }

    return {
      sucesso: true,
      matricula: rawPlate || undefined,
      odometroKm: typeof parsed.odometroKm === 'number' && parsed.odometroKm > 0 ? parsed.odometroKm : undefined,
      odometroHoras: typeof parsed.odometroHoras === 'number' && parsed.odometroHoras > 0 ? parsed.odometroHoras : undefined,
      tipoEquipamento: matchedEq?.tipo || parsed.tipo || parsed.tipoEquipamento,
      marcaModelo: matchedEq ? `${matchedEq.marca} ${matchedEq.modelo}` : parsed.marcaModelo || (parsed.marca ? `${parsed.marca} ${parsed.modelo || ''}`.trim() : undefined),
      numeroSerie: matchedEq?.nSerie || parsed.numeroSerie,
      pecasSugeridas: desPeca ? [desPeca] : (parsed.pecasSugeridas || []),
      anomaliasVisuais: parsed.anomaliasVisuais || [],
      textoExtraido: parsed.textoExtraido || data.response,
      confianca: parsed.confianca || 0.90,
      tempoProcessamentoMs: Date.now() - startTime,
      origem: 'ollama',
      imagemBase64: base64Image
    };
  } catch (err: any) {
    console.warn('[Ollama Vision Error]', err?.message || err);
    return fallbackLocalVision(base64Image, mode, startTime);
  }
}

function fallbackLocalVision(base64Image: string, mode: string, startTime: number): VisionScanResult {
  return {
    sucesso: false,
    confianca: 0,
    tempoProcessamentoMs: Date.now() - startTime,
    origem: 'ocr_local',
    imagemBase64: base64Image,
    textoExtraido: 'Não foi possível contactar o servidor Ollama ou imagem sem texto legível.'
  };
}

export interface TaskSuggestionFromNotes {
  hasActionableTask: boolean;
  tarefa?: {
    descricao: string;
    prioridade: 'Crítica' | 'Urgente' | 'Alta' | 'Normal' | 'Baixa';
    responsavel: string;
    dataLimite: string;
    notasAdicionais: string;
  };
  razao?: string;
}

export async function analyzeInternalNotesWithOllama(
  notasInternas: string,
  context?: {
    numeroFolha?: string;
    matricula?: string;
    nomeEmpresa?: string;
    clienteNome?: string;
  }
): Promise<TaskSuggestionFromNotes> {
  if (!notasInternas || notasInternas.trim().length === 0) {
    return { hasActionableTask: false };
  }

  const config = db.getConfig();
  const ollamaUrl = config.ollamaUrl || 'http://127.0.0.1:11434';
  const model = config.ollamaModel || 'llama3.2:latest';

  const contextStr = context
    ? `Folha de Serviço: ${context.numeroFolha || 'N/A'}, Viatura/Matrícula: ${context.matricula || 'N/A'}, Empresa: ${context.nomeEmpresa || 'N/A'}`
    : '';

  const prompt = `Tu és um assistente inteligente de gestão de oficina mecânica e frotas.
Analisa o seguinte texto escrito no campo "NOTAS INTERNAS" de uma Folha de Serviço.
Contexto da folha: ${contextStr}

Texto das Notas Internas:
"""
${notasInternas}
"""

Instruções:
1. Avalia se o texto contém alguma AÇÃO/TAREFA pendente para realizar (exemplos: enviar peça, enviar orçamento, encomendar peça ao fornecedor, ligar ao cliente, agendar visita, fazer teste de estrada, pedir cotação, etc.).
2. Se SIM (é uma tarefa/ação concreta), define:
   - "hasActionableTask": true
   - "descricao": descrição clara e direta da tarefa (ex: "Enviar orçamento de revisão ao cliente", "Encomendar filtro de óleo e correia", "Enviar peça para estaleiro")
   - "prioridade": uma de "Crítica", "Urgente", "Alta", "Normal", "Baixa"
   - "responsavel": "Hugo Portugal"
   - "diasLimite": número de dias a contar de hoje (ex: 1 para urgente, 3 para normal)
   - "razao": breve explicação
3. Se NÃO (é apenas uma nota informativa ou observação estática sem nada para fazer), define:
   - "hasActionableTask": false

Responde EXCLUSIVAMENTE em formato JSON:
{
  "hasActionableTask": true,
  "descricao": "Descrição da tarefa",
  "prioridade": "Normal",
  "responsavel": "Hugo Portugal",
  "diasLimite": 2,
  "razao": "A nota indica necessidade de enviar orçamento"
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.response || '{}');
      if (parsed.hasActionableTask && parsed.descricao) {
        const dias = parsed.diasLimite || 2;
        const limitDate = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        return {
          hasActionableTask: true,
          tarefa: {
            descricao: parsed.descricao,
            prioridade: ['Crítica', 'Urgente', 'Alta', 'Normal', 'Baixa'].includes(parsed.prioridade) ? parsed.prioridade : 'Normal',
            responsavel: parsed.responsavel || 'Hugo Portugal',
            dataLimite: limitDate,
            notasAdicionais: `Gerada via IA pelas Notas Internas da FS ${context?.numeroFolha || ''} (${context?.matricula || ''}).\nNota original: "${notasInternas}"`
          },
          razao: parsed.razao
        };
      }
    }
  } catch (err) {
    // Fallback to local heuristic
  }

  return analyzeInternalNotesHeuristic(notasInternas, context);
}

function analyzeInternalNotesHeuristic(
  text: string,
  context?: {
    numeroFolha?: string;
    matricula?: string;
    nomeEmpresa?: string;
    clienteNome?: string;
  }
): TaskSuggestionFromNotes {
  const lower = text.toLowerCase();
  const fsInfo = context?.numeroFolha ? `[FS ${context.numeroFolha}${context.matricula ? ` - ${context.matricula}` : ''}]` : '';

  // Patterns
  if (lower.includes('orçamento') || lower.includes('orcamento') || lower.includes('proposta') || lower.includes('cotacao') || lower.includes('cotação')) {
    const isUrg = lower.includes('urgente') || lower.includes('rapido') || lower.includes('hoje');
    const limitDate = new Date(Date.now() + (isUrg ? 1 : 2) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Elaborar e enviar orçamento ${fsInfo}`.trim(),
        prioridade: isUrg ? 'Urgente' : 'Alta',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada necessidade de orçamentação ou cotação.'
    };
  }

  if (lower.includes('encomendar') || lower.includes('pedir peca') || lower.includes('pedir peça') || lower.includes('comprar') || lower.includes('falta peça') || lower.includes('falta peca')) {
    const isUrg = lower.includes('urgente') || lower.includes('imediato');
    const limitDate = new Date(Date.now() + (isUrg ? 1 : 2) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Encomendar peças/material ${fsInfo}`.trim(),
        prioridade: isUrg ? 'Urgente' : 'Alta',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada necessidade de encomenda de peças ou material.'
    };
  }

  if (lower.includes('enviar peça') || lower.includes('enviar peca') || lower.includes('enviar material') || lower.includes('despachar') || lower.includes('levar')) {
    const limitDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Enviar/Expedir peças para cliente/estaleiro ${fsInfo}`.trim(),
        prioridade: 'Urgente',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada necessidade de envio ou entrega de peças.'
    };
  }

  if (lower.includes('ligar') || lower.includes('contactar') || lower.includes('telefonar') || lower.includes('avisar cliente')) {
    const limitDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Contactar cliente/responsável ${fsInfo}`.trim(),
        prioridade: 'Alta',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada necessidade de comunicação com o cliente.'
    };
  }

  if (lower.includes('agendar') || lower.includes('marcar') || lower.includes('ir ao estaleiro') || lower.includes('deslocacao') || lower.includes('deslocação')) {
    const limitDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Agendar intervenção / deslocação ${fsInfo}`.trim(),
        prioridade: 'Normal',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada necessidade de agendamento ou intervenção presencial.'
    };
  }

  if (lower.includes('verificar') || lower.includes('testar') || lower.includes('reparar') || lower.includes('substituir') || lower.includes('trocar')) {
    const limitDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `Verificação técnica pendente ${fsInfo}`.trim(),
        prioridade: 'Normal',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetada ação técnica pendente.'
    };
  }

  // If text is non-empty and has action words like "precisa", "tem de", "fazer", "pendente"
  if (lower.includes('precisa') || lower.includes('tem de') || lower.includes('tem que') || lower.includes('fazer') || lower.includes('pendente')) {
    const limitDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return {
      hasActionableTask: true,
      tarefa: {
        descricao: `${text.slice(0, 70)} ${fsInfo}`.trim(),
        prioridade: 'Normal',
        responsavel: 'Hugo Portugal',
        dataLimite: limitDate,
        notasAdicionais: `Gerado automaticamente a partir das Notas Internas:\n"${text}"`
      },
      razao: 'Detetado item de ação nas notas internas.'
    };
  }

  return { hasActionableTask: false };
}

export interface AutoPhotoAnalysisItem {
  imagemBase64: string;
  tipoDetectado: 'matricula' | 'odometro' | 'peca' | 'dano' | 'geral';
  labelTipo: string;
  matricula?: string;
  marcaModelo?: string;
  odometroKm?: number;
  odometroHoras?: number;
  pecasSugeridas?: string[];
  referenciaPeca?: string;
  designacaoPeca?: string;
  anomaliasVisuais?: string[];
  descricaoBreve: string;
  confianca: number;
}

export async function classifyAndProcessImageWithOllama(
  base64Image: string,
  imageIndex = 0
): Promise<AutoPhotoAnalysisItem> {
  const config = db.getConfig();
  const ollamaUrl = (config.ollamaUrl || 'https://oficina-hp-ollama.l1mamt.easypanel.host').trim().replace(/\/+$/, '');
  const model = config.ollamaModel || 'oficina-vision';

  // 1. Run ultra-fast, rotation-aware client-side OCR (0 deg & 90 deg for vertical stickers / plates)
  let localOcr: any = null;
  try {
    localOcr = await runLocalOCROnImage(base64Image);
  } catch (e) {
    console.warn('[Local OCR Scan Error]', e);
  }

  // Downscale and compress image to avoid server timeouts and tensor memory exhaustion
  const readyImage = await compressImageForAI(base64Image, 1024, 0.85);
  const cleanBase64 = readyImage.replace(/^data:image\/[a-z]+;base64,/, '');

  const knownEquipments = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
  const knownPlates = knownEquipments.map(e => e.matricula).filter(Boolean);
  const knownCatalog = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);
  const knownParts = knownCatalog.slice(0, 40).map(p => `${p.referencia} (${p.designacao})`);

  const prompt = `És um sistema perito de visão computacional de oficina mecânica e frotas industriais.
Analisa a fotografia e CLASSIFICA-A AUTOMATICAMENTE num dos seguintes tipos:
1. "matricula" se a foto for focada na matrícula (mesmo em fundo amarelo/branco) ou frente/traseira de um veículo/máquina.
2. "odometro" se a foto for do mostrador de quilómetros (Km) ou contador de horas (Horas).
3. "peca" se a foto for de uma peça mecânica, cavilha, autocolante, etiqueta adesiva, consumível, filtro ou código de referência (ex: HA-XXX-XXX).
4. "dano" se a foto mostrar uma avaria, peça partida, desgaste excessivo ou fuga.
5. "geral" se for uma foto geral da viatura.

ATENÇÃO CRÍTICA:
- O texto na etiqueta ou peça pode estar na vertical, de lado ou rodado a 90 graus (ao longo de tubos, cilindros ou autocolantes brancos). Lê atentamente em todas as direções.
- Se a matrícula for amarela ou branca portuguesa (ex: 72-TZ-38), extrai os 6 carateres com traços.

Base de dados da oficina:
- Matrículas conhecidas: [${knownPlates.join(', ')}]
- Peças no catálogo: [${knownParts.join(', ')}]

Responde ESTRITAMENTE em formato JSON:
{
  "tipoDetectado": "matricula" | "odometro" | "peca" | "dano" | "geral",
  "matricula": "XX-XX-XX",
  "marcaModelo": "Marca e Modelo se visível",
  "odometroKm": 0,
  "odometroHoras": 0,
  "referenciaPeca": "Código/Referência",
  "designacaoPeca": "Nome da peça",
  "anomaliasVisuais": ["Dano ou avaria visível"],
  "descricaoBreve": "Resumo em português do que está na foto",
  "confianca": 0.95
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        images: [cleanBase64],
        stream: false,
        format: 'json',
        options: {
          temperature: 0.0,
          num_predict: 400
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    let p: any = {};
    if (response.ok) {
      const data = await response.json();
      try {
        p = JSON.parse(data.response || '{}');
      } catch (e) {
        p = {};
      }
    }

    // Combine local OCR detection with Ollama output
    let detectedPlate = localOcr?.detectedPlate || p.matricula;
    let detectedMarcaModelo = localOcr?.matchedEquipment
      ? `${localOcr.matchedEquipment.marca} ${localOcr.matchedEquipment.modelo}`
      : p.marcaModelo;

    if (detectedPlate) {
      const eqMatch = findBestMatchingEquipment(detectedPlate, knownEquipments);
      if (eqMatch) {
        detectedPlate = eqMatch.matricula;
        detectedMarcaModelo = `${eqMatch.marca} ${eqMatch.modelo}`;
      } else {
        detectedPlate = formatPlate(detectedPlate);
      }
    }

    let refPeca = localOcr?.detectedPartRef || p.referenciaPeca;
    let desPeca = localOcr?.detectedPartName || p.designacaoPeca;
    const partMatch = findBestMatchingPart(refPeca, desPeca, knownCatalog);
    if (partMatch) {
      refPeca = partMatch.referencia;
      desPeca = partMatch.designacao;
    }

    let tipo: 'matricula' | 'odometro' | 'peca' | 'dano' | 'geral' = p.tipoDetectado || 'geral';
    if (detectedPlate) {
      tipo = 'matricula';
    } else if (refPeca || desPeca) {
      tipo = 'peca';
    } else if (!p.tipoDetectado) {
      if (p.odometroKm > 0 || p.odometroHoras > 0 || localOcr?.odometerKm) tipo = 'odometro';
      else if (p.anomaliasVisuais && p.anomaliasVisuais.length > 0) tipo = 'dano';
    }

    const labelMap: Record<string, string> = {
      matricula: '🚗 Matrícula',
      odometro: '⏱️ Odómetro / Horas',
      peca: '🔩 Peça / Material',
      dano: '⚠️ Dano / Anomalia',
      geral: '📸 Vista Geral'
    };

    return {
      imagemBase64: base64Image,
      tipoDetectado: tipo,
      labelTipo: labelMap[tipo] || '📸 Foto',
      matricula: detectedPlate,
      marcaModelo: detectedMarcaModelo,
      odometroKm: typeof p.odometroKm === 'number' && p.odometroKm > 0 ? p.odometroKm : localOcr?.odometerKm,
      odometroHoras: typeof p.odometroHoras === 'number' && p.odometroHoras > 0 ? p.odometroHoras : undefined,
      referenciaPeca: refPeca,
      designacaoPeca: desPeca,
      anomaliasVisuais: Array.isArray(p.anomaliasVisuais) ? p.anomaliasVisuais : undefined,
      descricaoBreve: p.descricaoBreve || (detectedPlate ? `Matrícula: ${detectedPlate}` : desPeca ? `Peça: ${refPeca ? `[${refPeca}] ` : ''}${desPeca}` : `${labelMap[tipo]} identificada`),
      confianca: detectedPlate || refPeca ? 0.98 : (p.confianca || 0.90)
    };
  } catch (err: any) {
    console.warn('[Classify Image Error, using Local OCR Fallback]', err?.message || err);
    return fallbackAutoClassify(base64Image, imageIndex, localOcr);
  }
}

function fallbackAutoClassify(base64Image: string, index: number, localOcr?: any): AutoPhotoAnalysisItem {
  if (localOcr?.detectedPlate) {
    return {
      imagemBase64: base64Image,
      tipoDetectado: 'matricula',
      labelTipo: '🚗 Matrícula',
      matricula: localOcr.detectedPlate,
      marcaModelo: localOcr.matchedEquipment ? `${localOcr.matchedEquipment.marca} ${localOcr.matchedEquipment.modelo}` : undefined,
      descricaoBreve: `Matrícula: ${localOcr.detectedPlate}`,
      confianca: 0.98
    };
  }
  if (localOcr?.detectedPartRef || localOcr?.detectedPartName) {
    return {
      imagemBase64: base64Image,
      tipoDetectado: 'peca',
      labelTipo: '🔩 Peça / Material',
      referenciaPeca: localOcr.detectedPartRef,
      designacaoPeca: localOcr.detectedPartName,
      descricaoBreve: `Peça: ${localOcr.detectedPartRef ? `[${localOcr.detectedPartRef}] ` : ''}${localOcr.detectedPartName || ''}`.trim(),
      confianca: 0.95
    };
  }
  return {
    imagemBase64: base64Image,
    tipoDetectado: 'geral',
    labelTipo: '📸 Vista Geral',
    descricaoBreve: `Fotografia ${index + 1} anexada`,
    confianca: 0.70
  };
}

export interface AiFolhaGenerationInput {
  fotos?: string[];
  fotoMatricula?: string;
  fotoOdometro?: string;
  fotosPecas?: string[];
  fotosGerais?: string[];
  textoDescritivo?: string;
  tipoServico?: TipoServico;
  equipamentos?: Equipamento[];
  empresas?: Empresa[];
}

export interface AiFolhaGenerationResult {
  sucesso: boolean;
  folha: Partial<FolhaServico>;
  detectedPlate?: string;
  detectedKms?: number;
  detectedHours?: number;
  detectedPartsCount: number;
  analiseFotos: AutoPhotoAnalysisItem[];
  resumoIA: string;
  origem: 'ollama' | 'ocr_local';
}

export async function transformPhotosToFolhaWithOllama(
  input: AiFolhaGenerationInput
): Promise<AiFolhaGenerationResult> {
  const config = db.getConfig();
  const newNum = db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');
  const now = new Date().toISOString().split('T')[0];

  const allEquipments = input.equipamentos && input.equipamentos.length > 0
    ? input.equipamentos
    : db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
  const allCompanies = input.empresas && input.empresas.length > 0
    ? input.empresas
    : db.get<Empresa>(STORAGE_KEYS.EMPRESAS);
  const allCatalog = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);

  let detectedPlate = '';
  let detectedMarca = '';
  let detectedModelo = '';
  let detectedTipo = 'Ligeiro';
  let detectedKms = 0;
  let detectedHours = 0;
  const detectedParts: PecaItem[] = [];
  const detectedServices: ServicoItem[] = [];
  const detectedAnomalies: string[] = [];
  const allRawPhotos: string[] = [];
  const analiseFotos: AutoPhotoAnalysisItem[] = [];

  if (input.fotos && input.fotos.length > 0) {
    allRawPhotos.push(...input.fotos);
  }
  if (input.fotoMatricula && !allRawPhotos.includes(input.fotoMatricula)) {
    allRawPhotos.push(input.fotoMatricula);
  }
  if (input.fotoOdometro && !allRawPhotos.includes(input.fotoOdometro)) {
    allRawPhotos.push(input.fotoOdometro);
  }
  if (input.fotosPecas) {
    input.fotosPecas.forEach(p => {
      if (!allRawPhotos.includes(p)) allRawPhotos.push(p);
    });
  }
  if (input.fotosGerais) {
    input.fotosGerais.forEach(g => {
      if (!allRawPhotos.includes(g)) allRawPhotos.push(g);
    });
  }

  const userNotes = input.textoDescritivo || '';
  if (userNotes) {
    for (const eq of allEquipments) {
      if (userNotes.toUpperCase().includes(normalizePlate(eq.matricula)) || userNotes.toUpperCase().includes(eq.matricula.toUpperCase())) {
        detectedPlate = eq.matricula;
        detectedMarca = eq.marca;
        detectedModelo = eq.modelo;
        detectedTipo = eq.tipo;
        break;
      }
    }
  }

  for (let i = 0; i < allRawPhotos.length; i++) {
    const photoBase64 = allRawPhotos[i];
    const analysis = await classifyAndProcessImageWithOllama(photoBase64, i);
    analiseFotos.push(analysis);

    if (analysis.matricula) {
      if (!detectedPlate) {
        detectedPlate = analysis.matricula;
        if (analysis.marcaModelo) {
          const parts = analysis.marcaModelo.split(' ');
          detectedMarca = parts[0] || '';
          detectedModelo = parts.slice(1).join(' ') || '';
        }
      }
    }

    if (analysis.odometroKm && analysis.odometroKm > 0 && detectedKms === 0) {
      detectedKms = analysis.odometroKm;
    }
    if (analysis.odometroHoras && analysis.odometroHoras > 0 && detectedHours === 0) {
      detectedHours = analysis.odometroHoras;
    }

    if (analysis.referenciaPeca || analysis.designacaoPeca) {
      const ref = analysis.referenciaPeca || 'PEC-IA';
      const designacao = analysis.designacaoPeca || 'Peça Identificada';
      const catalogMatch = findBestMatchingPart(ref, designacao, allCatalog);

      const finalRef = catalogMatch?.referencia || ref;
      const finalDesignacao = catalogMatch?.designacao || designacao;
      const finalPreco = catalogMatch?.precoVenda || 0;

      if (!detectedParts.some(p => p.referencia === finalRef && p.designacao === finalDesignacao)) {
        detectedParts.push({
          id: db.generateId('pec'),
          referencia: finalRef,
          designacao: finalDesignacao,
          qtd: 1,
          precoUnitario: finalPreco > 0 ? finalPreco : undefined,
          concluido: false,
          isLivre: !catalogMatch
        });
      }
    }

    if (analysis.anomaliasVisuais && analysis.anomaliasVisuais.length > 0) {
      detectedAnomalies.push(...analysis.anomaliasVisuais);
    }
  }

  if (userNotes) {
    for (const catPart of allCatalog) {
      if (
        userNotes.toLowerCase().includes(catPart.designacao.toLowerCase()) ||
        userNotes.toUpperCase().includes(catPart.referencia.toUpperCase())
      ) {
        if (!detectedParts.some(p => p.referencia === catPart.referencia)) {
          detectedParts.push({
            id: db.generateId('pec'),
            referencia: catPart.referencia,
            designacao: catPart.designacao,
            qtd: 1,
            precoUnitario: catPart.precoVenda,
            concluido: false,
            isLivre: false
          });
        }
      }
    }
  }

  const matchedEquip = findBestMatchingEquipment(detectedPlate, allEquipments);
  const matchedEmpresa = matchedEquip
    ? allCompanies.find(emp => emp.id === matchedEquip.empresaId)
    : allCompanies[0];

  const finalPlate = matchedEquip?.matricula || (detectedPlate ? formatPlate(detectedPlate) : '');
  const finalMarca = matchedEquip?.marca || detectedMarca || '';
  const finalModelo = matchedEquip?.modelo || detectedModelo || '';
  const finalTipo = matchedEquip?.tipo || detectedTipo || 'Ligeiro';
  const finalKms = detectedKms > 0 ? detectedKms : (matchedEquip?.kmsAtuais || 0);
  const finalHours = detectedHours > 0 ? detectedHours : (matchedEquip?.horasAtuais || 0);

  if (userNotes.toLowerCase().includes('óleo') || userNotes.toLowerCase().includes('revisão') || detectedParts.some(p => p.designacao.toLowerCase().includes('óleo') || p.designacao.toLowerCase().includes('filtro'))) {
    detectedServices.push({
      id: db.generateId('srv'),
      descricao: 'Mudança de óleo do motor e substituição de filtros',
      horas: 1.5,
      valorHora: config.valorHoraPadrao || 45.0,
      concluido: false,
      tecnico: 'Hugo Portugal'
    });
  }

  if (userNotes.toLowerCase().includes('trav') || detectedParts.some(p => p.designacao.toLowerCase().includes('trav') || p.designacao.toLowerCase().includes('pastilha')) || detectedAnomalies.some(a => a.toLowerCase().includes('trav') || a.toLowerCase().includes('pastilha'))) {
    detectedServices.push({
      id: db.generateId('srv'),
      descricao: 'Substituição de pastilhas/discos de travão e purga',
      horas: 2.0,
      valorHora: config.valorHoraPadrao || 45.0,
      concluido: false,
      tecnico: 'Hugo Portugal'
    });
  }

  if (detectedServices.length === 0) {
    detectedServices.push({
      id: db.generateId('srv'),
      descricao: userNotes ? `Manutenção: ${userNotes.slice(0, 60)}` : 'Inspeção mecânica geral e diagnóstico',
      horas: 1.5,
      valorHora: config.valorHoraPadrao || 45.0,
      concluido: false,
      tecnico: 'Hugo Portugal'
    });
  }

  const combinedAnomalies = [
    ...detectedAnomalies,
    ...(userNotes ? [userNotes] : [])
  ].join('; ');

  const folhaGerada: Partial<FolhaServico> = {
    id: db.generateId('fs'),
    numero: newNum,
    tipo: input.tipoServico || 'Oficina',
    data: now,
    dataEntradaOficina: now,
    status: 'OF - Com requisição - Aguardar agenda',
    empresaId: matchedEmpresa?.id || matchedEquip?.empresaId || '',
    equipamentoId: matchedEquip?.id || '',
    matricula: finalPlate,
    marca: finalMarca,
    modelo: finalModelo,
    kmsAtuais: finalKms,
    horasAtuais: finalHours,
    localizacao: 'Oficina Principal HP',
    localizacaoTipo: 'oficina',
    distanciaKms: 0,
    anomalias: combinedAnomalies || 'Diagnóstico e manutenção geral.',
    servicos: detectedServices,
    servicosAdicionais: [],
    pecas: detectedParts,
    pecasAdicionais: [],
    mensagens: [
      {
        id: db.generateId('msg'),
        user: 'Assistente IA Mobile (Ollama)',
        text: `Folha gerada a partir de ${allRawPhotos.length} foto(s) com correspondência à base de dados da oficina.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ],
    fotos: allRawPhotos,
    fotosCliente: [],
    notasCliente: userNotes || 'Serviço de manutenção com peças e componentes inspecionados.',
    notasInternas: `[Criada via IA] Matrícula: ${finalPlate || 'N/A'}. Odómetro: ${finalKms} Kms (${finalHours} H). ${userNotes ? `Notas: "${userNotes}"` : ''}`,
    previsaoRevisaoKms: finalKms > 0 ? finalKms + 15000 : undefined,
    previsaoRevisaoHoras: finalHours > 0 ? finalHours + 500 : undefined,
    equipamentoFuncionando: 'Sim',
    equipamentoOperacional: 'Sim',
    equipamentoFinalizado: 'Não'
  };

  const summary = `Folha ${newNum} gerada para ${finalPlate || 'Viatura'} (${finalKms} Kms) com ${detectedServices.length} serviço(s) e ${detectedParts.length} peça(s) reconhecidas.`;

  return {
    sucesso: true,
    folha: folhaGerada,
    detectedPlate: finalPlate,
    detectedKms: finalKms,
    detectedHours: finalHours,
    detectedPartsCount: detectedParts.length,
    analiseFotos: analiseFotos,
    resumoIA: summary,
    origem: 'ollama'
  };
}


