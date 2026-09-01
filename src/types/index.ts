export type NavigationTab = 
  | 'dashboard'
  | 'mapa'
  | 'oficina'
  | 'folhas-obra'
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
  // ASSISTÊNCIA TÉCNICA (AT)
  | 'AT - Pedido de Assistência'
  | 'AT - Enviar proposta'
  | 'AT - Agendar – Sem requisição'
  | 'AT - Agendar – Com requisição'
  | 'AT - Agendado'
  | 'AT - Aguardar requisição'
  | 'AT - Com requisição - Aguardar peças'
  // OFICINA (OF)
  | 'OF - Fazer orçamento'
  | 'OF - Orçamento Enviado – Aguardar resposta'
  | 'OF - Com requisição - Aguardar agenda'
  | 'OF - Com requisição - Aguardar viatura'
  | 'OF - Com requisição - Aguardar peças'
  | 'OF - Sem requisição - Aguardar peças'
  // CONTRATO (CT)
  | 'CT - Contrato'
  // FINALIZADO (FEITO)
  | 'FEITO - Faturar'
  | 'FEITO - Aguardar Requisição'
  | 'FEITO - Submeter Garantia'
  | 'FEITO - Aguardar Garantia'
  | 'FEITO - Faturado';

export type TipoServico = 
  | 'Assistência Técnica'
  | 'Oficina'
  | 'Garantia'
  | 'Entrega e Formação'
  | 'Contrato';

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
  dataFormacao?: string;
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
  guiaAT?: string;
  pessoaPresente?: string;
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

export interface UserProfile {
  id: string;
  nome: string;
  role: UserRole;
  avatar: string;
  email: string;
  password?: string;
  descricao: string;
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
    id: 'u_admin',
    nome: 'Hugo Portugal (Administrador)',
    role: 'administrador',
    avatar: 'HP',
    email: 'hugo.portugal@oficinahp.pt',
    password: 'admin',
    descricao: 'Acesso total a todas as áreas, peças, serviços, Automações e Configurações'
  },
  {
    id: 'u_gestor',
    nome: 'Gestor de Operações',
    role: 'gestor',
    avatar: 'GO',
    email: 'gestor@oficinahp.pt',
    password: '123',
    descricao: 'Acesso geral. Apenas leitura em Peças e Serviços (exceto Tarefas onde pode editar)'
  },
  {
    id: 'u_tecnico',
    nome: 'Técnico de Oficina',
    role: 'tecnico',
    avatar: 'TO',
    email: 'tecnico@oficinahp.pt',
    password: '123',
    descricao: 'Acesso operacional. Sem acesso a Orçamentos e sem preços visíveis nas peças'
  }
];

export function getPermissionsForRole(role: UserRole): RolePermissions {
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
        canEditPecas: false, // Não pode alterar nada no menu Peças
        canEditServicos: false, // Não pode alterar nada no menu Serviços...
        canEditTarefas: true, // ...com a exceção das tarefas
        canViewPrecos: false // Gestor não deve ter acesso a preços de peças
      };
    case 'tecnico':
      return {
        canAccessConfig: false,
        canAccessAutomacoes: false,
        canAccessPropostas: false, // Sem acesso aos orçamentos
        canEditPecas: true,
        canEditServicos: true,
        canEditTarefas: true,
        canViewPrecos: false // A lista de peças não deve ter preços
      };
  }
}

export function getInitials(name?: string): string {
  if (!name) return 'HP';
  const trimmed = name.trim();
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) return trimmed;
  const parts = trimmed.split(' ').filter(Boolean);
  if (parts.length === 0) return 'HP';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type TipoAutomacao = 
  | 'email_planeamento' 
  | 'email_atividade_semanal'
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
