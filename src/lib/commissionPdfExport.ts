import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CommissionRecord, CommissionStatus } from '../types';

export interface MonthlyCommissionSummaryRow {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  instructorCommissionFcfa: number;
  providerCommissionFcfa: number;
  totalCommissionFcfa: number;
  grossVolumeFcfa: number;
  operationsCount: number;
}

export interface ExportMonthlyCommissionPdfOptions {
  records: CommissionRecord[];
  monthlyRows: MonthlyCommissionSummaryRow[];
  selectedMonthKey?: string; // 'ALL' or 'YYYY-MM'
  periodLabel: string;
  generatedBy?: string;
}

const STATUS_LABELS: Record<CommissionStatus, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  PRELEVEE: 'Prélevée',
  REVERSE_PARTENAIRE: 'Reversée partenaire',
  ANNULEE: 'Annulée',
};

function formatPdfFcfa(amount: number): string {
  const rounded = Math.round(amount || 0);
  const formatted = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

function pdfSafeText(value: string): string {
  return String(value || '')
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, '-');
}

export function exportMonthlyCommissionsPdf({
  records,
  monthlyRows,
  selectedMonthKey = 'ALL',
  periodLabel,
  generatedBy = 'Administration Superadmin',
}: ExportMonthlyCommissionPdfOptions): { fileName: string; recordsCount: number } {
  const isSingleMonth = selectedMonthKey !== 'ALL';
  const scopedRecords = records.filter((r) => {
    if (r.status === 'ANNULEE') return false;
    if (!isSingleMonth) return true;
    const key = (r.transactionDate || r.createdAt || '').slice(0, 7);
    return key === selectedMonthKey;
  });

  const scopedMonthlyRows = isSingleMonth
    ? monthlyRows.filter((m) => m.monthKey === selectedMonthKey)
    : monthlyRows;

  const targetMonthLabel =
    isSingleMonth && scopedMonthlyRows[0]
      ? scopedMonthlyRows[0].fullMonthLabel
      : periodLabel;

  const totalGross = scopedRecords.reduce((s, r) => s + r.grossAmountFcfa, 0);
  const totalCommission = scopedRecords.reduce((s, r) => s + r.commissionAmountFcfa, 0);
  const totalNetPartner = scopedRecords.reduce((s, r) => s + r.netPartnerAmountFcfa, 0);
  const instructorCommission = scopedRecords
    .filter((r) => r.beneficiaryType === 'INSTRUCTOR')
    .reduce((s, r) => s + r.commissionAmountFcfa, 0);
  const providerCommission = scopedRecords
    .filter((r) => r.beneficiaryType === 'PROVIDER')
    .reduce((s, r) => s + r.commissionAmountFcfa, 0);
  const collectedCommission = scopedRecords
    .filter((r) => r.status === 'PRELEVEE' || r.status === 'REVERSE_PARTENAIRE')
    .reduce((s, r) => s + r.commissionAmountFcfa, 0);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const nowDate = new Date();
  const dateDisplay = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(nowDate);
  const reportRef = `BIL-COM-${isSingleMonth ? selectedMonthKey.replace('-', '') : nowDate.toISOString().slice(0, 7).replace('-', '')}`;

  // Executive Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setFillColor(37, 99, 235); // blue-600 accent strip
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TERANGA PRESTIGE DIGITAL', 14, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(191, 219, 254);
  doc.text(
    pdfSafeText('Bilan Financier Mensuel des Commissions - Formateurs Pro & Prestataires'),
    14,
    18.5,
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafeText(`Réf. : ${reportRef}`), pageWidth - 14, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(pdfSafeText(`Période : ${targetMonthLabel}`), pageWidth - 14, 16.5, { align: 'right' });
  doc.text(pdfSafeText(`Édité le ${dateDisplay}`), pageWidth - 14, 21.5, { align: 'right' });

  // KPI Financial Strip (4 Cards)
  const cardTop = 34;
  const cardGap = 4;
  const cardWidth = (pageWidth - 28 - cardGap * 3) / 4;
  const cardHeight = 20;

  const kpiCards = [
    {
      label: 'VOLUME BRUT PRESTATIONS',
      value: formatPdfFcfa(totalGross),
      sub: `${scopedRecords.length} opération(s) actives`,
      border: [203, 213, 225] as const,
      bg: [248, 250, 252] as const,
      valColor: [15, 23, 42] as const,
    },
    {
      label: 'COMMISSIONS GÉNÉRÉES',
      value: formatPdfFcfa(totalCommission),
      sub: `Formateurs: ${formatPdfFcfa(instructorCommission)}`,
      border: [147, 197, 253] as const,
      bg: [239, 246, 255] as const,
      valColor: [29, 78, 216] as const,
    },
    {
      label: 'ENCAISSÉES & SOLDÉES',
      value: formatPdfFcfa(collectedCommission),
      sub: `Prestataires: ${formatPdfFcfa(providerCommission)}`,
      border: [110, 231, 183] as const,
      bg: [236, 253, 245] as const,
      valColor: [4, 120, 87] as const,
    },
    {
      label: 'NET PARTENAIRES',
      value: formatPdfFcfa(totalNetPartner),
      sub: `Devise : Franc CFA (XOF)`,
      border: [203, 213, 225] as const,
      bg: [248, 250, 252] as const,
      valColor: [15, 23, 42] as const,
    },
  ];

  kpiCards.forEach((card, idx) => {
    const x = 14 + idx * (cardWidth + cardGap);
    doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
    doc.setDrawColor(card.border[0], card.border[1], card.border[2]);
    doc.roundedRect(x, cardTop, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafeText(card.label), x + 3.5, cardTop + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(card.valColor[0], card.valColor[1], card.valColor[2]);
    doc.text(pdfSafeText(card.value), x + 3.5, cardTop + 12.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(pdfSafeText(card.sub), x + 3.5, cardTop + 17.2);
  });

  // Section 1: Synthèse Mensuelle par Segment
  let nextY = cardTop + cardHeight + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafeText('1. Synthèse mensuelle par segment (hors opérations annulées)'), 14, nextY);

  const monthlyTableBody = scopedMonthlyRows.map((m) => {
    const monthGross = records
      .filter(
        (r) =>
          r.status !== 'ANNULEE' &&
          (r.transactionDate || r.createdAt || '').slice(0, 7) === m.monthKey,
      )
      .reduce((s, r) => s + r.grossAmountFcfa, 0);
    const monthNet = Math.max(0, monthGross - m.totalCommissionFcfa);
    return [
      pdfSafeText(m.fullMonthLabel),
      String(m.operationsCount),
      formatPdfFcfa(monthGross),
      formatPdfFcfa(m.instructorCommissionFcfa),
      formatPdfFcfa(m.providerCommissionFcfa),
      formatPdfFcfa(m.totalCommissionFcfa),
      formatPdfFcfa(monthNet),
    ];
  });

  autoTable(doc, {
    startY: nextY + 3,
    head: [
      [
        'Mois',
        'Opérations',
        'Volume Brut',
        'Comm. Formateurs',
        'Comm. Prestataires',
        'Total Commissions',
        'Net Partenaires',
      ],
    ],
    body:
      monthlyTableBody.length > 0
        ? monthlyTableBody
        : [['Aucune donnée sur la période sélectionnée', '0', '0 FCFA', '0 FCFA', '0 FCFA', '0 FCFA', '0 FCFA']],
    foot: [
      [
        'TOTAL PÉRIODE',
        String(scopedRecords.length),
        formatPdfFcfa(totalGross),
        formatPdfFcfa(instructorCommission),
        formatPdfFcfa(providerCommission),
        formatPdfFcfa(totalCommission),
        formatPdfFcfa(totalNetPartner),
      ],
    ],
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.3, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [239, 246, 255], textColor: [29, 78, 216], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
    },
  });

  nextY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 25) + 7;

  // Section 2: Ventilation par Statut
  const statuses: CommissionStatus[] = ['EN_ATTENTE', 'VALIDEE', 'PRELEVEE', 'REVERSE_PARTENAIRE'];
  const statusRows = statuses.map((st) => {
    const subset = scopedRecords.filter((r) => r.status === st);
    return [
      pdfSafeText(STATUS_LABELS[st]),
      String(subset.length),
      formatPdfFcfa(subset.reduce((s, r) => s + r.grossAmountFcfa, 0)),
      formatPdfFcfa(subset.reduce((s, r) => s + r.commissionAmountFcfa, 0)),
      formatPdfFcfa(subset.reduce((s, r) => s + r.netPartnerAmountFcfa, 0)),
    ];
  });

  if (nextY > pageHeight - 50) {
    doc.addPage();
    nextY = 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafeText('2. Ventilation par statut de règlement'), 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Statut', 'Dossiers', 'Volume Brut', 'Commissions Plateforme', 'Net Partenaires']],
    body: statusRows,
    theme: 'striped',
    margin: { left: 14, right: 14 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  nextY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? nextY + 25) + 7;

  if (nextY > pageHeight - 45) {
    doc.addPage();
    nextY = 16;
  }

  // Section 3: Registre détaillé des opérations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafeText(`3. Détail des opérations (${scopedRecords.length} écriture(s))`), 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [
      [
        'Réf.',
        'Date',
        'Partenaire',
        'Segment',
        'Prestation / Formation',
        'Brut',
        'Taux',
        'Commission',
        'Net Part.',
        'Statut',
      ],
    ],
    body:
      scopedRecords.length > 0
        ? scopedRecords.map((r) => [
            pdfSafeText(r.reference),
            pdfSafeText(r.transactionDate),
            pdfSafeText(r.beneficiaryName),
            r.beneficiaryType === 'INSTRUCTOR' ? 'Formateur' : 'Prestataire',
            pdfSafeText(r.sourceTitle),
            formatPdfFcfa(r.grossAmountFcfa),
            `${r.appliedRatePercent}%`,
            formatPdfFcfa(r.commissionAmountFcfa),
            formatPdfFcfa(r.netPartnerAmountFcfa),
            pdfSafeText(
              r.payoutReference
                ? `${STATUS_LABELS[r.status]} (${r.payoutReference})`
                : STATUS_LABELS[r.status],
            ),
          ])
        : [['-', '-', 'Aucune opération sur cette période', '-', '-', '0 FCFA', '-', '0 FCFA', '0 FCFA', '-']],
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 7.4, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      4: { cellWidth: 60 },
      5: { halign: 'right' },
      6: { halign: 'center' },
      7: { halign: 'right', fontStyle: 'bold' },
      8: { halign: 'right' },
    },
  });

  // Footer with page numbering on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafeText(`Teranga Prestige Digital - Bilan financier certifié (${generatedBy})`),
      14,
      pageHeight - 6.5,
    );
    doc.text(pdfSafeText(`Page ${i} / ${pageCount}`), pageWidth - 14, pageHeight - 6.5, {
      align: 'right',
    });
  }

  const fileName = isSingleMonth
    ? `bilan-commissions-${selectedMonthKey}.pdf`
    : `bilan-commissions-mensuel-${nowDate.toISOString().slice(0, 10)}.pdf`;

  doc.save(fileName);
  return { fileName, recordsCount: scopedRecords.length };
}
