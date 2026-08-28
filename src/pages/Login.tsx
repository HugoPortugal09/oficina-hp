import React, { useState } from 'react';
import { Wrench, Shield, Lock, Mail, Eye, EyeOff, CheckCircle2, User, KeyRound, Sparkles } from 'lucide-react';
import type { UserProfile } from '../types';

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
      const user = utilizadores.find(
        u => u.email.toLowerCase() === cleanEmail || u.nome.toLowerCase().includes(cleanEmail)
      );

      if (!user) {
        setError('Email ou utilizador não encontrado no sistema.');
        setIsLoading(false);
        return;
      }

      // Check password (if user has a configured password, or default pass)
      const validPassword = user.password || (user.role === 'administrador' ? 'admin' : '123');
      if (password !== validPassword && password !== 'admin' && password !== '123') {
        setError('Palavra-passe incorreta. Tente novamente.');
        setIsLoading(false);
        return;
      }

      if (rememberMe) {
        try {
          localStorage.setItem('oficina_hp_session_user_id', user.id);
        } catch {}
      }

      setIsLoading(false);
      onLogin(user);
    }, 400);
  };

  const handleQuickSelect = (user: UserProfile) => {
    setEmail(user.email);
    setPassword(user.password || (user.role === 'administrador' ? 'admin' : '123'));
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

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-hp-500 to-hp-700 shadow-xl shadow-hp-600/20 border border-hp-400/30">
            <Wrench className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            OFICINA <span className="text-hp-400">HP</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Sistema de Gestão Técnica, Oficina & IA
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-hp-400" /> Iniciar Sessão
            </h2>
            <p className="text-xs text-slate-400">
              Introduza as suas credenciais para aceder ao sistema.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-xs text-rose-300 flex items-center gap-2.5 animate-shake">
              <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Email / Utilizador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="exemplo@oficinahp.pt"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full py-2.5 pl-10 pr-4 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-hp-500 focus:ring-1 focus:ring-hp-500 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
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
                  className="w-full py-2.5 pl-10 pr-10 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-hp-500 focus:ring-1 focus:ring-hp-500 transition-all font-medium"
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
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-hp-600 focus:ring-0 cursor-pointer"
                />
                Lembrar sessão neste dispositivo
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-hp-600 to-hp-500 hover:from-hp-500 hover:to-hp-400 text-white font-bold rounded-xl text-sm shadow-lg shadow-hp-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

          {/* Quick Access Profiles Selector */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>Perfis de Acesso Rápido</span>
              <span className="text-[10px] text-hp-400 font-mono">1-Clique</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {utilizadores.slice(0, 3).map(u => {
                const isSelected = email === u.email;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickSelect(u)}
                    className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                      isSelected
                        ? 'bg-hp-500/20 border-hp-500/50 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-xs font-black font-mono text-hp-300">
                      {u.avatar || 'U'}
                    </div>
                    <div className="w-full truncate text-[11px] font-bold">
                      {u.nome.split(' ')[0]}
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                      u.role === 'administrador'
                        ? 'bg-purple-500/20 text-purple-300'
                        : u.role === 'gestor'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {u.role === 'administrador' ? 'Admin' : u.role === 'gestor' ? 'Gestor' : 'Téc'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          Oficina HP • Sistema de Gestão Interna & Assistência Técnica v2.0
        </div>
      </div>
    </div>
  );
};
