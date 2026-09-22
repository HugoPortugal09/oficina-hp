import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, Eye, EyeOff, UserCheck, CheckCircle2, AlertCircle, Wrench, Sparkles } from 'lucide-react';
import type { UserInvitation, UserProfile, UserRole } from '../types';
import { db, STORAGE_KEYS } from '../services/dbService';
import { syncPushToCloud, syncPullFromCloud } from '../services/pocketbaseSync';

interface RegistoConviteModalProps {
  token: string;
  onClose: () => void;
  onRegisterSuccess: (user: UserProfile) => void;
}

export const RegistoConviteModal: React.FC<RegistoConviteModalProps> = ({
  token,
  onClose,
  onRegisterSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<UserInvitation | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const findInvite = async () => {
      setLoading(true);
      // 1. Try local storage first
      let convites = db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
      let found = convites.find(c => c.token === token || c.id === token);

      // 2. If not found, attempt a cloud pull (in case invite was created on another machine)
      if (!found) {
        try {
          await syncPullFromCloud();
          convites = db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
          found = convites.find(c => c.token === token || c.id === token);
        } catch (e) {
          console.warn('[RegistoConvite] Erro ao sincronizar convites da nuvem:', e);
        }
      }

      setLoading(false);

      if (!found) {
        setStatusMessage('Convite não encontrado ou link inválido. Solicite um novo convite ao Administrador.');
        return;
      }

      if (found.status === 'aceite') {
        setStatusMessage('Este convite já foi utilizado e a conta já se encontra ativa. Por favor inicie sessão com as suas credenciais.');
        return;
      }

      if (found.status === 'cancelado') {
        setStatusMessage('Este convite foi revogado ou cancelado pelo Administrador da oficina.');
        return;
      }

      setInvitation(found);
    };

    findInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!invitation) return;

    if (!nome.trim() || nome.trim().length < 3) {
      setError('Por favor insira o seu nome completo (mínimo 3 caracteres).');
      return;
    }

    if (!password || password.length < 3) {
      setError('Por favor defina uma palavra-passe com pelo menos 3 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('A confirmação da palavra-passe não coincide.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create the new user profile
      const cleanEmail = invitation.email.trim().toLowerCase();
      const currentUsers = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || [];
      
      const newUser: UserProfile = {
        id: db.generateId('usr'),
        nome: nome.trim(),
        email: cleanEmail,
        password: password,
        role: invitation.role,
        avatar: (invitation.iniciais || nome.substring(0, 2)).toUpperCase(),
        descricao: invitation.cargo || (
          invitation.role === 'administrador'
            ? 'Administrador Principal • Acesso total e configurações'
            : invitation.role === 'gestor'
            ? 'Gestor de Operações'
            : 'Técnico de Manutenção e Oficina'
        ),
        ativo: true,
        criadoEm: new Date().toISOString()
      };

      // Check if user with this email already exists and replace, otherwise append
      const existingIdx = currentUsers.findIndex(u => u.email && u.email.toLowerCase() === cleanEmail);
      let updatedUsers: UserProfile[];
      if (existingIdx >= 0) {
        updatedUsers = [...currentUsers];
        updatedUsers[existingIdx] = { ...updatedUsers[existingIdx], ...newUser };
      } else {
        updatedUsers = [...currentUsers, newUser];
      }

      db.save(STORAGE_KEYS.UTILIZADORES, updatedUsers);

      // 2. Mark invitation as accepted
      const convites = db.get<UserInvitation>(STORAGE_KEYS.CONVITES) || [];
      const updatedConvites = convites.map(c => 
        (c.token === token || c.id === token)
          ? { ...c, status: 'aceite' as const }
          : c
      );
      db.save(STORAGE_KEYS.CONVITES, updatedConvites);

      // 3. Push to Cloud (PocketBase) asynchronously
      syncPushToCloud(STORAGE_KEYS.UTILIZADORES, updatedUsers).catch(() => {});
      syncPushToCloud(STORAGE_KEYS.CONVITES, updatedConvites).catch(() => {});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection: STORAGE_KEYS.UTILIZADORES } }));
        // Clean URL parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('convite');
        window.history.replaceState({}, document.title, url.pathname);
      }

      // 4. Complete login
      onRegisterSuccess(newUser);
    } catch (err: any) {
      console.error('[RegistoConvite] Erro ao concluir registo:', err);
      setError('Ocorreu um erro ao guardar o seu registo. Tente novamente.');
      setSubmitting(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'administrador':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <span>👑</span> Administrador
          </span>
        );
      case 'gestor':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
            <span>💼</span> Gestor de Operações
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span>🔧</span> Técnico de Oficina
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-hp-600/10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-hp-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-6 relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-hp-600 to-hp-400 text-white shadow-lg shadow-hp-500/25 mb-3">
            <Wrench className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">Oficina HP</h2>
          <p className="text-xs text-slate-400 mt-1">Ativação de Conta de Colaborador</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-hp-500 border-t-transparent rounded-full animate-spin" />
            <span>A validar o seu convite...</span>
          </div>
        )}

        {/* Error / Status message (invalid, already accepted, or canceled) */}
        {!loading && statusMessage && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto">
              {statusMessage}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-hp-600 hover:bg-hp-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Ir para o Início de Sessão
            </button>
          </div>
        )}

        {/* Active Invitation Form */}
        {!loading && !statusMessage && invitation && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Readonly info from invitation */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Nível de Acesso</span>
                {getRoleBadge(invitation.role)}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Iniciais na Oficina</span>
                <span className="px-2.5 py-0.5 rounded-lg bg-hp-500/20 text-hp-300 border border-hp-500/30 font-mono font-bold text-xs">
                  {invitation.iniciais}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">Email Registado</span>
                <span className="text-xs text-white font-mono">{invitation.email}</span>
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                O seu Nome Completo *
              </label>
              <input
                type="text"
                autoFocus
                required
                placeholder="ex: João Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-hp-500"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Defina a sua Palavra-passe *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Palavra-passe pessoal"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full py-2.5 pl-3 pr-10 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-hp-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Confirmar Palavra-passe *
              </label>
              <input
                type="password"
                required
                placeholder="Repita a sua palavra-passe"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-hp-500 font-mono"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-hp-600 to-hp-500 hover:from-hp-500 hover:to-hp-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-hp-600/30 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>A concluir registo...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Concluir Registo & Entrar</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
              >
                Já tem conta? Entrar com credenciais normais
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
