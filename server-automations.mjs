import PocketBase from 'pocketbase';
import { jsPDF } from 'jspdf';
import autoTablePkg from 'jspdf-autotable';

// Apply autotable plugin to jsPDF in Node.js
if (autoTablePkg && typeof autoTablePkg.applyPlugin === 'function') {
  autoTablePkg.applyPlugin(jsPDF);
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
          console.log(`[ServerCron] 🚀 A executar 'email_tempos_resposta' para o dia ${lisbon.dateIso}...`);
          try {
            const rawFolhas = await getAppData(pb, 'oficina_hp_folhas_servico', []);
            const empresas = await getAppData(pb, 'oficina_hp_empresas', []);

            // Calculate critical sheets (open and > 10 days)
            const openFolhas = rawFolhas.filter(f => f.status !== 'Concluído' && f.status !== 'Finalizado' && !f.status.startsWith('FEITO'));
            
            const recipients = auto.destinatarios && auto.destinatarios.length > 0
              ? auto.destinatarios
              : ['hugo@grau-maquinaria.com', 'pinto@grau-maquinaria.com'];

            const htmlTempos = `
              <div style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background:#f1f5f9;">
                <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; border:1px solid #cbd5e1; overflow:hidden;">
                  <div style="background:#0f172a; padding:18px 24px; color:#fff;">
                    <h2 style="margin:0; font-size:18px;">Relatório Diário de Tempos de Resposta & Imobilização</h2>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#94a3b8;">${lisbon.dateIso} • Grau Maquinaria</p>
                  </div>
                  <div style="padding:20px 24px;">
                    <p>Bom dia,</p>
                    <p>Segue o resumo das folhas em aberto no sistema Oficina HP:</p>
                    <ul>
                      <li><strong>Total Folhas Abertas:</strong> ${openFolhas.length}</li>
                      <li><strong>Oficina:</strong> ${openFolhas.filter(f => f.tipo === 'Oficina').length}</li>
                      <li><strong>Assistência Técnica:</strong> ${openFolhas.filter(f => f.tipo === 'Assistência Técnica').length}</li>
                      <li><strong>Contratos:</strong> ${openFolhas.filter(f => f.tipo === 'Contrato').length}</li>
                    </ul>
                    <p>Consulte a aplicação para aceder aos detalhes e tempos de imobilização atualizados.</p>
                  </div>
                </div>
              </div>
            `;

            await sendEmailFn({
              to: recipients,
              subject: `[Oficina HP] Relatório Diário de Tempos de Resposta (${lisbon.dateIso})`,
              html: htmlTempos
            });

            await setAppData(pb, `auto_last_day_${auto.id}`, lisbon.dateIso);
            automacoes[i].ultimoDisparo = `Hoje às ${lisbon.timeStr}`;
            await setAppData(pb, 'oficina_hp_automacoes', automacoes);

            console.log(`[ServerCron] ✅ Tempos de resposta enviado para: ${recipients.join(', ')}`);
            results.push({ id: auto.id, tipo: auto.tipo, success: true });
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
