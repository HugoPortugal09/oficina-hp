import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Timer,
  Mail,
  FileText,
  Send,
  Sparkles,
  Check,
  Printer,
  Loader2,
  X,
  ChevronDown,
  MapPin
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { formatDate, calculateDiffDays, getTodayFormatted } from '../utils/dateUtils';
import { isOficinaOrGraump, isExteriorService, isOpenService } from '../utils/locationUtils';
import { generateTemposRespostaPDF } from '../services/pdfService';
import { sendDailyTemposRespostaEmail } from '../services/emailService';
import { getTipoStyles } from '../utils/statusColors';
import type { FolhaServico, Empresa, Equipamento, TipoServico } from '../types';

export const ALL_TIPOS: TipoServico[] = [
  'Oficina',
  'Validação e Preparação',
  'Assistência Técnica',
  'Garantia',
  'Entrega e Formação',
  'Contrato'
];

interface TemposRespostaProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  onSelectFolha?: (folha: FolhaServico) => void;
}

export const TemposResposta: React.FC<TemposRespostaProps> = ({
  folhas,
  empresas,
  equipamentos,
  onSelectFolha
}) => {
  const [filterScope, setFilterScope] = useState<'abertas' | 'todos' | 'oficina' | 'exterior' | 'criticas'>('abertas');
  const [filterTipos, setFilterTipos] = useState<string[]>([]);
  const [isTipoDropdownOpen, setIsTipoDropdownOpen] = useState(false);
  const tipoDropdownRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'imobilizacao' | 'requisicao' | 'numero' | 'data'>('imobilizacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [isGeneratingA3Pdf, setIsGeneratingA3Pdf] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Close tipo dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(e.target as Node)) {
        setIsTipoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleTipo = (tipo: string) => {
    setFilterTipos(prev => {
      if (prev.includes(tipo)) {
        return prev.filter(t => t !== tipo);
      } else {
        return [...prev, tipo];
      }
    });
  };

  const tipoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    folhas.forEach(f => {
      if (f.tipo) {
        counts[f.tipo] = (counts[f.tipo] || 0) + 1;
      }
    });
    return counts;
  }, [folhas]);

  // Process and augment rows
  const processedRows = useMemo(() => {
    return folhas.map(f => {
      const emp = empresas.find(e => e.id === f.empresaId);
      const isConcluido = f.status === 'Concluído' || f.status.startsWith('FEITO') || f.status === 'Feito' || !!f.dataConclusao;

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
        isOficinaOrGraump: isOficinaOrGraump(f),
        isExterior: isExteriorService(f),
        isCritico: !isConcluido && (((imobilizacao?.days || 0) >= 10) || ((diasRequisicao?.days || 0) >= 10))
      };
    });
  }, [folhas, empresas]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return processedRows.filter(row => {
      // Filter scope
      if (filterScope === 'abertas' && row.isConcluido) return false;
      if (filterScope === 'oficina' && (!row.isOficinaOrGraump || row.isConcluido)) return false;
      if (filterScope === 'exterior' && (!row.isExterior || row.isConcluido)) return false;
      if (filterScope === 'criticas' && !row.isCritico) return false;

      // Filter tipo (multi-selection)
      if (filterTipos.length > 0 && !filterTipos.includes(row.folha.tipo)) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesNum = row.folha.numero.toLowerCase().includes(q);
        const matchesPlate = row.folha.matricula.toLowerCase().includes(q);
        const matchesEmp = row.empresaNome.toLowerCase().includes(q);
        const matchesStatus = row.folha.status.toLowerCase().includes(q);
        const matchesLoc = (row.folha.localizacao || '').toLowerCase().includes(q);
        if (!matchesNum && !matchesPlate && !matchesEmp && !matchesStatus && !matchesLoc) return false;
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
  }, [processedRows, filterScope, filterTipos, searchTerm, sortBy, sortOrder]);

  // Overall Statistics / Metrics
  const stats = useMemo(() => {
    const openOficinaRows = processedRows.filter(r => r.isOficinaOrGraump && !r.isConcluido && r.imobilizacao);
    const avgImobilizacaoOficina = openOficinaRows.length > 0
      ? openOficinaRows.reduce((acc, r) => acc + (r.imobilizacao?.days || 0), 0) / openOficinaRows.length
      : 0;

    const rowsWithReq = processedRows.filter(r => !r.isConcluido && r.diasRequisicao);
    const avgDiasReq = rowsWithReq.length > 0
      ? rowsWithReq.reduce((acc, r) => acc + (r.diasRequisicao?.days || 0), 0) / rowsWithReq.length
      : 0;

    const criticalCount = processedRows.filter(r => r.isCritico).length;
    const totalAbertas = processedRows.filter(r => !r.isConcluido).length;
    const totalOficinaAbertas = processedRows.filter(r => !r.isConcluido && r.isOficinaOrGraump).length;
    const totalExteriorAbertas = processedRows.filter(r => !r.isConcluido && r.isExterior).length;

    return {
      avgImobilizacaoOficina,
      avgDiasReq,
      criticalCount,
      totalAbertas,
      totalOficinaAbertas,
      totalExteriorAbertas
    };
  }, [processedRows]);

  // Trigger Send Daily Email with 3 A3 PDFs
  const handleTriggerEmail = async () => {
    setIsSendingEmail(true);
    setEmailFeedback(null);
    try {
      const res = await sendDailyTemposRespostaEmail({
        folhas,
        empresas,
        equipamentos
      });
      setEmailFeedback({
        success: res.success,
        msg: res.message
      });
    } catch (err: any) {
      setEmailFeedback({
        success: false,
        msg: `Erro ao enviar email: ${err?.message || err}`
      });
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailFeedback(null), 8000);
    }
  };

  // Download Individual A3 PDF (Apenas em Aberto)
  const handleDownloadPDF = (scope: 'OFICINA' | 'EXTERIOR' | 'TODOS') => {
    try {
      const doc = generateTemposRespostaPDF(folhas, empresas, scope);
      const dateStr = getTodayFormatted().replace(/\//g, '-');
      let fname = `Tempos_Resposta_Geral_Abertos_A3_${dateStr}.pdf`;
      if (scope === 'OFICINA') fname = `Tempos_Resposta_Oficina_A3_${dateStr}.pdf`;
      else if (scope === 'EXTERIOR') fname = `Tempos_Resposta_Exterior_A3_${dateStr}.pdf`;
      doc.save(fname);
    } catch (err) {
      alert('Erro ao gerar o documento PDF em formato A3.');
    }
  };

  // Print currently filtered map in A3 Landscape
  const handlePrintA3 = () => {
    if (isGeneratingA3Pdf) return;
    setIsGeneratingA3Pdf(true);
    setPrintFeedback('A preparar mapa de tempos de resposta em formato A3 horizontal com todas as opções de visualização...');

    try {
      if (filteredRows.length === 0) {
        setPrintFeedback('⚠️ Nenhum registo encontrado com as opções de visualização selecionadas.');
        setTimeout(() => setPrintFeedback(null), 4000);
        setIsGeneratingA3Pdf(false);
        return;
      }

      let scopeLabel = 'Todos os Registos';
      if (filterScope === 'abertas') scopeLabel = 'Apenas Abertos';
      else if (filterScope === 'oficina') scopeLabel = 'Oficina (GRAUMP)';
      else if (filterScope === 'exterior') scopeLabel = 'Exterior (Fora de GRAUMP)';
      else if (filterScope === 'criticas') scopeLabel = 'Críticos (≥ 10 dias)';
      else if (filterScope === 'todos') scopeLabel = 'Histórico Completo';

      const sortNameMap: Record<string, string> = {
        imobilizacao: 'Tempo de Imobilização',
        requisicao: 'Dias desde Requisição',
        data: 'Data de Entrada',
        numero: 'N.º de Folha'
      };
      const sortLabel = `${sortNameMap[sortBy] || sortBy} (${sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})`;

      const doc = generateTemposRespostaPDF(folhas, empresas, {
        filterTipos,
        filterScopeLabel: scopeLabel,
        searchTerm: searchTerm.trim() || undefined,
        sortLabel,
        customRows: filteredRows
      });

      const todayStr = getTodayFormatted().replace(/\//g, '-');
      const filename = `Tempos_Resposta_Visualizacao_A3_${todayStr}.pdf`;
      doc.save(filename);

      try {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (win) win.focus();
      } catch (e) {}

      setPrintFeedback(`✅ Mapa A3 gerado com sucesso com as opções de visualização escolhidas! (${filteredRows.length} registos)`);
      setTimeout(() => setPrintFeedback(null), 4000);
    } catch (err: any) {
      console.error('[TemposResposta] Erro ao gerar PDF A3:', err);
      setPrintFeedback(`❌ Erro ao gerar PDF A3: ${err?.message || err}`);
      setTimeout(() => setPrintFeedback(null), 5000);
    } finally {
      setIsGeneratingA3Pdf(false);
    }
  };

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Print A3 Map Button */}
          <button
            onClick={handlePrintA3}
            disabled={isGeneratingA3Pdf}
            title="Imprimir mapa de tempos de resposta em Folha A3 na horizontal (respeitando os filtros ativos)"
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 border ${
              isGeneratingA3Pdf
                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-wait'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-emerald-400/30 shadow-emerald-950/40'
            }`}
          >
            {isGeneratingA3Pdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                <span>A Preparar A3...</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5 text-emerald-200" />
                <span>Imprimir A3</span>
              </>
            )}
          </button>

          {/* Email Dispatch Button */}
          <button
            onClick={handleTriggerEmail}
            disabled={isSendingEmail}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-hp-600 hover:from-teal-500 hover:to-hp-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-hp-600/20 active:scale-95 disabled:opacity-50"
            title="Enviar relatório por email com 3 PDFs A3 para hugo@grau-maquinaria.com"
          >
            <Mail className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-spin' : ''}`} />
            {isSendingEmail ? 'A Gerar e Enviar 3 PDFs...' : 'Enviar Diário (3 PDFs A3)'}
          </button>

          {/* Download PDF Menu */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-0.5">
            <button
              onClick={() => handleDownloadPDF('OFICINA')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 transition-colors"
              title="Descarregar PDF A3 da Oficina (GRAUMP, apenas em aberto)"
            >
              <Download className="w-3 h-3 text-orange-400" />
              PDF Oficina (A3)
            </button>
            <button
              onClick={() => handleDownloadPDF('EXTERIOR')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 transition-colors"
              title="Descarregar PDF A3 do Exterior (fora de GRAUMP, apenas em aberto)"
            >
              <Download className="w-3 h-3 text-sky-400" />
              PDF Exterior (A3)
            </button>
            <button
              onClick={() => handleDownloadPDF('TODOS')}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1 transition-colors"
              title="Descarregar PDF A3 Geral (Apenas em aberto)"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              PDF Geral (A3)
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-hp-400" />
            CSV
          </button>
        </div>
      </div>

      {/* Feedback Banner if email sent or print action */}
      {(emailFeedback || printFeedback) && (
        <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 animate-in fade-in ${
          (printFeedback && !printFeedback.startsWith('❌') && !printFeedback.startsWith('⚠️')) || (emailFeedback && emailFeedback.success)
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : (printFeedback && printFeedback.startsWith('⚠️'))
            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {printFeedback ? (
              printFeedback.startsWith('❌') ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> :
              printFeedback.startsWith('⚠️') ? <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" /> :
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : emailFeedback?.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{printFeedback || emailFeedback?.msg}</span>
          </div>
          {printFeedback && (
            <button
              type="button"
              onClick={() => setPrintFeedback(null)}
              className="text-xs hover:text-white font-bold px-1.5 cursor-pointer"
            >
              &times;
            </button>
          )}
        </div>
      )}

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
            Oficina GRAUMP ({stats.totalOficinaAbertas}) • Exterior ({stats.totalExteriorAbertas})
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
                filterScope === 'oficina' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Oficina (GRAUMP)
            </button>
            <button
              onClick={() => setFilterScope('exterior')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                filterScope === 'exterior' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exterior
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

          {/* Multi-Select Type Filter */}
          <div className="relative" ref={tipoDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTipoDropdownOpen(prev => !prev)}
              className={`py-1.5 px-3 rounded-xl text-xs flex items-center gap-2 border transition-all select-none cursor-pointer ${
                filterTipos.length > 0
                  ? 'bg-hp-500/15 border-hp-500/60 text-white shadow-sm shadow-hp-500/10'
                  : 'bg-slate-950/80 border-slate-700/80 text-slate-300 hover:border-slate-600'
              }`}
              title="Filtrar por múltiplos Tipos de Serviço"
            >
              <Filter className={`w-3.5 h-3.5 ${filterTipos.length > 0 ? 'text-hp-400' : 'text-slate-400'}`} />

              {filterTipos.length === 0 ? (
                <span>Todos os Tipos</span>
              ) : filterTipos.length === 1 ? (
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${getTipoStyles(filterTipos[0]).dot}`} />
                  <span className="font-semibold text-white">{filterTipos[0]}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-white truncate max-w-[140px]">
                    {filterTipos.join(', ')}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-hp-500 text-white text-[10px] font-black">
                    {filterTipos.length}
                  </span>
                </div>
              )}

              {filterTipos.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation();
                    setFilterTipos([]);
                  }}
                  className="p-0.5 rounded-md hover:bg-white/20 text-slate-400 hover:text-white transition-colors ml-0.5 cursor-pointer"
                  title="Limpar seleção de tipos"
                >
                  <X className="w-3 h-3" />
                </span>
              )}

              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 ml-0.5 transition-transform duration-200 ${
                  isTipoDropdownOpen ? 'rotate-180 text-hp-400' : ''
                }`}
              />
            </button>

            {/* Dropdown Popover */}
            {isTipoDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 z-50 w-72 bg-slate-950/95 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in fade-in zoom-in-95">
                {/* Dropdown Header */}
                <div className="p-3 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/70">
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-hp-400" />
                    <span className="text-xs font-bold text-white">Tipo de Serviço</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {filterTipos.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setFilterTipos([])}
                        className="text-[11px] font-semibold text-hp-400 hover:text-hp-300 transition-colors cursor-pointer"
                      >
                        Limpar ({filterTipos.length})
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFilterTipos([...ALL_TIPOS])}
                        className="text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        Selecionar Todos
                      </button>
                    )}
                  </div>
                </div>

                {/* Dropdown Option List */}
                <div className="p-1.5 space-y-0.5 max-h-64 overflow-y-auto">
                  {ALL_TIPOS.map(tipo => {
                    const isSelected = filterTipos.includes(tipo);
                    const style = getTipoStyles(tipo);
                    const count = tipoCounts[tipo] || 0;

                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => handleToggleTipo(tipo)}
                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-hp-500/15 text-white border border-hp-500/30 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Checkbox Box */}
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-hp-500 border-hp-500 text-white'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          {/* Color Dot & Name */}
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                            <span className={isSelected ? 'text-white font-semibold' : 'text-slate-200'}>
                              {tipo}
                            </span>
                          </div>
                        </div>

                        {/* Count Badge */}
                        <span
                          className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-hp-500/30 text-hp-200 font-bold'
                              : 'bg-slate-800/80 text-slate-400'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Footer */}
                <div className="p-2 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-400 px-3">
                  <span>
                    {filterTipos.length === 0
                      ? 'Todos os tipos visíveis'
                      : `${filterTipos.length} de ${ALL_TIPOS.length} selecionados`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTipoDropdownOpen(false)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold text-[10px] transition-colors cursor-pointer"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </div>
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
            className="p-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handlePrintA3}
            disabled={isGeneratingA3Pdf}
            title="Imprimir dados deste mapa em Folha A3 na horizontal"
            className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ml-1"
          >
            {isGeneratingA3Pdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-300" />
            ) : (
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Imprimir A3</span>
          </button>
        </div>
      </div>

      {/* Active Multi-Type Filter Pills */}
      {filterTipos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 animate-in fade-in">
          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
            <Filter className="w-3 h-3 text-hp-400" />
            Tipos Ativos:
          </span>
          {filterTipos.map(t => {
            const style = getTipoStyles(t);
            return (
              <span
                key={t}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {t}
                <button
                  type="button"
                  onClick={() => handleToggleTipo(t)}
                  className="ml-0.5 hover:text-white rounded-full p-0.5 hover:bg-white/10 transition-colors cursor-pointer"
                  title={`Remover ${t}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setFilterTipos([])}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-slate-950/80 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                <th className="py-3 px-3.5">Folha</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3.5">Viatura</th>
                <th className="py-3 px-3.5">Cliente / Localização</th>
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

                      {/* 4. Cliente / Localização */}
                      <td className="py-3 px-3.5 text-slate-300 max-w-[180px]">
                        <div className="font-medium truncate">{row.empresaNome}</div>
                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                          <span className={row.isOficinaOrGraump ? 'text-orange-400/90 font-medium' : 'text-sky-400/90 font-medium'}>
                            {row.isOficinaOrGraump ? 'Oficina GRAUMP' : 'Exterior'}
                          </span>
                          {f.localizacao && f.localizacao !== 'GRAUMP' && (
                            <span className="text-slate-500 truncate text-[9px]">({f.localizacao})</span>
                          )}
                        </div>
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
