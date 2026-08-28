import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  FileCheck2,
  Calendar,
  Building2,
  Truck,
  Edit,
  Trash2,
  Check,
  Clock,
  ShieldCheck,
  ChevronDown,
  Car,
  X,
  Layers,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { Contrato, Empresa, Equipamento, UserProfile } from '../types';
import { getPermissionsForRole } from '../types';

interface ContratosProps {
  contratos: Contrato[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  currentUser?: UserProfile;
}

export const Contratos: React.FC<ContratosProps> = ({
  contratos,
  empresas,
  equipamentos,
  currentUser
}) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_contratos');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_contratos', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContrato, setEditingContrato] = useState<Partial<Contrato>>({});

  // Searchable Company Combobox state
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
  const empresaContainerRef = useRef<HTMLDivElement>(null);

  // Filter matching companies
  const matchingEmpresas = empresas.filter(emp =>
    emp.nome.toLowerCase().includes(empresaQuery.toLowerCase()) ||
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

  // Available fleet vehicles for the selected company
  const companyEquipamentos = equipamentos.filter(eq =>
    editingContrato.empresaId ? eq.empresaId === editingContrato.empresaId : true
  );

  const handleCreateNew = () => {
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.CONTRATOS, 'CT');
    setEditingContrato({
      id: db.generateId('ct'),
      numero: newNum,
      empresaId: '',
      nomeEmpresa: '',
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      equipamentosIds: [],
      matriculas: [],
      valorMensal: 350.0,
      periodicidade: 'Mensal',
      visitasPorPeriodo: 1,
      status: 'Ativo',
      notas: 'Inclui manutenção preventiva programada e assistência técnica prioritária.'
    });
    setEmpresaQuery('');
    setIsModalOpen(true);
  };

  const handleEditContrato = (ct: Contrato) => {
    setEditingContrato({
      ...ct,
      matriculas: ct.matriculas || ct.equipamentosIds?.map(id => equipamentos.find(e => e.id === id)?.matricula).filter(Boolean) as string[] || []
    });
    const associatedEmp = empresas.find(e => e.id === ct.empresaId);
    setEmpresaQuery(associatedEmp?.nome || ct.nomeEmpresa || '');
    setIsModalOpen(true);
  };

  const handleSelectEmpresaItem = (emp: Empresa) => {
    // Auto associate all fleet of that company by default
    const empFleet = equipamentos.filter(eq => eq.empresaId === emp.id);
    const empPlates = empFleet.map(eq => eq.matricula);
    const empIds = empFleet.map(eq => eq.id);

    setEditingContrato(prev => ({
      ...prev,
      empresaId: emp.id,
      nomeEmpresa: emp.nome,
      equipamentosIds: empIds,
      matriculas: empPlates
    }));
    setEmpresaQuery(emp.nome);
    setIsEmpresaDropdownOpen(false);
  };

  const handleToggleMatricula = (eq: Equipamento) => {
    const currentPlates = editingContrato.matriculas || [];
    const currentIds = editingContrato.equipamentosIds || [];
    const exists = currentPlates.includes(eq.matricula);

    let updatedPlates: string[];
    let updatedIds: string[];

    if (exists) {
      updatedPlates = currentPlates.filter(m => m !== eq.matricula);
      updatedIds = currentIds.filter(id => id !== eq.id);
    } else {
      updatedPlates = [...currentPlates, eq.matricula];
      updatedIds = [...currentIds, eq.id];
    }

    setEditingContrato(prev => ({
      ...prev,
      matriculas: updatedPlates,
      equipamentosIds: updatedIds
    }));
  };

  const handleSelectAllCompanyFleet = () => {
    const allPlates = companyEquipamentos.map(eq => eq.matricula);
    const allIds = companyEquipamentos.map(eq => eq.id);
    setEditingContrato(prev => ({
      ...prev,
      matriculas: allPlates,
      equipamentosIds: allIds
    }));
  };

  const handleClearAllFleet = () => {
    setEditingContrato(prev => ({
      ...prev,
      matriculas: [],
      equipamentosIds: []
    }));
  };

  const handleSave = () => {
    if (!editingContrato.empresaId || !editingContrato.nomeEmpresa) {
      alert('Por favor selecione a Empresa Cliente.');
      return;
    }

    const currentList = db.get<Contrato>(STORAGE_KEYS.CONTRATOS);
    const existingIndex = currentList.findIndex(c => c.id === editingContrato.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.CONTRATOS, editingContrato.id!, editingContrato);
    } else {
      db.insert(STORAGE_KEYS.CONTRATOS, editingContrato as Contrato);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar este contrato?')) {
      db.delete(STORAGE_KEYS.CONTRATOS, id);
      setIsModalOpen(false);
    }
  };

  const filteredContratos = contratos.filter(c => {
    const q = searchTerm.toLowerCase();
    const matchesNum = c.numero.toLowerCase().includes(q);
    const matchesEmp = c.nomeEmpresa.toLowerCase().includes(q);
    const matchesPlates = c.matriculas?.some(m => m.toLowerCase().includes(q)) || false;
    return matchesNum || matchesEmp || matchesPlates;
  });

  return (
    <div className="space-y-3.5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar contratos por número, empresa, matrícula abrangida..."
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

          {permissions.canEditServicos && (
            <button
              onClick={handleCreateNew}
              className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-4 h-4" />
              Novo Contrato de Manutenção
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContratos.map(ct => {
            const plates = ct.matriculas || ct.equipamentosIds?.map(id => equipamentos.find(e => e.id === id)?.matricula).filter(Boolean) as string[] || [];

            return (
              <GlassCard
                key={ct.id}
                onClick={() => {
                  if (permissions.canEditServicos) handleEditContrato(ct);
                }}
                className={`flex flex-col justify-between space-y-4 ${
                  permissions.canEditServicos ? 'hover:border-hp-500/50 cursor-pointer group' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {ct.numero}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1 group-hover:text-hp-400 transition-colors">
                        {ct.nomeEmpresa}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                      <Badge variant={ct.status === 'Ativo' ? 'success' : 'danger'}>
                        {ct.status}
                      </Badge>
                      {permissions.canEditServicos && (
                        <button
                          onClick={() => handleEditContrato(ct)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Contract Specs */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5 text-xs text-slate-300 font-mono">
                    {permissions.canViewPrecos && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-slate-400">Mensalidade:</span>
                        <span className="font-bold text-emerald-400 text-sm">{ct.valorMensal.toFixed(2)} € / mês</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-slate-400">
                      <span className="font-sans">Periodicidade:</span>
                      <span>{ct.periodicidade} ({ct.visitasPorPeriodo} visita/período)</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800">
                      <span className="font-sans">Validade:</span>
                      <span>{ct.dataInicio} até {ct.dataFim}</span>
                    </div>
                  </div>

                  {/* Associated License Plates */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/90 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5 text-hp-400" />
                      Matrículas Abrangidas ({plates.length}):
                    </span>

                    {plates.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {plates.map((mat, i) => (
                          <span
                            key={i}
                            className="font-mono font-extrabold text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white"
                          >
                            {mat}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">Nenhuma viatura associada a este contrato.</p>
                    )}
                  </div>

                  {ct.notas && (
                    <p className="text-xs text-slate-400 bg-slate-950/40 p-2 rounded-xl border border-slate-800/60 line-clamp-2">
                      {ct.notas}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-hp-400" />
                    Avença Preventiva
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">{plates.length} viatura(s) coberta(s)</span>
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
                <th className="py-3 px-4">Empresa Parceira</th>
                {permissions.canViewPrecos && <th className="py-3 px-4 text-right">Mensalidade</th>}
                <th className="py-3 px-4">Periodicidade</th>
                <th className="py-3 px-4">Vigência</th>
                <th className="py-3 px-4">Viaturas / Frotas</th>
                <th className="py-3 px-4 text-center">Estado</th>
                {permissions.canEditServicos && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredContratos.map(ct => {
                const plates = ct.matriculas || ct.equipamentosIds?.map(id => equipamentos.find(e => e.id === id)?.matricula).filter(Boolean) as string[] || [];

                return (
                  <tr
                    key={ct.id}
                    onClick={() => {
                      if (permissions.canEditServicos) handleEditContrato(ct);
                    }}
                    className={`${permissions.canEditServicos ? 'hover:bg-hp-600/10 cursor-pointer' : ''} transition-colors`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-hp-400">{ct.numero}</td>
                    <td className="py-3 px-4 font-bold text-white">{ct.nomeEmpresa}</td>
                    {permissions.canViewPrecos && (
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">
                        {ct.valorMensal.toFixed(2)} € / mês
                      </td>
                    )}
                    <td className="py-3 px-4 text-slate-400">{ct.periodicidade}</td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {ct.dataInicio} ~ {ct.dataFim}
                    </td>
                    <td className="py-3 px-4">
                      {plates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {plates.slice(0, 3).map((m, i) => (
                            <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-white">
                              {m}
                            </span>
                          ))}
                          {plates.length > 3 && (
                            <span className="text-[10px] text-slate-500 font-mono">+{plates.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Sem viaturas</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={ct.status === 'Ativo' ? 'success' : 'danger'}>
                        {ct.status}
                      </Badge>
                    </td>
                    {permissions.canEditServicos && (
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleEditContrato(ct)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
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
          title={`Contrato de Manutenção: ${editingContrato.numero}`}
          subtitle="Avença periódica, empresa parceira e associação de viaturas abrangidas"
          maxWidth="4xl"
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Searchable Empresa Cliente */}
              <div className="relative" ref={empresaContainerRef}>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Empresa Cliente * <span className="text-[10px] text-hp-400">(Escreva para pesquisar)</span>
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

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Estado do Contrato</label>
                <select
                  value={editingContrato.status || 'Ativo'}
                  onChange={e => setEditingContrato(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Expirado">Expirado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Association of Covered License Plates */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-hp-400" />
                    Matrículas Abrangidas pelo Contrato ({editingContrato.matriculas?.length || 0})
                  </label>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Selecione as viaturas da frota que têm direito a intervenções de contrato
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllCompanyFleet}
                    className="px-2.5 py-1 bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 rounded-lg text-xs font-semibold border border-hp-500/30 transition-all"
                  >
                    Selecionar Todas
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllFleet}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {companyEquipamentos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 max-h-48 overflow-y-auto">
                  {companyEquipamentos.map(eq => {
                    const isSelected = editingContrato.matriculas?.includes(eq.matricula);
                    return (
                      <div
                        key={eq.id}
                        onClick={() => handleToggleMatricula(eq)}
                        className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-hp-600/20 border-hp-500 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <span className="font-mono font-bold text-xs text-white block">{eq.matricula}</span>
                          <span className="text-[11px] text-slate-400">{eq.marca} {eq.modelo}</span>
                        </div>
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center border text-xs ${
                          isSelected ? 'bg-hp-600 border-hp-400 text-white' : 'border-slate-700 bg-slate-900'
                        }`}>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                  {editingContrato.empresaId
                    ? 'Nenhuma viatura registada para esta empresa. Registe viaturas no menu Frotas.'
                    : 'Por favor selecione primeiro a Empresa Cliente para listar a respetiva frota.'}
                </div>
              )}
            </div>

            {/* Financial and Periodicity Values */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Valor Mensal (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingContrato.valorMensal || 0}
                  onChange={e => setEditingContrato(prev => ({ ...prev, valorMensal: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Periodicidade</label>
                <select
                  value={editingContrato.periodicidade || 'Mensal'}
                  onChange={e => setEditingContrato(prev => ({ ...prev, periodicidade: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Mensal">Mensal</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Data Início</label>
                <input
                  type="date"
                  value={editingContrato.dataInicio || ''}
                  onChange={e => setEditingContrato(prev => ({ ...prev, dataInicio: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Data Fim</label>
                <input
                  type="date"
                  value={editingContrato.dataFim || ''}
                  onChange={e => setEditingContrato(prev => ({ ...prev, dataFim: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Notas & Condições do Contrato</label>
              <textarea
                rows={3}
                value={editingContrato.notas || ''}
                onChange={e => setEditingContrato(prev => ({ ...prev, notas: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingContrato.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingContrato.id!)}
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
                  Guardar Contrato
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
