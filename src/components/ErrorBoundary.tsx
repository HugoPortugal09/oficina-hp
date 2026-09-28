import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleHardReload = () => {
    try {
      if ('caches' in window) {
        caches.keys().then((keys) => {
          return Promise.all(keys.map((k) => caches.delete(k)));
        }).finally(() => {
          window.location.reload();
        });
        return;
      }
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b1120] text-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-5 animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-white">Oficina HP</h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Foi detetada uma nova versão ou uma quebra temporária no carregamento da aplicação.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-400 max-h-24 overflow-y-auto text-left">
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleHardReload}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-hp-600 to-hp-500 hover:from-hp-500 hover:to-hp-400 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-hp-600/30 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Atualizar & Carregar Versão Mais Recente</span>
            </button>

            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Os seus dados locais e na nuvem estão seguros.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
