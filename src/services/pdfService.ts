import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FolhaServico, Proposta, GuiaEnvio, Empresa, Equipamento, ConfiguracaoOficina } from '../types';
import { db } from './dbService';
import { GRAU_LOGO_BASE64 } from './grauLogoBase64';
import { formatDate, getTodayFormatted } from '../utils/dateUtils';

export function generateFolhaServicoPDF(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
) {
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
  if (folha.tipo === 'Oficina') docTitle = 'FOLHA DE OFICINA';
  else if (folha.tipo === 'Garantia') docTitle = 'FOLHA DE GARANTIA';
  else if (folha.tipo === 'Contrato') docTitle = 'MANUTENÇÃO CONTRATO';
  else if (folha.tipo === 'Entrega e Formação') docTitle = 'ENTREGA & FORMAÇÃO';
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
  if (anomaliaTexto) {
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
  if (folha.previsaoRevisaoKms > 0 || folha.previsaoRevisaoHoras > 0) {
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
