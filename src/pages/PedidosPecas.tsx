import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertTriangle,
  Trash2,
  Check,
  Building2,
  Package,
  FileText,
  ChevronDown,
  Car,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { PedidoPeca, PecaCatalogo, FolhaServico, UserProfile } from '../types';
import { getPermissionsForRole } from '../types';

interface PedidosPecasProps {
  pedidos: PedidoPeca[];
  catalogoPecas: PecaCatalogo[];
  folhas: FolhaServico[];
  currentUser?: UserProfile;
}

// Searchable Catalog Part Select Component for Order Lines
const SearchableCatalogSelect: React.FC<{
  value?: string;
  catalogo: PecaCatalogo[];
  onSelect: (peca: PecaCatalogo) => void;
}> = ({ value, catalogo, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPart = catalogo.find(p => p.id === value || p.referencia === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = catalogo.filter(p =>
    p.referencia.toLowerCase().includes(query.toLowerCase()) ||
    p.designacao.toLowerCase().includes(query.toLowerCase()) ||
    (p.marca && p.marca.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative w-48 sm:w-60" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 hover:border-hp-500 rounded-lg text-xs text-white flex items-center justify-between cursor-pointer"
      >
        <span className="truncate">
          {selectedPart ? `${selectedPart.referencia} - ${selectedPart.designacao}` : '-- Do Catálogo --'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-52 flex flex-col backdrop-blur-xl">
          <div className="p-1.5 border-b border-slate-800">
            <input
              type="text"
              autoFocus
              placeholder="Pesquisar ref ou nome..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-hp-500"
            />
          </div>

          <div className="overflow-y-auto flex-1 p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-500">Nenhuma peça encontrada</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left p-1.5 rounded-lg hover:bg-hp-600/20 text-xs text-slate-200 flex items-center justify-between group transition-colors"
                >
                  <div className="truncate pr-2">
                    <span className="font-mono font-bold text-hp-400 mr-1.5">{p.referencia}</span>
                    <span className="text-slate-300">{p.designacao}</span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-400 shrink-0">Stock: {p.stockAtual}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const PedidosPecas: React.FC<PedidosPecasProps> = ({
  pedidos,
  catalogoPecas,
  folhas,
  currentUser
}) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_pedidos_pecas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_pedidos_pecas', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Partial<PedidoPeca>>({});

  const handleCreateNew = () => {
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.PEDIDOS_PECAS, 'PED');
    setEditingPedido({
      id: db.generateId('ped'),
      numero: newNum,
      data: new Date().toISOString().split('T')[0],
      status: 'Pendente',
      prioridade: 'normal',
      fornecedor: '', // removido da UI
      pecas: [
        {
          referencia: '',
          designacao: '',
          qtd: 1
        }
      ],
      notas: ''
    });
    setIsModalOpen(true);
  };

  const handleAddPartToPedido = () => {
    setEditingPedido(prev => ({
      ...prev,
      pecas: [
        ...(prev.pecas || []),
        {
          referencia: '',
          designacao: '',
          qtd: 1
        }
      ]
    }));
  };

  const handleSelectCatalogPart = (part: PecaCatalogo, idx: number) => {
    setEditingPedido(prev => {
      const updated = [...(prev.pecas || [])];
      updated[idx] = {
        referencia: part.referencia,
        designacao: part.designacao,
        qtd: updated[idx]?.qtd || 1
      };
      return { ...prev, pecas: updated };
    });
  };

  const handleUpdatePart = (idx: number, field: string, value: any) => {
    setEditingPedido(prev => {
      const updated = [...(prev.pecas || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, pecas: updated };
    });
  };

  const handleRemovePart = (idx: number) => {
    setEditingPedido(prev => ({
      ...prev,
      pecas: prev.pecas?.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = () => {
    if (!editingPedido.pecas || editingPedido.pecas.length === 0) {
      alert('Por favor adicione pelo menos uma peça ao pedido.');
      return;
    }

    const currentList = db.get<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS);
    const existingIndex = currentList.findIndex(p => p.id === editingPedido.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.PEDIDOS_PECAS, editingPedido.id!, editingPedido);
    } else {
      db.insert(STORAGE_KEYS.PEDIDOS_PECAS, editingPedido as PedidoPeca);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar este pedido?')) {
      db.delete(STORAGE_KEYS.PEDIDOS_PECAS, id);
      setIsModalOpen(false);
    }
  };

  const filteredPedidos = pedidos.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchesNumber = p.numero.toLowerCase().includes(q);
    const matchesPlate = p.matricula ? p.matricula.toLowerCase().includes(q) : false;
    const matchesNotes = p.notas ? p.notas.toLowerCase().includes(q) : false;
    const matchesParts = p.pecas?.some(
      item =>
        item.referencia.toLowerCase().includes(q) ||
        item.designacao.toLowerCase().includes(q)
    );
    return matchesNumber || matchesPlate || matchesNotes || matchesParts;
  });

  return (
    <div className="space-y-3.5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar pedidos por número, referência, designação..."
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
              Novo Pedido de Peças
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table of Part Orders */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPedidos.map(ped => {
            return (
              <GlassCard
                key={ped.id}
                onClick={() => {
                  setEditingPedido(ped);
                  setIsModalOpen(true);
                }}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {ped.numero}
                      </span>
                      <p className="text-[11px] text-slate-400 font-mono mt-1">{ped.data}</p>
                    </div>

                    <div className="text-right space-y-1">
                      <Badge
                        variant={
                          ped.status === 'Recebido'
                            ? 'success'
                            : ped.status === 'Encomendado'
                            ? 'info'
                            : 'warning'
                        }
                      >
                        {ped.status}
                      </Badge>

                      <p className="text-[10px] uppercase font-bold text-amber-400">
                        Prioridade: {ped.prioridade}
                      </p>
                    </div>
                  </div>

                  {/* Parts list */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Peças Requisitadas ({ped.pecas?.length || 0})
                    </span>
                    {ped.pecas?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-300 py-0.5 border-b border-slate-900 last:border-0">
                        <div className="truncate pr-2">
                          {item.referencia && (
                            <span className="font-mono font-bold text-hp-400 mr-1.5">{item.referencia}</span>
                          )}
                          <span className="text-slate-200">{item.designacao}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400 shrink-0">x{item.qtd}</span>
                      </div>
                    ))}
                  </div>

                  {/* Notes if available */}
                  {ped.notas && (
                    <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-hp-400 shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{ped.notas}</p>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPedido(ped);
                      setIsModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                  >
                    {permissions.canEditPecas ? 'Ver / Editar' : 'Ver Detalhes'}
                  </button>

                  {permissions.canEditPecas && ped.status !== 'Recebido' && (
                    <button
                      type="button"
                      onClick={() => {
                        db.update<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS, ped.id, { status: 'Recebido' });
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Marcar como Recebido
                    </button>
                  )}
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
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Peças Requisitadas</th>
                <th className="py-3 px-4">Notas</th>
                <th className="py-3 px-4 text-center">Prioridade</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredPedidos.map(ped => (
                <tr
                  key={ped.id}
                  onClick={() => {
                    setEditingPedido(ped);
                    setIsModalOpen(true);
                  }}
                  className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-hp-400">{ped.numero}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{ped.data}</td>
                  <td className="py-3 px-4 max-w-sm">
                    <div className="space-y-0.5">
                      {ped.pecas?.slice(0, 2).map((it, idx) => (
                        <div key={idx} className="truncate text-[11px]">
                          {it.referencia && <b className="text-hp-400 font-mono mr-1">[{it.referencia}]</b>}
                          {it.designacao} <span className="text-emerald-400 font-mono font-bold">(x{it.qtd})</span>
                        </div>
                      ))}
                      {(ped.pecas?.length || 0) > 2 && (
                        <span className="text-[10px] text-slate-500 font-mono">+ {(ped.pecas?.length || 0) - 2} peça(s)...</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{ped.notas || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-amber-400 text-[11px]">{ped.prioridade}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge
                      variant={
                        ped.status === 'Recebido'
                          ? 'success'
                          : ped.status === 'Encomendado'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {ped.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                    {ped.status !== 'Recebido' && (
                      <button
                        type="button"
                        onClick={() => {
                          db.update<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS, ped.id, { status: 'Recebido' });
                        }}
                        title="Marcar como Recebido"
                        className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Pedido de Peças: ${editingPedido.numero}`}
          subtitle="Requisição de material e peças existentes no catálogo"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Header controls: Prioridade e Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Prioridade</label>
                <select
                  value={editingPedido.prioridade || 'normal'}
                  onChange={e => setEditingPedido(prev => ({ ...prev, prioridade: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="urgente">Urgente</option>
                  <option value="critico">Crítico (Viatura Imobilizada)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Estado</label>
                <select
                  value={editingPedido.status || 'Pendente'}
                  onChange={e => setEditingPedido(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Encomendado">Encomendado</option>
                  <option value="Recebido">Recebido</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            {/* Parts items with Catalog Search */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Lista de Peças Requisitadas ({editingPedido.pecas?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={handleAddPartToPedido}
                  className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-hp-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </button>
              </div>

              <div className="space-y-2">
                {editingPedido.pecas?.map((item, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                    {/* Searchable Catalog Combobox */}
                    <SearchableCatalogSelect
                      value={item.referencia}
                      catalogo={catalogoPecas}
                      onSelect={part => handleSelectCatalogPart(part, idx)}
                    />

                    {/* Referência / Código */}
                    <input
                      type="text"
                      placeholder="Referência / Código"
                      value={item.referencia}
                      onChange={e => handleUpdatePart(idx, 'referencia', e.target.value.toUpperCase())}
                      className="w-full sm:w-36 py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono font-bold"
                    />

                    {/* Designação da Peça */}
                    <input
                      type="text"
                      placeholder="Designação da Peça..."
                      value={item.designacao}
                      onChange={e => handleUpdatePart(idx, 'designacao', e.target.value)}
                      className="flex-1 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-semibold"
                    />

                    {/* Quantidade */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 sm:hidden">Qtd:</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.qtd}
                        onChange={e => handleUpdatePart(idx, 'qtd', Number(e.target.value))}
                        className="w-16 py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center font-bold"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePart(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg"
                      title="Remover peça"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notas Field */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Notas / Observações</label>
              <textarea
                rows={3}
                value={editingPedido.notas || ''}
                onChange={e => setEditingPedido(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Indique detalhes adicionais sobre a encomenda, viatura associada, urgência ou prazos..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingPedido.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingPedido.id!)}
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
                  Guardar Pedido
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
