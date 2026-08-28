import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { FolhaServico, Proposta, GuiaEnvio, Empresa, Equipamento, ConfiguracaoOficina } from '../types';
import { db } from './dbService';

export function generateFolhaServicoPDF(
  folha: FolhaServico,
  empresa?: Empresa,
  equipamento?: Equipamento
) {
  const config = db.getConfig();
  const doc = new jsPDF();

  // Header Banner
  doc.setFillColor(14, 140, 233); // HP Blue
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nome.toUpperCase(), 14, 12);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`FOLHA DE SERVIÇO / OBRA • ${folha.numero}`, 14, 19);

  // Workshop Info (Right aligned header)
  doc.setFontSize(8);
  doc.text(`${config.telefone} | ${config.email}`, 196, 12, { align: 'right' });
  doc.text(`NIF: ${config.nif}`, 196, 19, { align: 'right' });

  // Metadata Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  
  // Left Column - Client & Location
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE / EMPRESA:', 14, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(empresa?.nome || 'Cliente Particular', 14, 40);
  doc.text(`NIF: ${empresa?.nif || 'N/A'}`, 14, 45);
  doc.text(`Local: ${folha.localizacao || 'GRAUMP (Oficina)'}`, 14, 50);
  if (folha.distanciaKms && folha.distanciaKms > 0) {
    doc.text(`Deslocação: ${folha.distanciaKms} KM (Ida e Volta)`, 14, 55);
  }
  if (folha.pessoaPresente) {
    doc.text(`Pessoa Presente: ${folha.pessoaPresente}`, 14, (folha.distanciaKms && folha.distanciaKms > 0) ? 60 : 55);
  }

  // Right Column - Equipment & Details
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DA VIATURA / EQUIPAMENTO:', 110, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`Matrícula: ${folha.matricula || equipamento?.matricula || 'S/ Matrícula'}`, 110, 40);
  doc.text(`Marca/Modelo: ${folha.marca || ''} ${folha.modelo || ''}`, 110, 45);
  doc.text(`Km: ${folha.kmsAtuais.toLocaleString()} | Horas: ${folha.horasAtuais}h`, 110, 50);
  doc.text(`Data do Serviço: ${folha.data}`, 110, 55);

  // Dates metadata
  const datasMeta = [];
  if (folha.dataEntradaOficina) datasMeta.push(`Entrada Oficina: ${folha.dataEntradaOficina}`);
  if (folha.dataRequisicao) datasMeta.push(`Requisição: ${folha.dataRequisicao}`);
  if (folha.dataConclusao) datasMeta.push(`Conclusão: ${folha.dataConclusao}`);
  
  const headerExtraY = (folha.pessoaPresente && folha.distanciaKms && folha.distanciaKms > 0) ? 66 : 62;

  if (datasMeta.length > 0) {
    doc.setFontSize(8);
    doc.text(datasMeta.join(' | '), 14, headerExtraY);
  }

  // Anomalies / Description
  const anomalyStartY = datasMeta.length > 0 ? headerExtraY + 7 : headerExtraY + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('ANOMALIAS REPORTADAS / PEDIDO:', 14, anomalyStartY);
  doc.setFont('helvetica', 'normal');
  const anomaliaLines = doc.splitTextToSize(folha.anomalias || 'Sem anomalias registadas.', 182);
  doc.text(anomaliaLines, 14, anomalyStartY + 6);

  let currentY = anomalyStartY + 10 + (anomaliaLines.length * 5);

  // Services Table (Mão-de-Obra Efetuada - SEM nome do técnico e SEM coluna de estado)
  const allServices = [
    ...(folha.servicos || []).map(s => ({ ...s, isAdicional: false })),
    ...(folha.servicosAdicionais || []).map(s => ({ ...s, isAdicional: true }))
  ];

  const serviceRows = allServices.map((s, idx) => [
    (idx + 1).toString(),
    s.isAdicional ? `[ADICIONAL] ${s.descricao}` : s.descricao,
    `${s.horas}h`
  ]);

  if (serviceRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Serviço Efetuado / Mão-de-Obra', 'Horas']],
      body: serviceRows,
      theme: 'grid',
      headStyles: { fillColor: [14, 140, 233], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 145 }, 2: { cellWidth: 25 } }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Parts Table (Peças & Materiais - NUNCA mostrar código nem preços)
  const allParts = [
    ...(folha.pecas || []).map(p => ({ ...p, isAdicional: false })),
    ...(folha.pecasAdicionais || []).map(p => ({ ...p, isAdicional: true }))
  ];

  const pecasRows = allParts.map((p, idx) => [
    (idx + 1).toString(),
    p.isAdicional ? `[ADICIONAL] ${p.designacao}` : p.designacao,
    p.qtd.toString()
  ]);

  if (pecasRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Peça / Material Aplicado', 'Qtd']],
      body: pecasRows,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 145 }, 2: { cellWidth: 25 } }
    });
    currentY = (doc as any).lastAutoTable.finalY + 8;
  }

  // Check page overflow
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  // 1. NOTAS PARA O CLIENTE (Antes da Próxima Revisão)
  if (folha.notasCliente) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('NOTAS PARA O CLIENTE:', 14, currentY);
    doc.setFont('helvetica', 'normal');
    const notasLines = doc.splitTextToSize(folha.notasCliente, 182);
    doc.text(notasLines, 14, currentY + 5);
    currentY += 8 + (notasLines.length * 4);
  }

  // 2. Próxima Revisão (Kms e Horas)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Próxima Revisão: ${folha.previsaoRevisaoKms > 0 ? `${folha.previsaoRevisaoKms.toLocaleString()} Kms` : 'N/A'} ${folha.previsaoRevisaoHoras > 0 ? `| ${folha.previsaoRevisaoHoras} Horas` : ''}`, 14, currentY);
  currentY += 6;

  // 3. Linha abaixo da próxima revisão: Serviço Realizado + Iniciais do Técnico
  const initialsSet = new Set<string>();
  allServices.forEach(s => {
    if (s.tecnico) {
      const parts = s.tecnico.trim().split(/\s+/);
      const init = parts.map(p => p[0]?.toUpperCase()).join('');
      if (init) initialsSet.add(init);
    }
  });
  const techInitials = initialsSet.size > 0 ? Array.from(initialsSet).join(', ') : 'HP';

  doc.setFont('helvetica', 'normal');
  doc.text(`Serviço realizado: ${techInitials}`, 14, currentY);

  // Signature Boxes
  currentY += 15;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, currentY + 15, 90, currentY + 15);
  doc.line(120, currentY + 15, 196, currentY + 15);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('O Responsável Técnico (Oficina HP)', 14, currentY + 20);
  doc.text('O Cliente / Responsável do Equipamento', 120, currentY + 20);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Processado por Software Oficina HP • Emitido em ${new Date().toLocaleDateString('pt-PT')} • Página 1`, 105, 290, { align: 'center' });

  // Save / Trigger Download
  doc.save(`${folha.numero}_Folha_Servico_${folha.matricula || 'viatura'}.pdf`);
}

export function generatePropostaPDF(
  proposta: Proposta,
  empresa?: Empresa
) {
  const config = db.getConfig();
  const doc = new jsPDF();

  // Header Banner
  doc.setFillColor(14, 140, 233);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nome.toUpperCase(), 14, 13);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`ORÇAMENTO / PROPOSTA COMERCIAL • ${proposta.numero}`, 14, 22);

  doc.setFontSize(8);
  doc.text(`${config.morada} - ${config.localidade}`, 196, 10, { align: 'right' });
  doc.text(`Tel: ${config.telefone} | Email: ${config.email}`, 196, 15, { align: 'right' });
  doc.text(`NIF: ${config.nif} | IBAN: ${config.iban}`, 196, 20, { align: 'right' });

  // Proposal Meta
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  
  // Left: Customer
  doc.setFont('helvetica', 'bold');
  doc.text('EXMO.(S) SENHOR(ES):', 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(proposta.nomeEmpresa || empresa?.nome || 'Exmo. Cliente', 14, 44);
  doc.text(`NIF: ${empresa?.nif || 'Consumidor Final'}`, 14, 49);
  doc.text(`Contacto / A/C: ${proposta.nomeCliente || 'Direção'}`, 14, 54);

  // Right: Proposal Info
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHES DO ORÇAMENTO:', 120, 38);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data de Emissão: ${proposta.data}`, 120, 44);
  doc.text(`Válido até: ${proposta.dataValidade}`, 120, 49);
  doc.text(`Viatura/Equipamento: ${proposta.matricula || 'Geral'} - ${proposta.marcaModelo || ''}`, 120, 54);

  // Subject Description
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO DOS TRABALHOS / SERVIÇOS:', 14, 65);
  doc.setFont('helvetica', 'normal');
  const descLines = doc.splitTextToSize(proposta.descricao || 'Trabalhos mecânicos e fornecimento de peças.', 182);
  doc.text(descLines, 14, 71);

  let currentY = 75 + (descLines.length * 5);

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
    headStyles: { fillColor: [14, 140, 233], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 75 },
      3: { cellWidth: 12 },
      4: { cellWidth: 20 },
      5: { cellWidth: 15 },
      6: { cellWidth: 14 },
      7: { cellWidth: 24, halign: 'right' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Financial summary box (Right aligned)
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(245, 247, 250);
  doc.roundedRect(120, currentY, 76, 32, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Total S/ IVA:', 125, currentY + 8);
  doc.text(`${proposta.totalSemIva.toFixed(2)} €`, 190, currentY + 8, { align: 'right' });

  doc.text('Total IVA:', 125, currentY + 16);
  doc.text(`${proposta.totalIva.toFixed(2)} €`, 190, currentY + 16, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL C/ IVA:', 125, currentY + 26);
  doc.text(`${proposta.totalComIva.toFixed(2)} €`, 190, currentY + 26, { align: 'right' });

  // Terms & Conditions (Left of summary)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CONDIÇÕES COMERCIAIS:', 14, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Condições de Pagamento: ${proposta.condicoesPagamento || 'Pronto Pagamento'}`, 14, currentY + 15);
  doc.text(`• Prazo de Execução/Entrega: ${proposta.prazoEntrega || 'A combinar'}`, 14, currentY + 21);
  doc.text(`• Garantia: ${proposta.garantia || 'Garantia legal de peças e mão-de-obra'}`, 14, currentY + 27);

  // Approval Box
  currentY += 42;
  doc.setDrawColor(200, 200, 200);
  doc.rect(14, currentY, 182, 22);
  doc.setFontSize(8);
  doc.text('Aceitação e Adjudicação da Proposta (Carimbo / Assinatura do Cliente):', 18, currentY + 6);
  doc.text('Data: _____ / _____ / 2026', 18, currentY + 16);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Proposta Comercial válida até ${proposta.dataValidade} • Processado por Oficina HP`, 105, 290, { align: 'center' });

  doc.save(`${proposta.numero}_Proposta_${proposta.nomeEmpresa.replace(/\s+/g, '_')}.pdf`);
}

export function generateGuiaEnvioPDF(guia: GuiaEnvio) {
  const config = db.getConfig();
  const doc = new jsPDF();

  // Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(config.nome.toUpperCase(), 14, 12);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`GUIA DE ENVIO / TRANSPORTE DE MATERIAIS • ${guia.numero}`, 14, 19);

  // Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  
  doc.setFont('helvetica', 'bold');
  doc.text('ORIGEM / EXPEDIÇÃO:', 14, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(guia.empresaOrigem || config.nome, 14, 41);
  doc.text(config.morada, 14, 46);

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATÁRIO / ESTALEIRO:', 110, 35);
  doc.setFont('helvetica', 'normal');
  doc.text(guia.empresaDestino, 110, 41);
  doc.text(guia.moradaDestino, 110, 46);
  doc.text(`Viatura de Transporte: ${guia.matriculaViaturaTransporte || 'Própria'} | Motorista: ${guia.motorista || 'N/A'}`, 110, 52);

  // Material rows
  const matRows = guia.materiais.map((m, idx) => [
    (idx + 1).toString(),
    m.referencia || '-',
    m.descricao,
    m.quantidade.toString(),
    m.unidade || 'Un'
  ]);

  autoTable(doc, {
    startY: 62,
    head: [['#', 'Referência', 'Descrição do Material / Equipamento', 'Quantidade', 'Unidade']],
    body: matRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 25;

  doc.line(14, finalY, 90, finalY);
  doc.line(120, finalY, 196, finalY);
  doc.setFontSize(8);
  doc.text('Assinatura do Expedidor', 14, finalY + 6);
  doc.text('Assinatura / Receção do Destinatário', 120, finalY + 6);

  doc.save(`${guia.numero}_Guia_Envio.pdf`);
}
