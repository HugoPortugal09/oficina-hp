import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Building2,
  Database,
  Cpu,
  Download,
  Upload,
  RotateCcw,
  Check,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon,
  Users,
  UserPlus,
  Trash2,
  Edit,
  Shield,
  Briefcase,
  Wrench
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { db, STORAGE_KEYS } from '../services/dbService';
import { checkPocketBaseConnection } from '../services/pocketbase';
import type { ConfiguracaoOficina, UserProfile, UserRole } from '../types';
import { USERS } from '../types';

interface ConfiguracoesProps {
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const Configuracoes: React.FC<ConfiguracoesProps> = ({
  theme = 'dark',
  onToggleTheme
}) => {
  const [config, setConfig] = useState<ConfiguracaoOficina>(db.getConfig());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [pbTesting, setPbTesting] = useState(false);
  const [pbResult, setPbResult] = useState<{ connected: boolean; message: string } | null>(null);

  const [ollamaTesting, setOllamaTesting] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<{ connected: boolean; message: string } | null>(null);

  // User Management State
  const [utilizadores, setUtilizadores] = useState<UserProfile[]>(() => {
    const fromDb = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    return fromDb && fromDb.length > 0 ? fromDb : USERS;
  });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<UserProfile>>({
    id: '',
    nome: '',
    email: '',
    role: 'tecnico',
    avatar: '',
    descricao: ''
  });

  const handleCreateNewUser = () => {
    setEditingUser({
      id: db.generateId('usr'),
      nome: '',
      email: '',
      role: 'tecnico',
      avatar: '',
      descricao: ''
    });
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser({ ...user });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = () => {
    if (!editingUser.nome?.trim()) {
      alert('Por favor insira o nome do utilizador.');
      return;
    }
    const avatar = editingUser.avatar?.trim() || editingUser.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const finalUser: UserProfile = {
      id: editingUser.id || db.generateId('usr'),
      nome: editingUser.nome.trim(),
      email: editingUser.email?.trim() || '',
      role: (editingUser.role as UserRole) || 'tecnico',
      avatar: avatar,
      descricao: editingUser.descricao?.trim() || (
        editingUser.role === 'administrador'
          ? 'Administrador com acesso total e configurações'
          : editingUser.role === 'gestor'
          ? 'Gestor de Operações com foco em tarefas e consulta'
          : 'Técnico de Manutenção e Oficina'
      )
    };

    const currentList = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
    const existingIndex = currentList.findIndex(u => u.id === finalUser.id);
    let updated: UserProfile[];
    if (existingIndex >= 0) {
      updated = [...currentList];
      updated[existingIndex] = finalUser;
    } else {
      updated = [...currentList, finalUser];
    }
    db.save(STORAGE_KEYS.UTILIZADORES, updated);
    setUtilizadores(updated);
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === 'usr_admin') {
      alert('Não é possível eliminar o utilizador Administrador principal.');
      return;
    }
    if (confirm('Tem a certeza que deseja eliminar este utilizador?')) {
      const currentList = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
      const updated = currentList.filter(u => u.id !== userId);
      db.save(STORAGE_KEYS.UTILIZADORES, updated);
      setUtilizadores(updated);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestPocketBase = async () => {
    setPbTesting(true);
    setPbResult(null);
    const sanitizedUrl = (config.pocketbaseUrl || '').trim().replace(/\/+$/, '');
    const res = await checkPocketBaseConnection(sanitizedUrl);
    setPbResult(res);
    setPbTesting(false);
  };

  const handleTestOllama = async () => {
    setOllamaTesting(true);
    setOllamaResult(null);
    const sanitizedUrl = (config.ollamaUrl || '').trim().replace(/\/+$/, '');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${sanitizedUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name).join(', ');
        setOllamaResult({
          connected: true,
          message: `Ollama conectado com sucesso! Modelos ativos: ${models || 'Nenhum modelo descarregado'}`
        });
      } else {
        setOllamaResult({ connected: false, message: `Ollama HTTP ${res.status}` });
      }
    } catch (err: any) {
      setOllamaResult({
        connected: false,
        message: 'Servidor Ollama não alcançável via CORS. Certifique-se de que definiu OLLAMA_ORIGINS=* no Easypanel.'
      });
    } finally {
      setOllamaTesting(false);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = db.exportDatabase();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_oficina_hp_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const ok = db.importDatabase(content);
        if (ok) {
          alert('Cópia de segurança importada com sucesso! A recarregar dados...');
          window.location.reload();
        } else {
          alert('Ficheiro JSON inválido ou corrompido.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleResetSeed = () => {
    if (confirm('Tem a certeza que deseja repor os dados de demonstração iniciais da Oficina HP?')) {
      localStorage.clear();
      db.initSeed();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Theme / Appearance Card */}
      {onToggleTheme && (
        <GlassCard>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-hp-400" />
              ) : (
                <Sun className="w-5 h-5 text-amber-400" />
              )}
              <div>
                <h3 className="text-base font-bold text-white">Aparência & Modo de Visualização</h3>
                <p className="text-xs text-slate-400">Escolha o tema que melhor se adapta ao seu ambiente de trabalho ou telemóvel</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  if (theme !== 'light') onToggleTheme();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  theme === 'light'
                    ? 'bg-hp-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                Modo Claro
              </button>

              <button
                type="button"
                onClick={() => {
                  if (theme !== 'dark') onToggleTheme();
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  theme === 'dark'
                    ? 'bg-hp-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                Modo Escuro
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Workshop Profile */}
        <GlassCard>
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
            <Building2 className="w-5 h-5 text-hp-400" />
            <div>
              <h3 className="text-base font-bold text-white">Dados da Oficina & Faturação</h3>
              <p className="text-xs text-slate-400">Informação fiscal e contactos impressos nos cabeçalhos dos PDFs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Comercial da Oficina</label>
              <input
                type="text"
                value={config.nome}
                onChange={e => setConfig(prev => ({ ...prev, nome: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">NIF / NIPC</label>
              <input
                type="text"
                value={config.nif}
                onChange={e => setConfig(prev => ({ ...prev, nif: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-400 block mb-1">Morada da Oficina</label>
              <input
                type="text"
                value={config.morada}
                onChange={e => setConfig(prev => ({ ...prev, morada: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Código Postal & Localidade</label>
              <input
                type="text"
                value={`${config.codigoPostal} - ${config.localidade}`}
                onChange={e => {
                  const parts = e.target.value.split('-');
                  setConfig(prev => ({
                    ...prev,
                    codigoPostal: parts[0]?.trim() || '',
                    localidade: parts.slice(1).join('-').trim()
                  }));
                }}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Telefone Principal</label>
              <input
                type="text"
                value={config.telefone}
                onChange={e => setConfig(prev => ({ ...prev, telefone: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Email Geral</label>
              <input
                type="email"
                value={config.email}
                onChange={e => setConfig(prev => ({ ...prev, email: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">IBAN para Pagamento</label>
              <input
                type="text"
                value={config.iban}
                onChange={e => setConfig(prev => ({ ...prev, iban: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Valor Padrão da Mão-de-Obra (€ / Hora)</label>
              <input
                type="number"
                step="0.5"
                value={config.valorHoraPadrao}
                onChange={e => setConfig(prev => ({ ...prev, valorHoraPadrao: Number(e.target.value) }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Taxa IVA Padrão (%)</label>
              <input
                type="number"
                value={config.ivaPadrao}
                onChange={e => setConfig(prev => ({ ...prev, ivaPadrao: Number(e.target.value) }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
              />
            </div>
          </div>
        </GlassCard>

        {/* Server & AI Integrations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PocketBase */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <Database className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Servidor PocketBase</h3>
                <p className="text-[11px] text-slate-400">Base de dados e sincronização em tempo real</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">URL do Servidor PocketBase</label>
                <input
                  type="text"
                  value={config.pocketbaseUrl}
                  onChange={e => setConfig(prev => ({ ...prev, pocketbaseUrl: e.target.value }))}
                  placeholder="http://127.0.0.1:8090"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestPocketBase}
                  disabled={pbTesting}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${pbTesting ? 'animate-spin' : ''}`} />
                  Testar Conexão
                </button>

                {pbResult && (
                  <span className={`text-[11px] font-mono flex items-center gap-1 ${pbResult.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {pbResult.connected ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {pbResult.connected ? 'Online' : 'Offline / Local'}
                  </span>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Ollama AI Vision */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <Cpu className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Servidor IA Ollama</h3>
                <p className="text-[11px] text-slate-400">Reconhecimento de imagem com llama3.2-vision</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">URL do Servidor Ollama</label>
                <input
                  type="text"
                  value={config.ollamaUrl}
                  onChange={e => setConfig(prev => ({ ...prev, ollamaUrl: e.target.value }))}
                  placeholder="http://127.0.0.1:11434"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Modelo de Visão</label>
                <input
                  type="text"
                  value={config.ollamaModel}
                  onChange={e => setConfig(prev => ({ ...prev, ollamaModel: e.target.value }))}
                  placeholder="llama3.2-vision"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleTestOllama}
                  disabled={ollamaTesting}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ollamaTesting ? 'animate-spin' : ''}`} />
                  Testar Ollama
                </button>

                {ollamaResult && (
                  <span className={`text-[11px] font-mono flex items-center gap-1 ${ollamaResult.connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {ollamaResult.connected ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {ollamaResult.connected ? 'Disponível' : 'Modo Heurístico'}
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="w-4 h-4" />
                Configurações guardadas com sucesso!
              </span>
            )}
          </div>

          <button
            type="submit"
            className="glass-btn py-2.5 px-6 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar Todas as Configurações
          </button>
        </div>
      </form>

      {/* User Accounts & Roles Management */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-base font-bold text-white">Gestão de Utilizadores & Perfis de Acesso</h3>
              <p className="text-xs text-slate-400">
                O Administrador pode criar e gerir novos utilizadores, definindo o tipo de utilizador (Administrador, Gestor, Técnico)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateNewUser}
            className="glass-btn py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-purple-600/30 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            Novo Utilizador
          </button>
        </div>

        {/* Users List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {utilizadores.map(u => {
            return (
              <div
                key={u.id}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-md ${
                        u.role === 'administrador'
                          ? 'bg-purple-600'
                          : u.role === 'gestor'
                          ? 'bg-sky-600'
                          : 'bg-amber-600'
                      }`}>
                        {u.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{u.nome}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">{u.email || 'Sem email'}</span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                      u.role === 'administrador'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : u.role === 'gestor'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {u.role === 'administrador' ? '👑 Admin' : u.role === 'gestor' ? '💼 Gestor' : '🔧 Técnico'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 mt-2.5 line-clamp-2 leading-relaxed bg-slate-900/60 p-2 rounded-xl border border-slate-800/60">
                    {u.descricao || (
                      u.role === 'administrador'
                        ? 'Acesso total a todas as áreas e configurações.'
                        : u.role === 'gestor'
                        ? 'Acesso de consulta + tarefas em serviços (sem alteração de peças ou preços).'
                        : 'Operacional da oficina e serviços (sem orçamentos e sem preços).'
                    )}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleEditUser(u)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  {u.id !== 'usr_admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* Backup & Data Management */}
      <GlassCard>
        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
          <Database className="w-5 h-5 text-emerald-400" />
          <div>
            <h3 className="text-base font-bold text-white">Gestão e Cópia de Segurança da Base de Dados</h3>
            <p className="text-xs text-slate-400">Exportação completa para arquivo JSON, restauro e reposição de dados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={handleExportJSON}
            className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-hp-500/40 text-left transition-all group"
          >
            <Download className="w-6 h-6 text-hp-400 mb-2 group-hover:translate-y-0.5 transition-transform" />
            <h4 className="text-xs font-bold text-white">Exportar Cópia (JSON)</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Descarregar todos os registos para backup local seguro.</p>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/40 text-left transition-all group"
          >
            <Upload className="w-6 h-6 text-indigo-400 mb-2 group-hover:-translate-y-0.5 transition-transform" />
            <h4 className="text-xs font-bold text-white">Importar Backup (JSON)</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Restaurar dados a partir de um ficheiro JSON exportado anteriormente.</p>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJSON}
          />

          <button
            type="button"
            onClick={handleResetSeed}
            className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/40 text-left transition-all group"
          >
            <RotateCcw className="w-6 h-6 text-rose-400 mb-2 group-hover:rotate-45 transition-transform" />
            <h4 className="text-xs font-bold text-white">Repor Demonstração</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Recarregar os registos de demonstração da Oficina HP.</p>
          </button>
        </div>
      </GlassCard>

      {/* Create / Edit User Modal */}
      {isUserModalOpen && (
        <Modal
          isOpen={isUserModalOpen}
          onClose={() => setIsUserModalOpen(false)}
          title={editingUser.id ? `Utilizador: ${editingUser.nome || 'Novo'}` : 'Novo Utilizador'}
          subtitle="O Administrador define os dados e o tipo de perfil/permissões do utilizador"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  placeholder="ex: Hugo Portugal, João Silva..."
                  value={editingUser.nome || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const autoAvatar = val.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                    setEditingUser(prev => ({
                      ...prev,
                      nome: val,
                      avatar: prev.avatar && prev.avatar !== autoAvatar ? prev.avatar : autoAvatar
                    }));
                  }}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email</label>
                <input
                  type="email"
                  placeholder="ex: utilizador@oficinahp.pt"
                  value={editingUser.email || ''}
                  onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Iniciais / Avatar (2 Letras)</label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="ex: HP, JS..."
                  value={editingUser.avatar || ''}
                  onChange={e => setEditingUser(prev => ({ ...prev, avatar: e.target.value.toUpperCase() }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold uppercase focus:outline-none focus:border-hp-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Descrição / Cargo</label>
                <input
                  type="text"
                  placeholder="ex: Mecânico Sénior, Assistente Operacional..."
                  value={editingUser.descricao || ''}
                  onChange={e => setEditingUser(prev => ({ ...prev, descricao: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                />
              </div>
            </div>

            {/* Role / Tipo de Utilizador Selection */}
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Tipo de Utilizador (Escolha do Administrador) *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Administrador */}
                <button
                  type="button"
                  onClick={() => setEditingUser(prev => ({ ...prev, role: 'administrador' }))}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    editingUser.role === 'administrador'
                      ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">👑</span>
                    <Badge variant="info">Total</Badge>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Administrador</h5>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Acesso total irrestrito a todas as funcionalidades e menu <strong>Configurações & IA</strong>.
                    </p>
                  </div>
                </button>

                {/* Gestor */}
                <button
                  type="button"
                  onClick={() => setEditingUser(prev => ({ ...prev, role: 'gestor' }))}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    editingUser.role === 'gestor'
                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">💼</span>
                    <Badge variant="primary">Gestão</Badge>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Gestor</h5>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Consulta geral. Apenas cria/edita <strong>Tarefas</strong>. Sem alteração de peças e sem visualização de preços.
                    </p>
                  </div>
                </button>

                {/* Técnico */}
                <button
                  type="button"
                  onClick={() => setEditingUser(prev => ({ ...prev, role: 'tecnico' }))}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    editingUser.role === 'tecnico'
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">🔧</span>
                    <Badge variant="warning">Oficina</Badge>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Técnico</h5>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Operacional de oficina e serviços. <strong>Sem acesso aos orçamentos</strong> e sem preços de peças.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                className="glass-btn px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Guardar Utilizador
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
