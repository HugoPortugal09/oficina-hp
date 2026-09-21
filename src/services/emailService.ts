import { db, STORAGE_KEYS } from './dbService';
import { getPocketBase } from './pocketbase';
import type { Tarefa, UserProfile, FolhaServico, Equipamento, Empresa, VisitaCliente, Cliente } from '../types';
import { USERS } from '../types';
import { generateEntregaFormacaoPDF, generateTemposRespostaPDF, createFolhaServicoPDFDoc, generatePlaneamentoSemanalA4PDF, type PlaneamentoSemanalDayCol, type PlaneamentoSemanalDayItem } from './pdfService';
import { formatDate, getTodayFormatted, cleanPersonName, calculateDiffDays, formatDateToInput } from '../utils/dateUtils';

/**
 * Compresses and resizes an image Data URI or base64 string to a compact JPEG
 * so photo attachments don't exceed email size limits.
 */
export async function resizeImageForEmail(
  imageSource: string,
  maxDim = 1024,
  quality = 0.7
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return imageSource.includes(',') ? imageSource.split(',')[1] : imageSource;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      } else {
        resolve(imageSource.includes(',') ? imageSource.split(',')[1] : imageSource);
      }
    };
    img.onerror = () => {
      resolve(imageSource.includes(',') ? imageSource.split(',')[1] : imageSource);
    };
    img.src = imageSource;
  });
}

export interface TaskNotificationPayload {
  action: 'CRIADA' | 'CONCLUIDA';
  tarefa: Tarefa;
  currentUser?: UserProfile;
  todasTarefas?: Tarefa[];
}

/**
 * Resolves all recipient emails for a task event:
 * - Responsible user
 * - Creator user
 * - Completer user (if completed)
 * Deduplicates multiple occurrences of the same recipient.
 */
export function resolveTaskRecipients(
  tarefa: Tarefa,
  action: 'CRIADA' | 'CONCLUIDA',
  currentUser?: UserProfile
): string[] {
  let registeredUsers: UserProfile[] = [];
  try {
    const list = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    registeredUsers = list && list.length > 0 ? list : USERS;
  } catch {
    registeredUsers = USERS;
  }

  const emailsSet = new Set<string>();

  const findUserEmail = (identifier?: string): string | null => {
    if (!identifier) return null;
    const cleanId = identifier.trim().toLowerCase();

    // Direct email format
    if (cleanId.includes('@') && cleanId.includes('.')) {
      return cleanId;
    }

    // Match by exact or partial name
    const matchByName = registeredUsers.find(
      u => u.nome.toLowerCase() === cleanId ||
           u.nome.toLowerCase().includes(cleanId) ||
           cleanId.includes(u.nome.toLowerCase())
    );
    if (matchByName?.email) return matchByName.email.trim().toLowerCase();

    // Match by avatar initials
    const matchByAvatar = registeredUsers.find(
      u => u.avatar?.toLowerCase() === cleanId
    );
    if (matchByAvatar?.email) return matchByAvatar.email.trim().toLowerCase();

    // Special match for Hugo Portugal
    if (cleanId.includes('hugo') || cleanId === 'hp') {
      return 'hugo@grau-maquinaria.com';
    }

    return null;
  };

  // 1. Responsável
  const respEmail = findUserEmail(tarefa.responsavel);
  if (respEmail) emailsSet.add(respEmail);

  // 2. Criador
  const criadorEmail = findUserEmail(tarefa.criadoPorNome) || findUserEmail(tarefa.criadoPorIniciais);
  if (criadorEmail) emailsSet.add(criadorEmail);

  // 3. Conclusor (se ação for de conclusão)
  if (action === 'CONCLUIDA') {
    const conclusorEmail = findUserEmail(tarefa.concluidoPorNome) || findUserEmail(tarefa.concluidoPorIniciais);
    if (conclusorEmail) emailsSet.add(conclusorEmail);
  }

  // 4. Se tiver currentUser logado, também considerar se aplicável
  if (currentUser?.email && currentUser.email.includes('@')) {
    emailsSet.add(currentUser.email.trim().toLowerCase());
  }

  // Garantir que pelo menos o email principal da empresa é incluído se nenhum for detetado
  if (emailsSet.size === 0) {
    try {
      const config = db.getConfig();
      if (config.emailDestinatarioPlaneamento) {
        emailsSet.add(config.emailDestinatarioPlaneamento.trim().toLowerCase());
      }
    } catch {
      emailsSet.add('hugo@grau-maquinaria.com');
    }
  }

  return Array.from(emailsSet).filter(e => e && e.includes('@'));
}

/**
 * Builds the HTML content for task notification email
 */
function getPriorityBadgeStyle(prioridade?: string): { bg: string; text: string; border: string } {
  switch (prioridade) {
    case 'Crítica':
    case 'Urgente':
      return { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' };
    case 'Alta':
      return { bg: '#ffedd5', text: '#9a3412', border: '#f97316' };
    case 'Normal':
      return { bg: '#e0f2fe', text: '#0369a1', border: '#0284c7' };
    default:
      return { bg: '#f1f5f9', text: '#334155', border: '#94a3b8' };
  }
}

/**
 * Builds the HTML content for task notification email
 */
export function buildTaskNotificationHtml(
  action: 'CRIADA' | 'CONCLUIDA',
  tarefa: Tarefa,
  outrasTarefasAbertas: Tarefa[]
): string {
  const isCreated = action === 'CRIADA';
  const badgeColor = isCreated ? '#0284c7' : '#16a34a';
  const badgeText = isCreated ? 'NOVA TAREFA REGISTADA' : 'TAREFA CONCLUÍDA COM SUCESSO';
  const currentPStyle = getPriorityBadgeStyle(tarefa.prioridade);

  // Table rows for remaining open tasks
  const openTasksRows = outrasTarefasAbertas.length === 0
    ? '<tr><td colspan="5" bgcolor="#ffffff" style="text-align: center; padding: 16px; color: #0f172a; font-style: italic; border: 1px solid #cbd5e1;">Não existem outras tarefas pendentes ou em curso no sistema.</td></tr>'
    : outrasTarefasAbertas.map((t, idx) => {
        const pStyle = getPriorityBadgeStyle(t.prioridade);
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr bgcolor="${rowBg}">
            <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; color: #0f172a; border: 1px solid #cbd5e1;">${t.numero}</td>
            <td style="padding: 10px 8px; color: #0f172a; font-weight: 500; border: 1px solid #cbd5e1;">${t.descricao}</td>
            <td style="padding: 10px 8px; text-align: center; border: 1px solid #cbd5e1;">
              <span style="background-color: ${pStyle.bg}; color: ${pStyle.text}; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; border: 1px solid ${pStyle.border}; display: inline-block;">${t.prioridade}</span>
            </td>
            <td style="padding: 10px 8px; color: #0f172a; font-weight: 600; border: 1px solid #cbd5e1;">${t.responsavel || '-'}</td>
            <td style="padding: 10px 8px; color: #0f172a; font-size: 12px; font-weight: 600; border: 1px solid #cbd5e1;">${t.dataLimite || '-'}</td>
          </tr>
        `;
      }).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Notificação de Tarefa - Oficina HP</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 24px 28px; border-bottom: 4px solid ${badgeColor};">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; font-family: 'Segoe UI', Arial, sans-serif;">
                    OFICINA HP &bull; GESTÃO OPERACIONAL
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; display: inline-block;">
                      ${badgeText}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: 'Segoe UI', Arial, sans-serif;">
                      ${tarefa.numero}: ${tarefa.descricao}
                    </h1>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif;">
                      Notificação automática de gestão de tarefas da oficina.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Card Details -->
          <tr>
            <td style="padding: 24px 28px;">
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                📌 Detalhes da Tarefa
              </h2>

              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border: 1px solid #cbd5e1; border-collapse: collapse;">
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; width: 32%; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Número:</td>
                  <td style="padding: 10px 14px; font-family: monospace; font-weight: bold; color: #0f172a; font-size: 14px; border-bottom: 1px solid #cbd5e1;">${tarefa.numero}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Descrição:</td>
                  <td style="padding: 10px 14px; font-weight: 600; color: #0f172a; font-size: 14px; border-bottom: 1px solid #cbd5e1;">${tarefa.descricao}</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Responsável:</td>
                  <td style="padding: 10px 14px; font-weight: 700; color: #0284c7; font-size: 14px; border-bottom: 1px solid #cbd5e1;">${tarefa.responsavel}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Prioridade:</td>
                  <td style="padding: 10px 14px; border-bottom: 1px solid #cbd5e1;">
                    <span style="background-color: ${currentPStyle.bg}; color: ${currentPStyle.text}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 4px; border: 1px solid ${currentPStyle.border}; display: inline-block;">
                      ${tarefa.prioridade}
                    </span>
                  </td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Data Limite:</td>
                  <td style="padding: 10px 14px; font-weight: 600; color: #0f172a; font-size: 13px; border-bottom: 1px solid #cbd5e1;">${tarefa.dataLimite || 'Sem data limite definida'}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Criado Por:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; border-bottom: 1px solid #cbd5e1;">
                    ${tarefa.criadoPorNome && tarefa.criadoPorNome !== 'IA' ? tarefa.criadoPorNome : 'Hugo Portugal'} [<strong>${tarefa.criadoPorIniciais === 'IA' ? 'HP' : (tarefa.criadoPorIniciais || 'HP')}</strong>] em ${tarefa.dataCriacao}
                  </td>
                </tr>
                ${action === 'CONCLUIDA' ? `
                <tr bgcolor="#f0fdf4">
                  <td style="padding: 10px 14px; color: #166534; font-size: 13px; font-weight: 700; border-bottom: 1px solid #bbf7d0; border-right: 1px solid #bbf7d0;">Concluído Por:</td>
                  <td style="padding: 10px 14px; color: #166534; font-weight: bold; font-size: 13.5px; border-bottom: 1px solid #bbf7d0;">
                    ${tarefa.concluidoPorNome || ''} [<strong>${tarefa.concluidoPorIniciais}</strong>] em ${tarefa.dataConclusao}
                  </td>
                </tr>
                ` : ''}
                ${tarefa.notasAdicionais ? `
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; font-weight: 700; vertical-align: top; border-right: 1px solid #cbd5e1;">Notas / Obs:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-size: 13px; background-color: #ffffff;">
                    ${tarefa.notasAdicionais}
                  </td>
                </tr>
                ` : ''}
              </table>

              <!-- Remaining Open Tasks Section -->
              <div style="margin-top: 28px;">
                <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                  📋 Quadro de Tarefas Abertas no Sistema (Total: ${outrasTarefasAbertas.length})
                </h2>
                
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; background-color: #ffffff; border: 1px solid #cbd5e1; border-collapse: collapse;">
                  <thead>
                    <tr bgcolor="#e2e8f0" style="background-color: #e2e8f0; text-align: left; color: #0f172a;">
                      <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Nº</th>
                      <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Descrição</th>
                      <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; text-align: center;">Prioridade</th>
                      <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Responsável</th>
                      <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Limite</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${openTasksRows}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 4px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP</strong> &bull; Sistema Integrado de Gestão Mecânica &amp; Frotas</p>
              <p style="margin: 0; color: #475569;">Este é um email automático de notificação operacional enviado pelo sistema.</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends or queues the task notification email to all unique recipients
 */
export async function sendTaskNotificationEmail(payload: TaskNotificationPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  const { action, tarefa, currentUser, todasTarefas } = payload;

  const currentTarefas = todasTarefas || db.get<Tarefa>(STORAGE_KEYS.TAREFAS) || [];
  const outrasAbertas = currentTarefas.filter(
    t => t.id !== tarefa.id && (t.status === 'Pendente' || t.status === 'Em Curso')
  );

  const recipients = resolveTaskRecipients(tarefa, action, currentUser);
  const subject = action === 'CRIADA'
    ? `[Oficina HP] Nova Tarefa ${tarefa.numero}: ${tarefa.descricao} (${tarefa.prioridade})`
    : `[Oficina HP] Tarefa Concluída ${tarefa.numero}: ${tarefa.descricao}`;

  const htmlContent = buildTaskNotificationHtml(action, tarefa, outrasAbertas);

  console.log(`[EmailService] Sending task notification (${action}) for ${tarefa.numero} to:`, recipients);

  // 1. Enviar email real via API interna
  let apiDeliverySuccess = false;
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      apiDeliverySuccess = true;
      console.log(`[EmailService] ✅ Email de tarefa enviado via SMTP para ${recipients.join(', ')}`);
    }
  } catch (apiErr) {
    console.warn('[EmailService] ⚠️ Não foi possível contactar /api/send-email:', apiErr);
  }

  try {
    const emailLogEntry = {
      id: db.generateId('eml'),
      tipo: 'notificacao_tarefa',
      acao: action,
      tarefaId: tarefa.id,
      tarefaNumero: tarefa.numero,
      destinatarios: recipients,
      assunto: subject,
      dataEnvio: new Date().toISOString(),
      sucesso: apiDeliverySuccess
    };
    
    // Save to local sync
    const logs = db.get<any>('oficina_hp_email_logs') || [];
    db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);
    
    // Also push to PocketBase app_data if online
    const pb = getPocketBase();
    pb.collection('app_data').create({
      key: `task_notification_${tarefa.numero}_${Date.now()}`,
      data: {
        recipients,
        subject,
        action,
        tarefaNumero: tarefa.numero,
        html: htmlContent,
        sent: apiDeliverySuccess
      },
      timestamp: new Date().toISOString()
    }).catch(err => {
      console.warn('[EmailService] Cloud queue notice:', err?.message || err);
    });

  } catch (e: any) {
    console.warn('[EmailService] Storage notice:', e?.message || e);
  }

  return {
    success: true,
    recipients,
    message: apiDeliverySuccess
      ? `Notificação enviada por email para: ${recipients.join(', ')}`
      : `Notificação registada para: ${recipients.join(', ')}`
  };
}

export interface EntregaFormacaoEmailPayload {
  folha: FolhaServico;
  equipamento?: Equipamento;
  empresa?: Empresa;
  currentUser?: UserProfile;
}

/**
 * Resolves recipients for Entrega e Formação notification:
 * - "quem fez": logged in user email, or matched from entregaPor / formacaoPor / criadoPor
 * - "administrador": administrator email from config (emailDestinatarioPlaneamento) and registered admin users
 */
export function resolveEntregaFormacaoRecipients(
  folha: FolhaServico,
  currentUser?: UserProfile
): { recipients: string[]; quemFezEmail: string | null; adminEmail: string } {
  let registeredUsers: UserProfile[] = [];
  try {
    const list = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    registeredUsers = list && list.length > 0 ? list : USERS;
  } catch {
    registeredUsers = USERS;
  }

  const findUserEmail = (identifier?: string): string | null => {
    if (!identifier) return null;
    const cleanId = cleanPersonName(identifier).toLowerCase();
    if (cleanId.includes('@') && cleanId.includes('.')) return cleanId;

    const matchByName = registeredUsers.find(
      u => u.nome.toLowerCase() === cleanId ||
           u.nome.toLowerCase().includes(cleanId) ||
           cleanId.includes(u.nome.toLowerCase())
    );
    if (matchByName?.email) return matchByName.email.trim().toLowerCase();

    const matchByAvatar = registeredUsers.find(
      u => u.avatar?.toLowerCase() === cleanId
    );
    if (matchByAvatar?.email) return matchByAvatar.email.trim().toLowerCase();

    if (cleanId.includes('hugo') || cleanId === 'hp') {
      return 'hugo@grau-maquinaria.com';
    }
    return null;
  };

  const emailsSet = new Set<string>();

  // 1. Quem fez
  let quemFezEmail: string | null = null;
  if (currentUser?.email && currentUser.email.includes('@')) {
    quemFezEmail = currentUser.email.trim().toLowerCase();
  } else if (folha.entregaPor) {
    quemFezEmail = findUserEmail(folha.entregaPor);
  } else if (folha.formacaoPor) {
    quemFezEmail = findUserEmail(folha.formacaoPor);
  } else if (folha.criadoPor) {
    quemFezEmail = findUserEmail(folha.criadoPor);
  }

  if (quemFezEmail) {
    emailsSet.add(quemFezEmail);
  }

  // 2. Administrador & Destinatário Obrigatório
  let adminEmail = 'hugo@grau-maquinaria.com';
  try {
    const config = db.getConfig();
    if (config.emailDestinatarioPlaneamento && config.emailDestinatarioPlaneamento.includes('@')) {
      adminEmail = config.emailDestinatarioPlaneamento.trim().toLowerCase();
    }
  } catch {}

  const adminUser = registeredUsers.find(u => u.role === 'administrador');
  if (adminUser?.email && adminUser.email.includes('@')) {
    emailsSet.add(adminUser.email.trim().toLowerCase());
  }
  emailsSet.add(adminEmail);
  emailsSet.add('hugo@grau-maquinaria.com');
  emailsSet.add('pinto@grau-maquinaria.com');

  const recipients = Array.from(emailsSet).filter(e => e && e.includes('@'));
  return { recipients, quemFezEmail, adminEmail };
}

/**
 * Builds the official HTML template for Entrega e Formação notification
 * Clean, corporate and elegant styling with minimal colors for universal email client support
 */
export function buildEntregaFormacaoHtml(
  folha: FolhaServico,
  equipamento?: Equipamento,
  empresa?: Empresa,
  currentUser?: UserProfile
): string {
  const rawEntregaDate = folha.dataEntrega || equipamento?.dataEntrega;
  const dataEntrega = rawEntregaDate ? formatDate(rawEntregaDate) : 'Não especificada';
  const entregaPor = cleanPersonName(folha.entregaPor || equipamento?.entregaPor) || 'Não especificado';
  const rawFormacaoDate = folha.dataFormacao || equipamento?.dataFormacao;
  const dataFormacao = rawFormacaoDate ? formatDate(rawFormacaoDate) : 'Não especificada';
  const formacaoPor = cleanPersonName(folha.formacaoPor || equipamento?.formacaoPor) || 'Não especificado';
  const nSerie = folha.nSerie || equipamento?.nSerie || 'N/A';
  const kms = folha.kmsAtuais || equipamento?.kmsAtuais || 0;
  const horas = folha.horasAtuais || equipamento?.horasAtuais || 0;
  const clienteNome = empresa?.nome || (folha as any).empresaNome || (folha as any).cliente || 'Cliente Geral';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Registo de Entrega e Formação - Oficina HP</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 24px 28px; border-bottom: 4px solid #0284c7;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; font-family: 'Segoe UI', Arial, sans-serif;">
                    GRAUMP &bull; OFICINA HP &bull; REGISTO OPERACIONAL
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #0284c7; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; display: inline-block;">
                      ENTREGA E FORMAÇÃO
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: 'Segoe UI', Arial, sans-serif;">
                      Auto de Entrega e Formação: ${folha.matricula || 'Equipamento'}
                    </h1>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif;">
                      Folha de Serviço: <strong style="color: #ffffff; font-family: monospace;">${folha.numero}</strong> &bull; ${folha.marca || ''} ${folha.modelo || ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Callout PDF Anexo -->
          <tr>
            <td style="padding: 20px 28px 0 28px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; line-height: 1.4;">
                    📎 <strong>Documento Oficial Anexado:</strong> O Certificado / Auto de Entrega e Formação em formato PDF com o layout gráfico completo segue em anexo a este email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 28px;">
              
              <!-- Dados Entrega e Formação (2 Boxes) -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 22px;">
                <tr>
                  <td width="48%" valign="top" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-top: 4px solid #0284c7; border-radius: 6px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; margin-bottom: 8px;">
                      📦 ENTREGA
                    </div>
                    <div style="margin-bottom: 6px; font-size: 13px; color: #0f172a;">
                      <span style="font-weight: 700;">Data:</span> <strong>${dataEntrega}</strong>
                    </div>
                    <div style="font-size: 13px; color: #0f172a;">
                      <span style="font-weight: 700;">Entregue por:</span> <strong>${entregaPor}</strong>
                    </div>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <td width="48%" valign="top" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-top: 4px solid #16a34a; border-radius: 6px; padding: 12px 14px;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #16a34a; margin-bottom: 8px;">
                      🎓 FORMAÇÃO
                    </div>
                    <div style="margin-bottom: 6px; font-size: 13px; color: #0f172a;">
                      <span style="font-weight: 700;">Data:</span> <strong>${dataFormacao}</strong>
                    </div>
                    <div style="font-size: 13px; color: #0f172a;">
                      <span style="font-weight: 700;">Formador:</span> <strong>${formacaoPor}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Ficha Técnica do Equipamento -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                🚜 Ficha do Equipamento / Viatura
              </h2>
              
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-collapse: collapse; font-size: 13px;">
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; width: 35%; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Matrícula</td>
                  <td style="padding: 9px 12px; font-family: monospace; font-weight: 700; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${folha.matricula || '---'}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Marca / Modelo</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${folha.marca || ''} ${folha.modelo || ''}</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Nº de Série (VIN)</td>
                  <td style="padding: 9px 12px; font-family: monospace; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${nSerie}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Quilómetros / Horas</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${kms.toLocaleString('pt-PT')} Km &bull; ${horas} Horas</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Cliente / Entidade</td>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #cbd5e1;">${clienteNome}</td>
                </tr>
                ${folha.pessoaPresente ? `
                <tr bgcolor="#ffffff">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Pessoa Presente</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${folha.pessoaPresente}</td>
                </tr>
                ` : ''}
                <tr bgcolor="${folha.pessoaPresente ? '#f8fafc' : '#ffffff'}">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-right: 1px solid #cbd5e1;">Local da Intervenção</td>
                  <td style="padding: 9px 12px; color: #0f172a;">${folha.localizacao || 'Oficina Geral'}</td>
                </tr>
              </table>

              ${folha.anomalias || folha.notasCliente || folha.notasInternas ? `
              <!-- Observações -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 10px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                📝 Observações Técnicas
              </h2>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; line-height: 1.5;">
                    ${folha.anomalias ? `<div style="margin-bottom: 4px;"><strong>Trabalhos / Descrição:</strong> ${folha.anomalias}</div>` : ''}
                    ${folha.notasCliente ? `<div style="margin-bottom: 4px;"><strong>Notas Cliente:</strong> ${folha.notasCliente}</div>` : ''}
                    ${folha.notasInternas ? `<div><strong>Notas Internas:</strong> ${folha.notasInternas}</div>` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Registo efetuado por -->
              <div style="font-size: 12px; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 12px;">
                Registo efetuado por: <strong style="color: #0f172a;">${cleanPersonName(currentUser?.nome || folha.criadoPor || folha.entregaPor || 'Hugo Portugal')}</strong> &bull; ${new Date().toLocaleString('pt-PT')}
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 3px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
              <p style="margin: 0; color: #475569;">Notificação operacional gerada automaticamente pelo sistema.</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends or queues email notification for Entrega e Formação with PDF attachment and optional photos
 */
export async function sendEntregaFormacaoEmail(payload: EntregaFormacaoEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  const { folha, equipamento, empresa, currentUser } = payload;
  let targetEquip = equipamento;
  if (!targetEquip && folha.equipamentoId) {
    targetEquip = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS)?.find(e => e.id === folha.equipamentoId);
  }
  let targetEmpresa = empresa;
  if (!targetEmpresa) {
    const targetEmpresaId = folha.empresaId || (targetEquip ? targetEquip.empresaId : undefined);
    if (targetEmpresaId) {
      targetEmpresa = db.get<Empresa>(STORAGE_KEYS.EMPRESAS)?.find(e => e.id === targetEmpresaId);
    }
  }

  const { recipients } = resolveEntregaFormacaoRecipients(folha, currentUser);
  const subject = `[Oficina HP] Registo de Entrega e Formação: ${folha.matricula} (${folha.numero})`;
  const htmlContent = buildEntregaFormacaoHtml(folha, targetEquip, targetEmpresa, currentUser);

  // 1. Gerar layout oficial em PDF igual ao modelo visual para anexo
  const attachments: any[] = [];
  try {
    const doc = generateEntregaFormacaoPDF(folha, targetEmpresa, targetEquip);
    const pdfDataUri = doc.output('datauristring');
    const base64Content = pdfDataUri.split(',')[1];
    if (base64Content) {
      const cleanMatricula = (folha.matricula || 'Equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanNumero = (folha.numero || 'FS').replace(/[^a-zA-Z0-9_-]/g, '_');
      attachments.push({
        filename: `Entrega_Formacao_${cleanMatricula}_${cleanNumero}.pdf`,
        content: base64Content,
        encoding: 'base64',
        contentType: 'application/pdf'
      });
      console.log(`[EmailService] 📎 PDF de Entrega e Formação gerado com sucesso para anexo.`);
    }
  } catch (pdfErr) {
    console.error('[EmailService] Erro ao gerar PDF de Entrega e Formação para anexo:', pdfErr);
  }

  // 2. Se existirem fotos na folha de serviço, anexar também comprimidas para não ocupar muito espaço
  const rawFotos = folha.fotos || [];
  if (Array.isArray(rawFotos) && rawFotos.length > 0) {
    for (let i = 0; i < rawFotos.length; i++) {
      const foto = rawFotos[i];
      if (!foto) continue;
      try {
        const compressedBase64 = await resizeImageForEmail(foto, 1024, 0.7);
        if (compressedBase64) {
          const cleanMatricula = (folha.matricula || 'Equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
          attachments.push({
            filename: `Foto_${cleanMatricula}_${i + 1}.jpg`,
            content: compressedBase64,
            encoding: 'base64',
            contentType: 'image/jpeg'
          });
          console.log(`[EmailService] 📷 Foto ${i + 1} comprimida e adicionada aos anexos do email.`);
        }
      } catch (errFoto) {
        console.warn(`[EmailService] Erro ao anexar foto ${i + 1}:`, errFoto);
      }
    }
  }

  // 2. Enviar email real via API interna (/api/send-email via Gmail SMTP) com o anexo PDF
  let apiDeliverySuccess = false;
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent,
        attachments
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      apiDeliverySuccess = true;
      console.log(`[EmailService] ✅ Email de Entrega e Formação com PDF anexado enviado via SMTP com sucesso para ${recipients.join(', ')} (ID: ${data.messageId})`);
    } else {
      console.warn('[EmailService] ⚠️ Resposta da API de email:', data);
    }
  } catch (apiErr) {
    console.warn('[EmailService] ⚠️ Não foi possível contactar /api/send-email diretamente:', apiErr);
  }

  try {
    const emailLogEntry = {
      id: db.generateId('eml'),
      tipo: 'notificacao_entrega_formacao',
      folhaId: folha.id,
      folhaNumero: folha.numero,
      matricula: folha.matricula,
      destinatarios: recipients,
      assunto: subject,
      dataEntrega: folha.dataEntrega,
      entregaPor: folha.entregaPor,
      dataFormacao: folha.dataFormacao,
      formacaoPor: folha.formacaoPor,
      dataEnvio: new Date().toISOString(),
      sucesso: apiDeliverySuccess
    };

    // Save to local logs
    const logs = db.get<any>('oficina_hp_email_logs') || [];
    db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);

    // Push to PocketBase cloud queue in app_data
    const pb = getPocketBase();
    pb.collection('app_data').create({
      key: `email_entrega_formacao_${folha.numero}_${Date.now()}`,
      data: {
        recipients,
        subject,
        tipo: 'entrega_formacao',
        folhaNumero: folha.numero,
        matricula: folha.matricula,
        dataEntrega: folha.dataEntrega,
        entregaPor: folha.entregaPor,
        dataFormacao: folha.dataFormacao,
        formacaoPor: folha.formacaoPor,
        html: htmlContent,
        sent: apiDeliverySuccess
      },
      timestamp: new Date().toISOString()
    }).catch(err => {
      console.warn('[EmailService] PocketBase queue notice:', err?.message || err);
    });

    return {
      success: true,
      recipients,
      message: apiDeliverySuccess 
        ? `Email enviado com sucesso para: ${recipients.join(', ')}`
        : `Notificação registada para envio para: ${recipients.join(', ')}`
    };
  } catch (err: any) {
    console.error('[EmailService] Erro fatal em sendEntregaFormacaoEmail:', err);
    return {
      success: false,
      recipients: [],
      message: `Erro ao enviar email: ${err?.message || err}`
    };
  }
}

export interface TemposRespostaEmailPayload {
  folhas?: FolhaServico[];
  empresas?: Empresa[];
  equipamentos?: Equipamento[];
  destinatarios?: string[];
}

/**
 * Builds executive HTML template for the daily Tempos de Resposta email
 * Features summary stats cards (averages & KPIs) and preview of critical vehicles
 */
export function buildTemposRespostaDailyHtml(
  stats: {
    avgImobilizacaoOficina: number;
    avgDiasReq: number;
    criticalCount: number;
    totalAbertas: number;
    totalOficinaAbertas: number;
    totalAssistenciaAbertas: number;
    totalContratoAbertas: number;
  },
  criticalRows: any[],
  dataHoje: string
): string {
  const criticalTableRows = criticalRows.length === 0
    ? '<tr><td colspan="5" bgcolor="#ffffff" style="text-align: center; padding: 14px; color: #166534; font-weight: 700; border: 1px solid #cbd5e1;">✅ Excelente! Não existem viaturas em estado crítico (≥ 10 dias) de momento.</td></tr>'
    : criticalRows.map((r, idx) => {
        const imobText = r.imobilizacao ? r.imobilizacao.text : '-';
        const reqText = r.diasRequisicao ? r.diasRequisicao.text : '-';
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fff1f2';
        return `
          <tr bgcolor="${rowBg}">
            <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; color: #0f172a; border: 1px solid #fca5a5;">${r.folha.numero}</td>
            <td style="padding: 10px 8px; font-family: monospace; font-weight: bold; color: #b91c1c; border: 1px solid #fca5a5;">${r.folha.matricula || '-'}</td>
            <td style="padding: 10px 8px; color: #0f172a; font-weight: 600; border: 1px solid #fca5a5;">${r.empresaNome}</td>
            <td style="padding: 10px 8px; font-weight: bold; color: #b91c1c; border: 1px solid #fca5a5;">${imobText} (Oficina) / ${reqText} (Req.)</td>
            <td style="padding: 10px 8px; color: #0f172a; font-size: 12px; font-weight: 600; border: 1px solid #fca5a5;">${r.folha.status}</td>
          </tr>
        `;
      }).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Tempos de Resposta &amp; Imobilização - Relatório Diário</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
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
                      Relatório de controlo operacional emitido a <strong>${dataHoje}</strong>.
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
                      Oficina (${stats.totalOficinaAbertas}) &bull; AT (${stats.totalAssistenciaAbertas}) &bull; Contratos (${stats.totalContratoAbertas})
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
                      <li style="margin-bottom: 4px;"><strong>1. Tempos_Resposta_Oficina.pdf</strong> — Quadro de acompanhamento detalhado apenas da Oficina.</li>
                      <li style="margin-bottom: 4px;"><strong>2. Tempos_Resposta_Assistencia_Contratos.pdf</strong> — Quadro com Assistência Técnica no terreno e Contratos.</li>
                      <li style="margin-bottom: 0;"><strong>3. Tempos_Resposta_Geral_Completo.pdf</strong> — Quadro Geral completo com toda a informação operacional.</li>
                    </ul>
                    <div style="margin-top: 8px; font-size: 11.5px; color: #475569; font-style: italic;">
                      * Nota: Em cumprimento das diretrizes de apresentação, os ficheiros PDF anexos contêm apenas as tabelas detalhadas em formato A3 horizontal para fácil impressão ou consulta em grande ecrã.
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
              <p style="margin: 0; color: #475569;">Disparo automático diário às 06:00 (Dias de semana) &bull; hugo@grau-maquinaria.com &bull; pinto@grau-maquinaria.com</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends the daily automated email with 3 A3 PDF attachments and HTML summary averages
 */
export async function sendDailyTemposRespostaEmail(payload?: TemposRespostaEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  try {
    const rawFolhas = payload?.folhas || db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO) || [];
    const empresas = payload?.empresas || db.get<Empresa>(STORAGE_KEYS.EMPRESAS) || [];
    const equipamentos = payload?.equipamentos || db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS) || [];

    // Process rows
    const processedRows = rawFolhas.map(f => {
      const emp = empresas.find(e => e.id === f.empresaId);
      const isConcluido = f.status === 'Concluído' || f.status.startsWith('FEITO') || f.status === 'Feito' || !!f.dataConclusao;
      const isOficina = f.tipo === 'Oficina';

      const startDateImobilizacao = f.dataEntradaOficina || (isOficina ? f.data : undefined);
      const imobilizacao = calculateDiffDays(startDateImobilizacao, f.dataConclusao);
      const diasRequisicao = calculateDiffDays(f.dataRequisicao, f.dataConclusao);
      const isCritico = !isConcluido && (((imobilizacao?.days || 0) >= 10) || ((diasRequisicao?.days || 0) >= 10));

      return {
        folha: f,
        empresaNome: emp?.nome || 'Cliente',
        isConcluido,
        isOficina,
        imobilizacao,
        diasRequisicao,
        isCritico
      };
    });

    // Compute averages & KPIs for email body
    const openOficinaRows = processedRows.filter(r => r.isOficina && !r.isConcluido && r.imobilizacao);
    const avgImobilizacaoOficina = openOficinaRows.length > 0
      ? openOficinaRows.reduce((acc, r) => acc + (r.imobilizacao?.days || 0), 0) / openOficinaRows.length
      : 0;

    const rowsWithReq = processedRows.filter(r => !r.isConcluido && r.diasRequisicao);
    const avgDiasReq = rowsWithReq.length > 0
      ? rowsWithReq.reduce((acc, r) => acc + (r.diasRequisicao?.days || 0), 0) / rowsWithReq.length
      : 0;

    const criticalRows = processedRows.filter(r => r.isCritico);
    const criticalCount = criticalRows.length;
    const totalAbertas = processedRows.filter(r => !r.isConcluido).length;

    const totalOficinaAbertas = processedRows.filter(r => !r.isConcluido && r.isOficina).length;
    const totalAssistenciaAbertas = processedRows.filter(r => !r.isConcluido && r.folha.tipo === 'Assistência Técnica').length;
    const totalContratoAbertas = processedRows.filter(r => !r.isConcluido && r.folha.tipo === 'Contrato').length;

    const dataHoje = getTodayFormatted();

    // 1. Generate the 3 A3 Landscape PDFs
    const attachments: any[] = [];

    // PDF 1: Oficina
    try {
      const docOficina = generateTemposRespostaPDF(rawFolhas, empresas, 'OFICINA');
      const dataUriOficina = docOficina.output('datauristring');
      const base64Oficina = dataUriOficina.split(',')[1];
      if (base64Oficina) {
        attachments.push({
          filename: `Tempos_Resposta_Oficina.pdf`,
          content: base64Oficina,
          encoding: 'base64',
          contentType: 'application/pdf'
        });
      }
    } catch (errOf) {
      console.error('[EmailService] Erro ao gerar PDF da Oficina:', errOf);
    }

    // PDF 2: Assistência Técnica & Contratos
    try {
      const docAT = generateTemposRespostaPDF(rawFolhas, empresas, 'ASSISTENCIA_CONTRATOS');
      const dataUriAT = docAT.output('datauristring');
      const base64AT = dataUriAT.split(',')[1];
      if (base64AT) {
        attachments.push({
          filename: `Tempos_Resposta_Assistencia_Contratos.pdf`,
          content: base64AT,
          encoding: 'base64',
          contentType: 'application/pdf'
        });
      }
    } catch (errAT) {
      console.error('[EmailService] Erro ao gerar PDF de Assistência/Contratos:', errAT);
    }

    // PDF 3: Geral Completo
    try {
      const docGeral = generateTemposRespostaPDF(rawFolhas, empresas, 'TODOS');
      const dataUriGeral = docGeral.output('datauristring');
      const base64Geral = dataUriGeral.split(',')[1];
      if (base64Geral) {
        attachments.push({
          filename: `Tempos_Resposta_Geral_Completo.pdf`,
          content: base64Geral,
          encoding: 'base64',
          contentType: 'application/pdf'
        });
      }
    } catch (errGeral) {
      console.error('[EmailService] Erro ao gerar PDF Geral:', errGeral);
    }

    // 2. Build HTML content with averages
    const htmlContent = buildTemposRespostaDailyHtml(
      {
        avgImobilizacaoOficina,
        avgDiasReq,
        criticalCount,
        totalAbertas,
        totalOficinaAbertas,
        totalAssistenciaAbertas,
        totalContratoAbertas
      },
      criticalRows,
      dataHoje
    );

    // 3. Resolve recipients
    let recipients = payload?.destinatarios && payload.destinatarios.length > 0
      ? payload.destinatarios
      : ['hugo@grau-maquinaria.com', 'pinto@grau-maquinaria.com'];

    // Check config if other recipients exist in automations
    try {
      const autos = db.get<any>(STORAGE_KEYS.AUTOMACOES);
      const autoItem = autos?.find((a: any) => a.tipo === 'email_tempos_resposta');
      if (autoItem && Array.isArray(autoItem.destinatarios) && autoItem.destinatarios.length > 0) {
        recipients = Array.from(new Set([...recipients, ...autoItem.destinatarios]));
      }
    } catch {}

    const subject = `[Oficina HP] Relatório Diário de Tempos de Resposta & Imobilização (${dataHoje})`;

    console.log(`[EmailService] A enviar relatório diário de tempos de resposta para: ${recipients.join(', ')} com ${attachments.length} PDFs.`);

    // 4. Send email via internal API
    let apiDeliverySuccess = false;
    try {
      const resp = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject,
          html: htmlContent,
          attachments
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        apiDeliverySuccess = true;
        console.log(`[EmailService] ✅ Email diário de tempos de resposta enviado com sucesso via SMTP (ID: ${data.messageId})`);
      } else {
        console.warn('[EmailService] ⚠️ Resposta da API:', data);
      }
    } catch (apiErr) {
      console.warn('[EmailService] ⚠️ Não foi possível contactar /api/send-email:', apiErr);
    }

    // 5. Store in local email logs and PocketBase
    try {
      const emailLogEntry = {
        id: db.generateId('eml'),
        tipo: 'email_tempos_resposta_diario',
        destinatarios: recipients,
        assunto: subject,
        dataEnvio: new Date().toISOString(),
        anexosCount: attachments.length,
        sucesso: apiDeliverySuccess
      };
      const logs = db.get<any>('oficina_hp_email_logs') || [];
      db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);

      // Update automacao item last run
      const autos = db.get<any>(STORAGE_KEYS.AUTOMACOES) || [];
      const updatedAutos = autos.map((a: any) => a.tipo === 'email_tempos_resposta' ? {
        ...a,
        ultimoDisparo: `Hoje às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      } : a);
      db.save(STORAGE_KEYS.AUTOMACOES, updatedAutos);

      // PocketBase queue
      const pb = getPocketBase();
      pb.collection('app_data').create({
        key: `email_tempos_resposta_${Date.now()}`,
        data: {
          recipients,
          subject,
          tipo: 'tempos_resposta_diario',
          anexosCount: attachments.length,
          avgImobilizacao: avgImobilizacaoOficina,
          avgDiasReq,
          criticalCount,
          sent: apiDeliverySuccess
        },
        timestamp: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}

    return {
      success: true,
      recipients,
      message: apiDeliverySuccess
        ? `Relatório diário enviado com sucesso para: ${recipients.join(', ')} (${attachments.length} PDFs anexados)`
        : `Relatório diário registado para envio para: ${recipients.join(', ')}`
    };
  } catch (err: any) {
    console.error('[EmailService] Erro ao enviar relatório diário de tempos de resposta:', err);
    return {
      success: false,
      recipients: [],
      message: `Erro ao enviar relatório diário: ${err?.message || err}`
    };
  }
}

export interface FolhaServicoEmailPayload {
  folha: FolhaServico;
  empresa?: Empresa;
  equipamento?: Equipamento;
  currentUser?: UserProfile;
}

/**
 * Sends Folha de Serviço by email to the requesting user and hugo@grau-maquinaria.com
 */
export async function sendFolhaServicoEmail(payload: FolhaServicoEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  const { folha, currentUser } = payload;
  let targetEquip = payload.equipamento;
  if (!targetEquip && folha.equipamentoId) {
    targetEquip = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS)?.find(e => e.id === folha.equipamentoId);
  }
  let targetEmpresa = payload.empresa;
  if (!targetEmpresa) {
    const targetEmpresaId = folha.empresaId || (targetEquip ? targetEquip.empresaId : undefined);
    if (targetEmpresaId) {
      targetEmpresa = db.get<Empresa>(STORAGE_KEYS.EMPRESAS)?.find(e => e.id === targetEmpresaId);
    }
  }

  // Resolve recipients: requesting user + hugo@grau-maquinaria.com + config.emailDestinatarioPlaneamento
  const emailsSet = new Set<string>();
  
  if (currentUser?.email && currentUser.email.includes('@')) {
    emailsSet.add(currentUser.email.trim().toLowerCase());
  }

  let adminEmail = 'hugo@grau-maquinaria.com';
  try {
    const config = db.getConfig();
    if (config.emailDestinatarioPlaneamento && config.emailDestinatarioPlaneamento.includes('@')) {
      adminEmail = config.emailDestinatarioPlaneamento.trim().toLowerCase();
    }
  } catch {}

  emailsSet.add(adminEmail);
  emailsSet.add('hugo@grau-maquinaria.com');
  emailsSet.add('pinto@grau-maquinaria.com');

  const recipients = Array.from(emailsSet).filter(e => e && e.includes('@'));

  const cleanMatricula = (folha.matricula || 'Equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanNumero = (folha.numero || folha.id || 'FS').replace(/[^a-zA-Z0-9_-]/g, '_');
  const clienteNome = targetEmpresa?.nome || (folha as any).empresaNome || (folha as any).cliente || 'Cliente';
  const subject = `[Oficina HP] Folha de Serviço: ${folha.numero} - ${folha.matricula} (${clienteNome})`;

  // Generate PDF attachment
  const attachments: any[] = [];
  try {
    const doc = createFolhaServicoPDFDoc(folha, targetEmpresa, targetEquip);
    const pdfDataUri = doc.output('datauristring');
    const base64Content = pdfDataUri.split(',')[1];
    if (base64Content) {
      const filename = folha.tipo === 'Entrega e Formação'
        ? `Auto_Entrega_Formacao_${cleanMatricula}_${cleanNumero}.pdf`
        : `Folha_Servico_${cleanMatricula}_${cleanNumero}.pdf`;
      attachments.push({
        filename,
        content: base64Content,
        encoding: 'base64',
        contentType: 'application/pdf'
      });
      console.log(`[EmailService] 📎 PDF da folha ${folha.numero} gerado com sucesso.`);
    }
  } catch (pdfErr) {
    console.error('[EmailService] Erro ao gerar PDF da folha para anexo:', pdfErr);
  }

  // Se existirem fotos na folha, comprimir e anexar
  const rawFotos = folha.fotos || [];
  if (Array.isArray(rawFotos) && rawFotos.length > 0) {
    for (let i = 0; i < rawFotos.length; i++) {
      const foto = rawFotos[i];
      if (!foto) continue;
      try {
        const compressedBase64 = await resizeImageForEmail(foto, 1024, 0.7);
        if (compressedBase64) {
          attachments.push({
            filename: `Foto_${cleanMatricula}_${i + 1}.jpg`,
            content: compressedBase64,
            encoding: 'base64',
            contentType: 'image/jpeg'
          });
        }
      } catch {}
    }
  }

  // Build HTML Content
  const allServices = [...(folha.servicos || []), ...(folha.servicosAdicionais || [])];
  const allPecas = [...(folha.pecas || []), ...(folha.pecasAdicionais || [])];

  const servicesHtml = allServices.length === 0
    ? '<tr><td colspan="4" bgcolor="#ffffff" style="text-align: center; padding: 12px; color: #0f172a; font-style: italic; border: 1px solid #cbd5e1;">Nenhum serviço individual discriminado.</td></tr>'
    : allServices.map((s, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const isDone = s.concluido;
        return `
        <tr bgcolor="${rowBg}">
          <td style="padding: 8px 10px; color: #0f172a; font-weight: 500; border: 1px solid #cbd5e1;">${s.descricao}</td>
          <td style="padding: 8px 10px; text-align: center; font-family: monospace; font-weight: bold; color: #0f172a; border: 1px solid #cbd5e1;">${s.horas || 0}h</td>
          <td style="padding: 8px 10px; color: #0f172a; font-weight: 600; border: 1px solid #cbd5e1;">${s.tecnico || '-'}</td>
          <td style="padding: 8px 10px; text-align: center; border: 1px solid #cbd5e1;">
            <span style="background-color: ${isDone ? '#dcfce7' : '#fef3c7'}; color: ${isDone ? '#166534' : '#92400e'}; border: 1px solid ${isDone ? '#22c55e' : '#f59e0b'}; font-weight: 800; font-size: 11px; padding: 3px 8px; border-radius: 4px; display: inline-block;">
              ${isDone ? 'Concluído' : 'Pendente'}
            </span>
          </td>
        </tr>
      `;
      }).join('');

  const pecasHtml = allPecas.length === 0
    ? '<tr><td colspan="3" bgcolor="#ffffff" style="text-align: center; padding: 12px; color: #0f172a; font-style: italic; border: 1px solid #cbd5e1;">Nenhum material/peça registada.</td></tr>'
    : allPecas.map((p, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
        <tr bgcolor="${rowBg}">
          <td style="padding: 8px 10px; font-family: monospace; color: #0f172a; font-weight: 600; border: 1px solid #cbd5e1;">${p.referencia || '-'}</td>
          <td style="padding: 8px 10px; color: #0f172a; font-weight: 500; border: 1px solid #cbd5e1;">${p.designacao}</td>
          <td style="padding: 8px 10px; text-align: center; font-weight: bold; font-family: monospace; color: #0f172a; border: 1px solid #cbd5e1;">${p.qtd || 1}</td>
        </tr>
      `;
      }).join('');

  const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Folha de Serviço ${folha.numero} - Oficina HP</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 24px 28px; border-bottom: 4px solid #0284c7;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #38bdf8; font-family: 'Segoe UI', Arial, sans-serif;">
                    GRAUMP &bull; OFICINA HP &bull; REGISTO DE SERVIÇO
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #0284c7; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; display: inline-block;">
                      ${folha.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: 'Segoe UI', Arial, sans-serif;">
                      Folha de Serviço: ${folha.numero}
                    </h1>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif;">
                      Viatura / Equipamento: <strong style="color: #ffffff; font-family: monospace;">${folha.matricula}</strong> &bull; ${folha.marca || ''} ${folha.modelo || ''}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Callout Anexo -->
          <tr>
            <td style="padding: 20px 28px 0 28px;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 6px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; line-height: 1.4;">
                    📎 <strong>Documento Oficial Anexado:</strong> O documento oficial da Folha de Serviço em formato PDF segue em anexo a este email.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 28px;">
              
              <!-- Ficha Técnica -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                🚜 Identificação &amp; Ficha Técnica
              </h2>

              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 22px; border: 1px solid #cbd5e1; border-collapse: collapse; font-size: 13px;">
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; width: 32%; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Cliente / Entidade</td>
                  <td style="padding: 9px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${clienteNome}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Tipo &amp; Estado</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">
                    <strong>${folha.tipo}</strong> &bull; <span style="color: #0284c7; font-weight: 700;">${folha.status}</span>
                  </td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Data da Intervenção</td>
                  <td style="padding: 9px 12px; font-family: monospace; color: #0f172a; font-weight: 600; border-bottom: 1px solid #cbd5e1;">${formatDate(folha.data)}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Quilómetros / Horas</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${(folha.kmsAtuais || 0).toLocaleString('pt-PT')} Km &bull; ${folha.horasAtuais || 0} Horas</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-right: 1px solid #cbd5e1;">Local</td>
                  <td style="padding: 9px 12px; color: #0f172a;">${folha.localizacao || 'Oficina Geral'}</td>
                </tr>
              </table>

              ${allServices.length > 0 ? `
              <!-- Tabela Servicos -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                🔧 Serviços e Trabalhos Realizados
              </h2>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; border: 1px solid #cbd5e1; border-collapse: collapse; margin-bottom: 22px;">
                <thead>
                  <tr bgcolor="#e2e8f0" style="background-color: #e2e8f0; text-align: left; color: #0f172a;">
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Descrição</th>
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; text-align: center;">Horas</th>
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Técnico</th>
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; text-align: center;">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  ${servicesHtml}
                </tbody>
              </table>
              ` : ''}

              ${allPecas.length > 0 ? `
              <!-- Tabela Pecas -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                ⚙️ Peças e Materiais
              </h2>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 12.5px; border: 1px solid #cbd5e1; border-collapse: collapse; margin-bottom: 22px;">
                <thead>
                  <tr bgcolor="#e2e8f0" style="background-color: #e2e8f0; text-align: left; color: #0f172a;">
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Referência</th>
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1;">Designação</th>
                    <th style="padding: 10px 8px; font-weight: 800; font-size: 11px; text-transform: uppercase; border: 1px solid #cbd5e1; text-align: center;">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  ${pecasHtml}
                </tbody>
              </table>
              ` : ''}

              ${folha.anomalias || folha.notasCliente || folha.notasInternas ? `
              <!-- Observacoes -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 10px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; font-weight: 800;">
                📝 Observações e Anomalias
              </h2>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; line-height: 1.5;">
                    ${folha.anomalias ? `<div style="margin-bottom: 4px;"><strong>Anomalias / Diagnóstico:</strong> ${folha.anomalias}</div>` : ''}
                    ${folha.notasCliente ? `<div style="margin-bottom: 4px;"><strong>Notas Cliente:</strong> ${folha.notasCliente}</div>` : ''}
                    ${folha.notasInternas ? `<div><strong>Notas Internas:</strong> ${folha.notasInternas}</div>` : ''}
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Registo efetuado por -->
              <div style="font-size: 12px; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 12px;">
                Solicitado por: <strong style="color: #0f172a;">${cleanPersonName(currentUser?.nome || 'Utilizador')}</strong> (${currentUser?.email || 'N/A'}) &bull; ${new Date().toLocaleString('pt-PT')}
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 3px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
              <p style="margin: 0; color: #475569;">Notificação operacional gerada pelo sistema.</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Dispatch via /api/send-email
  let apiDeliverySuccess = false;
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent,
        attachments
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      apiDeliverySuccess = true;
      console.log(`[EmailService] ✅ Folha de Serviço ${folha.numero} enviada com sucesso para ${recipients.join(', ')}`);
    } else {
      console.warn('[EmailService] Resposta da API:', data);
    }
  } catch (apiErr) {
    console.warn('[EmailService] Erro ao contactar /api/send-email:', apiErr);
  }

  // Store in local logs and PocketBase
  try {
    const emailLogEntry = {
      id: db.generateId('eml'),
      tipo: 'envio_folha_servico',
      folhaId: folha.id,
      folhaNumero: folha.numero,
      matricula: folha.matricula,
      destinatarios: recipients,
      assunto: subject,
      dataEnvio: new Date().toISOString(),
      sucesso: apiDeliverySuccess
    };
    const logs = db.get<any>('oficina_hp_email_logs') || [];
    db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);

    const pb = getPocketBase();
    pb.collection('app_data').create({
      key: `email_folha_${folha.numero}_${Date.now()}`,
      data: {
        recipients,
        subject,
        tipo: 'envio_folha_servico',
        folhaNumero: folha.numero,
        matricula: folha.matricula,
        html: htmlContent,
        sent: apiDeliverySuccess
      },
      timestamp: new Date().toISOString()
    }).catch(() => {});
  } catch (e) {}

  return {
    success: true,
    recipients,
    message: apiDeliverySuccess
      ? `Email enviado com sucesso para: ${recipients.join(', ')}`
      : `Email registado para envio para: ${recipients.join(', ')}`
  };
}

export interface VisitaEmailPayload {
  visita: VisitaCliente;
  empresa?: Empresa;
  currentUser?: UserProfile;
}

/**
 * Envia email com os dados da visita/agendamento para o utilizador que inseriu
 * e para a direção técnica (hugo@grau-maquinaria.com).
 */
export async function sendVisitaEmail(payload: VisitaEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  const { visita, currentUser } = payload;
  const emailsSet = new Set<string>();

  if (currentUser?.email && currentUser.email.includes('@')) {
    emailsSet.add(currentUser.email.trim().toLowerCase());
  }

  let adminEmail = 'hugo@grau-maquinaria.com';
  try {
    const config = db.getConfig();
    if (config.emailDestinatarioPlaneamento && config.emailDestinatarioPlaneamento.includes('@')) {
      adminEmail = config.emailDestinatarioPlaneamento.trim().toLowerCase();
    }
  } catch {}

  emailsSet.add(adminEmail);
  emailsSet.add('hugo@grau-maquinaria.com');

  const recipients = Array.from(emailsSet).filter(e => e && e.includes('@'));
  const dataFormatada = formatDate(visita.data);
  const subject = `[Oficina HP] Agendamento de Visita: ${visita.nomeEmpresa} - ${dataFormatada} às ${visita.hora}`;

  const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Agendamento de Visita - ${visita.nomeEmpresa}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 24px 28px; border-bottom: 4px solid #059669;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle" style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #34d399; font-family: 'Segoe UI', Arial, sans-serif;">
                    GRAUMP &bull; OFICINA HP &bull; PLANEAMENTO DE VISITAS
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; font-family: 'Segoe UI', Arial, sans-serif; display: inline-block;">
                      ${visita.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 14px;">
                    <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; font-family: 'Segoe UI', Arial, sans-serif;">
                      Novo Agendamento de Visita ao Cliente
                    </h1>
                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif;">
                      Registo: <strong style="color: #ffffff; font-family: monospace;">${visita.numero}</strong> &bull; ${visita.nomeEmpresa}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 24px 28px;">
              
              <!-- Section Title -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #059669; padding-bottom: 6px; font-weight: 800;">
                📅 Detalhes do Agendamento
              </h2>

              <!-- Dados Principais da Visita -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 22px; border: 1px solid #cbd5e1; border-collapse: collapse; font-size: 13px;">
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; width: 35%; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Empresa / Cliente:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; font-size: 14px;">${visita.nomeEmpresa}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Data da Visita:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1;">${dataFormatada}</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Hora Prevista:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; font-family: monospace; border-bottom: 1px solid #cbd5e1;">${visita.hora}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Técnico / Responsável:</td>
                  <td style="padding: 10px 14px; color: #059669; font-weight: 700; border-bottom: 1px solid #cbd5e1;">${visita.tecnico}</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Motivo da Visita:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #cbd5e1;">${visita.motivo}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Pessoa de Contacto:</td>
                  <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${visita.nomeContacto || '<span style="color: #64748b; font-style: italic;">Não especificado</span>'}</td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Telefone:</td>
                  <td style="padding: 10px 14px; color: #0f172a; font-family: monospace; border-bottom: 1px solid #cbd5e1;">${visita.telefone || '<span style="color: #64748b; font-style: italic;">Não especificado</span>'}</td>
                </tr>
                <tr bgcolor="#ffffff">
                  <td style="padding: 10px 14px; color: #0f172a; font-weight: 700; border-right: 1px solid #cbd5e1;">Morada / Local:</td>
                  <td style="padding: 10px 14px; color: #0f172a;">${visita.morada || '<span style="color: #64748b; font-style: italic;">Não especificada</span>'}</td>
                </tr>
              </table>

              <!-- Notas / Observacoes -->
              <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; margin-top: 0; margin-bottom: 10px; border-bottom: 2px solid #059669; padding-bottom: 6px; font-weight: 800;">
                📝 Notas / Observações
              </h2>
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #059669; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 14px; font-size: 13px; color: #0f172a; line-height: 1.5; white-space: pre-wrap;">
                    ${visita.notas || 'Sem notas adicionais registadas.'}
                  </td>
                </tr>
              </table>

              <!-- Informacao de Registo -->
              <div style="font-size: 12px; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 12px;">
                Agendado por: <strong style="color: #0f172a;">${currentUser?.nome || visita.tecnico}</strong> ${currentUser?.email ? `(${currentUser.email})` : ''} &bull; Data de Registo: ${formatDate(visita.dataCriacao || new Date())}
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 4px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
              <p style="margin: 0; color: #475569;">GRAUMP &bull; hugo@grau-maquinaria.com</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  let apiDeliverySuccess = false;
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      apiDeliverySuccess = true;
      console.log(`[EmailService] ✅ Email de Agendamento de Visita enviado com sucesso para ${recipients.join(', ')}`);
    } else {
      console.warn('[EmailService] Resposta da API:', data);
    }
  } catch (apiErr) {
    console.warn('[EmailService] Erro ao contactar /api/send-email:', apiErr);
  }

  // Log in local storage
  try {
    const emailLogEntry = {
      id: db.generateId('eml'),
      tipo: 'agendamento_visita',
      visitaId: visita.id,
      visitaNumero: visita.numero,
      empresaNome: visita.nomeEmpresa,
      dataVisita: visita.data,
      tecnico: visita.tecnico,
      destinatarios: recipients,
      assunto: subject,
      dataEnvio: new Date().toISOString(),
      sucesso: apiDeliverySuccess
    };
    const logs = db.get<any>('oficina_hp_email_logs') || [];
    db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);
  } catch {}

  return {
    success: apiDeliverySuccess,
    recipients,
    message: apiDeliverySuccess
      ? `Email enviado com sucesso para: ${recipients.join(', ')}`
      : `Visita registada (não foi possível enviar email)`
  };
}

export interface NovoContactoEmailPayload {
  cliente: Cliente;
  empresa?: Empresa;
  currentUser?: UserProfile;
  isEdit?: boolean;
}

/**
 * Envia email com os dados do contacto/cliente para o utilizador que inseriu,
 * hugo@grau-maquinaria.com e pinto@grau-maquinaria.com
 */
export async function sendNovoContactoEmail(payload: NovoContactoEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  const { cliente, empresa, currentUser, isEdit } = payload;
  const emailsSet = new Set<string>();

  if (currentUser?.email && currentUser.email.includes('@')) {
    emailsSet.add(currentUser.email.trim().toLowerCase());
  }

  let adminEmail = 'hugo@grau-maquinaria.com';
  try {
    const config = db.getConfig();
    if (config.emailDestinatarioPlaneamento && config.emailDestinatarioPlaneamento.includes('@')) {
      adminEmail = config.emailDestinatarioPlaneamento.trim().toLowerCase();
    }
  } catch {}

  emailsSet.add(adminEmail);
  emailsSet.add('hugo@grau-maquinaria.com');
  emailsSet.add('pinto@grau-maquinaria.com');

  const recipients = Array.from(emailsSet).filter(e => e && e.includes('@'));
  const empresaNome = empresa?.nome || 'Cliente Particular / Sem Empresa';
  const subject = isEdit
    ? `[Oficina HP] Ficha de Contacto Atualizada: ${cliente.nome} (${empresaNome})`
    : `[Oficina HP] Novo Contacto Registado: ${cliente.nome} (${empresaNome})`;

  const nowStr = new Date().toLocaleDateString('pt-PT') + ' às ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${isEdit ? 'Ficha de Contacto Atualizada' : 'Novo Contacto Registado'} - ${cliente.nome}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="620" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Header -->
          <tr>
            <td bgcolor="#059669" style="background-color: #059669; padding: 22px 28px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #047857; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 9px; border-radius: 6px; margin-bottom: 8px;">
                      ${isEdit ? 'FICHA DE CONTACTO ATUALIZADA' : 'NOVO CONTACTO / CLIENTE'}
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                      ${cliente.nome}
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 13.5px; color: #d1fae5;">
                      Empresa: <strong>${empresaNome}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 24px 28px;">

              <!-- Status Banner -->
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ecfdf5" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="30" valign="middle" style="font-size: 20px; line-height: 1;">
                          👤
                        </td>
                        <td valign="middle">
                          <strong style="color: #065f46; font-size: 13.5px;">
                            ${isEdit ? 'Dados de Contacto Atualizados' : 'Novo Contacto Registado com Sucesso'}
                          </strong>
                          <div style="font-size: 12px; color: #047857; margin-top: 2px;">
                            Ficha registada no sistema de Gestão de Clientes & Contactos da Oficina HP.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Dados do Contacto -->
              <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
                Detalhes do Contacto
              </h3>

              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
                <tr bgcolor="#f8fafc">
                  <td width="38%" style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Nome Completo</td>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1;">${cliente.nome}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Empresa Parceira</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">
                    <strong>${empresaNome}</strong>
                    ${empresa?.nif ? `<br/><span style="color: #475569; font-size: 11.5px;">NIF: ${empresa.nif}</span>` : ''}
                    ${empresa?.moradaSede ? `<br/><span style="color: #475569; font-size: 11.5px;">Sede: ${empresa.moradaSede}</span>` : ''}
                  </td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Cargo / Função</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">${cliente.cargo || 'Responsável'}</td>
                </tr>
                <tr>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Telemóvel / Telefone</td>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1;">
                    ${cliente.telemovel ? `<a href="tel:${cliente.telemovel.replace(/\s+/g, '')}" style="color: #0284c7; text-decoration: none; font-weight: 700;">${cliente.telemovel}</a>` : '<span style="color: #94a3b8; font-style: italic;">Não especificado</span>'}
                  </td>
                </tr>
                <tr bgcolor="#f8fafc">
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Email</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1;">
                    ${cliente.email ? `<a href="mailto:${cliente.email.trim()}" style="color: #0284c7; text-decoration: none; font-weight: 700;">${cliente.email}</a>` : '<span style="color: #94a3b8; font-style: italic;">Não especificado</span>'}
                  </td>
                </tr>
                ${cliente.notas ? `
                <tr>
                  <td style="padding: 9px 12px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #cbd5e1;">Notas / Observações</td>
                  <td style="padding: 9px 12px; color: #0f172a; border-bottom: 1px solid #cbd5e1; white-space: pre-line;">${cliente.notas}</td>
                </tr>` : ''}
              </table>

              <!-- Informação de Registo -->
              <div style="font-size: 12px; color: #0f172a; border-top: 1px solid #cbd5e1; padding-top: 12px;">
                Registado por: <strong style="color: #0f172a;">${currentUser?.nome || 'Utilizador do Sistema'}</strong> ${currentUser?.email ? `(${currentUser.email})` : ''} &bull; Data: ${nowStr}
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 11.5px; color: #475569;">
              <p style="margin: 0 0 4px 0; color: #0f172a; font-weight: 700;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
              <p style="margin: 0; color: #475569;">GRAUMP &bull; hugo@grau-maquinaria.com &bull; pinto@grau-maquinaria.com</p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  let apiDeliverySuccess = false;
  try {
    const resp = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        subject,
        html: htmlContent
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && data.success) {
      apiDeliverySuccess = true;
      console.log(`[EmailService] ✅ Email de Contacto enviado com sucesso para ${recipients.join(', ')}`);
    } else {
      console.warn('[EmailService] Resposta da API:', data);
    }
  } catch (apiErr) {
    console.warn('[EmailService] Erro ao contactar /api/send-email:', apiErr);
  }

  // Log in local storage
  try {
    const emailLogEntry = {
      id: db.generateId('eml'),
      tipo: isEdit ? 'atualizacao_contacto' : 'novo_contacto',
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      empresaNome,
      destinatarios: recipients,
      assunto: subject,
      dataEnvio: new Date().toISOString(),
      sucesso: apiDeliverySuccess
    };
    const logs = db.get<any>('oficina_hp_email_logs') || [];
    db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);
  } catch {}

  return {
    success: apiDeliverySuccess,
    recipients,
    message: apiDeliverySuccess
      ? `Email enviado com sucesso para: ${recipients.join(', ')}`
      : `Contacto registado (não foi possível enviar email)`
  };
}

// -------------------------------------------------------------
// Weekly Planning (Planeamento Semanal) Email Notification & PDF
// -------------------------------------------------------------

export interface WeeklyPlaneamentoEmailPayload {
  destinatarios?: string[];
  weekStartDate?: Date;
  folhas?: FolhaServico[];
  visitas?: VisitaCliente[];
  empresas?: Empresa[];
}

function getMondayDate(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDaysToDate(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildWeeklyPlaneamentoHtml(options: {
  startDateStr: string;
  endDateStr: string;
  days: PlaneamentoSemanalDayCol[];
  totalFolhas: number;
  totalVisitas: number;
  uniqueTecnicos: string[];
  pdfFilename: string;
}): string {
  const { startDateStr, endDateStr, days, totalFolhas, totalVisitas, uniqueTecnicos, pdfFilename } = options;
  const activeDaysCount = days.filter(d => d.items.length > 0).length;

  const daysHtml = days.map(d => {
    const hasItems = d.items.length > 0;
    const itemsRows = hasItems
      ? d.items.map(item => {
          let badgeBg = '#059669';
          let badgeText = '#ffffff';
          if (item.type === 'visita') {
            badgeBg = '#0284c7';
          } else if (item.tipoOuMotivo?.toLowerCase().includes('assistência')) {
            badgeBg = '#d97706';
          } else if (item.tipoOuMotivo?.toLowerCase().includes('contrato')) {
            badgeBg = '#7c3aed';
          } else if (item.tipoOuMotivo?.toLowerCase().includes('oficina')) {
            badgeBg = '#059669';
          }

          const equipmentStr = [item.matricula, item.marcaModelo].filter(Boolean).join(' - ');
          const extraInfo = [item.localidade, item.contacto].filter(Boolean).join(' • ');

          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 12px; font-size: 12.5px; font-weight: 700; color: #1e293b; white-space: nowrap; vertical-align: top; width: 65px;">
                <span style="display: inline-block; background: #f1f5f9; padding: 3px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">
                  ${item.hora || '09:00'}
                </span>
              </td>
              <td style="padding: 10px 12px; font-size: 12.5px; vertical-align: top; width: 110px;">
                <span style="display: inline-block; background: ${badgeBg}; color: ${badgeText}; font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.04em;">
                  ${item.tipoOuMotivo || (item.type === 'visita' ? 'VISITA' : 'OFICINA')}
                </span>
                <div style="font-size: 11.5px; font-weight: 700; color: #0284c7; margin-top: 4px;">
                  ${item.numeroOuTitulo}
                </div>
              </td>
              <td style="padding: 10px 12px; font-size: 13px; vertical-align: top;">
                <div style="font-weight: 700; color: #0f172a; font-size: 13.5px;">${item.empresa}</div>
                ${equipmentStr ? `<div style="font-size: 12px; color: #475569; margin-top: 2px; font-weight: 500;">🚗 ${equipmentStr}</div>` : ''}
                ${extraInfo ? `<div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">📍 ${extraInfo}</div>` : ''}
                ${item.notas ? `<div style="font-size: 11.5px; color: #334155; background: #f8fafc; padding: 4px 8px; border-radius: 4px; margin-top: 4px; border-left: 2px solid #94a3b8; font-style: italic;">📝 ${item.notas}</div>` : ''}
              </td>
              <td style="padding: 10px 12px; font-size: 12.5px; color: #0f172a; vertical-align: top; width: 130px; text-align: right;">
                <span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-weight: 600; font-size: 11.5px; padding: 2px 8px; border-radius: 12px;">
                  👤 ${item.tecnico || 'Hugo Portugal'}
                </span>
                ${item.status ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;">${item.status}</div>` : ''}
              </td>
            </tr>
          `;
        }).join('')
      : `
        <tr>
          <td colspan="4" style="padding: 14px 16px; font-size: 12.5px; color: #94a3b8; text-align: center; font-style: italic;">
            Sem intervenções ou visitas agendadas para este dia.
          </td>
        </tr>
      `;

    return `
      <div style="margin-bottom: 20px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background: #f8fafc; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 14px; font-weight: 800; color: #0f172a;">
                📅 ${d.label} <span style="font-size: 13px; font-weight: 600; color: #64748b;">(${d.formattedDate})</span>
              </td>
              <td style="text-align: right; font-size: 12px; font-weight: 700; color: ${hasItems ? '#059669' : '#94a3b8'};">
                ${d.items.length} ${d.items.length === 1 ? 'marcação' : 'marcações'}
              </td>
            </tr>
          </table>
        </div>
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Planeamento Semanal - Oficina HP</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, h1, h2, h3, p, a, span { font-family: 'Segoe UI', Arial, Helvetica, sans-serif !important; }
    table { border-collapse: collapse; }
  </style>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light dark; }
    body { margin: 0; padding: 0; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #f1f5f9; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
  <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#f1f5f9" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table role="presentation" width="680" align="center" border="0" cellpadding="0" cellspacing="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width: 680px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="4" bgcolor="#059669" style="background-color: #059669; line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td bgcolor="#0f172a" style="background-color: #0f172a; padding: 26px 30px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: #059669; color: #ffffff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 10px; border-radius: 6px; margin-bottom: 8px;">
                      PLANEAMENTO SEMANAL • RELATÓRIO EXECUTIVO
                    </span>
                    <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                      Planeamento Técnico & Visitas
                    </h1>
                    <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">
                      Semana de <strong>${startDateStr}</strong> a <strong>${endDateStr}</strong> • Grau Maquinaria / Oficina HP
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- KPI Executive Metrics -->
          <tr>
            <td style="padding: 20px 28px 10px 28px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="25%" align="center" style="padding: 8px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #0284c7;">${totalFolhas}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Serviços Agendados</div>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding: 8px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #059669;">${totalVisitas}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Visitas a Clientes</div>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding: 8px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #7c3aed;">${uniqueTecnicos.length}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Técnicos Atribuídos</div>
                    </div>
                  </td>
                  <td width="25%" align="center" style="padding: 8px;">
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 24px; font-weight: 800; color: #d97706;">${activeDaysCount}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px;">Dias c/ Intervenções</div>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- PDF Attachment Notice Banner -->
          <tr>
            <td style="padding: 16px 28px 10px 28px;">
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px;">
                <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="30" valign="middle" style="font-size: 22px; line-height: 1;">
                      📎
                    </td>
                    <td valign="middle">
                      <strong style="color: #065f46; font-size: 13.5px;">
                        PDF A4 Paisagem Anexado: ${pdfFilename}
                      </strong>
                      <div style="font-size: 12px; color: #047857; margin-top: 2px;">
                        O mapa semanal executivo completo com colunas por dia está anexado a este email, pronto para consulta em ecrã ou impressão.
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Daily Schedule Sections -->
          <tr>
            <td style="padding: 16px 28px 24px 28px;">
              <h2 style="font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 14px 0; letter-spacing: -0.01em;">
                Agenda Detalhada por Dia
              </h2>
              ${daysHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 18px 28px; border-top: 1px solid #e2e8f0; text-align: center;">
              <div style="font-size: 12px; font-weight: 700; color: #475569;">
                Oficina HP • Grau Maquinaria
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
                Automação Semanal • Gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates the weekly planning A4 landscape PDF and sends it via email with an executive HTML summary.
 */
export async function sendWeeklyPlaneamentoEmail(payload?: WeeklyPlaneamentoEmailPayload): Promise<{
  success: boolean;
  recipients: string[];
  message: string;
}> {
  try {
    const rawFolhas = payload?.folhas || db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO) || [];
    const rawVisitas = payload?.visitas || db.get<VisitaCliente>(STORAGE_KEYS.VISITAS_CLIENTE) || [];
    const empresas = payload?.empresas || db.get<Empresa>(STORAGE_KEYS.EMPRESAS) || [];

    // Calculate Week Days: Monday to Sunday
    const monday = getMondayDate(payload?.weekStartDate || new Date());
    const weekDays = [
      { index: 0, label: 'Segunda-feira', short: 'Seg', date: addDaysToDate(monday, 0) },
      { index: 1, label: 'Terça-feira', short: 'Ter', date: addDaysToDate(monday, 1) },
      { index: 2, label: 'Quarta-feira', short: 'Qua', date: addDaysToDate(monday, 2) },
      { index: 3, label: 'Quinta-feira', short: 'Qui', date: addDaysToDate(monday, 3) },
      { index: 4, label: 'Sexta-feira', short: 'Sex', date: addDaysToDate(monday, 4) },
      { index: 5, label: 'Sábado', short: 'Sáb', date: addDaysToDate(monday, 5) },
      { index: 6, label: 'Domingo', short: 'Dom', date: addDaysToDate(monday, 6) }
    ].map(d => ({
      ...d,
      isoStr: formatIsoDate(d.date),
      formattedDate: `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}`
    }));

    // Filter current week items
    const weekIsoStrings = new Set(weekDays.map(d => d.isoStr));
    const currentWeekFolhas = rawFolhas.filter(f => {
      const targetDate = formatDateToInput(f.dataPlaneada || f.data);
      return weekIsoStrings.has(targetDate);
    });
    const currentWeekVisitas = rawVisitas.filter(v => {
      const targetDate = formatDateToInput(v.data);
      return weekIsoStrings.has(targetDate);
    });

    // Check weekend appointments
    const hasSabado = (
      currentWeekFolhas.some(f => formatDateToInput(f.dataPlaneada || f.data) === weekDays[5].isoStr) ||
      currentWeekVisitas.some(v => formatDateToInput(v.data) === weekDays[5].isoStr)
    );
    const hasDomingo = (
      currentWeekFolhas.some(f => formatDateToInput(f.dataPlaneada || f.data) === weekDays[6].isoStr) ||
      currentWeekVisitas.some(v => formatDateToInput(v.data) === weekDays[6].isoStr)
    );

    const activeDays = weekDays.filter(d => {
      if (d.index <= 4) return true; // Segunda a Sexta sempre
      if (d.index === 5) return hasSabado;
      if (d.index === 6) return hasDomingo;
      return false;
    });

    // Build Day Columns with Items
    const dayCols: PlaneamentoSemanalDayCol[] = activeDays.map(d => {
      const dayFolhas = currentWeekFolhas.filter(f => formatDateToInput(f.dataPlaneada || f.data) === d.isoStr);
      const dayVisitas = currentWeekVisitas.filter(v => formatDateToInput(v.data) === d.isoStr);

      const items: PlaneamentoSemanalDayItem[] = [
        ...dayFolhas.map((f): PlaneamentoSemanalDayItem => {
          const emp = empresas.find(e => e.id === f.empresaId);
          const local = f.localizacao?.trim() || f.moradaIntervencao?.trim() || f.localIntervencao?.trim() || '';
          const marcaModelo = `${f.marca || ''} ${f.modelo || ''}`.trim();
          const anomalia = (f.anomalias || f.notasInternas || '').trim();

          return {
            type: 'folha',
            hora: f.horaPlaneada || '09:00',
            numeroOuTitulo: f.numero,
            tipoOuMotivo: f.tipo,
            matricula: f.matricula,
            marcaModelo,
            empresa: emp?.nome || 'Cliente Geral',
            localidade: local,
            tecnico: f.tecnicoPlaneado || 'Hugo Portugal',
            status: f.status || 'Agendado',
            notas: anomalia
          };
        }),
        ...dayVisitas.map((v): PlaneamentoSemanalDayItem => {
          const contacto = [v.nomeContacto, v.telefone].filter(Boolean).join(' • ');
          return {
            type: 'visita',
            hora: v.hora || '09:30',
            numeroOuTitulo: 'VISITA',
            tipoOuMotivo: v.motivo || 'No Terreno',
            empresa: v.nomeEmpresa || 'Cliente',
            contacto,
            localidade: v.morada || '',
            tecnico: v.tecnico || 'Hugo Portugal',
            status: v.status || 'Agendada',
            notas: v.notas?.trim() || ''
          };
        })
      ];

      return {
        index: d.index,
        label: d.label,
        short: d.short,
        formattedDate: d.formattedDate,
        isoStr: d.isoStr,
        items
      };
    });

    const startDateStr = formatDate(weekDays[0].isoStr);
    const lastDayObj = activeDays[activeDays.length - 1];
    const endDateStr = formatDate(lastDayObj.isoStr);

    const totalFolhas = currentWeekFolhas.length;
    const totalVisitas = currentWeekVisitas.length;

    // Collect unique technicians
    const tecnicosSet = new Set<string>();
    dayCols.forEach(col => {
      col.items.forEach(it => {
        if (it.tecnico) tecnicosSet.add(it.tecnico);
      });
    });
    const uniqueTecnicos = Array.from(tecnicosSet);

    // 1. Generate Executive A4 Landscape PDF
    let base64Pdf = '';
    const pdfFilename = `Planeamento_Semanal_A4_${weekDays[0].isoStr}_a_${lastDayObj.isoStr}.pdf`;
    try {
      const doc = generatePlaneamentoSemanalA4PDF({
        days: dayCols,
        startDateStr,
        endDateStr,
        totalFolhas,
        totalVisitas
      });
      const dataUri = doc.output('datauristring');
      base64Pdf = dataUri.split(',')[1] || '';
    } catch (pdfErr) {
      console.error('[EmailService] Erro ao gerar PDF de Planeamento Semanal:', pdfErr);
    }

    const attachments: any[] = [];
    if (base64Pdf) {
      attachments.push({
        filename: pdfFilename,
        content: base64Pdf,
        encoding: 'base64',
        contentType: 'application/pdf'
      });
    }

    // 2. Build HTML Body
    const htmlContent = buildWeeklyPlaneamentoHtml({
      startDateStr,
      endDateStr,
      days: dayCols,
      totalFolhas,
      totalVisitas,
      uniqueTecnicos,
      pdfFilename
    });

    // 3. Resolve Recipients
    const emailsSet = new Set<string>();
    if (payload?.destinatarios && payload.destinatarios.length > 0) {
      payload.destinatarios.forEach(e => {
        if (e && e.includes('@')) emailsSet.add(e.trim().toLowerCase());
      });
    }

    // Retrieve from automations configuration if not specified
    try {
      const autos = db.get<any>(STORAGE_KEYS.AUTOMACOES) || [];
      const autoItem = autos.find((a: any) => a.tipo === 'email_planeamento');
      if (autoItem && Array.isArray(autoItem.destinatarios)) {
        autoItem.destinatarios.forEach((e: string) => {
          if (e && e.includes('@')) emailsSet.add(e.trim().toLowerCase());
        });
      }
    } catch {}

    // Default fallback
    if (emailsSet.size === 0) {
      emailsSet.add('hugo@grau-maquinaria.com');
    }

    const recipients = Array.from(emailsSet);
    const subject = `[Oficina HP] 📅 Planeamento Semanal (${startDateStr} a ${endDateStr})`;

    console.log(`[EmailService] A enviar Planeamento Semanal para: ${recipients.join(', ')} com anexo ${pdfFilename}`);

    // 4. Send email via /api/send-email
    let apiDeliverySuccess = false;
    let apiError = '';
    try {
      const resp = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject,
          html: htmlContent,
          attachments
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        apiDeliverySuccess = true;
        console.log(`[EmailService] ✅ Email de Planeamento Semanal enviado com sucesso via SMTP (ID: ${data.messageId})`);
      } else {
        apiError = data.error || `HTTP ${resp.status}`;
        console.warn('[EmailService] ⚠️ Resposta da API:', data);
      }
    } catch (apiErr: any) {
      apiError = apiErr?.message || 'Falha de rede';
      console.warn('[EmailService] ⚠️ Erro ao contactar /api/send-email:', apiErr);
    }

    // 5. Save email log
    try {
      const emailLogEntry = {
        id: db.generateId('eml'),
        tipo: 'email_planeamento_semanal',
        destinatarios: recipients,
        assunto: subject,
        dataEnvio: new Date().toISOString(),
        anexosCount: attachments.length,
        sucesso: apiDeliverySuccess,
        detalhes: {
          periodo: `${startDateStr} a ${endDateStr}`,
          totalFolhas,
          totalVisitas
        }
      };
      const logs = db.get<any>('oficina_hp_email_logs') || [];
      db.save('oficina_hp_email_logs', [emailLogEntry, ...logs.slice(0, 50)]);

      // Update automacao item last run
      const autos = db.get<any>(STORAGE_KEYS.AUTOMACOES) || [];
      const updatedAutos = autos.map((a: any) => a.tipo === 'email_planeamento' ? {
        ...a,
        ultimoDisparo: `Hoje às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      } : a);
      db.save(STORAGE_KEYS.AUTOMACOES, updatedAutos);

      // PocketBase queue backup
      const pb = getPocketBase();
      pb.collection('app_data').create({
        key: `email_planeamento_${Date.now()}`,
        data: {
          recipients,
          subject,
          tipo: 'planeamento_semanal',
          anexosCount: attachments.length,
          totalFolhas,
          totalVisitas,
          sent: apiDeliverySuccess
        },
        timestamp: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}

    return {
      success: apiDeliverySuccess,
      recipients,
      message: apiDeliverySuccess
        ? `Planeamento Semanal em PDF enviado com sucesso para: ${recipients.join(', ')}`
        : `Erro ao enviar email (${apiError || 'Serviço indisponível'}). Verifique o servidor de envio.`
    };
  } catch (error: any) {
    console.error('[EmailService] Exceção ao enviar planeamento semanal:', error);
    return {
      success: false,
      recipients: payload?.destinatarios || ['hugo@grau-maquinaria.com'],
      message: `Erro ao processar envio do planeamento semanal: ${error?.message || String(error)}`
    };
  }
}
