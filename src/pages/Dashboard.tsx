import React from 'react';
import {
  Wrench,
  Truck,
  FileSpreadsheet,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  MapPin
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import type {
  FolhaServico,
  Proposta,
  Equipamento,
  Empresa,
  NavigationTab
} from '../types';

interface DashboardProps {
  folhasServico: FolhaServico[];
  propostas: Proposta[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  setActiveTab: (tab: NavigationTab) => void;
  onOpenScanner: () => void;
  onSelectFolha: (fs: FolhaServico) => void;
  onCreateNewService: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  folhasServico,
  propostas,
  equipamentos,
  empresas,
  setActiveTab,
  onOpenScanner,
  onSelectFolha,
  onCreateNewService
}) => {
  // Compute Key Metrics
  const activeFolhas = folhasServico.filter(
    f => !f.status.includes('FEITO - Faturado')
  );

  const viaturasEmOficina = folhasServico.filter(
    f => f.status.startsWith('OF -') || f.localizacaoTipo === 'oficina'
  );

  const pedidosNoTerreno = folhasServico.filter(f => {
    if (f.status.startsWith('FEITO')) return false;
    const isInOficina =
      f.localizacaoTipo === 'oficina' ||
      f.tipo === 'Oficina' ||
      f.status.startsWith('OF -') ||
      f.localizacao?.toLowerCase().includes('oficina');
    return !isInOficina;
  });

  const orcamentosPendentes = propostas.filter(
    p => p.status === 'Rascunho' || p.status === 'Enviada'
  );

  const valorTotalOrcado = propostas.reduce((acc, p) => acc + p.totalComIva, 0);

  const concluidosEsteMes = folhasServico.filter(
    f => f.status.startsWith('FEITO -')
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-hp-950/60 border border-slate-800 p-4 sm:p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-hp-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-hp-500/15 border border-hp-500/30 text-hp-400 text-xs font-semibold">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Gestão Operacional de Oficinas & Frotas em Tempo Real
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Painel de Controlo da Oficina HP
            </h1>
            <p className="text-xs text-slate-300 max-w-xl">
              Monitore o ciclo de vida completo de manutenção, viaturas em reparação, aprovação de orçamentos e diagnóstico por visão computacional.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('mapa')}
              className="px-3.5 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/40 text-xs font-bold flex items-center gap-2 shadow-lg shadow-orange-500/10 transition-all active:scale-95"
            >
              <MapPin className="w-3.5 h-3.5 text-orange-400" />
              Mapa de Serviços ({pedidosNoTerreno.length} no Terreno)
            </button>
            <button
              onClick={onCreateNewService}
              className="glass-btn px-3.5 py-2 rounded-xl font-bold text-white text-xs flex items-center gap-1.5 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              Nova Folha de Serviço
            </button>
            <button
              onClick={onOpenScanner}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-hp-500 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Scanner IA
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <GlassCard hoverEffect onClick={() => setActiveTab('oficina')}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
              <Wrench className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-hp-400 bg-hp-500/10 px-2 py-0.5 rounded-full">
              Em curso
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Folhas Ativas</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">{activeFolhas.length}</h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> {concluidosEsteMes.length} concluídas recentemente
            </p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect onClick={() => setActiveTab('kanban')}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Truck className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
              Oficina
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Viaturas em Reparação</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">{viaturasEmOficina.length}</h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              Total de {equipamentos.length} viaturas na frota
            </p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect onClick={() => setActiveTab('propostas')}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Orçamentos
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Propostas Pendentes</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">{orcamentosPendentes.length}</h3>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              {propostas.length} orçamentos emitidos
            </p>
          </div>
        </GlassCard>

        <GlassCard hoverEffect onClick={() => setActiveTab('propostas')}>
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              Volume
            </span>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Volume Orçado C/ IVA</p>
            <h3 className="text-2xl font-extrabold text-white mt-1">
              {valorTotalOrcado.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
            </h3>
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" /> Ciclo de faturação ativo
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Main Content Grid: Recent Services & Quick Fleet Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Folhas de Serviço */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Wrench className="w-5 h-5 text-hp-400" />
              Intervenções Recentes na Oficina
            </h3>
            <button
              onClick={() => setActiveTab('oficina')}
              className="text-xs font-semibold text-hp-400 hover:text-hp-300 flex items-center gap-1"
            >
              Ver todas ({folhasServico.length}) &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {folhasServico.slice(0, 5).map(fs => {
              const empresa = empresas.find(e => e.id === fs.empresaId);
              const servicesCompleted = fs.servicos.filter(s => s.concluido).length;
              const partsCompleted = fs.pecas.filter(p => p.concluido).length;

              return (
                <div
                  key={fs.id}
                  onClick={() => onSelectFolha(fs)}
                  className="glass-card p-4 rounded-2xl cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-hp-400">{fs.numero}</span>
                      <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-200">
                        {fs.matricula}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {fs.marca} {fs.modelo}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {empresa?.nome || 'Empresa Geral'}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-1">
                      {fs.anomalias || 'Sem anomalias registadas.'}
                    </p>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                    <Badge variant={fs.status.startsWith('FEITO') ? 'success' : fs.status.startsWith('AT') ? 'info' : 'warning'}>
                      {fs.status.split(' - ')[1] || fs.status}
                    </Badge>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <span>Serviços: {servicesCompleted}/{fs.servicos.length}</span>
                      <span>Peças: {partsCompleted}/{fs.pecas.length}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Fleet Summary & Quick Access */}
        <div className="space-y-5">
          <GlassCard>
            <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Estado da Frota de Clientes
            </h4>

            <div className="space-y-3">
              {empresas.map(emp => {
                const empEquips = equipamentos.filter(e => e.empresaId === emp.id);
                const empActiveServices = folhasServico.filter(
                  f => f.empresaId === emp.id && !f.status.includes('FEITO - Faturado')
                );

                return (
                  <div
                    key={emp.id}
                    onClick={() => setActiveTab('empresas')}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 truncate max-w-[170px]">
                        {emp.nome}
                      </span>
                      <span className="font-mono text-slate-400">
                        {empEquips.length} viaturas
                      </span>
                    </div>
                    {empActiveServices.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>{empActiveServices.length} em manutenção ativa</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border-indigo-900/40">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Visão Computacional IA
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Aponte a câmara para a matrícula de qualquer viatura à chegada da oficina para abrir a ficha de serviço ou histórico automaticamente.
            </p>
            <button
              onClick={onOpenScanner}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
            >
              Abrir Scanner de Matrículas
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
