import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FolhaServico, Proposta, GuiaEnvio, Empresa, Equipamento, ConfiguracaoOficina } from '../types';
import { db, STORAGE_KEYS } from './dbService';
import { GRAU_LOGO_BASE64 } from './grauLogoBase64';
import { formatDate, getTodayFormatted, cleanPersonName, calculateDiffDays } from '../utils/dateUtils';

export function generateFolhaServicoPDF(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
) {
  // Se for folha de Entrega e Formação, gerar o documento oficial especializado
  if (folha.tipo === 'Entrega e Formação') {
    if (!equipamento && folha.equipamentoId) {
      equipamento = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS)?.find(e => e.id === folha.equipamentoId);
    }
    if (!empresa) {
      const targetEmpresaId = folha.empresaId || (equipamento ? equipamento.empresaId : undefined);
      if (targetEmpresaId) {
        empresa = db.get<Empresa>(STORAGE_KEYS.EMPRESAS)?.find(e => e.id === targetEmpresaId);
      }
    }
    const docEF = generateEntregaFormacaoPDF(folha, empresa, equipamento);
    const cleanMatricula = (folha.matricula || 'Equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanNumero = (folha.numero || folha.id || 'FS').replace(/[^a-zA-Z0-9_-]/g, '_');
    docEF.save(`Auto_Entrega_Formacao_${cleanMatricula}_${cleanNumero}.pdf`);
    return;
  }

  const doc = new jsPDF({ compress: true });
  const totalPagesExp = '{total_pages_count_string}';

  // 1. TOP HEADER ACCENT BARS
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 6, 'F');
  doc.setFillColor(13, 148, 136); // Teal GRAUMP accent
  doc.rect(145, 0, 65, 6, 'F');

  // 2. GRAUMP LOGO
  try {
    // 3:2 ratio for grau_logo.png (width: 32mm, height: 21mm)
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 11, 32, 21, undefined, 'FAST');
  } catch (err) {
    // Fallback if image fails
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 24);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Maquinaria Portugal', 14, 30);
  }

  // 3. DOCUMENT TITLE & REFERENCE (Right Aligned Header)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  
  let docTitle = 'GUIA DE TRABALHO';
  if (folha.tipo === 'Validação e Preparação') docTitle = 'VALIDAÇÃO E PREPARAÇÃO';
  else if (folha.tipo === 'Oficina') docTitle = 'FOLHA DE OFICINA';
  else if (folha.tipo === 'Garantia') docTitle = 'FOLHA DE GARANTIA';
  else if (folha.tipo === 'Contrato') docTitle = 'MANUTENÇÃO CONTRATO';
  else if (folha.tipo === 'Assistência Técnica') docTitle = 'GUIA DE TRABALHO';

  doc.text(docTitle, 196, 20, { align: 'right' });

  // Reference and Date info
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('REFERÊNCIA:', 160, 27, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(folha.numero || folha.id, 196, 27, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA:', 160, 32, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(folha.data) || getTodayFormatted(), 196, 32, { align: 'right' });

  if (folha.guiaAT) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('GUIA:', 160, 37, { align: 'right' });
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(folha.guiaAT, 196, 37, { align: 'right' });
  }

  // 4. CLIENT & EQUIPMENT BOXES (Cards)
  const cardStartY = 42;
  const cBg = [248, 250, 252]; // Slate 50
  const cBorder = [226, 232, 240]; // Slate 200
  const lblC = [100, 116, 139]; // Slate 500
  const txtC = [30, 41, 59]; // Slate 800

  // --- CARD 1: CLIENTE ---
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(14, cardStartY, 88, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('CLIENTE / ENTIDADE', 20, cardStartY + 7);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(txtC[0], txtC[1], txtC[2]);
  const clienteNome = empresa?.nome || 'Cliente Particular / Não Especificado';
  const cLines = doc.splitTextToSize(clienteNome, 76);
  doc.text(cLines, 20, cardStartY + 14);

  const cShift = (cLines.length - 1) * 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const morada = empresa?.moradaSede || folha.localizacao || 'Morada não disponível';
  const moradaLines = doc.splitTextToSize(morada, 76);
  doc.text(moradaLines.slice(0, 2), 20, cardStartY + 20 + cShift);

  if (folha.pessoaPresente) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(lblC[0], lblC[1], lblC[2]);
    doc.text(`Presente: `, 20, cardStartY + 33);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(txtC[0], txtC[1], txtC[2]);
    doc.text(folha.pessoaPresente, 34, cardStartY + 33);
  }

  // --- CARD 2: EQUIPAMENTO ---
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(108, cardStartY, 88, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('EQUIPAMENTO / VIATURA', 114, cardStartY + 7);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(txtC[0], txtC[1], txtC[2]);
  const equipNome = `${folha.marca || equipamento?.marca || ''} ${folha.modelo || equipamento?.modelo || ''}`.trim() || 'Equipamento Geral';
  doc.text(equipNome, 114, cardStartY + 14);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Matrícula: ${folha.matricula || equipamento?.matricula || '---'}`, 114, cardStartY + 20);

  const nSerie = folha.nSerie || equipamento?.nSerie || '';
  if (nSerie && nSerie !== 'undefined') {
    doc.text(`Nº Série: ${nSerie}`, 114, cardStartY + 25);
  }

  // Badges Kms & Horas
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.roundedRect(114, cardStartY + 28, 38, 7, 1.5, 1.5, 'FD');
  doc.roundedRect(156, cardStartY + 28, 38, 7, 1.5, 1.5, 'FD');

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('KMS:', 116, cardStartY + 33);
  doc.text('HORAS:', 158, cardStartY + 33);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(txtC[0], txtC[1], txtC[2]);
  doc.text(String(folha.kmsAtuais || 0), 126, cardStartY + 33);
  doc.text(String(folha.horasAtuais ? `${folha.horasAtuais}h` : '0h'), 171, cardStartY + 33);

  let currentY = cardStartY + 44;

  // 5. ANOMALIAS / OBSERVAÇÕES TÉCNICAS
  const anomaliaTexto = (folha.anomalias || '').trim();
  if (anomaliaTexto && folha.tipo !== 'Validação e Preparação') {
    autoTable(doc, {
      startY: currentY,
      head: [['ANOMALIAS REPORTADAS / OBSERVAÇÕES TÉCNICAS']],
      body: [[anomaliaTexto]],
      theme: 'grid',
      headStyles: {
        fillColor: [13, 148, 136], // Teal GRAUMP
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 5.1 CONTROLO DE VALIDAÇÃO & PREPARAÇÃO (Se aplicável)
  if (folha.tipo === 'Validação e Preparação') {
    const valText = folha.validacaoFeita
      ? `[X] Realizada em ${folha.validacaoData || '---'} por: ${folha.validacaoPor || 'HP'}`
      : `[ ] Pendente`;
    const prepText = folha.preparacaoFeita
      ? `[X] Realizada em ${folha.preparacaoData || '---'} por: ${folha.preparacaoPor || 'HP'}`
      : `[ ] Pendente`;

    autoTable(doc, {
      startY: currentY,
      head: [['ETAPA DE CONTROLO', 'ESTADO / REGISTO']],
      body: [
        ['VALIDAÇÃO', valText],
        ['PREPARAÇÃO', prepText]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // Emerald
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 132 }
      },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 6. SERVIÇOS EFETUADOS (Mão-de-Obra)
  const allServices = [
    ...(folha.servicos || []).map(s => ({ ...s, isAdicional: false })),
    ...(folha.servicosAdicionais || []).map(s => ({ ...s, isAdicional: true }))
  ];

  if (allServices.length > 0) {
    const serviceRows = allServices.map((s) => [
      `[${s.concluido !== false ? 'x' : ' '}]  ${s.isAdicional ? '[ADICIONAL] ' : ''}${s.descricao || ''}`,
      s.horas ? `${s.horas}h` : ''
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['SERVIÇOS REALIZADOS', 'TEMPO']],
      body: serviceRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Dark Slate
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      columnStyles: {
        0: { cellWidth: 160 },
        1: { cellWidth: 22, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 7. PEÇAS E MATERIAIS
  const allParts = [
    ...(folha.pecas || []).map(p => ({ ...p, isAdicional: false })),
    ...(folha.pecasAdicionais || []).map(p => ({ ...p, isAdicional: true }))
  ];

  if (allParts.length > 0) {
    const pecasRows = allParts.map((p) => {
      const refPart = p.referencia ? `[${p.referencia}] ` : '';
      return [
        `[${p.concluido !== false ? 'x' : ' '}]  ${p.qtd || 1} | ${refPart}${p.designacao || ''}`
      ];
    });

    autoTable(doc, {
      startY: currentY,
      head: [['PEÇAS E MATERIAIS APLICADOS']],
      body: pecasRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229], // Indigo professional
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 8. NOTAS PARA O CLIENTE (se existirem)
  if (folha.notasCliente && folha.notasCliente.trim()) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    autoTable(doc, {
      startY: currentY,
      head: [['NOTAS / OBSERVAÇÕES PARA O CLIENTE']],
      body: [[folha.notasCliente.trim()]],
      theme: 'grid',
      headStyles: {
        fillColor: [71, 85, 105], // Slate 600
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8.5
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 9. PRÓXIMA REVISÃO & TÉCNICO
  if (currentY > 235) {
    doc.addPage();
    currentY = 20;
  }

  // Check tech initials
  const initialsSet = new Set<string>();
  allServices.forEach(s => {
    if (s.tecnico) {
      const parts = s.tecnico.trim().split(/\s+/);
      const init = parts.map(p => p[0]?.toUpperCase()).join('');
      if (init) initialsSet.add(init);
    }
  });
  const techInitials = initialsSet.size > 0 ? Array.from(initialsSet).join(', ') : 'HP';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(13, 148, 136); // Teal
  if (folha.tipo !== 'Validação e Preparação' && (folha.previsaoRevisaoKms > 0 || folha.previsaoRevisaoHoras > 0)) {
    const revStr = `Próxima Revisão: ${folha.previsaoRevisaoKms > 0 ? `${folha.previsaoRevisaoKms.toLocaleString()} Kms` : ''} ${folha.previsaoRevisaoHoras > 0 ? `| ${folha.previsaoRevisaoHoras} Horas` : ''}`;
    doc.text(revStr.trim(), 14, currentY);
    currentY += 5;
  }

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Serviço realizado por: ${techInitials}`, 14, currentY);
  currentY += 12;

  // 10. ASSINATURAS
  if (currentY > 245) {
    doc.addPage();
    currentY = 20;
  }

  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.line(14, currentY + 12, 90, currentY + 12);
  doc.line(120, currentY + 12, 196, currentY + 12);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('O Responsável Técnico (GRAUMP)', 14, currentY + 17);
  doc.text('O Cliente / Responsável do Equipamento', 120, currentY + 17);

  // 11. MULTI-PAGE PROFESSIONAL FOOTER (GRAUMP + Oficina HP Gestão & Frotas)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer Base Bar
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 287, 210, 10, 'F');

    // Accent triangle & line (GRAUMP Teal)
    doc.setFillColor(13, 148, 136);
    try {
      doc.triangle(0, 297, 45, 297, 0, 278, 'F');
    } catch (e) {}
    doc.rect(0, 290, 32, 7, 'F');

    // Footer Text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, 293.5);

    doc.setTextColor(148, 163, 184);
    doc.text('Documento Processado por Computador', 110, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 196, 293.5, { align: 'right' });
  }

  // Save / Trigger Download
  doc.save(`${folha.numero || folha.id}_Folha_Servico_${folha.matricula || 'viatura'}.pdf`);
}

export function generatePropostaPDF(
  proposta: Proposta,
  empresa?: Empresa
) {
  const config = db.getConfig();
  const doc = new jsPDF();

  // 1. TOP HEADER ACCENT BARS
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 6, 'F');
  doc.setFillColor(14, 140, 233); // Blue accent
  doc.rect(145, 0, 65, 6, 'F');

  // 2. GRAUMP LOGO
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 11, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 24);
  }

  // 3. TITLE & REFERENCE
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('ORÇAMENTO / PROPOSTA', 196, 20, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PROPOSTA Nº:', 160, 27, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.text(proposta.numero, 196, 27, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA:', 160, 32, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(proposta.data) || getTodayFormatted(), 196, 32, { align: 'right' });

  // 4. CLIENT & PROPOSAL CARDS
  const cardStartY = 40;
  const cBg = [248, 250, 252];
  const cBorder = [226, 232, 240];
  const lblC = [100, 116, 139];
  const txtC = [30, 41, 59];

  // Card Left: Customer
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(14, cardStartY, 88, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('EXMO.(S) SENHOR(ES):', 20, cardStartY + 7);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(txtC[0], txtC[1], txtC[2]);
  const clienteNome = proposta.nomeEmpresa || empresa?.nome || 'Exmo. Cliente';
  const cLines = doc.splitTextToSize(clienteNome, 76);
  doc.text(cLines, 20, cardStartY + 14);

  const cShift = (cLines.length - 1) * 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`NIF: ${empresa?.nif || 'Consumidor Final'}`, 20, cardStartY + 20 + cShift);
  doc.text(`Contacto / A/C: ${proposta.nomeCliente || 'Direção Comercial / Técnica'}`, 20, cardStartY + 25 + cShift);

  // Card Right: Details
  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(108, cardStartY, 88, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('DETALHES DO ORÇAMENTO', 114, cardStartY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(txtC[0], txtC[1], txtC[2]);
  doc.text(`Viatura / Equipamento:`, 114, cardStartY + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${proposta.matricula || 'Geral'} - ${proposta.marcaModelo || ''}`, 114, cardStartY + 19);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(lblC[0], lblC[1], lblC[2]);
  doc.text('Válido até:', 114, cardStartY + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(14, 140, 233);
  doc.text(proposta.dataValidade || '30 dias', 134, cardStartY + 26);

  let currentY = cardStartY + 44;

  // Subject Description
  if (proposta.descricao) {
    autoTable(doc, {
      startY: currentY,
      head: [['DESCRIÇÃO DOS TRABALHOS / SERVIÇOS']],
      body: [[proposta.descricao]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Line items
  const tableRows = proposta.linhas.map((l, idx) => [
    (idx + 1).toString(),
    l.codigo,
    l.descricao,
    l.quantidade.toString(),
    `${l.precoUnitario.toFixed(2)} €`,
    `${l.desconto}%`,
    `${l.taxaIva}%`,
    `${l.subtotal.toFixed(2)} €`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['#', 'Ref.', 'Descrição do Item / Mão-de-Obra', 'Qtd', 'Pr. Unit.', 'Desc.', 'IVA', 'Total Líq.']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [226, 232, 240] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 75 },
      3: { cellWidth: 12 },
      4: { cellWidth: 20 },
      5: { cellWidth: 15 },
      6: { cellWidth: 14 },
      7: { cellWidth: 24, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Financial summary box (Right aligned)
  if (currentY > 215) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(120, currentY, 76, 32, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Total S/ IVA:', 125, currentY + 8);
  doc.text(`${proposta.totalSemIva.toFixed(2)} €`, 190, currentY + 8, { align: 'right' });

  doc.text('Total IVA:', 125, currentY + 16);
  doc.text(`${proposta.totalIva.toFixed(2)} €`, 190, currentY + 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL C/ IVA:', 125, currentY + 26);
  doc.text(`${proposta.totalComIva.toFixed(2)} €`, 190, currentY + 26, { align: 'right' });

  // Terms & Conditions (Left of summary)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('CONDIÇÕES COMERCIAIS:', 14, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`• Pagamento: ${proposta.condicoesPagamento || 'Pronto Pagamento'}`, 14, currentY + 14);
  doc.text(`• Prazo de Entrega: ${proposta.prazoEntrega || 'A combinar'}`, 14, currentY + 19);
  doc.text(`• Garantia: ${proposta.garantia || 'Garantia legal de peças e mão-de-obra'}`, 14, currentY + 24);

  // Approval Box
  currentY += 40;
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }
  doc.setDrawColor(203, 213, 225);
  doc.rect(14, currentY, 182, 20);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Aceitação e Adjudicação da Proposta (Carimbo / Assinatura do Cliente):', 18, currentY + 6);
  doc.text('Data: _____ / _____ / 2026', 18, currentY + 14);

  // Multi-page professional footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setFillColor(13, 148, 136);
    try { doc.triangle(0, 297, 45, 297, 0, 278, 'F'); } catch (e) {}
    doc.rect(0, 290, 32, 7, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, 293.5);

    doc.setTextColor(148, 163, 184);
    doc.text(`Validade: ${proposta.dataValidade || '30 dias'} • Documento Processado por Computador`, 110, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 196, 293.5, { align: 'right' });
  }

  doc.save(`${proposta.numero}_Proposta_${proposta.nomeEmpresa.replace(/\s+/g, '_')}.pdf`);
}

export function generateGuiaEnvioPDF(guia: GuiaEnvio) {
  const config = db.getConfig();
  const doc = new jsPDF();

  // 1. TOP HEADER ACCENT BARS
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 6, 'F');
  doc.setFillColor(13, 148, 136);
  doc.rect(145, 0, 65, 6, 'F');

  // 2. GRAUMP LOGO
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 11, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 24);
  }

  // 3. TITLE & REFERENCE
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('GUIA DE TRANSPORTE / ENVIO', 196, 20, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('GUIA Nº:', 160, 27, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.text(guia.numero, 196, 27, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA:', 160, 32, { align: 'right' });
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(guia.data) || getTodayFormatted(), 196, 32, { align: 'right' });

  // 4. METADATA BOXES
  const cardStartY = 40;
  const cBg = [248, 250, 252];
  const cBorder = [226, 232, 240];

  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(14, cardStartY, 88, 32, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ORIGEM / EXPEDIÇÃO:', 20, cardStartY + 7);
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(guia.empresaOrigem || 'GRAUMP - Albergaria-a-Velha', 20, cardStartY + 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(config.morada, 20, cardStartY + 20);

  doc.setDrawColor(cBorder[0], cBorder[1], cBorder[2]);
  doc.setFillColor(cBg[0], cBg[1], cBg[2]);
  doc.roundedRect(108, cardStartY, 88, 32, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('DESTINATÁRIO / ESTALEIRO:', 114, cardStartY + 7);
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(guia.empresaDestino, 114, cardStartY + 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(guia.moradaDestino || 'Estaleiro / Sede', 114, cardStartY + 20);
  doc.text(`Viatura: ${guia.matriculaViaturaTransporte || 'Própria'} | Motorista: ${guia.motorista || 'N/A'}`, 114, cardStartY + 26);

  // Material rows
  const matRows = guia.materiais.map((m, idx) => [
    (idx + 1).toString(),
    m.referencia || '-',
    m.descricao,
    m.quantidade.toString(),
    m.unidade || 'Un'
  ]);

  autoTable(doc, {
    startY: 78,
    head: [['#', 'Referência', 'Descrição do Material / Equipamento', 'Quantidade', 'Unidade']],
    body: matRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 25;

  doc.setDrawColor(203, 213, 225);
  doc.line(14, finalY, 90, finalY);
  doc.line(120, finalY, 196, finalY);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Assinatura do Expedidor (GRAUMP)', 14, finalY + 6);
  doc.text('Assinatura / Receção do Destinatário', 120, finalY + 6);

  // Multi-page professional footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 287, 210, 10, 'F');
    doc.setFillColor(13, 148, 136);
    try { doc.triangle(0, 297, 45, 297, 0, 278, 'F'); } catch (e) {}
    doc.rect(0, 290, 32, 7, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, 293.5);

    doc.setTextColor(148, 163, 184);
    doc.text('Documento Processado por Computador', 110, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 196, 293.5, { align: 'right' });
  }

  doc.save(`${guia.numero}_Guia_Envio.pdf`);
}

/**
 * Generates the official PDF layout for Entrega e Formação
 * Replicates the visual certificate design with branding, delivery/training cards,
 * equipment specs, observations, registration line, dual signature blocks,
 * and photo gallery on subsequent pages if photos are attached.
 */
export function generateEntregaFormacaoPDF(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
): jsPDF {
  // If not passed, fetch latest from DB
  if (!equipamento && folha.equipamentoId) {
    equipamento = db.get<Equipamento>(STORAGE_KEYS.EQUIPAMENTOS)?.find(e => e.id === folha.equipamentoId);
  }
  if (!empresa) {
    const targetEmpresaId = folha.empresaId || (equipamento ? equipamento.empresaId : undefined);
    if (targetEmpresaId) {
      empresa = db.get<Empresa>(STORAGE_KEYS.EMPRESAS)?.find(e => e.id === targetEmpresaId);
    }
  }

  const doc = new jsPDF({ compress: true });

  const runAutoTable = (options: any) => {
    const fn = (autoTable as any)?.default?.default || (autoTable as any)?.default || autoTable;
    if (typeof fn === 'function') {
      fn(doc, options);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(options);
    }
  };

  // 1. FULL-BLEED HERO HEADER BANNER (Navy #0b1528)
  doc.setFillColor(11, 21, 40); // Dark Navy Slate
  doc.rect(0, 0, 210, 36, 'F');

  // Emerald bottom border (matching Image 1)
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 35, 210, 1.2, 'F');

  // Subhead row: Left cyan text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // #38bdf8
  doc.text('OFICINA HP • GESTÃO OPERACIONAL DE FROTAS', 18, 13);

  // Subhead row: Right emerald pill badge
  doc.setFillColor(16, 185, 129); // #10b981
  doc.roundedRect(132, 8, 60, 6.5, 3.2, 3.2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ENTREGA & FORMAÇÃO CONCLUÍDA', 162, 12.4, { align: 'center' });

  // Main vehicle title
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const equipHeaderTitle = `${folha.matricula || 'SEM MATRÍCULA'} • ${folha.marca || ''} ${folha.modelo || ''}`.trim();
  doc.text(equipHeaderTitle, 18, 23.5);

  // Subtitle line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Folha de Serviço: ', 18, 30.5);
  const fsLabelW = doc.getTextWidth('Folha de Serviço: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // Sky 400
  const fsNum = folha.numero || folha.id || '---';
  doc.text(fsNum, 18 + fsLabelW, 30.5);
  const fsNumW = doc.getTextWidth(fsNum);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const regDateStr = ` • Registada a ${formatDate(folha.data) || getTodayFormatted()}`;
  doc.text(regDateStr, 18 + fsLabelW + fsNumW, 30.5);

  // 2. FULL-BLEED GREEN CONFIRMATION BANNER (matching Image 1)
  doc.setFillColor(236, 253, 245); // #ecfdf5
  doc.rect(0, 36.2, 210, 10, 'F');
  doc.setFillColor(16, 185, 129); // Green left accent
  doc.rect(0, 36.2, 3.5, 10, 'F');

  // Vector checkmark inside green circle
  doc.setFillColor(16, 185, 129);
  doc.circle(21, 41.2, 2.2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(19.9, 41.2, 20.7, 42.1);
  doc.line(20.7, 42.1, 22.1, 40.4);

  // Banner text
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70); // #065f46
  doc.text('A Ficha Técnica do Equipamento foi atualizada automaticamente no sistema com as novas datas de Entrega e Formação.', 25.5, 42.3);

  let curY = 52;

  // 3. DUAL CARDS: ENTREGA & FORMAÇÃO (Matching Image 1)
  const cardW = 84;
  const cardH = 30;

  // --- CARD 1: DADOS DE ENTREGA ---
  doc.setFillColor(240, 253, 244); // #f0fdf4
  doc.setDrawColor(134, 239, 172); // #86efac
  doc.setLineWidth(0.4);
  doc.roundedRect(18, curY, cardW, cardH, 2.5, 2.5, 'FD');

  // Title with icon
  doc.setFillColor(22, 101, 52);
  doc.roundedRect(22, curY + 4, 4, 3.5, 0.4, 0.4, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // #166534
  doc.text('DADOS DE ENTREGA', 28, curY + 7);

  // Data de Entrega
  const rawEntregaDate = folha.dataEntrega || equipamento?.dataEntrega;
  const entregaDateStr = rawEntregaDate ? formatDate(rawEntregaDate) : 'Não especificada';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Data de Entrega:', 22, curY + 16);
  doc.setFontSize(9.5);
  doc.setTextColor(22, 101, 52);
  doc.text(entregaDateStr, 54, curY + 16);

  // Entregue por (Clean name without cargo!)
  const entregaNome = cleanPersonName(folha.entregaPor || equipamento?.entregaPor) || 'Hugo Portugal';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Entregue por:', 22, curY + 24);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(entregaNome, 54, curY + 24);

  // --- CARD 2: DADOS DE FORMAÇÃO ---
  const card2X = 108;
  doc.setFillColor(240, 249, 255); // #f0f9ff
  doc.setDrawColor(125, 211, 252); // #7dd3fc
  doc.setLineWidth(0.4);
  doc.roundedRect(card2X, curY, cardW, cardH, 2.5, 2.5, 'FD');

  // Title with icon
  doc.setFillColor(3, 105, 161);
  doc.roundedRect(card2X + 4, curY + 4, 4, 3.5, 0.4, 0.4, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // #0369a1
  doc.text('DADOS DE FORMAÇÃO', card2X + 10, curY + 7);

  // Data de Formação
  const rawFormacaoDate = folha.dataFormacao || equipamento?.dataFormacao;
  const formacaoDateStr = rawFormacaoDate ? formatDate(rawFormacaoDate) : 'Não especificada';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Data de Formação:', card2X + 4, curY + 16);
  doc.setFontSize(9.5);
  doc.setTextColor(2, 132, 199);
  doc.text(formacaoDateStr, card2X + 40, curY + 16);

  // Formador (Clean name without cargo!)
  const formadorNome = cleanPersonName(folha.formacaoPor || equipamento?.formacaoPor) || 'Hugo Portugal';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Formador:', card2X + 4, curY + 24);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formadorNome, card2X + 40, curY + 24);

  curY += cardH + 7;

  // 4. SECTION: FICHA DO EQUIPAMENTO / VIATURA (Matching Image 1)
  const clienteNome = empresa?.nome || (folha as any).empresaNome || (folha as any).cliente || 'Cliente Geral';
  const nSerie = folha.nSerie || equipamento?.nSerie || 'N/A';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('FICHA DO EQUIPAMENTO / VIATURA', 18, curY + 4);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(18, curY + 6.5, 192, curY + 6.5);
  curY += 8;

  const equipRows: (string[])[] = [
    ['Matrícula:', folha.matricula || '---'],
    ['Marca / Modelo:', `${folha.marca || ''} ${folha.modelo || ''}`.trim() || '---'],
    ['Nº de Série / Chassi (VIN):', nSerie],
    ['Empresa / Cliente:', clienteNome]
  ];

  if (folha.pessoaPresente) {
    equipRows.push(['Pessoa Presente:', folha.pessoaPresente]);
  }
  if (folha.localizacao) {
    equipRows.push(['Local da Intervenção:', folha.localizacao]);
  }

  runAutoTable({
    startY: curY,
    body: equipRows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [241, 245, 249],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', textColor: [100, 116, 139] },
      1: { cellWidth: 119, fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 18, right: 18 }
  });

  curY = (doc as any).lastAutoTable.finalY + 6;

  // 5. SECTION: OBSERVAÇÕES TÉCNICAS REGISTADAS (Matching Image 1)
  const obsLines: string[] = [];
  if (folha.anomalias) obsLines.push(`Trabalhos / Descrição: ${folha.anomalias}`);
  if (folha.notasCliente) obsLines.push(`Notas Cliente: ${folha.notasCliente}`);
  if (folha.notasInternas) obsLines.push(`Notas Internas: ${folha.notasInternas}`);

  if (obsLines.length > 0) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVAÇÕES TÉCNICAS REGISTADAS', 18, curY + 4);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(18, curY + 6.5, 192, curY + 6.5);
    curY += 8;

    const obsText = obsLines.join('\n\n');
    const obsSplit = doc.splitTextToSize(obsText, 166);
    const obsBoxH = Math.max(12, obsSplit.length * 4.2 + 8);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(18, curY, 174, obsBoxH, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(obsSplit, 22, curY + 6.5);

    curY += obsBoxH + 6;
  }

  // 6. DOTTED LINE & REGISTO EFETUADO POR (Matching Image 1)
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(18, curY, 192, curY);
  doc.setLineDashPattern([], 0);
  curY += 5;

  const registadoPorLimpo = cleanPersonName(folha.formacaoPor || folha.entregaPor || folha.criadoPor || 'Hugo Portugal');
  const dataRegisto = formatDate(folha.data) || getTodayFormatted();
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Registo efetuado por: ', 18, curY);
  const regLblW = doc.getTextWidth('Registo efetuado por: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${registadoPorLimpo}`, 18 + regLblW, curY);
  const regNameW = doc.getTextWidth(registadoPorLimpo);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(` • ${dataRegisto}`, 18 + regLblW + regNameW, curY);

  // 7. PHOTO GALLERY (ONLY IF PHOTOS EXIST ON PAGE 2)
  const rawFotos = folha.fotos || [];
  if (Array.isArray(rawFotos) && rawFotos.length > 0) {
    doc.addPage();

    // Page 2 header
    doc.setFillColor(11, 21, 40);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 23.5, 210, 0.8, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('REGISTO FOTOGRÁFICO DA ENTREGA E FORMAÇÃO', 18, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`${folha.matricula || ''} • FS ${folha.numero || ''} • (${rawFotos.length} fotografia${rawFotos.length > 1 ? 's' : ''})`, 192, 15, { align: 'right' });

    let photoStartY = 32;
    const colW = 84;
    const colH = 62;
    const gapX = 6;
    const gapY = 8;

    rawFotos.forEach((foto, idx) => {
      const indexInPage = idx % 6;
      if (idx > 0 && indexInPage === 0) {
        doc.addPage();
        photoStartY = 16;
      }
      const col = indexInPage % 2;
      const row = Math.floor(indexInPage / 2);
      const px = 18 + col * (colW + gapX);
      const py = photoStartY + row * (colH + gapY);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(px, py, colW, colH, 2, 2, 'FD');

      try {
        const format = (foto && foto.startsWith('data:image/png')) ? 'PNG' : 'JPEG';
        doc.addImage(foto, format, px + 2, py + 2, colW - 4, colH - 11, undefined, 'FAST');
      } catch (errImg) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`[Fotografia ${idx + 1}]`, px + colW / 2, py + (colH / 2) - 3, { align: 'center' });
      }

      doc.setFillColor(241, 245, 249);
      doc.rect(px + 2, py + colH - 8, colW - 4, 6, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text(`Fotografia ${idx + 1}`, px + 6, py + colH - 3.8);
    });
  }

  return doc;
}

export type TemposRespostaScope = 'OFICINA' | 'ASSISTENCIA_CONTRATOS' | 'TODOS';

/**
 * Generates official A3 Landscape PDF table for Tempos de Resposta & Imobilização
 * Strictly without averages banner in the PDF file as requested by the user.
 */
export function generateTemposRespostaPDF(
  folhas: FolhaServico[],
  empresas: Empresa[],
  scope: TemposRespostaScope = 'TODOS'
): jsPDF {
  // A3 Landscape: 420mm width x 297mm height
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true
  });

  const runAutoTable = (options: any) => {
    const fn = (autoTable as any)?.default?.default || (autoTable as any)?.default || autoTable;
    if (typeof fn === 'function') {
      fn(doc, options);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(options);
    }
  };

  // 1. Filter rows by scope
  let filteredFolhas = folhas;
  let docTitle = 'QUADRO GERAL DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO';
  let scopeSubtitle = 'Relatório global diário com toda a informação operacional (Oficina, Assistência e Contratos)';
  let scopeBadge = 'ÂMBITO: GERAL (COMPLETO)';
  let accentColor = [13, 148, 136]; // Teal

  if (scope === 'OFICINA') {
    filteredFolhas = folhas.filter(f => f.tipo === 'Oficina');
    docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — OFICINA';
    scopeSubtitle = 'Acompanhamento diário de viaturas na oficina, tempos de imobilização e intervenção';
    scopeBadge = 'ÂMBITO: OFICINA';
    accentColor = [234, 88, 12]; // Orange
  } else if (scope === 'ASSISTENCIA_CONTRATOS') {
    filteredFolhas = folhas.filter(f => f.tipo === 'Assistência Técnica' || f.tipo === 'Contrato');
    docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — ASSISTÊNCIA TÉCNICA E CONTRATOS';
    scopeSubtitle = 'Acompanhamento diário de intervenções no terreno, contratos de manutenção e pedidos de assistência';
    scopeBadge = 'ÂMBITO: ASSISTÊNCIA & CONTRATOS';
    accentColor = [2, 132, 199]; // Sky blue
  }

  // 2. Augment and sort rows
  const processedRows = filteredFolhas.map(f => {
    const emp = empresas.find(e => e.id === f.empresaId);
    const isConcluido = f.status === 'Concluído' || f.status.startsWith('FEITO') || f.status === 'Feito' || !!f.dataConclusao;

    const startDateImobilizacao = f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined);
    const imobilizacao = calculateDiffDays(startDateImobilizacao, f.dataConclusao);
    const diasRequisicao = calculateDiffDays(f.dataRequisicao, f.dataConclusao);
    const isCritico = !isConcluido && (((imobilizacao?.days || 0) >= 10) || ((diasRequisicao?.days || 0) >= 10));

    return {
      folha: f,
      empresaNome: emp?.nome || 'Cliente / Não especificado',
      isConcluido,
      imobilizacao,
      diasRequisicao,
      isCritico
    };
  }).sort((a, b) => {
    // Open/in progress first, then critical status, then imobilizacao days desc, then date desc
    if (a.isConcluido !== b.isConcluido) return a.isConcluido ? 1 : -1;
    if (a.isCritico !== b.isCritico) return a.isCritico ? -1 : 1;
    const imobA = a.imobilizacao?.days || 0;
    const imobB = b.imobilizacao?.days || 0;
    if (imobB !== imobA) return imobB - imobA;
    return new Date(b.folha.data).getTime() - new Date(a.folha.data).getTime();
  });

  // 3. TOP ACCENT BAR (Width 420mm)
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 420, 6, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(290, 0, 130, 6, 'F');

  // 4. GRAUMP LOGO
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 10, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 23);
  }

  // 5. HEADER TITLES (Right-aligned on 420mm page)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(docTitle, 406, 18, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(scopeSubtitle, 406, 24, { align: 'right' });

  // Metadata Row
  const dataEmissao = getTodayFormatted();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(`${scopeBadge}  •  DATA DE EMISSÃO: ${dataEmissao}  •  TOTAL DE REGISTOS: ${processedRows.length}`, 406, 30, { align: 'right' });

  // 6. TABLE GENERATION (A3 Width ~ 392mm table)
  const tableRows = processedRows.map(r => {
    const f = r.folha;
    const marcaModelo = `${f.marca || ''} ${f.modelo || ''}`.trim() || '-';
    const dataCriacao = formatDate(f.data);
    const dataReq = f.dataRequisicao ? formatDate(f.dataRequisicao) : '-';
    const diasReqText = r.diasRequisicao ? r.diasRequisicao.text : '-';
    const dataEntradaOf = formatDate(f.dataEntradaOficina || (f.tipo === 'Oficina' ? f.data : undefined));
    const dataConc = f.dataConclusao ? formatDate(f.dataConclusao) : 'Em Aberto';
    const imobText = r.imobilizacao ? r.imobilizacao.text : '-';
    const obs = (f.anomalias || f.notasInternas || f.notasCliente || '-').replace(/\n/g, ' ');

    return [
      f.numero || f.id,
      f.tipo,
      f.matricula || '---',
      marcaModelo,
      r.empresaNome,
      dataCriacao,
      dataReq,
      diasReqText,
      dataEntradaOf,
      dataConc,
      imobText,
      f.status,
      obs
    ];
  });

  runAutoTable({
    startY: 36,
    head: [[
      'Folha',
      'Tipo',
      'Matrícula',
      'Marca / Modelo',
      'Cliente / Entidade',
      'Criação',
      'Data Req.',
      'Dias Req.',
      'Entrada Of.',
      'Conclusão',
      'Imobilização',
      'Estado Atual',
      'Observações Técnicas / Anomalias'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3.2
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.6,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold', textColor: [2, 132, 199] }, // Folha
      1: { cellWidth: 28, fontStyle: 'bold' }, // Tipo
      2: { cellWidth: 22, fontStyle: 'bold' }, // Matrícula
      3: { cellWidth: 32 }, // Marca / Modelo
      4: { cellWidth: 54 }, // Cliente
      5: { cellWidth: 18, halign: 'center' }, // Criação
      6: { cellWidth: 18, halign: 'center' }, // Data Req
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Dias Req
      8: { cellWidth: 18, halign: 'center' }, // Entrada Oficina
      9: { cellWidth: 20, halign: 'center' }, // Conclusão
      10: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }, // Imobilização
      11: { cellWidth: 46 }, // Estado Atual
      12: { cellWidth: 76 }  // Observações
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data: any) => {
      // Highlight critical items (>= 10 days) or specific statuses
      if (data.section === 'body') {
        const rowIdx = data.row.index;
        const rowData = processedRows[rowIdx];
        if (rowData && rowData.isCritico) {
          if (data.column.index === 10 || data.column.index === 7) {
            data.cell.styles.textColor = [225, 29, 72]; // Rose 600 bold
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [255, 241, 242]; // Rose 50
          }
        }
        if (data.column.index === 9 && data.cell.raw === 'Em Aberto') {
          data.cell.styles.textColor = [217, 119, 6]; // Amber 600
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  // 7. MULTI-PAGE PROFESSIONAL FOOTER (A3 Landscape: width 420, height 297)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer Base Bar
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 287, 420, 10, 'F');

    // Accent triangle & line (GRAUMP Teal / Theme accent)
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    try {
      doc.triangle(0, 297, 45, 297, 0, 278, 'F');
    } catch (e) {}
    doc.rect(0, 290, 32, 7, 'F');

    // Footer Text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, 293.5);

    doc.setTextColor(148, 163, 184);
    doc.text('Quadro de Tempos de Resposta & Imobilização (Formato A3) • Documento Processado por Computador', 210, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 406, 293.5, { align: 'right' });
  }

  return doc;
}

export interface MapaServicosA3Options {
  mapImageBase64?: string;
  items: {
    folha: FolhaServico;
    empresa?: Empresa;
    cliente?: Cliente;
    equipamento?: Equipamento;
    distanciaKm: number;
    moradaExibicao: string;
    coords: { cidade: string; distrito: string; regiao: string };
    isAT: boolean;
    isCT: boolean;
  }[];
  stats: {
    total: number;
    atCount: number;
    ctCount: number;
    outrosCount: number;
    norteCount: number;
    centroCount: number;
    lisboaCount: number;
    sulCount: number;
  };
  filterDescription?: string;
}

/**
 * Generates an executive A3 Landscape (420mm x 297mm) document combining:
 * 1. High-resolution visual snapshot of the interactive Portugal service map
 * 2. Complete structured summary table of all open service sheets in the field
 */
export function generateMapaServicosA3PDF(options: MapaServicosA3Options): jsPDF {
  const { mapImageBase64, items, stats, filterDescription } = options;

  // A3 Landscape: 420mm width x 297mm height
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true
  });

  const runAutoTable = (opts: any) => {
    const fn = (autoTable as any)?.default?.default || (autoTable as any)?.default || autoTable;
    if (typeof fn === 'function') {
      fn(doc, opts);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(opts);
    }
  };

  const accentColor = [2, 132, 199]; // Sky blue GRAUMP

  // 1. TOP HEADER ACCENT BARS
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 420, 6, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(290, 0, 130, 6, 'F');

  // 2. GRAUMP LOGO
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 10, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 23);
  }

  // 3. HEADER TITLES (Right-aligned on 420mm page)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MAPA OPERACIONAL DE SERVIÇOS EM ABERTO (PORTUGAL)', 406, 18, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Localização geográfica e lista resumida de pedidos no terreno (Assistência Técnica e Contratos)', 406, 24, { align: 'right' });

  // Metadata Row
  const dataEmissao = getTodayFormatted();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(
    `TOTAL EM ABERTO: ${stats.total}  •  ⚡ AT: ${stats.atCount}  •  📜 CONTRATOS: ${stats.ctCount}  •  SUL: ${stats.sulCount} | LISBOA: ${stats.lisboaCount} | CENTRO: ${stats.centroCount} | NORTE: ${stats.norteCount}  •  EMISSÃO: ${dataEmissao}`,
    406,
    30,
    { align: 'right' }
  );

  let currentY = 35;

  // 4. EMBED MAP SNAPSHOT (If available)
  if (mapImageBase64) {
    const mapWidth = 392;
    const mapHeight = 115;

    // Background placeholder frame
    doc.setFillColor(15, 23, 42); // Slate 900
    doc.roundedRect(14, currentY, mapWidth, mapHeight, 2, 2, 'F');

    try {
      doc.addImage(mapImageBase64, 'JPEG', 14, currentY, mapWidth, mapHeight, undefined, 'FAST');
    } catch (e) {
      console.warn('[PDF] Erro ao renderizar imagem do mapa no PDF:', e);
    }

    // Border around map
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, mapWidth, mapHeight, 2, 2, 'D');

    currentY += mapHeight + 6;
  }

  // 5. SECTION TITLE FOR SUMMARY TABLE
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`📋 LISTA RESUMIDA DE FOLHAS DE SERVIÇO EM ABERTO (${items.length} REGISTOS)`, 14, currentY);

  if (filterDescription) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Filtro: ${filterDescription}`, 406, currentY, { align: 'right' });
  }

  currentY += 4;

  // 6. TABLE ROWS
  const tableRows = items.map(item => {
    const f = item.folha;
    const marcaModelo = `${f.marca || ''} ${f.modelo || ''}`.trim() || '-';
    const dataPed = formatDate(f.data);
    const clienteNome = item.empresa?.nome || item.cliente?.nome || 'Cliente Geral';
    const localidade = item.moradaExibicao || `${item.coords.cidade}, ${item.coords.distrito}`;
    const regiaoDistrito = `${item.coords.distrito} (${item.coords.regiao})`;
    const distKm = `${item.distanciaKm} Km`;
    const contacto = item.cliente?.telemovel || item.empresa?.telefone || '-';
    const anomalia = (f.anomalias || f.notasInternas || f.notasCliente || '-').replace(/\n/g, ' ');

    return [
      f.numero || f.id,
      f.tipo,
      f.matricula || '---',
      marcaModelo,
      clienteNome,
      localidade,
      regiaoDistrito,
      distKm,
      dataPed,
      f.status,
      contacto,
      anomalia
    ];
  });

  runAutoTable({
    startY: currentY,
    head: [[
      'Folha',
      'Tipo',
      'Matrícula',
      'Marca / Modelo',
      'Cliente / Entidade',
      'Localização / Morada',
      'Distrito / Região',
      'Dist. Sede',
      'Data Pedido',
      'Estado Atual',
      'Contacto',
      'Anomalia / Resumo da Intervenção'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.4,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold', textColor: [2, 132, 199] }, // Folha
      1: { cellWidth: 26, fontStyle: 'bold' }, // Tipo
      2: { cellWidth: 20, fontStyle: 'bold' }, // Matrícula
      3: { cellWidth: 28 }, // Marca/Modelo
      4: { cellWidth: 44 }, // Cliente
      5: { cellWidth: 54 }, // Morada
      6: { cellWidth: 28 }, // Regiao
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Dist Km
      8: { cellWidth: 18, halign: 'center' }, // Data
      9: { cellWidth: 32 }, // Estado
      10: { cellWidth: 22 }, // Contacto
      11: { cellWidth: 84 }  // Anomalia
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, bottom: 15 },
    pageBreak: 'auto'
  });

  // 7. MULTI-PAGE PROFESSIONAL FOOTER (A3 Landscape: width 420, height 297)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer Base Bar
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 287, 420, 10, 'F');

    // Accent triangle & line
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    try {
      doc.triangle(0, 297, 45, 297, 0, 278, 'F');
    } catch (e) {}
    doc.rect(0, 290, 32, 7, 'F');

    // Footer Text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, 293.5);

    doc.setTextColor(148, 163, 184);
    doc.text('Mapa Operacional de Serviços em Aberto • Formato A3 • Documento Processado por Computador', 210, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 406, 293.5, { align: 'right' });
  }

  return doc;
}


