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
import { sendNovoContactoEmail } from '../services/emailService';
import type { Cliente, Empresa, UserProfile } from '../types';

interface ClientesProps {
  clientes: Cliente[];
  empresas: Empresa[];
  currentUser?: UserProfile;
}

export const Clientes: React.FC<ClientesProps> = ({ clientes, empresas, currentUser }) => {
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

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [sendingEmailForId, setSendingEmailForId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Partial<Cliente>>({});

  const handleSendContactEmail = async (cli: Cliente, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSendingEmailForId(cli.id);
    const targetEmpresa = (empresas || []).find(emp => emp.id === cli.empresaId);
    try {
      const res = await sendNovoContactoEmail({
        cliente: cli,
        empresa: targetEmpresa,
        currentUser,
        isEdit: false
      });
      if (res.success) {
        setFeedbackMessage(`Email dos dados de "${cli.nome}" enviado com sucesso para: ${res.recipients.join(', ')}`);
      } else {
        setFeedbackMessage(`Não foi possível enviar o email: ${res.message}`);
      }
      setTimeout(() => setFeedbackMessage(null), 8000);
    } catch (err: any) {
      setFeedbackMessage(`Erro ao enviar email: ${err?.message || err}`);
      setTimeout(() => setFeedbackMessage(null), 6000);
    } finally {
      setSendingEmailForId(null);
    }
  };

  // Searchable Company Combobox in Modal
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
  const empresaContainerRef = useRef<HTMLDivElement>(null);

  // Filter companies matching the search input safely
  const matchingEmpresas = (empresas || []).filter(emp => {
    const nome = (emp?.nome || '').toLowerCase();
    const nif = String(emp?.nif || '').toLowerCase();
    const q = (empresaQuery || '').toLowerCase();
    return nome.includes(q) || nif.includes(q);
  });

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
    const associatedEmp = (empresas || []).find(e => e.id === cli.empresaId);
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
    try {
      const nomeLimpo = (editingCliente.nome || '').trim();
      if (!nomeLimpo) {
        alert('Por favor informe o nome do cliente / contacto.');
        return;
      }

      let targetEmpresaId = editingCliente.empresaId;
      const cleanEmpresaName = (empresaQuery || '').trim();

      // If no empresaId is selected, but user typed a company name:
      if (!targetEmpresaId && cleanEmpresaName && cleanEmpresaName !== 'Cliente Particular / Sem Empresa') {
        const matched = (empresas || []).find(e => {
          const eNome = (e?.nome || '').trim().toLowerCase();
          const eNif = String(e?.nif || '').trim().toLowerCase();
          const target = cleanEmpresaName.toLowerCase();
          return (eNome && eNome === target) || (eNif && eNif === target);
        });

        if (matched) {
          targetEmpresaId = matched.id;
        } else {
          // Automatically create new Empresa with this name so user is NEVER blocked!
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

      // If still no empresaId and no company name was typed, associate with or create "Cliente Particular / Geral"
      if (!targetEmpresaId) {
        let particularEmp = (empresas || []).find(e => {
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

      const clientToSave: Cliente = {
        id: editingCliente.id && !editingCliente.id.startsWith('cli_new') ? editingCliente.id : db.generateId('cli'),
        nome: nomeLimpo,
        telemovel: (editingCliente.telemovel || '').trim(),
        email: (editingCliente.email || '').trim(),
        cargo: (editingCliente.cargo || '').trim() || 'Responsável',
        empresaId: targetEmpresaId,
        notas: (editingCliente.notas || '').trim()
      };

      const currentList = db.get<Cliente>(STORAGE_KEYS.CLIENTES) || [];
      const existingIndex = currentList.findIndex(c => c.id === clientToSave.id);

      if (existingIndex >= 0) {
        db.update(STORAGE_KEYS.CLIENTES, clientToSave.id, clientToSave);
      } else {
        db.insert(STORAGE_KEYS.CLIENTES, clientToSave);
      }

      // Explicitly notify change so UI updates immediately
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.CLIENTES } }));
      }

      const targetEmpresa = (empresas || []).find(e => e.id === clientToSave.empresaId);
      const isEdit = existingIndex >= 0;

      // Disparo automático de email para o utilizador, hugo@grau-maquinaria.com e pinto@grau-maquinaria.com
      sendNovoContactoEmail({
        cliente: clientToSave,
        empresa: targetEmpresa,
        currentUser,
        isEdit
      })
        .then(res => {
          if (res.success) {
            setFeedbackMessage(`Ficha de "${clientToSave.nome}" gravada e email enviado para: ${res.recipients.join(', ')}`);
          } else {
            setFeedbackMessage(`Ficha de "${clientToSave.nome}" gravada com sucesso!`);
          }
          setTimeout(() => setFeedbackMessage(null), 8000);
        })
        .catch(err => {
          console.warn('[EmailService] Erro ao enviar email de contacto:', err);
        });

      setIsModalOpen(false);
      setFeedbackMessage(`Ficha de "${clientToSave.nome}" gravada! A enviar email de notificação...`);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      console.error('[Erro ao gravar cliente]', err);
      alert('Ocorreu um erro ao gravar a ficha: ' + (err?.message || err));
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar este contacto?')) {
      db.delete(STORAGE_KEYS.CLIENTES, id);
      setIsModalOpen(false);
    }
  };

  const filteredClientes = (clientes || []).filter(c => {
    const emp = (empresas || []).find(e => e.id === c.empresaId);
    const q = (searchTerm || '').toLowerCase();
    const nome = (c?.nome || '').toLowerCase();
    const email = (c?.email || '').toLowerCase();
    const telemovel = String(c?.telemovel || '');
    const empNome = (emp?.nome || '').toLowerCase();
    return nome.includes(q) || email.includes(q) || telemovel.includes(q) || empNome.includes(q);
  });

  return (
    <div className="space-y-3.5">
      {feedbackMessage && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-950/40 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMessage}</span>
        </div>
      )}

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
            const empresa = (empresas || []).find(e => e.id === cli.empresaId);
            const cleanPhone = (cli.telemovel || '').replace(/\s+/g, '');

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
                        {(cli.nome || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-hp-400 transition-colors">
                          {cli.nome || 'Sem Nome'}
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
                    className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-slate-700 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    Ligar
                  </a>

                  <a
                    href={`https://wa.me/351${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-emerald-500/30 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                    WhatsApp
                  </a>

                  <button
                    onClick={e => handleSendContactEmail(cli, e)}
                    disabled={sendingEmailForId === cli.id}
                    title="Enviar dados do contacto por email (para hugo@grau-maquinaria.com, pinto@grau-maquinaria.com e para si)"
                    className="py-1.5 px-2.5 bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 border border-hp-500/30 transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Mail className="w-3.5 h-3.5 text-hp-400" />
                    <span>{sendingEmailForId === cli.id ? 'A enviar...' : 'Email'}</span>
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
                const empresa = (empresas || []).find(e => e.id === cli.empresaId);
                const cleanPhone = (cli.telemovel || '').replace(/\s+/g, '');
                return (
                  <tr
                    key={cli.id}
                    onClick={() => handleEditCliente(cli)}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-hp-500/20 text-hp-400 flex items-center justify-center font-bold text-xs">
                        {(cli.nome || 'C').charAt(0).toUpperCase()}
                      </div>
                      {cli.nome || 'Sem Nome'}
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
                        <button
                          onClick={e => handleSendContactEmail(cli, e)}
                          disabled={sendingEmailForId === cli.id}
                          title="Enviar dados do contacto por email para hugo@grau-maquinaria.com, pinto@grau-maquinaria.com e para si"
                          className="p-1.5 bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Mail className="w-3.5 h-3.5 text-hp-400" />
                        </button>
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
          title={!editingCliente.nome || !clientes.some(c => c.id === editingCliente.id) ? 'Nova Ficha de Cliente' : `Ficha de Cliente: ${editingCliente.nome}`}
          subtitle="Associação à empresa parceira, dados de contacto e notas"
          maxWidth="md"
        >
          <form noValidate onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Completo do Contacto / Cliente *</label>
              <input
                type="text"
                required
                value={editingCliente.nome || ''}
                onChange={e => setEditingCliente(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Eng. António Silva"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
              />
            </div>

            {/* Searchable Empresa Associada Combobox */}
            <div className="relative" ref={empresaContainerRef}>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Empresa Associada <span className="text-[10px] text-hp-400">(Escreva para pesquisar ou criar nova)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escreva o nome ou selecione da lista..."
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
                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCliente(prev => ({ ...prev, empresaId: '' }));
                      setEmpresaQuery('Cliente Particular / Sem Empresa');
                      setIsEmpresaDropdownOpen(false);
                    }}
                    className="w-full text-left p-2.5 bg-slate-900/60 hover:bg-hp-600/20 border-b border-slate-800 text-xs flex items-center justify-between text-hp-300 font-semibold transition-colors"
                  >
                    <span>👤 Cliente Particular / Sem Empresa</span>
                    <span className="text-[10px] text-slate-400 font-normal">Geral</span>
                  </button>

                  {empresaQuery.trim() && !matchingEmpresas.some(e => e.nome.toLowerCase() === empresaQuery.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onClick={() => setIsEmpresaDropdownOpen(false)}
                      className="w-full text-left p-2.5 bg-hp-950/50 hover:bg-hp-600/30 border-b border-slate-800 text-xs text-hp-300 font-bold flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-hp-400" />
                      <span>Associar e criar nova: <strong>"{empresaQuery.trim()}"</strong></span>
                    </button>
                  )}

                  {matchingEmpresas.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Nenhuma empresa encontrada com este nome. Ao guardar, a empresa <strong>"{empresaQuery.trim()}"</strong> será criada automaticamente!
                    </div>
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
                  type="text"
                  inputMode="email"
                  value={editingCliente.email || ''}
                  onChange={e => setEditingCliente(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Ex: a.silva@empresa.pt"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingCliente.id && clientes.some(c => c.id === editingCliente.id) && (
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
                  className="glass-btn py-2.5 px-6 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5 cursor-pointer hover:bg-hp-500 active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Guardar Ficha de Cliente
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
