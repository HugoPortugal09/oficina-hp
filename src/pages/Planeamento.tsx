import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Building2,
  Truck,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  CalendarCheck,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  GripVertical
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import type {
  FolhaServico,
  Empresa,
  Cliente,
  Equipamento,
  VisitaCliente
} from '../types';
import { db, STORAGE_KEYS } from '../services/dbService';

interface PlaneamentoProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  clientes: Cliente[];
  equipamentos: Equipamento[];
  visitas: VisitaCliente[];
  onSaveVisita: (visita: VisitaCliente) => void;
  onDeleteVisita: (id: string) => void;
  onUpdateFolha: (folha: FolhaServico) => void;
  onSelectFolha?: (folha: FolhaServico) => void;
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

const MOTIVOS_VISITA = [
  'Diagnóstico no Terreno',
  'Levantamento de Obra / Frota',
  'Peritagem & Avaliação',
  'Visita Comercial & Orçamentação',
  'Acompanhamento Técnico Preventivo',
  'Entrega de Equipamento & Formação',
  'Outro'
];

const TECNICOS_DISPONIVEIS = [
  'Hugo Portugal',
  'Rui Fernandes',
  'Carlos Mendes',
  'Miguel Santos',
  'António Silva'
];

export const Planeamento: React.FC<PlaneamentoProps> = ({
  folhas,
  empresas,
  clientes,
  equipamentos,
  visitas,
  onSaveVisita,
  onDeleteVisita,
  onUpdateFolha,
  onSelectFolha
}) => {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [selectedTecnico, setSelectedTecnico] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Drag & drop state
  const [draggedItem, setDraggedItem] = useState<{ type: 'visita' | 'folha'; id: string } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Modals state
  const [isVisitaModalOpen, setIsVisitaModalOpen] = useState(false);
  const [editingVisita, setEditingVisita] = useState<VisitaCliente | null>(null);
  
  const [isScheduleFolhaModalOpen, setIsScheduleFolhaModalOpen] = useState(false);
  const [selectedFolhaToSchedule, setSelectedFolhaToSchedule] = useState<FolhaServico | null>(null);
  const [scheduleData, setScheduleData] = useState({
    data: formatDateISO(new Date()),
    hora: '09:00',
    tecnico: 'Hugo Portugal'
  });

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, type: 'visita' | 'folha', id: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, id }));
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ type, id });
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverDay(null);
  };

  const handleDayDragOver = (e: React.DragEvent, dayIso: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== dayIso) {
      setDragOverDay(dayIso);
    }
  };

  const handleDayDragEnter = (e: React.DragEvent, dayIso: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverDay !== dayIso) {
      setDragOverDay(dayIso);
    }
  };

  const handleDayDragLeave = (e: React.DragEvent, dayIso: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return; // Still inside column
    }
    if (dragOverDay === dayIso) {
      setDragOverDay(null);
    }
  };

  const handleDayDrop = (e: React.DragEvent, targetDayIso: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDay(null);

    let item = draggedItem;
    try {
      const dataStr = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (dataStr) {
        item = JSON.parse(dataStr);
      }
    } catch {}

    setDraggedItem(null);

    if (!item || !item.id) return;

    if (item.type === 'visita') {
      const v = visitas.find(vis => vis.id === item!.id);
      if (v) {
        onSaveVisita({
          ...v,
          data: targetDayIso
        });
      }
    } else if (item.type === 'folha') {
      const f = folhas.find(fol => fol.id === item!.id);
      if (f) {
        onUpdateFolha({
          ...f,
          dataPlaneada: targetDayIso,
          horaPlaneada: f.horaPlaneada || '09:00',
          tecnicoPlaneado: f.tecnicoPlaneado || (selectedTecnico !== 'TODOS' ? selectedTecnico : 'Hugo Portugal'),
          atualizadoEm: new Date().toISOString()
        });
      }
    }
  };

  // Form state for Visita
  const [visitaForm, setVisitaForm] = useState<Partial<VisitaCliente>>({
    data: formatDateISO(new Date()),
    hora: '09:30',
    empresaId: '',
    nomeEmpresa: '',
    nomeContacto: '',
    telefone: '',
    morada: '',
    tecnico: 'Hugo Portugal',
    motivo: 'Diagnóstico no Terreno',
    status: 'Agendada',
    notas: ''
  });

  // Week navigation
  const handlePrevWeek = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNextWeek = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleCurrentWeek = () => setCurrentMonday(getMonday(new Date()));

  // 7 Days of current week
  const weekDays = useMemo(() => {
    const dias = [
      { index: 0, label: 'Segunda-feira', short: 'Seg' },
      { index: 1, label: 'Terça-feira', short: 'Ter' },
      { index: 2, label: 'Quarta-feira', short: 'Qua' },
      { index: 3, label: 'Quinta-feira', short: 'Qui' },
      { index: 4, label: 'Sexta-feira', short: 'Sex' },
      { index: 5, label: 'Sábado', short: 'Sáb' },
      { index: 6, label: 'Domingo', short: 'Dom' },
    ];

    return dias.map((dia, idx) => {
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

  // Open Folhas de Serviço (not finalized)
  const openFolhas = useMemo(() => {
    return folhas.filter(f => !f.status.startsWith('FEITO -'));
  }, [folhas]);

  // Open Visita Modal (New or Edit)
  const handleOpenVisitaModal = (visita?: VisitaCliente) => {
    if (visita) {
      setEditingVisita(visita);
      setVisitaForm({ ...visita });
    } else {
      setEditingVisita(null);
      setVisitaForm({
        data: formatDateISO(new Date()),
        hora: '09:30',
        empresaId: empresas[0]?.id || '',
        nomeEmpresa: empresas[0]?.nome || '',
        nomeContacto: '',
        telefone: '',
        morada: '',
        tecnico: 'Hugo Portugal',
        motivo: 'Diagnóstico no Terreno',
        status: 'Agendada',
        notas: ''
      });
    }
    setIsVisitaModalOpen(true);
  };

  // Handle Empresa change in Visita Form
  const handleEmpresaChange = (empId: string) => {
    const emp = empresas.find(e => e.id === empId);
    if (!emp) return;

    const contact = clientes.find(c => c.empresaId === empId);
    setVisitaForm(prev => ({
      ...prev,
      empresaId: emp.id,
      nomeEmpresa: emp.nome,
      nomeContacto: contact ? contact.nome : '',
      telefone: contact ? contact.telemovel : (emp.telefone || ''),
      morada: emp.moradaSede || ''
    }));
  };

  // Save Visita
  const handleSaveVisitaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitaForm.nomeEmpresa || !visitaForm.data) return;

    const savedVisita: VisitaCliente = {
      id: editingVisita?.id || db.generateId('vis'),
      numero: editingVisita?.numero || db.generateSequenceNumber(STORAGE_KEYS.VISITAS, 'VIS'),
      data: visitaForm.data || formatDateISO(new Date()),
      hora: visitaForm.hora || '09:30',
      empresaId: visitaForm.empresaId || '',
      nomeEmpresa: visitaForm.nomeEmpresa || 'Empresa',
      clienteId: visitaForm.clienteId,
      nomeContacto: visitaForm.nomeContacto,
      telefone: visitaForm.telefone,
      morada: visitaForm.morada,
      tecnico: visitaForm.tecnico || 'Hugo Portugal',
      motivo: visitaForm.motivo || 'Diagnóstico no Terreno',
      status: visitaForm.status || 'Agendada',
      notas: visitaForm.notas,
      folhaServicoId: visitaForm.folhaServicoId,
      dataCriacao: editingVisita?.dataCriacao || formatDateISO(new Date())
    };

    onSaveVisita(savedVisita);
    setIsVisitaModalOpen(false);
  };

  // Open Schedule Modal for a Folha
  const handleOpenScheduleFolha = (folha: FolhaServico) => {
    setSelectedFolhaToSchedule(folha);
    setScheduleData({
      data: folha.dataPlaneada || folha.data || formatDateISO(new Date()),
      hora: folha.horaPlaneada || '09:00',
      tecnico: folha.tecnicoPlaneado || 'Hugo Portugal'
    });
    setIsScheduleFolhaModalOpen(true);
  };

  // Save Scheduled Folha
  const handleSaveScheduleFolha = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolhaToSchedule) return;

    const updated: FolhaServico = {
      ...selectedFolhaToSchedule,
      dataPlaneada: scheduleData.data,
      horaPlaneada: scheduleData.hora,
      tecnicoPlaneado: scheduleData.tecnico,
      atualizadoEm: new Date().toISOString()
    };

    onUpdateFolha(updated);
    setIsScheduleFolhaModalOpen(false);
    setSelectedFolhaToSchedule(null);
  };

  // Filtered Visitas & Folhas for current week
  const weekStartStr = weekDays[0].isoStr;
  const weekEndStr = weekDays[6].isoStr;

  const currentWeekVisitas = useMemo(() => {
    return visitas.filter(v => {
      const inWeek = v.data >= weekStartStr && v.data <= weekEndStr;
      if (!inWeek) return false;
      if (selectedTecnico !== 'TODOS' && v.tecnico !== selectedTecnico) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesEmp = v.nomeEmpresa.toLowerCase().includes(q);
        const matchesMotivo = v.motivo.toLowerCase().includes(q);
        const matchesTec = v.tecnico.toLowerCase().includes(q);
        if (!matchesEmp && !matchesMotivo && !matchesTec) return false;
      }
      return true;
    });
  }, [visitas, weekStartStr, weekEndStr, selectedTecnico, searchTerm]);

  const currentWeekFolhas = useMemo(() => {
    return folhas.filter(f => {
      const plannedDate = f.dataPlaneada || f.data;
      const inWeek = plannedDate >= weekStartStr && plannedDate <= weekEndStr;
      if (!inWeek) return false;
      if (selectedTecnico !== 'TODOS' && f.tecnicoPlaneado && f.tecnicoPlaneado !== selectedTecnico) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesNum = f.numero.toLowerCase().includes(q);
        const matchesPlate = f.matricula.toLowerCase().includes(q);
        const emp = empresas.find(e => e.id === f.empresaId);
        const matchesEmp = emp?.nome.toLowerCase().includes(q) || false;
        if (!matchesNum && !matchesPlate && !matchesEmp) return false;
      }
      return true;
    });
  }, [folhas, weekStartStr, weekEndStr, selectedTecnico, searchTerm, empresas]);

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Planeamento & Visitas
            </h1>
            <p className="text-xs text-slate-400">
              Agendamento de folhas de serviço abertas e gestão de visitas aos clientes
            </p>
          </div>
        </div>

        {/* Actions & Week Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1">
            <button
              onClick={handlePrevWeek}
              title="Semana Anterior"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2 text-xs font-mono font-bold text-slate-200">
              {weekDays[0].formattedDayMonth} a {weekDays[6].formattedDayMonth}
            </span>

            <button
              onClick={handleNextWeek}
              title="Semana Seguinte"
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCurrentWeek}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-bold transition-all active:scale-95"
          >
            Esta Semana
          </button>

          {/* New Visit Button */}
          <button
            onClick={() => handleOpenVisitaModal()}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova Visita ao Cliente
          </button>
        </div>
      </div>

      {/* Main Content Grid: Left Drawer (Open Folhas) + Main Planner Board */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5 items-start">
        {/* Left Side Panel: Open Folhas to Schedule */}
        <div className="lg:col-span-1 space-y-3">
          <GlassCard className="p-3 border-hp-500/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-hp-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Folhas em Aberto ({openFolhas.length})
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Por agendar</span>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Arraste para um dia do calendário ou clique em <span className="text-hp-300 font-bold">Agendar</span>.
            </p>

            <div className="space-y-2 max-h-[620px] overflow-y-auto custom-scrollbar pr-1">
              {openFolhas.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 italic">
                  Não existem folhas de serviço em aberto.
                </div>
              ) : (
                openFolhas.map(f => {
                  const emp = empresas.find(e => e.id === f.empresaId);
                  const isScheduled = !!f.dataPlaneada;
                  const isDraggingThis = draggedItem?.type === 'folha' && draggedItem?.id === f.id;

                  return (
                    <div
                      key={f.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, 'folha', f.id)}
                      onDragEnd={handleDragEnd}
                      className={`p-2.5 rounded-xl border transition-all space-y-1.5 text-xs cursor-grab active:cursor-grabbing select-none ${
                        isDraggingThis
                          ? 'opacity-40 border-dashed border-hp-400 bg-hp-950/40 scale-95'
                          : 'bg-slate-900/80 border-slate-800 hover:border-hp-500/60 hover:shadow-lg hover:shadow-hp-500/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <GripVertical className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300 shrink-0" />
                          <span className="font-mono font-bold text-hp-400">{f.numero}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {f.tipo}
                        </span>
                      </div>

                      <div className="text-[11px] font-bold text-white flex items-center gap-1.5 truncate">
                        <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono text-hp-300">{f.matricula}</span>
                        <span className="truncate text-slate-300">{f.marca} {f.modelo}</span>
                      </div>

                      <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{emp?.nome || 'Cliente'}</span>
                      </div>

                      {f.dataPlaneada && (
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono pt-1 border-t border-slate-800/60">
                          <CalendarIcon className="w-3 h-3" />
                          <span>Planeado: {f.dataPlaneada} {f.horaPlaneada ? `às ${f.horaPlaneada}` : ''}</span>
                        </div>
                      )}

                      <div className="pt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenScheduleFolha(f)}
                          className="flex-1 py-1 rounded-lg bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 border border-hp-500/30 text-[10px] font-bold transition-colors text-center"
                        >
                          {isScheduled ? 'Reagendar' : 'Agendar no Mapa'}
                        </button>
                        {onSelectFolha && (
                          <button
                            type="button"
                            onClick={() => onSelectFolha(f)}
                            title="Ver Folha de Serviço"
                            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </GlassCard>
        </div>

        {/* Right Side: Weekly Calendar Plan Grid (7 Days) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[180px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por empresa, viatura..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-hp-500"
                />
              </div>

              <select
                value={selectedTecnico}
                onChange={e => setSelectedTecnico(e.target.value)}
                className="py-1 px-2.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-hp-500"
              >
                <option value="TODOS">Todos os Técnicos</option>
                {TECNICOS_DISPONIVEIS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-hp-500" />
                <span className="text-hp-300">Folha de Serviço</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-emerald-300">Visita ao Cliente</span>
              </div>
            </div>
          </div>

          {/* 7 Days Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-2.5 items-start">
            {weekDays.map(day => {
              const dayFolhas = currentWeekFolhas.filter(f => (f.dataPlaneada || f.data) === day.isoStr);
              const dayVisitas = currentWeekVisitas.filter(v => v.data === day.isoStr);
              const totalItems = dayFolhas.length + dayVisitas.length;
              const isOver = dragOverDay === day.isoStr;

              return (
                <div
                  key={day.isoStr}
                  onDragEnter={(e) => handleDayDragEnter(e, day.isoStr)}
                  onDragOver={(e) => handleDayDragOver(e, day.isoStr)}
                  onDragLeave={(e) => handleDayDragLeave(e, day.isoStr)}
                  onDrop={(e) => handleDayDrop(e, day.isoStr)}
                  className={`
                    flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden min-h-[360px]
                    ${
                      isOver
                        ? 'bg-hp-950/50 border-hp-400 ring-2 ring-hp-400/50 shadow-2xl scale-[1.01]'
                        : day.isToday
                        ? 'bg-slate-900/90 border-hp-500/50 ring-1 ring-hp-500/30 shadow-lg shadow-hp-500/10'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80'
                    }
                  `}
                >
                  {/* Day Header */}
                  <div
                    onDragEnter={(e) => handleDayDragEnter(e, day.isoStr)}
                    onDragOver={(e) => handleDayDragOver(e, day.isoStr)}
                    onDrop={(e) => handleDayDrop(e, day.isoStr)}
                    className={`p-2.5 border-b ${
                      isOver
                        ? 'bg-hp-500/20 border-hp-400/40'
                        : day.isToday
                        ? 'bg-hp-600/15 border-hp-500/30'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${
                          isOver ? 'text-hp-300 font-extrabold' : day.isToday ? 'text-hp-400 font-extrabold' : 'text-slate-200'
                        }`}>
                          {day.short}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {day.formattedDayMonth}
                        </span>
                      </div>
                      {day.isToday && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-hp-500 text-white">
                          Hoje
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {totalItems} agendamentos
                    </div>
                  </div>

                  {/* Day Items List */}
                  <div
                    onDragEnter={(e) => handleDayDragEnter(e, day.isoStr)}
                    onDragOver={(e) => handleDayDragOver(e, day.isoStr)}
                    onDrop={(e) => handleDayDrop(e, day.isoStr)}
                    className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar"
                  >
                    {/* Active Drop Placeholder Indicator when dragging over this day */}
                    {isOver && (
                      <div className="p-3 rounded-xl border-2 border-dashed border-hp-400 bg-hp-500/15 text-hp-300 text-[11px] font-bold text-center animate-pulse">
                        + Largar para agendar em {day.short} ({day.formattedDayMonth})
                      </div>
                    )}

                    {totalItems === 0 && !isOver ? (
                      <div className="py-8 text-center text-[10px] text-slate-600 italic">
                        Livre (Arraste para aqui)
                      </div>
                    ) : (
                      <>
                        {/* Planned Folhas de Serviço */}
                        {dayFolhas.map(f => {
                          const emp = empresas.find(e => e.id === f.empresaId);
                          const isDraggingThis = draggedItem?.type === 'folha' && draggedItem?.id === f.id;

                          return (
                            <div
                              key={`f_${f.id}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, 'folha', f.id)}
                              onDragEnd={handleDragEnd}
                              onDragEnter={(e) => handleDayDragEnter(e, day.isoStr)}
                              onDragOver={(e) => handleDayDragOver(e, day.isoStr)}
                              onDrop={(e) => handleDayDrop(e, day.isoStr)}
                              className={`p-2 rounded-xl border transition-all text-xs space-y-1 relative cursor-grab active:cursor-grabbing select-none ${
                                isDraggingThis
                                  ? 'opacity-40 border-dashed border-hp-400 bg-hp-950/40 scale-95'
                                  : 'bg-hp-950/20 border-hp-500/30 hover:border-hp-400 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-hp-400/60 shrink-0" />
                                  <span className="font-mono font-bold text-hp-400">{f.numero}</span>
                                </div>
                                {f.horaPlaneada && (
                                  <span className="text-[10px] text-slate-300 font-mono flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {f.horaPlaneada}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] font-bold text-white truncate">
                                {f.matricula} • {f.marca} {f.modelo}
                              </div>

                              <div className="text-[10px] text-slate-300 truncate">
                                {emp?.nome || 'Cliente'}
                              </div>

                              {f.tecnicoPlaneado && (
                                <div className="text-[9px] text-hp-300/80 font-mono truncate">
                                  Téc: {f.tecnicoPlaneado}
                                </div>
                              )}

                              <div className="pt-1 flex items-center justify-between border-t border-hp-500/20">
                                <button
                                  type="button"
                                  onClick={() => handleOpenScheduleFolha(f)}
                                  className="text-[9px] text-slate-400 hover:text-white"
                                >
                                  Alterar
                                </button>
                                {onSelectFolha && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectFolha(f)}
                                    className="text-[9px] font-bold text-hp-400 hover:underline flex items-center gap-0.5"
                                  >
                                    Ver Folha ➔
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Visitas a Clientes */}
                        {dayVisitas.map(v => {
                          const isDraggingThis = draggedItem?.type === 'visita' && draggedItem?.id === v.id;

                          return (
                            <div
                              key={`v_${v.id}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, 'visita', v.id)}
                              onDragEnd={handleDragEnd}
                              onDragEnter={(e) => handleDayDragEnter(e, day.isoStr)}
                              onDragOver={(e) => handleDayDragOver(e, day.isoStr)}
                              onDrop={(e) => handleDayDrop(e, day.isoStr)}
                              className={`p-2 rounded-xl border transition-all text-xs space-y-1 cursor-grab active:cursor-grabbing select-none ${
                                isDraggingThis
                                  ? 'opacity-40 border-dashed border-emerald-400 bg-emerald-950/40 scale-95'
                                  : 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <GripVertical className="w-3 h-3 text-emerald-400/60 shrink-0" />
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Visita
                                  </span>
                                </div>
                                {v.hora && (
                                  <span className="text-[10px] text-emerald-300 font-mono flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    {v.hora}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] font-bold text-white truncate">
                                {v.nomeEmpresa}
                              </div>

                              <div className="text-[10px] text-emerald-200/90 font-medium truncate">
                                {v.motivo}
                              </div>

                              {v.tecnico && (
                                <div className="text-[9px] text-slate-400 font-mono truncate">
                                  Téc: {v.tecnico}
                                </div>
                              )}

                              <div className="pt-1 flex items-center justify-between border-t border-emerald-500/20 text-[9px]">
                                <button
                                  type="button"
                                  onClick={() => handleOpenVisitaModal(v)}
                                  className="text-emerald-300 hover:text-white font-bold"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteVisita(v.id)}
                                  className="text-rose-400 hover:text-rose-300"
                                >
                                  Remover
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal: Nova / Editar Visita ao Cliente */}
      {isVisitaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingVisita ? 'Editar Visita ao Cliente' : 'Nova Visita ao Cliente'}
                </h3>
              </div>
              <button
                onClick={() => setIsVisitaModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVisitaSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Empresa / Cliente *
                </label>
                <select
                  value={visitaForm.empresaId || ''}
                  onChange={e => handleEmpresaChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione a Empresa...</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Pessoa de Contacto
                  </label>
                  <input
                    type="text"
                    value={visitaForm.nomeContacto || ''}
                    onChange={e => setVisitaForm({ ...visitaForm, nomeContacto: e.target.value })}
                    placeholder="Nome do responsável"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={visitaForm.telefone || ''}
                    onChange={e => setVisitaForm({ ...visitaForm, telefone: e.target.value })}
                    placeholder="Contacto telefónico"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Data da Visita *
                  </label>
                  <input
                    type="date"
                    value={visitaForm.data || ''}
                    onChange={e => setVisitaForm({ ...visitaForm, data: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Hora Prevista
                  </label>
                  <input
                    type="time"
                    value={visitaForm.hora || ''}
                    onChange={e => setVisitaForm({ ...visitaForm, hora: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Técnico / Responsável *
                  </label>
                  <select
                    value={visitaForm.tecnico || 'Hugo Portugal'}
                    onChange={e => setVisitaForm({ ...visitaForm, tecnico: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {TECNICOS_DISPONIVEIS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Motivo da Visita *
                  </label>
                  <select
                    value={visitaForm.motivo || 'Diagnóstico no Terreno'}
                    onChange={e => setVisitaForm({ ...visitaForm, motivo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MOTIVOS_VISITA.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Notas / Observações
                </label>
                <textarea
                  rows={3}
                  value={visitaForm.notas || ''}
                  onChange={e => setVisitaForm({ ...visitaForm, notas: e.target.value })}
                  placeholder="Indicações, objetivos da visita ou endereço específico..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsVisitaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
                >
                  {editingVisita ? 'Guardar Alterações' : 'Agendar Visita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agendar Folha de Serviço */}
      {isScheduleFolhaModalOpen && selectedFolhaToSchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  Agendar Folha • {selectedFolhaToSchedule.numero}
                </h3>
              </div>
              <button
                onClick={() => setIsScheduleFolhaModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleFolha} className="p-4 space-y-3">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="text-white font-bold">{selectedFolhaToSchedule.matricula} - {selectedFolhaToSchedule.marca} {selectedFolhaToSchedule.modelo}</div>
                <div className="text-slate-400">Tipo: <span className="text-hp-300 font-semibold">{selectedFolhaToSchedule.tipo}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Data Prevista *
                  </label>
                  <input
                    type="date"
                    value={scheduleData.data}
                    onChange={e => setScheduleData({ ...scheduleData, data: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Hora Prevista
                  </label>
                  <input
                    type="time"
                    value={scheduleData.hora}
                    onChange={e => setScheduleData({ ...scheduleData, hora: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Técnico Atribuído *
                </label>
                <select
                  value={scheduleData.tecnico}
                  onChange={e => setScheduleData({ ...scheduleData, tecnico: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                >
                  {TECNICOS_DISPONIVEIS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsScheduleFolhaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-hp-600 hover:bg-hp-500 text-white text-xs font-bold shadow-lg shadow-hp-600/30"
                >
                  Guardar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
