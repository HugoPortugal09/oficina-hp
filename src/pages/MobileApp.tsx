import React, { useState, useRef, useEffect } from 'react';
import {
  Wrench,
  Camera,
  Sparkles,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Car,
  Building2,
  User,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ArrowLeft,
  FileDown,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  CheckSquare,
  AlertTriangle,
  Upload,
  Layers,
  MapPin,
  Navigation,
  UserCheck,
  Calendar,
  X,
  Gauge,
  Phone,
  Mail,
  ExternalLink,
  Package,
  ShoppingCart,
  Truck,
  Info,
  SlidersHorizontal,
  FileText,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { db, STORAGE_KEYS } from '../services/dbService';
import { generateFolhaServicoPDF } from '../services/pdfService';
import {
  transformPhotosToFolhaWithOllama,
  analyzeInternalNotesWithOllama,
  type AiFolhaGenerationResult
} from '../services/ollamaService';
import type {
  FolhaServico,
  Empresa,
  Equipamento,
  Cliente,
  PecaCatalogo,
  PedidoPeca,
  Tarefa,
  StatusFolhaServico,
  ServicoItem,
  PecaItem,
  Estaleiro,
  UserProfile
} from '../types';
import { getInitials } from '../types';

interface MobileAppProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onSwitchToDesktop: () => void;
  currentUser?: UserProfile;
  onLogout?: () => void;
}

type MobileTab = 'folhas' | 'ia-wizard' | 'nova-manual' | 'consultas' | 'pecas' | 'tarefas';
type ConsultaSubTab = 'equipamentos' | 'empresas' | 'clientes';
type PecasSubTab = 'catalogo-pecas' | 'pedidos-pecas';

export const MobileApp: React.FC<MobileAppProps> = ({
  theme,
  onToggleTheme,
  onSwitchToDesktop,
  currentUser,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('folhas');
  const [consultaSubTab, setConsultaSubTab] = useState<ConsultaSubTab>('equipamentos');
  const [pecasSubTab, setPecasSubTab] = useState<PecasSubTab>('catalogo-pecas');
  const [pecasQuery, setPecasQuery] = useState('');

  // Database Data
  const [folhas, setFolhas] = useState<FolhaServico[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [catalogoPecas, setCatalogoPecas] = useState<PecaCatalogo[]>([]);
  const [pedidosPecas, setPedidosPecas] = useState<PedidoPeca[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  // Selected Folha for Full Mobile Detail / Edit
  const [selectedFolha, setSelectedFolha] = useState<FolhaServico | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');

  // Consultation search query
  const [consultaQuery, setConsultaQuery] = useState('');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  // Modals for Adding New Entities in Mobile
  const [isAddEquipamentoOpen, setIsAddEquipamentoOpen] = useState(false);
  const [isAddEmpresaOpen, setIsAddEmpresaOpen] = useState(false);
  const [isAddClienteOpen, setIsAddClienteOpen] = useState(false);
  const [isAddPedidoPecaOpen, setIsAddPedidoPecaOpen] = useState(false);

  // New Equipment Form State
  const [newEquipamento, setNewEquipamento] = useState<Partial<Equipamento>>({
    matricula: '',
    marca: '',
    modelo: '',
    tipo: 'Viatura Ligeira',
    empresaId: '',
    kmsAtuais: 0,
    horasAtuais: 0,
    fotos: [],
    dataEntrega: '',
    dataFormacao: ''
  });

  // New Company Form State
  const [newEmpresa, setNewEmpresa] = useState<Partial<Empresa>>({
    nome: '',
    nif: '',
    moradaSede: '',
    distanciaKmGRAUMP: 0,
    telefone: '',
    email: '',
    estaleiros: []
  });
  const [tempEstaleiroNome, setTempEstaleiroNome] = useState('');
  const [tempEstaleiroMorada, setTempEstaleiroMorada] = useState('');

  // New Client Form State
  const [newCliente, setNewCliente] = useState<Partial<Cliente>>({
    nome: '',
    cargo: '',
    empresaId: '',
    telemovel: '',
    email: '',
    notas: ''
  });

  // New Part Order Form State
  const [newPedidoPeca, setNewPedidoPeca] = useState<{
    fornecedor: string;
    matricula: string;
    empresaNome: string;
    prioridade: 'normal' | 'urgente' | 'critico';
    referencia: string;
    designacao: string;
    qtd: number;
    notas: string;
  }>({
    fornecedor: '',
    matricula: '',
    empresaNome: '',
    prioridade: 'normal',
    referencia: '',
    designacao: '',
    qtd: 1,
    notas: ''
  });

  // AI Multi-Photo Transformation State
  const [aiPhotos, setAiPhotos] = useState<string[]>([]);
  const [aiMatriculaPhoto, setAiMatriculaPhoto] = useState<string | null>(null);
  const [aiOdometroPhoto, setAiOdometroPhoto] = useState<string | null>(null);
  const [aiPecasPhotos, setAiPecasPhotos] = useState<string[]>([]);
  const [aiVoiceNotes, setAiVoiceNotes] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AiFolhaGenerationResult | null>(null);

  // Manual Folha Form State
  const [manualFolha, setManualFolha] = useState<Partial<FolhaServico>>({
    tipo: 'Oficina',
    status: 'OF - Com requisição - Aguardar agenda',
    kmsAtuais: 0,
    horasAtuais: 0,
    servicos: [],
    pecas: [],
    fotos: [],
    notasCliente: '',
    notasInternas: '',
    equipamentoOperacional: 'Sim',
    equipamentoFinalizado: 'Não'
  });

  // Plate search dropdown in manual form
  const [plateQuery, setPlateQuery] = useState('');
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // File Input Refs for direct native camera capture
  const allAiPhotosInputRef = useRef<HTMLInputElement>(null);
  const matriculaInputRef = useRef<HTMLInputElement>(null);
  const odometroInputRef = useRef<HTMLInputElement>(null);
  const pecasInputRef = useRef<HTMLInputElement>(null);
  const manualPhotoInputRef = useRef<HTMLInputElement>(null);
  const newEquipPhotoInputRef = useRef<HTMLInputElement>(null);
  const selectedFolhaPhotoInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
    setFolhas(db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO));
    setEmpresas(db.get<Empresa>(STORAGE_KEYS.EMPRESAS));
    setEquipamentos(db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS));
    setClientes(db.get<Cliente>(STORAGE_KEYS.CLIENTES));
    setCatalogoPecas(db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO));
    setPedidosPecas(db.get<PedidoPeca>(STORAGE_KEYS.PEDIDOS_PECAS));
    setTarefas(db.get<Tarefa>(STORAGE_KEYS.TAREFAS));
  };

  useEffect(() => {
    loadData();
    const handleDbChange = () => loadData();
    window.addEventListener('oficina_hp_db_changed', handleDbChange);
    return () => window.removeEventListener('oficina_hp_db_changed', handleDbChange);
  }, []);

  const handlePhotoCapture = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'all-ai' | 'matricula' | 'odometro' | 'pecas' | 'manual' | 'new-equip'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = ev => {
        const base64 = ev.target?.result as string;
        if (target === 'all-ai') {
          setAiPhotos(prev => [...prev, base64]);
        } else if (target === 'matricula') {
          setAiMatriculaPhoto(base64);
        } else if (target === 'odometro') {
          setAiOdometroPhoto(base64);
        } else if (target === 'pecas') {
          setAiPecasPhotos(prev => [...prev, base64]);
        } else if (target === 'manual') {
          setManualFolha(prev => ({
            ...prev,
            fotos: [...(prev.fotos || []), base64]
          }));
        } else if (target === 'new-equip') {
          setNewEquipamento(prev => ({
            ...prev,
            fotos: [...(prev.fotos || []), base64]
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Run AI Transformation with Ollama (All-in-One Multi-Photo Auto-Classification)
  const handleRunAiTransformation = async () => {
    const allInputPhotos = [
      ...aiPhotos,
      ...(aiMatriculaPhoto ? [aiMatriculaPhoto] : []),
      ...(aiOdometroPhoto ? [aiOdometroPhoto] : []),
      ...aiPecasPhotos
    ];

    if (allInputPhotos.length === 0 && !aiVoiceNotes) {
      alert('Por favor adicione pelo menos uma foto ou insira notas descritivas.');
      return;
    }

    setIsAiProcessing(true);
    try {
      const res = await transformPhotosToFolhaWithOllama({
        fotos: allInputPhotos,
        textoDescritivo: aiVoiceNotes,
        equipamentos: equipamentos,
        empresas: empresas
      });

      const cleanPlate = res.folha.matricula?.replace(/[^A-Z0-9]/g, '').toUpperCase() || '';
      const matchedEq = cleanPlate ? equipamentos.find(
        e => e.matricula.replace(/[^A-Z0-9]/g, '').toUpperCase() === cleanPlate
      ) : undefined;
      const matchedEmpId = matchedEq?.empresaId || res.folha.empresaId || '';
      const cliMatch = matchedEmpId ? clientes.find(c => c.empresaId === matchedEmpId) : undefined;

      const enhancedFolha: Partial<FolhaServico> = {
        ...res.folha,
        empresaId: matchedEmpId || res.folha.empresaId,
        clienteId: cliMatch?.id || res.folha.clienteId,
        pessoaPresente: cliMatch?.nome || res.folha.pessoaPresente || ''
      };

      setAiResult({
        ...res,
        folha: enhancedFolha
      });
      setManualFolha(enhancedFolha);
      setPlateQuery(enhancedFolha.matricula || '');
    } catch (err) {
      console.error(err);
      alert('Erro ao processar imagens com Ollama.');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Save Folha (from AI or Manual Entry)
  const handleSaveFolha = async (folhaData: Partial<FolhaServico>) => {
    if (!folhaData.matricula) {
      alert('Por favor, indique a matrícula da viatura ou equipamento.');
      return;
    }

    setIsSaving(true);
    const newNum = folhaData.numero || db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');
    const now = new Date().toISOString().split('T')[0];

    const matchedEq = equipamentos.find(
      e => e.matricula.toUpperCase() === folhaData.matricula?.toUpperCase()
    );

    const folhaToSave: FolhaServico = {
      id: folhaData.id || db.generateId('fs'),
      numero: newNum,
      tipo: folhaData.tipo || 'Oficina',
      data: folhaData.data || now,
      dataEntradaOficina: folhaData.dataEntradaOficina || now,
      status: folhaData.status || 'OF - Com requisição - Aguardar agenda',
      empresaId: folhaData.empresaId || matchedEq?.empresaId || empresas[0]?.id || '',
      clienteId: folhaData.clienteId || clientes.find(c => c.empresaId === (folhaData.empresaId || matchedEq?.empresaId))?.id,
      equipamentoId: folhaData.equipamentoId || matchedEq?.id || '',
      matricula: folhaData.matricula,
      marca: folhaData.marca || matchedEq?.marca || 'Geral',
      modelo: folhaData.modelo || matchedEq?.modelo || 'Frota',
      kmsAtuais: folhaData.kmsAtuais || matchedEq?.kmsAtuais || 0,
      horasAtuais: folhaData.horasAtuais || matchedEq?.horasAtuais || 0,
      localizacao: folhaData.localizacao || 'GRAUMP - Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha',
      localizacaoTipo: folhaData.localizacaoTipo || 'oficina',
      distanciaKms: folhaData.distanciaKms || 0,
      pessoaPresente: folhaData.pessoaPresente || '',
      anomalias: folhaData.anomalias || 'Manutenção e diagnóstico geral.',
      servicos: folhaData.servicos || [],
      servicosAdicionais: folhaData.servicosAdicionais || [],
      pecas: folhaData.pecas || [],
      pecasAdicionais: folhaData.pecasAdicionais || [],
      mensagens: folhaData.mensagens || [
        {
          id: db.generateId('msg'),
          user: 'Técnico Mobile',
          text: 'Folha de serviço registada via terminal móvel.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      fotos: folhaData.fotos || [],
      fotosCliente: folhaData.fotosCliente || [],
      notasCliente: folhaData.notasCliente || '',
      notasInternas: folhaData.notasInternas || '',
      previsaoRevisaoKms: folhaData.previsaoRevisaoKms || ((folhaData.kmsAtuais || 0) + 15000),
      previsaoRevisaoHoras: folhaData.previsaoRevisaoHoras || ((folhaData.horasAtuais || 0) + 500),
      equipamentoFuncionando: folhaData.equipamentoFuncionando || 'Sim',
      equipamentoOperacional: folhaData.equipamentoOperacional || 'Sim',
      equipamentoFinalizado: folhaData.equipamentoFinalizado || 'Não'
    };

    // Check internal notes with AI for automatic task generation if needed
    if (folhaToSave.notasInternas && folhaToSave.notasInternas.trim().length > 5) {
      try {
        const aiNote = await analyzeInternalNotesWithOllama(folhaToSave.notasInternas, {
          numeroFolha: folhaToSave.numero,
          matricula: folhaToSave.matricula
        });
        if (aiNote.hasActionableTask && aiNote.tarefa) {
          const tarNum = db.generateSequenceNumber(STORAGE_KEYS.TAREFAS, 'TAR');
          const novaTar: Tarefa = {
            id: db.generateId('tar'),
            numero: tarNum,
            descricao: aiNote.tarefa.descricao,
            prioridade: aiNote.tarefa.prioridade,
            responsavel: aiNote.tarefa.responsavel || 'Hugo Portugal',
            dataLimite: aiNote.tarefa.dataLimite,
            notasAdicionais: aiNote.tarefa.notasAdicionais,
            status: 'Pendente',
            criadoPorIniciais: 'IA',
            dataCriacao: now
          };
          db.insert(STORAGE_KEYS.TAREFAS, novaTar);
        }
      } catch (err) {
        console.error('AI Note interpretation error:', err);
      }
    }

    const currentList = db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
    const existingIdx = currentList.findIndex(f => f.id === folhaToSave.id);

    if (existingIdx >= 0) {
      db.update(STORAGE_KEYS.FOLHAS_SERVICO, folhaToSave.id, folhaToSave);
    } else {
      db.insert(STORAGE_KEYS.FOLHAS_SERVICO, folhaToSave);
    }

    // Update fleet odometer
    if (folhaToSave.equipamentoId) {
      db.update<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS, folhaToSave.equipamentoId, {
        kmsAtuais: folhaToSave.kmsAtuais,
        horasAtuais: folhaToSave.horasAtuais
      });
    }

    setIsSaving(false);
    setSaveBanner(`Folha ${folhaToSave.numero} gravada com sucesso!`);
    setTimeout(() => setSaveBanner(null), 4000);

    // Reset AI Wizard & Form
    setAiMatriculaPhoto(null);
    setAiOdometroPhoto(null);
    setAiPecasPhotos([]);
    setAiVoiceNotes('');
    setAiResult(null);
    setSelectedFolha(null);
    setActiveTab('folhas');
  };

  // Reset Form for new manual Folha
  const handleStartNewManual = (prefilledEq?: Equipamento) => {
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');
    const now = new Date().toISOString().split('T')[0];
    setManualFolha({
      id: db.generateId('fs'),
      numero: newNum,
      tipo: 'Oficina',
      data: now,
      status: 'OF - Com requisição - Aguardar agenda',
      matricula: prefilledEq?.matricula || '',
      marca: prefilledEq?.marca || '',
      modelo: prefilledEq?.modelo || '',
      equipamentoId: prefilledEq?.id || '',
      empresaId: prefilledEq?.empresaId || '',
      kmsAtuais: prefilledEq?.kmsAtuais || 0,
      horasAtuais: prefilledEq?.horasAtuais || 0,
      servicos: [
        {
          id: db.generateId('srv'),
          descricao: 'Manutenção / Revisão Geral',
          horas: 1.5,
          valorHora: 45.0,
          concluido: false,
          tecnico: 'Hugo Portugal'
        }
      ],
      pecas: [],
      fotos: [],
      notasCliente: '',
      notasInternas: '',
      equipamentoOperacional: 'Sim',
      equipamentoFinalizado: 'Não'
    });
    setPlateQuery(prefilledEq?.matricula || '');
    setActiveTab('nova-manual');
  };

  // Save Handlers for New Entities Added in Mobile
  const handleSaveNewEquipamento = () => {
    if (!newEquipamento.matricula || !newEquipamento.empresaId) {
      alert('Por favor preencha a Matrícula e a Empresa Proprietária.');
      return;
    }

    const created: Equipamento = {
      id: db.generateId('eq'),
      matricula: newEquipamento.matricula.toUpperCase().trim(),
      marca: newEquipamento.marca || 'Geral',
      modelo: newEquipamento.modelo || 'Frota',
      tipo: newEquipamento.tipo || 'Viatura',
      empresaId: newEquipamento.empresaId,
      kmsAtuais: Number(newEquipamento.kmsAtuais) || 0,
      horasAtuais: Number(newEquipamento.horasAtuais) || 0,
      fotos: newEquipamento.fotos || [],
      dataEntrega: newEquipamento.dataEntrega || '',
      dataFormacao: newEquipamento.dataFormacao || ''
    };

    db.insert(STORAGE_KEYS.EQUIPAMENTOS, created);
    setSaveBanner(`Viatura ${created.matricula} acrescentada com sucesso!`);
    setTimeout(() => setSaveBanner(null), 4000);
    setIsAddEquipamentoOpen(false);
    setNewEquipamento({
      matricula: '',
      marca: '',
      modelo: '',
      tipo: 'Viatura Ligeira',
      empresaId: '',
      kmsAtuais: 0,
      horasAtuais: 0,
      fotos: [],
      dataEntrega: '',
      dataFormacao: ''
    });
  };

  const handleSaveNewEmpresa = () => {
    if (!newEmpresa.nome || !newEmpresa.moradaSede) {
      alert('Por favor preencha o Nome da Empresa e a Morada da Sede.');
      return;
    }

    const created: Empresa = {
      id: db.generateId('emp'),
      nome: newEmpresa.nome.trim(),
      nif: newEmpresa.nif || '',
      moradaSede: newEmpresa.moradaSede.trim(),
      distanciaKmGRAUMP: Number(newEmpresa.distanciaKmGRAUMP) || 45,
      telefone: newEmpresa.telefone || '',
      email: newEmpresa.email || '',
      estaleiros: newEmpresa.estaleiros || [],
      ativo: true,
      criadoEm: new Date().toISOString().split('T')[0]
    };

    db.insert(STORAGE_KEYS.EMPRESAS, created);
    setSaveBanner(`Empresa "${created.nome}" acrescentada com sucesso!`);
    setTimeout(() => setSaveBanner(null), 4000);
    setIsAddEmpresaOpen(false);
    setNewEmpresa({
      nome: '',
      nif: '',
      moradaSede: '',
      distanciaKmGRAUMP: 0,
      telefone: '',
      email: '',
      estaleiros: []
    });
  };

  const handleSaveNewCliente = () => {
    if (!newCliente.nome || !newCliente.empresaId) {
      alert('Por favor preencha o Nome do Cliente e selecione a Empresa.');
      return;
    }

    const created: Cliente = {
      id: db.generateId('cli'),
      nome: newCliente.nome.trim(),
      cargo: newCliente.cargo || 'Responsável',
      empresaId: newCliente.empresaId,
      telemovel: newCliente.telemovel || '',
      email: newCliente.email || '',
      notas: newCliente.notas || ''
    };

    db.insert(STORAGE_KEYS.CLIENTES, created);
    setSaveBanner(`Contacto "${created.nome}" acrescentado com sucesso!`);
    setTimeout(() => setSaveBanner(null), 4000);
    setIsAddClienteOpen(false);
    setNewCliente({
      nome: '',
      cargo: '',
      empresaId: '',
      telemovel: '',
      email: '',
      notas: ''
    });
  };

  const handleSaveNewPedidoPeca = () => {
    if (!newPedidoPeca.designacao) {
      alert('Por favor indique a designação da peça.');
      return;
    }

    const newNum = db.generateSequenceNumber(STORAGE_KEYS.PEDIDOS_PECAS, 'PED');
    const now = new Date().toISOString().split('T')[0];

    const created: PedidoPeca = {
      id: db.generateId('ped'),
      numero: newNum,
      data: now,
      status: 'Pendente',
      prioridade: newPedidoPeca.prioridade || 'normal',
      fornecedor: newPedidoPeca.fornecedor || 'Fornecedor Geral',
      matricula: newPedidoPeca.matricula || '',
      empresaNome: newPedidoPeca.empresaNome || '',
      pecas: [
        {
          referencia: newPedidoPeca.referencia || 'REF-LIVRE',
          designacao: newPedidoPeca.designacao,
          qtd: Number(newPedidoPeca.qtd) || 1
        }
      ],
      notas: newPedidoPeca.notas || '',
      criadoEm: now
    };

    db.insert(STORAGE_KEYS.PEDIDOS_PECAS, created);
    setSaveBanner(`Pedido de Peça ${newNum} criado com sucesso!`);
    setTimeout(() => setSaveBanner(null), 4000);
    setIsAddPedidoPecaOpen(false);
    setNewPedidoPeca({
      fornecedor: '',
      matricula: '',
      empresaNome: '',
      prioridade: 'normal',
      referencia: '',
      designacao: '',
      qtd: 1,
      notas: ''
    });
  };

  // Calculate Part Usage Counts in last 30, 90, 360 days
  const calculatePartUsage = (referencia: string) => {
    const nowMs = Date.now();
    const day30Ms = 30 * 24 * 60 * 60 * 1000;
    const day90Ms = 90 * 24 * 60 * 60 * 1000;
    const day360Ms = 360 * 24 * 60 * 60 * 1000;

    let count30 = 0;
    let count90 = 0;
    let count360 = 0;

    folhas.forEach(f => {
      const folhaTime = new Date(f.data).getTime();
      const diff = nowMs - folhaTime;
      const allParts = [...(f.pecas || []), ...(f.pecasAdicionais || [])];

      allParts.forEach(p => {
        if (p.referencia?.toUpperCase() === referencia.toUpperCase()) {
          const q = p.qtd || 1;
          if (diff <= day30Ms) count30 += q;
          if (diff <= day90Ms) count90 += q;
          if (diff <= day360Ms) count360 += q;
        }
      });
    });

    return { count30, count90, count360 };
  };

  const filteredFolhas = folhas.filter(f => {
    const q = searchTerm.toLowerCase();
    const matchesQ =
      f.numero.toLowerCase().includes(q) ||
      f.matricula.toLowerCase().includes(q) ||
      (f.marca && f.marca.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'TODAS' || f.status.startsWith(statusFilter);
    return matchesQ && matchesStatus;
  });

  // Handlers for Mobile selectedFolha interactive editing
  const handleToggleServiceConcluido = (servicoId: string, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'servicosAdicionais' : 'servicos';
    const list = selectedFolha[key] || [];
    const today = new Date().toLocaleDateString('pt-PT');
    const updatedList = list.map(s => {
      if (s.id === servicoId) {
        const willBeDone = !s.concluido;
        const initials = getInitials(s.tecnico || 'HP');
        return {
          ...s,
          concluido: willBeDone,
          dataConclusao: willBeDone ? (s.dataConclusao || today) : undefined,
          tecnico: initials,
          iniciaisConclusao: willBeDone ? initials : undefined
        };
      }
      return s;
    });
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleTogglePecaConcluido = (pecaId: string, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'pecasAdicionais' : 'pecas';
    const list = selectedFolha[key] || [];
    const today = new Date().toLocaleDateString('pt-PT');
    const updatedList = list.map(p => {
      if (p.id === pecaId) {
        const willBeDone = !p.concluido;
        const initials = getInitials(p.iniciaisConclusao || 'HP');
        return {
          ...p,
          concluido: willBeDone,
          dataConclusao: willBeDone ? (p.dataConclusao || today) : undefined,
          iniciaisConclusao: willBeDone ? initials : undefined
        };
      }
      return p;
    });
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleAddServiceToSelected = (isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'servicosAdicionais' : 'servicos';
    const newSrv: ServicoItem = {
      id: db.generateId('srv'),
      descricao: '',
      horas: 1,
      valorHora: 38.5,
      concluido: false,
      tecnico: 'HP',
      iniciaisConclusao: 'HP'
    };
    const updatedList = [...(selectedFolha[key] || []), newSrv];
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleUpdateServiceInSelected = (servicoId: string, field: keyof ServicoItem, value: any, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'servicosAdicionais' : 'servicos';
    const list = selectedFolha[key] || [];
    const today = new Date().toLocaleDateString('pt-PT');
    const updatedList = list.map(s => {
      if (s.id !== servicoId) return s;
      if (field === 'concluido') {
        const checked = Boolean(value);
        const initials = getInitials(s.tecnico || 'HP');
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
    });
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleRemoveServiceFromSelected = (servicoId: string, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'servicosAdicionais' : 'servicos';
    const list = selectedFolha[key] || [];
    const updatedList = list.filter(s => s.id !== servicoId);
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleAddPartToSelected = (isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'pecasAdicionais' : 'pecas';
    const newPec: PecaItem = {
      id: db.generateId('pec'),
      referencia: '',
      designacao: '',
      qtd: 1,
      concluido: false,
      isLivre: true,
      iniciaisConclusao: 'HP'
    };
    const updatedList = [...(selectedFolha[key] || []), newPec];
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleUpdatePartInSelected = (pecaId: string, field: keyof PecaItem, value: any, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'pecasAdicionais' : 'pecas';
    const list = selectedFolha[key] || [];
    const today = new Date().toLocaleDateString('pt-PT');
    const updatedList = list.map(p => {
      if (p.id !== pecaId) return p;
      if (field === 'concluido') {
        const checked = Boolean(value);
        const initials = getInitials(p.iniciaisConclusao || 'HP');
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
    });
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleRemovePartFromSelected = (pecaId: string, isAdicional: boolean) => {
    if (!selectedFolha) return;
    const key = isAdicional ? 'pecasAdicionais' : 'pecas';
    const list = selectedFolha[key] || [];
    const updatedList = list.filter(p => p.id !== pecaId);
    const updatedFolha = { ...selectedFolha, [key]: updatedList };
    setSelectedFolha(updatedFolha);
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { [key]: updatedList });
  };

  const handleSelectedFolhaPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedFolha) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = ev => {
        const base64 = ev.target?.result as string;
        setSelectedFolha(prev => {
          if (!prev) return null;
          const updatedPhotos = [...(prev.fotos || []), base64];
          db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, prev.id, { fotos: updatedPhotos });
          return { ...prev, fotos: updatedPhotos };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSelectedFolha = () => {
    if (!selectedFolha) return;
    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, selectedFolha);
    setSaveBanner(`Folha de Serviço ${selectedFolha.numero} gravada com sucesso!`);
    setTimeout(() => setSaveBanner(null), 3500);
  };

  const matchingPlates = equipamentos.filter(
    eq =>
      eq.matricula.toLowerCase().includes(plateQuery.toLowerCase()) ||
      eq.marca.toLowerCase().includes(plateQuery.toLowerCase())
  );

  return (
    <div className={`min-h-screen pb-24 flex flex-col font-sans transition-colors ${
      theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Photo Enlarged Modal */}
      {selectedPhotoPreview && (
        <div
          onClick={() => setSelectedPhotoPreview(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative max-w-lg w-full max-h-[85vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedPhotoPreview(null)}
              className="absolute -top-12 right-0 p-2 text-white bg-slate-800 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhotoPreview}
              alt="Foto Ampliada"
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* 1. TOP MOBILE APP BAR */}
      <header className={`sticky top-0 z-40 px-4 py-3.5 border-b backdrop-blur-xl flex items-center justify-between shadow-sm ${
        theme === 'light' ? 'bg-white/90 border-slate-200' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-hp-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md shadow-hp-600/30">
            HP
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight leading-none text-hp-500">
              OFICINA HP
            </h1>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Terminal Móvel / Oficina
            </p>
          </div>
        </div>

        {/* Header Actions: Theme & Switch to Desktop */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className={`p-2.5 rounded-2xl border transition-colors ${
              theme === 'light'
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Alternar Modo Claro / Escuro"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-hp-500" />}
          </button>

          <button
            onClick={onSwitchToDesktop}
            className="p-2.5 rounded-2xl bg-hp-600/20 border border-hp-500/40 text-hp-400 hover:text-white font-bold text-xs flex items-center gap-1.5"
            title="Mudar para Versão Completa de Computador"
          >
            <Monitor className="w-4 h-4" />
            <span className="hidden xs:inline">Desktop</span>
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors"
              title="Terminar Sessão (Sair)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* SUCCESS / SAVE BANNER */}
      {saveBanner && (
        <div className="mx-4 mt-3 p-3.5 rounded-2xl bg-emerald-500 text-white font-bold text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-500/30 animate-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* 2. MAIN MOBILE CONTENT CONTAINER */}
      <main className="flex-1 p-4 max-w-lg w-full mx-auto space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: FOLHAS DE SERVIÇO (Lista Rápida com Botões Grandes) */}
        {/* ========================================================================= */}
        {activeTab === 'folhas' && !selectedFolha && (
          <div className="space-y-4">
            {/* Quick Action Big Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTab('ia-wizard')}
                className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-hp-600 text-white flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <span className="font-extrabold text-sm block">Criar com IA</span>
                  <span className="text-[10px] text-indigo-100 opacity-90">Fotos ➔ Folha Pronta</span>
                </div>
              </button>

              <button
                onClick={() => handleStartNewManual()}
                className="p-4 rounded-2xl bg-gradient-to-br from-hp-600 to-cyan-600 text-white flex flex-col items-center justify-center text-center gap-2 shadow-lg shadow-hp-600/30 active:scale-95 transition-transform"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="font-extrabold text-sm block">Nova à Mão</span>
                  <span className="text-[10px] text-hp-100 opacity-90">Preenchimento Tátil</span>
                </div>
              </button>
            </div>

            {/* Search and Status Chips */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar matrícula, número FS..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 rounded-2xl text-sm font-semibold border focus:outline-none focus:border-hp-500 ${
                    theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>

              {/* Status Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {['TODAS', 'AT', 'OF', 'FEITO'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                      statusFilter === st
                        ? 'bg-hp-600 text-white shadow-sm'
                        : theme === 'light'
                        ? 'bg-white text-slate-600 border border-slate-200'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {st === 'TODAS' ? 'Todas' : st === 'AT' ? 'Assistências (AT)' : st === 'OF' ? 'Oficina (OF)' : 'Concluídas (FEITO)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Folhas Cards List */}
            <div className="space-y-3">
              {filteredFolhas.length === 0 ? (
                <div className="p-8 text-center rounded-3xl border border-dashed border-slate-700/60 space-y-3">
                  <Wrench className="w-12 h-12 text-slate-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-400">Nenhuma folha de serviço encontrada.</p>
                  <button
                    onClick={() => handleStartNewManual()}
                    className="px-4 py-2 rounded-xl bg-hp-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Criar Primeira Folha
                  </button>
                </div>
              ) : (
                filteredFolhas.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFolha(f)}
                    className={`p-4 rounded-3xl border transition-all active:scale-[0.98] cursor-pointer space-y-3 shadow-sm ${
                      theme === 'light'
                        ? 'bg-white border-slate-200 hover:border-hp-400'
                        : 'bg-slate-900/90 border-slate-800 hover:border-hp-500/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="font-mono font-black text-xs text-hp-500 px-2 py-0.5 bg-hp-500/10 rounded-lg">
                          {f.numero}
                        </span>
                        <h3 className="text-lg font-black tracking-tight text-white font-mono mt-1">
                          {f.matricula}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">{f.marca} {f.modelo}</p>
                      </div>

                      <Badge
                        variant={
                          f.status.startsWith('FEITO')
                            ? 'success'
                            : f.status.startsWith('AT')
                            ? 'warning'
                            : 'info'
                        }
                      >
                        {f.status.split(' - ')[0]}
                      </Badge>
                    </div>

                    {/* Meta quick row */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
                      <span>{f.kmsAtuais ? `${f.kmsAtuais.toLocaleString()} Km` : '0 Km'}</span>
                      <span>{f.servicos?.length || 0} Serviços</span>
                      <span>{f.pecas?.length || 0} Peças</span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1.1: DETALHE / EDIÇÃO COMPLETA DE FOLHA SELECIONADA NO MOBILE */}
        {/* ========================================================================= */}
        {activeTab === 'folhas' && selectedFolha && (
          <div className="space-y-4 animate-in fade-in pb-8">
            {/* Back header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedFolha(null)}
                className="flex items-center gap-2 text-xs font-bold text-hp-400 py-2 px-3.5 rounded-2xl bg-slate-900 border border-slate-800 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar à Lista
              </button>

              <button
                onClick={handleSaveSelectedFolha}
                className="glass-btn py-2 px-4 rounded-2xl text-xs font-bold text-white flex items-center gap-1.5 shadow-lg shadow-hp-600/30"
              >
                <Check className="w-4 h-4" /> Guardar Folha
              </button>
            </div>

            <div className="p-4 rounded-3xl bg-slate-900/95 border border-slate-800 space-y-4 shadow-xl">
              {/* Header Info */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="font-mono font-black text-xs text-hp-400 px-2 py-0.5 bg-hp-500/10 rounded-lg">
                    {selectedFolha.numero}
                  </span>
                  <h2 className="text-2xl font-black font-mono text-white mt-1">{selectedFolha.matricula}</h2>
                  <p className="text-xs text-slate-400 font-semibold">{selectedFolha.marca} {selectedFolha.modelo}</p>
                </div>
                <Badge variant={selectedFolha.status.startsWith('FEITO') ? 'success' : selectedFolha.status.startsWith('AT') ? 'warning' : 'info'}>
                  {selectedFolha.status.split(' - ')[0]}
                </Badge>
              </div>

              {/* Status Quick Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 block uppercase">Estado da Folha</label>
                <select
                  value={selectedFolha.status}
                  onChange={e => {
                    const newSt = e.target.value as StatusFolhaServico;
                    setSelectedFolha(prev => (prev ? { ...prev, status: newSt } : null));
                    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { status: newSt });
                  }}
                  className="w-full py-3 px-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-hp-500"
                >
                  <optgroup label="Assistência Técnica (AT)">
                    <option value="AT - Pedido de Assistência">AT - Pedido de Assistência</option>
                    <option value="AT - Agendado">AT - Agendado</option>
                    <option value="AT - Com requisição - Aguardar peças">AT - Com requisição - Aguardar peças</option>
                  </optgroup>
                  <optgroup label="Oficina (OF)">
                    <option value="OF - Com requisição - Aguardar agenda">OF - Com requisição - Aguardar agenda</option>
                    <option value="OF - Com requisição - Aguardar viatura">OF - Com requisição - Aguardar viatura</option>
                    <option value="OF - Com requisição - Aguardar peças">OF - Com requisição - Aguardar peças</option>
                    <option value="OF - Fazer orçamento">OF - Fazer orçamento</option>
                  </optgroup>
                  <optgroup label="Finalizado (FEITO)">
                    <option value="FEITO - Faturar">FEITO - Faturar</option>
                    <option value="FEITO - Faturado">FEITO - Faturado</option>
                  </optgroup>
                </select>
              </div>

              {/* Editable Readings: Kms & Horas Atuais */}
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Leituras & Contador da Viatura (Editáveis)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">KMS ATUAIS</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={selectedFolha.kmsAtuais ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setSelectedFolha(prev => prev ? { ...prev, kmsAtuais: val } : null);
                          db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { kmsAtuais: val });
                        }}
                        className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-hp-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono font-bold">km</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1">HORAS TRABALHO</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={selectedFolha.horasAtuais ?? 0}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setSelectedFolha(prev => prev ? { ...prev, horasAtuais: val } : null);
                          db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { horasAtuais: val });
                        }}
                        className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-hp-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono font-bold">h</span>
                    </div>
                  </div>
                </div>

                {/* Total Labor Time Calculated Summary */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total Tempo Mão-de-Obra:</span>
                  <span className="font-mono font-black text-hp-400 text-sm">
                    {(
                      (selectedFolha.servicos?.reduce((acc, s) => acc + (Number(s.horas) || 0), 0) || 0) +
                      (selectedFolha.servicosAdicionais?.reduce((acc, s) => acc + (Number(s.horas) || 0), 0) || 0)
                    ).toFixed(1)} h
                  </span>
                </div>
              </div>

              {/* 1. MÃO-DE-OBRA & SERVIÇOS EFETUADOS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-hp-400" />
                    Mão-de-Obra Efetuada ({selectedFolha.servicos?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleAddServiceToSelected(false)}
                    className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-hp-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {(!selectedFolha.servicos || selectedFolha.servicos.length === 0) ? (
                    <p className="text-[11px] text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                      Nenhum serviço base registado.
                    </p>
                  ) : (
                    selectedFolha.servicos.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className={`p-3 rounded-2xl border transition-all space-y-2 ${
                          s.concluido
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleServiceConcluido(s.id, false)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                              s.concluido
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          <input
                            type="text"
                            placeholder="Descrição do serviço..."
                            value={s.descricao}
                            onChange={e => handleUpdateServiceInSelected(s.id, 'descricao', e.target.value, false)}
                            className={`flex-1 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500 ${
                              s.concluido ? 'line-through text-slate-400' : ''
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveServiceFromSelected(s.id, false)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pl-8 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Horas:</span>
                            <input
                              type="number"
                              step="0.5"
                              value={s.horas}
                              onChange={e => handleUpdateServiceInSelected(s.id, 'horas', Number(e.target.value), false)}
                              className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
                            />
                            <span className="text-[11px] text-slate-400 font-mono">h</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {s.concluido && s.dataConclusao && (
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-500/30 shrink-0">
                                📅 {s.dataConclusao}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Téc:</span>
                              <input
                                type="text"
                                value={getInitials(s.tecnico || 'HP')}
                                placeholder="HP"
                                maxLength={4}
                                onChange={e => handleUpdateServiceInSelected(s.id, 'tecnico', e.target.value.toUpperCase(), false)}
                                className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-hp-400 font-mono font-bold text-center uppercase text-xs"
                                title="Iniciais do Técnico"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 2. MÃO-DE-OBRA & SERVIÇOS ADICIONAIS */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-amber-400" />
                      Mão-de-Obra Adicional ({selectedFolha.servicosAdicionais?.length || 0})
                    </h4>
                    <p className="text-[10px] text-slate-400">Serviços adicionais fora do orçamento</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddServiceToSelected(true)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {(!selectedFolha.servicosAdicionais || selectedFolha.servicosAdicionais.length === 0) ? (
                    <p className="text-[11px] text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                      Nenhum serviço adicional registado.
                    </p>
                  ) : (
                    selectedFolha.servicosAdicionais.map((s, idx) => (
                      <div
                        key={s.id || idx}
                        className={`p-3 rounded-2xl border transition-all space-y-2 ${
                          s.concluido
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleToggleServiceConcluido(s.id, true)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                              s.concluido
                                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          <input
                            type="text"
                            placeholder="Descrição do serviço adicional..."
                            value={s.descricao}
                            onChange={e => handleUpdateServiceInSelected(s.id, 'descricao', e.target.value, true)}
                            className={`flex-1 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 ${
                              s.concluido ? 'line-through text-slate-400' : ''
                            }`}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveServiceFromSelected(s.id, true)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pl-8 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Horas:</span>
                            <input
                              type="number"
                              step="0.5"
                              value={s.horas}
                              onChange={e => handleUpdateServiceInSelected(s.id, 'horas', Number(e.target.value), true)}
                              className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center font-bold"
                            />
                            <span className="text-[11px] text-slate-400 font-mono">h</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {s.concluido && s.dataConclusao && (
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-950 text-amber-400 font-mono font-bold border border-amber-500/40 shrink-0">
                                📅 {s.dataConclusao}
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Téc:</span>
                              <input
                                type="text"
                                value={getInitials(s.tecnico || 'HP')}
                                placeholder="HP"
                                maxLength={4}
                                onChange={e => handleUpdateServiceInSelected(s.id, 'tecnico', e.target.value.toUpperCase(), true)}
                                className="w-28 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-center uppercase text-xs"
                                title="Iniciais do Técnico"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. PEÇAS & MATERIAIS APLICADOS */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Peças & Materiais ({selectedFolha.pecas?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => handleAddPartToSelected(false)}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-emerald-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {(!selectedFolha.pecas || selectedFolha.pecas.length === 0) ? (
                    <p className="text-[11px] text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                      Nenhuma peça base registada.
                    </p>
                  ) : (
                    selectedFolha.pecas.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className={`p-3 rounded-2xl border transition-all space-y-2 ${
                          p.concluido
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePecaConcluido(p.id, false)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                              p.concluido
                                ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          <div className="grid grid-cols-3 gap-1.5 flex-1">
                            <input
                              type="text"
                              placeholder="Ref..."
                              value={p.referencia || ''}
                              onChange={e => handleUpdatePartInSelected(p.id, 'referencia', e.target.value, false)}
                              className="py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-hp-400 font-mono font-bold"
                            />
                            <input
                              type="text"
                              placeholder="Designação da peça..."
                              value={p.designacao}
                              onChange={e => handleUpdatePartInSelected(p.id, 'designacao', e.target.value, false)}
                              className={`col-span-2 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white ${
                                p.concluido ? 'line-through text-slate-400' : ''
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-mono font-bold">x</span>
                            <input
                              type="number"
                              value={p.qtd}
                              onChange={e => handleUpdatePartInSelected(p.id, 'qtd', Number(e.target.value), false)}
                              className="w-12 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-center text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePartFromSelected(p.id, false)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Footer row with Date and Technician Initials */}
                        <div className="flex items-center justify-between gap-2 pl-8 text-xs">
                          {p.concluido && p.dataConclusao ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 font-mono font-bold border border-emerald-500/30">
                              📅 {p.dataConclusao}
                            </span>
                          ) : <span />}

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Téc:</span>
                            <input
                              type="text"
                              value={getInitials(p.iniciaisConclusao || 'HP')}
                              placeholder="HP"
                              maxLength={4}
                              onChange={e => handleUpdatePartInSelected(p.id, 'iniciaisConclusao', e.target.value.toUpperCase(), false)}
                              className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-emerald-400 font-mono font-bold text-center uppercase text-xs"
                              title="Iniciais do Técnico"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. PEÇAS & MATERIAIS ADICIONAIS */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-400" />
                      Peças Adicionais ({selectedFolha.pecasAdicionais?.length || 0})
                    </h4>
                    <p className="text-[10px] text-slate-400">Peças aplicadas não orçamentadas inicialmente</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddPartToSelected(true)}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-amber-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {(!selectedFolha.pecasAdicionais || selectedFolha.pecasAdicionais.length === 0) ? (
                    <p className="text-[11px] text-slate-500 italic p-3 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                      Nenhuma peça adicional registada.
                    </p>
                  ) : (
                    selectedFolha.pecasAdicionais.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className={`p-3 rounded-2xl border transition-all space-y-2 ${
                          p.concluido
                            ? 'bg-amber-950/20 border-amber-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePecaConcluido(p.id, true)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                              p.concluido
                                ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-sm'
                                : 'bg-slate-900 border-slate-700 text-transparent hover:border-slate-500'
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>

                          <div className="grid grid-cols-3 gap-1.5 flex-1">
                            <input
                              type="text"
                              placeholder="Ref..."
                              value={p.referencia || ''}
                              onChange={e => handleUpdatePartInSelected(p.id, 'referencia', e.target.value, true)}
                              className="py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-amber-400 font-mono font-bold"
                            />
                            <input
                              type="text"
                              placeholder="Designação da peça adicional..."
                              value={p.designacao}
                              onChange={e => handleUpdatePartInSelected(p.id, 'designacao', e.target.value, true)}
                              className={`col-span-2 py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white ${
                                p.concluido ? 'line-through text-slate-400' : ''
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-mono font-bold">x</span>
                            <input
                              type="number"
                              value={p.qtd}
                              onChange={e => handleUpdatePartInSelected(p.id, 'qtd', Number(e.target.value), true)}
                              className="w-12 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-center text-xs"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePartFromSelected(p.id, true)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Footer row with Date and Technician Initials */}
                        <div className="flex items-center justify-between gap-2 pl-8 text-xs">
                          {p.concluido && p.dataConclusao ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-950 text-amber-400 font-mono font-bold border border-amber-500/40">
                              📅 {p.dataConclusao}
                            </span>
                          ) : <span />}

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Téc:</span>
                            <input
                              type="text"
                              value={getInitials(p.iniciaisConclusao || 'HP')}
                              placeholder="HP"
                              maxLength={4}
                              onChange={e => handleUpdatePartInSelected(p.id, 'iniciaisConclusao', e.target.value.toUpperCase(), true)}
                              className="w-14 py-1 px-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 font-mono font-bold text-center uppercase text-xs"
                              title="Iniciais do Técnico"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 5. NOTAS PARA O CLIENTE */}
              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                    Notas para o Cliente
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-400 font-medium">
                    Visível no PDF do Cliente
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={selectedFolha.notasCliente || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedFolha(prev => prev ? { ...prev, notasCliente: val } : null);
                    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { notasCliente: val });
                  }}
                  placeholder="Observações e recomendações que constarão na folha entregue ao cliente..."
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-hp-500"
                />
              </div>

              {/* 6. NOTAS INTERNAS */}
              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-indigo-300 block flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400" />
                    Notas Internas
                  </label>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/80 text-indigo-300 font-medium">
                    Apenas Oficina (Não sai no PDF)
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={selectedFolha.notasInternas || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedFolha(prev => prev ? { ...prev, notasInternas: val } : null);
                    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { notasInternas: val });
                  }}
                  placeholder="Registo interno para a equipa da oficina..."
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 7. PRÓXIMA REVISÃO RECOMENDADA */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-hp-400" />
                  Próxima Revisão Recomendada
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase">Próxima Revisão (KMS)</label>
                    <input
                      type="number"
                      value={selectedFolha.previsaoRevisaoKms || 0}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setSelectedFolha(prev => prev ? { ...prev, previsaoRevisaoKms: val } : null);
                        db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { previsaoRevisaoKms: val });
                      }}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:border-hp-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase">Próxima Revisão (HORAS)</label>
                    <input
                      type="number"
                      value={selectedFolha.previsaoRevisaoHoras || 0}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setSelectedFolha(prev => prev ? { ...prev, previsaoRevisaoHoras: val } : null);
                        db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { previsaoRevisaoHoras: val });
                      }}
                      className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold focus:outline-none focus:border-hp-500"
                    />
                  </div>
                </div>
              </div>

              {/* 8. Viatura Operacional & Responsável no Local */}
              <div className="p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 block uppercase">Viatura Operacional no Final?</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolha(prev => prev ? { ...prev, equipamentoOperacional: 'Sim' } : null);
                        db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { equipamentoOperacional: 'Sim' });
                      }}
                      className={`py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        (selectedFolha.equipamentoOperacional || 'Sim') === 'Sim'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      🟢 Sim (Operacional)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolha(prev => prev ? { ...prev, equipamentoOperacional: 'Não' } : null);
                        db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { equipamentoOperacional: 'Não' });
                      }}
                      className={`py-2.5 rounded-2xl text-xs font-bold transition-all ${
                        selectedFolha.equipamentoOperacional === 'Não'
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      🔴 Não (Inoperacional)
                    </button>
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Pessoa Presente no Local / Responsável
                  </span>
                  <input
                    type="text"
                    value={selectedFolha.pessoaPresente || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setSelectedFolha(prev => prev ? { ...prev, pessoaPresente: val } : null);
                      db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, selectedFolha.id, { pessoaPresente: val });
                    }}
                    placeholder="Indicar quem esteve presente..."
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-hp-500"
                  />
                </div>
              </div>

              {/* 9. Fotografias da Folha */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 block uppercase">
                    Fotos ({selectedFolha.fotos?.length || 0})
                  </span>
                  <button
                    type="button"
                    onClick={() => selectedFolhaPhotoInputRef.current?.click()}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-hp-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all"
                  >
                    <Camera className="w-3.5 h-3.5" /> + Foto
                  </button>
                  <input
                    ref={selectedFolhaPhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleSelectedFolhaPhotoCapture}
                    className="hidden"
                  />
                </div>

                {selectedFolha.fotos && selectedFolha.fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedFolha.fotos.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt={`Foto ${i + 1}`}
                        onClick={() => setSelectedPhotoPreview(img)}
                        className="w-full h-20 object-cover rounded-xl border border-slate-700 cursor-pointer active:scale-95 transition-transform"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 10. Actions */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <button
                  type="button"
                  onClick={handleSaveSelectedFolha}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-hp-600 to-indigo-600 hover:from-hp-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-hp-600/30 active:scale-[0.99] transition-all"
                >
                  <Check className="w-5 h-5 stroke-[2.5]" /> Guardar Alterações da Folha
                </button>

                <button
                  type="button"
                  onClick={() => generateFolhaServicoPDF(selectedFolha, empresas.find(e => e.id === selectedFolha.empresaId))}
                  className="w-full py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-800 transition-all"
                >
                  <FileDown className="w-4 h-4 text-hp-400" /> Descarregar PDF da Folha
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SCANNER IA (Ollama All-in-One Multi-Photo Auto-Classification) */}
        {/* ========================================================================= */}
        {activeTab === 'ia-wizard' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Header banner */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/90 via-slate-900 to-hp-950/80 border border-indigo-500/40 space-y-2.5 shadow-lg">
              <div className="flex items-center gap-2 text-amber-300">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h2 className="text-base font-black">Scanner Inteligente com Ollama IA</h2>
              </div>
              <p className="text-xs text-indigo-200/90 leading-relaxed">
                <b className="text-white">Carregue todas as fotos de uma só vez</b> (ou tire sequencialmente com a câmara). O Ollama deteta e separa automaticamente:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-semibold text-slate-300">
                <span className="flex items-center gap-1">🚗 Matrícula & Viatura</span>
                <span className="flex items-center gap-1">⏱️ Odómetro / Horímetro</span>
                <span className="flex items-center gap-1">🔩 Peças & Referências</span>
                <span className="flex items-center gap-1">⚠️ Danos & Avarias</span>
              </div>
            </div>

            {/* Main All-in-One Upload Area */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-hp-400" />
                  Fotos da Intervenção ({aiPhotos.length})
                </label>
                {aiPhotos.length > 0 && (
                  <button
                    onClick={() => {
                      setAiPhotos([]);
                      setAiResult(null);
                    }}
                    className="text-[11px] text-rose-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Limpar Todas
                  </button>
                )}
              </div>

              {/* Big tactile button to capture/upload ALL photos */}
              <button
                type="button"
                onClick={() => allAiPhotosInputRef.current?.click()}
                className="w-full py-6 px-4 rounded-2xl border-2 border-dashed border-hp-500/50 bg-hp-600/10 hover:bg-hp-600/20 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-hp-600/20 flex items-center justify-center text-hp-400 shadow-inner">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <span className="font-extrabold text-sm text-white block">
                    {aiPhotos.length === 0 ? 'Tirar / Carregar Todas as Fotos' : '+ Adicionar Mais Fotos'}
                  </span>
                  <span className="text-[11px] text-hp-300 opacity-90 block mt-0.5">
                    Selecione várias fotos da galeria ou câmara de uma só vez
                  </span>
                </div>
              </button>
              <input
                ref={allAiPhotosInputRef}
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={e => handlePhotoCapture(e, 'all-ai')}
                className="hidden"
              />

              {/* Grid of Captured Photos with Classification Status */}
              {aiPhotos.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-slate-400 uppercase block">
                    Fotos Selecionadas ({aiPhotos.length})
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {aiPhotos.map((img, idx) => {
                      const analysis = aiResult?.analiseFotos?.[idx];
                      return (
                        <div key={idx} className="relative group">
                          <img
                            src={img}
                            alt={`Foto ${idx + 1}`}
                            onClick={() => setSelectedPhotoPreview(img)}
                            className="w-full h-24 object-cover rounded-2xl border border-slate-700 cursor-pointer active:scale-95 transition-transform"
                          />
                          <button
                            onClick={() => setAiPhotos(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg active:scale-90"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>

                          {/* Classification Tag Overlay (if analyzed by AI) */}
                          {analysis && (
                            <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded-lg bg-slate-950/90 backdrop-blur-sm border border-slate-700/80 text-[9px] font-bold text-slate-200 truncate text-center">
                              {analysis.labelTipo}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Notes (Voice or Text) */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
              <label className="text-xs font-black uppercase text-white block">
                Notas / Áudio da Intervenção (Opcional)
              </label>
              <textarea
                rows={2}
                value={aiVoiceNotes}
                onChange={e => setAiVoiceNotes(e.target.value)}
                placeholder="Ex: Mudança de óleo 5W30 e filtros, pastilhas da frente gastas, cliente pediu orçamento..."
                className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:border-hp-500 focus:outline-none"
              />
            </div>

            {/* Big Action Button: Process AI Transformation */}
            <button
              onClick={handleRunAiTransformation}
              disabled={isAiProcessing || (aiPhotos.length === 0 && !aiVoiceNotes)}
              className="w-full py-4 rounded-3xl bg-gradient-to-r from-indigo-600 via-hp-600 to-hp-500 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-5 h-5 text-amber-300 ${isAiProcessing ? 'animate-spin' : 'animate-pulse'}`} />
              {isAiProcessing
                ? `Ollama a Analisar ${aiPhotos.length} Fotos...`
                : 'Processar Fotos com Ollama IA'}
            </button>

            {/* AI Result Review & One-Tap Save */}
            {aiResult && aiResult.folha && (
              <div className="p-4 rounded-3xl bg-emerald-950/70 border-2 border-emerald-500/60 space-y-4 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <h3 className="text-sm font-black uppercase">Folha Pronta Gerada por IA!</h3>
                  </div>
                  <Badge variant="success">Ollama Vision</Badge>
                </div>

                {/* Breakdown of what Ollama detected in each photo */}
                {aiResult.analiseFotos && aiResult.analiseFotos.length > 0 && (
                  <div className="space-y-1.5 p-3 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Identificação Automática das Fotos:
                    </span>
                    {aiResult.analiseFotos.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
                        <span className="font-bold text-slate-200">{item.labelTipo}</span>
                        <span className="text-slate-400 truncate max-w-[200px] text-right font-mono text-[11px]">
                          {item.descricaoBreve}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Synthesis Overview */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-400">Matrícula:</span>
                    <b className="text-white text-sm">{aiResult.folha.matricula}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-400">Leituras:</span>
                    <span>{aiResult.folha.kmsAtuais?.toLocaleString()} Km | {aiResult.folha.horasAtuais} H</span>
                  </div>

                  {/* Tempo de Mão de Obra */}
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                    <span className="font-sans text-slate-400 font-bold">Tempo Mão-de-Obra:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const currentH = aiResult.folha.servicos?.[0]?.horas || 1.5;
                          const newH = Math.max(0, Math.round((currentH - 0.5) * 10) / 10);
                          setAiResult(prev => prev ? {
                            ...prev,
                            folha: {
                              ...prev.folha,
                              servicos: prev.folha.servicos && prev.folha.servicos.length > 0
                                ? prev.folha.servicos.map((s, idx) => idx === 0 ? { ...s, horas: newH } : s)
                                : [{ id: db.generateId('srv'), descricao: 'Manutenção / Revisão Geral', horas: newH, valorHora: 45, concluido: false }]
                            }
                          } : null);
                        }}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center active:scale-95"
                      >
                        -0.5
                      </button>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={aiResult.folha.servicos?.[0]?.horas || 1.5}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setAiResult(prev => prev ? {
                            ...prev,
                            folha: {
                              ...prev.folha,
                              servicos: prev.folha.servicos && prev.folha.servicos.length > 0
                                ? prev.folha.servicos.map((s, idx) => idx === 0 ? { ...s, horas: val } : s)
                                : [{ id: db.generateId('srv'), descricao: 'Manutenção / Revisão Geral', horas: val, valorHora: 45, concluido: false }]
                            }
                          } : null);
                        }}
                        className="w-14 py-1 px-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-center text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const currentH = aiResult.folha.servicos?.[0]?.horas || 1.5;
                          const newH = Math.round((currentH + 0.5) * 10) / 10;
                          setAiResult(prev => prev ? {
                            ...prev,
                            folha: {
                              ...prev.folha,
                              servicos: prev.folha.servicos && prev.folha.servicos.length > 0
                                ? prev.folha.servicos.map((s, idx) => idx === 0 ? { ...s, horas: newH } : s)
                                : [{ id: db.generateId('srv'), descricao: 'Manutenção / Revisão Geral', horas: newH, valorHora: 45, concluido: false }]
                            }
                          } : null);
                        }}
                        className="w-7 h-7 rounded-lg bg-hp-600/30 hover:bg-hp-600/50 border border-hp-500/40 text-hp-300 font-bold text-xs flex items-center justify-center active:scale-95"
                      >
                        +0.5
                      </button>
                      <span className="text-hp-400 font-bold font-sans text-xs">h</span>
                    </div>
                  </div>

                  {/* Empresa Cliente */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-800/80 font-sans">
                    <label className="text-[11px] font-bold text-slate-400 uppercase block">Empresa Cliente</label>
                    <select
                      value={aiResult.folha.empresaId || ''}
                      onChange={e => {
                        const newEmpId = e.target.value;
                        const clientMatch = clientes.find(c => c.empresaId === newEmpId);
                        setAiResult(prev => prev ? {
                          ...prev,
                          folha: {
                            ...prev.folha,
                            empresaId: newEmpId,
                            clienteId: clientMatch?.id || prev.folha.clienteId,
                            pessoaPresente: clientMatch?.nome || prev.folha.pessoaPresente
                          }
                        } : null);
                      }}
                      className="w-full py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs"
                    >
                      <option value="">-- Selecionar Empresa --</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.nome}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pessoa Presente / Responsável (Apenas pessoas da empresa selecionada) */}
                  <div className="space-y-1 pt-1.5 border-t border-slate-800/80 font-sans">
                    <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Pessoa Presente no Local / Responsável
                    </label>
                    <select
                      value={aiResult.folha.pessoaPresente || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const matchedClient = clientes.find(c => c.nome === val && c.empresaId === aiResult.folha.empresaId);
                        setAiResult(prev => prev ? {
                          ...prev,
                          folha: {
                            ...prev.folha,
                            pessoaPresente: val,
                            clienteId: matchedClient?.id || prev.folha.clienteId
                          }
                        } : null);
                      }}
                      disabled={!aiResult.folha.empresaId}
                      className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs disabled:opacity-50"
                    >
                      <option value="">
                        {!aiResult.folha.empresaId
                          ? '-- Selecione primeiro a Empresa --'
                          : clientes.filter(c => c.empresaId === aiResult.folha.empresaId).length === 0
                          ? '-- Sem contactos registados nesta empresa --'
                          : '-- Selecionar Pessoa da Empresa --'}
                      </option>
                      {clientes
                        .filter(c => c.empresaId === aiResult.folha.empresaId)
                        .map(cli => (
                          <option key={cli.id} value={cli.nome}>
                            {cli.nome} {cli.cargo ? `(${cli.cargo})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Viatura Operacional no Final */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-sans">
                    <label className="text-[11px] font-bold text-slate-400 uppercase block">Viatura Operacional no Final?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAiResult(prev => prev ? { ...prev, folha: { ...prev.folha, equipamentoOperacional: 'Sim' } } : null)}
                        className={`py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                          (aiResult.folha.equipamentoOperacional || 'Sim') === 'Sim'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        🟢 Sim (Operacional)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiResult(prev => prev ? { ...prev, folha: { ...prev.folha, equipamentoOperacional: 'Não' } } : null)}
                        className={`py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                          aiResult.folha.equipamentoOperacional === 'Não'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                      >
                        🔴 Não (Inoperacional)
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between pt-1 border-t border-slate-800/80">
                    <span className="font-sans text-slate-400">Serviços gerados:</span>
                    <span className="text-hp-400 font-bold">{aiResult.folha.servicos?.length || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-400">Peças identificadas:</span>
                    <span className="text-emerald-400 font-bold">{aiResult.folha.pecas?.length || 0}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setManualFolha(aiResult.folha);
                      setActiveTab('nova-manual');
                    }}
                    className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                  >
                    Rever / Editar à Mão
                  </button>

                  <button
                    onClick={() => handleSaveFolha(aiResult.folha)}
                    disabled={isSaving}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30"
                  >
                    <Check className="w-4 h-4" /> Gravar Folha
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOVA FOLHA MANUAL (Inserção Tátil e Completa à Mão) */}
        {/* ========================================================================= */}
        {activeTab === 'nova-manual' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-hp-500" />
                Registo de Folha de Serviço
              </h2>

              {/* 1. Matrícula (Com Seletor / Pesquisa Tátil) */}
              <div className="space-y-1.5 relative">
                <label className="text-xs font-black uppercase text-slate-300 block">
                  Matrícula da Viatura / Equipamento *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={plateQuery || manualFolha.matricula || ''}
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setPlateQuery(val);
                      const cleanInput = val.replace(/[^A-Z0-9]/g, '');
                      const exactEq = cleanInput ? equipamentos.find(
                        eq => eq.matricula.replace(/[^A-Z0-9]/g, '').toUpperCase() === cleanInput
                      ) : undefined;

                      const matchedEmpId = exactEq?.empresaId;
                      const cliMatch = matchedEmpId ? clientes.find(c => c.empresaId === matchedEmpId) : undefined;

                      setManualFolha(prev => ({
                        ...prev,
                        matricula: val,
                        ...(exactEq ? {
                          marca: exactEq.marca,
                          modelo: exactEq.modelo,
                          equipamentoId: exactEq.id,
                          empresaId: exactEq.empresaId,
                          kmsAtuais: exactEq.kmsAtuais || prev.kmsAtuais,
                          horasAtuais: exactEq.horasAtuais || prev.horasAtuais,
                          pessoaPresente: cliMatch?.nome || '',
                          clienteId: cliMatch?.id || ''
                        } : {})
                      }));
                      setIsPlateDropdownOpen(true);
                    }}
                    onFocus={() => setIsPlateDropdownOpen(true)}
                    placeholder="Ex: 44-HP-77"
                    className="w-full py-3.5 px-4 bg-slate-950 border border-slate-700 rounded-2xl text-base font-mono font-black text-white placeholder-slate-600 focus:border-hp-500"
                  />
                  <Car className="w-5 h-5 text-hp-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Dropdown Suggestions */}
                {isPlateDropdownOpen && matchingPlates.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl divide-y divide-slate-800">
                    {matchingPlates.slice(0, 5).map(eq => (
                      <div
                        key={eq.id}
                        onClick={() => {
                          setPlateQuery(eq.matricula);
                          const cliMatch = eq.empresaId ? clientes.find(c => c.empresaId === eq.empresaId) : undefined;
                          setManualFolha(prev => ({
                            ...prev,
                            matricula: eq.matricula,
                            marca: eq.marca,
                            modelo: eq.modelo,
                            equipamentoId: eq.id,
                            empresaId: eq.empresaId,
                            kmsAtuais: eq.kmsAtuais || prev.kmsAtuais,
                            horasAtuais: eq.horasAtuais || prev.horasAtuais,
                            pessoaPresente: cliMatch?.nome || '',
                            clienteId: cliMatch?.id || ''
                          }));
                          setIsPlateDropdownOpen(false);
                        }}
                        className="p-3 hover:bg-hp-600/20 active:bg-hp-600/30 cursor-pointer flex items-center justify-between"
                      >
                        <span className="font-mono font-black text-sm text-white">{eq.matricula}</span>
                        <span className="text-xs text-slate-400">{eq.marca} {eq.modelo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Empresa Cliente */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block uppercase">Empresa Cliente</label>
                <select
                  value={manualFolha.empresaId || ''}
                  onChange={e => {
                    const empId = e.target.value;
                    const cliMatch = clientes.find(c => c.empresaId === empId);
                    setManualFolha(prev => ({
                      ...prev,
                      empresaId: empId,
                      pessoaPresente: cliMatch?.nome || '',
                      clienteId: cliMatch?.id || ''
                    }));
                  }}
                  className="w-full py-3 px-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="">-- Selecione a Empresa --</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                  ))}
                </select>
              </div>

              {/* Pessoa Presente no Local / Responsável (Apenas pessoas da empresa) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block uppercase flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" /> Pessoa Presente no Local / Responsável
                </label>
                <select
                  value={manualFolha.pessoaPresente || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const cliMatch = clientes.find(c => c.nome === val && c.empresaId === manualFolha.empresaId);
                    setManualFolha(prev => ({
                      ...prev,
                      pessoaPresente: val,
                      clienteId: cliMatch?.id || prev.clienteId
                    }));
                  }}
                  disabled={!manualFolha.empresaId}
                  className="w-full py-3 px-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs font-bold text-white disabled:opacity-50"
                >
                  <option value="">
                    {!manualFolha.empresaId
                      ? '-- Selecione primeiro a Viatura / Empresa --'
                      : clientes.filter(c => c.empresaId === manualFolha.empresaId).length === 0
                      ? '-- Sem contactos registados nesta empresa --'
                      : '-- Selecionar Pessoa da Empresa --'}
                  </option>
                  {clientes
                    .filter(c => c.empresaId === manualFolha.empresaId)
                    .map(cli => (
                      <option key={cli.id} value={cli.nome}>
                        {cli.nome} {cli.cargo ? `(${cli.cargo})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* 3. Kms & Horas Atuais */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block uppercase">Kms Atuais</label>
                  <input
                    type="number"
                    value={manualFolha.kmsAtuais || 0}
                    onChange={e => setManualFolha(prev => ({ ...prev, kmsAtuais: Number(e.target.value) }))}
                    className="w-full py-3 px-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-mono font-bold text-white text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block uppercase">Horas Atuais</label>
                  <input
                    type="number"
                    value={manualFolha.horasAtuais || 0}
                    onChange={e => setManualFolha(prev => ({ ...prev, horasAtuais: Number(e.target.value) }))}
                    className="w-full py-3 px-3 bg-slate-950 border border-slate-700 rounded-2xl text-sm font-mono font-bold text-white text-center"
                  />
                </div>
              </div>

              {/* 4. Anomalias / Descrição */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block uppercase">Anomalias Reportadas / Descrição</label>
                <textarea
                  rows={2}
                  value={manualFolha.anomalias || ''}
                  onChange={e => setManualFolha(prev => ({ ...prev, anomalias: e.target.value }))}
                  placeholder="Descreva as anomalias ou o trabalho a realizar..."
                  className="w-full py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white"
                />
              </div>

              {/* 5. Serviços (Mão-de-Obra) & Tempo Total */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase text-slate-300 shrink-0">
                    Serviços / Mão-de-Obra
                  </label>

                  {/* Tempo Total de Mão-de-Obra colocado entre o título e o botão */}
                  <div className="px-2.5 py-1 rounded-xl bg-hp-950/80 border border-hp-500/40 text-hp-400 font-mono font-black text-xs flex items-center gap-1.5 shadow-sm">
                    <Clock className="w-3 h-3 text-hp-400 shrink-0" />
                    <span>
                      {manualFolha.servicos?.reduce((acc, s) => acc + (Number(s.horas) || 0), 0).toFixed(1) || '0.0'} Horas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newS: ServicoItem = {
                        id: db.generateId('srv'),
                        descricao: '',
                        horas: 1.0,
                        valorHora: 45.0,
                        concluido: false,
                        tecnico: 'Hugo Portugal'
                      };
                      setManualFolha(prev => ({ ...prev, servicos: [...(prev.servicos || []), newS] }));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-hp-600 hover:bg-hp-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 active:scale-95 shadow-md shadow-hp-600/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {manualFolha.servicos?.map((s, idx) => (
                    <div key={s.id || idx} className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <input
                        type="text"
                        placeholder="Descrição do serviço..."
                        value={s.descricao}
                        onChange={e => {
                          const val = e.target.value;
                          setManualFolha(prev => ({
                            ...prev,
                            servicos: prev.servicos?.map(item => item.id === s.id ? { ...item, descricao: val } : item)
                          }));
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-slate-400 font-sans font-bold">Horas:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setManualFolha(prev => ({
                                ...prev,
                                servicos: prev.servicos?.map(item =>
                                  item.id === s.id
                                    ? { ...item, horas: Math.max(0, Math.round(((Number(item.horas) || 0) - 0.5) * 10) / 10) }
                                    : item
                                )
                              }));
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold text-xs flex items-center justify-center"
                          >
                            -0.5
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={s.horas}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setManualFolha(prev => ({
                                ...prev,
                                servicos: prev.servicos?.map(item => item.id === s.id ? { ...item, horas: val } : item)
                              }));
                            }}
                            className="w-14 py-1 px-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold text-center font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setManualFolha(prev => ({
                                ...prev,
                                servicos: prev.servicos?.map(item =>
                                  item.id === s.id
                                    ? { ...item, horas: Math.round(((Number(item.horas) || 0) + 0.5) * 10) / 10 }
                                    : item
                                )
                              }));
                            }}
                            className="w-7 h-7 rounded-lg bg-hp-600/30 hover:bg-hp-600/50 border border-hp-500/40 active:scale-95 text-hp-300 font-bold text-xs flex items-center justify-center"
                          >
                            +0.5
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setManualFolha(prev => ({
                              ...prev,
                              servicos: prev.servicos?.filter(item => item.id !== s.id)
                            }));
                          }}
                          className="p-1 text-rose-400 hover:bg-rose-950 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 6. Peças Aplicadas */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-300">Peças & Material</label>
                  <button
                    type="button"
                    onClick={() => {
                      const newP: PecaItem = {
                        id: db.generateId('pec'),
                        designacao: '',
                        qtd: 1,
                        concluido: false,
                        isLivre: true
                      };
                      setManualFolha(prev => ({ ...prev, pecas: [...(prev.pecas || []), newP] }));
                    }}
                    className="px-2.5 py-1 rounded-xl bg-hp-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar
                  </button>
                </div>

                <div className="space-y-2">
                  {manualFolha.pecas?.map((p, idx) => (
                    <div key={p.id || idx} className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                      <input
                        type="text"
                        placeholder="Nome da peça / Referência..."
                        value={p.designacao}
                        onChange={e => {
                          const val = e.target.value;
                          setManualFolha(prev => ({
                            ...prev,
                            pecas: prev.pecas?.map(item => item.id === p.id ? { ...item, designacao: val } : item)
                          }));
                        }}
                        className="w-full py-1.5 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-slate-400">Qtd:</span>
                          <input
                            type="number"
                            value={p.qtd}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setManualFolha(prev => ({
                                ...prev,
                                pecas: prev.pecas?.map(item => item.id === p.id ? { ...item, qtd: val } : item)
                              }));
                            }}
                            className="w-16 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold text-center"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setManualFolha(prev => ({
                              ...prev,
                              pecas: prev.pecas?.filter(item => item.id !== p.id)
                            }));
                          }}
                          className="p-1 text-rose-400 hover:bg-rose-950 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7. Fotos da Folha */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-black uppercase text-slate-300 block">Fotografias</label>
                {manualFolha.fotos && manualFolha.fotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {manualFolha.fotos.map((img, i) => (
                      <div key={i} className="relative">
                        <img
                          src={img}
                          alt={`Foto ${i}`}
                          onClick={() => setSelectedPhotoPreview(img)}
                          className="w-full h-20 object-cover rounded-xl border border-slate-700 cursor-pointer"
                        />
                        <button
                          onClick={() => {
                            setManualFolha(prev => ({
                              ...prev,
                              fotos: prev.fotos?.filter((_, idx) => idx !== i)
                            }));
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => manualPhotoInputRef.current?.click()}
                  className="w-full py-3 rounded-2xl border border-slate-700 bg-slate-950 text-slate-300 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 text-hp-400" /> Tirar / Anexar Fotografia
                </button>
                <input
                  ref={manualPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={e => handlePhotoCapture(e, 'manual')}
                  className="hidden"
                />
              </div>

              {/* 8. Viatura Operacional & Serviço Finalizado */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block uppercase mb-1.5">
                    Viatura Operacional no Final? *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'Sim' as const, label: '🟢 Sim', desc: 'Operacional' },
                      { id: 'Não' as const, label: '🔴 Não', desc: 'Inoperacional' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setManualFolha(prev => ({ ...prev, equipamentoOperacional: opt.id }))}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center text-center transition-all ${
                          (manualFolha.equipamentoOperacional || 'Sim') === opt.id
                            ? opt.id === 'Sim'
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        <span className="font-extrabold text-xs">{opt.label}</span>
                        <span className="text-[10px] opacity-80">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block uppercase mb-1.5">
                    Serviço Finalizado?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setManualFolha(prev => ({ ...prev, equipamentoFinalizado: 'Sim' }))}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        manualFolha.equipamentoFinalizado === 'Sim'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      🟢 Sim (Finalizado)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualFolha(prev => ({ ...prev, equipamentoFinalizado: 'Não' }))}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                        (manualFolha.equipamentoFinalizado || 'Não') === 'Não'
                          ? 'bg-slate-800 text-white border border-slate-600'
                          : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      ⚪ Não (Em Curso)
                    </button>
                  </div>
                </div>
              </div>

              {/* 9. Notas para o Cliente & Notas Internas */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-400 block uppercase">Notas para o Cliente (PDF)</label>
                  <textarea
                    rows={2}
                    value={manualFolha.notasCliente || ''}
                    onChange={e => setManualFolha(prev => ({ ...prev, notasCliente: e.target.value }))}
                    placeholder="Observações entregues ao cliente..."
                    className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-indigo-300 block uppercase">Notas Internas (IA & Oficina)</label>
                  <textarea
                    rows={2}
                    value={manualFolha.notasInternas || ''}
                    onChange={e => setManualFolha(prev => ({ ...prev, notasInternas: e.target.value }))}
                    placeholder="Notas internas da equipa (a IA detetará tarefas automáticas)..."
                    className="w-full py-2 px-3 bg-slate-950 border border-indigo-900/60 rounded-2xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={() => handleSaveFolha(manualFolha)}
                disabled={isSaving}
                className="w-full py-4 rounded-3xl bg-gradient-to-r from-hp-600 to-indigo-600 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-hp-600/40 active:scale-95 transition-all"
              >
                <Check className="w-5 h-5" />
                {isSaving ? 'A Gravar...' : 'Gravar Folha de Serviço'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: CONSULTAS & ACRESCENTAR ENTIDADES (Frotas, Empresas, Clientes) */}
        {/* ========================================================================= */}
        {activeTab === 'consultas' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Consultation Navigation Tabs (3 Grid Columns - No Scroll Required) */}
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'equipamentos', label: 'Frotas', icon: <Car className="w-3.5 h-3.5 shrink-0" /> },
                { id: 'empresas', label: 'Empresas', icon: <Building2 className="w-3.5 h-3.5 shrink-0" /> },
                { id: 'clientes', label: 'Clientes', icon: <User className="w-3.5 h-3.5 shrink-0" /> }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setConsultaSubTab(sub.id as ConsultaSubTab);
                    setConsultaQuery('');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
                    consultaSubTab === sub.id
                      ? 'bg-hp-600 text-white shadow-md shadow-hp-600/20'
                      : theme === 'light'
                      ? 'bg-white text-slate-700 border border-slate-200'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {sub.icon}
                  <span className="truncate">{sub.label}</span>
                </button>
              ))}
            </div>

            {/* Search and Action Bar for Current Subtab */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Pesquisar em ${
                    consultaSubTab === 'equipamentos'
                      ? 'matrícula, marca, modelo...'
                      : consultaSubTab === 'empresas'
                      ? 'nome da empresa, NIF, morada...'
                      : 'nome do cliente, telefone, empresa...'
                  }`}
                  value={consultaQuery}
                  onChange={e => setConsultaQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-semibold border focus:outline-none focus:border-hp-500 ${
                    theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>

              {/* Add New Buttons for Viaturas, Empresas, Clientes */}
              {consultaSubTab === 'equipamentos' && (
                <button
                  onClick={() => setIsAddEquipamentoOpen(true)}
                  className="px-3 py-2.5 rounded-2xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-hp-600/30 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Acrescentar
                </button>
              )}

              {consultaSubTab === 'empresas' && (
                <button
                  onClick={() => setIsAddEmpresaOpen(true)}
                  className="px-3 py-2.5 rounded-2xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-hp-600/30 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Acrescentar
                </button>
              )}

              {consultaSubTab === 'clientes' && (
                <button
                  onClick={() => setIsAddClienteOpen(true)}
                  className="px-3 py-2.5 rounded-2xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-hp-600/30 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Acrescentar
                </button>
              )}
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* SUBTAB: EQUIPAMENTOS / FROTAS */}
            {/* --------------------------------------------------------------------- */}
            {consultaSubTab === 'equipamentos' && (
              <div className="space-y-3">
                {/* Form to Add New Equipment */}
                {isAddEquipamentoOpen && (
                  <div className="p-4 rounded-3xl bg-hp-950/40 border-2 border-hp-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-hp-400 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Acrescentar Nova Viatura / Equipamento
                      </h3>
                      <button
                        onClick={() => setIsAddEquipamentoOpen(false)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Matrícula *</label>
                        <input
                          type="text"
                          placeholder="Ex: 44-HP-77"
                          value={newEquipamento.matricula || ''}
                          onChange={e => setNewEquipamento(prev => ({ ...prev, matricula: e.target.value.toUpperCase() }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Marca</label>
                          <input
                            type="text"
                            placeholder="Ex: Renault"
                            value={newEquipamento.marca || ''}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, marca: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Modelo</label>
                          <input
                            type="text"
                            placeholder="Ex: Master 2.3 dCi"
                            value={newEquipamento.modelo || ''}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, modelo: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tipo de Equipamento (Campo Livre)</label>
                        <input
                          type="text"
                          placeholder="Ex: Furgão / Trator / Empilhador / Manitou"
                          value={newEquipamento.tipo || ''}
                          onChange={e => setNewEquipamento(prev => ({ ...prev, tipo: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Empresa Proprietária *</label>
                        <select
                          value={newEquipamento.empresaId || ''}
                          onChange={e => setNewEquipamento(prev => ({ ...prev, empresaId: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                        >
                          <option value="">-- Selecione a Empresa --</option>
                          {empresas.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.nome}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Kms Atuais</label>
                          <input
                            type="number"
                            value={newEquipamento.kmsAtuais || 0}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, kmsAtuais: Number(e.target.value) }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Horas Atuais</label>
                          <input
                            type="number"
                            value={newEquipamento.horasAtuais || 0}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, horasAtuais: Number(e.target.value) }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Data de Entrega</label>
                          <input
                            type="date"
                            value={newEquipamento.dataEntrega || ''}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, dataEntrega: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Data de Formação</label>
                          <input
                            type="date"
                            value={newEquipamento.dataFormacao || ''}
                            onChange={e => setNewEquipamento(prev => ({ ...prev, dataFormacao: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* Photo Capture for New Equipment */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fotografia da Viatura</label>
                        {newEquipamento.fotos && newEquipamento.fotos.length > 0 && (
                          <img
                            src={newEquipamento.fotos[0]}
                            alt="Preview"
                            className="w-full h-24 object-cover rounded-xl border border-slate-700 mb-2"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => newEquipPhotoInputRef.current?.click()}
                          className="w-full py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Camera className="w-4 h-4 text-hp-400" /> Tirar / Escolher Foto
                        </button>
                        <input
                          ref={newEquipPhotoInputRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={e => handlePhotoCapture(e, 'new-equip')}
                          className="hidden"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddEquipamentoOpen(false)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-slate-300 font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewEquipamento}
                          className="flex-1 py-2.5 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold"
                        >
                          Gravar Viatura
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {equipamentos
                  .filter(eq => {
                    const q = consultaQuery.toLowerCase();
                    const empName = empresas.find(e => e.id === eq.empresaId)?.nome?.toLowerCase() || '';
                    return (
                      eq.matricula.toLowerCase().includes(q) ||
                      eq.marca.toLowerCase().includes(q) ||
                      eq.modelo.toLowerCase().includes(q) ||
                      empName.includes(q)
                    );
                  })
                  .map(eq => {
                    const ownerCompany = empresas.find(e => e.id === eq.empresaId);
                    return (
                      <div
                        key={eq.id}
                        className={`p-4 rounded-3xl border space-y-3 shadow-sm ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-base font-black text-hp-400 px-2.5 py-1 bg-hp-500/10 rounded-xl inline-block border border-hp-500/20">
                              {eq.matricula}
                            </span>
                            <h3 className="text-sm font-black text-white mt-1.5">{eq.marca} {eq.modelo}</h3>
                            <p className="text-xs font-bold text-hp-300">{ownerCompany?.nome || 'Empresa Geral'}</p>
                          </div>

                          {eq.fotos && eq.fotos.length > 0 && (
                            <img
                              src={eq.fotos[0]}
                              alt={eq.matricula}
                              onClick={() => setSelectedPhotoPreview(eq.fotos?.[0] || null)}
                              className="w-16 h-16 rounded-2xl object-cover border border-slate-700 cursor-pointer shadow-md"
                            />
                          )}
                        </div>

                        {/* Mileage / Hours info */}
                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">QUILÓMETROS</span>
                            <b className="text-white font-bold">{eq.kmsAtuais || 0} km</b>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">HORAS TRABALHO</span>
                            <b className="text-white font-bold">{eq.horasAtuais || 0} h</b>
                          </div>
                        </div>

                        {/* Service history summary */}
                        <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                          <span>Tipo: <b className="text-slate-200">{eq.tipo || 'Viatura'}</b></span>
                          {eq.dataEntrega && (
                            <span className="text-[11px] font-mono">Entregue: {eq.dataEntrega}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* --------------------------------------------------------------------- */}
            {/* SUBTAB: EMPRESAS */}
            {/* --------------------------------------------------------------------- */}
            {consultaSubTab === 'empresas' && (
              <div className="space-y-3">
                {/* Form to Add New Empresa */}
                {isAddEmpresaOpen && (
                  <div className="p-4 rounded-3xl bg-hp-950/40 border-2 border-hp-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-hp-400 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Acrescentar Nova Empresa
                      </h3>
                      <button
                        onClick={() => setIsAddEmpresaOpen(false)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nome da Empresa *</label>
                        <input
                          type="text"
                          placeholder="Ex: Construções Silva & Filhos, Lda"
                          value={newEmpresa.nome || ''}
                          onChange={e => setNewEmpresa(prev => ({ ...prev, nome: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">NIF</label>
                          <input
                            type="text"
                            placeholder="Ex: 501 234 567"
                            value={newEmpresa.nif || ''}
                            onChange={e => setNewEmpresa(prev => ({ ...prev, nif: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Telefone Geral</label>
                          <input
                            type="text"
                            placeholder="Ex: 234 123 456"
                            value={newEmpresa.telefone || ''}
                            onChange={e => setNewEmpresa(prev => ({ ...prev, telefone: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Morada da Sede *</label>
                        <textarea
                          rows={2}
                          placeholder="Rua, Número, Código Postal, Localidade"
                          value={newEmpresa.moradaSede || ''}
                          onChange={e => setNewEmpresa(prev => ({ ...prev, moradaSede: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                        />
                      </div>

                      {/* Estaleiros Adicionais */}
                      <div className="p-2.5 bg-slate-900/80 rounded-2xl border border-slate-800 space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-400 block">Adicionar Estaleiro (Opcional)</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="Nome (Ex: Águeda)"
                            value={tempEstaleiroNome}
                            onChange={e => setTempEstaleiroNome(e.target.value)}
                            className="py-1 px-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-[11px]"
                          />
                          <input
                            type="text"
                            placeholder="Morada"
                            value={tempEstaleiroMorada}
                            onChange={e => setTempEstaleiroMorada(e.target.value)}
                            className="py-1 px-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-[11px]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (tempEstaleiroNome && tempEstaleiroMorada) {
                              const est: Estaleiro = {
                                id: db.generateId('est'),
                                nome: tempEstaleiroNome,
                                morada: tempEstaleiroMorada
                              };
                              setNewEmpresa(prev => ({
                                ...prev,
                                estaleiros: [...(prev.estaleiros || []), est]
                              }));
                              setTempEstaleiroNome('');
                              setTempEstaleiroMorada('');
                            }
                          }}
                          className="w-full py-1 rounded-lg bg-slate-800 text-hp-300 font-bold text-[11px]"
                        >
                          + Inserir Estaleiro
                        </button>

                        {newEmpresa.estaleiros && newEmpresa.estaleiros.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {newEmpresa.estaleiros.map((est, i) => (
                              <div key={i} className="text-[11px] text-slate-300 flex justify-between bg-slate-950 p-1.5 rounded">
                                <span>{est.nome}: {est.morada}</span>
                                <button
                                  type="button"
                                  onClick={() => setNewEmpresa(prev => ({ ...prev, estaleiros: prev.estaleiros?.filter((_, idx) => idx !== i) }))}
                                  className="text-rose-400 font-bold ml-2"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddEmpresaOpen(false)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-slate-300 font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewEmpresa}
                          className="flex-1 py-2.5 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold"
                        >
                          Gravar Empresa
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {empresas
                  .filter(emp => {
                    const q = consultaQuery.toLowerCase();
                    return (
                      emp.nome.toLowerCase().includes(q) ||
                      (emp.nif && emp.nif.includes(q)) ||
                      (emp.moradaSede && emp.moradaSede.toLowerCase().includes(q))
                    );
                  })
                  .map(emp => {
                    const companyVehicles = equipamentos.filter(eq => eq.empresaId === emp.id);

                    return (
                      <div
                        key={emp.id}
                        className={`p-4 rounded-3xl border space-y-3 shadow-sm ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-extrabold text-white">{emp.nome}</h3>
                            <span className="text-xs font-mono text-slate-400">NIF: {emp.nif || 'N/A'}</span>
                          </div>
                          <Badge variant="info">{companyVehicles.length} Viaturas</Badge>
                        </div>

                        {/* Contacts quick links */}
                        <div className="flex gap-2 text-xs font-semibold">
                          {emp.telefone && (
                            <a
                              href={`tel:${emp.telefone}`}
                              className="flex-1 py-2 rounded-xl bg-slate-950 text-slate-200 flex items-center justify-center gap-1.5 border border-slate-800"
                            >
                              <Phone className="w-3.5 h-3.5 text-emerald-400" /> {emp.telefone}
                            </a>
                          )}
                          {emp.email && (
                            <a
                              href={`mailto:${emp.email}`}
                              className="flex-1 py-2 rounded-xl bg-slate-950 text-slate-200 flex items-center justify-center gap-1.5 border border-slate-800"
                            >
                              <Mail className="w-3.5 h-3.5 text-hp-400" /> Email
                            </a>
                          )}
                        </div>

                        {/* Estaleiros vinculados */}
                        {emp.estaleiros && emp.estaleiros.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block">Estaleiros / Parques de Obras</span>
                            <div className="space-y-1">
                              {emp.estaleiros.map((est, i) => (
                                <div key={i} className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs">
                                  <div className="min-w-0 pr-2">
                                    <span className="font-bold text-white block">{est.nome}</span>
                                    <span className="text-[11px] text-slate-400 truncate block">{est.morada}</span>
                                  </div>
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(est.morada)}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg bg-slate-800 text-hp-300 shrink-0"
                                  >
                                    <Navigation className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* --------------------------------------------------------------------- */}
            {/* SUBTAB: CLIENTES / CONTACTOS */}
            {/* --------------------------------------------------------------------- */}
            {consultaSubTab === 'clientes' && (
              <div className="space-y-3">
                {/* Form to Add New Client */}
                {isAddClienteOpen && (
                  <div className="p-4 rounded-3xl bg-hp-950/40 border-2 border-hp-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-hp-400 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Acrescentar Novo Cliente / Contacto
                      </h3>
                      <button
                        onClick={() => setIsAddClienteOpen(false)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nome do Contacto *</label>
                        <input
                          type="text"
                          placeholder="Ex: Eng. Carlos Silva"
                          value={newCliente.nome || ''}
                          onChange={e => setNewCliente(prev => ({ ...prev, nome: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cargo / Função</label>
                          <input
                            type="text"
                            placeholder="Ex: Gestor de Frota"
                            value={newCliente.cargo || ''}
                            onChange={e => setNewCliente(prev => ({ ...prev, cargo: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Empresa Associada *</label>
                          <select
                            value={newCliente.empresaId || ''}
                            onChange={e => setNewCliente(prev => ({ ...prev, empresaId: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                          >
                            <option value="">-- Selecione a Empresa --</option>
                            {empresas.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.nome}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Telemóvel</label>
                          <input
                            type="text"
                            placeholder="Ex: 912 345 678"
                            value={newCliente.telemovel || ''}
                            onChange={e => setNewCliente(prev => ({ ...prev, telemovel: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Email</label>
                          <input
                            type="email"
                            placeholder="carlos@empresa.pt"
                            value={newCliente.email || ''}
                            onChange={e => setNewCliente(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Notas / Observações</label>
                        <textarea
                          rows={2}
                          placeholder="Horários de contacto preferenciais, notas de assistência..."
                          value={newCliente.notas || ''}
                          onChange={e => setNewCliente(prev => ({ ...prev, notas: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddClienteOpen(false)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-slate-300 font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewCliente}
                          className="flex-1 py-2.5 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold"
                        >
                          Gravar Contacto
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {clientes
                  .filter(c => {
                    const q = consultaQuery.toLowerCase();
                    const empName = empresas.find(e => e.id === c.empresaId)?.nome?.toLowerCase() || '';
                    return (
                      c.nome.toLowerCase().includes(q) ||
                      (c.cargo && c.cargo.toLowerCase().includes(q)) ||
                      (c.telemovel && c.telemovel.includes(q)) ||
                      empName.includes(q)
                    );
                  })
                  .map(cli => {
                    const associatedEmp = empresas.find(e => e.id === cli.empresaId);
                    return (
                      <div
                        key={cli.id}
                        className={`p-4 rounded-3xl border space-y-3 shadow-sm ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-base font-extrabold text-white">{cli.nome}</h3>
                            <p className="text-xs text-slate-400 font-medium">{cli.cargo || 'Responsável'}</p>
                          </div>
                          <Badge variant="info">{associatedEmp?.nome || 'Geral'}</Badge>
                        </div>

                        {/* Contact Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {cli.telemovel && (
                            <a
                              href={`tel:${cli.telemovel}`}
                              className="py-3 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 border border-emerald-500/30 active:scale-95 transition-all"
                            >
                              <Phone className="w-4 h-4 text-emerald-400" />
                              <span>{cli.telemovel}</span>
                            </a>
                          )}
                          {cli.email && (
                            <a
                              href={`mailto:${cli.email}`}
                              className="py-3 rounded-2xl bg-hp-600/20 hover:bg-hp-600/30 text-hp-300 font-bold text-xs flex items-center justify-center gap-2 border border-hp-500/30 active:scale-95 transition-all truncate px-2"
                            >
                              <Mail className="w-4 h-4 text-hp-400 shrink-0" />
                              <span className="truncate">Email</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: PEÇAS (Catálogo de Peças e Pedidos de Peças) */}
        {/* ========================================================================= */}
        {activeTab === 'pecas' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Peças Navigation Tabs (2 Grid Columns - No Scroll Required) */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'catalogo-pecas', label: 'Catálogo de Peças', icon: <Package className="w-3.5 h-3.5 shrink-0" /> },
                { id: 'pedidos-pecas', label: 'Pedidos de Peças', icon: <ShoppingCart className="w-3.5 h-3.5 shrink-0" /> }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => {
                    setPecasSubTab(sub.id as PecasSubTab);
                    setPecasQuery('');
                  }}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center ${
                    pecasSubTab === sub.id
                      ? 'bg-hp-600 text-white shadow-md shadow-hp-600/20'
                      : theme === 'light'
                      ? 'bg-white text-slate-700 border border-slate-200'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  {sub.icon}
                  <span className="truncate">{sub.label}</span>
                </button>
              ))}
            </div>

            {/* Search and Action Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={`Pesquisar em ${
                    pecasSubTab === 'catalogo-pecas'
                      ? 'referência, peça, marca...'
                      : 'pedido, referência, matrícula...'
                  }`}
                  value={pecasQuery}
                  onChange={e => setPecasQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-semibold border focus:outline-none focus:border-hp-500 ${
                    theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                  }`}
                />
              </div>

              {pecasSubTab === 'pedidos-pecas' && (
                <button
                  onClick={() => setIsAddPedidoPecaOpen(true)}
                  className="px-3 py-2.5 rounded-2xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-hp-600/30 shrink-0"
                >
                  <Plus className="w-4 h-4" /> Pedir Peça
                </button>
              )}
            </div>

            {/* Read-Only Badge for Catálogo de Peças only */}
            {pecasSubTab === 'catalogo-pecas' && (
              <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-hp-400" />
                  Módulo de Consulta Rápida de Peças
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Apenas Consulta
                </span>
              </div>
            )}

            {/* --------------------------------------------------------------------- */}
            {/* SUBTAB: CATÁLOGO DE PEÇAS */}
            {/* --------------------------------------------------------------------- */}
            {pecasSubTab === 'catalogo-pecas' && (
              <div className="space-y-3">
                {catalogoPecas
                  .filter(p => {
                    const q = pecasQuery.toLowerCase();
                    return (
                      p.referencia.toLowerCase().includes(q) ||
                      p.designacao.toLowerCase().includes(q) ||
                      (p.marca && p.marca.toLowerCase().includes(q)) ||
                      (p.fornecedor && p.fornecedor.toLowerCase().includes(q))
                    );
                  })
                  .map(peca => {
                    const usage = calculatePartUsage(peca.referencia);
                    return (
                      <div
                        key={peca.id}
                        className={`p-4 rounded-3xl border space-y-3 shadow-sm ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-black text-hp-400 px-2 py-0.5 bg-hp-500/10 rounded-lg">
                              {peca.referencia}
                            </span>
                            <h3 className="text-sm font-black text-white mt-1">{peca.designacao}</h3>
                            <p className="text-xs text-slate-400 font-medium">{peca.marca} {peca.modelo}</p>
                          </div>

                          <div className="text-right">
                            {peca.fornecedor && (
                              <span className="text-[11px] font-semibold text-slate-300 px-2 py-0.5 bg-slate-800 rounded-lg block font-sans">
                                {peca.fornecedor}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Part Usage in 30, 90, 360 days */}
                        <div className="p-2.5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-1 font-mono text-[11px]">
                          <span className="text-[10px] font-sans font-bold uppercase text-slate-400 block">
                            Peças Usadas na Oficina
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="p-1.5 bg-slate-900 rounded-xl">
                              <span className="text-[9px] text-slate-400 block">30 DIAS</span>
                              <b className="text-white text-xs">{usage.count30}</b>
                            </div>
                            <div className="p-1.5 bg-slate-900 rounded-xl">
                              <span className="text-[9px] text-slate-400 block">90 DIAS</span>
                              <b className="text-white text-xs">{usage.count90}</b>
                            </div>
                            <div className="p-1.5 bg-slate-900 rounded-xl">
                              <span className="text-[9px] text-slate-400 block">360 DIAS</span>
                              <b className="text-white text-xs">{usage.count360}</b>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* --------------------------------------------------------------------- */}
            {/* SUBTAB: PEDIDOS DE PEÇAS */}
            {/* --------------------------------------------------------------------- */}
            {pecasSubTab === 'pedidos-pecas' && (
              <div className="space-y-3">
                {/* Form to Add New Pedido de Peça */}
                {isAddPedidoPecaOpen && (
                  <div className="p-4 rounded-3xl bg-hp-950/40 border-2 border-hp-500/60 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black text-hp-400 flex items-center gap-1.5">
                        <Plus className="w-4 h-4" /> Novo Pedido de Peça
                      </h3>
                      <button
                        onClick={() => setIsAddPedidoPecaOpen(false)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {/* Referência / Peça Selecionada do Catálogo */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Peça do Catálogo (Opcional)
                        </label>
                        <select
                          onChange={e => {
                            const pecaSel = catalogoPecas.find(p => p.id === e.target.value);
                            if (pecaSel) {
                              setNewPedidoPeca(prev => ({
                                ...prev,
                                referencia: pecaSel.referencia,
                                designacao: pecaSel.designacao,
                                fornecedor: pecaSel.fornecedor || prev.fornecedor
                              }));
                            }
                          }}
                          className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                        >
                          <option value="">-- Escolher do Catálogo ou escrever abaixo --</option>
                          {catalogoPecas.map(p => (
                            <option key={p.id} value={p.id}>
                              [{p.referencia}] {p.designacao} - {p.marca}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Referência / Código
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: FIL-1029"
                            value={newPedidoPeca.referencia}
                            onChange={e => setNewPedidoPeca(prev => ({ ...prev, referencia: e.target.value.toUpperCase() }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Quantidade *
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={newPedidoPeca.qtd}
                            onChange={e => setNewPedidoPeca(prev => ({ ...prev, qtd: Number(e.target.value) }))}
                            className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono font-bold text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Designação da Peça *
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Filtro de Óleo Cartucho / Bomba Hidráulica"
                          value={newPedidoPeca.designacao}
                          onChange={e => setNewPedidoPeca(prev => ({ ...prev, designacao: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Matrícula / Viatura
                          </label>
                          <select
                            value={newPedidoPeca.matricula}
                            onChange={e => {
                              const mat = e.target.value;
                              const eq = equipamentos.find(v => v.matricula === mat);
                              const emp = empresas.find(em => em.id === eq?.empresaId);
                              setNewPedidoPeca(prev => ({
                                ...prev,
                                matricula: mat,
                                empresaNome: emp?.nome || prev.empresaNome
                              }));
                            }}
                            className="w-full py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs"
                          >
                            <option value="">Geral / Stock</option>
                            {equipamentos.map(eq => (
                              <option key={eq.id} value={eq.matricula}>
                                {eq.matricula} - {eq.marca}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                            Prioridade
                          </label>
                          <select
                            value={newPedidoPeca.prioridade}
                            onChange={e => setNewPedidoPeca(prev => ({ ...prev, prioridade: e.target.value as any }))}
                            className="w-full py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs"
                          >
                            <option value="normal">Normal</option>
                            <option value="urgente">Urgente</option>
                            <option value="critico">Crítico</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Fornecedor Sugerido
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: AutoDoc / Valeo / Bosch / Fornecedor Local"
                          value={newPedidoPeca.fornecedor}
                          onChange={e => setNewPedidoPeca(prev => ({ ...prev, fornecedor: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                          Notas / Observações
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Motivo do pedido, prazos ou especificações técnicas..."
                          value={newPedidoPeca.notas}
                          onChange={e => setNewPedidoPeca(prev => ({ ...prev, notas: e.target.value }))}
                          className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddPedidoPecaOpen(false)}
                          className="flex-1 py-2.5 rounded-xl bg-slate-900 text-slate-300 font-bold"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewPedidoPeca}
                          className="flex-1 py-2.5 rounded-xl bg-hp-600 hover:bg-hp-500 text-white font-extrabold"
                        >
                          Gravar Pedido
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {pedidosPecas
                  .filter(ped => {
                    const q = pecasQuery.toLowerCase();
                    const hasPartMatch = ped.pecas?.some(
                      p => p.referencia?.toLowerCase().includes(q) || p.designacao?.toLowerCase().includes(q)
                    );
                    return (
                      ped.numero.toLowerCase().includes(q) ||
                      (ped.fornecedor && ped.fornecedor.toLowerCase().includes(q)) ||
                      (ped.matricula && ped.matricula.toLowerCase().includes(q)) ||
                      hasPartMatch
                    );
                  })
                  .map(ped => {
                    const firstPart = ped.pecas?.[0];
                    const totalQtd = ped.pecas?.reduce((acc, p) => acc + (p.qtd || 1), 0) || 1;

                    return (
                      <div
                        key={ped.id}
                        className={`p-4 rounded-3xl border space-y-3 shadow-sm ${
                          theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-black text-hp-400 px-2 py-0.5 bg-hp-500/10 rounded-lg">
                              {ped.numero}
                            </span>
                            <h3 className="text-sm font-black text-white mt-1">
                              {firstPart?.designacao || 'Pedido de Peça'}
                            </h3>
                            {firstPart?.referencia && (
                              <span className="text-xs font-mono text-slate-400">Ref: {firstPart.referencia}</span>
                            )}
                          </div>

                          <Badge
                            variant={
                              ped.status === 'Recebido'
                                ? 'success'
                                : ped.status === 'Encomendado'
                                ? 'warning'
                                : 'info'
                            }
                          >
                            {ped.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">QUANTIDADE</span>
                            <b className="text-white font-bold">{totalQtd} un.</b>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block font-sans">MATRÍCULA</span>
                            <b className="text-hp-400">{ped.matricula || 'Geral'}</b>
                          </div>
                        </div>

                        {ped.notas && (
                          <p className="text-xs text-slate-300 italic bg-slate-950/40 p-2 rounded-xl border border-slate-800/60">
                            "{ped.notas}"
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: TAREFAS RÁPIDAS (Check com 1 Toque) */}
        {/* ========================================================================= */}
        {activeTab === 'tarefas' && (
          <div className="space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-hp-400" />
                Tarefas Pendentes
              </h2>
              <span className="text-xs font-mono font-bold text-hp-400 px-2 py-0.5 bg-hp-500/10 rounded-lg">
                {tarefas.filter(t => t.status !== 'Concluída').length} ativas
              </span>
            </div>

            <div className="space-y-2.5">
              {tarefas.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Sem tarefas registadas.</p>
              ) : (
                tarefas.map(t => {
                  const isDone = t.status === 'Concluída';
                  return (
                    <div
                      key={t.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        isDone
                          ? 'opacity-60 bg-slate-950 border-slate-900'
                          : 'bg-slate-900/90 border-slate-800 shadow-sm'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-hp-400">{t.numero}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            t.prioridade === 'Crítica' || t.prioridade === 'Urgente'
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {t.prioridade}
                          </span>
                        </div>
                        <p className={`text-xs font-bold leading-snug ${isDone ? 'line-through text-slate-500' : 'text-white'}`}>
                          {t.descricao}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Resp: {t.responsavel} {t.dataLimite && `• Limite: ${t.dataLimite}`}
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          const newStatus = isDone ? 'Pendente' : 'Concluída';
                          db.update<Tarefa>(STORAGE_KEYS.TAREFAS, t.id, {
                            status: newStatus,
                            dataConclusao: !isDone ? new Date().toISOString().split('T')[0] : undefined,
                            concluidoPorIniciais: !isDone ? 'HP' : undefined
                          });
                        }}
                        className={`p-3 rounded-2xl shrink-0 transition-all ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                        }`}
                      >
                        <Check className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* 3. BOTTOM PWA NAVIGATION BAR (Big Tactile Icons) */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-2xl px-1 py-2 flex items-center justify-around shadow-2xl ${
        theme === 'light' ? 'bg-white/95 border-slate-200 shadow-slate-200' : 'bg-slate-900/95 border-slate-800 shadow-black'
      }`}>
        {/* Tab 1: Folhas */}
        <button
          onClick={() => {
            setSelectedFolha(null);
            setActiveTab('folhas');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'folhas'
              ? 'text-hp-500 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Folhas</span>
        </button>

        {/* Tab 2: Scanner IA (Prominent Center Button) */}
        <button
          onClick={() => setActiveTab('ia-wizard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'ia-wizard'
              ? 'text-indigo-400 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Scanner IA</span>
        </button>

        {/* Tab 3: Nova Manual */}
        <button
          onClick={() => handleStartNewManual()}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'nova-manual'
              ? 'text-hp-500 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-5 h-5" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Nova Folha</span>
        </button>

        {/* Tab 4: Consultas */}
        <button
          onClick={() => setActiveTab('consultas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'consultas'
              ? 'text-hp-500 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Consultas</span>
        </button>

        {/* Tab 5: Peças */}
        <button
          onClick={() => setActiveTab('pecas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'pecas'
              ? 'text-hp-500 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Peças</span>
        </button>

        {/* Tab 6: Tarefas */}
        <button
          onClick={() => setActiveTab('tarefas')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-2xl transition-all ${
            activeTab === 'tarefas'
              ? 'text-hp-500 font-black scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[9px] sm:text-[10px] mt-0.5">Tarefas</span>
        </button>
      </nav>
    </div>
  );
};
