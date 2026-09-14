import { db, STORAGE_KEYS } from './dbService';
import { getPocketBase } from './pocketbase';
import type { Tarefa, UserProfile, FolhaServico, Equipamento, Empresa } from '../types';
import { USERS } from '../types';
import { generateEntregaFormacaoPDF } from './pdfService';
import { formatDate, cleanPersonName } from '../utils/dateUtils';

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

  } catch (e: any) {
    console.warn('[EmailService] Notice:', e?.message || e);
  }

  return {
    success: true,
    recipients,
    message: apiDeliverySuccess 
      ? `Email enviado com sucesso para: ${recipients.join(', ')}`
      : `Notificação registada para envio para: ${recipients.join(', ')}`
  };
}

