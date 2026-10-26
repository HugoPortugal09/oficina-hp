import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import PocketBase from 'pocketbase';
import { getServerData, setServerData as saveToLocalServerStore } from './server-storage.mjs';

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
 * Analisa e extrai dados de folha de serviço a partir de texto (PDF ou corpo de email)
 */
export function parseServiceSheetText(rawText, filename = '') {
  const cleanText = cleanDeKerning(rawText);

  // 1. Número / Referência
  let numero = '';
  const refMatch = cleanText.match(/REFER[ÊE]NCIA:\s*([A-Z0-9_\-\/]+)/i);
  const relatorioNumMatch = cleanText.match(/N[ºo]\s*(\d{2,6})/i) || filename.match(/N[ºo]\s*(\d{2,6})/i);
  const guiaFileMatch = filename.match(/(?:GUIA|AT|OF|FS)[_\s\-]?([A-Z0-9\-]+)/i);

  if (refMatch) {
    numero = refMatch[1].trim();
  } else if (guiaFileMatch) {
    numero = guiaFileMatch[1].trim();
  } else if (relatorioNumMatch) {
    numero = 'REL-' + relatorioNumMatch[1].trim();
  }

  // 2. Data
  let dataIso = '';
  const dataMatch = cleanText.match(/DATA:\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i) ||
                    cleanText.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dataMatch) {
    const day = String(dataMatch[1]).padStart(2, '0');
    const month = String(dataMatch[2]).padStart(2, '0');
    const year = dataMatch[3];
    dataIso = `${year}-${month}-${day}`;
  } else {
    dataIso = new Date().toISOString().split('T')[0];
  }

  // 3. Cliente / Empresa
  let clienteNome = '';
  let morada = '';
  const clienteMatch = cleanText.match(/CLIENTE\s*\n+([^\n]+)/i) ||
                       cleanText.match(/Nome:\s*([^\n]+)/i);
  if (clienteMatch) {
    clienteNome = clienteMatch[1].trim();
  }
  const moradaMatch = cleanText.match(/Morada:\s*([^\n]+)/i) ||
                      cleanText.match(/CLIENTE\s*\n+[^\n]+\n+([^\n]+)/i);
  if (moradaMatch && !moradaMatch[1].includes('EQUIPAMENTO') && !moradaMatch[1].includes('Data:')) {
    morada = moradaMatch[1].trim();
  }

  // 4. Matrícula
  let matricula = '';
  const matMatch = cleanText.match(/Matr[íi]cula:\s*([A-Z0-9\-]{6,10})/i) ||
                   cleanText.match(/\b([0-9]{2}-[A-Z]{2}-[0-9]{2}|[A-Z]{2}-[0-9]{2}-[A-Z]{2}|[0-9]{2}-[0-9]{2}-[A-Z]{2}|[A-Z]{2}-[0-9]{2}-[0-9]{2})\b/i);
  if (matMatch) {
    matricula = matMatch[1].toUpperCase().trim();
  }

  // 5. Marca, Modelo & Nº de Série
  let marca = 'Goupil';
  let modelo = 'G4';
  if (/Goupil\s*G6/i.test(cleanText) || /G6/i.test(cleanText)) {
    modelo = 'G6';
  } else if (/Goupil\s*G2/i.test(cleanText) || /G2/i.test(cleanText)) {
    modelo = 'G2';
  } else if (/Goupil\s*G4/i.test(cleanText) || /G4/i.test(cleanText)) {
    modelo = 'G4';
  }

  let nSerie = '';
  const serieMatch = cleanText.match(/N[ºo]\s*(?:de\s*)?S[ée]rie:\s*([A-Z0-9\-]+)/i);
  if (serieMatch) {
    nSerie = serieMatch[1].trim();
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

  // 7. Anomalias & Observações
  let anomalias = '';
  const anomMatch = cleanText.match(/ANOMALIAS\s*[\/&]\s*OBSERVA[ÇC][ÕO]ES\s*T[ÉE]CNICAS\s*\n+([\s\S]*?)(?=SERVI[ÇC]OS|PE[ÇC]AS|Servi[çc]o|$)/i);
  if (anomMatch) {
    anomalias = anomMatch[1].trim();
  } else {
    const relTextMatch = cleanText.match(/Matr[íi]cula:[^\n]+\n+([\s\S]*?)(?=Cumprimentos|Best Regards|Servi[çc]o|$)/i);
    if (relTextMatch) {
      anomalias = relTextMatch[1].trim();
    }
  }

  // 8. Serviços executados
  const servicos = [];
  const servMatch = cleanText.match(/SERVI[ÇC]OS\s*\n+([\s\S]*?)(?=PE[ÇC]AS|Servi[çc]o|$)/i);
  if (servMatch) {
    const sLines = servMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (const sl of sLines) {
      if (sl.includes('[x]') || sl.includes('[X]')) {
        const desc = sl.replace(/\[\s*x?\s*\]/gi, '').trim();
        if (desc) {
          servicos.push({
            id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            descricao: desc,
            horas: 0,
            concluido: true,
            dataConclusao: dataIso
          });
        }
      }
    }
  }

  // 9. Peças & Materiais
  const pecas = [];
  const pecasMatch = cleanText.match(/PE[ÇC]AS\s*E\s*MATERIAIS\s*\n+([\s\S]*?)(?=Servi[çc]o\s*realizado|HPerformance|$)/i);
  if (pecasMatch) {
    const pLines = pecasMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
    for (let rawLine of pLines) {
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

  // 10. Técnico
  let tecnico = '';
  const tecMatch = cleanText.match(/Servi[çc]o\s*realizado\s*por:\s*([^\n\r]+)/i) ||
                   cleanText.match(/([A-ZÀ-ÿa-z\s]+)\s*-\s*T[ée]cnico/i);
  if (tecMatch) {
    tecnico = tecMatch[1].trim();
  }

  // Tipo de Serviço
  let tipo = 'Assistência Técnica';
  if (/^OF/i.test(numero) || /Oficina/i.test(cleanText)) {
    tipo = 'Oficina';
  } else if (/Contrato/i.test(cleanText) || /^CT/i.test(numero)) {
    tipo = 'Contrato';
  }

  return {
    numero: numero || (`IMP-${Date.now().toString().slice(-6)}`),
    data: dataIso,
    tipo,
    clienteNome: clienteNome || 'Cliente Não Identificado',
    morada: morada || '',
    matricula: matricula || 'SEM-MATRICULA',
    marca,
    modelo,
    nSerie,
    kms,
    horas,
    anomalias,
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
    console.warn(`[EmailImporter] Aviso ao gravar key="${key}" no PocketBase:`, err.message);
    return true;
  }
}

/**
 * Monitoriza a caixa de correio do Gmail via IMAP e importa novas folhas de serviço
 */
export async function checkAndImportEmails({ dryRun = false } = {}) {
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
      // Procurar mensagens não lidas
      const unreadList = await client.search({ seen: false });
      if (!unreadList || unreadList.length === 0) {
        return {
          success: true,
          count: 0,
          message: 'Nenhum email novo por processar na caixa de entrada.'
        };
      }

      console.log(`[EmailImporter] 📬 Encontrados ${unreadList.length} emails não lidos. A analisar...`);

      // Inicializar PocketBase
      const pb = new PocketBase(POCKETBASE_URL);
      pb.autoCancellation(false);

      let empresas = await getAppData(pb, 'oficina_hp_empresas', []);
      let equipamentos = await getAppData(pb, 'oficina_hp_equipamentos', []);
      let folhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
      let logs = await getAppData(pb, 'oficina_hp_email_import_logs', []);

      const { PDFParse } = await import('pdf-parse');

      for (const uid of unreadList) {
        try {
          const message = await client.fetchOne(uid, { source: true, flags: true, envelope: true });
          if (!message || !message.source) continue;

          const parsedMail = await simpleParser(message.source);
          const subject = parsedMail.subject || '';
          const fromAddress = parsedMail.from?.text || 'Desconhecido';
          const mailDate = parsedMail.date ? parsedMail.date.toISOString() : new Date().toISOString();

          console.log(`[EmailImporter] ✉️ A analisar email UID ${uid} | De: ${fromAddress} | Assunto: ${subject}`);

          const candidateTexts = [];

          // 1. Extrair de anexos PDF
          if (parsedMail.attachments && parsedMail.attachments.length > 0) {
            for (const att of parsedMail.attachments) {
              if (att.contentType === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')) {
                try {
                  const pdfParser = new PDFParse({ data: att.content });
                  const { text } = await pdfParser.getText();
                  if (text && text.trim().length > 50) {
                    candidateTexts.push({ text, filename: att.filename });
                  }
                } catch (pdfErr) {
                  console.warn(`[EmailImporter] Erro ao ler PDF anexo ${att.filename}:`, pdfErr.message);
                }
              }
            }
          }

          // 2. Se não houver PDFs válidos, tentar o corpo do email se relevante
          if (candidateTexts.length === 0) {
            const body = parsedMail.text || parsedMail.html || '';
            const isRelevant = /folha|serviço|guia|relatório|matrícula|reparação|revisão|at26|of26/i.test(`${subject} ${body}`);
            if (isRelevant && body.length > 50) {
              candidateTexts.push({ text: body, filename: subject });
            }
          }

          // Processar cada candidato encontrado
          for (const cand of candidateTexts) {
            const parsed = parseServiceSheetText(cand.text, cand.filename);

            // Validar se tem dados mínimos suficientes
            if (!parsed.matricula && !parsed.numero && parsed.clienteNome === 'Cliente Não Identificado') {
              console.log(`[EmailImporter] Conteúdo do email/anexo não corresponde a uma folha de serviço válida. A ignorar.`);
              continue;
            }

            // 1. Resolver Empresa
            let emp = empresas.find(e =>
              e.nome.toLowerCase().includes(parsed.clienteNome.toLowerCase()) ||
              parsed.clienteNome.toLowerCase().includes(e.nome.toLowerCase())
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

            // 2. Resolver Equipamento
            let eq = equipamentos.find(e =>
              e.matricula.replace(/[^A-Z0-9]/gi, '').toUpperCase() ===
              parsed.matricula.replace(/[^A-Z0-9]/gi, '').toUpperCase()
            );

            if (eq) {
              // Atualizar KMs e Horas se maiores
              if (parsed.kms > (eq.kmsAtuais || 0)) eq.kmsAtuais = parsed.kms;
              if (parsed.horas > (eq.horasAtuais || 0)) eq.horasAtuais = parsed.horas;
              if (parsed.nSerie && !eq.nSerie) eq.nSerie = parsed.nSerie;
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

            // 3. Verificar se folha já existe
            const existingIdx = folhas.findIndex(f => f.numero.toUpperCase() === parsed.numero.toUpperCase());

            const folhaData = {
              id: existingIdx >= 0 ? folhas[existingIdx].id : `fs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              numero: parsed.numero,
              tipo: parsed.tipo,
              data: parsed.data,
              dataAbertura: parsed.data,
              dataConclusao: parsed.data,
              status: 'Concluído',
              empresaId: emp.id,
              equipamentoId: eq?.id || '',
              matricula: parsed.matricula,
              marca: parsed.marca,
              modelo: parsed.modelo,
              nSerie: parsed.nSerie,
              kmsAtuais: parsed.kms,
              horasAtuais: parsed.horas,
              localizacao: parsed.morada || emp.moradaSede || '',
              localizacaoTipo: 'sede',
              distanciaKms: 0,
              anomalias: parsed.anomalias,
              servicos: parsed.servicos,
              servicosAdicionais: [],
              pecas: parsed.pecas,
              pecasAdicionais: [],
              mensagens: [],
              fotos: [],
              fotosCliente: [],
              notasCliente: '',
              notasInternas: `Importada automaticamente via email (${fromAddress}) a partir do programa antigo. Técnico: ${parsed.tecnico || 'N/A'}.`,
              previsaoRevisaoKms: (parsed.kms || 0) + 5000,
              previsaoRevisaoHoras: (parsed.horas || 0) + 250,
              tecnicoPlaneado: parsed.tecnico || undefined,
              faturacao: 'Pendente',
              criadoPor: `Robô Email (${fromAddress})`,
              criadoEm: mailDate,
              atualizadoEm: new Date().toISOString()
            };

            if (existingIdx >= 0) {
              folhas[existingIdx] = { ...folhas[existingIdx], ...folhaData };
              console.log(`[EmailImporter] 🔄 Folha ${parsed.numero} atualizada com dados do email.`);
            } else {
              folhas.unshift(folhaData);
              console.log(`[EmailImporter] 📄 Nova Folha de Serviço criada: ${parsed.numero} (${parsed.matricula} - ${emp.nome})`);
            }

            importedSheets.push({
              numero: parsed.numero,
              matricula: parsed.matricula,
              cliente: emp.nome,
              data: parsed.data,
              pecasCount: parsed.pecas.length,
              subject
            });

            // Adicionar ao log
            logs.unshift({
              id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toISOString(),
              de: fromAddress,
              assunto: subject,
              folhaNumero: parsed.numero,
              matricula: parsed.matricula,
              cliente: emp.nome,
              sucesso: true
            });
          }

          // Marcar o email como lido no Gmail
          if (!dryRun) {
            await client.messageFlagsAdd({ uid }, ['\\Seen']);
          }
        } catch (msgErr) {
          console.error(`[EmailImporter] Erro ao processar email UID ${uid}:`, msgErr);
        }
      }

      // Guardar tudo no armazenamento do servidor e PocketBase
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
