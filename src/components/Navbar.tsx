import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Scan,
  Database,
  Sparkles,
  Plus,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  Shield,
  Briefcase,
  Wrench,
  Check,
  ChevronDown,
  LogOut
} from 'lucide-react';
import type { NavigationTab, UserProfile } from '../types';
import { USERS } from '../types';
import { checkPocketBaseConnection } from '../services/pocketbase';

interface NavbarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  onOpenScanner: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen?: boolean;
  onCreateNewService?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSwitchToMobile?: () => void;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  users?: UserProfile[];
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onToggleSidebar,
  isSidebarOpen = true,
  onCreateNewService,
  theme,
  onToggleTheme,
  onSwitchToMobile,
  currentUser,
  onSelectUser,
  users = USERS,
  onLogout
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [pbStatus, setPbStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: 'A verificar...'
  });

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const res = await checkPocketBaseConnection();
      if (isMounted) setPbStatus(res);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard Operacional', subtitle: 'Métricas, KPIs e visão geral em tempo real' },
    mapa: { title: 'Mapa de Serviços', subtitle: 'Localização geográfica de clientes com pedidos e intervenções em aberto' },
    oficina: { title: 'Folhas de Serviço', subtitle: 'Registo e acompanhamento técnico de intervenções' },
    'folhas-obra': { title: 'Folhas de Obra (Ambiente de Testes)', subtitle: 'Módulo de testes e desenvolvimento experimental de folhas de obra' },
    kanban: { title: 'Quadro Kanban da Oficina', subtitle: 'Fluxo visual de trabalho e distribuição de tarefas' },
    tarefas: { title: 'Gestão de Tarefas', subtitle: 'Atribuição, prioridades, datas limite e registo de conclusão' },
    propostas: { title: 'Orçamentos & Propostas', subtitle: 'Criação dinâmica de propostas comerciais e orçamentação' },
    empresas: { title: 'Empresas & Estaleiros', subtitle: 'Diretório de empresas parceiras e localizações' },
    clientes: { title: 'Clientes & Contactos', subtitle: 'Lista de contactos, gestores e responsáveis de frota' },
    equipamentos: { title: 'Frotas & Equipamentos', subtitle: 'Registo de viaturas, máquinas e histórico de revisões' },
    pecas: { title: 'Catálogo de Peças & Stock', subtitle: 'Gestão de referências, preços de venda e armazém' },
    'pedidos-pecas': { title: 'Pedidos de Peças', subtitle: 'Requisição e acompanhamento com fornecedores' },
    'guias-envio': { title: 'Guias de Envio', subtitle: 'Guias de transporte de materiais e equipamentos' },
    contratos: { title: 'Contratos de Manutenção', subtitle: 'Avenças preventivas e planos periódicos' },
    'atividade-semanal': { title: 'Atividade Semanal & Produção', subtitle: 'Registo e acompanhamento visual semanal de serviços, peças e tarefas' },
    planeamento: { title: 'Planeamento & Visitas', subtitle: 'Agendamento de folhas de serviço abertas e gestão de visitas aos clientes' },
    automacoes: { title: 'Centro de Automações & Disparos', subtitle: 'Gestão de envios automáticos, relatórios semanais por email e alertas' },
    'tempos-resposta': { title: 'Tempos de Resposta & Imobilização', subtitle: 'Tempo de imobilização em oficina e acompanhamento de requisições' },
    configuracoes: { title: 'Configurações do Sistema', subtitle: 'Dados da oficina, PocketBase, Ollama e cópias de segurança' },
  };

  const currentInfo = titles[activeTab] || { title: 'Oficina HP', subtitle: 'Sistema de Gestão' };

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/75 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 py-2 flex items-center justify-between gap-4">
      {/* Left: Sidebar Toggle Button & Page Title */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          title={isSidebarOpen ? 'Ocultar Menu Lateral' : 'Mostrar Menu Lateral'}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-700 transition-colors flex items-center justify-center"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5 text-slate-300" />
          ) : (
            <PanelLeftOpen className="w-5 h-5 text-hp-400 animate-pulse" />
          )}
        </button>

        <div className="flex items-center gap-2.5">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
            {currentInfo.title}
          </h2>
          <span className="text-[11px] text-slate-400 hidden lg:inline border-l border-slate-700 pl-2.5">
            {currentInfo.subtitle}
          </span>
        </div>
      </div>

      {/* Center/Right: Mobile Mode Button, Scanner Button, PB Indicator & Quick Action */}
      <div className="flex items-center gap-2">
        {/* Mobile Mode Route Switcher Button */}
        {onSwitchToMobile && (
          <button
            onClick={onSwitchToMobile}
            title="Abrir Modo Telemóvel (/mobile)"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-hp-500 transition-colors text-xs font-bold"
          >
            <Smartphone className="w-3.5 h-3.5 text-hp-400" />
            <span className="hidden sm:inline">Modo Telemóvel</span>
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Escuro'}
          className="p-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white hover:border-hp-500 transition-colors flex items-center justify-center"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-hp-500" />
          )}
        </button>

        {/* AI Scanner Trigger Button */}
        <button
          onClick={onOpenScanner}
          title="Digitalizar Matrícula ou Peça com IA"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-hp-600/30 to-indigo-600/30 border border-hp-500/40 text-hp-300 hover:text-white hover:border-hp-400 transition-all text-xs font-semibold shadow-sm group"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Scanner IA</span>
        </button>

        {/* PocketBase Status Badge */}
        <div
          title={pbStatus.message}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-mono border backdrop-blur-md ${
            pbStatus.connected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          }`}
        >
          <Database className="w-3 h-3" />
          <span className="hidden xl:inline">
            {pbStatus.connected ? 'PB Online' : 'Modo Offline (Local)'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              pbStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
        </div>

        {/* Global Quick Action: New Folha (Only for Admin and Técnico) */}
        {onCreateNewService && currentUser.role !== 'gestor' && (
          <button
            onClick={onCreateNewService}
            className="flex items-center gap-1 px-3 py-1 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-bold text-xs shadow-md shadow-hp-600/20 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova Folha</span>
          </button>
        )}

        {/* User Profile Selector Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(prev => !prev)}
            className={`flex items-center gap-2 py-1 px-2 rounded-xl border transition-all ${
              currentUser.role === 'administrador'
                ? 'bg-purple-950/40 border-purple-500/40 text-purple-200 hover:border-purple-400'
                : currentUser.role === 'gestor'
                ? 'bg-sky-950/40 border-sky-500/40 text-sky-200 hover:border-sky-400'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-200 hover:border-amber-400'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] text-white shadow-sm ${
              currentUser.role === 'administrador'
                ? 'bg-purple-600'
                : currentUser.role === 'gestor'
                ? 'bg-sky-600'
                : 'bg-amber-600'
            }`}>
              {currentUser.avatar}
            </div>

            <div className="flex flex-col text-left hidden sm:flex">
              <span className="text-[11px] font-bold leading-tight truncate max-w-[120px]">
                {currentUser.nome}
              </span>
              <span className="text-[9px] font-mono opacity-80 uppercase leading-none">
                {currentUser.role === 'administrador'
                  ? '👑 Admin'
                  : currentUser.role === 'gestor'
                  ? '💼 Gestor'
                  : '🔧 Técnico'}
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* User Profile Menu */}
          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-800">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-md ${
                  currentUser.role === 'administrador'
                    ? 'bg-purple-600'
                    : currentUser.role === 'gestor'
                    ? 'bg-sky-600'
                    : 'bg-amber-600'
                }`}>
                  {currentUser.avatar}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {currentUser.nome}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {currentUser.email}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase inline-block mt-1 ${
                    currentUser.role === 'administrador'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : currentUser.role === 'gestor'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                {currentUser.descricao}
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  Terminar Sessão
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
