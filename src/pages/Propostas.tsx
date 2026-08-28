import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  FileSpreadsheet,
  FileDown,
  Trash2,
  Check,
  Building2,
  Car,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent,
  Calculator,
  Wrench,
  Package,
  Navigation,
  ChevronDown,
  X,
  LayoutGrid,
  Table
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import { generatePropostaPDF } from '../services/pdfService';
import type {
  Proposta,
  PropostaLinha,
  Empresa,
  Equipamento,
  Cliente,
  PecaCatalogo,
  FolhaServico,
  UserProfile
} from '../types';
import { getPermissionsForRole } from '../types';

interface PropostasProps {
  propostas: Proposta[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  clientes: Cliente[];
  catalogoPecas: PecaCatalogo[];
  onNavigateToFolha?: (folha: FolhaServico) => void;
  currentUser?: UserProfile;
}

const GRAUMP_BASE = 'Parque Empresarial Vista Alegre, Pavilhão 5, 3850-184 Albergaria-a-Velha';

function estimateRoundTripKms(address?: string): number {
  if (!address) return 60; // 30km ida + 30km volta padrão
  const lower = address.toLowerCase();
  if (lower.includes('albergaria')) return 10;
  if (lower.includes('aveiro') || lower.includes('estarreja') || lower.includes('íhavo') || lower.includes('ilhavo')) return 40; // 20km x 2
  if (lower.includes('porto') || lower.includes('maia') || lower.includes('gaia') || lower.includes('matosinhos')) return 120; // 60km x 2
  if (lower.includes('coimbra') || lower.includes('mealhada') || lower.includes('agueda') || lower.includes('águeda')) return 70; // 35km x 2
  if (lower.includes('lisboa') || lower.includes('sintra') || lower.includes('cascais') || lower.includes('loures')) return 500; // 250km x 2
  return 60; // padrão
}

// Searchable Catalog Part Select Combobox for Proposal Lines
const SearchableCatalogSelectForLine: React.FC<{
  catalogo: PecaCatalogo[];
  onSelect: (peca: PecaCatalogo) => void;
}> = ({ catalogo, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

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
    p.designacao.toLowerCase().includes(query.toLowerCase()) ||
    (p.marca && p.marca.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 bg-hp-950/60 border border-hp-500/40 text-hp-300 hover:text-white rounded-lg text-xs flex items-center gap-1 font-semibold"
      >
        <Package className="w-3.5 h-3.5" />
        <span>+ Peça do Catálogo</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden w-64 max-h-56 flex flex-col backdrop-blur-xl">
          <div className="p-1.5 border-b border-slate-800">
            <input
              type="text"
              autoFocus
              placeholder="Pesquisar catálogo..."
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
                  <span className="font-mono text-[11px] text-emerald-400 shrink-0">{p.precoVenda.toFixed(2)} €</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const Propostas: React.FC<PropostasProps> = ({
  propostas,
  empresas,
  equipamentos,
  clientes,
  catalogoPecas,
  onNavigateToFolha,
  currentUser
}) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');

  if (!permissions.canAccessPropostas) {
    return (
      <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl shadow-lg">
          🔒
        </div>
        <h3 className="text-xl font-bold text-white">Acesso Restrito a Orçamentos</h3>
        <p className="text-slate-300 text-xs leading-relaxed">
          O perfil de <strong>Técnico de Oficina</strong> não tem permissão de acesso ao módulo de orçamentos e propostas comerciais.
        </p>
      </div>
    );
  }

  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_propostas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_propostas', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<Partial<Proposta>>({});

  // Searchable Company Combobox state
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [isEmpresaDropdownOpen, setIsEmpresaDropdownOpen] = useState(false);
  const empresaContainerRef = useRef<HTMLDivElement>(null);

  // Searchable Plate Combobox state
  const [plateQuery, setPlateQuery] = useState('');
  const [isPlateDropdownOpen, setIsPlateDropdownOpen] = useState(false);
  const plateContainerRef = useRef<HTMLDivElement>(null);

  // Matching companies
  const matchingEmpresas = empresas.filter(emp =>
    emp.nome.toLowerCase().includes(empresaQuery.toLowerCase()) ||
    (emp.nif && emp.nif.toLowerCase().includes(empresaQuery.toLowerCase()))
  );

  // Available equipment: if an empresa is selected, show company's equipment first or all registered equipment
  const matchingEquipamentos = equipamentos.filter(eq => {
    const matchesQuery = eq.matricula.toLowerCase().includes(plateQuery.toLowerCase()) ||
      eq.marca.toLowerCase().includes(plateQuery.toLowerCase()) ||
      eq.modelo.toLowerCase().includes(plateQuery.toLowerCase());

    if (editingProp.empresaId) {
      return eq.empresaId === editingProp.empresaId && matchesQuery;
    }
    return matchesQuery;
  });

  // Handle clicking outside dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (empresaContainerRef.current && !empresaContainerRef.current.contains(e.target as Node)) {
        setIsEmpresaDropdownOpen(false);
      }
      if (plateContainerRef.current && !plateContainerRef.current.contains(e.target as Node)) {
        setIsPlateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateTotals = (linhas: PropostaLinha[]) => {
    let semIva = 0;
    let iva = 0;

    linhas.forEach(l => {
      const lineNet = l.quantidade * l.precoUnitario * (1 - l.desconto / 100);
      const lineIva = lineNet * (l.taxaIva / 100);
      semIva += lineNet;
      iva += lineIva;
    });

    return {
      totalSemIva: semIva,
      totalIva: iva,
      totalComIva: semIva + iva
    };
  };

  const handleCreateNew = () => {
    const config = db.getConfig();
    const newNum = db.generateSequenceNumber(STORAGE_KEYS.PROPOSTAS, 'PR');
    const today = new Date();
    const expiry = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const initialLinhas: PropostaLinha[] = [
      {
        id: db.generateId('plin'),
        tipo: 'servico',
        codigo: 'MO-MEC',
        descricao: 'Mão-de-Obra Mecânica Especializada',
        quantidade: 2,
        precoUnitario: config.valorHoraPadrao,
        desconto: 0,
        taxaIva: config.ivaPadrao,
        subtotal: 2 * config.valorHoraPadrao
      }
    ];

    const totals = calculateTotals(initialLinhas);

    setEditingProp({
      id: db.generateId('prop'),
      numero: newNum,
      data: today.toISOString().split('T')[0],
      dataValidade: expiry.toISOString().split('T')[0],
      status: 'Rascunho',
      empresaId: '',
      nomeEmpresa: '',
      clienteId: '',
      nomeCliente: '',
      equipamentoId: '',
      matricula: '',
      marcaModelo: '',
      descricao: 'Orçamento para manutenção e fornecimento de peças.',
      condicoesPagamento: 'Pronto pagamento ou 30 dias após emissão de fatura.',
      prazoEntrega: '2 a 4 dias úteis após aprovação.',
      garantia: '12 meses para peças novas e serviços efetuados.',
      linhas: initialLinhas,
      ...totals
    });

    setEmpresaQuery('');
    setPlateQuery('');
    setIsModalOpen(true);
  };

  const handleSelectEmpresaItem = (emp: Empresa) => {
    const cli = clientes.find(c => c.empresaId === emp.id);
    const eq = equipamentos.find(e => e.empresaId === emp.id);

    setEditingProp(prev => ({
      ...prev,
      empresaId: emp.id,
      nomeEmpresa: emp.nome,
      clienteId: cli?.id || prev.clienteId,
      nomeCliente: cli?.nome || prev.nomeCliente,
      equipamentoId: eq ? eq.id : prev.equipamentoId,
      matricula: eq ? eq.matricula : prev.matricula,
      marcaModelo: eq ? `${eq.marca} ${eq.modelo}` : prev.marcaModelo
    }));

    setEmpresaQuery(emp.nome);
    if (eq) setPlateQuery(eq.matricula);
    setIsEmpresaDropdownOpen(false);
  };

  const handleSelectPlateItem = (eq: Equipamento) => {
    const associatedEmp = empresas.find(e => e.id === eq.empresaId);
    setEditingProp(prev => ({
      ...prev,
      equipamentoId: eq.id,
      matricula: eq.matricula,
      marcaModelo: `${eq.marca} ${eq.modelo}`.trim(),
      empresaId: associatedEmp ? associatedEmp.id : prev.empresaId,
      nomeEmpresa: associatedEmp ? associatedEmp.nome : prev.nomeEmpresa
    }));
    setPlateQuery(eq.matricula);
    if (associatedEmp) setEmpresaQuery(associatedEmp.nome);
    setIsPlateDropdownOpen(false);
  };

  const handleClearPlate = () => {
    setEditingProp(prev => ({
      ...prev,
      equipamentoId: '',
      matricula: '',
      marcaModelo: ''
    }));
    setPlateQuery('');
    setIsPlateDropdownOpen(false);
  };

  const handleAddLine = (tipo: 'servico' | 'peca') => {
    const config = db.getConfig();
    const newLine: PropostaLinha = {
      id: db.generateId('plin'),
      tipo: tipo,
      codigo: tipo === 'servico' ? 'MO-ESP' : 'PEC-CAT',
      descricao: tipo === 'servico' ? 'Serviço Mecânico Adicional' : 'Peça / Material',
      quantidade: 1,
      precoUnitario: tipo === 'servico' ? config.valorHoraPadrao : 50.0,
      desconto: 0,
      taxaIva: config.ivaPadrao || 23,
      subtotal: tipo === 'servico' ? config.valorHoraPadrao : 50.0
    };

    const updatedLines = [...(editingProp.linhas || []), newLine];
    const totals = calculateTotals(updatedLines);

    setEditingProp(prev => ({
      ...prev,
      linhas: updatedLines,
      ...totals
    }));
  };

  // Add Deslocação Line (0.75 € / Km, Ida e Volta x 2 from GRAUMP)
  const handleAddDeslocacao = () => {
    const selectedEmp = empresas.find(e => e.id === editingProp.empresaId);
    const roundTripKms = estimateRoundTripKms(selectedEmp?.moradaSede);
    const precoPorKm = 0.75;
    const subtotal = roundTripKms * precoPorKm;

    const newLine: PropostaLinha = {
      id: db.generateId('plin'),
      tipo: 'servico',
      codigo: 'DESLOC-KM',
      descricao: `Deslocação Técnica (${roundTripKms} Km Ida e Volta) - GRAUMP / ${selectedEmp?.nome || 'Sede do Cliente'}`,
      quantidade: roundTripKms,
      precoUnitario: precoPorKm,
      desconto: 0,
      taxaIva: 23,
      subtotal: subtotal
    };

    const updatedLines = [...(editingProp.linhas || []), newLine];
    const totals = calculateTotals(updatedLines);

    setEditingProp(prev => ({
      ...prev,
      linhas: updatedLines,
      ...totals
    }));
  };

  const handleSelectCatalogPartForLine = (part: PecaCatalogo, lineId: string) => {
    const updatedLines = editingProp.linhas?.map(l => {
      if (l.id === lineId) {
        const sub = l.quantidade * part.precoVenda * (1 - l.desconto / 100);
        return {
          ...l,
          codigo: part.referencia,
          descricao: part.designacao,
          precoUnitario: part.precoVenda,
          taxaIva: part.taxaIva || 23,
          subtotal: sub
        };
      }
      return l;
    }) || [];

    const totals = calculateTotals(updatedLines);
    setEditingProp(prev => ({ ...prev, linhas: updatedLines, ...totals }));
  };

  const handleUpdateLine = (lineId: string, field: keyof PropostaLinha, value: any) => {
    const updatedLines = editingProp.linhas?.map(l => {
      if (l.id === lineId) {
        const updated = { ...l, [field]: value };
        const net = updated.quantidade * updated.precoUnitario * (1 - updated.desconto / 100);
        updated.subtotal = net;
        return updated;
      }
      return l;
    }) || [];

    const totals = calculateTotals(updatedLines);
    setEditingProp(prev => ({ ...prev, linhas: updatedLines, ...totals }));
  };

  const handleRemoveLine = (lineId: string) => {
    const updatedLines = editingProp.linhas?.filter(l => l.id !== lineId) || [];
    const totals = calculateTotals(updatedLines);
    setEditingProp(prev => ({ ...prev, linhas: updatedLines, ...totals }));
  };

  const handleSave = () => {
    if (!editingProp.empresaId || !editingProp.nomeEmpresa) {
      alert('Por favor selecione uma Empresa Cliente criada no sistema.');
      return;
    }

    const currentList = db.get<Proposta>(STORAGE_KEYS.PROPOSTAS);
    const existingIndex = currentList.findIndex(p => p.id === editingProp.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.PROPOSTAS, editingProp.id!, editingProp);
    } else {
      db.insert(STORAGE_KEYS.PROPOSTAS, editingProp as Proposta);
    }

    setIsModalOpen(false);
  };

  const handleConvertToFolha = (prop: Proposta) => {
    if (confirm(`Deseja converter o Orçamento ${prop.numero} numa Folha de Serviço da Oficina?`)) {
      const config = db.getConfig();
      const newFsNum = db.generateSequenceNumber(STORAGE_KEYS.FOLHAS_SERVICO, 'FS');

      // Map proposal lines to services and parts
      const servicos = prop.linhas
        .filter(l => l.tipo === 'servico')
        .map(l => ({
          id: db.generateId('srv'),
          descricao: l.descricao,
          horas: l.quantidade,
          valorHora: l.precoUnitario,
          concluido: false,
          tecnico: 'Hugo Portugal'
        }));

      const pecas = prop.linhas
        .filter(l => l.tipo === 'peca')
        .map(l => ({
          id: db.generateId('pec'),
          referencia: l.codigo,
          designacao: l.descricao,
          qtd: l.quantidade,
          precoUnitario: l.precoUnitario,
          concluido: false,
          isLivre: true
        }));

      const newFolha: FolhaServico = {
        id: db.generateId('fs'),
        numero: newFsNum,
        tipo: 'Oficina',
        data: new Date().toISOString().split('T')[0],
        status: 'OF - Com requisição - Aguardar agenda',
        empresaId: prop.empresaId,
        clienteId: prop.clienteId,
        equipamentoId: prop.equipamentoId || '',
        matricula: prop.matricula || '',
        marca: prop.marcaModelo?.split(' ')[0] || '',
        modelo: prop.marcaModelo?.split(' ').slice(1).join(' ') || '',
        kmsAtuais: 0,
        horasAtuais: 0,
        localizacao: 'Oficina Principal HP',
        localizacaoTipo: 'oficina',
        distanciaKms: 0,
        anomalias: `Serviço adjudicado com base na Proposta ${prop.numero}: ${prop.descricao}`,
        servicos,
        servicosAdicionais: [],
        pecas,
        pecasAdicionais: [],
        mensagens: [
          {
            id: db.generateId('msg'),
            user: 'Sistema',
            text: `Folha gerada a partir da Proposta ${prop.numero}.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ],
        fotos: [],
        fotosCliente: [],
        notasCliente: prop.condicoesPagamento,
        previsaoRevisaoKms: 0,
        previsaoRevisaoHoras: 0
      };

      db.insert(STORAGE_KEYS.FOLHAS_SERVICO, newFolha);
      db.update(STORAGE_KEYS.PROPOSTAS, prop.id, {
        status: 'Convertida',
        folhaServicoId: newFolha.id
      });

      if (onNavigateToFolha) {
        onNavigateToFolha(newFolha);
      } else {
        alert(`Folha de Serviço ${newFsNum} criada com sucesso!`);
      }
    }
  };

  const filteredPropostas = propostas.filter(p =>
    p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.nomeEmpresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.matricula && p.matricula.toLowerCase().includes(searchTerm.toLowerCase())) ||
    p.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-3.5">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar propostas por número, empresa, matrícula..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-700/80 p-0.5 rounded-xl">
            <button
              onClick={() => handleSetViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'grid' ? 'bg-hp-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista em Cartões"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cartões</span>
            </button>
            <button
              onClick={() => handleSetViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
                viewMode === 'table' ? 'bg-hp-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Vista em Tabela"
            >
              <Table className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tabela</span>
            </button>
          </div>

          {permissions.canEditServicos && (
            <button
              onClick={handleCreateNew}
              className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-4 h-4" />
              Novo Orçamento
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPropostas.map(prop => {
            const empresa = empresas.find(e => e.id === prop.empresaId);
            return (
              <GlassCard
                key={prop.id}
                onClick={() => {
                  setEditingProp(prop);
                  setEmpresaQuery(prop.nomeEmpresa || '');
                  setPlateQuery(prop.matricula || '');
                  setIsModalOpen(true);
                }}
                className="flex flex-col justify-between space-y-4 hover:border-hp-500/50 cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold text-hp-400">{prop.numero}</span>
                      <h4 className="text-base font-bold text-white mt-0.5 group-hover:text-hp-300 transition-colors">{prop.nomeEmpresa}</h4>
                    </div>
                    <Badge variant={prop.status === 'Aprovada' ? 'success' : prop.status === 'Convertida' ? 'info' : prop.status === 'Rejeitada' ? 'danger' : 'warning'}>
                      {prop.status}
                    </Badge>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Car className="w-3.5 h-3.5 text-hp-400" />
                      <span className="font-mono font-semibold">{prop.matricula || 'Sem Matrícula'}</span>
                      {prop.marcaModelo && <span className="text-slate-400">({prop.marcaModelo})</span>}
                    </div>
                    <p className="text-slate-300 line-clamp-2">{prop.descricao}</p>
                  </div>

                  {/* Financial Summary */}
                  <div className="mt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 font-mono text-xs space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Total S/ IVA:</span>
                      <span>{prop.totalSemIva.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>IVA:</span>
                      <span>{prop.totalIva.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold text-sm pt-1 border-t border-slate-800">
                      <span>Total C/ IVA:</span>
                      <span>{prop.totalComIva.toFixed(2)} €</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => generatePropostaPDF(prop, empresa)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF Oficial
                  </button>

                  <div className="flex items-center gap-1.5">
                    {prop.status !== 'Convertida' && (
                      <button
                        onClick={() => handleConvertToFolha(prop)}
                        title="Converter em Folha de Serviço"
                        className="px-3 py-1.5 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1 border border-hp-500/30 transition-all"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        Gerar FS
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setEditingProp(prop);
                        setEmpresaQuery(prop.nomeEmpresa || '');
                        setPlateQuery(prop.matricula || '');
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 backdrop-blur-md">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Número</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Empresa</th>
                <th className="py-3 px-4">Matrícula / Viatura</th>
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4 text-right">Total C/ IVA</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredPropostas.map(prop => {
                const empresa = empresas.find(e => e.id === prop.empresaId);
                return (
                  <tr
                    key={prop.id}
                    onClick={() => {
                      setEditingProp(prop);
                      setEmpresaQuery(prop.nomeEmpresa || '');
                      setPlateQuery(prop.matricula || '');
                      setIsModalOpen(true);
                    }}
                    className="hover:bg-hp-600/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-hp-400">{prop.numero}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{prop.data}</td>
                    <td className="py-3 px-4 font-bold text-white">{prop.nomeEmpresa}</td>
                    <td className="py-3 px-4">
                      {prop.matricula ? (
                        <span className="font-mono font-bold text-slate-200 px-2 py-0.5 bg-slate-900 rounded border border-slate-700">
                          {prop.matricula}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">S/ Matrícula</span>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">{prop.descricao}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      {prop.totalComIva.toFixed(2)} €
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={prop.status === 'Aprovada' ? 'success' : prop.status === 'Convertida' ? 'info' : prop.status === 'Rejeitada' ? 'danger' : 'warning'}>
                        {prop.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => generatePropostaPDF(prop, empresa)}
                          title="Descarregar PDF Oficial"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        {prop.status !== 'Convertida' && (
                          <button
                            onClick={() => handleConvertToFolha(prop)}
                            title="Gerar Folha de Serviço"
                            className="p-1.5 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Proposta Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Orçamento Comercial: ${editingProp.numero}`}
          subtitle="Configuração dinâmica de linhas de serviço, peças, deslocações, descontos e IVA"
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Header Data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
              {/* Searchable Empresa Cliente Input */}
              <div className="relative" ref={empresaContainerRef}>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Empresa Cliente <span className="text-[10px] text-hp-400">(Apenas clientes criados)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Escreva para pesquisar cliente..."
                    value={empresaQuery}
                    onChange={e => {
                      setEmpresaQuery(e.target.value);
                      setIsEmpresaDropdownOpen(true);
                    }}
                    onFocus={() => setIsEmpresaDropdownOpen(true)}
                    className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 focus:border-hp-500 rounded-xl text-xs text-white"
                  />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {isEmpresaDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    {matchingEmpresas.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500">Nenhum cliente registado encontrado.</div>
                    ) : (
                      matchingEmpresas.map(emp => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmpresaItem(emp)}
                          className="w-full text-left p-2.5 hover:bg-hp-600/20 border-b border-slate-800/60 last:border-0 text-xs flex items-center justify-between group transition-colors"
                        >
                          <span className="font-bold text-white">{emp.nome}</span>
                          <span className="text-[11px] text-slate-400 font-mono">NIF: {emp.nif || 'S/NIF'}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Searchable Viatura / Matrícula Input (Optional) */}
              <div className="relative" ref={plateContainerRef}>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Viatura / Matrícula <span className="text-[10px] text-slate-500">(Opcional • Só criadas)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Sem matrícula ou pesquisar frota..."
                    value={plateQuery}
                    onChange={e => {
                      setPlateQuery(e.target.value.toUpperCase());
                      setIsPlateDropdownOpen(true);
                    }}
                    onFocus={() => setIsPlateDropdownOpen(true)}
                    className="w-full py-1.5 pl-3 pr-7 bg-slate-900 border border-slate-700 focus:border-hp-500 rounded-xl text-xs text-white font-mono font-bold"
                  />
                  {editingProp.matricula ? (
                    <button
                      type="button"
                      onClick={handleClearPlate}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>

                {isPlateDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={handleClearPlate}
                      className="w-full text-left p-2 hover:bg-slate-900 border-b border-slate-800 text-xs text-slate-400 italic"
                    >
                      -- Sem Matrícula / Intervenção Geral --
                    </button>
                    {matchingEquipamentos.map(eq => (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => handleSelectPlateItem(eq)}
                        className="w-full text-left p-2 hover:bg-hp-600/20 border-b border-slate-800/60 last:border-0 text-xs flex items-center justify-between group transition-colors"
                      >
                        <span className="font-mono font-extrabold text-white">{eq.matricula}</span>
                        <span className="text-[11px] text-slate-300">{eq.marca} {eq.modelo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Estado da Proposta</label>
                <select
                  value={editingProp.status || 'Rascunho'}
                  onChange={e => setEditingProp(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full py-1.5 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviada">Enviada</option>
                  <option value="Aprovada">Aprovada</option>
                  <option value="Rejeitada">Rejeitada</option>
                  <option value="Convertida">Convertida</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Descrição / Objeto da Proposta</label>
              <textarea
                rows={2}
                value={editingProp.descricao || ''}
                onChange={e => setEditingProp(prev => ({ ...prev, descricao: e.target.value }))}
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Proposal Lines Table with New Deslocação Button */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Linhas do Orçamento ({editingProp.linhas?.length || 0})
                </h4>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddLine('servico')}
                    className="px-2.5 py-1 bg-hp-600/30 hover:bg-hp-600 text-hp-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-hp-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Mão-de-Obra
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddLine('peca')}
                    className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-emerald-500/30 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + Peça / Material
                  </button>

                  {/* New Deslocação button (0.75€/Km) */}
                  <button
                    type="button"
                    onClick={handleAddDeslocacao}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 border border-amber-500/40 transition-all shadow-sm"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    + Deslocação (0.75€/Km)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {editingProp.linhas?.map(linha => (
                  <div key={linha.id} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded shrink-0 ${
                        linha.codigo === 'DESLOC-KM'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : linha.tipo === 'servico'
                          ? 'bg-hp-500/20 text-hp-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {linha.codigo === 'DESLOC-KM' ? 'Deslocação' : linha.tipo}
                      </span>

                      {linha.tipo === 'peca' && (
                        <SearchableCatalogSelectForLine
                          catalogo={catalogoPecas}
                          onSelect={(part: PecaCatalogo) => handleSelectCatalogPartForLine(part, linha.id)}
                        />
                      )}

                      <input
                        type="text"
                        placeholder="Código"
                        value={linha.codigo}
                        onChange={e => handleUpdateLine(linha.id, 'codigo', e.target.value)}
                        className="w-24 py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />

                      <input
                        type="text"
                        placeholder="Descrição do item..."
                        value={linha.descricao}
                        onChange={e => handleUpdateLine(linha.id, 'descricao', e.target.value)}
                        className="flex-1 py-1 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(linha.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-slate-500 block">{linha.codigo === 'DESLOC-KM' ? 'KM (Ida+Volta)' : 'Qtd / Horas'}</span>
                        <input
                          type="number"
                          value={linha.quantidade}
                          onChange={e => handleUpdateLine(linha.id, 'quantidade', Number(e.target.value))}
                          className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Preço Unit. €</span>
                        <input
                          type="number"
                          step="0.01"
                          value={linha.precoUnitario}
                          onChange={e => handleUpdateLine(linha.id, 'precoUnitario', Number(e.target.value))}
                          className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Desconto %</span>
                        <input
                          type="number"
                          value={linha.desconto}
                          onChange={e => handleUpdateLine(linha.id, 'desconto', Number(e.target.value))}
                          className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 block">Taxa IVA %</span>
                        <select
                          value={linha.taxaIva}
                          onChange={e => handleUpdateLine(linha.id, 'taxaIva', Number(e.target.value))}
                          className="w-full py-1 px-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center"
                        >
                          <option value="23">23%</option>
                          <option value="13">13%</option>
                          <option value="6">6%</option>
                          <option value="0">0% (Isento)</option>
                        </select>
                      </div>

                      <div className="text-right flex flex-col justify-end">
                        <span className="text-[10px] text-slate-500 block">Subtotal Líq.</span>
                        <span className="py-1 font-bold text-hp-400 text-sm">
                          {linha.subtotal.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Grand Totals */}
            <div className="flex justify-end">
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 w-72 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Total S/ IVA:</span>
                  <span>{editingProp.totalSemIva?.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total IVA:</span>
                  <span>{editingProp.totalIva?.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-extrabold text-base pt-2 border-t border-slate-800">
                  <span>TOTAL FINAL:</span>
                  <span>{editingProp.totalComIva?.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Guardar Orçamento
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
