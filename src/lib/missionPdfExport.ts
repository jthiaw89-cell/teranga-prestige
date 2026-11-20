import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  MissionAgentCategory,
  MissionOrderRecord,
  MissionStatus,
  MissionTransportMode,
  MissionZone,
} from '../types';

const ZONE_LABELS: Record<MissionZone, string> = {
  DAKAR_PERIPHERIE: 'Dakar / Diamniadio / Thiès (Périphérie)',
  SENEGAL_INTERIEUR: 'Intérieur du Sénégal (Régions)',
  UEMOA_AFRIQUE: 'Zone UEMOA / Afrique',
  HORS_AFRIQUE: 'Hors Afrique (International)',
};

const CATEGORY_LABELS: Record<MissionAgentCategory, string> = {
  CAT_A_HAUTE_DIRECTION: 'Catégorie A — Haute Direction / SG / Inspecteurs',
  CAT_B_CADRE: 'Catégorie B — Chefs de Service / Cadres',
  CAT_C_EXECUTION: 'Catégorie C — Agents d’exécution / Logistique',
};

const TRANSPORT_LABELS: Record<MissionTransportMode, string> = {
  VEHICULE_ADMIN: 'Véhicule administratif de service',
  TRANSPORT_PUBLIC: 'Transport public / interurbain',
  AVION: 'Transport aérien (Avion)',
  VEHICULE_PERSONNEL: 'Véhicule personnel autorisé',
};

const STATUS_LABELS: Record<MissionStatus, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS_N1: 'En attente Visa N+1',
  VISA_DAGE: 'En attente Visa DAGE / SG',
  APPROUVE_SG: 'Signé & Autorisé (SG)',
  EN_MISSION: 'En cours de mission',
  RAPPORT_DEPOSE: 'Rapport déposé — À liquider',
  CLOTURE: 'Clôturé & Soldé',
  REJETE: 'Rejeté',
};

function formatPdfFcfa(amount: number): string {
  const rounded = Math.round(amount || 0);
  const formatted = String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
}

function pdfSafe(value: string): string {
  return String(value || '')
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, '-');
}

export function exportMissionOrderPdf(
  mission: MissionOrderRecord,
  organizationName = 'TERANGA PRESTIGE DIGITAL',
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Official Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(16, 185, 129); // emerald-500 institutional strip
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(pdfSafe('REPUBLIQUE DU SENEGAL · ADMINISTRATION & INSTITUTION'), 14, 10.5);

  doc.setFontSize(15);
  doc.text(pdfSafe(organizationName.toUpperCase()), 14, 18.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(pdfSafe('ORDRE DE MISSION OFFICIEL & ETAT DE FRAIS DE DEPLACEMENT'), 14, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafe(`N° ${mission.reference}`), pageWidth - 14, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208);
  doc.text(pdfSafe(`Statut : ${STATUS_LABELS[mission.status]}`), pageWidth - 14, 20, {
    align: 'right',
  });
  doc.setTextColor(203, 213, 225);
  doc.text(pdfSafe(`Code vérif. : ${mission.verificationQrCode}`), pageWidth - 14, 26, {
    align: 'right',
  });

  // Agent & Itinerary Summary Grid
  autoTable(doc, {
    startY: 42,
    head: [['IDENTITE DE L’AGENT MISSIONNE', 'CADRE & ITINERAIRE DE LA MISSION']],
    body: [
      [
        pdfSafe(
          `Nom complet : ${mission.agentName}\nFonction : ${mission.agentJobTitle}\nDirection / Pôle : ${mission.department}\nBarème : ${CATEGORY_LABELS[mission.agentCategory]}`,
        ),
        pdfSafe(
          `Objet : ${mission.title}\nDestination : ${mission.destination}\nZone tarifaire : ${ZONE_LABELS[mission.zone]}\nPériode : du ${mission.departureDate} au ${mission.returnDate} (${mission.daysCount} jour(s))\nMoyen de transport : ${TRANSPORT_LABELS[mission.transportMode]}${mission.vehicleName ? ` (${mission.vehicleName})` : ''}`,
        ),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59], lineColor: [203, 213, 225] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
  });

  const afterInfoY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 95) + 6;

  // Expense & Per Diem Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe('DECOMPTE PREVISIONNEL & REEL DES FRAIS (FCFA)'), 14, afterInfoY);

  autoTable(doc, {
    startY: afterInfoY + 3,
    head: [['Poste de dépense', 'Justificatif / Réf.', 'Prévu (FCFA)', 'Réel (FCFA)']],
    body: mission.expenseLines.map((line) => [
      pdfSafe(line.label),
      pdfSafe(line.receiptRef || '-'),
      formatPdfFcfa(line.estimatedFcfa),
      line.actualFcfa !== undefined ? formatPdfFcfa(line.actualFcfa) : '-',
    ]),
    foot: [
      [
        'TOTAL ENGAGEMENT / LIQUIDATION',
        pdfSafe(`Avance versée (${mission.advanceRequestedPct}%) : ${formatPdfFcfa(mission.advancePaidFcfa)}`),
        formatPdfFcfa(mission.totalEstimatedFcfa),
        mission.actualSpentFcfa !== undefined ? formatPdfFcfa(mission.actualSpentFcfa) : '-',
      ],
    ],
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 2.8, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
  });

  const afterExpensesY =
    ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 155) + 7;

  // Approval Signatures & Visa Trail
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe('CIRCUIT DES VISAS & SIGNATURES ELECTRONIQUES'), 14, afterExpensesY);

  autoTable(doc, {
    startY: afterExpensesY + 3,
    head: [['Étape de validation', 'Autorité / Acteur', 'Date & Heure', 'Observation']],
    body: mission.approvalTrail.map((step) => [
      pdfSafe(step.stepLabel),
      pdfSafe(step.actorName),
      pdfSafe(new Date(step.timestamp).toLocaleString('fr-FR')),
      pdfSafe(step.note || 'Visé électroniquement'),
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [51, 65, 85], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
  });

  if (mission.missionReportSummary) {
    const afterTrailY =
      ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 215) + 7;
    if (afterTrailY < pageHeight - 34) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(pdfSafe('COMPTE RENDU DE MISSION'), 14, afterTrailY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const splitReport = doc.splitTextToSize(pdfSafe(mission.missionReportSummary), pageWidth - 28);
      doc.text(splitReport, 14, afterTrailY + 5);
    }
  }

  // Footer
  doc.setDrawColor(203, 213, 225);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    pdfSafe(
      `Document généré automatiquement · Vérification authenticité : ${mission.verificationQrCode} · Devise : FCFA (XOF)`,
    ),
    14,
    pageHeight - 10,
  );

  const fileName = `${mission.reference}.pdf`;
  doc.save(fileName);
  return fileName;
}
