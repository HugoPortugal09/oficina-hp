import React, { useState } from 'react';
import { Wrench, Shield, Lock, Mail, Eye, EyeOff, KeyRound, UserCheck, Users, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';
import { isAdminEmail, ADMIN_EMAILS } from '../types';

interface LoginProps {
  utilizadores: UserProfile[];
  onLogin: (user: UserProfile) => void;
  theme: 'dark' | 'light';
}

export const Login: React.FC<LoginProps> = ({ utilizadores, onLogin, theme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      const cleanEmail = email.trim().toLowerCase();
      
      // 1. Find user in registered list
      let user = utilizadores.find(
        u => (u.email && u.email.toLowerCase() === cleanEmail) ||
             (u.nome && u.nome.toLowerCase() === cleanEmail) ||
             (u.nome && u.nome.toLowerCase().includes(cleanEmail))
      );

      // 2. If it's a designated Administrator email but not yet in the array, instantiate it
      if (!user && isAdminEmail(cleanEmail)) {
        user = {
          id: `u_admin_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
          nome: cleanEmail.includes('hugo') ? 'Hugo Portugal (Administrador)' : 'Administrador',
          email: cleanEmail,
          role: 'administrador',
          avatar: cleanEmail.includes('hugo') ? 'HP' : 'AD',
          password: 'admin',
          descricao: 'Administrador Principal • Acesso total e configurações',
          ativo: true
        };
      }

      if (!user) {
        setError('Email ou utilizador não encontrado no sistema. Verifique os dados inseridos.');
        setIsLoading(false);
        return;
      }

      if (user.ativo === false) {
        setError('Esta conta de colaborador foi desativada pelo Administrador.');
        setIsLoading(false);
        return;
      }

      // Check if user is administrator
      const isUserAdmin = user.role === 'administrador' || isAdminEmail(user.email);
      const expectedPassword = user.password || (isUserAdmin ? 'admin' : '123');

      // Strict password validation (no cross-role bypass)
      if (password !== expectedPassword) {
        setError('Palavra-passe incorreta. Tente novamente.');
        setIsLoading(false);
        return;
      }

      // Ensure admin role if email is an admin email
      if (isAdminEmail(user.email) && user.role !== 'administrador') {
        user = { ...user, role: 'administrador' };
      }

      if (rememberMe) {
        try {
          localStorage.setItem('oficina_hp_session_user_id', user.id);
          localStorage.setItem('oficina_hp_active_user_id', user.id);
        } catch {}
      }

      setIsLoading(false);
      onLogin(user);
    }, 350);
  };

  const handleSelectPreFill = (u: UserProfile) => {
    setEmail(u.email);
    setPassword(u.password || (u.role === 'administrador' ? 'admin' : '123'));
    setError(null);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 selection:bg-hp-500 selection:text-white ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-hp-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700/80 shadow-2xl shadow-black/60 relative overflow-hidden group">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-black text-2xl tracking-wider">HP</span>
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-400/40 to-transparent" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            OFICINA <span className="text-sky-400">HP</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Gestão Operacional & Frotas • Acesso à Equipa
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-hp-400" /> Iniciar Sessão
            </h2>
            <p className="text-xs text-slate-400">
              Introduza as suas credenciais para aceder ao sistema.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2.5 animate-shake">
              <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email / Username Field */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300 block">
                Email / Utilizador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="ex: hugo@grau-maquinaria.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-4 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-hp-500 focus:ring-1 focus:ring-hp-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 block">
                  Palavra-passe
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-10 bg-slate-950/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-hp-500 focus:ring-1 focus:ring-hp-500 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-hp-600 focus:ring-0 cursor-pointer"
                />
                Lembrar sessão neste dispositivo
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-hp-600 to-hp-500 hover:from-hp-500 hover:to-hp-400 text-white font-bold rounded-xl text-xs shadow-lg shadow-hp-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Entrar na Aplicação
                </>
              )}
            </button>
          </form>

          {/* Quick Team Member Access */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-hp-400" /> Colaboradores da Equipa
              </span>
              <span className="text-[10px] text-slate-500">Clique para preencher</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {utilizadores.slice(0, 6).map(u => {
                const isAdmin = u.role === 'administrador' || isAdminEmail(u.email);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectPreFill(u)}
                    className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-hp-500/50 hover:bg-slate-800/50 text-left flex items-center gap-2 transition-all group"
                  >
                    <div className={`w-6 h-6 rounded-md font-bold text-[10px] flex items-center justify-center ${
                      isAdmin ? 'bg-hp-500/20 text-hp-400' : u.role === 'gestor' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {u.avatar || u.nome.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-200 truncate group-hover:text-white">
                        {u.nome}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate capitalize">
                        {isAdmin ? 'Administrador' : u.role}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          Oficina HP • Sistema de Gestão Operacional & Frotas
        </div>
      </div>
    </div>
  );
};
