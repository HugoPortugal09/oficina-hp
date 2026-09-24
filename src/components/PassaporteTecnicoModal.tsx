import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Clock,
  Calendar,
  Truck,
  ExternalLink,
  Download,
  Plus,
  Package,
  Activity,
  History,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  User,
  X
} from 'lucide-react';
import { Badge } from './Badge';
import type { Equipamento, Empresa, FolhaServico } from '../types';
import { formatDate, parseDateToMs } from '../utils/dateUtils';
import { generatePassaporteTecnicoPDF } from '../services/pdfService';

interface PassaporteTecnicoModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipamento: Equipamento | null;
  empresas: Empresa[];
  folhas: FolhaServico[];
  onSelectFolha: (fs: FolhaServico) => void;
  onCreateFolha?: (eq: Equipamento) => void;
}

export const PassaporteTecnicoModal: React.FC<PassaporteTecnicoModalProps> = ({
  isOpen,
  onClose,
  equipamento,
  empresas,
  folhas,
  onSelectFolha,
  onCreateFolha
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'evolucao' | 'pecas' | 'tabela'>('timeline');
  const [pecasSearch, setPecasSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !equipamento) return null;

  const safeEmpresas = Array.isArray(empresas) ? empresas : [];
  const safeFolhas = Array.isArray(folhas) ? folhas : [];

  const ownerCompany = safeEmpresas.find(e => e.id === equipamento.empresaId);

  // Filter service sheets for this vehicle, sorted chronological newest first
  const matchingFolhasNewest = useMemo(() => {
    return safeFolhas
      .filter(f => (
        (equipamento.id && f.equipamentoId === equipamento.id) ||
        (equipamento.matricula && f.matricula && f.matricula.trim().toUpperCase() === equipamento.matricula.trim().toUpperCase())
      ))
      .sort((a, b) => parseDateToMs(b.dataConclusao || b.data || b.criadoEm) - parseDateToMs(a.dataConclusao || a.data || a.criadoEm));
  }, [equipamento, safeFolhas]);

  // Oldest first for progression analysis
  const matchingFolhasOldest = useMemo(() => {
    return [...matchingFolhasNewest].reverse();
  }, [matchingFolhasNewest]);

  // Calculate current readings and delta metrics
  const latestWithKms = matchingFolhasNewest.find(f => f.kmsAtuais !== undefined && Number(f.kmsAtuais) > 0);
  const latestWithHoras = matchingFolhasNewest.find(f => f.horasAtuais !== undefined && Number(f.horasAtuais) > 0);
  const oldestWithKms = matchingFolhasOldest.find(f => f.kmsAtuais !== undefined && Number(f.kmsAtuais) > 0);
  const oldestWithHoras = matchingFolhasOldest.find(f => f.horasAtuais !== undefined && Number(f.horasAtuais) > 0);

  const currentKms = latestWithKms?.kmsAtuais ? Number(latestWithKms.kmsAtuais) : (equipamento.kmsAtuais || 0);
  const currentHoras = latestWithHoras?.horasAtuais ? Number(latestWithHoras.horasAtuais) : (equipamento.horasAtuais || 0);
  const initialKms = oldestWithKms?.kmsAtuais ? Number(oldestWithKms.kmsAtuais) : currentKms;
  const initialHoras = oldestWithHoras?.horasAtuais ? Number(oldestWithHoras.horasAtuais) : currentHoras;

  const totalKmsDelta = Math.max(0, currentKms - initialKms);
  const totalHorasDelta = Math.max(0, currentHoras - initialHoras);

  // Total labor hours recorded
  const totalLaborHours = useMemo(() => {
    return matchingFolhasNewest.reduce((acc, f) => {
      if (Array.isArray(f.servicos)) {
        return acc + f.servicos.reduce((sAcc, s) => sAcc + (Number(s.tempo) || 0), 0);
      }
      return acc;
    }, 0);
  }, [matchingFolhasNewest]);

  // Consolidated parts list
  const consolidatedParts = useMemo(() => {
    const map = new Map<string, {
      ref: string;
      desc: string;
      totalQty: number;
      lastDate: string;
      lastFolha: string;
      occurrences: number;
    }>();

    matchingFolhasNewest.forEach(f => {
      if (Array.isArray(f.pecas)) {
        f.pecas.forEach(p => {
          const ref = (p.referencia || p.codigo || '').trim();
          const desc = (p.designacao || p.descricao || 'Peça').trim();
          const key = `${ref}__${desc}`.toLowerCase();
          const qty = Number(p.quantidade) || 1;
          const dateStr = formatDate(f.dataConclusao || f.data);
          const folhaNum = f.numero || '';

          if (map.has(key)) {
            const item = map.get(key)!;
            item.totalQty += qty;
            item.occurrences += 1;
          } else {
            map.set(key, {
              ref: ref || '-',
              desc,
              totalQty: qty,
              lastDate: dateStr,
              lastFolha: folhaNum,
              occurrences: 1
            });
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  }, [matchingFolhasNewest]);

  // Filtered parts based on search
  const filteredParts = useMemo(() => {
    if (!pecasSearch.trim()) return consolidatedParts;
    const q = pecasSearch.toLowerCase().trim();
    return consolidatedParts.filter(p =>
      p.ref.toLowerCase().includes(q) ||
      p.desc.toLowerCase().includes(q) ||
      p.lastFolha.toLowerCase().includes(q)
    );
  }, [consolidatedParts, pecasSearch]);

  // Next revision recommendation calculation
  const nextRevision = useMemo(() => {
    // Check if the latest folha specifies next revision
    const latestFolhaWithRev = matchingFolhasNewest.find(f => f.proximaRevisaoKms || f.proximaRevisaoHoras || f.proximaRevisaoData);
    if (latestFolhaWithRev) {
      const targetKms = Number(latestFolhaWithRev.proximaRevisaoKms) || 0;
      const targetHoras = Number(latestFolhaWithRev.proximaRevisaoHoras) || 0;
      const targetData = latestFolhaWithRev.proximaRevisaoData;
      const kmsRemaining = targetKms > 0 ? targetKms - currentKms : null;
      const horasRemaining = targetHoras > 0 ? targetHoras - currentHoras : null;

      return {
        targetKms: targetKms || null,
        targetHoras: targetHoras || null,
        targetData: targetData || null,
        kmsRemaining,
        horasRemaining,
        isOverdue: (kmsRemaining !== null && kmsRemaining <= 0) || (horasRemaining !== null && horasRemaining <= 0)
      };
    }

    // Default revision estimate (+10,000 km or +250h from current)
    if (currentKms > 0) {
      const targetKms = Math.ceil(currentKms / 10000) * 10000 + (currentKms % 10000 === 0 ? 10000 : 0);
      return {
        targetKms,
        targetHoras: currentHoras > 0 ? currentHoras + 250 : null,
        targetData: null,
        kmsRemaining: targetKms - currentKms,
        horasRemaining: 250,
        isOverdue: false
      };
    }

    return null;
  }, [matchingFolhasNewest, currentKms, currentHoras]);

  // SVG Chart Data Points (Odometer Progression)
  const chartPoints = useMemo(() => {
    const valid = matchingFolhasOldest.filter(f => (f.kmsAtuais && Number(f.kmsAtuais) > 0) || (f.horasAtuais && Number(f.horasAtuais) > 0));
    if (valid.length <= 1) return null;

    const maxKms = Math.max(...valid.map(f => Number(f.kmsAtuais) || 0));
    const minKms = Math.min(...valid.map(f => Number(f.kmsAtuais) || 0));
    const kmsRange = Math.max(1, maxKms - minKms);

    return valid.map((f, i) => {
      const kms = Number(f.kmsAtuais) || 0;
      const xPercent = (i / (valid.length - 1)) * 100;
      const yPercent = 100 - ((kms - minKms) / kmsRange) * 80 - 10; // 10% padding
      return {
        folha: f,
        kms,
        horas: Number(f.horasAtuais) || 0,
        x: xPercent,
        y: yPercent,
        date: formatDate(f.dataConclusao || f.data)
      };
    });
  }, [matchingFolhasOldest]);

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = generatePassaporteTecnicoPDF(equipamento, ownerCompany, safeFolhas);
      const safeMatricula = (equipamento.matricula || 'equipamento').replace(/[^a-zA-Z0-9-]/g, '_');
      doc.save(`Passaporte_Tecnico_${safeMatricula}.pdf`);
    } catch (err) {
      console.error('[PassaporteTecnico] Erro ao exportar PDF:', err);
      alert('Erro ao gerar Passaporte Técnico em PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Top Header Card */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-hp-600 to-hp-400 text-white flex items-center justify-center shadow-lg shadow-hp-600/30 shrink-0">
              <Truck className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-base sm:text-lg font-black bg-white text-slate-900 px-3 py-0.5 rounded-lg border-2 border-slate-300 shadow-sm tracking-wider">
                  {equipamento.matricula || 'S/ MATRÍCULA'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {equipamento.tipo || 'Viatura'}
                </span>
                {ownerCompany && (
                  <span className="text-xs font-semibold text-hp-400 truncate max-w-xs">
                    • {ownerCompany.nome}
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-black text-white mt-1 truncate">
                {equipamento.marca} {equipamento.modelo}
                <span className="text-xs font-normal text-slate-400 font-mono ml-2">
                  (Nº Série: {equipamento.numeroSerie || 'N/D'})
                </span>
              </h2>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
              title="Descarregar Passaporte Técnico Oficial em PDF A4"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'A Gerar...' : 'Exportar PDF'}</span>
            </button>

            {onCreateFolha && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateFolha(equipamento);
                }}
                className="py-2 px-3.5 bg-hp-600 hover:bg-hp-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md shadow-hp-950/40 transition-all cursor-pointer"
                title="Criar nova Folha de Serviço para este veículo"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Nova Folha</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick KPI Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:px-6 bg-slate-950/70 border-b border-slate-800 shrink-0 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Quilómetros Atuais</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-base font-extrabold text-emerald-400">
                {currentKms.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">km</span>
              {totalKmsDelta > 0 && (
                <span className="text-[10px] font-mono text-emerald-500/80 ml-1">
                  (+{totalKmsDelta.toLocaleString()} km)
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Horas de Trabalho</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-base font-extrabold text-amber-400">
                {currentHoras}
              </span>
              <span className="text-[10px] text-slate-400">h</span>
              {totalHorasDelta > 0 && (
                <span className="text-[10px] font-mono text-amber-500/80 ml-1">
                  (+{totalHorasDelta} h)
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Intervenções & Assistência</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-base font-extrabold text-hp-400">
                {matchingFolhasNewest.length}
              </span>
              <span className="text-[10px] text-slate-400">folhas</span>
              <span className="text-[10px] font-mono text-slate-500 ml-1">
                ({totalLaborHours.toFixed(1)}h M.O.)
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Peças Substituídas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-mono text-base font-extrabold text-purple-400">
                {consolidatedParts.length}
              </span>
              <span className="text-[10px] text-slate-400">itens</span>
              <span className="text-[10px] font-mono text-slate-500 ml-1">
                ({consolidatedParts.reduce((acc, p) => acc + p.totalQty, 0)} unidades)
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 sm:px-6 pt-3 border-b border-slate-800 bg-slate-900/40 shrink-0 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`py-2 px-3.5 rounded-t-xl font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-hp-500 text-white bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <History className="w-3.5 h-3.5 text-hp-400" />
            <span>Linha do Tempo</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-[10px] font-mono">
              {matchingFolhasNewest.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('evolucao')}
            className={`py-2 px-3.5 rounded-t-xl font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'evolucao'
                ? 'border-hp-500 text-white bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Evolução & Revisões</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pecas')}
            className={`py-2 px-3.5 rounded-t-xl font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'pecas'
                ? 'border-hp-500 text-white bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-purple-400" />
            <span>Peças Aplicadas</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-[10px] font-mono">
              {consolidatedParts.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tabela')}
            className={`py-2 px-3.5 rounded-t-xl font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'tabela'
                ? 'border-hp-500 text-white bg-slate-800/80'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Tabela Completa</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* TAB 1: Visual Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {matchingFolhasNewest.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Wrench className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">
                    Ainda não existem intervenções registadas para a viatura{' '}
                    <span className="font-mono font-bold text-white">{equipamento.matricula}</span>.
                  </p>
                  {onCreateFolha && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onCreateFolha(equipamento);
                      }}
                      className="mt-2 py-2 px-4 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" /> Registar Primeira Intervenção
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                  {matchingFolhasNewest.map((f, idx) => {
                    const isConcluded = f.status?.includes('Concluído') || f.status?.includes('Feito') || f.status?.startsWith('FEITO');
                    const isLatest = idx === 0;

                    return (
                      <div key={f.id} className="relative group">
                        {/* Timeline Node Icon */}
                        <div className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                          isLatest
                            ? 'bg-hp-500 border-white text-white shadow-md shadow-hp-500/50 scale-105'
                            : isConcluded
                            ? 'bg-slate-900 border-emerald-500 text-emerald-400'
                            : 'bg-slate-900 border-amber-500 text-amber-400'
                        }`}>
                          {isConcluded ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Wrench className="w-3 h-3" />
                          )}
                        </div>

                        {/* Timeline Card */}
                        <div
                          onClick={() => {
                            onClose();
                            onSelectFolha(f);
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                            isLatest
                              ? 'bg-slate-950/80 border-hp-500/50 hover:border-hp-400 shadow-md'
                              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/70'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-black text-hp-400 group-hover:underline">
                                {f.numero}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                                {f.tipo || 'Oficina'}
                              </span>
                              {isLatest && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-hp-500/20 text-hp-300 border border-hp-500/40">
                                  Última Intervenção
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {formatDate(f.dataConclusao || f.data)}
                              </span>
                              <Badge
                                variant={
                                  isConcluded
                                    ? 'success'
                                    : f.status?.includes('Em curso')
                                    ? 'primary'
                                    : 'warning'
                                }
                              >
                                {f.status || 'Em aberto'}
                              </Badge>
                            </div>
                          </div>

                          {/* Kms / Hours and Technician in this intervention */}
                          <div className="flex flex-wrap items-center gap-4 py-1.5 px-3 rounded-xl bg-slate-900/70 border border-slate-800/80 text-xs font-mono mb-2.5">
                            {f.kmsAtuais ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-sans">KM:</span>
                                <b className="text-emerald-400">{Number(f.kmsAtuais).toLocaleString()} km</b>
                              </div>
                            ) : null}

                            {f.horasAtuais ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-slate-400 font-sans">HORAS:</span>
                                <b className="text-amber-400">{f.horasAtuais} h</b>
                              </div>
                            ) : null}

                            {(f.tecnico || f.tecnicoPlaneado) && (
                              <div className="flex items-center gap-1 ml-auto text-slate-300 font-sans">
                                <User className="w-3 h-3 text-hp-400" />
                                <span className="text-[11px]">Técnico: <b>{f.tecnico || f.tecnicoPlaneado}</b></span>
                              </div>
                            )}
                          </div>

                          {/* Work description / Anomalies */}
                          <p className="text-xs text-slate-300 leading-relaxed mb-2.5">
                            {f.anomalias || (f.servicos && f.servicos.length > 0 ? f.servicos.map(s => s.descricao).join(' • ') : 'Revisão periódica / manutenção de rotina')}
                          </p>

                          {/* Applied Parts in this intervention */}
                          {f.pecas && f.pecas.length > 0 && (
                            <div className="pt-2 border-t border-slate-800/80">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                                Peças / Materiais Aplicados ({f.pecas.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {f.pecas.map((p, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-1"
                                  >
                                    <b className="text-hp-400 font-mono">{p.quantidade || 1}x</b>
                                    <span>{p.designacao || p.descricao}</span>
                                    {p.referencia && (
                                      <span className="font-mono text-[9px] text-slate-500">({p.referencia})</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quick open link */}
                          <div className="mt-2.5 pt-2 flex items-center justify-end text-xs text-hp-400 group-hover:text-hp-300 font-bold">
                            <span className="flex items-center gap-1">
                              Abrir Folha de Serviço <ExternalLink className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Evolution & Next Revisions */}
          {activeTab === 'evolucao' && (
            <div className="space-y-5">
              
              {/* Next Revision Plan Card */}
              {nextRevision && (
                <div className={`p-4 rounded-2xl border ${
                  nextRevision.isOverdue
                    ? 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                    : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {nextRevision.isOverdue ? (
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                      ) : (
                        <Activity className="w-5 h-5 text-emerald-400 shrink-0" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Plano de Manutenção & Próxima Revisão
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {nextRevision.isOverdue
                            ? 'Atenção: A viatura atingiu ou ultrapassou a meta recomendada para revisão!'
                            : 'Previsão de manutenção periódica para garantia e longevidade do equipamento.'}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold font-mono border ${
                      nextRevision.isOverdue
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    }`}>
                      {nextRevision.isOverdue ? '⚠️ Revisão Necessária' : 'Em Dia'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    {nextRevision.targetKms && (
                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-400 block font-sans">META DE QUILÓMETROS</span>
                        <b className="text-white text-sm">{nextRevision.targetKms.toLocaleString()} km</b>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {nextRevision.kmsRemaining !== null && nextRevision.kmsRemaining > 0
                            ? `Faltam ${nextRevision.kmsRemaining.toLocaleString()} km`
                            : `Excedido em ${Math.abs(nextRevision.kmsRemaining || 0).toLocaleString()} km`}
                        </span>
                      </div>
                    )}

                    {nextRevision.targetHoras && (
                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-400 block font-sans">META DE HORAS</span>
                        <b className="text-white text-sm">{nextRevision.targetHoras} h</b>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          {nextRevision.horasRemaining !== null && nextRevision.horasRemaining > 0
                            ? `Faltam ${nextRevision.horasRemaining} horas`
                            : `Excedido em ${Math.abs(nextRevision.horasRemaining || 0)} horas`}
                        </span>
                      </div>
                    )}

                    {nextRevision.targetData && (
                      <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 font-mono">
                        <span className="text-[10px] text-slate-400 block font-sans">DATA LIMITE RECOMENDADA</span>
                        <b className="text-white text-sm">{formatDate(nextRevision.targetData)}</b>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progression Chart */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-hp-400" />
                      Evolução de Quilometragem ao Longo do Tempo
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Registo cronológico em cada passagem pela oficina ou assistência exterior.
                    </p>
                  </div>
                </div>

                {chartPoints && chartPoints.length > 1 ? (
                  <div className="pt-4">
                    {/* SVG Graphic Area */}
                    <div className="relative h-44 w-full bg-slate-900/50 rounded-xl border border-slate-800/80 p-3 overflow-hidden">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                        {/* Area gradient under line */}
                        <defs>
                          <linearGradient id="kmsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Area fill */}
                        <polygon
                          points={`0,100 ${chartPoints.map(p => `${p.x},${p.y}`).join(' ')} 100,100`}
                          fill="url(#kmsGradient)"
                        />

                        {/* Progression Line */}
                        <polyline
                          points={chartPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Points */}
                        {chartPoints.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r="3"
                            className="fill-emerald-400 stroke-slate-900 hover:scale-150 transition-transform cursor-pointer"
                            strokeWidth="1.5"
                          />
                        ))}
                      </svg>
                    </div>

                    {/* Timeline labels under chart */}
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-2 px-1">
                      <span>{chartPoints[0].date} ({chartPoints[0].kms.toLocaleString()} km)</span>
                      <span>{chartPoints[chartPoints.length - 1].date} ({chartPoints[chartPoints.length - 1].kms.toLocaleString()} km)</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    São necessárias pelo menos duas folhas de serviço com registo de Kms para traçar o gráfico de evolução.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Replaced Parts History */}
          {activeTab === 'pecas' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Pesquisar por referência, nome da peça ou folha..."
                    value={pecasSearch}
                    onChange={e => setPecasSearch(e.target.value)}
                    className="w-full py-2 pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-hp-500 font-mono"
                  />
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  Total de <b>{filteredParts.length}</b> peça(s) no histórico
                </span>
              </div>

              {filteredParts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Nenhuma peça encontrada para esta pesquisa.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Referência</th>
                        <th className="py-2.5 px-3">Designação da Peça</th>
                        <th className="py-2.5 px-3 text-center">Quantidade Total</th>
                        <th className="py-2.5 px-3">Última Substituição</th>
                        <th className="py-2.5 px-3 text-right">Folha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredParts.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                            {item.ref}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-white">
                            {item.desc}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-hp-400">
                            {item.totalQty}x
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                            {item.lastDate}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-hp-400 font-bold">
                            {item.lastFolha}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Tabular View */}
          {activeTab === 'tabela' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Nº Folha</th>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 font-mono text-right">Kms / Horas</th>
                    <th className="py-2.5 px-3">Trabalhos / Anomalias</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {matchingFolhasNewest.map(f => (
                    <tr
                      key={f.id}
                      onClick={() => {
                        onClose();
                        onSelectFolha(f);
                      }}
                      className="hover:bg-hp-600/15 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-3 font-mono font-extrabold text-hp-400 group-hover:underline">
                        {f.numero}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {formatDate(f.dataConclusao || f.data)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                          {f.tipo || 'Oficina'}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <Badge
                          variant={
                            f.status?.includes('Concluído') || f.status?.includes('Feito')
                              ? 'success'
                              : f.status?.includes('Em curso')
                              ? 'primary'
                              : 'warning'
                          }
                        >
                          {f.status || 'Em aberto'}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-right whitespace-nowrap">
                        {f.kmsAtuais ? <span className="text-emerald-400 font-bold">{Number(f.kmsAtuais).toLocaleString()} km</span> : null}
                        {f.kmsAtuais && f.horasAtuais ? <span className="text-slate-500 mx-1">•</span> : null}
                        {f.horasAtuais ? <span className="text-amber-400">{f.horasAtuais} h</span> : null}
                        {!f.kmsAtuais && !f.horasAtuais && <span className="text-slate-500">-</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                        {f.anomalias || (f.servicos && f.servicos.length > 0 ? f.servicos.map(s => s.descricao).join(', ') : '-')}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            onClose();
                            onSelectFolha(f);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-hp-500 hover:bg-hp-600 text-white font-semibold text-[11px] inline-flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                        >
                          <span>Abrir</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-6 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 hidden sm:inline">
            Oficina HP • Passaporte Técnico & Histórico de Intervenções
          </span>
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors cursor-pointer ml-auto"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
