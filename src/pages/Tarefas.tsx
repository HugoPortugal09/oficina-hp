import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  Clock,
  Calendar,
  User,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Trash2,
  Edit,
  Check,
  Filter,
  FileText,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  UserCheck,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import { sortByDateDesc, formatDate, formatDateToInput, getTodayFormatted } from '../utils/dateUtils';
import { sendTaskNotificationEmail } from '../services/emailService';
import type { Tarefa, PrioridadeTarefa, StatusTarefa, UserProfile } from '../types';
import { USERS, getInitials } from '../types';

interface TarefasProps {
  tarefas: Tarefa[];
  currentUser?: UserProfile;
}

export const Tarefas: React.FC<TarefasProps> = ({ tarefas, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_tarefas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_tarefas', mode);
    } catch {}
  };

  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [filterPrioridade, setFilterPrioridade] = useState<string>('TODAS');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Partial<Tarefa>>({});

  // Registered Users list for assignment & responsible pickers
  const utilizadores: UserProfile[] = (() => {
    try {
      const list = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
      return list && list.length > 0 ? list : USERS;
    } catch {
      return USERS;
    }
  })();

  // Quick Complete Modal State
  const [completeModal, setCompleteModal] = useState<{
    isOpen: boolean;
    tarefa: Tarefa | null;
    iniciais: string;
    nome: string;
  }>({
    isOpen: false,
    tarefa: null,
    iniciais: getInitials(currentUser?.nome || currentUser?.avatar || 'HP'),
    nome: currentUser?.nome || 'Hugo Portugal'
  });

  // Migração/Sanitização automática: se alguma tarefa tiver "IA" no campo criadoPorIniciais, substituir pelo utilizador real
  useEffect(() => {
    const list = db.get<Tarefa>(STORAGE_KEYS.TAREFAS);
    let hasChanges = false;
    const defaultInit = currentUser?.avatar || getInitials(currentUser?.nome) || 'HP';
    const defaultNome = currentUser?.nome || 'Hugo Portugal';

    const sanitized = list.map(t => {
      if (t.criadoPorIniciais === 'IA' || !t.criadoPorIniciais) {
        hasChanges = true;
        const resolvedInit = (t.criadoPorNome && t.criadoPorNome !== 'IA')
          ? getInitials(t.criadoPorNome)
          : defaultInit;
        const resolvedNome = (t.criadoPorNome && t.criadoPorNome !== 'IA')
          ? t.criadoPorNome
          : defaultNome;

        return {
          ...t,
          criadoPorIniciais: resolvedInit === 'IA' ? 'HP' : resolvedInit,
          criadoPorNome: resolvedNome
        };
      }
      return t;
    });

    if (hasChanges) {
      db.save(STORAGE_KEYS.TAREFAS, sanitized);
    }
  }, [currentUser]);

  const handleCreateNew = () => {
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.TAREFAS, 'TAR');
    const today = getTodayFormatted();
    const defaultLimit = formatDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString());
    const userIniciais = currentUser?.avatar || getInitials(currentUser?.nome) || 'HP';
    const userNome = currentUser?.nome || 'Hugo Portugal';
    const defaultResp = userNome || utilizadores[0]?.nome || 'Hugo Portugal';

    setEditingTarefa({
      id: db.generateId('tar'),
      numero: newNum,
      descricao: '',
      prioridade: 'Normal',
      responsavel: defaultResp,
      dataLimite: defaultLimit,
      notasAdicionais: '',
      status: 'Pendente',
      criadoPorIniciais: userIniciais === 'IA' ? 'HP' : userIniciais,
      criadoPorNome: userNome,
      dataCriacao: today
    });
    setIsModalOpen(true);
  };

  const handleEdit = (t: Tarefa) => {
    const safeIniciais = (!t.criadoPorIniciais || t.criadoPorIniciais === 'IA')
      ? (currentUser?.avatar || getInitials(currentUser?.nome) || 'HP')
      : t.criadoPorIniciais;
    const safeNome = (!t.criadoPorNome || t.criadoPorNome === 'IA')
      ? (currentUser?.nome || 'Hugo Portugal')
      : t.criadoPorNome;

    setEditingTarefa({
      ...t,
      criadoPorIniciais: safeIniciais === 'IA' ? 'HP' : safeIniciais,
      criadoPorNome: safeNome
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingTarefa.descricao) {
      alert('Por favor informe a descrição da tarefa.');
      return;
    }

    // Garantir que criadoPorIniciais nunca seja 'IA'
    if (!editingTarefa.criadoPorIniciais || editingTarefa.criadoPorIniciais === 'IA') {
      const fallbackInit = currentUser?.avatar || getInitials(currentUser?.nome) || 'HP';
      editingTarefa.criadoPorIniciais = fallbackInit === 'IA' ? 'HP' : fallbackInit;
      if (!editingTarefa.criadoPorNome || editingTarefa.criadoPorNome === 'IA') {
        editingTarefa.criadoPorNome = currentUser?.nome || 'Hugo Portugal';
      }
    }

    const currentList = db.get<Tarefa>(STORAGE_KEYS.TAREFAS);
    const existingIndex = currentList.findIndex(t => t.id === editingTarefa.id);
    const isNew = existingIndex < 0;
    const previousTarefa = !isNew ? currentList[existingIndex] : null;

    if (!isNew) {
      db.update(STORAGE_KEYS.TAREFAS, editingTarefa.id!, editingTarefa);
      // Se passou a Concluída
      if (editingTarefa.status === 'Concluída' && previousTarefa?.status !== 'Concluída') {
        sendTaskNotificationEmail({
          action: 'CONCLUIDA',
          tarefa: editingTarefa as Tarefa,
          currentUser,
          todasTarefas: tarefas.map(t => t.id === editingTarefa.id ? (editingTarefa as Tarefa) : t)
        });
      }
    } else {
      const novaTarefa = editingTarefa as Tarefa;
      db.insert(STORAGE_KEYS.TAREFAS, novaTarefa);
      sendTaskNotificationEmail({
        action: 'CRIADA',
        tarefa: novaTarefa,
        currentUser,
        todasTarefas: [...tarefas, novaTarefa]
      });
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta tarefa?')) {
      db.delete(STORAGE_KEYS.TAREFAS, id);
      setIsModalOpen(false);
    }
  };

  const handleOpenCompleteModal = (t: Tarefa) => {
    setCompleteModal({
      isOpen: true,
      tarefa: t,
      iniciais: getInitials(currentUser?.nome || currentUser?.avatar || 'HP'),
      nome: currentUser?.nome || 'Hugo Portugal'
    });
  };

  const handleConfirmComplete = () => {
    if (!completeModal.tarefa) return;
    if (!completeModal.iniciais) {
      alert('Por favor informe as suas iniciais para registar a conclusão.');
      return;
    }

    const now = new Date();
    const formattedDate = `${getTodayFormatted()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const updatedTask: Tarefa = {
      ...completeModal.tarefa,
      status: 'Concluída',
      dataConclusao: formattedDate,
      concluidoPorIniciais: completeModal.iniciais.toUpperCase(),
      concluidoPorNome: completeModal.nome
    };

    db.update<Tarefa>(STORAGE_KEYS.TAREFAS, completeModal.tarefa.id, updatedTask);

    // Envio automático de notificação por email para os envolvidos e resumo de abertas
    sendTaskNotificationEmail({
      action: 'CONCLUIDA',
      tarefa: updatedTask,
      currentUser,
      todasTarefas: tarefas.map(t => t.id === updatedTask.id ? updatedTask : t)
    });

    setCompleteModal({
      isOpen: false,
      tarefa: null,
      iniciais: getInitials(currentUser?.nome || currentUser?.avatar || 'HP'),
      nome: currentUser?.nome || 'Hugo Portugal'
    });
  };

  const handleReopenTask = (t: Tarefa) => {
    db.update<Tarefa>(STORAGE_KEYS.TAREFAS, t.id, {
      status: 'Em Curso',
      dataConclusao: undefined,
      concluidoPorIniciais: undefined,
      concluidoPorNome: undefined
    });
  };

  const filteredTarefas = tarefas.filter(t => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      t.descricao.toLowerCase().includes(q) ||
      t.numero.toLowerCase().includes(q) ||
      t.responsavel.toLowerCase().includes(q) ||
      t.criadoPorIniciais.toLowerCase().includes(q) ||
      (t.concluidoPorIniciais && t.concluidoPorIniciais.toLowerCase().includes(q)) ||
      (t.notasAdicionais && t.notasAdicionais.toLowerCase().includes(q));

    const matchesStatus = filterStatus === 'TODAS' || t.status === filterStatus;
    const matchesPrioridade = filterPrioridade === 'TODAS' || t.prioridade === filterPrioridade;

    return matchesSearch && matchesStatus && matchesPrioridade;
  }).sort(sortByDateDesc(t => t.dataCriacao || t.dataLimite, t => t.numero));

  const countPendentes = tarefas.filter(t => t.status === 'Pendente').length;
  const countEmCurso = tarefas.filter(t => t.status === 'Em Curso').length;
  const countConcluidas = tarefas.filter(t => t.status === 'Concluída').length;
  const countCriticas = tarefas.filter(t => (t.prioridade === 'Crítica' || t.prioridade === 'Urgente') && t.status !== 'Concluída').length;

  const getPriorityBadgeVariant = (p: PrioridadeTarefa) => {
    switch (p) {
      case 'Crítica':
      case 'Urgente':
        return 'danger';
      case 'Alta':
        return 'warning';
      case 'Normal':
        return 'info';
      case 'Baixa':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3 flex items-center justify-between border-amber-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Pendentes</span>
            <h3 className="text-2xl font-extrabold font-mono text-amber-400 mt-1">{countPendentes}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-hp-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Em Curso</span>
            <h3 className="text-2xl font-extrabold font-mono text-hp-400 mt-1">{countEmCurso}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-rose-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Urgentes / Críticas</span>
            <h3 className="text-2xl font-extrabold font-mono text-rose-400 mt-1">{countCriticas}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Flame className="w-4 h-4" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-emerald-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">Concluídas</span>
            <h3 className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">{countConcluidas}</h3>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </GlassCard>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar tarefas por descrição, responsável, iniciais..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODAS">Todos os Estados</option>
            <option value="Pendente">Pendentes</option>
            <option value="Em Curso">Em Curso</option>
            <option value="Concluída">Concluídas</option>
            <option value="Cancelada">Canceladas</option>
          </select>

          <select
            value={filterPrioridade}
            onChange={e => setFilterPrioridade(e.target.value)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODAS">Todas as Prioridades</option>
            <option value="Crítica">Crítica</option>
            <option value="Urgente">Urgente</option>
            <option value="Alta">Alta</option>
            <option value="Normal">Normal</option>
            <option value="Baixa">Baixa</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 p-0.5 rounded-xl">
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-hp-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista em Cartões"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cartões</span>
            </button>
            <button
              onClick={() => handleSetViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'table' ? 'bg-hp-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista em Tabela"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>

          <button
            onClick={handleCreateNew}
            className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
          >
            <Plus className="w-4 h-4" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTarefas.map(t => {
            const isDone = t.status === 'Concluída';
            const isExpired = t.dataLimite && !isDone && new Date(t.dataLimite).getTime() < Date.now();

            return (
              <GlassCard
                key={t.id}
                onClick={() => handleEdit(t)}
                className={`flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group transition-all ${
                  isDone ? 'opacity-75 bg-slate-950/40' : ''
                }`}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {t.numero}
                      </span>
                      <Badge variant={getPriorityBadgeVariant(t.prioridade)}>
                        {t.prioridade}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <Badge variant={isDone ? 'success' : t.status === 'Em Curso' ? 'info' : 'warning'}>
                        {t.status}
                      </Badge>
                      <button
                        onClick={() => handleEdit(t)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <h4 className={`text-sm font-bold leading-snug group-hover:text-hp-300 transition-colors ${
                      isDone ? 'line-through text-slate-400' : 'text-white'
                    }`}>
                      {t.descricao}
                    </h4>
                  </div>

                  {/* Task Details */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
                    {/* Responsável */}
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="font-sans text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-hp-400" /> Responsável:
                      </span>
                      <span className="font-semibold text-white">{t.responsavel}</span>
                    </div>

                    {/* Data Limite */}
                    {t.dataLimite && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" /> Data Limite:
                        </span>
                        <span className={`font-bold ${isExpired ? 'text-rose-400' : 'text-slate-200'}`}>
                          {formatDate(t.dataLimite)} {isExpired && '(Atrasada)'}
                        </span>
                      </div>
                    )}

                    {/* Audit Trail: Open & Complete Initials & Dates */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[11px] font-sans">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>Aberta em:</span>
                        <span className="font-mono text-slate-300">
                          {formatDate(t.dataCriacao)} por <b className="text-hp-400 px-1 py-0.5 bg-slate-900 rounded border border-slate-700">[{t.criadoPorIniciais === 'IA' ? (currentUser?.avatar || 'HP') : t.criadoPorIniciais}]</b>
                        </span>
                      </div>

                      {isDone && t.dataConclusao && (
                        <div className="flex items-center justify-between text-emerald-400 font-semibold">
                          <span>Concluída em:</span>
                          <span className="font-mono">
                            {formatDate(t.dataConclusao)} por <b className="text-emerald-300 px-1 py-0.5 bg-emerald-950/80 rounded border border-emerald-700">[{t.concluidoPorIniciais}]</b>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {t.notasAdicionais && (
                    <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{t.notasAdicionais}</p>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs" onClick={e => e.stopPropagation()}>
                  {isDone ? (
                    <button
                      type="button"
                      onClick={() => handleReopenTask(t)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-semibold transition-colors"
                    >
                      Reabrir Tarefa
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenCompleteModal(t)}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 border border-emerald-500/30 transition-all ml-auto"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Concluir Tarefa
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Descrição da Tarefa</th>
                <th className="py-3 px-4">Responsável</th>
                <th className="py-3 px-4">Data Limite</th>
                <th className="py-3 px-4">Aberta por</th>
                <th className="py-3 px-4">Concluída por</th>
                <th className="py-3 px-4 text-center">Prioridade</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredTarefas.map(t => {
                const isDone = t.status === 'Concluída';
                const isExpired = t.dataLimite && !isDone && new Date(t.dataLimite).getTime() < Date.now();

                return (
                  <tr
                    key={t.id}
                    onClick={() => handleEdit(t)}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-hp-400">{t.numero}</td>
                    <td className="py-3 px-4 max-w-sm">
                      <span className={`font-semibold block ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                        {t.descricao}
                      </span>
                      {t.notasAdicionais && (
                        <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                          {t.notasAdicionais}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-medium">{t.responsavel}</td>
                    <td className="py-3 px-4 font-mono">
                      {t.dataLimite ? (
                        <span className={isExpired ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {formatDate(t.dataLimite)} {isExpired && '⚠️'}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {formatDate(t.dataCriacao)} <b className="text-hp-400 font-mono">[{t.criadoPorIniciais === 'IA' ? (currentUser?.avatar || 'HP') : t.criadoPorIniciais}]</b>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {isDone && t.dataConclusao ? (
                        <span className="text-emerald-400 font-mono">
                          {formatDate(t.dataConclusao)} <b>[{t.concluidoPorIniciais}]</b>
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={getPriorityBadgeVariant(t.prioridade)}>
                        {t.prioridade}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={isDone ? 'success' : t.status === 'Em Curso' ? 'info' : 'warning'}>
                        {t.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      {isDone ? (
                        <button
                          type="button"
                          onClick={() => handleReopenTask(t)}
                          className="text-xs text-slate-400 hover:text-white font-semibold"
                        >
                          Reabrir
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(t)}
                          className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs"
                          title="Concluir Tarefa"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Tarefa: ${editingTarefa.numero || 'Nova Tarefa'}`}
          subtitle="Registo de tarefas, prioridade, responsável, data limite e iniciais de autoria"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Descrição da Tarefa *</label>
              <textarea
                rows={2}
                value={editingTarefa.descricao || ''}
                onChange={e => setEditingTarefa(prev => ({ ...prev, descricao: e.target.value }))}
                placeholder="Ex: Verificar filtros do compressor principal e substituir correia de transmissão"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Prioridade</label>
                <select
                  value={editingTarefa.prioridade || 'Normal'}
                  onChange={e => setEditingTarefa(prev => ({ ...prev, prioridade: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                  <option value="Crítica">Crítica</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Responsável *</label>
                <select
                  value={editingTarefa.responsavel || ''}
                  onChange={e => setEditingTarefa(prev => ({ ...prev, responsavel: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500 font-semibold"
                >
                  <option value="">-- Selecione o Responsável --</option>
                  {utilizadores.map(u => (
                    <option key={u.id} value={u.nome}>
                      {u.nome} ({u.role.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Estado</label>
                <select
                  value={editingTarefa.status || 'Pendente'}
                  onChange={e => setEditingTarefa(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Em Curso">Em Curso</option>
                  <option value="Concluída">Concluída</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Data Limite</label>
                <input
                  type="date"
                  value={formatDateToInput(editingTarefa.dataLimite)}
                  onChange={e => setEditingTarefa(prev => ({ ...prev, dataLimite: formatDate(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Iniciais de Quem Abriu * <span className="text-[10px] text-hp-400">(Ex: HP, RF)</span>
                </label>
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {utilizadores.map(u => {
                    const init = u.avatar || getInitials(u.nome);
                    const currentVal = editingTarefa.criadoPorIniciais === 'IA'
                      ? (currentUser?.avatar || 'HP')
                      : (editingTarefa.criadoPorIniciais || '');
                    const isSelected = currentVal === init.toUpperCase();
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setEditingTarefa(prev => ({
                          ...prev,
                          criadoPorIniciais: init.toUpperCase(),
                          criadoPorNome: u.nome
                        }))}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                          isSelected ? 'bg-hp-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {init}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  maxLength={4}
                  value={editingTarefa.criadoPorIniciais === 'IA' ? (currentUser?.avatar || 'HP') : (editingTarefa.criadoPorIniciais || '')}
                  onChange={e => {
                    const val = e.target.value.toUpperCase();
                    const cleanVal = val === 'IA' ? (currentUser?.avatar || 'HP') : val;
                    const matched = utilizadores.find(u => (u.avatar || getInitials(u.nome)).toUpperCase() === cleanVal);
                    setEditingTarefa(prev => ({
                      ...prev,
                      criadoPorIniciais: cleanVal,
                      criadoPorNome: matched ? matched.nome : prev.criadoPorNome
                    }));
                  }}
                  placeholder="HP"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Notas Adicionais</label>
              <textarea
                rows={3}
                value={editingTarefa.notasAdicionais || ''}
                onChange={e => setEditingTarefa(prev => ({ ...prev, notasAdicionais: e.target.value }))}
                placeholder="Observações complementares, peças necessárias, localização ou detalhes operacionais..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* If completed, show completion details */}
            {editingTarefa.status === 'Concluída' && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-emerald-400 block">Registo de Conclusão</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block">Iniciais de Conclusão</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={editingTarefa.concluidoPorIniciais || ''}
                      onChange={e => setEditingTarefa(prev => ({ ...prev, concluidoPorIniciais: e.target.value.toUpperCase() }))}
                      className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block">Data de Conclusão</label>
                    <input
                      type="text"
                      value={editingTarefa.dataConclusao || ''}
                      onChange={e => setEditingTarefa(prev => ({ ...prev, dataConclusao: e.target.value }))}
                      className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingTarefa.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingTarefa.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Tarefa
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Complete Modal (Prompting for initials) */}
      {completeModal.isOpen && completeModal.tarefa && (
        <Modal
          isOpen={completeModal.isOpen}
          onClose={() => setCompleteModal({ isOpen: false, tarefa: null, iniciais: 'HP', nome: 'Hugo Portugal' })}
          title={`Concluir Tarefa: ${completeModal.tarefa.numero}`}
          subtitle="Registo das iniciais do colaborador para validação da conclusão"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300">
              Está a concluir: <b className="text-white">"{completeModal.tarefa.descricao}"</b>
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Selecionar Colaborador ou Iniciais *
              </label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {utilizadores.map(u => {
                  const init = u.avatar || getInitials(u.nome);
                  const isSelected = completeModal.iniciais === init.toUpperCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setCompleteModal(prev => ({ ...prev, iniciais: init.toUpperCase(), nome: u.nome }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        isSelected ? 'bg-hp-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {init} ({u.nome.split(' ')[0]})
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                autoFocus
                maxLength={4}
                value={completeModal.iniciais}
                onChange={e => {
                  const val = e.target.value.toUpperCase();
                  const matchedUser = utilizadores.find(u => (u.avatar || getInitials(u.nome)).toUpperCase() === val);
                  setCompleteModal(prev => ({
                    ...prev,
                    iniciais: val,
                    nome: matchedUser ? matchedUser.nome : prev.nome
                  }));
                }}
                placeholder="HP"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 focus:border-hp-500 rounded-xl text-center text-sm text-white font-mono font-extrabold tracking-widest uppercase"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCompleteModal({ isOpen: false, tarefa: null, iniciais: 'HP', nome: 'Hugo Portugal' })}
                className="py-1.5 px-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="glass-btn py-1.5 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1 shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-3.5 h-3.5" />
                Confirmar Conclusão
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
