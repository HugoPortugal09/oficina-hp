import React, { useState, useMemo } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  Package,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  Truck,
  Sparkles,
  Filter,
  Search,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckSquare,
  Activity,
  FileText
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import type {
  FolhaServico,
  Tarefa,
  Empresa,
  Equipamento,
  Cliente
} from '../types';

interface AtividadeSemanalProps {
  folhas: FolhaServico[];
  tarefas: Tarefa[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  clientes: Cliente[];
  onSelectFolha?: (folha: FolhaServico) => void;
  currentUser?: import('../types').UserProfile;
}

interface ActivityItem {
  id: string;
  tipo: 'folha' | 'tarefa';
  dateStr: string; // YYYY-MM-DD
  timeStr?: string;
  titulo: string;
  descricao: string;
  concluido: boolean;
  tecnico?: string;
  horas?: number;
  qtdServicos?: number;
  qtdPecas?: number;
  folhaNumero?: string;
  folhaId?: string;
  matricula?: string;
  marcaModelo?: string;
  empresaNome?: string;
  status?: string;
  rawFolha?: FolhaServico;
  rawTarefa?: Tarefa;
  prioridade?: string;
}

// Helpers for Week calculations (Monday to Sunday)
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DIAS_SEMANA = [
  { index: 0, label: 'Segunda-feira', short: 'Seg' },
  { index: 1, label: 'Terça-feira', short: 'Ter' },
  { index: 2, label: 'Quarta-feira', short: 'Qua' },
  { index: 3, label: 'Quinta-feira', short: 'Qui' },
  { index: 4, label: 'Sexta-feira', short: 'Sex' },
  { index: 5, label: 'Sábado', short: 'Sáb' },
  { index: 6, label: 'Domingo', short: 'Dom' },
];

export const AtividadeSemanal: React.FC<AtividadeSemanalProps> = ({
  folhas,
  tarefas,
  empresas,
  equipamentos,
  clientes,
  onSelectFolha,
  currentUser
}) => {
  const isAdmin = currentUser?.role === 'administrador';
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedTecnico, setSelectedTecnico] = useState<string>('TODOS');
  const [selectedTipo, setSelectedTipo] = useState<'TODOS' | 'folhas' | 'tarefas' | 'concluidos'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Navigate weeks
  const handlePrevWeek = () => {
    setCurrentMonday(prev => addDays(prev, -7));
  };

  const handleNextWeek = () => {
    setCurrentMonday(prev => addDays(prev, 7));
  };

  const handleCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
  };

  // Week days array
  const weekDays = useMemo(() => {
    return DIAS_SEMANA.map((dia, idx) => {
      const dateObj = addDays(currentMonday, idx);
      const isoStr = formatDateISO(dateObj);
      const isToday = isoStr === formatDateISO(new Date());
      return {
        ...dia,
        dateObj,
        isoStr,
        formattedDayMonth: `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`,
        isToday
      };
    });
  }, [currentMonday]);

  // Extract all technician names
  const tecnicosList = useMemo(() => {
    const set = new Set<string>();
    folhas.forEach(f => {
      if (f.tecnicoPlaneado) set.add(f.tecnicoPlaneado);
      f.servicos?.forEach(s => s.tecnico && set.add(s.tecnico));
      f.servicosAdicionais?.forEach(s => s.tecnico && set.add(s.tecnico));
    });
    tarefas.forEach(t => {
      if (t.responsavel) set.add(t.responsavel);
      if (t.concluidoPorNome) set.add(t.concluidoPorNome);
    });
    return Array.from(set).filter(Boolean).sort();
  }, [folhas, tarefas]);

  // Build all Activity Items (Each Folha de Serviço appears ONCE)
  const allActivities = useMemo(() => {
    const list: ActivityItem[] = [];

    // 1. Folhas de Serviço (1 Folha = 1 Registo)
    folhas.forEach(f => {
      const emp = empresas.find(e => e.id === f.empresaId);
      const folhaDate = f.dataConclusao
        ? f.dataConclusao.split('T')[0]
        : (f.dataPlaneada || f.dataEntradaOficina || f.data || formatDateISO(new Date()));

      const isConcluido = f.status.startsWith('FEITO -') || !!f.dataConclusao;
      
      const totalHoras = (f.servicos?.reduce((acc, s) => acc + (s.horas || 0), 0) || 0) +
                         (f.servicosAdicionais?.reduce((acc, s) => acc + (s.horas || 0), 0) || 0);
      const countServicos = (f.servicos?.length || 0) + (f.servicosAdicionais?.length || 0);
      const countPecas = (f.pecas?.reduce((acc, p) => acc + (p.qtd || 1), 0) || 0) +
                         (f.pecasAdicionais?.reduce((acc, p) => acc + (p.qtd || 1), 0) || 0);

      const tecnicosUnicos = Array.from(new Set([
        ...(f.servicos?.map(s => s.tecnico) || []),
        ...(f.servicosAdicionais?.map(s => s.tecnico) || []),
        f.tecnicoPlaneado
      ])).filter(Boolean).join(', ') || 'Oficina HP';

      const firstServiceDesc = f.servicos?.[0]?.descricao || f.servicosAdicionais?.[0]?.descricao;
      const desc = f.anomalias || firstServiceDesc || f.notasInternas || `${f.tipo} • ${f.status}`;

      list.push({
        id: `folha_${f.id}`,
        tipo: 'folha',
        dateStr: folhaDate,
        titulo: `Folha de Serviço ${f.numero}`,
        descricao: desc,
        concluido: isConcluido,
        tecnico: tecnicosUnicos,
        horas: totalHoras,
        qtdServicos: countServicos,
        qtdPecas: countPecas,
        folhaNumero: f.numero,
        folhaId: f.id,
        matricula: f.matricula,
        marcaModelo: `${f.marca} ${f.modelo}`,
        empresaNome: emp?.nome || 'Cliente',
        status: f.status,
        rawFolha: f
      });
    });

    // 2. Tarefas Concluídas
    tarefas.forEach(t => {
      if (t.status === 'Concluída') {
        const taskDate = t.dataConclusao
          ? t.dataConclusao.split(' ')[0]
          : t.dataCriacao || formatDateISO(new Date());

        list.push({
          id: `tar_${t.id}`,
          tipo: 'tarefa',
          dateStr: taskDate,
          timeStr: t.dataConclusao?.split(' ')[1] || '',
          titulo: `Tarefa Concluída • ${t.numero}`,
          descricao: t.descricao,
          concluido: true,
          tecnico: t.concluidoPorNome || t.responsavel || 'Hugo Portugal',
          prioridade: t.prioridade,
          rawTarefa: t
        });
      }
    });

    return list;
  }, [folhas, tarefas, empresas]);

  // Filter activities for the selected week & user filters
  const weekStartStr = weekDays[0].isoStr;
  const weekEndStr = weekDays[6].isoStr;

  const currentWeekActivities = useMemo(() => {
    return allActivities.filter(item => {
      // Date within week
      const inWeek = item.dateStr >= weekStartStr && item.dateStr <= weekEndStr;
      if (!inWeek) return false;

      // Filter by Técnico
      if (selectedTecnico !== 'TODOS') {
        if (!item.tecnico?.toLowerCase().includes(selectedTecnico.toLowerCase())) return false;
      }

      // Filter by Tipo
      if (selectedTipo === 'concluidos') {
        if (!item.concluido) return false;
      } else if (selectedTipo === 'folhas') {
        if (item.tipo !== 'folha') return false;
      } else if (selectedTipo === 'tarefas') {
        if (item.tipo !== 'tarefa') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesDesc = item.descricao.toLowerCase().includes(q);
        const matchesPlate = item.matricula?.toLowerCase().includes(q) || false;
        const matchesEmp = item.empresaNome?.toLowerCase().includes(q) || false;
        const matchesFs = item.folhaNumero?.toLowerCase().includes(q) || false;
        const matchesTec = item.tecnico?.toLowerCase().includes(q) || false;
        if (!matchesDesc && !matchesPlate && !matchesEmp && !matchesFs && !matchesTec) return false;
      }

      return true;
    });
  }, [allActivities, weekStartStr, weekEndStr, selectedTecnico, selectedTipo, searchTerm]);

  // Week metrics
  const weekMetrics = useMemo(() => {
    const totalFolhas = currentWeekActivities.filter(a => a.tipo === 'folha');
    
    // Oficina
    const ofFolhas = totalFolhas.filter(f => f.rawFolha?.tipo === 'Oficina');
    const ofNovos = ofFolhas.filter(f => f.rawFolha?.dataEntradaOficina && f.rawFolha.dataEntradaOficina >= weekStartStr && f.rawFolha.dataEntradaOficina <= weekEndStr).length || ofFolhas.length;
    const ofConcluidas = ofFolhas.filter(f => f.concluido).length;
    const ofAbertas = ofFolhas.length - ofConcluidas;

    // Assistência Técnica
    const atFolhas = totalFolhas.filter(f => f.rawFolha?.tipo === 'Assistência Técnica');
    const atNovos = atFolhas.filter(f => f.rawFolha?.dataEntradaOficina && f.rawFolha.dataEntradaOficina >= weekStartStr && f.rawFolha.dataEntradaOficina <= weekEndStr).length || atFolhas.length;
    const atConcluidas = atFolhas.filter(f => f.concluido).length;
    const atAbertas = atFolhas.length - atConcluidas;

    // Contratos
    const ctFolhas = totalFolhas.filter(f => f.rawFolha?.tipo === 'Contrato');
    const ctNovos = ctFolhas.filter(f => f.rawFolha?.dataEntradaOficina && f.rawFolha.dataEntradaOficina >= weekStartStr && f.rawFolha.dataEntradaOficina <= weekEndStr).length;
    const ctConcluidas = ctFolhas.filter(f => f.concluido).length;
    const ctAbertas = ctFolhas.length - ctConcluidas;

    // Tarefas
    const totalTarefas = currentWeekActivities.filter(a => a.tipo === 'tarefa');
    const tarefasNovas = totalTarefas.filter(t => t.rawTarefa?.dataCriacao && t.rawTarefa.dataCriacao >= weekStartStr && t.rawTarefa.dataCriacao <= weekEndStr).length || totalTarefas.length;
    const tarefasConcluidas = totalTarefas.filter(t => t.concluido).length;
    const tarefasAbertas = totalTarefas.length - tarefasConcluidas;

    // Horas e Peças (para Administrador)
    const totalHoras = totalFolhas.reduce((acc, s) => acc + (s.horas || 0), 0);
    const totalPecas = totalFolhas.reduce((acc, f) => acc + (f.qtdPecas || 0), 0);

    return {
      ofNovos,
      ofAbertas,
      ofConcluidas,
      atNovos,
      atAbertas,
      atConcluidas,
      ctNovos,
      ctAbertas,
      ctConcluidas,
      tarefasNovas,
      tarefasAbertas,
      tarefasConcluidas,
      totalHoras,
      totalPecas,
      totalFolhasCount: totalFolhas.length
    };
  }, [currentWeekActivities, weekStartStr, weekEndStr]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header & Week Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3.5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Atividade Semanal da Oficina
              </h1>
              <p className="text-xs text-slate-400">
                Registo de Folhas de Serviço executadas e tarefas concluídas na semana
              </p>
            </div>
          </div>
        </div>

        {/* Week Switcher Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevWeek}
            title="Semana Anterior"
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-hp-500 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-mono font-bold text-slate-200 flex items-center gap-2 shadow-inner">
            <Calendar className="w-3.5 h-3.5 text-hp-400" />
            <span>
              {weekDays[0].formattedDayMonth} a {weekDays[6].formattedDayMonth}
            </span>
          </div>

          <button
            onClick={handleNextWeek}
            title="Semana Seguinte"
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-hp-500 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleCurrentWeek}
            className="px-2.5 py-1.5 rounded-xl bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 border border-hp-500/30 text-xs font-bold transition-all active:scale-95 ml-1"
          >
            Esta Semana
          </button>
        </div>
      </div>

      {/* Categorized Weekly Metrics KPIs Banner (Novos, Abertos, Concluídos) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Oficina */}
        <GlassCard className="p-3 border-sky-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-400 block">Oficina</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xs font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span className="text-sky-300 font-extrabold text-sm">{weekMetrics.ofNovos}</span> Novos
            <span className="text-slate-500">|</span>
            <span className="text-amber-300 font-extrabold text-sm">{weekMetrics.ofAbertas}</span> Abertos
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-extrabold text-sm">{weekMetrics.ofConcluidas}</span> Concluídos
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Produção em Oficina
          </span>
        </GlassCard>

        {/* Assistência Técnica */}
        <GlassCard className="p-3 border-amber-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-400 block">Assistência Técnica</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xs font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span className="text-amber-300 font-extrabold text-sm">{weekMetrics.atNovos}</span> Novos
            <span className="text-slate-500">|</span>
            <span className="text-amber-300 font-extrabold text-sm">{weekMetrics.atAbertas}</span> Abertos
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-extrabold text-sm">{weekMetrics.atConcluidas}</span> Concluídos
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Intervenções no Terreno
          </span>
        </GlassCard>

        {/* Contratos */}
        <GlassCard className="p-3 border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-400 block">Contratos</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xs font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-300 font-extrabold text-sm">{weekMetrics.ctNovos}</span> Novos
            <span className="text-slate-500">|</span>
            <span className="text-amber-300 font-extrabold text-sm">{weekMetrics.ctAbertas}</span> Abertos
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-extrabold text-sm">{weekMetrics.ctConcluidas}</span> Concluídos
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Manutenções Contratuais
          </span>
        </GlassCard>

        {/* Tarefas */}
        <GlassCard className="p-3 border-purple-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-400 block">Tarefas</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CheckSquare className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xs font-mono font-bold text-white flex items-center gap-1.5 flex-wrap">
            <span className="text-purple-300 font-extrabold text-sm">{weekMetrics.tarefasNovas}</span> Novas
            <span className="text-slate-500">|</span>
            <span className="text-amber-300 font-extrabold text-sm">{weekMetrics.tarefasAbertas}</span> Abertas
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400 font-extrabold text-sm">{weekMetrics.tarefasConcluidas}</span> Concluídas
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Tarefas Internas de Oficina
          </span>
        </GlassCard>
      </div>

      {/* Admin Extra Metrics: Horas e Peças (Apenas para Administrador) */}
      {isAdmin && (
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Total Mão-de-Obra na Semana: <strong className="text-white font-mono">{weekMetrics.totalHoras.toFixed(1)}h</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-indigo-400" />
            <span>Total Peças Aplicadas: <strong className="text-white font-mono">{weekMetrics.totalPecas} unidades</strong></span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por matrícula, empresa, FS, técnico..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
            />
          </div>

          {/* Filter by Técnico */}
          <select
            value={selectedTecnico}
            onChange={e => setSelectedTecnico(e.target.value)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODOS">Todos os Técnicos</option>
            {tecnicosList.map(tec => (
              <option key={tec} value={tec}>{tec}</option>
            ))}
          </select>

          {/* Filter by Tipo */}
          <select
            value={selectedTipo}
            onChange={e => setSelectedTipo(e.target.value as any)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODOS">Todos os Registos</option>
            <option value="concluidos">✓ Apenas Concluídos (Verde)</option>
            <option value="folhas">Apenas Folhas de Serviço</option>
            <option value="tarefas">Apenas Tarefas Concluídas</option>
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span className="text-emerald-300">Concluído (Verde)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-amber-300">Em Aberto / Curso</span>
          </div>
        </div>
      </div>

      {/* Weekly 7-Day Columns Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 items-start pb-4">
        {weekDays.map(day => {
          const dayActivities = currentWeekActivities.filter(a => a.dateStr === day.isoStr);
          const dayHours = dayActivities
            .filter(a => a.tipo === 'folha')
            .reduce((acc, s) => acc + (s.horas || 0), 0);

          return (
            <div
              key={day.isoStr}
              className={`
                flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden min-h-[300px]
                ${
                  day.isToday
                    ? 'bg-slate-900/90 border-hp-500/50 ring-1 ring-hp-500/30 shadow-lg shadow-hp-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                }
              `}
            >
              {/* Day Header */}
              <div className={`p-3 border-b ${day.isToday ? 'bg-hp-600/15 border-hp-500/30' : 'bg-slate-900/60 border-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${day.isToday ? 'text-hp-400 font-extrabold' : 'text-slate-200'}`}>
                      {day.short}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {day.formattedDayMonth}
                    </span>
                  </div>

                  {day.isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-hp-500 text-white shadow-sm">
                      Hoje
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800/60">
                  <span>{dayActivities.length} {dayActivities.length === 1 ? 'registo' : 'registos'}</span>
                  {isAdmin && dayHours > 0 && <span className="text-emerald-400 font-bold">{dayHours.toFixed(1)}h</span>}
                </div>
              </div>

              {/* Day Activities List */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[550px] custom-scrollbar">
                {dayActivities.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-600 italic">
                    Sem atividade registada
                  </div>
                ) : (
                  dayActivities.map(item => {
                    const isGreen = item.concluido;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (item.rawFolha && onSelectFolha) {
                            onSelectFolha(item.rawFolha);
                          }
                        }}
                        className={`
                          p-2.5 rounded-xl border transition-all duration-150 relative group
                          ${item.rawFolha ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.99]' : ''}
                          ${
                            isGreen
                              ? 'bg-emerald-950/30 border-emerald-500/50 text-slate-200 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/20'
                              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                          }
                        `}
                      >
                        {/* Status Accent Left Bar */}
                        <div
                          className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${
                            isGreen ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
                          }`}
                        />

                        {/* Card Header: Type Badge & State */}
                        <div className="flex items-center justify-between gap-1 mb-1.5 pl-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.tipo === 'folha' ? (
                              <Wrench className="w-3.5 h-3.5 text-hp-400 shrink-0" />
                            ) : (
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}

                            <span className="text-xs font-bold font-mono truncate text-white">
                              {item.folhaNumero || item.titulo}
                            </span>
                          </div>

                          {/* Green Concluded Badge vs Pending Badge */}
                          {isGreen ? (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              Concluído
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                              <Clock className="w-2.5 h-2.5" />
                              Em curso
                            </span>
                          )}
                        </div>

                        {/* Vehicle & Company info if associated with Folha */}
                        {item.matricula && (
                          <div className="pl-1.5 text-[11px] font-bold text-slate-100 flex items-center gap-1.5 mb-1 truncate">
                            <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="bg-slate-950 px-1.5 py-0.2 rounded font-mono text-[10px] text-hp-300 border border-slate-800">
                              {item.matricula}
                            </span>
                            <span className="truncate text-slate-300">{item.marcaModelo}</span>
                          </div>
                        )}

                        {item.empresaNome && (
                          <div className="pl-1.5 text-[10px] text-slate-400 flex items-center gap-1 mb-1 truncate">
                            <Building2 className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            <span className="truncate font-medium">{item.empresaNome}</span>
                          </div>
                        )}

                        {/* Description of Service / Problem */}
                        <p className={`pl-1.5 text-[11px] leading-snug line-clamp-2 ${isGreen ? 'text-emerald-100/90' : 'text-slate-300'}`}>
                          {item.descricao}
                        </p>

                        {/* Footer: Technician, and (if Admin) Hours and Summary */}
                        <div className="pl-1.5 mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1 truncate max-w-[110px]">
                            <User className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            <span className="truncate">{item.tecnico}</span>
                          </span>

                          {isAdmin && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.horas !== undefined && item.horas > 0 && (
                                <span className={`font-bold ${isGreen ? 'text-emerald-400' : 'text-hp-400'}`}>
                                  {item.horas}h
                                </span>
                              )}
                              {item.qtdPecas !== undefined && item.qtdPecas > 0 && (
                                <span className="text-indigo-300 font-bold">
                                  {item.qtdPecas} pçs
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
