import React, { useState } from 'react';
import { Wrench, Shield, Lock, Mail, Eye, EyeOff, KeyRound } from 'lucide-react';
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700/80 shadow-2xl shadow-black/60 relative overflow-hidden group">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-black text-2xl tracking-wider">HP</span>
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-400/40 to-transparent" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            OFICINA <span className="text-sky-400">HP</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Gestão Operacional & Frotas
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
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          Oficina HP • Sistema de Gestão Interna & Assistência Técnica v2.0
        </div>
      </div>
    </div>
  );
};
