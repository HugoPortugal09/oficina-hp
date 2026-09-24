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
  Wrench,
  Cloud,
  CloudUpload,
  CloudDownload,
  Mail,
  Send,
  Copy,
  Clock,
  ExternalLink,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { db, STORAGE_KEYS } from '../services/dbService';
import { checkPocketBaseConnection } from '../services/pocketbase';
import { syncPullFromCloud, uploadAllLocalToCloud, syncPushToCloud } from '../services/pocketbaseSync';
import { sendConviteColaboradorEmail } from '../services/emailService';
import type { ConfiguracaoOficina, UserProfile, UserRole, UserInvitation } from '../types';
import { USERS, isAdminEmail, ADMIN_EMAILS } from '../types';

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
    password: '',
    role: 'tecnico',
    avatar: '',
    descricao: ''
  });

  // Invitations State
  const [convites, setConvites] = useState<UserInvitation[]>(() => {
    return db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
  });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteIniciais, setInviteIniciais] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('tecnico');
  const [inviteCargo, setInviteCargo] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [inviteStatusMsg, setInviteStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [teamTab, setTeamTab] = useState<'colaboradores' | 'convites'>('colaboradores');

  useEffect(() => {
    const handleDbChanged = () => {
      const fromDbUsers = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
      setUtilizadores(fromDbUsers && fromDbUsers.length > 0 ? fromDbUsers : USERS);
      setConvites(db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || []);
    };
    window.addEventListener('oficina_hp_db_changed', handleDbChanged);
    return () => window.removeEventListener('oficina_hp_db_changed', handleDbChanged);
  }, []);

  const handleOpenInviteModal = () => {
    setInviteEmail('');
    setInviteIniciais('');
    setInviteRole('tecnico');
    setInviteCargo('');
    setInviteStatusMsg(null);
    setGeneratedInviteLink(null);
    setIsInviteModalOpen(true);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteStatusMsg(null);
    setGeneratedInviteLink(null);

    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanIniciais = inviteIniciais.trim().toUpperCase();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setInviteStatusMsg({ type: 'error', text: 'Por favor insira um endereço de email válido.' });
      return;
    }

    if (!cleanIniciais || cleanIniciais.length < 2 || cleanIniciais.length > 3) {
      setInviteStatusMsg({ type: 'error', text: 'As iniciais na oficina devem ter entre 2 e 3 letras (ex: JS, HP).' });
      return;
    }

    // Check if user already exists
    const existingUser = utilizadores.find(u => u.email && u.email.toLowerCase() === cleanEmail);
    if (existingUser) {
      setInviteStatusMsg({ type: 'error', text: `Já existe um utilizador registado com este email (${existingUser.nome}).` });
      return;
    }

    setIsSendingInvite(true);

  const getAppBaseUrl = () => {
    let base = (config.appPublicUrl || '').trim().replace(/\/+$/, '');
    if (!base && typeof window !== 'undefined' && window.location.origin) {
      base = window.location.origin;
    }
    return base || 'https://oficina-hp.up.railway.app';
  };

  const buildConviteUrl = (token: string) => {
    return `${getAppBaseUrl()}/?convite=${token}`;
  };

  const getWhatsAppShareUrl = (conviteUrl: string, email: string = '') => {
    const emailInfo = email ? ` (${email})` : '';
    const text = `Olá! Segue o convite de acesso à equipa da Oficina HP${emailInfo}:\n${conviteUrl}\n\nClica no link para definires o teu nome e a tua palavra-passe.`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

    try {
      const token = db.generateId('inv');
      const conviteUrl = buildConviteUrl(token);

      const newInvite: UserInvitation = {
        id: token,
        email: cleanEmail,
        iniciais: cleanIniciais,
        role: inviteRole,
        token: token,
        criadoEm: new Date().toISOString(),
        criadoPor: 'Hugo Portugal (Administrador)',
        status: 'pendente',
        cargo: inviteCargo.trim() || undefined
      };

      const currentConvites = db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
      // If there was an older pending invite for this email, replace it
      const filtered = currentConvites.filter(c => c.email.toLowerCase() !== cleanEmail || c.status === 'aceite');
      const updatedConvites = [newInvite, ...filtered];

      db.save(STORAGE_KEYS.CONVITES, updatedConvites);
      setConvites(updatedConvites);

      // Immediate synchronization to PocketBase Cloud so invite is immediately resolvable across any device
      await Promise.allSettled([
        syncPushToCloud(STORAGE_KEYS.CONVITES, updatedConvites, { immediate: true }),
        syncPushToCloud(`convite_${token}`, newInvite, { immediate: true })
      ]);

      // Send email via backend service
      const emailResult = await sendConviteColaboradorEmail({
        email: cleanEmail,
        iniciais: cleanIniciais,
        role: inviteRole,
        conviteUrl: conviteUrl,
        adminNome: 'Hugo Portugal'
      });

      setGeneratedInviteLink(conviteUrl);

      if (emailResult.success) {
        setInviteStatusMsg({
          type: 'success',
          text: `Convite enviado com sucesso para ${cleanEmail}! O colaborador receberá o link por email e também pode partilhar diretamente por WhatsApp.`
        });
      } else {
        setInviteStatusMsg({
          type: 'error',
          text: `Convite registado e ativo! Houve falha no envio do email (${emailResult.message}), mas o link abaixo está pronto a ser enviado diretamente por WhatsApp.`
        });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.CONVITES } }));
      }
    } catch (err: any) {
      setInviteStatusMsg({ type: 'error', text: err?.message || 'Erro ao gerar convite.' });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleResendInvite = async (convite: UserInvitation) => {
    const conviteUrl = buildConviteUrl(convite.token);

    const res = await sendConviteColaboradorEmail({
      email: convite.email,
      iniciais: convite.iniciais,
      role: convite.role,
      conviteUrl: conviteUrl,
      adminNome: 'Hugo Portugal'
    });

    if (res.success) {
      alert(`Convite reenviado com sucesso para ${convite.email}!`);
    } else {
      alert(`Falha ao reenviar email: ${res.message}. Pode copiar o link manualmente ou enviar por WhatsApp: ${conviteUrl}`);
    }
  };

  const handleCancelInvite = (conviteId: string) => {
    if (!confirm('Deseja realmente cancelar este convite?')) return;
    const current = db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
    const target = current.find(c => c.id === conviteId || c.token === conviteId);
    const updated = current.filter(c => c.id !== conviteId && c.token !== conviteId);
    db.save(STORAGE_KEYS.CONVITES, updated);
    setConvites(updated);
    syncPushToCloud(STORAGE_KEYS.CONVITES, updated, { immediate: true }).catch(() => {});
    if (target?.token) {
      syncPushToCloud(`convite_${target.token}`, { ...target, status: 'cancelado' }, { immediate: true }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.CONVITES } }));
    }
  };

  const handleCopyLink = (token: string) => {
    const link = buildConviteUrl(token);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      alert('Link do convite copiado para a área de transferência!');
    } else {
      prompt('Copie o link do convite abaixo:', link);
    }
  };

  const handleCreateNewUser = () => {
    setEditingUser({
      id: db.generateId('usr'),
      nome: '',
      email: '',
      password: '123',
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
    const isTargetAdmin = (editingUser.role === 'administrador') || isAdminEmail(editingUser.email);
    const finalRole: UserRole = isTargetAdmin ? 'administrador' : ((editingUser.role as UserRole) || 'tecnico');
    const avatar = editingUser.avatar?.trim() || editingUser.nome.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    
    const finalUser: UserProfile = {
      id: editingUser.id || db.generateId('usr'),
      nome: editingUser.nome.trim(),
      email: editingUser.email?.trim() || '',
      password: editingUser.password?.trim() || (isTargetAdmin ? 'admin' : '123'),
      role: finalRole,
      avatar: avatar,
      descricao: editingUser.descricao?.trim() || (
        finalRole === 'administrador'
          ? 'Administrador com acesso total e configurações'
          : finalRole === 'gestor'
          ? 'Gestor de Operações com foco em tarefas e consulta'
          : 'Técnico de Manutenção e Oficina'
      ),
      ativo: editingUser.ativo !== undefined ? editingUser.ativo : true
    };

    const currentList = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
    const existingIndex = currentList.findIndex(u => u.id === finalUser.id || (u.email && u.email.toLowerCase() === finalUser.email.toLowerCase()));
    let updated: UserProfile[];
    if (existingIndex >= 0) {
      updated = [...currentList];
      updated[existingIndex] = finalUser;
    } else {
      updated = [...currentList, finalUser];
    }

    db.save(STORAGE_KEYS.UTILIZADORES, updated);
    setUtilizadores(updated);
    syncPushToCloud(STORAGE_KEYS.UTILIZADORES, updated).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.UTILIZADORES } }));
    }
    setIsUserModalOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const currentList = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
    const targetUser = currentList.find(u => u.id === userId);

    if (targetUser && (isAdminEmail(targetUser.email) || targetUser.role === 'administrador')) {
      alert('Não é possível eliminar um Administrador designado do sistema.');
      return;
    }

    if (confirm(`Tem a certeza que deseja eliminar o colaborador ${targetUser?.nome || ''}?`)) {
      const updated = currentList.filter(u => u.id !== userId);
      db.save(STORAGE_KEYS.UTILIZADORES, updated);
      setUtilizadores(updated);
      syncPushToCloud(STORAGE_KEYS.UTILIZADORES, updated).catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.UTILIZADORES } }));
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveConfig(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  const handleTestPocketBase = async () => {
    setPbTesting(true);
    setPbResult(null);
    const sanitizedUrl = (config.pocketbaseUrl || '').trim().replace(/\/+$/, '');
    const res = await checkPocketBaseConnection(sanitizedUrl);
    setPbResult(res);
    setPbTesting(false);
  };

  const handleSyncPullFromCloud = async () => {
    setIsCloudSyncing(true);
    setSyncStatusMsg('A descarregar dados mais recentes do PocketBase...');
    const ok = await syncPullFromCloud();
    if (ok) {
      setSyncStatusMsg('Base de dados sincronizada com o PocketBase com sucesso!');
    } else {
      setSyncStatusMsg('Não foi possível sincronizar com o PocketBase. Verifique se a coleção "app_data" existe no PocketBase com regras públicas.');
    }
    setIsCloudSyncing(false);
    setTimeout(() => setSyncStatusMsg(null), 5000);
  };

  const handleUploadAllToCloud = async () => {
    if (!confirm('Deseja enviar toda a sua base de dados atual para o PocketBase? Isto irá atualizar o servidor com os seus dados atuais.')) return;
    setIsCloudSyncing(true);
    setSyncStatusMsg('A carregar todos os registos para o PocketBase...');
    const res = await uploadAllLocalToCloud();
    if (res.success) {
      setSyncStatusMsg(`Sucesso! ${res.count} tabelas/módulos enviados para o PocketBase.`);
    } else {
      setSyncStatusMsg(`Erro ao enviar: ${res.error}`);
    }
    setIsCloudSyncing(false);
    setTimeout(() => setSyncStatusMsg(null), 6000);
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

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                <span>URL Público / IP da Aplicação (Partilha de Links & WhatsApp)</span>
                <span className="text-[10px] text-slate-500 font-normal">Opcional</span>
              </label>
              <input
                type="text"
                placeholder={typeof window !== 'undefined' ? window.location.origin : 'ex: http://192.168.1.100:3000 ou https://oficinahp.pt'}
                value={config.appPublicUrl || ''}
                onChange={e => setConfig(prev => ({ ...prev, appPublicUrl: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-hp-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Endereço base utilizado para gerar convites e links partilhados via WhatsApp. Se não preencher, utiliza automaticamente o endereço atual do navegador ({typeof window !== 'undefined' ? window.location.origin : ''}).
              </span>
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

              {/* Cloud Synchronization Actions */}
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-hp-400" /> Sincronização entre Dispositivos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSyncPullFromCloud}
                    disabled={isCloudSyncing}
                    className="py-2 px-2.5 bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border border-hp-500/30 transition-all disabled:opacity-50"
                  >
                    <CloudDownload className="w-3.5 h-3.5" />
                    Sincronizar Agora
                  </button>

                  <button
                    type="button"
                    onClick={handleUploadAllToCloud}
                    disabled={isCloudSyncing}
                    className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 border border-slate-700 transition-all disabled:opacity-50"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    Enviar Tudo p/ Nuvem
                  </button>
                </div>

                {syncStatusMsg && (
                  <p className="text-[10px] p-2 rounded-lg bg-hp-500/10 border border-hp-500/30 text-hp-300 font-medium animate-in fade-in">
                    {syncStatusMsg}
                  </p>
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

          {/* Email Automático & Planeamento Semanal */}
          <GlassCard>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
              <Mail className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Email Automático & Planeamento</h3>
                <p className="text-[11px] text-slate-400">Envio automático do mapa semanal às Segundas às 07:30</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email Emissor (Gmail / SMTP)</label>
                <input
                  type="email"
                  value={config.emailEmissor || 'oficinahpapp@gmail.com'}
                  onChange={e => setConfig(prev => ({ ...prev, emailEmissor: e.target.value }))}
                  placeholder="oficinahpapp@gmail.com"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Destinatário do Planeamento</label>
                <input
                  type="email"
                  value={config.emailDestinatarioPlaneamento || 'hugo@grau-maquinaria.com'}
                  onChange={e => setConfig(prev => ({ ...prev, emailDestinatarioPlaneamento: e.target.value }))}
                  placeholder="hugo@grau-maquinaria.com"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-300">Automação Ativa (Segundas às 07:30)</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                  Ativo
                </span>
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

      {/* Team Management & Invitations Card */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-hp-400" />
            <div>
              <h3 className="text-base font-bold text-white">Equipa & Controlo de Acessos</h3>
              <p className="text-xs text-slate-400">
                Convites de novos colaboradores por email, credenciais e níveis de permissão
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleOpenInviteModal}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-hp-600 to-sky-600 hover:from-hp-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-hp-600/25 transition-all cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              Convidar Colaborador
            </button>

            <button
              type="button"
              onClick={handleCreateNewUser}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Manual
            </button>
          </div>
        </div>

        {/* Navigation Tabs between Active Users and Pending Invites */}
        <div className="flex items-center gap-2 pt-3 border-b border-slate-800/80">
          <button
            type="button"
            onClick={() => setTeamTab('colaboradores')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              teamTab === 'colaboradores'
                ? 'text-hp-400 border-b-2 border-hp-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Colaboradores Ativos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 font-mono text-slate-300">
              {utilizadores.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setTeamTab('convites')}
            className={`pb-2.5 px-3 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
              teamTab === 'convites'
                ? 'text-hp-400 border-b-2 border-hp-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Convites Enviados</span>
            {convites.filter(c => c.status === 'pendente').length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold animate-pulse">
                {convites.filter(c => c.status === 'pendente').length}
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Active Collaborators List */}
        {teamTab === 'colaboradores' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            {utilizadores.map(u => {
              const isUserAdmin = u.role === 'administrador' || isAdminEmail(u.email);
              return (
                <div
                  key={u.id}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 transition-all flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                      isUserAdmin
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : u.role === 'gestor'
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {u.avatar || u.nome.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white truncate">{u.nome}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                          isUserAdmin
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : u.role === 'gestor'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          {isUserAdmin ? 'Administrador' : u.role === 'gestor' ? 'Gestor' : 'Técnico'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                        {u.email || 'Sem email associado'}
                      </div>

                      <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                        {u.descricao || (isUserAdmin ? 'Acesso total' : u.role === 'gestor' ? 'Gestão operacional' : 'Técnico de oficina')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditUser(u)}
                      title="Editar colaborador"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    {!isUserAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        title="Eliminar colaborador"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Pending Invitations List */}
        {teamTab === 'convites' && (
          <div className="pt-4 space-y-3">
            {convites.length === 0 ? (
              <div className="py-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800/60 p-6">
                <Mail className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <h4 className="text-xs font-bold text-slate-300">Nenhum convite enviado até ao momento</h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Envie um convite para o email do novo colaborador com as iniciais definidas para que ele possa escolher a sua própria palavra-passe.
                </p>
                <button
                  type="button"
                  onClick={handleOpenInviteModal}
                  className="px-4 py-2 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Enviar Primeiro Convite
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {convites.map(c => {
                  const isAccepted = c.status === 'aceite';
                  const isCanceled = c.status === 'cancelado';
                  return (
                    <div
                      key={c.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                        isAccepted
                          ? 'bg-slate-950/40 border-slate-800/50 opacity-70'
                          : isCanceled
                          ? 'bg-rose-950/10 border-rose-900/30 opacity-60'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-hp-500/20 text-hp-300 border border-hp-500/30 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            {c.iniciais}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white font-mono truncate">{c.email}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                                c.role === 'administrador'
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                  : c.role === 'gestor'
                                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}>
                                {c.role === 'administrador' ? '👑 Admin' : c.role === 'gestor' ? '💼 Gestor' : '🔧 Técnico'}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {new Date(c.criadoEm).toLocaleDateString('pt-PT')}
                              </span>
                              {c.cargo && <span>&bull; {c.cargo}</span>}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAccepted ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Aceite
                            </span>
                          ) : isCanceled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              Cancelado
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ⏳ Aguarda Registo
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons for pending invite */}
                      {!isAccepted && !isCanceled && (
                        <div className="pt-2 border-t border-slate-800/70 flex items-center justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(c.token)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Copiar link de ativação para enviar por WhatsApp"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copiar Link</span>
                          </button>

                          <a
                            href={getWhatsAppShareUrl(buildConviteUrl(c.token), c.email)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Partilhar diretamente no WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleResendInvite(c)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-sky-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Reenviar email de convite"
                          >
                            <Send className="w-3 h-3" />
                            <span>Reenviar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCancelInvite(c.id)}
                            className="px-2 py-1 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Cancelar convite"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Permissions Summary Note */}
        <div className="mt-4 p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
          <div className="font-bold text-slate-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-hp-400" />
            Níveis de Acesso & Permissões:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[10px]">
            <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-purple-400 block">👑 Administrador</span>
              <span>Acesso irrestrito a configurações, automações, propostas e controlo da equipa.</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-sky-400 block">💼 Gestor</span>
              <span>Acesso ao planeamento, visitas, tarefas e orçamentos. Sem acesso a configurações.</span>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="font-bold text-amber-400 block">🔧 Técnico</span>
              <span>Operacional de oficina e exterior, folhas e peças. Sem acesso a orçamentos ou preços.</span>
            </div>
          </div>
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
                <label className="text-xs font-semibold text-slate-400 block mb-1">Palavra-passe de Acesso *</label>
                <input
                  type="text"
                  placeholder="ex: password123"
                  value={editingUser.password || ''}
                  onChange={e => setEditingUser(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500 font-mono"
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

              {isAdminEmail(editingUser.email) && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>Este endereço de email é um <strong>Administrador Oficial</strong> designado do sistema e terá sempre permissões completas de Administração.</span>
                </div>
              )}
            </div>

            {/* Account Active Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editingUser.ativo !== false}
                  onChange={e => setEditingUser(prev => ({ ...prev, ativo: e.target.checked }))}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-hp-600 focus:ring-0 cursor-pointer"
                />
                <span className="font-semibold">Conta Ativa (pode aceder ao sistema)</span>
              </label>
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

      {/* Invite Collaborator Modal */}
      {isInviteModalOpen && (
        <Modal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          title="Convidar Colaborador para a Equipa"
          subtitle="O Administrador define o email, as iniciais e o nível de acesso. O colaborador recebe um email com link para definir a sua palavra-passe."
          maxWidth="2xl"
        >
          <form onSubmit={handleSendInvite} className="space-y-4">
            {inviteStatusMsg && (
              <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                inviteStatusMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {inviteStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <div className="space-y-1">
                  <span className="leading-relaxed block">{inviteStatusMsg.text}</span>
                  {generatedInviteLink && (
                    <div className="mt-2.5 pt-2.5 border-t border-emerald-500/20 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950/80 p-2 rounded-xl border border-emerald-500/30">
                        <span className="font-mono text-[10px] text-emerald-300 truncate max-w-sm select-all">
                          {generatedInviteLink}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (navigator.clipboard) {
                                navigator.clipboard.writeText(generatedInviteLink);
                                alert('Link copiado para a área de transferência!');
                              } else {
                                prompt('Copie o link abaixo:', generatedInviteLink);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Copiar
                          </button>
                          <a
                            href={getWhatsAppShareUrl(generatedInviteLink, inviteEmail)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Enviar por WhatsApp
                          </a>
                        </div>
                      </div>

                      {(generatedInviteLink.includes('localhost') || generatedInviteLink.includes('127.0.0.1')) && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300/90 leading-tight">
                          💡 <strong>Dica</strong>: Este link utiliza <code>localhost</code>. Se o novo colaborador for abrir o convite no telemóvel, configure o IP da rede ou o URL público nas <strong>Definições da Oficina</strong>.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email do Colaborador *
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="ex: colab@oficinahp.pt ou gmail..."
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1 flex items-center justify-between">
                  <span>Iniciais na Oficina (2 a 3 Letras) *</span>
                  <span className="text-[10px] text-hp-400 font-normal">Usadas nas Folhas e Tarefas</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  placeholder="ex: JS, HP, MP..."
                  value={inviteIniciais}
                  onChange={e => setInviteIniciais(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-black uppercase tracking-wider focus:outline-none focus:border-hp-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Função / Especialidade (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="ex: Mecânico Geral, Eletricista, Apoio Técnico..."
                  value={inviteCargo}
                  onChange={e => setInviteCargo(e.target.value)}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="text-xs font-bold text-white block mb-2">
                Nível de Permissão na Aplicação *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Administrador */}
                <button
                  type="button"
                  onClick={() => setInviteRole('administrador')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    inviteRole === 'administrador'
                      ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-base">👑</span>
                    <Badge variant="info">Acesso Total</Badge>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">Administrador</h5>
                    <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                      Acesso total a todas as áreas, finanças, utilizadores e configurações.
                    </p>
                  </div>
                </button>

                {/* Gestor */}
                <button
                  type="button"
                  onClick={() => setInviteRole('gestor')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    inviteRole === 'gestor'
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
                      Planeamento semanal, tarefas, orçamentos e visitas. Sem acesso a configurações.
                    </p>
                  </div>
                </button>

                {/* Técnico */}
                <button
                  type="button"
                  onClick={() => setInviteRole('tecnico')}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    inviteRole === 'tecnico'
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
                      Operacional de oficina e exterior, tarefas e peças. Sem acesso a orçamentos ou preços.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                {generatedInviteLink ? 'Concluir' : 'Cancelar'}
              </button>

              <button
                type="submit"
                disabled={isSendingInvite}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-hp-600 to-sky-600 hover:from-hp-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-hp-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSendingInvite ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>A Enviar Convite...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar Convite por Email</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
