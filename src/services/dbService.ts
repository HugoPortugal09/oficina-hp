import type {
  Empresa,
  Cliente,
  Equipamento,
  FolhaServico,
  Proposta,
  PecaCatalogo,
  PedidoPeca,
  GuiaEnvio,
  Contrato,
  Tarefa,
  VisitaCliente,
  ConfiguracaoOficina,
  StatusFolhaServico,
  UserProfile,
  AutomacaoItem
} from '../types';
import { USERS } from '../types';
import { syncPushToCloud } from './pocketbaseSync';

const STORAGE_KEYS = {
  EMPRESAS: 'oficina_hp_empresas',
  CLIENTES: 'oficina_hp_clientes',
  EQUIPAMENTOS: 'oficina_hp_equipamentos',
  FOLHAS_SERVICO: 'oficina_hp_folhas_servico',
  PROPOSTAS: 'oficina_hp_propostas',
  PECAS_CATALOGO: 'oficina_hp_pecas_catalogo',
  PEDIDOS_PECAS: 'oficina_hp_pedidos_pecas',
  GUIAS_ENVIO: 'oficina_hp_guias_envio',
  CONTRATOS: 'oficina_hp_contratos',
  TAREFAS: 'oficina_hp_tarefas',
  VISITAS: 'oficina_hp_visitas',
  UTILIZADORES: 'oficina_hp_utilizadores',
  AUTOMACOES: 'oficina_hp_automacoes',
  CONFIGURACAO: 'oficina_hp_configuracao',
};

const DEFAULT_CONFIG: ConfiguracaoOficina = {
  nome: 'Oficina HP - Soluções Mecânicas & Frotas',
  nif: '509 888 777',
  morada: 'Zona Industrial Lote 14, Pavilhão B',
  codigoPostal: '4700-000',
  localidade: 'Braga, Portugal',
  telefone: '+351 253 100 200',
  email: 'geral@oficinahp.pt',
  website: 'www.oficinahp.pt',
  iban: 'PT50 0033 0000 1234 5678 9012 3',
  valorHoraPadrao: 38.5,
  ivaPadrao: 23,
  pocketbaseUrl: 'https://oficina-hp-pocketbase.l1mamt.easypanel.host',
  ollamaUrl: 'https://oficina-hp-ollama.l1mamt.easypanel.host',
  ollamaModel: 'minicpm-v',
  emailEmissor: 'oficinahpapp@gmail.com',
  emailAppPassword: 'ewhzzvysccrptkns',
  emailDestinatarioPlaneamento: 'hugo@grau-maquinaria.com',
  emailPlaneamentoAtivo: true
};

const INITIAL_EMPRESAS: Empresa[] = [
  {
    id: 'E001',
    nome: 'PREZERO PORTUGAL, S.A.',
    nif: '501234567',
    moradaSede: 'Rua da Lionesa, 446, Edifício G39 - 4465-671  Leça do Balio',
    telefone: '229 000 000',
    email: 'contacto@prezero.pt',
    estaleiros: [
      { id: 'est_braganca', nome: 'Ecocentro de Bragança', morada: 'Quinta do Lima, Vale D´Álvaro 5300-067 Bragança' },
      { id: 'est_maia', nome: 'Prezero Maia', morada: 'ZI Maia - Armazém 36 Setor II, R. de Rafael Baptista Rodrigues, 4475-150 Gemunde (Maia)' }
    ]
  },
  {
    id: 'E009',
    nome: 'MUNICIPIO PORTO',
    nif: '501306099',
    moradaSede: 'PC GEN HUMBERTO DELGADO , 4049-001 PORTO',
    telefone: '222 000 000',
    email: 'geral@cm-porto.pt',
    estaleiros: [
      { id: 'est_porto_oficinas', nome: 'OFICINAS', morada: 'R. Acácio Lino 69, Porto' },
      { id: 'est_porto_prado', nome: 'Cemitério Prado Repouso', morada: 'Largo do Padre Baltasar Guedes, 4300-059 Porto' },
      { id: 'est_porto_parque', nome: 'Parque da Cidade', morada: 'Parque da Cidade, 4100 Porto' }
    ]
  },
  {
    id: 'E005',
    nome: 'MUNICIPIO DE COIMBRA',
    nif: '506415082',
    moradaSede: 'Praça 8 de Maio, 3000-300 Coimbra',
    telefone: '239 857 500',
    email: 'geral@cm-coimbra.pt',
    estaleiros: [
      { id: 'est_coimbra_oficinas', nome: 'Oficinas Mecânicas - CM COIMBRA', morada: 'Rua da Liberdade, Carvalhais de Baixo, 3040-658 Assafarge' }
    ]
  }
];

const INITIAL_CLIENTES: Cliente[] = [
  {
    id: 'cli_001',
    nome: 'Gestão de Frotas Porto',
    telemovel: '912 345 678',
    email: 'frotas@cm-porto.pt',
    empresaId: 'E009',
    cargo: 'Diretor de Frotas'
  },
  {
    id: 'cli_002',
    nome: 'Responsável Técnico Prezero',
    telemovel: '934 567 890',
    email: 'tecnico@prezero.pt',
    empresaId: 'E001',
    cargo: 'Gestor de Manutenção'
  },
  {
    id: 'cli_003',
    nome: 'Oficina Municipal Coimbra',
    telemovel: '965 432 100',
    email: 'oficinas@cm-coimbra.pt',
    empresaId: 'E005',
    cargo: 'Chefe de Oficina'
  }
];

const INITIAL_EQUIPAMENTOS: Equipamento[] = [
  {
    id: 'eq_001',
    matricula: 'CH-28-LN',
    marca: 'Goupil',
    modelo: 'G4',
    nSerie: 'G4-2021-0081',
    ano: 2021,
    tipo: 'Elétrico Urbano',
    kmsAtuais: 32400,
    horasAtuais: 1420,
    empresaId: 'E009',
    notas: 'Viatura 100% elétrica em operação municipal.'
  },
  {
    id: 'eq_002',
    matricula: '93-TX-72',
    marca: 'Goupil',
    modelo: 'G4',
    nSerie: 'G4-2022-0194',
    ano: 2022,
    tipo: 'Elétrico Urbano',
    kmsAtuais: 18500,
    horasAtuais: 940,
    empresaId: 'E001',
    estaleiroId: 'est_maia',
    notas: 'Equipamento afeto à recolha seletiva.'
  },
  {
    id: 'eq_003',
    matricula: '16-UA-69',
    marca: 'Goupil',
    modelo: 'G4',
    nSerie: 'G4-2020-0044',
    ano: 2020,
    tipo: 'Elétrico Urbano',
    kmsAtuais: 44300,
    horasAtuais: 2100,
    empresaId: 'E005',
    estaleiroId: 'est_coimbra_oficinas',
    notas: 'Revisão geral do sistema de tração elétrica efetuada.'
  },
  {
    id: 'eq_004',
    matricula: '44-HP-77',
    marca: 'Toyota',
    modelo: 'Hilux 2.4 D-4D 4x4',
    nSerie: 'MROFX22G901004921',
    ano: 2023,
    tipo: 'Pick-Up Todo-o-Terreno',
    kmsAtuais: 32400,
    horasAtuais: 890,
    empresaId: 'emp_003',
    notas: 'Revisão periódica agendada.'
  }
];

const INITIAL_PECAS: PecaCatalogo[] = [
  {
    id: 'pec_001',
    referencia: 'FIL-OLE-01',
    designacao: 'Filtro de Óleo Heavy Duty HU947',
    marca: 'MANN-FILTER',
    modelo: 'Actros / FH',
    fornecedor: 'Auto Peças Portugal',
    preco: 24.9,
    precoVenda: 24.9,
    taxaIva: 23,
    stockAtual: 18,
    stockMinimo: 5,
    localizacaoArmazem: 'Prateleira A-02'
  },
  {
    id: 'pec_002',
    referencia: 'OLE-10W40-S',
    designacao: 'Óleo Motor 10W40 Sintético (Litro)',
    marca: 'Castrol',
    modelo: 'Vecton Long Drain',
    fornecedor: 'Lubrificantes do Norte',
    preco: 9.5,
    precoVenda: 9.5,
    taxaIva: 23,
    stockAtual: 240,
    stockMinimo: 50,
    localizacaoArmazem: 'Depósito B-01'
  },
  {
    id: 'pec_003',
    referencia: 'PAST-FR-MERC',
    designacao: 'Jogo Pastilhas Travão Frente HD',
    marca: 'Brembo',
    modelo: 'Mercedes Actros',
    fornecedor: 'Brembo Ibérica',
    preco: 128.0,
    precoVenda: 128.0,
    taxaIva: 23,
    stockAtual: 6,
    stockMinimo: 2,
    localizacaoArmazem: 'Prateleira C-04'
  },
  {
    id: 'pec_004',
    referencia: 'RET-HID-CAT',
    designacao: 'Kit Vedantes Pistão Hidráulico',
    marca: 'Caterpillar OEM',
    modelo: '320 GC / 330',
    fornecedor: 'Barloworld STET',
    preco: 260.0,
    precoVenda: 260.0,
    taxaIva: 23,
    stockAtual: 2,
    stockMinimo: 1,
    localizacaoArmazem: 'Prateleira D-01'
  },
  {
    id: 'pec_005',
    referencia: 'CORR-ALT-02',
    designacao: 'Correia de Acessórios Alternador Poly-V',
    marca: 'Continental',
    modelo: '6PK1750',
    fornecedor: 'Auto Peças Portugal',
    preco: 36.5,
    precoVenda: 36.5,
    taxaIva: 23,
    stockAtual: 12,
    stockMinimo: 3,
    localizacaoArmazem: 'Prateleira A-05'
  }
];

const INITIAL_FOLHAS_SERVICO: FolhaServico[] = [
  {
    id: 'fs_001',
    numero: 'FS26001',
    tipo: 'Oficina',
    data: new Date().toISOString().split('T')[0],
    status: 'OF - Com requisição - Aguardar agenda',
    empresaId: 'emp_002',
    clienteId: 'cli_002',
    equipamentoId: 'eq_001',
    matricula: 'AA-45-ZZ',
    marca: 'Mercedes-Benz',
    modelo: 'Actros 1845',
    nSerie: 'WDB9634031L892314',
    kmsAtuais: 185420,
    horasAtuais: 4210,
    localizacao: 'Oficina Principal HP - Box 2',
    localizacaoTipo: 'oficina',
    distanciaKms: 0,
    anomalias: 'Perda de pressão no circuito de travagem traseiro e revisão dos 185.000km.',
    servicos: [
      { id: 's1', descricao: 'Diagnóstico computadorizado sistema EBS / WABCO', horas: 1.5, valorHora: 38.5, concluido: true, tecnico: 'RF', dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' },
      { id: 's2', descricao: 'Substituição de pastilhas de travão e sangramento de circuito', horas: 3.0, valorHora: 38.5, concluido: false, tecnico: 'HP', iniciaisConclusao: 'HP' }
    ],
    servicosAdicionais: [],
    pecas: [
      { id: 'p1', pecaId: 'pec_003', referencia: 'PAST-FR-MERC', designacao: 'Jogo Pastilhas Travão Frente Brembo HD', qtd: 2, precoUnitario: 128.0, concluido: false, isLivre: false, iniciaisConclusao: 'HP' },
      { id: 'p2', pecaId: 'pec_002', referencia: 'OLE-10W40-S', designacao: 'Óleo Motor 10W40 Sintético (Litro)', qtd: 32, precoUnitario: 9.5, concluido: true, isLivre: false, dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' }
    ],
    pecasAdicionais: [],
    mensagens: [
      { id: 'm1', user: 'Hugo Portugal', text: 'Viatura deu entrada na oficina. Sensor de desgaste ativo no eixo traseiro.', time: '09:15' },
      { id: 'm2', user: 'Sérgio Santos (Cliente)', text: 'Aprovada substituição imediata. Precisamos do camião na estrada até sexta.', time: '10:30' }
    ],
    fotos: [],
    fotosCliente: [],
    notasCliente: 'Urgência na entrega para rota ibérica.',
    notasInternas: 'Verificar também folga no rolamento da roda direita.',
    previsaoRevisaoKms: 225000,
    previsaoRevisaoHoras: 5000,
    dataEntradaOficina: new Date().toISOString().split('T')[0],
    dataRequisicao: new Date().toISOString().split('T')[0],
    dataConclusao: '',
    equipamentoFuncionando: 'Sim',
    equipamentoOperacional: 'Sim',
    equipamentoFinalizado: 'Não',
    historicoEstados: [
      { status: 'OF - Com requisição - Aguardar agenda', dataEntrada: new Date(Date.now() - 3600000 * 24).toISOString() }
    ]
  },
  {
    id: 'fs_002',
    numero: 'FS26002',
    tipo: 'Assistência Técnica',
    data: new Date().toISOString().split('T')[0],
    status: 'AT - Com requisição - Aguardar peças',
    empresaId: 'emp_001',
    clienteId: 'cli_001',
    equipamentoId: 'eq_002',
    matricula: '12-XT-98',
    marca: 'Caterpillar',
    modelo: '320 GC',
    kmsAtuais: 0,
    horasAtuais: 3450,
    localizacao: 'Estaleiro Maia - Via Norte Km 4',
    localizacaoTipo: 'estaleiro',
    distanciaKms: 24,
    anomalias: 'Fuga de óleo no êmbolo principal do braço de escavação.',
    servicos: [
      { id: 's3', descricao: 'Desmontagem de cilindro hidráulico e avaliação de haste', horas: 4.0, valorHora: 42.0, concluido: true, tecnico: 'CM', dataConclusao: '27/08/2026', iniciaisConclusao: 'CM' }
    ],
    servicosAdicionais: [],
    pecas: [
      { id: 'p3', pecaId: 'pec_004', referencia: 'RET-HID-CAT', designacao: 'Kit Vedantes Pistão Hidráulico Principal', qtd: 1, precoUnitario: 260.0, concluido: false, isLivre: false, iniciaisConclusao: 'CM' }
    ],
    pecasAdicionais: [],
    mensagens: [
      { id: 'm3', user: 'Carlos Mendes', text: 'Deslocação ao estaleiro concluída. Peça encomendada ao fornecedor.', time: '14:00' }
    ],
    fotos: [],
    fotosCliente: [],
    notasCliente: 'Giratória parada em frente de obra.',
    previsaoRevisaoKms: 0,
    previsaoRevisaoHoras: 4000,
    dataEntradaOficina: '',
    dataRequisicao: new Date(Date.now() - 3600000 * 48).toISOString().split('T')[0],
    dataConclusao: '',
    equipamentoFuncionando: 'Não',
    equipamentoOperacional: 'Não',
    equipamentoFinalizado: 'Não',
    historicoEstados: [
      { status: 'AT - Pedido de Assistência', dataEntrada: new Date(Date.now() - 3600000 * 48).toISOString(), dataSaida: new Date(Date.now() - 3600000 * 24).toISOString(), duracaoTexto: '1d' },
      { status: 'AT - Com requisição - Aguardar peças', dataEntrada: new Date(Date.now() - 3600000 * 24).toISOString() }
    ]
  },
  {
    id: 'fs_003',
    numero: 'FS26003',
    tipo: 'Contrato',
    data: new Date().toISOString().split('T')[0],
    status: 'FEITO - Faturar',
    empresaId: 'emp_003',
    clienteId: 'cli_003',
    equipamentoId: 'eq_004',
    matricula: '44-HP-77',
    marca: 'Toyota',
    modelo: 'Hilux 2.4 D-4D 4x4',
    kmsAtuais: 32400,
    horasAtuais: 890,
    localizacao: 'Oficina Principal HP',
    localizacaoTipo: 'oficina',
    distanciaKms: 0,
    anomalias: 'Manutenção periódica dos 30.000 Kms + Alinhamento de direção.',
    servicos: [
      { id: 's4', descricao: 'Revisão geral: mudança de óleo e filtros', horas: 2.0, valorHora: 38.5, concluido: true, tecnico: 'RF', dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' },
      { id: 's5', descricao: 'Alinhamento de direção computadorizado 3D', horas: 1.0, valorHora: 38.5, concluido: true, tecnico: 'RF', dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' }
    ],
    servicosAdicionais: [],
    pecas: [
      { id: 'p4', pecaId: 'pec_001', referencia: 'FIL-OLE-01', designacao: 'Filtro de Óleo Heavy Duty MANN HU947', qtd: 1, precoUnitario: 24.9, concluido: true, isLivre: false, dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' },
      { id: 'p5', pecaId: 'pec_002', referencia: 'OLE-10W40-S', designacao: 'Óleo Motor 10W40 Sintético (Litro)', qtd: 7.5, precoUnitario: 9.5, concluido: true, isLivre: false, dataConclusao: '28/08/2026', iniciaisConclusao: 'RF' }
    ],
    pecasAdicionais: [],
    mensagens: [
      { id: 'm4', user: 'Rui Fernandes', text: 'Revisão concluída com sucesso. Teste de estrada ok.', time: '16:45' }
    ],
    fotos: [],
    fotosCliente: [],
    notasCliente: 'Entregar com viatura lavada.',
    previsaoRevisaoKms: 45000,
    previsaoRevisaoHoras: 1200,
    dataEntradaOficina: new Date(Date.now() - 3600000 * 12).toISOString().split('T')[0],
    dataRequisicao: new Date(Date.now() - 3600000 * 12).toISOString().split('T')[0],
    dataConclusao: new Date().toISOString().split('T')[0],
    equipamentoFuncionando: 'Sim',
    equipamentoOperacional: 'Sim',
    equipamentoFinalizado: 'Sim',
    historicoEstados: [
      { status: 'OF - Com requisição - Aguardar agenda', dataEntrada: new Date(Date.now() - 3600000 * 12).toISOString(), dataSaida: new Date(Date.now() - 3600000 * 2).toISOString(), duracaoTexto: '10h' },
      { status: 'FEITO - Faturar', dataEntrada: new Date(Date.now() - 3600000 * 2).toISOString() }
    ]
  }
];

const INITIAL_PROPOSTAS: Proposta[] = [
  {
    id: 'prop_001',
    numero: 'PR26001',
    data: new Date().toISOString().split('T')[0],
    dataValidade: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'Enviada',
    empresaId: 'emp_001',
    nomeEmpresa: 'Construções & Pavimentos Silva, Lda',
    clienteId: 'cli_001',
    nomeCliente: 'Eng. António Silva',
    equipamentoId: 'eq_003',
    matricula: '98-BB-12',
    marcaModelo: 'Iveco Daily 35S15',
    descricao: 'Orçamento para substituição completa do kit de embraiagem e revisão geral.',
    condicoesPagamento: 'Pronto pagamento com 2% de desconto ou 30 dias.',
    prazoEntrega: '3 dias úteis após adjudicação.',
    garantia: '12 meses para peças novas e mão de obra.',
    linhas: [
      { id: 'l1', tipo: 'servico', codigo: 'MO-MEC', descricao: 'Mão-de-Obra Mecânica Especializada (Substituição de embraiagem)', quantidade: 6, precoUnitario: 38.5, desconto: 5, taxaIva: 23, subtotal: 219.45 },
      { id: 'l2', tipo: 'peca', codigo: 'KIT-EMB-IVECO', descricao: 'Kit de Embraiagem Completo com Rolamento de Encosto Sachs', quantidade: 1, precoUnitario: 380.0, desconto: 10, taxaIva: 23, subtotal: 342.0 },
      { id: 'l3', tipo: 'peca', codigo: 'OLEO-CX-75W80', descricao: 'Valvulina Óleo de Caixa de Velocidades Sintético', quantidade: 3, precoUnitario: 14.0, desconto: 0, taxaIva: 23, subtotal: 42.0 }
    ],
    totalSemIva: 603.45,
    totalIva: 138.79,
    totalComIva: 742.24
  }
];

const INITIAL_CONTRATOS: Contrato[] = [
  {
    id: 'ct_001',
    numero: 'CT26001',
    empresaId: 'emp_002',
    nomeEmpresa: 'TransLogística Ibérica S.A.',
    dataInicio: '2026-01-01',
    dataFim: '2026-12-31',
    equipamentosIds: ['eq_001', 'eq_004'],
    valorMensal: 450.0,
    periodicidade: 'Mensal',
    visitasPorPeriodo: 2,
    status: 'Ativo',
    notas: 'Inclui revisões preventivas mensais e assistência 24/7 na zona norte.'
  }
];

function notifyChange(collection: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('oficina_hp_db_changed', { detail: { collection } }));
  }
}

const INITIAL_TAREFAS: Tarefa[] = [
  {
    id: 'tar_001',
    numero: 'TAR26001',
    descricao: 'Verificar nível do óleo e filtros do elevador de 5T',
    prioridade: 'Alta',
    responsavel: 'Hugo Portugal',
    dataLimite: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notasAdicionais: 'Utilizar óleo hidráulico ISO VG 46 do armazém B.',
    status: 'Pendente',
    criadoPorIniciais: 'HP',
    criadoPorNome: 'Hugo Portugal',
    dataCriacao: new Date().toISOString().split('T')[0]
  },
  {
    id: 'tar_002',
    numero: 'TAR26002',
    descricao: 'Calibrar máquina de alinhamento 3D e atualizar base de dados',
    prioridade: 'Normal',
    responsavel: 'Rui Fernandes',
    dataLimite: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notasAdicionais: 'Contactar suporte técnico caso haja erro de firmware.',
    status: 'Em Curso',
    criadoPorIniciais: 'HP',
    criadoPorNome: 'Hugo Portugal',
    dataCriacao: new Date().toISOString().split('T')[0]
  },
  {
    id: 'tar_003',
    numero: 'TAR26003',
    descricao: 'Organização do lote de pneus e baterias usadas para reciclagem',
    prioridade: 'Normal',
    responsavel: 'Carlos Mendes',
    dataLimite: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notasAdicionais: 'Empilhar de acordo com normas ambientais.',
    status: 'Concluída',
    criadoPorIniciais: 'RF',
    criadoPorNome: 'Rui Fernandes',
    dataCriacao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    concluidoPorIniciais: 'CM',
    concluidoPorNome: 'Carlos Mendes',
    dataConclusao: new Date().toISOString().split('T')[0]
  }
];

const INITIAL_AUTOMACOES: AutomacaoItem[] = [
  {
    id: 'auto_001',
    nome: 'Envio do Planeamento Semanal em PDF',
    descricao: 'Envia automaticamente o mapa semanal com folhas de serviço, visitas e lista de folhas em aberto para a direção técnica.',
    tipo: 'email_planeamento',
    frequencia: 'Todas as Segundas-feiras às 07:30',
    cronExpr: '30 7 * * 1',
    ativo: true,
    destinatarios: ['hugo@grau-maquinaria.com'],
    canaisEnvio: ['email'],
    anexoTipo: 'pdf',
    icone: 'Calendar',
    ultimoDisparo: 'Hoje às 00:30',
    proximoDisparo: 'Segunda-feira às 07:30'
  },
  {
    id: 'auto_001_b',
    nome: 'Quadro de Atividade Semanal & Produção em PDF',
    descricao: 'Envia o relatório semanal de produção consolidado (serviços e tarefas concluídas/abertas) aos domingos.',
    tipo: 'email_atividade_semanal',
    frequencia: 'Todos os Domingos às 09:00',
    cronExpr: '0 9 * * 0',
    ativo: true,
    destinatarios: ['hugo@grau-maquinaria.com'],
    canaisEnvio: ['email'],
    anexoTipo: 'pdf',
    icone: 'Activity',
    ultimoDisparo: 'Hoje às 01:00',
    proximoDisparo: 'Domingo às 09:00'
  },
  {
    id: 'auto_002',
    nome: 'Alerta de Ruptura / Stock Mínimo de Peças',
    descricao: 'Dispara um aviso por email quando qualquer artigo do catálogo atinge ou fica abaixo do stock mínimo de segurança.',
    tipo: 'alerta_stock',
    frequencia: 'Diário (às 08:00)',
    cronExpr: '0 8 * * *',
    ativo: true,
    destinatarios: ['hugo@grau-maquinaria.com'],
    canaisEnvio: ['email', 'notificacao'],
    anexoTipo: 'nenhum',
    icone: 'PackageAlert',
    ultimoDisparo: 'Ontem às 08:00',
    proximoDisparo: 'Amanhã às 08:00'
  },
  {
    id: 'auto_003',
    nome: 'Lembrete de Revisão Preventiva por Kms / Horas',
    descricao: 'Analisa as viaturas e equipamentos da frota e envia aviso quando faltarem menos de 1.000 Km ou 50 Horas para a próxima revisão.',
    tipo: 'alerta_revisao',
    frequencia: 'Semanal (Sextas-feiras às 17:00)',
    cronExpr: '0 17 * * 5',
    ativo: false,
    destinatarios: ['hugo@grau-maquinaria.com'],
    canaisEnvio: ['email'],
    anexoTipo: 'pdf',
    icone: 'Truck',
    proximoDisparo: 'Sexta-feira às 17:00'
  },
  {
    id: 'auto_004',
    nome: 'Notificação ao Cliente de Obra Concluída',
    descricao: 'Envia um email automático ao cliente da viatura quando a Folha de Serviço passa para o estado "FEITO - Faturar" ou "Finalizado".',
    tipo: 'notificacao_cliente',
    frequencia: 'Instantâneo (Ao alterar estado)',
    ativo: false,
    destinatarios: ['hugo@grau-maquinaria.com'],
    canaisEnvio: ['email']
  }
];

export function normalizeFolhaServico(f: any): FolhaServico {
  let status: StatusFolhaServico = f.status || 'Aguardar agenda';
  let requisicao: 'Sim' | 'Não' = f.requisicao || 'Não';
  let faturacao: any = f.faturacao || 'Pendente';

  const s = (f.status || '').trim();

  // Legacy mappings
  if (s.startsWith('AT - ') || s.startsWith('OF - ') || s.startsWith('CT - ') || s.startsWith('EF - ') || s.startsWith('FEITO - ') || s.includes(' – ')) {
    if (s.toLowerCase().includes('com requisição') || s.toLowerCase().includes('com requisicao')) {
      requisicao = 'Sim';
    } else if (s.toLowerCase().includes('sem requisição') || s.toLowerCase().includes('sem requisicao')) {
      requisicao = 'Não';
    }

    if (s.includes('A ser intervencionado') || s.includes('Em Intervenção') || s.includes('Em intervenção')) {
      status = 'A ser intervencionado';
    } else if (s.includes('Pedido de Assistência')) {
      status = 'Pedido de Assistência';
    } else if (s.includes('Fazer orçamento')) {
      status = 'Fazer orçamento';
    } else if (s.includes('Enviar orçamento') || s.includes('Enviar proposta')) {
      status = 'Enviar orçamento';
      if (s.includes('Enviar proposta')) faturacao = 'Enviar proposta';
    } else if (s.includes('Orçamento Enviado') || s.includes('Orçamento enviado') || s.includes('Aguardar resposta')) {
      status = 'Orçamento enviado – Aguardar resposta';
    } else if (s.includes('Aguardar agenda') || s.includes('Agendar') || s === 'A Agendar') {
      status = 'Aguardar agenda';
    } else if (s.includes('Agendado')) {
      status = 'Agendado';
    } else if (s.includes('Aguardar viatura')) {
      status = 'Aguardar viatura';
    } else if (s.includes('Aguardar peças')) {
      status = 'Aguardar peças';
    } else if (s.startsWith('FEITO') || s === 'Feito' || s === 'EF - Feito') {
      status = 'Concluído';
      if (s.includes('Faturado')) faturacao = 'Faturado';
      else if (s.includes('Faturar')) faturacao = 'Faturar';
      else if (s.includes('Aguardar Requisição')) faturacao = 'Aguardar Requisição';
      else if (s.includes('Submeter Garantia')) faturacao = 'Submeter Garantia';
      else if (s.includes('Aguardar Garantia')) faturacao = 'Garantia submetida';
      else if (s.includes('Resolvido') || s === 'Feito') faturacao = 'Pendente';
    }
  }

  return {
    ...f,
    status,
    requisicao,
    faturacao
  };
}

export const db = {
  get<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      if (!data) return [];
      const parsed = JSON.parse(data) as T[];
      if (key === STORAGE_KEYS.FOLHAS_SERVICO && Array.isArray(parsed)) {
        return parsed.map(item => normalizeFolhaServico(item)) as unknown as T[];
      }
      return parsed;
    } catch {
      return [];
    }
  },

  save<T>(key: string, items: T[]): void {
    localStorage.setItem(key, JSON.stringify(items));
    notifyChange(key);
    // Push automatically to PocketBase Cloud in background
    syncPushToCloud(key, items).catch(err => {
      console.warn('[Cloud Sync Push Background Error]', err);
    });
  },

  getSingle<T>(key: string, id: string): T | undefined {
    const list = this.get<any>(key);
    return list.find(item => item.id === id);
  },

  insert<T extends { id?: string } = any>(key: string, item: T): T {
    const list = this.get<T>(key);
    const updated = [item, ...list];
    this.save(key, updated);
    return item;
  },

  update<T = any>(key: string, id: string, item: Partial<T>): T | undefined {
    const list = this.get<any>(key);
    const index = list.findIndex((i: any) => i.id === id);
    if (index === -1) return undefined;
    const updatedItem = { ...list[index], ...item } as T;
    list[index] = updatedItem;
    this.save(key, list);
    return updatedItem;
  },

  delete(key: string, id: string): boolean {
    const list = this.get<any>(key);
    const filtered = list.filter((i: any) => i.id !== id);
    if (filtered.length !== list.length) {
      this.save(key, filtered);
      return true;
    }
    return false;
  },

  getConfig(): ConfiguracaoOficina {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONFIGURACAO);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.CONFIGURACAO, JSON.stringify(DEFAULT_CONFIG));
        return DEFAULT_CONFIG;
      }
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  saveConfig(config: Partial<ConfiguracaoOficina>): ConfiguracaoOficina {
    const current = this.getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(STORAGE_KEYS.CONFIGURACAO, JSON.stringify(updated));
    if (updated.pocketbaseUrl) {
      localStorage.setItem('oficina_hp_pb_url', updated.pocketbaseUrl);
    }
    notifyChange(STORAGE_KEYS.CONFIGURACAO);
    return updated;
  },

  initSeed(): void {
    if (!localStorage.getItem(STORAGE_KEYS.EMPRESAS)) {
      this.save(STORAGE_KEYS.EMPRESAS, INITIAL_EMPRESAS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLIENTES)) {
      this.save(STORAGE_KEYS.CLIENTES, INITIAL_CLIENTES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.EQUIPAMENTOS)) {
      this.save(STORAGE_KEYS.EQUIPAMENTOS, INITIAL_EQUIPAMENTOS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PECAS_CATALOGO)) {
      this.save(STORAGE_KEYS.PECAS_CATALOGO, INITIAL_PECAS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.FOLHAS_SERVICO)) {
      this.save(STORAGE_KEYS.FOLHAS_SERVICO, INITIAL_FOLHAS_SERVICO);
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROPOSTAS)) {
      this.save(STORAGE_KEYS.PROPOSTAS, INITIAL_PROPOSTAS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONTRATOS)) {
      this.save(STORAGE_KEYS.CONTRATOS, INITIAL_CONTRATOS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.TAREFAS)) {
      this.save(STORAGE_KEYS.TAREFAS, INITIAL_TAREFAS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.VISITAS)) {
      const sampleVisitas: VisitaCliente[] = [
        {
          id: 'vis_01',
          numero: 'VIS26001',
          data: new Date().toISOString().split('T')[0],
          hora: '09:30',
          empresaId: 'emp_01',
          nomeEmpresa: 'TransLopes & Filhos, Lda.',
          nomeContacto: 'António Lopes',
          telefone: '912 345 678',
          morada: 'Braga',
          tecnico: 'Hugo Portugal',
          motivo: 'Diagnóstico no Terreno',
          status: 'Agendada',
          notas: 'Verificação do sistema hidráulico no camião 45-ZZ-89.',
          dataCriacao: new Date().toISOString().split('T')[0]
        },
        {
          id: 'vis_02',
          numero: 'VIS26002',
          data: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          hora: '14:00',
          empresaId: 'emp_02',
          nomeEmpresa: 'Rodoviária do Norte, S.A.',
          nomeContacto: 'Eng. Manuel Ribeiro',
          telefone: '934 567 890',
          morada: 'Porto',
          tecnico: 'Rui Fernandes',
          motivo: 'Levantamento de Obra',
          status: 'Agendada',
          notas: 'Peritagem da frota de autocarros para contrato de manutenção.',
          dataCriacao: new Date().toISOString().split('T')[0]
        }
      ];
      this.save(STORAGE_KEYS.VISITAS, sampleVisitas);
    }
    if (!localStorage.getItem(STORAGE_KEYS.UTILIZADORES)) {
      this.save(STORAGE_KEYS.UTILIZADORES, USERS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.AUTOMACOES)) {
      this.save(STORAGE_KEYS.AUTOMACOES, INITIAL_AUTOMACOES);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONFIGURACAO)) {
      localStorage.setItem(STORAGE_KEYS.CONFIGURACAO, JSON.stringify(DEFAULT_CONFIG));
    }

    // Consolidation migration for duplicate / alias companies
    try {
      const COMPANY_CONSOLIDATION_MAP: Record<string, string> = {
        "C.M. ALBERGARIA": "MUNICIPIO DE ALBERGARIA A VELHA",
        "C.M. ALENQUER": "MUNICIPIO DE ALENQUER",
        "C.M. ALFANDEGA DA FÉ": "MUNICIPIO DE ALFANDEGA DA FE",
        "C.M. ALMADA": "MUNICIPIO DE ALMADA",
        "C.M. ARCOS DE VALDEVEZ": "MUNICIPIO DE ARCOS DE VALDEVEZ",
        "C.M. AROUCA": "MUNICIPIO DE AROUCA",
        "C.M. ARRAIOLOS": "MUNICIPIO DE ARRAIOLOS",
        "C.M. BAIÃO": "MUNICIPIO DE BAIÃO",
        "C.M. BARCELOS": "MUNICIPIO DE BARCELOS",
        "C.M. BEJA": "MUNICIPIO DE BEJA",
        "C.M. BRAGA": "MUNICIPIO DE BRAGA",
        "C.M. CALDAS DA RAINHA": "MUNICIPIO DE CALDAS DA RAINHA",
        "C.M. CAMINHA": "MUNICIPIO DE CAMINHA",
        "C.M. CARRAZEDA DE ANSIÃES": "MUNICIPIO DE CARRAZEDA ANSIAES",
        "C.M. CHAVES": "MUNICIPIO DE CHAVES",
        "C.M. CHEVES": "MUNICIPIO DE CHAVES",
        "C.M. CINFÃES": "MUNICIPIO DE CINFÃES",
        "C.M. Coimbra": "MUNICIPIO DE COIMBRA",
        "C.M. CONDEIXA": "MUNICIPIO DE CONDEIXA A NOVA",
        "C.M. CORVO": "MUNICIPIO DO CORVO",
        "C.M. ÉVORA": "MUNICIPIO DE EVORA",
        "C.M. FORNOS DE ALGODRES": "MUNICIPIO DE FORNOS DE ALGODRES",
        "C.M. GOUVEIA": "MUNICIPIO DE GOUVEIA",
        "C.M. Guimarães": "MUNICIPIO DE GUIMARÃES",
        "C.M. LAGOS": "MUNICIPIO DE LAGOS",
        "C.M. LOULÉ": "MUNICIPIO DE LOULE",
        "C.M. LOUSADA": "MUNICIPIO DE LOUSADA",
        "C.M. MACEDO DE CAVALEIROS": "MUNICIPIO DE MACEDO DE CAVALEIROS",
        "C.M. MAFRA": "MUNICIPIO DE MAFRA",
        "C.M. MARVÃO": "MUNICIPIO DE MARVAO",
        "C.M. MATOSINHOS": "MUNICIPIO MATOSINHOS",
        "C.M. MELGAÇO": "MUNICIPIO DE MELGAÇO",
        "C.M. MIRA": "MUNICIPIO DE MIRA",
        "C.M. MOGADOURO": "MUNICIPIO DE MOGADOURO",
        "C.M. MONTEMOR-O-NOVO": "MUNICIPIO DE MONTEMOR O NOVO",
        "C.M. NAZARÉ": "SERVICOS MUNICIPALIZADOS CAMARA MUNICIPAL CONCELHO NAZARE",
        "C.M. ÓBIDOS": "MUNICIPIO DE OBIDOS",
        "C.M. ODEMIRA": "MUNICIPIO DE ODEMIRA",
        "C.M. Oeiras": "MUNICIPIO DE OEIRAS",
        "C.M. OLIV. DO HOSPITAL": "MUNICIPIO DE OLIVEIRA DO BAIRRO",
        "C.M. OLIVEIRA DO HOSPITAL": "MUNICIPIO DE OLIVEIRA DO HOSPITAL",
        "C.M. OVAR": "MUNICIPIO OVAR",
        "C.M. PAÇOS DE FERREIRA": "MUNICIPIO DE PAÇOS DE FERREIRA",
        "C.M. PAREDES": "MUNICIPIO DE PAREDES",
        "C.M. PINHEL": "MUNICIPIO DE PINHEL",
        "C.M. POMBAL": "MUNICIPIO DE POMBAL",
        "C.M. PONTE DE LIMA": "MUNICIPIO DE PONTE DE LIMA",
        "C.M. PONTE DE SOR": "MUNICIPIO DE PONTE DE SOR",
        "C.M. PORTEL": "MUNICIPIO DE PORTEL",
        "C.M. PORTO": "MUNICIPIO PORTO",
        "C.M. PORTTO": "MUNICIPIO PORTO",
        "C.M. PÓVOA DE VARZIM": "MUNICIPIO DA POVOA DE VARZIM",
        "C.M. REGUENGOS DE MONSAR": "MUNICIPIO DE REGUENGOS MONSARAZ",
        "C.M. REGUENGOS DE MONSARAZ": "MUNICIPIO DE REGUENGOS MONSARAZ",
        "C.M. S. J. MADEIRA": "MUNICIPIO DE SAO JOAO DA MADEIRA",
        "C.M. S. PEDRO DO SUL": "MUNICIPIO DE S PEDRO SUL",
        "C.M. S.BRÁS DE ALPORTEL": "MUNICIPIO DE S BRAS DE ALPORTEL",
        "C.M. SANTARÉM": "MUNICIPIO DE SANTAREM",
        "C.M. Santiago de Cacém": "MUNICIPIO SANTIAGO CACEM",
        "C.M. SÃO BRÁS DE ALPORTEL": "MUNICIPIO DE S BRAS DE ALPORTEL",
        "C.M. SERPA": "MUNICIPIO DE SERPA",
        "C.M. SESIMBRA": "MUNICIPIO DE SESIMBRA",
        "C.M. SOURE": "MUNICIPIO DE SOURE",
        "C.M. Trancoso": "MUNICIPIO DE TRANCOSO",
        "C.M. VALENÇA": "MUNICIPIO DE VALENÇA",
        "C.M. VALPAÇOS": "MUNICIPIO DE VALPACOS",
        "C.M. VESEU": "MUNICIPIO DE VISEU",
        "C.M. VIANA DO ALENTEJO": "MUNICIPIO DE VIANA DO ALENTEJO",
        "C.M. VILA FLOR": "MUNICIPIO DE VILA FLOR",
        "C.M. VINHAIS": "MUNICIPIO DE VINHAIS",
        "C.M. VISEU": "MUNICIPIO DE VISEU",
        "PORTO AMBIENTE": "EMAP - EMPRESA MUNICIPAL DE AMBIENTE DO PORTO",
        "J. F. ALFRAGIDE": "FREGUESIA DE ALFRAGIDE",
        "J. F. MODIVAS": "Freguesia de Modivas",
        "J.F VALBOM E JOVIM": "UF GONDOMAR (SAO COSME), VALBOM E JOVIM",
        "J.F. ARCA E PONTE DE LIMA": "JF de Arca e Ponte de Lima",
        "J.F. ARROIOS - VECORENT": "FREGUESIA DE ARROIOS",
        "J.F. ARROIOS FOLHA - 01": "FREGUESIA DE ARROIOS",
        "J.F. CAMPOLIDE": "FREGUESIA DE CAMPOLIDE",
        "J.F. ENCOSTA DO SOL": "Freguesia de Encosta do Sol",
        "J.F. ESTRELA": "Freguesia de Estrela",
        "J.F. ODIVELAS": "Freguesia de Odivelas",
        "MAIA AMBIENTE": "MAIAMBIENTE, EM",
        "MARINA VILAMOURA": "MARINA DE VILAMOURA SA",
        "PREZERO - ACE": "PREZERO PORTUGAL - ECOAMBIENTE",
        "PRÉ-ZERO - ECOAMBIENTE": "PREZERO PORTUGAL - ECOAMBIENTE",
        "SANTIAGO DO CACÉM": "MUNICIPIO SANTIAGO CACEM",
        "VIMÁGUA": "VIMAGUA EMPRESA DE AGUA E SANEAMENTO DE GUIMARÃES E VIZ",
        "VECORENT – J.F. ARROIOS": "FREGUESIA DE ARROIOS"
      };

      const existingEmpresas = this.get<Empresa>(STORAGE_KEYS.EMPRESAS);
      if (existingEmpresas && existingEmpresas.length > 0) {
        const idRemap = new Map<string, string>();
        const empresaByName = new Map<string, Empresa>();
        existingEmpresas.forEach(e => {
          empresaByName.set(e.nome.trim().toUpperCase(), e);
        });

        const oldToTarget = new Map<string, string>();
        for (const [oldName, targetName] of Object.entries(COMPANY_CONSOLIDATION_MAP)) {
          if (oldName.trim().toUpperCase() !== targetName.trim().toUpperCase()) {
            oldToTarget.set(oldName.trim().toUpperCase(), targetName.trim());
          }
        }

        let hasChanges = false;
        existingEmpresas.forEach(emp => {
          const norm = emp.nome.trim().toUpperCase();
          if (oldToTarget.has(norm)) {
            const targetName = oldToTarget.get(norm)!;
            let targetEmp = empresaByName.get(targetName.toUpperCase());
            if (!targetEmp) {
              targetEmp = existingEmpresas.find(e => e.nome.trim().toUpperCase() === targetName.toUpperCase());
            }

            if (targetEmp && targetEmp.id !== emp.id) {
              idRemap.set(emp.id, targetEmp.id);
              hasChanges = true;
              if (Array.isArray(emp.estaleiros) && emp.estaleiros.length > 0) {
                if (!Array.isArray(targetEmp.estaleiros)) targetEmp.estaleiros = [];
                emp.estaleiros.forEach(est => {
                  if (!targetEmp!.estaleiros.some(te => te.nome === est.nome || te.id === est.id)) {
                    targetEmp!.estaleiros.push(est);
                  }
                });
              }
            } else {
              emp.nome = targetName;
              empresaByName.set(targetName.toUpperCase(), emp);
              hasChanges = true;
            }
          }
        });

        if (hasChanges || idRemap.size > 0) {
          // Reassign Clientes
          const existingClientes = this.get<Cliente>(STORAGE_KEYS.CLIENTES);
          if (existingClientes && existingClientes.length > 0) {
            let clChanged = false;
            const updatedClientes = existingClientes.map(c => {
              if (c.empresaId && idRemap.has(c.empresaId)) {
                clChanged = true;
                return { ...c, empresaId: idRemap.get(c.empresaId)! };
              }
              return c;
            });
            if (clChanged) this.save(STORAGE_KEYS.CLIENTES, updatedClientes);
          }

          // Reassign Equipamentos (Veículos)
          const existingEqs = this.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
          if (existingEqs && existingEqs.length > 0) {
            let eqChanged = false;
            const updatedEqs = existingEqs.map(eq => {
              if (eq.empresaId && idRemap.has(eq.empresaId)) {
                eqChanged = true;
                return { ...eq, empresaId: idRemap.get(eq.empresaId)! };
              }
              return eq;
            });
            if (eqChanged) this.save(STORAGE_KEYS.EQUIPAMENTOS, updatedEqs);
          }

          // Reassign Folhas de Serviço
          const existingFs = this.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
          if (existingFs && existingFs.length > 0) {
            let fsChanged = false;
            const updatedFs = existingFs.map(f => {
              if (f.empresaId && idRemap.has(f.empresaId)) {
                const targetId = idRemap.get(f.empresaId)!;
                fsChanged = true;
                return { ...f, empresaId: targetId };
              }
              return f;
            });
            if (fsChanged) this.save(STORAGE_KEYS.FOLHAS_SERVICO, updatedFs);
          }

          // Delete obsolete duplicate empresas
          const idsToDelete = new Set(idRemap.keys());
          const cleanedEmpresas = existingEmpresas.filter(e => !idsToDelete.has(e.id));
          this.save(STORAGE_KEYS.EMPRESAS, cleanedEmpresas);
        }
      }
    } catch (err) {
      console.warn('Error during company consolidation:', err);
    }

    // Explicit purge of blacklisted / unwanted dummy client entities
    try {
      const PURGE_NAMES = [
        "AGROTERRA SOLUÇÕES AGRÍCOLAS",
        "BASE LOGÍSTICA VILA DO CONDE",
        "CONSTRUÇÕES & PAVIMENTOS SILVA, LDA",
        "ESTALEIRO GAIA",
        "ESTALEIRO MAIA",
        "IBERBATERIAS - SOCIEDADE DE REPRESENTAÇÕES LDA",
        "MARGEMPRISMA, UNIPESSOAL LDA"
      ];

      const empresas = this.get<Empresa>(STORAGE_KEYS.EMPRESAS);
      if (empresas && empresas.length > 0) {
        const deletedIds = new Set<string>();
        const filteredEmpresas = empresas.filter(e => {
          const norm = (e.nome || '').trim().toUpperCase();
          if (PURGE_NAMES.includes(norm) || norm.includes('CONSTRUÇÕES & PAVIMENTOS') || norm.includes('AGROTERRA')) {
            deletedIds.add(e.id);
            return false;
          }
          if (Array.isArray(e.estaleiros)) {
            e.estaleiros = e.estaleiros.filter(est => {
              const estNorm = (est.nome || '').trim().toUpperCase();
              return !PURGE_NAMES.includes(estNorm);
            });
          }
          return true;
        });

        if (deletedIds.size > 0 || filteredEmpresas.length !== empresas.length) {
          this.save(STORAGE_KEYS.EMPRESAS, filteredEmpresas);

          // Purge associated dummy clientes
          const clientes = this.get<Cliente>(STORAGE_KEYS.CLIENTES);
          if (clientes && clientes.length > 0) {
            const filteredClientes = clientes.filter(c => !deletedIds.has(c.empresaId));
            if (filteredClientes.length !== clientes.length) {
              this.save(STORAGE_KEYS.CLIENTES, filteredClientes);
            }
          }

          // Purge associated dummy equipamentos
          const equipamentos = this.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS);
          if (equipamentos && equipamentos.length > 0) {
            const filteredEquipamentos = equipamentos.filter(eq => !deletedIds.has(eq.empresaId));
            if (filteredEquipamentos.length !== equipamentos.length) {
              this.save(STORAGE_KEYS.EQUIPAMENTOS, filteredEquipamentos);
            }
          }
        }
      }
    } catch (purgeErr) {
      console.warn('Error purging blacklisted companies:', purgeErr);
    }

    // Synchronize and heal any existing Folhas in localStorage so tipo matches status
    try {
      const existingFolhas = this.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO);
      if (existingFolhas && existingFolhas.length > 0) {
        let changed = false;
        const healed = existingFolhas.map(f => {
          let expectedTipo = f.tipo;
          if (f.status.startsWith('AT -') && f.tipo !== 'Assistência Técnica') {
            expectedTipo = 'Assistência Técnica';
            changed = true;
          } else if (f.status.startsWith('OF -') && f.tipo !== 'Oficina') {
            expectedTipo = 'Oficina';
            changed = true;
          } else if (f.status.startsWith('CT -') && f.tipo !== 'Contrato') {
            expectedTipo = 'Contrato';
            changed = true;
          }
          return expectedTipo !== f.tipo ? { ...f, tipo: expectedTipo } : f;
        });
        if (changed) {
          localStorage.setItem(STORAGE_KEYS.FOLHAS_SERVICO, JSON.stringify(healed));
        }
      }
    } catch (e) {
      console.warn('Error healing folhas:', e);
    }
  },

  exportDatabase(): string {
    const dump = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      empresas: this.get(STORAGE_KEYS.EMPRESAS),
      clientes: this.get(STORAGE_KEYS.CLIENTES),
      equipamentos: this.get(STORAGE_KEYS.EQUIPAMENTOS),
      folhasServico: this.get(STORAGE_KEYS.FOLHAS_SERVICO),
      propostas: this.get(STORAGE_KEYS.PROPOSTAS),
      pecasCatalogo: this.get(STORAGE_KEYS.PECAS_CATALOGO),
      pedidosPecas: this.get(STORAGE_KEYS.PEDIDOS_PECAS),
      guiasEnvio: this.get(STORAGE_KEYS.GUIAS_ENVIO),
      contratos: this.get(STORAGE_KEYS.CONTRATOS),
      tarefas: this.get(STORAGE_KEYS.TAREFAS),
      visitas: this.get(STORAGE_KEYS.VISITAS),
      utilizadores: this.get(STORAGE_KEYS.UTILIZADORES),
      configuracao: this.getConfig()
    };
    return JSON.stringify(dump, null, 2);
  },

  importDatabase(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.empresas) this.save(STORAGE_KEYS.EMPRESAS, data.empresas);
      if (data.clientes) this.save(STORAGE_KEYS.CLIENTES, data.clientes);
      if (data.equipamentos) this.save(STORAGE_KEYS.EQUIPAMENTOS, data.equipamentos);
      if (data.folhasServico) this.save(STORAGE_KEYS.FOLHAS_SERVICO, data.folhasServico);
      if (data.propostas) this.save(STORAGE_KEYS.PROPOSTAS, data.propostas);
      if (data.pecasCatalogo) this.save(STORAGE_KEYS.PECAS_CATALOGO, data.pecasCatalogo);
      if (data.pedidosPecas) this.save(STORAGE_KEYS.PEDIDOS_PECAS, data.pedidosPecas);
      if (data.guiasEnvio) this.save(STORAGE_KEYS.GUIAS_ENVIO, data.guiasEnvio);
      if (data.contratos) this.save(STORAGE_KEYS.CONTRATOS, data.contratos);
      if (data.tarefas) this.save(STORAGE_KEYS.TAREFAS, data.tarefas);
      if (data.visitas) this.save(STORAGE_KEYS.VISITAS, data.visitas);
      if (data.utilizadores) this.save(STORAGE_KEYS.UTILIZADORES, data.utilizadores);
      if (data.configuracao) this.saveConfig(data.configuracao);
      return true;
    } catch {
      return false;
    }
  },

  generateId(prefix: string = 'id'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${prefix}_${timestamp}_${random}`;
  },

  generateSequenceNumber(key: string, prefix: string): string {
    const items = this.get<any>(key);
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const count = items.length + 1;
    return `${prefix}${currentYear}${count.toString().padStart(3, '0')}`;
  }
};

export { STORAGE_KEYS };
