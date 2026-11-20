import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WorkReportRecord, WorkReportStatus, WorkReportType } from '../types';

const TYPE_LABELS: Record<WorkReportType, string> = {
  RAPPORT_MISSION: 'RAPPORT DE MISSION OFFICIEL',
  RAPPORT_TRAVAIL_HEBDO: 'RAPPORT DE TRAVAIL HEBDOMADAIRE',
  RAPPORT_TRAVAIL_MENSUEL: 'RAPPORT D’ACTIVITE MENSUEL',
  RAPPORT_PROJET: 'RAPPORT D’AVANCEMENT PROJET',
  RAPPORT_DIRECTION: 'RAPPORT CONSOLIDE DE DIRECTION',
};

const STATUS_LABELS: Record<WorkReportStatus, string> = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis pour validation',
  REVISION_DEMANDEE: 'Révision demandée',
  VALIDE: 'Validé & Approuvé',
  ARCHIVE: 'Archivé',
};

function pdfSafe(value: string): string {
  return String(value || '')
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u2022/g, '-');
}

function getLastTableY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || fallback;
}

export function exportWorkReportPdf(
  report: WorkReportRecord,
  organizationName = 'TERANGA PRESTIGE DIGITAL',
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;

  // Institutional Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 34, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  doc.setTextColor(167, 243, 208);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(pdfSafe(TYPE_LABELS[report.type]), margin, 10);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14.5);
  doc.text(pdfSafe(organizationName.toUpperCase()), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  const titleLines = doc.splitTextToSize(pdfSafe(report.title), 125);
  doc.text(titleLines.slice(0, 2), margin, 24.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfSafe(`N° ${report.reference}`), pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208);
  doc.text(pdfSafe(`Statut : ${STATUS_LABELS[report.status]}`), pageWidth - margin, 19, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(pdfSafe(`Complétude : ${report.completenessPct}%`), pageWidth - margin, 25.5, { align: 'right' });

  // Metadata Table
  autoTable(doc, {
    startY: 42,
    head: [['REDACTEUR & ENTITE', 'CADRE, PERIODE & REFERENCES']],
    body: [
      [
        pdfSafe(
          `Auteur : ${report.authorName}\nFonction : ${report.authorJobTitle} (${report.authorRole})\nDépartement : ${report.department}`,
        ),
        pdfSafe(
          `Période : ${report.periodLabel} (${report.startDate} au ${report.endDate})\nLieu / Site : ${report.location || 'Siège'}\n${report.linkedMissionRef ? `Ordre de mission : ${report.linkedMissionRef}` : 'Rapport d’activité interne'}${report.linkedTaskCodes.length > 0 ? `\nTâches liées : ${report.linkedTaskCodes.join(', ')}` : ''}`,
        ),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3.2, textColor: [30, 41, 59], lineColor: [203, 213, 225] },
    headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
  });

  let cursorY = getLastTableY(doc, 82) + 6;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 22) {
      doc.addPage();
      cursorY = 18;
    }
  };

  const renderSection = (heading: string, bodyText: string, highlight = false) => {
    const clean = pdfSafe(bodyText || 'Non renseigné.');
    const wrapped = doc.splitTextToSize(clean, maxWidth - (highlight ? 6 : 0));
    const blockHeight = 8 + wrapped.length * 4.5 + 4;
    ensureSpace(Math.min(blockHeight, 48));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe(heading), margin, cursorY);
    cursorY += 4.5;

    if (highlight) {
      const boxHeight = wrapped.length * 4.5 + 6;
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(167, 243, 208);
      doc.roundedRect(margin, cursorY - 2, maxWidth, boxHeight, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(30, 41, 59);
      doc.text(wrapped, margin + 3, cursorY + 3);
      cursorY += boxHeight + 4;
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(51, 65, 85);
      for (const line of wrapped) {
        if (cursorY > pageHeight - 20) {
          doc.addPage();
          cursorY = 18;
        }
        doc.text(line, margin, cursorY);
        cursorY += 4.5;
      }
      cursorY += 4;
    }
  };

  renderSection('SYNTHESE EXECUTIVE', report.executiveSummary, true);
  renderSection('1. CONTEXTE & OBJECTIFS', report.contextAndObjectives);
  renderSection('2. ACTIVITES REALISEES & LIVRABLES', report.activitiesAndDeliverables);
  renderSection('3. DIFFICULTES, ECARTS & RISQUES', report.difficultiesAndRisks);
  renderSection('4. RECOMMANDATIONS & PROCHAINES ETAPES', report.recommendationsAndNextSteps);

  if (report.kpis.length > 0) {
    ensureSpace(32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe('5. INDICATEURS CHIFFRES (KPI)'), margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Indicateur', 'Cible', 'Réalisé', 'Unité', 'Statut']],
      body: report.kpis.map((k) => [
        pdfSafe(k.label),
        pdfSafe(k.targetValue || '-'),
        pdfSafe(k.actualValue || '-'),
        pdfSafe(k.unit || '-'),
        pdfSafe(k.status),
      ]),
      theme: 'striped',
      styles: { fontSize: 8.3, cellPadding: 2.5, textColor: [30, 41, 59] },
      headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    });
    cursorY = getLastTableY(doc, cursorY + 25) + 7;
  }

  if (report.actionPlan.length > 0) {
    ensureSpace(32);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafe('6. PLAN D’ACTION & SUIVI'), margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Action / Décision', 'Responsable', 'Échéance', 'Priorité', 'Statut']],
      body: report.actionPlan.map((a) => [
        pdfSafe(a.action),
        pdfSafe(a.owner || '-'),
        pdfSafe(a.deadline || '-'),
        pdfSafe(a.priority),
        pdfSafe(a.status),
      ]),
      theme: 'grid',
      styles: { fontSize: 8.3, cellPadding: 2.5, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    });
    cursorY = getLastTableY(doc, cursorY + 25) + 7;
  }

  if (report.attachmentsNote) {
    renderSection('PIECES JOINTES & REFERENCES DOCUMENTAIRES', report.attachmentsNote);
  }

  ensureSpace(32);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafe('CIRCUIT DE REDACTION & VISAS HIERARCHIQUES'), margin, cursorY);
  autoTable(doc, {
    startY: cursorY + 3,
    head: [['Étape', 'Acteur', 'Rôle', 'Date & Heure', 'Observation']],
    body: report.reviewTrail.map((step) => [
      pdfSafe(step.stepLabel),
      pdfSafe(step.actorName),
      pdfSafe(step.actorRole),
      pdfSafe(new Date(step.timestamp).toLocaleString('fr-FR')),
      pdfSafe(step.note || '-'),
    ]),
    theme: 'grid',
    styles: { fontSize: 7.8, cellPadding: 2.3, textColor: [51, 65, 85], lineColor: [226, 232, 240] },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
  });

  // Page numbers & footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafe(`${organizationName} · ${report.reference} · Document interne`),
      margin,
      pageHeight - 8.5,
    );
    doc.text(pdfSafe(`Page ${p}/${pageCount}`), pageWidth - margin, pageHeight - 8.5, { align: 'right' });
  }

  const fileName = `${report.reference}.pdf`;
  doc.save(fileName);
  return fileName;
}
