export type OrganizationOption = {
  id: string;
  name: string;
  sector: string;
  ninea: string;
  city: string;
  logoUrl?: string;
};

export type ContactType = 'CLIENT' | 'PROSPECT' | 'SUPPLIER';
export type CrmPipelineStage = 'NOUVEAU' | 'CONTACTE' | 'QUALIFIE' | 'PROPOSITION' | 'GAGNE';

export interface CrmContact {
  id: string;
  ownerUserId?: string;
  organizationId?: string;
  type: ContactType;
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

export type CrmCampaignStatus = 'BROUILLON' | 'ACTIVE' | 'TERMINEE';
export type CrmCampaignAudience = 'ALL_CLIENTS_PROSPECTS' | 'QUALIFIED_PROSPECTS' | 'WHATSAPP_OPTIN' | 'UNPAID_INVOICES';

export interface CrmCampaign {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'EMAIL' | 'MIXTE';
  audience: CrmCampaignAudience;
  status: CrmCampaignStatus;
  messageTemplate: string;
  targetCount: number;
  sentConfirmedCount: number;
  repliesCount: number;
  createdAt: string;
}

export type WhatsappRelanceStatus =
  | 'A_ENVOYER'
  | 'OUVERT_WHATSAPP'
  | 'ENVOI_CONFIRME'
  | 'REPONSE_RECUE'
  | 'REPORTE';

export interface WhatsappFollowUp {
  id: string;
  contactId: string;
  contactName: string;
  phone: string;
  campaignId?: string;
  campaignName?: string;
  documentNumber?: string;
  message: string;
  status: WhatsappRelanceStatus;
  preparedAt: string;
  confirmedSentAt?: string;
  replyNote?: string;
  repliedAt?: string;
}

export type CrmActivityKind = 'APPEL' | 'WHATSAPP' | 'EMAIL' | 'REUNION' | 'DOCUMENT' | 'NOTE';

export interface CrmActivityLog {
  id: string;
  contactId: string;
  contactName: string;
  kind: CrmActivityKind;
  summary: string;
  nextStep?: string;
  followUpDate?: string;
  createdAt: string;
  author: string;
}

export type DocumentKind =
  | 'QUOTE'
  | 'CUSTOMER_ORDER'
  | 'DELIVERY_NOTE'
  | 'CUSTOMER_INVOICE'
  | 'PURCHASE_ORDER'
  | 'SUPPLIER_INVOICE';

export type DocumentStatus = 'DRAFT' | 'VALIDATED' | 'PARTIAL' | 'DELIVERED' | 'PAID';

export interface DocumentLine {
  id: string;
  label: string;
  quantity: number;
  deliveredQuantity: number;
  unitPrice: number;
  vatRate: number;
}

export interface DocumentPayment {
  id: string;
  date: string;
  amount: number;
  method: 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
  reference: string;
}

export interface CommercialDocument {
  id: string;
  kind: DocumentKind;
  number: string;
  date: string;
  contactId: string;
  contactName: string;
  status: DocumentStatus;
  lines: DocumentLine[];
  payments: DocumentPayment[];
  notes: string;
}

export interface EventRecord {
  id: string;
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

export type TrainingRegistrationStatus = 'OUVERTE' | 'DERNIERES_PLACES' | 'COMPLET';
export type TrainingModality = 'EN_LIGNE' | 'HYBRIDE' | 'PRESENTIEL';

export interface TrainingProgram {
  id: string;
  title: string;
  category: string;
  instructor: string;
  instructorAvatarUrl?: string;
  modality?: TrainingModality;
  durationHours: number;
  nextSession: string;
  startHour?: number;
  enrolled: number;
  maxSeats: number;
  feeFcfa: number;
  certified: boolean;
  registrationStatus?: TrainingRegistrationStatus;
}

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

export interface LearnerCourseSection {
  id: string;
  title: string;
  description?: string;
  lessonIds: string[];
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

export interface LearnerCourse {
  id: string;
  learnerId: string;
  linkedCourseId?: string;
  title: string;
  category: string;
  modality: TrainingModality;
  instructor: string;
  instructorAvatarUrl?: string;
  companySponsor: string;
  startDate: string;
  scheduleInfo: string;
  durationHours: number;
  lessons: LearnerLesson[];
  certificate?: LearnerCourseCertificate;
  description?: string;
  coverImage?: string;
  rating?: number;
  reviewsCount?: number;
  level?: string;
  objectives?: string[];
  sections?: LearnerCourseSection[];
  questions?: LearnerCourseQuestion[];
  notes?: LearnerLessonNote[];
}

export interface LearnerProfile {
  id: string;
  email: string;
  name: string;
  companyName: string;
  jobTitle: string;
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

export interface InstructorProfile {
  id: string;
  email: string;
  name: string;
  specialty: string;
  city: string;
  avatarUrl?: string;
}

export interface InstructorEnrollment {
  id: string;
  courseId: string;
  courseTitle: string;
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

export interface ProviderProfile {
  id: string;
  email: string;
  name: string;
  companyName: string;
  roleTitle: string;
  city: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
}

export type AuthSpace =
  | 'intranet'
  | 'accounting'
  | 'learner'
  | 'instructor'
  | 'provider'
  | 'superadmin';

export type UserAccountStatus = 'ACTIVE' | 'SUSPENDED';

export interface AuthSessionSummary {
  userId: string;
  space: AuthSpace;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  subtitle?: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
}

export interface AccountDirectoryEntry {
  userId: string;
  space: AuthSpace;
  name: string;
  email: string;
  role: string;
  subtitle: string;
  organizationId: string;
  organizationName: string;
  status?: UserAccountStatus;
  avatarUrl?: string;
  companyLogoUrl?: string;
}

export interface ManagedUserRecord {
  userId: string;
  space: AuthSpace;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  subtitle: string;
  city?: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
  status: UserAccountStatus;
  createdAt: string;
  lastLoginAt?: string;
  activeSessionsCount: number;
  ownedRecordsCount: number;
  activitySummary: string;
}

export interface PlatformAuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorSpace: AuthSpace;
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
  beneficiaryAvatarUrl?: string;
  beneficiaryLogoUrl?: string;
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

export interface CommissionPartnerSummary {
  beneficiaryType: CommissionBeneficiaryType;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryOrg: string;
  avatarUrl?: string;
  companyLogoUrl?: string;
  transactionsCount: number;
  grossTotalFcfa: number;
  commissionTotalFcfa: number;
  netPartnerTotalFcfa: number;
  pendingCommissionFcfa: number;
  collectedCommissionFcfa: number;
  effectiveRatePercent: number;
}

export interface CommissionOverviewPayload {
  kpis: {
    totalRecords: number;
    grossVolumeFcfa: number;
    totalCommissionFcfa: number;
    instructorCommissionFcfa: number;
    providerCommissionFcfa: number;
    pendingValidationFcfa: number;
    collectedOrSettledFcfa: number;
    netPartnerTotalFcfa: number;
    pendingCount: number;
    activeRulesCount: number;
  };
  chartByType: Array<{
    type: CommissionBeneficiaryType;
    label: string;
    grossFcfa: number;
    commissionFcfa: number;
    netPartnerFcfa: number;
    count: number;
  }>;
  partnerSummaries: CommissionPartnerSummary[];
  rules: CommissionRule[];
  records: CommissionRecord[];
  partners: {
    instructors: Array<{ id: string; name: string; subtitle: string; email: string; avatarUrl?: string }>;
    providers: Array<{ id: string; name: string; companyName: string; email: string; avatarUrl?: string; companyLogoUrl?: string }>;
  };
  categories: string[];
}

export interface SuperadminOverviewPayload {
  kpis: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    activeSessionsTotal: number;
    organizationsCount: number;
    totalTrackedRecords: number;
  };
  usersBySpace: Array<{
    space: AuthSpace;
    label: string;
    total: number;
    active: number;
    suspended: number;
    sessions: number;
  }>;
  moduleStats: {
    crmContacts: number;
    crmDocuments: number;
    accountingEntries: number;
    instructorCourses: number;
    learnerEnrollments: number;
    providerOffers: number;
    providerRequests: number;
    platformEvents: number;
  };
  users: ManagedUserRecord[];
  auditLogs: PlatformAuditLog[];
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

export interface TaskAssigneeOption {
  userId: string;
  name: string;
  role: string;
  space: AuthSpace;
  organizationId: string;
}

export interface TasksOverviewPayload {
  tasks: PlatformTask[];
  assignableUsers: TaskAssigneeOption[];
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    overdue: number;
    urgent: number;
    completionRate: number;
  };
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

export interface PlanningOverviewPayload {
  entries: PlanningEntry[];
  syncedTasks: PlatformTask[];
  syncedEvents: EventRecord[];
  syncedTrainings: TrainingProgram[];
  syncedProviderRequests: ProviderServiceRequest[];
  teamMembers: TaskAssigneeOption[];
}

export type SharedAvailabilityPermissionScope =
  | 'FULL_ORG'
  | 'TEAM_MANAGER'
  | 'COLLEAGUE_MASKED'
  | 'SELF_ONLY';

export interface SharedColleagueProfile {
  userId: string;
  name: string;
  jobTitle: string;
  department: string;
  site: string;
  isSelf: boolean;
}

export interface SharedUnavailabilityBlock {
  id: string;
  userId: string;
  userName: string;
  department: string;
  site: string;
  startDate: string;
  endDate: string;
  halfDay: 'FULL' | 'MORNING' | 'AFTERNOON';
  status: LeaveRequestStatus;
  statusLabel: string;
  displayLabel: string;
  leaveType?: LeaveTypeCode;
  reason?: string;
  masked: boolean;
  isSelf: boolean;
}

export interface SharedAvailabilityPayload {
  permissionScope: SharedAvailabilityPermissionScope;
  permissionTitle: string;
  permissionDescription: string;
  canViewLeaveReasons: boolean;
  canViewPendingLeaves: boolean;
  colleagues: SharedColleagueProfile[];
  unavailabilities: SharedUnavailabilityBlock[];
  holidays: SenegalHoliday[];
}

// --- Cahier des Charges Modules ---

// 1. RH, Congés, Pointage & Dossier Personnel (EF-030 à EF-044)
export type LeaveTypeCode =
  | 'ANNUEL'
  | 'MALADIE'
  | 'MATERNITE_PATERNITE'
  | 'MARIAGE'
  | 'DECES'
  | 'SANS_SOLDE'
  | 'RECUPERATION'
  | 'MISSION';

export type LeaveRequestStatus = 'EN_ATTENTE' | 'APPROUVE_N1' | 'APPROUVE' | 'REJETE' | 'ANNULE';

export interface SenegalHoliday {
  id: string;
  date: string;
  label: string;
  category: 'NATIONAL' | 'RELIGIEUX' | 'FERMETURE';
  isMobile: boolean;
}

export interface LeaveTypeRule {
  code: LeaveTypeCode;
  label: string;
  annualAllowanceDays: number;
  monthlyAccrualDays: number;
  carryoverMaxDays: number;
  requiresJustification: boolean;
  noticeDays: number;
  paid: boolean;
}

export interface LeaveBalanceRecord {
  userId: string;
  leaveType: LeaveTypeCode;
  acquiredDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface LeaveRequestRecord {
  id: string;
  reference: string;
  userId: string;
  userName: string;
  organizationId: string;
  department: string;
  site: string;
  leaveType: LeaveTypeCode;
  startDate: string;
  endDate: string;
  halfDay: 'FULL' | 'MORNING' | 'AFTERNOON';
  workingDays: number;
  reason: string;
  attachmentLabel?: string;
  status: LeaveRequestStatus;
  currentApproverName: string;
  decisionNote?: string;
  decidedByName?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface AttendanceEntry {
  id: string;
  userId: string;
  userName: string;
  organizationId: string;
  date: string;
  checkInTime: string;
  checkOutTime?: string;
  site: string;
  mode: 'DECLARATIF' | 'QR_SITE' | 'BADGEUSE';
  overtimeHours: number;
  status: 'PRESENT' | 'RETARD' | 'ABSENCE_JUSTIFIEE' | 'TELETRAVAIL';
  note?: string;
}

export interface EmployeeHrProfile {
  userId: string;
  matricule: string;
  name: string;
  email: string;
  phone: string;
  organizationId: string;
  department: string;
  service: string;
  site: string;
  jobTitle: string;
  managerName: string;
  contractType: 'CDI' | 'CDD' | 'STAGE' | 'PRESTATAIRE';
  hireDate: string;
  contractEndDate?: string;
  probationEndDate?: string;
  medicalVisitDate?: string;
  idExpiryDate?: string;
  workCycle: 'FIXE_08_17' | 'ROTATION_EQUIPE' | 'HYBRIDE';
  seniorityYears: number;
}

export interface HrAttestationRecord {
  id: string;
  reference: string;
  userId: string;
  userName: string;
  type: 'TRAVAIL' | 'CONGE' | 'SALAIRE' | 'STAGE';
  issuedAt: string;
  verificationCode: string;
  signedBy: string;
}

export interface HrAlertItem {
  id: string;
  userId: string;
  userName: string;
  category: 'FIN_ESSAI' | 'FIN_CDD' | 'VISITE_MEDICALE' | 'EXPIRATION_CNI';
  dueDate: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
}

export interface HrOverviewPayload {
  profiles: EmployeeHrProfile[];
  ownProfile: EmployeeHrProfile | null;
  leaveRules: LeaveTypeRule[];
  holidays: SenegalHoliday[];
  balances: LeaveBalanceRecord[];
  leaveRequests: LeaveRequestRecord[];
  attendance: AttendanceEntry[];
  attestations: HrAttestationRecord[];
  alerts: HrAlertItem[];
  canManageTeam: boolean;
  stats: {
    headcount: number;
    pendingLeaves: number;
    approvedDaysThisMonth: number;
    presentToday: number;
    alertsCount: number;
  };
}

// 2. Demandes & Circuits de Validation (EF-090 à EF-099, EF-011)
export type WorkflowCategory =
  | 'CONGE'
  | 'ATTESTATION'
  | 'AVANCE_SALAIRE'
  | 'MATERIEL'
  | 'ORDRE_MISSION'
  | 'NOTE_FRAIS'
  | 'FORMATION'
  | 'DEMANDE_LIBRE';

export type WorkflowStatus =
  | 'EN_ATTENTE'
  | 'COMPLEMENT_REQUIS'
  | 'APPROUVEE'
  | 'REJETEE'
  | 'ANNULEE';

export interface DynamicFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

export interface DynamicFormTemplate {
  id: string;
  code: string;
  category: WorkflowCategory;
  title: string;
  description: string;
  version: number;
  fields: DynamicFormField[];
  approvalSteps: string[];
  slaHours: number;
  active: boolean;
}

export interface WorkflowHistoryStep {
  id: string;
  stepLabel: string;
  actorId: string;
  actorName: string;
  action: 'SOUMIS' | 'APPROUVE' | 'REJETE' | 'COMPLEMENT' | 'DELEGUE' | 'RELANCE';
  comment: string;
  timestamp: string;
}

export interface WorkflowComment {
  id: string;
  authorId: string;
  authorName: string;
  visibility: 'PUBLIC' | 'INTERNE_VALIDEURS';
  content: string;
  createdAt: string;
}

export interface WorkflowInstanceRecord {
  id: string;
  reference: string;
  templateId: string;
  templateVersion: number;
  category: WorkflowCategory;
  title: string;
  requesterId: string;
  requesterName: string;
  organizationId: string;
  space: AuthSpace;
  department: string;
  amountFcfa?: number;
  formValues: Record<string, string>;
  steps: string[];
  currentStepIndex: number;
  currentApproverRole: string;
  status: WorkflowStatus;
  slaDeadlineAt: string;
  verificationQrCode?: string;
  history: WorkflowHistoryStep[];
  comments: WorkflowComment[];
  createdAt: string;
  updatedAt: string;
}

export interface DelegationRecord {
  id: string;
  delegatorUserId: string;
  delegatorName: string;
  delegateUserId: string;
  delegateName: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  scope: string;
  active: boolean;
}

export interface WorkflowsOverviewPayload {
  templates: DynamicFormTemplate[];
  requests: WorkflowInstanceRecord[];
  inboxRequests: WorkflowInstanceRecord[];
  delegations: DelegationRecord[];
  canConfigure: boolean;
  canApprove: boolean;
  stats: {
    myPending: number;
    toApproveCount: number;
    approvedCount: number;
    avgTurnaroundHours: number;
  };
}

// 3. GED & Documents (EF-110 à EF-119, EF-024)
export type DocumentClassification = 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL' | 'SECRET';

export interface GedFolder {
  id: string;
  name: string;
  department: string;
  organizationId: string;
  classification: DocumentClassification;
  retentionYears: number;
}

export interface GedDocumentVersion {
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  changeNote: string;
  sizeKb: number;
  fileName?: string;
  mimeType?: string;
  hasFileContent?: boolean;
}

export interface GedShareLink {
  id: string;
  token: string;
  expiresAt: string;
  hasPassword: boolean;
  accessCount: number;
}

export interface GedDocumentRecord {
  id: string;
  reference: string;
  folderId: string;
  title: string;
  category: 'BULLETIN_PAIE' | 'CONTRAT' | 'ATTESTATION' | 'PROCEDURE' | 'SUPPORT_COURS' | 'FACTURE_PIECE' | 'GOUVERNANCE';
  fileName?: string;
  fileExtension?: string;
  mimeType: string;
  sizeKb: number;
  hasFileContent?: boolean;
  organizationId: string;
  ownerUserId: string;
  ownerName: string;
  targetUserId?: string;
  classification: DocumentClassification;
  currentVersion: number;
  versions: GedDocumentVersion[];
  tags: string[];
  checkedOutBy?: string;
  signedByName?: string;
  signedAt?: string;
  requiresAcknowledgement: boolean;
  acknowledgedByIds: string[];
  shareLinks: GedShareLink[];
  retentionUntil: string;
  updatedAt: string;
}

export interface GedOverviewPayload {
  folders: GedFolder[];
  documents: GedDocumentRecord[];
  canManageGed: boolean;
  stats: {
    totalDocs: number;
    pendingAcknowledgements: number;
    signedDocs: number;
    totalSizeMb: number;
  };
}

// 4. Notes de service, Sondages & Annuaire (EF-050 à EF-061, EF-026)
export type OfficialMemoImportance = 'INFORMATION' | 'IMPORTANT' | 'URGENT';
export type OfficialMemoStatus = 'BROUILLON' | 'RELECTURE' | 'PUBLIEE' | 'ARCHIVEE';

export interface OfficialMemoRecord {
  id: string;
  reference: string;
  title: string;
  summary: string;
  body: string;
  importance: OfficialMemoImportance;
  status: OfficialMemoStatus;
  pinned: boolean;
  requiresAck: boolean;
  audienceLabel: string;
  organizationId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  publishedAt: string;
  expiresAt?: string;
  readByUserIds: string[];
  targetAudienceCount: number;
  lastReminderAt?: string;
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface InternalPollRecord {
  id: string;
  question: string;
  description: string;
  anonymous: boolean;
  organizationId: string;
  createdByName: string;
  closesAt: string;
  options: PollOption[];
  votedUserIds: string[];
  status: 'OUVERT' | 'CLOTURE';
}

export interface DirectoryMemberRecord {
  userId: string;
  name: string;
  email: string;
  phone: string;
  space: AuthSpace;
  role: string;
  jobTitle: string;
  department: string;
  site: string;
  skills: string[];
  organizationId: string;
  organizationName: string;
  hidePersonalPhone: boolean;
  avatarUrl?: string;
  companyLogoUrl?: string;
}

export interface CommsOverviewPayload {
  memos: OfficialMemoRecord[];
  polls: InternalPollRecord[];
  directory: DirectoryMemberRecord[];
  canPublishMemo: boolean;
  stats: {
    publishedMemos: number;
    unreadRequiredMemos: number;
    openPolls: number;
    directoryCount: number;
  };
}

// 5. Notifications Intelligentes & Préférences (EF-130 à EF-137)
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH_WEB';
export type NotificationPriority = 'BASSE' | 'NORMALE' | 'HAUTE' | 'URGENTE';

export interface NotificationItem {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  message: string;
  category: 'RH' | 'WORKFLOW' | 'NOTE_SERVICE' | 'PLANNING' | 'GED' | 'SYSTEME';
  priority: NotificationPriority;
  channelsSent: NotificationChannel[];
  targetSection?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushWebEnabled: boolean;
  dailyDigest: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
}

export interface NotificationsOverviewPayload {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences;
  deliveryStats: {
    sent24h: number;
    deliveryRatePct: number;
    smsQuotaUsed: number;
    smsQuotaLimit: number;
  };
}

// 6. Administration Organisation, Structure & Marque Blanche (EF-009 à EF-013, EF-170 à EF-177)
export interface OrgUnitNode {
  id: string;
  name: string;
  type: 'DIRECTION' | 'DEPARTEMENT' | 'SERVICE' | 'EQUIPE';
  parentId?: string;
  leadName: string;
  site: string;
  headcount: number;
}

export interface OrgSite {
  id: string;
  name: string;
  city: string;
  address: string;
  agentCount: number;
}

export interface OrgThemeConfig {
  organizationId: string;
  displayName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  memberLabel: 'Collaborateur' | 'Agent';
  unitLabel: 'Direction' | 'Département';
  locale: 'fr-SN' | 'en-US';
  timezone: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  enabledModules: string[];
}

export interface OrgApiToken {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
}

export interface OrgWebhook {
  id: string;
  url: string;
  events: string[];
  hmacSecretMasked: string;
  active: boolean;
  lastDeliveryStatus: 'OK' | 'PENDING';
}

export interface OrgBackupSnapshot {
  id: string;
  createdAt: string;
  sizeMb: number;
  type: 'QUOTIDIENNE_AUTO' | 'MANUELLE';
  status: 'VERIFIEE' | 'EN_COURS';
}

export interface OrgAdminOverviewPayload {
  theme: OrgThemeConfig;
  units: OrgUnitNode[];
  sites: OrgSite[];
  tokens: OrgApiToken[];
  webhooks: OrgWebhook[];
  backups: OrgBackupSnapshot[];
  canEditAdmin: boolean;
}

// 7. Courrier Institutionnel, Visiteurs & Ressources Partagées (EF-077, §4.15)
export type InstitutionalMailDirection = 'ARRIVEE' | 'DEPART';

export interface InstitutionalMailRecord {
  id: string;
  reference: string;
  direction: InstitutionalMailDirection;
  subject: string;
  correspondent: string;
  confidentiality: DocumentClassification;
  imputedToName: string;
  department: string;
  dueDate: string;
  status: 'ENREGISTRE' | 'IMPUTE' | 'EN_TRAITEMENT' | 'TRAITE' | 'ARCHIVE';
  createdAt: string;
}

export interface VisitorLogRecord {
  id: string;
  visitorName: string;
  organization: string;
  idDocumentNumber: string;
  hostName: string;
  site: string;
  purpose: string;
  badgeCode: string;
  checkInAt: string;
  checkOutAt?: string;
  status: 'SUR_SITE' | 'SORTI';
}

export interface SharedResourceBooking {
  id: string;
  resourceName: string;
  resourceType: 'SALLE' | 'VEHICULE' | 'MATERIEL_AV';
  site: string;
  date: string;
  startHour: number;
  endHour: number;
  bookedByUserId: string;
  bookedByName: string;
  purpose: string;
  status: 'CONFIRME' | 'EN_ATTENTE';
}

export interface OperationsOverviewPayload {
  mail: InstitutionalMailRecord[];
  visitors: VisitorLogRecord[];
  bookings: SharedResourceBooking[];
  resourcesCatalog: Array<{ name: string; type: 'SALLE' | 'VEHICULE' | 'MATERIEL_AV'; site: string; capacity: string }>;
  stats: {
    openMailCount: number;
    visitorsOnSite: number;
    bookingsToday: number;
  };
}

// 8. Back-Office Superadmin : Multi-Tenants, Facturation FCFA & Support (EF-190 à EF-197)
export type TenantPlanTier = 'STANDARD' | 'PREMIUM' | 'SOUVERAIN';
export type TenantStatus = 'ACTIF' | 'ESSAI_30J' | 'SUSPENDU_IMPAYE';

export interface TenantRecord {
  id: string;
  name: string;
  logoUrl?: string;
  subdomain: string;
  customDomain?: string;
  plan: TenantPlanTier;
  status: TenantStatus;
  adminEmail: string;
  userCount: number;
  userQuota: number;
  storageUsedGb: number;
  storageQuotaGb: number;
  monthlyFeeFcfa: number;
  enabledModules: string[];
  featureFlags: string[];
  createdAt: string;
}

export interface TenantInvoiceRecord {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  periodLabel: string;
  amountFcfa: number;
  paymentMethod: 'WAVE' | 'ORANGE_MONEY' | 'CARTE' | 'VIREMENT';
  status: 'PAYEE' | 'EN_ATTENTE' | 'EN_RETARD';
  issuedAt: string;
  paidAt?: string;
}

export interface SupportTicketRecord {
  id: string;
  reference: string;
  tenantId: string;
  tenantName: string;
  requesterName: string;
  subject: string;
  severity: 'P1_CRITIQUE' | 'P2_MAJEUR' | 'P3_STANDARD';
  status: 'OUVERT' | 'EN_COURS' | 'RESOLU';
  slaTarget: string;
  createdAt: string;
}

export interface ServiceHealthMetric {
  service: string;
  status: 'OPERATIONNEL' | 'DEGRADE';
  uptimePct: number;
  latencyMs: number;
}

export interface SuperadminTenantsPayload {
  tenants: TenantRecord[];
  invoices: TenantInvoiceRecord[];
  tickets: SupportTicketRecord[];
  servicesHealth: ServiceHealthMetric[];
  kpis: {
    totalTenants: number;
    activeTenants: number;
    trialTenants: number;
    mrrFcfa: number;
    arrFcfa: number;
    churnPct: number;
    openTickets: number;
  };
}

// 9. Chaîne des Ordres de Mission & Frais de Déplacement (Secteur Public / Sénégal)
export type MissionZone =
  | 'DAKAR_PERIPHERIE'
  | 'SENEGAL_INTERIEUR'
  | 'UEMOA_AFRIQUE'
  | 'HORS_AFRIQUE';

export type MissionAgentCategory =
  | 'CAT_A_HAUTE_DIRECTION'
  | 'CAT_B_CADRE'
  | 'CAT_C_EXECUTION';

export type MissionTransportMode =
  | 'VEHICULE_ADMIN'
  | 'TRANSPORT_PUBLIC'
  | 'AVION'
  | 'VEHICULE_PERSONNEL';

export type MissionStatus =
  | 'BROUILLON'
  | 'SOUMIS_N1'
  | 'VISA_DAGE'
  | 'APPROUVE_SG'
  | 'EN_MISSION'
  | 'RAPPORT_DEPOSE'
  | 'CLOTURE'
  | 'REJETE';

export interface MissionPerDiemTariff {
  zone: MissionZone;
  zoneLabel: string;
  category: MissionAgentCategory;
  categoryLabel: string;
  dailyRateFcfa: number;
  lodgingCeilingFcfa: number;
}

export interface MissionExpenseLine {
  id: string;
  category: 'PER_DIEM' | 'HEBERGEMENT' | 'CARBURANT_PEAGE' | 'BILLET_TRANSPORT' | 'DIVERS';
  label: string;
  estimatedFcfa: number;
  actualFcfa?: number;
  receiptRef?: string;
}

export interface MissionApprovalStep {
  id: string;
  stepLabel: string;
  actorName: string;
  action: 'CREATION' | 'SOUMIS' | 'VISA_N1' | 'VISA_DAGE' | 'SIGNATURE_SG' | 'RAPPORT' | 'CLOTURE' | 'REJET';
  note?: string;
  timestamp: string;
}

export interface MissionOrderRecord {
  id: string;
  reference: string;
  agentUserId: string;
  agentName: string;
  agentJobTitle: string;
  agentCategory: MissionAgentCategory;
  department: string;
  organizationId: string;
  title: string;
  destination: string;
  zone: MissionZone;
  departureDate: string;
  returnDate: string;
  daysCount: number;
  transportMode: MissionTransportMode;
  vehicleName?: string;
  bookingId?: string;
  perDiemDailyFcfa: number;
  perDiemTotalFcfa: number;
  lodgingEstimateFcfa: number;
  transportEstimateFcfa: number;
  totalEstimatedFcfa: number;
  advanceRequestedPct: 0 | 50 | 80 | 100;
  advancePaidFcfa: number;
  actualSpentFcfa?: number;
  balanceToSettleFcfa?: number;
  expenseLines: MissionExpenseLine[];
  status: MissionStatus;
  currentApproverRole: string;
  approvalTrail: MissionApprovalStep[];
  missionReportSummary?: string;
  missionReportSubmittedAt?: string;
  verificationQrCode: string;
  createdAt: string;
}

export interface MissionDestinationCity {
  id: string;
  city: string;
  regionOrCountry: string;
  zone: MissionZone;
  distanceFromDakarKm: number;
  tollRoundTripFcfa: number;
  flightEstimateFcfa?: number;
  publicTransitRoundTripFcfa?: number;
}

export interface MissionCalculationBreakdown {
  cityId?: string;
  cityName: string;
  regionOrCountry: string;
  zone: MissionZone;
  zoneLabel: string;
  category: MissionAgentCategory;
  categoryLabel: string;
  daysCount: number;
  nightsCount: number;
  distanceRoundTripKm: number;
  dailyPerDiemRateFcfa: number;
  effectiveDailyPerDiemFcfa: number;
  perDiemTotalFcfa: number;
  lodgingCeilingPerNightFcfa: number;
  lodgingTotalFcfa: number;
  transportAllowanceFcfa: number;
  tollFcfa: number;
  totalTransportFcfa: number;
  totalEstimatedFcfa: number;
  advanceRequestedPct: 0 | 50 | 80 | 100;
  advanceAmountFcfa: number;
  balanceAfterMissionFcfa: number;
  lodgingCoveredByHost: boolean;
  mealsCoveredByHost: boolean;
  legalReference: string;
}

export interface MissionOverviewPayload {
  missions: MissionOrderRecord[];
  tariffs: MissionPerDiemTariff[];
  destinationCities: MissionDestinationCity[];
  vehiclesCatalog: Array<{ name: string; site: string; capacity: string }>;
  canValidateN1: boolean;
  canValidateDage: boolean;
  canApproveSg: boolean;
  hasPendingReportBlock: boolean;
  blockingMissionRef?: string;
  stats: {
    total: number;
    inApproval: number;
    activeMissions: number;
    awaitingReport: number;
    totalCommittedFcfa: number;
    totalAdvancePaidFcfa: number;
  };
}

// 10. Organisation des Cours Formateurs & Demandes de Formation Temps Réel
export type CourseSessionStatus =
  | 'PLANIFIEE'
  | 'CONFIRMEE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'REPORTEE'
  | 'ANNULEE';

export interface CourseSessionChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface CourseOrganizationSession {
  id: string;
  courseId: string;
  courseTitle: string;
  instructorId: string;
  instructorName: string;
  cohortName: string;
  chapterId?: string;
  chapterTitle?: string;
  modality: TrainingModality;
  sessionDate: string;
  startTime: string;
  endTime: string;
  locationOrLink: string;
  maxSeats: number;
  enrolledCount: number;
  status: CourseSessionStatus;
  linkedRequestId?: string;
  notes?: string;
  checklist: CourseSessionChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

export type TrainingRequestStage =
  | 'NOUVELLE_DEMANDE'
  | 'ANALYSE_BESOIN'
  | 'DEVIS_ENVOYE'
  | 'VALIDEE_PLANIFIEE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'REFUSEE';

export interface TrainingRequestMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  createdAt: string;
}

export interface TrainingRequestHistoryEvent {
  id: string;
  actorName: string;
  action: string;
  stage: TrainingRequestStage;
  timestamp: string;
}

export interface TrainingRequestRecord {
  id: string;
  reference: string;
  title: string;
  category: string;
  courseId?: string;
  courseTitle?: string;
  instructorId?: string;
  instructorName?: string;
  instructorAvatarUrl?: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterSpace: AuthSpace;
  organizationName: string;
  modality: TrainingModality;
  participantsCount: number;
  desiredStartDate: string;
  durationHours: number;
  locationOrCity: string;
  objectives: string;
  budgetEstimatedFcfa: number;
  quotedAmountFcfa?: number;
  quoteNumber?: string;
  conventionNumber?: string;
  priority: 'NORMALE' | 'HAUTE' | 'URGENTE';
  stage: TrainingRequestStage;
  scheduledSessionId?: string;
  canManage?: boolean;
  messages: TrainingRequestMessage[];
  history: TrainingRequestHistoryEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface TrainingRequestsOverviewPayload {
  requests: TrainingRequestRecord[];
  instructorsCatalog: Array<{ id: string; name: string; specialty: string; city: string; avatarUrl?: string }>;
  kpis: {
    total: number;
    newCount: number;
    inProgressCount: number;
    validatedOrRunningCount: number;
    completedCount: number;
    totalVolumeFcfa: number;
    conversionRatePct: number;
  };
}

// 11. Outil de Rédaction de Rapports de Mission & Rapports de Travail
export type WorkReportType =
  | 'RAPPORT_MISSION'
  | 'RAPPORT_TRAVAIL_HEBDO'
  | 'RAPPORT_TRAVAIL_MENSUEL'
  | 'RAPPORT_PROJET'
  | 'RAPPORT_DIRECTION';

export type WorkReportStatus =
  | 'BROUILLON'
  | 'SOUMIS'
  | 'REVISION_DEMANDEE'
  | 'VALIDE'
  | 'ARCHIVE';

export type WorkReportAudienceRole = 'EMPLOYEE' | 'MANAGER' | 'DIRECTION' | 'ALL';

export interface WorkReportKpiItem {
  id: string;
  label: string;
  targetValue: string;
  actualValue: string;
  unit?: string;
  status: 'ATTEINT' | 'EN_COURS' | 'ECART';
}

export interface WorkReportActionItem {
  id: string;
  action: string;
  owner: string;
  deadline: string;
  priority: 'NORMALE' | 'HAUTE' | 'URGENTE';
  status: 'A_LANCER' | 'EN_COURS' | 'FAIT';
}

export interface WorkReportReviewStep {
  id: string;
  stepLabel: string;
  actorName: string;
  actorRole: string;
  action: 'CREATION' | 'MISE_A_JOUR' | 'SOUMIS' | 'REVISION' | 'VALIDATION' | 'ARCHIVE';
  note?: string;
  timestamp: string;
}

export interface WorkReportTemplate {
  id: string;
  code: string;
  type: WorkReportType;
  title: string;
  targetRoles: WorkReportAudienceRole[];
  defaultObjective: string;
  contextPrompts: string[];
  achievementPrompts: string[];
  riskPrompts: string[];
  recommendationPrompts: string[];
  suggestedKpis: Array<{ label: string; targetValue: string; unit?: string }>;
}

export interface WorkReportRecord {
  id: string;
  reference: string;
  type: WorkReportType;
  status: WorkReportStatus;
  title: string;
  authorUserId: string;
  authorName: string;
  authorJobTitle: string;
  authorRole: string;
  department: string;
  organizationId: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  location?: string;
  linkedMissionId?: string;
  linkedMissionRef?: string;
  linkedTaskCodes: string[];
  executiveSummary: string;
  contextAndObjectives: string;
  activitiesAndDeliverables: string;
  difficultiesAndRisks: string;
  recommendationsAndNextSteps: string;
  kpis: WorkReportKpiItem[];
  actionPlan: WorkReportActionItem[];
  attachmentsNote?: string;
  reviewerName?: string;
  reviewNote?: string;
  completenessPct: number;
  wordCount: number;
  reviewTrail: WorkReportReviewStep[];
  submittedAt?: string;
  validatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkReportMissionOption {
  id: string;
  reference: string;
  title: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  daysCount: number;
  agentName: string;
  department: string;
  totalEstimatedFcfa: number;
  actualSpentFcfa?: number;
  status: MissionStatus;
}

export interface WorkReportTaskOption {
  id: string;
  code: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  dueDate?: string;
  assigneeName: string;
  linkedRecordLabel?: string;
}

export interface WorkReportsOverviewPayload {
  reports: WorkReportRecord[];
  templates: WorkReportTemplate[];
  missionsCatalog: WorkReportMissionOption[];
  tasksCatalog: WorkReportTaskOption[];
  canReviewReports: boolean;
  canFinalValidate: boolean;
  actorRoleGroup: 'DIRECTION' | 'MANAGER' | 'EMPLOYEE';
  stats: {
    total: number;
    drafts: number;
    submitted: number;
    revisionRequested: number;
    validated: number;
    missionReportsCount: number;
    workReportsCount: number;
  };
}

// 12. Module Communication & Collaboration Teams (Messagerie, Visio, Partage & Coédition)
export type TeamsConversationKind =
  | 'CHANNEL'
  | 'PROJECT'
  | 'FORMATION'
  | 'ONBOARDING'
  | 'GROUP'
  | 'DM';

export type TeamsPresenceStatus = 'ONLINE' | 'IN_MEETING' | 'BUSY' | 'OFFLINE';

export interface TeamsParticipantSummary {
  userId: string;
  name: string;
  email: string;
  role: string;
  space: AuthSpace;
  title: string;
  organizationName: string;
  avatarUrl?: string;
  presence: TeamsPresenceStatus;
}

export interface TeamsConversationRecord {
  id: string;
  kind: TeamsConversationKind;
  name: string;
  slug: string;
  topic?: string;
  organizationId: string;
  isPrivate: boolean;
  memberIds: string[];
  createdByUserId: string;
  createdByName: string;
  linkedCourseTitle?: string;
  linkedProjectCode?: string;
  unreadCount?: number;
  lastMessageAt?: string;
}

export interface TeamsMessageAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export interface TeamsMessageReaction {
  emoji: string;
  userIds: string[];
}

export interface TeamsMessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatarUrl?: string;
  content: string;
  replyToId?: string;
  replyToPreview?: string;
  attachment?: TeamsMessageAttachment;
  linkedDocId?: string;
  linkedDocTitle?: string;
  reactions: TeamsMessageReaction[];
  createdAt: string;
}

export type TeamsMeetingMode = 'AUDIO' | 'VIDEO' | 'COURS_DISTANT' | 'REUNION_PROJET';
export type TeamsMeetingStatus = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE';

export interface TeamsMeetingRecording {
  id: string;
  meetingId: string;
  conversationId: string;
  title: string;
  durationSeconds: number;
  recordedByName: string;
  sizeBytes: number;
  mimeType: string;
  dataUrl?: string;
  createdAt: string;
}

export interface TeamsMeetingRecord {
  id: string;
  conversationId: string;
  conversationName: string;
  title: string;
  mode: TeamsMeetingMode;
  status: TeamsMeetingStatus;
  hostUserId: string;
  hostName: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  activeParticipantIds: string[];
  activeParticipantNames: string[];
  screenSharingUserId?: string;
  screenSharingUserName?: string;
  isRecording: boolean;
  recordingStartedBy?: string;
  recordings: TeamsMeetingRecording[];
  notesSummary?: string;
}

export type TeamsDocCategory = 'COMPTE_RENDU' | 'PROJET' | 'COURS_SUPPORT' | 'DEVOIR_GROUPE' | 'ONBOARDING';
export type TeamsHomeworkStatus = 'BROUILLON' | 'RENDU' | 'CORRIGE';

export interface TeamsCollabDocVersion {
  id: string;
  editorName: string;
  summary: string;
  contentSnapshot: string;
  savedAt: string;
}

export interface TeamsCollabDoc {
  id: string;
  conversationId: string;
  title: string;
  category: TeamsDocCategory;
  content: string;
  createdByUserId: string;
  createdByName: string;
  lastEditedByUserId: string;
  lastEditedByName: string;
  activeEditorNames: string[];
  homeworkStatus?: TeamsHomeworkStatus;
  homeworkGrade?: string;
  homeworkFeedback?: string;
  versions: TeamsCollabDocVersion[];
  createdAt: string;
  updatedAt: string;
}

export type TeamsFileCategory = 'DOCUMENT' | 'SUPPORT_COURS' | 'DEVOIR' | 'ENREGISTREMENT' | 'IMAGE';

export interface TeamsSharedFile {
  id: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  category: TeamsFileCategory;
  uploadedByUserId: string;
  uploadedByName: string;
  homeworkStatus?: TeamsHomeworkStatus;
  createdAt: string;
}

export interface TeamsWorkspacePayload {
  currentUser: TeamsParticipantSummary;
  conversations: TeamsConversationRecord[];
  messages: TeamsMessageRecord[];
  meetings: TeamsMeetingRecord[];
  collabDocs: TeamsCollabDoc[];
  sharedFiles: TeamsSharedFile[];
  directory: TeamsParticipantSummary[];
  stats: {
    conversationsCount: number;
    unreadTotal: number;
    liveMeetingsCount: number;
    collabDocsCount: number;
    sharedFilesCount: number;
    onlineUsersCount: number;
  };
}

// =========================================================================
// Marketing & Retargeting (Smart Audiences, Multi-channel, Automations)
// =========================================================================

export type MarketingChannel = 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH';

export type MarketingAudienceSource =
  | 'CRM_CONTACTS'
  | 'OPEN_QUOTES'
  | 'UNPAID_INVOICES'
  | 'TRAINING_REQUESTS'
  | 'EVENT_GUESTS'
  | 'MULTI_SOURCE';

export type MarketingRuleField =
  | 'CONTACT_TYPE'
  | 'PIPELINE_STAGE'
  | 'WHATSAPP_OPTIN'
  | 'SECTOR'
  | 'MIN_AMOUNT_FCFA'
  | 'INACTIVE_DAYS'
  | 'HAS_EMAIL'
  | 'HAS_PHONE';

export type MarketingRuleOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'GTE' | 'IS_TRUE';

export interface MarketingAudienceRule {
  id: string;
  field: MarketingRuleField;
  operator: MarketingRuleOperator;
  value: string;
}

export interface MarketingAudienceMember {
  id: string;
  name: string;
  organizationName: string;
  email: string;
  phone: string;
  sourceLabel: string;
  pipelineStage?: string;
  sector?: string;
  pendingAmountFcfa: number;
  lastActivityDate: string;
  channelsAvailable: MarketingChannel[];
}

export interface MarketingSmartAudience {
  id: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  sourceScope: MarketingAudienceSource;
  matchMode: 'ALL' | 'ANY';
  rules: MarketingAudienceRule[];
  preferredChannels: MarketingChannel[];
  autoRefresh: boolean;
  matchedCount: number;
  reachableWhatsapp: number;
  reachableSms: number;
  reachableEmail: number;
  reachablePush: number;
  potentialValueFcfa: number;
  matchedTargets: MarketingAudienceMember[];
  createdAt: string;
  updatedAt: string;
}

export type MarketingCampaignObjective =
  | 'RETARGETING_DEVIS'
  | 'RECOUVREMENT_FACTURE'
  | 'ABANDON_INSCRIPTION'
  | 'REACTIVATION_CLIENT'
  | 'EVENEMENT_VIP'
  | 'PROMOTION_FORMATION';

export type MarketingCampaignStatus = 'BROUILLON' | 'PLANIFIEE' | 'ACTIVE' | 'EN_PAUSE' | 'TERMINEE';

export interface MarketingChannelContent {
  subject?: string;
  title?: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface MarketingCampaignRecord {
  id: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  objective: MarketingCampaignObjective;
  audienceId: string;
  audienceName: string;
  channels: MarketingChannel[];
  channelMessages: Partial<Record<MarketingChannel, MarketingChannelContent>>;
  status: MarketingCampaignStatus;
  scheduledAt?: string;
  targetCount: number;
  dispatchedCount: number;
  deliveredCount: number;
  openedOrClickedCount: number;
  convertedCount: number;
  revenueRecoveredFcfa: number;
  createdAt: string;
  lastDispatchedAt?: string;
}

export type MarketingTriggerEvent =
  | 'DEVIS_SANS_REPONSE'
  | 'FACTURE_IMPAYEE'
  | 'INSCRIPTION_FORMATION_INCOMPLETE'
  | 'CONTACT_INACTIF'
  | 'POST_EVENEMENT';

export type MarketingStepCondition = 'ALWAYS' | 'IF_NO_REPLY' | 'IF_NO_PAYMENT';

export interface MarketingAutomationStep {
  id: string;
  stepOrder: number;
  delayDays: number;
  channel: MarketingChannel;
  condition: MarketingStepCondition;
  subject?: string;
  messageTemplate: string;
  sentCount: number;
}

export interface MarketingAutomationWorkflow {
  id: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  triggerEvent: MarketingTriggerEvent;
  triggerDelayDays: number;
  audienceId?: string;
  audienceName?: string;
  status: 'ACTIVE' | 'EN_PAUSE' | 'BROUILLON';
  steps: MarketingAutomationStep[];
  enrolledCount: number;
  completedCount: number;
  conversionsCount: number;
  recoveredFcfa: number;
  lastTriggeredAt?: string;
  createdAt: string;
}

export type MarketingDispatchStatus =
  | 'EN_ATTENTE'
  | 'ENVOYE'
  | 'DELIVRE'
  | 'OUVERT'
  | 'CLIQUE'
  | 'CONVERTI'
  | 'ECHOUE';

export interface MarketingDispatchLog {
  id: string;
  ownerUserId: string;
  organizationId: string;
  campaignId?: string;
  campaignName?: string;
  automationId?: string;
  automationName?: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  channel: MarketingChannel;
  subject?: string;
  messageBody: string;
  status: MarketingDispatchStatus;
  amountRelatedFcfa: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingChannelMetric {
  channel: MarketingChannel;
  dispatched: number;
  delivered: number;
  engaged: number;
  converted: number;
  deliveryRate: number;
  conversionRate: number;
}

export interface MarketingOverviewPayload {
  audiences: MarketingSmartAudience[];
  campaigns: MarketingCampaignRecord[];
  automations: MarketingAutomationWorkflow[];
  dispatches: MarketingDispatchLog[];
  channelMetrics: MarketingChannelMetric[];
  summary: {
    totalReachableContacts: number;
    smartAudiencesCount: number;
    activeCampaignsCount: number;
    activeAutomationsCount: number;
    totalDispatched: number;
    conversionRate: number;
    recoverablePipelineFcfa: number;
    recoveredRevenueFcfa: number;
  };
}



