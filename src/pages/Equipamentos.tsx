import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Truck,
  Car,
  Calendar,
  Clock,
  Sparkles,
  Building2,
  Edit,
  Trash2,
  Check,
  Wrench,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  ChevronDown,
  X,
  GraduationCap,
  PackageCheck,
  LayoutGrid,
  Table,
  ExternalLink
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import { formatDate, formatDateToInput, parseDateToMs } from '../utils/dateUtils';
import { compressImageFile } from '../utils/imageUtils';
import type { Equipamento, Empresa, FolhaServico } from '../types';

export function getEquipamentoLatestData(eq: Partial<Equipamento>, folhas: FolhaServico[]) {
  const safeFolhas = Array.isArray(folhas) ? folhas : [];
  if (!eq) {
    return {
      latestKms: 0,
      latestHoras: 0,
      latestFolha: undefined,
      latestFolhaWithKms: undefined,
      latestFolhaWithHoras: undefined,
      matchingFolhas: []
    };
  }
  const matchingFolhas = safeFolhas
    .filter(f => (
      (eq.id && f.equipamentoId === eq.id) ||
      (eq.matricula && f.matricula && f.matricula.trim().toUpperCase() === eq.matricula.trim().toUpperCase())
    ))
    .sort((a, b) => parseDateToMs(b.dataConclusao || b.data || b.criadoEm) - parseDateToMs(a.dataConclusao || a.data || a.criadoEm));

  const latestFolhaWithKms = matchingFolhas.find(f => f.kmsAtuais !== undefined && Number(f.kmsAtuais) > 0);
  const latestFolhaWithHoras = matchingFolhas.find(f => f.horasAtuais !== undefined && Number(f.horasAtuais) > 0);
  const latestFolha = matchingFolhas[0];

  const latestKms = (latestFolhaWithKms?.kmsAtuais !== undefined && Number(latestFolhaWithKms.kmsAtuais) > 0)
    ? Number(latestFolhaWithKms.kmsAtuais)
    : (eq.kmsAtuais || 0);

  const latestHoras = (latestFolhaWithHoras?.horasAtuais !== undefined && Number(latestFolhaWithHoras.horasAtuais) > 0)
    ? Number(latestFolhaWithHoras.horasAtuais)
    : (eq.horasAtuais || 0);

  return {
    latestKms,
    latestHoras,
    latestFolha,
    latestFolhaWithKms,
    latestFolhaWithHoras,
    matchingFolhas
  };
}

interface EquipamentosProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  folhas: FolhaServico[];
  onOpenScanner: () => void;
  onSelectFolha: (fs: FolhaServico) => void;
}

export const Equipamentos: React.FC<EquipamentosProps> = ({
  equipamentos,
  empresas,
  folhas,
  onOpenScanner,
  onSelectFolha
}) => {
  const safeEquipamentos = Array.isArray(equipamentos) ? equipamentos : [];
  const safeEmpresas = Array.isArray(empresas) ? empresas : [];
  const safeFolhas = Array.isArray(folhas) ? folhas : [];

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_equipamentos');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_equipamentos', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Partial<Equipamento>>({});
  const [servicesModalEquip, setServicesModalEquip] = useState<Equipamento | null>(null);

  // Searchable Empresa Combobox state
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
  const empresaContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter companies matching the search input
  const matchingEmpresas = safeEmpresas.filter(emp =>
    (emp.nome || '').toLowerCase().includes(empresaQuery.toLowerCase()) ||
    (emp.nif && emp.nif.toLowerCase().includes(empresaQuery.toLowerCase()))
  );

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (empresaContainerRef.current && !empresaContainerRef.current.contains(e.target as Node)) {
        setIsEmpresaDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreateNew = () => {
    setEditingEquip({
      id: db.generateId('eq'),
      matricula: '',
      marca: '',
      modelo: '',
      nSerie: '',
      ano: new Date().getFullYear(),
      tipo: 'Pesado',
      kmsAtuais: 0,
      horasAtuais: 0,
      empresaId: '',
      notas: '',
      fotos: [],
      dataEntrega: '',
      entregaPor: '',
      dataFormacao: '',
      formacaoPor: ''
    });
    setEmpresaQuery('');
    setIsModalOpen(true);
  };

  const handleEditEquip = (eq: Equipamento) => {
    const latestData = getEquipamentoLatestData(eq, safeFolhas);

    setEditingEquip({
      ...eq,
      kmsAtuais: latestData.latestKms,
      horasAtuais: latestData.latestHoras,
      fotos: eq.fotos || (eq.fotoUrl ? [eq.fotoUrl] : [])
    });
    const associatedEmp = safeEmpresas.find(e => e.id === eq.empresaId);
    setEmpresaQuery(associatedEmp?.nome || '');
    setIsModalOpen(true);
  };

  // Cached latest data for the currently edited equipment
  const editingLatestData = useMemo(() => {
    if (!editingEquip.id && !editingEquip.matricula) return null;
    return getEquipamentoLatestData(editingEquip, safeFolhas);
  }, [editingEquip.id, editingEquip.matricula, safeFolhas]);

  const handleSelectEmpresaItem = (emp: Empresa) => {
    setEditingEquip(prev => ({
      ...prev,
      empresaId: emp.id
    }));
    setEmpresaQuery(emp.nome);
    setIsEmpresaDropdownOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const compressed = await compressImageFile(files[i], 800, 0.65);
        if (compressed) {
          setEditingEquip(prev => {
            const currentFotos = prev.fotos || [];
            return {
              ...prev,
              fotos: [...currentFotos, compressed],
              fotoUrl: prev.fotoUrl || compressed
            };
          });
        }
      } catch (err) {
        console.warn('[Equipamentos] Erro ao comprimir imagem:', err);
      }
    }

    if (e.target) e.target.value = '';
  };

  const handleRemoveFoto = (index: number) => {
    setEditingEquip(prev => {
      const updatedFotos = (prev.fotos || []).filter((_, i) => i !== index);
      return {
        ...prev,
        fotos: updatedFotos,
        fotoUrl: updatedFotos[0] || ''
      };
    });
  };

  const handleSave = () => {
    try {
      const cleanMatricula = (editingEquip.matricula || '').trim().toUpperCase();
      if (!cleanMatricula) {
        alert('Por favor informe a matrícula ou identificador do equipamento.');
        return;
      }

      let targetEmpresaId = editingEquip.empresaId;
      const cleanEmpresaName = (empresaQuery || '').trim();

      // If no empresaId selected but company name was typed:
      if (!targetEmpresaId && cleanEmpresaName) {
        const matched = safeEmpresas.find(e => {
          const eNome = (e?.nome || '').trim().toLowerCase();
          const eNif = String(e?.nif || '').trim().toLowerCase();
          const target = cleanEmpresaName.toLowerCase();
          return (eNome && eNome === target) || (eNif && eNif === target);
        });

        if (matched) {
          targetEmpresaId = matched.id;
        } else {
          const newEmp: Empresa = {
            id: db.generateId('emp'),
            nome: cleanEmpresaName,
            moradaSede: '',
            distanciaKmGRAUMP: 0,
            estaleiros: []
          };
          db.insert(STORAGE_KEYS.EMPRESAS, newEmp);
          targetEmpresaId = newEmp.id;
        }
      }

      // If still no empresaId, associate with "Cliente Particular / Geral"
      if (!targetEmpresaId) {
        let particularEmp = safeEmpresas.find(e => {
          const eNome = (e?.nome || '').toLowerCase();
          return eNome.includes('particular') || eNome.includes('cliente geral');
        });
        if (!particularEmp) {
          particularEmp = {
            id: db.generateId('emp'),
            nome: 'Cliente Particular / Geral',
            moradaSede: '',
            distanciaKmGRAUMP: 0,
            estaleiros: []
          };
          db.insert(STORAGE_KEYS.EMPRESAS, particularEmp);
        }
        targetEmpresaId = particularEmp.id;
      }

      const equipToSave: Equipamento = {
        ...(editingEquip as Equipamento),
        matricula: cleanMatricula,
        empresaId: targetEmpresaId
      };

      const currentList = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS) || [];
      const existingIndex = currentList.findIndex(e => e.id === equipToSave.id);

      if (existingIndex >= 0) {
        db.update(STORAGE_KEYS.EQUIPAMENTOS, equipToSave.id, equipToSave);
      } else {
        db.insert(STORAGE_KEYS.EQUIPAMENTOS, equipToSave);
      }

      // Notify change
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.EQUIPAMENTOS } }));
      }

      setIsModalOpen(false);
      alert(`Ficha do equipamento "${cleanMatricula}" gravada com sucesso!`);
    } catch (err: any) {
      console.error('[Erro ao gravar equipamento]', err);
      alert('Ocorreu um erro ao gravar a ficha do equipamento: ' + (err?.message || err));
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta viatura?')) {
      db.delete(STORAGE_KEYS.EQUIPAMENTOS, id);
      setIsModalOpen(false);
    }
  };

  const filteredEquipamentos = safeEquipamentos.filter(eq => {
    if (!eq) return false;
    const term = searchTerm.toLowerCase();
    const emp = safeEmpresas.find(e => e.id === eq.empresaId);
    const empNome = emp ? (emp.nome || '').toLowerCase() : '';
    const empNif = emp?.nif ? emp.nif.toLowerCase() : '';

    return (
      (eq.matricula || '').toLowerCase().includes(term) ||
      (eq.marca || '').toLowerCase().includes(term) ||
      (eq.modelo || '').toLowerCase().includes(term) ||
      (eq.tipo && eq.tipo.toLowerCase().includes(term)) ||
      (eq.nSerie && eq.nSerie.toLowerCase().includes(term)) ||
      empNome.includes(term) ||
      empNif.includes(term)
    );
  });

  return (
    <div className="space-y-3.5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por matrícula, marca, modelo, empresa proprietária, tipo, série..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
          />
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
            onClick={onOpenScanner}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            Reconhecer Matrícula
          </button>

          <button
            onClick={handleCreateNew}
            className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
          >
            <Plus className="w-4 h-4" />
            Registar Viatura / Máquina
          </button>
        </div>
      </div>

      {/* Grid or Table of Equipments */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEquipamentos.map(eq => {
            const empresa = empresas.find(e => e.id === eq.empresaId);
            const latestData = getEquipamentoLatestData(eq, folhas);
            const historyFolhas = latestData.matchingFolhas;
            const coverPhoto = eq.fotos && eq.fotos.length > 0 ? eq.fotos[0] : eq.fotoUrl;

            return (
              <GlassCard
                key={eq.id}
                onClick={() => handleEditEquip(eq)}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                <div className="space-y-3">
                  {/* Photo preview if exists */}
                  {coverPhoto && (
                    <div className="relative h-36 w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                      <img
                        src={coverPhoto}
                        alt={eq.matricula}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-mono text-slate-300 border border-slate-700">
                        {eq.fotos?.length || 1} foto(s)
                      </div>
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-extrabold px-2.5 py-1 bg-slate-950 rounded-xl border border-slate-800 text-slate-100 text-base tracking-wider inline-block">
                        {eq.matricula}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-hp-400 transition-colors">
                        {eq.marca} {eq.modelo}
                      </h4>
                      <span className="text-xs text-slate-400">{eq.tipo || 'Geral'} {eq.ano ? `• ${eq.ano}` : ''}</span>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEditEquip(eq);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Specs list */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs text-slate-300 font-mono">
                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-sans text-slate-400">Empresa:</span>
                      <span className="font-sans font-semibold text-slate-200 truncate max-w-[170px]">
                        {empresa?.nome || 'Geral'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-sans text-slate-400">Quilómetros:</span>
                      <span className="font-bold text-emerald-400">{latestData.latestKms.toLocaleString()} Km</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="font-sans text-slate-400">Horas Trabalho:</span>
                      <span className="font-bold text-amber-400">{latestData.latestHoras} h</span>
                    </div>

                    {/* Delivery and Training Dates */}
                    {(eq.dataEntrega || eq.dataFormacao) && (
                      <div className="pt-1.5 border-t border-slate-800 space-y-1 text-[11px] font-sans">
                        {eq.dataEntrega && (
                          <div className="flex items-center justify-between text-emerald-300">
                            <span className="flex items-center gap-1">
                              <PackageCheck className="w-3 h-3" /> Data Entrega:
                            </span>
                            <span className="font-mono font-bold">
                              {formatDate(eq.dataEntrega)} {eq.entregaPor && <span className="text-[10px] text-emerald-400 font-sans font-normal">({eq.entregaPor})</span>}
                            </span>
                          </div>
                        )}
                        {eq.dataFormacao && (
                          <div className="flex items-center justify-between text-sky-300">
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" /> Data Formação:
                            </span>
                            <span className="font-mono font-bold">
                              {formatDate(eq.dataFormacao)} {eq.formacaoPor && <span className="text-[10px] text-sky-400 font-sans font-normal">({eq.formacaoPor})</span>}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {eq.nSerie && (
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        <span className="font-sans">Nº Série:</span>
                        <span className="truncate max-w-[150px]">{eq.nSerie}</span>
                      </div>
                    )}
                  </div>

                  {/* Maintenance History */}
                  {historyFolhas.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                        Últimas Intervenções ({historyFolhas.length})
                      </span>
                      <div className="space-y-1">
                        {historyFolhas.slice(0, 2).map(h => (
                          <div
                            key={h.id}
                            onClick={e => {
                              e.stopPropagation();
                              onSelectFolha(h);
                            }}
                            className="text-xs p-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 flex items-center justify-between hover:border-hp-500/40 cursor-pointer"
                          >
                            <span className="font-mono text-hp-400 font-bold">{h.numero}</span>
                            <span className="text-[10px] text-slate-400">{formatDate(h.data)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom tag */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setServicesModalEquip(eq);
                    }}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-hp-300 transition-colors cursor-pointer group/link"
                    title="Ver folhas de serviço desta viatura"
                  >
                    <Wrench className="w-3.5 h-3.5 text-hp-400" />
                    <span className="underline decoration-hp-500/50 underline-offset-2 font-bold text-hp-400 group-hover/link:text-hp-300">
                      {historyFolhas.length}
                    </span>{' '}
                    registos no histórico
                    {historyFolhas.length > 0 && (
                      <ExternalLink className="w-3 h-3 text-hp-400/70 ml-0.5 opacity-60 group-hover/link:opacity-100 transition-opacity" />
                    )}
                  </button>
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
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Marca & Modelo</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Empresa Proprietária</th>
                <th className="py-3 px-4 font-mono text-right">Quilómetros</th>
                <th className="py-3 px-4 font-mono text-right">Horas</th>
                <th className="py-3 px-4">Data Entrega</th>
                <th className="py-3 px-4">Data Formação</th>
                <th className="py-3 px-4 text-center">Intervenções</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredEquipamentos.map(eq => {
                const empresa = empresas.find(e => e.id === eq.empresaId);
                const latestData = getEquipamentoLatestData(eq, folhas);
                const historyFolhas = latestData.matchingFolhas;

                return (
                  <tr
                    key={eq.id}
                    onClick={() => handleEditEquip(eq)}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-extrabold px-2 py-0.5 bg-slate-900 border border-slate-700 text-white rounded">
                        {eq.matricula}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{eq.marca} {eq.modelo}</td>
                    <td className="py-3 px-4 text-slate-400">{eq.tipo || 'Geral'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{empresa?.nome || 'Geral'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">
                      {latestData.latestKms.toLocaleString()} Km
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-400 text-right">
                      {latestData.latestHoras} h
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{formatDate(eq.dataEntrega)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{formatDate(eq.dataFormacao)}</td>
                    <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setServicesModalEquip(eq)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono font-bold text-xs transition-all cursor-pointer ${
                          historyFolhas.length > 0
                            ? 'bg-hp-500/15 hover:bg-hp-500/30 text-hp-300 border-hp-500/40 hover:border-hp-400 shadow-sm'
                            : 'bg-slate-900/60 hover:bg-slate-800 text-slate-500 border-slate-800'
                        }`}
                        title="Ver histórico de folhas de serviço desta viatura"
                      >
                        <span>{historyFolhas.length}</span>
                        {historyFolhas.length > 0 && <ExternalLink className="w-3 h-3 text-hp-400" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditEquip(eq)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingEquip.id?.startsWith('eq_new') ? 'Nova Viatura / Máquina' : `Editar: ${editingEquip.matricula}`}
          subtitle="Ficha técnica, empresa proprietária, datas de entrega/formação e fotografias"
          maxWidth="4xl"
        >
          <div className="space-y-5">
            {/* Row 1: Plate & Searchable Empresa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Matrícula / Identificador *</label>
                <input
                  type="text"
                  value={editingEquip.matricula || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, matricula: e.target.value.toUpperCase() }))}
                  placeholder="Ex: AA-45-ZZ"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              {/* Searchable Empresa Combobox */}
              <div className="relative" ref={empresaContainerRef}>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Empresa Proprietária * <span className="text-[10px] text-hp-400">(Escreva para pesquisar)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escreva o nome ou NIF da empresa..."
                    value={empresaQuery}
                    onChange={e => {
                      setEmpresaQuery(e.target.value);
                      setIsEmpresaDropdownOpen(true);
                    }}
                    onFocus={() => setIsEmpresaDropdownOpen(true)}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 focus:border-hp-500 rounded-xl text-xs text-white font-semibold"
                  />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {isEmpresaDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {matchingEmpresas.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">Nenhuma empresa encontrada.</div>
                    ) : (
                      matchingEmpresas.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmpresaItem(emp)}
                          className="w-full text-left p-2.5 hover:bg-hp-600/20 border-b border-slate-800/60 last:border-0 text-xs flex items-center justify-between group transition-colors"
                        >
                          <span className="font-bold text-white">{emp.nome}</span>
                          <span className="text-[11px] text-slate-400 font-mono">NIF: {emp.nif || 'S/NIF'}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Brand, Model, Year */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Marca</label>
                <input
                  type="text"
                  value={editingEquip.marca || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, marca: e.target.value }))}
                  placeholder="Ex: Mercedes-Benz, Caterpillar, Komatsu"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Modelo</label>
                <input
                  type="text"
                  value={editingEquip.modelo || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, modelo: e.target.value }))}
                  placeholder="Ex: Actros 1845, 320D, FH 500"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Ano</label>
                <input
                  type="number"
                  value={editingEquip.ano || 2022}
                  onChange={e => setEditingEquip(prev => ({ ...prev, ano: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Row 3: Tipo de Equipamento (CAMPO LIVRE) + KM + Horas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Tipo de Equipamento <span className="text-[10px] text-hp-400">(Campo Livre)</span>
                </label>
                <input
                  type="text"
                  list="tipos-equipamento-sugestoes"
                  value={editingEquip.tipo || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, tipo: e.target.value }))}
                  placeholder="Ex: Camião Trator, Giratória, Dumper..."
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <datalist id="tipos-equipamento-sugestoes">
                  <option value="Ligeiro de Passageiros" />
                  <option value="Ligeiro de Mercadorias" />
                  <option value="Pesado de Mercadorias" />
                  <option value="Trator Pesado (Camião)" />
                  <option value="Furgão Oficina" />
                  <option value="Escavadora Giratória" />
                  <option value="Mini-Escavadora" />
                  <option value="Retroescavadora" />
                  <option value="Pá Carregadora" />
                  <option value="Empilhador Diesel" />
                  <option value="Empilhador Elétrico" />
                  <option value="Plataforma Elevatória" />
                  <option value="Grupo Gerador" />
                  <option value="Camião Betoneira" />
                  <option value="Camião Bomba" />
                  <option value="Trator Agrícola" />
                </datalist>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Quilómetros Atuais</label>
                  {editingLatestData?.latestFolhaWithKms && (
                    <span className="text-[10px] text-emerald-400 font-mono font-medium truncate max-w-[170px]" title={`Última Folha: ${editingLatestData.latestFolhaWithKms.numero} (${editingLatestData.latestFolhaWithKms.kmsAtuais?.toLocaleString()} km)`}>
                      Última FS: {editingLatestData.latestFolhaWithKms.numero} ({editingLatestData.latestFolhaWithKms.kmsAtuais?.toLocaleString()} km)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={editingEquip.kmsAtuais || 0}
                  onChange={e => setEditingEquip(prev => ({ ...prev, kmsAtuais: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400">Horas de Trabalho</label>
                  {editingLatestData?.latestFolhaWithHoras && (
                    <span className="text-[10px] text-amber-400 font-mono font-medium truncate max-w-[170px]" title={`Última Folha: ${editingLatestData.latestFolhaWithHoras.numero} (${editingLatestData.latestFolhaWithHoras.horasAtuais} h)`}>
                      Última FS: {editingLatestData.latestFolhaWithHoras.numero} ({editingLatestData.latestFolhaWithHoras.horasAtuais} h)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={editingEquip.horasAtuais || 0}
                  onChange={e => setEditingEquip(prev => ({ ...prev, horasAtuais: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Row 4: Data de Entrega & Data de Formação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-1">
                    <PackageCheck className="w-4 h-4" />
                    Data de Entrega
                  </label>
                  <input
                    type="date"
                    value={formatDateToInput(editingEquip.dataEntrega)}
                    onChange={e => setEditingEquip(prev => ({ ...prev, dataEntrega: formatDate(e.target.value) }))}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Entregue por (Técnico / Responsável)
                  </label>
                  <input
                    type="text"
                    placeholder="Nome de quem entregou..."
                    value={editingEquip.entregaPor || ''}
                    onChange={e => setEditingEquip(prev => ({ ...prev, entregaPor: e.target.value }))}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-semibold text-sky-400 flex items-center gap-1.5 mb-1">
                    <GraduationCap className="w-4 h-4" />
                    Data de Formação
                  </label>
                  <input
                    type="date"
                    value={formatDateToInput(editingEquip.dataFormacao)}
                    onChange={e => setEditingEquip(prev => ({ ...prev, dataFormacao: formatDate(e.target.value) }))}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">
                    Formação ministrada por
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do formador..."
                    value={editingEquip.formacaoPor || ''}
                    onChange={e => setEditingEquip(prev => ({ ...prev, formacaoPor: e.target.value }))}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Serial / VIN & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Número de Série / Chassi (VIN)</label>
                <input
                  type="text"
                  value={editingEquip.nSerie || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, nSerie: e.target.value }))}
                  placeholder="Ex: WDB9634031L892314"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Notas Técnicas</label>
                <input
                  type="text"
                  value={editingEquip.notas || ''}
                  onChange={e => setEditingEquip(prev => ({ ...prev, notas: e.target.value }))}
                  placeholder="Ex: Revisão de 20.000km em atraso"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Photos Upload & Gallery Section */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-hp-400" />
                  Galeria de Fotografias da Viatura ({editingEquip.fotos?.length || 0})
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-hp-500/30 transition-all"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Adicionar Fotos
                  </button>
                </div>
              </div>

              {/* Photo thumbnails */}
              {editingEquip.fotos && editingEquip.fotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {editingEquip.fotos.map((foto, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900 aspect-video">
                      <img src={foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleRemoveFoto(idx)}
                          className="p-1.5 bg-rose-500/80 hover:bg-rose-600 text-white rounded-lg text-xs"
                          title="Remover foto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-hp-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          Capa
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 border-2 border-dashed border-slate-800 hover:border-hp-500/50 rounded-xl text-center cursor-pointer transition-colors"
                >
                  <Camera className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-semibold">Clique para carregar fotografias da viatura ou máquina</p>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Formatos suportados: PNG, JPG, JPEG</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingEquip.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingEquip.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Viatura
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
                  Guardar Viatura
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Histórico de Folhas de Serviço da Viatura */}
      {servicesModalEquip && (
        <Modal
          isOpen={!!servicesModalEquip}
          onClose={() => setServicesModalEquip(null)}
          title={`Intervenções & Folhas de Serviço • ${servicesModalEquip.matricula}`}
          subtitle={`${servicesModalEquip.marca} ${servicesModalEquip.modelo} • ${safeEmpresas.find(e => e.id === servicesModalEquip.empresaId)?.nome || 'Cliente Geral'}`}
          maxWidth="4xl"
        >
          {(() => {
            const latestData = getEquipamentoLatestData(servicesModalEquip, safeFolhas);
            const equipFolhas = latestData.matchingFolhas;

            if (equipFolhas.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <Wrench className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-sm font-medium">
                    Ainda não existem folhas de serviço registadas para a viatura{' '}
                    <span className="font-mono font-bold text-white">{servicesModalEquip.matricula}</span>.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-4">
                {/* Resumo da Viatura */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Intervenções</span>
                      <span className="font-mono font-extrabold text-hp-400 text-sm">{equipFolhas.length} Folha(s)</span>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Quilómetros Atuais</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">{latestData.latestKms.toLocaleString()} Km</span>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Horas de Trabalho</span>
                      <span className="font-mono font-bold text-amber-400 text-sm">{latestData.latestHoras} h</span>
                    </div>
                  </div>
                  <span className="text-slate-400 text-[11px] italic">
                    💡 Clique numa folha ou no botão "Abrir" para editar diretamente.
                  </span>
                </div>

                {/* Tabela de Folhas de Serviço */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px] sticky top-0 z-10">
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
                      {equipFolhas.map(f => (
                        <tr
                          key={f.id}
                          onClick={() => {
                            setServicesModalEquip(null);
                            onSelectFolha(f);
                          }}
                          className="hover:bg-hp-600/15 cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-3">
                            <span className="font-mono font-extrabold text-hp-400 group-hover:underline text-xs">
                              {f.numero}
                            </span>
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
                                  : f.status?.includes('Em curso') || f.status?.includes('intervencionado')
                                  ? 'primary'
                                  : f.status?.includes('Aguardar')
                                  ? 'warning'
                                  : 'info'
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
                                setServicesModalEquip(null);
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

                <div className="flex justify-end pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setServicesModalEquip(null)}
                    className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};
