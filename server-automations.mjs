import PocketBase from 'pocketbase';
import { jsPDF } from 'jspdf';
import autoTablePkg from 'jspdf-autotable';

// Apply autotable plugin to jsPDF in Node.js
if (autoTablePkg) {
  if (typeof autoTablePkg.default?.applyPlugin === 'function') {
    autoTablePkg.default.applyPlugin(jsPDF);
  } else if (typeof autoTablePkg.applyPlugin === 'function') {
    autoTablePkg.applyPlugin(jsPDF);
  }
}

const POCKETBASE_URL = process.env.POCKETBASE_URL || 'https://oficina-hp-pocketbase.l1mamt.easypanel.host';
const TIMEZONE = 'Europe/Lisbon';

let isChecking = false;

/**
 * Gets current Lisbon time details
 */
export function getLisbonTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const getPart = (type) => parts.find(p => p.type === type)?.value || '';

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const weekdayStr = getPart('weekday').toLowerCase(); // 'mon', 'tue', etc.

  // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const weekdayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 1;

  const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const totalMinutes = hour * 60 + minute;

  // Calculate ISO week
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    totalMinutes,
    dayOfWeek,
    dateIso,
    weekKey,
    timeStr: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  };
}

/**
 * Reads a collection from PocketBase app_data
 */
async function getAppData(pb, key, fallback = []) {
  try {
    const record = await pb.collection('app_data').getFirstListItem(`key="${key}"`);
    return record?.data || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Saves a key-value record in PocketBase app_data
 */
async function setAppData(pb, key, data) {
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
  } catch (err) {
    console.warn(`[ServerAutomation] Aviso ao gravar chave '${key}':`, err.message);
  }
}

/**
 * Normalizes any date string (ISO YYYY-MM-DD or DD/MM/YYYY) to YYYY-MM-DD
 */
function normalizeToIso(d) {
  if (!d) return '';
  const str = String(d).trim();
  if (!str) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, day] = ymdMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const [, day, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return str.slice(0, 10);
}

/**
 * Generates Weekly Planeamento PDF A4 Landscape in Node
 */
function generateServerPlaneamentoPDF({ days, startDateStr, endDateStr, totalFolhas, totalVisitas }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  // Top header bars
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 297, 5, 'F');
  doc.setFillColor(2, 132, 199); // Sky blue
  doc.rect(197, 0, 100, 5, 'F');

  // Title
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GRAUMP • MAPA SEMANAL DE PLANEAMENTO & VISITAS', 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Semana de ${startDateStr} a ${endDateStr} • Total: ${totalFolhas} Serviços, ${totalVisitas} Visitas`, 14, 21);

  // Table Columns
  const tableHeaders = days.map(d => `${d.label.toUpperCase()}\n${d.formattedDate} (${d.items.length})`);
  const maxRows = Math.max(1, ...days.map(d => d.items.length));
  const tableBody = [];

  for (let r = 0; r < maxRows; r++) {
    const row = days.map(d => {
      const item = d.items[r];
      if (!item) return '';
      const horaStr = item.hora ? `[${item.hora}] ` : '';
      const plateStr = item.matricula ? `\n🚗 ${item.matricula}` : '';
      const techStr = item.tecnico ? `\n👤 ${item.tecnico}` : '';
      const notesStr = item.notas ? `\n• ${item.notas}` : '';
      return `${horaStr}${item.numeroOuTitulo} (${item.tipoOuMotivo})\n🏢 ${item.empresa}${plateStr}${techStr}${notesStr}`;
    });
    tableBody.push(row);
  }

  const colWidth = (297 - 20) / days.length;
  const colStyles = {};
  days.forEach((_, idx) => {
    colStyles[idx] = { cellWidth: colWidth };
  });

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      head: [tableHeaders],
      body: tableBody,
      startY: 26,
      margin: { left: 10, right: 10 },
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center',
        cellPadding: 3
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        valign: 'top',
        overflow: 'linebreak'
      },
      columnStyles: colStyles
    });
  }

  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] || '';
}

/**
 * Builds HTML for Weekly Planeamento Email
 */
function buildServerPlaneamentoHtml({ startDateStr, endDateStr, days, totalFolhas, totalVisitas, pdfFilename }) {
  const daysHtml = days.map(d => {
    const rows = d.items.length > 0
      ? d.items.map(item => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 8px 10px; font-weight: bold; font-size: 12px; color: #1e293b; width: 60px;">${item.hora || '09:00'}</td>
            <td style="padding: 8px 10px; font-size: 12px; width: 110px;">
              <span style="background: #0284c7; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                ${item.tipoOuMotivo}
              </span>
              <div style="font-weight: bold; color: #0369a1; margin-top: 3px;">${item.numeroOuTitulo}</div>
            </td>
            <td style="padding: 8px 10px; font-size: 12.5px;">
              <strong>${item.empresa}</strong>
              ${item.matricula ? `<div style="font-size: 11.5px; color: #475569;">🚗 ${item.matricula}</div>` : ''}
              ${item.notas ? `<div style="font-size: 11px; color: #64748b; font-style: italic;">📝 ${item.notas}</div>` : ''}
            </td>
            <td style="padding: 8px 10px; font-size: 11.5px; text-align: right; color: #0369a1;">
              👤 ${item.tecnico || 'Hugo Portugal'}
            </td>
          </tr>
        `).join('')
      : `<tr><td colspan="4" style="padding: 10px; text-align: center; color: #94a3b8; font-size: 12px; font-style: italic;">Sem intervenções agendadas</td></tr>`;

    return `
      <div style="margin-bottom: 14px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #ffffff;">
        <div style="background: #f8fafc; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 13px; color: #0f172a;">
          📅 ${d.label} (${d.formattedDate}) • <span style="color: #059669;">${d.items.length} agendamentos</span>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          ${rows}
        </table>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Planeamento Semanal - Oficina HP</title></head>
<body style="margin:0; padding:20px; font-family:'Segoe UI', Arial, sans-serif; background-color:#f1f5f9;">
  <div style="max-width:680px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #cbd5e1;">
    <div style="background:#0f172a; padding:24px; color:#ffffff;">
      <span style="background:#059669; color:#fff; font-size:10px; font-weight:bold; padding:3px 8px; border-radius:4px; text-transform:uppercase;">
        AUTOMAÇÃO 24/7 • RELATÓRIO OFICIAL
      </span>
      <h1 style="margin:8px 0 4px 0; font-size:22px;">Planeamento Semanal de Intervenções & Visitas</h1>
      <p style="margin:0; font-size:13px; color:#94a3b8;">Semana de ${startDateStr} a ${endDateStr} • Grau Maquinaria</p>
    </div>
    <div style="padding:16px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
      <table width="100%" style="text-align:center;">
        <tr>
          <td width="50%">
            <div style="font-size:24px; font-weight:bold; color:#0284c7;">${totalFolhas}</div>
            <div style="font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Serviços Agendados</div>
          </td>
          <td width="50%">
            <div style="font-size:24px; font-weight:bold; color:#059669;">${totalVisitas}</div>
            <div style="font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Visitas a Clientes</div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:12px 24px; background:#ecfdf5; border-bottom:1px solid #a7f3d0; color:#065f46; font-size:12.5px;">
      📎 <strong>PDF A4 Paisagem Anexado:</strong> ${pdfFilename} pronto para impressão e afixação.
    </div>
    <div style="padding:20px 24px;">
      <h3 style="margin:0 0 12px 0; font-size:15px; color:#0f172a;">Agenda Detalhada por Dia</h3>
      ${daysHtml}
    </div>
    <div style="background:#f8fafc; padding:14px; text-align:center; font-size:11px; color:#64748b; border-top:1px solid #e2e8f0;">
      Oficina HP • Grau Maquinaria • Disparado automaticamente pelo servidor às 07:30
    </div>
  </div>
</body>
</html>`;
}

/**
 * Formata data para formato português DD/MM/AAAA
 */
function formatPtDate(d) {
  if (!d) return '-';
  const iso = normalizeToIso(d);
  if (!iso || iso.length < 10) return String(d);
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function calculateDiffDays(startDateStr, endDateStr) {
  if (!startDateStr) return { days: 0, text: '-' };
  const isoStart = normalizeToIso(startDateStr);
  if (!isoStart) return { days: 0, text: '-' };
  const start = new Date(isoStart + 'T00:00:00');
  const end = endDateStr ? new Date(normalizeToIso(endDateStr) + 'T00:00:00') : new Date();
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  return {
    days: diffDays,
    text: `${diffDays} dia${diffDays === 1 ? '' : 's'}`
  };
}

function isOpenService(f) {
  if (!f) return false;
  const st = String(f.status || '').toUpperCase();
  if (st.includes('CONCLUÍDO') || st.includes('CONCLUIDO') || st.includes('FINALIZADO') || st.startsWith('FEITO') || st === 'FEITO') {
    return false;
  }
  if (f.dataConclusao) return false;
  return true;
}

function isOficinaOrGraump(f) {
  if (!f) return false;
  if (f.localizacaoTipo === 'oficina') return true;
  if (f.tipo === 'Oficina') return true;
  if (typeof f.status === 'string' && f.status.startsWith('OF -')) return true;
  const loc = (f.localizacao || '').toLowerCase();
  if (loc.includes('oficina') || loc.includes('graump')) return true;
  return false;
}

function isExteriorService(f) {
  return !isOficinaOrGraump(f);
}

/**
 * Gera PDF A3 Paisagem com tabela detalhada de Tempos de Resposta no Node.js
 */
function generateServerTemposA3PDF({ rawFolhas, empresas, scope, dateStr }) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true
  });

  // Filtrar apenas serviços em aberto
  let filtered = rawFolhas.filter(f => isOpenService(f));

  let docTitle = 'QUADRO GERAL DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO';
  let scopeSubtitle = 'Relatório global diário com todos os serviços em curso (Oficina e Exterior) (Apenas em Aberto)';
  let scopeBadge = 'ÂMBITO: GERAL (APENAS EM ABERTO)';
  let accentColor = [13, 148, 136]; // Teal

  if (scope === 'OFICINA') {
    filtered = filtered.filter(f => isOficinaOrGraump(f));
    docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — OFICINA (GRAUMP)';
    scopeSubtitle = 'Acompanhamento diário de viaturas na oficina e serviços sediados na GRAUMP (Apenas em Aberto)';
    scopeBadge = 'ÂMBITO: OFICINA (GRAUMP) • APENAS EM ABERTO';
    accentColor = [234, 88, 12]; // Laranja
  } else if (scope === 'EXTERIOR') {
    filtered = filtered.filter(f => isExteriorService(f));
    docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — EXTERIOR';
    scopeSubtitle = 'Acompanhamento diário de intervenções no terreno, assistências e contratos fora da GRAUMP (Apenas em Aberto)';
    scopeBadge = 'ÂMBITO: EXTERIOR (FORA DA GRAUMP) • APENAS EM ABERTO';
    accentColor = [2, 132, 199]; // Azul Céu
  }

  const rows = filtered.map(f => {
    const emp = empresas.find(e => e.id === f.empresaId);
    const startDateImob = f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined);
    const imob = calculateDiffDays(startDateImob);
    const diasReq = calculateDiffDays(f.dataRequisicao);
    const isCritico = (imob.days >= 10) || (diasReq.days >= 10);
    return {
      folha: f,
      empresaNome: emp?.nome || 'Cliente / Não especificado',
      imob,
      diasReq,
      isCritico
    };
  }).sort((a, b) => {
    if (a.isCritico !== b.isCritico) return a.isCritico ? -1 : 1;
    if (b.imob.days !== a.imob.days) return b.imob.days - a.imob.days;
    return new Date(b.folha.data).getTime() - new Date(a.folha.data).getTime();
  });

  // Barra superior decorativa (420mm de largura A3)
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 420, 6, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(290, 0, 130, 6, 'F');

  // Cabeçalho e Título
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('GRAUMP', 14, 20);

  doc.setFontSize(14);
  doc.text(docTitle, 406, 17, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(scopeSubtitle, 406, 23, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`${scopeBadge}  •  TOTAL REGISTOS: ${rows.length}  •  EMISSÃO: ${dateStr}`, 406, 29, { align: 'right' });

  // Corpo da Tabela
  const tableData = rows.map(r => {
    const f = r.folha;
    const marcaMod = `${f.marca || ''} ${f.modelo || ''}`.trim() || '-';
    const locTag = f.localizacao
      ? `\n📍 ${f.localizacao}`
      : (isOficinaOrGraump(f) ? '\n📍 GRAUMP (Albergaria)' : '');
    const cliCell = `${r.empresaNome}${locTag}`;
    const obs = (f.anomalias || f.notasInternas || f.descricaoTrabalho || '-').replace(/\n/g, ' ');

    return [
      f.numero || f.id,
      f.tipo || 'Oficina',
      f.matricula || '---',
      marcaMod,
      cliCell,
      formatPtDate(f.data),
      f.dataRequisicao ? formatPtDate(f.dataRequisicao) : '-',
      r.diasReq.days > 0 ? r.diasReq.text : '-',
      formatPtDate(f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined)),
      'Em Aberto',
      r.imob.days > 0 ? r.imob.text : '-',
      f.status || 'Pendente',
      obs
    ];
  });

  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      startY: 34,
      head: [[
        'Folha',
        'Tipo',
        'Matrícula',
        'Marca / Modelo',
        'Cliente / Localização',
        'Criação',
        'Data Req.',
        'Dias Req.',
        'Entrada Of.',
        'Conclusão',
        'Imobilização',
        'Estado Atual',
        'Observações / Trabalhos'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 3
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold', textColor: [2, 132, 199] },
        1: { cellWidth: 28, fontStyle: 'bold' },
        2: { cellWidth: 22, fontStyle: 'bold' },
        3: { cellWidth: 32 },
        4: { cellWidth: 54 },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        8: { cellWidth: 18, halign: 'center' },
        9: { cellWidth: 20, halign: 'center' },
        10: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        11: { cellWidth: 46 },
        12: { cellWidth: 76 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const rowData = rows[data.row.index];
          if (rowData && rowData.isCritico) {
            if (data.column.index === 10 || data.column.index === 7) {
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [255, 241, 242];
            }
          }
          if (data.column.index === 9 && data.cell.raw === 'Em Aberto') {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
  }

  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] || '';
}

/**
 * Calcula os KPIs executivos para o email de Tempos de Resposta
 */
function calculateServerTemposStats(rawFolhas, empresas) {
  const openFolhas = rawFolhas.filter(f => isOpenService(f));

  let totalImobOficinaDays = 0;
  let countOficinaImob = 0;
  let totalDiasReq = 0;
  let countReq = 0;
  let criticalCount = 0;
  const criticalRows = [];

  openFolhas.forEach(f => {
    const emp = empresas.find(e => e.id === f.empresaId);
    const startDateImob = f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined);
    const imob = calculateDiffDays(startDateImob);
    const diasReq = calculateDiffDays(f.dataRequisicao);
    const isCritico = (imob.days >= 10) || (diasReq.days >= 10);

    if (isOficinaOrGraump(f) && imob.days > 0) {
      totalImobOficinaDays += imob.days;
      countOficinaImob++;
    }

    if (f.dataRequisicao && diasReq.days > 0) {
      totalDiasReq += diasReq.days;
      countReq++;
    }

    if (isCritico) {
      criticalCount++;
      criticalRows.push({
        numero: f.numero || f.id,
        matricula: f.matricula || '---',
        cliente: emp?.nome || 'Cliente',
        dias: Math.max(imob.days, diasReq.days),
        status: f.status || 'Em Aberto'
      });
    }
  });

  const avgImobilizacaoOficina = countOficinaImob > 0 ? (totalImobOficinaDays / countOficinaImob) : 0;
  const avgDiasReq = countReq > 0 ? (totalDiasReq / countReq) : 0;
  const totalOficinaAbertas = openFolhas.filter(f => isOficinaOrGraump(f)).length;
  const totalExteriorAbertas = openFolhas.filter(f => isExteriorService(f)).length;

  return {
    totalAbertas: openFolhas.length,
    totalOficinaAbertas,
    totalExteriorAbertas,
    avgImobilizacaoOficina,
    avgDiasReq,
    criticalCount,
    criticalRows: criticalRows.slice(0, 10)
  };
}

/**
 * Constrói o HTML executivo oficial do email de Tempos de Resposta
 */
function buildServerTemposRespostaHtml({ stats, dateStr }) {
  const criticalTableRows = stats.criticalRows.map(r => `
    <tr style="border-bottom: 1px solid #fee2e2;">
      <td style="padding: 7px 8px; font-weight: 700; color: #0284c7; border: 1px solid #fca5a5;">${r.numero}</td>
      <td style="padding: 7px 8px; font-weight: 700; color: #0f172a; border: 1px solid #fca5a5;">${r.matricula}</td>
      <td style="padding: 7px 8px; color: #334155; border: 1px solid #fca5a5;">${r.cliente}</td>
      <td style="padding: 7px 8px; font-weight: 800; color: #be123c; text-align: center; border: 1px solid #fca5a5;">${r.dias} dias</td>
      <td style="padding: 7px 8px; color: #d97706; font-weight: 600; border: 1px solid #fca5a5;">${r.status}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quadro Diário de Tempos de Resposta &amp; Imobilização - GRAUMP</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#0b1528" style="background-color: #0b1528; padding: 24px 28px; border-bottom: 4px solid #0d9488;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #2dd4bf; font-family: 'Segoe UI', Arial, sans-serif;">
                    GRAUMP &bull; OFICINA HP &bull; FROTAS
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #0d9488; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; display: inline-block;">
                      DISPARO DIÁRIO DAS 06H00
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: 'Segoe UI', Arial, sans-serif;">
                      Quadro Diário de Tempos de Resposta &amp; Imobilização
                    </h1>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif;">
                      Relatório de controlo operacional emitido a <strong>${dateStr}</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 24px 28px;">
              
              <!-- Section Title -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 16px; font-weight: 800; border-bottom: 2px solid #0d9488; padding-bottom: 6px;">
                📊 Resumo Executivo &amp; Médias Operacionais
              </h2>

              <!-- 4 KPI Cards Grid -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
                <tr>
                  <!-- Card 1: Imobilização Média -->
                  <td width="48%" valign="top" bgcolor="#fff7ed" style="background-color: #fff7ed; border: 1px solid #fdba74; border-left: 5px solid #ea580c; border-radius: 8px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; color: #9a3412; text-transform: uppercase; margin-bottom: 4px;">
                      ⏱️ Imobilização Média (Oficina)
                    </div>
                    <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #c2410c;">
                      ${stats.avgImobilizacaoOficina.toFixed(1)} <span style="font-size: 13px; font-weight: 700; color: #9a3412;">dias</span>
                    </div>
                    <div style="font-size: 11.5px; color: #9a3412; font-weight: 600; margin-top: 2px;">
                      Média desde a entrada na oficina
                    </div>
                  </td>

                  <td width="4%">&nbsp;</td>

                  <!-- Card 2: Média Requisição -->
                  <td width="48%" valign="top" bgcolor="#f0f9ff" style="background-color: #f0f9ff; border: 1px solid #7dd3fc; border-left: 5px solid #0284c7; border-radius: 8px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; color: #075985; text-transform: uppercase; margin-bottom: 4px;">
                      📅 Média desde Requisição
                    </div>
                    <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0284c7;">
                      ${stats.avgDiasReq.toFixed(1)} <span style="font-size: 13px; font-weight: 700; color: #0369a1;">dias</span>
                    </div>
                    <div style="font-size: 11.5px; color: #075985; font-weight: 600; margin-top: 2px;">
                      Para serviços com requisição
                    </div>
                  </td>
                </tr>

                <tr><td colspan="3" style="height: 10px; font-size: 10px; line-height: 10px;">&nbsp;</td></tr>

                <tr>
                  <!-- Card 3: Viaturas Críticas -->
                  <td width="48%" valign="top" bgcolor="#fef2f2" style="background-color: #fef2f2; border: 1px solid #fca5a5; border-left: 5px solid #e11d48; border-radius: 8px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; color: #9f1239; text-transform: uppercase; margin-bottom: 4px;">
                      🚨 Viaturas Críticas (&ge; 10 dias)
                    </div>
                    <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #be123c;">
                      ${stats.criticalCount} <span style="font-size: 13px; font-weight: 700; color: #9f1239;">viaturas</span>
                    </div>
                    <div style="font-size: 11.5px; color: #9f1239; font-weight: 600; margin-top: 2px;">
                      Imobilização ou requisição &ge; 10 dias
                    </div>
                  </td>

                  <td width="4%">&nbsp;</td>

                  <!-- Card 4: Serviços em Aberto -->
                  <td width="48%" valign="top" bgcolor="#f0fdfa" style="background-color: #f0fdfa; border: 1px solid #5eead4; border-left: 5px solid #0d9488; border-radius: 8px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; color: #115e59; text-transform: uppercase; margin-bottom: 4px;">
                      🔧 Serviços em Aberto
                    </div>
                    <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0f766e;">
                      ${stats.totalAbertas} <span style="font-size: 13px; font-weight: 700; color: #134e4a;">em curso</span>
                    </div>
                    <div style="font-size: 11.5px; color: #115e59; font-weight: 600; margin-top: 2px;">
                      Oficina GRAUMP (${stats.totalOficinaAbertas}) &bull; Exterior (${stats.totalExteriorAbertas})
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Attachments Notice Banner -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0d9488; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
                      📎 3 Documentos Oficiais em PDF Formato A3 Anexados a este Email:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #0f172a;">
                      <li style="margin-bottom: 4px;"><strong>1. Tempos_Resposta_Oficina.pdf</strong> — Quadro de acompanhamento de viaturas na oficina e serviços sediados na GRAUMP (apenas em aberto).</li>
                      <li style="margin-bottom: 4px;"><strong>2. Tempos_Resposta_Exterior.pdf</strong> — Quadro Exterior com todas as intervenções no terreno e fora das instalações da GRAUMP (apenas em aberto).</li>
                      <li style="margin-bottom: 0;"><strong>3. Tempos_Resposta_Geral_Completo.pdf</strong> — Quadro Geral completo com todos os serviços em aberto.</li>
                    </ul>
                    <div style="margin-top: 8px; font-size: 11.5px; color: #475569; font-style: italic;">
                      * Nota: Ficheiros em formato A3 horizontal para consulta detalhada ou impressão.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Critical Vehicles Mini Table (If any) -->
              ${stats.criticalCount > 0 ? `
              <div style="margin-top: 20px;">
                <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #9f1239; margin-top: 0; margin-bottom: 10px; font-weight: 800; border-bottom: 2px solid #e11d48; padding-bottom: 6px;">
                  ⚠️ Viaturas e Serviços Críticos em Atenção Imediata (${stats.criticalCount})
                </h3>
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12px; background-color: #ffffff; border: 1px solid #fca5a5; border-collapse: collapse;">
                  <thead>
                    <tr bgcolor="#fee2e2" style="background-color: #fee2e2; text-align: left; color: #991b1b;">
                      <th style="padding: 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #fca5a5;">Folha</th>
                      <th style="padding: 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #fca5a5;">Matrícula</th>
                      <th style="padding: 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #fca5a5;">Cliente</th>
                      <th style="padding: 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #fca5a5;">Dias</th>
                      <th style="padding: 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #fca5a5;">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${criticalTableRows}
                  </tbody>
                </table>
              </div>
              ` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 4px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
              <p style="margin: 0; color: #475569;">Disparo automático diário às 06:00 (Dias de semana) &bull; Servidor 24/7</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Main Check & Execution Function for All Automations
 */
export async function runServerAutomations(sendEmailFn, forced = false) {
  if (isChecking) return { status: 'already_running' };
  isChecking = true;

  const results = [];
  const lisbon = getLisbonTime();

  try {
    const pb = new PocketBase(POCKETBASE_URL);
    pb.autoCancellation(false);

    const automacoes = await getAppData(pb, 'oficina_hp_automacoes', []);
    if (!automacoes || automacoes.length === 0) {
      return { status: 'no_automations_found' };
    }

    console.log(`[ServerCron] ⏰ Verificação de automações: ${lisbon.timeStr} (${lisbon.dateIso}, Dia ${lisbon.dayOfWeek})`);

    for (let i = 0; i < automacoes.length; i++) {
      const auto = automacoes[i];
      if (!auto.ativo && !forced) continue;

      // -------------------------------------------------------------
      // 1. EMAIL PLANEAMENTO SEMANAL (Segundas-feiras às 07:30)
      // -------------------------------------------------------------
      if (auto.tipo === 'email_planeamento') {
        const isMonday = lisbon.dayOfWeek === 1;
        const isPast730 = lisbon.totalMinutes >= (7 * 60 + 30); // 07:30
        const lastSentWeek = await getAppData(pb, `auto_last_week_${auto.id}`, null);

        const shouldRun = forced || (isMonday && isPast730 && lastSentWeek !== lisbon.weekKey);

        if (shouldRun) {
          console.log(`[ServerCron] 🚀 A executar 'email_planeamento' para a semana ${lisbon.weekKey}...`);
          try {
            const rawFolhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
            const rawVisitas = await getAppData(pb, 'oficina_hp_visitas', []);
            const empresas = await getAppData(pb, 'oficina_hp_empresas', []);

            // Calculate active week (Monday to Sunday)
            const mondayDate = new Date(lisbon.year, lisbon.month - 1, lisbon.day - (lisbon.dayOfWeek === 0 ? 6 : lisbon.dayOfWeek - 1));
            
            const weekDays = [0, 1, 2, 3, 4, 5, 6].map(offset => {
              const d = new Date(mondayDate);
              d.setDate(d.getDate() + offset);
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const labels = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
              return {
                index: offset,
                label: labels[offset],
                isoStr: iso,
                formattedDate: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
              };
            });

            // Filter items
            const weekIsoSet = new Set(weekDays.map(w => w.isoStr));
            const weekFolhas = rawFolhas.filter(f => weekIsoSet.has(normalizeToIso(f.dataPlaneada || f.data)));
            const weekVisitas = rawVisitas.filter(v => weekIsoSet.has(normalizeToIso(v.data)));

            const hasSab = weekFolhas.some(f => normalizeToIso(f.dataPlaneada || f.data) === weekDays[5].isoStr) ||
                           weekVisitas.some(v => normalizeToIso(v.data) === weekDays[5].isoStr);
            const hasDom = weekFolhas.some(f => normalizeToIso(f.dataPlaneada || f.data) === weekDays[6].isoStr) ||
                           weekVisitas.some(v => normalizeToIso(v.data) === weekDays[6].isoStr);

            const activeDays = weekDays.filter(d => {
              if (d.index <= 4) return true;
              if (d.index === 5) return hasSab;
              if (d.index === 6) return hasDom;
              return false;
            });

            const dayCols = activeDays.map(d => {
              const dayFolhas = weekFolhas.filter(f => normalizeToIso(f.dataPlaneada || f.data) === d.isoStr);
              const dayVisitas = weekVisitas.filter(v => normalizeToIso(v.data) === d.isoStr);

              const items = [
                ...dayFolhas.map(f => {
                  const emp = empresas.find(e => e.id === f.empresaId);
                  return {
                    hora: f.horaPlaneada || '09:00',
                    numeroOuTitulo: f.numero,
                    tipoOuMotivo: f.tipo || 'Oficina',
                    empresa: emp?.nome || 'Cliente Geral',
                    matricula: f.matricula || '',
                    tecnico: f.tecnicoPlaneado || 'Hugo Portugal',
                    notas: f.anomalias || ''
                  };
                }),
                ...dayVisitas.map(v => ({
                  hora: v.hora || '09:30',
                  numeroOuTitulo: 'VISITA',
                  tipoOuMotivo: v.motivo || 'No Terreno',
                  empresa: v.nomeEmpresa || 'Cliente',
                  matricula: '',
                  tecnico: v.tecnico || 'Hugo Portugal',
                  notas: v.notas || ''
                }))
              ];

              return { ...d, items };
            });

            const startDateStr = weekDays[0].formattedDate + `/${lisbon.year}`;
            const endDateStr = activeDays[activeDays.length - 1].formattedDate + `/${lisbon.year}`;
            const pdfFilename = `Planeamento_Semanal_${weekDays[0].isoStr}_a_${activeDays[activeDays.length - 1].isoStr}.pdf`;

            const pdfBase64 = generateServerPlaneamentoPDF({
              days: dayCols,
              startDateStr,
              endDateStr,
              totalFolhas: weekFolhas.length,
              totalVisitas: weekVisitas.length
            });

            const htmlContent = buildServerPlaneamentoHtml({
              startDateStr,
              endDateStr,
              days: dayCols,
              totalFolhas: weekFolhas.length,
              totalVisitas: weekVisitas.length,
              pdfFilename
            });

            const recipients = auto.destinatarios && auto.destinatarios.length > 0
              ? auto.destinatarios
              : ['hugo@grau-maquinaria.com'];

            await sendEmailFn({
              to: recipients,
              subject: `[Oficina HP] 📅 Planeamento Semanal (${startDateStr} a ${endDateStr})`,
              html: htmlContent,
              attachments: [
                {
                  filename: pdfFilename,
                  content: pdfBase64,
                  encoding: 'base64',
                  contentType: 'application/pdf'
                }
              ]
            });

            // Mark week as sent
            await setAppData(pb, `auto_last_week_${auto.id}`, lisbon.weekKey);
            await setAppData(pb, `oficina_hp_last_run_week_${auto.id}`, lisbon.weekKey);

            // Update automacoes list
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);

            console.log(`[ServerCron] ✅ Planeamento semanal enviado para: ${recipients.join(', ')}`);
            results.push({ id: auto.id, tipo: auto.tipo, success: true });
          } catch (err) {
            console.error(`[ServerCron] ❌ Erro ao enviar planeamento semanal:`, err);
            results.push({ id: auto.id, tipo: auto.tipo, success: false, error: err.message });
          }
        }
      }

      // -------------------------------------------------------------
      // 2. EMAIL TEMPOS DE RESPOSTA (Dias de semana às 06:00)
      // -------------------------------------------------------------
      if (auto.tipo === 'email_tempos_resposta') {
        const isWeekday = lisbon.dayOfWeek >= 1 && lisbon.dayOfWeek <= 5;
        const isPast600 = lisbon.totalMinutes >= (6 * 60); // 06:00
        const lastSentDay = await getAppData(pb, `auto_last_day_${auto.id}`, null);

        const shouldRun = forced || (isWeekday && isPast600 && lastSentDay !== lisbon.dateIso);

        if (shouldRun) {
          console.log(`[ServerCron] 🚀 A executar 'email_tempos_resposta' (3 PDFs A3) para o dia ${lisbon.dateIso}...`);
          try {
            const rawFolhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
            const empresas = await getAppData(pb, 'oficina_hp_empresas', []);

            const dateStr = `${String(lisbon.day).padStart(2, '0')}/${String(lisbon.month).padStart(2, '0')}/${lisbon.year}`;

            // 1. Gerar os 3 PDFs A3 Paisagem (Apenas em Aberto)
            const attachments = [];

            // PDF 1: Oficina (Serviços Oficina e todos com morada na GRAUMP)
            try {
              const base64Oficina = generateServerTemposA3PDF({ rawFolhas, empresas, scope: 'OFICINA', dateStr });
              if (base64Oficina) {
                attachments.push({
                  filename: 'Tempos_Resposta_Oficina.pdf',
                  content: base64Oficina,
                  encoding: 'base64',
                  contentType: 'application/pdf'
                });
              }
            } catch (errOf) {
              console.error('[ServerCron] Erro ao gerar PDF Oficina A3:', errOf);
            }

            // PDF 2: Exterior (Intervenções no terreno / fora da GRAUMP)
            try {
              const base64Exterior = generateServerTemposA3PDF({ rawFolhas, empresas, scope: 'EXTERIOR', dateStr });
              if (base64Exterior) {
                attachments.push({
                  filename: 'Tempos_Resposta_Exterior.pdf',
                  content: base64Exterior,
                  encoding: 'base64',
                  contentType: 'application/pdf'
                });
              }
            } catch (errExt) {
              console.error('[ServerCron] Erro ao gerar PDF Exterior A3:', errExt);
            }

            // PDF 3: Geral Completo (Apenas em aberto)
            try {
              const base64Geral = generateServerTemposA3PDF({ rawFolhas, empresas, scope: 'TODOS', dateStr });
              if (base64Geral) {
                attachments.push({
                  filename: 'Tempos_Resposta_Geral_Completo.pdf',
                  content: base64Geral,
                  encoding: 'base64',
                  contentType: 'application/pdf'
                });
              }
            } catch (errAll) {
              console.error('[ServerCron] Erro ao gerar PDF Geral A3:', errAll);
            }

            // 2. Calcular Estatísticas Executivas e Construir HTML
            const stats = calculateServerTemposStats(rawFolhas, empresas);
            const htmlTempos = buildServerTemposRespostaHtml({ stats, dateStr });

            const recipients = auto.destinatarios && auto.destinatarios.length > 0
              ? auto.destinatarios
              : ['hugo@grau-maquinaria.com'];

            await sendEmailFn({
              to: recipients,
              subject: `[Oficina HP] 📊 Quadro Diário de Tempos de Resposta & Imobilização (${dateStr})`,
              html: htmlTempos,
              attachments
            });

            await setAppData(pb, `auto_last_day_${auto.id}`, lisbon.dateIso);
            await setAppData(pb, `oficina_hp_last_run_day_${auto.id}`, lisbon.dateIso);
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);

            console.log(`[ServerCron] ✅ Tempos de resposta com ${attachments.length} PDFs A3 enviado para: ${recipients.join(', ')}`);
            results.push({ id: auto.id, tipo: auto.tipo, success: true, attachmentsCount: attachments.length });
          } catch (err) {
            console.error(`[ServerCron] ❌ Erro ao enviar tempos de resposta:`, err);
            results.push({ id: auto.id, tipo: auto.tipo, success: false, error: err.message });
          }
        }
      }

      // -------------------------------------------------------------
      // 3. ALERTA DE STOCK MÍNIMO (Diário às 08:00)
      // -------------------------------------------------------------
      if (auto.tipo === 'alerta_stock') {
        const isPast800 = lisbon.totalMinutes >= (8 * 60); // 08:00
        const lastSentDay = await getAppData(pb, `auto_last_day_${auto.id}`, null);

        const shouldRun = forced || (isPast800 && lastSentDay !== lisbon.dateIso);

        if (shouldRun) {
          try {
            const pecas = await getAppData(pb, 'oficina_hp_pecas_catalogo', []);
            const pecasBaixoStock = pecas.filter(p => (Number(p.stock) || 0) <= (Number(p.stockMinimo) || 0));

            if (pecasBaixoStock.length > 0) {
              console.log(`[ServerCron] ⚠️ Encontradas ${pecasBaixoStock.length} peças com stock baixo. A enviar alerta...`);

              const rows = pecasBaixoStock.map(p => `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:6px 10px; font-weight:bold;">${p.referencia || '-'}</td>
                  <td style="padding:6px 10px;">${p.designacao || p.nome}</td>
                  <td style="padding:6px 10px; color:#dc2626; font-weight:bold;">${p.stock}</td>
                  <td style="padding:6px 10px;">${p.stockMinimo}</td>
                </tr>
              `).join('');

              const htmlStock = `
                <div style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f8fafc;">
                  <div style="max-width:600px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:20px;">
                    <h2 style="color:#dc2626; margin-top:0;">⚠️ Alerta de Stock Mínimo / Ruptura</h2>
                    <p>Existem <strong>${pecasBaixoStock.length} artigos</strong> do catálogo que atingiram ou estão abaixo do stock mínimo de segurança:</p>
                    <table width="100%" style="border-collapse:collapse; font-size:12.5px;">
                      <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                          <th style="padding:6px 10px;">Ref</th>
                          <th style="padding:6px 10px;">Artigo</th>
                          <th style="padding:6px 10px;">Stock Atual</th>
                          <th style="padding:6px 10px;">Mínimo</th>
                        </tr>
                      </thead>
                      <tbody>${rows}</tbody>
                    </table>
                  </div>
                </div>
              `;

              await sendEmailFn({
                to: auto.destinatarios || ['hugo@grau-maquinaria.com'],
                subject: `[Oficina HP] ⚠️ Alerta de Ruptura / Stock Mínimo (${pecasBaixoStock.length} artigos)`,
                html: htmlStock
              });
            }

            await setAppData(pb, `auto_last_day_${auto.id}`, lisbon.dateIso);
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);
            results.push({ id: auto.id, tipo: auto.tipo, success: true });
          } catch (err) {
            results.push({ id: auto.id, tipo: auto.tipo, success: false, error: err.message });
          }
        }
      }

      // -------------------------------------------------------------
      // 4. ATIVIDADE SEMANAL & PRODUÇÃO (Domingos às 09:00)
      // -------------------------------------------------------------
      if (auto.tipo === 'email_atividade_semanal') {
        const isSunday = lisbon.dayOfWeek === 0;
        const isPast900 = lisbon.totalMinutes >= (9 * 60); // 09:00
        const lastSentWeek = await getAppData(pb, `auto_last_week_${auto.id}`, null);

        const shouldRun = forced || (isSunday && isPast900 && lastSentWeek !== lisbon.weekKey);

        if (shouldRun) {
          try {
            const rawFolhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
            const concluidas = rawFolhas.filter(f => f.status === 'Concluído' || f.status.startsWith('FEITO')).length;
            const abertas = rawFolhas.length - concluidas;

            const htmlAtiv = `
              <div style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f8fafc;">
                <div style="max-width:600px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:20px;">
                  <h2 style="color:#0f172a; margin-top:0;">📊 Quadro de Atividade Semanal & Produção</h2>
                  <p>Resumo semanal da oficina para a semana ${lisbon.weekKey}:</p>
                  <ul>
                    <li><strong>Total Intervenções Concluídas:</strong> ${concluidas}</li>
                    <li><strong>Total Intervenções em Aberto:</strong> ${abertas}</li>
                  </ul>
                </div>
              </div>
            `;

            await sendEmailFn({
              to: auto.destinatarios || ['hugo@grau-maquinaria.com'],
              subject: `[Oficina HP] 📊 Resumo Semanal de Produção (${lisbon.weekKey})`,
              html: htmlAtiv
            });

            await setAppData(pb, `auto_last_week_${auto.id}`, lisbon.weekKey);
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);
            results.push({ id: auto.id, tipo: auto.tipo, success: true });
          } catch (err) {
            results.push({ id: auto.id, tipo: auto.tipo, success: false, error: err.message });
          }
        }
      }

      // -------------------------------------------------------------
      // 5. ALERTA DE REVISÃO PREVENTIVA (Sextas-feiras às 17:00)
      // -------------------------------------------------------------
      if (auto.tipo === 'alerta_revisao') {
        const isFriday = lisbon.dayOfWeek === 5;
        const isPast1700 = lisbon.totalMinutes >= (17 * 60); // 17:00
        const lastSentWeek = await getAppData(pb, `auto_last_week_${auto.id}`, null);

        const shouldRun = forced || (isFriday && isPast1700 && lastSentWeek !== lisbon.weekKey);

        if (shouldRun) {
          try {
            const equipamentos = await getAppData(pb, 'oficina_hp_equipamentos', []);
            const necessitamRevisao = equipamentos.filter(e => {
              const diffKm = (Number(e.proximaRevisaoKm) || 0) - (Number(e.quilometros) || 0);
              const diffHoras = (Number(e.proximaRevisaoHoras) || 0) - (Number(e.horasTrabalho) || 0);
              return (diffKm > 0 && diffKm <= 1000) || (diffHoras > 0 && diffHoras <= 50);
            });

            if (necessitamRevisao.length > 0) {
              const rows = necessitamRevisao.map(e => `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:6px 10px; font-weight:bold;">${e.matricula || '-'}</td>
                  <td style="padding:6px 10px;">${e.marca} ${e.modelo}</td>
                  <td style="padding:6px 10px;">${e.quilometros || 0} Km (Próx: ${e.proximaRevisaoKm || '-'})</td>
                  <td style="padding:6px 10px;">${e.horasTrabalho || 0} h (Próx: ${e.proximaRevisaoHoras || '-'})</td>
                </tr>
              `).join('');

              const htmlRev = `
                <div style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f8fafc;">
                  <div style="max-width:600px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:20px;">
                    <h2 style="color:#d97706; margin-top:0;">🚚 Lembrete de Revisões Preventivas Próximas</h2>
                    <p>Existem <strong>${necessitamRevisao.length} equipamentos</strong> a aproximarem-se do limite de revisão:</p>
                    <table width="100%" style="border-collapse:collapse; font-size:12.5px;">
                      <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                          <th style="padding:6px 10px;">Matrícula</th>
                          <th style="padding:6px 10px;">Equipamento</th>
                          <th style="padding:6px 10px;">Kms</th>
                          <th style="padding:6px 10px;">Horas</th>
                        </tr>
                      </thead>
                      <tbody>${rows}</tbody>
                    </table>
                  </div>
                </div>
              `;

              await sendEmailFn({
                to: auto.destinatarios || ['hugo@grau-maquinaria.com'],
                subject: `[Oficina HP] 🚚 Lembrete de Revisão Preventiva (${necessitamRevisao.length} viaturas)`,
                html: htmlRev
              });
            }

            await setAppData(pb, `auto_last_week_${auto.id}`, lisbon.weekKey);
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);
            results.push({ id: auto.id, tipo: auto.tipo, success: true });
          } catch (err) {
            results.push({ id: auto.id, tipo: auto.tipo, success: false, error: err.message });
          }
        }
      }
    }

    return { status: 'checked', lisbon, results };
  } catch (err) {
    console.error('[ServerCron] Erro geral na execução do cron:', err);
    return { status: 'error', error: err.message };
  } finally {
    isChecking = false;
  }
}

/**
 * Starts the Server Automation Cron Loop (runs every 60 seconds)
 */
export function startServerAutomationCron(sendEmailFn) {
  console.log('⏰ [ServerCron] Agendador de automações 24/7 iniciado no servidor Node.js.');

  // Run initial check after 10 seconds (wait for server to stabilize)
  setTimeout(() => {
    runServerAutomations(sendEmailFn).catch(console.error);
  }, 10000);

  // Check every 60 seconds
  const interval = setInterval(() => {
    runServerAutomations(sendEmailFn).catch(console.error);
  }, 60 * 1000);

  return () => clearInterval(interval);
}
