import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface InstallPwaPromptProps {
  theme?: 'dark' | 'light';
}

export const InstallPwaPrompt: React.FC<InstallPwaPromptProps> = ({ theme = 'dark' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(inStandalone);

    // Check if iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isIosDevice);

    // Check if user dismissed recently (24 hours)
    try {
      const dismissedAt = localStorage.getItem('oficina_hp_pwa_dismissed');
      if (dismissedAt) {
        const timeDiff = Date.now() - parseInt(dismissedAt, 10);
        if (timeDiff < 24 * 60 * 60 * 1000) {
          setIsDismissed(true);
        }
      }
    } catch {}

    // Listen to Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen to appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed');
      setIsStandalone(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem('oficina_hp_pwa_dismissed', Date.now().toString());
    } catch {}
  };

  // Do not show if already installed in standalone or dismissed
  if (isStandalone || isDismissed) {
    return null;
  }

  // Only show if prompt is available (Android/PC) OR if it's iOS Safari not installed
  const canInstall = Boolean(deferredPrompt) || (isIos && !isStandalone);
  if (!canInstall) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom / Banner Prompt */}
      <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom duration-300">
        <div className={`p-3.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 ${
          theme === 'light'
            ? 'bg-white/95 border-hp-500/30 shadow-slate-300 text-slate-800'
            : 'bg-[#0f172a]/95 border-hp-500/40 shadow-black text-white'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#0b1528] border border-hp-500/30 flex items-center justify-center shrink-0 p-1 shadow-md">
              <img src="/pwa-192x192.png" alt="Oficina HP" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-hp-400 uppercase tracking-wider">Instalar App</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold truncate">Oficina HP no Telemóvel</h4>
              <p className="text-[11px] text-slate-400 truncate">Acesso rápido com 1 toque no ecrã</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-hp-600 to-hp-500 hover:from-hp-500 hover:to-hp-400 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-hp-500/25 active:scale-95 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar</span>
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition cursor-pointer"
              title="Dispensar por 24 horas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-sm rounded-3xl border p-5 shadow-2xl space-y-4 ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-hp-400" />
                <h3 className="text-sm font-black text-white">Instalar no iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIosModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Para instalar a <b>Oficina HP</b> no seu ecrã principal e utilizar sem barras de navegação:
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="p-1.5 rounded-lg bg-hp-500/20 text-hp-400 shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-white block font-bold">1. Toque em Partilhar</b>
                  <span className="text-slate-400">Na barra inferior do Safari, toque no ícone de partilha.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="p-1.5 rounded-lg bg-hp-500/20 text-hp-400 shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-white block font-bold">2. Adicionar ao Ecrã Principal</b>
                  <span className="text-slate-400">Rola para baixo nas opções e seleciona "Ecrã Principal".</span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-white block font-bold">3. Confirmar "Adicionar"</b>
                  <span className="text-slate-400">Toque em "Adicionar" no canto superior direito. Pronto!</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2.5 rounded-xl bg-hp-500 hover:bg-hp-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Compreendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Standalone Install Button for Settings or Header
export const InstallPwaButton: React.FC<{
  className?: string;
  theme?: 'dark' | 'light';
}> = ({ className = '', theme: _theme }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);

  useEffect(() => {
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(inStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (isStandalone) {
    return (
      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> App Instalada
      </span>
    );
  }

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosModal(true);
    } else {
      // Fallback instructions
      alert('Para instalar a Oficina HP: abra as opções do navegador (três pontos ou menu) e selecione "Instalar aplicação" ou "Adicionar ao ecrã principal".');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`px-3 py-1.5 rounded-xl bg-hp-500/15 hover:bg-hp-500/25 border border-hp-500/30 text-hp-400 hover:text-hp-300 font-bold text-xs flex items-center gap-2 transition cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar Aplicação</span>
      </button>

      {showIosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-white space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-hp-400" /> Como Instalar no iPhone
            </h3>
            <p className="text-xs text-slate-300">
              No Safari: toque no botão <b>Partilhar [⎋]</b> e selecione <b>"Adicionar ao Ecrã Principal" [+]</b>.
            </p>
            <button
              onClick={() => setShowIosModal(false)}
              className="w-full py-2 bg-hp-500 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
