import React, { useState } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Wrench,
  Kanban,
  CheckSquare,
  FileSpreadsheet,
  Building2,
  Users,
  Truck,
  Package,
  ShoppingCart,
  Send,
  FileCheck2,
  Settings,
  X,
  Sun,
  Moon,
  Smartphone,
  ChevronDown,
  ChevronRight,
  Layers,
  Box,
  Database,
  PanelLeftClose,
  PanelLeftOpen,
  Calendar,
  Activity,
  CalendarCheck,
  Timer,
  Shield,
  Briefcase,
  Check,
  LogOut,
  Zap
} from 'lucide-react';
import type { NavigationTab, UserProfile } from '../types';
import { USERS } from '../types';

interface SidebarProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSwitchToMobile?: () => void;
  openFolhasCount?: number;
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  users?: UserProfile[];
  onLogout?: () => void;
}

interface MenuItem {
  id: NavigationTab;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface MenuGroup {
  id: string;
  title: string;
  icon?: React.ReactNode;
  items: MenuItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onSwitchToMobile,
  openFolhasCount,
  currentUser,
  onSelectUser,
  users = USERS,
  onLogout
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_sidebar_groups');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { dados: true, servicos: true, pecas: true, gestao: true };
  });

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem('oficina_hp_sidebar_groups', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const menuGroups: MenuGroup[] = [
    {
      id: 'dados',
      title: 'BASE DE DADOS',
      icon: <Database className="w-3.5 h-3.5 text-emerald-400" />,
      items: [
        { id: 'empresas', label: 'Empresas', icon: <Building2 className="w-4 h-4" /> },
        { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
        { id: 'equipamentos', label: 'Frotas', icon: <Truck className="w-4 h-4" /> },
      ]
    },
    {
      id: 'servicos',
      title: 'SERVIÇOS',
      icon: <Wrench className="w-3.5 h-3.5 text-hp-400" />,
      items: [
        { id: 'oficina', label: 'Folhas de Serviços', icon: <Wrench className="w-4 h-4" /> },
        { id: 'tarefas', label: 'Tarefas', icon: <CheckSquare className="w-4 h-4" /> },
        { id: 'contratos', label: 'Contratos de Manutenção', icon: <FileCheck2 className="w-4 h-4" /> },
        // Orçamentos ocultos para Técnico
        ...(currentUser.role !== 'tecnico'
          ? [{ id: 'propostas' as NavigationTab, label: 'Orçamentos', icon: <FileSpreadsheet className="w-4 h-4" /> }]
          : []),
        {
          id: 'mapa',
          label: 'Mapa de Serviços',
          icon: <MapPin className="w-4 h-4 text-orange-400" />,
          badge: openFolhasCount ? `${openFolhasCount} Abertos` : undefined
        },
        { id: 'kanban', label: 'Quadro Kanban', icon: <Kanban className="w-4 h-4" />, badge: 'Live' },
      ]
    },
    {
      id: 'pecas',
      title: 'PEÇAS',
      icon: <Package className="w-3.5 h-3.5 text-indigo-400" />,
      items: [
        { id: 'pecas', label: 'Catalogo de Peças', icon: <Package className="w-4 h-4" /> },
        { id: 'pedidos-pecas', label: 'Pedido de Peças', icon: <ShoppingCart className="w-4 h-4" /> },
        { id: 'guias-envio', label: 'Guias de envio', icon: <Send className="w-4 h-4" /> },
      ]
    },
    {
      id: 'gestao',
      title: 'GESTÃO',
      icon: <Activity className="w-3.5 h-3.5 text-amber-400" />,
      items: [
        { id: 'atividade-semanal', label: 'Atividade Semanal', icon: <Calendar className="w-4 h-4 text-emerald-400" /> },
        { id: 'planeamento', label: 'Planeamento', icon: <CalendarCheck className="w-4 h-4 text-sky-400" /> },
        // Automações exclusivo para Administrador
        ...(currentUser.role === 'administrador'
          ? [{ id: 'automacoes' as NavigationTab, label: 'Automações', icon: <Zap className="w-4 h-4 text-purple-400" />, badge: 'IA' }]
          : []),
        { id: 'tempos-resposta', label: 'Tempos de Resposta', icon: <Timer className="w-4 h-4 text-orange-400" /> },
      ]
    }
  ];

  const handleSelectTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-40 w-72 bg-slate-950/90 backdrop-blur-2xl border-r border-slate-800/80
          flex flex-col transition-all duration-300 ease-in-out shadow-2xl
          ${isOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none'}
        `}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="h-10 px-2.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-lg shadow-black/40 overflow-hidden group">
              <img src="/grau_logo.png" alt="GRAUMP" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                OFICINA <span className="text-hp-400">HP</span>
              </h1>
              <p className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                Gestão & Frotas
              </p>
            </div>
          </div>

          {/* Toggle / Close Sidebar Button */}
          <button
            onClick={onClose}
            title="Ocultar Menu Lateral"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto custom-scrollbar">
          {/* Top Standalone Dashboard Item */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            className={`
              w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold text-xs
              transition-all duration-150 group
              ${
                activeTab === 'dashboard'
                  ? 'bg-hp-600/20 text-hp-400 border border-hp-500/30 shadow-md shadow-hp-600/10'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }
            `}
          >
            <div className="flex items-center gap-2.5">
              <span className={`transition-colors ${activeTab === 'dashboard' ? 'text-hp-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                <LayoutDashboard className="w-4 h-4" />
              </span>
              <span>Dashboard</span>
            </div>
          </button>

          {/* Group Accordions */}
          {menuGroups.map(group => {
            const isGroupOpen = !!openGroups[group.id];
            const hasActiveChild = group.items.some(item => item.id === activeTab);

            return (
              <div key={group.id} className="space-y-1 pt-1">
                {/* Group Header Button */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`
                    w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase
                    transition-all select-none group
                    ${hasActiveChild ? 'text-hp-400 bg-hp-500/5' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'}
                  `}
                >
                  <div className="flex items-center gap-2">
                    {group.icon}
                    <span>{group.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {group.items.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isGroupOpen ? 'rotate-0' : '-rotate-90 text-slate-500'
                      }`}
                    />
                  </div>
                </button>

                {/* Group Items (Collapsible) */}
                {isGroupOpen && (
                  <div className="space-y-0.5 pl-1.5 border-l border-slate-800/80 ml-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`
                            w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg font-medium text-xs
                            transition-all duration-150 group
                            ${
                              isActive
                                ? 'bg-hp-600/20 text-hp-400 border border-hp-500/30 shadow-sm shadow-hp-600/10 font-semibold'
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                            }
                          `}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={`transition-colors shrink-0 ${isActive ? 'text-hp-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                              {item.icon}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </div>

                          {item.badge && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 ml-1">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Bottom Standalone Configurações Item (Apenas Administrador) */}
          {currentUser.role === 'administrador' && (
            <div className="pt-2 border-t border-slate-800/60">
              <button
                onClick={() => handleSelectTab('configuracoes')}
                className={`
                  w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium text-xs
                  transition-all duration-150 group
                  ${
                    activeTab === 'configuracoes'
                      ? 'bg-hp-600/20 text-hp-400 border border-hp-500/30 shadow-md shadow-hp-600/10 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                  }
                `}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`transition-colors ${activeTab === 'configuracoes' ? 'text-hp-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    <Settings className="w-4 h-4" />
                  </span>
                  <span>Configurações & IA</span>
                </div>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Admin
                </span>
              </button>
            </div>
          )}
        </div>

        {/* User / Workspace & Theme Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
          {/* Mobile Mode Switcher */}
          {onSwitchToMobile && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-300 hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Modo Telemóvel (/mobile)</span>
              </div>
              <span className="text-[10px] font-mono uppercase text-indigo-400">PWA ➔</span>
            </button>
          )}

          {/* Theme Toggle Button in Sidebar */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900/70 border border-slate-800 hover:border-hp-500 text-slate-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-hp-500" />
              )}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </div>
            <span className="text-[10px] font-mono uppercase text-slate-500">
              {theme === 'dark' ? 'Ativar ☀️' : 'Ativar 🌙'}
            </span>
          </button>

          {/* Interactive User Switcher Card */}
          <div
              className={`w-full p-2.5 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 ${
                currentUser.role === 'administrador'
                  ? 'bg-purple-950/30 border-purple-500/40 shadow-sm'
                  : currentUser.role === 'gestor'
                  ? 'bg-sky-950/30 border-sky-500/40 shadow-sm'
                  : 'bg-amber-950/30 border-amber-500/40 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-md shrink-0 ${
                  currentUser.role === 'administrador'
                    ? 'bg-purple-600 ring-2 ring-purple-400/40'
                    : currentUser.role === 'gestor'
                    ? 'bg-sky-600 ring-2 ring-sky-400/40'
                    : 'bg-amber-600 ring-2 ring-amber-400/40'
                }`}>
                  {currentUser.avatar}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-100 truncate">{currentUser.nome}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                      currentUser.role === 'administrador'
                        ? 'bg-purple-500/20 text-purple-300'
                        : currentUser.role === 'gestor'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Terminar Sessão"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
        </div>
      </aside>
    </>
  );
};
