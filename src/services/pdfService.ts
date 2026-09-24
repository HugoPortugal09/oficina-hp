import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FolhaServico, Proposta, GuiaEnvio, Empresa, Equipamento, Cliente, ConfiguracaoOficina } from '../types';
import { db, STORAGE_KEYS } from './dbService';
import { GRAU_LOGO_BASE64 } from './grauLogoBase64';
import { formatDate, getTodayFormatted, cleanPersonName, calculateDiffDays } from '../utils/dateUtils';
import { isOficinaOrGraump, isExteriorService, isOpenService } from '../utils/locationUtils';

export function createFolhaServicoPDFDoc(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
): jsPDF {
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
    return generateEntregaFormacaoPDF(folha, empresa, equipamento);
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

  // 1. DOCUMENT TYPE & HERO BADGE CONFIGURATION
  let docTitle = (folha.tipo || 'FOLHA DE SERVIÇO').toUpperCase();
  if (folha.tipo === 'Assistência Técnica') {
    docTitle = 'ASSISTÊNCIA TÉCNICA';
  } else if (folha.tipo === 'Validação e Preparação') {
    docTitle = 'VALIDAÇÃO & PREPARAÇÃO';
  } else if (folha.tipo === 'Oficina') {
    docTitle = 'FOLHA DE OFICINA';
  } else if (folha.tipo === 'Garantia') {
    docTitle = 'GARANTIA';
  } else if (folha.tipo === 'Contrato') {
    docTitle = 'MANUTENÇÃO CONTRATO';
  }

  // 2. FULL-BLEED HERO HEADER BANNER (Navy #0b1528)
  doc.setFillColor(11, 21, 40); // Dark Navy Slate
  doc.rect(0, 0, 210, 38, 'F');

  // Emerald bottom accent border
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 37, 210, 1.2, 'F');

  // Grau Logo (Top Left)
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 18, 7, 28, 18.5, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('GRAUMP', 18, 18);
  }

  // Main document title (e.g. ASSISTÊNCIA TÉCNICA) - prominent white bold title
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle, 54, 19);

  // Subtitle line directly below docTitle: FS number, date, optional Guia AT
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Folha de Serviço: ', 54, 27);
  const fsLabelW = doc.getTextWidth('Folha de Serviço: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // Sky 400
  const fsNum = folha.numero || folha.id || '---';
  doc.text(fsNum, 54 + fsLabelW, 27);
  const fsNumW = doc.getTextWidth(fsNum);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  let regDateStr = ` • Registada a ${formatDate(folha.data) || getTodayFormatted()}`;
  if (folha.guiaAT) {
    regDateStr += ` • Guia: ${folha.guiaAT}`;
  }
  doc.text(regDateStr, 54 + fsLabelW + fsNumW, 27);

  // 3. DUAL CARDS: CLIENTE (VERDE) & EQUIPAMENTO (AZUL)
  let curY = 44;
  const cardW = 84;
  const cardH = 32;

  // --- CARD 1: CLIENTE / ENTIDADE (Verde - Idêntico a Dados de Entrega) ---
  doc.setFillColor(240, 253, 244); // #f0fdf4
  doc.setDrawColor(134, 239, 172); // #86efac
  doc.setLineWidth(0.4);
  doc.roundedRect(18, curY, cardW, cardH, 2.5, 2.5, 'FD');

  // Title with green icon square
  doc.setFillColor(22, 101, 52);
  doc.roundedRect(22, curY + 4, 4, 3.5, 0.4, 0.4, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // #166534
  doc.text('CLIENTE / ENTIDADE', 28, curY + 7);

  const clienteNome = empresa?.nome || (folha as any).empresaNome || (folha as any).cliente || 'Cliente Particular / Não Especificado';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const cLines = doc.splitTextToSize(clienteNome, 74);
  doc.text(cLines.slice(0, 2), 22, curY + 14.5);

  const morada = empresa?.moradaSede || folha.localizacao || '';
  if (morada) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const moradaLines = doc.splitTextToSize(morada, 74);
    doc.text(moradaLines.slice(0, 1), 22, curY + 22.5);
  }

  if (folha.pessoaPresente) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('Presente: ', 22, curY + 28.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(folha.pessoaPresente, 35, curY + 28.5);
  }

  // --- CARD 2: EQUIPAMENTO / VIATURA (Azul - Idêntico a Dados de Formação) ---
  const card2X = 108;
  doc.setFillColor(240, 249, 255); // #f0f9ff
  doc.setDrawColor(125, 211, 252); // #7dd3fc
  doc.setLineWidth(0.4);
  doc.roundedRect(card2X, curY, cardW, cardH, 2.5, 2.5, 'FD');

  // Title with blue icon square
  doc.setFillColor(3, 105, 161);
  doc.roundedRect(card2X + 4, curY + 4, 4, 3.5, 0.4, 0.4, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // #0369a1
  doc.text('EQUIPAMENTO / VIATURA', card2X + 10, curY + 7);

  const equipNome = `${folha.marca || equipamento?.marca || ''} ${folha.modelo || equipamento?.modelo || ''}`.trim() || 'Equipamento Geral';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(equipNome, card2X + 4, curY + 14.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const nSerie = folha.nSerie || equipamento?.nSerie || '';
  const seriePart = (nSerie && nSerie !== 'undefined') ? ` • Nº Série: ${nSerie}` : '';
  doc.text(`Matrícula: ${folha.matricula || equipamento?.matricula || '---'}${seriePart}`, card2X + 4, curY + 21);

  // Professional KMS & HORAS (Clean inline presentation without clunky boxes)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // #0369a1
  doc.text('Kms: ', card2X + 4, curY + 27.5);
  const kmsLblW = doc.getTextWidth('Kms: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const kmsVal = folha.kmsAtuais ? `${folha.kmsAtuais.toLocaleString()}` : '0';
  doc.text(kmsVal, card2X + 4 + kmsLblW, curY + 27.5);
  const kmsValW = doc.getTextWidth(kmsVal);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('   •   ', card2X + 4 + kmsLblW + kmsValW, curY + 27.5);
  const sepW = doc.getTextWidth('   •   ');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161);
  doc.text('Horas: ', card2X + 4 + kmsLblW + kmsValW + sepW, curY + 27.5);
  const hrsLblW = doc.getTextWidth('Horas: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const hrsVal = folha.horasAtuais ? `${folha.horasAtuais}h` : '0h';
  doc.text(hrsVal, card2X + 4 + kmsLblW + kmsValW + sepW + hrsLblW, curY + 27.5);

  curY += cardH + 7;

  // 4. ANOMALIAS / OBSERVAÇÕES TÉCNICAS (Clean card layout like Entrega & Formação)
  const anomaliaTexto = (folha.anomalias || '').trim();
  if (anomaliaTexto && folha.tipo !== 'Validação e Preparação') {
    if (curY > 240) { doc.addPage(); curY = 20; }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('ANOMALIAS REPORTADAS / OBSERVAÇÕES TÉCNICAS', 18, curY + 4);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(18, curY + 6.5, 192, curY + 6.5);
    curY += 9;

    const anomaliaSplit = doc.splitTextToSize(anomaliaTexto, 166);
    const boxH = Math.max(12, anomaliaSplit.length * 4.2 + 8);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(18, curY, 174, boxH, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(anomaliaSplit, 22, curY + 6.5);

    curY += boxH + 7;
  }

  // 4.1 CONTROLO DE VALIDAÇÃO & PREPARAÇÃO (Se aplicável)
  if (folha.tipo === 'Validação e Preparação') {
    if (curY > 240) { doc.addPage(); curY = 20; }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('CONTROLO DE VALIDAÇÃO & PREPARAÇÃO', 18, curY + 4);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(18, curY + 6.5, 192, curY + 6.5);
    curY += 9;

    const valText = folha.validacaoFeita
      ? `[X] Realizada em ${folha.validacaoData || '---'} por: ${folha.validacaoPor || 'HP'}`
      : `[ ] Pendente`;
    const prepText = folha.preparacaoFeita
      ? `[X] Realizada em ${folha.preparacaoData || '---'} por: ${folha.preparacaoPor || 'HP'}`
      : `[ ] Pendente`;

    runAutoTable({
      startY: curY,
      head: [['ETAPA DE CONTROLO', 'ESTADO / REGISTO']],
      body: [
        ['VALIDAÇÃO', valText],
        ['PREPARAÇÃO', prepText]
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129], // Emerald
        textColor: [255, 255, 255],
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
        1: { cellWidth: 124 }
      },
      margin: { left: 18, right: 18 }
    });
    curY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 5. SERVIÇOS EFETUADOS (Mão-de-Obra)
  const allServices = [
    ...(folha.servicos || []).map(s => ({ ...s, isAdicional: false })),
    ...(folha.servicosAdicionais || []).map(s => ({ ...s, isAdicional: true }))
  ];

  if (allServices.length > 0) {
    if (curY > 240) { doc.addPage(); curY = 20; }

    const serviceRows = allServices.map((s, idx) => [
      String(idx + 1),
      `${s.isAdicional ? '[ADICIONAL] ' : ''}${s.descricao || ''}`,
      s.horas ? `${s.horas}h` : ''
    ]);

    runAutoTable({
      startY: curY,
      head: [['#', 'Serviço Efetuado / Mão-de-Obra', 'Horas']],
      body: serviceRows,
      theme: 'grid',
      headStyles: {
        fillColor: [3, 105, 161], // Sky Blue #0369a1
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 144 },
        2: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: 18, right: 18 }
    });
    curY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 6. PEÇAS E MATERIAIS - NUNCA mostrar códigos/referências das peças
  const allParts = [
    ...(folha.pecas || []).map(p => ({ ...p, isAdicional: false })),
    ...(folha.pecasAdicionais || []).map(p => ({ ...p, isAdicional: true }))
  ];

  if (allParts.length > 0) {
    if (curY > 240) { doc.addPage(); curY = 20; }

    const pecasRows = allParts.map((p, idx) => {
      let cleanDesc = (p.designacao || '').trim();
      // Remover códigos entre parênteses retos [GO-...] ou curvos (GO-...) que possam ter vindo no texto
      cleanDesc = cleanDesc.replace(/^\[[^\]]+\]\s*/, '').replace(/^\([^)]+\)\s*/, '');
      if (!cleanDesc) cleanDesc = 'Material de Intervenção';
      if (p.isAdicional) cleanDesc = `[ADICIONAL] ${cleanDesc}`;

      return [
        String(idx + 1),
        cleanDesc,
        String(p.qtd || 1)
      ];
    });

    runAutoTable({
      startY: curY,
      head: [['#', 'Peça / Material Aplicado', 'Qtd']],
      body: pecasRows,
      theme: 'grid',
      headStyles: {
        fillColor: [11, 21, 40], // Dark Navy Slate #0b1528
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 144 },
        2: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: 18, right: 18 }
    });
    curY = (doc as any).lastAutoTable.finalY + 7;
  }

  // 7. NOTAS PARA O CLIENTE (se existirem)
  if (folha.notasCliente && folha.notasCliente.trim()) {
    if (curY > 240) { doc.addPage(); curY = 20; }
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('NOTAS / OBSERVAÇÕES PARA O CLIENTE', 18, curY + 4);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(18, curY + 6.5, 192, curY + 6.5);
    curY += 9;

    const notasSplit = doc.splitTextToSize(folha.notasCliente.trim(), 166);
    const boxH = Math.max(12, notasSplit.length * 4.2 + 8);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.roundedRect(18, curY, 174, boxH, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(notasSplit, 22, curY + 6.5);

    curY += boxH + 7;
  }

  // 8. PRÓXIMA REVISÃO & REGISTO EFETUADO POR
  if (curY > 255) {
    doc.addPage();
    curY = 20;
  }

  // Dotted separator line matching Entrega & Formação
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(18, curY, 192, curY);
  doc.setLineDashPattern([], 0);
  curY += 5;

  const rawRevKms = folha.previsaoRevisaoKms;
  const rawRevHoras = folha.previsaoRevisaoHoras;
  const hasRevKms = rawRevKms !== undefined && rawRevKms !== null && rawRevKms !== '' && !isNaN(Number(rawRevKms)) && Number(rawRevKms) !== 0;
  const hasRevHoras = rawRevHoras !== undefined && rawRevHoras !== null && rawRevHoras !== '' && !isNaN(Number(rawRevHoras)) && Number(rawRevHoras) !== 0;

  if (folha.tipo !== 'Validação e Preparação' && (hasRevKms || hasRevHoras)) {
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52); // Green #166534

    const revParts: string[] = [];
    if (hasRevKms) {
      const numKms = Number(rawRevKms);
      revParts.push(`${numKms.toLocaleString()} Kms`);
    }
    if (hasRevHoras) {
      const numHoras = Number(rawRevHoras);
      revParts.push(`${numHoras.toLocaleString()} Horas`);
    }

    const revStr = `Próxima Revisão: ${revParts.join(' | ')}`;
    doc.text(revStr, 18, curY);
    curY += 5;
  }

  const dataRegisto = formatDate(folha.data) || getTodayFormatted();
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Registo efetuado por: ', 18, curY);
  const regLblW = doc.getTextWidth('Registo efetuado por: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(techName, 18 + regLblW, curY);
  const regNameW = doc.getTextWidth(techName);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(` • ${dataRegisto}`, 18 + regLblW + regNameW, curY);

  // 9. PHOTO GALLERY (IF PHOTOS EXIST)
  const rawFotos = folha.fotos || [];
  if (Array.isArray(rawFotos) && rawFotos.length > 0) {
    doc.addPage();

    // Page header
    doc.setFillColor(11, 21, 40);
    doc.rect(0, 0, 210, 24, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(0, 23.5, 210, 0.8, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('REGISTO FOTOGRÁFICO DA INTERVENÇÃO', 18, 15);

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
        doc.addImage(foto, format, px + 2, py + 2, colW - 4, colH - 4, undefined, 'FAST');
      } catch (errImg) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`[Fotografia ${idx + 1}]`, px + colW / 2, py + colH / 2, { align: 'center' });
      }
    });
  }

  // 10. MULTI-PAGE PROFESSIONAL FOOTER (GRAUMP + Oficina HP Gestão & Frotas + Página X de Y)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer Base Bar
    doc.setFillColor(11, 21, 40); // Dark Navy Slate
    doc.rect(0, 287, 210, 10, 'F');

    // Emerald accent line
    doc.setFillColor(16, 185, 129); // #10b981
    doc.rect(0, 286.2, 210, 0.8, 'F');

    // Footer Text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('OFICINA HP • GESTÃO OPERACIONAL DE FROTAS', 18, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Documento Processado por Computador', 115, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${pageCount}`, 192, 293.5, { align: 'right' });
  }

  return doc;
}

export function generateFolhaServicoPDF(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
) {
  const doc = createFolhaServicoPDFDoc(folha, empresa, equipamento);
  const cleanMatricula = (folha.matricula || 'Equipamento').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanNumero = (folha.numero || folha.id || 'FS').replace(/[^a-zA-Z0-9_-]/g, '_');
  
  if (folha.tipo === 'Entrega e Formação') {
    doc.save(`Auto_Entrega_Formacao_${cleanMatricula}_${cleanNumero}.pdf`);
  } else {
    doc.save(`${cleanNumero}_Folha_Servico_${cleanMatricula}.pdf`);
  }
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
  doc.rect(0, 0, 210, 38, 'F');

  // Emerald bottom border (matching Image 1)
  doc.setFillColor(16, 185, 129); // #10b981
  doc.rect(0, 37, 210, 1.2, 'F');

  // Grau Logo (Top Left)
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 5, 26, 17, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('GRAUMP', 14, 18);
  }

  // Subhead row: Left cyan text
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // #38bdf8
  doc.text('OFICINA HP • GESTÃO OPERACIONAL DE FROTAS', 44, 13);

  // Subhead row: Right emerald pill badge
  doc.setFillColor(16, 185, 129); // #10b981
  doc.roundedRect(132, 8, 64, 6.5, 3.2, 3.2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ENTREGA & FORMAÇÃO CONCLUÍDA', 164, 12.4, { align: 'center' });

  // Main vehicle title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  const equipHeaderTitle = `${folha.matricula || 'SEM MATRÍCULA'} • ${folha.marca || ''} ${folha.modelo || ''}`.trim();
  doc.text(equipHeaderTitle, 44, 23);

  // Subtitle line
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Folha de Serviço: ', 44, 31);
  const fsLabelW = doc.getTextWidth('Folha de Serviço: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(56, 189, 248); // Sky 400
  const fsNum = folha.numero || folha.id || '---';
  doc.text(fsNum, 44 + fsLabelW, 31);
  const fsNumW = doc.getTextWidth(fsNum);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const regDateStr = ` • Registada a ${formatDate(folha.data) || getTodayFormatted()}`;
  doc.text(regDateStr, 44 + fsLabelW + fsNumW, 31);

  let curY = 44;

  // 2. DUAL CARDS: ENTREGA & FORMAÇÃO (Matching Image 1)
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
    });
  }

  // Multi-page professional footer with page numbering
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer Base Bar
    doc.setFillColor(11, 21, 40); // Dark Navy Slate
    doc.rect(0, 287, 210, 10, 'F');

    // Emerald accent line
    doc.setFillColor(16, 185, 129); // #10b981
    doc.rect(0, 286.2, 210, 0.8, 'F');

    // Footer Text
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('OFICINA HP • GESTÃO OPERACIONAL DE FROTAS', 18, 293.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Documento Processado por Computador', 115, 293.5, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(`Página ${i} de ${pageCount}`, 192, 293.5, { align: 'right' });
  }

  return doc;
}

export type TemposRespostaScope = 'OFICINA' | 'EXTERIOR' | 'ASSISTENCIA_CONTRATOS' | 'TODOS';

export interface TemposRespostaPDFConfig {
  scope?: TemposRespostaScope;
  filterTipos?: string[];
  filterScopeLabel?: string;
  searchTerm?: string;
  sortLabel?: string;
  customRows?: Array<{
    folha: FolhaServico;
    empresaNome: string;
    isConcluido: boolean;
    imobilizacao?: { days: number; text: string };
    diasRequisicao?: { days: number; text: string };
    isCritico: boolean;
  }>;
}

/**
 * Generates official A3 Landscape PDF table for Tempos de Resposta & Imobilização
 * Strictly without averages banner in the PDF file as requested by the user.
 */
export function generateTemposRespostaPDF(
  folhas: FolhaServico[],
  empresas: Empresa[],
  scopeOrConfig: TemposRespostaScope | TemposRespostaPDFConfig = 'TODOS'
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

  const isConfigObj = typeof scopeOrConfig === 'object';
  const config = isConfigObj ? scopeOrConfig : {};
  const scope: TemposRespostaScope = isConfigObj ? (config.scope || 'TODOS') : scopeOrConfig;

  let processedRows: Array<{
    folha: FolhaServico;
    empresaNome: string;
    isConcluido: boolean;
    imobilizacao?: { days: number; text: string };
    diasRequisicao?: { days: number; text: string };
    isCritico: boolean;
  }> = [];

  let docTitle = 'QUADRO GERAL DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO';
  let scopeSubtitle = 'Relatório global diário com toda a informação operacional (Oficina e Exterior)';
  let scopeBadge = 'ÂMBITO: GERAL (APENAS EM ABERTO)';
  let accentColor = [13, 148, 136]; // Teal

  if (isConfigObj && config.customRows) {
    processedRows = config.customRows;
    docTitle = 'MAPA OPERACIONAL DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO';
    scopeSubtitle = 'Acompanhamento detalhado de imobilização em oficina, tempos de resposta e requisições';
    accentColor = [2, 132, 199]; // Sky blue GRAUMP

    const parts: string[] = [];
    if (config.filterScopeLabel) {
      parts.push(`ÂMBITO: ${config.filterScopeLabel.toUpperCase()}`);
    }
    if (config.filterTipos && config.filterTipos.length > 0) {
      parts.push(`TIPOS: ${config.filterTipos.join(' + ')}`);
    } else {
      parts.push('TODOS OS TIPOS');
    }
    if (config.searchTerm) {
      parts.push(`PESQUISA: "${config.searchTerm}"`);
    }
    if (config.sortLabel) {
      parts.push(`ORDENAÇÃO: ${config.sortLabel.toUpperCase()}`);
    }
    scopeBadge = parts.join('  •  ');
  } else {
    // 1. Filtrar registos por âmbito - Regra obrigatória: Apenas descarregar os que estão em aberto!
    let filteredFolhas = folhas.filter(f => isOpenService(f));

    if (scope === 'OFICINA') {
      // Regra do utilizador: "O PDF Oficina (A3) devem de constar todos os serviços que sejam Oficina e todos os outros em que a morada seja GRAUMP."
      filteredFolhas = filteredFolhas.filter(f => isOficinaOrGraump(f));
      docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — OFICINA (GRAUMP)';
      scopeSubtitle = 'Acompanhamento diário de viaturas na oficina e serviços sediados na GRAUMP (Apenas em Aberto)';
      scopeBadge = 'ÂMBITO: OFICINA (GRAUMP)  •  APENAS EM ABERTO';
      accentColor = [234, 88, 12]; // Orange
    } else if (scope === 'EXTERIOR' || scope === 'ASSISTENCIA_CONTRATOS') {
      // Regra do utilizador: "No pdf AT/Contratos (A3), deves de mudar o nome para PDF Exterior, e devem de estar todos os serviços que a morada não sejam GRAUMP."
      filteredFolhas = filteredFolhas.filter(f => isExteriorService(f));
      docTitle = 'QUADRO DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO — EXTERIOR';
      scopeSubtitle = 'Acompanhamento diário de intervenções no terreno, assistências e contratos fora da GRAUMP (Apenas em Aberto)';
      scopeBadge = 'ÂMBITO: EXTERIOR (FORA DA GRAUMP)  •  APENAS EM ABERTO';
      accentColor = [2, 132, 199]; // Sky blue
    } else {
      // TODOS (Geral em aberto)
      docTitle = 'QUADRO GERAL DE TEMPOS DE RESPOSTA & IMOBILIZAÇÃO';
      scopeSubtitle = 'Relatório global diário com todos os serviços em curso (Oficina e Exterior) (Apenas em Aberto)';
      scopeBadge = 'ÂMBITO: GERAL (APENAS EM ABERTO)';
      accentColor = [13, 148, 136]; // Teal
    }

    // 2. Augment and sort rows
    processedRows = filteredFolhas.map(f => {
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
      // Critical status first, then imobilizacao days desc, then date desc
      if (a.isCritico !== b.isCritico) return a.isCritico ? -1 : 1;
      const imobA = a.imobilizacao?.days || 0;
      const imobB = b.imobilizacao?.days || 0;
      if (imobB !== imobA) return imobB - imobA;
      return new Date(b.folha.data).getTime() - new Date(a.folha.data).getTime();
    });
  }

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
  doc.text(`${scopeBadge}  •  TOTAL DE REGISTOS: ${processedRows.length}  •  DATA DE EMISSÃO: ${dataEmissao}`, 406, 30, { align: 'right' });

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
    const locTag = f.localizacao
      ? `\n📍 ${f.localizacao}`
      : (isOficinaOrGraump(f) ? '\n📍 GRAUMP (Albergaria)' : '');
    const clienteCell = `${r.empresaNome}${locTag}`;

    return [
      f.numero || f.id,
      f.tipo,
      f.matricula || '---',
      marcaModelo,
      clienteCell,
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
      'Cliente / Localização',
      'Criação',
      'Data Req.',
      'Dias Req.',
      'Entrada Of.',
      'Conclusão',
      'Imobilização',
      'Estado Atual',
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
/**
 * Generates an executive A3 Multi-Orientation document:
 * - Folha 1 (Vertical / Portrait - 297mm x 420mm): Clean, undistorted geographic map of Portugal with executive KPIs
 * - Folha 2+ (Horizontal / Landscape - 420mm x 297mm): Complete 12-column structured summary table of all open service sheets
 */
export function generateMapaServicosA3PDF(options: MapaServicosA3Options): jsPDF {
  const { mapImageBase64, items, stats, filterDescription } = options;

  // 1. FOLHA 1 (PORTRAIT / VERTICAL): 297mm width x 420mm height
  const doc = new jsPDF({
    orientation: 'portrait',
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
  const dataEmissao = getTodayFormatted();

  // --- FOLHA 1: CABEÇALHO VERTICAL (Largura 297mm) ---
  // Barra de topo
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 297, 6, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(197, 0, 100, 6, 'F');

  // Logótipo GRAUMP
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 10, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 23);
  }

  // Títulos à direita (alinhados a x = 283)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MAPA OPERACIONAL DE SERVIÇOS EM ABERTO', 283, 17, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Localização geográfica e distribuição no terreno (Assistência Técnica e Contratos)', 283, 23, { align: 'right' });

  // Linha de KPIs
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(
    `TOTAL EM ABERTO: ${stats.total}  •  AT: ${stats.atCount}  •  CONTRATOS: ${stats.ctCount}  •  DATA: ${dataEmissao}`,
    283,
    29,
    { align: 'right' }
  );

  // Linha Regional / Filtros
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Sul: ${stats.sulCount}  |  Lisboa: ${stats.lisboaCount}  |  Centro: ${stats.centroCount}  |  Norte: ${stats.norteCount}${filterDescription ? `  •  Filtro: ${filterDescription}` : ''}`,
    283,
    34,
    { align: 'right' }
  );

  // Linha divisória
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 38, 283, 38);

  // --- FOLHA 1: MAPA DE PORTUGAL (ENQUADRAMENTO VERTICAL SEM DEFORMAÇÃO) ---
  const mapStartY = 42;
  const maxMapW = 269; // 297 - 28
  const maxMapH = 344; // De 42 até 386 (deixa espaço para barra de legenda em 388..402)

  if (mapImageBase64) {
    try {
      const imgProps = doc.getImageProperties(mapImageBase64);
      const imgRatio = imgProps.width / imgProps.height;

      let renderW = maxMapW;
      let renderH = maxMapW / imgRatio;

      if (renderH > maxMapH) {
        renderH = maxMapH;
        renderW = maxMapH * imgRatio;
      }

      // Centralizar imagem na área útil da Folha 1
      const renderX = 14 + (maxMapW - renderW) / 2;
      const renderY = mapStartY + (maxMapH - renderH) / 2;

      // Fundo escuro elegante de apoio
      doc.setFillColor(15, 23, 42); // Slate 900
      doc.roundedRect(renderX, renderY, renderW, renderH, 2.5, 2.5, 'F');

      // Desenhar mapa proporcional (zero distorção / círculos perfeitamente redondos)
      doc.addImage(mapImageBase64, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST');

      // Moldura exterior
      doc.setDrawColor(51, 65, 85); // Slate 700
      doc.setLineWidth(0.4);
      doc.roundedRect(renderX, renderY, renderW, renderH, 2.5, 2.5, 'D');
    } catch (e) {
      console.warn('[PDF] Erro ao renderizar imagem do mapa:', e);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(14, mapStartY, maxMapW, 200, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text('Pré-visualização do mapa não disponível no momento da exportação.', 148.5, mapStartY + 100, { align: 'center' });
    }
  } else {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, mapStartY, maxMapW, 200, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Mapa não carregado. Abra o mapa antes de imprimir.', 148.5, mapStartY + 100, { align: 'center' });
  }

  // --- FOLHA 1: BARRA DE LEGENDA INFORMATIVA (Fundo da Folha 1) ---
  const legY = 390;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, legY, maxMapW, 14, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('LEGENDA OPERACIONAL:', 18, legY + 8.5);

  // Pin AT (Laranja)
  doc.setFillColor(234, 88, 12);
  doc.circle(68, legY + 8, 3, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Assistência Técnica (AT)', 73, legY + 9.5);

  // Pin CT (Roxo)
  doc.setFillColor(147, 51, 234);
  doc.circle(126, legY + 8, 3, 'F');
  doc.text('Contratos (CT)', 131, legY + 9.5);

  // Badge Múltiplos
  doc.setFillColor(2, 132, 199);
  doc.roundedRect(165, legY + 5.5, 9, 6, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('Nº', 169.5, legY + 9.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Serviços Sobrepostos no Local', 177, legY + 9.5);

  // Nota de continuação na Folha 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('>> Ver Folha 2 para a Tabela Detalhada', 278, legY + 9.5, { align: 'right' });


  // 2. FOLHA 2 (LANDSCAPE / HORIZONTAL): 420mm width x 297mm height
  doc.addPage('a3', 'landscape');

  // --- FOLHA 2: CABEÇALHO HORIZONTAL (Largura 420mm) ---
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 420, 6, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(290, 0, 130, 6, 'F');

  // Logótipo GRAUMP
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 14, 10, 32, 21, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('GRAUMP', 14, 23);
  }

  // Título da Tabela à direita (alinhado a x = 406)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LISTA RESUMIDA DE FOLHAS DE SERVIÇO EM ABERTO', 406, 17, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Detalhamento operacional de pedidos no terreno (Assistência Técnica e Contratos)', 406, 23, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(
    `TOTAL: ${items.length} REGISTOS  •  AT: ${stats.atCount}  •  CONTRATOS: ${stats.ctCount}${filterDescription ? `  •  FILTRO: ${filterDescription}` : ''}  •  EMISSÃO: ${dataEmissao}`,
    406,
    29,
    { align: 'right' }
  );

  // Linha divisória horizontal
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 33, 406, 33);

  // --- FOLHA 2: TABELA DE SERVIÇOS EM A3 HORIZONTAL ---
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
    startY: 36,
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
      6: { cellWidth: 28 }, // Região
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Dist Km
      8: { cellWidth: 18, halign: 'center' }, // Data
      9: { cellWidth: 32 }, // Estado
      10: { cellWidth: 22 }, // Contacto
      11: { cellWidth: 84 }  // Anomalia
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, top: 12, bottom: 16 },
    pageBreak: 'auto',
    willDrawPage: (data: any) => {
      // Se quebrar para uma nova página (pág 3+), desenha cabeçalho superior subtil
      if (data.pageNumber > 2) {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 420, 5, 'F');
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(320, 0, 100, 5, 'F');
      }
    }
  });

  // 3. RODAPÉS DINÂMICOS CONFORME A ORIENTAÇÃO DA PÁGINA
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageSize = doc.internal.pageSize;
    const pageWidth = pageSize.getWidth ? pageSize.getWidth() : pageSize.width;
    const pageHeight = pageSize.getHeight ? pageSize.getHeight() : pageSize.height;
    const isPortrait = pageHeight > pageWidth;

    const footerY = pageHeight - 10;
    const textY = pageHeight - 3.5;
    const rightMargin = pageWidth - 14;

    // Barra base do rodapé
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, footerY, pageWidth, 10, 'F');

    // Acento visual no rodapé
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    try {
      doc.triangle(0, pageHeight, 45, pageHeight, 0, footerY - 9, 'F');
    } catch (e) {}
    doc.rect(0, footerY + 3, 32, 7, 'F');

    // Texto de marca à esquerda
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, textY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, textY);

    // Texto central informativo
    doc.setTextColor(148, 163, 184);
    const centerTitle = isPortrait
      ? 'Mapa Operacional de Serviços em Aberto • Folha 1 (Enquadramento Geográfico - Formato Vertical A3)'
      : 'Lista Resumida de Serviços em Aberto • Folha 2 (Detalhamento Operacional - Formato Horizontal A3)';
    doc.text(centerTitle, pageWidth / 2, textY, { align: 'center' });

    // Numeração de página à direita
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, rightMargin, textY, { align: 'right' });
  }

  return doc;
}

export interface FolhasServicoA3Row {
  folha: FolhaServico;
  empresa?: Empresa;
  cliente?: Cliente;
  equipamento?: Equipamento;
  localidade: string;
  distritoRegiao: string;
  distKm: string;
  contacto: string;
}

export interface FolhasServicoA3Options {
  items: FolhasServicoA3Row[];
  filterTipos: string[];
  filterDescription?: string;
}

/**
 * Generates an executive A3 Landscape (420mm x 297mm) document:
 * Detailed structured summary table of all open service sheets in the workshop/field,
 * filtered by the selected service types (e.g. Oficina, Validação e Preparação).
 */
export function generateFolhasServicoA3PDF(options: FolhasServicoA3Options): jsPDF {
  const { items, filterTipos, filterDescription } = options;

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
  const dataEmissao = getTodayFormatted();

  // 1. TOP HEADER ACCENT BARS (Largura 420mm)
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

  // 3. HEADER TITLES (Alinhados à direita a 406mm)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MAPA OPERACIONAL DE FOLHAS DE SERVIÇO EM ABERTO', 406, 17, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Listagem estruturada de pedidos operacionais em curso (Oficina, Validação e Preparação, Assistência, etc.)', 406, 23, { align: 'right' });

  // Metadata Row
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  const tiposStr = filterTipos.length > 0 ? `TIPOS: ${filterTipos.join(' + ')}` : 'TODOS OS TIPOS';
  doc.text(
    `TOTAL EM ABERTO: ${items.length} FOLHAS  •  ${tiposStr}${filterDescription ? `  •  ${filterDescription}` : ''}  •  EMISSÃO: ${dataEmissao}`,
    406,
    29,
    { align: 'right' }
  );

  // Linha divisória horizontal
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(14, 33, 406, 33);

  // 4. TABELA DE SERVIÇOS EM A3 HORIZONTAL
  const tableRows = items.map(item => {
    const f = item.folha;
    const marcaModelo = `${f.marca || ''} ${f.modelo || ''}`.trim() || '-';
    const dataPed = formatDate(f.data);
    const clienteNome = item.empresa?.nome || item.cliente?.nome || 'Cliente Geral';
    const anomalia = (f.anomalias || f.notasInternas || f.notasCliente || '-').replace(/\n/g, ' ');

    return [
      f.numero || f.id,
      f.tipo,
      f.matricula || '---',
      marcaModelo,
      clienteNome,
      item.localidade,
      item.distritoRegiao,
      item.distKm,
      dataPed,
      f.status,
      item.contacto,
      anomalia
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
      6: { cellWidth: 28 }, // Região
      7: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // Dist Km
      8: { cellWidth: 18, halign: 'center' }, // Data
      9: { cellWidth: 32 }, // Estado
      10: { cellWidth: 22 }, // Contacto
      11: { cellWidth: 84 }  // Anomalia
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, top: 12, bottom: 16 },
    pageBreak: 'auto',
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 420, 5, 'F');
        doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
        doc.rect(320, 0, 100, 5, 'F');
      }
    }
  });

  // 5. RODAPÉS DINÂMICOS
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = 287;
    const textY = 293.5;

    // Barra base do rodapé
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, footerY, 420, 10, 'F');

    // Acento visual no rodapé
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    try {
      doc.triangle(0, 297, 45, 297, 0, footerY - 9, 'F');
    } catch (e) {}
    doc.rect(0, footerY + 3, 32, 7, 'F');

    // Texto de marca à esquerda
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 15, textY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 29, textY);

    // Texto central informativo
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Mapa Operacional de Folhas de Serviço em Aberto • Formato A3 Horizontal • Documento Processado por Computador',
      210,
      textY,
      { align: 'center' }
    );

    // Numeração de página à direita
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 406, textY, { align: 'right' });
  }

  return doc;
}

// -------------------------------------------------------------
// PLANEAMENTO SEMANAL EM FORMATO A4 HORIZONTAL (LANDSCAPE)
// -------------------------------------------------------------

export interface PlaneamentoSemanalDayItem {
  type: 'folha' | 'visita';
  hora?: string;
  numeroOuTitulo: string; // "FS26900" ou "VISITA"
  tipoOuMotivo: string; // "Oficina", "Diagnóstico no Terreno", etc.
  matricula?: string;
  marcaModelo?: string;
  empresa: string;
  contacto?: string;
  localidade?: string;
  tecnico?: string;
  status?: string;
  notas?: string;
}

export interface PlaneamentoSemanalDayCol {
  index: number;
  label: string; // "Segunda-feira", "Terça-feira", etc.
  short: string; // "Seg", "Ter", etc.
  formattedDate: string; // "21/09"
  isoStr: string; // "2026-09-21"
  items: PlaneamentoSemanalDayItem[];
}

export interface PlaneamentoSemanalA4Options {
  days: PlaneamentoSemanalDayCol[];
  startDateStr: string; // "21/09/2026"
  endDateStr: string; // "25/09/2026"
  selectedTecnico?: string;
  searchTerm?: string;
  totalFolhas: number;
  totalVisitas: number;
}

/**
 * Generates an executive A4 Landscape (297mm x 210mm) document for Weekly Planning & Visits:
 * Displays active week days as columns (Monday to Friday always included;
 * Saturday and Sunday only included if there are appointments scheduled).
 */
export function generatePlaneamentoSemanalA4PDF(options: PlaneamentoSemanalA4Options): jsPDF {
  const {
    days,
    startDateStr,
    endDateStr,
    selectedTecnico,
    searchTerm,
    totalFolhas,
    totalVisitas
  } = options;

  // A4 Landscape: 297mm width x 210mm height
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
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
  const dataEmissao = getTodayFormatted();

  // 1. TOP HEADER ACCENT BARS (Largura 297mm)
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 297, 5, 'F');
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(197, 0, 100, 5, 'F');

  // 2. GRAUMP LOGO (12mm margem esquerda, topo 7mm)
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 12, 8, 26, 17, undefined, 'FAST');
  } catch (err) {
    doc.setFillColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('GRAUMP', 12, 19);
  }

  // 3. HEADER TITLES (Alinhados à direita a 285mm)
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MAPA SEMANAL DE PLANEAMENTO & VISITAS', 285, 13, { align: 'right' });

  // Subtitle with days description
  const hasSab = days.some(d => d.index === 5);
  const hasDom = days.some(d => d.index === 6);
  let scopeLabel = 'Segunda a Sexta-feira';
  if (hasSab && hasDom) scopeLabel = 'Segunda a Domingo (Semana Completa)';
  else if (hasSab) scopeLabel = 'Segunda a Sábado';
  else if (hasDom) scopeLabel = 'Segunda a Sexta + Domingo';

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Semana de ${startDateStr} a ${endDateStr} (${scopeLabel})`, 285, 18, { align: 'right' });

  // Metadata Row
  const tecLabel = selectedTecnico && selectedTecnico !== 'TODOS' ? `TÉCNICO: ${selectedTecnico.toUpperCase()}` : 'TODOS OS TÉCNICOS';
  const searchPart = searchTerm ? `  •  FILTRO: "${searchTerm}"` : '';
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(
    `${tecLabel}  •  TOTAL: ${totalFolhas} FOLHAS, ${totalVisitas} VISITAS${searchPart}  •  EMISSÃO: ${dataEmissao}`,
    285,
    23,
    { align: 'right' }
  );

  // Linha divisória horizontal
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(12, 26, 285, 26);

  // 4. PREPARAR COLUNAS E LINHAS DO CALENDÁRIO
  const numCols = days.length; // 5, 6 ou 7
  const tableWidth = 273; // 285 - 12
  const colWidth = tableWidth / numCols;

  // Cabeçalhos de coluna
  const tableHead = [
    days.map(d => `${d.label.toUpperCase()}\n${d.formattedDate} (${d.items.length})`)
  ];

  // Ordenar itens de cada dia por hora
  days.forEach(d => {
    d.items.sort((a, b) => (a.hora || '00:00').localeCompare(b.hora || '00:00'));
  });

  const maxItems = Math.max(1, ...days.map(d => d.items.length));
  const tableRows: string[][] = [];

  for (let r = 0; r < maxItems; r++) {
    const rowCells: string[] = [];
    for (let c = 0; c < numCols; c++) {
      const day = days[c];
      const item = day.items[r];

      if (item) {
        const lines: string[] = [];
        const horaStr = item.hora ? `[${item.hora}] ` : '';

        if (item.type === 'folha') {
          lines.push(`${horaStr}${item.numeroOuTitulo} • ${item.tipoOuMotivo}`);
          if (item.matricula) {
            lines.push(`${item.matricula}${item.marcaModelo ? ` (${item.marcaModelo})` : ''}`);
          }
          if (item.empresa) lines.push(item.empresa);
          if (item.localidade) lines.push(`Local: ${item.localidade}`);
          if (item.tecnico) lines.push(`Téc: ${item.tecnico}`);
          if (item.status) lines.push(`Estado: ${item.status}`);
          if (item.notas) {
            const shortNotes = item.notas.length > 40 ? item.notas.substring(0, 38) + '...' : item.notas;
            lines.push(`Obs: ${shortNotes.replace(/\n/g, ' ')}`);
          }
        } else {
          lines.push(`${horaStr}VISITA • ${item.tipoOuMotivo}`);
          if (item.empresa) lines.push(item.empresa);
          if (item.contacto) lines.push(`Cont: ${item.contacto}`);
          if (item.localidade) lines.push(`Morada: ${item.localidade}`);
          if (item.tecnico) lines.push(`Téc: ${item.tecnico}`);
          if (item.status) lines.push(`Estado: ${item.status}`);
          if (item.notas) {
            const shortNotes = item.notas.length > 40 ? item.notas.substring(0, 38) + '...' : item.notas;
            lines.push(`Notas: ${shortNotes.replace(/\n/g, ' ')}`);
          }
        }

        rowCells.push(lines.join('\n'));
      } else {
        if (r === 0 && day.items.length === 0) {
          rowCells.push('— Sem marcações —');
        } else {
          rowCells.push('');
        }
      }
    }
    tableRows.push(rowCells);
  }

  // Column styles mapping
  const columnStyles: Record<number, any> = {};
  for (let c = 0; c < numCols; c++) {
    columnStyles[c] = {
      cellWidth: colWidth,
      valign: 'top'
    };
  }

  runAutoTable({
    startY: 28,
    head: tableHead,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Dark slate
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2.5
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak'
    },
    columnStyles,
    margin: { left: 12, right: 12, top: 10, bottom: 12 },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        const raw = String(data.cell.raw || '');
        if (raw.includes('VISITA •')) {
          data.cell.styles.fillColor = [240, 253, 244]; // Emerald 50
          data.cell.styles.textColor = [6, 78, 59]; // Dark emerald
        } else if (raw.includes('FS') && raw.includes('•')) {
          data.cell.styles.fillColor = [240, 249, 255]; // Sky 50
          data.cell.styles.textColor = [12, 74, 110]; // Dark sky
        } else if (raw === '— Sem marcações —') {
          data.cell.styles.fillColor = [248, 250, 252];
          data.cell.styles.textColor = [148, 163, 184];
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.halign = 'center';
        } else if (raw === '') {
          data.cell.styles.fillColor = [255, 255, 255];
        }
      }
    }
  });

  // 5. RODAPÉ EXECUTIVO (A4 Landscape: width 297, height 210)
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = 202;
    const textY = 206.5;

    // Barra base do rodapé
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, footerY, 297, 8, 'F');

    // Acento visual no rodapé
    doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    try {
      doc.triangle(0, 210, 30, 210, 0, footerY - 5, 'F');
    } catch (e) {}
    doc.rect(0, footerY + 2, 22, 6, 'F');

    // Texto de marca à esquerda
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 10, textY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 23, textY);

    // Texto central informativo
    doc.setTextColor(148, 163, 184);
    doc.text(
      'Planeamento Semanal Operacional • Folha A4 Horizontal • Processado por Computador',
      148.5,
      textY,
      { align: 'center' }
    );

    // Numeração de página à direita
    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${pageCount}`, 285, textY, { align: 'right' });
  }

  return doc;
}

/**
 * Generates an executive A4 Technical Passport and Service History PDF for a vehicle / equipment.
 */
export function generatePassaporteTecnicoPDF(
  equipamento: Equipamento,
  empresa?: Empresa,
  folhas?: FolhaServico[]
): jsPDF {
  const doc = new jsPDF({ compress: true });

  const runAutoTable = (options: any) => {
    const fn = (autoTable as any)?.default?.default || (autoTable as any)?.default || autoTable;
    if (typeof fn === 'function') {
      fn(doc, options);
    } else if (typeof (doc as any).autoTable === 'function') {
      (doc as any).autoTable(options);
    }
  };

  const safeFolhas = Array.isArray(folhas) ? folhas : (db.get<FolhaServico>(STORAGE_KEYS.FOLHAS_SERVICO) || []);
  const matchingFolhas = safeFolhas
    .filter(f => (
      (equipamento.id && f.equipamentoId === equipamento.id) ||
      (equipamento.matricula && f.matricula && f.matricula.trim().toUpperCase() === equipamento.matricula.trim().toUpperCase())
    ))
    .sort((a, b) => parseDateToMs(a.dataConclusao || a.data || a.criadoEm) - parseDateToMs(b.dataConclusao || b.data || b.criadoEm)); // oldest to newest for chronological history

  // Calculate stats
  const latestFolhaWithKms = [...matchingFolhas].reverse().find(f => f.kmsAtuais !== undefined && Number(f.kmsAtuais) > 0);
  const latestFolhaWithHoras = [...matchingFolhas].reverse().find(f => f.horasAtuais !== undefined && Number(f.horasAtuais) > 0);
  const currentKms = latestFolhaWithKms?.kmsAtuais ? Number(latestFolhaWithKms.kmsAtuais) : (equipamento.kmsAtuais || 0);
  const currentHoras = latestFolhaWithHoras?.horasAtuais ? Number(latestFolhaWithHoras.horasAtuais) : (equipamento.horasAtuais || 0);

  // Replaced parts aggregation & labor hours sum
  const partsMap = new Map<string, { ref: string; desc: string; totalQty: number; lastDate: string; lastFolha: string }>();
  let totalLaborHours = 0;

  matchingFolhas.forEach(f => {
    if (Array.isArray(f.servicos)) {
      f.servicos.forEach(s => {
        totalLaborHours += Number(s.tempo) || 0;
      });
    }
    if (Array.isArray(f.pecas)) {
      f.pecas.forEach(p => {
        const ref = (p.referencia || p.codigo || '').trim();
        const desc = (p.designacao || p.descricao || 'Peça').trim();
        const key = `${ref}__${desc}`.toLowerCase();
        const qty = Number(p.quantidade) || 1;
        const dateStr = formatDate(f.dataConclusao || f.data);
        const folhaNum = f.numero || '';

        if (partsMap.has(key)) {
          const existing = partsMap.get(key)!;
          existing.totalQty += qty;
          existing.lastDate = dateStr;
          existing.lastFolha = folhaNum;
        } else {
          partsMap.set(key, { ref: ref || '-', desc, totalQty: qty, lastDate: dateStr, lastFolha: folhaNum });
        }
      });
    }
  });

  const partsList = Array.from(partsMap.values()).sort((a, b) => b.totalQty - a.totalQty);

  // 1. Full-bleed Hero Header (Dark Navy #0b1528)
  doc.setFillColor(11, 21, 40);
  doc.rect(0, 0, 210, 36, 'F');

  doc.setFillColor(16, 185, 129); // Emerald accent border #10b981
  doc.rect(0, 35, 210, 1.2, 'F');

  // Logo Grau Maquinaria
  try {
    doc.addImage(GRAU_LOGO_BASE64, 'PNG', 12, 6, 42, 22);
  } catch (e) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('OFICINA HP', 14, 20);
  }

  // Header Title & Date
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('PASSAPORTE TÉCNICO', 198, 15, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('HISTÓRICO INTEGRAL DE INTERVENÇÕES & MANUTENÇÃO', 198, 21, { align: 'right' });
  doc.text(`Data de Emissão: ${getTodayFormatted()}`, 198, 27, { align: 'right' });

  // 2. Identification Cards (Side by side)
  let y = 43;

  // Card Left: Vehicle Identification
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(12, y, 92, 42, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, y, 92, 42, 3, 3, 'S');

  // Top header bar of left card
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(12, y, 92, 8, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('IDENTIFICAÇÃO DA VIATURA / EQUIPAMENTO', 16, y + 5.5);

  // License plate badge
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(16, y + 11, 28, 7.5, 1.5, 1.5, 'FD');
  doc.setFontSize(9.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(equipamento.matricula || 'S/ MATRÍCULA', 30, y + 16, { align: 'center' });

  // Brand / Model
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${equipamento.marca || ''} ${equipamento.modelo || ''}`.trim() || 'Equipamento', 48, y + 16.5);

  // Chassis / Serie
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Nº Série / Chassi: ${equipamento.numeroSerie || 'Não especificado'}`, 16, y + 24);
  doc.text(`Tipo / Categoria: ${equipamento.tipo || 'Ligeiro'}`, 16, y + 29.5);
  if (equipamento.ano) {
    doc.text(`Ano de Fabrico: ${equipamento.ano}`, 16, y + 35);
  } else if (equipamento.dataEntrega) {
    doc.text(`Data de Entrega: ${formatDate(equipamento.dataEntrega)}`, 16, y + 35);
  } else {
    doc.text(`Status: Operacional`, 16, y + 35);
  }

  // Card Right: Client & Utilization Metrics
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(108, y, 90, 42, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(108, y, 90, 42, 3, 3, 'S');

  // Top header bar of right card
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(108, y, 90, 8, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CLIENTE & INDICADORES OPERACIONAIS', 112, y + 5.5);

  const empName = empresa?.nome || 'Cliente / Empresa Geral';
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(empName.length > 38 ? empName.substring(0, 38) + '...' : empName, 112, y + 15);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  if (empresa?.nif) {
    doc.text(`NIF: ${empresa.nif}`, 112, y + 20);
  }
  if (empresa?.localidade || empresa?.cidade) {
    doc.text(`Localidade: ${empresa.localidade || empresa.cidade}`, 112, y + 24.5);
  }

  // 3 Mini-stats at bottom of right card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(112, y + 27, 26, 12, 1.5, 1.5, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('QUILÓMETROS', 125, y + 31.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text(`${currentKms.toLocaleString()} km`, 125, y + 36.5, { align: 'center' });

  doc.roundedRect(140, y + 27, 26, 12, 1.5, 1.5, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('HORAS TRABALHO', 153, y + 31.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6); // Amber
  doc.text(`${currentHoras} h`, 153, y + 36.5, { align: 'center' });

  doc.roundedRect(168, y + 27, 26, 12, 1.5, 1.5, 'FD');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('INTERVENÇÕES', 181, y + 31.5, { align: 'center' });
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // Sky blue
  doc.text(`${matchingFolhas.length} FS`, 181, y + 36.5, { align: 'center' });

  // 3. Section Title: HISTÓRICO DE INTERVENÇÕES
  y = 92;
  doc.setFillColor(15, 23, 42); // Navy
  doc.rect(12, y, 4, 10, 'F');
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('HISTÓRICO CRONOLÓGICO DE INTERVENÇÕES', 20, y + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total de assistência registada: ${totalLaborHours.toFixed(1)}h`, 198, y + 7, { align: 'right' });

  // 4. Table of Interventions
  const tableData = matchingFolhas.map((f, idx) => {
    const dataStr = formatDate(f.dataConclusao || f.data);
    const numStr = f.numero || `FS-${idx + 1}`;
    const tipoStr = f.tipo || 'Oficina';
    const statusStr = (f.status || 'Concluído').replace(/^[A-Z0-9\s-]+-\s*/, '');
    const kmsStr = f.kmsAtuais ? `${Number(f.kmsAtuais).toLocaleString()} km` : '-';
    const horasStr = f.horasAtuais ? `${f.horasAtuais}h` : '';
    const odoStr = kmsStr !== '-' && horasStr ? `${kmsStr}\n${horasStr}` : kmsStr !== '-' ? kmsStr : horasStr || '-';
    const trabStr = f.anomalias || (f.servicos && f.servicos.length > 0 ? f.servicos.map(s => s.descricao).join('\n') : 'Manutenção / Revisão periódica');
    const pecasStr = f.pecas && f.pecas.length > 0 ? f.pecas.map(p => `${p.quantidade || 1}x ${p.designacao || p.descricao}`).join(', ') : '-';
    const tecStr = f.tecnico || f.tecnicoPlaneado || '-';

    return [
      dataStr,
      numStr,
      tipoStr,
      odoStr,
      trabStr,
      pecasStr,
      tecStr,
      statusStr
    ];
  });

  runAutoTable({
    startY: y + 13,
    head: [['Data', 'Nº Folha', 'Tipo', 'Kms / Horas', 'Trabalhos Executados', 'Peças / Materiais Aplicados', 'Téc.', 'Estado']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', 'Nenhuma intervenção registada.', '-', '-', '-']],
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2.2,
      overflow: 'linebreak',
      textColor: [30, 41, 59]
    },
    headStyles: {
      fillColor: [11, 21, 40],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold', halign: 'center', textColor: [3, 105, 161] },
      2: { cellWidth: 18 },
      3: { cellWidth: 20, halign: 'center', font: 'courier' },
      4: { cellWidth: 46 },
      5: { cellWidth: 40 },
      6: { cellWidth: 12, halign: 'center' },
      7: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 12, right: 12 }
  });

  let finalY = (doc as any).lastAutoTable?.finalY || 200;

  // 5. Consolidated Parts Table (if parts exist)
  if (partsList.length > 0) {
    if (finalY > 230) {
      doc.addPage();
      finalY = 20;
    } else {
      finalY += 8;
    }

    doc.setFillColor(15, 23, 42); // Navy
    doc.rect(12, finalY, 4, 8, 'F');
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('PEÇAS & COMPONENTES APLICADOS NO VEÍCULO (RESUMO CONSOLIDADO)', 20, finalY + 6);

    const partsTableData = partsList.map(item => [
      item.ref,
      item.desc,
      String(item.totalQty),
      item.lastDate,
      item.lastFolha
    ]);

    runAutoTable({
      startY: finalY + 10,
      head: [['Referência', 'Designação da Peça', 'Qtd Total', 'Última Substituição', 'Nº Folha']],
      body: partsTableData,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        overflow: 'linebreak',
        textColor: [30, 41, 59]
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 35, font: 'courier', fontStyle: 'bold' },
        1: { cellWidth: 85 },
        2: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 26, halign: 'center' },
        4: { cellWidth: 20, halign: 'center', fontStyle: 'bold', textColor: [3, 105, 161] }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 12, right: 12 }
    });
  }

  // 6. Executive Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = 287;
    const textY = 292;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, footerY, 210, 10, 'F');

    doc.setFillColor(16, 185, 129); // Emerald accent line
    doc.rect(0, footerY, 210, 0.8, 'F');

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('GRAUMP', 12, textY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(' • Oficina HP Gestão & Frotas', 26, textY);

    doc.setTextColor(148, 163, 184);
    doc.text(
      `Passaporte Técnico • Viatura: ${equipamento.matricula || ''} (${equipamento.marca || ''} ${equipamento.modelo || ''})`,
      105,
      textY,
      { align: 'center' }
    );

    doc.setTextColor(255, 255, 255);
    doc.text(`Página ${i} de ${totalPages}`, 198, textY, { align: 'right' });
  }

  return doc;
}


