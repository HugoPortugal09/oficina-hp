import React, { useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Truck,
  Building2,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  ShieldAlert,
  Layers,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Timer
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { formatDate } from '../utils/dateUtils';
import type { FolhaServico, Empresa, Equipamento } from '../types';

interface TemposRespostaProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  onSelectFolha?: (folha: FolhaServico) => void;
}

// Helpers for date calculations
function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function calculateDiffDays(startDateStr?: string, endDateStr?: string): { days: number; text: string } | null {
  const start = parseDate(startDateStr);
  if (!start) return null;

  const end = endDateStr ? parseDate(endDateStr) || new Date() : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    return { days: Number(diffDays.toFixed(1)), text: `${hours}h` };
  } else {
    const roundedDays = Math.round(diffDays * 10) / 10;
    return { days: roundedDays, text: `${roundedDays} ${roundedDays === 1 ? 'dia' : 'dias'}` };
  }
}

export const TemposResposta: React.FC<TemposRespostaProps> = ({
  folhas,
  empresas,
  equipamentos,
  onSelectFolha
}) => {
  const [filterScope, setFilterScope] = useState<'abertas' | 'todos' | 'oficina' | 'criticas'>('abertas');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'imobilizacao' | 'requisicao' | 'numero' | 'data'>('imobilizacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Process and augment rows
  const processedRows = useMemo(() => {
    return folhas.map(f => {
      const emp = empresas.find(e => e.id === f.empresaId);
      const isConcluido = f.status.startsWith('FEITO -');

      // 1. Tempo de Imobilização (Oficina): calculated from dataEntradaOficina (or f.data) to dataConclusao (or now)
      const startDateImobilizacao = f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined);
      const imobilizacao = calculateDiffDays(startDateImobilizacao, f.dataConclusao);

      // 2. Dias desde a Requisição (if entered)
      const diasRequisicao = calculateDiffDays(f.dataRequisicao, f.dataConclusao);

      // 3. Tempo de Resposta (from data to entry/first action)
      const tempoResposta = calculateDiffDays(f.dataRequisicao || f.data, f.dataEntradaOficina || f.data);

      return {
        folha: f,
        empresaNome: emp?.nome || 'Cliente',
        isConcluido,
        startDateImobilizacao,
        imobilizacao,
        diasRequisicao,
        tempoResposta,
        isOficina: f.tipo === 'Oficina',
        isCritico: !isConcluido && (((imobilizacao?.days || 0) >= 10) || ((diasRequisicao?.days || 0) >= 10))
      };
    });
  }, [folhas, empresas]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return processedRows.filter(row => {
      // Filter scope
      if (filterScope === 'abertas' && row.isConcluido) return false;
      if (filterScope === 'oficina' && !row.isOficina) return false;
      if (filterScope === 'criticas' && !row.isCritico) return false;

      // Filter tipo
      if (filterTipo !== 'TODOS' && row.folha.tipo !== filterTipo) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesNum = row.folha.numero.toLowerCase().includes(q);
        const matchesPlate = row.folha.matricula.toLowerCase().includes(q);
        const matchesEmp = row.empresaNome.toLowerCase().includes(q);
        const matchesStatus = row.folha.status.toLowerCase().includes(q);
        if (!matchesNum && !matchesPlate && !matchesEmp && !matchesStatus) return false;
      }

      return true;
    }).sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'imobilizacao') {
        valA = a.imobilizacao?.days || 0;
        valB = b.imobilizacao?.days || 0;
      } else if (sortBy === 'requisicao') {
        valA = a.diasRequisicao?.days || 0;
        valB = b.diasRequisicao?.days || 0;
      } else if (sortBy === 'numero') {
        return sortOrder === 'asc'
          ? a.folha.numero.localeCompare(b.folha.numero)
          : b.folha.numero.localeCompare(a.folha.numero);
      } else if (sortBy === 'data') {
        valA = new Date(a.folha.data).getTime();
        valB = new Date(b.folha.data).getTime();
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [processedRows, filterScope, filterTipo, searchTerm, sortBy, sortOrder]);

  // Overall Statistics / Metrics
  const stats = useMemo(() => {
    const openOficinaRows = processedRows.filter(r => r.isOficina && !r.isConcluido && r.imobilizacao);
    const avgImobilizacaoOficina = openOficinaRows.length > 0
      ? openOficinaRows.reduce((acc, r) => acc + (r.imobilizacao?.days || 0), 0) / openOficinaRows.length
      : 0;

    const rowsWithReq = processedRows.filter(r => !r.isConcluido && r.diasRequisicao);
    const avgDiasReq = rowsWithReq.length > 0
      ? rowsWithReq.reduce((acc, r) => acc + (r.diasRequisicao?.days || 0), 0) / rowsWithReq.length
      : 0;

    const criticalCount = processedRows.filter(r => r.isCritico).length;
    const totalAbertas = processedRows.filter(r => !r.isConcluido).length;

    return {
      avgImobilizacaoOficina,
      avgDiasReq,
      criticalCount,
      totalAbertas
    };
  }, [processedRows]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Numero',
      'Tipo',
      'Matricula',
      'Empresa',
      'Data Criacao',
      'Data Requisicao',
      'Dias desde Requisicao',
      'Data Entrada Oficina',
      'Data Conclusao',
      'Tempo Imobilizacao (Dias)',
      'Estado'
    ];

    const rows = filteredRows.map(r => [
      r.folha.numero,
      r.folha.tipo,
      r.folha.matricula,
      `"${r.empresaNome.replace(/"/g, '""')}"`,
      formatDate(r.folha.data),
      formatDate(r.folha.dataRequisicao, 'N/A'),
      r.diasRequisicao ? r.diasRequisicao.days : 'N/A',
      formatDate(r.folha.dataEntradaOficina, 'N/A'),
      r.folha.dataConclusao ? formatDate(r.folha.dataConclusao) : 'Em Aberto',
      r.imobilizacao ? r.imobilizacao.days : 'N/A',
      `"${r.folha.status.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tempos_resposta_oficina_hp_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/70 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
            <Timer className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Tempos de Resposta & Imobilização
            </h1>
            <p className="text-xs text-slate-400">
              Cálculo de imobilização em oficina, tempos de resposta e acompanhamento de requisições
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-hp-400" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3 border-orange-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block">Imobilização Média (Oficina)</span>
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-orange-400 mt-1">
            {stats.avgImobilizacaoOficina.toFixed(1)}{' '}
            <span className="text-xs text-slate-400 font-normal">dias</span>
          </h3>
          <span className="text-[10px] text-slate-400">
            Desde a entrada na oficina
          </span>
        </GlassCard>

        <GlassCard className="p-3 border-sky-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block">Média desde Requisição</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-sky-300 mt-1">
            {stats.avgDiasReq.toFixed(1)}{' '}
            <span className="text-xs text-slate-400 font-normal">dias</span>
          </h3>
          <span className="text-[10px] text-slate-400">
            Com data de requisição inserida
          </span>
        </GlassCard>

        <GlassCard className="p-3 border-rose-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block">Viaturas Críticas (≥ 10 dias)</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-rose-400 mt-1">
            {stats.criticalCount}
          </h3>
          <span className="text-[10px] text-rose-300 font-semibold">
            Imobilização ou requisição ≥ 10 dias
          </span>
        </GlassCard>

        <GlassCard className="p-3 border-hp-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block">Serviços em Aberto</span>
            <div className="w-7 h-7 rounded-lg bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
              <Truck className="w-3.5 h-3.5" />
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold font-mono text-hp-300 mt-1">
            {stats.totalAbertas}
          </h3>
          <span className="text-[10px] text-slate-400">
            Em curso na oficina / assistência
          </span>
        </GlassCard>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por matrícula, folha, empresa, estado..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-hp-500"
            />
          </div>

          {/* Quick Scope Filters */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterScope('abertas')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                filterScope === 'abertas' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Apenas Abertos
            </button>
            <button
              onClick={() => setFilterScope('oficina')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                filterScope === 'oficina' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Oficina
            </button>
            <button
              onClick={() => setFilterScope('criticas')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                filterScope === 'criticas' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Críticos
            </button>
            <button
              onClick={() => setFilterScope('todos')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                filterScope === 'todos' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Filter by Tipo */}
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="py-1.5 px-2.5 bg-slate-950/80 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="Oficina">Oficina</option>
            <option value="Assistência Técnica">Assistência Técnica</option>
            <option value="Contrato">Contrato</option>
          </select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="py-1 px-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="imobilizacao">Tempo de Imobilização</option>
            <option value="requisicao">Dias desde Requisição</option>
            <option value="data">Data de Entrada</option>
            <option value="numero">N.º da Folha</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            title="Inverter Ordem"
            className="p-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3 px-3.5">Folha</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3.5">Viatura</th>
                <th className="py-3 px-3.5">Cliente / Empresa</th>
                <th className="py-3 px-3.5">Data Requisição (Dias)</th>
                <th className="py-3 px-3.5">Entrada Oficina</th>
                <th className="py-3 px-3.5">Conclusão</th>
                <th className="py-3 px-3.5">Tempo Imobilização</th>
                <th className="py-3 px-3.5">Estado</th>
                <th className="py-3 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-xs text-slate-500 italic">
                    Nenhum serviço encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const f = row.folha;
                  const imobDays = row.imobilizacao?.days || 0;

                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-slate-900/50 transition-colors group"
                    >
                      {/* 1. Folha N.º */}
                      <td className="py-3 px-3.5 font-mono font-bold text-hp-400 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectFolha && onSelectFolha(f)}
                          className="hover:underline flex items-center gap-1 text-left"
                        >
                          {f.numero}
                        </button>
                      </td>

                      {/* 2. Tipo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          f.tipo === 'Oficina'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                            : f.tipo === 'Assistência Técnica'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                        }`}>
                          {f.tipo}
                        </span>
                      </td>

                      {/* 3. Viatura */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-900 border border-slate-700/80 px-1.5 py-0.5 rounded font-mono font-bold text-slate-200 text-[11px]">
                            {f.matricula}
                          </span>
                          <span className="text-slate-400 text-[11px] truncate max-w-[120px]">
                            {f.marca} {f.modelo}
                          </span>
                        </div>
                      </td>

                      {/* 4. Empresa */}
                      <td className="py-3 px-3.5 text-slate-300 max-w-[160px] truncate font-medium">
                        {row.empresaNome}
                      </td>

                      {/* 5. Data da Requisição & Número de Dias */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {f.dataRequisicao ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[11px] text-slate-300 block">
                              {formatDate(f.dataRequisicao)}
                            </span>
                            {row.diasRequisicao && (
                              <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {row.diasRequisicao.text} desde req.
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">
                            Sem requisição
                          </span>
                        )}
                      </td>

                      {/* 6. Data Entrada Oficina */}
                      <td className="py-3 px-3.5 whitespace-nowrap font-mono text-[11px] text-slate-300">
                        {formatDate(f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined))}
                      </td>

                      {/* 7. Data Conclusão */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {f.dataConclusao ? (
                          <span className="font-mono text-[11px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {formatDate(f.dataConclusao)}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
                            <Clock className="w-2.5 h-2.5 animate-spin" />
                            Em Aberto
                          </span>
                        )}
                      </td>

                      {/* 8. Tempo de Imobilização na Oficina */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {row.imobilizacao ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg border ${
                                imobDays >= 10
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                                  : imobDays >= 5
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {row.imobilizacao.text}
                            </span>
                            {imobDays >= 10 && (
                              <span title="Imobilização crítica (≥ 10 dias)" className="text-rose-400">
                                ⚠️
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500">-</span>
                        )}
                      </td>

                      {/* 9. Estado Atual */}
                      <td className="py-3 px-3.5 max-w-[180px] truncate">
                        <span className="text-[10px] font-medium text-slate-300 truncate block">
                          {f.status}
                        </span>
                      </td>

                      {/* 10. Ações */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        {onSelectFolha && (
                          <button
                            type="button"
                            onClick={() => onSelectFolha(f)}
                            className="px-2 py-1 rounded-lg bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 border border-hp-500/30 text-[10px] font-bold transition-colors"
                          >
                            Abrir Folha ➔
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
