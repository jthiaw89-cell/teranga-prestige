import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import type {
  AttendanceEntry,
  CommsOverviewPayload,
  DelegationRecord,
  DirectoryMemberRecord,
  DocumentClassification,
  DynamicFormTemplate,
  EmployeeHrProfile,
  GedDocumentRecord,
  GedFolder,
  GedOverviewPayload,
  HrAlertItem,
  HrAttestationRecord,
  HrOverviewPayload,
  InstitutionalMailDirection,
  InstitutionalMailRecord,
  InternalPollRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeCode,
  LeaveTypeRule,
  MissionAgentCategory,
  MissionCalculationBreakdown,
  MissionDestinationCity,
  MissionExpenseLine,
  MissionOrderRecord,
  MissionOverviewPayload,
  MissionPerDiemTariff,
  MissionStatus,
  MissionTransportMode,
  MissionZone,
  NotificationItem,
  NotificationPreferences,
  NotificationsOverviewPayload,
  OfficialMemoImportance,
  OfficialMemoRecord,
  OperationsOverviewPayload,
  OrgAdminOverviewPayload,
  OrgApiToken,
  OrgBackupSnapshot,
  OrgSite,
  OrgThemeConfig,
  OrgUnitNode,
  OrgWebhook,
  SenegalHoliday,
  ServiceHealthMetric,
  SharedAvailabilityPayload,
  SharedAvailabilityPermissionScope,
  SharedColleagueProfile,
  SharedResourceBooking,
  SharedUnavailabilityBlock,
  SuperadminTenantsPayload,
  SupportTicketRecord,
  TenantInvoiceRecord,
  TenantPlanTier,
  TenantRecord,
  TenantStatus,
  VisitorLogRecord,
  WorkReportActionItem,
  WorkReportKpiItem,
  WorkReportMissionOption,
  WorkReportRecord,
  WorkReportStatus,
  WorkReportTaskOption,
  WorkReportTemplate,
  WorkReportType,
  WorkReportsOverviewPayload,
  WorkflowCategory,
  WorkflowInstanceRecord,
  WorkflowsOverviewPayload,
} from '../src/types.js';
import { store } from './db.js';
import { registerModulePersistence } from './persistence.js';

export interface ActiveActorContext {
  id: string;
  space: 'intranet' | 'accounting' | 'learner' | 'instructor' | 'provider' | 'superadmin';
  role: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

export interface RegisterCahierDeps {
  getActiveActor: (req: Request) => ActiveActorContext | null;
  addAuditLog: (entry: {
    actorId: string;
    actorName: string;
    actorSpace: ActiveActorContext['space'];
    action: string;
    target: string;
    details: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
  }) => void;
}

// --- Seed Data ---

const senegalHolidays: SenegalHoliday[] = [
  { id: 'hol-1', date: '2026-01-01', label: 'Jour de l’An', category: 'NATIONAL', isMobile: false },
  { id: 'hol-2', date: '2026-03-20', label: 'Korité (Aïd el-Fitr — estimé)', category: 'RELIGIEUX', isMobile: true },
  { id: 'hol-3', date: '2026-04-04', label: 'Fête de l’Indépendance du Sénégal', category: 'NATIONAL', isMobile: false },
  { id: 'hol-4', date: '2026-05-01', label: 'Fête du Travail', category: 'NATIONAL', isMobile: false },
  { id: 'hol-5', date: '2026-05-27', label: 'Tabaski (Aïd el-Kébir — estimé)', category: 'RELIGIEUX', isMobile: true },
  { id: 'hol-6', date: '2026-06-26', label: 'Tamkharit (Achoura)', category: 'RELIGIEUX', isMobile: true },
  { id: 'hol-7', date: '2026-08-15', label: 'Assomption', category: 'RELIGIEUX', isMobile: false },
  { id: 'hol-8', date: '2026-08-25', label: 'Gamou (Maouloud — estimé)', category: 'RELIGIEUX', isMobile: true },
  { id: 'hol-9', date: '2026-09-02', label: 'Grand Magal de Touba', category: 'RELIGIEUX', isMobile: true },
  { id: 'hol-10', date: '2026-11-01', label: 'Toussaint', category: 'RELIGIEUX', isMobile: false },
  { id: 'hol-11', date: '2026-12-25', label: 'Noël', category: 'RELIGIEUX', isMobile: false },
];

const leaveRules: LeaveTypeRule[] = [
  { code: 'ANNUEL', label: 'Congé annuel payé (Code du Travail SN)', annualAllowanceDays: 24, monthlyAccrualDays: 2, carryoverMaxDays: 12, requiresJustification: false, noticeDays: 7, paid: true },
  { code: 'MALADIE', label: 'Congé maladie (avec certificat médical)', annualAllowanceDays: 15, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: true, noticeDays: 0, paid: true },
  { code: 'MATERNITE_PATERNITE', label: 'Congé maternité / paternité', annualAllowanceDays: 98, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: true, noticeDays: 14, paid: true },
  { code: 'MARIAGE', label: 'Permission exceptionnelle mariage', annualAllowanceDays: 3, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: true, noticeDays: 7, paid: true },
  { code: 'DECES', label: 'Permission exceptionnelle décès familial', annualAllowanceDays: 4, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: true, noticeDays: 0, paid: true },
  { code: 'RECUPERATION', label: 'Récupération heures supplémentaires', annualAllowanceDays: 10, monthlyAccrualDays: 0, carryoverMaxDays: 5, requiresJustification: false, noticeDays: 2, paid: true },
  { code: 'MISSION', label: 'Ordre de mission / Déplacement officiel', annualAllowanceDays: 30, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: false, noticeDays: 1, paid: true },
  { code: 'SANS_SOLDE', label: 'Congé sans solde', annualAllowanceDays: 30, monthlyAccrualDays: 0, carryoverMaxDays: 0, requiresJustification: false, noticeDays: 15, paid: false },
];

const hrProfiles: EmployeeHrProfile[] = [
  {
    userId: 'int-u-1',
    matricule: 'TPD-001',
    name: 'Cheikh Tidiane Fall',
    email: 'direction@teranga-demo.sn',
    phone: '+221 77 632 10 01',
    organizationId: 'tpd-demo-intranet',
    department: 'Direction Générale',
    service: 'Présidence & Stratégie',
    site: 'Dakar Plateau',
    jobTitle: 'Directeur Général',
    managerName: 'Conseil d’Administration',
    contractType: 'CDI',
    hireDate: '2021-02-01',
    medicalVisitDate: '2026-12-10',
    idExpiryDate: '2029-05-14',
    workCycle: 'FIXE_08_17',
    seniorityYears: 5,
  },
  {
    userId: 'int-u-2',
    matricule: 'TPD-014',
    name: 'Fatou Binetou Sarr',
    email: 'manager@teranga-demo.sn',
    phone: '+221 77 540 22 18',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    service: 'Production & Protocole',
    site: 'Dakar Plateau',
    jobTitle: 'Responsable Pôle Événementiel',
    managerName: 'Cheikh Tidiane Fall',
    contractType: 'CDI',
    hireDate: '2022-06-15',
    medicalVisitDate: '2026-11-28',
    idExpiryDate: '2028-03-19',
    workCycle: 'HYBRIDE',
    seniorityYears: 4,
  },
  {
    userId: 'int-u-3',
    matricule: 'TPD-029',
    name: 'Moussa Ndiaye',
    email: 'employe@teranga-demo.sn',
    phone: '+221 78 411 90 45',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    service: 'Logistique Terrain',
    site: 'Diamniadio',
    jobTitle: 'Chargé de Logistique',
    managerName: 'Fatou Binetou Sarr',
    contractType: 'CDD',
    hireDate: '2025-01-10',
    contractEndDate: '2026-12-31',
    probationEndDate: '2025-04-10',
    medicalVisitDate: '2026-11-25',
    idExpiryDate: '2027-01-18',
    workCycle: 'ROTATION_EQUIPE',
    seniorityYears: 1,
  },
  {
    userId: 'acc-u-1',
    matricule: 'TPD-008',
    name: 'Amadou Konté',
    email: 'comptabilite@teranga-demo.sn',
    phone: '+221 77 312 45 80',
    organizationId: 'tpd-demo-accounting',
    department: 'Finance & SYSCOHADA',
    service: 'Comptabilité Générale',
    site: 'Dakar Plateau',
    jobTitle: 'Directeur Administratif & Financier',
    managerName: 'Cheikh Tidiane Fall',
    contractType: 'CDI',
    hireDate: '2021-09-01',
    medicalVisitDate: '2027-02-15',
    idExpiryDate: '2028-11-30',
    workCycle: 'FIXE_08_17',
    seniorityYears: 5,
  },
];

const leaveBalances: LeaveBalanceRecord[] = [
  { userId: 'int-u-1', leaveType: 'ANNUEL', acquiredDays: 24, usedDays: 6, pendingDays: 0, remainingDays: 18 },
  { userId: 'int-u-1', leaveType: 'RECUPERATION', acquiredDays: 4, usedDays: 1, pendingDays: 0, remainingDays: 3 },
  { userId: 'int-u-2', leaveType: 'ANNUEL', acquiredDays: 22, usedDays: 5, pendingDays: 3, remainingDays: 14 },
  { userId: 'int-u-2', leaveType: 'RECUPERATION', acquiredDays: 5, usedDays: 2, pendingDays: 0, remainingDays: 3 },
  { userId: 'int-u-3', leaveType: 'ANNUEL', acquiredDays: 20, usedDays: 4, pendingDays: 2, remainingDays: 14 },
  { userId: 'int-u-3', leaveType: 'RECUPERATION', acquiredDays: 3, usedDays: 0, pendingDays: 0, remainingDays: 3 },
  { userId: 'acc-u-1', leaveType: 'ANNUEL', acquiredDays: 24, usedDays: 8, pendingDays: 0, remainingDays: 16 },
  { userId: 'acc-u-1', leaveType: 'RECUPERATION', acquiredDays: 2, usedDays: 0, pendingDays: 0, remainingDays: 2 },
];

const leaveRequests: LeaveRequestRecord[] = [
  {
    id: 'lvr-1',
    reference: 'CNG-2026-041',
    userId: 'int-u-3',
    userName: 'Moussa Ndiaye',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    site: 'Diamniadio',
    leaveType: 'ANNUEL',
    startDate: '2026-11-24',
    endDate: '2026-11-25',
    halfDay: 'FULL',
    workingDays: 2,
    reason: 'Démarches familiales à Thiès après montage Sommet Diamniadio.',
    status: 'EN_ATTENTE',
    currentApproverName: 'Fatou Binetou Sarr',
    createdAt: '2026-11-17T10:15:00Z',
  },
  {
    id: 'lvr-2',
    reference: 'CNG-2026-039',
    userId: 'int-u-2',
    userName: 'Fatou Binetou Sarr',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    site: 'Dakar Plateau',
    leaveType: 'ANNUEL',
    startDate: '2026-12-02',
    endDate: '2026-12-04',
    halfDay: 'FULL',
    workingDays: 3,
    reason: 'Repos annuel post-clôture forum économique.',
    status: 'EN_ATTENTE',
    currentApproverName: 'Cheikh Tidiane Fall',
    createdAt: '2026-11-16T15:30:00Z',
  },
  {
    id: 'lvr-3',
    reference: 'CNG-2026-032',
    userId: 'int-u-3',
    userName: 'Moussa Ndiaye',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    site: 'Diamniadio',
    leaveType: 'RECUPERATION',
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    halfDay: 'AFTERNOON',
    workingDays: 0.5,
    reason: 'Récupération astreinte samedi soir.',
    status: 'APPROUVE',
    currentApproverName: 'Fatou Binetou Sarr',
    decidedByName: 'Fatou Binetou Sarr',
    decidedAt: '2026-11-08T11:00:00Z',
    decisionNote: 'Validé — continuité assurée sur Diamniadio.',
    createdAt: '2026-11-07T09:00:00Z',
  },
  {
    id: 'lvr-4',
    reference: 'CNG-2026-036',
    userId: 'int-u-2',
    userName: 'Fatou Binetou Sarr',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    site: 'Dakar Plateau',
    leaveType: 'MISSION',
    startDate: '2026-11-19',
    endDate: '2026-11-20',
    halfDay: 'FULL',
    workingDays: 2,
    reason: 'Supervision technique et protocole Sommet Économique à Diamniadio.',
    status: 'APPROUVE',
    currentApproverName: 'Cheikh Tidiane Fall',
    decidedByName: 'Cheikh Tidiane Fall',
    decidedAt: '2026-11-12T14:20:00Z',
    decisionNote: 'Ordre de mission validé — véhicule de service affecté.',
    createdAt: '2026-11-11T09:30:00Z',
  },
  {
    id: 'lvr-5',
    reference: 'CNG-2026-038',
    userId: 'int-u-3',
    userName: 'Moussa Ndiaye',
    organizationId: 'tpd-demo-intranet',
    department: 'Pôle Événementiel & Projets',
    site: 'Diamniadio',
    leaveType: 'MALADIE',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    halfDay: 'FULL',
    workingDays: 1,
    reason: 'Arrêt médical court avec justificatif médical confidentiel.',
    attachmentLabel: 'certificat-medical-nov2026.pdf',
    status: 'APPROUVE',
    currentApproverName: 'Fatou Binetou Sarr',
    decidedByName: 'Cheikh Tidiane Fall',
    decidedAt: '2026-11-18T16:10:00Z',
    createdAt: '2026-11-18T12:00:00Z',
  },
  {
    id: 'lvr-6',
    reference: 'CNG-2026-040',
    userId: 'acc-u-1',
    userName: 'Amadou Konté',
    organizationId: 'tpd-demo-accounting',
    department: 'Finance & SYSCOHADA',
    site: 'Dakar Plateau',
    leaveType: 'ANNUEL',
    startDate: '2026-11-20',
    endDate: '2026-11-21',
    halfDay: 'FULL',
    workingDays: 1,
    reason: 'Repos annuel planifié après clôture budgétaire mensuelle.',
    status: 'APPROUVE',
    currentApproverName: 'Cheikh Tidiane Fall',
    decidedByName: 'Cheikh Tidiane Fall',
    decidedAt: '2026-11-14T10:00:00Z',
    createdAt: '2026-11-13T11:45:00Z',
  },
  {
    id: 'lvr-7',
    reference: 'CNG-2026-042',
    userId: 'int-u-1',
    userName: 'Cheikh Tidiane Fall',
    organizationId: 'tpd-demo-intranet',
    department: 'Direction Générale',
    site: 'Dakar Plateau',
    leaveType: 'MISSION',
    startDate: '2026-11-27',
    endDate: '2026-11-27',
    halfDay: 'MORNING',
    workingDays: 0.5,
    reason: 'Audience institutionnelle UEMOA — Dakar Plateau.',
    status: 'APPROUVE_N1',
    currentApproverName: 'Conseil d’Administration',
    createdAt: '2026-11-17T08:40:00Z',
  },
];

const attendanceEntries: AttendanceEntry[] = [
  {
    id: 'att-1',
    userId: 'int-u-1',
    userName: 'Cheikh Tidiane Fall',
    organizationId: 'tpd-demo-intranet',
    date: '2026-11-18',
    checkInTime: '08:12',
    site: 'Dakar Plateau',
    mode: 'QR_SITE',
    overtimeHours: 0,
    status: 'PRESENT',
  },
  {
    id: 'att-2',
    userId: 'int-u-2',
    userName: 'Fatou Binetou Sarr',
    organizationId: 'tpd-demo-intranet',
    date: '2026-11-18',
    checkInTime: '08:25',
    site: 'Dakar Plateau',
    mode: 'DECLARATIF',
    overtimeHours: 1,
    status: 'PRESENT',
  },
  {
    id: 'att-3',
    userId: 'int-u-3',
    userName: 'Moussa Ndiaye',
    organizationId: 'tpd-demo-intranet',
    date: '2026-11-18',
    checkInTime: '08:48',
    site: 'Diamniadio',
    mode: 'QR_SITE',
    overtimeHours: 0,
    status: 'RETARD',
    note: 'Embouteillage péage Diamniadio signalé.',
  },
  {
    id: 'att-4',
    userId: 'acc-u-1',
    userName: 'Amadou Konté',
    organizationId: 'tpd-demo-accounting',
    date: '2026-11-18',
    checkInTime: '08:05',
    site: 'Dakar Plateau',
    mode: 'DECLARATIF',
    overtimeHours: 0,
    status: 'PRESENT',
  },
];

const hrAttestations: HrAttestationRecord[] = [
  {
    id: 'ats-1',
    reference: 'ATT-2026-018',
    userId: 'int-u-3',
    userName: 'Moussa Ndiaye',
    type: 'TRAVAIL',
    issuedAt: '2026-11-05',
    verificationCode: 'QR-TPD-2026-9841',
    signedBy: 'Cheikh Tidiane Fall (DG)',
  },
  {
    id: 'ats-2',
    reference: 'ATT-2026-019',
    userId: 'int-u-2',
    userName: 'Fatou Binetou Sarr',
    type: 'SALAIRE',
    issuedAt: '2026-11-12',
    verificationCode: 'QR-TPD-2026-9912',
    signedBy: 'Amadou Konté (DAF)',
  },
];

// 2. Workflows & Dynamic Forms
const formTemplates: DynamicFormTemplate[] = [
  {
    id: 'tpl-1',
    code: 'FRM-ATTESTATION',
    category: 'ATTESTATION',
    title: 'Demande d’attestation administrative',
    description: 'Attestation de travail, de salaire, de stage ou de congé avec QR code officiel.',
    version: 2,
    fields: [
      { key: 'typeAttestation', label: 'Type d’attestation', type: 'select', required: true, options: ['Attestation de travail', 'Attestation de salaire', 'Attestation de congé', 'Attestation de prise en charge'] },
      { key: 'destinataire', label: 'Organisme destinataire (banque, ambassade…)', type: 'text', required: true },
      { key: 'delaiSouhaite', label: 'Date souhaitée', type: 'date', required: true },
    ],
    approvalSteps: ['RH / Direction'],
    slaHours: 24,
    active: true,
  },
  {
    id: 'tpl-2',
    code: 'FRM-MISSION',
    category: 'ORDRE_MISSION',
    title: 'Ordre de mission & frais de déplacement',
    description: 'Déplacement professionnel hors site avec estimation per diem et véhicule.',
    version: 1,
    fields: [
      { key: 'destination', label: 'Ville / Site de mission', type: 'text', required: true },
      { key: 'dateDepart', label: 'Date de départ', type: 'date', required: true },
      { key: 'montantFcfa', label: 'Budget estimé (FCFA)', type: 'number', required: true },
      { key: 'objet', label: 'Objet de la mission', type: 'textarea', required: true },
    ],
    approvalSteps: ['Manager N+1', 'DAF / Comptabilité'],
    slaHours: 48,
    active: true,
  },
  {
    id: 'tpl-3',
    code: 'FRM-FRAIS',
    category: 'NOTE_FRAIS',
    title: 'Remboursement de note de frais',
    description: 'Remboursement transport, restauration client ou fournitures urgentes.',
    version: 3,
    fields: [
      { key: 'categorieFrais', label: 'Catégorie', type: 'select', required: true, options: ['Transport & Carburant', 'Hébergement', 'Restauration client', 'Fournitures terrain'] },
      { key: 'montantFcfa', label: 'Montant TTC (FCFA)', type: 'number', required: true },
      { key: 'dateDepense', label: 'Date de la dépense', type: 'date', required: true },
      { key: 'justificatif', label: 'Référence reçu / facture', type: 'text', required: true },
    ],
    approvalSteps: ['Manager N+1', 'DAF / Comptabilité'],
    slaHours: 72,
    active: true,
  },
  {
    id: 'tpl-4',
    code: 'FRM-MATERIEL',
    category: 'MATERIEL',
    title: 'Dotation matériel ou équipement informatique',
    description: 'Demande de poste, smartphone terrain, badges ou mobilier.',
    version: 1,
    fields: [
      { key: 'equipement', label: 'Équipement demandé', type: 'text', required: true },
      { key: 'urgence', label: 'Niveau d’urgence', type: 'select', required: true, options: ['Standard', 'Prioritaire', 'Critique'] },
      { key: 'justification', label: 'Justification opérationnelle', type: 'textarea', required: true },
    ],
    approvalSteps: ['Manager N+1', 'Direction / DSI'],
    slaHours: 48,
    active: true,
  },
  {
    id: 'tpl-5',
    code: 'FRM-FORMATION',
    category: 'FORMATION',
    title: 'Demande de formation professionnelle',
    description: 'Inscription au catalogue Teranga Formation ou organisme externe.',
    version: 1,
    fields: [
      { key: 'intitule', label: 'Intitulé de la formation', type: 'text', required: true },
      { key: 'montantFcfa', label: 'Coût pédagogique (FCFA)', type: 'number', required: false },
      { key: 'objectifs', label: 'Compétences visées', type: 'textarea', required: true },
    ],
    approvalSteps: ['Manager N+1', 'Direction'],
    slaHours: 72,
    active: true,
  },
];

const workflowInstances: WorkflowInstanceRecord[] = [
  {
    id: 'wf-1',
    reference: 'DEM-2026-104',
    templateId: 'tpl-2',
    templateVersion: 1,
    category: 'ORDRE_MISSION',
    title: 'Mission repérage logistique Sommet Diamniadio',
    requesterId: 'int-u-3',
    requesterName: 'Moussa Ndiaye',
    organizationId: 'tpd-demo-intranet',
    space: 'intranet',
    department: 'Pôle Événementiel & Projets',
    amountFcfa: 85000,
    formValues: {
      destination: 'CICAD Diamniadio',
      dateDepart: '2026-11-21',
      montantFcfa: '85000',
      objet: 'Coordination technique éclairage et badges VIP.',
    },
    steps: ['Manager N+1', 'DAF / Comptabilité'],
    currentStepIndex: 0,
    currentApproverRole: 'Manager N+1',
    status: 'EN_ATTENTE',
    slaDeadlineAt: '2026-11-20T18:00:00Z',
    history: [
      {
        id: 'wfh-1',
        stepLabel: 'Dépôt initial',
        actorId: 'int-u-3',
        actorName: 'Moussa Ndiaye',
        action: 'SOUMIS',
        comment: 'Demande soumise pour mission terrain CICAD.',
        timestamp: '2026-11-17T11:20:00Z',
      },
    ],
    comments: [
      {
        id: 'wfc-1',
        authorId: 'int-u-3',
        authorName: 'Moussa Ndiaye',
        visibility: 'PUBLIC',
        content: 'Véhicule de service requis dès 08h00.',
        createdAt: '2026-11-17T11:25:00Z',
      },
    ],
    createdAt: '2026-11-17T11:20:00Z',
    updatedAt: '2026-11-17T11:20:00Z',
  },
  {
    id: 'wf-2',
    reference: 'DEM-2026-102',
    templateId: 'tpl-3',
    templateVersion: 3,
    category: 'NOTE_FRAIS',
    title: 'Note de frais accueil délégation Sonatel Business',
    requesterId: 'int-u-2',
    requesterName: 'Fatou Binetou Sarr',
    organizationId: 'tpd-demo-intranet',
    space: 'intranet',
    department: 'Pôle Événementiel & Projets',
    amountFcfa: 145000,
    formValues: {
      categorieFrais: 'Restauration client',
      montantFcfa: '145000',
      dateDepense: '2026-11-15',
      justificatif: 'FAC-RAD-8821',
    },
    steps: ['Manager N+1', 'DAF / Comptabilité'],
    currentStepIndex: 1,
    currentApproverRole: 'DAF / Comptabilité',
    status: 'EN_ATTENTE',
    slaDeadlineAt: '2026-11-19T17:00:00Z',
    history: [
      {
        id: 'wfh-2',
        stepLabel: 'Dépôt initial',
        actorId: 'int-u-2',
        actorName: 'Fatou Binetou Sarr',
        action: 'SOUMIS',
        comment: 'Déjeuner de cadrage contrat cadre 2027.',
        timestamp: '2026-11-16T09:10:00Z',
      },
      {
        id: 'wfh-3',
        stepLabel: 'Manager N+1',
        actorId: 'int-u-1',
        actorName: 'Cheikh Tidiane Fall',
        action: 'APPROUVE',
        comment: 'Bon pour transmission au DAF.',
        timestamp: '2026-11-16T14:40:00Z',
      },
    ],
    comments: [],
    createdAt: '2026-11-16T09:10:00Z',
    updatedAt: '2026-11-16T14:40:00Z',
  },
  {
    id: 'wf-3',
    reference: 'DEM-2026-098',
    templateId: 'tpl-5',
    templateVersion: 1,
    category: 'FORMATION',
    title: 'Prise en charge Certification Audit SYSCOHADA',
    requesterId: 'lrn-1',
    requesterName: 'Awa Diagne',
    organizationId: 'Sonatel Business SA',
    space: 'learner',
    department: 'Direction Projets',
    amountFcfa: 350000,
    formValues: {
      intitule: 'Maîtrise SYSCOHADA Révisé & Audit Financier',
      montantFcfa: '350000',
      objectifs: 'Validation compétences contrôle interne.',
    },
    steps: ['RH / Direction'],
    currentStepIndex: 0,
    currentApproverRole: 'RH / Direction',
    status: 'APPROUVEE',
    slaDeadlineAt: '2026-11-14T18:00:00Z',
    verificationQrCode: 'QR-WF-2026-098',
    history: [
      {
        id: 'wfh-4',
        stepLabel: 'Dépôt initial',
        actorId: 'lrn-1',
        actorName: 'Awa Diagne',
        action: 'SOUMIS',
        comment: 'Demande de prise en charge plan de formation.',
        timestamp: '2026-11-12T10:00:00Z',
      },
      {
        id: 'wfh-5',
        stepLabel: 'RH / Direction',
        actorId: 'sup-1',
        actorName: 'Validation Direction',
        action: 'APPROUVE',
        comment: 'Budget formation approuvé.',
        timestamp: '2026-11-13T16:15:00Z',
      },
    ],
    comments: [],
    createdAt: '2026-11-12T10:00:00Z',
    updatedAt: '2026-11-13T16:15:00Z',
  },
];

const delegations: DelegationRecord[] = [
  {
    id: 'del-1',
    delegatorUserId: 'int-u-1',
    delegatorName: 'Cheikh Tidiane Fall',
    delegateUserId: 'int-u-2',
    delegateName: 'Fatou Binetou Sarr',
    organizationId: 'tpd-demo-intranet',
    startDate: '2026-11-25',
    endDate: '2026-11-29',
    scope: 'Congés & ordres de mission < 250 000 FCFA',
    active: true,
  },
];

// 3. GED & Documents
const gedFolders: GedFolder[] = [
  { id: 'fld-rh', name: 'Dossiers RH & Bulletins de paie', department: 'Ressources Humaines', organizationId: 'tpd-demo-intranet', classification: 'CONFIDENTIEL', retentionYears: 10 },
  { id: 'fld-gov', name: 'Gouvernance, Procédures & Loi 2008-12 CDP', department: 'Direction Générale', organizationId: 'tpd-demo-intranet', classification: 'INTERNE', retentionYears: 10 },
  { id: 'fld-ev', name: 'Dossiers Événements & Protocoles', department: 'Pôle Événementiel', organizationId: 'tpd-demo-intranet', classification: 'INTERNE', retentionYears: 5 },
  { id: 'fld-fin', name: 'Pièces Comptables & Contrats SYSCOHADA', department: 'Finance & Audit', organizationId: 'tpd-demo-accounting', classification: 'CONFIDENTIEL', retentionYears: 10 },
  { id: 'fld-acad', name: 'Supports Pédagogiques & Attestations', department: 'Formation Pro', organizationId: 'global', classification: 'PUBLIC', retentionYears: 5 },
];

const gedDocuments: GedDocumentRecord[] = [
  {
    id: 'doc-1',
    reference: 'GED-2026-001',
    folderId: 'fld-gov',
    title: 'Règlement Intérieur & Charte Sécurité Teranga 2026.pdf',
    category: 'PROCEDURE',
    mimeType: 'application/pdf',
    sizeKb: 840,
    organizationId: 'tpd-demo-intranet',
    ownerUserId: 'int-u-1',
    ownerName: 'Cheikh Tidiane Fall',
    classification: 'INTERNE',
    currentVersion: 2,
    versions: [
      { version: 1, uploadedBy: 'Cheikh Tidiane Fall', uploadedAt: '2026-01-10T09:00:00Z', changeNote: 'Édition initiale 2026', sizeKb: 790 },
      { version: 2, uploadedBy: 'Cheikh Tidiane Fall', uploadedAt: '2026-10-05T14:30:00Z', changeNote: 'Mise à jour conformité CDP loi 2008-12', sizeKb: 840 },
    ],
    tags: ['Règlement', 'CDP', 'Conformité'],
    signedByName: 'Cheikh Tidiane Fall',
    signedAt: '2026-10-05T14:35:00Z',
    requiresAcknowledgement: true,
    acknowledgedByIds: ['int-u-1', 'int-u-2'],
    shareLinks: [],
    retentionUntil: '2036-10-05',
    updatedAt: '2026-10-05T14:35:00Z',
  },
  {
    id: 'doc-2',
    reference: 'GED-2026-014',
    folderId: 'fld-rh',
    title: 'Bulletin de paie — Octobre 2026 — Moussa Ndiaye.pdf',
    category: 'BULLETIN_PAIE',
    mimeType: 'application/pdf',
    sizeKb: 215,
    organizationId: 'tpd-demo-intranet',
    ownerUserId: 'acc-u-1',
    ownerName: 'Amadou Konté',
    targetUserId: 'int-u-3',
    classification: 'SECRET',
    currentVersion: 1,
    versions: [
      { version: 1, uploadedBy: 'Amadou Konté', uploadedAt: '2026-11-02T10:00:00Z', changeNote: 'Dépôt automatique paie Octobre', sizeKb: 215 },
    ],
    tags: ['Paie', 'Octobre 2026', 'Confidentiel'],
    signedByName: 'Amadou Konté',
    signedAt: '2026-11-02T10:05:00Z',
    requiresAcknowledgement: true,
    acknowledgedByIds: [],
    shareLinks: [],
    retentionUntil: '2036-11-02',
    updatedAt: '2026-11-02T10:05:00Z',
  },
  {
    id: 'doc-3',
    reference: 'GED-2026-019',
    folderId: 'fld-fin',
    title: 'Liasse Fiscale & Balance SYSCOHADA Q3 2026.xlsx',
    category: 'FACTURE_PIECE',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeKb: 1420,
    organizationId: 'tpd-demo-accounting',
    ownerUserId: 'acc-u-1',
    ownerName: 'Amadou Konté',
    classification: 'CONFIDENTIEL',
    currentVersion: 1,
    versions: [
      { version: 1, uploadedBy: 'Amadou Konté', uploadedAt: '2026-11-12T16:20:00Z', changeNote: 'Clôture trimestrielle validée', sizeKb: 1420 },
    ],
    tags: ['SYSCOHADA', 'Audit', 'Q3'],
    signedByName: 'Amadou Konté',
    signedAt: '2026-11-12T16:25:00Z',
    requiresAcknowledgement: false,
    acknowledgedByIds: ['acc-u-1'],
    shareLinks: [
      { id: 'sh-1', token: 'tpd-sh-99a2f', expiresAt: '2026-11-30', hasPassword: true, accessCount: 2 },
    ],
    retentionUntil: '2036-11-12',
    updatedAt: '2026-11-12T16:25:00Z',
  },
  {
    id: 'doc-4',
    reference: 'GED-2026-022',
    folderId: 'fld-acad',
    title: 'Guide Architecture Cloud Souverain & UEMOA.pdf',
    category: 'SUPPORT_COURS',
    mimeType: 'application/pdf',
    sizeKb: 2450,
    organizationId: 'global',
    ownerUserId: 'inst-1',
    ownerName: 'Ibrahima Diallo',
    classification: 'PUBLIC',
    currentVersion: 1,
    versions: [
      { version: 1, uploadedBy: 'Ibrahima Diallo', uploadedAt: '2026-11-14T11:00:00Z', changeNote: 'Support officiel cohorte Novembre', sizeKb: 2450 },
    ],
    tags: ['Formation', 'Cloud', 'Support'],
    requiresAcknowledgement: false,
    acknowledgedByIds: [],
    shareLinks: [],
    retentionUntil: '2031-11-14',
    updatedAt: '2026-11-14T11:00:00Z',
  },
];

interface StoredGedBinary {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

const gedVersionBinaries = new Map<string, StoredGedBinary>();

const ALLOWED_GED_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  zip: 'application/zip',
};

function getExtensionFromName(name: string): string {
  const parts = name.trim().toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function parseGedDataUrl(
  fileDataUrl: string,
  fileName: string,
  declaredMime?: string,
): { ok: true; buffer: Buffer; mimeType: string; ext: string; sizeKb: number } | { ok: false; error: string } {
  const ext = getExtensionFromName(fileName);
  if (!ext || !ALLOWED_GED_MIME_BY_EXT[ext]) {
    return {
      ok: false,
      error: 'Format non autorisé. Formats acceptés : PDF, Word, Excel, PowerPoint, TXT, CSV, OpenDocument, Images, ZIP.',
    };
  }
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(fileDataUrl);
  if (!match) {
    return { ok: false, error: 'Contenu fichier invalide.' };
  }
  const isBase64 = Boolean(match[2]);
  const rawPayload = match[3] || '';
  const buffer = isBase64
    ? Buffer.from(rawPayload, 'base64')
    : Buffer.from(decodeURIComponent(rawPayload), 'utf-8');
  if (buffer.length === 0) {
    return { ok: false, error: 'Le fichier sélectionné est vide.' };
  }
  if (buffer.length > 18 * 1024 * 1024) {
    return { ok: false, error: 'Taille maximale autorisée : 18 Mo par fichier.' };
  }
  const mimeType = ALLOWED_GED_MIME_BY_EXT[ext] || declaredMime || 'application/octet-stream';
  return {
    ok: true,
    buffer,
    mimeType,
    ext: ext.toUpperCase(),
    sizeKb: Math.max(1, Math.round(buffer.length / 1024)),
  };
}

// 4. Official Memos, Polls & Directory
const officialMemos: OfficialMemoRecord[] = [
  {
    id: 'mem-1',
    reference: 'NS-2026-018',
    title: 'Note de service : Procédure dématérialisée des congés & jours fériés 2026',
    summary: 'Toutes les demandes de congé et permissions passent désormais par le portail RH avec calcul automatique des jours ouvrés.',
    body: 'À compter du 1er novembre 2026, l’ensemble des collaborateurs et managers doit déposer et valider les demandes de congés via le module RH de Teranga Prestige Digital. Le calendrier officiel des jours fériés du Sénégal est préchargé. Un accusé de lecture est obligatoire sous 48h.',
    importance: 'URGENT',
    status: 'PUBLIEE',
    pinned: true,
    requiresAck: true,
    audienceLabel: 'Toute l’organisation',
    organizationId: 'global',
    authorId: 'int-u-1',
    authorName: 'Cheikh Tidiane Fall',
    authorRole: 'Directeur Général',
    publishedAt: '2026-11-15T09:00:00Z',
    readByUserIds: ['int-u-1', 'int-u-2'],
    targetAudienceCount: 6,
  },
  {
    id: 'mem-2',
    reference: 'NS-2026-019',
    title: 'Plan de continuité & accueil délégations au CICAD Diamniadio',
    summary: 'Consignes protocolaires, pointage QR site et badges visiteurs obligatoires.',
    body: 'Les équipes mobilisées sur le site de Diamniadio doivent enregistrer leur pointage à l’arrivée et veiller à l’inscription de chaque prestataire externe dans le registre des visiteurs.',
    importance: 'IMPORTANT',
    status: 'PUBLIEE',
    pinned: false,
    requiresAck: true,
    audienceLabel: 'Pôle Événementiel & Prestataires',
    organizationId: 'global',
    authorId: 'int-u-2',
    authorName: 'Fatou Binetou Sarr',
    authorRole: 'Responsable Pôle Événementiel',
    publishedAt: '2026-11-17T14:00:00Z',
    readByUserIds: ['int-u-2'],
    targetAudienceCount: 5,
  },
];

const internalPolls: InternalPollRecord[] = [
  {
    id: 'pol-1',
    question: 'Créneau préféré pour l’atelier mensuel de conduite du changement ?',
    description: 'Sondage interne pour organiser la session pratique d’adoption des nouveaux modules.',
    anonymous: true,
    organizationId: 'global',
    createdByName: 'Fatou Binetou Sarr',
    closesAt: '2026-11-28',
    options: [
      { id: 'opt-1', label: 'Mardi matin (09h30 – 11h00)', votes: 7 },
      { id: 'opt-2', label: 'Jeudi après-midi (15h00 – 16h30)', votes: 5 },
      { id: 'opt-3', label: 'Vendredi matin (10h00 – 11h30)', votes: 3 },
    ],
    votedUserIds: ['int-u-1'],
    status: 'OUVERT',
  },
];

// 5. Smart Notifications & Preferences
const notificationsList: NotificationItem[] = [
  {
    id: 'ntf-1',
    userId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    title: 'Demande de congé à valider — Fatou Binetou Sarr',
    message: 'CNG-2026-039 (3 jours ouvrés du 02 au 04 déc.) en attente de votre arbitrage.',
    category: 'RH',
    priority: 'HAUTE',
    channelsSent: ['IN_APP', 'EMAIL'],
    targetSection: 'hr',
    read: false,
    createdAt: '2026-11-17T16:10:00Z',
  },
  {
    id: 'ntf-2',
    userId: 'int-u-2',
    organizationId: 'tpd-demo-intranet',
    title: 'Circuit validation N+1 — Ordre de mission DEM-2026-104',
    message: 'Moussa Ndiaye sollicite 85 000 FCFA pour le repérage CICAD Diamniadio.',
    category: 'WORKFLOW',
    priority: 'URGENTE',
    channelsSent: ['IN_APP', 'SMS', 'EMAIL'],
    targetSection: 'workflows',
    read: false,
    createdAt: '2026-11-17T11:25:00Z',
  },
  {
    id: 'ntf-3',
    userId: 'int-u-3',
    organizationId: 'tpd-demo-intranet',
    title: 'Bulletin de paie Octobre 2026 disponible',
    message: 'Votre bulletin GED-2026-014 a été déposé dans votre coffre GED (accusé requis).',
    category: 'GED',
    priority: 'NORMALE',
    channelsSent: ['IN_APP', 'EMAIL'],
    targetSection: 'ged',
    read: false,
    createdAt: '2026-11-16T10:00:00Z',
  },
  {
    id: 'ntf-4',
    userId: 'acc-u-1',
    organizationId: 'tpd-demo-accounting',
    title: 'Validation DAF requise — Note de frais DEM-2026-102',
    message: '145 000 FCFA approuvés par N+1, en attente de visa comptable.',
    category: 'WORKFLOW',
    priority: 'HAUTE',
    channelsSent: ['IN_APP', 'EMAIL'],
    targetSection: 'workflows',
    read: false,
    createdAt: '2026-11-16T14:45:00Z',
  },
  {
    id: 'ntf-5',
    userId: 'sup-1',
    organizationId: 'tpd-superadmin',
    title: 'Facture tenant en attente — Hôtel Terrou-Bi Resort',
    message: 'Échéance abonnement Standard (180 000 FCFA) — relance Wave/OM prête.',
    category: 'SYSTEME',
    priority: 'HAUTE',
    channelsSent: ['IN_APP', 'EMAIL'],
    targetSection: 'tenants',
    read: false,
    createdAt: '2026-11-17T08:30:00Z',
  },
];

const notificationPrefsByUser = new Map<string, NotificationPreferences>();

// 6. Org Admin: Structure, Sites, Theme, Tokens, Webhooks, Backups
const orgUnits: OrgUnitNode[] = [
  { id: 'unit-1', name: 'Direction Générale', type: 'DIRECTION', leadName: 'Cheikh Tidiane Fall', site: 'Dakar Plateau', headcount: 4 },
  { id: 'unit-2', name: 'Pôle Événementiel & Projets', type: 'DEPARTEMENT', parentId: 'unit-1', leadName: 'Fatou Binetou Sarr', site: 'Dakar Plateau', headcount: 9 },
  { id: 'unit-3', name: 'Service Logistique & Régie Terrain', type: 'SERVICE', parentId: 'unit-2', leadName: 'Moussa Ndiaye', site: 'Diamniadio', headcount: 5 },
  { id: 'unit-4', name: 'Direction Administrative & Financière (SYSCOHADA)', type: 'DIRECTION', parentId: 'unit-1', leadName: 'Amadou Konté', site: 'Dakar Plateau', headcount: 3 },
  { id: 'unit-5', name: 'Institut Teranga Formation', type: 'DEPARTEMENT', parentId: 'unit-1', leadName: 'Ibrahima Diallo', site: 'Thiès / Dakar', headcount: 6 },
];

const orgSites: OrgSite[] = [
  { id: 'site-1', name: 'Siège Dakar Plateau', city: 'Dakar', address: 'Immeuble Teranga, Rue Carnot x Avenue Lamine Guèye', agentCount: 16 },
  { id: 'site-2', name: 'Antenne CICAD Diamniadio', city: 'Diamniadio', address: 'Pôle Urbain de Diamniadio, Hall B', agentCount: 8 },
  { id: 'site-3', name: 'Campus Régional Thiès', city: 'Thiès', address: 'Avenue Caen, Quartier Escale', agentCount: 4 },
];

const DEFAULT_ORG_LOGOS: Record<string, string> = {
  'tpd-demo-intranet': '/src/assets/images/logo_org_teranga_1795100810532.jpg',
  'tpd-demo-accounting': '/src/assets/images/logo_org_teranga_1795100810532.jpg',
  'teranga-events': '/src/assets/images/logo_company_teranex_1795100810852.jpg',
  'teranga-academy': '/src/assets/images/logo_org_academy_1795100810596.jpg',
  'sonatel-business': '/src/assets/images/logo_org_sonatel_biz_1795100811818.jpg',
  'ministere-modernisation': '/src/assets/images/logo_org_public_admin_1795100810727.jpg',
};

function sanitizeMediaString(val: unknown): { valid: boolean; clear?: boolean; value?: string } {
  if (val === '' || val === null) {
    return { valid: true, clear: true, value: undefined };
  }
  if (typeof val !== 'string') return { valid: false };
  const trimmed = val.trim();
  if (!trimmed) return { valid: true, clear: true, value: undefined };
  if (
    (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed) &&
      trimmed.length <= 7_000_000) ||
    trimmed.startsWith('/src/assets/images/') ||
    trimmed.startsWith('/assets/')
  ) {
    return { valid: true, value: trimmed };
  }
  return { valid: false };
}

const orgThemes = new Map<string, OrgThemeConfig>();
function getOrInitTheme(orgId: string, orgName: string): OrgThemeConfig {
  const existing = orgThemes.get(orgId);
  if (existing) return existing;
  const created: OrgThemeConfig = {
    organizationId: orgId,
    displayName: orgName || 'Teranga Prestige Digital',
    logoUrl: DEFAULT_ORG_LOGOS[orgId] || '/src/assets/images/logo_org_teranga_1795100810532.jpg',
    primaryColor: '#2563eb',
    accentColor: '#0f172a',
    memberLabel: 'Collaborateur',
    unitLabel: 'Direction',
    locale: 'fr-SN',
    timezone: 'Africa/Dakar',
    onboardingCompleted: true,
    onboardingStep: 6,
    enabledModules: [
      'hr',
      'workflows',
      'ged',
      'comms',
      'operations',
      'tasks',
      'planning',
      'crm',
      'accounting',
      'events',
      'training',
    ],
  };
  orgThemes.set(orgId, created);
  return created;
}

const orgTokens: OrgApiToken[] = [
  {
    id: 'tok-1',
    label: 'Connecteur Paie Sage / Odoo Dakar',
    prefix: 'tpd_live_84c1...',
    scopes: ['hr:read', 'leaves:read', 'payroll:export'],
    createdAt: '2026-10-01T08:00:00Z',
    lastUsedAt: '2026-11-17T18:10:00Z',
    revoked: false,
  },
  {
    id: 'tok-2',
    label: 'Synchronisation Badgeuse CICAD',
    prefix: 'tpd_live_19f4...',
    scopes: ['attendance:write'],
    createdAt: '2026-10-20T12:00:00Z',
    lastUsedAt: '2026-11-18T08:48:00Z',
    revoked: false,
  },
];

const orgWebhooks: OrgWebhook[] = [
  {
    id: 'wh-1',
    url: 'https://erp.terangaprestige.sn/webhooks/tpd-v1',
    events: ['leave.approved', 'request.completed', 'post.published'],
    hmacSecretMasked: 'whsec_••••••••9f2a',
    active: true,
    lastDeliveryStatus: 'OK',
  },
];

const orgBackups: OrgBackupSnapshot[] = [
  { id: 'bkp-1', createdAt: '2026-11-18T03:00:00Z', sizeMb: 412, type: 'QUOTIDIENNE_AUTO', status: 'VERIFIEE' },
  { id: 'bkp-2', createdAt: '2026-11-17T03:00:00Z', sizeMb: 409, type: 'QUOTIDIENNE_AUTO', status: 'VERIFIEE' },
];

// 7. Operations: Institutional Mail, Visitors, Shared Resources
const institutionalMail: InstitutionalMailRecord[] = [
  {
    id: 'mail-1',
    reference: 'ARR-2026-214',
    direction: 'ARRIVEE',
    subject: 'Convention cadre Formation Agents Publics 2027',
    correspondent: 'Ministère de la Fonction Publique',
    confidentiality: 'CONFIDENTIEL',
    imputedToName: 'Cheikh Tidiane Fall',
    department: 'Direction Générale',
    dueDate: '2026-11-22',
    status: 'IMPUTE',
    createdAt: '2026-11-17T09:15:00Z',
  },
  {
    id: 'mail-2',
    reference: 'DEP-2026-108',
    direction: 'DEPART',
    subject: 'Transmission bordereau déclarations sociales IPRES / CSS',
    correspondent: 'Caisse de Sécurité Sociale Dakar',
    confidentiality: 'INTERNE',
    imputedToName: 'Amadou Konté',
    department: 'Finance & SYSCOHADA',
    dueDate: '2026-11-20',
    status: 'TRAITE',
    createdAt: '2026-11-15T14:30:00Z',
  },
];

const visitorLogs: VisitorLogRecord[] = [
  {
    id: 'vis-1',
    visitorName: 'Ibrahima Mboup',
    organization: 'Sonatel Business SA',
    idDocumentNumber: 'CNI •••• 4821',
    hostName: 'Cheikh Tidiane Fall',
    site: 'Dakar Plateau',
    purpose: 'Comité signature contrat événementiel',
    badgeCode: 'VIS-042',
    checkInAt: '2026-11-18T09:30:00Z',
    status: 'SUR_SITE',
  },
  {
    id: 'vis-2',
    visitorName: 'Marième Diouf',
    organization: 'Cabinet Audit Diop',
    idDocumentNumber: 'CNI •••• 1190',
    hostName: 'Amadou Konté',
    site: 'Dakar Plateau',
    purpose: 'Revue pièces SYSCOHADA Q3',
    badgeCode: 'VIS-039',
    checkInAt: '2026-11-17T10:00:00Z',
    checkOutAt: '2026-11-17T13:15:00Z',
    status: 'SORTI',
  },
];

const sharedBookings: SharedResourceBooking[] = [
  {
    id: 'res-1',
    resourceName: 'Salle Conseil Plateau (16 places)',
    resourceType: 'SALLE',
    site: 'Dakar Plateau',
    date: '2026-11-18',
    startHour: 10,
    endHour: 12,
    bookedByUserId: 'int-u-1',
    bookedByName: 'Cheikh Tidiane Fall',
    purpose: 'Comité de direction hebdomadaire',
    status: 'CONFIRME',
  },
  {
    id: 'res-2',
    resourceName: 'Véhicule SUV 4x4 DK-4821-AM',
    resourceType: 'VEHICULE',
    site: 'Diamniadio',
    date: '2026-11-19',
    startHour: 8,
    endHour: 14,
    bookedByUserId: 'int-u-3',
    bookedByName: 'Moussa Ndiaye',
    purpose: 'Acheminement matériel audiovisuel CICAD',
    status: 'CONFIRME',
  },
];

const resourcesCatalog = [
  { name: 'Salle Conseil Plateau (16 places)', type: 'SALLE' as const, site: 'Dakar Plateau', capacity: '16 personnes · Visio 4K' },
  { name: 'Salle Formation Almadies (24 places)', type: 'SALLE' as const, site: 'Dakar Plateau', capacity: '24 personnes · Vidéoprojecteur' },
  { name: 'Véhicule SUV 4x4 DK-4821-AM', type: 'VEHICULE' as const, site: 'Diamniadio', capacity: '5 places + coffre matériel' },
  { name: 'Berline Direction DK-1092-AA', type: 'VEHICULE' as const, site: 'Dakar Plateau', capacity: '4 places · Chauffeur affecté' },
  { name: 'Kit Régie Audio & Streaming Mobile', type: 'MATERIEL_AV' as const, site: 'Dakar Plateau', capacity: '4 micros HF + table mixage' },
];

// 9. Chaîne des Ordres de Mission & Frais de Déplacement (Secteur Public / Sénégal)
const missionTariffs: MissionPerDiemTariff[] = [
  { zone: 'DAKAR_PERIPHERIE', zoneLabel: 'Dakar / Diamniadio / Thiès (Périphérie)', category: 'CAT_A_HAUTE_DIRECTION', categoryLabel: 'Cat. A (Directeurs, SG, Inspecteurs)', dailyRateFcfa: 25000, lodgingCeilingFcfa: 45000 },
  { zone: 'DAKAR_PERIPHERIE', zoneLabel: 'Dakar / Diamniadio / Thiès (Périphérie)', category: 'CAT_B_CADRE', categoryLabel: 'Cat. B (Chefs de Service, Cadres)', dailyRateFcfa: 18000, lodgingCeilingFcfa: 35000 },
  { zone: 'DAKAR_PERIPHERIE', zoneLabel: 'Dakar / Diamniadio / Thiès (Périphérie)', category: 'CAT_C_EXECUTION', categoryLabel: 'Cat. C (Agents, Chauffeurs, Logistique)', dailyRateFcfa: 12000, lodgingCeilingFcfa: 25000 },

  { zone: 'SENEGAL_INTERIEUR', zoneLabel: 'Intérieur du Sénégal (Régions)', category: 'CAT_A_HAUTE_DIRECTION', categoryLabel: 'Cat. A (Directeurs, SG, Inspecteurs)', dailyRateFcfa: 55000, lodgingCeilingFcfa: 65000 },
  { zone: 'SENEGAL_INTERIEUR', zoneLabel: 'Intérieur du Sénégal (Régions)', category: 'CAT_B_CADRE', categoryLabel: 'Cat. B (Chefs de Service, Cadres)', dailyRateFcfa: 40000, lodgingCeilingFcfa: 45000 },
  { zone: 'SENEGAL_INTERIEUR', zoneLabel: 'Intérieur du Sénégal (Régions)', category: 'CAT_C_EXECUTION', categoryLabel: 'Cat. C (Agents, Chauffeurs, Logistique)', dailyRateFcfa: 28000, lodgingCeilingFcfa: 30000 },

  { zone: 'UEMOA_AFRIQUE', zoneLabel: 'Zone UEMOA / Afrique', category: 'CAT_A_HAUTE_DIRECTION', categoryLabel: 'Cat. A (Directeurs, SG, Inspecteurs)', dailyRateFcfa: 145000, lodgingCeilingFcfa: 130000 },
  { zone: 'UEMOA_AFRIQUE', zoneLabel: 'Zone UEMOA / Afrique', category: 'CAT_B_CADRE', categoryLabel: 'Cat. B (Chefs de Service, Cadres)', dailyRateFcfa: 115000, lodgingCeilingFcfa: 95000 },
  { zone: 'UEMOA_AFRIQUE', zoneLabel: 'Zone UEMOA / Afrique', category: 'CAT_C_EXECUTION', categoryLabel: 'Cat. C (Agents, Chauffeurs, Logistique)', dailyRateFcfa: 85000, lodgingCeilingFcfa: 70000 },

  { zone: 'HORS_AFRIQUE', zoneLabel: 'Hors Afrique (Europe / International)', category: 'CAT_A_HAUTE_DIRECTION', categoryLabel: 'Cat. A (Directeurs, SG, Inspecteurs)', dailyRateFcfa: 210000, lodgingCeilingFcfa: 185000 },
  { zone: 'HORS_AFRIQUE', zoneLabel: 'Hors Afrique (Europe / International)', category: 'CAT_B_CADRE', categoryLabel: 'Cat. B (Chefs de Service, Cadres)', dailyRateFcfa: 170000, lodgingCeilingFcfa: 145000 },
  { zone: 'HORS_AFRIQUE', zoneLabel: 'Hors Afrique (Europe / International)', category: 'CAT_C_EXECUTION', categoryLabel: 'Cat. C (Agents, Chauffeurs, Logistique)', dailyRateFcfa: 130000, lodgingCeilingFcfa: 110000 },
];

const missionDestinationCities: MissionDestinationCity[] = [
  // Dakar & Périphérie
  { id: 'city-dkr', city: 'Dakar Plateau / Almadies', regionOrCountry: 'Dakar', zone: 'DAKAR_PERIPHERIE', distanceFromDakarKm: 12, tollRoundTripFcfa: 0, publicTransitRoundTripFcfa: 3000 },
  { id: 'city-diamniadio', city: 'Diamniadio (CICAD / Sphères)', regionOrCountry: 'Dakar', zone: 'DAKAR_PERIPHERIE', distanceFromDakarKm: 36, tollRoundTripFcfa: 3200, publicTransitRoundTripFcfa: 4000 },
  { id: 'city-rufisque', city: 'Rufisque / Bargny', regionOrCountry: 'Dakar', zone: 'DAKAR_PERIPHERIE', distanceFromDakarKm: 28, tollRoundTripFcfa: 2000, publicTransitRoundTripFcfa: 3000 },
  { id: 'city-thies', city: 'Thiès', regionOrCountry: 'Thiès', zone: 'DAKAR_PERIPHERIE', distanceFromDakarKm: 70, tollRoundTripFcfa: 4400, publicTransitRoundTripFcfa: 6000 },
  { id: 'city-mbour', city: 'Mbour / Saly', regionOrCountry: 'Thiès', zone: 'DAKAR_PERIPHERIE', distanceFromDakarKm: 84, tollRoundTripFcfa: 5400, publicTransitRoundTripFcfa: 7000 },

  // Intérieur du Sénégal (12 autres régions + pôles)
  { id: 'city-diourbel', city: 'Diourbel', regionOrCountry: 'Diourbel', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 146, tollRoundTripFcfa: 8000, publicTransitRoundTripFcfa: 10000 },
  { id: 'city-touba', city: 'Touba / Mbacké', regionOrCountry: 'Diourbel', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 194, tollRoundTripFcfa: 10400, publicTransitRoundTripFcfa: 12000 },
  { id: 'city-fatick', city: 'Fatick', regionOrCountry: 'Fatick', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 155, tollRoundTripFcfa: 6000, publicTransitRoundTripFcfa: 10000 },
  { id: 'city-kaolack', city: 'Kaolack', regionOrCountry: 'Kaolack', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 192, tollRoundTripFcfa: 6000, publicTransitRoundTripFcfa: 12000 },
  { id: 'city-kaffrine', city: 'Kaffrine', regionOrCountry: 'Kaffrine', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 256, tollRoundTripFcfa: 6000, publicTransitRoundTripFcfa: 15000 },
  { id: 'city-louga', city: 'Louga', regionOrCountry: 'Louga', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 203, tollRoundTripFcfa: 4400, publicTransitRoundTripFcfa: 12000 },
  { id: 'city-saint-louis', city: 'Saint-Louis', regionOrCountry: 'Saint-Louis', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 264, tollRoundTripFcfa: 4400, flightEstimateFcfa: 115000, publicTransitRoundTripFcfa: 16000 },
  { id: 'city-matam', city: 'Matam / Ourossogui', regionOrCountry: 'Matam', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 530, tollRoundTripFcfa: 10400, flightEstimateFcfa: 135000, publicTransitRoundTripFcfa: 28000 },
  { id: 'city-tamba', city: 'Tambacounda', regionOrCountry: 'Tambacounda', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 465, tollRoundTripFcfa: 6000, flightEstimateFcfa: 135000, publicTransitRoundTripFcfa: 24000 },
  { id: 'city-kedougou', city: 'Kédougou', regionOrCountry: 'Kédougou', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 702, tollRoundTripFcfa: 6000, flightEstimateFcfa: 165000, publicTransitRoundTripFcfa: 38000 },
  { id: 'city-kolda', city: 'Kolda', regionOrCountry: 'Kolda', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 670, tollRoundTripFcfa: 6000, flightEstimateFcfa: 145000, publicTransitRoundTripFcfa: 32000 },
  { id: 'city-sedhiou', city: 'Sédhiou', regionOrCountry: 'Sédhiou', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 560, tollRoundTripFcfa: 6000, publicTransitRoundTripFcfa: 28000 },
  { id: 'city-ziguinchor', city: 'Ziguinchor / Cap Skirring', regionOrCountry: 'Ziguinchor', zone: 'SENEGAL_INTERIEUR', distanceFromDakarKm: 454, tollRoundTripFcfa: 6000, flightEstimateFcfa: 145000, publicTransitRoundTripFcfa: 26000 },

  // Zone UEMOA / Afrique
  { id: 'city-nouakchott', city: 'Nouakchott', regionOrCountry: 'Mauritanie', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 550, tollRoundTripFcfa: 4400, flightEstimateFcfa: 260000, publicTransitRoundTripFcfa: 45000 },
  { id: 'city-bamako', city: 'Bamako', regionOrCountry: 'Mali (UEMOA)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 1280, tollRoundTripFcfa: 6000, flightEstimateFcfa: 340000, publicTransitRoundTripFcfa: 75000 },
  { id: 'city-abidjan', city: 'Abidjan', regionOrCountry: 'Côte d’Ivoire (UEMOA)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 2200, tollRoundTripFcfa: 0, flightEstimateFcfa: 390000 },
  { id: 'city-ouaga', city: 'Ouagadougou', regionOrCountry: 'Burkina Faso (UEMOA)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 2100, tollRoundTripFcfa: 0, flightEstimateFcfa: 410000 },
  { id: 'city-lome', city: 'Lomé', regionOrCountry: 'Togo (UEMOA)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 2650, tollRoundTripFcfa: 0, flightEstimateFcfa: 420000 },
  { id: 'city-cotonou', city: 'Cotonou', regionOrCountry: 'Bénin (UEMOA)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 2800, tollRoundTripFcfa: 0, flightEstimateFcfa: 430000 },
  { id: 'city-casablanca', city: 'Casablanca / Rabat', regionOrCountry: 'Maroc (Afrique)', zone: 'UEMOA_AFRIQUE', distanceFromDakarKm: 2300, tollRoundTripFcfa: 0, flightEstimateFcfa: 460000 },

  // Hors Afrique
  { id: 'city-paris', city: 'Paris', regionOrCountry: 'France', zone: 'HORS_AFRIQUE', distanceFromDakarKm: 4200, tollRoundTripFcfa: 0, flightEstimateFcfa: 680000 },
  { id: 'city-bruxelles', city: 'Bruxelles', regionOrCountry: 'Belgique (UE)', zone: 'HORS_AFRIQUE', distanceFromDakarKm: 4450, tollRoundTripFcfa: 0, flightEstimateFcfa: 720000 },
  { id: 'city-geneve', city: 'Genève', regionOrCountry: 'Suisse (ONU)', zone: 'HORS_AFRIQUE', distanceFromDakarKm: 4300, tollRoundTripFcfa: 0, flightEstimateFcfa: 760000 },
  { id: 'city-washington', city: 'Washington / New York', regionOrCountry: 'États-Unis', zone: 'HORS_AFRIQUE', distanceFromDakarKm: 6150, tollRoundTripFcfa: 0, flightEstimateFcfa: 1050000 },
];

const missionOrders: MissionOrderRecord[] = [
  {
    id: 'om-1',
    reference: 'OM-2026-081',
    agentUserId: 'int-u-2',
    agentName: 'Fatou Binetou Sarr',
    agentJobTitle: 'Responsable Pôle Événementiel',
    agentCategory: 'CAT_B_CADRE',
    department: 'Pôle Événementiel & Projets',
    organizationId: 'tpd-demo-intranet',
    title: 'Supervision technique & protocole Sommet Économique',
    destination: 'Diamniadio — CICAD',
    zone: 'DAKAR_PERIPHERIE',
    departureDate: '2026-11-19',
    returnDate: '2026-11-20',
    daysCount: 2,
    transportMode: 'VEHICULE_ADMIN',
    vehicleName: 'Véhicule SUV 4x4 DK-4821-AM',
    bookingId: 'res-2',
    perDiemDailyFcfa: 18000,
    perDiemTotalFcfa: 36000,
    lodgingEstimateFcfa: 35000,
    transportEstimateFcfa: 25000,
    totalEstimatedFcfa: 96000,
    advanceRequestedPct: 80,
    advancePaidFcfa: 76800,
    expenseLines: [
      { id: 'ml-1', category: 'PER_DIEM', label: 'Per diem officiel (2 j × 18 000 FCFA)', estimatedFcfa: 36000 },
      { id: 'ml-2', category: 'HEBERGEMENT', label: 'Hébergement Diamniadio (1 nuitée)', estimatedFcfa: 35000 },
      { id: 'ml-3', category: 'CARBURANT_PEAGE', label: 'Carburant & Péage autoroute Ila Touba/AIBD', estimatedFcfa: 25000 },
    ],
    status: 'APPROUVE_SG',
    currentApproverRole: 'En cours — Déplacement autorisé',
    approvalTrail: [
      { id: 'ma-1', stepLabel: 'Création & Soumission', actorName: 'Fatou Binetou Sarr', action: 'SOUMIS', timestamp: '2026-11-12T09:15:00Z' },
      { id: 'ma-2', stepLabel: 'Visa N+1', actorName: 'Cheikh Tidiane Fall', action: 'VISA_N1', note: 'Mission stratégique validée.', timestamp: '2026-11-12T11:30:00Z' },
      { id: 'ma-3', stepLabel: 'Visa DAGE / Budget', actorName: 'Amadou Konté', action: 'VISA_DAGE', note: 'Ligne 6384 disponible · Avance 80% mandatée.', timestamp: '2026-11-13T10:05:00Z' },
      { id: 'ma-4', stepLabel: 'Signature Secrétariat Général', actorName: 'Cheikh Tidiane Fall', action: 'SIGNATURE_SG', note: 'Ordre de mission signé et scellé.', timestamp: '2026-11-13T16:40:00Z' },
    ],
    verificationQrCode: 'QR-OM-TPD-2026-081',
    createdAt: '2026-11-12T09:15:00Z',
  },
  {
    id: 'om-2',
    reference: 'OM-2026-082',
    agentUserId: 'int-u-3',
    agentName: 'Moussa Ndiaye',
    agentJobTitle: 'Chargé de Logistique',
    agentCategory: 'CAT_C_EXECUTION',
    department: 'Pôle Événementiel & Projets',
    organizationId: 'tpd-demo-intranet',
    title: 'Déploiement régie & installation Antenne Nord',
    destination: 'Saint-Louis — Gouvernance Régionale',
    zone: 'SENEGAL_INTERIEUR',
    departureDate: '2026-11-25',
    returnDate: '2026-11-27',
    daysCount: 3,
    transportMode: 'VEHICULE_ADMIN',
    vehicleName: 'Véhicule SUV 4x4 DK-4821-AM',
    perDiemDailyFcfa: 28000,
    perDiemTotalFcfa: 84000,
    lodgingEstimateFcfa: 60000,
    transportEstimateFcfa: 45000,
    totalEstimatedFcfa: 189000,
    advanceRequestedPct: 80,
    advancePaidFcfa: 0,
    expenseLines: [
      { id: 'ml-4', category: 'PER_DIEM', label: 'Per diem officiel (3 j × 28 000 FCFA)', estimatedFcfa: 84000 },
      { id: 'ml-5', category: 'HEBERGEMENT', label: 'Hébergement Saint-Louis (2 nuitées)', estimatedFcfa: 60000 },
      { id: 'ml-6', category: 'CARBURANT_PEAGE', label: 'Dotation carburant & péage Dakar–Saint-Louis A/R', estimatedFcfa: 45000 },
    ],
    status: 'SOUMIS_N1',
    currentApproverRole: 'Supérieur Hiérarchique (N+1)',
    approvalTrail: [
      { id: 'ma-5', stepLabel: 'Création & Soumission', actorName: 'Moussa Ndiaye', action: 'SOUMIS', timestamp: '2026-11-18T14:10:00Z' },
    ],
    verificationQrCode: 'QR-OM-TPD-2026-082',
    createdAt: '2026-11-18T14:10:00Z',
  },
  {
    id: 'om-3',
    reference: 'OM-2026-083',
    agentUserId: 'int-u-1',
    agentName: 'Cheikh Tidiane Fall',
    agentJobTitle: 'Directeur Général',
    agentCategory: 'CAT_A_HAUTE_DIRECTION',
    department: 'Direction Générale',
    organizationId: 'tpd-demo-intranet',
    title: 'Session Commission Régionale Transformation Publique UEMOA',
    destination: 'Abidjan — Plateau (Côte d’Ivoire)',
    zone: 'UEMOA_AFRIQUE',
    departureDate: '2026-12-03',
    returnDate: '2026-12-06',
    daysCount: 4,
    transportMode: 'AVION',
    perDiemDailyFcfa: 145000,
    perDiemTotalFcfa: 580000,
    lodgingEstimateFcfa: 390000,
    transportEstimateFcfa: 310000,
    totalEstimatedFcfa: 1280000,
    advanceRequestedPct: 100,
    advancePaidFcfa: 0,
    expenseLines: [
      { id: 'ml-7', category: 'PER_DIEM', label: 'Per diem UEMOA Cat. A (4 j × 145 000 FCFA)', estimatedFcfa: 580000 },
      { id: 'ml-8', category: 'HEBERGEMENT', label: 'Hôtel Abidjan (3 nuitées)', estimatedFcfa: 390000 },
      { id: 'ml-9', category: 'BILLET_TRANSPORT', label: 'Billet Air Côte d’Ivoire A/R Dakar–Abidjan', estimatedFcfa: 310000 },
    ],
    status: 'VISA_DAGE',
    currentApproverRole: 'Secrétariat Général / Direction',
    approvalTrail: [
      { id: 'ma-6', stepLabel: 'Création & Soumission', actorName: 'Cheikh Tidiane Fall', action: 'SOUMIS', timestamp: '2026-11-16T10:00:00Z' },
      { id: 'ma-7', stepLabel: 'Visa N+1', actorName: 'Direction Générale', action: 'VISA_N1', timestamp: '2026-11-16T10:30:00Z' },
      { id: 'ma-8', stepLabel: 'Visa DAGE / Budget', actorName: 'Amadou Konté', action: 'VISA_DAGE', note: 'Engagement budgétaire validé.', timestamp: '2026-11-17T15:20:00Z' },
    ],
    verificationQrCode: 'QR-OM-TPD-2026-083',
    createdAt: '2026-11-16T10:00:00Z',
  },
  {
    id: 'om-4',
    reference: 'OM-2026-080',
    agentUserId: 'acc-u-1',
    agentName: 'Amadou Konté',
    agentJobTitle: 'Directeur Administratif & Financier',
    agentCategory: 'CAT_A_HAUTE_DIRECTION',
    department: 'Finance & SYSCOHADA',
    organizationId: 'tpd-demo-accounting',
    title: 'Contrôle budgétaire & inventaire Antenne Sud',
    destination: 'Ziguinchor — Antenne Régionale',
    zone: 'SENEGAL_INTERIEUR',
    departureDate: '2026-11-11',
    returnDate: '2026-11-13',
    daysCount: 3,
    transportMode: 'AVION',
    perDiemDailyFcfa: 55000,
    perDiemTotalFcfa: 165000,
    lodgingEstimateFcfa: 120000,
    transportEstimateFcfa: 98000,
    totalEstimatedFcfa: 383000,
    advanceRequestedPct: 80,
    advancePaidFcfa: 306400,
    actualSpentFcfa: 368500,
    balanceToSettleFcfa: 62100,
    expenseLines: [
      { id: 'ml-10', category: 'PER_DIEM', label: 'Per diem officiel (3 j × 55 000 FCFA)', estimatedFcfa: 165000, actualFcfa: 165000, receiptRef: 'BAREME-SN-2026' },
      { id: 'ml-11', category: 'HEBERGEMENT', label: 'Hôtel Kadiandoumagne (2 nuitées)', estimatedFcfa: 120000, actualFcfa: 110000, receiptRef: 'FAC-HTL-882' },
      { id: 'ml-12', category: 'BILLET_TRANSPORT', label: 'Vol Air Sénégal Dakar–Ziguinchor A/R', estimatedFcfa: 98000, actualFcfa: 93500, receiptRef: 'TKT-AS-4410' },
    ],
    status: 'RAPPORT_DEPOSE',
    currentApproverRole: 'DAGE — Liquidation finale',
    approvalTrail: [
      { id: 'ma-9', stepLabel: 'Création & Soumission', actorName: 'Amadou Konté', action: 'SOUMIS', timestamp: '2026-11-05T09:00:00Z' },
      { id: 'ma-10', stepLabel: 'Visa N+1', actorName: 'Cheikh Tidiane Fall', action: 'VISA_N1', timestamp: '2026-11-05T12:00:00Z' },
      { id: 'ma-11', stepLabel: 'Visa DAGE', actorName: 'Amadou Konté', action: 'VISA_DAGE', timestamp: '2026-11-06T09:30:00Z' },
      { id: 'ma-12', stepLabel: 'Signature SG', actorName: 'Cheikh Tidiane Fall', action: 'SIGNATURE_SG', timestamp: '2026-11-06T14:00:00Z' },
      { id: 'ma-13', stepLabel: 'Dépôt Rapport & Pièces', actorName: 'Amadou Konté', action: 'RAPPORT', note: 'Inventaire validé, pièces comptables jointes.', timestamp: '2026-11-14T16:15:00Z' },
    ],
    missionReportSummary:
      'Audit complet de l’antenne de Ziguinchor réalisé : rapprochement de caisse conforme, PV d’inventaire immobilisations signé par le chef d’antenne.',
    missionReportSubmittedAt: '2026-11-14T16:15:00Z',
    verificationQrCode: 'QR-OM-TPD-2026-080',
    createdAt: '2026-11-05T09:00:00Z',
  },
];

// 9. Outil de Rédaction de Rapports de Mission & Rapports de Travail
const workReportTemplates: WorkReportTemplate[] = [
  {
    id: 'tpl-rpt-mission',
    code: 'TRM-MIS-01',
    type: 'RAPPORT_MISSION',
    title: 'Rapport de Mission Terrain & Déplacement Officiel',
    targetRoles: ['ALL'],
    defaultObjective: 'Compte rendu d’exécution, livrables terrain, écarts budgétaires et recommandations suite à l’ordre de mission.',
    contextPrompts: [
      'Conformément à l’ordre de mission référencé, la mission s’est déroulée sur le site cible en présence des équipes locales et partenaires institutionnels.',
      'Objectif principal : réaliser le contrôle opérationnel, collecter les pièces justificatives et coordonner les actions prioritaires avec le point focal régional.',
    ],
    achievementPrompts: [
      '• Tenue des réunions de cadrage et d’alignement avec les responsables de l’antenne / du site.',
      '• Vérification technique sur site, établissement du procès-verbal contradictoire et collecte des justificatifs comptables.',
      '• Remise du kit opérationnel / déploiement des livrables attendus dans le respect du calendrier imparti.',
    ],
    riskPrompts: [
      '• Contrainte logistique ou délai d’acheminement constaté sur place nécessitant une réorganisation du planning.',
      '• Besoin de mise à niveau d’équipements / connectivité relevé lors de l’inspection terrain.',
    ],
    recommendationPrompts: [
      '• Valider la liquidation financière des frais engagés et archiver les justificatifs au coffre-fort GED.',
      '• Programmer un point de suivi à J+15 avec le responsable local pour vérifier la levée des réserves.',
    ],
    suggestedKpis: [
      { label: 'Objectifs de mission réalisés', targetValue: '100', unit: '%' },
      { label: 'Justificatifs conformes transmis', targetValue: '100', unit: '%' },
      { label: 'Écart budget prévu / réel', targetValue: '<= 5', unit: '%' },
    ],
  },
  {
    id: 'tpl-rpt-hebdo',
    code: 'TRM-TRV-H01',
    type: 'RAPPORT_TRAVAIL_HEBDO',
    title: 'Rapport de Travail Hebdomadaire (Employé / Chargé de mission)',
    targetRoles: ['EMPLOYEE', 'MANAGER'],
    defaultObjective: 'Synthèse hebdomadaire des tâches exécutées, avancement des dossiers en cours, points de blocage et priorités S+1.',
    contextPrompts: [
      'Période couverte : semaine ouvrée complète selon le plan de charge validé par la hiérarchie.',
      'Périmètre : exécution des tâches assignées sur le tableau Kanban et traitement des dossiers opérationnels du service.',
    ],
    achievementPrompts: [
      '• Clôture des dossiers prioritaires assignés dans les délais convenus avec transmission des livrables.',
      '• Suivi quotidien des demandes entrantes, coordination logistique et mise à jour des fiches de suivi.',
      '• Participation aux points d’équipe et remontée des informations terrain.',
    ],
    riskPrompts: [
      '• Attente de retour ou de validation externe retardant la finalisation d’un dossier.',
      '• Charge ponctuelle élevée nécessitant un arbitrage sur les priorités de la semaine suivante.',
    ],
    recommendationPrompts: [
      '• Prioriser les tâches en statut « En révision » dès le début de la semaine prochaine.',
      '• Solliciter le visa N+1 sur les dossiers prêts afin de libérer les étapes aval.',
    ],
    suggestedKpis: [
      { label: 'Tâches clôturées sur la semaine', targetValue: '5', unit: 'tâches' },
      { label: 'Respect des échéances', targetValue: '95', unit: '%' },
    ],
  },
  {
    id: 'tpl-rpt-mensuel',
    code: 'TRM-TRV-M02',
    type: 'RAPPORT_TRAVAIL_MENSUEL',
    title: 'Rapport d’Activité Mensuel de Service (Manager / Chef de Pôle)',
    targetRoles: ['MANAGER', 'DIRECTION'],
    defaultObjective: 'Bilan mensuel consolidé du pôle : performance opérationnelle, charge d’équipe, KPIs et arbitrage Direction.',
    contextPrompts: [
      'Bilan mensuel des activités du pôle couvrant les opérations courantes, les missions terrain et les engagements clients/institutionnels.',
      'Analyse comparative entre les objectifs fixés en début de mois et les réalisations constatées par les équipes.',
    ],
    achievementPrompts: [
      '• Pilotage et validation des livrables majeurs de l’équipe dans le respect des standards qualité.',
      '• Coordination inter-services (RH, Finance SYSCOHADA, Logistique) et suivi des ordres de mission du pôle.',
      '• Amélioration continue des processus internes et accompagnement des collaborateurs.',
    ],
    riskPrompts: [
      '• Chevauchement de congés / missions nécessitant une réallocation temporaire des ressources.',
      '• Dérive potentielle de délai sur un chantier dépendant d’un prestataire externe.',
    ],
    recommendationPrompts: [
      '• Valider le plan de charge M+1 et sécuriser les disponibilités clés sur le planning partagé.',
      '• Arbitrer les demandes budgétaires et ressources additionnelles en comité de direction.',
    ],
    suggestedKpis: [
      { label: 'Taux d’exécution du plan mensuel', targetValue: '90', unit: '%' },
      { label: 'Délai moyen de traitement des validations', targetValue: '24', unit: 'h' },
      { label: 'Taux de conformité livrables', targetValue: '98', unit: '%' },
    ],
  },
  {
    id: 'tpl-rpt-projet',
    code: 'TRM-PRJ-03',
    type: 'RAPPORT_PROJET',
    title: 'Rapport d’Avancement Projet & Livrables',
    targetRoles: ['MANAGER', 'EMPLOYEE', 'DIRECTION'],
    defaultObjective: 'Point d’étape structuré sur les jalons du projet, le budget consommé, les risques critiques et les décisions attendues.',
    contextPrompts: [
      'Revue d’avancement du projet portant sur les jalons contractuels, les livrables techniques et la mobilisation des parties prenantes.',
    ],
    achievementPrompts: [
      '• Validation du jalon intermédiaire et recette des livrables avec les parties prenantes.',
      '• Avancement conforme des chantiers logistiques, techniques et documentaires.',
    ],
    riskPrompts: [
      '• Dépendance critique sur la livraison d’un sous-traitant ou la disponibilité d’un site.',
    ],
    recommendationPrompts: [
      '• Acter le passage au jalon suivant et confirmer le planning de déploiement final.',
    ],
    suggestedKpis: [
      { label: 'Avancement global projet', targetValue: '75', unit: '%' },
      { label: 'Jalons respectés dans les délais', targetValue: '100', unit: '%' },
    ],
  },
  {
    id: 'tpl-rpt-direction',
    code: 'TRM-DIR-04',
    type: 'RAPPORT_DIRECTION',
    title: 'Rapport Consolidé de Direction & Gouvernance',
    targetRoles: ['DIRECTION'],
    defaultObjective: 'Note de synthèse stratégique pour la Direction Générale / Conseil : résultats consolidés, arbitrages et feuille de route.',
    contextPrompts: [
      'Synthèse exécutive à destination de la Direction Générale et des instances de gouvernance regroupant les indicateurs clés des pôles.',
      'Évaluation transversale des engagements financiers, de la performance des équipes et de l’avancement des missions stratégiques.',
    ],
    achievementPrompts: [
      '• Consolidation des résultats opérationnels et financiers sur la période de référence.',
      '• Signature des conventions stratégiques, supervision des missions extérieures et suivi des pôles.',
    ],
    riskPrompts: [
      '• Exposition budgétaire ou tension de trésorerie à anticiper sur le prochain trimestre.',
      '• Risque de calendrier sur les projets structurants nécessitant un arbitrage exécutif.',
    ],
    recommendationPrompts: [
      '• Adopter les mesures d’optimisation des coûts de mission et renforcer le contrôle budgétaire DAGE.',
      '• Diffuser les orientations stratégiques aux managers de pôles via note de service.',
    ],
    suggestedKpis: [
      { label: 'Taux de réalisation stratégique', targetValue: '88', unit: '%' },
      { label: 'Maîtrise enveloppe missions', targetValue: '95', unit: '%' },
      { label: 'Indice de satisfaction interne', targetValue: '90', unit: '%' },
    ],
  },
];

const workReports: WorkReportRecord[] = [
  {
    id: 'rpt-1',
    reference: 'RPT-2026-038',
    type: 'RAPPORT_MISSION',
    status: 'VALIDE',
    title: 'Rapport de mission — Contrôle budgétaire & inventaire Antenne Sud (Ziguinchor)',
    authorUserId: 'acc-u-1',
    authorName: 'Amadou Konté',
    authorJobTitle: 'Directeur Administratif & Financier',
    authorRole: 'ACCOUNTANT',
    department: 'Finance & SYSCOHADA',
    organizationId: 'tpd-demo-intranet',
    periodLabel: '11–13 Nov 2026 (3 jours)',
    startDate: '2026-11-11',
    endDate: '2026-11-13',
    location: 'Ziguinchor — Antenne Régionale',
    linkedMissionId: 'om-4',
    linkedMissionRef: 'OM-2026-080',
    linkedTaskCodes: ['TSK-2026-002'],
    executiveSummary:
      'Mission d’audit financier et d’inventaire exécutée du 11 au 13 novembre 2026 à Ziguinchor. Rapprochement bancaire et caisse conformes, PV d’inventaire des immobilisations signé, dépense réelle maîtrisée à 368 500 FCFA (économie de 14 500 FCFA sur l’enveloppe prévue).',
    contextAndObjectives:
      'Conformément à l’ordre de mission OM-2026-080, la mission avait pour objet le contrôle de la régie d’avances de l’Antenne Sud, la vérification physique des immobilisations et le rapprochement des pièces comptables SYSCOHADA.',
    activitiesAndDeliverables:
      '• Audit exhaustif du journal de caisse et rapprochement des relevés d’octobre et novembre 2026.\n• Inventaire physique de 42 équipements étiquetés et établissement du procès-verbal contradictoire avec le chef d’antenne.\n• Formation courte de l’assistante administrative locale sur la numérisation des factures normalisées.',
    difficultiesAndRisks:
      '• Retard mineur de transmission de deux factures prestataires locales (récupérées et validées sur place).\n• Capacité de stockage réseau local limitée à renforcer au T1 2027.',
    recommendationsAndNextSteps:
      '• Procéder à la liquidation finale du solde de mission (62 100 FCFA) en comptabilité.\n• Généraliser le contrôle trimestriel à distance via le coffre-fort GED.',
    kpis: [
      { id: 'kpi-r1-1', label: 'Immobilisations inventoriées', targetValue: '42', actualValue: '42', unit: 'actifs', status: 'ATTEINT' },
      { id: 'kpi-r1-2', label: 'Dépense réelle vs budget (383k)', targetValue: '383 000', actualValue: '368 500', unit: 'FCFA', status: 'ATTEINT' },
    ],
    actionPlan: [
      { id: 'act-r1-1', action: 'Liquidation financière OM-2026-080', owner: 'Amadou Konté', deadline: '2026-11-22', priority: 'HAUTE', status: 'EN_COURS' },
      { id: 'act-r1-2', action: 'Archivage PV inventaire en GED Sécurisée', owner: 'Cheikh Tidiane Fall', deadline: '2026-11-25', priority: 'NORMALE', status: 'FAIT' },
    ],
    attachmentsNote: 'FAC-HTL-882, TKT-AS-4410, PV-INV-ZIG-2026.pdf',
    reviewerName: 'Cheikh Tidiane Fall',
    reviewNote: 'Rapport complet et chiffré. Validé pour liquidation DAGE.',
    completenessPct: 100,
    wordCount: 185,
    reviewTrail: [
      { id: 'rt-1', stepLabel: 'Rédaction initiale', actorName: 'Amadou Konté', actorRole: 'DAF', action: 'CREATION', timestamp: '2026-11-14T15:30:00Z' },
      { id: 'rt-2', stepLabel: 'Soumission Direction', actorName: 'Amadou Konté', actorRole: 'DAF', action: 'SOUMIS', timestamp: '2026-11-14T16:15:00Z' },
      { id: 'rt-3', stepLabel: 'Validation Direction Générale', actorName: 'Cheikh Tidiane Fall', actorRole: 'OWNER', action: 'VALIDATION', note: 'Validé pour liquidation DAGE.', timestamp: '2026-11-15T10:10:00Z' },
    ],
    submittedAt: '2026-11-14T16:15:00Z',
    validatedAt: '2026-11-15T10:10:00Z',
    createdAt: '2026-11-14T15:30:00Z',
    updatedAt: '2026-11-15T10:10:00Z',
  },
  {
    id: 'rpt-2',
    reference: 'RPT-2026-039',
    type: 'RAPPORT_TRAVAIL_HEBDO',
    status: 'SOUMIS',
    title: 'Rapport hebdomadaire — Préparation logistique & déploiement matériel S47',
    authorUserId: 'int-u-3',
    authorName: 'Moussa Ndiaye',
    authorJobTitle: 'Chargé de Logistique',
    authorRole: 'EMPLOYEE',
    department: 'Pôle Événementiel & Projets',
    organizationId: 'tpd-demo-intranet',
    periodLabel: 'Semaine 47 · 16–20 Nov 2026',
    startDate: '2026-11-16',
    endDate: '2026-11-20',
    location: 'Dakar Plateau / Diamniadio',
    linkedTaskCodes: ['TSK-2026-001', 'TSK-2026-004'],
    executiveSummary:
      'Semaine dédiée à la sécurisation des équipements audiovisuels pour le Sommet Économique de Diamniadio et à la préparation de l’ordre de mission Saint-Louis (OM-2026-082). 4 livrables finalisés sur 5 prévus.',
    contextAndObjectives:
      'Assurer la disponibilité complète du matériel de régie avant le déploiement à Diamniadio et boucler le dossier logistique pour l’Antenne Nord.',
    activitiesAndDeliverables:
      '• Vérification technique et test complet de 3 kits sonorisation et 2 vidéoprojecteurs laser.\n• Coordination avec le prestataire signalétique pour la livraison des kakémonos institutionnels.\n• Préparation et soumission de l’ordre de mission OM-2026-082 (Saint-Louis) avec réservation du véhicule SUV DK-4821-AM.',
    difficultiesAndRisks:
      '• En attente du visa N+1 sur OM-2026-082 pour confirmer le départ du 25 novembre.\n• Un câble HDMI longue portée défectueux remplacé sur stock interne.',
    recommendationsAndNextSteps:
      '• Valider OM-2026-082 avant lundi 12h00 afin d’engager la dotation carburant.\n• Prévoir un jeu de batteries de secours supplémentaire pour la régie mobile.',
    kpis: [
      { id: 'kpi-r2-1', label: 'Kits régie testés & conformes', targetValue: '5', actualValue: '5', unit: 'kits', status: 'ATTEINT' },
      { id: 'kpi-r2-2', label: 'Tâches semaine clôturées', targetValue: '5', actualValue: '4', unit: 'tâches', status: 'EN_COURS' },
    ],
    actionPlan: [
      { id: 'act-r2-1', action: 'Visa N+1 sur OM-2026-082 (Saint-Louis)', owner: 'Fatou Binetou Sarr', deadline: '2026-11-21', priority: 'URGENTE', status: 'A_LANCER' },
      { id: 'act-r2-2', action: 'Chargement matériel CICAD Diamniadio', owner: 'Moussa Ndiaye', deadline: '2026-11-22', priority: 'HAUTE', status: 'EN_COURS' },
    ],
    attachmentsNote: 'Checklist régie S47 + bon de sortie magasin #MG-114',
    completenessPct: 95,
    wordCount: 162,
    reviewTrail: [
      { id: 'rt-4', stepLabel: 'Rédaction & Soumission Manager', actorName: 'Moussa Ndiaye', actorRole: 'EMPLOYEE', action: 'SOUMIS', timestamp: '2026-11-19T17:30:00Z' },
    ],
    submittedAt: '2026-11-19T17:30:00Z',
    createdAt: '2026-11-19T16:45:00Z',
    updatedAt: '2026-11-19T17:30:00Z',
  },
  {
    id: 'rpt-3',
    reference: 'RPT-2026-040',
    type: 'RAPPORT_PROJET',
    status: 'SOUMIS',
    title: 'Point d’avancement Projet — Sommet Économique CICAD Diamniadio',
    authorUserId: 'int-u-2',
    authorName: 'Fatou Binetou Sarr',
    authorJobTitle: 'Responsable Pôle Événementiel',
    authorRole: 'MANAGER',
    department: 'Pôle Événementiel & Projets',
    organizationId: 'tpd-demo-intranet',
    periodLabel: 'Novembre 2026 · Jalon J-7',
    startDate: '2026-11-01',
    endDate: '2026-11-19',
    location: 'Diamniadio — CICAD',
    linkedMissionId: 'om-1',
    linkedMissionRef: 'OM-2026-081',
    linkedTaskCodes: ['TSK-2026-001'],
    executiveSummary:
      'Avancement global à 88% à 7 jours de l’ouverture. Scénographie et protocole VIP validés avec les équipes du CICAD, 94% des badges officiels édités. Un point de vigilance subsiste sur la coordination transport des délégations régionales.',
    contextAndObjectives:
      'Piloter la production événementielle complète du Sommet Économique : accueil protocolaire, gestion des prestataires techniques, coordination des interprètes et couverture média.',
    activitiesAndDeliverables:
      '• Visite de repérage technique à Diamniadio (OM-2026-081) et validation des plans d’implantation des 3 salles plénières.\n• Confirmation écrite des 4 prestataires clés (traiteur, sonorisation, traduction simultanée, sécurité).\n• Publication du conducteur minute par minute validé avec la Direction Générale.',
    difficultiesAndRisks:
      '• Confirmation tardive de 2 intervenants internationaux nécessitant une adaptation du programme imprimé.\n• Besoin d’un véhicule navette supplémentaire le jour J.',
    recommendationsAndNextSteps:
      '• Figer le conducteur définitif vendredi à 16h00 avant lancement de l’impression.\n• Approuver l’affectation d’un chauffeur d’astreinte supplémentaire sur la journée du sommet.',
    kpis: [
      { id: 'kpi-r3-1', label: 'Avancement préparation globale', targetValue: '90', actualValue: '88', unit: '%', status: 'EN_COURS' },
      { id: 'kpi-r3-2', label: 'Prestataires contractualisés', targetValue: '4', actualValue: '4', unit: 'contrats', status: 'ATTEINT' },
      { id: 'kpi-r3-3', label: 'Accréditations délivrées', targetValue: '250', actualValue: '235', unit: 'badges', status: 'EN_COURS' },
    ],
    actionPlan: [
      { id: 'act-r3-1', action: 'Validation finale conducteur VIP', owner: 'Cheikh Tidiane Fall', deadline: '2026-11-21', priority: 'URGENTE', status: 'EN_COURS' },
      { id: 'act-r3-2', action: 'Répétition générale technique CICAD', owner: 'Fatou Binetou Sarr', deadline: '2026-11-23', priority: 'HAUTE', status: 'A_LANCER' },
    ],
    attachmentsNote: 'Plan implantation CICAD v3 + Conducteur officiel',
    completenessPct: 98,
    wordCount: 196,
    reviewTrail: [
      { id: 'rt-5', stepLabel: 'Création rapport projet', actorName: 'Fatou Binetou Sarr', actorRole: 'MANAGER', action: 'CREATION', timestamp: '2026-11-19T11:00:00Z' },
      { id: 'rt-6', stepLabel: 'Transmission Direction Générale', actorName: 'Fatou Binetou Sarr', actorRole: 'MANAGER', action: 'SOUMIS', timestamp: '2026-11-19T14:20:00Z' },
    ],
    submittedAt: '2026-11-19T14:20:00Z',
    createdAt: '2026-11-19T11:00:00Z',
    updatedAt: '2026-11-19T14:20:00Z',
  },
  {
    id: 'rpt-4',
    reference: 'RPT-2026-041',
    type: 'RAPPORT_DIRECTION',
    status: 'BROUILLON',
    title: 'Note de synthèse Direction — Performance Pôles & Engagements T4 2026',
    authorUserId: 'int-u-1',
    authorName: 'Cheikh Tidiane Fall',
    authorJobTitle: 'Directeur Général',
    authorRole: 'OWNER',
    department: 'Direction Générale',
    organizationId: 'tpd-demo-intranet',
    periodLabel: 'Trimestre T4 2026 (Situation mi-parcours)',
    startDate: '2026-10-01',
    endDate: '2026-11-20',
    location: 'Dakar Plateau — Siège',
    linkedMissionId: 'om-3',
    linkedMissionRef: 'OM-2026-083',
    linkedTaskCodes: [],
    executiveSummary:
      'Consolidation intermédiaire du T4 2026 : progression soutenue des pôles Événementiel et Formation Pro, maîtrise de l’enveloppe des ordres de mission et préparation de la session régionale UEMOA à Abidjan.',
    contextAndObjectives:
      'Évaluer l’exécution budgétaire et opérationnelle à mi-trimestre et préparer les décisions d’arbitrage pour la clôture annuelle.',
    activitiesAndDeliverables:
      '• Revue des indicateurs CRM, recouvrement et facturation SYSCOHADA.\n• Préparation du dossier stratégique pour la Commission Régionale UEMOA à Abidjan (OM-2026-083).',
    difficultiesAndRisks:
      '• Délais de recouvrement sur deux comptes institutionnels à accélérer avant fin décembre.',
    recommendationsAndNextSteps:
      '• Mettre en place un comité hebdomadaire de suivi recouvrement & liquidation des missions.',
    kpis: [
      { id: 'kpi-r4-1', label: 'Taux d’exécution objectifs T4', targetValue: '85', actualValue: '79', unit: '%', status: 'EN_COURS' },
      { id: 'kpi-r4-2', label: 'Conformité justificatifs missions', targetValue: '100', actualValue: '96', unit: '%', status: 'ATTEINT' },
    ],
    actionPlan: [
      { id: 'act-r4-1', action: 'Comité recouvrement fin d’exercice', owner: 'Amadou Konté', deadline: '2026-11-28', priority: 'HAUTE', status: 'A_LANCER' },
    ],
    completenessPct: 88,
    wordCount: 138,
    reviewTrail: [
      { id: 'rt-7', stepLabel: 'Initialisation brouillon Direction', actorName: 'Cheikh Tidiane Fall', actorRole: 'OWNER', action: 'CREATION', timestamp: '2026-11-20T08:45:00Z' },
    ],
    createdAt: '2026-11-20T08:45:00Z',
    updatedAt: '2026-11-20T08:45:00Z',
  },
];

// 8. Superadmin Multi-Tenant Back-office (EF-190 à EF-197)
const tenantsList: TenantRecord[] = [
  {
    id: 'tpd-demo-intranet',
    name: 'Teranga Prestige Digital (Siège)',
    logoUrl: '/src/assets/images/logo_org_teranga_1795100810532.jpg',
    subdomain: 'teranga.terangaprestige.digital',
    customDomain: 'intranet.terangaprestige.sn',
    plan: 'PREMIUM',
    status: 'ACTIF',
    adminEmail: 'direction@teranga-demo.sn',
    userCount: 48,
    userQuota: 100,
    storageUsedGb: 18.4,
    storageQuotaGb: 100,
    monthlyFeeFcfa: 240000,
    enabledModules: ['hr', 'workflows', 'ged', 'comms', 'operations', 'crm', 'accounting', 'events', 'training'],
    featureFlags: ['v1_full', 'qr_attestations', 'webhooks_hmac'],
    createdAt: '2026-01-15',
  },
  {
    id: 'sonatel-business',
    name: 'Sonatel Business Solutions',
    logoUrl: '/src/assets/images/logo_org_sonatel_biz_1795100811818.jpg',
    subdomain: 'sonatel-biz.terangaprestige.digital',
    plan: 'PREMIUM',
    status: 'ACTIF',
    adminEmail: 'apprenant@teranga-demo.sn',
    userCount: 120,
    userQuota: 250,
    storageUsedGb: 42.1,
    storageQuotaGb: 250,
    monthlyFeeFcfa: 450000,
    enabledModules: ['hr', 'workflows', 'ged', 'comms', 'training'],
    featureFlags: ['v1_full', 'sso_oidc'],
    createdAt: '2026-04-02',
  },
  {
    id: 'ministere-modernisation',
    name: 'Direction Modernisation Administrative',
    logoUrl: '/src/assets/images/logo_org_public_admin_1795100810727.jpg',
    subdomain: 'dma-etat.terangaprestige.digital',
    customDomain: 'portail.fonctionpublique.gouv.sn',
    plan: 'SOUVERAIN',
    status: 'ACTIF',
    adminEmail: 'sg@dma.gouv.sn',
    userCount: 310,
    userQuota: 500,
    storageUsedGb: 112.0,
    storageQuotaGb: 1000,
    monthlyFeeFcfa: 1250000,
    enabledModules: ['hr', 'workflows', 'ged', 'comms', 'operations'],
    featureFlags: ['sovereign_dedicated', 'classification_secret', 'courrier_v2'],
    createdAt: '2026-06-10',
  },
  {
    id: 'hotel-terrou-bi',
    name: 'Hôtel Terrou-Bi Resort Dakar',
    logoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
    subdomain: 'terroubi.terangaprestige.digital',
    plan: 'STANDARD',
    status: 'ESSAI_30J',
    adminEmail: 'drh@terroubi.sn',
    userCount: 32,
    userQuota: 50,
    storageUsedGb: 4.8,
    storageQuotaGb: 25,
    monthlyFeeFcfa: 180000,
    enabledModules: ['hr', 'workflows', 'comms', 'planning'],
    featureFlags: ['v1_core'],
    createdAt: '2026-11-01',
  },
];

const tenantInvoices: TenantInvoiceRecord[] = [
  {
    id: 'tinv-1',
    invoiceNumber: 'FAC-SAAS-2026-1101',
    tenantId: 'tpd-demo-intranet',
    tenantName: 'Teranga Prestige Digital (Siège)',
    periodLabel: 'Novembre 2026',
    amountFcfa: 240000,
    paymentMethod: 'WAVE',
    status: 'PAYEE',
    issuedAt: '2026-11-01',
    paidAt: '2026-11-02',
  },
  {
    id: 'tinv-2',
    invoiceNumber: 'FAC-SAAS-2026-1102',
    tenantId: 'sonatel-business',
    tenantName: 'Sonatel Business Solutions',
    periodLabel: 'Novembre 2026',
    amountFcfa: 450000,
    paymentMethod: 'ORANGE_MONEY',
    status: 'PAYEE',
    issuedAt: '2026-11-01',
    paidAt: '2026-11-03',
  },
  {
    id: 'tinv-3',
    invoiceNumber: 'FAC-SAAS-2026-1103',
    tenantId: 'ministere-modernisation',
    tenantName: 'Direction Modernisation Administrative',
    periodLabel: 'Novembre 2026',
    amountFcfa: 1250000,
    paymentMethod: 'VIREMENT',
    status: 'PAYEE',
    issuedAt: '2026-11-01',
    paidAt: '2026-11-08',
  },
  {
    id: 'tinv-4',
    invoiceNumber: 'FAC-SAAS-2026-1104',
    tenantId: 'hotel-terrou-bi',
    tenantName: 'Hôtel Terrou-Bi Resort Dakar',
    periodLabel: 'Novembre 2026 (Activation)',
    amountFcfa: 180000,
    paymentMethod: 'WAVE',
    status: 'EN_ATTENTE',
    issuedAt: '2026-11-14',
  },
];

const supportTickets: SupportTicketRecord[] = [
  {
    id: 'tkt-1',
    reference: 'SUP-2026-084',
    tenantId: 'hotel-terrou-bi',
    tenantName: 'Hôtel Terrou-Bi Resort Dakar',
    requesterName: 'DRH Terrou-Bi',
    subject: 'Import CSV 32 collaborateurs en rotation 3x8',
    severity: 'P2_MAJEUR',
    status: 'EN_COURS',
    slaTarget: '4h ouvrées',
    createdAt: '2026-11-17T13:20:00Z',
  },
  {
    id: 'tkt-2',
    reference: 'SUP-2026-081',
    tenantId: 'ministere-modernisation',
    tenantName: 'Direction Modernisation Administrative',
    requesterName: 'DSI Ministère',
    subject: 'Activation webhook HMAC pour parapheur interne',
    severity: 'P3_STANDARD',
    status: 'OUVERT',
    slaTarget: '30 min 24/7',
    createdAt: '2026-11-18T06:45:00Z',
  },
];

const servicesHealth: ServiceHealthMetric[] = [
  { service: 'API & Passerelle Multi-Tenant', status: 'OPERATIONNEL', uptimePct: 99.98, latencyMs: 42 },
  { service: 'PostgreSQL RLS & Sauvegardes WAL', status: 'OPERATIONNEL', uptimePct: 99.99, latencyMs: 14 },
  { service: 'Moteur Workflow & Files BullMQ', status: 'OPERATIONNEL', uptimePct: 99.95, latencyMs: 28 },
  { service: 'Notifications SMTP / SMS Sénégal / Push', status: 'OPERATIONNEL', uptimePct: 99.82, latencyMs: 118 },
  { service: 'Stockage Objets GED & Antivirus', status: 'OPERATIONNEL', uptimePct: 99.97, latencyMs: 65 },
];

// --- Helpers ---

function calculateSenegalWorkingDays(startDate: string, endDate: string, halfDay: 'FULL' | 'MORNING' | 'AFTERNOON'): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  const holidayDates = new Set(senegalHolidays.map((h) => h.date));
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    const iso = cursor.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidayDates.has(iso)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (halfDay !== 'FULL' && count === 1) return 0.5;
  return count;
}

function pushNotification(params: {
  userId: string;
  organizationId: string;
  title: string;
  message: string;
  category: NotificationItem['category'];
  priority?: NotificationItem['priority'];
  targetSection?: string;
}): void {
  notificationsList.unshift({
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    userId: params.userId,
    organizationId: params.organizationId,
    title: params.title,
    message: params.message,
    category: params.category,
    priority: params.priority || 'NORMALE',
    channelsSent: ['IN_APP', 'EMAIL'],
    targetSection: params.targetSection,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

function canManageHr(actor: ActiveActorContext): boolean {
  return (
    actor.space === 'superadmin' ||
    (actor.space === 'intranet' && ['OWNER', 'DIRECTION', 'MANAGER'].includes(actor.role))
  );
}

function canApproveWorkflows(actor: ActiveActorContext): boolean {
  return (
    actor.space === 'superadmin' ||
    (actor.space === 'intranet' && ['OWNER', 'DIRECTION', 'MANAGER'].includes(actor.role)) ||
    (actor.space === 'accounting' && actor.role === 'ACCOUNTANT')
  );
}

function buildDirectoryMembers(actor: ActiveActorContext): DirectoryMemberRecord[] {
  const all: DirectoryMemberRecord[] = [
    ...store.intranetUsers.map((u) => {
      const hr = hrProfiles.find((p) => p.userId === u.id);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        phone: hr?.phone || '+221 77 000 00 00',
        space: 'intranet' as const,
        role: u.role,
        jobTitle: u.title,
        department: hr?.department || 'Organisation',
        site: hr?.site || 'Dakar Plateau',
        skills: u.role === 'OWNER' ? ['Stratégie', 'Gouvernance', 'SYSCOHADA'] : u.role === 'MANAGER' ? ['Événementiel', 'CRM', 'Pilotage'] : ['Logistique', 'Terrain', 'Protocole'],
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        hidePersonalPhone: false,
        avatarUrl: u.avatarUrl,
      };
    }),
    ...store.accountingUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: '+221 77 312 45 80',
      space: 'accounting' as const,
      role: u.role,
      jobTitle: u.role === 'ACCOUNTANT' ? 'Directeur Financier' : 'Auditeur Externe',
      department: 'Finance & SYSCOHADA',
      site: 'Dakar Plateau',
      skills: ['SYSCOHADA', 'Fiscalité UEMOA', 'Audit'],
      organizationId: u.organizationId,
      organizationName: u.organizationName,
      hidePersonalPhone: u.role === 'READ_ONLY',
      avatarUrl: u.avatarUrl,
    })),
    ...store.instructorUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: '+221 77 510 30 20',
      space: 'instructor' as const,
      role: 'INSTRUCTOR',
      jobTitle: u.specialty,
      department: 'Formateurs Certifiés',
      site: u.city,
      skills: [u.specialty, 'Pédagogie', 'Certification'],
      organizationId: u.city,
      organizationName: `Formateur · ${u.city}`,
      hidePersonalPhone: false,
      avatarUrl: u.avatarUrl,
    })),
    ...store.providerUsers.map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      phone: '+221 77 880 12 12',
      space: 'provider' as const,
      role: 'PROVIDER',
      jobTitle: u.roleTitle,
      department: 'Prestataires Partenaires',
      site: u.city,
      skills: [u.roleTitle, 'Événementiel'],
      organizationId: u.companyName,
      organizationName: u.companyName,
      hidePersonalPhone: false,
      avatarUrl: u.avatarUrl,
      companyLogoUrl: u.companyLogoUrl,
    })),
  ];

  if (actor.space === 'superadmin') return all;
  if (actor.space === 'intranet') {
    return all.filter((m) => m.space === 'intranet' || m.space === 'accounting' || m.space === 'instructor' || m.space === 'provider');
  }
  return all.filter((m) => m.userId === actor.id || m.space === 'intranet' || m.space === actor.space);
}

// --- Registration ---

export function registerCahierModules(app: Express, deps: RegisterCahierDeps): void {
  const { getActiveActor, addAuditLog } = deps;

  // =========================================================================
  // 1. MODULE RH, CONGÉS, POINTAGE & ATTESTATIONS (EF-030 à EF-044)
  // =========================================================================
  function buildHrOverview(actor: ActiveActorContext): HrOverviewPayload {
    const canManage = canManageHr(actor);
    let visibleProfiles = hrProfiles;
    if (actor.space !== 'superadmin') {
      if (canManage) {
        visibleProfiles = hrProfiles.filter(
          (p) => p.organizationId === actor.organizationId || p.userId === actor.id,
        );
      } else {
        visibleProfiles = hrProfiles.filter((p) => p.userId === actor.id);
      }
    }

    // Ensure non-seeded users still get a dynamic profile & leave balance
    let ownProfile = hrProfiles.find((p) => p.userId === actor.id) || null;
    if (!ownProfile) {
      ownProfile = {
        userId: actor.id,
        matricule: `TPD-${actor.id.slice(-3).toUpperCase()}`,
        name: actor.name,
        email: actor.email,
        phone: '+221 77 000 00 00',
        organizationId: actor.organizationId,
        department: actor.space === 'accounting' ? 'Finance & SYSCOHADA' : 'Direction Opérationnelle',
        service: actor.role,
        site: 'Dakar Plateau',
        jobTitle: actor.role,
        managerName: 'Direction Générale',
        contractType: 'CDI',
        hireDate: '2024-01-15',
        workCycle: 'FIXE_08_17',
        seniorityYears: 2,
      };
      hrProfiles.push(ownProfile);
      leaveBalances.push({
        userId: actor.id,
        leaveType: 'ANNUEL',
        acquiredDays: 24,
        usedDays: 2,
        pendingDays: 0,
        remainingDays: 22,
      });
      if (!canManage) visibleProfiles = [ownProfile];
    }

    const visibleUserIds = new Set(visibleProfiles.map((p) => p.userId));
    const balances = leaveBalances.filter((b) => visibleUserIds.has(b.userId));
    const visibleLeaves = leaveRequests.filter((r) => visibleUserIds.has(r.userId));
    const visibleAttendance = attendanceEntries.filter((a) => visibleUserIds.has(a.userId));
    const visibleAttestations = hrAttestations.filter((a) => visibleUserIds.has(a.userId));

    const alerts: HrAlertItem[] = [];
    for (const p of visibleProfiles) {
      if (p.contractEndDate) {
        alerts.push({
          id: `al-cdd-${p.userId}`,
          userId: p.userId,
          userName: p.name,
          category: 'FIN_CDD',
          dueDate: p.contractEndDate,
          severity: 'WARNING',
          message: `Échéance CDD prévue le ${p.contractEndDate} — renouvellement ou CDI à anticiper.`,
        });
      }
      if (p.medicalVisitDate) {
        alerts.push({
          id: `al-med-${p.userId}`,
          userId: p.userId,
          userName: p.name,
          category: 'VISITE_MEDICALE',
          dueDate: p.medicalVisitDate,
          severity: 'INFO',
          message: `Visite médicale annuelle programmée pour le ${p.medicalVisitDate}.`,
        });
      }
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      profiles: visibleProfiles,
      ownProfile,
      leaveRules,
      holidays: senegalHolidays,
      balances,
      leaveRequests: visibleLeaves,
      attendance: visibleAttendance,
      attestations: visibleAttestations,
      alerts,
      canManageTeam: canManage,
      stats: {
        headcount: visibleProfiles.length,
        pendingLeaves: visibleLeaves.filter((l) => l.status === 'EN_ATTENTE').length,
        approvedDaysThisMonth: visibleLeaves
          .filter((l) => l.status === 'APPROUVE')
          .reduce((s, l) => s + l.workingDays, 0),
        presentToday: visibleAttendance.filter((a) => a.date === todayIso || a.date === '2026-11-18').length,
        alertsCount: alerts.length,
      },
    };
  }

  app.get('/api/hr/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildHrOverview(actor));
  });

  function buildSharedAvailability(actor: ActiveActorContext): SharedAvailabilityPayload {
    const leaveShortLabels: Record<LeaveTypeCode, string> = {
      ANNUEL: 'Congé annuel',
      MALADIE: 'Congé maladie',
      MATERNITE_PATERNITE: 'Congé maternité / paternité',
      MARIAGE: 'Permission mariage',
      DECES: 'Permission familiale',
      RECUPERATION: 'Récupération',
      MISSION: 'Ordre de mission',
      SANS_SOLDE: 'Congé sans solde',
    };

    const statusLabels: Record<LeaveRequestRecord['status'], string> = {
      EN_ATTENTE: 'En attente de validation',
      APPROUVE_N1: 'Validé N+1',
      APPROUVE: 'Validé RH',
      REJETE: 'Refusé',
      ANNULE: 'Annulé',
    };

    let permissionScope: SharedAvailabilityPermissionScope = 'SELF_ONLY';
    let permissionTitle = 'Vue personnelle uniquement';
    let permissionDescription =
      'Votre rôle externe ne donne pas accès au calendrier interne des absences du personnel. Seules vos propres absences et les jours fériés officiels du Sénégal sont affichés.';
    let canViewLeaveReasons = false;
    let canViewPendingLeaves = false;

    if (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'DIRECTION'))
    ) {
      permissionScope = 'FULL_ORG';
      permissionTitle = 'Direction & Administration RH — Visibilité intégrale';
      permissionDescription =
        'Accès complet multi-départements aux absences validées et demandes en attente avec motifs et natures de congés.';
      canViewLeaveReasons = true;
      canViewPendingLeaves = true;
    } else if (
      (actor.space === 'intranet' && actor.role === 'MANAGER') ||
      (actor.space === 'accounting' && actor.role === 'ACCOUNTANT')
    ) {
      permissionScope = 'TEAM_MANAGER';
      permissionTitle = 'Manager d’équipe — Visibilité organisationnelle (données médicales protégées)';
      permissionDescription =
        'Vous visualisez les absences validées et demandes en attente de votre organisation. Les motifs médicaux des collaborateurs restent strictement confidentiels.';
      canViewLeaveReasons = true;
      canViewPendingLeaves = true;
    } else if (
      (actor.space === 'intranet' && actor.role === 'EMPLOYEE') ||
      (actor.space === 'accounting' && actor.role === 'READ_ONLY')
    ) {
      permissionScope = 'COLLEAGUE_MASKED';
      permissionTitle = 'Collaborateur — Disponibilités anonymisées (RGPD / CDP)';
      permissionDescription =
        'Vous visualisez uniquement les créneaux d’indisponibilité validés de vos collègues sans exposition des motifs ni des demandes en attente.';
      canViewLeaveReasons = false;
      canViewPendingLeaves = false;
    }

    // Build colleague list strictly scoped by HR permissions
    const rawColleagues: SharedColleagueProfile[] = [];
    const seenUserIds = new Set<string>();

    const addProfile = (p: {
      userId: string;
      name: string;
      jobTitle: string;
      department: string;
      site: string;
      organizationId: string;
    }) => {
      if (seenUserIds.has(p.userId)) return;
      seenUserIds.add(p.userId);
      rawColleagues.push({
        userId: p.userId,
        name: p.name,
        jobTitle: p.jobTitle,
        department: p.department,
        site: p.site,
        isSelf: p.userId === actor.id,
      });
    };

    if (permissionScope === 'FULL_ORG') {
      hrProfiles.forEach(addProfile);
      store.intranetUsers.forEach((u) =>
        addProfile({
          userId: u.id,
          name: u.name,
          jobTitle: u.title,
          department: 'Intranet & Projets',
          site: 'Dakar Plateau',
          organizationId: u.organizationId,
        }),
      );
      store.accountingUsers.forEach((u) =>
        addProfile({
          userId: u.id,
          name: u.name,
          jobTitle: u.role === 'ACCOUNTANT' ? 'Directeur Financier' : 'Auditeur SYSCOHADA',
          department: 'Finance & SYSCOHADA',
          site: 'Dakar Plateau',
          organizationId: u.organizationId,
        }),
      );
    } else if (permissionScope === 'TEAM_MANAGER' || permissionScope === 'COLLEAGUE_MASKED') {
      hrProfiles
        .filter((p) => p.organizationId === actor.organizationId || p.userId === actor.id)
        .forEach(addProfile);
      if (actor.space === 'intranet') {
        store.intranetUsers
          .filter((u) => u.organizationId === actor.organizationId)
          .forEach((u) =>
            addProfile({
              userId: u.id,
              name: u.name,
              jobTitle: u.title,
              department: 'Équipe Intranet',
              site: 'Dakar Plateau',
              organizationId: u.organizationId,
            }),
          );
      } else if (actor.space === 'accounting') {
        store.accountingUsers
          .filter((u) => u.organizationId === actor.organizationId)
          .forEach((u) =>
            addProfile({
              userId: u.id,
              name: u.name,
              jobTitle: u.role === 'ACCOUNTANT' ? 'Directeur Financier' : 'Auditeur SYSCOHADA',
              department: 'Finance & SYSCOHADA',
              site: 'Dakar Plateau',
              organizationId: u.organizationId,
            }),
          );
      }
    }

    // Always ensure the active user appears in the matrix (at first position)
    if (!seenUserIds.has(actor.id)) {
      const existingHr = hrProfiles.find((p) => p.userId === actor.id);
      addProfile({
        userId: actor.id,
        name: actor.name,
        jobTitle: existingHr?.jobTitle || actor.role,
        department: existingHr?.department || actor.organizationName,
        site: existingHr?.site || 'Dakar Plateau',
        organizationId: actor.organizationId,
      });
    }

    const colleagues = [...rawColleagues].sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.name.localeCompare(b.name, 'fr');
    });

    const visibleUserIds = new Set(colleagues.map((c) => c.userId));

    const unavailabilities: SharedUnavailabilityBlock[] = [];
    for (const leave of leaveRequests) {
      if (leave.status === 'REJETE' || leave.status === 'ANNULE') continue;
      if (!visibleUserIds.has(leave.userId)) continue;

      const isSelf = leave.userId === actor.id;

      // Employees & Read-Only cannot view colleague pending requests
      if (!isSelf && !canViewPendingLeaves && leave.status === 'EN_ATTENTE') {
        continue;
      }

      if (isSelf || permissionScope === 'FULL_ORG') {
        unavailabilities.push({
          id: leave.id,
          userId: leave.userId,
          userName: leave.userName,
          department: leave.department,
          site: leave.site,
          startDate: leave.startDate,
          endDate: leave.endDate,
          halfDay: leave.halfDay,
          status: leave.status,
          statusLabel: statusLabels[leave.status],
          displayLabel: leaveShortLabels[leave.leaveType] || leave.leaveType,
          leaveType: leave.leaveType,
          reason: leave.reason,
          masked: false,
          isSelf,
        });
        continue;
      }

      if (permissionScope === 'TEAM_MANAGER') {
        const isMedicalPrivate = leave.leaveType === 'MALADIE';
        unavailabilities.push({
          id: leave.id,
          userId: leave.userId,
          userName: leave.userName,
          department: leave.department,
          site: leave.site,
          startDate: leave.startDate,
          endDate: leave.endDate,
          halfDay: leave.halfDay,
          status: leave.status,
          statusLabel: statusLabels[leave.status],
          displayLabel: isMedicalPrivate
            ? 'Absence santé (confidentiel RH)'
            : leaveShortLabels[leave.leaveType] || 'Absence',
          leaveType: isMedicalPrivate ? undefined : leave.leaveType,
          reason: isMedicalPrivate ? undefined : leave.reason,
          masked: isMedicalPrivate,
          isSelf: false,
        });
        continue;
      }

      // COLLEAGUE_MASKED: approved / N1 validated absences only, strict privacy masking
      unavailabilities.push({
        id: leave.id,
        userId: leave.userId,
        userName: leave.userName,
        department: leave.department,
        site: leave.site,
        startDate: leave.startDate,
        endDate: leave.endDate,
        halfDay: leave.halfDay,
        status: leave.status,
        statusLabel: 'Indisponible',
        displayLabel: 'Indisponible (Absence validée)',
        masked: true,
        isSelf: false,
      });
    }

    return {
      permissionScope,
      permissionTitle,
      permissionDescription,
      canViewLeaveReasons,
      canViewPendingLeaves,
      colleagues,
      unavailabilities,
      holidays: senegalHolidays,
    };
  }

  app.get('/api/planning/shared-availability', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildSharedAvailability(actor));
  });

  app.post('/api/hr/leaves', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      leaveType?: LeaveTypeCode;
      startDate?: string;
      endDate?: string;
      halfDay?: 'FULL' | 'MORNING' | 'AFTERNOON';
      reason?: string;
      attachmentLabel?: string;
    };
    if (!body.leaveType || !body.startDate || !body.endDate || !body.reason?.trim()) {
      return res.status(400).json({ error: 'Type, dates et motif requis.' });
    }
    const halfDay = body.halfDay || 'FULL';
    const workingDays = calculateSenegalWorkingDays(body.startDate, body.endDate, halfDay);
    if (workingDays <= 0) {
      return res.status(400).json({ error: 'Aucun jour ouvré dans la plage sélectionnée (week-ends et jours fériés exclus).' });
    }

    // Overlap detection (EF-033)
    const overlap = leaveRequests.find(
      (r) =>
        r.userId === actor.id &&
        r.status !== 'REJETE' &&
        r.status !== 'ANNULE' &&
        !(body.endDate! < r.startDate || body.startDate! > r.endDate),
    );
    if (overlap) {
      return res.status(409).json({ error: `Chevauchement détecté avec la demande ${overlap.reference}.` });
    }

    // Balance check for annual leave
    if (body.leaveType === 'ANNUEL') {
      const bal = leaveBalances.find((b) => b.userId === actor.id && b.leaveType === 'ANNUEL');
      if (bal && bal.remainingDays < workingDays) {
        return res.status(400).json({
          error: `Solde insuffisant (${bal.remainingDays} j disponibles pour ${workingDays} j demandés).`,
        });
      }
      if (bal) {
        bal.pendingDays += workingDays;
        bal.remainingDays = Math.max(0, bal.acquiredDays - bal.usedDays - bal.pendingDays);
      }
    }

    const profile = hrProfiles.find((p) => p.userId === actor.id);
    const reqRecord: LeaveRequestRecord = {
      id: `lvr-${Date.now()}`,
      reference: `CNG-2026-${String(leaveRequests.length + 42).padStart(3, '0')}`,
      userId: actor.id,
      userName: actor.name,
      organizationId: actor.organizationId,
      department: profile?.department || 'Équipe',
      site: profile?.site || 'Dakar Plateau',
      leaveType: body.leaveType,
      startDate: body.startDate,
      endDate: body.endDate,
      halfDay,
      workingDays,
      reason: body.reason.trim(),
      attachmentLabel: body.attachmentLabel?.trim() || undefined,
      status: 'EN_ATTENTE',
      currentApproverName: profile?.managerName || 'Direction Générale',
      createdAt: new Date().toISOString(),
    };
    leaveRequests.unshift(reqRecord);

    pushNotification({
      userId: 'int-u-1',
      organizationId: actor.organizationId,
      title: `Nouvelle demande de congé ${reqRecord.reference}`,
      message: `${actor.name} demande ${workingDays} jour(s) (${body.startDate} → ${body.endDate}).`,
      category: 'RH',
      priority: 'HAUTE',
      targetSection: 'hr',
    });

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'HR_LEAVE_REQUESTED',
      target: reqRecord.reference,
      details: `${workingDays} jour(s) (${body.leaveType}) du ${body.startDate} au ${body.endDate}`,
      severity: 'INFO',
    });

    return res.status(201).json({ request: reqRecord, ...buildHrOverview(actor) });
  });

  app.patch('/api/hr/leaves/:id/decision', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const leave = leaveRequests.find((l) => l.id === req.params.id);
    if (!leave) return res.status(404).json({ error: 'Demande de congé introuvable.' });

    const body = req.body as { decision: 'APPROUVE' | 'REJETE' | 'ANNULE'; note?: string };
    if (body.decision === 'ANNULE') {
      if (leave.userId !== actor.id && !canManageHr(actor)) {
        return res.status(403).json({ error: 'Annulation non autorisée.' });
      }
    } else if (!canManageHr(actor)) {
      return res.status(403).json({ error: 'Seul un manager ou la direction peut approuver/rejeter.' });
    }

    const bal = leaveBalances.find((b) => b.userId === leave.userId && b.leaveType === leave.leaveType);
    if (bal && leave.status === 'EN_ATTENTE') {
      bal.pendingDays = Math.max(0, bal.pendingDays - leave.workingDays);
      if (body.decision === 'APPROUVE') {
        bal.usedDays += leave.workingDays;
      }
      bal.remainingDays = Math.max(0, bal.acquiredDays - bal.usedDays - bal.pendingDays);
    }

    leave.status = body.decision;
    leave.decidedByName = actor.name;
    leave.decidedAt = new Date().toISOString();
    leave.decisionNote = body.note?.trim() || undefined;

    pushNotification({
      userId: leave.userId,
      organizationId: leave.organizationId,
      title: `Congé ${leave.reference} : ${body.decision === 'APPROUVE' ? 'Approuvé' : body.decision === 'REJETE' ? 'Refusé' : 'Annulé'}`,
      message: body.note?.trim() || `Décision enregistrée par ${actor.name}.`,
      category: 'RH',
      priority: body.decision === 'APPROUVE' ? 'NORMALE' : 'HAUTE',
      targetSection: 'hr',
    });

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: `HR_LEAVE_${body.decision}`,
      target: leave.reference,
      details: `${leave.userName} (${leave.workingDays}j)`,
      severity: 'INFO',
    });

    return res.json(buildHrOverview(actor));
  });

  app.post('/api/hr/attendance/clock', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      action: 'IN' | 'OUT';
      site?: string;
      mode?: 'DECLARATIF' | 'QR_SITE' | 'BADGEUSE';
      status?: 'PRESENT' | 'RETARD' | 'TELETRAVAIL';
      note?: string;
    };
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    if (body.action === 'OUT') {
      const existing = attendanceEntries.find((a) => a.userId === actor.id && !a.checkOutTime);
      if (existing) {
        existing.checkOutTime = nowTime;
      }
      return res.json(buildHrOverview(actor));
    }

    const entry: AttendanceEntry = {
      id: `att-${Date.now()}`,
      userId: actor.id,
      userName: actor.name,
      organizationId: actor.organizationId,
      date: todayIso,
      checkInTime: nowTime,
      site: body.site || 'Dakar Plateau',
      mode: body.mode || 'DECLARATIF',
      overtimeHours: 0,
      status: body.status || 'PRESENT',
      note: body.note?.trim() || undefined,
    };
    attendanceEntries.unshift(entry);
    return res.status(201).json(buildHrOverview(actor));
  });

  app.post('/api/hr/attestations', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as { type?: 'TRAVAIL' | 'CONGE' | 'SALAIRE' | 'STAGE' };
    const attestation: HrAttestationRecord = {
      id: `ats-${Date.now()}`,
      reference: `ATT-2026-${String(hrAttestations.length + 20).padStart(3, '0')}`,
      userId: actor.id,
      userName: actor.name,
      type: body.type || 'TRAVAIL',
      issuedAt: new Date().toISOString().slice(0, 10),
      verificationCode: `QR-TPD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      signedBy: 'Direction Générale · Cachet Électronique',
    };
    hrAttestations.unshift(attestation);
    return res.status(201).json({ attestation, ...buildHrOverview(actor) });
  });

  // =========================================================================
  // 2. MODULE DEMANDES & CIRCUITS DE VALIDATION (EF-090 à EF-099)
  // =========================================================================
  function buildWorkflowsOverview(actor: ActiveActorContext): WorkflowsOverviewPayload {
    const canApprove = canApproveWorkflows(actor);
    const canConfigure =
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role));

    const requests = workflowInstances.filter((r) => {
      if (actor.space === 'superadmin') return true;
      if (canApprove) {
        return r.organizationId === actor.organizationId || r.requesterId === actor.id || r.space === 'intranet';
      }
      return r.requesterId === actor.id;
    });

    const inboxRequests = canApprove
      ? requests.filter((r) => r.status === 'EN_ATTENTE' || r.status === 'COMPLEMENT_REQUIS')
      : [];

    const orgDelegations =
      actor.space === 'superadmin'
        ? delegations
        : delegations.filter((d) => d.organizationId === actor.organizationId || d.delegatorUserId === actor.id || d.delegateUserId === actor.id);

    return {
      templates: formTemplates,
      requests,
      inboxRequests,
      delegations: orgDelegations,
      canConfigure,
      canApprove,
      stats: {
        myPending: requests.filter((r) => r.requesterId === actor.id && r.status === 'EN_ATTENTE').length,
        toApproveCount: inboxRequests.length,
        approvedCount: requests.filter((r) => r.status === 'APPROUVEE').length,
        avgTurnaroundHours: 14,
      },
    };
  }

  app.get('/api/workflows/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildWorkflowsOverview(actor));
  });

  app.post('/api/workflows/requests', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      templateId?: string;
      title?: string;
      category?: WorkflowCategory;
      amountFcfa?: number;
      formValues?: Record<string, string>;
    };
    const template = formTemplates.find((t) => t.id === body.templateId) || formTemplates[0];
    if (!body.title?.trim()) {
      return res.status(400).json({ error: 'L’objet de la demande est requis.' });
    }
    const now = new Date().toISOString();
    const deadline = new Date(Date.now() + template.slaHours * 3600 * 1000).toISOString();
    const record: WorkflowInstanceRecord = {
      id: `wf-${Date.now()}`,
      reference: `DEM-2026-${String(workflowInstances.length + 105).padStart(3, '0')}`,
      templateId: template.id,
      templateVersion: template.version,
      category: body.category || template.category,
      title: body.title.trim(),
      requesterId: actor.id,
      requesterName: actor.name,
      organizationId: actor.organizationId,
      space: actor.space,
      department: actor.organizationName,
      amountFcfa: body.amountFcfa ? Number(body.amountFcfa) : undefined,
      formValues: body.formValues || {},
      steps: template.approvalSteps,
      currentStepIndex: 0,
      currentApproverRole: template.approvalSteps[0] || 'Direction',
      status: 'EN_ATTENTE',
      slaDeadlineAt: deadline,
      history: [
        {
          id: `wfh-${Date.now()}`,
          stepLabel: 'Dépôt initial',
          actorId: actor.id,
          actorName: actor.name,
          action: 'SOUMIS',
          comment: 'Demande soumise dans le circuit de validation.',
          timestamp: now,
        },
      ],
      comments: [],
      createdAt: now,
      updatedAt: now,
    };
    workflowInstances.unshift(record);

    pushNotification({
      userId: 'int-u-2',
      organizationId: actor.organizationId,
      title: `Nouvelle demande à valider (${record.reference})`,
      message: `${actor.name} : ${record.title}`,
      category: 'WORKFLOW',
      priority: 'HAUTE',
      targetSection: 'workflows',
    });

    return res.status(201).json({ instance: record, ...buildWorkflowsOverview(actor) });
  });

  app.patch('/api/workflows/requests/:id/action', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const wf = workflowInstances.find((w) => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Demande introuvable.' });

    const body = req.body as {
      action: 'APPROUVE' | 'REJETE' | 'COMPLEMENT' | 'ANNULE';
      comment?: string;
    };
    if (body.action !== 'ANNULE' && !canApproveWorkflows(actor)) {
      return res.status(403).json({ error: 'Droit de validation requis.' });
    }
    if (body.action === 'ANNULE' && wf.requesterId !== actor.id && !canApproveWorkflows(actor)) {
      return res.status(403).json({ error: 'Annulation non autorisée.' });
    }

    const now = new Date().toISOString();
    wf.history.push({
      id: `wfh-${Date.now()}`,
      stepLabel: wf.currentApproverRole,
      actorId: actor.id,
      actorName: actor.name,
      action: body.action === 'ANNULE' ? 'REJETE' : body.action,
      comment: body.comment?.trim() || `Action ${body.action} effectuée.`,
      timestamp: now,
    });

    if (body.action === 'APPROUVE') {
      if (wf.currentStepIndex + 1 < wf.steps.length) {
        wf.currentStepIndex += 1;
        wf.currentApproverRole = wf.steps[wf.currentStepIndex];
        wf.status = 'EN_ATTENTE';
      } else {
        wf.status = 'APPROUVEE';
        wf.verificationQrCode = `QR-WF-${wf.reference}`;
      }
    } else if (body.action === 'REJETE') {
      wf.status = 'REJETEE';
    } else if (body.action === 'COMPLEMENT') {
      wf.status = 'COMPLEMENT_REQUIS';
    } else if (body.action === 'ANNULE') {
      wf.status = 'ANNULEE';
    }
    wf.updatedAt = now;

    pushNotification({
      userId: wf.requesterId,
      organizationId: wf.organizationId,
      title: `Demande ${wf.reference} mise à jour (${wf.status})`,
      message: `${actor.name} : ${body.comment?.trim() || 'Traitement enregistré.'}`,
      category: 'WORKFLOW',
      priority: 'NORMALE',
      targetSection: 'workflows',
    });

    return res.json(buildWorkflowsOverview(actor));
  });

  app.post('/api/workflows/requests/batch-approve', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canApproveWorkflows(actor)) return res.status(403).json({ error: 'Validation par lot réservée aux valideurs.' });

    const body = req.body as { ids?: string[]; comment?: string };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    const now = new Date().toISOString();

    for (const id of ids) {
      const wf = workflowInstances.find((w) => w.id === id);
      if (!wf || wf.status !== 'EN_ATTENTE') continue;
      wf.history.push({
        id: `wfh-${Date.now()}-${id}`,
        stepLabel: wf.currentApproverRole,
        actorId: actor.id,
        actorName: actor.name,
        action: 'APPROUVE',
        comment: body.comment?.trim() || 'Validation par lots.',
        timestamp: now,
      });
      if (wf.currentStepIndex + 1 < wf.steps.length) {
        wf.currentStepIndex += 1;
        wf.currentApproverRole = wf.steps[wf.currentStepIndex];
      } else {
        wf.status = 'APPROUVEE';
        wf.verificationQrCode = `QR-WF-${wf.reference}`;
      }
      wf.updatedAt = now;
    }

    return res.json(buildWorkflowsOverview(actor));
  });

  app.post('/api/workflows/requests/:id/comments', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const wf = workflowInstances.find((w) => w.id === req.params.id);
    if (!wf) return res.status(404).json({ error: 'Demande introuvable.' });
    const body = req.body as { content?: string; visibility?: 'PUBLIC' | 'INTERNE_VALIDEURS' };
    if (!body.content?.trim()) return res.status(400).json({ error: 'Commentaire vide.' });
    wf.comments.push({
      id: `wfc-${Date.now()}`,
      authorId: actor.id,
      authorName: actor.name,
      visibility: body.visibility || 'PUBLIC',
      content: body.content.trim(),
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json(buildWorkflowsOverview(actor));
  });

  app.post('/api/workflows/templates', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as Partial<DynamicFormTemplate>;
    if (!body.title?.trim()) return res.status(400).json({ error: 'Titre du modèle requis.' });
    const tpl: DynamicFormTemplate = {
      id: `tpl-${Date.now()}`,
      code: `FRM-${String(formTemplates.length + 10)}`,
      category: body.category || 'DEMANDE_LIBRE',
      title: body.title.trim(),
      description: body.description?.trim() || 'Formulaire personnalisé sans code',
      version: 1,
      fields: Array.isArray(body.fields) && body.fields.length > 0
        ? body.fields
        : [{ key: 'precision', label: 'Détails de la demande', type: 'textarea', required: true }],
      approvalSteps: Array.isArray(body.approvalSteps) && body.approvalSteps.length > 0
        ? body.approvalSteps
        : ['Manager N+1', 'Direction'],
      slaHours: Number(body.slaHours) || 48,
      active: true,
    };
    formTemplates.unshift(tpl);
    return res.status(201).json(buildWorkflowsOverview(actor));
  });

  app.post('/api/workflows/delegations', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as { delegateName?: string; startDate?: string; endDate?: string; scope?: string };
    if (!body.delegateName?.trim() || !body.startDate || !body.endDate) {
      return res.status(400).json({ error: 'Suppléant et période requis.' });
    }
    delegations.unshift({
      id: `del-${Date.now()}`,
      delegatorUserId: actor.id,
      delegatorName: actor.name,
      delegateUserId: `ext-${Date.now()}`,
      delegateName: body.delegateName.trim(),
      organizationId: actor.organizationId,
      startDate: body.startDate,
      endDate: body.endDate,
      scope: body.scope?.trim() || 'Validations courantes',
      active: true,
    });
    return res.status(201).json(buildWorkflowsOverview(actor));
  });

  // =========================================================================
  // 3. MODULE GED & DOCUMENTS (EF-110 à EF-119)
  // =========================================================================
  function buildGedOverview(actor: ActiveActorContext): GedOverviewPayload {
    const canManage = canManageHr(actor) || actor.space === 'accounting' || actor.space === 'instructor';
    const docs = gedDocuments.filter((d) => {
      if (actor.space === 'superadmin') return true;
      if (d.targetUserId === actor.id || d.ownerUserId === actor.id) return true;
      if (d.classification === 'PUBLIC') return true;
      if (d.classification === 'SECRET') return false;
      if (actor.space === 'intranet') return d.organizationId === actor.organizationId || d.organizationId === 'global';
      if (actor.space === 'accounting') return d.organizationId === 'tpd-demo-accounting' || d.organizationId === 'global';
      return d.organizationId === actor.organizationId || d.organizationId === 'global';
    });

    const pendingAck = docs.filter(
      (d) => d.requiresAcknowledgement && !d.acknowledgedByIds.includes(actor.id),
    ).length;

    return {
      folders: gedFolders,
      documents: docs,
      canManageGed: canManage,
      stats: {
        totalDocs: docs.length,
        pendingAcknowledgements: pendingAck,
        signedDocs: docs.filter((d) => Boolean(d.signedAt)).length,
        totalSizeMb: Number((docs.reduce((s, d) => s + d.sizeKb, 0) / 1024).toFixed(2)),
      },
    };
  }

  app.get('/api/ged/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildGedOverview(actor));
  });

  app.post('/api/ged/documents', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      title?: string;
      folderId?: string;
      category?: GedDocumentRecord['category'];
      classification?: DocumentClassification;
      tags?: string[];
      requiresAcknowledgement?: boolean;
      sizeKb?: number;
      fileName?: string;
      mimeType?: string;
      fileDataUrl?: string;
    };
    const effectiveTitle = body.title?.trim() || body.fileName?.trim() || '';
    if (!effectiveTitle) return res.status(400).json({ error: 'Nom du document ou fichier requis.' });

    let resolvedMime = body.mimeType || 'application/pdf';
    let resolvedSizeKb = Number(body.sizeKb) || 480;
    let resolvedExt = getExtensionFromName(body.fileName || effectiveTitle).toUpperCase() || 'PDF';
    let parsedBinary: StoredGedBinary | null = null;

    if (body.fileDataUrl && body.fileName) {
      const parsed = parseGedDataUrl(body.fileDataUrl, body.fileName, body.mimeType);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      resolvedMime = parsed.mimeType;
      resolvedSizeKb = parsed.sizeKb;
      resolvedExt = parsed.ext;
      parsedBinary = {
        fileName: body.fileName.trim(),
        mimeType: parsed.mimeType,
        buffer: parsed.buffer,
      };
    }

    const now = new Date().toISOString();
    const docId = `doc-${Date.now()}`;
    if (parsedBinary) {
      gedVersionBinaries.set(`${docId}:v1`, parsedBinary);
    }

    const doc: GedDocumentRecord = {
      id: docId,
      reference: `GED-2026-${String(gedDocuments.length + 30).padStart(3, '0')}`,
      folderId: body.folderId || gedFolders[0].id,
      title: effectiveTitle,
      category: body.category || 'PROCEDURE',
      fileName: body.fileName?.trim() || effectiveTitle,
      fileExtension: resolvedExt,
      mimeType: resolvedMime,
      sizeKb: resolvedSizeKb,
      hasFileContent: Boolean(parsedBinary),
      organizationId: actor.organizationId,
      ownerUserId: actor.id,
      ownerName: actor.name,
      classification: body.classification || 'INTERNE',
      currentVersion: 1,
      versions: [
        {
          version: 1,
          uploadedBy: actor.name,
          uploadedAt: now,
          changeNote: parsedBinary
            ? `Fichier ${body.fileName} téléversé (${resolvedExt})`
            : 'Téléversement initial (index GED)',
          sizeKb: resolvedSizeKb,
          fileName: body.fileName?.trim() || effectiveTitle,
          mimeType: resolvedMime,
          hasFileContent: Boolean(parsedBinary),
        },
      ],
      tags: Array.isArray(body.tags) && body.tags.length > 0 ? body.tags : [resolvedExt, 'GED'],
      requiresAcknowledgement: Boolean(body.requiresAcknowledgement),
      acknowledgedByIds: [],
      shareLinks: [],
      retentionUntil: '2036-11-18',
      updatedAt: now,
    };
    gedDocuments.unshift(doc);
    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'GED_DOCUMENT_UPLOADED',
      target: doc.reference,
      details: `Dépôt GED ${doc.title} (${resolvedExt}, ${resolvedSizeKb} Ko)`,
      severity: 'INFO',
    });
    return res.status(201).json(buildGedOverview(actor));
  });

  app.post('/api/ged/documents/:id/version', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    const body = req.body as {
      changeNote?: string;
      fileName?: string;
      mimeType?: string;
      fileDataUrl?: string;
    };
    const nextVer = doc.currentVersion + 1;
    const now = new Date().toISOString();
    let nextSizeKb = doc.sizeKb + 45;
    let nextMime = doc.mimeType;
    let nextFileName = doc.fileName || doc.title;
    let hasBinary = false;

    if (body.fileDataUrl && body.fileName) {
      const parsed = parseGedDataUrl(body.fileDataUrl, body.fileName, body.mimeType);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      nextSizeKb = parsed.sizeKb;
      nextMime = parsed.mimeType;
      nextFileName = body.fileName.trim();
      doc.fileName = nextFileName;
      doc.fileExtension = parsed.ext;
      doc.mimeType = nextMime;
      doc.hasFileContent = true;
      hasBinary = true;
      gedVersionBinaries.set(`${doc.id}:v${nextVer}`, {
        fileName: nextFileName,
        mimeType: nextMime,
        buffer: parsed.buffer,
      });
    }

    doc.currentVersion = nextVer;
    doc.sizeKb = nextSizeKb;
    doc.versions.unshift({
      version: nextVer,
      uploadedBy: actor.name,
      uploadedAt: now,
      changeNote: body.changeNote?.trim() || (hasBinary ? `Nouveau fichier ${nextFileName}` : `Révision v${nextVer}`),
      sizeKb: nextSizeKb,
      fileName: nextFileName,
      mimeType: nextMime,
      hasFileContent: hasBinary,
    });
    doc.updatedAt = now;
    return res.json(buildGedOverview(actor));
  });

  app.get('/api/ged/documents/:id/download', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const requestedVersion = Number(req.query.version || doc.currentVersion);
    const isInline = req.query.inline === '1';
    const stored =
      gedVersionBinaries.get(`${doc.id}:v${requestedVersion}`) ||
      gedVersionBinaries.get(`${doc.id}:v${doc.currentVersion}`);

    if (stored) {
      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader(
        'Content-Disposition',
        `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(stored.fileName)}"`,
      );
      return res.send(stored.buffer);
    }

    // Clean summary export for pre-seeded metadata documents without uploaded binary yet
    const safeName = `${doc.reference}-v${requestedVersion}.txt`;
    const summaryText = [
      `Référence : ${doc.reference}`,
      `Titre : ${doc.title}`,
      `Version : v${requestedVersion}`,
      `Classification : ${doc.classification}`,
      `Propriétaire : ${doc.ownerName}`,
      `Rétention : ${doc.retentionUntil}`,
      `Tags : ${doc.tags.join(', ')}`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `${isInline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(safeName)}"`,
    );
    return res.send(Buffer.from(summaryText, 'utf-8'));
  });

  app.post('/api/ged/documents/:id/sign', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    doc.signedByName = actor.name;
    doc.signedAt = new Date().toISOString();
    doc.updatedAt = doc.signedAt;
    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'GED_DOCUMENT_SIGNED',
      target: doc.reference,
      details: `Signature horodatée apposée sur ${doc.title}`,
      severity: 'INFO',
    });
    return res.json(buildGedOverview(actor));
  });

  app.post('/api/ged/documents/:id/acknowledge', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    if (!doc.acknowledgedByIds.includes(actor.id)) {
      doc.acknowledgedByIds.push(actor.id);
    }
    return res.json(buildGedOverview(actor));
  });

  app.post('/api/ged/documents/:id/checkout', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    doc.checkedOutBy = doc.checkedOutBy ? undefined : actor.name;
    return res.json(buildGedOverview(actor));
  });

  app.post('/api/ged/documents/:id/share', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = gedDocuments.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    const exp = new Date(Date.now() + 7 * 86400 * 1000).toISOString().slice(0, 10);
    doc.shareLinks.unshift({
      id: `sh-${Date.now()}`,
      token: `tpd-${crypto.randomBytes(3).toString('hex')}`,
      expiresAt: exp,
      hasPassword: true,
      accessCount: 0,
    });
    return res.json(buildGedOverview(actor));
  });

  // =========================================================================
  // 4. NOTES DE SERVICE, SONDAGES & ANNUAIRE (EF-050 à EF-061, EF-026)
  // =========================================================================
  function buildCommsOverview(actor: ActiveActorContext): CommsOverviewPayload {
    const canPublish = canManageHr(actor);
    const directory = buildDirectoryMembers(actor);
    const memos = officialMemos.filter(
      (m) => actor.space === 'superadmin' || m.organizationId === 'global' || m.organizationId === actor.organizationId,
    );
    const unreadRequired = memos.filter(
      (m) => m.status === 'PUBLIEE' && m.requiresAck && !m.readByUserIds.includes(actor.id),
    ).length;

    return {
      memos,
      polls: internalPolls,
      directory,
      canPublishMemo: canPublish,
      stats: {
        publishedMemos: memos.filter((m) => m.status === 'PUBLIEE').length,
        unreadRequiredMemos: unreadRequired,
        openPolls: internalPolls.filter((p) => p.status === 'OUVERT').length,
        directoryCount: directory.length,
      },
    };
  }

  app.get('/api/comms/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildCommsOverview(actor));
  });

  app.post('/api/comms/memos', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canManageHr(actor)) return res.status(403).json({ error: 'Publication réservée à la direction / management.' });
    const body = req.body as {
      title?: string;
      summary?: string;
      body?: string;
      importance?: OfficialMemoImportance;
      requiresAck?: boolean;
      pinned?: boolean;
      audienceLabel?: string;
    };
    if (!body.title?.trim() || !body.body?.trim()) {
      return res.status(400).json({ error: 'Titre et contenu requis.' });
    }
    const memo: OfficialMemoRecord = {
      id: `mem-${Date.now()}`,
      reference: `NS-2026-${String(officialMemos.length + 20).padStart(3, '0')}`,
      title: body.title.trim(),
      summary: body.summary?.trim() || body.body.trim().slice(0, 120),
      body: body.body.trim(),
      importance: body.importance || 'INFORMATION',
      status: 'PUBLIEE',
      pinned: Boolean(body.pinned),
      requiresAck: Boolean(body.requiresAck),
      audienceLabel: body.audienceLabel?.trim() || 'Toute l’organisation',
      organizationId: 'global',
      authorId: actor.id,
      authorName: actor.name,
      authorRole: actor.role,
      publishedAt: new Date().toISOString(),
      readByUserIds: [actor.id],
      targetAudienceCount: 6,
    };
    officialMemos.unshift(memo);

    if (memo.importance === 'URGENT' || memo.requiresAck) {
      pushNotification({
        userId: 'int-u-3',
        organizationId: actor.organizationId,
        title: `Note officielle ${memo.reference} : ${memo.title}`,
        message: memo.requiresAck ? 'Accusé de lecture obligatoire requis.' : memo.summary,
        category: 'NOTE_SERVICE',
        priority: memo.importance === 'URGENT' ? 'URGENTE' : 'HAUTE',
        targetSection: 'comms',
      });
    }

    return res.status(201).json(buildCommsOverview(actor));
  });

  app.post('/api/comms/memos/:id/read', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const memo = officialMemos.find((m) => m.id === req.params.id);
    if (!memo) return res.status(404).json({ error: 'Note introuvable.' });
    if (!memo.readByUserIds.includes(actor.id)) {
      memo.readByUserIds.push(actor.id);
    }
    return res.json(buildCommsOverview(actor));
  });

  app.post('/api/comms/memos/:id/remind', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const memo = officialMemos.find((m) => m.id === req.params.id);
    if (!memo) return res.status(404).json({ error: 'Note introuvable.' });
    memo.lastReminderAt = new Date().toISOString();
    return res.json(buildCommsOverview(actor));
  });

  app.post('/api/comms/polls', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as { question?: string; description?: string; options?: string[]; anonymous?: boolean };
    if (!body.question?.trim() || !Array.isArray(body.options) || body.options.length < 2) {
      return res.status(400).json({ error: 'Question et au moins 2 choix requis.' });
    }
    internalPolls.unshift({
      id: `pol-${Date.now()}`,
      question: body.question.trim(),
      description: body.description?.trim() || 'Consultation interne',
      anonymous: body.anonymous ?? true,
      organizationId: 'global',
      createdByName: actor.name,
      closesAt: '2026-12-15',
      options: body.options.filter(Boolean).map((lbl, i) => ({ id: `opt-${Date.now()}-${i}`, label: lbl.trim(), votes: 0 })),
      votedUserIds: [],
      status: 'OUVERT',
    });
    return res.status(201).json(buildCommsOverview(actor));
  });

  app.post('/api/comms/polls/:id/vote', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const poll = internalPolls.find((p) => p.id === req.params.id);
    if (!poll) return res.status(404).json({ error: 'Sondage introuvable.' });
    if (poll.votedUserIds.includes(actor.id)) {
      return res.status(400).json({ error: 'Vous avez déjà participé à ce sondage.' });
    }
    const body = req.body as { optionId?: string };
    const option = poll.options.find((o) => o.id === body.optionId);
    if (!option) return res.status(400).json({ error: 'Option invalide.' });
    option.votes += 1;
    poll.votedUserIds.push(actor.id);
    return res.json(buildCommsOverview(actor));
  });

  // =========================================================================
  // 5. MODULE NOTIFICATIONS INTELLIGENTES & PRÉFÉRENCES (EF-130 à EF-137)
  // =========================================================================
  function getPrefsForUser(userId: string): NotificationPreferences {
    const existing = notificationPrefsByUser.get(userId);
    if (existing) return existing;
    const created: NotificationPreferences = {
      userId,
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      pushWebEnabled: true,
      dailyDigest: true,
      quietHoursEnabled: true,
      quietStart: '20:00',
      quietEnd: '07:30',
    };
    notificationPrefsByUser.set(userId, created);
    return created;
  }

  function buildNotificationsOverview(actor: ActiveActorContext): NotificationsOverviewPayload {
    const mine = notificationsList.filter(
      (n) => actor.space === 'superadmin' || n.userId === actor.id,
    );
    return {
      notifications: mine,
      unreadCount: mine.filter((n) => !n.read).length,
      preferences: getPrefsForUser(actor.id),
      deliveryStats: {
        sent24h: 142,
        deliveryRatePct: 99.4,
        smsQuotaUsed: 38,
        smsQuotaLimit: 500,
      },
    };
  }

  app.get('/api/notifications/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildNotificationsOverview(actor));
  });

  app.patch('/api/notifications/:id/read', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const ntf = notificationsList.find((n) => n.id === req.params.id);
    if (ntf && (ntf.userId === actor.id || actor.space === 'superadmin')) {
      ntf.read = true;
    }
    return res.json(buildNotificationsOverview(actor));
  });

  app.post('/api/notifications/read-all', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    for (const n of notificationsList) {
      if (actor.space === 'superadmin' || n.userId === actor.id) {
        n.read = true;
      }
    }
    return res.json(buildNotificationsOverview(actor));
  });

  app.put('/api/notifications/preferences', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as Partial<NotificationPreferences>;
    const current = getPrefsForUser(actor.id);
    Object.assign(current, {
      inAppEnabled: body.inAppEnabled ?? current.inAppEnabled,
      emailEnabled: body.emailEnabled ?? current.emailEnabled,
      smsEnabled: body.smsEnabled ?? current.smsEnabled,
      pushWebEnabled: body.pushWebEnabled ?? current.pushWebEnabled,
      dailyDigest: body.dailyDigest ?? current.dailyDigest,
      quietHoursEnabled: body.quietHoursEnabled ?? current.quietHoursEnabled,
      quietStart: body.quietStart ?? current.quietStart,
      quietEnd: body.quietEnd ?? current.quietEnd,
    });
    return res.json(buildNotificationsOverview(actor));
  });

  // =========================================================================
  // 6. ADMINISTRATION ORGANISATION, MARQUE BLANCHE & API (EF-170 à EF-177)
  // =========================================================================
  function canEditOrgAdmin(actor: ActiveActorContext): boolean {
    return (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role))
    );
  }

  function buildOrgAdminOverview(actor: ActiveActorContext): OrgAdminOverviewPayload {
    return {
      theme: getOrInitTheme(actor.organizationId, actor.organizationName),
      units: orgUnits,
      sites: orgSites,
      tokens: orgTokens,
      webhooks: orgWebhooks,
      backups: orgBackups,
      canEditAdmin: canEditOrgAdmin(actor),
    };
  }

  app.get('/api/org-admin/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildOrgAdminOverview(actor));
  });

  app.put('/api/org-admin/theme', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const theme = getOrInitTheme(actor.organizationId, actor.organizationName);
    const body = req.body as Partial<OrgThemeConfig>;
    let nextLogoUrl = theme.logoUrl;
    if (body.logoUrl !== undefined) {
      const check = sanitizeMediaString(body.logoUrl);
      if (!check.valid) {
        return res.status(400).json({ error: 'Format de logo invalide.' });
      }
      nextLogoUrl = check.clear ? undefined : check.value;
      const tenant = tenantsList.find((t) => t.id === actor.organizationId);
      if (tenant) tenant.logoUrl = nextLogoUrl;
    }
    Object.assign(theme, {
      displayName: body.displayName?.trim() || theme.displayName,
      logoUrl: nextLogoUrl,
      primaryColor: body.primaryColor || theme.primaryColor,
      accentColor: body.accentColor || theme.accentColor,
      memberLabel: body.memberLabel || theme.memberLabel,
      unitLabel: body.unitLabel || theme.unitLabel,
      locale: body.locale || theme.locale,
      timezone: body.timezone || theme.timezone,
      onboardingStep: body.onboardingStep ?? theme.onboardingStep,
      onboardingCompleted: body.onboardingCompleted ?? theme.onboardingCompleted,
    });
    return res.json(buildOrgAdminOverview(actor));
  });

  app.put('/api/org-admin/modules', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const theme = getOrInitTheme(actor.organizationId, actor.organizationName);
    const body = req.body as { enabledModules?: string[] };
    if (Array.isArray(body.enabledModules)) {
      theme.enabledModules = body.enabledModules;
    }
    return res.json(buildOrgAdminOverview(actor));
  });

  app.post('/api/org-admin/units', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const body = req.body as { name?: string; type?: OrgUnitNode['type']; leadName?: string; site?: string; headcount?: number };
    if (!body.name?.trim()) return res.status(400).json({ error: 'Nom de l’entité requis.' });
    orgUnits.push({
      id: `unit-${Date.now()}`,
      name: body.name.trim(),
      type: body.type || 'SERVICE',
      parentId: 'unit-1',
      leadName: body.leadName?.trim() || actor.name,
      site: body.site?.trim() || 'Dakar Plateau',
      headcount: Number(body.headcount) || 1,
    });
    return res.status(201).json(buildOrgAdminOverview(actor));
  });

  app.post('/api/org-admin/tokens', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const body = req.body as { label?: string; scopes?: string[] };
    if (!body.label?.trim()) return res.status(400).json({ error: 'Libellé du jeton requis.' });
    const rawHex = crypto.randomBytes(4).toString('hex');
    orgTokens.unshift({
      id: `tok-${Date.now()}`,
      label: body.label.trim(),
      prefix: `tpd_live_${rawHex}...`,
      scopes: Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : ['hr:read', 'workflows:read'],
      createdAt: new Date().toISOString(),
      revoked: false,
    });
    return res.status(201).json(buildOrgAdminOverview(actor));
  });

  app.patch('/api/org-admin/tokens/:id/revoke', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const tok = orgTokens.find((t) => t.id === req.params.id);
    if (tok) tok.revoked = true;
    return res.json(buildOrgAdminOverview(actor));
  });

  app.post('/api/org-admin/webhooks', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    const body = req.body as { url?: string; events?: string[] };
    if (!body.url?.trim()) return res.status(400).json({ error: 'URL webhook requise.' });
    orgWebhooks.unshift({
      id: `wh-${Date.now()}`,
      url: body.url.trim(),
      events: Array.isArray(body.events) && body.events.length > 0 ? body.events : ['leave.approved', 'request.completed'],
      hmacSecretMasked: `whsec_••••••••${crypto.randomBytes(2).toString('hex')}`,
      active: true,
      lastDeliveryStatus: 'OK',
    });
    return res.status(201).json(buildOrgAdminOverview(actor));
  });

  app.post('/api/org-admin/backups', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canEditOrgAdmin(actor)) {
      return res.status(403).json({ error: 'Droits Direction ou Superadmin requis.' });
    }
    orgBackups.unshift({
      id: `bkp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      sizeMb: 416,
      type: 'MANUELLE',
      status: 'VERIFIEE',
    });
    return res.status(201).json(buildOrgAdminOverview(actor));
  });

  // =========================================================================
  // 7. COURRIER INSTITUTIONNEL, VISITEURS & RESSOURCES (§4.15, EF-077)
  // =========================================================================
  function buildOperationsOverview(): OperationsOverviewPayload {
    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      mail: institutionalMail,
      visitors: visitorLogs,
      bookings: sharedBookings,
      resourcesCatalog,
      stats: {
        openMailCount: institutionalMail.filter((m) => m.status !== 'ARCHIVE' && m.status !== 'TRAITE').length,
        visitorsOnSite: visitorLogs.filter((v) => v.status === 'SUR_SITE').length,
        bookingsToday: sharedBookings.filter((b) => b.date === todayIso || b.date === '2026-11-18').length,
      },
    };
  }

  app.get('/api/operations/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildOperationsOverview());
  });

  app.post('/api/operations/mail', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      direction?: InstitutionalMailDirection;
      subject?: string;
      correspondent?: string;
      imputedToName?: string;
      department?: string;
      confidentiality?: DocumentClassification;
      dueDate?: string;
    };
    if (!body.subject?.trim() || !body.correspondent?.trim()) {
      return res.status(400).json({ error: 'Objet et correspondant requis.' });
    }
    const dir = body.direction || 'ARRIVEE';
    const prefix = dir === 'ARRIVEE' ? 'ARR' : 'DEP';
    institutionalMail.unshift({
      id: `mail-${Date.now()}`,
      reference: `${prefix}-2026-${String(institutionalMail.length + 215)}`,
      direction: dir,
      subject: body.subject.trim(),
      correspondent: body.correspondent.trim(),
      confidentiality: body.confidentiality || 'INTERNE',
      imputedToName: body.imputedToName?.trim() || actor.name,
      department: body.department?.trim() || 'Direction Générale',
      dueDate: body.dueDate || '2026-11-25',
      status: 'ENREGISTRE',
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json(buildOperationsOverview());
  });

  app.patch('/api/operations/mail/:id/status', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const mail = institutionalMail.find((m) => m.id === req.params.id);
    if (!mail) return res.status(404).json({ error: 'Courrier introuvable.' });
    const body = req.body as { status: InstitutionalMailRecord['status'] };
    mail.status = body.status;
    return res.json(buildOperationsOverview());
  });

  app.post('/api/operations/visitors', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      visitorName?: string;
      organization?: string;
      idDocumentNumber?: string;
      hostName?: string;
      site?: string;
      purpose?: string;
    };
    if (!body.visitorName?.trim()) return res.status(400).json({ error: 'Nom du visiteur requis.' });
    visitorLogs.unshift({
      id: `vis-${Date.now()}`,
      visitorName: body.visitorName.trim(),
      organization: body.organization?.trim() || 'Visiteur externe',
      idDocumentNumber: body.idDocumentNumber?.trim() || 'CNI vérifiée',
      hostName: body.hostName?.trim() || actor.name,
      site: body.site || 'Dakar Plateau',
      purpose: body.purpose?.trim() || 'Rendez-vous professionnel',
      badgeCode: `VIS-${String(visitorLogs.length + 43).padStart(3, '0')}`,
      checkInAt: new Date().toISOString(),
      status: 'SUR_SITE',
    });
    return res.status(201).json(buildOperationsOverview());
  });

  app.patch('/api/operations/visitors/:id/checkout', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const vis = visitorLogs.find((v) => v.id === req.params.id);
    if (!vis) return res.status(404).json({ error: 'Visiteur introuvable.' });
    vis.status = 'SORTI';
    vis.checkOutAt = new Date().toISOString();
    return res.json(buildOperationsOverview());
  });

  app.post('/api/operations/bookings', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const body = req.body as {
      resourceName?: string;
      date?: string;
      startHour?: number;
      endHour?: number;
      purpose?: string;
    };
    if (!body.resourceName || !body.date || !body.purpose?.trim()) {
      return res.status(400).json({ error: 'Ressource, date et motif requis.' });
    }
    const startH = Number(body.startHour) || 9;
    const endH = Number(body.endHour) || startH + 2;
    const conflict = sharedBookings.find(
      (b) =>
        b.resourceName === body.resourceName &&
        b.date === body.date &&
        !(endH <= b.startHour || startH >= b.endHour),
    );
    if (conflict) {
      return res.status(409).json({
        error: `Conflit de réservation avec ${conflict.bookedByName} (${conflict.startHour}h–${conflict.endHour}h).`,
      });
    }
    const catalogMatch = resourcesCatalog.find((r) => r.name === body.resourceName);
    sharedBookings.unshift({
      id: `res-${Date.now()}`,
      resourceName: body.resourceName,
      resourceType: catalogMatch?.type || 'SALLE',
      site: catalogMatch?.site || 'Dakar Plateau',
      date: body.date,
      startHour: startH,
      endHour: endH,
      bookedByUserId: actor.id,
      bookedByName: actor.name,
      purpose: body.purpose.trim(),
      status: 'CONFIRME',
    });
    return res.status(201).json(buildOperationsOverview());
  });

  // =========================================================================
  // 8. BACK-OFFICE SUPERADMIN : MULTI-TENANTS, FACTURATION FCFA & SUPPORT
  // =========================================================================
  function buildSuperadminTenantsPayload(): SuperadminTenantsPayload {
    const active = tenantsList.filter((t) => t.status === 'ACTIF').length;
    const trial = tenantsList.filter((t) => t.status === 'ESSAI_30J').length;
    const mrr = tenantsList
      .filter((t) => t.status !== 'SUSPENDU_IMPAYE')
      .reduce((s, t) => s + t.monthlyFeeFcfa, 0);
    return {
      tenants: tenantsList,
      invoices: tenantInvoices,
      tickets: supportTickets,
      servicesHealth,
      kpis: {
        totalTenants: tenantsList.length,
        activeTenants: active,
        trialTenants: trial,
        mrrFcfa: mrr,
        arrFcfa: mrr * 12,
        churnPct: 2.1,
        openTickets: supportTickets.filter((t) => t.status !== 'RESOLU').length,
      },
    };
  }

  app.get('/api/superadmin/tenants/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'superadmin') {
      return res.status(403).json({ error: 'Accès réservé au Superadmin Teranga.' });
    }
    return res.json(buildSuperadminTenantsPayload());
  });

  app.post('/api/superadmin/tenants', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'superadmin') {
      return res.status(403).json({ error: 'Accès réservé au Superadmin Teranga.' });
    }
    const body = req.body as {
      name?: string;
      subdomain?: string;
      plan?: TenantPlanTier;
      adminEmail?: string;
      userQuota?: number;
      monthlyFeeFcfa?: number;
      logoUrl?: string;
    };
    if (!body.name?.trim() || !body.subdomain?.trim() || !body.adminEmail?.trim()) {
      return res.status(400).json({ error: 'Nom, sous-domaine et e-mail administrateur requis.' });
    }
    const logoCheck = body.logoUrl !== undefined ? sanitizeMediaString(body.logoUrl) : { valid: true, value: undefined };
    if (!logoCheck.valid) {
      return res.status(400).json({ error: 'Format de logo invalide.' });
    }
    const plan = body.plan || 'STANDARD';
    const tenant: TenantRecord = {
      id: `ten-${Date.now()}`,
      name: body.name.trim(),
      logoUrl: logoCheck.value,
      subdomain: `${body.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}.terangaprestige.digital`,
      plan,
      status: 'ESSAI_30J',
      adminEmail: body.adminEmail.trim(),
      userCount: 1,
      userQuota: Number(body.userQuota) || (plan === 'SOUVERAIN' ? 500 : plan === 'PREMIUM' ? 150 : 50),
      storageUsedGb: 0.2,
      storageQuotaGb: plan === 'SOUVERAIN' ? 1000 : plan === 'PREMIUM' ? 200 : 25,
      monthlyFeeFcfa: Number(body.monthlyFeeFcfa) || (plan === 'SOUVERAIN' ? 1250000 : plan === 'PREMIUM' ? 350000 : 120000),
      enabledModules: ['hr', 'workflows', 'ged', 'comms', 'planning'],
      featureFlags: plan === 'SOUVERAIN' ? ['sovereign_dedicated'] : ['v1_core'],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    tenantsList.unshift(tenant);

    tenantInvoices.unshift({
      id: `tinv-${Date.now()}`,
      invoiceNumber: `FAC-SAAS-2026-${String(tenantInvoices.length + 1101)}`,
      tenantId: tenant.id,
      tenantName: tenant.name,
      periodLabel: 'Activation Essai / Premier mois',
      amountFcfa: tenant.monthlyFeeFcfa,
      paymentMethod: 'WAVE',
      status: 'EN_ATTENTE',
      issuedAt: new Date().toISOString().slice(0, 10),
    });

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'TENANT_CREATED',
      target: tenant.name,
      details: `Plan ${plan} · ${tenant.subdomain}`,
      severity: 'INFO',
    });

    return res.status(201).json(buildSuperadminTenantsPayload());
  });

  app.patch('/api/superadmin/tenants/:id', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'superadmin') {
      return res.status(403).json({ error: 'Accès réservé au Superadmin Teranga.' });
    }
    const tenant = tenantsList.find((t) => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Organisation introuvable.' });
    const body = req.body as {
      status?: TenantStatus;
      plan?: TenantPlanTier;
      toggleFlag?: string;
      logoUrl?: string | null;
    };
    if (body.status) tenant.status = body.status;
    if (body.plan) tenant.plan = body.plan;
    if (body.logoUrl !== undefined) {
      const check = sanitizeMediaString(body.logoUrl);
      if (!check.valid) {
        return res.status(400).json({ error: 'Format de logo invalide.' });
      }
      tenant.logoUrl = check.clear ? undefined : check.value;
      const existingTheme = orgThemes.get(tenant.id);
      if (existingTheme) {
        existingTheme.logoUrl = tenant.logoUrl;
      }
    }
    if (body.toggleFlag) {
      if (tenant.featureFlags.includes(body.toggleFlag)) {
        tenant.featureFlags = tenant.featureFlags.filter((f) => f !== body.toggleFlag);
      } else {
        tenant.featureFlags.push(body.toggleFlag);
      }
    }
    return res.json(buildSuperadminTenantsPayload());
  });

  app.post('/api/superadmin/invoices/:id/pay', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'superadmin') {
      return res.status(403).json({ error: 'Accès réservé au Superadmin Teranga.' });
    }
    const inv = tenantInvoices.find((i) => i.id === req.params.id);
    if (!inv) return res.status(404).json({ error: 'Facture introuvable.' });
    const body = req.body as { paymentMethod?: TenantInvoiceRecord['paymentMethod'] };
    if (body.paymentMethod) inv.paymentMethod = body.paymentMethod;
    inv.status = 'PAYEE';
    inv.paidAt = new Date().toISOString().slice(0, 10);
    const tenant = tenantsList.find((t) => t.id === inv.tenantId);
    if (tenant && tenant.status === 'ESSAI_30J') {
      tenant.status = 'ACTIF';
    }
    return res.json(buildSuperadminTenantsPayload());
  });

  app.patch('/api/superadmin/tickets/:id/status', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'superadmin') {
      return res.status(403).json({ error: 'Accès réservé au Superadmin Teranga.' });
    }
    const tkt = supportTickets.find((t) => t.id === req.params.id);
    if (!tkt) return res.status(404).json({ error: 'Ticket introuvable.' });
    const body = req.body as { status: SupportTicketRecord['status'] };
    tkt.status = body.status;
    return res.json(buildSuperadminTenantsPayload());
  });

  // =========================================================================
  // 9. CHAÎNE DES ORDRES DE MISSION & FRAIS DE DÉPLACEMENT (SECTEUR PUBLIC SN)
  // =========================================================================
  function computeMissionDays(departureDate: string, returnDate: string): number {
    const start = new Date(`${departureDate}T00:00:00`);
    const end = new Date(`${returnDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }

  function resolveAgentCategory(actor: ActiveActorContext, requested?: MissionAgentCategory): MissionAgentCategory {
    if (requested) return requested;
    if (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'DIRECTION')) ||
      actor.space === 'accounting'
    ) {
      return 'CAT_A_HAUTE_DIRECTION';
    }
    if (actor.space === 'intranet' && actor.role === 'MANAGER') return 'CAT_B_CADRE';
    return 'CAT_C_EXECUTION';
  }

  function getBlockingMissionForUser(userId: string): MissionOrderRecord | undefined {
    const todayIso = new Date().toISOString().slice(0, 10);
    return missionOrders.find(
      (m) =>
        m.agentUserId === userId &&
        m.advancePaidFcfa > 0 &&
        (m.status === 'APPROUVE_SG' || m.status === 'EN_MISSION') &&
        m.returnDate < todayIso,
    );
  }

  function canMissionN1(actor: ActiveActorContext): boolean {
    return (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION', 'MANAGER'].includes(actor.role))
    );
  }

  function canMissionDage(actor: ActiveActorContext): boolean {
    return (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role)) ||
      (actor.space === 'accounting' && ['OWNER', 'ACCOUNTANT'].includes(actor.role))
    );
  }

  function canMissionSg(actor: ActiveActorContext): boolean {
    return (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role))
    );
  }

  function resolveDestinationCity(cityId?: string, destination?: string): MissionDestinationCity | undefined {
    if (cityId) {
      const byId = missionDestinationCities.find((c) => c.id === cityId);
      if (byId) return byId;
    }
    if (destination?.trim()) {
      const needle = destination.trim().toLowerCase();
      return missionDestinationCities.find(
        (c) =>
          needle.includes(c.city.toLowerCase()) ||
          c.city.toLowerCase().includes(needle) ||
          needle.includes(c.city.split(' ')[0].toLowerCase()),
      );
    }
    return undefined;
  }

  function calculateMissionBreakdown(params: {
    cityId?: string;
    destination?: string;
    zone?: MissionZone;
    agentCategory: MissionAgentCategory;
    departureDate?: string;
    returnDate?: string;
    daysCountOverride?: number;
    transportMode: MissionTransportMode;
    lodgingCoveredByHost?: boolean;
    mealsCoveredByHost?: boolean;
    customLodgingFcfa?: number;
    customTransportFcfa?: number;
    advanceRequestedPct?: 0 | 50 | 80 | 100;
  }): MissionCalculationBreakdown {
    const matchedCity = resolveDestinationCity(params.cityId, params.destination);
    const zone: MissionZone = params.zone || matchedCity?.zone || 'SENEGAL_INTERIEUR';
    const tariff =
      missionTariffs.find((t) => t.zone === zone && t.category === params.agentCategory) ||
      missionTariffs[4];

    let daysCount = 0;
    if (params.daysCountOverride !== undefined && Number(params.daysCountOverride) > 0) {
      daysCount = Math.max(1, Math.min(90, Math.round(Number(params.daysCountOverride))));
    } else if (params.departureDate && params.returnDate) {
      daysCount = computeMissionDays(params.departureDate, params.returnDate);
    }
    if (daysCount <= 0) daysCount = 1;

    const nightsCount = Math.max(0, daysCount - 1);
    const mealsCoveredByHost = Boolean(params.mealsCoveredByHost);
    const lodgingCoveredByHost = Boolean(params.lodgingCoveredByHost);

    // Règle fonction publique SN : abattement de 50% sur l'indemnité de subsistance si restauration assurée par l'hôte
    const dailyPerDiemRateFcfa = tariff.dailyRateFcfa;
    const effectiveDailyPerDiemFcfa = mealsCoveredByHost
      ? Math.round(dailyPerDiemRateFcfa * 0.5)
      : dailyPerDiemRateFcfa;
    const perDiemTotalFcfa = effectiveDailyPerDiemFcfa * daysCount;

    const lodgingCeilingPerNightFcfa = tariff.lodgingCeilingFcfa;
    const lodgingTotalFcfa = lodgingCoveredByHost
      ? 0
      : params.customLodgingFcfa !== undefined
        ? Math.max(0, Math.round(params.customLodgingFcfa))
        : nightsCount * lodgingCeilingPerNightFcfa;

    const distanceOneWay = matchedCity ? matchedCity.distanceFromDakarKm : zone === 'DAKAR_PERIPHERIE' ? 35 : zone === 'SENEGAL_INTERIEUR' ? 240 : zone === 'UEMOA_AFRIQUE' ? 1800 : 4200;
    const distanceRoundTripKm = distanceOneWay * 2;
    const tollFcfa = matchedCity ? matchedCity.tollRoundTripFcfa : 0;

    let autoTransportBase = 0;
    if (params.transportMode === 'VEHICULE_ADMIN') {
      // Dotation gasoil fonction publique (~95 FCFA/km A/R, forfait mini 10 000 FCFA intra-Dakar)
      autoTransportBase = Math.max(10000, Math.round(distanceRoundTripKm * 95));
    } else if (params.transportMode === 'VEHICULE_PERSONNEL') {
      // Indemnité kilométrique barème administratif (~150 FCFA/km A/R)
      autoTransportBase = Math.max(12000, Math.round(distanceRoundTripKm * 150));
    } else if (params.transportMode === 'TRANSPORT_PUBLIC') {
      autoTransportBase =
        matchedCity?.publicTransitRoundTripFcfa ??
        Math.max(4000, Math.round(distanceRoundTripKm * 45));
    } else {
      // AVION
      autoTransportBase =
        matchedCity?.flightEstimateFcfa ??
        (zone === 'SENEGAL_INTERIEUR' ? 140000 : zone === 'UEMOA_AFRIQUE' ? 390000 : 750000);
    }

    const autoToll =
      params.transportMode === 'VEHICULE_ADMIN' || params.transportMode === 'VEHICULE_PERSONNEL'
        ? tollFcfa
        : 0;
    const transportAllowanceFcfa =
      params.customTransportFcfa !== undefined
        ? Math.max(0, Math.round(params.customTransportFcfa))
        : autoTransportBase;
    const totalTransportFcfa =
      params.customTransportFcfa !== undefined
        ? transportAllowanceFcfa
        : transportAllowanceFcfa + autoToll;

    const totalEstimatedFcfa = perDiemTotalFcfa + lodgingTotalFcfa + totalTransportFcfa;
    const advanceRequestedPct: 0 | 50 | 80 | 100 =
      params.advanceRequestedPct === 0 ||
      params.advanceRequestedPct === 50 ||
      params.advanceRequestedPct === 80 ||
      params.advanceRequestedPct === 100
        ? params.advanceRequestedPct
        : 80;
    const advanceAmountFcfa = Math.round((totalEstimatedFcfa * advanceRequestedPct) / 100);
    const balanceAfterMissionFcfa = totalEstimatedFcfa - advanceAmountFcfa;

    return {
      cityId: matchedCity?.id,
      cityName: matchedCity?.city || params.destination?.trim() || tariff.zoneLabel,
      regionOrCountry: matchedCity?.regionOrCountry || tariff.zoneLabel,
      zone,
      zoneLabel: tariff.zoneLabel,
      category: params.agentCategory,
      categoryLabel: tariff.categoryLabel,
      daysCount,
      nightsCount,
      distanceRoundTripKm,
      dailyPerDiemRateFcfa,
      effectiveDailyPerDiemFcfa,
      perDiemTotalFcfa,
      lodgingCeilingPerNightFcfa,
      lodgingTotalFcfa,
      transportAllowanceFcfa,
      tollFcfa: params.customTransportFcfa !== undefined ? 0 : autoToll,
      totalTransportFcfa,
      totalEstimatedFcfa,
      advanceRequestedPct,
      advanceAmountFcfa,
      balanceAfterMissionFcfa,
      lodgingCoveredByHost,
      mealsCoveredByHost,
      legalReference:
        'Décret n° 2012-1284 / Barème indemnités de mission Fonction Publique (Sénégal & UEMOA)',
    };
  }

  function buildMissionsOverview(actor: ActiveActorContext): MissionOverviewPayload {
    const isFullScope =
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role)) ||
      (actor.space === 'accounting' && ['OWNER', 'ACCOUNTANT'].includes(actor.role));

    const isTeamManager = actor.space === 'intranet' && actor.role === 'MANAGER';

    const visibleMissions = missionOrders.filter((m) => {
      if (isFullScope) return true;
      if (isTeamManager) return m.organizationId === actor.organizationId || m.agentUserId === actor.id;
      return m.agentUserId === actor.id;
    });

    const blocking = getBlockingMissionForUser(actor.id);
    const vehiclesCatalog = resourcesCatalog
      .filter((r) => r.type === 'VEHICULE')
      .map((r) => ({ name: r.name, site: r.site, capacity: r.capacity }));

    return {
      missions: visibleMissions,
      tariffs: missionTariffs,
      destinationCities: missionDestinationCities,
      vehiclesCatalog,
      canValidateN1: canMissionN1(actor),
      canValidateDage: canMissionDage(actor),
      canApproveSg: canMissionSg(actor),
      hasPendingReportBlock: Boolean(blocking),
      blockingMissionRef: blocking?.reference,
      stats: {
        total: visibleMissions.length,
        inApproval: visibleMissions.filter((m) => ['SOUMIS_N1', 'VISA_DAGE'].includes(m.status)).length,
        activeMissions: visibleMissions.filter((m) => ['APPROUVE_SG', 'EN_MISSION'].includes(m.status)).length,
        awaitingReport: visibleMissions.filter((m) => ['APPROUVE_SG', 'EN_MISSION', 'RAPPORT_DEPOSE'].includes(m.status)).length,
        totalCommittedFcfa: visibleMissions
          .filter((m) => m.status !== 'REJETE')
          .reduce((s, m) => s + m.totalEstimatedFcfa, 0),
        totalAdvancePaidFcfa: visibleMissions
          .filter((m) => m.status !== 'REJETE')
          .reduce((s, m) => s + m.advancePaidFcfa, 0),
      },
    };
  }

  app.get('/api/missions/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildMissionsOverview(actor));
  });

  app.post('/api/missions/calculate', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      cityId?: string;
      destination?: string;
      zone?: MissionZone;
      agentCategory?: MissionAgentCategory;
      departureDate?: string;
      returnDate?: string;
      daysCount?: number;
      transportMode?: MissionTransportMode;
      lodgingCoveredByHost?: boolean;
      mealsCoveredByHost?: boolean;
      customLodgingFcfa?: number;
      customTransportFcfa?: number;
      advanceRequestedPct?: 0 | 50 | 80 | 100;
    };

    const agentCategory = resolveAgentCategory(actor, body.agentCategory);
    const breakdown = calculateMissionBreakdown({
      cityId: body.cityId,
      destination: body.destination,
      zone: body.zone,
      agentCategory,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      daysCountOverride: body.daysCount,
      transportMode: body.transportMode || 'VEHICULE_ADMIN',
      lodgingCoveredByHost: body.lodgingCoveredByHost,
      mealsCoveredByHost: body.mealsCoveredByHost,
      customLodgingFcfa: body.customLodgingFcfa,
      customTransportFcfa: body.customTransportFcfa,
      advanceRequestedPct: body.advanceRequestedPct,
    });

    return res.json(breakdown);
  });

  app.post('/api/missions', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      title?: string;
      cityId?: string;
      destination?: string;
      zone?: MissionZone;
      departureDate?: string;
      returnDate?: string;
      agentCategory?: MissionAgentCategory;
      transportMode?: MissionTransportMode;
      vehicleName?: string;
      lodgingCoveredByHost?: boolean;
      mealsCoveredByHost?: boolean;
      lodgingEstimateFcfa?: number;
      transportEstimateFcfa?: number;
      advanceRequestedPct?: 0 | 50 | 80 | 100;
      submitNow?: boolean;
    };

    if (!body.title?.trim() || (!body.destination?.trim() && !body.cityId) || !body.departureDate || !body.returnDate) {
      return res.status(400).json({ error: 'Objet, destination et dates de mission requis.' });
    }

    const daysCount = computeMissionDays(body.departureDate, body.returnDate);
    if (daysCount <= 0) {
      return res.status(400).json({ error: 'La date de retour doit être postérieure ou égale au départ.' });
    }

    const advancePct: 0 | 50 | 80 | 100 =
      body.advanceRequestedPct === 0 ||
      body.advanceRequestedPct === 50 ||
      body.advanceRequestedPct === 80 ||
      body.advanceRequestedPct === 100
        ? body.advanceRequestedPct
        : 80;

    // Enforce mandatory report closure before requesting a new advance
    const blocking = getBlockingMissionForUser(actor.id);
    if (blocking && advancePct > 0) {
      return res.status(409).json({
        error: `Avance bloquée : vous devez d’abord déposer le rapport de mission et les justificatifs pour ${blocking.reference} (${blocking.destination}).`,
      });
    }

    const agentCategory = resolveAgentCategory(actor, body.agentCategory);
    const transportMode: MissionTransportMode = body.transportMode || 'VEHICULE_ADMIN';
    const breakdown = calculateMissionBreakdown({
      cityId: body.cityId,
      destination: body.destination,
      zone: body.zone,
      agentCategory,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      transportMode,
      lodgingCoveredByHost: body.lodgingCoveredByHost,
      mealsCoveredByHost: body.mealsCoveredByHost,
      customLodgingFcfa: body.lodgingEstimateFcfa,
      customTransportFcfa: body.transportEstimateFcfa,
      advanceRequestedPct: advancePct,
    });

    const zone = breakdown.zone;
    const perDiemDailyFcfa = breakdown.effectiveDailyPerDiemFcfa;
    const perDiemTotalFcfa = breakdown.perDiemTotalFcfa;
    const nights = breakdown.nightsCount;
    const lodgingEstimateFcfa = breakdown.lodgingTotalFcfa;
    const transportEstimateFcfa = breakdown.totalTransportFcfa;
    const totalEstimatedFcfa = breakdown.totalEstimatedFcfa;
    const resolvedDestination = body.destination?.trim() || breakdown.cityName;

    let bookingId: string | undefined;
    let chosenVehicle: string | undefined;

    if (transportMode === 'VEHICULE_ADMIN' && body.vehicleName?.trim()) {
      chosenVehicle = body.vehicleName.trim();
      const conflict = sharedBookings.find(
        (b) =>
          b.resourceName === chosenVehicle &&
          b.date >= body.departureDate! &&
          b.date <= body.returnDate!,
      );
      if (conflict) {
        return res.status(409).json({
          error: `Véhicule indisponible : ${chosenVehicle} est déjà réservé le ${conflict.date} par ${conflict.bookedByName}.`,
        });
      }
      bookingId = `res-${Date.now()}`;
      sharedBookings.unshift({
        id: bookingId,
        resourceName: chosenVehicle,
        resourceType: 'VEHICULE',
        site: 'Mission Extérieure',
        date: body.departureDate,
        startHour: 8,
        endHour: 18,
        bookedByUserId: actor.id,
        bookedByName: actor.name,
        purpose: `Ordre de mission : ${body.title.trim()} (${resolvedDestination})`,
        status: body.submitNow === false ? 'EN_ATTENTE' : 'CONFIRME',
      });
    }

    const hrProf = hrProfiles.find((p) => p.userId === actor.id);
    const refNumber = `OM-2026-${String(missionOrders.length + 82).padStart(3, '0')}`;
    const submitNow = body.submitNow !== false;

    const expenseLines: MissionExpenseLine[] = [
      {
        id: `ml-${Date.now()}-1`,
        category: 'PER_DIEM',
        label: `Per diem officiel (${daysCount} j × ${perDiemDailyFcfa.toLocaleString('fr-FR')} FCFA${body.mealsCoveredByHost ? ' · abattement repas 50%' : ''})`,
        estimatedFcfa: perDiemTotalFcfa,
      },
      ...(lodgingEstimateFcfa > 0
        ? [
            {
              id: `ml-${Date.now()}-2`,
              category: 'HEBERGEMENT' as const,
              label: `Hébergement (${nights} nuitée${nights > 1 ? 's' : ''})`,
              estimatedFcfa: lodgingEstimateFcfa,
            },
          ]
        : []),
      ...(transportEstimateFcfa > 0
        ? [
            {
              id: `ml-${Date.now()}-3`,
              category:
                transportMode === 'VEHICULE_ADMIN' || transportMode === 'VEHICULE_PERSONNEL'
                  ? ('CARBURANT_PEAGE' as const)
                  : ('BILLET_TRANSPORT' as const),
              label:
                transportMode === 'AVION'
                  ? 'Billet d’avion A/R'
                  : transportMode === 'VEHICULE_ADMIN'
                    ? `Dotation carburant & péage (${breakdown.distanceRoundTripKm} km A/R)`
                    : transportMode === 'VEHICULE_PERSONNEL'
                      ? `Indemnité kilométrique & péage (${breakdown.distanceRoundTripKm} km A/R)`
                      : 'Titre de transport public A/R',
              estimatedFcfa: transportEstimateFcfa,
            },
          ]
        : []),
    ];

    const newMission: MissionOrderRecord = {
      id: `om-${Date.now()}`,
      reference: refNumber,
      agentUserId: actor.id,
      agentName: actor.name,
      agentJobTitle: hrProf?.jobTitle || actor.role,
      agentCategory,
      department: hrProf?.department || actor.organizationName,
      organizationId: actor.organizationId,
      title: body.title.trim(),
      destination: resolvedDestination,
      zone,
      departureDate: body.departureDate,
      returnDate: body.returnDate,
      daysCount,
      transportMode,
      vehicleName: chosenVehicle,
      bookingId,
      perDiemDailyFcfa,
      perDiemTotalFcfa,
      lodgingEstimateFcfa,
      transportEstimateFcfa,
      totalEstimatedFcfa,
      advanceRequestedPct: advancePct,
      advancePaidFcfa: 0,
      expenseLines,
      status: submitNow ? 'SOUMIS_N1' : 'BROUILLON',
      currentApproverRole: submitNow ? 'Supérieur Hiérarchique (N+1)' : 'Brouillon agent',
      approvalTrail: [
        {
          id: `ma-${Date.now()}`,
          stepLabel: submitNow ? 'Création & Soumission' : 'Enregistrement brouillon',
          actorName: actor.name,
          action: submitNow ? 'SOUMIS' : 'CREATION',
          timestamp: new Date().toISOString(),
        },
      ],
      verificationQrCode: `QR-${refNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      createdAt: new Date().toISOString(),
    };

    missionOrders.unshift(newMission);

    if (submitNow) {
      pushNotification({
        userId: 'int-u-2',
        organizationId: actor.organizationId,
        title: `Nouvel ordre de mission ${newMission.reference}`,
        message: `${actor.name} soumet une mission vers ${newMission.destination} (${totalEstimatedFcfa.toLocaleString('fr-FR')} FCFA).`,
        category: 'WORKFLOW',
        priority: 'HAUTE',
        targetSection: 'missions',
      });
    }

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'MISSION_ORDER_CREATED',
      target: newMission.reference,
      details: `${newMission.destination} (${daysCount}j · ${totalEstimatedFcfa} FCFA)`,
      severity: 'INFO',
    });

    return res.status(201).json(buildMissionsOverview(actor));
  });

  app.patch('/api/missions/:id/workflow', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const mission = missionOrders.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: 'Ordre de mission introuvable.' });

    const body = req.body as {
      action: 'SUBMIT' | 'VISA_N1' | 'VISA_DAGE' | 'APPROVE_SG' | 'START_MISSION' | 'REJECT';
      note?: string;
    };

    const nowIso = new Date().toISOString();

    if (body.action === 'SUBMIT') {
      if (mission.agentUserId !== actor.id && !canMissionSg(actor)) {
        return res.status(403).json({ error: 'Action réservée au porteur de la mission.' });
      }
      mission.status = 'SOUMIS_N1';
      mission.currentApproverRole = 'Supérieur Hiérarchique (N+1)';
      mission.approvalTrail.push({
        id: `ma-${Date.now()}`,
        stepLabel: 'Soumission au visa N+1',
        actorName: actor.name,
        action: 'SOUMIS',
        note: body.note?.trim(),
        timestamp: nowIso,
      });
    } else if (body.action === 'VISA_N1') {
      if (!canMissionN1(actor)) {
        return res.status(403).json({ error: 'Visa réservé au supérieur hiérarchique (N+1) ou Direction.' });
      }
      if (mission.status !== 'SOUMIS_N1') {
        return res.status(400).json({ error: 'Cet ordre de mission n’est pas à l’étape N+1.' });
      }
      mission.status = 'VISA_DAGE';
      mission.currentApproverRole = 'DAGE / Contrôle Budgétaire';
      mission.approvalTrail.push({
        id: `ma-${Date.now()}`,
        stepLabel: 'Visa Hiérarchique N+1',
        actorName: actor.name,
        action: 'VISA_N1',
        note: body.note?.trim(),
        timestamp: nowIso,
      });
    } else if (body.action === 'VISA_DAGE') {
      if (!canMissionDage(actor)) {
        return res.status(403).json({ error: 'Visa budgétaire réservé à la DAGE / Comptabilité / Direction.' });
      }
      if (mission.status !== 'VISA_DAGE') {
        return res.status(400).json({ error: 'Cet ordre de mission doit d’abord recevoir le visa N+1.' });
      }
      if (mission.approvalTrail.some((a) => a.action === 'VISA_DAGE')) {
        return res.status(400).json({ error: 'Le visa DAGE a déjà été apposé sur cet ordre de mission.' });
      }
      mission.status = 'VISA_DAGE';
      mission.currentApproverRole = 'Secrétariat Général / Direction — Signature finale';
      mission.advancePaidFcfa = Math.round(
        (mission.totalEstimatedFcfa * mission.advanceRequestedPct) / 100,
      );
      mission.approvalTrail.push({
        id: `ma-${Date.now()}`,
        stepLabel: 'Visa DAGE & Mandatement avance',
        actorName: actor.name,
        action: 'VISA_DAGE',
        note:
          body.note?.trim() ||
          `Crédits vérifiés · Avance ${mission.advanceRequestedPct}% (${mission.advancePaidFcfa.toLocaleString('fr-FR')} FCFA) mandatée.`,
        timestamp: nowIso,
      });
    } else if (body.action === 'APPROVE_SG') {
      if (!canMissionSg(actor)) {
        return res.status(403).json({ error: 'Signature finale réservée au Secrétariat Général / Direction.' });
      }
      if (mission.status !== 'VISA_DAGE') {
        return res.status(400).json({ error: 'Validation hiérarchique préalable requise.' });
      }
      if (mission.advancePaidFcfa === 0 && mission.advanceRequestedPct > 0) {
        mission.advancePaidFcfa = Math.round(
          (mission.totalEstimatedFcfa * mission.advanceRequestedPct) / 100,
        );
      }
      mission.status = 'APPROUVE_SG';
      mission.currentApproverRole = 'Ordre de mission signé — Départ autorisé';
      mission.approvalTrail.push({
        id: `ma-${Date.now()}`,
        stepLabel: 'Signature Secrétariat Général',
        actorName: actor.name,
        action: 'SIGNATURE_SG',
        note: body.note?.trim() || 'Ordre de mission officiel signé et enregistré au planning RH.',
        timestamp: nowIso,
      });

      // Sync approved mission automatically into HR leaves / Shared Planning Calendar!
      const alreadySynced = leaveRequests.some((l) => l.id === `lvr-${mission.id}`);
      if (!alreadySynced) {
        leaveRequests.unshift({
          id: `lvr-${mission.id}`,
          reference: mission.reference,
          userId: mission.agentUserId,
          userName: mission.agentName,
          organizationId: mission.organizationId,
          department: mission.department,
          site: mission.destination,
          leaveType: 'MISSION',
          startDate: mission.departureDate,
          endDate: mission.returnDate,
          halfDay: 'FULL',
          workingDays: mission.daysCount,
          reason: `Ordre de mission ${mission.reference} : ${mission.title} (${mission.destination})`,
          status: 'APPROUVE',
          currentApproverName: actor.name,
          decidedByName: actor.name,
          decidedAt: nowIso,
          createdAt: mission.createdAt,
        });
      }

      if (mission.bookingId) {
        const booking = sharedBookings.find((b) => b.id === mission.bookingId);
        if (booking) booking.status = 'CONFIRME';
      }

      pushNotification({
        userId: mission.agentUserId,
        organizationId: mission.organizationId,
        title: `Ordre de mission ${mission.reference} signé`,
        message: `Votre ordre de mission vers ${mission.destination} est approuvé et publié dans le calendrier partagé.`,
        category: 'PLANNING',
        priority: 'HAUTE',
        targetSection: 'missions',
      });
    } else if (body.action === 'START_MISSION') {
      mission.status = 'EN_MISSION';
      mission.currentApproverRole = 'Agent actuellement en déplacement';
    } else if (body.action === 'REJECT') {
      if (!canMissionN1(actor) && !canMissionDage(actor)) {
        return res.status(403).json({ error: 'Droits de validation requis pour rejeter.' });
      }
      if (!body.note?.trim()) {
        return res.status(400).json({ error: 'Un motif de rejet est obligatoire.' });
      }
      mission.status = 'REJETE';
      mission.currentApproverRole = 'Rejeté';
      mission.approvalTrail.push({
        id: `ma-${Date.now()}`,
        stepLabel: 'Rejet du dossier',
        actorName: actor.name,
        action: 'REJET',
        note: body.note.trim(),
        timestamp: nowIso,
      });
    }

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: `MISSION_${body.action}`,
      target: mission.reference,
      details: `${mission.agentName} · ${mission.destination}`,
      severity: body.action === 'REJECT' ? 'WARNING' : 'INFO',
    });

    return res.json(buildMissionsOverview(actor));
  });

  app.post('/api/missions/:id/report', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const mission = missionOrders.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: 'Ordre de mission introuvable.' });

    if (mission.agentUserId !== actor.id && !canMissionSg(actor) && !canMissionDage(actor)) {
      return res.status(403).json({ error: 'Seul le porteur de mission ou la DAGE peut déposer le rapport.' });
    }

    const body = req.body as {
      missionReportSummary?: string;
      actualLines?: Array<{ id: string; actualFcfa: number; receiptRef?: string }>;
    };

    if (!body.missionReportSummary?.trim()) {
      return res.status(400).json({ error: 'Le résumé du rapport de mission est obligatoire.' });
    }

    if (Array.isArray(body.actualLines)) {
      for (const upd of body.actualLines) {
        const line = mission.expenseLines.find((l) => l.id === upd.id);
        if (line) {
          line.actualFcfa = Math.max(0, Number(upd.actualFcfa) || 0);
          line.receiptRef = upd.receiptRef?.trim() || undefined;
        }
      }
    }

    const actualSpentFcfa = mission.expenseLines.reduce(
      (s, l) => s + (l.actualFcfa !== undefined ? l.actualFcfa : l.estimatedFcfa),
      0,
    );
    const balanceToSettleFcfa = actualSpentFcfa - mission.advancePaidFcfa;

    mission.actualSpentFcfa = actualSpentFcfa;
    mission.balanceToSettleFcfa = balanceToSettleFcfa;
    mission.missionReportSummary = body.missionReportSummary.trim();
    mission.missionReportSubmittedAt = new Date().toISOString();
    mission.status = 'RAPPORT_DEPOSE';
    mission.currentApproverRole = 'DAGE — Liquidation & Clôture';
    mission.approvalTrail.push({
      id: `ma-${Date.now()}`,
      stepLabel: 'Dépôt Rapport & Justificatifs',
      actorName: actor.name,
      action: 'RAPPORT',
      note: `Dépenses réelles : ${actualSpentFcfa.toLocaleString('fr-FR')} FCFA (Solde : ${balanceToSettleFcfa >= 0 ? '+' : ''}${balanceToSettleFcfa.toLocaleString('fr-FR')} FCFA).`,
      timestamp: new Date().toISOString(),
    });

    pushNotification({
      userId: 'acc-u-1',
      organizationId: mission.organizationId,
      title: `Rapport déposé — ${mission.reference}`,
      message: `${mission.agentName} a transmis le compte rendu et les pièces comptables pour liquidation.`,
      category: 'WORKFLOW',
      priority: 'NORMALE',
      targetSection: 'missions',
    });

    return res.json(buildMissionsOverview(actor));
  });

  app.patch('/api/missions/:id/settle', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canMissionDage(actor)) {
      return res.status(403).json({ error: 'La liquidation finale est réservée à la DAGE / Direction.' });
    }
    const mission = missionOrders.find((m) => m.id === req.params.id);
    if (!mission) return res.status(404).json({ error: 'Ordre de mission introuvable.' });

    const body = req.body as { note?: string };
    mission.status = 'CLOTURE';
    mission.currentApproverRole = 'Dossier soldé & archivé';
    mission.approvalTrail.push({
      id: `ma-${Date.now()}`,
      stepLabel: 'Liquidation & Clôture financière',
      actorName: actor.name,
      action: 'CLOTURE',
      note: body.note?.trim() || 'Frais de mission liquidés et apurés en comptabilité.',
      timestamp: new Date().toISOString(),
    });

    return res.json(buildMissionsOverview(actor));
  });

  // =========================================================================
  // 10. OUTIL DE RAPPORT DE MISSION & RAPPORT DE TRAVAIL (DIRECTEUR, MANAGER, EMPLOYE)
  // =========================================================================

  function getReportActorRoleGroup(actor: ActiveActorContext): 'DIRECTION' | 'MANAGER' | 'EMPLOYEE' {
    if (
      actor.space === 'superadmin' ||
      (actor.space === 'intranet' && ['OWNER', 'DIRECTION'].includes(actor.role)) ||
      (actor.space === 'accounting' && ['OWNER', 'ACCOUNTANT'].includes(actor.role))
    ) {
      return 'DIRECTION';
    }
    if (actor.space === 'intranet' && actor.role === 'MANAGER') {
      return 'MANAGER';
    }
    return 'EMPLOYEE';
  }

  function computeReportMetrics(data: {
    title?: string;
    periodLabel?: string;
    executiveSummary?: string;
    contextAndObjectives?: string;
    activitiesAndDeliverables?: string;
    difficultiesAndRisks?: string;
    recommendationsAndNextSteps?: string;
    kpis?: WorkReportKpiItem[];
    actionPlan?: WorkReportActionItem[];
  }): { completenessPct: number; wordCount: number } {
    const checks = [
      Boolean(data.title?.trim()),
      Boolean(data.periodLabel?.trim()),
      Boolean(data.executiveSummary?.trim() && data.executiveSummary.trim().length >= 20),
      Boolean(data.contextAndObjectives?.trim() && data.contextAndObjectives.trim().length >= 20),
      Boolean(data.activitiesAndDeliverables?.trim() && data.activitiesAndDeliverables.trim().length >= 20),
      Boolean(data.difficultiesAndRisks?.trim()),
      Boolean(data.recommendationsAndNextSteps?.trim()),
      Boolean((data.kpis && data.kpis.length > 0) || (data.actionPlan && data.actionPlan.length > 0)),
    ];
    const completenessPct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
    const fullText = [
      data.title,
      data.executiveSummary,
      data.contextAndObjectives,
      data.activitiesAndDeliverables,
      data.difficultiesAndRisks,
      data.recommendationsAndNextSteps,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const wordCount = fullText ? fullText.split(/\s+/).filter(Boolean).length : 0;
    return { completenessPct, wordCount };
  }

  function sanitizeReportKpis(raw: unknown): WorkReportKpiItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx): WorkReportKpiItem => {
        const status: WorkReportKpiItem['status'] =
          item.status === 'ATTEINT' || item.status === 'EN_COURS' || item.status === 'ECART'
            ? item.status
            : 'EN_COURS';
        return {
          id: String(item.id || `kpi-${Date.now()}-${idx}`),
          label: String(item.label || '').trim(),
          targetValue: String(item.targetValue || '').trim(),
          actualValue: String(item.actualValue || '').trim(),
          unit: item.unit ? String(item.unit).trim() : undefined,
          status,
        };
      })
      .filter((k) => k.label.length > 0);
  }

  function sanitizeReportActions(raw: unknown): WorkReportActionItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item, idx): WorkReportActionItem => {
        const priority: WorkReportActionItem['priority'] =
          item.priority === 'URGENTE' || item.priority === 'HAUTE' || item.priority === 'NORMALE'
            ? item.priority
            : 'NORMALE';
        const status: WorkReportActionItem['status'] =
          item.status === 'FAIT' || item.status === 'EN_COURS' || item.status === 'A_LANCER'
            ? item.status
            : 'A_LANCER';
        return {
          id: String(item.id || `act-${Date.now()}-${idx}`),
          action: String(item.action || '').trim(),
          owner: String(item.owner || '').trim(),
          deadline: String(item.deadline || '').trim(),
          priority,
          status,
        };
      })
      .filter((a) => a.action.length > 0);
  }

  function buildWorkReportsOverview(actor: ActiveActorContext): WorkReportsOverviewPayload {
    const roleGroup = getReportActorRoleGroup(actor);
    const canReviewReports = roleGroup === 'DIRECTION' || roleGroup === 'MANAGER';
    const canFinalValidate = roleGroup === 'DIRECTION';

    const visibleReports = workReports.filter((r) => {
      if (actor.space === 'superadmin') return true;
      if (r.authorUserId === actor.id) return true;
      const sameOrg = r.organizationId === actor.organizationId || actor.organizationId === 'tpd-demo-accounting';
      if (!sameOrg) return false;
      if (roleGroup === 'DIRECTION') return r.status !== 'BROUILLON';
      if (roleGroup === 'MANAGER') return r.status !== 'BROUILLON';
      return r.status === 'VALIDE';
    });

    const visibleMissions: WorkReportMissionOption[] = missionOrders
      .filter((m) => {
        if (actor.space === 'superadmin' || roleGroup === 'DIRECTION') return true;
        if (roleGroup === 'MANAGER') return m.organizationId === actor.organizationId || m.agentUserId === actor.id;
        return m.agentUserId === actor.id;
      })
      .map((m) => ({
        id: m.id,
        reference: m.reference,
        title: m.title,
        destination: m.destination,
        departureDate: m.departureDate,
        returnDate: m.returnDate,
        daysCount: m.daysCount,
        agentName: m.agentName,
        department: m.department,
        totalEstimatedFcfa: m.totalEstimatedFcfa,
        actualSpentFcfa: m.actualSpentFcfa,
        status: m.status,
      }));

    const visibleTasks: WorkReportTaskOption[] = store.tasks
      .filter((t) => {
        if (actor.space === 'superadmin' || roleGroup === 'DIRECTION') return true;
        if (roleGroup === 'MANAGER') return t.organizationId === actor.organizationId || t.assigneeUserId === actor.id || t.ownerUserId === actor.id;
        return t.assigneeUserId === actor.id || t.ownerUserId === actor.id;
      })
      .slice(0, 40)
      .map((t) => ({
        id: t.id,
        code: t.code,
        title: t.title,
        status: t.status,
        priority: t.priority,
        category: t.category,
        dueDate: t.dueDate,
        assigneeName: t.assigneeName,
        linkedRecordLabel: t.linkedRecordLabel,
      }));

    return {
      reports: visibleReports,
      templates: workReportTemplates,
      missionsCatalog: visibleMissions,
      tasksCatalog: visibleTasks,
      canReviewReports,
      canFinalValidate,
      actorRoleGroup: roleGroup,
      stats: {
        total: visibleReports.length,
        drafts: visibleReports.filter((r) => r.status === 'BROUILLON').length,
        submitted: visibleReports.filter((r) => r.status === 'SOUMIS').length,
        revisionRequested: visibleReports.filter((r) => r.status === 'REVISION_DEMANDEE').length,
        validated: visibleReports.filter((r) => r.status === 'VALIDE').length,
        missionReportsCount: visibleReports.filter((r) => r.type === 'RAPPORT_MISSION').length,
        workReportsCount: visibleReports.filter((r) => r.type !== 'RAPPORT_MISSION').length,
      },
    };
  }

  app.get('/api/reports/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildWorkReportsOverview(actor));
  });

  app.post('/api/reports', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      type?: WorkReportType;
      title?: string;
      periodLabel?: string;
      startDate?: string;
      endDate?: string;
      location?: string;
      linkedMissionId?: string;
      linkedTaskCodes?: string[];
      executiveSummary?: string;
      contextAndObjectives?: string;
      activitiesAndDeliverables?: string;
      difficultiesAndRisks?: string;
      recommendationsAndNextSteps?: string;
      kpis?: WorkReportKpiItem[];
      actionPlan?: WorkReportActionItem[];
      attachmentsNote?: string;
      submitNow?: boolean;
    };

    if (!body.title?.trim()) {
      return res.status(400).json({ error: 'Le titre du rapport est obligatoire.' });
    }

    const validTypes: WorkReportType[] = [
      'RAPPORT_MISSION',
      'RAPPORT_TRAVAIL_HEBDO',
      'RAPPORT_TRAVAIL_MENSUEL',
      'RAPPORT_PROJET',
      'RAPPORT_DIRECTION',
    ];
    const resolvedType: WorkReportType = validTypes.includes(body.type as WorkReportType)
      ? (body.type as WorkReportType)
      : 'RAPPORT_TRAVAIL_HEBDO';

    const linkedMission = body.linkedMissionId
      ? missionOrders.find((m) => m.id === body.linkedMissionId)
      : undefined;

    const hrProf = hrProfiles.find((p) => p.userId === actor.id);
    const nowIso = new Date().toISOString();
    const todayIso = nowIso.slice(0, 10);
    const submitNow = Boolean(body.submitNow);
    const kpis = sanitizeReportKpis(body.kpis);
    const actionPlan = sanitizeReportActions(body.actionPlan);
    const metrics = computeReportMetrics({
      title: body.title,
      periodLabel: body.periodLabel || `${body.startDate || todayIso} → ${body.endDate || todayIso}`,
      executiveSummary: body.executiveSummary,
      contextAndObjectives: body.contextAndObjectives,
      activitiesAndDeliverables: body.activitiesAndDeliverables,
      difficultiesAndRisks: body.difficultiesAndRisks,
      recommendationsAndNextSteps: body.recommendationsAndNextSteps,
      kpis,
      actionPlan,
    });

    const reference = `RPT-2026-${String(workReports.length + 38).padStart(3, '0')}`;
    const newReport: WorkReportRecord = {
      id: `rpt-${Date.now()}`,
      reference,
      type: resolvedType,
      status: submitNow ? 'SOUMIS' : 'BROUILLON',
      title: body.title.trim(),
      authorUserId: actor.id,
      authorName: actor.name,
      authorJobTitle: hrProf?.jobTitle || actor.role,
      authorRole: actor.role,
      department: hrProf?.department || actor.organizationName,
      organizationId: actor.organizationId === 'tpd-demo-accounting' ? 'tpd-demo-intranet' : actor.organizationId,
      periodLabel: body.periodLabel?.trim() || `${body.startDate || todayIso} — ${body.endDate || todayIso}`,
      startDate: body.startDate || todayIso,
      endDate: body.endDate || todayIso,
      location: body.location?.trim() || linkedMission?.destination || hrProf?.site || 'Dakar',
      linkedMissionId: linkedMission?.id,
      linkedMissionRef: linkedMission?.reference,
      linkedTaskCodes: Array.isArray(body.linkedTaskCodes)
        ? body.linkedTaskCodes.map((c) => String(c).trim()).filter(Boolean)
        : [],
      executiveSummary: (body.executiveSummary || '').trim(),
      contextAndObjectives: (body.contextAndObjectives || '').trim(),
      activitiesAndDeliverables: (body.activitiesAndDeliverables || '').trim(),
      difficultiesAndRisks: (body.difficultiesAndRisks || '').trim(),
      recommendationsAndNextSteps: (body.recommendationsAndNextSteps || '').trim(),
      kpis,
      actionPlan,
      attachmentsNote: body.attachmentsNote?.trim() || undefined,
      completenessPct: metrics.completenessPct,
      wordCount: metrics.wordCount,
      reviewTrail: [
        {
          id: `rt-${Date.now()}`,
          stepLabel: submitNow ? 'Création & Soumission pour visa' : 'Enregistrement brouillon',
          actorName: actor.name,
          actorRole: actor.role,
          action: submitNow ? 'SOUMIS' : 'CREATION',
          timestamp: nowIso,
        },
      ],
      submittedAt: submitNow ? nowIso : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    workReports.unshift(newReport);

    if (submitNow) {
      if (linkedMission && !linkedMission.missionReportSummary) {
        linkedMission.missionReportSummary =
          newReport.executiveSummary || newReport.activitiesAndDeliverables.slice(0, 320);
        linkedMission.missionReportSubmittedAt = nowIso;
      }
      pushNotification({
        userId: actor.role === 'EMPLOYEE' ? 'int-u-2' : 'int-u-1',
        organizationId: newReport.organizationId,
        title: `Nouveau rapport soumis — ${newReport.reference}`,
        message: `${actor.name} a transmis « ${newReport.title} » pour validation.`,
        category: 'WORKFLOW',
        priority: 'NORMALE',
        targetSection: 'reports',
      });
    }

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: submitNow ? 'REPORT_CREATED_AND_SUBMITTED' : 'REPORT_DRAFT_CREATED',
      target: newReport.reference,
      details: `${newReport.type} · ${newReport.title}`,
      severity: 'INFO',
    });

    return res.status(201).json({ report: newReport, ...buildWorkReportsOverview(actor) });
  });

  app.patch('/api/reports/:id', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const report = workReports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Rapport introuvable.' });

    const roleGroup = getReportActorRoleGroup(actor);
    if (report.authorUserId !== actor.id && roleGroup !== 'DIRECTION') {
      return res.status(403).json({ error: 'Modification réservée à l’auteur ou à la Direction.' });
    }
    if (report.status === 'VALIDE' || report.status === 'ARCHIVE') {
      return res.status(400).json({ error: 'Un rapport validé ou archivé ne peut plus être modifié.' });
    }

    const body = req.body as Partial<WorkReportRecord> & { submitNow?: boolean };
    if (body.type) report.type = body.type;
    if (body.title !== undefined && body.title.trim()) report.title = body.title.trim();
    if (body.periodLabel !== undefined) report.periodLabel = body.periodLabel.trim();
    if (body.startDate !== undefined) report.startDate = body.startDate;
    if (body.endDate !== undefined) report.endDate = body.endDate;
    if (body.location !== undefined) report.location = body.location.trim() || undefined;
    if (body.linkedMissionId !== undefined) {
      const m = body.linkedMissionId
        ? missionOrders.find((x) => x.id === body.linkedMissionId)
        : undefined;
      report.linkedMissionId = m?.id;
      report.linkedMissionRef = m?.reference;
    }
    if (Array.isArray(body.linkedTaskCodes)) {
      report.linkedTaskCodes = body.linkedTaskCodes.map((c) => String(c).trim()).filter(Boolean);
    }
    if (body.executiveSummary !== undefined) report.executiveSummary = body.executiveSummary.trim();
    if (body.contextAndObjectives !== undefined) report.contextAndObjectives = body.contextAndObjectives.trim();
    if (body.activitiesAndDeliverables !== undefined) report.activitiesAndDeliverables = body.activitiesAndDeliverables.trim();
    if (body.difficultiesAndRisks !== undefined) report.difficultiesAndRisks = body.difficultiesAndRisks.trim();
    if (body.recommendationsAndNextSteps !== undefined) report.recommendationsAndNextSteps = body.recommendationsAndNextSteps.trim();
    if (body.kpis !== undefined) report.kpis = sanitizeReportKpis(body.kpis);
    if (body.actionPlan !== undefined) report.actionPlan = sanitizeReportActions(body.actionPlan);
    if (body.attachmentsNote !== undefined) report.attachmentsNote = body.attachmentsNote.trim() || undefined;

    const metrics = computeReportMetrics(report);
    report.completenessPct = metrics.completenessPct;
    report.wordCount = metrics.wordCount;
    const nowIso = new Date().toISOString();
    report.updatedAt = nowIso;

    if (body.submitNow) {
      report.status = 'SOUMIS';
      report.submittedAt = nowIso;
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: 'Mise à jour & Soumission pour visa',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'SOUMIS',
        timestamp: nowIso,
      });
      pushNotification({
        userId: actor.role === 'EMPLOYEE' ? 'int-u-2' : 'int-u-1',
        organizationId: report.organizationId,
        title: `Rapport soumis — ${report.reference}`,
        message: `${actor.name} a transmis « ${report.title} » pour validation.`,
        category: 'WORKFLOW',
        priority: 'NORMALE',
        targetSection: 'reports',
      });
    } else {
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: 'Enregistrement révision brouillon',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'MISE_A_JOUR',
        timestamp: nowIso,
      });
    }

    return res.json({ report, ...buildWorkReportsOverview(actor) });
  });

  app.patch('/api/reports/:id/review', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const report = workReports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Rapport introuvable.' });

    const body = req.body as {
      action: 'SUBMIT' | 'APPROVE' | 'REQUEST_REVISION' | 'ARCHIVE';
      note?: string;
    };

    const roleGroup = getReportActorRoleGroup(actor);
    const nowIso = new Date().toISOString();

    if (body.action === 'SUBMIT') {
      if (report.authorUserId !== actor.id && roleGroup !== 'DIRECTION') {
        return res.status(403).json({ error: 'Action réservée à l’auteur du rapport.' });
      }
      report.status = 'SOUMIS';
      report.submittedAt = nowIso;
      report.updatedAt = nowIso;
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: 'Soumission pour validation',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'SOUMIS',
        note: body.note?.trim() || undefined,
        timestamp: nowIso,
      });
      pushNotification({
        userId: actor.role === 'EMPLOYEE' ? 'int-u-2' : 'int-u-1',
        organizationId: report.organizationId,
        title: `Rapport à viser — ${report.reference}`,
        message: `${actor.name} soumet « ${report.title} ».`,
        category: 'WORKFLOW',
        priority: 'NORMALE',
        targetSection: 'reports',
      });
    } else if (body.action === 'APPROVE') {
      if (roleGroup === 'EMPLOYEE') {
        return res.status(403).json({ error: 'La validation hiérarchique est réservée aux Managers et à la Direction.' });
      }
      if (report.authorUserId === actor.id && roleGroup !== 'DIRECTION') {
        return res.status(403).json({ error: 'Un manager ne peut pas auto-valider son propre rapport.' });
      }
      report.status = 'VALIDE';
      report.reviewerName = actor.name;
      report.reviewNote = body.note?.trim() || 'Rapport validé et approuvé.';
      report.validatedAt = nowIso;
      report.updatedAt = nowIso;
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: roleGroup === 'DIRECTION' ? 'Validation Direction Générale' : 'Visa & Validation Manager N+1',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'VALIDATION',
        note: report.reviewNote,
        timestamp: nowIso,
      });
      if (report.linkedMissionId) {
        const linkedMission = missionOrders.find((m) => m.id === report.linkedMissionId);
        if (linkedMission && !linkedMission.missionReportSummary) {
          linkedMission.missionReportSummary =
            report.executiveSummary || report.activitiesAndDeliverables.slice(0, 320);
          linkedMission.missionReportSubmittedAt = nowIso;
        }
      }
      pushNotification({
        userId: report.authorUserId,
        organizationId: report.organizationId,
        title: `Rapport validé — ${report.reference}`,
        message: `${actor.name} a validé votre rapport « ${report.title} ».`,
        category: 'WORKFLOW',
        priority: 'NORMALE',
        targetSection: 'reports',
      });
    } else if (body.action === 'REQUEST_REVISION') {
      if (roleGroup === 'EMPLOYEE') {
        return res.status(403).json({ error: 'Réservé aux Managers et à la Direction.' });
      }
      if (!body.note?.trim()) {
        return res.status(400).json({ error: 'Précisez les éléments à compléter.' });
      }
      report.status = 'REVISION_DEMANDEE';
      report.reviewerName = actor.name;
      report.reviewNote = body.note.trim();
      report.updatedAt = nowIso;
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: 'Demande de complément / révision',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'REVISION',
        note: body.note.trim(),
        timestamp: nowIso,
      });
      pushNotification({
        userId: report.authorUserId,
        organizationId: report.organizationId,
        title: `Révision demandée — ${report.reference}`,
        message: `${actor.name} demande un complément sur « ${report.title} » : ${body.note.trim()}`,
        category: 'WORKFLOW',
        priority: 'HAUTE',
        targetSection: 'reports',
      });
    } else if (body.action === 'ARCHIVE') {
      if (roleGroup !== 'DIRECTION' && report.authorUserId !== actor.id) {
        return res.status(403).json({ error: 'Action réservée à la Direction ou à l’auteur.' });
      }
      report.status = 'ARCHIVE';
      report.updatedAt = nowIso;
      report.reviewTrail.push({
        id: `rt-${Date.now()}`,
        stepLabel: 'Archivage dossier',
        actorName: actor.name,
        actorRole: actor.role,
        action: 'ARCHIVE',
        note: body.note?.trim() || undefined,
        timestamp: nowIso,
      });
    }

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: `REPORT_${body.action}`,
      target: report.reference,
      details: `${report.authorName} · ${report.title}`,
      severity: body.action === 'REQUEST_REVISION' ? 'WARNING' : 'INFO',
    });

    return res.json({ report, ...buildWorkReportsOverview(actor) });
  });

  app.delete('/api/reports/:id', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const idx = workReports.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Rapport introuvable.' });

    const report = workReports[idx];
    const roleGroup = getReportActorRoleGroup(actor);
    if (report.authorUserId !== actor.id && roleGroup !== 'DIRECTION') {
      return res.status(403).json({ error: 'Suppression réservée à l’auteur ou à la Direction.' });
    }
    if (report.status === 'VALIDE' && roleGroup !== 'DIRECTION') {
      return res.status(403).json({ error: 'Un rapport validé ne peut être supprimé que par la Direction.' });
    }

    workReports.splice(idx, 1);
    return res.json(buildWorkReportsOverview(actor));
  });

  registerModulePersistence('cahier', {
    getState: () => ({
      hrProfiles,
      leaveBalances,
      leaveRequests,
      attendanceEntries,
      hrAttestations,
      formTemplates,
      workflowInstances,
      delegations,
      gedFolders,
      gedDocuments,
      gedVersionBinaries: Array.from(gedVersionBinaries.entries()).map(([k, v]) => [
        k,
        { fileName: v.fileName, mimeType: v.mimeType, base64: v.buffer.toString('base64') },
      ]),
      officialMemos,
      internalPolls,
      notificationsList,
      notificationPrefsByUser: Array.from(notificationPrefsByUser.entries()),
      orgUnits,
      orgSites,
      orgThemes: Array.from(orgThemes.entries()),
      orgTokens,
      orgWebhooks,
      orgBackups,
      institutionalMail,
      visitorLogs,
      sharedBookings,
      missionOrders,
      workReports,
      tenantsList,
      tenantInvoices,
      supportTickets,
      servicesHealth,
    }),
    restoreState: (data) => {
      const replaceArr = <T,>(arr: T[], incoming: unknown) => {
        if (Array.isArray(incoming)) arr.splice(0, arr.length, ...(incoming as T[]));
      };
      replaceArr(hrProfiles, data.hrProfiles);
      replaceArr(leaveBalances, data.leaveBalances);
      replaceArr(leaveRequests, data.leaveRequests);
      replaceArr(attendanceEntries, data.attendanceEntries);
      replaceArr(hrAttestations, data.hrAttestations);
      replaceArr(formTemplates, data.formTemplates);
      replaceArr(workflowInstances, data.workflowInstances);
      replaceArr(delegations, data.delegations);
      replaceArr(gedFolders, data.gedFolders);
      replaceArr(gedDocuments, data.gedDocuments);
      if (Array.isArray(data.gedVersionBinaries)) {
        gedVersionBinaries.clear();
        for (const [k, v] of data.gedVersionBinaries as [
          string,
          { fileName: string; mimeType: string; base64?: string; buffer?: { data?: number[] } },
        ][]) {
          const buf = v.base64
            ? Buffer.from(v.base64, 'base64')
            : v.buffer?.data
            ? Buffer.from(v.buffer.data)
            : Buffer.alloc(0);
          gedVersionBinaries.set(k, { fileName: v.fileName, mimeType: v.mimeType, buffer: buf });
        }
      }
      replaceArr(officialMemos, data.officialMemos);
      replaceArr(internalPolls, data.internalPolls);
      replaceArr(notificationsList, data.notificationsList);
      if (Array.isArray(data.notificationPrefsByUser)) {
        notificationPrefsByUser.clear();
        for (const [k, v] of data.notificationPrefsByUser as [string, NotificationPreferences][]) {
          notificationPrefsByUser.set(k, v);
        }
      }
      replaceArr(orgUnits, data.orgUnits);
      replaceArr(orgSites, data.orgSites);
      if (Array.isArray(data.orgThemes)) {
        orgThemes.clear();
        for (const [k, v] of data.orgThemes as [string, OrgThemeConfig][]) {
          orgThemes.set(k, v);
        }
      }
      replaceArr(orgTokens, data.orgTokens);
      replaceArr(orgWebhooks, data.orgWebhooks);
      replaceArr(orgBackups, data.orgBackups);
      replaceArr(institutionalMail, data.institutionalMail);
      replaceArr(visitorLogs, data.visitorLogs);
      replaceArr(sharedBookings, data.sharedBookings);
      replaceArr(missionOrders, data.missionOrders);
      replaceArr(workReports, data.workReports);
      replaceArr(tenantsList, data.tenantsList);
      replaceArr(tenantInvoices, data.tenantInvoices);
      replaceArr(supportTickets, data.supportTickets);
      replaceArr(servicesHealth, data.servicesHealth);
    },
  });
}

export function getCahierCollections() {
  return {
    missionOrders,
    workReports,
    gedDocuments,
    leaveRequests,
  };
}

export function pushPlatformNotification(input: {
  userId: string;
  organizationId: string;
  title: string;
  message: string;
  category?: NotificationItem['category'];
  priority?: NotificationItem['priority'];
  channelsSent?: NotificationItem['channelsSent'];
  targetSection?: string;
}): NotificationItem {
  const created: NotificationItem = {
    id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId: input.userId,
    organizationId: input.organizationId,
    title: input.title,
    message: input.message,
    category: input.category || 'SYSTEME',
    priority: input.priority || 'NORMALE',
    channelsSent: input.channelsSent || ['IN_APP', 'PUSH_WEB'],
    targetSection: input.targetSection || 'marketing',
    read: false,
    createdAt: new Date().toISOString(),
  };
  notificationsList.unshift(created);
  return created;
}


