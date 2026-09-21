export type NavigationTab = 
  | 'dashboard'
  | 'mapa'
  | 'oficina'
  | 'kanban'
  | 'tarefas'
  | 'propostas'
  | 'empresas'
  | 'clientes'
  | 'equipamentos'
  | 'pecas'
  | 'pedidos-pecas'
  | 'guias-envio'
  | 'contratos'
  | 'atividade-semanal'
  | 'planeamento'
  | 'automacoes'
  | 'tempos-resposta'
  | 'configuracoes';

export type StatusFolhaServico =
  | 'A ser intervencionado'
  | 'Pedido de Assistência'
  | 'Fazer orçamento'
  | 'Enviar orçamento'
  | 'Orçamento enviado – Aguardar resposta'
  | 'Aguardar agenda'
  | 'Agendado'
  | 'Aguardar viatura'
  | 'Aguardar peças'
  | 'Concluído'
  | (string & {});

export type StatusFaturacao =
  | 'Pendente'
  | 'Enviar proposta'
  | 'Aguardar Requisição'
  | 'Faturar'
  | 'Faturado'
  | 'Submeter Garantia'
  | 'Garantia submetida'
  | 'Garantia recebida'
  | 'N/A';

export type TipoServico = 
  | 'Assistência Técnica'
  | 'Oficina'
  | 'Garantia'
  | 'Entrega e Formação'
  | 'Contrato'
  | 'Validação e Preparação';

export interface Estaleiro {
  id: string;
  nome: string;
  morada: string;
  distanciaKmGRAUMP?: number;
  responsavel?: string;
  telefone?: string;
  notas?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  nif?: string;
  moradaSede: string;
  distanciaKmGRAUMP?: number;
  telefone?: string;
  email?: string;
  estaleiros: Estaleiro[];
  ativo?: boolean;
  criadoEm?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telemovel: string;
  email: string;
  empresaId: string;
  cargo?: string;
  notas?: string;
}

export interface Equipamento {
  id: string;
  matricula: string;
  marca: string;
  modelo: string;
  nSerie?: string;
  ano?: number;
  tipo: string; // Campo livre de escrita
  kmsAtuais?: number;
  horasAtuais?: number;
  empresaId: string;
  estaleiroId?: string;
  notas?: string;
  fotoUrl?: string;
  fotos?: string[];
  dataEntrega?: string;
  entregaPor?: string;
  dataFormacao?: string;
  formacaoPor?: string;
  ultimaRevisao?: string;
  proximaRevisaoKms?: number;
  proximaRevisaoHoras?: number;
}

export interface ServicoItem {
  id: string;
  descricao: string;
  horas: number;
  valorHora?: number;
  concluido: boolean;
  tecnico?: string;
  dataConclusao?: string;
  iniciaisConclusao?: string;
  dataCriacao?: string;
}

export interface PecaItem {
  id: string;
  pecaId?: string;
  referencia?: string;
  designacao: string;
  qtd: number;
  precoUnitario?: number;
  concluido: boolean;
  isLivre: boolean;
  matricula?: string;
  dataConclusao?: string;
  iniciaisConclusao?: string;
  dataCriacao?: string;
}

export interface MensagemTecnica {
  id: string;
  user: string;
  text: string;
  time: string;
}

export interface EstadoHistoricoItem {
  status: StatusFolhaServico;
  dataEntrada: string;
  dataSaida?: string;
  duracaoTexto?: string;
}

export interface FolhaServico {
  id: string;
  numero: string; // Ex: FS26001
  tipo: TipoServico;
  data: string;
  dataAbertura?: string;
  dataEntradaOficina?: string;
  dataRequisicao?: string;
  dataConclusao?: string;
  status: StatusFolhaServico;
  empresaId: string;
  clienteId?: string;
  equipamentoId: string;
  matricula: string;
  marca: string;
  modelo: string;
  nSerie?: string;
  kmsAtuais: number;
  horasAtuais: number;
  localizacao: string;
  localizacaoTipo: 'sede' | 'estaleiro' | 'oficina' | 'outro';
  distanciaKms: number;
  anomalias: string;
  servicos: ServicoItem[];
  servicosAdicionais: ServicoItem[];
  pecas: PecaItem[];
  pecasAdicionais: PecaItem[];
  mensagens: MensagemTecnica[];
  fotos: string[];
  fotosCliente: string[];
  notasCliente: string;
  notasInternas?: string;
  previsaoRevisaoKms: number;
  previsaoRevisaoHoras: number;
  dataEntrega?: string;
  entregaPor?: string;
  dataFormacao?: string;
  formacaoPor?: string;
  guiaAT?: string;
  pessoaPresente?: string;
  requisicao?: 'Sim' | 'Não';
  faturacao?: StatusFaturacao;
  validacaoFeita?: boolean;
  validacaoData?: string;
  validacaoPor?: string;
  preparacaoFeita?: boolean;
  preparacaoData?: string;
  preparacaoPor?: string;
  equipamentoFuncionando?: 'Sim' | 'Não';
  equipamentoOperacional?: 'Sim' | 'Não';
  equipamentoFinalizado?: 'Sim' | 'Não';
  contratoId?: string;
  assinatura?: string;
  historicoEstados?: EstadoHistoricoItem[];
  dataPlaneada?: string;
  horaPlaneada?: string;
  tecnicoPlaneado?: string;
  criadoPor?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface VisitaCliente {
  id: string;
  numero: string;
  data: string; // YYYY-MM-DD
  hora?: string; // HH:mm
  empresaId: string;
  nomeEmpresa: string;
  clienteId?: string;
  nomeContacto?: string;
  telefone?: string;
  morada?: string;
  tecnico: string;
  motivo: string;
  status: 'Agendada' | 'Em Curso' | 'Realizada' | 'Cancelada';
  notas?: string;
  folhaServicoId?: string;
  dataCriacao: string;
}

export interface PropostaLinha {
  id: string;
  tipo: 'peca' | 'servico';
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number; // percentagem 0 - 100
  taxaIva: number; // 23, 13, 6, 0
  subtotal: number;
}

export interface Proposta {
  id: string;
  numero: string; // Ex: PR26001
  data: string;
  dataValidade: string;
  status: 'Rascunho' | 'Enviada' | 'Aprovada' | 'Rejeitada' | 'Convertida';
  empresaId: string;
  nomeEmpresa: string;
  clienteId?: string;
  nomeCliente?: string;
  equipamentoId?: string;
  matricula?: string;
  marcaModelo?: string;
  descricao: string;
  condicoesPagamento: string;
  prazoEntrega: string;
  garantia: string;
  linhas: PropostaLinha[];
  totalSemIva: number;
  totalIva: number;
  totalComIva: number;
  notas?: string;
  folhaServicoId?: string;
  criadoEm?: string;
}

export interface PecaCatalogo {
  id: string;
  referencia: string;
  designacao: string;
  marca?: string;
  modelo?: string;
  fornecedor?: string;
  preco: number;
  precoVenda: number; // mantido para compatibilidade
  taxaIva?: number;
  stockAtual: number;
  stockMinimo: number;
  localizacaoArmazem?: string;
  fornecedorPrincipal?: string;
  categoria?: string;
  precoCusto?: number;
}

export interface PedidoPeca {
  id: string;
  numero: string;
  data: string;
  status: 'Pendente' | 'Encomendado' | 'Recebido' | 'Cancelado';
  prioridade: 'normal' | 'urgente' | 'critico';
  fornecedor: string;
  folhaServicoId?: string;
  matricula?: string;
  empresaNome?: string;
  pecas: {
    pecaId?: string;
    referencia: string;
    designacao: string;
    qtd: number;
  }[];
  notas?: string;
  criadoEm?: string;
}

export interface GuiaEnvio {
  id: string;
  numero: string;
  data: string;
  empresaOrigem: string;
  empresaDestino: string;
  moradaDestino: string;
  matriculaViaturaTransporte?: string;
  motorista?: string;
  materiais: {
    referencia?: string;
    descricao: string;
    quantidade: number;
    unidade?: string;
  }[];
  status: 'Emitida' | 'Em Trânsito' | 'Entregue' | 'Anulada';
  observacoes?: string;
  assinadoPor?: string;
}

export interface Contrato {
  id: string;
  numero: string; // Ex: CT26001
  empresaId: string;
  nomeEmpresa: string;
  dataInicio: string;
  dataFim: string;
  equipamentosIds: string[];
  matriculas?: string[];
  valorMensal: number;
  periodicidade: 'Mensal' | 'Trimestral' | 'Semestral' | 'Anual';
  visitasPorPeriodo: number;
  status: 'Ativo' | 'Expirado' | 'Cancelado';
  notas?: string;
}

export type PrioridadeTarefa = 'Baixa' | 'Normal' | 'Alta' | 'Urgente' | 'Crítica';
export type StatusTarefa = 'Pendente' | 'Em Curso' | 'Concluída' | 'Cancelada';

export interface Tarefa {
  id: string;
  numero: string; // Ex: TAR26001
  descricao: string;
  prioridade: PrioridadeTarefa;
  responsavel: string;
  dataLimite?: string;
  notasAdicionais?: string;
  status: StatusTarefa;
  criadoPorIniciais: string;
  criadoPorNome?: string;
  dataCriacao: string;
  concluidoPorIniciais?: string;
  concluidoPorNome?: string;
  dataConclusao?: string;
}

export interface ConfiguracaoOficina {
  nome: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  localidade: string;
  telefone: string;
  email: string;
  website: string;
  iban: string;
  logoUrl?: string;
  valorHoraPadrao: number;
  ivaPadrao: number;
  // Integrações
  pocketbaseUrl: string;
  pocketbaseToken?: string;
  ollamaUrl: string;
  ollamaModel: string;
  // Envio de Emails Automáticos & Planeamento Semanal
  emailEmissor?: string;
  emailAppPassword?: string;
  emailDestinatarioPlaneamento?: string;
  emailPlaneamentoAtivo?: boolean;
}

export interface VisionScanResult {
  sucesso: boolean;
  matricula?: string;
  odometroKm?: number;
  odometroHoras?: number;
  tipoEquipamento?: string;
  marcaModelo?: string;
  numeroSerie?: string;
  pecasSugeridas?: string[];
  anomaliasVisuais?: string[];
  textoExtraido?: string;
  confianca?: number;
  tempoProcessamentoMs?: number;
  origem: 'ollama' | 'ocr_local' | 'manual';
  imagemBase64?: string;
}

export type UserRole = 'administrador' | 'gestor' | 'tecnico';

export const ADMIN_EMAILS = [
  'hugo@grau-maquinaria.com',
  'hugoportugal@gmail.com',
  'oficinahpapp@gmail.com'
] as const;

export function isAdminEmail(email?: string): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean);
}

export interface UserProfile {
  id: string;
  nome: string;
  role: UserRole;
  avatar: string;
  email: string;
  password?: string;
  descricao?: string;
  telefone?: string;
  ativo?: boolean;
  criadoEm?: string;
}

export interface RolePermissions {
  canAccessConfig: boolean;
  canAccessAutomacoes: boolean;
  canAccessPropostas: boolean;
  canEditPecas: boolean;
  canEditServicos: boolean;
  canEditTarefas: boolean;
  canViewPrecos: boolean;
}

export const USERS: UserProfile[] = [
  {
    id: 'u_admin_hugo',
    nome: 'Hugo Portugal',
    role: 'administrador',
    avatar: 'HP',
    email: 'hugo@grau-maquinaria.com',
    password: 'admin',
    descricao: 'Administrador Principal • Acesso total e configurações',
    ativo: true
  },
  {
    id: 'u_admin_gmail',
    nome: 'Hugo Portugal (Gmail)',
    role: 'administrador',
    avatar: 'HP',
    email: 'hugoportugal@gmail.com',
    password: 'admin',
    descricao: 'Administrador • Acesso total e configurações',
    ativo: true
  },
  {
    id: 'u_admin_app',
    nome: 'Oficina HP App',
    role: 'administrador',
    avatar: 'OH',
    email: 'oficinahpapp@gmail.com',
    password: 'admin',
    descricao: 'Administrador de Sistema • Acesso total',
    ativo: true
  },
  {
    id: 'u_gestor',
    nome: 'Gestor de Operações',
    role: 'gestor',
    avatar: 'GO',
    email: 'gestor@grau-maquinaria.com',
    password: '123',
    descricao: 'Gestor Operacional • Planeamento, visitas, tarefas e orçamentos',
    ativo: true
  },
  {
    id: 'u_tecnico_oficina',
    nome: 'Técnico de Oficina',
    role: 'tecnico',
    avatar: 'TO',
    email: 'oficina@grau-maquinaria.com',
    password: '123',
    descricao: 'Técnico de Oficina • Intervenções mecânicas, peças e tempos',
    ativo: true
  },
  {
    id: 'u_tecnico_exterior',
    nome: 'Técnico de Exterior',
    role: 'tecnico',
    avatar: 'TE',
    email: 'exterior@grau-maquinaria.com',
    password: '123',
    descricao: 'Técnico de Terreno • Assistência técnica móvel e contratos',
    ativo: true
  }
];

export function getPermissionsForRole(role: UserRole, email?: string): RolePermissions {
  if (email && isAdminEmail(email)) {
    return {
      canAccessConfig: true,
      canAccessAutomacoes: true,
      canAccessPropostas: true,
      canEditPecas: true,
      canEditServicos: true,
      canEditTarefas: true,
      canViewPrecos: true
    };
  }

  switch (role) {
    case 'administrador':
      return {
        canAccessConfig: true,
        canAccessAutomacoes: true,
        canAccessPropostas: true,
        canEditPecas: true,
        canEditServicos: true,
        canEditTarefas: true,
        canViewPrecos: true
      };
    case 'gestor':
      return {
        canAccessConfig: false,
        canAccessAutomacoes: false,
        canAccessPropostas: true,
        canEditPecas: false,
        canEditServicos: false,
        canEditTarefas: true,
        canViewPrecos: false
      };
    case 'tecnico':
      return {
        canAccessConfig: false,
        canAccessAutomacoes: false,
        canAccessPropostas: false,
        canEditPecas: true,
        canEditServicos: true,
        canEditTarefas: true,
        canViewPrecos: false
      };
  }
}

export function getInitials(name?: string): string {
  if (!name) return 'HP';
  const trimmed = name.trim();
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed === 'IA' ? 'HP' : trimmed;
  }
  // Strip parenthesized suffixes such as "(Administrador)"
  const cleanName = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
  const parts = cleanName.split(' ').filter(Boolean);
  if (parts.length === 0) return 'HP';
  if (parts.length === 1) {
    const single = parts[0].substring(0, 2).toUpperCase();
    return single === 'IA' ? 'HP' : single;
  }
  const result = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return result === 'IA' ? 'HP' : result;
}

export type TipoAutomacao = 
  | 'email_planeamento' 
  | 'email_atividade_semanal'
  | 'email_tempos_resposta'
  | 'alerta_stock' 
  | 'alerta_revisao' 
  | 'notificacao_cliente'
  | 'whatsapp_resumo';

export interface AutomacaoItem {
  id: string;
  nome: string;
  descricao: string;
  tipo: TipoAutomacao;
  frequencia: string;
  cronExpr?: string;
  ativo: boolean;
  destinatarios: string[]; // Lista de emails que recebem esta automação
  canaisEnvio: ('email' | 'whatsapp' | 'notificacao')[];
  ultimoDisparo?: string;
  proximoDisparo?: string;
  anexoTipo?: 'pdf' | 'excel' | 'nenhum';
  icone?: string;
}
