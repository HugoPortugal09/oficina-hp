import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Users,
  Building2,
  Phone,
  Mail,
  Edit,
  Trash2,
  Check,
  MessageCircle,
  ChevronDown,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { Cliente, Empresa } from '../types';

interface ClientesProps {
  clientes: Cliente[];
  empresas: Empresa[];
}

export const Clientes: React.FC<ClientesProps> = ({ clientes, empresas }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_clientes');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_clientes', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente>>({});

  // Searchable Company Combobox in Modal
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
  const empresaContainerRef = useRef<HTMLDivElement>(null);

  // Filter companies matching the search input
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

  const handleCreateNew = () => {
    setEditingCliente({
      id: db.generateId('cli'),
      nome: '',
      telemovel: '',
      email: '',
      empresaId: '',
      cargo: 'Gestor de Frota'
    });
    setEmpresaQuery('');
    setIsModalOpen(true);
  };

  const handleEditCliente = (cli: Cliente) => {
    setEditingCliente(cli);
    const associatedEmp = empresas.find(e => e.id === cli.empresaId);
    setEmpresaQuery(associatedEmp?.nome || '');
    setIsModalOpen(true);
  };

  const handleSelectEmpresaItem = (emp: Empresa) => {
    setEditingCliente(prev => ({
      ...prev,
      empresaId: emp.id
    }));
    setEmpresaQuery(emp.nome);
    setIsEmpresaDropdownOpen(false);
  };

  const handleSave = () => {
    if (!editingCliente.nome) {
      alert('Por favor informe o nome do cliente / contacto.');
      return;
    }

    if (!editingCliente.empresaId) {
      alert('Por favor selecione a Empresa Associada.');
      return;
    }

    const currentList = db.get<Cliente>(STORAGE_KEYS.CLIENTES);
    const existingIndex = currentList.findIndex(c => c.id === editingCliente.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.CLIENTES, editingCliente.id!, editingCliente);
    } else {
      db.insert(STORAGE_KEYS.CLIENTES, editingCliente as Cliente);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar este contacto?')) {
      db.delete(STORAGE_KEYS.CLIENTES, id);
      setIsModalOpen(false);
    }
  };

  const filteredClientes = clientes.filter(c => {
    const emp = empresas.find(e => e.id === c.empresaId);
    return (
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.telemovel.includes(searchTerm) ||
      (emp && emp.nome.toLowerCase().includes(searchTerm.toLowerCase()))
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
            placeholder="Pesquisar por nome, telefone, email, empresa..."
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
            Novo Contacto / Cliente
          </button>
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClientes.map(cli => {
            const empresa = empresas.find(e => e.id === cli.empresaId);
            const cleanPhone = cli.telemovel.replace(/\s+/g, '');

            return (
              <GlassCard
                key={cli.id}
                onClick={() => handleEditCliente(cli)}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-hp-500 flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-transform">
                        {cli.nome.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-hp-400 transition-colors">
                          {cli.nome}
                        </h4>
                        <span className="text-xs text-slate-400">{cli.cargo || 'Responsável'}</span>
                      </div>
                    </div>

                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleEditCliente(cli);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-hp-400 shrink-0" />
                      <span className="font-semibold text-slate-200 truncate">{empresa?.nome || 'Particular'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono">{cli.telemovel}</span>
                    </div>

                    {cli.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{cli.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Direct Communication Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <a
                    href={`tel:${cleanPhone}`}
                    className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Ligar
                  </a>

                  <a
                    href={`https://wa.me/351${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-500/30 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    WhatsApp
                  </a>
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
                <th className="py-3 px-4">Nome</th>
                <th className="py-3 px-4">Empresa Associada</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4">Telemóvel</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4 text-right">Contacto Direto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredClientes.map(cli => {
                const empresa = empresas.find(e => e.id === cli.empresaId);
                const cleanPhone = cli.telemovel.replace(/\s+/g, '');
                return (
                  <tr
                    key={cli.id}
                    onClick={() => handleEditCliente(cli)}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-hp-500/20 text-hp-400 flex items-center justify-center font-bold text-xs">
                        {cli.nome.charAt(0)}
                      </div>
                      {cli.nome}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">{empresa?.nome || 'Particular'}</td>
                    <td className="py-3 px-4 text-slate-400">{cli.cargo || 'Responsável'}</td>
                    <td className="py-3 px-4 font-mono">{cli.telemovel}</td>
                    <td className="py-3 px-4 text-slate-400">{cli.email || '-'}</td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={`tel:${cleanPhone}`}
                          title="Ligar"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        </a>
                        <a
                          href={`https://wa.me/351${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="WhatsApp"
                          className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      </div>
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
          title={editingCliente.id?.startsWith('cli_new') ? 'Novo Contacto' : `Editar: ${editingCliente.nome}`}
          subtitle="Associação a empresa parceira, telemóvel e email"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Completo *</label>
              <input
                type="text"
                value={editingCliente.nome || ''}
                onChange={e => setEditingCliente(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Eng. António Silva"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Searchable Empresa Associada Combobox */}
            <div className="relative" ref={empresaContainerRef}>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Empresa Associada * <span className="text-[10px] text-hp-400">(Escreva para pesquisar)</span>
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

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Cargo / Função</label>
              <input
                type="text"
                value={editingCliente.cargo || ''}
                onChange={e => setEditingCliente(prev => ({ ...prev, cargo: e.target.value }))}
                placeholder="Ex: Diretor de Frotas / Mecânico Chefe"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Telemóvel / WhatsApp</label>
                <input
                  type="text"
                  value={editingCliente.telemovel || ''}
                  onChange={e => setEditingCliente(prev => ({ ...prev, telemovel: e.target.value }))}
                  placeholder="Ex: 912 345 678"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  value={editingCliente.email || ''}
                  onChange={e => setEditingCliente(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Ex: a.silva@empresa.pt"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingCliente.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingCliente.id!)}
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
                  Guardar Contacto
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
