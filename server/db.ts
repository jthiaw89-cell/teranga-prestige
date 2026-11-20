import pg from 'pg';
import type { CourseOrganizationSession, TrainingRequestRecord } from '../src/types.js';

const { Pool } = pg;

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  release: () => void;
}

export interface DbAdapter {
  isMock: boolean;
  query: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
  connect: () => Promise<DbClient>;
}

export interface AccountingAccount {
  id: string;
  organizationId: string;
  code: string;
  label: string;
  accountClass: string;
  normalBalance: 'DEBIT' | 'CREDIT';
}

export interface AccountingJournal {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: 'ACHATS' | 'VENTES' | 'BANQUE' | 'CAISSE' | 'OD';
}

export interface AccountingFiscalYear {
  id: string;
  organizationId: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CLOSED';
}

export interface AccountingEntryLine {
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: number;
  credit: number;
}

export interface AccountingEntry {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  journalCode: string;
  entryNumber: string;
  entryDate: string;
  reference: string;
  description: string;
  lines: AccountingEntryLine[];
  createdBy: string;
  createdAt: string;
}

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface AccountingUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ACCOUNTANT' | 'READ_ONLY';
  passwordHash: string;
  avatarUrl?: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface IntranetUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: 'OWNER' | 'DIRECTION' | 'MANAGER' | 'EMPLOYEE';
  title: string;
  passwordHash: string;
  avatarUrl?: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface IntranetChannel {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  isPrivate: boolean;
  memberIds: string[];
}

export interface IntranetAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface IntranetMessage {
  id: string;
  organizationId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachment?: IntranetAttachment;
  createdAt: string;
}

export interface IntranetForumReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface IntranetForumTopic {
  id: string;
  organizationId: string;
  channelId: string;
  title: string;
  body: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  replies: IntranetForumReply[];
}

export type TrainingModality = 'EN_LIGNE' | 'HYBRIDE' | 'PRESENTIEL';

export interface LearnerLesson {
  id: string;
  title: string;
  format: 'VIDEO' | 'SUPPORT_PDF' | 'ATELIER' | 'EVALUATION';
  durationMinutes: number;
  summary: string;
  completed: boolean;
}

export interface LearnerCourseCertificate {
  certificateNumber: string;
  issuedAt: string;
  mention: string;
}

export interface LearnerCourse {
  id: string;
  learnerId: string;
  linkedCourseId?: string;
  title: string;
  category: string;
  modality: TrainingModality;
  instructor: string;
  companySponsor: string;
  startDate: string;
  scheduleInfo: string;
  durationHours: number;
  lessons: LearnerLesson[];
  certificate?: LearnerCourseCertificate;
}

export interface LearnerCourseQuestion {
  id: string;
  courseId: string;
  lessonId?: string;
  lessonTitle?: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  createdAt: string;
  instructorReply?: string;
}

export interface LearnerLessonNote {
  id: string;
  courseId: string;
  lessonId: string;
  learnerId: string;
  content: string;
  updatedAt: string;
}

export interface LearnerUser {
  id: string;
  email: string;
  name: string;
  companyName: string;
  jobTitle: string;
  passwordHash: string;
  avatarUrl?: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export type CourseLessonType = 'VIDEO' | 'PDF' | 'WORD' | 'AUDIO' | 'TEXTE' | 'ATELIER';
export type CoursePricingModel = 'ONE_TIME' | 'SUBSCRIPTION' | 'B2B_LICENSE' | 'FREE';
export type CourseStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
export type CourseLevel = 'TOUS_NIVEAUX' | 'DEBUTANT' | 'INTERMEDIAIRE' | 'AVANCE';

export interface InstructorLesson {
  id: string;
  title: string;
  type: CourseLessonType;
  durationMinutes: number;
  resourceUrl?: string;
  fileName?: string;
  textContent?: string;
  isFreePreview?: boolean;
}

export interface InstructorChapter {
  id: string;
  title: string;
  description: string;
  lessons: InstructorLesson[];
}

export interface InstructorCourse {
  id: string;
  instructorId: string;
  instructorName: string;
  instructorAvatarUrl?: string;
  title: string;
  category: string;
  pricingModel: CoursePricingModel;
  priceFcfa: number;
  promoPriceFcfa?: number;
  description: string;
  level: CourseLevel;
  estimatedDuration: string;
  modality: TrainingModality;
  locationOrPlatform?: string;
  nextSessionDate?: string;
  startHour?: number;
  trailerYoutubeUrl?: string;
  chapters: InstructorChapter[];
  images: string[];
  promoBadge?: string;
  status: CourseStatus;
  enrolledCount: number;
  completionRate: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorUser {
  id: string;
  email: string;
  name: string;
  specialty: string;
  city: string;
  avatarUrl?: string;
  passwordHash: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface InstructorEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
  learnerId?: string;
  learnerName: string;
  companyName: string;
  modality: TrainingModality;
  progressPct: number;
  attendanceStatus: 'PRESENT' | 'EN_LIGNE_ACTIF' | 'ABSENT' | 'CERTIFIE';
  enrolledAt: string;
}

export type ProviderOfferStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
export type ProviderRequestStage =
  | 'NOUVELLE_DEMANDE'
  | 'EN_ETUDE'
  | 'DEVIS_ENVOYE'
  | 'COMMANDE_CONFIRMEE'
  | 'FACTURE_EMISE'
  | 'PAYEE'
  | 'REFUSEE';

export interface ProviderIncludedService {
  id: string;
  name: string;
  details: string;
}

export interface ProviderServiceOffer {
  id: string;
  providerId: string;
  providerName: string;
  providerAvatarUrl?: string;
  companyName: string;
  companyLogoUrl?: string;
  title: string;
  category: string;
  priceFcfa: number;
  referencePriceFcfa?: number;
  description: string;
  locationZone: string;
  capacityGuests: number;
  includedServices: ProviderIncludedService[];
  images: string[];
  status: ProviderOfferStatus;
  requestsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderServiceRequest {
  id: string;
  providerId: string;
  requesterUserId?: string;
  requesterOrgId?: string;
  offerId: string;
  offerTitle: string;
  category: string;
  clientName: string;
  clientCompany: string;
  clientEmail: string;
  eventType: string;
  eventDate: string;
  eventLocation: string;
  guestCount: number;
  notes: string;
  stage: ProviderRequestStage;
  quoteNumber?: string;
  orderNumber?: string;
  invoiceNumber?: string;
  amountFcfa: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderUser {
  id: string;
  email: string;
  name: string;
  companyName: string;
  roleTitle: string;
  city: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
  passwordHash: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface SuperadminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'SECURITY_ADMIN';
  title: string;
  avatarUrl?: string;
  passwordHash: string;
  status?: UserAccountStatus;
  lastLoginAt?: string;
  createdAt?: string;
}

export interface PlatformAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorSpace: 'intranet' | 'accounting' | 'learner' | 'instructor' | 'provider' | 'superadmin';
  action: string;
  targetType: 'USER' | 'SESSION' | 'SYSTEM' | 'AUTH' | 'COMMISSION';
  targetId?: string;
  targetLabel?: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export type CommissionBeneficiaryType = 'INSTRUCTOR' | 'PROVIDER';
export type CommissionRuleScope = 'GLOBAL' | 'CATEGORY' | 'USER';
export type CommissionStatus =
  | 'EN_ATTENTE'
  | 'VALIDEE'
  | 'PRELEVEE'
  | 'REVERSE_PARTENAIRE'
  | 'ANNULEE';
export type CommissionPayoutMethod =
  | 'VIREMENT'
  | 'MOBILE_MONEY'
  | 'RETENUE_FACTURE'
  | 'CHEQUE';

export interface CommissionRule {
  id: string;
  name: string;
  beneficiaryType: CommissionBeneficiaryType;
  scope: CommissionRuleScope;
  targetUserId?: string;
  targetUserName?: string;
  category?: string;
  ratePercent: number;
  fixedFeeFcfa: number;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface CommissionRecord {
  id: string;
  reference: string;
  beneficiaryType: CommissionBeneficiaryType;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryOrg: string;
  sourceType: 'COURSE_ENROLLMENT' | 'PROVIDER_REQUEST' | 'MANUAL';
  sourceId: string;
  sourceTitle: string;
  clientOrLearnerName: string;
  category: string;
  grossAmountFcfa: number;
  appliedRatePercent: number;
  fixedFeeFcfa: number;
  commissionAmountFcfa: number;
  netPartnerAmountFcfa: number;
  ruleId?: string;
  ruleName?: string;
  status: CommissionStatus;
  payoutMethod?: CommissionPayoutMethod;
  payoutReference?: string;
  notes?: string;
  transactionDate: string;
  validatedAt?: string;
  collectedAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'A_FAIRE' | 'EN_COURS' | 'EN_REVISION' | 'TERMINE';
export type TaskPriority = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';
export type TaskCategory =
  | 'CRM'
  | 'EVENEMENT'
  | 'FORMATION'
  | 'COMPTABILITE'
  | 'PRESTATION'
  | 'ADMINISTRATION'
  | 'PERSONNEL';

export interface TaskChecklistItem {
  id: string;
  label: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export type AuthSpace =
  | 'intranet'
  | 'accounting'
  | 'learner'
  | 'instructor'
  | 'provider'
  | 'superadmin';

export interface PlatformTask {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  ownerUserId: string;
  ownerName: string;
  assigneeUserId: string;
  assigneeName: string;
  organizationId: string;
  space: AuthSpace;
  startDate?: string;
  dueDate?: string;
  startHour?: number;
  estimatedHours?: number;
  tags: string[];
  checklist: TaskChecklistItem[];
  comments: TaskComment[];
  linkedRecordLabel?: string;
  syncToPlanning: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type PlanningEntryType =
  | 'REUNION'
  | 'RENDEZ_VOUS'
  | 'EVENEMENT'
  | 'FORMATION'
  | 'PRESTATION'
  | 'BLOC_TEMPS'
  | 'ECHEANCE';

export type PlanningEntryStatus =
  | 'PLANIFIE'
  | 'CONFIRME'
  | 'EN_COURS'
  | 'TERMINE'
  | 'ANNULE';

export interface PlanningEntry {
  id: string;
  ownerUserId: string;
  ownerName: string;
  participantUserIds: string[];
  participantNames: string[];
  organizationId: string;
  space: AuthSpace;
  title: string;
  description: string;
  type: PlanningEntryType;
  status: PlanningEntryStatus;
  date: string;
  startHour: number;
  durationHours: number;
  location: string;
  linkedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export type CrmContactType = 'CLIENT' | 'PROSPECT' | 'SUPPLIER';
export type CrmPipelineStage = 'NOUVEAU' | 'CONTACTE' | 'QUALIFIE' | 'PROPOSITION' | 'GAGNE';

export interface ServerCrmContact {
  id: string;
  ownerUserId: string;
  organizationId: string;
  type: CrmContactType;
  name: string;
  email: string;
  phone: string;
  ninea: string;
  address: string;
  sector?: string;
  whatsappOptIn?: boolean;
  pipelineStage?: CrmPipelineStage;
  lastContactAt?: string;
  nextFollowUpDate?: string;
  notes?: string;
}

export type ServerDocKind =
  | 'QUOTE'
  | 'CUSTOMER_ORDER'
  | 'DELIVERY_NOTE'
  | 'CUSTOMER_INVOICE'
  | 'PURCHASE_ORDER'
  | 'SUPPLIER_INVOICE';

export type ServerDocStatus = 'DRAFT' | 'VALIDATED' | 'PARTIAL' | 'DELIVERED' | 'PAID';

export interface ServerDocumentLine {
  id: string;
  label: string;
  quantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface ServerDocumentPayment {
  id: string;
  date: string;
  amount: number;
  method: 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
  reference: string;
}

export interface ServerCommercialDocument {
  id: string;
  ownerUserId: string;
  organizationId: string;
  kind: ServerDocKind;
  number: string;
  date: string;
  contactId: string;
  contactName: string;
  status: ServerDocStatus;
  lines: ServerDocumentLine[];
  payments: ServerDocumentPayment[];
  notes: string;
  syncedToAccounting?: boolean;
  linkedProviderRequestId?: string;
}

export interface ServerCrmCampaign {
  id: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'MIXTE';
  audience: 'ALL_CLIENTS_PROSPECTS' | 'QUALIFIED_PROSPECTS' | 'WHATSAPP_OPTIN' | 'UNPAID_INVOICES';
  status: 'BROUILLON' | 'ACTIVE' | 'TERMINEE';
  messageTemplate: string;
  targetCount: number;
  sentConfirmedCount: number;
  repliesCount: number;
  createdAt: string;
}

export interface ServerWhatsappFollowUp {
  id: string;
  ownerUserId: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  phone: string;
  campaignId?: string;
  campaignName?: string;
  documentNumber?: string;
  message: string;
  status: 'A_ENVOYER' | 'OUVERT_WHATSAPP' | 'ENVOI_CONFIRME' | 'REPONSE_RECUE' | 'REPORTE';
  preparedAt: string;
  confirmedSentAt?: string;
  replyNote?: string;
  repliedAt?: string;
}

export interface ServerCrmActivityLog {
  id: string;
  ownerUserId: string;
  organizationId: string;
  contactId: string;
  contactName: string;
  kind: 'APPEL' | 'WHATSAPP' | 'EMAIL' | 'REUNION' | 'DOCUMENT' | 'NOTE';
  summary: string;
  nextStep?: string;
  followUpDate?: string;
  createdAt: string;
  author: string;
}

export interface ServerEventRecord {
  id: string;
  ownerUserId: string;
  organizationId: string;
  assignedUserIds: string[];
  title: string;
  client: string;
  date: string;
  startHour?: number;
  venue: string;
  capacity: number;
  registered: number;
  budgetFcfa: number;
  status: 'PLANIFIE' | 'EN_COURS' | 'TERMINE';
}

export interface InMemoryStore {
  accountingUsers: AccountingUser[];
  accountingFiscalYears: AccountingFiscalYear[];
  accountingJournals: AccountingJournal[];
  accountingAccounts: AccountingAccount[];
  accountingEntries: AccountingEntry[];
  intranetUsers: IntranetUser[];
  intranetChannels: IntranetChannel[];
  intranetMessages: IntranetMessage[];
  intranetForumTopics: IntranetForumTopic[];
  learnerUsers: LearnerUser[];
  learnerCourses: LearnerCourse[];
  learnerCourseQuestions: LearnerCourseQuestion[];
  learnerLessonNotes: LearnerLessonNote[];
  instructorUsers: InstructorUser[];
  instructorCourses: InstructorCourse[];
  instructorEnrollments: InstructorEnrollment[];
  courseOrganizationSessions: CourseOrganizationSession[];
  trainingRequests: TrainingRequestRecord[];
  providerUsers: ProviderUser[];
  providerOffers: ProviderServiceOffer[];
  providerRequests: ProviderServiceRequest[];
  crmContacts: ServerCrmContact[];
  crmDocuments: ServerCommercialDocument[];
  crmCampaigns: ServerCrmCampaign[];
  crmFollowUps: ServerWhatsappFollowUp[];
  crmActivities: ServerCrmActivityLog[];
  platformEvents: ServerEventRecord[];
  superadminUsers: SuperadminUser[];
  auditLogs: PlatformAuditLog[];
  commissionRules: CommissionRule[];
  commissions: CommissionRecord[];
  tasks: PlatformTask[];
  planningEntries: PlanningEntry[];
}

export function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

export const store: InMemoryStore = {
  accountingUsers: [
    {
      id: 'acc-u-1',
      organizationId: 'tpd-demo-accounting',
      organizationName: 'Senelec Digital (Démo SYSCOHADA)',
      email: 'comptabilite@teranga-demo.sn',
      name: 'Aminata Diallo',
      role: 'OWNER',
      passwordHash: simpleHash('demo-accounting-2026'),
    },
    {
      id: 'acc-u-2',
      organizationId: 'tpd-demo-accounting',
      organizationName: 'Senelec Digital (Démo SYSCOHADA)',
      email: 'expert@teranga-demo.sn',
      name: 'Moussa Ndiaye',
      role: 'ACCOUNTANT',
      passwordHash: simpleHash('demo-accounting-2026'),
    },
  ],
  accountingFiscalYears: [
    {
      id: 'fy-2026',
      organizationId: 'tpd-demo-accounting',
      label: 'Exercice 2026',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'OPEN',
    },
  ],
  accountingJournals: [
    { id: 'j-ve', organizationId: 'tpd-demo-accounting', code: 'VE', name: 'Journal des Ventes', type: 'VENTES' },
    { id: 'j-ac', organizationId: 'tpd-demo-accounting', code: 'AC', name: 'Journal des Achats', type: 'ACHATS' },
    { id: 'j-bq', organizationId: 'tpd-demo-accounting', code: 'BQ', name: 'Journal de Banque CBAO', type: 'BANQUE' },
    { id: 'j-ca', organizationId: 'tpd-demo-accounting', code: 'CA', name: 'Journal de Caisse', type: 'CAISSE' },
    { id: 'j-od', organizationId: 'tpd-demo-accounting', code: 'OD', name: 'Opérations Diverses', type: 'OD' },
  ],
  accountingAccounts: [
    { id: 'a-101', organizationId: 'tpd-demo-accounting', code: '101', label: 'Capital social', accountClass: '1', normalBalance: 'CREDIT' },
    { id: 'a-401', organizationId: 'tpd-demo-accounting', code: '401', label: 'Fournisseurs, dettes en compte', accountClass: '4', normalBalance: 'CREDIT' },
    { id: 'a-411', organizationId: 'tpd-demo-accounting', code: '411', label: 'Clients', accountClass: '4', normalBalance: 'DEBIT' },
    { id: 'a-443', organizationId: 'tpd-demo-accounting', code: '4431', label: 'TVA facturée sur ventes (18%)', accountClass: '4', normalBalance: 'CREDIT' },
    { id: 'a-445', organizationId: 'tpd-demo-accounting', code: '4452', label: 'TVA récupérable sur achats', accountClass: '4', normalBalance: 'DEBIT' },
    { id: 'a-521', organizationId: 'tpd-demo-accounting', code: '521', label: 'Banques locales', accountClass: '5', normalBalance: 'DEBIT' },
    { id: 'a-571', organizationId: 'tpd-demo-accounting', code: '571', label: 'Caisse siège Dakar', accountClass: '5', normalBalance: 'DEBIT' },
    { id: 'a-605', organizationId: 'tpd-demo-accounting', code: '605', label: 'Autres achats et prestations', accountClass: '6', normalBalance: 'DEBIT' },
    { id: 'a-706', organizationId: 'tpd-demo-accounting', code: '706', label: 'Services vendus (Événementiel & Formation)', accountClass: '7', normalBalance: 'CREDIT' },
  ],
  accountingEntries: [
    {
      id: 'ent-1',
      organizationId: 'tpd-demo-accounting',
      fiscalYearId: 'fy-2026',
      journalCode: 'VE',
      entryNumber: 'VE-2026-0001',
      entryDate: '2026-02-10',
      reference: 'FAC-2026-014',
      description: 'Facturation Séminaire Leadership Dakar',
      lines: [
        { accountCode: '411', accountLabel: 'Clients', label: 'Client Sonatel Business', debit: 2950000, credit: 0 },
        { accountCode: '706', accountLabel: 'Services vendus (Événementiel & Formation)', label: 'Prestation événementielle HT', debit: 0, credit: 2500000 },
        { accountCode: '4431', accountLabel: 'TVA facturée sur ventes (18%)', label: 'TVA collectée 18%', debit: 0, credit: 450000 },
      ],
      createdBy: 'Aminata Diallo',
      createdAt: '2026-02-10T10:15:00Z',
    },
    {
      id: 'ent-2',
      organizationId: 'tpd-demo-accounting',
      fiscalYearId: 'fy-2026',
      journalCode: 'BQ',
      entryNumber: 'BQ-2026-0001',
      entryDate: '2026-02-14',
      reference: 'VIR-CBAO-882',
      description: 'Encaissement virement Sonatel Business',
      lines: [
        { accountCode: '521', accountLabel: 'Banques locales', label: 'Règlement FAC-2026-014', debit: 2950000, credit: 0 },
        { accountCode: '411', accountLabel: 'Clients', label: 'Apurement compte client', debit: 0, credit: 2950000 },
      ],
      createdBy: 'Moussa Ndiaye',
      createdAt: '2026-02-14T14:30:00Z',
    },
  ],
  intranetUsers: [
    {
      id: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      organizationName: 'Teranga Prestige — Intranet',
      email: 'direction@teranga-demo.sn',
      name: 'Cheikh Tidiane Fall',
      role: 'OWNER',
      title: 'Directeur Général',
      passwordHash: simpleHash('demo-intranet-2026'),
    },
    {
      id: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      organizationName: 'Teranga Prestige — Intranet',
      email: 'manager@teranga-demo.sn',
      name: 'Fatou Binetou Sarr',
      role: 'MANAGER',
      title: 'Responsable Événementiel & Formation',
      passwordHash: simpleHash('demo-intranet-2026'),
    },
    {
      id: 'int-u-3',
      organizationId: 'tpd-demo-intranet',
      organizationName: 'Teranga Prestige — Intranet',
      email: 'employe@teranga-demo.sn',
      name: 'Ibrahima Gueye',
      role: 'EMPLOYEE',
      title: 'Chargé de coordination',
      passwordHash: simpleHash('demo-intranet-2026'),
    },
  ],
  intranetChannels: [
    {
      id: 'ch-general',
      organizationId: 'tpd-demo-intranet',
      name: 'Général',
      slug: 'general',
      description: 'Annonces officielles et vie d’entreprise pour tout le personnel.',
      isPrivate: false,
      memberIds: ['int-u-1', 'int-u-2', 'int-u-3'],
    },
    {
      id: 'ch-direction',
      organizationId: 'tpd-demo-intranet',
      name: 'Direction',
      slug: 'direction',
      description: 'Pilotage stratégique, budgets et gouvernance.',
      isPrivate: true,
      memberIds: ['int-u-1'],
    },
    {
      id: 'ch-managers',
      organizationId: 'tpd-demo-intranet',
      name: 'Managers',
      slug: 'managers',
      description: 'Coordination opérationnelle des pôles Bureau, Événementiel et Formation.',
      isPrivate: true,
      memberIds: ['int-u-1', 'int-u-2'],
    },
    {
      id: 'ch-employes',
      organizationId: 'tpd-demo-intranet',
      name: 'Équipe employés',
      slug: 'equipe-employes',
      description: 'Échanges quotidiens, logistique terrain et support.',
      isPrivate: false,
      memberIds: ['int-u-1', 'int-u-2', 'int-u-3'],
    },
  ],
  intranetMessages: [
    {
      id: 'msg-1',
      organizationId: 'tpd-demo-intranet',
      channelId: 'ch-general',
      senderId: 'int-u-1',
      senderName: 'Cheikh Tidiane Fall',
      senderRole: 'OWNER',
      content: 'Bienvenue sur l’espace souverain Teranga Prestige Digital. Tous les pôles (Bureau numérique, Événementiel et Formation) sont désormais synchronisés.',
      createdAt: '2026-11-17T08:15:00Z',
    },
    {
      id: 'msg-2',
      organizationId: 'tpd-demo-intranet',
      channelId: 'ch-general',
      senderId: 'int-u-2',
      senderName: 'Fatou Binetou Sarr',
      senderRole: 'MANAGER',
      content: 'Le programme du Forum Économique de Diamniadio et les fiches de présence de la cohorte Certification Cloud sont à jour.',
      createdAt: '2026-11-17T09:05:00Z',
    },
  ],
  intranetForumTopics: [
    {
      id: 'top-1',
      organizationId: 'tpd-demo-intranet',
      channelId: 'ch-general',
      title: 'Préparation Sommet Teranga Tech Dakar — Logistique & Accueil VIP',
      body: 'Merci de centraliser ici les besoins en signalétique, badges QR et traduction simultanée avant vendredi 16h.',
      authorId: 'int-u-2',
      authorName: 'Fatou Binetou Sarr',
      createdAt: '2026-11-16T15:20:00Z',
      replies: [
        {
          id: 'rep-1',
          authorId: 'int-u-3',
          authorName: 'Ibrahima Gueye',
          content: 'Le kit badges et l’accueil protocole sont validés pour 250 participants.',
          createdAt: '2026-11-16T16:40:00Z',
        },
      ],
    },
  ],
  learnerUsers: [
    {
      id: 'lrn-1',
      email: 'apprenant@teranga-demo.sn',
      name: 'Awa Diagne',
      companyName: 'Sonatel Business SA',
      jobTitle: 'Chef de Projet Transformation Digitale',
      passwordHash: simpleHash('demo-apprenant-2026'),
    },
    {
      id: 'lrn-2',
      email: 'k.ndiaye@senelec.sn',
      name: 'Khadim Ndiaye',
      companyName: 'Senelec Digital',
      jobTitle: 'Contrôleur de Gestion Senior',
      passwordHash: simpleHash('demo-apprenant-2026'),
    },
  ],
  learnerCourses: [
    {
      id: 'lc-1',
      learnerId: 'lrn-1',
      linkedCourseId: 'ic-1',
      title: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      category: 'Ingénierie Numérique',
      modality: 'EN_LIGNE',
      instructor: 'Ibrahima Diallo',
      companySponsor: 'Sonatel Business SA',
      startDate: '2026-11-04',
      scheduleInfo: '100% en ligne — Accès asynchrone illimité 24/7',
      durationHours: 42,
      lessons: [
        {
          id: 'les-101',
          title: 'Module 1 : Souveraineté des données et conformité UEMOA',
          format: 'VIDEO',
          durationMinutes: 45,
          summary: 'Cadre réglementaire CDP Sénégal, hébergement souverain et chiffrement.',
          completed: true,
        },
        {
          id: 'les-102',
          title: 'Module 2 : Architecture multi-organisations & isolation PostgreSQL',
          format: 'SUPPORT_PDF',
          durationMinutes: 60,
          summary: 'Bonnes pratiques d’isolation par tenant et gestion des sessions HttpOnly.',
          completed: true,
        },
        {
          id: 'les-103',
          title: 'Module 3 : Sécurisation des API & contrôle d’accès RBAC',
          format: 'ATELIER',
          durationMinutes: 90,
          summary: 'Atelier pratique sur les rôles Direction, Manager, Employé et Comptable.',
          completed: true,
        },
        {
          id: 'les-104',
          title: 'Module 4 : Évaluation finale & Audit de sécurité B2B',
          format: 'EVALUATION',
          durationMinutes: 40,
          summary: 'Validation des acquis pour obtenir l’attestation nominative.',
          completed: false,
        },
      ],
    },
    {
      id: 'lc-2',
      learnerId: 'lrn-1',
      linkedCourseId: 'ic-2',
      title: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      category: 'Finance & Conformité',
      modality: 'HYBRIDE',
      instructor: 'Ibrahima Diallo',
      companySponsor: 'Sonatel Business SA',
      startDate: '2026-10-14',
      scheduleInfo: 'Hybride — Modules e-learning + Atelier présentiel Dakar Plateau',
      durationHours: 35,
      lessons: [
        {
          id: 'les-201',
          title: 'Module 1 : Plan comptable SYSCOHADA & journaux auxiliaires',
          format: 'VIDEO',
          durationMinutes: 50,
          summary: 'Structure des classes 1 à 8 et paramétrage des journaux VE, AC, BQ.',
          completed: true,
        },
        {
          id: 'les-202',
          title: 'Module 2 : Rapprochements & écritures en partie double',
          format: 'ATELIER',
          durationMinutes: 75,
          summary: 'Session présentielle au Campus Teranga Plateau — Étude de cas entreprise.',
          completed: true,
        },
        {
          id: 'les-203',
          title: 'Module 3 : Clôture annuelle & états financiers certifiés',
          format: 'EVALUATION',
          durationMinutes: 45,
          summary: 'Contrôle final de conformité et validation du bilan.',
          completed: true,
        },
      ],
      certificate: {
        certificateNumber: 'CERT-TPD-2026-8412',
        issuedAt: '2026-11-12',
        mention: 'Très Bien — Formation B2B Hybride validée',
      },
    },
    {
      id: 'lc-3',
      learnerId: 'lrn-1',
      title: 'Direction Protocole & Scénographie Événementielle',
      category: 'Événementiel Corporate',
      modality: 'PRESENTIEL',
      instructor: 'M. Ousmane Kane',
      companySponsor: 'Sonatel Business SA',
      startDate: '2026-11-28',
      scheduleInfo: 'Présentiel — CICAD Diamniadio, Salle Prestige B2 (09h00 - 17h00)',
      durationHours: 28,
      lessons: [
        {
          id: 'les-301',
          title: 'Module 1 : Cahier des charges & préparation logistique',
          format: 'SUPPORT_PDF',
          durationMinutes: 40,
          summary: 'Pré-lecture préparatoire avant le séminaire en présentiel.',
          completed: true,
        },
        {
          id: 'les-302',
          title: 'Module 2 : Protocole officiel, accueil VIP & gestion de flux',
          format: 'ATELIER',
          durationMinutes: 180,
          summary: 'Mise en situation réelle en salle avec dispositif d’accréditation.',
          completed: false,
        },
        {
          id: 'les-303',
          title: 'Module 3 : Soutenance de cas pratique en présentiel',
          format: 'EVALUATION',
          durationMinutes: 60,
          summary: 'Évaluation devant jury pour délivrance du certificat.',
          completed: false,
        },
      ],
    },
    {
      id: 'lc-4',
      learnerId: 'lrn-2',
      linkedCourseId: 'ic-2',
      title: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      category: 'Finance & Conformité',
      modality: 'HYBRIDE',
      instructor: 'Ibrahima Diallo',
      companySponsor: 'Senelec Digital',
      startDate: '2026-10-18',
      scheduleInfo: 'Hybride — Visio + Campus Teranga Dakar Plateau',
      durationHours: 14,
      lessons: [
        {
          id: 'les-401',
          title: 'Module 1 : Référentiel SYSCOHADA & Journaux auxiliaires',
          format: 'VIDEO',
          durationMinutes: 55,
          summary: 'Paramétrage des classes 1 à 8 pour Senelec Digital.',
          completed: true,
        },
        {
          id: 'les-402',
          title: 'Module 2 : Étude de cas contrôle interne en présentiel',
          format: 'ATELIER',
          durationMinutes: 60,
          summary: 'Rapprochement bancaire et contrôle de cohérence bilan.',
          completed: false,
        },
      ],
    },
    {
      id: 'lc-5',
      learnerId: 'lrn-2',
      linkedCourseId: 'ic-4',
      title: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      category: 'Cybersécurité & Conformité',
      modality: 'EN_LIGNE',
      instructor: 'Ndeye Fatou Mbaye',
      companySponsor: 'Senelec Digital',
      startDate: '2026-11-15',
      scheduleInfo: '100% en ligne — Parcours certifiant individuel',
      durationHours: 12,
      lessons: [
        {
          id: 'les-501',
          title: 'Module 1 : Protection des données personnelles (Loi CDP)',
          format: 'VIDEO',
          durationMinutes: 40,
          summary: 'Obligations des responsables de traitement au Sénégal.',
          completed: true,
        },
        {
          id: 'les-502',
          title: 'Module 2 : Audit des accès et journaux de sécurité',
          format: 'EVALUATION',
          durationMinutes: 45,
          summary: 'Évaluation pratique finale pour délivrance du certificat.',
          completed: false,
        },
      ],
    },
  ],
  learnerCourseQuestions: [
    {
      id: 'lq-1',
      courseId: 'lc-1',
      lessonId: 'les-102',
      lessonTitle: 'Module 2 : Architecture multi-organisations & isolation PostgreSQL',
      authorId: 'lrn-1',
      authorName: 'Awa Diagne',
      title: 'Isolation des schémas multi-organisations UEMOA',
      body: 'Faut-il privilégier un Row-Level Security (RLS) PostgreSQL ou des bases séparées pour les filiales Sonatel Business ?',
      createdAt: '2026-11-12T10:20:00Z',
      instructorReply:
        'Pour vos 4 filiales B2B, le RLS couplé à des jetons de session signés par organisation offre le meilleur compromis conformité/maintenance.',
    },
    {
      id: 'lq-2',
      courseId: 'lc-1',
      lessonId: 'les-104',
      lessonTitle: 'Module 4 : Évaluation finale & Audit de sécurité B2B',
      authorId: 'lrn-1',
      authorName: 'Awa Diagne',
      title: 'Format de l’évaluation finale et seuil de certification',
      body: 'Quel est le seuil minimum requis sur l’audit final pour déclencher l’attestation nominative ?',
      createdAt: '2026-11-15T14:05:00Z',
      instructorReply:
        'Dès que vous validez 100% des modules du parcours, le certificat PDF nominatif est généré automatiquement.',
    },
  ],
  learnerLessonNotes: [
    {
      id: 'ln-1',
      courseId: 'lc-1',
      lessonId: 'les-101',
      learnerId: 'lrn-1',
      content: 'Point clé CDP Sénégal : documenter la finalité de traitement avant mise en production et activer le chiffrement TLS + au repos.',
      updatedAt: '2026-11-11T16:30:00Z',
    },
  ],
  instructorUsers: [
    {
      id: 'inst-1',
      email: 'formateur@teranga-demo.sn',
      name: 'Ibrahima Diallo',
      specialty: 'Formateur Principal Cloud, IA & Systèmes Souverains',
      city: 'Thiès / Dakar',
      avatarUrl: '/src/assets/images/avatar_instructor_ibrahima_1795100808153.jpg',
      passwordHash: simpleHash('demo-formateur-2026'),
    },
    {
      id: 'inst-2',
      email: 'n.mbaye@teranga-demo.sn',
      name: 'Ndeye Fatou Mbaye',
      specialty: 'Experte Cybersécurité & Audit SYSCOHADA',
      city: 'Dakar Plateau',
      avatarUrl: '/src/assets/images/avatar_instructor_ndeye_1795100808407.jpg',
      passwordHash: simpleHash('demo-formateur-2026'),
    },
  ],
  instructorCourses: [
    {
      id: 'ic-1',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      instructorAvatarUrl: '/src/assets/images/avatar_instructor_ibrahima_1795100808153.jpg',
      title: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      category: 'Formations & Masterclasses',
      pricingModel: 'ONE_TIME',
      priceFcfa: 45000,
      promoPriceFcfa: 65000,
      description:
        'Maîtrisez la conception d’infrastructures souveraines, la sécurité multi-organisations et l’intégration de workflows IA en entreprise.',
      level: 'INTERMEDIAIRE',
      estimatedDuration: '6h 30min',
      modality: 'EN_LIGNE',
      locationOrPlatform: 'Plateforme E-learning Teranga (Asynchrone 24/7)',
      nextSessionDate: '2026-11-24',
      trailerYoutubeUrl: 'https://youtube.com/watch?v=teranga-cloud-demo',
      promoBadge: 'Certifiant B2B',
      images: ['/src/assets/images/course_cloud_cyber_1794940322970.jpg'],
      status: 'PUBLISHED',
      enrolledCount: 42,
      completionRate: 84,
      rating: 4.9,
      createdAt: '2026-10-12T09:00:00Z',
      updatedAt: '2026-11-15T14:20:00Z',
      chapters: [
        {
          id: 'ch-101',
          title: 'Chapitre 1 : Fondamentaux du Cloud Souverain UEMOA',
          description: 'Cadre réglementaire CDP Sénégal, chiffrement des flux et isolation des tenants.',
          lessons: [
            {
              id: 'il-101',
              title: 'Introduction vidéo : Souveraineté numérique en Afrique de l’Ouest',
              type: 'VIDEO',
              durationMinutes: 28,
              resourceUrl: 'https://youtube.com/watch?v=souverainete-uemoa',
              isFreePreview: true,
            },
            {
              id: 'il-102',
              title: 'Guide d’architecture multi-tenant (Document PDF)',
              type: 'PDF',
              durationMinutes: 35,
              fileName: 'Architecture_MultiTenant_UEMOA_2026.pdf',
            },
            {
              id: 'il-103',
              title: 'Synthèse audio : Retour d’expérience DSI Dakar',
              type: 'AUDIO',
              durationMinutes: 18,
              fileName: 'Podcast_DSI_Cloud_Dakar.mp3',
            },
          ],
        },
        {
          id: 'ch-102',
          title: 'Chapitre 2 : Modèles de cahier des charges & Mise en production',
          description: 'Livrables Word prêts à l’emploi et checklist de déploiement.',
          lessons: [
            {
              id: 'il-104',
              title: 'Cahier des charges sécurité B2B (Modèle Word)',
              type: 'WORD',
              durationMinutes: 40,
              fileName: 'Modele_Cahier_Charges_Securite.docx',
            },
            {
              id: 'il-105',
              title: 'Fiche mémo : Politique de sauvegarde 3-2-1',
              type: 'TEXTE',
              durationMinutes: 15,
              textContent:
                'Règle 3-2-1 : conservez 3 copies de vos données critiques sur 2 supports distincts dont 1 copie chiffrée hors site dans un datacenter souverain.',
            },
          ],
        },
      ],
    },
    {
      id: 'ic-2',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      instructorAvatarUrl: '/src/assets/images/avatar_instructor_ibrahima_1795100808153.jpg',
      title: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      category: 'Finance & Conformité',
      pricingModel: 'B2B_LICENSE',
      priceFcfa: 185000,
      description:
        'Parcours hybride combinant capsules vidéo, modèles d’états financiers Word/PDF et ateliers pratiques en salle au Plateau.',
      level: 'AVANCE',
      estimatedDuration: '14h 00min',
      modality: 'HYBRIDE',
      locationOrPlatform: 'Visio Teams + Campus Teranga Dakar Plateau',
      nextSessionDate: '2026-12-02',
      promoBadge: 'Hybride Premium',
      images: ['/src/assets/images/course_syscohada_finance_1794940307275.jpg'],
      status: 'PUBLISHED',
      enrolledCount: 24,
      completionRate: 91,
      rating: 4.8,
      createdAt: '2026-10-28T11:30:00Z',
      updatedAt: '2026-11-16T08:45:00Z',
      chapters: [
        {
          id: 'ch-201',
          title: 'Chapitre 1 : Référentiel SYSCOHADA & Journaux auxiliaires',
          description: 'Paramétrage des comptes classes 1 à 8 et automatisation TVA.',
          lessons: [
            {
              id: 'il-201',
              title: 'Cours magistral vidéo : Clôture fiscale annuelle',
              type: 'VIDEO',
              durationMinutes: 55,
              resourceUrl: 'https://youtube.com/watch?v=syscohada-cloture',
              isFreePreview: true,
            },
            {
              id: 'il-202',
              title: 'Liasse fiscale et notes annexes (Document Word)',
              type: 'WORD',
              durationMinutes: 45,
              fileName: 'Liasse_Fiscale_SYSCOHADA_2026.docx',
            },
          ],
        },
        {
          id: 'ch-202',
          title: 'Chapitre 2 : Étude de cas en présentiel',
          description: 'Rapprochement bancaire et contrôle de cohérence bilan.',
          lessons: [
            {
              id: 'il-203',
              title: 'Support d’exercice corrigé (PDF)',
              type: 'PDF',
              durationMinutes: 60,
              fileName: 'Etude_Cas_Audit_SYSCOHADA.pdf',
            },
          ],
        },
      ],
    },
    {
      id: 'ic-3',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      instructorAvatarUrl: '/src/assets/images/avatar_instructor_ibrahima_1795100808153.jpg',
      title: 'Direction Protocole & Scénographie de Sommets',
      category: 'Événementiel Corporate',
      pricingModel: 'ONE_TIME',
      priceFcfa: 240000,
      description:
        'Formation intensive 100% présentielle au CICAD Diamniadio dédiée aux directions communication et protocolaires.',
      level: 'TOUS_NIVEAUX',
      estimatedDuration: '21h 00min',
      modality: 'PRESENTIEL',
      locationOrPlatform: 'CICAD Diamniadio — Salle Prestige B2',
      nextSessionDate: '2026-12-15',
      images: ['/src/assets/images/course_events_protocol_1794940323026.jpg'],
      status: 'DRAFT',
      enrolledCount: 16,
      completionRate: 0,
      rating: 5.0,
      createdAt: '2026-11-10T16:00:00Z',
      updatedAt: '2026-11-17T07:10:00Z',
      chapters: [
        {
          id: 'ch-301',
          title: 'Chapitre 1 : Accueil VIP, protocole diplomatique & sécurité',
          description: 'Conduite de cérémonies officielles et gestion de flux.',
          lessons: [
            {
              id: 'il-301',
              title: 'Manuel de protocole officiel (PDF)',
              type: 'PDF',
              durationMinutes: 50,
              fileName: 'Manuel_Protocole_VIP_CICAD.pdf',
            },
            {
              id: 'il-302',
              title: 'Briefing vocal terrain : Coordination régie & sécurité',
              type: 'AUDIO',
              durationMinutes: 22,
              fileName: 'Briefing_Regie_Sommet.mp3',
            },
            {
              id: 'il-303',
              title: 'Checklist jour J & plan de salle',
              type: 'TEXTE',
              durationMinutes: 20,
              textContent:
                'Vérifier les badges QR accrédités H-3, tester les cabines d’interprétation simultanée et valider l’ordre de prise de parole avec le cabinet.',
            },
          ],
        },
      ],
    },
    {
      id: 'ic-4',
      instructorId: 'inst-2',
      instructorName: 'Ndeye Fatou Mbaye',
      instructorAvatarUrl: '/src/assets/images/avatar_instructor_ndeye_1795100808407.jpg',
      title: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      category: 'Cybersécurité & Conformité',
      pricingModel: 'B2B_LICENSE',
      priceFcfa: 195000,
      description:
        'Audit sécurité des systèmes d’information, conformité légale CDP et réponse aux incidents pour entreprises sénégalaises.',
      level: 'INTERMEDIAIRE',
      estimatedDuration: '12h 00min',
      modality: 'EN_LIGNE',
      locationOrPlatform: 'Plateforme E-learning Teranga (Asynchrone)',
      nextSessionDate: '2026-12-08',
      promoBadge: 'Conformité CDP',
      images: ['/src/assets/images/course_cloud_cyber_1794940322970.jpg'],
      status: 'PUBLISHED',
      enrolledCount: 19,
      completionRate: 78,
      rating: 4.9,
      createdAt: '2026-11-01T09:00:00Z',
      updatedAt: '2026-11-16T11:00:00Z',
      chapters: [
        {
          id: 'ch-401',
          title: 'Chapitre 1 : Cadre réglementaire CDP & Protection des données',
          description: 'Obligations des responsables de traitement au Sénégal.',
          lessons: [
            {
              id: 'il-401',
              title: 'Protection des données personnelles (Loi CDP)',
              type: 'VIDEO',
              durationMinutes: 40,
              isFreePreview: true,
            },
            {
              id: 'il-402',
              title: 'Grille d’audit des accès & journaux de sécurité',
              type: 'PDF',
              durationMinutes: 45,
              fileName: 'Grille_Audit_CDP_2026.pdf',
            },
          ],
        },
      ],
    },
  ],
  instructorEnrollments: [
    {
      id: 'enr-1',
      courseId: 'ic-1',
      courseTitle: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      learnerId: 'lrn-1',
      learnerName: 'Awa Diagne',
      companyName: 'Sonatel Business SA',
      modality: 'EN_LIGNE',
      progressPct: 75,
      attendanceStatus: 'EN_LIGNE_ACTIF',
      enrolledAt: '2026-11-04',
    },
    {
      id: 'enr-2',
      courseId: 'ic-2',
      courseTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      learnerId: 'lrn-1',
      learnerName: 'Awa Diagne',
      companyName: 'Sonatel Business SA',
      modality: 'HYBRIDE',
      progressPct: 100,
      attendanceStatus: 'CERTIFIE',
      enrolledAt: '2026-10-14',
    },
    {
      id: 'enr-3',
      courseId: 'ic-2',
      courseTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      learnerId: 'lrn-2',
      learnerName: 'Khadim Ndiaye',
      companyName: 'Senelec Digital',
      modality: 'HYBRIDE',
      progressPct: 50,
      attendanceStatus: 'PRESENT',
      enrolledAt: '2026-10-18',
    },
    {
      id: 'enr-4',
      courseId: 'ic-3',
      courseTitle: 'Direction Protocole & Scénographie de Sommets',
      learnerName: 'Mariama Ba',
      companyName: 'Port Autonome de Dakar',
      modality: 'PRESENTIEL',
      progressPct: 35,
      attendanceStatus: 'PRESENT',
      enrolledAt: '2026-11-11',
    },
    {
      id: 'enr-5',
      courseId: 'ic-4',
      courseTitle: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      learnerId: 'lrn-2',
      learnerName: 'Khadim Ndiaye',
      companyName: 'Senelec Digital',
      modality: 'EN_LIGNE',
      progressPct: 50,
      attendanceStatus: 'EN_LIGNE_ACTIF',
      enrolledAt: '2026-11-15',
    },
  ],
  courseOrganizationSessions: [
    {
      id: 'cs-1',
      courseId: 'ic-1',
      courseTitle: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      cohortName: 'Cohorte Novembre — Sonatel & Secteur Public',
      chapterId: 'ch-101',
      chapterTitle: 'Chapitre 1 : Infrastructures souveraines & zéro-trust',
      modality: 'EN_LIGNE',
      sessionDate: '2026-11-24',
      startTime: '09:00',
      endTime: '12:30',
      locationOrLink: 'Visio Teranga Meet — Salle #CLOUD-01',
      maxSeats: 25,
      enrolledCount: 18,
      status: 'CONFIRMEE',
      notes: 'Vérifier l’activation des comptes sandbox avant 08h45.',
      checklist: [
        { id: 'chk-1', label: 'Supports PDF & modèles Word déposés', done: true },
        { id: 'chk-2', label: 'Lien visioconférence testé & envoyé', done: true },
        { id: 'chk-3', label: 'Feuille d’émargement numérique générée', done: false },
      ],
      createdAt: '2026-11-10T09:00:00Z',
      updatedAt: '2026-11-18T11:00:00Z',
    },
    {
      id: 'cs-2',
      courseId: 'ic-2',
      courseTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      cohortName: 'Cohorte Direction Financière — Senelec & DAGE',
      chapterId: 'ch-201',
      chapterTitle: 'Chapitre 1 : Référentiel SYSCOHADA & Journaux auxiliaires',
      modality: 'HYBRIDE',
      sessionDate: '2026-12-02',
      startTime: '09:30',
      endTime: '16:30',
      locationOrLink: 'Campus Teranga Dakar Plateau (Salle 3) + Teams',
      maxSeats: 30,
      enrolledCount: 24,
      status: 'CONFIRMEE',
      linkedRequestId: 'tr-req-4',
      notes: 'Atelier liasses fiscales prévu l’après-midi.',
      checklist: [
        { id: 'chk-4', label: 'Liasse fiscale SYSCOHADA 2026 prête', done: true },
        { id: 'chk-5', label: 'Salle Plateau & vidéoprojecteur réservés', done: true },
        { id: 'chk-6', label: 'Pause-café & badges apprenants confirmés', done: true },
      ],
      createdAt: '2026-11-12T14:00:00Z',
      updatedAt: '2026-11-18T16:20:00Z',
    },
    {
      id: 'cs-3',
      courseId: 'ic-2',
      courseTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      cohortName: 'Cohorte Direction Financière — Senelec & DAGE',
      chapterId: 'ch-202',
      chapterTitle: 'Chapitre 2 : Étude de cas en présentiel',
      modality: 'PRESENTIEL',
      sessionDate: '2026-12-09',
      startTime: '09:00',
      endTime: '13:00',
      locationOrLink: 'Campus Teranga Dakar Plateau — Salle Conseil',
      maxSeats: 30,
      enrolledCount: 24,
      status: 'PLANIFIEE',
      checklist: [
        { id: 'chk-7', label: 'Dossiers d’audit imprimés (30 ex.)', done: false },
        { id: 'chk-8', label: 'Évaluation finale & certificats préparés', done: false },
      ],
      createdAt: '2026-11-12T14:05:00Z',
      updatedAt: '2026-11-12T14:05:00Z',
    },
    {
      id: 'cs-4',
      courseId: 'ic-3',
      courseTitle: 'Direction Protocole & Scénographie de Sommets',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      cohortName: 'Séminaire Intensif Protocole CICAD',
      chapterId: 'ch-301',
      chapterTitle: 'Chapitre 1 : Accueil VIP, protocole diplomatique & sécurité',
      modality: 'PRESENTIEL',
      sessionDate: '2026-12-15',
      startTime: '08:30',
      endTime: '17:00',
      locationOrLink: 'CICAD Diamniadio — Salle Prestige B2',
      maxSeats: 20,
      enrolledCount: 16,
      status: 'PLANIFIEE',
      checklist: [
        { id: 'chk-9', label: 'Validation dispositif sécurité CICAD', done: true },
        { id: 'chk-10', label: 'Supports audio terrain vérifiés', done: true },
      ],
      createdAt: '2026-11-14T10:00:00Z',
      updatedAt: '2026-11-17T08:00:00Z',
    },
    {
      id: 'cs-5',
      courseId: 'ic-4',
      courseTitle: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      instructorId: 'inst-2',
      instructorName: 'Ndeye Fatou Mbaye',
      cohortName: 'Session Audit Conformité CDP',
      chapterId: 'ch-401',
      chapterTitle: 'Chapitre 1 : Cadre réglementaire CDP & Protection des données',
      modality: 'EN_LIGNE',
      sessionDate: '2026-12-08',
      startTime: '10:00',
      endTime: '13:00',
      locationOrLink: 'Plateforme E-learning Teranga',
      maxSeats: 25,
      enrolledCount: 19,
      status: 'CONFIRMEE',
      checklist: [
        { id: 'chk-11', label: 'Grille d’audit CDP 2026 publiée', done: true },
      ],
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-17T10:00:00Z',
    },
  ],
  trainingRequests: [
    {
      id: 'tr-req-1',
      reference: 'DEM-FRM-2026-041',
      title: 'Formation intra-entreprise Cloud Souverain & PRA',
      category: 'Cloud, IA & Systèmes',
      courseId: 'ic-1',
      courseTitle: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      requesterUserId: 'int-u-2',
      requesterName: 'Fatou Binetou Sarr',
      requesterEmail: 'manager@teranga-demo.sn',
      requesterSpace: 'intranet',
      organizationName: 'Teranga Prestige — Intranet',
      modality: 'HYBRIDE',
      participantsCount: 14,
      desiredStartDate: '2026-12-10',
      durationHours: 21,
      locationOrCity: 'Dakar Plateau + Visio',
      objectives: 'Monter en compétence l’équipe infrastructure sur le plan de reprise d’activité souverain et la sécurité zéro-trust.',
      budgetEstimatedFcfa: 1850000,
      priority: 'HAUTE',
      stage: 'NOUVELLE_DEMANDE',
      messages: [
        {
          id: 'trm-1',
          senderId: 'int-u-2',
          senderName: 'Fatou Binetou Sarr',
          senderRole: 'Responsable Événementiel & Formation',
          content: 'Bonjour Ibrahima, nous souhaitons organiser cette cohorte pour 14 ingénieurs à partir du 10 décembre.',
          createdAt: '2026-11-18T10:15:00Z',
        },
      ],
      history: [
        {
          id: 'trh-1',
          actorName: 'Fatou Binetou Sarr',
          action: 'Demande de formation créée et transmise au formateur',
          stage: 'NOUVELLE_DEMANDE',
          timestamp: '2026-11-18T10:15:00Z',
        },
      ],
      createdAt: '2026-11-18T10:15:00Z',
      updatedAt: '2026-11-18T10:15:00Z',
    },
    {
      id: 'tr-req-2',
      reference: 'DEM-FRM-2026-040',
      title: 'Atelier sur mesure Passation des Marchés & Contrôle DAGE',
      category: 'Gouvernance & Secteur Public',
      instructorId: undefined,
      instructorName: undefined,
      requesterUserId: 'int-u-1',
      requesterName: 'Cheikh Tidiane Fall',
      requesterEmail: 'direction@teranga-demo.sn',
      requesterSpace: 'intranet',
      organizationName: 'Ministère Partenaire — Cellule DAGE',
      modality: 'PRESENTIEL',
      participantsCount: 22,
      desiredStartDate: '2026-12-18',
      durationHours: 14,
      locationOrCity: 'Diamniadio — Sphères Ministérielles',
      objectives: 'Former 22 agents DAGE sur les procédures dématérialisées de passation, suivi des engagements et justification.',
      budgetEstimatedFcfa: 2400000,
      priority: 'URGENTE',
      stage: 'NOUVELLE_DEMANDE',
      messages: [
        {
          id: 'trm-2',
          senderId: 'int-u-1',
          senderName: 'Cheikh Tidiane Fall',
          senderRole: 'Directeur Général',
          content: 'Demande ouverte à prise en charge par un formateur senior disponible mi-décembre.',
          createdAt: '2026-11-18T14:30:00Z',
        },
      ],
      history: [
        {
          id: 'trh-2',
          actorName: 'Cheikh Tidiane Fall',
          action: 'Demande ouverte publiée dans le flux global',
          stage: 'NOUVELLE_DEMANDE',
          timestamp: '2026-11-18T14:30:00Z',
        },
      ],
      createdAt: '2026-11-18T14:30:00Z',
      updatedAt: '2026-11-18T14:30:00Z',
    },
    {
      id: 'tr-req-3',
      reference: 'DEM-FRM-2026-039',
      title: 'Parcours Protocole & Cérémonial Officiel — Sommet Dakar',
      category: 'Événementiel Corporate',
      courseId: 'ic-3',
      courseTitle: 'Direction Protocole & Scénographie de Sommets',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      requesterUserId: 'int-u-1',
      requesterName: 'Cheikh Tidiane Fall',
      requesterEmail: 'direction@teranga-demo.sn',
      requesterSpace: 'intranet',
      organizationName: 'Port Autonome de Dakar',
      modality: 'PRESENTIEL',
      participantsCount: 16,
      desiredStartDate: '2026-12-15',
      durationHours: 21,
      locationOrCity: 'CICAD Diamniadio',
      objectives: 'Préparer les équipes protocolaires avant les sommets institutionnels du T1 2027.',
      budgetEstimatedFcfa: 2100000,
      quotedAmountFcfa: 1980000,
      quoteNumber: 'DEV-FRM-2026-039',
      priority: 'HAUTE',
      stage: 'DEVIS_ENVOYE',
      messages: [
        {
          id: 'trm-3',
          senderId: 'inst-1',
          senderName: 'Ibrahima Diallo',
          senderRole: 'Formateur Principal',
          content: 'Devis DEV-FRM-2026-039 transmis incluant les supports terrain et la visite technique CICAD.',
          createdAt: '2026-11-17T16:10:00Z',
        },
      ],
      history: [
        {
          id: 'trh-3a',
          actorName: 'Cheikh Tidiane Fall',
          action: 'Demande soumise',
          stage: 'NOUVELLE_DEMANDE',
          timestamp: '2026-11-16T09:00:00Z',
        },
        {
          id: 'trh-3b',
          actorName: 'Ibrahima Diallo',
          action: 'Devis DEV-FRM-2026-039 émis (1 980 000 FCFA)',
          stage: 'DEVIS_ENVOYE',
          timestamp: '2026-11-17T16:10:00Z',
        },
      ],
      createdAt: '2026-11-16T09:00:00Z',
      updatedAt: '2026-11-17T16:10:00Z',
    },
    {
      id: 'tr-req-4',
      reference: 'DEM-FRM-2026-038',
      title: 'Mise en conformité SYSCOHADA Révisé — Équipe Comptable',
      category: 'Finance & Conformité',
      courseId: 'ic-2',
      courseTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      instructorId: 'inst-1',
      instructorName: 'Ibrahima Diallo',
      requesterUserId: 'acc-u-1',
      requesterName: 'Aminata Diallo',
      requesterEmail: 'comptabilite@teranga-demo.sn',
      requesterSpace: 'accounting',
      organizationName: 'Senelec Digital',
      modality: 'HYBRIDE',
      participantsCount: 12,
      desiredStartDate: '2026-12-02',
      durationHours: 14,
      locationOrCity: 'Dakar Plateau',
      objectives: 'Maîtriser les liasses fiscales et écritures d’inventaire SYSCOHADA révisé.',
      budgetEstimatedFcfa: 1650000,
      quotedAmountFcfa: 1580000,
      quoteNumber: 'DEV-FRM-2026-038',
      conventionNumber: 'CONV-FRM-2026-038',
      priority: 'NORMALE',
      stage: 'VALIDEE_PLANIFIEE',
      scheduledSessionId: 'cs-2',
      messages: [
        {
          id: 'trm-4',
          senderId: 'inst-1',
          senderName: 'Ibrahima Diallo',
          senderRole: 'Formateur Principal',
          content: 'Session planifiée au 02 décembre sur le Campus Plateau et Teams.',
          createdAt: '2026-11-15T11:20:00Z',
        },
      ],
      history: [
        {
          id: 'trh-4a',
          actorName: 'Aminata Diallo',
          action: 'Bon pour accord et convention validée',
          stage: 'VALIDEE_PLANIFIEE',
          timestamp: '2026-11-15T11:20:00Z',
        },
      ],
      createdAt: '2026-11-12T09:00:00Z',
      updatedAt: '2026-11-15T11:20:00Z',
    },
    {
      id: 'tr-req-5',
      reference: 'DEM-FRM-2026-037',
      title: 'Audit CDP & Sensibilisation Données Personnelles',
      category: 'Cybersécurité & Conformité',
      courseId: 'ic-4',
      courseTitle: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      instructorId: 'inst-2',
      instructorName: 'Ndeye Fatou Mbaye',
      requesterUserId: 'lrn-2',
      requesterName: 'Khadim Ndiaye',
      requesterEmail: 'khadim.ndiaye@senelec-demo.sn',
      requesterSpace: 'learner',
      organizationName: 'Senelec Digital',
      modality: 'EN_LIGNE',
      participantsCount: 19,
      desiredStartDate: '2026-12-08',
      durationHours: 12,
      locationOrCity: 'En ligne (Synchrone)',
      objectives: 'Préparer les correspondants informatiques à la conformité CDP.',
      budgetEstimatedFcfa: 1450000,
      quotedAmountFcfa: 1450000,
      quoteNumber: 'DEV-FRM-2026-037',
      conventionNumber: 'CONV-FRM-2026-037',
      priority: 'NORMALE',
      stage: 'EN_COURS',
      scheduledSessionId: 'cs-5',
      messages: [],
      history: [
        {
          id: 'trh-5',
          actorName: 'Ndeye Fatou Mbaye',
          action: 'Cohorte démarrée en ligne',
          stage: 'EN_COURS',
          timestamp: '2026-11-16T08:30:00Z',
        },
      ],
      createdAt: '2026-11-10T08:00:00Z',
      updatedAt: '2026-11-16T08:30:00Z',
    },
  ],
  providerUsers: [
    {
      id: 'prov-1',
      email: 'prestataire@teranga-demo.sn',
      name: 'Serigne Ba',
      companyName: 'Teranex Connect Événementiel',
      roleTitle: 'Coordinateur Logistique & Prestataire Prestige',
      city: 'Dakar Plateau',
      avatarUrl: '/src/assets/images/avatar_provider_serigne_1795100808386.jpg',
      companyLogoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
      passwordHash: simpleHash('demo-prestataire-2026'),
    },
    {
      id: 'prov-2',
      email: 'traiteur@teranga-demo.sn',
      name: 'Khady Ndiaye',
      companyName: 'Saveurs de la Teranga Traiteur',
      roleTitle: 'Cheffe Traiteur & Réceptions B2B',
      city: 'Almadies, Dakar',
      avatarUrl: '/src/assets/images/avatar_provider_khady_1795100811591.jpg',
      companyLogoUrl: '/src/assets/images/logo_company_saveurs_1795100811359.jpg',
      passwordHash: simpleHash('demo-prestataire-2026'),
    },
  ],
  providerOffers: [
    {
      id: 'po-1',
      providerId: 'prov-1',
      providerName: 'Serigne Ba',
      providerAvatarUrl: '/src/assets/images/avatar_provider_serigne_1795100808386.jpg',
      companyName: 'Teranex Connect Événementiel',
      companyLogoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
      title: 'Sonorisation complète, Régie & Animation DJ pour Gala / Conférence',
      category: 'Animateur & DJ',
      priceFcfa: 250000,
      referencePriceFcfa: 320000,
      description:
        'Prestation audiovisuelle complète avec sonorisation Line Array, jeux de lumières architecturaux, micros HF et animation DJ / Maître de cérémonie.',
      locationZone: 'Dakar, Diamniadio, Thiès, Saly',
      capacityGuests: 300,
      includedServices: [
        {
          id: 'ps-101',
          name: 'Installation son et lumière complète',
          details: 'Enceintes haute puissance, 4 micros sans fil Shure, 12 projecteurs LED DMX.',
        },
        {
          id: 'ps-102',
          name: 'Animation DJ & Maître de cérémonie (6 heures)',
          details: 'Playlist corporate sur mesure, transitions protocolaires et soirée dansante.',
        },
      ],
      images: ['/src/assets/images/service_dj_sonorisation_1794941483737.jpg'],
      status: 'PUBLISHED',
      requestsCount: 3,
      createdAt: '2026-10-15T10:00:00Z',
      updatedAt: '2026-11-15T12:00:00Z',
    },
    {
      id: 'po-2',
      providerId: 'prov-1',
      providerName: 'Serigne Ba',
      providerAvatarUrl: '/src/assets/images/avatar_provider_serigne_1795100808386.jpg',
      companyName: 'Teranex Connect Événementiel',
      companyLogoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
      title: 'Traiteur Prestige — Cocktail Dînatoire & Banquet Corporate',
      category: 'Traiteur & Gastronomie',
      priceFcfa: 850000,
      referencePriceFcfa: 980000,
      description:
        'Service traiteur gastronomique clé en main pour galas, sommets institutionnels, séminaires et réceptions privées avec brigade dédiée.',
      locationZone: 'Dakar Plateau, Almadies, CICAD Diamniadio',
      capacityGuests: 200,
      includedServices: [
        {
          id: 'ps-201',
          name: 'Menu Cocktail 18 pièces + Dîner chaud (3 plats)',
          details: 'Spécialités sénégalaises revisitées et gastronomie internationale halal.',
        },
        {
          id: 'ps-202',
          name: 'Brigade de service & Arts de la table',
          details: '10 maîtres d’hôtel, nappage lin, vaisselle porcelaine et verrerie cristal.',
        },
      ],
      images: ['/src/assets/images/service_traiteur_gala_1794941483603.jpg'],
      status: 'PUBLISHED',
      requestsCount: 2,
      createdAt: '2026-10-22T09:30:00Z',
      updatedAt: '2026-11-16T15:10:00Z',
    },
    {
      id: 'po-3',
      providerId: 'prov-1',
      providerName: 'Serigne Ba',
      providerAvatarUrl: '/src/assets/images/avatar_provider_serigne_1795100808386.jpg',
      companyName: 'Teranex Connect Événementiel',
      companyLogoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
      title: 'Scénographie Scénique, Écran LED & Mobilier VIP',
      category: 'Décoration & Scénographie',
      priceFcfa: 1250000,
      description:
        'Conception de scène sur mesure avec mur LED P2.6, pupitre protocolaire, salons VIP et signalétique lumineuse pour forums et congrès.',
      locationZone: 'Tout le Sénégal (Dakar, Saly, Saint-Louis)',
      capacityGuests: 500,
      includedServices: [
        {
          id: 'ps-301',
          name: 'Mur écran LED 6m x 3m + Régie vidéo',
          details: 'Diffusion HD, habillage dynamique aux couleurs de l’événement.',
        },
      ],
      images: ['/src/assets/images/service_decor_scenographie_1794941483444.jpg'],
      status: 'DRAFT',
      requestsCount: 1,
      createdAt: '2026-11-08T14:00:00Z',
      updatedAt: '2026-11-17T08:00:00Z',
    },
    {
      id: 'po-4',
      providerId: 'prov-2',
      providerName: 'Khady Ndiaye',
      providerAvatarUrl: '/src/assets/images/avatar_provider_khady_1795100811591.jpg',
      companyName: 'Saveurs de la Teranga Traiteur',
      companyLogoUrl: '/src/assets/images/logo_company_saveurs_1795100811359.jpg',
      title: 'Banquet Teranga & Service Traiteur Gastronomique VIP',
      category: 'Traiteur & Gastronomie',
      priceFcfa: 920000,
      referencePriceFcfa: 1100000,
      description:
        'Cuisine gastronomique sénégalaise et internationale pour sommets diplomatiques, conseils d’administration et galas prestigieux.',
      locationZone: 'Almadies, Dakar Plateau, Diamniadio',
      capacityGuests: 250,
      includedServices: [
        {
          id: 'ps-401',
          name: 'Menu Gastronomique 4 temps & Cocktail Teranga',
          details: 'Produits frais locaux, options végétariennes et service à l’assiette.',
        },
      ],
      images: ['/src/assets/images/service_traiteur_gala_1794941483603.jpg'],
      status: 'PUBLISHED',
      requestsCount: 1,
      createdAt: '2026-11-02T09:00:00Z',
      updatedAt: '2026-11-16T10:30:00Z',
    },
  ],
  providerRequests: [
    {
      id: 'req-1',
      providerId: 'prov-1',
      requesterUserId: 'int-u-2',
      requesterOrgId: 'tpd-demo-intranet',
      offerId: 'po-2',
      offerTitle: 'Traiteur Prestige — Cocktail Dînatoire & Banquet Corporate',
      category: 'Traiteur & Gastronomie',
      clientName: 'Mme Marième Sène',
      clientCompany: 'Consortium Bancaire UEMOA',
      clientEmail: 'm.sene@consortium-uemoa.sn',
      eventType: 'Dîner de Gala Annuel',
      eventDate: '2026-12-18',
      eventLocation: 'King Fahd Palace, Almadies',
      guestCount: 240,
      notes: 'Cocktail d’accueil à 19h30 suivi d’un dîner assis pour 240 convives VIP.',
      stage: 'NOUVELLE_DEMANDE',
      amountFcfa: 1150000,
      createdAt: '2026-11-17T08:30:00Z',
      updatedAt: '2026-11-17T08:30:00Z',
    },
    {
      id: 'req-2',
      providerId: 'prov-1',
      requesterUserId: 'int-u-1',
      requesterOrgId: 'tpd-demo-intranet',
      offerId: 'po-1',
      offerTitle: 'Sonorisation complète, Régie & Animation DJ pour Gala / Conférence',
      category: 'Animateur & DJ',
      clientName: 'M. Abdoulaye Ndiaye',
      clientCompany: 'Sonatel Business SA',
      clientEmail: 'a.ndiaye@sonatel.sn',
      eventType: 'Séminaire Innovation & Soirée Collaborateurs',
      eventDate: '2026-12-05',
      eventLocation: 'Radisson Blu Sea Plaza, Dakar',
      guestCount: 180,
      notes: 'Besoin de 4 micros HF pour la table ronde le matin + DJ Set de 20h à 01h.',
      stage: 'DEVIS_ENVOYE',
      quoteNumber: 'DEV-PRV-2026-019',
      amountFcfa: 295000,
      createdAt: '2026-11-14T10:15:00Z',
      updatedAt: '2026-11-15T16:40:00Z',
    },
    {
      id: 'req-3',
      providerId: 'prov-1',
      requesterUserId: 'int-u-2',
      requesterOrgId: 'tpd-demo-intranet',
      offerId: 'po-1',
      offerTitle: 'Sonorisation complète, Régie & Animation DJ pour Gala / Conférence',
      category: 'Animateur & DJ',
      clientName: 'Mme Coumba Fall',
      clientCompany: 'Port Autonome de Dakar',
      clientEmail: 'c.fall@portdakar.sn',
      eventType: 'Forum Maritime International',
      eventDate: '2026-11-29',
      eventLocation: 'CICAD Diamniadio',
      guestCount: 300,
      notes: 'Installation requise la veille à 16h pour balance son avec les intervenants.',
      stage: 'COMMANDE_CONFIRMEE',
      quoteNumber: 'DEV-PRV-2026-014',
      orderNumber: 'CMD-PRV-2026-008',
      amountFcfa: 350000,
      createdAt: '2026-11-05T09:00:00Z',
      updatedAt: '2026-11-12T11:20:00Z',
    },
    {
      id: 'req-4',
      providerId: 'prov-1',
      requesterUserId: 'int-u-1',
      requesterOrgId: 'tpd-demo-intranet',
      offerId: 'po-2',
      offerTitle: 'Traiteur Prestige — Cocktail Dînatoire & Banquet Corporate',
      category: 'Traiteur & Gastronomie',
      clientName: 'M. Cheikh Diop',
      clientCompany: 'Senelec Digital',
      clientEmail: 'c.diop@senelec.sn',
      eventType: 'Lancement Programme Cloud Souverain',
      eventDate: '2026-11-10',
      eventLocation: 'Dakar Plateau — Siège Senelec',
      guestCount: 120,
      notes: 'Pause-café prestige et déjeuner buffet exécutif.',
      stage: 'FACTURE_EMISE',
      quoteNumber: 'DEV-PRV-2026-009',
      orderNumber: 'CMD-PRV-2026-005',
      invoiceNumber: 'FAC-PRV-2026-012',
      amountFcfa: 680000,
      createdAt: '2026-10-28T14:00:00Z',
      updatedAt: '2026-11-11T09:45:00Z',
    },
    {
      id: 'req-5',
      providerId: 'prov-2',
      requesterUserId: 'int-u-2',
      requesterOrgId: 'tpd-demo-intranet',
      offerId: 'po-4',
      offerTitle: 'Banquet Teranga & Service Traiteur Gastronomique VIP',
      category: 'Traiteur & Gastronomie',
      clientName: 'Fatou Binetou Sarr',
      clientCompany: 'Teranga Prestige Événementiel',
      clientEmail: 'manager@teranga-demo.sn',
      eventType: 'Forum Économique Souverain de Diamniadio',
      eventDate: '2026-12-04',
      eventLocation: 'CICAD Diamniadio',
      guestCount: 220,
      notes: 'Déjeuner officiel pour 220 délégations et pause VIP.',
      stage: 'NOUVELLE_DEMANDE',
      amountFcfa: 920000,
      createdAt: '2026-11-17T10:15:00Z',
      updatedAt: '2026-11-17T10:15:00Z',
    },
  ],
  crmContacts: [
    // Direction (int-u-1 — Cheikh Tidiane Fall)
    {
      id: 'c-dir-1',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      type: 'CLIENT',
      name: 'Sonatel Business SA',
      email: 'achats@sonatel.sn',
      phone: '+221 77 839 10 00',
      ninea: '004218765 2G3',
      address: 'Cité Keur Gorgui, Dakar',
      sector: 'Télécommunications',
      whatsappOptIn: true,
      pipelineStage: 'GAGNE',
      lastContactAt: '2026-11-15',
      nextFollowUpDate: '2026-11-22',
    },
    {
      id: 'c-dir-2',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      type: 'PROSPECT',
      name: 'CBAO Groupe Attijariwafa Bank',
      email: 'evenements@cbao.sn',
      phone: '+221 78 410 33 21',
      ninea: '000451290 2A8',
      address: 'Place de l’Indépendance, Dakar',
      sector: 'Banque & Finance',
      whatsappOptIn: true,
      pipelineStage: 'PROPOSITION',
      lastContactAt: '2026-11-16',
      nextFollowUpDate: '2026-11-21',
    },
    {
      id: 'c-dir-3',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      type: 'PROSPECT',
      name: 'Port Autonome de Dakar — Pôle Formation',
      email: 'drh.formation@portdakar.sn',
      phone: '+221 77 612 45 90',
      ninea: '000018412 1E1',
      address: 'Boulevard de la Libération, Dakar',
      sector: 'Logistique & Maritime',
      whatsappOptIn: true,
      pipelineStage: 'QUALIFIE',
      lastContactAt: '2026-11-14',
      nextFollowUpDate: '2026-11-20',
    },
    {
      id: 'c-dir-4',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      type: 'SUPPLIER',
      name: 'Dakar Audio & Scénographie SARL',
      email: 'contact@dakaraudio.sn',
      phone: '+221 77 540 22 10',
      ninea: '007912340 1A2',
      address: 'Zone Industrielle Sodida, Dakar',
      sector: 'Sonorisation & Événementiel',
      whatsappOptIn: false,
    },
    // Manager (int-u-2 — Fatou Binetou Sarr) — strictement séparé de int-u-1
    {
      id: 'c-mgr-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      type: 'CLIENT',
      name: 'Consortium Bancaire UEMOA',
      email: 'm.sene@consortium-uemoa.sn',
      phone: '+221 77 330 88 12',
      ninea: '008114920 2D1',
      address: 'Plateau, Dakar',
      sector: 'Finance Régionale',
      whatsappOptIn: true,
      pipelineStage: 'GAGNE',
      lastContactAt: '2026-11-16',
      nextFollowUpDate: '2026-11-23',
    },
    {
      id: 'c-mgr-2',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      type: 'PROSPECT',
      name: 'Ministère de l’Économie Numérique',
      email: 'protocole@numerique.gouv.sn',
      phone: '+221 77 512 09 44',
      ninea: '000001200 1A1',
      address: 'Sphère Ministérielle Diamniadio',
      sector: 'Secteur Public',
      whatsappOptIn: true,
      pipelineStage: 'QUALIFIE',
      lastContactAt: '2026-11-15',
      nextFollowUpDate: '2026-11-19',
    },
  ],
  crmDocuments: [
    {
      id: 'doc-dir-1',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      kind: 'CUSTOMER_INVOICE',
      number: 'FAC-2026-001',
      date: '2026-11-10',
      contactId: 'c-dir-1',
      contactName: 'Sonatel Business SA',
      status: 'PARTIAL',
      lines: [
        {
          id: 'l-1',
          label: 'Organisation Forum Transformation Numérique (250 pers.)',
          quantity: 1,
          deliveredQuantity: 1,
          unitPrice: 2500000,
          vatRate: 18,
        },
      ],
      payments: [
        {
          id: 'p-1',
          date: '2026-11-12',
          amount: 1500000,
          method: 'VIREMENT',
          reference: 'VIR-CBAO-4412',
        },
      ],
      notes: 'Facture synchronisée avec la comptabilité SYSCOHADA',
      syncedToAccounting: true,
    },
    {
      id: 'doc-dir-2',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      kind: 'QUOTE',
      number: 'DEV-2026-001',
      date: '2026-11-14',
      contactId: 'c-dir-2',
      contactName: 'CBAO Groupe Attijariwafa Bank',
      status: 'VALIDATED',
      lines: [
        {
          id: 'l-2',
          label: 'Programme Gouvernance & Conformité SYSCOHADA (30 cadres)',
          quantity: 1,
          deliveredQuantity: 0,
          unitPrice: 3200000,
          vatRate: 18,
        },
      ],
      payments: [],
      notes: 'Proposition valable 30 jours — inclut certification nominative',
    },
    {
      id: 'doc-mgr-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      kind: 'QUOTE',
      number: 'DEV-MGR-2026-001',
      date: '2026-11-15',
      contactId: 'c-mgr-2',
      contactName: 'Ministère de l’Économie Numérique',
      status: 'VALIDATED',
      lines: [
        {
          id: 'l-m1',
          label: 'Scénographie & Logistique Forum Économique de Diamniadio',
          quantity: 1,
          deliveredQuantity: 0,
          unitPrice: 4500000,
          vatRate: 18,
        },
      ],
      payments: [],
      notes: 'Devis géré par Fatou Binetou Sarr (Manager Événementiel)',
    },
  ],
  crmCampaigns: [
    {
      id: 'camp-dir-1',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      name: 'Relance Séminaires & Certifications Q4 2026',
      channel: 'WHATSAPP',
      audience: 'QUALIFIED_PROSPECTS',
      status: 'ACTIVE',
      messageTemplate:
        'Bonjour {nom}, suite à nos échanges avec {organisation}, nos créneaux de formation & d’événementiel Q4 restent ouverts. Souhaitez-vous recevoir la proposition mise à jour ?',
      targetCount: 2,
      sentConfirmedCount: 1,
      repliesCount: 1,
      createdAt: '2026-11-12',
    },
    {
      id: 'camp-mgr-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      name: 'Invitation Sommet Protocolaire Diamniadio',
      channel: 'WHATSAPP',
      audience: 'ALL_CLIENTS_PROSPECTS',
      status: 'ACTIVE',
      messageTemplate:
        'Bonjour {nom}, nous finalisons les réservations VIP pour le Forum de Diamniadio. Confirmez-vous votre présence ?',
      targetCount: 2,
      sentConfirmedCount: 1,
      repliesCount: 0,
      createdAt: '2026-11-15',
    },
  ],
  crmFollowUps: [
    {
      id: 'wa-dir-1',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      contactId: 'c-dir-2',
      contactName: 'CBAO Groupe Attijariwafa Bank',
      phone: '+221 78 410 33 21',
      campaignId: 'camp-dir-1',
      campaignName: 'Relance Séminaires & Certifications Q4 2026',
      documentNumber: 'DEV-2026-001',
      message:
        'Bonjour CBAO Groupe Attijariwafa Bank, suite au devis DEV-2026-001, nous restons à votre disposition pour planifier votre cohorte SYSCOHADA.',
      status: 'A_ENVOYER',
      preparedAt: '2026-11-16 09:30',
    },
    {
      id: 'wa-mgr-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      contactId: 'c-mgr-2',
      contactName: 'Ministère de l’Économie Numérique',
      phone: '+221 77 512 09 44',
      campaignId: 'camp-mgr-1',
      campaignName: 'Invitation Sommet Protocolaire Diamniadio',
      documentNumber: 'DEV-MGR-2026-001',
      message:
        'Bonjour Ministère de l’Économie Numérique, souhaitez-vous valider les options scénographiques du devis DEV-MGR-2026-001 ?',
      status: 'A_ENVOYER',
      preparedAt: '2026-11-16 14:10',
    },
  ],
  crmActivities: [
    {
      id: 'act-dir-1',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      contactId: 'c-dir-2',
      contactName: 'CBAO Groupe Attijariwafa Bank',
      kind: 'DOCUMENT',
      summary: 'Envoi du devis DEV-2026-001 pour 30 cadres (3 776 000 FCFA TTC).',
      nextStep: 'Relance WhatsApp sur décision comité formation',
      followUpDate: '2026-11-21',
      createdAt: '2026-11-16 14:20',
      author: 'Cheikh Tidiane Fall',
    },
    {
      id: 'act-mgr-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      contactId: 'c-mgr-1',
      contactName: 'Consortium Bancaire UEMOA',
      kind: 'REUNION',
      summary: 'Validation du cahier des charges traiteur et accueil VIP King Fahd Palace.',
      nextStep: 'Suivi devis traiteur Teranex Connect',
      followUpDate: '2026-11-23',
      createdAt: '2026-11-16 11:00',
      author: 'Fatou Binetou Sarr',
    },
  ],
  platformEvents: [
    {
      id: 'ev-1',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      assignedUserIds: ['int-u-1', 'int-u-2', 'int-u-3'],
      title: 'Forum Économique Souverain de Diamniadio',
      client: 'Ministère de l’Économie Numérique',
      date: '2026-12-04',
      venue: 'CICAD Diamniadio, Dakar',
      capacity: 600,
      registered: 485,
      budgetFcfa: 28500000,
      status: 'EN_COURS',
    },
    {
      id: 'ev-2',
      ownerUserId: 'int-u-2',
      organizationId: 'tpd-demo-intranet',
      assignedUserIds: ['int-u-2', 'int-u-3'],
      title: 'Gala Annuel & Remise des Prix Teranga Prestige',
      client: 'Consortium Bancaire UEMOA',
      date: '2026-12-18',
      venue: 'King Fahd Palace, Almadies',
      capacity: 300,
      registered: 240,
      budgetFcfa: 16200000,
      status: 'PLANIFIE',
    },
    {
      id: 'ev-3',
      ownerUserId: 'int-u-1',
      organizationId: 'tpd-demo-intranet',
      assignedUserIds: ['int-u-1'],
      title: 'Comité Stratégique Souveraineté Numérique UEMOA',
      client: 'Sonatel Business SA',
      date: '2026-12-10',
      venue: 'Siège Senelec Digital, Dakar Plateau',
      capacity: 80,
      registered: 64,
      budgetFcfa: 9400000,
      status: 'PLANIFIE',
    },
  ],
  superadminUsers: [
    {
      id: 'sup-1',
      email: 'superadmin@teranga-demo.sn',
      name: 'Ousmane Diop',
      role: 'SUPERADMIN',
      title: 'Super Administrateur Plateforme',
      passwordHash: simpleHash('demo-superadmin-2026'),
      status: 'ACTIVE',
      createdAt: '2026-01-05T09:00:00Z',
      lastLoginAt: '2026-11-17T08:00:00Z',
    },
    {
      id: 'sup-2',
      email: 'securite@teranga-demo.sn',
      name: 'Aïssatou Sow',
      role: 'SECURITY_ADMIN',
      title: 'Responsable Audit, Accès & Sécurité',
      passwordHash: simpleHash('demo-superadmin-2026'),
      status: 'ACTIVE',
      createdAt: '2026-02-12T10:30:00Z',
      lastLoginAt: '2026-11-16T17:45:00Z',
    },
  ],
  auditLogs: [
    {
      id: 'aud-1',
      timestamp: '2026-11-17T08:15:00Z',
      actorId: 'sup-1',
      actorName: 'Ousmane Diop',
      actorSpace: 'superadmin',
      action: 'SYSTEM_SYNC',
      targetType: 'SYSTEM',
      targetLabel: 'Plateforme Teranga Prestige',
      details: 'Vérification de l’isolation multi-comptes et synchronisation CRM / SYSCOHADA / Formation validées.',
      severity: 'INFO',
    },
    {
      id: 'aud-2',
      timestamp: '2026-11-17T09:05:00Z',
      actorId: 'int-u-2',
      actorName: 'Fatou Binetou Sarr',
      actorSpace: 'intranet',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: 'int-u-2',
      targetLabel: 'Fatou Binetou Sarr (manager@teranga-demo.sn)',
      details: 'Connexion espace Intranet & CRM.',
      severity: 'INFO',
    },
    {
      id: 'aud-3',
      timestamp: '2026-11-16T17:45:00Z',
      actorId: 'sup-2',
      actorName: 'Aïssatou Sow',
      actorSpace: 'superadmin',
      action: 'SECURITY_AUDIT',
      targetType: 'SYSTEM',
      targetLabel: 'Politique RBAC & Tokens',
      details: 'Contrôle périodique des sessions actives et droits par espace.',
      severity: 'INFO',
    },
  ],
  commissionRules: [
    {
      id: 'rule-global-inst',
      name: 'Barème Standard Formateurs Pro',
      beneficiaryType: 'INSTRUCTOR',
      scope: 'GLOBAL',
      ratePercent: 15,
      fixedFeeFcfa: 0,
      isActive: true,
      updatedAt: '2026-10-01T09:00:00Z',
      updatedBy: 'Ousmane Diop',
    },
    {
      id: 'rule-global-prov',
      name: 'Barème Standard Prestataires Événementiels',
      beneficiaryType: 'PROVIDER',
      scope: 'GLOBAL',
      ratePercent: 12,
      fixedFeeFcfa: 0,
      isActive: true,
      updatedAt: '2026-10-01T09:00:00Z',
      updatedBy: 'Ousmane Diop',
    },
    {
      id: 'rule-cat-finance',
      name: 'Formations Certifiantes Finance & Conformité',
      beneficiaryType: 'INSTRUCTOR',
      scope: 'CATEGORY',
      category: 'Finance & Conformité',
      ratePercent: 18,
      fixedFeeFcfa: 0,
      isActive: true,
      updatedAt: '2026-10-15T10:30:00Z',
      updatedBy: 'Ousmane Diop',
    },
    {
      id: 'rule-cat-traiteur',
      name: 'Partenariat Traiteur & Gastronomie Corporate',
      beneficiaryType: 'PROVIDER',
      scope: 'CATEGORY',
      category: 'Traiteur & Gastronomie',
      ratePercent: 10,
      fixedFeeFcfa: 5000,
      isActive: true,
      updatedAt: '2026-10-20T14:00:00Z',
      updatedBy: 'Ousmane Diop',
    },
  ],
  commissions: [
    {
      id: 'com-1',
      reference: 'COM-2026-001',
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: 'inst-1',
      beneficiaryName: 'Ibrahima Diallo',
      beneficiaryOrg: 'Formateur Principal Cloud, IA & Systèmes Souverains',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: 'enr-2',
      sourceTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      clientOrLearnerName: 'Awa Diagne (Sonatel Business SA)',
      category: 'Finance & Conformité',
      grossAmountFcfa: 185000,
      appliedRatePercent: 18,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 33300,
      netPartnerAmountFcfa: 151700,
      ruleId: 'rule-cat-finance',
      ruleName: 'Formations Certifiantes Finance & Conformité',
      status: 'REVERSE_PARTENAIRE',
      payoutMethod: 'VIREMENT',
      payoutReference: 'VIR-TPD-2026-104',
      notes: 'Cohorte validée & reversement effectué au formateur.',
      transactionDate: '2026-10-14',
      validatedAt: '2026-10-16T10:00:00Z',
      collectedAt: '2026-10-20T14:00:00Z',
      settledAt: '2026-11-05T11:30:00Z',
      createdAt: '2026-10-14T12:00:00Z',
      updatedAt: '2026-11-05T11:30:00Z',
    },
    {
      id: 'com-2',
      reference: 'COM-2026-002',
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: 'inst-1',
      beneficiaryName: 'Ibrahima Diallo',
      beneficiaryOrg: 'Formateur Principal Cloud, IA & Systèmes Souverains',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: 'enr-1',
      sourceTitle: 'Architecture Cloud Souveraine & Déploiement IA B2B',
      clientOrLearnerName: 'Awa Diagne (Sonatel Business SA)',
      category: 'Formations & Masterclasses',
      grossAmountFcfa: 45000,
      appliedRatePercent: 15,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 6750,
      netPartnerAmountFcfa: 38250,
      ruleId: 'rule-global-inst',
      ruleName: 'Barème Standard Formateurs Pro',
      status: 'PRELEVEE',
      payoutMethod: 'RETENUE_FACTURE',
      payoutReference: 'RET-TPD-2026-031',
      notes: 'Commission encaissée à l’inscription B2B.',
      transactionDate: '2026-11-04',
      validatedAt: '2026-11-05T09:15:00Z',
      collectedAt: '2026-11-08T16:00:00Z',
      createdAt: '2026-11-04T11:00:00Z',
      updatedAt: '2026-11-08T16:00:00Z',
    },
    {
      id: 'com-3',
      reference: 'COM-2026-003',
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: 'inst-1',
      beneficiaryName: 'Ibrahima Diallo',
      beneficiaryOrg: 'Formateur Principal Cloud, IA & Systèmes Souverains',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: 'enr-3',
      sourceTitle: 'Gouvernance SYSCOHADA Révisé & Pilotage Financier',
      clientOrLearnerName: 'Khadim Ndiaye (Senelec Digital)',
      category: 'Finance & Conformité',
      grossAmountFcfa: 185000,
      appliedRatePercent: 18,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 33300,
      netPartnerAmountFcfa: 151700,
      ruleId: 'rule-cat-finance',
      ruleName: 'Formations Certifiantes Finance & Conformité',
      status: 'VALIDEE',
      notes: 'Licence B2B validée, en attente d’imputation mensuelle.',
      transactionDate: '2026-10-18',
      validatedAt: '2026-10-20T10:00:00Z',
      createdAt: '2026-10-18T09:30:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
    },
    {
      id: 'com-4',
      reference: 'COM-2026-004',
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: 'inst-2',
      beneficiaryName: 'Ndeye Fatou Mbaye',
      beneficiaryOrg: 'Experte Cybersécurité & Audit SYSCOHADA',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: 'enr-5',
      sourceTitle: 'Cybersécurité Opérationnelle & Conformité CDP Sénégal',
      clientOrLearnerName: 'Khadim Ndiaye (Senelec Digital)',
      category: 'Cybersécurité & Conformité',
      grossAmountFcfa: 195000,
      appliedRatePercent: 15,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 29250,
      netPartnerAmountFcfa: 165750,
      ruleId: 'rule-global-inst',
      ruleName: 'Barème Standard Formateurs Pro',
      status: 'EN_ATTENTE',
      notes: 'Nouvelle inscription Senelec Digital à valider.',
      transactionDate: '2026-11-15',
      createdAt: '2026-11-15T10:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z',
    },
    {
      id: 'com-5',
      reference: 'COM-2026-005',
      beneficiaryType: 'PROVIDER',
      beneficiaryId: 'prov-1',
      beneficiaryName: 'Serigne Ba',
      beneficiaryOrg: 'Teranex Connect Événementiel',
      sourceType: 'PROVIDER_REQUEST',
      sourceId: 'req-4',
      sourceTitle: 'Traiteur Prestige — Cocktail Dînatoire & Banquet (FAC-PRV-2026-012)',
      clientOrLearnerName: 'M. Cheikh Diop (Senelec Digital)',
      category: 'Traiteur & Gastronomie',
      grossAmountFcfa: 680000,
      appliedRatePercent: 10,
      fixedFeeFcfa: 5000,
      commissionAmountFcfa: 73000,
      netPartnerAmountFcfa: 607000,
      ruleId: 'rule-cat-traiteur',
      ruleName: 'Partenariat Traiteur & Gastronomie Corporate',
      status: 'REVERSE_PARTENAIRE',
      payoutMethod: 'VIREMENT',
      payoutReference: 'VIR-PRV-2026-089',
      notes: 'Facture FAC-PRV-2026-012 prélevée et net partenaire viré.',
      transactionDate: '2026-11-11',
      validatedAt: '2026-11-11T15:00:00Z',
      collectedAt: '2026-11-13T10:00:00Z',
      settledAt: '2026-11-15T17:00:00Z',
      createdAt: '2026-11-11T09:45:00Z',
      updatedAt: '2026-11-15T17:00:00Z',
    },
    {
      id: 'com-6',
      reference: 'COM-2026-006',
      beneficiaryType: 'PROVIDER',
      beneficiaryId: 'prov-1',
      beneficiaryName: 'Serigne Ba',
      beneficiaryOrg: 'Teranex Connect Événementiel',
      sourceType: 'PROVIDER_REQUEST',
      sourceId: 'req-3',
      sourceTitle: 'Sonorisation complète, Régie & Animation DJ (CMD-PRV-2026-008)',
      clientOrLearnerName: 'Mme Coumba Fall (Port Autonome de Dakar)',
      category: 'Animateur & DJ',
      grossAmountFcfa: 350000,
      appliedRatePercent: 12,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 42000,
      netPartnerAmountFcfa: 308000,
      ruleId: 'rule-global-prov',
      ruleName: 'Barème Standard Prestataires Événementiels',
      status: 'VALIDEE',
      notes: 'Commande confirmée Forum Maritime International — en attente facturation finale.',
      transactionDate: '2026-11-12',
      validatedAt: '2026-11-13T09:30:00Z',
      createdAt: '2026-11-12T11:20:00Z',
      updatedAt: '2026-11-13T09:30:00Z',
    },
    {
      id: 'com-7',
      reference: 'COM-2026-007',
      beneficiaryType: 'PROVIDER',
      beneficiaryId: 'prov-1',
      beneficiaryName: 'Serigne Ba',
      beneficiaryOrg: 'Teranex Connect Événementiel',
      sourceType: 'PROVIDER_REQUEST',
      sourceId: 'req-2',
      sourceTitle: 'Sonorisation & DJ Set Séminaire Innovation (DEV-PRV-2026-019)',
      clientOrLearnerName: 'M. Abdoulaye Ndiaye (Sonatel Business SA)',
      category: 'Animateur & DJ',
      grossAmountFcfa: 295000,
      appliedRatePercent: 12,
      fixedFeeFcfa: 0,
      commissionAmountFcfa: 35400,
      netPartnerAmountFcfa: 259600,
      ruleId: 'rule-global-prov',
      ruleName: 'Barème Standard Prestataires Événementiels',
      status: 'EN_ATTENTE',
      notes: 'Devis envoyé au client — validation dès confirmation de commande.',
      transactionDate: '2026-11-15',
      createdAt: '2026-11-15T16:40:00Z',
      updatedAt: '2026-11-15T16:40:00Z',
    },
  ],
  tasks: [
    {
      id: 'tsk-1',
      code: 'TSK-2026-001',
      title: 'Finaliser la proposition Sommet Économique Dakar',
      description: 'Valider le chiffrage scénographie, traiteur et sécurité VIP avant transmission au comité d’organisation.',
      status: 'EN_COURS',
      priority: 'URGENTE',
      category: 'CRM',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      assigneeUserId: 'int-u-1',
      assigneeName: 'Fatou Bintou Fall',
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      startDate: '2026-11-16',
      dueDate: '2026-11-19',
      startHour: 10,
      estimatedHours: 3,
      tags: ['Sommet Dakar', 'Devis VIP'],
      checklist: [
        { id: 'chk-1', label: 'Vérifier disponibilité salle CICAD', completed: true },
        { id: 'chk-2', label: 'Intégrer devis traiteur prestige', completed: true },
        { id: 'chk-3', label: 'Signature direction financière', completed: false },
      ],
      comments: [
        {
          id: 'cmt-1',
          authorId: 'int-u-1',
          authorName: 'Fatou Bintou Fall',
          content: 'Le client attend la version finale jeudi matin.',
          createdAt: '2026-11-17T15:20:00Z',
        },
      ],
      linkedRecordLabel: 'DEV-2026-041 · Sonatel Business',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-16T08:30:00Z',
      updatedAt: '2026-11-17T15:20:00Z',
    },
    {
      id: 'tsk-2',
      code: 'TSK-2026-002',
      title: 'Relancer prospects qualifiés Forum Énergie',
      description: 'Effectuer le suivi WhatsApp et téléphonique des 6 directeurs généraux rencontrés lors du petit-déjeuner.',
      status: 'A_FAIRE',
      priority: 'HAUTE',
      category: 'CRM',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      assigneeUserId: 'int-u-2',
      assigneeName: 'Moussa Sarr',
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      startDate: '2026-11-18',
      dueDate: '2026-11-20',
      startHour: 14,
      estimatedHours: 2,
      tags: ['Prospection', 'WhatsApp'],
      checklist: [
        { id: 'chk-4', label: 'Exporter les fiches opt-in CRM', completed: true },
        { id: 'chk-5', label: 'Planifier RDV démo', completed: false },
      ],
      comments: [],
      linkedRecordLabel: 'Campagne Q4 Corporate',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T10:00:00Z',
      updatedAt: '2026-11-17T10:00:00Z',
    },
    {
      id: 'tsk-3',
      code: 'TSK-2026-003',
      title: 'Préparer les badges & accueil VIP Gala Diamniadio',
      description: 'Contrôler la liste des 180 invités, impressions nominatives et répartition des hôtesses.',
      status: 'EN_REVISION',
      priority: 'NORMALE',
      category: 'EVENEMENT',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      assigneeUserId: 'int-u-3',
      assigneeName: 'Awa Ndiaye',
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      startDate: '2026-11-15',
      dueDate: '2026-11-21',
      startHour: 9,
      estimatedHours: 4,
      tags: ['Logistique', 'Protocole'],
      checklist: [
        { id: 'chk-6', label: 'Valider liste nominative', completed: true },
        { id: 'chk-7', label: 'Réceptionner les tours de cou', completed: true },
        { id: 'chk-8', label: 'Brief équipe accueil', completed: false },
      ],
      comments: [],
      linkedRecordLabel: 'Gala Annuel Banques UEMOA',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-15T09:00:00Z',
      updatedAt: '2026-11-17T11:30:00Z',
    },
    {
      id: 'tsk-4',
      code: 'TSK-2026-004',
      title: 'Clôturer le dossier formation intra CBAO',
      description: 'Archiver les feuilles de présence signées et transmettre les attestations nominatives.',
      status: 'TERMINE',
      priority: 'NORMALE',
      category: 'FORMATION',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      assigneeUserId: 'int-u-1',
      assigneeName: 'Fatou Bintou Fall',
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      startDate: '2026-11-10',
      dueDate: '2026-11-14',
      estimatedHours: 2,
      tags: ['Attestations', 'Clôture'],
      checklist: [
        { id: 'chk-9', label: 'Collecter émargements', completed: true },
        { id: 'chk-10', label: 'Envoyer facturation finale', completed: true },
      ],
      comments: [],
      syncToPlanning: false,
      orderIndex: 0,
      createdAt: '2026-11-10T09:00:00Z',
      updatedAt: '2026-11-14T17:00:00Z',
      completedAt: '2026-11-14T17:00:00Z',
    },
    {
      id: 'tsk-5',
      code: 'TSK-2026-005',
      title: 'Déclaration TVA mensuelle & rapprochement DGID',
      description: 'Contrôler les factures fournisseurs récupérables et générer le bordereau TVA de novembre.',
      status: 'EN_COURS',
      priority: 'URGENTE',
      category: 'COMPTABILITE',
      ownerUserId: 'acc-u-1',
      ownerName: 'Aminata Diallo',
      assigneeUserId: 'acc-u-1',
      assigneeName: 'Aminata Diallo',
      organizationId: 'tpd-demo-accounting',
      space: 'accounting',
      startDate: '2026-11-17',
      dueDate: '2026-11-20',
      startHour: 9,
      estimatedHours: 3,
      tags: ['DGID', 'TVA 18%'],
      checklist: [
        { id: 'chk-11', label: 'Vérifier journal des ventes VE', completed: true },
        { id: 'chk-12', label: 'Pointer factures achats AC', completed: false },
      ],
      comments: [],
      linkedRecordLabel: 'Exercice 2026 · SYSCOHADA',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T08:00:00Z',
      updatedAt: '2026-11-18T09:00:00Z',
    },
    {
      id: 'tsk-6',
      code: 'TSK-2026-006',
      title: 'Terminer le module Kubernetes & Souveraineté Numérique',
      description: 'Visionner les deux dernières capsules vidéo et soumettre l’atelier pratique avant l’évaluation.',
      status: 'EN_COURS',
      priority: 'HAUTE',
      category: 'FORMATION',
      ownerUserId: 'lrn-1',
      ownerName: 'Awa Diagne',
      assigneeUserId: 'lrn-1',
      assigneeName: 'Awa Diagne',
      organizationId: 'Sonatel Business SA',
      space: 'learner',
      startDate: '2026-11-18',
      dueDate: '2026-11-22',
      startHour: 16,
      estimatedHours: 2,
      tags: ['Certification', 'Cloud'],
      checklist: [
        { id: 'chk-13', label: 'Capsule Architecture Zero-Trust', completed: true },
        { id: 'chk-14', label: 'Atelier pratique déploiement', completed: false },
      ],
      comments: [],
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T14:00:00Z',
      updatedAt: '2026-11-18T08:00:00Z',
    },
    {
      id: 'tsk-7',
      code: 'TSK-2026-007',
      title: 'Mettre à jour les supports PDF Gouvernance SYSCOHADA',
      description: 'Intégrer les nouveaux cas pratiques 2026 sur les écritures de provisions et amortissements.',
      status: 'A_FAIRE',
      priority: 'HAUTE',
      category: 'FORMATION',
      ownerUserId: 'inst-1',
      ownerName: 'Ibrahima Diallo',
      assigneeUserId: 'inst-1',
      assigneeName: 'Ibrahima Diallo',
      organizationId: 'Dakar',
      space: 'instructor',
      startDate: '2026-11-18',
      dueDate: '2026-11-21',
      startHour: 11,
      estimatedHours: 3,
      tags: ['Supports', 'Cohorte Nov'],
      checklist: [
        { id: 'chk-15', label: 'Actualiser tableau amortissements', completed: false },
        { id: 'chk-16', label: 'Publier sur la fiche cours', completed: false },
      ],
      comments: [],
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T11:00:00Z',
      updatedAt: '2026-11-17T11:00:00Z',
    },
    {
      id: 'tsk-8',
      code: 'TSK-2026-008',
      title: 'Préparer matériel sonorisation Forum Maritime PAD',
      description: 'Tester les 8 micros HF, console numérique et câblage scène 24h avant le déploiement au port.',
      status: 'EN_COURS',
      priority: 'URGENTE',
      category: 'PRESTATION',
      ownerUserId: 'prov-1',
      ownerName: 'Serigne Ba',
      assigneeUserId: 'prov-1',
      assigneeName: 'Serigne Ba',
      organizationId: 'Teranex Connect Événementiel',
      space: 'provider',
      startDate: '2026-11-18',
      dueDate: '2026-11-20',
      startHour: 10,
      estimatedHours: 3,
      tags: ['Régie Audio', 'CMD-PRV-2026-008'],
      checklist: [
        { id: 'chk-17', label: 'Contrôle fréquences HF', completed: true },
        { id: 'chk-18', label: 'Chargement véhicule utilitaire', completed: false },
      ],
      comments: [],
      linkedRecordLabel: 'CMD-PRV-2026-008 · Port Autonome',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T09:00:00Z',
      updatedAt: '2026-11-18T08:15:00Z',
    },
    {
      id: 'tsk-9',
      code: 'TSK-2026-009',
      title: 'Valider les reversements commissions de novembre',
      description: 'Vérifier les bordereaux Formateurs Pro & Prestataires et déclencher les virements validés.',
      status: 'EN_REVISION',
      priority: 'HAUTE',
      category: 'ADMINISTRATION',
      ownerUserId: 'sup-1',
      ownerName: 'Ousmane Diop',
      assigneeUserId: 'sup-1',
      assigneeName: 'Ousmane Diop',
      organizationId: 'tpd-superadmin',
      space: 'superadmin',
      startDate: '2026-11-17',
      dueDate: '2026-11-21',
      startHour: 15,
      estimatedHours: 2,
      tags: ['Commissions', 'Trésorerie'],
      checklist: [
        { id: 'chk-19', label: 'Contrôler COM-2026-003 & COM-2026-006', completed: true },
        { id: 'chk-20', label: 'Éditer bordereau mensuel', completed: false },
      ],
      comments: [],
      linkedRecordLabel: 'Commissions Superadmin',
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-17T10:30:00Z',
      updatedAt: '2026-11-18T07:45:00Z',
    },
    {
      id: 'tsk-10',
      code: 'TSK-2026-010',
      title: 'Audit trimestriel des comptes & sessions actives',
      description: 'Revoir les journaux d’audit sécurité et vérifier les accès suspendus.',
      status: 'A_FAIRE',
      priority: 'NORMALE',
      category: 'ADMINISTRATION',
      ownerUserId: 'sup-1',
      ownerName: 'Ousmane Diop',
      assigneeUserId: 'sup-1',
      assigneeName: 'Ousmane Diop',
      organizationId: 'tpd-superadmin',
      space: 'superadmin',
      startDate: '2026-11-18',
      dueDate: '2026-11-25',
      startHour: 11,
      estimatedHours: 2,
      tags: ['Sécurité', 'Audit'],
      checklist: [
        { id: 'chk-21', label: 'Analyser tentatives connexion', completed: false },
      ],
      comments: [],
      syncToPlanning: true,
      orderIndex: 0,
      createdAt: '2026-11-18T08:00:00Z',
      updatedAt: '2026-11-18T08:00:00Z',
    },
  ],
  planningEntries: [
    {
      id: 'pln-1',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      participantUserIds: ['int-u-1', 'int-u-2', 'int-u-3'],
      participantNames: ['Fatou Bintou Fall', 'Moussa Sarr', 'Awa Ndiaye'],
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      title: 'Point hebdomadaire Pôle Ingénierie & Événements',
      description: 'Revue des dossiers clients en cours, assignation des tâches et arbitrages prestataires.',
      type: 'REUNION',
      status: 'CONFIRME',
      date: '2026-11-18',
      startHour: 9,
      durationHours: 2,
      location: 'Salle Teranga Plateau / Visio',
      createdAt: '2026-11-16T09:00:00Z',
      updatedAt: '2026-11-16T09:00:00Z',
    },
    {
      id: 'pln-2',
      ownerUserId: 'int-u-1',
      ownerName: 'Fatou Bintou Fall',
      participantUserIds: ['int-u-1'],
      participantNames: ['Fatou Bintou Fall'],
      organizationId: 'tpd-demo-intranet',
      space: 'intranet',
      title: 'Rendez-vous signature contrat Sonatel Business',
      description: 'Présentation finale du budget événementiel et validation calendrier de déploiement.',
      type: 'RENDEZ_VOUS',
      status: 'PLANIFIE',
      date: '2026-11-19',
      startHour: 15,
      durationHours: 2,
      location: 'Siège Sonatel VDN, Dakar',
      linkedTaskId: 'tsk-1',
      createdAt: '2026-11-17T10:00:00Z',
      updatedAt: '2026-11-17T10:00:00Z',
    },
    {
      id: 'pln-3',
      ownerUserId: 'acc-u-1',
      ownerName: 'Aminata Diallo',
      participantUserIds: ['acc-u-1'],
      participantNames: ['Aminata Diallo'],
      organizationId: 'tpd-demo-accounting',
      space: 'accounting',
      title: 'Comité clôture TVA & révision SYSCOHADA',
      description: 'Contrôle des balances auxiliaires clients/fournisseurs avant dépôt télédéclaration.',
      type: 'ECHEANCE',
      status: 'CONFIRME',
      date: '2026-11-19',
      startHour: 10,
      durationHours: 2,
      location: 'Direction Financière',
      linkedTaskId: 'tsk-5',
      createdAt: '2026-11-17T08:30:00Z',
      updatedAt: '2026-11-17T08:30:00Z',
    },
    {
      id: 'pln-4',
      ownerUserId: 'lrn-1',
      ownerName: 'Awa Diagne',
      participantUserIds: ['lrn-1'],
      participantNames: ['Awa Diagne'],
      organizationId: 'Sonatel Business SA',
      space: 'learner',
      title: 'Session de révision Certification Cloud Souverain',
      description: 'Créneau dédié à la finalisation de l’atelier pratique et QCM de validation.',
      type: 'FORMATION',
      status: 'PLANIFIE',
      date: '2026-11-19',
      startHour: 17,
      durationHours: 2,
      location: 'E-Learning · Plateforme Teranga',
      linkedTaskId: 'tsk-6',
      createdAt: '2026-11-17T14:00:00Z',
      updatedAt: '2026-11-17T14:00:00Z',
    },
    {
      id: 'pln-5',
      ownerUserId: 'inst-1',
      ownerName: 'Ibrahima Diallo',
      participantUserIds: ['inst-1'],
      participantNames: ['Ibrahima Diallo'],
      organizationId: 'Dakar',
      space: 'instructor',
      title: 'Classe virtuelle interactive — Cohorte SYSCOHADA',
      description: 'Questions-réponses en direct et correction des cas pratiques avec les apprenants.',
      type: 'FORMATION',
      status: 'CONFIRME',
      date: '2026-11-20',
      startHour: 10,
      durationHours: 3,
      location: 'Studio Visio Formateur',
      createdAt: '2026-11-16T11:00:00Z',
      updatedAt: '2026-11-16T11:00:00Z',
    },
    {
      id: 'pln-6',
      ownerUserId: 'prov-1',
      ownerName: 'Serigne Ba',
      participantUserIds: ['prov-1'],
      participantNames: ['Serigne Ba'],
      organizationId: 'Teranex Connect Événementiel',
      space: 'provider',
      title: 'Repérage technique & balances audio Port de Dakar',
      description: 'Installation préliminaire et tests acoustiques sur site avec la régie générale.',
      type: 'PRESTATION',
      status: 'CONFIRME',
      date: '2026-11-19',
      startHour: 9,
      durationHours: 3,
      location: 'Terminal Maritime, Port Autonome de Dakar',
      linkedTaskId: 'tsk-8',
      createdAt: '2026-11-17T09:15:00Z',
      updatedAt: '2026-11-17T09:15:00Z',
    },
    {
      id: 'pln-7',
      ownerUserId: 'sup-1',
      ownerName: 'Ousmane Diop',
      participantUserIds: ['sup-1'],
      participantNames: ['Ousmane Diop'],
      organizationId: 'tpd-superadmin',
      space: 'superadmin',
      title: 'Comité de direction & validation commissions mensuelles',
      description: 'Revue des performances partenaires, arbitrages barèmes et validation des reversements.',
      type: 'REUNION',
      status: 'CONFIRME',
      date: '2026-11-20',
      startHour: 10,
      durationHours: 2,
      location: 'Salle Conseil Superadmin',
      linkedTaskId: 'tsk-9',
      createdAt: '2026-11-17T10:45:00Z',
      updatedAt: '2026-11-17T10:45:00Z',
    },
  ],
};

function createDb(): DbAdapter {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[AI Studio] DATABASE_URL non défini — mode stockage en mémoire actif pour PostgreSQL');
    return {
      isMock: true,
      query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }),
      connect: async () => ({
        query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }),
        release: () => {},
      }),
    };
  }

  try {
    const pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_SIZE || 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    return {
      isMock: false,
      query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
        const result = await pool.query(text, params);
        return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
      },
      connect: async () => {
        const client = await pool.connect();
        return {
          query: async <T = Record<string, unknown>>(text: string, params?: unknown[]) => {
            const result = await client.query(text, params);
            return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
          },
          release: () => client.release(),
        };
      },
    };
  } catch (err) {
    console.warn('[AI Studio] Connexion PostgreSQL impossible — mode en mémoire actif:', err);
    return {
      isMock: true,
      query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }),
      connect: async () => ({
        query: async <T = Record<string, unknown>>() => ({ rows: [] as T[], rowCount: 0 }),
        release: () => {},
      }),
    };
  }
}

export const db = createDb();
