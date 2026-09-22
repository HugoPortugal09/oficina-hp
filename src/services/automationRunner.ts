import { db, STORAGE_KEYS } from './dbService';
import { sendWeeklyPlaneamentoEmail, sendDailyTemposRespostaEmail } from './emailService';
import type { AutomacaoItem } from '../types';

/**
 * Returns ISO week format string, e.g. "2026-W39"
 */
function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Returns date format string "YYYY-MM-DD"
 */
function getTodayIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let isRunningCheck = false;

/**
 * Evaluates active automations and executes those whose trigger conditions are met.
 */
export async function checkAndExecuteDueAutomations(): Promise<void> {
  if (isRunningCheck) return;
  isRunningCheck = true;

  try {
    const automacoes = db.get<AutomacaoItem>(STORAGE_KEYS.AUTOMACOES);
    if (!automacoes || automacoes.length === 0) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentWeekKey = getIsoWeek(now);
    const todayIso = getTodayIsoDate(now);

    let hasUpdates = false;
    const updatedAutos = [...automacoes];

    for (let i = 0; i < updatedAutos.length; i++) {
      const auto = updatedAutos[i];
      if (!auto.ativo) continue;

      // 1. Weekly Planning Email (Todas as Segundas-feiras às 07:30)
      if (auto.tipo === 'email_planeamento') {
        const isMonday = dayOfWeek === 1;
        const isPastScheduledTime = currentMinutes >= (7 * 60 + 30); // >= 07:30
        const storageKey = `oficina_hp_last_run_week_${auto.id}`;
        const lastSentWeek = localStorage.getItem(storageKey);

        const alreadyFiredWeek = auto.ultimoDisparo && auto.ultimoDisparo.includes('Hoje');
        if (isMonday && isPastScheduledTime && lastSentWeek !== currentWeekKey && !alreadyFiredWeek) {
          console.log(`[AutomationRunner] 🚀 A disparar envio semanal de planeamento (${currentWeekKey}) para: ${auto.destinatarios.join(', ')}`);
          try {
            const res = await sendWeeklyPlaneamentoEmail({ destinatarios: auto.destinatarios });
            if (res.success) {
              localStorage.setItem(storageKey, currentWeekKey);
              const nowFormatted = `Hoje às ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              updatedAutos[i] = { ...auto, ultimoDisparo: nowFormatted };
              hasUpdates = true;
              console.log(`[AutomationRunner] ✅ Planeamento semanal enviado automaticamente com sucesso.`);
            } else {
              console.warn(`[AutomationRunner] ⚠️ Falha no envio do planeamento semanal:`, res.message);
            }
          } catch (autoErr) {
            console.error(`[AutomationRunner] ❌ Erro ao executar planeamento semanal:`, autoErr);
          }
        }
      }

      // 2. Daily Response Times & Immobilization Email (Dias de semana às 06:00)
      if (auto.tipo === 'email_tempos_resposta') {
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isPastScheduledTime = currentMinutes >= (6 * 60); // >= 06:00
        const storageKey = `oficina_hp_last_run_day_${auto.id}`;
        const lastSentDay = localStorage.getItem(storageKey);
        const alreadyFiredToday = auto.ultimoDisparo && auto.ultimoDisparo.includes('Hoje');

        if (isWeekday && isPastScheduledTime && lastSentDay !== todayIso && !alreadyFiredToday) {
          console.log(`[AutomationRunner] 🚀 A disparar envio diário de tempos de resposta (${todayIso}) para: ${auto.destinatarios.join(', ')}`);
          try {
            const res = await sendDailyTemposRespostaEmail({ destinatarios: auto.destinatarios });
            if (res.success) {
              localStorage.setItem(storageKey, todayIso);
              const nowFormatted = `Hoje às ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
              updatedAutos[i] = { ...auto, ultimoDisparo: nowFormatted };
              hasUpdates = true;
              console.log(`[AutomationRunner] ✅ Tempos de resposta enviado automaticamente com sucesso.`);
            } else {
              console.warn(`[AutomationRunner] ⚠️ Falha no envio de tempos de resposta:`, res.message);
            }
          } catch (autoErr) {
            console.error(`[AutomationRunner] ❌ Erro ao executar tempos de resposta:`, autoErr);
          }
        }
      }
    }

    if (hasUpdates) {
      db.save(STORAGE_KEYS.AUTOMACOES, updatedAutos);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed'));
      }
    }
  } catch (err) {
    console.error('[AutomationRunner] Erro ao verificar automações:', err);
  } finally {
    isRunningCheck = false;
  }
}

/**
 * Initializes background interval to check automations periodically.
 * Returns cleanup callback.
 */
export function startAutomationRunner(): () => void {
  // Initial check after app mount and initial data sync (6 seconds)
  const initialTimer = setTimeout(() => {
    checkAndExecuteDueAutomations().catch(() => {});
  }, 6000);

  // Periodic recurring check every 4 minutes
  const intervalId = setInterval(() => {
    checkAndExecuteDueAutomations().catch(() => {});
  }, 4 * 60 * 1000);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(intervalId);
  };
}
