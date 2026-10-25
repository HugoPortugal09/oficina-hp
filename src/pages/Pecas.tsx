import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  ShoppingCart,
  Edit,
  Trash2,
  Check,
  TrendingUp,
  Boxes,
  Calendar,
  Clock,
  Truck,
  Layers,
  Activity,
  History,
  LayoutGrid,
  Table,
  Download,
  Wrench,
  Tag,
  Sparkles,
  Info
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { db, STORAGE_KEYS } from '../services/dbService';
import type { PecaCatalogo, FolhaServico, UserProfile, KitManutencao, KitPecaItem, KitServicoItem } from '../types';
import { getPermissionsForRole } from '../types';

interface PecasProps {
  pecas: PecaCatalogo[];
  folhas?: FolhaServico[];
  kits?: KitManutencao[];
  currentUser?: UserProfile;
}

export const Pecas: React.FC<PecasProps> = ({ pecas, folhas = [], kits: propKits, currentUser }) => {
  const permissions = getPermissionsForRole(currentUser?.role || 'administrador');
  const [searchTerm, setSearchTerm] = useState('');
  const [displayCount, setDisplayCount] = useState(30);

  useEffect(() => {
    setDisplayCount(30);
  }, [searchTerm]);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    try {
      const saved = localStorage.getItem('oficina_hp_view_pecas');
      if (saved === 'grid' || saved === 'table') return saved;
    } catch {}
    return 'grid';
  });

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('oficina_hp_view_pecas', mode);
    } catch {}
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPeca, setEditingPeca] = useState<Partial<PecaCatalogo>>({});

  // Sub-tabs: Catálogo vs Kits de Manutenção
  const [mainTab, setMainTab] = useState<'catalogo' | 'kits'>('catalogo');
  const [kitsList, setKitsList] = useState<KitManutencao[]>(() => {
    return propKits && propKits.length > 0 ? propKits : db.get<KitManutencao>(STORAGE_KEYS.KITS_MANUTENCAO);
  });
  const [kitSearchTerm, setKitSearchTerm] = useState('');
  const [isKitModalOpen, setIsKitModalOpen] = useState(false);
  const [editingKit, setEditingKit] = useState<Partial<KitManutencao> | null>(null);

  useEffect(() => {
    if (propKits && propKits.length > 0) {
      setKitsList(propKits);
    }
  }, [propKits]);

  // Calculate Parts usage over 30, 90, and 360 days (memoized to eliminate heavy body recalculation on render)
  const { totalUsadas30, totalUsadas90, totalUsadas360, partUsageMap } = useMemo(() => {
    const now = new Date().getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const cutoff30 = now - 30 * ONE_DAY_MS;
    const cutoff90 = now - 90 * ONE_DAY_MS;
    const cutoff360 = now - 360 * ONE_DAY_MS;

    let u30 = 0;
    let u90 = 0;
    let u360 = 0;
    const usageMap: { [key: string]: { d30: number; d90: number; d360: number } } = {};

    folhas.forEach(f => {
      const folhaTime = new Date(f.data).getTime() || now;
      const allPecas = [...(f.pecas || []), ...(f.pecasAdicionais || [])];

      allPecas.forEach(p => {
        const qtd = Number(p.qtd) || 0;
        if (folhaTime >= cutoff30) u30 += qtd;
        if (folhaTime >= cutoff90) u90 += qtd;
        if (folhaTime >= cutoff360) u360 += qtd;

        const refKey = (p.referencia || p.designacao || '').trim().toLowerCase();
        if (refKey) {
          if (!usageMap[refKey]) {
            usageMap[refKey] = { d30: 0, d90: 0, d360: 0 };
          }
          if (folhaTime >= cutoff30) usageMap[refKey].d30 += qtd;
          if (folhaTime >= cutoff90) usageMap[refKey].d90 += qtd;
          if (folhaTime >= cutoff360) usageMap[refKey].d360 += qtd;
        }
      });
    });

    return { totalUsadas30: u30, totalUsadas90: u90, totalUsadas360: u360, partUsageMap: usageMap };
  }, [folhas]);

  const getUsageForPart = (p: PecaCatalogo) => {
    const keyRef = (p.referencia || '').trim().toLowerCase();
    const keyDes = (p.designacao || '').trim().toLowerCase();
    return partUsageMap[keyRef] || partUsageMap[keyDes] || { d30: 0, d90: 0, d360: 0 };
  };

  const handleCreateNew = () => {
    setEditingPeca({
      id: db.generateId('pec'),
      referencia: '',
      designacao: '',
      marca: '',
      modelo: '',
      fornecedor: '',
      preco: 0,
      precoVenda: 0,
      taxaIva: 23,
      stockAtual: 0,
      stockMinimo: 2,
      localizacaoArmazem: 'Armazém Principal'
    });
    setIsModalOpen(true);
  };

  const handleExportCSV = () => {
    const headers = [
      'Código / Referência',
      'Designação',
      'Código de Barras (Barcode)',
      'Marca',
      'Modelo',
      'Localização Armazém',
      'Stock Atual',
      'Stock Mínimo',
      'Preço Custo (€)',
      'Preço Venda (€)',
      'Taxa IVA (%)',
      'Fornecedor',
      'Categoria',
      'Notas'
    ];
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const rows = [headers.map(escapeCsv).join(';')];
    pecas.forEach(p => {
      const ref = p.referencia || '';
      rows.push([
        ref,
        p.designacao || '',
        p.codigoBarras || ref,
        p.marca || '',
        p.modelo || '',
        p.localizacaoArmazem || '',
        p.stockAtual ?? 0,
        p.stockMinimo ?? 0,
        p.precoCusto ?? (p.preco !== undefined ? p.preco : ''),
        p.precoVenda ?? '',
        p.taxaIva ?? 23,
        p.fornecedor || '',
        p.categoria || '',
        p.notas || ''
      ].map(escapeCsv).join(';'));
    });
    const blob = new Blob(['\uFEFF' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `catalogo_pecas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (!editingPeca.referencia || !editingPeca.designacao) {
      alert('Por favor informe a referência e designação da peça.');
      return;
    }

    const price = Number(editingPeca.preco || editingPeca.precoVenda || 0);
    const pecaToSave: PecaCatalogo = {
      ...(editingPeca as PecaCatalogo),
      preco: price,
      precoVenda: price
    };

    const currentList = db.get<PecaCatalogo>(STORAGE_KEYS.PECAS_CATALOGO);
    const existingIndex = currentList.findIndex(p => p.id === editingPeca.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.PECAS_CATALOGO, editingPeca.id!, pecaToSave);
    } else {
      db.insert(STORAGE_KEYS.PECAS_CATALOGO, pecaToSave);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar esta peça?')) {
      db.delete(STORAGE_KEYS.PECAS_CATALOGO, id);
      setIsModalOpen(false);
    }
  };

  // Funções de Gestão de Kits de Manutenção
  const handleReloadKits = () => {
    setKitsList(db.get<KitManutencao>(STORAGE_KEYS.KITS_MANUTENCAO));
  };

  const handleCreateNewKit = () => {
    setEditingKit({
      id: db.generateId('kit'),
      codigo: '',
      nome: '',
      descricao: '',
      marcaModelo: '',
      horasIntervalo: 500,
      kmsIntervalo: 15000,
      pecas: [
        { id: db.generateId('kp'), referencia: '', designacao: '', qtd: 1, isLivre: true }
      ],
      servicos: [
        { id: db.generateId('ks'), descricao: '', horas: 1.0 }
      ]
    });
    setIsKitModalOpen(true);
  };

  const handleEditKit = (kit: KitManutencao) => {
    setEditingKit(JSON.parse(JSON.stringify(kit)));
    setIsKitModalOpen(true);
  };

  const handleSaveKit = () => {
    if (!editingKit || !editingKit.codigo?.trim() || !editingKit.nome?.trim()) {
      alert('Por favor introduza o Código e o Nome do Kit de Manutenção.');
      return;
    }

    const kitToSave: KitManutencao = {
      id: editingKit.id || db.generateId('kit'),
      codigo: editingKit.codigo.trim().toUpperCase(),
      nome: editingKit.nome.trim(),
      descricao: editingKit.descricao?.trim() || '',
      marcaModelo: editingKit.marcaModelo?.trim() || '',
      horasIntervalo: Number(editingKit.horasIntervalo) || 0,
      kmsIntervalo: Number(editingKit.kmsIntervalo) || 0,
      pecas: (editingKit.pecas || []).filter(p => (p.referencia && p.referencia.trim()) || (p.designacao && p.designacao.trim())),
      servicos: (editingKit.servicos || []).filter(s => s.descricao && s.descricao.trim()),
      atualizadoEm: new Date().toISOString()
    };

    const currentKits = db.get<KitManutencao>(STORAGE_KEYS.KITS_MANUTENCAO);
    const existingIndex = currentKits.findIndex(k => k.id === kitToSave.id);

    if (existingIndex >= 0) {
      db.update(STORAGE_KEYS.KITS_MANUTENCAO, kitToSave.id, kitToSave);
    } else {
      kitToSave.criadoEm = new Date().toISOString();
      db.insert(STORAGE_KEYS.KITS_MANUTENCAO, kitToSave);
    }

    handleReloadKits();
    setIsKitModalOpen(false);
    setEditingKit(null);
  };

  const handleDeleteKit = (id: string) => {
    if (confirm('Tem a certeza que deseja eliminar este Kit de Manutenção?')) {
      db.delete(STORAGE_KEYS.KITS_MANUTENCAO, id);
      handleReloadKits();
      setIsKitModalOpen(false);
      setEditingKit(null);
    }
  };

  const handleAddKitPeca = () => {
    if (!editingKit) return;
    setEditingKit(prev => prev ? ({
      ...prev,
      pecas: [
        ...(prev.pecas || []),
        { id: db.generateId('kp'), referencia: '', designacao: '', qtd: 1, isLivre: true }
      ]
    }) : null);
  };

  const handleSelectCatalogToKitPeca = (itemIndex: number, partId: string) => {
    if (!editingKit) return;
    const catPart = pecas.find(p => p.id === partId);
    if (!catPart) return;

    setEditingKit(prev => {
      if (!prev || !prev.pecas) return prev;
      const updatedPecas = [...prev.pecas];
      updatedPecas[itemIndex] = {
        ...updatedPecas[itemIndex],
        pecaId: catPart.id,
        referencia: catPart.referencia,
        designacao: catPart.designacao,
        isLivre: false
      };
      return { ...prev, pecas: updatedPecas };
    });
  };

  const handleUpdateKitPeca = (itemIndex: number, field: keyof KitPecaItem, val: any) => {
    if (!editingKit) return;
    setEditingKit(prev => {
      if (!prev || !prev.pecas) return prev;
      const updatedPecas = [...prev.pecas];
      updatedPecas[itemIndex] = {
        ...updatedPecas[itemIndex],
        [field]: val
      };
      return { ...prev, pecas: updatedPecas };
    });
  };

  const handleRemoveKitPeca = (itemIndex: number) => {
    if (!editingKit) return;
    setEditingKit(prev => {
      if (!prev || !prev.pecas) return prev;
      const updatedPecas = prev.pecas.filter((_, idx) => idx !== itemIndex);
      return { ...prev, pecas: updatedPecas };
    });
  };

  const handleAddKitServico = () => {
    if (!editingKit) return;
    setEditingKit(prev => prev ? ({
      ...prev,
      servicos: [
        ...(prev.servicos || []),
        { id: db.generateId('ks'), descricao: '', horas: 1.0 }
      ]
    }) : null);
  };

  const handleUpdateKitServico = (itemIndex: number, field: keyof KitServicoItem, val: any) => {
    if (!editingKit) return;
    setEditingKit(prev => {
      if (!prev || !prev.servicos) return prev;
      const updatedServicos = [...prev.servicos];
      updatedServicos[itemIndex] = {
        ...updatedServicos[itemIndex],
        [field]: val
      };
      return { ...prev, servicos: updatedServicos };
    });
  };

  const handleRemoveKitServico = (itemIndex: number) => {
    if (!editingKit) return;
    setEditingKit(prev => {
      if (!prev || !prev.servicos) return prev;
      const updatedServicos = prev.servicos.filter((_, idx) => idx !== itemIndex);
      return { ...prev, servicos: updatedServicos };
    });
  };

  const filteredPecas = pecas.filter(p => {
    const q = searchTerm.toLowerCase();
    return (
      p.referencia.toLowerCase().includes(q) ||
      p.designacao.toLowerCase().includes(q) ||
      (p.marca && p.marca.toLowerCase().includes(q)) ||
      (p.modelo && p.modelo.toLowerCase().includes(q)) ||
      (p.fornecedor && p.fornecedor.toLowerCase().includes(q))
    );
  });

  const visiblePecas = useMemo(() => filteredPecas.slice(0, displayCount), [filteredPecas, displayCount]);

  const filteredKits = kitsList.filter(k => {
    const q = kitSearchTerm.toLowerCase();
    return (
      k.codigo.toLowerCase().includes(q) ||
      k.nome.toLowerCase().includes(q) ||
      (k.marcaModelo && k.marcaModelo.toLowerCase().includes(q)) ||
      (k.descricao && k.descricao.toLowerCase().includes(q)) ||
      k.pecas.some(p => p.referencia.toLowerCase().includes(q) || p.designacao.toLowerCase().includes(q)) ||
      k.servicos.some(s => s.descricao.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3.5">
      {/* Top Tabs: Catálogo de Peças vs Kits de Manutenção */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainTab('catalogo')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              mainTab === 'catalogo'
                ? 'bg-hp-600/20 text-hp-400 border-hp-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catálogo de Peças</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
              {pecas.length}
            </span>
          </button>

          <button
            onClick={() => setMainTab('kits')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              mainTab === 'kits'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Boxes className="w-4 h-4 text-amber-400" />
            <span>Kits de Manutenção / Revisão</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {kitsList.length}
            </span>
          </button>
        </div>

        {mainTab === 'kits' && permissions.canEditPecas && (
          <button
            onClick={handleCreateNewKit}
            className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-amber-600/20 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border border-amber-400/30"
          >
            <Plus className="w-4 h-4" />
            Criar Kit de Manutenção
          </button>
        )}
      </div>

      {mainTab === 'catalogo' && (
        <>
          {/* 30, 90, 360 Days Stats Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlassCard className="p-3 flex items-center justify-between border-hp-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-hp-400" />
              Peças Usadas (Últimos 30 Dias)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-white mt-1">
              {totalUsadas30} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-hp-500/20 border border-hp-500/30 flex items-center justify-center text-hp-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-cyan-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              Peças Usadas (Últimos 90 Dias)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-cyan-300 mt-1">
              {totalUsadas90} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between border-amber-500/30">
          <div>
            <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Peças Usadas (Último Ano)
            </span>
            <h3 className="text-2xl font-extrabold font-mono text-amber-300 mt-1">
              {totalUsadas360} <span className="text-xs text-slate-400 font-normal">unidades</span>
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
        </GlassCard>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Pesquisar por referência, designação, marca, modelo, fornecedor..."
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

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-colors flex items-center gap-2 shadow-sm"
            title="Exportar Catálogo em CSV / Excel para Etiquetas de Código de Barras"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          {permissions.canEditPecas && (
            <button
              onClick={handleCreateNew}
              className="glass-btn px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-hp-600/30"
            >
              <Plus className="w-4 h-4" />
              Adicionar Peça ao Catálogo
            </button>
          )}
        </div>
      </div>

      {/* Grid or Table View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visiblePecas.map(p => {
            const isLowStock = p.stockAtual <= p.stockMinimo;
            const displayPrice = p.preco !== undefined ? p.preco : p.precoVenda;
            const usage = getUsageForPart(p);

            return (
              <GlassCard
                key={p.id}
                onClick={() => {
                  if (permissions.canEditPecas) {
                    setEditingPeca(p);
                    setIsModalOpen(true);
                  }
                }}
                className={`flex flex-col justify-between space-y-4 ${
                  permissions.canEditPecas ? 'hover:border-hp-500/40 cursor-pointer group' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-hp-400 px-2 py-0.5 bg-slate-950 rounded border border-slate-800">
                        {p.referencia}
                      </span>
                      <h4 className="text-sm font-bold text-white mt-1.5 group-hover:text-hp-400 transition-colors">
                        {p.designacao}
                      </h4>
                      {(p.marca || p.modelo) && (
                        <span className="text-xs text-slate-400">
                          {p.marca} {p.modelo ? `• ${p.modelo}` : ''}
                        </span>
                      )}
                    </div>

                    {permissions.canEditPecas && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingPeca(p);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Stock, Supplier and Price */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs font-mono">
                    {permissions.canViewPrecos && (
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-slate-400">Preço:</span>
                        <span className="font-bold text-emerald-400 text-base">{displayPrice.toFixed(2)} €</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="font-sans text-slate-400">Stock Atual:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold ${isLowStock ? 'text-rose-400' : 'text-slate-200'}`}>
                          {p.stockAtual} un.
                        </span>
                        {isLowStock && (
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">
                            Mín: {p.stockMinimo}
                          </span>
                        )}
                      </div>
                    </div>

                    {p.fornecedor && (
                      <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800 text-[11px]">
                        <span className="font-sans">Fornecedor:</span>
                        <span className="font-sans font-semibold text-slate-300 truncate max-w-[170px]">{p.fornecedor}</span>
                      </div>
                    )}

                    {p.localizacaoArmazem && (
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span className="font-sans">Local Armazém:</span>
                        <span className="font-sans text-slate-400">{p.localizacaoArmazem}</span>
                      </div>
                    )}
                  </div>

                  {/* Consumption Metric Per Part */}
                  <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/90 text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Consumo Deste Artigo:</span>
                    <div className="grid grid-cols-3 gap-1 text-center font-mono text-[11px]">
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">30d</span>
                        <span className="font-bold text-hp-400">{usage.d30} un.</span>
                      </div>
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">90d</span>
                        <span className="font-bold text-cyan-400">{usage.d90} un.</span>
                      </div>
                      <div className="p-1 bg-slate-900 rounded-lg">
                        <span className="text-[9px] text-slate-500 block">360d</span>
                        <span className="font-bold text-amber-400">{usage.d360} un.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action / Status */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono">
                    {permissions.canViewPrecos ? `IVA: ${p.taxaIva || 23}%` : 'Disponibilidade'}
                  </span>
                  <Badge variant={isLowStock ? 'danger' : 'success'}>
                    {isLowStock ? 'Stock Baixo' : 'Disponível'}
                  </Badge>
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
                <th className="py-3 px-4">Referência</th>
                <th className="py-3 px-4">Designação da Peça</th>
                <th className="py-3 px-4">Marca / Modelo</th>
                <th className="py-3 px-4">Fornecedor</th>
                {permissions.canViewPrecos && <th className="py-3 px-4 text-right">Preço (€)</th>}
                <th className="py-3 px-4 text-right">Stock</th>
                <th className="py-3 px-4 text-center">Consumo (30d / 90d / 360d)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                {permissions.canEditPecas && <th className="py-3 px-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {visiblePecas.map(p => {
                const isLowStock = p.stockAtual <= p.stockMinimo;
                const displayPrice = p.preco !== undefined ? p.preco : p.precoVenda;
                const usage = getUsageForPart(p);

                return (
                  <tr
                    key={p.id}
                    onClick={() => {
                      if (permissions.canEditPecas) {
                        setEditingPeca(p);
                        setIsModalOpen(true);
                      }
                    }}
                    className={`${permissions.canEditPecas ? 'hover:bg-hp-600/10 cursor-pointer' : ''} transition-colors`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-hp-400">{p.referencia}</td>
                    <td className="py-3 px-4 font-bold text-white max-w-xs">{p.designacao}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.marca} {p.modelo ? `• ${p.modelo}` : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.fornecedor || '-'}</td>
                    {permissions.canViewPrecos && (
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {displayPrice.toFixed(2)} €
                      </td>
                    )}
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={isLowStock ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                        {p.stockAtual} un.
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[11px]">
                      <span className="text-hp-400 font-bold">{usage.d30}</span> /{' '}
                      <span className="text-cyan-400 font-bold">{usage.d90}</span> /{' '}
                      <span className="text-amber-400 font-bold">{usage.d360}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={isLowStock ? 'danger' : 'success'}>
                        {isLowStock ? 'Stock Baixo' : 'Disponível'}
                      </Badge>
                    </td>
                    {permissions.canEditPecas && (
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingPeca(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Load More Button for Instant Performance */}
      {filteredPecas.length > displayCount && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-6">
          <button
            type="button"
            onClick={() => setDisplayCount(prev => prev + 30)}
            className="px-5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-hp-500 text-xs font-bold text-slate-200 hover:text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            A mostrar {visiblePecas.length} de {filteredPecas.length} peças • Carregar mais (+30)
          </button>
          <button
            type="button"
            onClick={() => setDisplayCount(filteredPecas.length)}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
          >
            Mostrar todas ({filteredPecas.length})
          </button>
        </div>
      )}
      </>
      )}

      {/* Main Tab: KITS DE MANUTENÇÃO */}
      {mainTab === 'kits' && (
        <div className="space-y-4">
          {/* Kits Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <GlassCard className="p-3 flex items-center justify-between border-amber-500/30">
              <div>
                <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  Kits de Manutenção Ativos
                </span>
                <h3 className="text-2xl font-extrabold font-mono text-amber-300 mt-1">
                  {kitsList.length} <span className="text-xs text-slate-400 font-normal">configurados</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Boxes className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-3 flex items-center justify-between border-emerald-500/30">
              <div>
                <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  Peças Vinculadas em Kits
                </span>
                <h3 className="text-2xl font-extrabold font-mono text-emerald-300 mt-1">
                  {kitsList.reduce((acc, k) => acc + (k.pecas?.length || 0), 0)}{' '}
                  <span className="text-xs text-slate-400 font-normal">peças</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Check className="w-5 h-5" />
              </div>
            </GlassCard>

            <GlassCard className="p-3 flex items-center justify-between border-cyan-500/30">
              <div>
                <span className="text-xs font-semibold text-slate-400 block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Tarefas Técnicas Padronizadas
                </span>
                <h3 className="text-2xl font-extrabold font-mono text-cyan-300 mt-1">
                  {kitsList.reduce((acc, k) => acc + (k.servicos?.length || 0), 0)}{' '}
                  <span className="text-xs text-slate-400 font-normal">passos</span>
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Wrench className="w-5 h-5" />
              </div>
            </GlassCard>
          </div>

          {/* Kits Filter & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar kit por código, nome, máquina, peça ou tarefa..."
                value={kitSearchTerm}
                onChange={e => setKitSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Ao escolher o código do Kit numa Folha de Serviço, as peças e serviços desdobram-se automaticamente.</span>
            </div>
          </div>

          {/* Kits Cards Grid */}
          {filteredKits.length === 0 ? (
            <GlassCard className="p-8 text-center border-dashed border-slate-800">
              <Boxes className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-300">Nenhum Kit de Manutenção encontrado</h4>
              <p className="text-xs text-slate-500 mt-1">
                {kitSearchTerm ? 'Tente outro termo de pesquisa.' : 'Crie o primeiro kit com peças e tempos de intervenção definidos.'}
              </p>
              {permissions.canEditPecas && !kitSearchTerm && (
                <button
                  onClick={handleCreateNewKit}
                  className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  Criar Primeiro Kit
                </button>
              )}
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredKits.map(kit => {
                const totalHoras = (kit.servicos || []).reduce((acc, s) => acc + (Number(s.horas) || 0), 0);
                return (
                  <GlassCard
                    key={kit.id}
                    className="flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all border-slate-800/80 bg-slate-950/70"
                  >
                    <div className="space-y-3">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-lg border border-amber-500/30 tracking-wider">
                              [KIT] {kit.codigo}
                            </span>
                            {kit.horasIntervalo ? (
                              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                                <Clock className="w-3 h-3 text-amber-400" />
                                {kit.horasIntervalo}h
                              </span>
                            ) : null}
                            {kit.kmsIntervalo ? (
                              <span className="text-[11px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                                {kit.kmsIntervalo.toLocaleString()} km
                              </span>
                            ) : null}
                          </div>
                          <h4 className="text-base font-extrabold text-white mt-2 leading-snug">{kit.nome}</h4>
                          {kit.marcaModelo && (
                            <p className="text-xs text-slate-400 mt-0.5 font-medium flex items-center gap-1">
                              <Tag className="w-3 h-3 text-slate-500" />
                              {kit.marcaModelo}
                            </p>
                          )}
                        </div>

                        {permissions.canEditPecas && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditKit(kit)}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                              title="Editar Kit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteKit(kit.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Eliminar Kit"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {kit.descricao && (
                        <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">
                          {kit.descricao}
                        </p>
                      )}

                      {/* Peças Incluídas */}
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-1.5 text-emerald-400">
                            <Package className="w-3.5 h-3.5" />
                            Peças & Consumíveis ({kit.pecas?.length || 0})
                          </span>
                        </div>
                        {(!kit.pecas || kit.pecas.length === 0) ? (
                          <p className="text-[11px] text-slate-500 italic">Nenhuma peça configurada.</p>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {kit.pecas.map((p, idx) => (
                              <div
                                key={p.id || idx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800/40"
                              >
                                <div className="truncate pr-2">
                                  {p.referencia && (
                                    <span className="font-mono font-bold text-hp-400 mr-1.5">
                                      {p.referencia}
                                    </span>
                                  )}
                                  <span className="text-slate-200">{p.designacao}</span>
                                </div>
                                <span className="font-mono font-bold text-emerald-400 shrink-0 text-[11px] px-1.5 py-0.5 bg-emerald-950/60 border border-emerald-500/30 rounded">
                                  {p.qtd}x
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tarefas & Tempos Previstos */}
                      <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                          <span className="flex items-center gap-1.5 text-cyan-400">
                            <Wrench className="w-3.5 h-3.5" />
                            Tarefas a Realizar ({kit.servicos?.length || 0})
                          </span>
                          <span className="font-mono text-cyan-300 font-extrabold text-[11px] px-2 py-0.5 bg-cyan-950/60 border border-cyan-500/30 rounded-lg">
                            Tempo Total: {totalHoras.toFixed(2)}h
                          </span>
                        </div>
                        {(!kit.servicos || kit.servicos.length === 0) ? (
                          <p className="text-[11px] text-slate-500 italic">Nenhum serviço configurado.</p>
                        ) : (
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {kit.servicos.map((s, idx) => (
                              <div
                                key={s.id || idx}
                                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/60 border border-slate-800/40"
                              >
                                <span className="text-slate-300 truncate pr-2">
                                  {idx + 1}. {s.descricao}
                                </span>
                                <span className="font-mono font-bold text-cyan-400 shrink-0 text-[11px]">
                                  {Number(s.horas || 0).toFixed(2)}h
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <span>Pronto a aplicar na Folha de Serviço</span>
                      <span className="font-mono text-amber-400/90 font-bold">{kit.codigo}</span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Criação / Edição de Kit de Manutenção */}
      {isKitModalOpen && editingKit && (
        <Modal
          isOpen={isKitModalOpen}
          onClose={() => {
            setIsKitModalOpen(false);
            setEditingKit(null);
          }}
          title={editingKit.id ? `Editar Kit: ${editingKit.codigo || 'Novo'}` : 'Novo Kit de Manutenção'}
          subtitle="Configure as peças necessárias e o checklist de tarefas com tempos previstos em horas"
          maxWidth="3xl"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Código do Kit * <span className="text-amber-400 font-mono">(Ex: KIT-500H)</span>
                </label>
                <input
                  type="text"
                  value={editingKit.codigo || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, codigo: e.target.value.toUpperCase() }) : null)}
                  placeholder="KIT-500H"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold uppercase focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Nome do Kit * <span className="text-slate-500">(Ex: Kit Revisão 500 Horas)</span>
                </label>
                <input
                  type="text"
                  value={editingKit.nome || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, nome: e.target.value }) : null)}
                  placeholder="Kit Revisão 500 Horas"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Marca / Modelo Aplicável
                </label>
                <input
                  type="text"
                  value={editingKit.marcaModelo || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, marcaModelo: e.target.value }) : null)}
                  placeholder="Geral / Empilhadores Diesel"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Intervalo em Horas (h)
                </label>
                <input
                  type="number"
                  value={editingKit.horasIntervalo || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, horasIntervalo: Number(e.target.value) }) : null)}
                  placeholder="500"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Intervalo em Quilómetros (km)
                </label>
                <input
                  type="number"
                  value={editingKit.kmsIntervalo || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, kmsIntervalo: Number(e.target.value) }) : null)}
                  placeholder="15000"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Descrição / Notas
                </label>
                <input
                  type="text"
                  value={editingKit.descricao || ''}
                  onChange={e => setEditingKit(prev => prev ? ({ ...prev, descricao: e.target.value }) : null)}
                  placeholder="Revisão preventiva padrão..."
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* SECÇÃO DE PEÇAS DO KIT */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-400" />
                    Peças & Filtros do Kit ({editingKit.pecas?.length || 0})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Selecione artigos do catálogo existente ou escreva diretamente a referência e designação
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddKitPeca}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-emerald-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Peça
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(!editingKit.pecas || editingKit.pecas.length === 0) ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                    Nenhuma peça adicionada a este kit. Clique em "+ Adicionar Peça".
                  </p>
                ) : (
                  editingKit.pecas.map((pec, idx) => (
                    <div
                      key={pec.id || idx}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-xl"
                    >
                      {/* Seletor rápido de catálogo */}
                      <select
                        value={pec.pecaId || ''}
                        onChange={e => handleSelectCatalogToKitPeca(idx, e.target.value)}
                        className="w-full sm:w-48 py-1.5 px-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                      >
                        <option value="">-- Escolher do Catálogo --</option>
                        {pecas.map(cp => (
                          <option key={cp.id} value={cp.id}>
                            {cp.referencia} - {cp.designacao}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="Referência..."
                        value={pec.referencia || ''}
                        onChange={e => handleUpdateKitPeca(idx, 'referencia', e.target.value)}
                        className="w-full sm:w-32 py-1.5 px-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-hp-400 font-mono font-bold"
                      />

                      <input
                        type="text"
                        placeholder="Designação da peça / filtro..."
                        value={pec.designacao || ''}
                        onChange={e => handleUpdateKitPeca(idx, 'designacao', e.target.value)}
                        className="flex-1 py-1.5 px-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                      />

                      <div className="flex items-center gap-2 justify-between sm:justify-end">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 font-semibold">Qtd:</span>
                          <input
                            type="number"
                            min="1"
                            value={pec.qtd || 1}
                            onChange={e => handleUpdateKitPeca(idx, 'qtd', Number(e.target.value) || 1)}
                            className="w-16 py-1.5 px-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-emerald-400 font-mono font-bold text-center"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveKitPeca(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SECÇÃO DE SERVIÇOS & TAREFAS DO KIT */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-cyan-400" />
                    Checklist de Tarefas & Serviços ({editingKit.servicos?.length || 0})
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Defina o que o operador deve fazer e o tempo padrão estipulado em horas (ex: 1.0 = 1 hora, 0.5 = 30 min)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddKitServico}
                  className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1 border border-cyan-500/30 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Tarefa
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(!editingKit.servicos || editingKit.servicos.length === 0) ? (
                  <p className="text-xs text-slate-500 italic p-3 text-center bg-slate-900/40 rounded-xl border border-slate-800">
                    Nenhuma tarefa técnica adicionada a este kit. Clique em "+ Adicionar Tarefa".
                  </p>
                ) : (
                  editingKit.servicos.map((srv, idx) => (
                    <div
                      key={srv.id || idx}
                      className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-xl"
                    >
                      <span className="text-xs font-mono font-bold text-slate-500 w-6 text-center shrink-0">
                        {idx + 1}.
                      </span>

                      <input
                        type="text"
                        placeholder="Descrição da tarefa (ex: Substituir óleo do motor e filtro)..."
                        value={srv.descricao || ''}
                        onChange={e => handleUpdateKitServico(idx, 'descricao', e.target.value)}
                        className="flex-1 py-1.5 px-2.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                      />

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px] text-slate-400 font-semibold">Horas:</span>
                        <input
                          type="number"
                          step="0.25"
                          min="0.1"
                          placeholder="1.0"
                          value={srv.horas !== undefined ? srv.horas : 1.0}
                          onChange={e => handleUpdateKitServico(idx, 'horas', Number(e.target.value))}
                          className="w-20 py-1.5 px-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-cyan-400 font-mono font-bold text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveKitServico(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Total Horas do Kit */}
              <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Mão-de-Obra Total Prevista:
                </span>
                <span className="font-mono font-extrabold text-cyan-300 text-sm">
                  {(editingKit.servicos || []).reduce((acc, s) => acc + (Number(s.horas) || 0), 0).toFixed(2)} horas
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingKit.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteKit(editingKit.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar Kit
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsKitModalOpen(false);
                    setEditingKit(null);
                  }}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveKit}
                  className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-amber-600/30 flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 border border-amber-400/30"
                >
                  <Check className="w-4 h-4" />
                  Guardar Kit de Manutenção
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit / Create Part Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingPeca.id?.startsWith('pec_new') ? 'Nova Peça no Catálogo' : `Editar: ${editingPeca.referencia}`}
          subtitle="Dados da peça, marca, modelo, fornecedor, preço e gestão de stock"
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className={`grid grid-cols-1 ${permissions.canViewPrecos ? 'sm:grid-cols-2' : ''} gap-3`}>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Referência / Código *</label>
                <input
                  type="text"
                  value={editingPeca.referencia || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, referencia: e.target.value.toUpperCase() }))}
                  placeholder="Ex: FIL-OLE-01"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>

              {permissions.canViewPrecos && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Preço (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingPeca.preco !== undefined ? editingPeca.preco : (editingPeca.precoVenda || 0)}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setEditingPeca(prev => ({ ...prev, preco: val, precoVenda: val }));
                    }}
                    className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Designação da Peça *</label>
              <input
                type="text"
                value={editingPeca.designacao || ''}
                onChange={e => setEditingPeca(prev => ({ ...prev, designacao: e.target.value }))}
                placeholder="Ex: Filtro de Óleo Heavy Duty MANN HU947"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Row: Marca, Modelo, Fornecedor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Marca</label>
                <input
                  type="text"
                  value={editingPeca.marca || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, marca: e.target.value }))}
                  placeholder="Ex: MANN, Castrol, Brembo"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Modelo / Aplicação</label>
                <input
                  type="text"
                  value={editingPeca.modelo || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, modelo: e.target.value }))}
                  placeholder="Ex: Actros 1845 / FH500"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Fornecedor</label>
                <input
                  type="text"
                  value={editingPeca.fornecedor || ''}
                  onChange={e => setEditingPeca(prev => ({ ...prev, fornecedor: e.target.value }))}
                  placeholder="Ex: Auto Peças Portugal"
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            {/* Stock Levels & Warehouse */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Atual (Unidades)</label>
                <input
                  type="number"
                  value={editingPeca.stockAtual || 0}
                  onChange={e => setEditingPeca(prev => ({ ...prev, stockAtual: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Mínimo (Alerta)</label>
                <input
                  type="number"
                  value={editingPeca.stockMinimo || 2}
                  onChange={e => setEditingPeca(prev => ({ ...prev, stockMinimo: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Taxa IVA %</label>
                <select
                  value={editingPeca.taxaIva || 23}
                  onChange={e => setEditingPeca(prev => ({ ...prev, taxaIva: Number(e.target.value) }))}
                  className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                >
                  <option value="23">23%</option>
                  <option value="13">13%</option>
                  <option value="6">6%</option>
                  <option value="0">0%</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Localização no Armazém</label>
              <input
                type="text"
                value={editingPeca.localizacaoArmazem || ''}
                onChange={e => setEditingPeca(prev => ({ ...prev, localizacaoArmazem: e.target.value }))}
                placeholder="Ex: Prateleira B-04 / Depósito Óleos"
                className="w-full py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {editingPeca.id && (
                <button
                  type="button"
                  onClick={() => handleDelete(editingPeca.id!)}
                  className="py-2 px-3 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              )}

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="glass-btn py-2 px-5 rounded-xl text-xs font-bold text-white shadow-lg shadow-hp-600/30 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Guardar Peça
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
