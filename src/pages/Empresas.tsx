import React, { useState } from 'react';
import {
  Plus,
  Search,
  Building2,
  MapPin,
  Phone,
  Mail,
  Truck,
  Edit,
  Trash2,
  Check,
  Building,
  Navigation,
  ExternalLink,
  Users,
  Wrench,
  Car,
  Compass,
  FileText,
  Clock,
  ChevronRight,
  Calculator,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { Empresa, Estaleiro, Equipamento, Cliente, FolhaServico } from '../types';

interface EmpresasProps {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  clientes: Cliente[];
  folhas?: FolhaServico[];
  onSelectFolha?: (folha: FolhaServico) => void;
}

const GRAUMP_ORIGIN = 'Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha';

// Realistic Road Distance Heuristic from Albergaria-a-Velha (GRAUMP)
export function estimateDistanceKm(address?: string): number {
  if (!address) return 45;
  const a = address.toLowerCase();

  if (a.includes('albergaria')) return 5;
  if (a.includes('estarreja') || a.includes('sever') || a.includes('águeda') || a.includes('agueda')) return 20;
  if (a.includes('aveiro') || a.includes('íhavo') || a.includes('ilhavo') || a.includes('vagos')) return 28;
  if (a.includes('ovar') || a.includes('oliveira de azeméis') || a.includes('azemeis') || a.includes('são joão')) return 32;
  if (a.includes('feira') || a.includes('espinho') || a.includes('anadia') || a.includes('mealhada')) return 42;
  if (a.includes('porto') || a.includes('gaia') || a.includes('maia') || a.includes('matosinhos') || a.includes('gondomar')) return 62;
  if (a.includes('coimbra') || a.includes('cantanhede') || a.includes('figueira da foz')) return 58;
  if (a.includes('viseu') || a.includes('são pedro do sul') || a.includes('tondela')) return 65;
  if (a.includes('braga') || a.includes('guimarães') || a.includes('famalicão') || a.includes('famalicao')) return 98;
  if (a.includes('viana do castelo') || a.includes('barcelos')) return 125;
  if (a.includes('leiria') || a.includes('pombal') || a.includes('marinha grande') || a.includes('fátima') || a.includes('fatima')) return 95;
  if (a.includes('santarém') || a.includes('santarem') || a.includes('torres novas') || a.includes('tomar')) return 145;
  if (a.includes('lisboa') || a.includes('sintra') || a.includes('cascais') || a.includes('loures') || a.includes('amadora') || a.includes('oeiras')) return 245;
  if (a.includes('setúbal') || a.includes('setubal') || a.includes('almada') || a.includes('seixal')) return 275;
  if (a.includes('faro') || a.includes('albufeira') || a.includes('portimão') || a.includes('algarve')) return 510;

  return 45;
}

export const Empresas: React.FC<EmpresasProps> = ({
  empresas,
  equipamentos,
  clientes,
  folhas = [],
  onSelectFolha
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_empresas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_empresas', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<Partial<Empresa>>({});

  // Quick Inspection Modal State
  const [inspectModal, setInspectModal] = useState<{
    isOpen: boolean;
    type: 'viaturas' | 'contactos' | 'estaleiros' | 'servicos';
    empresa: Empresa | null;
  }>({
    isOpen: false,
    type: 'viaturas',
    empresa: null
  });

  const handleOpenNavigation = (address: string, app: 'google' | 'waze') => {
    if (!address) return;
    if (app === 'google') {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(GRAUMP_ORIGIN)}&destination=${encodeURIComponent(address)}`;
      window.open(url, '_blank');
    } else {
      const url = `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
      window.open(url, '_blank');
    }
  };

  const handleCreateNew = () => {
    setEditingEmpresa({
      id: db.generateId('emp'),
      nome: '',
      nif: '',
      moradaSede: '',
      distanciaKmGRAUMP: 0,
      telefone: '',
      email: '',
      estaleiros: []
    });
    setIsModalOpen(true);
  };

  const handleMoradaSedeChange = (morada: string) => {
    const km = estimateDistanceKm(morada);
    setEditingEmpresa(prev => ({
      ...prev,
      moradaSede: morada,
      distanciaKmGRAUMP: km
    }));
  };

  const handleAddEstaleiro = () => {
    const newEst: Estaleiro = {
      id: db.generateId('est'),
      nome: '',
      morada: '',
      distanciaKmGRAUMP: 0,
      responsavel: '',
      telefone: ''
    };
    setEditingEmpresa(prev => ({
      ...prev,
      estaleiros: [...(prev.estaleiros || []), newEst]
    }));
  };

  const handleUpdateEstaleiro = (id: string, field: keyof Estaleiro, value: any) => {
    setEditingEmpresa(prev => ({
      ...prev,
      estaleiros: prev.estaleiros?.map(e => {
        if (e.id === id) {
          const updated = { ...e, [field]: value };
          if (field === 'morada') {
            updated.distanciaKmGRAUMP = estimateDistanceKm(value);
          }
          return updated;
        }
        return e;
      })
    }));
  };

  const handleRemoveEstaleiro = (id: string) => {
    setEditingEmpresa(prev => ({
      ...prev,
      estaleiros: prev.estaleiros?.filter(e => e.id !== id)
    }));
  };

  const handleSave = () => {
    if (!editingEmpresa.nome) {
      alert('Por favor informe o nome da empresa.');
      return;
    }

    const currentList = db.get<Empresa>(STORAGE_KEYS.EMPRESAS);
    const existingIndex = currentList.findIndex(e => e.id === editingEmpresa.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.EMPRESAS, editingEmpresa.id!, editingEmpresa);
    } else {
      db.insert(STORAGE_KEYS.EMPRESAS, editingEmpresa as Empresa);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta empresa?')) {
      db.delete(STORAGE_KEYS.EMPRESAS, id);
      setIsModalOpen(false);
    }
  };

  const filteredEmpresas = empresas.filter(e =>
    e.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.nif && e.nif.includes(searchTerm)) ||
    (e.moradaSede && e.moradaSede.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-3.5">
      {/* Search & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por nome, NIF, morada..."
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
            onClick={handleCreateNew}
            className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
          >
            <Plus className="w-4 h-4" />
            Registar Nova Empresa
          </button>
        </div>
      </div>

      {/* Grid or Table of Companies */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmpresas.map(emp => {
            const empEquips = equipamentos.filter(eq => eq.empresaId === emp.id);
            const empClients = clientes.filter(c => c.empresaId === emp.id);
            const empFolhas = folhas.filter(f => f.empresaId === emp.id);
            const totalServices = empFolhas.length;
            const completedServices = empFolhas.filter(f => f.status.startsWith('FEITO')).length;
            const sedeKm = emp.distanciaKmGRAUMP || estimateDistanceKm(emp.moradaSede);

            return (
              <GlassCard
                key={emp.id}
                onClick={() => {
                  setEditingEmpresa(emp);
                  setIsModalOpen(true);
                }}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400 font-bold group-hover:scale-105 transition-transform">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight group-hover:text-hp-400 transition-colors">
                          {emp.nome}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400">NIF: {emp.nif || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setEditingEmpresa(emp);
                          setIsModalOpen(true);
                        }}
                        title="Editar Empresa"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sede Address with Multiline Preview & Direct GPS Navigation */}
                  <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="flex items-start gap-1.5 text-xs text-slate-300">
                      <MapPin className="w-4 h-4 text-hp-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <span className="font-semibold text-white block text-[11px] uppercase tracking-wider">Morada da Sede</span>
                        <p className="whitespace-pre-line text-slate-300 text-xs mt-0.5 leading-relaxed">
                          {emp.moradaSede || 'Sem morada de sede registada.'}
                        </p>
                      </div>
                    </div>

                    {emp.moradaSede && (
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60" onClick={e => e.stopPropagation()}>
                        <span className="text-[11px] font-mono text-amber-300 flex items-center gap-1 font-semibold">
                          <Compass className="w-3.5 h-3.5" />
                          {sedeKm} KM da GRAUMP
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenNavigation(emp.moradaSede, 'google')}
                            className="px-2 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 border border-hp-500/30 transition-all"
                          >
                            <Navigation className="w-3 h-3" />
                            Google Maps
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenNavigation(emp.moradaSede, 'waze')}
                            className="px-2 py-1 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-[11px] font-bold flex items-center gap-1 border border-cyan-500/30 transition-all"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Waze
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Services Performed Stat Badge */}
                  <div
                    onClick={e => {
                      e.stopPropagation();
                      setInspectModal({ isOpen: true, type: 'servicos', empresa: emp });
                    }}
                    className="p-2.5 bg-hp-950/40 border border-hp-500/30 hover:border-hp-500/60 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-hp-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">Serviços Realizados</span>
                        <span className="text-[10px] text-slate-400">Total de obras efetuadas</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-extrabold font-mono text-hp-400">{totalServices}</span>
                      <span className="text-[10px] text-emerald-400 block font-mono">({completedServices} concluídos)</span>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{emp.telefone || 'S/ Telefone'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{emp.email || 'S/ Email'}</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Badges for Viaturas, Contactos, Estaleiros */}
                <div className="pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setInspectModal({ isOpen: true, type: 'viaturas', empresa: emp })}
                    className="p-1.5 bg-slate-900/90 hover:bg-hp-600/20 border border-slate-800 hover:border-hp-500/40 rounded-xl transition-all"
                  >
                    <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
                      <Car className="w-3 h-3 text-hp-400" /> Viaturas
                    </span>
                    <span className="text-xs font-bold font-mono text-white">{empEquips.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectModal({ isOpen: true, type: 'contactos', empresa: emp })}
                    className="p-1.5 bg-slate-900/90 hover:bg-hp-600/20 border border-slate-800 hover:border-hp-500/40 rounded-xl transition-all"
                  >
                    <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
                      <Users className="w-3 h-3 text-emerald-400" /> Contactos
                    </span>
                    <span className="text-xs font-bold font-mono text-white">{empClients.length}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectModal({ isOpen: true, type: 'estaleiros', empresa: emp })}
                    className="p-1.5 bg-slate-900/90 hover:bg-hp-600/20 border border-slate-800 hover:border-hp-500/40 rounded-xl transition-all"
                  >
                    <span className="text-[10px] text-slate-400 block flex items-center justify-center gap-1">
                      <Building className="w-3 h-3 text-amber-400" /> Estaleiros
                    </span>
                    <span className="text-xs font-bold font-mono text-white">{emp.estaleiros?.length || 0}</span>
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
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4">NIF</th>
                <th className="py-3 px-4">Morada da Sede</th>
                <th className="py-3 px-4">Distância GRAUMP</th>
                <th className="py-3 px-4 text-center">Viaturas</th>
                <th className="py-3 px-4 text-center">Contactos</th>
                <th className="py-3 px-4 text-center">Estaleiros</th>
                <th className="py-3 px-4 text-center">Obras / Serviços</th>
                <th className="py-3 px-4 text-right">Ações GPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredEmpresas.map(emp => {
                const empEquips = equipamentos.filter(eq => eq.empresaId === emp.id);
                const empClients = clientes.filter(c => c.empresaId === emp.id);
                const empFolhas = folhas.filter(f => f.empresaId === emp.id);
                const sedeKm = emp.distanciaKmGRAUMP || estimateDistanceKm(emp.moradaSede);

                return (
                  <tr
                    key={emp.id}
                    onClick={() => {
                      setEditingEmpresa(emp);
                      setIsModalOpen(true);
                    }}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white">{emp.nome}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{emp.nif || '-'}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{emp.moradaSede || '-'}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-amber-300">{sedeKm} KM</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-hp-400">{empEquips.length}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-emerald-400">{empClients.length}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-amber-400">{emp.estaleiros?.length || 0}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300">{empFolhas.length}</td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      {emp.moradaSede && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenNavigation(emp.moradaSede, 'google')}
                            className="p-1.5 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-[11px]"
                            title="Google Maps"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenNavigation(emp.moradaSede, 'waze')}
                            className="p-1.5 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-[11px]"
                            title="Waze"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Empresa Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`${editingEmpresa.id ? 'Editar' : 'Registar Nova'} Empresa`}
          subtitle="Dados gerais, moradas multilinhas da sede e estaleiros com cálculo de distâncias"
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* General Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Nome da Empresa *</label>
                <input
                  type="text"
                  value={editingEmpresa.nome || ''}
                  onChange={e => setEditingEmpresa(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Ex: Construções & Pavimentos Silva, Lda"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">NIF</label>
                <input
                  type="text"
                  value={editingEmpresa.nif || ''}
                  onChange={e => setEditingEmpresa(prev => ({ ...prev, nif: e.target.value }))}
                  placeholder="Ex: 501234567"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Multiline Sede Address & Distances */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-hp-400" />
                  Morada da Sede (Multilinha)
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {editingEmpresa.distanciaKmGRAUMP || 0} KM da GRAUMP
                  </span>
                  {editingEmpresa.moradaSede && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenNavigation(editingEmpresa.moradaSede!, 'google')}
                        className="px-2 py-0.5 rounded bg-hp-600/30 text-hp-300 hover:text-white text-[10px] font-bold"
                      >
                        GPS
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <textarea
                rows={3}
                value={editingEmpresa.moradaSede || ''}
                onChange={e => handleMoradaSedeChange(e.target.value)}
                placeholder="Rua / Avenida, Edifício, Piso&#10;Código Postal&#10;Localidade / Concelho"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Distância calculada a partir de Albergaria-a-Velha (GRAUMP)</span>
                <div className="flex items-center gap-1">
                  <span>Ajustar KM:</span>
                  <input
                    type="number"
                    value={editingEmpresa.distanciaKmGRAUMP || 0}
                    onChange={e => setEditingEmpresa(prev => ({ ...prev, distanciaKmGRAUMP: Number(e.target.value) }))}
                    className="w-16 py-0.5 px-1.5 bg-slate-900 border border-slate-700 rounded text-center text-white font-mono font-bold"
                  />
                  <span>KM</span>
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Telefone Principal</label>
                <input
                  type="text"
                  value={editingEmpresa.telefone || ''}
                  onChange={e => setEditingEmpresa(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="Ex: 229 450 120"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email Geral</label>
                <input
                  type="email"
                  value={editingEmpresa.email || ''}
                  onChange={e => setEditingEmpresa(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Ex: geral@empresa.pt"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Estaleiros (Multilinha + Distância KM) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-amber-400" />
                  Estaleiros & Parques de Equipamentos ({editingEmpresa.estaleiros?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={handleAddEstaleiro}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Estaleiro
                </button>
              </div>

              <div className="space-y-3">
                {editingEmpresa.estaleiros?.map(est => (
                  <div key={est.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Nome do Estaleiro (Ex: Estaleiro Maia Norte)"
                        value={est.nome}
                        onChange={e => handleUpdateEstaleiro(est.id, 'nome', e.target.value)}
                        className="flex-1 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold"
                      />

                      <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span className="font-mono text-amber-300 font-bold">{est.distanciaKmGRAUMP || 0} KM</span>
                        <input
                          type="number"
                          placeholder="KM"
                          value={est.distanciaKmGRAUMP || 0}
                          onChange={e => handleUpdateEstaleiro(est.id, 'distanciaKmGRAUMP', Number(e.target.value))}
                          className="w-14 py-1 px-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-white font-mono"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveEstaleiro(est.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Morada completa do estaleiro / Coordenadas / Ponto de referência (Multilinha)..."
                      value={est.morada}
                      onChange={e => handleUpdateEstaleiro(est.id, 'morada', e.target.value)}
                      className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Responsável no local"
                        value={est.responsavel || ''}
                        onChange={e => handleUpdateEstaleiro(est.id, 'responsavel', e.target.value)}
                        className="py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                      <input
                        type="text"
                        placeholder="Telefone do responsável"
                        value={est.telefone || ''}
                        onChange={e => handleUpdateEstaleiro(est.id, 'telefone', e.target.value)}
                        className="py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingEmpresa.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingEmpresa.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Empresa
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Empresa
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Inspection Modal for Viaturas, Contactos, Estaleiros, Serviços */}
      {inspectModal.isOpen && inspectModal.empresa && (
        <Modal
          isOpen={inspectModal.isOpen}
          onClose={() => setInspectModal({ isOpen: false, type: 'viaturas', empresa: null })}
          title={`${inspectModal.empresa.nome} • ${
            inspectModal.type === 'viaturas' ? 'Frota de Viaturas' :
            inspectModal.type === 'contactos' ? 'Contactos da Empresa' :
            inspectModal.type === 'estaleiros' ? 'Estaleiros & Parques' : 'Histórico de Serviços'
          }`}
          subtitle={`Informação detalhada associada a ${inspectModal.empresa.nome}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* View Switcher inside Inspect Modal */}
            <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setInspectModal(prev => ({ ...prev, type: 'viaturas' }))}
                className={`py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  inspectModal.type === 'viaturas' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                Viaturas ({equipamentos.filter(eq => eq.empresaId === inspectModal.empresa?.id).length})
              </button>

              <button
                type="button"
                onClick={() => setInspectModal(prev => ({ ...prev, type: 'contactos' }))}
                className={`py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  inspectModal.type === 'contactos' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Contactos ({clientes.filter(c => c.empresaId === inspectModal.empresa?.id).length})
              </button>

              <button
                type="button"
                onClick={() => setInspectModal(prev => ({ ...prev, type: 'estaleiros' }))}
                className={`py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  inspectModal.type === 'estaleiros' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                Estaleiros ({inspectModal.empresa.estaleiros?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setInspectModal(prev => ({ ...prev, type: 'servicos' }))}
                className={`py-1.5 px-3 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
                  inspectModal.type === 'servicos' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Serviços ({folhas.filter(f => f.empresaId === inspectModal.empresa?.id).length})
              </button>
            </div>

            {/* Content: Viaturas */}
            {inspectModal.type === 'viaturas' && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {equipamentos.filter(eq => eq.empresaId === inspectModal.empresa?.id).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">Nenhuma viatura associada a esta empresa.</p>
                ) : (
                  equipamentos.filter(eq => eq.empresaId === inspectModal.empresa?.id).map(eq => (
                    <div key={eq.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-extrabold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-xs mr-2">
                          {eq.matricula}
                        </span>
                        <span className="font-bold text-slate-200">{eq.marca} {eq.modelo}</span>
                        <span className="text-[11px] text-slate-400 ml-2">({eq.tipo})</span>
                      </div>
                      <div className="text-right font-mono text-slate-400 text-[11px]">
                        <span>{eq.kmsAtuais?.toLocaleString() || 0} Km | {eq.horasAtuais || 0}h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Content: Contactos */}
            {inspectModal.type === 'contactos' && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {clientes.filter(c => c.empresaId === inspectModal.empresa?.id).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">Nenhum contacto associado a esta empresa.</p>
                ) : (
                  clientes.filter(c => c.empresaId === inspectModal.empresa?.id).map(c => (
                    <div key={c.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <h5 className="font-bold text-white">{c.nome}</h5>
                        <p className="text-[11px] text-slate-400">{c.cargo || 'Responsável'}</p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        {c.telemovel && (
                          <a
                            href={`tel:${c.telemovel}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-hp-400 font-mono font-semibold flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {c.telemovel}
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            {c.email}
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Content: Estaleiros */}
            {inspectModal.type === 'estaleiros' && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {inspectModal.empresa.estaleiros?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">Nenhum estaleiro registado.</p>
                ) : (
                  inspectModal.empresa.estaleiros?.map(est => (
                    <div key={est.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-white text-sm">{est.nome}</h5>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {est.distanciaKmGRAUMP || estimateDistanceKm(est.morada)} KM da GRAUMP
                        </span>
                      </div>

                      <p className="whitespace-pre-line text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                        {est.morada || 'Sem morada'}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <div className="text-[11px] text-slate-400">
                          {est.responsavel && <span>Contacto: <b>{est.responsavel}</b> ({est.telefone})</span>}
                        </div>

                        {est.morada && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenNavigation(est.morada, 'google')}
                              className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-hp-500/30"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Google Maps
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenNavigation(est.morada, 'waze')}
                              className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-cyan-500/30"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Waze
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Content: Serviços */}
            {inspectModal.type === 'servicos' && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {folhas.filter(f => f.empresaId === inspectModal.empresa?.id).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center">Nenhum serviço registado para esta empresa.</p>
                ) : (
                  folhas.filter(f => f.empresaId === inspectModal.empresa?.id).map(fs => (
                    <div
                      key={fs.id}
                      onClick={() => {
                        if (onSelectFolha) {
                          setInspectModal({ isOpen: false, type: 'viaturas', empresa: null });
                          onSelectFolha(fs);
                        }
                      }}
                      className="p-3 bg-slate-950/80 hover:bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-hp-400">{fs.numero}</span>
                          <span className="font-mono font-bold text-white px-1.5 py-0.5 bg-slate-900 rounded border border-slate-700 text-[11px]">
                            {fs.matricula}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">{fs.marca} {fs.modelo} • {fs.tipo}</p>
                      </div>

                      <div className="text-right">
                        <Badge variant={fs.status.startsWith('FEITO') ? 'success' : fs.status.startsWith('AT') ? 'info' : 'warning'}>
                          {fs.status.split(' - ')[1] || fs.status}
                        </Badge>
                        <p className="text-[10px] text-slate-500 font-mono mt-1">{fs.data}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
