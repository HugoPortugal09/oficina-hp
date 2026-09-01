import { db, STORAGE_KEYS } from './dbService';
import { getPocketBase } from './pocketbase';
import type { Tarefa, UserProfile } from '../types';
import { USERS } from '../types';

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
            ${tarefa.criadoPorNome || 'Utilizador'} [<strong>${tarefa.criadoPorIniciais}</strong>] em ${tarefa.dataCriacao}
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
      sucesso: true
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
        html: htmlContent
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
    message: `Notificação enviada para ${recipients.join(', ')}`
  };
}
