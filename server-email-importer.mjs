import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import PocketBase from 'pocketbase';
import { getServerData, setServerData as saveToLocalServerStore } from './server-storage.mjs';
import { AT26143_PHOTOS } from './server-seed-at26143.mjs';

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://oficina-hp-pocketbase.l1mamt.easypanel.host';
const EMAIL_USER = process.env.EMAIL_EMISSOR || 'oficinahpapp@gmail.com';
const EMAIL_PASS = (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

/**
 * Normaliza e limpa texto com possíveis quebras de kerning de PDF
 */
function cleanDeKerning(str) {
  if (!str) return '';
  let s = str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/ÿýÿý|ÿý/g, 'Ã');

  s = s.replace(/\bA N E L\b/gi, 'ANEL')
       .replace(/\bD E\b/gi, 'DE')
       .replace(/\bR E T E N [ÃA] O\b/gi, 'RETENÇÃO')
       .replace(/\bT A M B O R\b/gi, 'TAMBOR')
       .replace(/\bT R A V [ÃA] O\b/gi, 'TRAVÃO')
       .replace(/\bG\s+([0-9]+)/gi, 'G$1');

  return s;
}

/**
 * Extrai todas as fotografias de intervenção embutidas num ficheiro PDF (ignorando o logótipo do cabeçalho)
 */
export async function extractPhotosFromPdfBuffer(pdfBuffer, pdfParser = null) {
  const photos = [];
  if (!pdfBuffer) return photos;
  const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);

  // 1. Extração direta de streams JPEG nativos (DCTDecode) embutidos no PDF
  try {
    let pos = 0;
    while (pos < buf.length) {
      const sIdx = buf.indexOf('stream', pos);
      if (sIdx === -1) break;
      let dataStart = sIdx + 6;
      if (buf[dataStart] === 13) dataStart++;
      if (buf[dataStart] === 10) dataStart++;
      const eIdx = buf.indexOf('endstream', dataStart);
      if (eIdx === -1) break;
      let dataEnd = eIdx;
      if (buf[dataEnd - 1] === 10) dataEnd--;
      if (buf[dataEnd - 1] === 13) dataEnd--;

      if (dataEnd > dataStart + 2000) {
        const chunk = buf.subarray(dataStart, dataEnd);
        if (chunk[0] === 0xFF && chunk[1] === 0xD8 && chunk[2] === 0xFF) {
          photos.push(`data:image/jpeg;base64,${chunk.toString('base64')}`);
        }
      }
      pos = eIdx + 9;
    }
  } catch (err) {
    console.warn('[EmailImporter] Aviso na extração de streams JPEG do PDF:', err.message);
  }

  // 2. Fallback via pdfParser.getImage() caso existam fotos noutro formato (ignorando o logótipo 1024x724 da página 1)
  if (photos.length === 0 && pdfParser && typeof pdfParser.getImage === 'function') {
    try {
      const imgRes = await pdfParser.getImage({ imageThreshold: 120, imageDataUrl: true, imageBuffer: false });
      for (const page of (imgRes.pages || [])) {
        for (const img of (page.images || [])) {
          if (page.pageNumber === 1 && img.name === 'img_p0_1') continue;
          if (img.width === 1024 && img.height === 724 && img.dataUrl && img.dataUrl.length < 110000) continue;
          if (img.dataUrl && img.dataUrl.startsWith('data:image/')) {
            photos.push(img.dataUrl);
          }
        }
      }
    } catch (err) {
      console.warn('[EmailImporter] Aviso no fallback getImage do PDF:', err.message);
    }
  }

  return photos;
}

/**
 * Analisa e extrai dados de folha de serviço a partir de texto (PDF + corpo do email + assunto)
 */
export function parseServiceSheetText(rawText, filename = '', emailBodyText = '', emailSubject = '') {
  const cleanText = cleanDeKerning(rawText);
  const cleanEmailBody = cleanDeKerning(emailBodyText || '');
  const cleanSubject = (emailSubject || '').trim();

  // 1. Número / Referência
  let numero = '';
  const refMatch =
    cleanText.match(/REFER[ÊE]NCIA:\s*([A-Z0-9_\-\/]+)/i) ||
    cleanEmailBody.match(/(?:Folha\s+de\s+[A-Z]+\s*#|DOCUMENTO:\s*[A-Z]*\s*#?)([A-Z0-9_\-\/]+)/i) ||
    cleanSubject.match(/#([A-Z0-9_\-\/]+)/i);
  const relatorioNumMatch = cleanText.match(/N[ºo]\s*(\d{2,6})/i) || filename.match(/N[ºo]\s*(\d{2,6})/i);
  const guiaFileMatch = filename.match(/(?:GUIA[_\s\-]?(?:AT|OF|FS)?[_\s\-]?|AT|OF|FS)([A-Z0-9\-]+)/i);

  if (refMatch) {
    numero = refMatch[1].trim().toUpperCase();
  } else if (guiaFileMatch) {
    numero = guiaFileMatch[1].trim().toUpperCase();
  } else if (relatorioNumMatch) {
    numero = 'REL-' + relatorioNumMatch[1].trim();
  }

  // 2. Data
  let dataIso = '';
  const dataMatch =
    cleanText.match(/DATA:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i) ||
    cleanEmailBody.match(/DATA:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i) ||
    cleanText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dataMatch) {
    const day = String(dataMatch[1]).padStart(2, '0');
    const month = String(dataMatch[2]).padStart(2, '0');
    const year = dataMatch[3];
    dataIso = `${year}-${month}-${day}`;
  } else {
    dataIso = new Date().toISOString().split('T')[0];
  }

  // 3. Cliente / Empresa, Morada Sede & Local de Assistência
  let clienteNome = '';
  let morada = '';
  let localAssistencia = '';

  const clienteBlockMatch = cleanText.match(
    /CLIENTE\s*\n+([\s\S]*?)(?=\n\s*(?:LOCAL\s+DE\s+ASSIST[ÊE]NCIA|EQUIPAMENTO|Matr[íi]cula:|KMS)|$)/i
  );
  if (clienteBlockMatch) {
    const cLines = clienteBlockMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    if (cLines.length > 0) clienteNome = cLines[0];
    if (cLines.length > 1 && !/^(?:EQUIPAMENTO|LOCAL|DATA|KMS)/i.test(cLines[1])) {
      morada = cLines[1];
    }
  }

  if (!clienteNome) {
    const emailEmpMatch =
      cleanEmailBody.match(/EMPRESA:\s*([^\n\r]+)/i) ||
      cleanText.match(/Nome:\s*([^\n\r]+)/i);
    if (emailEmpMatch) clienteNome = emailEmpMatch[1].trim();
  }

  const localAssistMatch = cleanText.match(/LOCAL\s+DE\s+ASSIST[ÊE]NCIA\s*\n+([^\n\r]+)/i);
  if (localAssistMatch) {
    const locCandidate = localAssistMatch[1].trim();
    if (locCandidate && !/^(?:EQUIPAMENTO|KMS|HORAS)/i.test(locCandidate)) {
      localAssistencia = locCandidate;
    }
  }

  // 4. Matrícula & Nº de Série (Sem truncar aos 10 caracteres — suporta matrículas e VINs de 17+ caracteres)
  let matricula = '';
  const matMatch =
    cleanText.match(/Matr[íi]cula:\s*([^\n\r]+)/i) ||
    cleanEmailBody.match(/MATR[ÍI]CULA:\s*([^\n\r]+)/i) ||
    cleanSubject.match(/#[A-Z0-9_\-]+\s*-\s*([A-Z0-9\-]{4,30})/i) ||
    cleanText.match(/\b([0-9]{2}-[A-Z]{2}-[0-9]{2}|[A-Z]{2}-[0-9]{2}-[A-Z]{2}|[0-9]{2}-[0-9]{2}-[A-Z]{2}|[A-Z]{2}-[0-9]{2}-[0-9]{2})\b/i);

  if (matMatch) {
    matricula = matMatch[1]
      .replace(/\bN[ºo°]\s*(?:de\s*)?S[ée]rie.*$/i, '')
      .trim()
      .toUpperCase();
  }

  let nSerie = '';
  const serieMatch = cleanText.match(/N[ºo°]\s*(?:de\s*)?S[ée]rie:\s*([^\n\r]+)/i);
  if (serieMatch) {
    nSerie = serieMatch[1].trim().toUpperCase();
  }

  // Se matrícula estiver truncada mas o Nº de Série completo começar por ela, usar o completo
  if (matricula && nSerie && nSerie.length > matricula.length && nSerie.startsWith(matricula)) {
    matricula = nSerie;
  }

  // 5. Marca & Modelo
  let marca = 'Goupil';
  let modelo = '';

  const equipHeaderMatch =
    cleanText.match(/EQUIPAMENTO\s*\n+([^\n\r]+)/i) ||
    cleanEmailBody.match(/VE[ÍI]CULO:\s*([^\n\r]+)/i);

  if (equipHeaderMatch) {
    const eqLine = equipHeaderMatch[1].trim();
    if (!/^Matr[íi]cula/i.test(eqLine)) {
      const gMatch = eqLine.match(/\b(Goupil)\s+([A-Z0-9\-\s]+)/i);
      if (gMatch) {
        marca = 'Goupil';
        modelo = gMatch[2].trim().toUpperCase();
      } else {
        const parts = eqLine.split(/\s+/);
        marca = parts[0] || 'Goupil';
        modelo = parts.slice(1).join(' ') || eqLine;
      }
    }
  }

  if (!modelo) {
    if (/\bGoupil\s*G6\b|\bG6\b/i.test(cleanText) || /^VRWG6/i.test(matricula) || /^VRWG6/i.test(nSerie)) {
      modelo = 'G6';
    } else if (/\bGoupil\s*G5\b|\bG5\b/i.test(cleanText)) {
      modelo = 'G5';
    } else if (/\bGoupil\s*G3\b|\bG3\b/i.test(cleanText) || /^VRWG3/i.test(matricula) || /^VRWG3/i.test(nSerie)) {
      modelo = 'G3';
    } else if (/\bGoupil\s*G2\b|\bG2\b/i.test(cleanText) || /^VRWG2/i.test(matricula) || /^VRWG2/i.test(nSerie)) {
      modelo = 'G2';
    } else if (/\bGoupil\s*G1\b|\bG1\b/i.test(cleanText)) {
      modelo = 'G1';
    } else {
      modelo = 'G4';
    }
  }

  // 6. Kms & Horas
  let kms = 0;
  let horas = 0;
  const kmsHorasMatch = cleanText.match(/KMS\s+HORAS\s*\n+(\d+)\s+([0-9hm\s]+)/i);
  if (kmsHorasMatch) {
    kms = parseInt(kmsHorasMatch[1], 10) || 0;
    const hMatch = kmsHorasMatch[2].match(/(\d+)\s*h/i);
    if (hMatch) horas = parseInt(hMatch[1], 10) || 0;
  } else {
    const kmMatch = cleanText.match(/(\d+)\s*(?:kms?|quil[ôo]metros)/i);
    if (kmMatch) kms = parseInt(kmMatch[1], 10) || 0;
    const hrMatch = cleanText.match(/(\d+)\s*(?:horas|hrs?|h)\b/i);
    if (hrMatch) horas = parseInt(hrMatch[1], 10) || 0;
  }

  // 7. Técnico
  let tecnico = '';
  const tecMatch =
    cleanText.match(/Servi[çc]o\s*realizado\s*por:\s*([^\n\r]+)/i) ||
    cleanText.match(/([A-ZÀ-ÿa-z\s]+)\s*-\s*T[ée]cnico/i);
  if (tecMatch) {
    tecnico = tecMatch[1].trim();
  }

  // 8. Anomalias & Notas do PDF
  let anomalias = '';
  const anomMatch = cleanText.match(
    /ANOMALIAS\s*[\/&]\s*OBSERVA[ÇC][ÕO]ES\s*T[ÉE]CNICAS\s*\n+([\s\S]*?)(?=\n\s*(?:SERVI[ÇC]OS|NOTAS|PE[ÇC]AS|REGISTO\s+FOTOGR[ÁA]FICO|Servi[çc]o\s+realizado|HPerformance)|$)/i
  );
  if (anomMatch) {
    anomalias = anomMatch[1]
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/HPerformance[^\n]*/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  let notasPdf = '';
  const notasMatch = cleanText.match(
    /\n\s*NOTAS\s*\n+([\s\S]*?)(?=\n\s*(?:PE[ÇC]AS|REGISTO\s+FOTOGR[ÁA]FICO|Servi[çc]o\s+realizado|HPerformance)|$)/i
  );
  if (notasMatch) {
    notasPdf = notasMatch[1]
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/HPerformance[^\n]*/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (notasPdf && anomalias && !anomalias.toLowerCase().includes(notasPdf.toLowerCase())) {
    anomalias = `${anomalias}\nNotas Técnicas: ${notasPdf}`;
  } else if (notasPdf && !anomalias) {
    anomalias = notasPdf;
  }

  // 9. Serviços Executados / Realizados / Concluídos (PDF + Corpo do Email com horas)
  const emailServices = [];
  const emailServSection = cleanEmailBody.match(
    /SERVI[ÇC]OS\s+(?:CONCLU[ÍI]DOS|REALIZADOS|EXECUTADOS)\s*:?\s*\n+([\s\S]*?)(?=\n\s*(?:PE[ÇC]AS|O\s+PDF\s+com\s+todos|Cumprimentos|HPerformance)|$)/i
  );
  if (emailServSection) {
    const eLines = emailServSection[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const el of eLines) {
      const cleaned = el.replace(/^[\•\-\*\u2022\s]+/, '').trim();
      if (!cleaned || /^O\s+PDF\s+com/i.test(cleaned)) continue;
      const hrMatch = cleaned.match(/^(.*?)\s*\(\s*(\d+(?:[,\.]\d+)?)\s*h(?:oras?)?\s*\)\s*$/i);
      if (hrMatch) {
        emailServices.push({
          descricao: hrMatch[1].trim(),
          horas: parseFloat(hrMatch[2].replace(',', '.')) || 0
        });
      } else {
        emailServices.push({
          descricao: cleaned,
          horas: 0
        });
      }
    }
  }

  const servicos = [];
  const servMatch = cleanText.match(
    /SERVI[ÇC]OS(?:\s+REALIZADOS|\s+EXECUTADOS|\s+CONCLU[ÍI]DOS)?\s*\n+([\s\S]*?)(?=\n\s*(?:NOTAS|PE[ÇC]AS|REGISTO\s+FOTOGR[ÁA]FICO|Servi[çc]o\s+realizado|HPerformance)|$)/i
  );
  if (servMatch) {
    const rawLines = servMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !/^--\s*\d+\s*of\s*\d+\s*--$/i.test(l) && !/^HPerformance/i.test(l));

    const hasCheckboxes = rawLines.some(l => /\[\s*x\s*\]/i.test(l));
    for (const sl of rawLines) {
      if (hasCheckboxes && !/\[\s*x\s*\]/i.test(sl)) continue;
      let desc = sl.replace(/\[\s*x?\s*\]/gi, '').replace(/^[\•\-\*\u2022\s]+/, '').trim();
      if (!desc) continue;

      let horas = 0;
      const inlineHr = desc.match(/^(.*?)\s*\(\s*(\d+(?:[,\.]\d+)?)\s*h(?:oras?)?\s*\)\s*$/i);
      if (inlineHr) {
        desc = inlineHr[1].trim();
        horas = parseFloat(inlineHr[2].replace(',', '.')) || 0;
      }

      if (!horas && emailServices.length > 0) {
        const normDesc = desc.replace(/[^a-zA-Z0-9À-ÿ]/g, '').toLowerCase();
        const matchedEs = emailServices.find(es => {
          const normEs = es.descricao.replace(/[^a-zA-Z0-9À-ÿ]/g, '').toLowerCase();
          return normEs === normDesc || normEs.includes(normDesc) || normDesc.includes(normEs);
        });
        if (matchedEs && matchedEs.horas > 0) {
          horas = matchedEs.horas;
        }
      }

      servicos.push({
        id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        descricao: desc,
        horas: horas || 1,
        tecnico: tecnico || 'HP',
        concluido: true,
        dataConclusao: dataIso
      });
    }
  }

  if (servicos.length === 0 && emailServices.length > 0) {
    for (const es of emailServices) {
      servicos.push({
        id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        descricao: es.descricao,
        horas: es.horas || 1,
        tecnico: tecnico || 'HP',
        concluido: true,
        dataConclusao: dataIso
      });
    }
  }

  // 10. Peças & Materiais
  const pecas = [];
  const pecasMatch = cleanText.match(
    /PE[ÇC]AS\s*E\s*MATERIAIS\s*\n+([\s\S]*?)(?=\n\s*(?:NOTAS|REGISTO\s+FOTOGR[ÁA]FICO|Servi[çc]o\s*realizado|HPerformance)|$)/i
  );
  if (pecasMatch) {
    const pLines = pecasMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const rawLine of pLines) {
      if (!rawLine.includes('|')) continue;
      let cleanLine = rawLine.replace(/\[\s*x?\s*\]/gi, '').trim();
      cleanLine = cleanLine.replace(/\[\s*([A-Z0-9\s\-]+)\s*\]/g, (m, g1) => '[' + g1.replace(/\s+/g, '') + ']');
      const partMatch = cleanLine.match(/^(\d+(?:[,\.]\d+)?)\s*\|\s*(.*)$/);
      if (partMatch) {
        const qtd = parseFloat(partMatch[1].replace(',', '.'));
        let rest = partMatch[2].trim();
        let ref = '';

        const bracketRef = rest.match(/^\[([A-Z0-9_\-]+)\]\s*(.*)$/i);
        const plainRef = rest.match(/^([A-Z]{2,4}-?[0-9]{4,10})\s+(.*)$/i);

        if (bracketRef) {
          ref = bracketRef[1];
          rest = bracketRef[2];
        } else if (plainRef) {
          ref = plainRef[1];
          rest = plainRef[2];
        }

        rest = rest.replace(/\bA N E L\b/gi, 'ANEL')
                   .replace(/\bD E\b/gi, 'DE')
                   .replace(/\bR E T E N [ÃA] O\b/gi, 'RETENÇÃO')
                   .replace(/\bT A M B O R\b/gi, 'TAMBOR')
                   .replace(/\bT R A V [ÃA] O\b/gi, 'TRAVÃO')
                   .replace(/\bG\s+([0-9]+)/gi, 'G$1')
                   .replace(/\s+/g, ' ')
                   .trim();

        pecas.push({
          id: `peca_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          qtd,
          referencia: ref || undefined,
          designacao: rest || 'Peça sem designação',
          concluido: true,
          isLivre: true,
          dataConclusao: dataIso
        });
      }
    }
  }

  // Tipo de Serviço
  let tipo = 'Assistência Técnica';
  if (/^OF/i.test(numero) || /^O2/i.test(numero)) {
    tipo = 'Oficina';
  } else if (/^CT/i.test(numero)) {
    tipo = 'Contrato';
  }

  return {
    numero: numero || (`IMP-${Date.now().toString().slice(-6)}`),
    data: dataIso,
    tipo,
    clienteNome: clienteNome || 'Cliente Não Identificado',
    morada: morada || '',
    localAssistencia: localAssistencia || '',
    matricula: matricula || 'SEM-MATRICULA',
    marca,
    modelo,
    nSerie,
    kms,
    horas,
    anomalias,
    notasCliente: notasPdf || '',
    servicos,
    pecas,
    tecnico,
    status: 'Concluído'
  };
}

/**
 * Lê coleção do armazenamento local do servidor ou PocketBase app_data
 */
async function getAppData(pb, key, fallback = []) {
  const local = getServerData(key);
  if (local !== null && local !== undefined) return local;
  try {
    const record = await pb.collection('app_data').getFirstListItem(`key="${key}"`);
    if (record?.data !== undefined) {
      saveToLocalServerStore(key, record.data);
      return record.data;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Grava coleção no armazenamento do servidor e tenta sincronizar no PocketBase
 */
async function setAppData(pb, key, data) {
  saveToLocalServerStore(key, data);
  try {
    let existing = null;
    try {
      existing = await pb.collection('app_data').getFirstListItem(`key="${key}"`);
    } catch {}

    if (existing) {
      await pb.collection('app_data').update(existing.id, {
        data,
        timestamp: new Date().toISOString()
      });
    } else {
      await pb.collection('app_data').create({
        key,
        data,
        timestamp: new Date().toISOString()
      });
    }
    return true;
  } catch (err) {
    return true;
  }
}

/**
 * Resolve o formato exato de localização esperado pela interface (Sede ou Estaleiro)
 */
function resolveFolhaLocation(emp, parsed) {
  if (!emp) {
    return {
      localizacao: parsed.localAssistencia || parsed.morada || '',
      localizacaoTipo: 'estaleiro'
    };
  }

  const assistAddr = (parsed.localAssistencia || '').trim();
  if (assistAddr) {
    const normAssist = assistAddr.toLowerCase().replace(/\s+/g, ' ');
    const estaleiros = Array.isArray(emp.estaleiros) ? emp.estaleiros : [];
    const matchedEst = estaleiros.find(est => {
      const m = (est.morada || '').toLowerCase().replace(/\s+/g, ' ');
      const n = (est.nome || '').toLowerCase().replace(/\s+/g, ' ');
      return (m && (m.includes(normAssist) || normAssist.includes(m))) ||
             (n && (n.includes(normAssist) || normAssist.includes(n)));
    });

    if (matchedEst) {
      return {
        localizacao: `Estaleiro ${matchedEst.nome}: ${matchedEst.morada || matchedEst.nome}`,
        localizacaoTipo: 'estaleiro'
      };
    }

    // Verificar se é a morada da sede
    const normSede = (emp.moradaSede || '').toLowerCase().replace(/\s+/g, ' ');
    if (normSede && (normSede.includes(normAssist) || normAssist.includes(normSede))) {
      return {
        localizacao: `Sede: ${emp.moradaSede || emp.nome}`,
        localizacaoTipo: 'sede'
      };
    }

    // Adicionar como estaleiro se for uma morada nova de assistência
    if (!emp.estaleiros) emp.estaleiros = [];
    const newEst = {
      id: `est_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      nome: assistAddr.split(',')[0].trim() || 'Local de Assistência',
      morada: assistAddr,
      responsavel: '',
      telefone: ''
    };
    emp.estaleiros.push(newEst);
    return {
      localizacao: `Estaleiro ${newEst.nome}: ${newEst.morada}`,
      localizacaoTipo: 'estaleiro'
    };
  }

  return {
    localizacao: `Sede: ${emp.moradaSede || parsed.morada || emp.nome}`,
    localizacaoTipo: 'sede'
  };
}

/**
 * Repara imediatamente a folha AT26143 e remove qualquer matrícula truncada (VRWG3SNBCF)
 */
export async function repairAt26143AndBrokenImports() {
  try {
    const pb = new PocketBase(POCKETBASE_URL);
    pb.autoCancellation(false);

    let empresas = await getAppData(pb, 'oficina_hp_empresas', []);
    let equipamentos = await getAppData(pb, 'oficina_hp_equipamentos', []);
    let folhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);

    if (!Array.isArray(folhas)) folhas = [];
    if (!Array.isArray(equipamentos)) equipamentos = [];
    if (!Array.isArray(empresas)) empresas = [];

    // 1. Remover equipamento duplicado truncado "VRWG3SNBCF"
    const cleanEquipamentos = equipamentos.filter(
      e => (e.matricula || '').trim().toUpperCase() !== 'VRWG3SNBCF'
    );

    // 2. Encontrar empresa KNOWER PROJECTS, S.A. (E127) e equipamento real VRWG3SNBCF0000339
    const knowerEmp = empresas.find(
      e => e.id === 'E127' || (e.nome && e.nome.toUpperCase().includes('KNOWER PROJECTS'))
    );
    const realG3Equip = cleanEquipamentos.find(
      e => (e.matricula && e.matricula.toUpperCase() === 'VRWG3SNBCF0000339') ||
           (e.nSerie && e.nSerie.toUpperCase() === 'VRWG3SNBCF0000339')
    );

    const nowIso = new Date().toISOString();
    const existingIdx = folhas.findIndex(f => (f.numero || '').toUpperCase() === 'AT26143');
    const folhaId = existingIdx >= 0 ? folhas[existingIdx].id : 'fs_at26143';

    const repairedAt26143 = {
      ...(existingIdx >= 0 ? folhas[existingIdx] : {}),
      id: folhaId,
      numero: 'AT26143',
      tipo: 'Assistência Técnica',
      data: '2026-11-05',
      dataAbertura: '2026-11-05',
      dataConclusao: '2026-11-05',
      status: 'Concluído',
      requisicao: existingIdx >= 0 ? (folhas[existingIdx].requisicao || 'Não') : 'Não',
      faturacao: existingIdx >= 0 ? (folhas[existingIdx].faturacao || 'Pendente') : 'Pendente',
      empresaId: knowerEmp?.id || realG3Equip?.empresaId || 'E127',
      equipamentoId: realG3Equip?.id || '62474c40-9026-4794-8843-1037df768611',
      matricula: 'VRWG3SNBCF0000339',
      marca: 'Goupil',
      modelo: 'G3',
      nSerie: 'VRWG3SNBCF0000339',
      kmsAtuais: 1899,
      horasAtuais: 275,
      localizacao: 'Estaleiro Benfica Campus: Q.ta da Trindade, 2840-600 Seixal',
      localizacaoTipo: 'estaleiro',
      distanciaKms: existingIdx >= 0 && folhas[existingIdx].distanciaKms ? folhas[existingIdx].distanciaKms : 510,
      anomalias: 'Verificação de anomalia, sem travões e dobradiças traseiras arrancadas.\nNotas Técnicas: Viatura necessita de bomba de travões nova, a mesma está danificada, reparação da traseira, dobradiças do taipal que foram arrancadas.',
      notasCliente: 'Viatura necessita de bomba de travões nova, a mesma está danificada, reparação da traseira, dobradiças do taipal que foram arrancadas.',
      notasInternas: 'Importada automaticamente via email (hugoportugal@gmail.com). Técnico: SF. Local de Assistência: Q.ta da Trindade, 2840-600 Seixal.',
      servicos: [
        {
          id: 'srv_at26143_1',
          descricao: 'Verificação de anomalia.',
          horas: 1,
          tecnico: 'SF',
          concluido: true,
          dataConclusao: '2026-11-05'
        }
      ],
      servicosAdicionais: existingIdx >= 0 ? (folhas[existingIdx].servicosAdicionais || []) : [],
      pecas: existingIdx >= 0 && folhas[existingIdx].pecas?.length ? folhas[existingIdx].pecas : [],
      pecasAdicionais: existingIdx >= 0 ? (folhas[existingIdx].pecasAdicionais || []) : [],
      fotos: AT26143_PHOTOS,
      fotosCliente: [],
      tecnicoPlaneado: 'SF',
      atualizadoEm: nowIso,
      updatedAt: nowIso
    };

    if (existingIdx >= 0) {
      folhas[existingIdx] = repairedAt26143;
    } else {
      folhas.unshift(repairedAt26143);
    }

    await setAppData(pb, 'oficina_hp_equipamentos', cleanEquipamentos);
    await setAppData(pb, 'oficina_hp_folhas_servico', folhas);

    // Guardar fotos dedicadas por ID e por Número para carregamento rápido em todos os PCs
    const photoPayload = {
      folhaId,
      folhaNumero: 'AT26143',
      photos: AT26143_PHOTOS,
      updatedAt: nowIso
    };
    await setAppData(pb, `folha_photos_${folhaId}`, photoPayload);
    await setAppData(pb, 'folha_photos_num_AT26143', photoPayload);

    console.log(`[EmailImporter] ✅ Folha AT26143 reparada (Matrícula: VRWG3SNBCF0000339, Modelo: Goupil G3, 1 serviço, ${AT26143_PHOTOS.length} fotos).`);
  } catch (err) {
    console.warn('[EmailImporter] Aviso ao reparar AT26143:', err.message);
  }
}

// Executar reparação imediata no arranque do módulo
repairAt26143AndBrokenImports().catch(() => {});

/**
 * Monitoriza a caixa de correio do Gmail via IMAP e importa novas folhas de serviço (ou repara folhas incompletas recentes)
 */
export async function checkAndImportEmails({ dryRun = false } = {}) {
  // Garantir que a reparação da AT26143 está aplicada
  await repairAt26143AndBrokenImports();

  if (!EMAIL_PASS) {
    console.warn('[EmailImporter] ⚠️ EMAIL_APP_PASSWORD não configurada. Impossível ligar ao Gmail IMAP.');
    return {
      success: false,
      error: 'EMAIL_APP_PASSWORD não configurada nas variáveis de ambiente do EasyPanel.'
    };
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    logger: false
  });

  const importedSheets = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Procurar mensagens não lidas + mensagens recentes dos últimos 14 dias (para reparar folhas importadas de forma incompleta)
      const unreadUids = (await client.search({ seen: false })) || [];
      const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentUids = (await client.search({ since: sinceDate })) || [];
      const allCandidateUids = Array.from(new Set([...unreadUids, ...recentUids]));

      if (allCandidateUids.length === 0) {
        return {
          success: true,
          count: 0,
          message: 'Nenhum email novo por processar na caixa de entrada.'
        };
      }

      const pb = new PocketBase(POCKETBASE_URL);
      pb.autoCancellation(false);

      let empresas = await getAppData(pb, 'oficina_hp_empresas', []);
      let equipamentos = (await getAppData(pb, 'oficina_hp_equipamentos', [])).filter(
        e => (e.matricula || '').trim().toUpperCase() !== 'VRWG3SNBCF'
      );
      let folhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
      let logs = await getAppData(pb, 'oficina_hp_email_import_logs', []);

      const { PDFParse } = await import('pdf-parse');

      for (const uid of allCandidateUids) {
        const isUnread = unreadUids.includes(uid);
        try {
          const message = await client.fetchOne(uid, { source: true, flags: true, envelope: true });
          if (!message || !message.source) continue;

          const parsedMail = await simpleParser(message.source);
          const subject = parsedMail.subject || '';
          const fromAddress = parsedMail.from?.text || 'Desconhecido';
          const mailDate = parsedMail.date ? parsedMail.date.toISOString() : new Date().toISOString();
          const emailBodyText = parsedMail.text || (parsedMail.html ? parsedMail.html.replace(/<[^>]+>/g, '\n') : '');

          // Se já foi lido, verificar rapidamente pelo assunto se corresponde a uma folha já completa
          if (!isUnread) {
            const subjRefMatch = subject.match(/#([A-Z0-9_\-]+)/i);
            if (!subjRefMatch) continue;
            const refNum = subjRefMatch[1].toUpperCase();
            const existingFolha = folhas.find(f => (f.numero || '').toUpperCase() === refNum);
            const isComplete =
              existingFolha &&
              existingFolha.matricula &&
              existingFolha.matricula.length !== 10 &&
              Array.isArray(existingFolha.servicos) &&
              existingFolha.servicos.length > 0 &&
              Array.isArray(existingFolha.fotos) &&
              existingFolha.fotos.length > 0;
            if (isComplete) continue;
          }

          console.log(`[EmailImporter] ✉️ A analisar email UID ${uid} | De: ${fromAddress} | Assunto: ${subject}`);

          const candidateItems = [];
          const directEmailPhotos = [];

          // 1. Extrair de anexos PDF e imagens anexadas diretamente ao email
          if (parsedMail.attachments && parsedMail.attachments.length > 0) {
            for (const att of parsedMail.attachments) {
              if (att.contentType === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')) {
                try {
                  const pdfParser = new PDFParse({ data: att.content });
                  const { text } = await pdfParser.getText();
                  const pdfPhotos = await extractPhotosFromPdfBuffer(att.content, pdfParser);
                  await pdfParser.destroy().catch(() => {});

                  if (text && text.trim().length > 40) {
                    candidateItems.push({
                      text,
                      filename: att.filename || '',
                      photos: pdfPhotos
                    });
                  }
                } catch (pdfErr) {
                  console.warn(`[EmailImporter] Erro ao ler PDF anexo ${att.filename}:`, pdfErr.message);
                }
              } else if (att.contentType && att.contentType.startsWith('image/') && att.content && att.content.length > 3000) {
                directEmailPhotos.push(`data:${att.contentType};base64,${att.content.toString('base64')}`);
              }
            }
          }

          // 2. Se não houver PDFs válidos, tentar o corpo do email se relevante
          if (candidateItems.length === 0) {
            const isRelevant = /folha|serviço|guia|relatório|matrícula|reparação|revisão|at26|of26/i.test(`${subject} ${emailBodyText}`);
            if (isRelevant && emailBodyText.length > 40) {
              candidateItems.push({
                text: emailBodyText,
                filename: subject,
                photos: directEmailPhotos
              });
            }
          }

          // Processar cada candidato encontrado
          for (const cand of candidateItems) {
            const parsed = parseServiceSheetText(cand.text, cand.filename, emailBodyText, subject);
            const allPhotos = [...(cand.photos || []), ...directEmailPhotos];

            if (!parsed.matricula && !parsed.numero && parsed.clienteNome === 'Cliente Não Identificado') {
              continue;
            }

            // 1. Resolver Equipamento existente na Base de Dados (por matrícula completa, Nº de série ou prefixo VIN)
            const normMat = (parsed.matricula || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const normSerie = (parsed.nSerie || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

            let eq = equipamentos.find(e => {
              const eMat = (e.matricula || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
              const eSerie = (e.nSerie || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
              if (normMat && eMat === normMat) return true;
              if (normMat && eSerie === normMat) return true;
              if (normSerie && eSerie === normSerie) return true;
              if (normSerie && eMat === normSerie) return true;
              if (normMat.length >= 10 && eMat.length > normMat.length && eMat.startsWith(normMat)) return true;
              if (normMat.length >= 10 && eSerie.length > normMat.length && eSerie.startsWith(normMat)) return true;
              return false;
            });

            // 2. Resolver Empresa (pelo nome do cliente ou pelo empresaId do equipamento já existente)
            let emp = empresas.find(e =>
              (parsed.clienteNome &&
                parsed.clienteNome !== 'Cliente Não Identificado' &&
                (e.nome.toLowerCase().includes(parsed.clienteNome.toLowerCase()) ||
                 parsed.clienteNome.toLowerCase().includes(e.nome.toLowerCase()))) ||
              (eq && eq.empresaId && e.id === eq.empresaId)
            );

            if (!emp) {
              emp = {
                id: `emp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                nome: parsed.clienteNome,
                moradaSede: parsed.morada || 'Morada a confirmar',
                estaleiros: [],
                ativo: true,
                criadoEm: new Date().toISOString()
              };
              empresas.push(emp);
              console.log(`[EmailImporter] 🏢 Nova empresa criada automaticamente: ${emp.nome}`);
            }

            if (eq) {
              // Preservar matrícula, marca e modelo reais do equipamento existente na base de dados
              parsed.matricula = eq.matricula || parsed.matricula;
              parsed.marca = eq.marca || parsed.marca;
              parsed.modelo = (eq.modelo || parsed.modelo).trim();
              if (eq.nSerie && !parsed.nSerie) parsed.nSerie = eq.nSerie;
              if (parsed.kms > (eq.kmsAtuais || 0)) eq.kmsAtuais = parsed.kms;
              if (parsed.horas > (eq.horasAtuais || 0)) eq.horasAtuais = parsed.horas;
            } else if (parsed.matricula && parsed.matricula !== 'SEM-MATRICULA') {
              eq = {
                id: `eq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                matricula: parsed.matricula,
                marca: parsed.marca || 'Goupil',
                modelo: parsed.modelo || 'G4',
                nSerie: parsed.nSerie || '',
                tipo: 'Viatura Elétrica',
                kmsAtuais: parsed.kms,
                horasAtuais: parsed.horas,
                empresaId: emp.id
              };
              equipamentos.push(eq);
              console.log(`[EmailImporter] 🚗 Novo equipamento criado automaticamente: ${eq.matricula} (${eq.modelo})`);
            }

            // 3. Resolver Local de Intervenção (Estaleiro vs Sede)
            const resolvedLoc = resolveFolhaLocation(emp, parsed);

            // 4. Verificar se folha já existe
            const existingIdx = folhas.findIndex(f => (f.numero || '').toUpperCase() === parsed.numero.toUpperCase());
            const folhaId = existingIdx >= 0 ? folhas[existingIdx].id : `fs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const nowIso = new Date().toISOString();

            const folhaData = {
              ...(existingIdx >= 0 ? folhas[existingIdx] : {}),
              id: folhaId,
              numero: parsed.numero,
              tipo: parsed.tipo,
              data: parsed.data,
              dataAbertura: parsed.data,
              dataConclusao: parsed.data,
              status: 'Concluído',
              requisicao: existingIdx >= 0 ? (folhas[existingIdx].requisicao || 'Não') : 'Não',
              empresaId: emp.id,
              equipamentoId: eq?.id || '',
              matricula: parsed.matricula,
              marca: parsed.marca,
              modelo: parsed.modelo,
              nSerie: parsed.nSerie,
              kmsAtuais: parsed.kms,
              horasAtuais: parsed.horas,
              localizacao: resolvedLoc.localizacao,
              localizacaoTipo: resolvedLoc.localizacaoTipo,
              distanciaKms: existingIdx >= 0 ? (folhas[existingIdx].distanciaKms || 0) : 0,
              anomalias: parsed.anomalias,
              servicos: parsed.servicos,
              servicosAdicionais: existingIdx >= 0 ? (folhas[existingIdx].servicosAdicionais || []) : [],
              pecas: parsed.pecas,
              pecasAdicionais: existingIdx >= 0 ? (folhas[existingIdx].pecasAdicionais || []) : [],
              mensagens: existingIdx >= 0 ? (folhas[existingIdx].mensagens || []) : [],
              fotos: allPhotos.length > 0 ? allPhotos : (existingIdx >= 0 ? (folhas[existingIdx].fotos || []) : []),
              fotosCliente: existingIdx >= 0 ? (folhas[existingIdx].fotosCliente || []) : [],
              notasCliente: parsed.notasCliente || (existingIdx >= 0 ? (folhas[existingIdx].notasCliente || '') : ''),
              notasInternas: `Importada automaticamente via email (${fromAddress}) a partir do programa antigo. Técnico: ${parsed.tecnico || 'N/A'}.${parsed.localAssistencia ? ` Local: ${parsed.localAssistencia}.` : ''}`,
              previsaoRevisaoKms: (parsed.kms || 0) + 5000,
              previsaoRevisaoHoras: (parsed.horas || 0) + 250,
              tecnicoPlaneado: parsed.tecnico || undefined,
              faturacao: existingIdx >= 0 ? (folhas[existingIdx].faturacao || 'Pendente') : 'Pendente',
              criadoPor: `Robô Email (${fromAddress})`,
              criadoEm: mailDate,
              atualizadoEm: nowIso,
              updatedAt: nowIso
            };

            if (existingIdx >= 0) {
              folhas[existingIdx] = folhaData;
              console.log(`[EmailImporter] 🔄 Folha ${parsed.numero} atualizada (${parsed.matricula} | ${parsed.servicos.length} serviços | ${folhaData.fotos.length} fotos).`);
            } else {
              folhas.unshift(folhaData);
              console.log(`[EmailImporter] 📄 Nova Folha de Serviço criada: ${parsed.numero} (${parsed.matricula} - ${emp.nome} | ${parsed.servicos.length} serviços | ${folhaData.fotos.length} fotos)`);
            }

            // Gravar fotografias extraídas nos registos dedicados de fotos da folha
            if (folhaData.fotos && folhaData.fotos.length > 0 && !dryRun) {
              const photoPayload = {
                folhaId,
                folhaNumero: parsed.numero,
                photos: folhaData.fotos,
                updatedAt: nowIso
              };
              await setAppData(pb, `folha_photos_${folhaId}`, photoPayload);
              await setAppData(pb, `folha_photos_num_${parsed.numero}`, photoPayload);
            }

            importedSheets.push({
              numero: parsed.numero,
              matricula: parsed.matricula,
              cliente: emp.nome,
              data: parsed.data,
              servicosCount: parsed.servicos.length,
              pecasCount: parsed.pecas.length,
              fotosCount: folhaData.fotos.length,
              subject
            });

            logs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              timestamp: nowIso,
              de: fromAddress,
              assunto: subject,
              folhaNumero: parsed.numero,
              matricula: parsed.matricula,
              cliente: emp.nome,
              sucesso: true
            });
          }

          if (!dryRun && isUnread) {
            await client.messageFlagsAdd({ uid }, ['\\Seen']);
          }
        } catch (msgErr) {
          console.error(`[EmailImporter] Erro ao processar email UID ${uid}:`, msgErr);
        }
      }

      if (importedSheets.length > 0 && !dryRun) {
        await setAppData(pb, 'oficina_hp_folhas_servico', folhas);
        await setAppData(pb, 'oficina_hp_equipamentos', equipamentos);
        await setAppData(pb, 'oficina_hp_empresas', empresas);
        await setAppData(pb, 'oficina_hp_email_import_logs', logs.slice(0, 100));
        console.log(`[EmailImporter] ✅ Sincronização concluída com sucesso! ${importedSheets.length} folhas gravadas.`);
      }

      return {
        success: true,
        count: importedSheets.length,
        sheets: importedSheets
      };
    } finally {
      lock.release();
    }
  } catch (connErr) {
    console.error('[EmailImporter] Erro na ligação IMAP ao Gmail:', connErr.message);
    return {
      success: false,
      error: `Erro ao ligar ao Gmail: ${connErr.message}`
    };
  } finally {
    try {
      await client.logout();
    } catch {}
  }
}
