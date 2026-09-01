import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Wrench,
  Calendar,
  FileDown,
  Trash2,
  CheckCircle2,
  Clock,
  Car,
  Building2,
  User,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  Edit,
  Eye,
  Check,
  Send,
  Camera,
  Upload,
  Layers,
  Gauge,
  LayoutGrid,
  Table as TableIcon,
  ChevronDown,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  History,
  Receipt,
  MapPin,
  Navigation,
  UserCheck,
  FileText
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { CameraScannerModal } from '../components/CameraScannerModal';
import { db, STORAGE_KEYS } from '../services/dbService';
import { generateFolhaServicoPDF, generatePropostaPDF } from '../services/pdfService';
import { analyzeInternalNotesWithOllama, type TaskSuggestionFromNotes } from '../services/ollamaService';
import { sendTaskNotificationEmail } from '../services/emailService';
import type {
  FolhaServico,
  Empresa,
  Equipamento,
  Cliente,
  PecaCatalogo,
  Contrato,
  Proposta,
  PropostaLinha,
  StatusFolhaServico,
  TipoServico,
  ServicoItem,
  PecaItem,
  VisionScanResult,
  EstadoHistoricoItem,
  Tarefa,
  UserProfile
} from '../types';
import { getPermissionsForRole, getInitials } from '../types';

interface OficinaProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  clientes: Cliente[];
  catalogoPecas: PecaCatalogo[];
  contratos?: Contrato[];
  onOpenScanner: () => void;
  selectedFolhaToOpen?: FolhaServico | null;
  onClearSelectedFolha?: () => void;
  currentUser?: UserProfile;
}

const AT_STATUSES: StatusFolhaServico[] = [
  'AT - Pedido de Assistência',
  'AT - Enviar proposta',
  'AT - Agendar – Sem requisição',
  'AT - Agendar – Com requisição',
  'AT - Agendado',
  'AT - Aguardar requisição',
  'AT - Com requisição - Aguardar peças'
];

const OF_STATUSES: StatusFolhaServico[] = [
  'OF - Fazer orçamento',
  'OF - Orçamento Enviado – Aguardar resposta',
  'OF - Com requisição - Aguardar agenda',
  'OF - Com requisição - Aguardar viatura',
  'OF - Com requisição - Aguardar peças',
  'OF - Sem requisição - Aguardar peças'
];

const CT_STATUSES: StatusFolhaServico[] = [
  'CT - Contrato'
];

const FEITO_STATUSES: StatusFolhaServico[] = [
  'FEITO - Faturar',
  'FEITO - Aguardar Requisição',
  'FEITO - Submeter Garantia',
  'FEITO - Aguardar Garantia',
  'FEITO - Faturado'
];

const ALL_STATUSES: StatusFolhaServico[] = [
  ...AT_STATUSES,
  ...OF_STATUSES,
  ...CT_STATUSES,
  ...FEITO_STATUSES
];

function getAvailableStatusesForFolha(tipo?: TipoServico, isAdmin: boolean = false, currentStatus?: StatusFolhaServico): StatusFolhaServico[] {
  let baseStatuses: StatusFolhaServico[] = [];
  if (tipo === 'Assistência Técnica') {
    baseStatuses = [...AT_STATUSES];
  } else if (tipo === 'Oficina') {
    baseStatuses = [...OF_STATUSES];
  } else if (tipo === 'Contrato') {
    baseStatuses = [...CT_STATUSES];
  } else {
    // Garantia, Entrega e Formação
    baseStatuses = [...AT_STATUSES, ...OF_STATUSES];
  }

  if (isAdmin) {
    baseStatuses = [...baseStatuses, ...FEITO_STATUSES];
  } else if (currentStatus && currentStatus.startsWith('FEITO') && !baseStatuses.includes(currentStatus)) {
    baseStatuses = [...baseStatuses, currentStatus];
  }

  return Array.from(new Set(baseStatuses));
}

const GRAUMP_LOCATION = 'GRAUMP (Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha)';

function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    const remHours = diffHours % 24;
    return `${diffDays}d ${remHours}h`;
  }
  if (diffHours > 0) {
    const remMins = diffMins % 60;
    return `${diffHours}h ${remMins}m`;
  }
  return `${Math.max(1, diffMins)} min`;
}

// Searchable Combobox for Parts in Catalog (Price-free for Workshop Technical Sheet)
const SearchablePartSelect: React.FC<{
  value?: string;
  catalogo: PecaCatalogo[];
  onSelect: (peca: PecaCatalogo) => void;
}> = ({ value, catalogo, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPart = catalogo.find(p => p.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = catalogo.filter(p =>
    p.referencia.toLowerCase().includes(query.toLowerCase()) ||
    p.designacao.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-52 sm:w-64" ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 hover:border-hp-500 rounded-lg text-xs text-white flex items-center justify-between cursor-pointer"
      >
        <span className="truncate">
          {selectedPart ? `${selectedPart.referencia} - ${selectedPart.designacao}` : '-- Do Catálogo --'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-52 flex flex-col backdrop-blur-xl">
          <div className="p-1.5 border-b border-slate-800">
            <input
              type="text"
              autoFocus
              placeholder="Pesquisar código ou designação..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-hp-500"
            />
          </div>

          <div className="overflow-y-auto flex-1 p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-500">Nenhuma peça encontrada</div>
            ) : (
              filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="w-full text-left p-1.5 rounded-lg hover:bg-hp-600/20 text-xs text-slate-200 flex items-center justify-between group transition-colors"
                >
                  <div className="truncate pr-2">
                    <span className="font-mono font-bold text-hp-400 mr-1.5">{p.referencia}</span>
                    <span className="text-slate-300">{p.designacao}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Oficina: React.FC<OficinaProps> = ({
  folhas,
  empresas,
  equipamentos,
  clientes,
  catalogoPecas,
  contratos = [],
  onOpenScanner,
  selectedFolhaToOpen,
  onClearSelectedFolha,
  currentUser
}) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_oficina');
      if (saved === 'cards' || saved === 'table') return saved;
    } catch {}
    return 'cards';
  });

  const handleSetViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_oficina', mode);
    } catch {}
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFolha, setEditingFolha] = useState<Partial<FolhaServico>>({});
  const [newMessageText, setNewMessageText] = useState('');

  // Plate Autocomplete State
  const [plateQuery, setPlateQuery] = useState('');
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateContainerRef = useRef<HTMLDivElement>(null);

  // Embedded AI Scanner state inside Folha de Obra
  const [isInlineScannerOpen, setIsInlineScannerOpen] = useState(false);
  const [scannerContext, setScannerContext] = useState<'matricula' | 'odometro' | 'peca' | 'geral' | 'foto_anomalias'>('geral');
  const [previewEnlargedPhoto, setPreviewEnlargedPhoto] = useState<string | null>(null);

  // AI Notes Interpretation & Task Generation state
  const [isAnalyzingNotes, setIsAnalyzingNotes] = useState(false);
  const [aiNoteSuggestion, setAiNoteSuggestion] = useState<TaskSuggestionFromNotes | null>(null);
  const [taskCreatedFeedback, setTaskCreatedFeedback] = useState<string | null>(null);

  const filePhotoInputRef = useRef<HTMLInputElement>(null);

  // Contract covered equipment IDs
  const contractEquipIds = contratos
    .filter(c => c.status === 'Ativo')
    .flatMap(c => c.equipamentosIds || []);

  // Filter equipments allowed for selection
  const allowedEquipamentos = equipamentos.filter(eq => {
    if (editingFolha.tipo === 'Contrato') {
      return contractEquipIds.includes(eq.id);
    }
    return true;
  });

  // Matching plate suggestions
  const matchingPlates = allowedEquipamentos.filter(eq =>
    eq.matricula.toLowerCase().includes(plateQuery.toLowerCase()) ||
    eq.marca.toLowerCase().includes(plateQuery.toLowerCase()) ||
    eq.modelo.toLowerCase().includes(plateQuery.toLowerCase())
  );

  // Selected company object
  const selectedCompany = empresas.find(e => e.id === editingFolha.empresaId);

  // Filtered contacts associated with the selected company
  const companyContacts = clientes.filter(c => c.empresaId === editingFolha.empresaId);

  // Intervention location options
  const locationOptions: { label: string; value: string; type: 'oficina' | 'sede' | 'estaleiro'; defaultKm: number }[] = [
    {
      label: 'GRAUMP (Oficina Principal - Albergaria-a-Velha)',
      value: GRAUMP_LOCATION,
      type: 'oficina',
      defaultKm: 0
    }
  ];

  if (selectedCompany) {
    locationOptions.push({
      label: `Sede: ${selectedCompany.nome} (${selectedCompany.moradaSede})`,
      value: `Sede: ${selectedCompany.moradaSede}`,
      type: 'sede',
      defaultKm: 46
    });

    selectedCompany.estaleiros?.forEach(est => {
      locationOptions.push({
        label: `Estaleiro: ${est.nome} (${est.morada})`,
        value: `Estaleiro ${est.nome}: ${est.morada}`,
        type: 'estaleiro',
        defaultKm: 58
      });
    });
  }

  // Handle clicking outside plate dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (plateContainerRef.current && !plateContainerRef.current.contains(e.target as Node)) {
        setIsPlateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open modal if prop passed
  useEffect(() => {
    if (selectedFolhaToOpen) {
      setEditingFolha(selectedFolhaToOpen);
      setPlateQuery(selectedFolhaToOpen.matricula || '');
      setAiNoteSuggestion(null);
      setTaskCreatedFeedback(null);
      setIsModalOpen(true);
      if (onClearSelectedFolha) onClearSelectedFolha();
    }
  }, [selectedFolhaToOpen]);

  const handleOpenCreate = () => {
    const config = db.getConfig();
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');
    const now = new Date().toISOString().split('T')[0];
    setAiNoteSuggestion(null);
    setTaskCreatedFeedback(null);

    const initialHistory: EstadoHistoricoItem[] = [
      {
        status: 'OF - Com requisição - Aguardar agenda',
        dataEntrada: new Date().toISOString()
      }
    ];

    setEditingFolha({
      id: db.generateId('fs'),
      numero: newNum,
      tipo: 'Oficina',
      data: now,
      dataAbertura: now,
      dataEntradaOficina: now,
      dataRequisicao: '',
      dataConclusao: '',
      guiaAT: '',
      status: 'OF - Com requisição - Aguardar agenda',
      empresaId: '',
      equipamentoId: '',
      matricula: '',
      marca: '',
      modelo: '',
      kmsAtuais: 0,
      horasAtuais: 0,
      localizacao: GRAUMP_LOCATION,
      localizacaoTipo: 'oficina',
      distanciaKms: 0,
      pessoaPresente: '',
      anomalias: '',
      servicos: [],
      servicosAdicionais: [],
      pecas: [],
      pecasAdicionais: [],
      mensagens: [],
      fotos: [],
      fotosCliente: [],
      notasCliente: '',
      notasInternas: '',
      previsaoRevisaoKms: 0,
      previsaoRevisaoHoras: 0,
      equipamentoFuncionando: 'Sim',
      equipamentoOperacional: 'Sim',
      equipamentoFinalizado: 'Não',
      historicoEstados: initialHistory
    });
    setPlateQuery('');
    setIsModalOpen(true);
  };

  const handleTipoChange = (newTipo: TipoServico) => {
    const isOficina = newTipo === 'Oficina';
    const isAT = newTipo === 'Assistência Técnica';
    const isContrato = newTipo === 'Contrato';

    let defaultStatus: StatusFolhaServico = 'OF - Com requisição - Aguardar agenda';
    if (isAT) defaultStatus = 'AT - Pedido de Assistência';
    else if (isContrato) defaultStatus = 'CT - Contrato';

    setEditingFolha(prev => ({
      ...prev,
      tipo: newTipo,
      localizacao: isOficina ? GRAUMP_LOCATION : (prev.localizacao === GRAUMP_LOCATION ? '' : prev.localizacao),
      localizacaoTipo: isOficina ? 'oficina' : prev.localizacaoTipo,
      distanciaKms: isOficina ? 0 : prev.distanciaKms,
      status: prev.status?.startsWith('FEITO') ? prev.status : defaultStatus,
      matricula: newTipo === 'Contrato' && prev.equipamentoId && !contractEquipIds.includes(prev.equipamentoId)
        ? '' : prev.matricula
    }));
  };

  const handleEquipamentoFinalizadoChange = (finalizado: 'Sim' | 'Não') => {
    if (finalizado === 'Sim') {
      const now = new Date().toISOString().split('T')[0];
      setEditingFolha(prev => ({
        ...prev,
        equipamentoFinalizado: 'Sim',
        status: 'FEITO - Faturar',
        dataConclusao: prev.dataConclusao || now
      }));
    } else {
      setEditingFolha(prev => ({
        ...prev,
        equipamentoFinalizado: 'Não',
        status: prev.tipo === 'Assistência Técnica'
          ? 'AT - Agendado'
          : prev.tipo === 'Contrato'
          ? 'CT - Contrato'
          : 'OF - Com requisição - Aguardar agenda'
      }));
    }
  };

  const handleSelectPlateItem = (eq: Equipamento) => {
    const associatedCompany = empresas.find(e => e.id === eq.empresaId);
    setEditingFolha(prev => ({
      ...prev,
      equipamentoId: eq.id,
      empresaId: eq.empresaId,
      matricula: eq.matricula,
      marca: eq.marca,
      modelo: eq.modelo,
      nSerie: eq.nSerie,
      kmsAtuais: eq.kmsAtuais || 0,
      horasAtuais: eq.horasAtuais || 0,
      previsaoRevisaoKms: (eq.kmsAtuais || 0) + 15000,
      previsaoRevisaoHoras: (eq.horasAtuais || 0) + 500,
      // Default to GRAUMP unless previously set
      localizacao: prev.localizacao || GRAUMP_LOCATION,
      distanciaKms: prev.localizacao === GRAUMP_LOCATION ? 0 : (prev.distanciaKms || 0)
    }));
    setPlateQuery(eq.matricula);
    setIsPlateDropdownOpen(false);
  };

  const handleLocationChange = (locValue: string) => {
    const found = locationOptions.find(o => o.value === locValue);
    if (locValue === GRAUMP_LOCATION || found?.type === 'oficina') {
      setEditingFolha(prev => ({
        ...prev,
        localizacao: locValue,
        localizacaoTipo: 'oficina',
        distanciaKms: 0
      }));
    } else {
      setEditingFolha(prev => ({
        ...prev,
        localizacao: locValue,
        localizacaoTipo: found?.type || 'estaleiro',
        distanciaKms: found?.defaultKm || 50
      }));
    }
  };

  // Launch inline scanner for specific field inside the Folha
  const handleOpenInlineScanner = (context: 'matricula' | 'odometro' | 'peca' | 'geral' | 'foto_anomalias') => {
    setScannerContext(context);
    setIsInlineScannerOpen(true);
  };

  // Process the result of the scanner directly into editingFolha
  const handleInlineScanComplete = (res: VisionScanResult) => {
    if (scannerContext === 'matricula' && res.matricula) {
      const existing = allowedEquipamentos.find(
        e => e.matricula.toUpperCase() === res.matricula?.toUpperCase()
      );
      if (existing) {
        handleSelectPlateItem(existing);
      } else {
        alert(`Matrícula ${res.matricula} reconhecida, mas não está registada na frota do sistema.`);
      }
    } else if (scannerContext === 'odometro') {
      setEditingFolha(prev => ({
        ...prev,
        kmsAtuais: res.odometroKm !== undefined && res.odometroKm > 0 ? res.odometroKm : prev.kmsAtuais,
        horasAtuais: res.odometroHoras !== undefined && res.odometroHoras > 0 ? res.odometroHoras : prev.horasAtuais
      }));
    } else if (scannerContext === 'peca') {
      const newPart: PecaItem = {
        id: db.generateId('pec'),
        referencia: res.numeroSerie || res.pecasSugeridas?.[0] || 'PEC-SCAN',
        designacao: res.pecasSugeridas?.[0] || res.textoExtraido || 'Peça Identificada por IA',
        qtd: 1,
        concluido: false,
        isLivre: true
      };
      setEditingFolha(prev => ({
        ...prev,
        pecas: [...(prev.pecas || []), newPart]
      }));
    } else if (scannerContext === 'foto_anomalias' || scannerContext === 'geral') {
      const photo = res.imagemBase64;
      const detectedAnomalies = res.anomaliasVisuais && res.anomaliasVisuais.length > 0
        ? res.anomaliasVisuais.join('; ')
        : '';

      setEditingFolha(prev => {
        const updatedFotos = photo ? [...(prev.fotos || []), photo] : prev.fotos;
        const updatedAnomalias = detectedAnomalies
          ? (prev.anomalias ? `${prev.anomalias} | IA: ${detectedAnomalies}` : `IA: ${detectedAnomalies}`)
          : prev.anomalias;

        return {
          ...prev,
          fotos: updatedFotos,
          anomalias: updatedAnomalias,
          kmsAtuais: res.odometroKm || prev.kmsAtuais
        };
      });
    }
  };

  const handleDirectPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setEditingFolha(prev => ({
          ...prev,
          fotos: [...(prev.fotos || []), base64]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setEditingFolha(prev => ({
      ...prev,
      fotos: prev.fotos?.filter((_, i) => i !== index)
    }));
  };

  // Status Change with Duration Tracker
  const handleStatusChange = (newStatus: StatusFolhaServico) => {
    const now = new Date().toISOString();
    const history: EstadoHistoricoItem[] = [...(editingFolha.historicoEstados || [])];

    if (history.length > 0) {
      const lastIndex = history.length - 1;
      const lastItem = history[lastIndex];
      if (lastItem.status !== newStatus) {
        lastItem.dataSaida = now;
        lastItem.duracaoTexto = formatDuration(lastItem.dataEntrada, now);
        history.push({
          status: newStatus,
          dataEntrada: now
        });
      }
    } else {
      history.push({
        status: newStatus,
        dataEntrada: now
      });
    }

    const newTipo: TipoServico | undefined = newStatus.startsWith('AT -')
      ? 'Assistência Técnica'
      : newStatus.startsWith('OF -')
      ? 'Oficina'
      : newStatus.startsWith('CT -')
      ? 'Contrato'
      : undefined;

    setEditingFolha(prev => ({
      ...prev,
      status: newStatus,
      ...(newTipo ? { tipo: newTipo } : {}),
      historicoEstados: history
    }));
  };

  // AI Analysis of Internal Notes
  const handleAnalyzeNotes = async (customText?: string) => {
    const text = customText !== undefined ? customText : (editingFolha.notasInternas || '');
    if (!text || text.trim().length === 0) {
      setAiNoteSuggestion(null);
      return;
    }
    setIsAnalyzingNotes(true);
    try {
      const res = await analyzeInternalNotesWithOllama(text, {
        numeroFolha: editingFolha.numero,
        matricula: editingFolha.matricula,
        nomeEmpresa: selectedCompany?.nome
      });
      setAiNoteSuggestion(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzingNotes(false);
    }
  };

  const handleCreateTaskFromAi = (suggestion?: TaskSuggestionFromNotes) => {
    const target = suggestion || aiNoteSuggestion;
    if (!target || !target.tarefa) return;

    const newNum = db.generateSequenceNumber(STORAGE_KEYS.TAREFAS, 'TAR');
    const userIniciais = getInitials(currentUser?.nome || currentUser?.avatar || 'HP');
    const userNome = currentUser?.nome || 'Hugo Portugal';

    const novaTarefa: Tarefa = {
      id: db.generateId('tar'),
      numero: newNum,
      descricao: target.tarefa.descricao,
      prioridade: target.tarefa.prioridade,
      responsavel: target.tarefa.responsavel || userNome,
      dataLimite: target.tarefa.dataLimite,
      notasAdicionais: target.tarefa.notasAdicionais,
      status: 'Pendente',
      criadoPorIniciais: userIniciais,
      criadoPorNome: userNome,
      dataCriacao: new Date().toISOString().split('T')[0]
    };

    db.insert(STORAGE_KEYS.TAREFAS, novaTarefa);

    // Envio automático de notificação por email para os envolvidos
    sendTaskNotificationEmail({
      action: 'CRIADA',
      tarefa: novaTarefa,
      currentUser
    });

    setTaskCreatedFeedback(`Tarefa ${newNum} ("${novaTarefa.descricao}") criada com sucesso no menu Tarefas!`);
    setTimeout(() => setTaskCreatedFeedback(null), 6000);
  };

  const handleSaveFolha = () => {
    if (!editingFolha.matricula || !editingFolha.equipamentoId) {
      alert('Por favor, selecione uma matrícula registada no sistema.');
      return;
    }

    // Update history end for the active status to keep durations fresh
    const now = new Date().toISOString();
    const history: EstadoHistoricoItem[] = [...(editingFolha.historicoEstados || [])];
    if (history.length > 0) {
      const last = history[history.length - 1];
      last.duracaoTexto = formatDuration(last.dataEntrada, now);
    }

    const folhaToSave: FolhaServico = {
      ...editingFolha,
      historicoEstados: history
    } as FolhaServico;

    const currentList = db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
    const existingIndex = currentList.findIndex(f => f.id === folhaToSave.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.FOLHAS_SERVICO, folhaToSave.id, folhaToSave);
    } else {
      db.insert(STORAGE_KEYS.FOLHAS_SERVICO, folhaToSave);
    }

    // Update equipment mileage / hours in fleet
    if (folhaToSave.equipamentoId) {
      db.update<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS, folhaToSave.equipamentoId, {
        kmsAtuais: folhaToSave.kmsAtuais,
        horasAtuais: folhaToSave.horasAtuais
      });
    }

    setIsModalOpen(false);
  };

  // Generate Proposta / Orçamento from Additional items (or all items)
  const handleGenerateOrçamentoFromAdicionais = () => {
    const config = db.getConfig();
    const adicServices = editingFolha.servicosAdicionais || [];
    const adicParts = editingFolha.pecasAdicionais || [];

    if (adicServices.length === 0 && adicParts.length === 0) {
      alert('Não existem serviços ou peças adicionais registados nesta folha.');
      return;
    }

    const newNum = db.generateSequenceNumber(STORAGE_KEYS.PROPOSTAS, 'PR');
    const empresa = empresas.find(e => e.id === editingFolha.empresaId);
    const cliente = clientes.find(c => c.empresaId === editingFolha.empresaId);

    const linhas: PropostaLinha[] = [];

    // Add additional services
    adicServices.forEach(s => {
      const vHora = s.valorHora || config.valorHoraPadrao;
      const subtotal = s.horas * vHora;
      linhas.push({
        id: db.generateId('lin'),
        tipo: 'servico',
        codigo: 'MO-ADIC',
        descricao: `[Mão-de-Obra Adicional] ${s.descricao}`,
        quantidade: s.horas,
        precoUnitario: vHora,
        desconto: 0,
        taxaIva: config.ivaPadrao || 23,
        subtotal: subtotal
      });
    });

    // Add additional parts
    adicParts.forEach(p => {
      const catalogItem = catalogoPecas.find(c => c.id === p.pecaId);
      const precoUnit = catalogItem ? catalogItem.precoVenda : (p.precoUnitario || 45.0);
      const subtotal = p.qtd * precoUnit;
      linhas.push({
        id: db.generateId('lin'),
        tipo: 'peca',
        codigo: p.referencia || catalogItem?.referencia || 'PEC-ADIC',
        descricao: `[Material Adicional] ${p.designacao}`,
        quantidade: p.qtd,
        precoUnitario: precoUnit,
        desconto: 0,
        taxaIva: catalogItem?.taxaIva || config.ivaPadrao || 23,
        subtotal: subtotal
      });
    });

    const totalSemIva = linhas.reduce((acc, l) => acc + l.subtotal, 0);
    const totalIva = totalSemIva * ((config.ivaPadrao || 23) / 100);
    const totalComIva = totalSemIva + totalIva;

    const novaProposta: Proposta = {
      id: db.generateId('prop'),
      numero: newNum,
      data: new Date().toISOString().split('T')[0],
      dataValidade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Rascunho',
      empresaId: editingFolha.empresaId || '',
      nomeEmpresa: empresa?.nome || 'Cliente',
      clienteId: cliente?.id,
      nomeCliente: cliente?.nome || 'Exmo. Cliente',
      equipamentoId: editingFolha.equipamentoId,
      matricula: editingFolha.matricula,
      marcaModelo: `${editingFolha.marca || ''} ${editingFolha.modelo || ''}`.trim(),
      descricao: `Orçamento de trabalhos e peças adicionais referente à Folha ${editingFolha.numero} (${editingFolha.matricula}).`,
      condicoesPagamento: '30 dias',
      prazoEntrega: 'Imediato / Em execução',
      garantia: 'Garantia standard Oficina HP',
      linhas: linhas,
      totalSemIva: Math.round(totalSemIva * 100) / 100,
      totalIva: Math.round(totalIva * 100) / 100,
      totalComIva: Math.round(totalComIva * 100) / 100,
      folhaServicoId: editingFolha.id,
      criadoEm: new Date().toISOString()
    };

    db.insert(STORAGE_KEYS.PROPOSTAS, novaProposta);

    if (confirm(`Orçamento ${newNum} gerado com sucesso com ${linhas.length} itens adicionais no valor total de ${totalComIva.toFixed(2)} €.\n\nDeseja descarregar o PDF do Orçamento agora?`)) {
      generatePropostaPDF(novaProposta, empresa);
    }
  };

  const handleDeleteFolha = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta Folha de Serviço?')) {
      db.delete(STORAGE_KEYS.FOLHAS_SERVICO, id);
      setIsModalOpen(false);
    }
  };

  // Standard Services lines
  const handleAddService = (isAdicional: boolean = false) => {
    const config = db.getConfig();
    const newService: ServicoItem = {
      id: db.generateId('srv'),
      descricao: '',
      horas: 1.0,
      valorHora: config.valorHoraPadrao,
      concluido: false,
      tecnico: getInitials(currentUser?.avatar || 'HP'),
      iniciaisConclusao: getInitials(currentUser?.avatar || 'HP')
    };

    if (isAdicional) {
      setEditingFolha(prev => ({
        ...prev,
        servicosAdicionais: [...(prev.servicosAdicionais || []), newService]
      }));
    } else {
      setEditingFolha(prev => ({
        ...prev,
        servicos: [...(prev.servicos || []), newService]
      }));
    }
  };

  const handleUpdateService = (id: string, field: keyof ServicoItem, value: any, isAdicional: boolean = false) => {
    const targetKey = isAdicional ? 'servicosAdicionais' : 'servicos';
    const today = new Date().toLocaleDateString('pt-PT');
    setEditingFolha(prev => ({
      ...prev,
      [targetKey]: prev[targetKey]?.map(s => {
        if (s.id !== id) return s;
        if (field === 'concluido') {
          const checked = Boolean(value);
          const initials = getInitials(s.tecnico || currentUser?.avatar || 'HP');
          return {
            ...s,
            concluido: checked,
            dataConclusao: checked ? (s.dataConclusao || today) : undefined,
            tecnico: initials,
            iniciaisConclusao: checked ? initials : undefined
          };
        }
        if (field === 'tecnico') {
          const initials = getInitials(value);
          return { ...s, tecnico: initials, iniciaisConclusao: initials };
        }
        return { ...s, [field]: value };
      })
    }));
  };

  const handleRemoveService = (id: string, isAdicional: boolean = false) => {
    const targetKey = isAdicional ? 'servicosAdicionais' : 'servicos';
    setEditingFolha(prev => ({
      ...prev,
      [targetKey]: prev[targetKey]?.filter(s => s.id !== id)
    }));
  };

  // Parts lines (Price-free for Workshop Technical Sheet)
  const handleAddPart = (isAdicional: boolean = false) => {
    const isExcluded = editingFolha.tipo === 'Oficina' || editingFolha.tipo === 'Entrega e Formação';
    if (!isExcluded && !editingFolha.guiaAT) {
      const guiaPrompt = window.prompt('Deseja introduzir o Nº da Guia AT para este serviço com aplicação de peças? (Opcional, deixe em branco para avançar):');
      if (guiaPrompt && guiaPrompt.trim()) {
        setEditingFolha(prev => ({ ...prev, guiaAT: guiaPrompt.trim() }));
      }
    }

    const newPart: PecaItem = {
      id: db.generateId('pec'),
      designacao: '',
      qtd: 1,
      concluido: false,
      isLivre: true,
      iniciaisConclusao: getInitials(currentUser?.avatar || 'HP')
    };
    if (isAdicional) {
      setEditingFolha(prev => ({
        ...prev,
        pecasAdicionais: [...(prev.pecasAdicionais || []), newPart]
      }));
    } else {
      setEditingFolha(prev => ({
        ...prev,
        pecas: [...(prev.pecas || []), newPart]
      }));
    }
  };

  const handleSelectCatalogPart = (part: PecaCatalogo, itemLineId: string, isAdicional: boolean = false) => {
    const targetKey = isAdicional ? 'pecasAdicionais' : 'pecas';
    setEditingFolha(prev => ({
      ...prev,
      [targetKey]: prev[targetKey]?.map(p => p.id === itemLineId ? {
        ...p,
        pecaId: part.id,
        referencia: part.referencia,
        designacao: part.designacao,
        precoUnitario: part.precoVenda,
        isLivre: false
      } : p)
    }));
  };

  const handleUpdatePart = (id: string, field: keyof PecaItem, value: any, isAdicional: boolean = false) => {
    const targetKey = isAdicional ? 'pecasAdicionais' : 'pecas';
    const today = new Date().toLocaleDateString('pt-PT');
    setEditingFolha(prev => ({
      ...prev,
      [targetKey]: prev[targetKey]?.map(p => {
        if (p.id !== id) return p;
        if (field === 'concluido') {
          const checked = Boolean(value);
          const initials = getInitials(p.iniciaisConclusao || currentUser?.avatar || 'HP');
          return {
            ...p,
            concluido: checked,
            dataConclusao: checked ? (p.dataConclusao || today) : undefined,
            iniciaisConclusao: initials
          };
        }
        if (field === 'iniciaisConclusao') {
          const initials = getInitials(value);
          return { ...p, iniciaisConclusao: initials };
        }
        return { ...p, [field]: value };
      })
    }));
  };

  const handleRemovePart = (id: string, isAdicional: boolean = false) => {
    const targetKey = isAdicional ? 'pecasAdicionais' : 'pecas';
    setEditingFolha(prev => ({
      ...prev,
      [targetKey]: prev[targetKey]?.filter(p => p.id !== id)
    }));
  };

  // Technical Messages
  const handleAddMessage = () => {
    if (!newMessageText.trim()) return;
    const msg = {
      id: db.generateId('msg'),
      user: 'Hugo Portugal',
      text: newMessageText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setEditingFolha(prev => ({
      ...prev,
      mensagens: [...(prev.mensagens || []), msg]
    }));
    setNewMessageText('');
  };

  // Filtered Folhas
  const filteredFolhas = folhas.filter(f => {
    const matchesSearch =
      f.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.marca.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.anomalias && f.anomalias.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'TODOS' || f.status === filterStatus;
    
    // Resolve effective category from status prefix or tipo
    const effectiveTipo = f.status.startsWith('AT -')
      ? 'Assistência Técnica'
      : f.status.startsWith('OF -')
      ? 'Oficina'
      : f.status.startsWith('CT -')
      ? 'Contrato'
      : f.tipo;

    const matchesTipo = filterTipo === 'TODOS' || effectiveTipo === filterTipo || f.tipo === filterTipo;

    return matchesSearch && matchesStatus && matchesTipo;
  });

  const hasAdicionais = ((editingFolha.servicosAdicionais?.length || 0) > 0) || ((editingFolha.pecasAdicionais?.length || 0) > 0);

  return (
    <div className="space-y-3.5">
      {/* Controls & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar por matrícula, número FS, anomalia..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODOS">Todos os Estados</option>
            {ALL_STATUSES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={filterTipo}
            onChange={e => setFilterTipo(e.target.value)}
            className="py-1.5 px-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-hp-500"
          >
            <option value="TODOS">Todos os Tipos</option>
            <option value="Oficina">Oficina</option>
            <option value="Assistência Técnica">Assistência Técnica</option>
            <option value="Garantia">Garantia</option>
            <option value="Entrega e Formação">Entrega e Formação</option>
            <option value="Contrato">Contrato</option>
          </select>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-700/80">
            <button
              onClick={() => handleSetViewMode('cards')}
              title="Vista em Blocos"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'cards' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleSetViewMode('table')}
              title="Vista em Tabela"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-hp-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onOpenScanner}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Scanner Geral</span>
          </button>

          {permissions.canEditServicos && (
            <button
              onClick={handleOpenCreate}
              className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-4 h-4" />
              Nova Folha
            </button>
          )}
        </div>
      </div>

      {/* View Mode: Cards (Grid) */}
      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredFolhas.map(fs => {
            const empresa = empresas.find(e => e.id === fs.empresaId);
            const totalServices = (fs.servicos?.length || 0) + (fs.servicosAdicionais?.length || 0);
            const servicesDone = (fs.servicos?.filter(s => s.concluido).length || 0) + (fs.servicosAdicionais?.filter(s => s.concluido).length || 0);
            const totalParts = (fs.pecas?.length || 0) + (fs.pecasAdicionais?.length || 0);
            const partsDone = (fs.pecas?.filter(p => p.concluido).length || 0) + (fs.pecasAdicionais?.filter(p => p.concluido).length || 0);
            const photosCount = fs.fotos?.length || 0;

            return (
              <GlassCard
                key={fs.id}
                onClick={() => {
                  setEditingFolha(fs);
                  setPlateQuery(fs.matricula || '');
                  setIsModalOpen(true);
                }}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-hp-400">{fs.numero}</span>
                        {fs.tipo === 'Contrato' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                            Contrato
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-extrabold text-white mt-0.5 flex items-center gap-2">
                        <span className="font-mono px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-200 text-sm group-hover:border-hp-500/50 transition-colors">
                          {fs.matricula}
                        </span>
                      </h4>
                      <p className="text-xs text-slate-300 font-medium mt-1">
                        {fs.marca} {fs.modelo}
                      </p>
                    </div>

                    <div className="text-right">
                      <Badge variant={fs.status.startsWith('FEITO') ? 'success' : fs.status.startsWith('AT') ? 'info' : 'warning'}>
                        {fs.status.split(' - ')[1] || fs.status}
                      </Badge>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">{fs.data}</p>
                    </div>
                  </div>

                  {/* Company & Location */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-hp-400" />
                      <span className="truncate">{empresa?.nome || 'Empresa Geral'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Car className="w-3.5 h-3.5 text-slate-500" />
                        <span>{fs.kmsAtuais.toLocaleString()} Km | {fs.horasAtuais}h</span>
                      </div>
                      {photosCount > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-hp-400">
                          <ImageIcon className="w-3 h-3" /> {photosCount} foto{photosCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Anomalies Preview */}
                  {fs.anomalias && (
                    <p className="mt-2.5 text-xs text-slate-300 bg-slate-950/50 p-2 rounded-xl border border-slate-800/60 line-clamp-2">
                      {fs.anomalias}
                    </p>
                  )}
                </div>

                {/* Footer / Stats & Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                    <span>Serviços: <b className="text-slate-200">{servicesDone}/{totalServices}</b></span>
                    <span>Peças: <b className="text-slate-200">{partsDone}/{totalParts}</b></span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setEditingFolha(fs);
                        setPlateQuery(fs.matricula || '');
                        handleOpenInlineScanner('foto_anomalias');
                      }}
                      title="Digitalizar Fotos / Análise IA para esta Folha"
                      className="p-1.5 text-amber-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => generateFolhaServicoPDF(fs, empresa)}
                      title="Exportar PDF Oficial (Sem preços nem códigos)"
                      className="p-1.5 text-slate-400 hover:text-hp-400 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => {
                        setEditingFolha(fs);
                        setPlateQuery(fs.matricula || '');
                        setIsModalOpen(true);
                      }}
                      title="Editar Folha"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        /* View Mode: Table */
        <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase font-mono tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Matrícula</th>
                  <th className="py-3 px-4">Marca / Modelo</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Estado / Kanban</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredFolhas.map(fs => {
                  const empresa = empresas.find(e => e.id === fs.empresaId);
                  return (
                    <tr
                      key={fs.id}
                      onClick={() => {
                        setEditingFolha(fs);
                        setPlateQuery(fs.matricula || '');
                        setIsModalOpen(true);
                      }}
                      className="hover:bg-slate-900/60 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-hp-400">{fs.numero}</td>
                      <td className="py-3 px-4 font-mono font-extrabold text-white">{fs.matricula}</td>
                      <td className="py-3 px-4 text-slate-200">{fs.marca} {fs.modelo}</td>
                      <td className="py-3 px-4 text-slate-300 truncate max-w-[180px]">{empresa?.nome || 'Geral'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          fs.tipo === 'Contrato' ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-300'
                        }`}>
                          {fs.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={fs.status.startsWith('FEITO') ? 'success' : fs.status.startsWith('AT') ? 'info' : 'warning'}>
                          {fs.status.split(' - ')[1] || fs.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">{fs.data}</td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => generateFolhaServicoPDF(fs, empresa)}
                            title="Exportar PDF"
                            className="p-1.5 text-slate-400 hover:text-hp-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingFolha(fs);
                              setPlateQuery(fs.matricula || '');
                              setIsModalOpen(true);
                            }}
                            title="Editar"
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create Folha de Serviço Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`${editingFolha.id?.startsWith('fs_new') ? 'Nova' : 'Editar'} Folha de Serviço: ${editingFolha.numero}`}
          subtitle="Registo técnico de oficina, serviços executados, materiais e historial"
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* TOP ACTION BAR: Cancelar, Gerar Orçamento, Guardar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 font-mono">
                  {editingFolha.numero}
                </span>
                {hasAdicionais && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Com Trabalhos Adicionais
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {hasAdicionais && (
                  <button
                    type="button"
                    onClick={handleGenerateOrçamentoFromAdicionais}
                    className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    Gerar Orçamento de Adicionais
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveFolha}
                  className="glass-btn py-1.5 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Folha de Serviço
                </button>
              </div>
            </div>

            {/* Top Row: Meta Info & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Tipo de Serviço</label>
                <select
                  value={editingFolha.tipo || 'Oficina'}
                  onChange={e => handleTipoChange(e.target.value as TipoServico)}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Oficina">Oficina</option>
                  <option value="Assistência Técnica">Assistência Técnica</option>
                  <option value="Garantia">Garantia</option>
                  <option value="Entrega e Formação">Entrega e Formação</option>
                  <option value="Contrato">Contrato</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-400 block">Estado / Etapa Kanban</label>
                  {currentUser?.role !== 'administrador' && (
                    <span className="text-[9px] text-slate-500 font-mono" title="Estados FEITO reservados a Administrador">
                      Restrito
                    </span>
                  )}
                </div>
                <select
                  value={editingFolha.status || (editingFolha.tipo === 'Assistência Técnica' ? 'AT - Pedido de Assistência' : 'OF - Com requisição - Aguardar agenda')}
                  onChange={e => handleStatusChange(e.target.value as StatusFolhaServico)}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  {getAvailableStatusesForFolha(editingFolha.tipo, currentUser?.role === 'administrador', editingFolha.status).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Data da Intervenção</label>
                <input
                  type="date"
                  value={editingFolha.data || ''}
                  onChange={e => setEditingFolha(prev => ({ ...prev, data: e.target.value }))}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Data de Abertura <span className="text-[10px] text-emerald-400 font-mono">(Automática)</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={editingFolha.dataAbertura || editingFolha.data || new Date().toISOString().split('T')[0]}
                  className="w-full py-1.5 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            {/* Dates: Entrada Oficina, Requisição, Conclusão (Disponíveis apenas para Oficina, Contrato ou Garantia) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 text-xs">
              {['Oficina', 'Contrato', 'Garantia'].includes(editingFolha.tipo || '') ? (
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Data de Entrada Oficina</label>
                  <input
                    type="date"
                    value={editingFolha.dataEntradaOficina || ''}
                    onChange={e => setEditingFolha(prev => ({ ...prev, dataEntradaOficina: e.target.value }))}
                    className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/50 flex items-center text-slate-500 italic text-[11px]">
                  Entrada oficina N/A ({editingFolha.tipo})
                </div>
              )}

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Data de Requisição</label>
                <input
                  type="date"
                  value={editingFolha.dataRequisicao || ''}
                  onChange={e => setEditingFolha(prev => ({ ...prev, dataRequisicao: e.target.value }))}
                  className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {['Oficina', 'Contrato', 'Garantia'].includes(editingFolha.tipo || '') ? (
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Data de Conclusão</label>
                  <input
                    type="date"
                    value={editingFolha.dataConclusao || ''}
                    onChange={e => setEditingFolha(prev => ({ ...prev, dataConclusao: e.target.value }))}
                    className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-slate-900/40 border border-slate-800/50 flex items-center text-slate-500 italic text-[11px]">
                  Conclusão oficina N/A ({editingFolha.tipo})
                </div>
              )}
            </div>

            {/* Vehicle & Customer Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Vehicle Box with Searchable Plate (Only Registered Equipments) */}
              <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-hp-400" />
                    Viatura / Equipamento
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleOpenInlineScanner('matricula')}
                    className="text-[11px] font-semibold text-hp-400 hover:text-hp-300 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-hp-500/10 border border-hp-500/30"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Scanner Matrícula IA
                  </button>
                </div>

                {/* Searchable Matrícula Input */}
                <div className="relative" ref={plateContainerRef}>
                  <label className="text-xs text-slate-400 block mb-1">
                    Matrícula <span className="text-[10px] text-hp-400">(Apenas viaturas registadas)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escreva a matrícula para pesquisar..."
                      value={plateQuery}
                      onChange={e => {
                        setPlateQuery(e.target.value.toUpperCase());
                        setIsPlateDropdownOpen(true);
                      }}
                      onFocus={() => setIsPlateDropdownOpen(true)}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 focus:border-hp-500 rounded-xl text-xs text-white font-mono font-bold tracking-wider"
                    />
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Dropdown with filtered plates */}
                  {isPlateDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {matchingPlates.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500">
                          {editingFolha.tipo === 'Contrato'
                            ? 'Nenhuma viatura sob contrato ativo encontrada.'
                            : 'Nenhuma viatura encontrada no sistema.'}
                        </div>
                      ) : (
                        matchingPlates.map(eq => {
                          const emp = empresas.find(e => e.id === eq.empresaId);
                          return (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => handleSelectPlateItem(eq)}
                              className="w-full text-left p-2.5 hover:bg-hp-600/20 border-b border-slate-800/60 last:border-0 text-xs flex items-center justify-between group transition-colors"
                            >
                              <div>
                                <span className="font-mono font-extrabold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-xs mr-2">
                                  {eq.matricula}
                                </span>
                                <span className="text-slate-300 font-medium">{eq.marca} {eq.modelo}</span>
                              </div>
                              <span className="text-[11px] text-slate-400 truncate max-w-[120px]">{emp?.nome || 'Geral'}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Auto-filled Brand / Model */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Marca / Modelo (Preenchido Automaticamente)</label>
                  <input
                    type="text"
                    readOnly
                    value={`${editingFolha.marca || ''} ${editingFolha.modelo || ''}`.trim() || 'Selecione uma matrícula'}
                    className="w-full py-1.5 px-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold"
                  />
                </div>

                {/* Mileage / Hours with Dedicated Odometer Scanner */}
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-hp-400" />
                      Contadores de Utilização
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenInlineScanner('odometro')}
                      className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      Scanner Painel / Km IA
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block">Quilómetros (Km)</label>
                      <input
                        type="number"
                        value={editingFolha.kmsAtuais || 0}
                        onChange={e => setEditingFolha(prev => ({ ...prev, kmsAtuais: Number(e.target.value) }))}
                        className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block">Horas de Trabalho</label>
                      <input
                        type="number"
                        value={editingFolha.horasAtuais || 0}
                        onChange={e => setEditingFolha(prev => ({ ...prev, horasAtuais: Number(e.target.value) }))}
                        className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer & Location & Deslocação & Pessoa Presente */}
              <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-hp-400" />
                  Empresa & Localização
                </h4>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Empresa Cliente (Auto-Preenchido)</label>
                  <input
                    type="text"
                    readOnly
                    value={selectedCompany?.nome || (editingFolha.empresaId ? 'Empresa Associada' : 'Selecione a matrícula')}
                    className="w-full py-1.5 px-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-200 font-semibold"
                  />
                </div>

                {/* Local de Intervenção: Only GRAUMP or Sede/Estaleiros */}
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-hp-400" />
                    Local de Intervenção <span className="text-[10px] text-hp-400">(GRAUMP ou Locais da Empresa)</span>
                  </label>
                  <select
                    value={editingFolha.localizacao || GRAUMP_LOCATION}
                    onChange={e => handleLocationChange(e.target.value)}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  >
                    {locationOptions.map((opt, idx) => (
                      <option key={idx} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Deslocação KM & Pessoa Presente in a clean grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                      <Navigation className="w-3 h-3 text-hp-400" />
                      Deslocação KM (Ida e Volta)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        disabled={editingFolha.localizacao === GRAUMP_LOCATION}
                        value={editingFolha.distanciaKms || 0}
                        onChange={e => setEditingFolha(prev => ({ ...prev, distanciaKms: Number(e.target.value) }))}
                        className={`w-full py-1 px-2.5 rounded-lg text-xs font-mono font-bold ${
                          editingFolha.localizacao === GRAUMP_LOCATION
                            ? 'bg-slate-900/40 border border-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                      <span className="text-[10px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 font-mono">KM</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5 flex items-center gap-1 font-medium">
                      <UserCheck className="w-3 h-3 text-emerald-400" />
                      Pessoa Presente
                    </label>
                    <select
                      value={editingFolha.pessoaPresente || ''}
                      onChange={e => setEditingFolha(prev => ({ ...prev, pessoaPresente: e.target.value }))}
                      className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                    >
                      <option value="">-- Selecione o contacto --</option>
                      {companyContacts.map(c => (
                        <option key={c.id} value={c.nome}>
                          {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-slate-400 block">Anomalias Reportadas / Pedido</label>
                    <button
                      type="button"
                      onClick={() => handleOpenInlineScanner('foto_anomalias')}
                      className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      Inspecionar c/ IA
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={editingFolha.anomalias || ''}
                    onChange={e => setEditingFolha(prev => ({ ...prev, anomalias: e.target.value }))}
                    placeholder="Descreva as anomalias detetadas..."
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>
            </div>

            {/* Photo Gallery & AI Visual Inspection Section */}
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Fotografias da Obra / Inspeção IA ({editingFolha.fotos?.length || 0})
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenInlineScanner('foto_anomalias')}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-amber-500/30 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Fotografar & Analisar c/ IA
                  </button>

                  <button
                    type="button"
                    onClick={() => filePhotoInputRef.current?.click()}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Carregar Foto
                  </button>
                  <input
                    ref={filePhotoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleDirectPhotoUpload}
                  />
                </div>
              </div>

              {/* Photos Thumbnails Grid */}
              {editingFolha.fotos && editingFolha.fotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {editingFolha.fotos.map((foto, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video border border-slate-800 bg-slate-900">
                      <img
                        src={foto}
                        alt={`Foto ${idx + 1}`}
                        onClick={() => setPreviewEnlargedPhoto(foto)}
                        className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-slate-950/80 text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  Nenhuma fotografia anexada.
                </div>
              )}
            </div>

            {/* 1. Services: MÃO-DE-OBRA & SERVIÇOS EFETUADOS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-hp-400" />
                  Mão-de-Obra & Serviços Efetuados ({editingFolha.servicos?.length || 0})
                </h4>
                <button
                  type="button"
                  onClick={() => handleAddService(false)}
                  className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-hp-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Serviço
                </button>
              </div>

              <div className="space-y-2">
                {editingFolha.servicos?.map(srv => (
                  <div key={srv.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border transition-all ${srv.concluido ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950/80 border-slate-800'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={srv.concluido}
                        onChange={e => handleUpdateService(srv.id, 'concluido', e.target.checked, false)}
                        className="w-4 h-4 rounded text-hp-600 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      {srv.concluido && srv.dataConclusao && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-500/30 shrink-0" title="Data em que o serviço foi concluído">
                          📅 {srv.dataConclusao}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Descrição do serviço..."
                      value={srv.descricao}
                      onChange={e => handleUpdateService(srv.id, 'descricao', e.target.value, false)}
                      className={`flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white ${srv.concluido ? 'line-through text-slate-400' : ''}`}
                    />
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Horas"
                          value={srv.horas}
                          onChange={e => handleUpdateService(srv.id, 'horas', Number(e.target.value), false)}
                          className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center font-bold"
                        />
                        <span className="text-[11px] text-slate-400 font-mono">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Téc:</span>
                        <input
                          type="text"
                          placeholder="HP"
                          maxLength={4}
                          value={getInitials(srv.tecnico || 'HP')}
                          onChange={e => handleUpdateService(srv.id, 'tecnico', e.target.value.toUpperCase(), false)}
                          className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-hp-400 font-mono font-bold text-center uppercase"
                          title="Iniciais do Técnico"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(srv.id, false)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Services: MÃO-DE-OBRA & SERVIÇOS ADICIONAIS */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Mão-de-Obra & Serviços Adicionais ({editingFolha.servicosAdicionais?.length || 0})
                  </h4>
                  <p className="text-[10px] text-slate-400">Serviços efetuados que não constavam do orçamento inicial</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddService(true)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Serviço Adicional
                </button>
              </div>

              <div className="space-y-2">
                {editingFolha.servicosAdicionais?.map(srv => (
                  <div key={srv.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border transition-all ${srv.concluido ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950/80 border-amber-900/40'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={srv.concluido}
                        onChange={e => handleUpdateService(srv.id, 'concluido', e.target.checked, true)}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      {srv.concluido && srv.dataConclusao && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-mono font-bold border border-amber-500/40 shrink-0" title="Data em que o serviço adicional foi concluído">
                          📅 {srv.dataConclusao}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Descrição do serviço adicional..."
                      value={srv.descricao}
                      onChange={e => handleUpdateService(srv.id, 'descricao', e.target.value, true)}
                      className={`flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white ${srv.concluido ? 'line-through text-slate-400' : ''}`}
                    />
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Horas"
                          value={srv.horas}
                          onChange={e => handleUpdateService(srv.id, 'horas', Number(e.target.value), true)}
                          className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center font-bold"
                        />
                        <span className="text-[11px] text-slate-400 font-mono">h</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Téc:</span>
                        <input
                          type="text"
                          placeholder="HP"
                          maxLength={4}
                          value={getInitials(srv.tecnico || 'HP')}
                          onChange={e => handleUpdateService(srv.id, 'tecnico', e.target.value.toUpperCase(), true)}
                          className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-400 font-mono font-bold text-center uppercase"
                          title="Iniciais do Técnico"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(srv.id, true)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Parts: PEÇAS & MATERIAIS APLICADOS (Price-Free) */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-400" />
                  Peças & Materiais Aplicados ({editingFolha.pecas?.length || 0})
                </h4>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenInlineScanner('peca')}
                    className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-indigo-500/30 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Ler Peça c/ IA
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddPart(false)}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-emerald-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Peça
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {editingFolha.pecas?.map(pec => (
                  <div key={pec.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border transition-all ${pec.concluido ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-slate-950/80 border-slate-800'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pec.concluido}
                        onChange={e => handleUpdatePart(pec.id, 'concluido', e.target.checked, false)}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      {pec.concluido && pec.dataConclusao && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-500/30 shrink-0" title="Data em que a peça foi aplicada">
                          📅 {pec.dataConclusao}
                        </span>
                      )}
                      <SearchablePartSelect
                        value={pec.pecaId}
                        catalogo={catalogoPecas}
                        onSelect={part => handleSelectCatalogPart(part, pec.id, false)}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Designação da peça..."
                      value={pec.designacao}
                      onChange={e => handleUpdatePart(pec.id, 'designacao', e.target.value, false)}
                      className={`flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white ${pec.concluido ? 'line-through text-slate-400' : ''}`}
                    />

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-400 font-medium">Qtd:</span>
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={pec.qtd}
                          onChange={e => handleUpdatePart(pec.id, 'qtd', Number(e.target.value), false)}
                          className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Téc:</span>
                        <input
                          type="text"
                          placeholder="HP"
                          maxLength={4}
                          value={getInitials(pec.iniciaisConclusao || 'HP')}
                          onChange={e => handleUpdatePart(pec.id, 'iniciaisConclusao', e.target.value.toUpperCase(), false)}
                          className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-emerald-400 font-mono font-bold text-center uppercase"
                          title="Iniciais do Técnico"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePart(pec.id, false)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Parts: PEÇAS & MATERIAIS ADICIONAIS (Price-Free) */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    Peças & Materiais Adicionais ({editingFolha.pecasAdicionais?.length || 0})
                  </h4>
                  <p className="text-[10px] text-slate-400">Peças aplicadas não orçamentadas inicialmente</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddPart(true)}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Peça Adicional
                </button>
              </div>

              <div className="space-y-2">
                {editingFolha.pecasAdicionais?.map(pec => (
                  <div key={pec.id} className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl border transition-all ${pec.concluido ? 'bg-amber-950/20 border-amber-500/40' : 'bg-slate-950/80 border-amber-900/40'}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pec.concluido}
                        onChange={e => handleUpdatePart(pec.id, 'concluido', e.target.checked, true)}
                        className="w-4 h-4 rounded text-amber-500 bg-slate-900 border-slate-700 cursor-pointer"
                      />
                      {pec.concluido && pec.dataConclusao && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 font-mono font-bold border border-amber-500/40 shrink-0" title="Data em que a peça adicional foi aplicada">
                          📅 {pec.dataConclusao}
                        </span>
                      )}
                      <SearchablePartSelect
                        value={pec.pecaId}
                        catalogo={catalogoPecas}
                        onSelect={part => handleSelectCatalogPart(part, pec.id, true)}
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Designação da peça adicional..."
                      value={pec.designacao}
                      onChange={e => handleUpdatePart(pec.id, 'designacao', e.target.value, true)}
                      className={`flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white ${pec.concluido ? 'line-through text-slate-400' : ''}`}
                    />

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-400 font-medium">Qtd:</span>
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={pec.qtd}
                          onChange={e => handleUpdatePart(pec.id, 'qtd', Number(e.target.value), true)}
                          className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono text-center font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Téc:</span>
                        <input
                          type="text"
                          placeholder="HP"
                          maxLength={4}
                          value={getInitials(pec.iniciaisConclusao || 'HP')}
                          onChange={e => handleUpdatePart(pec.id, 'iniciaisConclusao', e.target.value.toUpperCase(), true)}
                          className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-400 font-mono font-bold text-center uppercase"
                          title="Iniciais do Técnico"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePart(pec.id, true)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Nº GUIA AT (Depois do campo Peças & Materiais Adicionais) */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-hp-400" />
                  Nº Guia AT
                </label>
                <span className="text-[10px] text-slate-400">
                  Guia de Transporte / Assistência Técnica
                </span>
              </div>
              <input
                type="text"
                placeholder="Ex: GAT-2026-00123 ou Nº de documento de saída..."
                value={editingFolha.guiaAT || ''}
                onChange={e => setEditingFolha(prev => ({ ...prev, guiaAT: e.target.value }))}
                className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:border-hp-500"
              />
            </div>

            {/* 6. NOTAS PARA O CLIENTE (Depois das Peças Adicionais e Guia AT) */}
            <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Notas para o Cliente
                </label>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400">
                  Visível no PDF do Cliente
                </span>
              </div>
              <textarea
                rows={2}
                value={editingFolha.notasCliente || ''}
                onChange={e => setEditingFolha(prev => ({ ...prev, notasCliente: e.target.value }))}
                placeholder="Observações, recomendações e notas que irão constar na folha entregue ao cliente..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* 5.1 NOTAS INTERNAS & IA OLLAMA INTERPRETER */}
            <div className="p-4 bg-slate-950/60 rounded-2xl border border-indigo-500/30 space-y-3 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-300 block">
                    Notas Internas
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/80 text-indigo-300 font-medium">
                    Apenas Oficina (Não sai no PDF)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAnalyzeNotes()}
                  disabled={isAnalyzingNotes || !editingFolha.notasInternas}
                  className="px-3 py-1 bg-gradient-to-r from-indigo-600/30 to-hp-600/30 hover:from-indigo-600/50 hover:to-hp-600/50 text-indigo-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/40 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed w-fit"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isAnalyzingNotes ? 'animate-spin' : ''}`} />
                  {isAnalyzingNotes ? 'Ollama a Interpretar...' : 'Interpretar com IA (Ollama)'}
                </button>
              </div>

              <textarea
                rows={2}
                value={editingFolha.notasInternas || ''}
                onChange={e => {
                  const val = e.target.value;
                  setEditingFolha(prev => ({ ...prev, notasInternas: val }));
                }}
                onBlur={() => {
                  if (editingFolha.notasInternas && editingFolha.notasInternas.trim().length > 5) {
                    handleAnalyzeNotes(editingFolha.notasInternas);
                  }
                }}
                placeholder="Registo interno para a equipa da oficina (Ex: enviar orçamento de bomba injetora ao cliente, encomendar filtro de óleo ao fornecedor, enviar peças para estaleiro, etc.)..."
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-indigo-500"
              />

              {/* Feedback when task was created */}
              {taskCreatedFeedback && (
                <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{taskCreatedFeedback}</span>
                </div>
              )}

              {/* AI Suggestion Card if Actionable Task Detected */}
              {aiNoteSuggestion?.hasActionableTask && aiNoteSuggestion.tarefa && (
                <div className="p-3 bg-indigo-950/50 border border-indigo-500/50 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Ação Detetada pela IA (Ollama):
                      </div>
                      <p className="text-xs text-white font-medium mt-1">
                        "{aiNoteSuggestion.tarefa.descricao}"
                      </p>
                      {aiNoteSuggestion.razao && (
                        <p className="text-[11px] text-indigo-200/70 mt-0.5">{aiNoteSuggestion.razao}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-amber-400 px-2 py-0.5 bg-slate-950 rounded border border-amber-500/30">
                        Prioridade: {aiNoteSuggestion.tarefa.prioridade}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-900/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      Responsável: <b className="text-white">{aiNoteSuggestion.tarefa.responsavel}</b> • Limite: <b className="text-slate-200">{aiNoteSuggestion.tarefa.dataLimite}</b>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleCreateTaskFromAi()}
                      className="px-3 py-1.5 bg-hp-600 hover:bg-hp-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-hp-600/30 transition-all shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Criar Tarefa no Menu Tarefas
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. PRÓXIMA REVISÃO (Depois das Notas para o Cliente) */}
            <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-hp-400" />
                Próxima Revisão Recomendada
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Próxima Revisão (KMS)</label>
                  <input
                    type="number"
                    value={editingFolha.previsaoRevisaoKms || 0}
                    onChange={e => setEditingFolha(prev => ({ ...prev, previsaoRevisaoKms: Number(e.target.value) }))}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">Próxima Revisão (H)</label>
                  <input
                    type="number"
                    value={editingFolha.previsaoRevisaoHoras || 0}
                    onChange={e => setEditingFolha(prev => ({ ...prev, previsaoRevisaoHoras: Number(e.target.value) }))}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* 7. End of Form: Equipamento Operacional & Finalizado Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">Equipamento Operacional?</span>
                  <span className="text-[10px] text-slate-400">Estado de funcionamento atual</span>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingFolha(prev => ({ ...prev, equipamentoOperacional: 'Sim' }))}
                    className={`py-1 px-3 rounded text-xs font-bold transition-all ${
                      editingFolha.equipamentoOperacional !== 'Não'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingFolha(prev => ({ ...prev, equipamentoOperacional: 'Não' }))}
                    className={`py-1 px-3 rounded text-xs font-bold transition-all ${
                      editingFolha.equipamentoOperacional === 'Não'
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs font-bold text-white block">Equipamento Finalizado?</span>
                  <span className="text-[10px] text-slate-400">Trabalhos concluídos com sucesso</span>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleEquipamentoFinalizadoChange('Sim')}
                    className={`py-1 px-3 rounded text-xs font-bold transition-all ${
                      editingFolha.equipamentoFinalizado === 'Sim'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEquipamentoFinalizadoChange('Não')}
                    className={`py-1 px-3 rounded text-xs font-bold transition-all ${
                      editingFolha.equipamentoFinalizado !== 'Sim'
                        ? 'bg-slate-700 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>
            </div>

            {/* 8. Time in Kanban States Tracker (Internal App only) */}
            <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <History className="w-4 h-4 text-hp-400" />
                Histórico de Tempo em Cada Estado / Etapa Kanban (Interno)
              </h4>

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {editingFolha.historicoEstados && editingFolha.historicoEstados.length > 0 ? (
                  editingFolha.historicoEstados.map((hist, idx) => {
                    const isCurrent = !hist.dataSaida;
                    const duration = isCurrent
                      ? `${formatDuration(hist.dataEntrada)} (Atual)`
                      : (hist.duracaoTexto || formatDuration(hist.dataEntrada, hist.dataSaida));

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs border ${
                          isCurrent
                            ? 'bg-hp-950/30 border-hp-500/30 text-hp-300'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-hp-400" />
                          <span className="font-semibold">{hist.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                          <span>Início: {new Date(hist.dataEntrada).toLocaleDateString('pt-PT')} {new Date(hist.dataEntrada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="font-bold text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            {duration}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 italic p-2">Sem histórico registado.</p>
                )}
              </div>
            </div>

            {/* 9. Messages / Discussion History */}
            <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-hp-400" />
                Histórico Técnico & Mensagens
              </h4>

              <div className="max-h-36 overflow-y-auto space-y-2 p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                {editingFolha.mensagens?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-2">Sem notas técnicas registadas.</p>
                ) : (
                  editingFolha.mensagens?.map(m => (
                    <div key={m.id} className="text-xs p-2 rounded-lg bg-slate-950 border border-slate-800/60">
                      <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                        <span className="font-bold text-hp-400">{m.user}</span>
                        <span className="font-mono">{m.time}</span>
                      </div>
                      <p className="text-slate-200">{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escrever nota ou atualização técnica..."
                  value={newMessageText}
                  onChange={e => setNewMessageText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMessage()}
                  className="flex-1 py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleAddMessage}
                  className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Enviar
                </button>
              </div>
            </div>

            {/* BOTTOM ACTION BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              {editingFolha.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteFolha(editingFolha.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Folha
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto">
                {hasAdicionais && (
                  <button
                    type="button"
                    onClick={handleGenerateOrçamentoFromAdicionais}
                    className="py-2 px-3.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <Receipt className="w-4 h-4" />
                    Gerar Orçamento de Adicionais
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleSaveFolha}
                  className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Folha de Serviço
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline Contextual Scanner Modal inside Folha de Obra */}
      <CameraScannerModal
        isOpen={isInlineScannerOpen}
        onClose={() => setIsInlineScannerOpen(false)}
        initialMode={scannerContext === 'foto_anomalias' ? 'geral' : scannerContext}
        onScanComplete={handleInlineScanComplete}
      />

      {/* Enlarged Photo Preview Modal */}
      {previewEnlargedPhoto && (
        <div
          onClick={() => setPreviewEnlargedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={previewEnlargedPhoto}
            alt="Foto Ampliada"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain border border-slate-800"
          />
        </div>
      )}
    </div>
  );
};
