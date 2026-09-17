import { db, STORAGE_KEYS } from './dbService';
import { getPocketBase } from './pocketbase';
import type { Tarefa, UserProfile, FolhaServico, Equipamento, Empresa } from '../types';
import { USERS } from '../types';
import { generateEntregaFormacaoPDF, generateTemposRespostaPDF } from './pdfService';
import { formatDate, getTodayFormatted, cleanPersonName, calculateDiffDays } from '../utils/dateUtils';

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
export function buildTaskNotificationHtml(
  action: 'CRIADA' | 'CONCLUIDA',
  tarefa: Tarefa,
  outrasTarefasAbertas: Tarefa[]
): string {
  const isCreated = action === 'CRIADA';
  const badgeColor = isCreated ? '#0284c7' : '#16a34a';
  const badgeText = isCreated ? 'NOVA TAREFA REGISTADA' : 'TAREFA CONCLUÍDA COM SUCESSO';
  const priorityColor =
    tarefa.prioridade === 'Crítica' || tarefa.prioridade === 'Urgente'
      ? '#dc2626'
      : tarefa.prioridade === 'Alta'
      ? '#ea580c'
      : tarefa.prioridade === 'Normal'
      ? '#0284c7'
      : '#64748b';

  // Table rows for remaining open tasks
  const openTasksRows = outrasTarefasAbertas.length === 0
    ? '<tr><td colspan="5" style="text-align: center; padding: 16px; color: #64748b; font-style: italic;">Não existem outras tarefas pendentes ou em curso no sistema.</td></tr>'
    : outrasTarefasAbertas.map(t => {
        const pColor =
          t.prioridade === 'Crítica' || t.prioridade === 'Urgente'
            ? '#dc2626'
            : t.prioridade === 'Alta'
            ? '#ea580c'
            : '#0284c7';
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-weight: bold; font-family: monospace; color: #0f172a;">${t.numero}</td>
            <td style="padding: 10px; color: #334155;">${t.descricao}</td>
            <td style="padding: 10px;"><span style="background-color: ${pColor}15; color: ${pColor}; font-weight: bold; font-size: 11px; padding: 2px 8px; border-radius: 6px; border: 1px solid ${pColor}40;">${t.prioridade}</span></td>
            <td style="padding: 10px; color: #475569; font-weight: 600;">${t.responsavel || '-'}</td>
            <td style="padding: 10px; color: #64748b; font-size: 12px;">${t.dataLimite || '-'}</td>
          </tr>
        `;
      }).join('');

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Notificação de Tarefa - Oficina HP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;">
  <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 28px 32px; border-bottom: 3px solid ${badgeColor};">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #38bdf8;">Oficina HP &bull; Gestão Operacional</span>
        <span style="background-color: ${badgeColor}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; text-transform: uppercase;">
          ${badgeText}
        </span>
      </div>
      <h1 style="margin: 12px 0 4px 0; font-size: 22px; font-weight: 800; color: #ffffff;">
        ${tarefa.numero}: ${tarefa.descricao}
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">
        Notificação automática de gestão de tarefas da oficina.
      </p>
    </div>

    <!-- Main Card Details -->
    <div style="padding: 28px 32px;">
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0; margin-bottom: 16px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
        📌 Detalhes da Tarefa
      </h2>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 35%;"><strong>Número:</strong></td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: bold; color: #0f172a; font-size: 14px;">${tarefa.numero}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Descrição:</strong></td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a; font-size: 14px;">${tarefa.descricao}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Responsável:</strong></td>
          <td style="padding: 8px 0; font-weight: 700; color: #0284c7; font-size: 14px;">${tarefa.responsavel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Prioridade:</strong></td>
          <td style="padding: 8px 0;">
            <span style="background-color: ${priorityColor}15; color: ${priorityColor}; font-weight: 800; font-size: 12px; padding: 3px 10px; border-radius: 6px; border: 1px solid ${priorityColor}40;">
              ${tarefa.prioridade}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Data Limite:</strong></td>
          <td style="padding: 8px 0; font-weight: 600; color: #334155; font-size: 13px;">${tarefa.dataLimite || 'Sem data limite definida'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px;"><strong>Criado Por:</strong></td>
          <td style="padding: 8px 0; color: #334155; font-size: 13px;">
            ${tarefa.criadoPorNome && tarefa.criadoPorNome !== 'IA' ? tarefa.criadoPorNome : 'Hugo Portugal'} [<strong>${tarefa.criadoPorIniciais === 'IA' ? 'HP' : (tarefa.criadoPorIniciais || 'HP')}</strong>] em ${tarefa.dataCriacao}
          </td>
        </tr>
        ${action === 'CONCLUIDA' ? `
        <tr>
          <td style="padding: 8px 0; color: #16a34a; font-size: 13px;"><strong>Concluído Por:</strong></td>
          <td style="padding: 8px 0; color: #16a34a; font-weight: bold; font-size: 13px;">
            ${tarefa.concluidoPorNome || ''} [<strong>${tarefa.concluidoPorIniciais}</strong>] em ${tarefa.dataConclusao}
          </td>
        </tr>
        ` : ''}
        ${tarefa.notasAdicionais ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;"><strong>Notas / Obs:</strong></td>
          <td style="padding: 8px 0; color: #475569; font-size: 13px; background-color: #f8fafc; padding: 8px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
            ${tarefa.notasAdicionais}
          </td>
        </tr>
        ` : ''}
      </table>

      <!-- Remaining Open Tasks Section -->
      <div style="margin-top: 32px;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-top: 0; margin-bottom: 12px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px;">
          📋 Quadro de Tarefas Abertas no Sistema (Total: ${outrasTarefasAbertas.length})
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8fafc; text-align: left; color: #475569; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">
              <th style="padding: 10px; font-weight: 700;">Nº</th>
              <th style="padding: 10px; font-weight: 700;">Descrição</th>
              <th style="padding: 10px; font-weight: 700;">Prioridade</th>
              <th style="padding: 10px; font-weight: 700;">Responsável</th>
              <th style="padding: 10px; font-weight: 700;">Limite</th>
            </tr>
          </thead>
          <tbody>
            ${openTasksRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
      <p style="margin: 0 0 4px 0;"><strong>Oficina HP</strong> &bull; Sistema Integrado de Gestão Mecânica &amp; Frotas</p>
      <p style="margin: 0;">Este é um email automático de notificação operacional enviado pelo sistema.</p>
    </div>

  </div>
</body>
</html>
  `;
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

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Registo de Entrega e Formação - Oficina HP</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5;">
  <div style="max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Header -->
    <div style="padding: 24px 28px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">
        GRAUMP &bull; OFICINA HP &bull; REGISTO OPERACIONAL
      </div>
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 700; color: #0f172a;">
        Auto de Entrega e Formação: ${folha.matricula || 'Equipamento'}
      </h1>
      <div style="font-size: 13px; color: #64748b;">
        Folha de Serviço: <strong style="color: #0f172a; font-family: monospace;">${folha.numero}</strong> &bull; ${folha.marca || ''} ${folha.modelo || ''}
      </div>
    </div>

    <!-- Attachment Notification Callout -->
    <div style="margin: 20px 28px 0 28px; padding: 12px 16px; background-color: #f1f5f9; border-left: 3px solid #0284c7; border-radius: 4px; font-size: 13px; color: #334155;">
      📎 <strong>Documento Oficial Anexado:</strong> O Certificado / Auto de Entrega e Formação em formato PDF com o layout gráfico completo e campos de assinatura segue em anexo a este email.
    </div>

    <!-- Main Content -->
    <div style="padding: 20px 28px;">
      
      <!-- Dados Entrega e Formacao -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <tr>
          <td style="padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; width: 50%; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
              📦 Entrega
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color: #64748b;">Data:</span> <strong style="color: #0f172a;">${dataEntrega}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Entregue por:</span> <strong style="color: #0f172a;">${entregaPor}</strong>
            </div>
          </td>
          <td style="padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; width: 50%; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 6px;">
              🎓 Formação
            </div>
            <div style="margin-bottom: 4px;">
              <span style="color: #64748b;">Data:</span> <strong style="color: #0f172a;">${dataFormacao}</strong>
            </div>
            <div>
              <span style="color: #64748b;">Formador:</span> <strong style="color: #0f172a;">${formacaoPor}</strong>
            </div>
          </td>
        </tr>
      </table>

      <!-- Ficha Técnica do Equipamento -->
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px;">
        Ficha do Equipamento / Viatura
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; width: 35%; background-color: #f8fafc;">Matrícula</td>
          <td style="padding: 8px 12px; font-family: monospace; font-weight: 700; color: #0f172a;">${folha.matricula || '---'}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Marca / Modelo</td>
          <td style="padding: 8px 12px; color: #0f172a;">${folha.marca || ''} ${folha.modelo || ''}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Nº de Série (VIN)</td>
          <td style="padding: 8px 12px; font-family: monospace; color: #334155;">${nSerie}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Quilómetros / Horas</td>
          <td style="padding: 8px 12px; color: #0f172a;">${kms.toLocaleString('pt-PT')} Km &bull; ${horas} Horas</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Cliente / Entidade</td>
          <td style="padding: 8px 12px; color: #0f172a; font-weight: 600;">${clienteNome}</td>
        </tr>
        ${folha.pessoaPresente ? `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Pessoa Presente</td>
          <td style="padding: 8px 12px; color: #0f172a;">${folha.pessoaPresente}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px 12px; color: #64748b; background-color: #f8fafc;">Local da Intervenção</td>
          <td style="padding: 8px 12px; color: #334155;">${folha.localizacao || 'Oficina Geral'}</td>
        </tr>
      </table>

      ${folha.anomalias || folha.notasCliente || folha.notasInternas ? `
      <!-- Observações -->
      <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px;">
        Observações Técnicas
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; font-size: 13px; color: #334155; margin-bottom: 20px;">
        ${folha.anomalias ? `<div style="margin-bottom: 4px;"><strong>Trabalhos / Descrição:</strong> ${folha.anomalias}</div>` : ''}
        ${folha.notasCliente ? `<div style="margin-bottom: 4px;"><strong>Notas Cliente:</strong> ${folha.notasCliente}</div>` : ''}
        ${folha.notasInternas ? `<div><strong>Notas Internas:</strong> ${folha.notasInternas}</div>` : ''}
      </div>
      ` : ''}

      <!-- Registo efetuado por -->
      <div style="font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px;">
        Registo efetuado por: <strong style="color: #0f172a;">${cleanPersonName(currentUser?.nome || folha.criadoPor || folha.entregaPor || 'Hugo Portugal')}</strong> &bull; ${new Date().toLocaleString('pt-PT')}
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 28px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #94a3b8;">
      <p style="margin: 0 0 2px 0;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
      <p style="margin: 0;">Notificação operacional gerada automaticamente pelo sistema.</p>
    </div>

  </div>
</body>
</html>
  `;
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
    ? '<tr><td colspan="5" style="text-align: center; padding: 14px; color: #16a34a; font-weight: 600;">✅ Excelente! Não existem viaturas em estado crítico (≥ 10 dias) de momento.</td></tr>'
    : criticalRows.map(r => {
        const imobText = r.imobilizacao ? r.imobilizacao.text : '-';
        const reqText = r.diasRequisicao ? r.diasRequisicao.text : '-';
        return `
          <tr style="border-bottom: 1px solid #fee2e2;">
            <td style="padding: 10px 8px; font-weight: bold; font-family: monospace; color: #0f172a;">${r.folha.numero}</td>
            <td style="padding: 10px 8px; font-family: monospace; font-weight: bold; color: #dc2626;">${r.folha.matricula || '-'}</td>
            <td style="padding: 10px 8px; color: #334155;">${r.empresaNome}</td>
            <td style="padding: 10px 8px; font-weight: bold; color: #dc2626;">${imobText} (Oficina) / ${reqText} (Req.)</td>
            <td style="padding: 10px 8px; color: #64748b; font-size: 12px;">${r.folha.status}</td>
          </tr>
        `;
      }).join('');

  return `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Tempos de Resposta &amp; Imobilização - Relatório Diário</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; line-height: 1.5;">
  <div style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Top Header -->
    <div style="background: linear-gradient(135deg, #0b1528 0%, #1e293b 100%); color: #ffffff; padding: 26px 30px; border-bottom: 3px solid #0d9488;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #2dd4bf;">GRAUMP &bull; OFICINA HP &bull; FROTAS</span>
        <span style="background-color: #0d9488; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 14px; text-transform: uppercase;">
          DISPARO DIÁRIO DAS 06H00
        </span>
      </div>
      <h1 style="margin: 4px 0 2px 0; font-size: 20px; font-weight: 800; color: #ffffff;">
        Quadro Diário de Tempos de Resposta &amp; Imobilização
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">
        Relatório de controlo operacional emitido a <strong>${dataHoje}</strong>.
      </p>
    </div>

    <!-- Main Content Body -->
    <div style="padding: 24px 30px;">
      
      <!-- Section Title -->
      <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-top: 0; margin-bottom: 14px; font-weight: 800; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">
        📊 Resumo Executivo &amp; Médias Operacionais
      </h2>

      <!-- 4 KPI Cards Grid (Universal Table Layout) -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px;">
        <tr>
          <!-- Card 1: Imobilização Média -->
          <td style="width: 50%; background-color: #fff7ed; border: 1px solid #ffedd5; border-left: 4px solid #ea580c; border-radius: 8px; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #9a3412; text-transform: uppercase; margin-bottom: 4px;">
              ⏱️ Imobilização Média (Oficina)
            </div>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #c2410c;">
              ${stats.avgImobilizacaoOficina.toFixed(1)} <span style="font-size: 13px; font-weight: 500; color: #7c2d12;">dias</span>
            </div>
            <div style="font-size: 11px; color: #9a3412; margin-top: 2px;">
              Média desde a entrada na oficina
            </div>
          </td>

          <!-- Card 2: Média Requisição -->
          <td style="width: 50%; background-color: #f0f9ff; border: 1px solid #e0f2fe; border-left: 4px solid #0284c7; border-radius: 8px; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #075985; text-transform: uppercase; margin-bottom: 4px;">
              📅 Média desde Requisição
            </div>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0284c7;">
              ${stats.avgDiasReq.toFixed(1)} <span style="font-size: 13px; font-weight: 500; color: #0369a1;">dias</span>
            </div>
            <div style="font-size: 11px; color: #075985; margin-top: 2px;">
              Para serviços com requisição
            </div>
          </td>
        </tr>

        <tr>
          <!-- Card 3: Viaturas Críticas -->
          <td style="width: 50%; background-color: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #e11d48; border-radius: 8px; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #9f1239; text-transform: uppercase; margin-bottom: 4px;">
              🚨 Viaturas Críticas (&ge; 10 dias)
            </div>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #be123c;">
              ${stats.criticalCount} <span style="font-size: 13px; font-weight: 500; color: #9f1239;">viaturas</span>
            </div>
            <div style="font-size: 11px; color: #9f1239; margin-top: 2px;">
              Imobilização ou requisição &ge; 10 dias
            </div>
          </td>

          <!-- Card 4: Serviços em Aberto -->
          <td style="width: 50%; background-color: #f0fdfa; border: 1px solid #ccfbf1; border-left: 4px solid #0d9488; border-radius: 8px; padding: 12px 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #115e59; text-transform: uppercase; margin-bottom: 4px;">
              🔧 Serviços em Aberto
            </div>
            <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #0f766e;">
              ${stats.totalAbertas} <span style="font-size: 13px; font-weight: 500; color: #134e4a;">em curso</span>
            </div>
            <div style="font-size: 11px; color: #115e59; margin-top: 2px;">
              Oficina (${stats.totalOficinaAbertas}) &bull; AT (${stats.totalAssistenciaAbertas}) &bull; Contratos (${stats.totalContratoAbertas})
            </div>
          </td>
        </tr>
      </table>

      <!-- Attachments Notice Banner -->
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: bold; color: #0f172a; margin-bottom: 6px;">
          📎 3 Documentos Oficiais em PDF Formato A3 Anexados a este Email:
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #334155;">
          <li style="margin-bottom: 4px;"><strong>1. Tempos_Resposta_Oficina.pdf</strong> — Quadro de acompanhamento detalhado apenas da Oficina.</li>
          <li style="margin-bottom: 4px;"><strong>2. Tempos_Resposta_Assistencia_Contratos.pdf</strong> — Quadro com Assistência Técnica no terreno e Contratos.</li>
          <li style="margin-bottom: 0;"><strong>3. Tempos_Resposta_Geral_Completo.pdf</strong> — Quadro Geral completo com toda a informação operacional.</li>
        </ul>
        <div style="margin-top: 8px; font-size: 11px; color: #64748b; font-style: italic;">
          * Nota: Em cumprimento das diretrizes de apresentação, os ficheiros PDF anexos contêm apenas as tabelas detalhadas em formato A3 horizontal para fácil impressão ou consulta em grande ecrã, sem o cabeçalho de médias.
        </div>
      </div>

      <!-- Critical Vehicles Mini Table (If any) -->
      ${stats.criticalCount > 0 ? `
      <div style="margin-top: 20px;">
        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #be123c; margin-top: 0; margin-bottom: 10px; font-weight: 800;">
          ⚠️ Viaturas e Serviços Críticos em Atenção Imediata (${stats.criticalCount})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; background-color: #ffffff; border: 1px solid #fecdd3; border-radius: 6px; overflow: hidden;">
          <thead>
            <tr style="background-color: #fff1f2; text-align: left; color: #9f1239; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #fecdd3;">
              <th style="padding: 8px; font-weight: 700;">Folha</th>
              <th style="padding: 8px; font-weight: 700;">Matrícula</th>
              <th style="padding: 8px; font-weight: 700;">Cliente</th>
              <th style="padding: 8px; font-weight: 700;">Dias</th>
              <th style="padding: 8px; font-weight: 700;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${criticalTableRows}
          </tbody>
        </table>
      </div>
      ` : ''}

    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 18px 30px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11.5px; color: #94a3b8;">
      <p style="margin: 0 0 3px 0;"><strong>Oficina HP &bull; GRAUMP Maquinaria Portugal</strong></p>
      <p style="margin: 0;">Disparo automático diário às 06:00 (Dias de semana) &bull; hugo@grau-maquinaria.com</p>
    </div>

  </div>
</body>
</html>
  `;
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
      : ['hugo@grau-maquinaria.com'];

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
