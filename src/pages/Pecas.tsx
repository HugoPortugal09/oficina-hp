import React, { useState } from 'react';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  ShoppingCart,
  Edit,
  Trash2,
  Check,
  TrendingUp,
  Boxes,
  Calendar,
  Clock,
  Truck,
  Layers,
  Activity,
  History,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { PecaCatalogo, FolhaServico, UserProfile } from '../types';
import { getPermissionsForRole } from '../types';

interface PecasProps {
  pecas: PecaCatalogo[];
  folhas?: FolhaServico[];
  currentUser?: UserProfile;
}

export const Pecas: React.FC<PecasProps> = ({ pecas, folhas = [], currentUser }) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_pecas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_pecas', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Partial<PecaCatalogo>>({});

  // Calculate Parts usage over 30, 90, and 360 days
  const now = new Date().getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const cutoff30 = now - 30 * ONE_DAY_MS;
  const cutoff90 = now - 90 * ONE_DAY_MS;
  const cutoff360 = now - 360 * ONE_DAY_MS;

  // Global usage counts across all sheets
  let totalUsadas30 = 0;
  let totalUsadas90 = 0;
  let totalUsadas360 = 0;

  // Map for individual part usage
  const partUsageMap: { [key: string]: { d30: number; d90: number; d360: number } } = {};

  folhas.forEach(f => {
    const folhaTime = new Date(f.data).getTime() || now;
    const allPecas = [...(f.pecas || []), ...(f.pecasAdicionais || [])];

    allPecas.forEach(p => {
      const qtd = Number(p.qtd) || 0;
      if (folhaTime >= cutoff30) totalUsadas30 += qtd;
      if (folhaTime >= cutoff90) totalUsadas90 += qtd;
      if (folhaTime >= cutoff360) totalUsadas360 += qtd;

      const refKey = (p.referencia || p.designacao || '').trim().toLowerCase();
      if (refKey) {
        if (!partUsageMap[refKey]) {
          partUsageMap[refKey] = { d30: 0, d90: 0, d360: 0 };
        }
        if (folhaTime >= cutoff30) partUsageMap[refKey].d30 += qtd;
        if (folhaTime >= cutoff90) partUsageMap[refKey].d90 += qtd;
        if (folhaTime >= cutoff360) partUsageMap[refKey].d360 += qtd;
      }
    });
  });

  const getUsageForPart = (p: PecaCatalogo) => {
    const keyRef = (p.referencia || '').trim().toLowerCase();
    const keyDes = (p.designacao || '').trim().toLowerCase();
    return partUsageMap[keyRef] || partUsageMap[keyDes] || { d30: 0, d90: 0, d360: 0 };
  };

  const handleCreateNew = () => {
    setEditingPeca({
      id: db.generateId('pec'),
      referencia: '',
      designacao: '',
      marca: '',
      modelo: '',
      fornecedor: '',
      preco: 0,
      precoVenda: 0,
      taxaIva: 23,
      stockAtual: 0,
      stockMinimo: 2,
      localizacaoArmazem: 'Armazém Principal'
    });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!editingPeca.referencia || !editingPeca.designacao) {
      alert('Por favor informe a referência e designação da peça.');
      return;
    }

    const price = Number(editingPeca.preco || editingPeca.precoVenda || 0);
    const pecaToSave: PecaCatalogo = {
      ...(editingPeca as PecaCatalogo),
      preco: price,
      precoVenda: price
    };

    const currentList = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);
    const existingIndex = currentList.findIndex(p => p.id === editingPeca.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.PECAS_CATALOGO, editingPeca.id!, pecaToSave);
    } else {
      db.insert(STORAGE_KEYS.PECAS_CATALOGO, pecaToSave);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta peça?')) {
      db.delete(STORAGE_KEYS.PECAS_CATALOGO, id);
      setIsModalOpen(false);
    }
  };

  const filteredPecas = pecas.filter(p => {
    const q = searchTerm.toLowerCase();
    return (
      p.referencia.toLowerCase().includes(q) ||
      p.designacao.toLowerCase().includes(q) ||
      (p.marca && p.marca.toLowerCase().includes(q)) ||
      (p.modelo && p.modelo.toLowerCase().includes(q)) ||
      (p.fornecedor && p.fornecedor.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3.5">
      {/* 30, 90, 360 Days Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-3 flex items-center justify-between border-hp-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-hp-400" />
              Peças Usadas (Últimos 30 Dias)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-white mt-1">
              {totalUsadas30} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-cyan-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Peças Usadas (Últimos 90 Dias)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-cyan-300 mt-1">
              {totalUsadas90} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-amber-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Peças Usadas (Último Ano)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-amber-300 mt-1">
              {totalUsadas360} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
        </GlassCard>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por referência, designação, marca, modelo, fornecedor..."
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

          {permissions.canEditPecas && (
            <button
              onClick={handleCreateNew}
              className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-4 h-4" />
              Adicionar Peça ao Catálogo
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPecas.map(p => {
            const isLowStock = p.stockAtual <= p.stockMinimo;
            const displayPrice = p.preco !== undefined ? p.preco : p.precoVenda;
            const usage = getUsageForPart(p);

            return (
              <GlassCard
                key={p.id}
                onClick={() => {
                  if (permissions.canEditPecas) {
                    setEditingPeca(p);
                    setIsModalOpen(true);
                  }
                }}
                className={`flex flex-col justify-between space-y-4 ${
                  permissions.canEditPecas ? 'hover:border-hp-500/40 cursor-pointer group' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {p.referencia}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-hp-400 transition-colors">
                        {p.designacao}
                      </h4>
                      {(p.marca || p.modelo) && (
                        <span className="text-xs text-slate-400">
                          {p.marca} {p.modelo ? `• ${p.modelo}` : ''}
                        </span>
                      )}
                    </div>

                    {permissions.canEditPecas && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingPeca(p);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Stock, Supplier and Price */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
                    {permissions.canViewPrecos && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-slate-400">Preço:</span>
                        <span className="font-bold text-emerald-400 text-base">{displayPrice.toFixed(2)} €</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="font-sans text-slate-400">Stock Atual:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isLowStock ? 'text-rose-400' : 'text-slate-200'}`}>
                          {p.stockAtual} un.
                        </span>
                        {isLowStock && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                            Mín: {p.stockMinimo}
                          </span>
                        )}
                      </div>
                    </div>

                    {p.fornecedor && (
                      <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
                        <span className="font-sans">Fornecedor:</span>
                        <span className="font-sans font-semibold text-slate-300 truncate max-w-[170px]">{p.fornecedor}</span>
                      </div>
                    )}

                    {p.localizacaoArmazem && (
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="font-sans">Local Armazém:</span>
                        <span className="font-sans text-slate-400">{p.localizacaoArmazem}</span>
                      </div>
                    )}
                  </div>

                  {/* Consumption Metric Per Part */}
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/90 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Consumo Deste Artigo:</span>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">30d</span>
                        <span className="font-bold text-hp-400">{usage.d30} un.</span>
                      </div>
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">90d</span>
                        <span className="font-bold text-cyan-400">{usage.d90} un.</span>
                      </div>
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">360d</span>
                        <span className="font-bold text-amber-400">{usage.d360} un.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action / Status */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono">
                    {permissions.canViewPrecos ? `IVA: ${p.taxaIva || 23}%` : 'Disponibilidade'}
                  </span>
                  <Badge variant={isLowStock ? 'danger' : 'success'}>
                    {isLowStock ? 'Stock Baixo' : 'Disponível'}
                  </Badge>
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
                <th className="py-3 px-4">Referência</th>
                <th className="py-3 px-4">Designação da Peça</th>
                <th className="py-3 px-4">Marca / Modelo</th>
                <th className="py-3 px-4">Fornecedor</th>
                {permissions.canViewPrecos && <th className="py-3 px-4 text-right">Preço (€)</th>}
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-center">Consumo (30d / 90d / 360d)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                {permissions.canEditPecas && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredPecas.map(p => {
                const isLowStock = p.stockAtual <= p.stockMinimo;
                const displayPrice = p.preco !== undefined ? p.preco : p.precoVenda;
                const usage = getUsageForPart(p);

                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      if (permissions.canEditPecas) {
                        setEditingPeca(p);
                        setIsModalOpen(true);
                      }
                    }}
                    className={`${permissions.canEditPecas ? 'hover:bg-hp-600/10 cursor-pointer' : ''} transition-colors`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-hp-400">{p.referencia}</td>
                    <td className="py-3 px-4 font-bold text-white max-w-xs">{p.designacao}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.marca} {p.modelo ? `• ${p.modelo}` : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.fornecedor || '-'}</td>
                    {permissions.canViewPrecos && (
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {displayPrice.toFixed(2)} €
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={isLowStock ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                        {p.stockAtual} un.
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[11px]">
                      <span className="text-hp-400 font-bold">{usage.d30}</span> /{' '}
                      <span className="text-cyan-400 font-bold">{usage.d90}</span> /{' '}
                      <span className="text-amber-400 font-bold">{usage.d360}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={isLowStock ? 'danger' : 'success'}>
                        {isLowStock ? 'Stock Baixo' : 'Disponível'}
                      </Badge>
                    </td>
                    {permissions.canEditPecas && (
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingPeca(p);
                            setIsModalOpen(true);
                          }}
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
          title={editingPeca.id?.startsWith('pec_new') ? 'Nova Peça no Catálogo' : `Editar: ${editingPeca.referencia}`}
          subtitle="Dados da peça, marca, modelo, fornecedor, preço e gestão de stock"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className={`grid grid-cols-1 ${permissions.canViewPrecos ? 'sm:grid-cols-2' : ''} gap-3`}>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Referência / Código *</label>
                <input
                  type="text"
                  value={editingPeca.referencia || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, referencia: e.target.value.toUpperCase() }))}
                  placeholder="Ex: FIL-OLE-01"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              {permissions.canViewPrecos && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Preço (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPeca.preco !== undefined ? editingPeca.preco : (editingPeca.precoVenda || 0)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setEditingPeca(prev => ({ ...prev, preco: val, precoVenda: val }));
                    }}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Designação da Peça *</label>
              <input
                type="text"
                value={editingPeca.designacao || ''}
                onChange={e => setEditingPeca(prev => ({ ...prev, designacao: e.target.value }))}
                placeholder="Ex: Filtro de Óleo Heavy Duty MANN HU947"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Row: Marca, Modelo, Fornecedor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Marca</label>
                <input
                  type="text"
                  value={editingPeca.marca || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, marca: e.target.value }))}
                  placeholder="Ex: MANN, Castrol, Brembo"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Modelo / Aplicação</label>
                <input
                  type="text"
                  value={editingPeca.modelo || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, modelo: e.target.value }))}
                  placeholder="Ex: Actros 1845 / FH500"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={editingPeca.fornecedor || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, fornecedor: e.target.value }))}
                  placeholder="Ex: Auto Peças Portugal"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Stock Levels & Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Atual (Unidades)</label>
                <input
                  type="number"
                  value={editingPeca.stockAtual || 0}
                  onChange={e => setEditingPeca(prev => ({ ...prev, stockAtual: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  value={editingPeca.stockMinimo || 2}
                  onChange={e => setEditingPeca(prev => ({ ...prev, stockMinimo: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Taxa IVA %</label>
                <select
                  value={editingPeca.taxaIva || 23}
                  onChange={e => setEditingPeca(prev => ({ ...prev, taxaIva: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="23">23%</option>
                  <option value="13">13%</option>
                  <option value="6">6%</option>
                  <option value="0">0%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Localização no Armazém</label>
              <input
                type="text"
                value={editingPeca.localizacaoArmazem || ''}
                onChange={e => setEditingPeca(prev => ({ ...prev, localizacaoArmazem: e.target.value }))}
                placeholder="Ex: Prateleira B-04 / Depósito Óleos"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingPeca.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingPeca.id!)}
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
                  Guardar Peça
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
