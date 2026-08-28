import React, { useState } from 'react';
import {
  Wrench,
  Search,
  CheckCircle2,
  Clock,
  Car,
  Building2,
  ArrowRight,
  MoveRight,
  FileDown,
  Sparkles
} from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { Badge } from '../components/Badge';
import { db, STORAGE_KEYS } from '../services/dbService';
import { generateFolhaServicoPDF } from '../services/pdfService';
import type {
  FolhaServico,
  Empresa,
  Equipamento,
  StatusFolhaServico
} from '../types';

interface KanbanProps {
  folhas: FolhaServico[];
  empresas: Empresa[];
  equipamentos: Equipamento[];
  onSelectFolha: (fs: FolhaServico) => void;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  statuses: StatusFolhaServico[];
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'at',
    title: 'ASSISTÊNCIA TÉCNICA',
    color: 'from-blue-600/30 to-blue-900/20 border-blue-500/40 text-blue-300',
    statuses: [
      'AT - Pedido de Assistência',
      'AT - Agendar – Sem requisição',
      'AT - Agendar – Com requisição',
      'AT - Agendado',
      'AT - Aguardar requisição',
      'AT - Com requisição - Aguardar peças'
    ]
  },
  {
    id: 'of',
    title: 'OFICINA / EM REPARAÇÃO',
    color: 'from-amber-600/30 to-amber-900/20 border-amber-500/40 text-amber-300',
    statuses: [
      'OF - Fazer orçamento',
      'OF - Orçamento Enviado – Aguardar resposta',
      'OF - Com requisição - Aguardar agenda',
      'OF - Com requisição - Aguardar viatura',
      'OF - Com requisição - Aguardar peças'
    ]
  },
  {
    id: 'ct',
    title: 'CONTRATOS & PREVENTIVA',
    color: 'from-teal-600/30 to-teal-900/20 border-teal-500/40 text-teal-300',
    statuses: ['CT - Contrato']
  },
  {
    id: 'finalizado',
    title: 'FINALIZADO & FATURAÇÃO',
    color: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/40 text-emerald-300',
    statuses: [
      'FEITO - Faturar',
      'FEITO - Aguardar Requisição',
      'FEITO - Submeter Garantia',
      'FEITO - Aguardar Garantia',
      'FEITO - Faturado'
    ]
  }
];

export const Kanban: React.FC<KanbanProps> = ({
  folhas,
  empresas,
  equipamentos,
  onSelectFolha
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedFolhaId, setDraggedFolhaId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedFolhaId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedFolhaId;
    if (!id) return;

    // Pick first status in the destination column as default
    const newStatus = column.statuses[0];
    const newTipo = newStatus.startsWith('AT -')
      ? 'Assistência Técnica'
      : newStatus.startsWith('OF -')
      ? 'Oficina'
      : newStatus.startsWith('CT -')
      ? 'Contrato'
      : undefined;

    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, id, {
      status: newStatus,
      ...(newTipo ? { tipo: newTipo } : {})
    });
    setDraggedFolhaId(null);
  };

  const handleChangeStatusDirect = (folhaId: string, newStatus: StatusFolhaServico, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTipo = newStatus.startsWith('AT -')
      ? 'Assistência Técnica'
      : newStatus.startsWith('OF -')
      ? 'Oficina'
      : newStatus.startsWith('CT -')
      ? 'Contrato'
      : undefined;

    db.update<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO, folhaId, {
      status: newStatus,
      ...(newTipo ? { tipo: newTipo } : {})
    });
  };

  return (
    <div className="space-y-3 flex flex-col h-[calc(100vh-105px)]">
      {/* Top Bar / Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por matrícula, empresa, FS..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-1.5 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-hp-500"
          />
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Arraste os cartões entre colunas para atualizar o estado</span>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 overflow-x-auto items-start pb-4">
        {KANBAN_COLUMNS.map(col => {
          const matchingFolhas = folhas.filter(f => {
            const matchesCol = col.statuses.includes(f.status);
            const matchesSearch =
              f.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
              f.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
              f.marca.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCol && matchesSearch;
          });

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col)}
              className="flex flex-col max-h-full rounded-2xl bg-slate-950/50 border border-slate-800/80 p-3 min-w-[280px]"
            >
              {/* Column Header */}
              <div className={`flex items-center justify-between p-2.5 mb-3 rounded-xl bg-gradient-to-r ${col.color} border font-bold text-xs`}>
                <span className="tracking-wide">{col.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-950/80 font-mono text-[11px]">
                  {matchingFolhas.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {matchingFolhas.length === 0 ? (
                  <div className="p-6 text-center text-slate-600 text-xs italic border-2 border-dashed border-slate-800/60 rounded-xl">
                    Sem tarefas nesta etapa
                  </div>
                ) : (
                  matchingFolhas.map(fs => {
                    const empresa = empresas.find(e => e.id === fs.empresaId);
                    const servicesDone = fs.servicos.filter(s => s.concluido).length;
                    const partsDone = fs.pecas.filter(p => p.concluido).length;

                    return (
                      <div
                        key={fs.id}
                        draggable
                        onDragStart={e => handleDragStart(e, fs.id)}
                        onClick={() => onSelectFolha(fs)}
                        className="glass-card p-3.5 rounded-xl border border-slate-800 hover:border-hp-500/50 cursor-grab active:cursor-grabbing space-y-2.5 transition-all shadow-md"
                      >
                        {/* Top: FS Number & Company */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-hp-400">{fs.numero}</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                            {empresa?.nome || 'Cliente Geral'}
                          </span>
                        </div>

                        {/* Middle: Plate & Vehicle */}
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-extrabold px-2 py-0.5 bg-slate-950 rounded border border-slate-800 text-slate-100 text-xs tracking-wider">
                            {fs.matricula}
                          </span>
                          <span className="text-[11px] text-slate-300 font-medium truncate max-w-[130px]">
                            {fs.marca} {fs.modelo}
                          </span>
                        </div>

                        {/* Anomalies Preview */}
                        {fs.anomalias && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/40">
                            {fs.anomalias}
                          </p>
                        )}

                        {/* Services & Parts Progress */}
                        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Serviços: <b className="text-slate-200">{servicesDone}/{fs.servicos.length}</b></span>
                          <span>Peças: <b className="text-slate-200">{partsDone}/{fs.pecas.length}</b></span>
                        </div>

                        {/* Status Select Shortcut */}
                        <div className="pt-1" onClick={e => e.stopPropagation()}>
                          <select
                            value={fs.status}
                            onChange={e => handleChangeStatusDirect(fs.id, e.target.value as StatusFolhaServico, e as any)}
                            className="w-full text-[10px] py-1 px-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono focus:outline-none focus:border-hp-500 truncate"
                          >
                            {col.statuses.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
