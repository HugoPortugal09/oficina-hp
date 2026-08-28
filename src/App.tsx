import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { CameraScannerModal } from './components/CameraScannerModal';
import { Dashboard } from './pages/Dashboard';
import { MapaPortugal } from './pages/MapaPortugal';
import { Oficina } from './pages/Oficina';
import { Kanban } from './pages/Kanban';
import { Propostas } from './pages/Propostas';
import { Empresas } from './pages/Empresas';
import { Clientes } from './pages/Clientes';
import { Equipamentos } from './pages/Equipamentos';
import { Pecas } from './pages/Pecas';
import { PedidosPecas } from './pages/PedidosPecas';
import { GuiasEnvio } from './pages/GuiasEnvio';
import { Contratos } from './pages/Contratos';
import { Tarefas } from './pages/Tarefas';
import { AtividadeSemanal } from './pages/AtividadeSemanal';
import { Planeamento } from './pages/Planeamento';
import { TemposResposta } from './pages/TemposResposta';
import { Configuracoes } from './pages/Configuracoes';
import { MobileApp } from './pages/MobileApp';
import { Login } from './pages/Login';

import { db, STORAGE_KEYS } from './services/dbService';
import { syncPullFromCloud, subscribeToRealtimeSync } from './services/pocketbaseSync';
import type {
  NavigationTab,
  FolhaServico,
  Proposta,
  Empresa,
  Cliente,
  Equipamento,
  PecaCatalogo,
  PedidoPeca,
  GuiaEnvio,
  Contrato,
  Tarefa,
  VisitaCliente,
  VisionScanResult,
  UserProfile
} from './types';
import { USERS, getPermissionsForRole } from './types';

export default function App() {
  // Check if current URL route is /mobile
  const [isMobileRoute, setIsMobileRoute] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return (
        window.location.pathname.startsWith('/mobile') ||
        window.location.search.includes('mobile=1') ||
        window.location.hash.startsWith('#/mobile')
      );
    }
    return false;
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setIsMobileRoute(
        window.location.pathname.startsWith('/mobile') ||
        window.location.search.includes('mobile=1') ||
        window.location.hash.startsWith('#/mobile')
      );
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateToMobile = () => {
    window.history.pushState(null, '', '/mobile');
    setIsMobileRoute(true);
  };

  const navigateToDesktop = () => {
    window.history.pushState(null, '', '/');
    setIsMobileRoute(false);
  };

  // Active User Profile State (Administrador, Gestor, Técnico)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const savedId = localStorage.getItem('oficina_hp_session_user_id') || localStorage.getItem('oficina_hp_active_user_id');
      if (savedId) {
        const fromDb = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES) || USERS;
        const found = fromDb.find(u => u.id === savedId);
        if (found) return found;
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
    setCurrentUser(user);
    setIsAuthenticated(true);
    try {
      localStorage.setItem('oficina_hp_session_user_id', user.id);
      localStorage.setItem('oficina_hp_active_user_id', user.id);
    } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      localStorage.removeItem('oficina_hp_session_user_id');
    } catch {}
  };

  const handleSelectUser = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('oficina_hp_active_user_id', user.id);
      localStorage.setItem('oficina_hp_session_user_id', user.id);
    } catch {}
    if (user.role !== 'administrador' && activeTab === 'configuracoes') {
      setActiveTab('dashboard');
    }
    if (user.role === 'tecnico' && activeTab === 'propostas') {
      setActiveTab('dashboard');
    }
  };

  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
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
  const [pedidos, setPedidos] = useState<PedidoPeca[]>([]);
  const [guias, setGuias] = useState<GuiaEnvio[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [visitas, setVisitas] = useState<VisitaCliente[]>([]);
  const [utilizadores, setUtilizadores] = useState<UserProfile[]>(() => {
    const fromDb = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    return fromDb && fromDb.length > 0 ? fromDb : USERS;
  });

  // Selected item for cross-module navigation
  const [selectedFolha, setSelectedFolha] = useState<FolhaServico | null>(null);

  const loadAllData = () => {
    setFolhas(db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO));
    setPropostas(db.get<Proposta>(STORAGE_KEYS.PROPOSTAS));
    setEmpresas(db.get<Empresa>(STORAGE_KEYS.EMPRESAS));
    setClientes(db.get<Cliente>(STORAGE_KEYS.CLIENTES));
    setEquipamentos(db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS));
    setPecas(db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO));
    setPedidos(db.get<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS));
    setGuias(db.get<GuiaEnvio>(STORAGE_KEYS.GUIAS_ENVIO));
    setContratos(db.get<Contrato>(STORAGE_KEYS.CONTRATOS));
    setTarefas(db.get<Tarefa>(STORAGE_KEYS.TAREFAS));
    setVisitas(db.get<VisitaCliente>(STORAGE_KEYS.VISITAS));
    const loadedUsers = db.get<UserProfile>(STORAGE_KEYS.UTILIZADORES);
    setUtilizadores(loadedUsers && loadedUsers.length > 0 ? loadedUsers : USERS);
  };

  const handleSaveVisita = (visita: VisitaCliente) => {
    const existing = db.get<VisitaCliente>(STORAGE_KEYS.VISITAS);
    const index = existing.findIndex(v => v.id === visita.id);
    let updated: VisitaCliente[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = visita;
    } else {
      updated = [visita, ...existing];
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
    const existing = db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
    const index = existing.findIndex(f => f.id === folha.id);
    let updated: FolhaServico[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = folha;
    } else {
      updated = [folha, ...existing];
    }
    db.save(STORAGE_KEYS.FOLHAS_SERVICO, updated);
    setFolhas(updated);
  };

  useEffect(() => {
    db.initSeed();
    loadAllData();

    // 1. Initial Pull from PocketBase Cloud
    syncPullFromCloud().then(() => {
      loadAllData();
    }).catch(() => {});

    // 2. Realtime SSE Subscription from PocketBase
    const unsubscribeRealtime = subscribeToRealtimeSync();

    // 3. Listener for local database changes
    const handleDbChange = () => {
      loadAllData();
    };

    // 4. Sync on Window Focus (when switching back to browser tab)
    const handleWindowFocus = () => {
      syncPullFromCloud().then(() => loadAllData()).catch(() => {});
    };

    // 5. Periodic Background Sync (every 8 seconds)
    const syncInterval = setInterval(() => {
      syncPullFromCloud().catch(() => {});
    }, 8000);

    window.addEventListener('oficina_hp_db_changed', handleDbChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      unsubscribeRealtime();
      clearInterval(syncInterval);
      window.removeEventListener('oficina_hp_db_changed', handleDbChange);
      window.removeEventListener('focus', handleWindowFocus);
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
          f => f.equipamentoId === existing.id && !f.status.includes('FEITO - Faturado')
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
          setSelectedFolha(newFs);
          setActiveTab('oficina');
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
        setActiveTab('equipamentos');
      }
    }
  };

  const handleSelectFolhaDirect = (fs: FolhaServico) => {
    setSelectedFolha(fs);
    setActiveTab('oficina');
  };

  const handleCreateNewServiceDirect = () => {
    setSelectedFolha(null);
    setActiveTab('oficina');
  };

  // If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return <Login utilizadores={utilizadores} onLogin={handleLogin} theme={theme} />;
  }

  if (isMobileRoute) {
    return (
      <MobileApp
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchToDesktop={navigateToDesktop}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  const openFolhasCount = folhas.filter(f => {
    if (f.status.startsWith('FEITO')) return false;
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
        setActiveTab={setActiveTab}
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
          setActiveTab={setActiveTab}
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

        {/* Dynamic Page Container */}
        <main className="flex-1 px-4 sm:px-6 py-4 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              folhasServico={folhas}
              propostas={propostas}
              equipamentos={equipamentos}
              empresas={empresas}
              setActiveTab={setActiveTab}
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
              contratos={contratos}
              onOpenScanner={() => setIsScannerOpen(true)}
              selectedFolhaToOpen={selectedFolha}
              onClearSelectedFolha={() => setSelectedFolha(null)}
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
            />
          )}

          {activeTab === 'propostas' && (
            <Propostas
              propostas={propostas}
              empresas={empresas}
              equipamentos={equipamentos}
              clientes={clientes}
              catalogoPecas={pecas}
              onNavigateToFolha={(newFs) => {
                setSelectedFolha(newFs);
                setActiveTab('oficina');
              }}
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
            />
          )}

          {activeTab === 'equipamentos' && (
            <Equipamentos
              equipamentos={equipamentos}
              empresas={empresas}
              folhas={folhas}
              onOpenScanner={() => setIsScannerOpen(true)}
              onSelectFolha={handleSelectFolhaDirect}
            />
          )}

          {activeTab === 'pecas' && (
            <Pecas
              pecas={pecas}
              folhas={folhas}
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
            />
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
        </main>
      </div>

      {/* Camera / AI Vision Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanComplete={handleScanComplete}
      />
    </div>
  );
}
