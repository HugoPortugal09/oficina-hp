import React, { useState } from 'react';
import {
  Plus,
  Search,
  Send,
  FileDown,
  Trash2,
  Check,
  Truck,
  Building2,
  MapPin,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import { generateGuiaEnvioPDF } from '../services/pdfService';
import type { GuiaEnvio, Empresa, UserProfile } from '../types';
import { getPermissionsForRole } from '../types';

interface GuiasEnvioProps {
  guias: GuiaEnvio[];
  empresas: Empresa[];
  currentUser?: UserProfile;
}

export const GuiasEnvio: React.FC<GuiasEnvioProps> = ({ guias, empresas, currentUser }) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_guias_envio');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_guias_envio', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuia, setEditingGuia] = useState<Partial<GuiaEnvio>>({});

  const handleCreateNew = () => {
    const config = db.getConfig();
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.GUIAS_ENVIO, 'GE');
    setEditingGuia({
      id: db.generateId('guia'),
      numero: newNum,
      data: new Date().toISOString().split('T')[0],
      empresaOrigem: config.nome,
      empresaDestino: empresas[0]?.nome || 'Empresa Destinatária',
      moradaDestino: empresas[0]?.moradaSede || 'Morada do Estaleiro',
      matriculaViaturaTransporte: '44-HP-77',
      motorista: 'Hugo Portugal',
      materiais: [
        { referencia: 'MAT-01', descricao: 'Material / Ferramenta de apoio', quantidade: 1, unidade: 'Un' }
      ],
      status: 'Emitida'
    });
    setIsModalOpen(true);
  };

  const handleAddMaterial = () => {
    setEditingGuia(prev => ({
      ...prev,
      materiais: [
        ...(prev.materiais || []),
        { descricao: '', quantidade: 1, unidade: 'Un' }
      ]
    }));
  };

  const handleUpdateMaterial = (idx: number, field: string, value: any) => {
    setEditingGuia(prev => {
      const updated = [...(prev.materiais || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, materiais: updated };
    });
  };

  const handleRemoveMaterial = (idx: number) => {
    setEditingGuia(prev => ({
      ...prev,
      materiais: prev.materiais?.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = () => {
    if (!editingGuia.empresaDestino) {
      alert('Por favor informe a empresa destinatária.');
      return;
    }

    const currentList = db.get<GuiaEnvio>(STORAGE_KEYS.GUIAS_ENVIO);
    const existingIndex = currentList.findIndex(g => g.id === editingGuia.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.GUIAS_ENVIO, editingGuia.id!, editingGuia);
    } else {
      db.insert(STORAGE_KEYS.GUIAS_ENVIO, editingGuia as GuiaEnvio);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta guia de envio?')) {
      db.delete(STORAGE_KEYS.GUIAS_ENVIO, id);
      setIsModalOpen(false);
    }
  };

  const filteredGuias = guias.filter(g =>
    g.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.empresaDestino.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.motorista && g.motorista.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-3.5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar guias por número, empresa, morada, viatura..."
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
              Emitir Guia de Envio
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredGuias.map(guia => {
            return (
              <GlassCard
                key={guia.id}
                onClick={() => {
                  setEditingGuia(guia);
                  setIsModalOpen(true);
                }}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/40 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {guia.numero}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1 group-hover:text-hp-400 transition-colors">{guia.empresaDestino}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">{guia.data}</p>
                    </div>

                    <Badge variant={guia.status === 'Entregue' ? 'success' : 'info'}>
                      {guia.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{guia.moradaDestino}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{guia.matriculaViaturaTransporte || 'Própria'} • {guia.motorista}</span>
                    </div>
                  </div>

                  {/* Materials preview */}
                  <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Materiais Transportados ({guia.materiais?.length || 0})
                    </span>
                    {guia.materiais?.slice(0, 3).map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                        <span className="truncate">{m.descricao}</span>
                        <span className="font-mono text-hp-400">x{m.quantidade} {m.unidade || 'Un'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => generateGuiaEnvioPDF(guia)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF da Guia
                  </button>

                  <button
                    onClick={() => {
                      setEditingGuia(guia);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs"
                  >
                    Editar
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
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Destinatário</th>
                <th className="py-3 px-4">Morada Destino</th>
                <th className="py-3 px-4">Viatura & Motorista</th>
                <th className="py-3 px-4 text-center">Itens</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredGuias.map(guia => (
                <tr
                  key={guia.id}
                  onClick={() => {
                    setEditingGuia(guia);
                    setIsModalOpen(true);
                  }}
                  className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono font-bold text-hp-400">{guia.numero}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">{guia.data}</td>
                  <td className="py-3 px-4 font-bold text-white">{guia.empresaDestino}</td>
                  <td className="py-3 px-4 max-w-xs truncate text-slate-300">{guia.moradaDestino}</td>
                  <td className="py-3 px-4 font-mono text-slate-400">
                    {guia.matriculaViaturaTransporte || 'Própria'} ({guia.motorista})
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-hp-400">
                    {guia.materiais?.length || 0}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Badge variant={guia.status === 'Entregue' ? 'success' : 'info'}>
                      {guia.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => generateGuiaEnvioPDF(guia)}
                      title="Descarregar PDF da Guia"
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Guia de Transporte / Envio: ${editingGuia.numero}`}
          subtitle="Documento de acompanhamento de materiais e ferramentas para estaleiro"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Empresa Destinatária</label>
                <input
                  type="text"
                  value={editingGuia.empresaDestino || ''}
                  onChange={e => setEditingGuia(prev => ({ ...prev, empresaDestino: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Morada de Destino / Estaleiro</label>
                <input
                  type="text"
                  value={editingGuia.moradaDestino || ''}
                  onChange={e => setEditingGuia(prev => ({ ...prev, moradaDestino: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Viatura de Transporte</label>
                <input
                  type="text"
                  value={editingGuia.matriculaViaturaTransporte || ''}
                  onChange={e => setEditingGuia(prev => ({ ...prev, matriculaViaturaTransporte: e.target.value }))}
                  placeholder="Ex: 44-HP-77"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Motorista</label>
                <input
                  type="text"
                  value={editingGuia.motorista || ''}
                  onChange={e => setEditingGuia(prev => ({ ...prev, motorista: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Estado</label>
                <select
                  value={editingGuia.status || 'Emitida'}
                  onChange={e => setEditingGuia(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Emitida">Emitida</option>
                  <option value="Em Trânsito">Em Trânsito</option>
                  <option value="Entregue">Entregue</option>
                  <option value="Anulada">Anulada</option>
                </select>
              </div>
            </div>

            {/* Materials table */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Materiais e Ferramentas
                </h4>
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-hp-500/30"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Item
                </button>
              </div>

              <div className="space-y-2">
                {editingGuia.materiais?.map((mat, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <input
                      type="text"
                      placeholder="Referência"
                      value={mat.referencia || ''}
                      onChange={e => handleUpdateMaterial(idx, 'referencia', e.target.value)}
                      className="w-28 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                    />

                    <input
                      type="text"
                      placeholder="Descrição do material..."
                      value={mat.descricao}
                      onChange={e => handleUpdateMaterial(idx, 'descricao', e.target.value)}
                      className="flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    />

                    <input
                      type="number"
                      placeholder="Qtd"
                      value={mat.quantidade}
                      onChange={e => handleUpdateMaterial(idx, 'quantidade', Number(e.target.value))}
                      className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center"
                    />

                    <input
                      type="text"
                      placeholder="Un"
                      value={mat.unidade || 'Un'}
                      onChange={e => handleUpdateMaterial(idx, 'unidade', e.target.value)}
                      className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white text-center"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="p-1 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingGuia.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingGuia.id!)}
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
                  Guardar Guia
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
