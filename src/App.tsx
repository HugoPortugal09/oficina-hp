import React, { useState, useEffect, Suspense } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { RegistoConviteModal } from './components/RegistoConviteModal';
import { checkForAppUpdate, subscribeToUpdates, reloadAppWithCacheClear } from './services/updateService';

// Helper tipado para importação lazy de componentes com named exports
const lazyNamed = <T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K
) => React.lazy(() => loader().then((m) => ({ default: m[name] })));

// Code-Splitting: Carregamento sob demanda de todas as páginas e do scanner pesado
const Dashboard = lazyNamed(() => import('./pages/Dashboard'), 'Dashboard');
const MapaPortugal = lazyNamed(() => import('./pages/MapaPortugal'), 'MapaPortugal');
const Oficina = lazyNamed(() => import('./pages/Oficina'), 'Oficina');
const Kanban = lazyNamed(() => import('./pages/Kanban'), 'Kanban');
const Propostas = lazyNamed(() => import('./pages/Propostas'), 'Propostas');
const Empresas = lazyNamed(() => import('./pages/Empresas'), 'Empresas');
const Clientes = lazyNamed(() => import('./pages/Clientes'), 'Clientes');
const Equipamentos = lazyNamed(() => import('./pages/Equipamentos'), 'Equipamentos');
const Pecas = lazyNamed(() => import('./pages/Pecas'), 'Pecas');
const PedidosPecas = lazyNamed(() => import('./pages/PedidosPecas'), 'PedidosPecas');
const GuiasEnvio = lazyNamed(() => import('./pages/GuiasEnvio'), 'GuiasEnvio');
const Contratos = lazyNamed(() => import('./pages/Contratos'), 'Contratos');
const Tarefas = lazyNamed(() => import('./pages/Tarefas'), 'Tarefas');
const AtividadeSemanal = lazyNamed(() => import('./pages/AtividadeSemanal'), 'AtividadeSemanal');
const Planeamento = lazyNamed(() => import('./pages/Planeamento'), 'Planeamento');
const Automacoes = lazyNamed(() => import('./pages/Automacoes'), 'Automacoes');
const TemposResposta = lazyNamed(() => import('./pages/TemposResposta'), 'TemposResposta');
const Configuracoes = lazyNamed(() => import('./pages/Configuracoes'), 'Configuracoes');
const MobileApp = lazyNamed(() => import('./pages/MobileApp'), 'MobileApp');
const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const CameraScannerModal = lazyNamed(() => import('./components/CameraScannerModal'), 'CameraScannerModal');

function PageFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] p-8 text-center animate-pulse">
      <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-3" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        A carregar vista...
      </span>
    </div>
  );
}

function FullscreenFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
      <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
      <span className="text-sm font-semibold tracking-wide text-slate-300">
        Oficina HP • A carregar aplicação...
      </span>
    </div>
  );
}

import { db, STORAGE_KEYS } from './services/dbService';
import { syncPullFromCloud, subscribeToRealtimeSync, syncPushAllToServer } from './services/pocketbaseSync';
import { cleanupOrphanLocalStorageKeys } from './utils/storageUtils';
import { startAutomationRunner } from './services/automationRunner';
import { parseCurrentRoute, buildPath, findFolhaByParam } from './utils/routeUtils';
import { InstallPwaPrompt } from './components/InstallPwaPrompt';
import type {
  NavigationTab,
  FolhaServico,
  Proposta,
  Empresa,
  Cliente,
  Equipamento,
  PecaCatalogo,
  KitManutencao,
  PedidoPeca,
  GuiaEnvio,
  Contrato,
  Tarefa,
  VisitaCliente,
  VisionScanResult,
  UserProfile
} from './types';
import { USERS, getPermissionsForRole, isAdminEmail } from './types';

export default function App() {
  const [isMobileRoute, setIsMobileRoute] = useState<boolean>(() => parseCurrentRoute().isMobile);
  const [activeTab, setActiveTab] = useState<NavigationTab>(() => parseCurrentRoute().tab);
  const [conviteToken, setConviteToken] = useState<string | null>(() => parseCurrentRoute().conviteToken);
  const [pendingFolhaParam, setPendingFolhaParam] = useState<string | null>(() => parseCurrentRoute().folhaParam);
  const [selectedFolha, setSelectedFolha] = useState<FolhaServico | null>(null);

  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseCurrentRoute();
      setIsMobileRoute(parsed.isMobile);
      setActiveTab(parsed.tab);
      setConviteToken(parsed.conviteToken);
      setPendingFolhaParam(parsed.folhaParam);
      if (!parsed.folhaParam) {
        setSelectedFolha(null);
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateToMobile = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ isMobile: true }, '', '/mobile');
    }
    setIsMobileRoute(true);
  };

  const navigateToDesktop = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({ tab: 'dashboard' }, '', '/');
    }
    setIsMobileRoute(false);
    setActiveTab('dashboard');
  };

  const handleSelectTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    setIsMobileRoute(false);
    setSelectedFolha(null);
    setPendingFolhaParam(null);
    const path = buildPath(tab);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path);
    }
  };

  const handleSelectFolhaDirect = (fs: FolhaServico) => {
    setSelectedFolha(fs);
    setActiveTab('oficina');
    setIsMobileRoute(false);
    const path = buildPath('oficina', fs.numero || fs.id);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({ tab: 'oficina', folhaId: fs.id }, '', path);
    }
  };

  const handleCreateNewServiceDirect = (equip?: any) => {
    if (equip) {
      const today = getTodayFormatted();
      const newNum = db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');
      const newFs: FolhaServico = {
        id: db.generateId('fs'),
        numero: newNum,
        tipo: 'Oficina',
        data: today,
        dataAbertura: today,
        dataEntradaOficina: today,
        dataRequisicao: '',
        dataConclusao: '',
        guiaAT: '',
        status: 'A ser intervencionado',
        requisicao: 'Não',
        faturacao: 'Pendente',
        empresaId: equip.empresaId || '',
        equipamentoId: equip.id,
        matricula: equip.matricula,
        marca: equip.marca || 'Viatura',
        modelo: equip.modelo || 'Frota',
        kmsAtuais: equip.kmsAtuais || 0,
        horasAtuais: equip.horasAtuais || 0,
        localizacao: 'GRAUMP (Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha)',
        localizacaoTipo: 'oficina',
        distanciaKms: 0,
        anomalias: 'Abertura de serviço para viatura/equipamento.',
        servicos: [],
        servicosAdicionais: [],
        pecas: [],
        pecasAdicionais: [],
        mensagens: [
          {
            id: db.generateId('msg'),
            user: currentUser?.nome || 'Oficina HP',
            text: `Nova intervenção iniciada para o equipamento ${equip.matricula} (${equip.marca || ''} ${equip.modelo || ''}).`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        historicoEstados: [
          {
            status: 'A ser intervencionado',
            dataEntrada: new Date().toISOString()
          }
        ],
        fotos: [],
        fotosCliente: [],
        notasCliente: '',
        previsaoRevisaoKms: (equip.kmsAtuais || 0) + 15000,
        previsaoRevisaoHoras: (equip.horasAtuais || 0) + 500,
        equipamentoFuncionando: 'Sim',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.insert(STORAGE_KEYS.FOLHAS_SERVICO, newFs);
      loadAllData();
      handleSelectFolhaDirect(newFs);
      return;
    }

    setSelectedFolha(null);
    setPendingFolhaParam(null);
    handleSelectTab('oficina');
  };

  const handleClearSelectedFolha = () => {
    setSelectedFolha(null);
    setPendingFolhaParam(null);
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/oficina/')) {
      window.history.pushState({ tab: 'oficina' }, '', '/oficina');
    }
  };

  // Active User Profile State (Administrador, Gestor, Técnico)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const savedId = localStorage.getItem('oficina_hp_session_user_id') || localStorage.getItem('oficina_hp_active_user_id');
      if (savedId) {
        const fromDb = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
        const found = fromDb.find(u => u.id === savedId || (u.email && u.email.toLowerCase() === savedId.toLowerCase()));
        if (found) {
          if (isAdminEmail(found.email) && found.role !== 'administrador') {
            return { ...found, role: 'administrador' };
          }
          return found;
        }
      }
    } catch {}
    return USERS[0]; // Administrador por defeito
  });

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const savedSession = localStorage.getItem('oficina_hp_session_user_id');
      return Boolean(savedSession);
    } catch {
      return false;
    }
  });

  const handleLogin = (user: UserProfile) => {
    const effectiveUser = isAdminEmail(user.email) ? { ...user, role: 'administrador' as const } : user;
    setCurrentUser(effectiveUser);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('oficina_hp_session_user_id', effectiveUser.id);
      localStorage.setItem('oficina_hp_active_user_id', effectiveUser.id);
    } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('oficina_hp_session_user_id');
      localStorage.removeItem('oficina_hp_active_user_id');
    } catch {}
  };

  const handleSelectUser = (user: UserProfile) => {
    const effectiveUser = isAdminEmail(user.email) ? { ...user, role: 'administrador' as const } : user;
    setCurrentUser(effectiveUser);
    try {
      localStorage.setItem('oficina_hp_active_user_id', effectiveUser.id);
      localStorage.setItem('oficina_hp_session_user_id', effectiveUser.id);
    } catch {}
    if (effectiveUser.role !== 'administrador' && activeTab === 'configuracoes') {
      handleSelectTab('dashboard');
    }
    if (effectiveUser.role === 'tecnico' && (activeTab === 'propostas' || activeTab === 'automacoes')) {
      handleSelectTab('dashboard');
    }
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_sidebar_open');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    } catch {
      return true;
    }
  });
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('oficina_hp_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Theme state: dark | light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('oficina_hp_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    }
    localStorage.setItem('oficina_hp_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Data states
  const [folhas, setFolhas] = useState<FolhaServico[]>([]);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [pecas, setPecas] = useState<PecaCatalogo[]>([]);
  const [kits, setKits] = useState<KitManutencao[]>([]);
  const [pedidos, setPedidos] = useState<PedidoPeca[]>([]);
  const [guias, setGuias] = useState<GuiaEnvio[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [visitas, setVisitas] = useState<VisitaCliente[]>([]);
  const [utilizadores, setUtilizadores] = useState<UserProfile[]>(() => {
    const fromDb = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    return fromDb && fromDb.length > 0 ? fromDb : USERS;
  });

  // Automatically resolve and open Folha when URL contains a folha number/id (e.g. /oficina/O26049 or ?folha=O26049)
  useEffect(() => {
    if (pendingFolhaParam && folhas.length > 0) {
      const match = findFolhaByParam(folhas, pendingFolhaParam);
      if (match) {
        setSelectedFolha(match);
        setActiveTab('oficina');
      }
    }
  }, [pendingFolhaParam, folhas]);

  const loadAllData = () => {
    setFolhas(db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO));
    setPropostas(db.get<Proposta>(STORAGE_KEYS.PROPOSTAS));
    setEmpresas(db.get<Empresa>(STORAGE_KEYS.EMPRESAS));
    setClientes(db.get<Cliente>(STORAGE_KEYS.CLIENTES));
    setEquipamentos(db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS));
    setPecas(db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO));
    setKits(db.get<KitManutencao>(STORAGE_KEYS.KITS_MANUTENCAO));
    setPedidos(db.get<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS));
    setGuias(db.get<GuiaEnvio>(STORAGE_KEYS.GUIAS_ENVIO));
    setContratos(db.get<Contrato>(STORAGE_KEYS.CONTRATOS));
    setTarefas(db.get<Tarefa>(STORAGE_KEYS.TAREFAS));
    setVisitas(db.get<VisitaCliente>(STORAGE_KEYS.VISITAS));
    const loadedUsers = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    setUtilizadores(loadedUsers && loadedUsers.length > 0 ? loadedUsers : USERS);
  };

  const handleSaveVisita = (visita: VisitaCliente) => {
    const nowIso = new Date().toISOString();
    const visitaWithTimestamp: VisitaCliente = {
      ...visita,
      atualizadoEm: nowIso,
      updatedAt: nowIso,
      criadoEm: (visita as any).criadoEm || nowIso
    };
    const existing = db.get<VisitaCliente>(STORAGE_KEYS.VISITAS);
    const index = existing.findIndex(v => v.id === visita.id || (v.numero && v.numero === visita.numero));
    let updated: VisitaCliente[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...visitaWithTimestamp };
    } else {
      updated = [visitaWithTimestamp, ...existing];
    }
    db.save(STORAGE_KEYS.VISITAS, updated);
    setVisitas(updated);
  };

  const handleDeleteVisita = (id: string) => {
    const existing = db.get<VisitaCliente>(STORAGE_KEYS.VISITAS);
    const updated = existing.filter(v => v.id !== id);
    db.save(STORAGE_KEYS.VISITAS, updated);
    setVisitas(updated);
  };

  const handleUpdateFolhaDirect = (folha: FolhaServico) => {
    const now = new Date().toISOString();
    const folhaWithTimestamp: FolhaServico = {
      ...folha,
      updatedAt: now,
      atualizadoEm: now
    };
    const existing = db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
    const index = existing.findIndex(f => f.id === folha.id);
    let updated: FolhaServico[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = folhaWithTimestamp;
    } else {
      updated = [folhaWithTimestamp, ...existing];
    }
    db.save(STORAGE_KEYS.FOLHAS_SERVICO, updated);
    setFolhas(updated);
  };

  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const unsub = subscribeToUpdates(setUpdateAvailable);
    checkForAppUpdate();
    const interval = setInterval(checkForAppUpdate, 45000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    cleanupOrphanLocalStorageKeys();
    db.initSeed();
    loadAllData();

    // 1. Initial Bidirectional Sync (Push local changes first to preserve them, then pull complete server state)
    syncPushAllToServer()
      .then(() => syncPullFromCloud())
      .then(() => loadAllData())
      .catch(() => {
        syncPullFromCloud().then(() => loadAllData()).catch(() => {});
      });

    // 2. Realtime SSE Subscription from PocketBase
    const unsubscribeRealtime = subscribeToRealtimeSync();

    // 3. Listener for local database changes with 150ms debounce to avoid rapid successive re-renders
    let dbChangeTimer: any = null;
    const handleDbChange = () => {
      if (dbChangeTimer) clearTimeout(dbChangeTimer);
      dbChangeTimer = setTimeout(() => {
        loadAllData();
      }, 150);
    };

    // 4. Sync on Window Focus, Visibility Change and Reconnect (when switching tabs or waking PC)
    let syncThrottleTimer: any = null;
    const handleSync = () => {
      if (syncThrottleTimer) return;
      syncThrottleTimer = setTimeout(() => { syncThrottleTimer = null; }, 3000);
      syncPullFromCloud().then(() => loadAllData()).catch(() => {});
      syncPushAllToServer().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleSync();
      }
    };

    // 5. Periodic Background Sync (every 60 seconds - relaxed from 8s since Realtime SSE already syncs instantly)
    const syncInterval = setInterval(() => {
      syncPullFromCloud().catch(() => {});
    }, 60000);

    // 6. Background Automation Runner (Monday 07:30 weekly planeamento, response times, etc.)
    const stopAutomationRunner = startAutomationRunner();

    window.addEventListener('oficina_hp_db_changed', handleDbChange);
    window.addEventListener('focus', handleSync);
    window.addEventListener('online', handleSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (dbChangeTimer) clearTimeout(dbChangeTimer);
      if (syncThrottleTimer) clearTimeout(syncThrottleTimer);
      unsubscribeRealtime();
      clearInterval(syncInterval);
      stopAutomationRunner();
      window.removeEventListener('oficina_hp_db_changed', handleDbChange);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('online', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleScanComplete = (res: VisionScanResult) => {
    if (res.matricula) {
      // Check if equipment exists with this plate
      const existing = equipamentos.find(
        e => e.matricula.toUpperCase() === res.matricula?.toUpperCase()
      );

      if (existing) {
        // Find if there is an active folha
        const activeFolha = folhas.find(
          f => f.equipamentoId === existing.id && f.status !== 'Concluído' && !f.status.includes('FEITO') && f.status !== 'Feito'
        );

        if (activeFolha) {
          setSelectedFolha(activeFolha);
          setActiveTab('oficina');
        } else {
          // Create new service with scanned vehicle
          const newFs: FolhaServico = {
            id: db.generateId('fs'),
            numero: db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS'),
            tipo: 'Oficina',
            data: new Date().toISOString().split('T')[0],
            status: 'OF - Com requisição - Aguardar agenda',
            empresaId: existing.empresaId,
            equipamentoId: existing.id,
            matricula: existing.matricula,
            marca: existing.marca,
            modelo: existing.modelo,
            kmsAtuais: res.odometroKm || existing.kmsAtuais || 0,
            horasAtuais: res.odometroHoras || existing.horasAtuais || 0,
            localizacao: 'Oficina Principal HP',
            localizacaoTipo: 'oficina',
            distanciaKms: 0,
            anomalias: res.anomaliasVisuais?.join('; ') || 'Entrada na oficina via Scanner IA.',
            servicos: [],
            servicosAdicionais: [],
            pecas: [],
            pecasAdicionais: [],
            mensagens: [
              {
                id: db.generateId('msg'),
                user: 'Scanner IA',
                text: `Matrícula ${res.matricula} reconhecida com sucesso (${res.origem}).`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ],
            fotos: [],
            fotosCliente: [],
            notasCliente: '',
            previsaoRevisaoKms: (res.odometroKm || existing.kmsAtuais || 0) + 15000,
            previsaoRevisaoHoras: (res.odometroHoras || existing.horasAtuais || 0) + 500,
            equipamentoFuncionando: 'Sim'
          };

          db.insert(STORAGE_KEYS.FOLHAS_SERVICO, newFs);
          handleSelectFolhaDirect(newFs);
        }
      } else {
        // Register new equipment automatically or open oficina
        const newEq: Equipamento = {
          id: db.generateId('eq'),
          matricula: res.matricula,
          marca: res.marcaModelo?.split(' ')[0] || 'Desconhecida',
          modelo: res.marcaModelo?.split(' ').slice(1).join(' ') || 'Geral',
          tipo: res.tipoEquipamento || 'Ligeiro',
          kmsAtuais: res.odometroKm || 0,
          horasAtuais: res.odometroHoras || 0,
          empresaId: empresas[0]?.id || ''
        };
        db.insert(STORAGE_KEYS.EQUIPAMENTOS, newEq);
        handleSelectTab('equipamentos');
      }
    }
  };

  // If opening via invite token link, show registration modal
  if (conviteToken) {
    return (
      <RegistoConviteModal
        token={conviteToken}
        onClose={() => {
          setConviteToken(null);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('convite');
            window.history.replaceState({}, document.title, url.pathname);
          }
        }}
        onRegisterSuccess={(newUser) => {
          setConviteToken(null);
          loadAllData();
          handleLogin(newUser);
        }}
      />
    );
  }

  // If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<FullscreenFallback />}>
        <Login utilizadores={utilizadores} onLogin={handleLogin} theme={theme} />
      </Suspense>
    );
  }

  if (isMobileRoute) {
    return (
      <Suspense fallback={<FullscreenFallback />}>
        <MobileApp
          theme={theme}
          onToggleTheme={toggleTheme}
          onSwitchToDesktop={navigateToDesktop}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  const openFolhasCount = folhas.filter(f => {
    if (f.status.startsWith('FEITO') || f.status === 'Concluído' || f.status === 'Feito') return false;
    const isInOficina =
      f.localizacaoTipo === 'oficina' ||
      f.tipo === 'Oficina' ||
      f.status.startsWith('OF -') ||
      f.localizacao?.toLowerCase().includes('oficina');
    return !isInOficina;
  }).length;

  return (
    <div className={`min-h-screen flex selection:bg-hp-500 selection:text-white transition-colors ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0b1120] text-slate-100'}`}>
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchToMobile={navigateToMobile}
        openFolhasCount={openFolhasCount}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        users={utilizadores}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarOpen ? 'lg:pl-72' : 'lg:pl-0'}`}>
        {/* Sticky Top Header Navbar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={handleSelectTab}
          onOpenScanner={() => setIsScannerOpen(true)}
          onToggleSidebar={toggleSidebar}
          isSidebarOpen={isSidebarOpen}
          onCreateNewService={handleCreateNewServiceDirect}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSwitchToMobile={navigateToMobile}
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          users={utilizadores}
          onLogout={handleLogout}
        />

        {/* Banner de Atualização Disponível (Especialmente útil para PWAs instaladas no Desktop) */}
        {updateAvailable && (
          <div className="sticky top-[53px] z-20 bg-gradient-to-r from-hp-600 via-blue-600 to-indigo-600 text-white px-4 py-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border-b border-hp-400/40">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>Nova versão da Oficina HP disponível no EasyPanel! Atualize para carregar as alterações mais recentes.</span>
            </div>
            <button
              type="button"
              onClick={reloadAppWithCacheClear}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 text-hp-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-hp-600" />
              <span>Atualizar Agora</span>
            </button>
          </div>
        )}

        {/* Dynamic Page Container */}
        <main className="flex-1 px-4 sm:px-6 py-4 max-w-7xl w-full mx-auto">
          <Suspense fallback={<PageFallback />}>
            {activeTab === 'dashboard' && (
            <Dashboard
              folhasServico={folhas}
              propostas={propostas}
              equipamentos={equipamentos}
              empresas={empresas}
              setActiveTab={handleSelectTab}
              onOpenScanner={() => setIsScannerOpen(true)}
              onSelectFolha={handleSelectFolhaDirect}
              onCreateNewService={handleCreateNewServiceDirect}
            />
          )}

          {activeTab === 'mapa' && (
            <MapaPortugal
              folhas={folhas}
              empresas={empresas}
              clientes={clientes}
              equipamentos={equipamentos}
              onSelectFolha={handleSelectFolhaDirect}
              theme={theme}
            />
          )}

          {activeTab === 'oficina' && (
            <Oficina
              folhas={folhas}
              empresas={empresas}
              equipamentos={equipamentos}
              clientes={clientes}
              catalogoPecas={pecas}
              kits={kits}
              contratos={contratos}
              onOpenScanner={() => setIsScannerOpen(true)}
              selectedFolhaToOpen={selectedFolha}
              onClearSelectedFolha={handleClearSelectedFolha}
              onSelectFolha={handleSelectFolhaDirect}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'kanban' && (
            <Kanban
              folhas={folhas}
              empresas={empresas}
              equipamentos={equipamentos}
              onSelectFolha={handleSelectFolhaDirect}
            />
          )}

          {activeTab === 'tarefas' && (
            <Tarefas
              tarefas={tarefas}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'propostas' && (
            <Propostas
              propostas={propostas}
              empresas={empresas}
              equipamentos={equipamentos}
              clientes={clientes}
              catalogoPecas={pecas}
              onNavigateToFolha={handleSelectFolhaDirect}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'empresas' && (
            <Empresas
              empresas={empresas}
              equipamentos={equipamentos}
              clientes={clientes}
              folhas={folhas}
              onSelectFolha={handleSelectFolhaDirect}
            />
          )}

          {activeTab === 'clientes' && (
            <Clientes
              clientes={clientes}
              empresas={empresas}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'equipamentos' && (
            <Equipamentos
              equipamentos={equipamentos}
              empresas={empresas}
              folhas={folhas}
              onOpenScanner={() => setIsScannerOpen(true)}
              onSelectFolha={handleSelectFolhaDirect}
              onCreateNewServiceDirect={handleCreateNewServiceDirect}
            />
          )}

          {activeTab === 'pecas' && (
            <Pecas
              pecas={pecas}
              folhas={folhas}
              kits={kits}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'pedidos-pecas' && (
            <PedidosPecas
              pedidos={pedidos}
              catalogoPecas={pecas}
              folhas={folhas}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'guias-envio' && (
            <GuiasEnvio
              guias={guias}
              empresas={empresas}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'contratos' && (
            <Contratos
              contratos={contratos}
              empresas={empresas}
              equipamentos={equipamentos}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'atividade-semanal' && (
            <AtividadeSemanal
              folhas={folhas}
              tarefas={tarefas}
              empresas={empresas}
              equipamentos={equipamentos}
              clientes={clientes}
              onSelectFolha={handleSelectFolhaDirect}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'planeamento' && (
            <Planeamento
              folhas={folhas}
              empresas={empresas}
              clientes={clientes}
              equipamentos={equipamentos}
              visitas={visitas}
              onSaveVisita={handleSaveVisita}
              onDeleteVisita={handleDeleteVisita}
              onUpdateFolha={handleUpdateFolhaDirect}
              onSelectFolha={handleSelectFolhaDirect}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'automacoes' && (
            currentUser.role === 'administrador' ? (
              <Automacoes />
            ) : (
              <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                  👑
                </div>
                <h3 className="text-xl font-bold text-white">Acesso Exclusivo ao Administrador</h3>
                <p className="text-slate-300 text-xs leading-relaxed">
                  O Centro de Automações e Disparos Programados de Email é de uso restrito da administração da Oficina HP.
                </p>
              </div>
            )
          )}

          {activeTab === 'tempos-resposta' && (
            <TemposResposta
              folhas={folhas}
              empresas={empresas}
              equipamentos={equipamentos}
              onSelectFolha={handleSelectFolhaDirect}
            />
          )}

          {activeTab === 'configuracoes' && (
            currentUser.role === 'administrador' ? (
              <Configuracoes
                theme={theme}
                onToggleTheme={toggleTheme}
              />
            ) : (
              <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
                  👑
                </div>
                <h3 className="text-xl font-bold text-white">Acesso Exclusivo ao Administrador</h3>
                <p className="text-slate-300 text-xs leading-relaxed">
                  Apenas o perfil de <strong>Administrador (Hugo Portugal)</strong> tem acesso às Configurações Gerais & IA da Oficina.
                </p>
              </div>
            )
          )}
          </Suspense>
        </main>
      </div>

      {/* Camera / AI Vision Scanner Modal (Carregado apenas quando aberto) */}
      {isScannerOpen && (
        <Suspense fallback={null}>
          <CameraScannerModal
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onScanComplete={handleScanComplete}
          />
        </Suspense>
      )}

      {/* PWA Install Prompt */}
      <InstallPwaPrompt theme={theme} />
    </div>
  );
}
