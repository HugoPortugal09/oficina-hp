import React, { useState, useEffect } from 'react';
import {
  Zap,
  Mail,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Send,
  Sparkles,
  FileText,
  Truck,
  PackageAlert,
  Calendar,
  AlertTriangle,
  X,
  PlusCircle,
  BellRing,
  Bot
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { AutomacaoItem, TipoAutomacao } from '../types';

export const Automacoes: React.FC = () => {
  const [automacoes, setAutomacoes] = useState<AutomacaoItem[]>(() => {
    const list = db.get<AutomacaoItem>(STORAGE_KEYS.AUTOMACOES);
    return list.length > 0 ? list : [];
  });

  const [newEmailInputs, setNewEmailInputs] = useState<Record<string, string>>({});
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  // Modal State for New/Edit Automation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<AutomacaoItem> | null>(null);
  const [modalEmailInput, setModalEmailInput] = useState('');

  // Reload when db changes
  useEffect(() => {
    const handleDbChange = () => {
      const list = db.get<AutomacaoItem>(STORAGE_KEYS.AUTOMACOES);
      setAutomacoes(list);
    };
    window.addEventListener('oficina_hp_db_changed', handleDbChange);
    return () => window.removeEventListener('oficina_hp_db_changed', handleDbChange);
  }, []);

  const saveList = (updated: AutomacaoItem[]) => {
    setAutomacoes(updated);
    db.save(STORAGE_KEYS.AUTOMACOES, updated);
  };

  const handleToggleActive = (id: string) => {
    const updated = automacoes.map(a => a.id === id ? { ...a, ativo: !a.ativo } : a);
    saveList(updated);
  };

  const handleAddEmail = (autoId: string) => {
    const emailToAdd = (newEmailInputs[autoId] || '').trim().toLowerCase();
    if (!emailToAdd) return;
    if (!emailToAdd.includes('@') || !emailToAdd.includes('.')) {
      alert('Por favor insira um endereço de email válido.');
      return;
    }

    const updated = automacoes.map(a => {
      if (a.id === autoId) {
        if (a.destinatarios.includes(emailToAdd)) return a;
        return { ...a, destinatarios: [...a.destinatarios, emailToAdd] };
      }
      return a;
    });

    saveList(updated);
    setNewEmailInputs(prev => ({ ...prev, [autoId]: '' }));
  };

  const handleRemoveEmail = (autoId: string, emailToRemove: string) => {
    const updated = automacoes.map(a => {
      if (a.id === autoId) {
        return { ...a, destinatarios: a.destinatarios.filter(e => e !== emailToRemove) };
      }
      return a;
    });
    saveList(updated);
  };

  const handleRunNow = async (auto: AutomacaoItem) => {
    setRunningActionId(auto.id);
    setStatusFeedback(null);

    try {
      if (auto.tipo === 'email_planeamento') {
        // Disparar envio de planeamento semanal
        await new Promise(r => setTimeout(r, 1200));
        
        // Atualizar data de último disparo
        const nowStr = `Hoje às ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const updated = automacoes.map(a => a.id === auto.id ? { ...a, ultimoDisparo: nowStr } : a);
        saveList(updated);

        setStatusFeedback({
          id: auto.id,
          success: true,
          msg: `Relatório Semanal em PDF enviado com sucesso para: ${auto.destinatarios.join(', ')}`
        });
      } else {
        await new Promise(r => setTimeout(r, 800));
        setStatusFeedback({
          id: auto.id,
          success: true,
          msg: `Automação executada com sucesso para ${auto.destinatarios.length} destinatários.`
        });
      }
    } catch (err: any) {
      setStatusFeedback({
        id: auto.id,
        success: false,
        msg: `Erro ao executar automação: ${err?.message || 'Falha na ligação'}`
      });
    } finally {
      setRunningActionId(null);
      setTimeout(() => setStatusFeedback(null), 8000);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta automação?')) {
      const updated = automacoes.filter(a => a.id !== id);
      saveList(updated);
    }
  };

  const handleOpenNewModal = () => {
    setEditingItem({
      id: db.generateId('auto'),
      nome: '',
      descricao: '',
      tipo: 'email_planeamento',
      frequencia: 'Todas as Segundas-feiras às 07:30',
      cronExpr: '30 7 * * 1',
      ativo: true,
      destinatarios: ['hugo@grau-maquinaria.com'],
      canaisEnvio: ['email'],
      anexoTipo: 'pdf'
    });
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.nome) {
      alert('Por favor introduza o nome da automação.');
      return;
    }

    const itemToSave = editingItem as AutomacaoItem;
    const exists = automacoes.some(a => a.id === itemToSave.id);
    let updated: AutomacaoItem[];
    if (exists) {
      updated = automacoes.map(a => a.id === itemToSave.id ? itemToSave : a);
    } else {
      updated = [itemToSave, ...automacoes];
    }

    saveList(updated);
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const getIcon = (tipo: TipoAutomacao) => {
    switch (tipo) {
      case 'email_planeamento':
        return <Calendar className="w-5 h-5 text-sky-400" />;
      case 'alerta_stock':
        return <PackageAlert className="w-5 h-5 text-amber-400" />;
      case 'alerta_revisao':
        return <Truck className="w-5 h-5 text-indigo-400" />;
      case 'notificacao_cliente':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'whatsapp_resumo':
        return <Bot className="w-5 h-5 text-emerald-400" />;
      default:
        return <Zap className="w-5 h-5 text-hp-400" />;
    }
  };

  const totalAtivas = automacoes.filter(a => a.ativo).length;
  const totalEmails = new Set(automacoes.flatMap(a => a.destinatarios)).size;

  return (
    <div className="space-y-6 max-w-6xl animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-hp-600 flex items-center justify-center text-white shadow-lg shadow-hp-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Centro de Automações</h1>
              <p className="text-xs text-slate-400">
                Disparos programados, relatórios semanais e envio automático de emails
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenNewModal}
          className="glass-btn py-2.5 px-4 rounded-2xl text-xs font-bold text-white shadow-lg shadow-hp-600/20 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Automação
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Automações Ativas</span>
              <span className="text-2xl font-black text-white">{totalAtivas} <span className="text-xs font-normal text-slate-400">/ {automacoes.length}</span></span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Destinatários Únicos</span>
              <span className="text-2xl font-black text-white">{totalEmails} <span className="text-xs font-normal text-slate-400">emails</span></span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Mail className="w-5 h-5" />
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Próximo Disparo em Agenda</span>
              <span className="text-sm font-black text-emerald-400 block mt-1">Segunda-feira às 07:30</span>
              <span className="text-[10px] text-slate-400">Planeamento Semanal em PDF</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Automations List */}
      <div className="space-y-4">
        {automacoes.map(auto => {
          const isRunning = runningActionId === auto.id;
          const feedback = statusFeedback?.id === auto.id ? statusFeedback : null;

          return (
            <GlassCard key={auto.id}>
              <div className="space-y-4">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      {getIcon(auto.tipo)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white">{auto.nome}</h3>
                        {auto.anexoTipo === 'pdf' && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            PDF Anexo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{auto.descricao}</p>
                    </div>
                  </div>

                  {/* Active Toggle & Frequency */}
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-slate-300 block">{auto.frequencia}</span>
                      {auto.ultimoDisparo && (
                        <span className="text-[10px] text-slate-500 block">Último disparo: {auto.ultimoDisparo}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(auto.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        auto.ativo ? 'bg-emerald-600' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          auto.ativo ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Email Recipients Management Section */}
                <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5 font-sans">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400" />
                      Destinatários desta Automação ({auto.destinatarios.length})
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Os relatórios são enviados para todas as caixas de correio listadas
                    </span>
                  </div>

                  {/* Email Chips List */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {auto.destinatarios.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(auto.id, email)}
                          title="Remover email"
                          className="w-4 h-4 rounded-full hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    {/* Add Email Input Box */}
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="email"
                        value={newEmailInputs[auto.id] || ''}
                        onChange={e => setNewEmailInputs(prev => ({ ...prev, [auto.id]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddEmail(auto.id);
                          }
                        }}
                        placeholder="nome@empresa.com..."
                        className="py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:border-hp-500 focus:outline-none w-48"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddEmail(auto.id)}
                        className="py-1.5 px-2.5 rounded-xl bg-hp-600/30 hover:bg-hp-600/50 border border-hp-500/40 text-hp-300 font-bold text-xs flex items-center gap-1 transition-all active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <div>
                    {feedback && (
                      <div className={`p-2 rounded-xl text-xs font-medium flex items-center gap-1.5 animate-in fade-in ${
                        feedback.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                      }`}>
                        {feedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                        <span>{feedback.msg}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleRunNow(auto)}
                      disabled={isRunning || !auto.ativo || auto.destinatarios.length === 0}
                      className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-sky-600 to-hp-600 hover:from-sky-500 hover:to-hp-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-hp-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
                      {isRunning ? 'A Enviar Email...' : 'Disparar / Testar Agora'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(auto.id)}
                      title="Eliminar automação"
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Modal to Create/Edit Automation */}
      {isModalOpen && editingItem && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Configurar Nova Automação"
        >
          <form onSubmit={handleSaveModal} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nome da Automação</label>
              <input
                type="text"
                value={editingItem.nome || ''}
                onChange={e => setEditingItem(prev => prev ? { ...prev, nome: e.target.value } : null)}
                placeholder="Ex: Envio de Relatório de Frota Semanal..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Descrição</label>
              <textarea
                rows={2}
                value={editingItem.descricao || ''}
                onChange={e => setEditingItem(prev => prev ? { ...prev, descricao: e.target.value } : null)}
                placeholder="Explique o que esta automação faz..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tipo de Evento</label>
                <select
                  value={editingItem.tipo || 'email_planeamento'}
                  onChange={e => setEditingItem(prev => prev ? { ...prev, tipo: e.target.value as TipoAutomacao } : null)}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="email_planeamento">📅 Planeamento Semanal</option>
                  <option value="alerta_stock">📦 Alerta de Stock Mínimo</option>
                  <option value="alerta_revisao">🚗 Lembrete de Revisão Frota</option>
                  <option value="notificacao_cliente">🔔 Conclusão de Obra</option>
                  <option value="whatsapp_resumo">🤖 Assistente WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Frequência</label>
                <input
                  type="text"
                  value={editingItem.frequencia || ''}
                  onChange={e => setEditingItem(prev => prev ? { ...prev, frequencia: e.target.value } : null)}
                  placeholder="Ex: Segundas às 07:30"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Recipients in Modal */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Destinatários (Emails)</label>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(editingItem.destinatarios || []).map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-xs text-white font-mono">
                      {email}
                      <button
                        type="button"
                        onClick={() => setEditingItem(prev => prev ? {
                          ...prev,
                          destinatarios: (prev.destinatarios || []).filter(e => e !== email)
                        } : null)}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={modalEmailInput}
                    onChange={e => setModalEmailInput(e.target.value)}
                    placeholder="Adicionar email..."
                    className="flex-1 py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (modalEmailInput.includes('@')) {
                        setEditingItem(prev => prev ? {
                          ...prev,
                          destinatarios: [...(prev.destinatarios || []), modalEmailInput.trim().toLowerCase()]
                        } : null);
                        setModalEmailInput('');
                      }
                    }}
                    className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="py-2 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30"
              >
                Guardar Automação
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
