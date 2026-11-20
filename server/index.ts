import 'dotenv/config';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http, { type IncomingMessage } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import type {
  CourseOrganizationSession,
  CourseSessionChecklistItem,
  CourseSessionStatus,
  TrainingRequestRecord,
  TrainingRequestStage,
  TrainingRequestsOverviewPayload,
} from '../src/types.js';
import {
  db,
  simpleHash,
  store,
  type AccountingEntryLine,
  type AccountingUser,
  type CommissionBeneficiaryType,
  type CommissionPayoutMethod,
  type CommissionRecord,
  type CommissionRule,
  type CommissionRuleScope,
  type CommissionStatus,
  type InstructorCourse,
  type InstructorEnrollment,
  type InstructorUser,
  type IntranetAttachment,
  type IntranetUser,
  type LearnerCourse,
  type LearnerUser,
  type PlanningEntry,
  type PlanningEntryStatus,
  type PlanningEntryType,
  type PlatformAuditLog,
  type PlatformTask,
  type ProviderRequestStage,
  type ProviderServiceOffer,
  type ProviderServiceRequest,
  type ProviderUser,
  type ServerCommercialDocument,
  type ServerCrmContact,
  type ServerDocumentPayment,
  type SuperadminUser,
  type TaskCategory,
  type TaskChecklistItem,
  type TaskPriority,
  type TaskStatus,
  type UserAccountStatus,
} from './db.js';
import { getCahierCollections, registerCahierModules } from './cahierModules.js';
import { getMarketingCampaignsList, registerMarketingModule } from './marketingModule.js';
import { getTeamsCollections, registerTeamsModule } from './teamsModule.js';
import {
  attachPersistenceMiddleware,
  loadServerSnapshot,
  scheduleServerSave,
} from './persistence.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

interface SessionRecord<T> {
  id: string;
  user: T;
  createdAt: number;
}

const accountingSessions = new Map<string, SessionRecord<AccountingUser>>();
const intranetSessions = new Map<string, SessionRecord<IntranetUser>>();
const learnerSessions = new Map<string, SessionRecord<LearnerUser>>();
const instructorSessions = new Map<string, SessionRecord<InstructorUser>>();
const providerSessions = new Map<string, SessionRecord<ProviderUser>>();
const superadminSessions = new Map<string, SessionRecord<SuperadminUser>>();

type PlatformSpace = 'intranet' | 'accounting' | 'learner' | 'instructor' | 'provider' | 'superadmin';

interface TrainingRealtimeEvent {
  eventType:
    | 'training_request:created'
    | 'training_request:updated'
    | 'training_request:message'
    | 'course_session:updated'
    | 'course_chapters:reordered';
  request?: TrainingRequestRecord;
  session?: CourseOrganizationSession;
  deletedSessionId?: string;
  courseId?: string;
  instructorId?: string;
  timestamp: string;
}

const trainingRealtimeBus = new EventEmitter();
trainingRealtimeBus.setMaxListeners(100);

function broadcastTrainingRealtime(event: Omit<TrainingRealtimeEvent, 'timestamp'>): void {
  trainingRealtimeBus.emit('training_event', {
    ...event,
    timestamp: new Date().toISOString(),
  });
}

function addAuditLog(entry: Omit<PlatformAuditLog, 'id' | 'timestamp'>): void {
  store.auditLogs.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  });
  if (store.auditLogs.length > 250) {
    store.auditLogs.length = 250;
  }
}

function getSessionMapForSpace(
  space: PlatformSpace,
): Map<string, SessionRecord<{ id: string }>> {
  switch (space) {
    case 'intranet':
      return intranetSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
    case 'accounting':
      return accountingSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
    case 'learner':
      return learnerSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
    case 'instructor':
      return instructorSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
    case 'provider':
      return providerSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
    case 'superadmin':
      return superadminSessions as unknown as Map<string, SessionRecord<{ id: string }>>;
  }
}

function countUserSessions(space: PlatformSpace, userId: string): number {
  const map = getSessionMapForSpace(space);
  let count = 0;
  for (const rec of map.values()) {
    if (rec.user.id === userId) count += 1;
  }
  return count;
}

function revokeUserSessions(space: PlatformSpace, userId: string): number {
  const map = getSessionMapForSpace(space);
  let revoked = 0;
  for (const [token, rec] of map.entries()) {
    if (rec.user.id === userId) {
      map.delete(token);
      revoked += 1;
    }
  }
  return revoked;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

function extractToken(req: Request, cookieName: string): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[cookieName]) return cookies[cookieName];
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function setSessionCookie(res: Response, name: string, token: string): void {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getIntranetUser(req: Request): IntranetUser | null {
  const token = extractToken(req, 'tpd_intranet_session');
  if (!token) return null;
  const session = intranetSessions.get(token);
  if (!session) return null;
  const fresh = store.intranetUsers.find((u) => u.id === session.user.id);
  if (!fresh || fresh.status === 'SUSPENDED') return null;
  return fresh;
}

function getAccountingUser(req: Request): AccountingUser | null {
  const token = extractToken(req, 'tpd_acc_session');
  if (token && accountingSessions.has(token)) {
    const session = accountingSessions.get(token)!;
    const fresh = store.accountingUsers.find((u) => u.id === session.user.id);
    if (!fresh || fresh.status === 'SUSPENDED') return null;
    return fresh;
  }
  // Allow OWNER of the organization to access SYSCOHADA seamlessly
  const intranetOwner = getIntranetUser(req);
  if (intranetOwner && intranetOwner.role === 'OWNER') {
    return {
      id: intranetOwner.id,
      organizationId: 'tpd-demo-accounting',
      organizationName: intranetOwner.organizationName,
      email: intranetOwner.email,
      name: intranetOwner.name,
      role: 'OWNER',
      passwordHash: intranetOwner.passwordHash,
      status: intranetOwner.status,
    };
  }
  return null;
}

function getLearnerUser(req: Request): LearnerUser | null {
  const token = extractToken(req, 'tpd_learner_session');
  if (!token) return null;
  const session = learnerSessions.get(token);
  if (!session) return null;
  const fresh = store.learnerUsers.find((u) => u.id === session.user.id);
  if (!fresh || fresh.status === 'SUSPENDED') return null;
  return fresh;
}

function getInstructorUser(req: Request): InstructorUser | null {
  const token = extractToken(req, 'tpd_instructor_session');
  if (!token) return null;
  const session = instructorSessions.get(token);
  if (!session) return null;
  const fresh = store.instructorUsers.find((u) => u.id === session.user.id);
  if (!fresh || fresh.status === 'SUSPENDED') return null;
  return fresh;
}

function getProviderUser(req: Request): ProviderUser | null {
  const token = extractToken(req, 'tpd_provider_session');
  if (!token) return null;
  const session = providerSessions.get(token);
  if (!session) return null;
  const fresh = store.providerUsers.find((u) => u.id === session.user.id);
  if (!fresh || fresh.status === 'SUSPENDED') return null;
  return fresh;
}

function getSuperadminUser(req: Request): SuperadminUser | null {
  const token = extractToken(req, 'tpd_superadmin_session');
  if (!token) return null;
  const session = superadminSessions.get(token);
  if (!session) return null;
  const fresh = store.superadminUsers.find((u) => u.id === session.user.id);
  if (!fresh || fresh.status === 'SUSPENDED') return null;
  return fresh;
}

interface ActiveActor {
  id: string;
  space: PlatformSpace;
  role: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

function getActiveActor(req: Request): ActiveActor | null {
  const requestedSpace = req.headers['x-active-space'];
  const intUser = getIntranetUser(req);
  const accUser = (() => {
    const token = extractToken(req, 'tpd_acc_session');
    if (!token) return null;
    const session = accountingSessions.get(token);
    if (!session) return null;
    const fresh = store.accountingUsers.find((u) => u.id === session.user.id);
    if (!fresh || fresh.status === 'SUSPENDED') return null;
    return fresh;
  })();
  const lrnUser = getLearnerUser(req);
  const instUser = getInstructorUser(req);
  const provUser = getProviderUser(req);
  const supUser = getSuperadminUser(req);

  const candidates: ActiveActor[] = [];
  if (supUser) {
    candidates.push({
      id: supUser.id,
      space: 'superadmin',
      role: supUser.role,
      name: supUser.name,
      email: supUser.email,
      organizationId: 'tpd-superadmin',
      organizationName: 'Administration Plateforme',
    });
  }
  if (intUser) {
    candidates.push({
      id: intUser.id,
      space: 'intranet',
      role: intUser.role,
      name: intUser.name,
      email: intUser.email,
      organizationId: intUser.organizationId,
      organizationName: intUser.organizationName,
    });
  }
  if (accUser) {
    candidates.push({
      id: accUser.id,
      space: 'accounting',
      role: accUser.role,
      name: accUser.name,
      email: accUser.email,
      organizationId: accUser.organizationId,
      organizationName: accUser.organizationName,
    });
  }
  if (lrnUser) {
    candidates.push({
      id: lrnUser.id,
      space: 'learner',
      role: 'LEARNER',
      name: lrnUser.name,
      email: lrnUser.email,
      organizationId: lrnUser.companyName,
      organizationName: lrnUser.companyName,
    });
  }
  if (instUser) {
    candidates.push({
      id: instUser.id,
      space: 'instructor',
      role: 'INSTRUCTOR',
      name: instUser.name,
      email: instUser.email,
      organizationId: instUser.city,
      organizationName: `Formateur · ${instUser.city}`,
    });
  }
  if (provUser) {
    candidates.push({
      id: provUser.id,
      space: 'provider',
      role: 'PROVIDER',
      name: provUser.name,
      email: provUser.email,
      organizationId: provUser.companyName,
      organizationName: provUser.companyName,
    });
  }

  if (typeof requestedSpace === 'string') {
    const match = candidates.find((c) => c.space === requestedSpace);
    if (match) return match;
  }
  return candidates[0] ?? null;
}

function resolveSseActor(req: Request): ActiveActor | null {
  const fromHeadersOrCookie = getActiveActor(req);
  if (fromHeadersOrCookie) return fromHeadersOrCookie;

  const qToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const qSpace = typeof req.query.space === 'string' ? (req.query.space.trim() as PlatformSpace) : undefined;
  if (!qToken) return null;

  const checkSpace = (space: PlatformSpace): ActiveActor | null => {
    if (space === 'superadmin') {
      const s = superadminSessions.get(qToken);
      const u = s ? store.superadminUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'superadmin', role: u.role, name: u.name, email: u.email, organizationId: 'tpd-superadmin', organizationName: 'Administration Plateforme' }
        : null;
    }
    if (space === 'instructor') {
      const s = instructorSessions.get(qToken);
      const u = s ? store.instructorUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'instructor', role: 'INSTRUCTOR', name: u.name, email: u.email, organizationId: u.city, organizationName: `Formateur · ${u.city}` }
        : null;
    }
    if (space === 'intranet') {
      const s = intranetSessions.get(qToken);
      const u = s ? store.intranetUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'intranet', role: u.role, name: u.name, email: u.email, organizationId: u.organizationId, organizationName: u.organizationName }
        : null;
    }
    if (space === 'accounting') {
      const s = accountingSessions.get(qToken);
      const u = s ? store.accountingUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'accounting', role: u.role, name: u.name, email: u.email, organizationId: u.organizationId, organizationName: u.organizationName }
        : null;
    }
    if (space === 'learner') {
      const s = learnerSessions.get(qToken);
      const u = s ? store.learnerUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'learner', role: 'LEARNER', name: u.name, email: u.email, organizationId: u.companyName, organizationName: u.companyName }
        : null;
    }
    if (space === 'provider') {
      const s = providerSessions.get(qToken);
      const u = s ? store.providerUsers.find((x) => x.id === s.user.id) : null;
      return u && u.status !== 'SUSPENDED'
        ? { id: u.id, space: 'provider', role: 'PROVIDER', name: u.name, email: u.email, organizationId: u.companyName, organizationName: u.companyName }
        : null;
    }
    return null;
  };

  if (qSpace && ['intranet', 'accounting', 'learner', 'instructor', 'provider', 'superadmin'].includes(qSpace)) {
    const match = checkSpace(qSpace);
    if (match) return match;
  }
  const order: PlatformSpace[] = ['instructor', 'intranet', 'superadmin', 'learner', 'accounting', 'provider'];
  for (const sp of order) {
    const found = checkSpace(sp);
    if (found) return found;
  }
  return null;
}

function resolveActorFromIncoming(req: IncomingMessage): ActiveActor | null {
  try {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const qToken = urlObj.searchParams.get('token')?.trim() || '';
    const qSpace = (urlObj.searchParams.get('space')?.trim() as PlatformSpace | undefined) || undefined;
    const cookies = parseCookies(req.headers.cookie);

    const resolveWithToken = (space: PlatformSpace, token: string): ActiveActor | null => {
      if (!token) return null;
      if (space === 'superadmin') {
        const s = superadminSessions.get(token);
        const u = s ? store.superadminUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'superadmin', role: u.role, name: u.name, email: u.email, organizationId: 'tpd-superadmin', organizationName: 'Administration Plateforme' }
          : null;
      }
      if (space === 'instructor') {
        const s = instructorSessions.get(token);
        const u = s ? store.instructorUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'instructor', role: 'INSTRUCTOR', name: u.name, email: u.email, organizationId: u.city, organizationName: `Formateur · ${u.city}` }
          : null;
      }
      if (space === 'intranet') {
        const s = intranetSessions.get(token);
        const u = s ? store.intranetUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'intranet', role: u.role, name: u.name, email: u.email, organizationId: u.organizationId, organizationName: u.organizationName }
          : null;
      }
      if (space === 'accounting') {
        const s = accountingSessions.get(token);
        const u = s ? store.accountingUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'accounting', role: u.role, name: u.name, email: u.email, organizationId: u.organizationId, organizationName: u.organizationName }
          : null;
      }
      if (space === 'learner') {
        const s = learnerSessions.get(token);
        const u = s ? store.learnerUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'learner', role: 'LEARNER', name: u.name, email: u.email, organizationId: u.companyName, organizationName: u.companyName }
          : null;
      }
      if (space === 'provider') {
        const s = providerSessions.get(token);
        const u = s ? store.providerUsers.find((x) => x.id === s.user.id) : null;
        return u && u.status !== 'SUSPENDED'
          ? { id: u.id, space: 'provider', role: 'PROVIDER', name: u.name, email: u.email, organizationId: u.companyName, organizationName: u.companyName }
          : null;
      }
      return null;
    };

    const cookieNames: Record<PlatformSpace, string> = {
      superadmin: 'tpd_superadmin_session',
      intranet: 'tpd_intranet_session',
      accounting: 'tpd_acc_session',
      learner: 'tpd_learner_session',
      instructor: 'tpd_instructor_session',
      provider: 'tpd_provider_session',
    };

    if (qSpace && cookieNames[qSpace]) {
      const m = resolveWithToken(qSpace, qToken || cookies[cookieNames[qSpace]] || '');
      if (m) return m;
    }

    const order: PlatformSpace[] = ['intranet', 'accounting', 'instructor', 'learner', 'provider', 'superadmin'];
    for (const sp of order) {
      const tok = qToken || cookies[cookieNames[sp]] || '';
      const found = resolveWithToken(sp, tok);
      if (found) return found;
    }
  } catch {
    return null;
  }
  return null;
}

function calcServerDocTotals(doc: ServerCommercialDocument) {
  const ht = doc.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const tva = doc.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.vatRate / 100), 0);
  return { ht: Math.round(ht), tva: Math.round(tva), ttc: Math.round(ht + tva) };
}

function syncDocumentToAccounting(doc: ServerCommercialDocument, actorName: string): void {
  if (doc.syncedToAccounting || doc.status === 'DRAFT') return;
  if (doc.kind !== 'CUSTOMER_INVOICE' && doc.kind !== 'SUPPLIER_INVOICE') return;
  const totals = calcServerDocTotals(doc);
  if (totals.ttc <= 0) return;

  const accOrgId = 'tpd-demo-accounting';
  const seq = store.accountingEntries.filter((e) => e.organizationId === accOrgId).length + 1;
  const journalCode = doc.kind === 'CUSTOMER_INVOICE' ? 'VE' : 'AC';
  const lines: AccountingEntryLine[] =
    doc.kind === 'CUSTOMER_INVOICE'
      ? [
          {
            accountCode: '411',
            accountLabel: 'Clients',
            label: `Facture client ${doc.number} — ${doc.contactName}`,
            debit: totals.ttc,
            credit: 0,
          },
          {
            accountCode: '706',
            accountLabel: 'Services vendus (Événementiel & Formation)',
            label: `Prestation HT — ${doc.number}`,
            debit: 0,
            credit: totals.ht,
          },
          ...(totals.tva > 0
            ? [
                {
                  accountCode: '4431',
                  accountLabel: 'TVA facturée sur ventes (18%)',
                  label: `TVA collectée — ${doc.number}`,
                  debit: 0,
                  credit: totals.tva,
                },
              ]
            : []),
        ]
      : [
          {
            accountCode: '605',
            accountLabel: 'Autres achats et prestations',
            label: `Prestation fournisseur HT — ${doc.number}`,
            debit: totals.ht,
            credit: 0,
          },
          ...(totals.tva > 0
            ? [
                {
                  accountCode: '4452',
                  accountLabel: 'TVA récupérable sur achats',
                  label: `TVA déductible — ${doc.number}`,
                  debit: totals.tva,
                  credit: 0,
                },
              ]
            : []),
          {
            accountCode: '401',
            accountLabel: 'Fournisseurs, dettes en compte',
            label: `Facture fournisseur ${doc.number} — ${doc.contactName}`,
            debit: 0,
            credit: totals.ttc,
          },
        ];

  store.accountingEntries.unshift({
    id: `ent-sync-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: accOrgId,
    fiscalYearId: 'fy-2026',
    journalCode,
    entryNumber: `${journalCode}-${doc.date.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
    entryDate: doc.date,
    reference: doc.number,
    description: `[Synchro CRM] ${doc.kind === 'CUSTOMER_INVOICE' ? 'Facture client' : 'Facture fournisseur'} ${doc.contactName}`,
    lines,
    createdBy: `${actorName} (Synchro auto)`,
    createdAt: new Date().toISOString(),
  });
  doc.syncedToAccounting = true;
}

function syncPaymentToAccounting(
  doc: ServerCommercialDocument,
  payment: ServerDocumentPayment,
  actorName: string,
): void {
  if (doc.kind !== 'CUSTOMER_INVOICE' && doc.kind !== 'SUPPLIER_INVOICE') return;
  const accOrgId = 'tpd-demo-accounting';
  const seq = store.accountingEntries.filter((e) => e.organizationId === accOrgId).length + 1;
  const journalCode = payment.method === 'ESPECES' ? 'CA' : 'BQ';
  const treasuryAcc = payment.method === 'ESPECES' ? '571' : '521';
  const treasuryLabel = payment.method === 'ESPECES' ? 'Caisse siège Dakar' : 'Banques locales';

  const lines: AccountingEntryLine[] =
    doc.kind === 'CUSTOMER_INVOICE'
      ? [
          {
            accountCode: treasuryAcc,
            accountLabel: treasuryLabel,
            label: `Encaissement ${doc.number} (${payment.reference})`,
            debit: payment.amount,
            credit: 0,
          },
          {
            accountCode: '411',
            accountLabel: 'Clients',
            label: `Apurement client ${doc.contactName}`,
            debit: 0,
            credit: payment.amount,
          },
        ]
      : [
          {
            accountCode: '401',
            accountLabel: 'Fournisseurs, dettes en compte',
            label: `Règlement fournisseur ${doc.contactName}`,
            debit: payment.amount,
            credit: 0,
          },
          {
            accountCode: treasuryAcc,
            accountLabel: treasuryLabel,
            label: `Décaissement ${doc.number} (${payment.reference})`,
            debit: 0,
            credit: payment.amount,
          },
        ];

  store.accountingEntries.unshift({
    id: `ent-pay-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    organizationId: accOrgId,
    fiscalYearId: 'fy-2026',
    journalCode,
    entryNumber: `${journalCode}-${payment.date.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
    entryDate: payment.date,
    reference: payment.reference,
    description: `[Synchro Règlement] ${doc.number} — ${doc.contactName}`,
    lines,
    createdBy: `${actorName} (Synchro auto)`,
    createdAt: new Date().toISOString(),
  });
}

function syncProviderRequestToCrm(reqItem: ProviderServiceRequest, provider: ProviderUser): void {
  const targetOwnerId = reqItem.requesterUserId || 'int-u-1';
  const targetOrgId = reqItem.requesterOrgId || 'tpd-demo-intranet';
  const today = new Date().toISOString().slice(0, 10);

  let supplierContact: ServerCrmContact | undefined = store.crmContacts.find(
    (c) => c.ownerUserId === targetOwnerId && c.type === 'SUPPLIER' && c.email === provider.email,
  );
  if (!supplierContact) {
    supplierContact = {
      id: `c-prov-${provider.id}-${Date.now()}`,
      ownerUserId: targetOwnerId,
      organizationId: targetOrgId,
      type: 'SUPPLIER',
      name: provider.companyName,
      email: provider.email,
      phone: '+221 77 000 00 00',
      ninea: 'PRESTATAIRE-TPD',
      address: provider.city,
      sector: reqItem.category,
      whatsappOptIn: false,
    };
    store.crmContacts.unshift(supplierContact);
  }

  let doc = store.crmDocuments.find((d) => d.linkedProviderRequestId === reqItem.id);
  const htAmount = Math.round(reqItem.amountFcfa / 1.18);

  if (reqItem.stage === 'DEVIS_ENVOYE' || reqItem.stage === 'COMMANDE_CONFIRMEE') {
    const kind = reqItem.stage === 'DEVIS_ENVOYE' ? 'PURCHASE_ORDER' : 'PURCHASE_ORDER';
    const docNumber = reqItem.orderNumber || reqItem.quoteNumber || `PRV-${Date.now().toString().slice(-4)}`;
    if (!doc) {
      doc = {
        id: `doc-prv-${Date.now()}`,
        ownerUserId: targetOwnerId,
        organizationId: targetOrgId,
        kind,
        number: docNumber,
        date: today,
        contactId: supplierContact.id,
        contactName: provider.companyName,
        status: reqItem.stage === 'COMMANDE_CONFIRMEE' ? 'VALIDATED' : 'DRAFT',
        lines: [
          {
            id: `l-prv-${Date.now()}`,
            label: `${reqItem.offerTitle} — ${reqItem.eventType}`,
            quantity: 1,
            deliveredQuantity: 0,
            unitPrice: htAmount,
            vatRate: 18,
          },
        ],
        payments: [],
        notes: `Synchronisé depuis Espace Prestataires (${provider.name})`,
        linkedProviderRequestId: reqItem.id,
      };
      store.crmDocuments.unshift(doc);
    } else {
      doc.number = docNumber;
      doc.status = reqItem.stage === 'COMMANDE_CONFIRMEE' ? 'VALIDATED' : doc.status;
    }
  }

  if (reqItem.stage === 'FACTURE_EMISE' || reqItem.stage === 'PAYEE') {
    const docNumber = reqItem.invoiceNumber || `FAC-PRV-${Date.now().toString().slice(-4)}`;
    if (!doc) {
      doc = {
        id: `doc-prv-${Date.now()}`,
        ownerUserId: targetOwnerId,
        organizationId: targetOrgId,
        kind: 'SUPPLIER_INVOICE',
        number: docNumber,
        date: today,
        contactId: supplierContact.id,
        contactName: provider.companyName,
        status: reqItem.stage === 'PAYEE' ? 'PAID' : 'VALIDATED',
        lines: [
          {
            id: `l-prv-${Date.now()}`,
            label: `${reqItem.offerTitle} — ${reqItem.eventType}`,
            quantity: 1,
            deliveredQuantity: 1,
            unitPrice: htAmount,
            vatRate: 18,
          },
        ],
        payments: [],
        notes: `Facture prestataire synchronisée (${provider.name})`,
        linkedProviderRequestId: reqItem.id,
      };
      store.crmDocuments.unshift(doc);
    } else {
      doc.kind = 'SUPPLIER_INVOICE';
      doc.number = docNumber;
      doc.status = reqItem.stage === 'PAYEE' ? 'PAID' : 'VALIDATED';
    }
    syncDocumentToAccounting(doc, provider.name);

    if (reqItem.stage === 'PAYEE' && doc.payments.length === 0) {
      const payment: ServerDocumentPayment = {
        id: `pay-prv-${Date.now()}`,
        date: today,
        amount: reqItem.amountFcfa,
        method: 'VIREMENT',
        reference: `REG-${docNumber}`,
      };
      doc.payments.push(payment);
      syncPaymentToAccounting(doc, payment, provider.name);
    }
  }
}

async function createServer(): Promise<void> {
  const app = express();

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '25mb' }));
  attachPersistenceMiddleware(app);

  function sanitizeImageInput(val: unknown): { valid: boolean; clear?: boolean; value?: string } {
    if (val === '' || val === null) {
      return { valid: true, clear: true, value: undefined };
    }
    if (typeof val !== 'string') {
      return { valid: false };
    }
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

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      mode: db.isMock ? 'in-memory' : 'postgresql',
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // ANNUAIRE DES COMPTES & INSCRIPTION PERSONNELLE ISOLÉE
  // =========================================================================

  app.get('/api/auth/directory', (_req: Request, res: Response) => {
    const accounts = [
      ...store.intranetUsers.map((u) => ({
        userId: u.id,
        space: 'intranet' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        subtitle: u.title,
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
      ...store.accountingUsers.map((u) => ({
        userId: u.id,
        space: 'accounting' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        subtitle: u.role === 'ACCOUNTANT' ? 'Directeur Administratif & Financier' : u.role === 'OWNER' ? 'Propriétaire / Direction' : 'Audit Externe (Lecture seule)',
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
      ...store.learnerUsers.map((u) => ({
        userId: u.id,
        space: 'learner' as const,
        name: u.name,
        email: u.email,
        role: 'LEARNER',
        subtitle: `${u.jobTitle} · ${u.companyName}`,
        organizationId: u.companyName,
        organizationName: u.companyName,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
      ...store.instructorUsers.map((u) => ({
        userId: u.id,
        space: 'instructor' as const,
        name: u.name,
        email: u.email,
        role: 'INSTRUCTOR',
        subtitle: `${u.specialty} · ${u.city}`,
        organizationId: u.city,
        organizationName: `Formateur · ${u.city}`,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
      ...store.providerUsers.map((u) => ({
        userId: u.id,
        space: 'provider' as const,
        name: u.name,
        email: u.email,
        role: 'PROVIDER',
        subtitle: `${u.roleTitle} · ${u.companyName}`,
        organizationId: u.companyName,
        organizationName: u.companyName,
        avatarUrl: u.avatarUrl,
        companyLogoUrl: u.companyLogoUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
      ...store.superadminUsers.map((u) => ({
        userId: u.id,
        space: 'superadmin' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        subtitle: u.title,
        organizationId: 'tpd-superadmin',
        organizationName: 'Administration Plateforme',
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
      })),
    ];
    return res.json({ accounts });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { space, name, email, password, organizationOrCompany, roleOrSpecialty, city } = req.body as {
      space?: 'learner' | 'instructor' | 'provider';
      name?: string;
      email?: string;
      password?: string;
      organizationOrCompany?: string;
      roleOrSpecialty?: string;
      city?: string;
    };

    if (!space || !['learner', 'instructor', 'provider'].includes(space)) {
      return res.status(400).json({ error: 'Type de compte invalide (apprenant, formateur ou prestataire).' });
    }
    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ error: 'Nom complet, e-mail et mot de passe (min. 6 caractères) requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = crypto.randomBytes(24).toString('hex');

    const nowIso = new Date().toISOString();

    if (space === 'learner') {
      if (store.learnerUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Un compte apprenant existe déjà avec cet e-mail.' });
      }
      const created: LearnerUser = {
        id: `lrn-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        companyName: organizationOrCompany?.trim() || 'Entreprise Partenaire B2B',
        jobTitle: roleOrSpecialty?.trim() || 'Apprenant B2B',
        passwordHash: simpleHash(password),
        status: 'ACTIVE',
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      store.learnerUsers.push(created);
      learnerSessions.set(token, { id: token, user: created, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_learner_session', token);
      addAuditLog({
        actorId: created.id,
        actorName: created.name,
        actorSpace: 'learner',
        action: 'REGISTER',
        targetType: 'USER',
        targetId: created.id,
        targetLabel: `${created.name} (${created.email})`,
        details: `Nouveau compte Apprenant B2B inscrit (${created.companyName}).`,
        severity: 'INFO',
      });
      return res.status(201).json({
        token,
        session: {
          userId: created.id,
          space: 'learner',
          name: created.name,
          email: created.email,
          role: 'LEARNER',
          organizationId: created.companyName,
          organizationName: created.companyName,
          subtitle: created.jobTitle,
        },
      });
    }

    if (space === 'instructor') {
      if (store.instructorUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Un compte formateur existe déjà avec cet e-mail.' });
      }
      const created: InstructorUser = {
        id: `inst-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        specialty: roleOrSpecialty?.trim() || 'Formateur Expert B2B',
        city: city?.trim() || 'Dakar',
        passwordHash: simpleHash(password),
        status: 'ACTIVE',
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      store.instructorUsers.push(created);
      instructorSessions.set(token, { id: token, user: created, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_instructor_session', token);
      addAuditLog({
        actorId: created.id,
        actorName: created.name,
        actorSpace: 'instructor',
        action: 'REGISTER',
        targetType: 'USER',
        targetId: created.id,
        targetLabel: `${created.name} (${created.email})`,
        details: `Nouveau compte Formateur Pro inscrit (${created.specialty}).`,
        severity: 'INFO',
      });
      return res.status(201).json({
        token,
        session: {
          userId: created.id,
          space: 'instructor',
          name: created.name,
          email: created.email,
          role: 'INSTRUCTOR',
          organizationId: created.city,
          organizationName: `Formateur · ${created.city}`,
          subtitle: created.specialty,
        },
      });
    }

    if (store.providerUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return res.status(409).json({ error: 'Un compte prestataire existe déjà avec cet e-mail.' });
    }
    const created: ProviderUser = {
      id: `prov-${Date.now()}`,
      email: cleanEmail,
      name: name.trim(),
      companyName: organizationOrCompany?.trim() || `${name.trim()} Services`,
      roleTitle: roleOrSpecialty?.trim() || 'Prestataire Événementiel',
      city: city?.trim() || 'Dakar',
      passwordHash: simpleHash(password),
      status: 'ACTIVE',
      createdAt: nowIso,
      lastLoginAt: nowIso,
    };
    store.providerUsers.push(created);
    providerSessions.set(token, { id: token, user: created, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_provider_session', token);
    addAuditLog({
      actorId: created.id,
      actorName: created.name,
      actorSpace: 'provider',
      action: 'REGISTER',
      targetType: 'USER',
      targetId: created.id,
      targetLabel: `${created.name} (${created.email})`,
      details: `Nouveau compte Prestataire Événementiel inscrit (${created.companyName}).`,
      severity: 'INFO',
    });
    return res.status(201).json({
      token,
      session: {
        userId: created.id,
        space: 'provider',
        name: created.name,
        email: created.email,
        role: 'PROVIDER',
        organizationId: created.companyName,
        organizationName: created.companyName,
        subtitle: created.roleTitle,
      },
    });
  });

  app.post('/api/auth/google', (req: Request, res: Response) => {
    const { space, email, displayName, photoUrl } = req.body as {
      space?: PlatformSpace;
      email?: string;
      displayName?: string;
      photoUrl?: string;
      firebaseUid?: string;
    };

    const targetSpace: PlatformSpace =
      space && ['intranet', 'accounting', 'learner', 'instructor', 'provider', 'superadmin'].includes(space)
        ? space
        : 'intranet';
    if (!email?.trim()) {
      return res.status(400).json({ error: 'E-mail Google vérifié requis.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName?.trim() || cleanEmail.split('@')[0];
    const token = crypto.randomBytes(24).toString('hex');
    const nowIso = new Date().toISOString();

    if (targetSpace === 'intranet') {
      let user = store.intranetUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: `int-g-${Date.now()}`,
          organizationId: 'tpd-demo-intranet',
          organizationName: 'Teranga Prestige Digital',
          email: cleanEmail,
          name: cleanName,
          role: 'OWNER',
          title: 'Direction · Compte Google vérifié',
          passwordHash: simpleHash(`google-${Date.now()}`),
          avatarUrl: photoUrl || undefined,
          status: 'ACTIVE',
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        store.intranetUsers.push(user);
      } else {
        user.lastLoginAt = nowIso;
        if (photoUrl && !user.avatarUrl) user.avatarUrl = photoUrl;
      }
      intranetSessions.set(token, { id: token, user, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_intranet_session', token);
      scheduleServerSave();
      return res.json({
        token,
        session: {
          userId: user.id,
          space: 'intranet',
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
          subtitle: user.title,
        },
      });
    }

    if (targetSpace === 'accounting') {
      let user = store.accountingUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: `acc-g-${Date.now()}`,
          organizationId: 'tpd-demo-accounting',
          organizationName: 'Teranga Prestige Digital',
          email: cleanEmail,
          name: cleanName,
          role: 'OWNER',
          passwordHash: simpleHash(`google-${Date.now()}`),
          avatarUrl: photoUrl || undefined,
          status: 'ACTIVE',
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        store.accountingUsers.push(user);
      } else {
        user.lastLoginAt = nowIso;
      }
      accountingSessions.set(token, { id: token, user, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_acc_session', token);
      scheduleServerSave();
      return res.json({
        token,
        session: {
          userId: user.id,
          space: 'accounting',
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
          subtitle: 'Comptabilité SYSCOHADA · Google',
        },
      });
    }

    if (targetSpace === 'learner') {
      let user = store.learnerUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: `lrn-g-${Date.now()}`,
          email: cleanEmail,
          name: cleanName,
          companyName: 'Teranga Prestige Digital',
          jobTitle: 'Apprenant B2B',
          passwordHash: simpleHash(`google-${Date.now()}`),
          avatarUrl: photoUrl || undefined,
          status: 'ACTIVE',
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        store.learnerUsers.push(user);
      } else {
        user.lastLoginAt = nowIso;
      }
      learnerSessions.set(token, { id: token, user, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_learner_session', token);
      scheduleServerSave();
      return res.json({
        token,
        session: {
          userId: user.id,
          space: 'learner',
          name: user.name,
          email: user.email,
          role: 'LEARNER',
          organizationId: user.companyName,
          organizationName: user.companyName,
          subtitle: user.jobTitle,
        },
      });
    }

    if (targetSpace === 'instructor') {
      let user = store.instructorUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: `inst-g-${Date.now()}`,
          email: cleanEmail,
          name: cleanName,
          specialty: 'Formateur Expert',
          city: 'Dakar',
          passwordHash: simpleHash(`google-${Date.now()}`),
          avatarUrl: photoUrl || undefined,
          status: 'ACTIVE',
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        store.instructorUsers.push(user);
      } else {
        user.lastLoginAt = nowIso;
      }
      instructorSessions.set(token, { id: token, user, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_instructor_session', token);
      scheduleServerSave();
      return res.json({
        token,
        session: {
          userId: user.id,
          space: 'instructor',
          name: user.name,
          email: user.email,
          role: 'INSTRUCTOR',
          organizationId: user.city,
          organizationName: `Formateur · ${user.city}`,
          subtitle: user.specialty,
        },
      });
    }

    if (targetSpace === 'provider') {
      let user = store.providerUsers.find((u) => u.email.toLowerCase() === cleanEmail);
      if (!user) {
        user = {
          id: `prov-g-${Date.now()}`,
          email: cleanEmail,
          name: cleanName,
          companyName: 'Partenaire Événementiel',
          roleTitle: 'Prestataire Référencé',
          city: 'Dakar',
          passwordHash: simpleHash(`google-${Date.now()}`),
          avatarUrl: photoUrl || undefined,
          status: 'ACTIVE',
          createdAt: nowIso,
          lastLoginAt: nowIso,
        };
        store.providerUsers.push(user);
      } else {
        user.lastLoginAt = nowIso;
      }
      providerSessions.set(token, { id: token, user, createdAt: Date.now() });
      setSessionCookie(res, 'tpd_provider_session', token);
      scheduleServerSave();
      return res.json({
        token,
        session: {
          userId: user.id,
          space: 'provider',
          name: user.name,
          email: user.email,
          role: 'PROVIDER',
          organizationId: user.companyName,
          organizationName: user.companyName,
          subtitle: user.roleTitle,
        },
      });
    }

    // superadmin
    let user = store.superadminUsers.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      user = {
        id: `sup-g-${Date.now()}`,
        email: cleanEmail,
        name: cleanName,
        role: 'SUPERADMIN',
        title: 'Super Administrateur Plateforme',
        passwordHash: simpleHash(`google-${Date.now()}`),
        avatarUrl: photoUrl || undefined,
        status: 'ACTIVE',
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      store.superadminUsers.push(user);
    } else {
      user.lastLoginAt = nowIso;
    }
    superadminSessions.set(token, { id: token, user, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_superadmin_session', token);
    scheduleServerSave();
    return res.json({
      token,
      session: {
        userId: user.id,
        space: 'superadmin',
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: 'tpd-superadmin',
        organizationName: 'Administration Plateforme',
        subtitle: user.title,
      },
    });
  });

  app.get('/api/persistence/snapshot', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const cahier = getCahierCollections();
    const campaigns = getMarketingCampaignsList();
    const teams = getTeamsCollections();

    return res.json({
      organizationId: actor.organizationId,
      crmContacts: store.crmContacts.filter((c) => c.organizationId === actor.organizationId || c.ownerUserId === actor.id).slice(0, 80),
      crmDocuments: store.crmDocuments.filter((d) => d.organizationId === actor.organizationId || d.ownerUserId === actor.id).slice(0, 80),
      campaigns: campaigns.filter((c) => c.organizationId === actor.organizationId || c.ownerUserId === actor.id).slice(0, 50),
      missions: cahier.missionOrders.filter((m) => m.organizationId === actor.organizationId || m.agentUserId === actor.id).slice(0, 60),
      reports: cahier.workReports.filter((r) => r.organizationId === actor.organizationId || r.authorUserId === actor.id).slice(0, 60),
      tasks: store.tasks.filter((t) => t.organizationId === actor.organizationId || t.ownerUserId === actor.id).slice(0, 80),
      planningEvents: store.planningEntries.filter((p) => p.organizationId === actor.organizationId || p.ownerUserId === actor.id).slice(0, 80),
      gedDocuments: cahier.gedDocuments.filter((g) => g.organizationId === actor.organizationId || g.ownerUserId === actor.id || g.organizationId === 'global').slice(0, 80),
      accountingEntries: store.accountingEntries.filter((a) => a.organizationId === actor.organizationId || a.createdBy === actor.name).slice(0, 80),
      teamsChannels: teams.teamsConversations.filter((ch) => ch.organizationId === actor.organizationId || ch.memberIds.includes(actor.id)).slice(0, 40),
      teamsMessages: teams.teamsMessages.slice(0, 80),
      leaveRequests: cahier.leaveRequests.filter((l) => l.organizationId === actor.organizationId || l.userId === actor.id).slice(0, 60),
    });
  });

  app.post('/api/persistence/hydrate', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      crmContacts?: Array<{ id: string; name: string; company: string; sector: string; email?: string; phone?: string; stage: string; estimatedValueFcfa?: number }>;
      tasks?: Array<{ id: string; title: string; category: string; priority: string; status: string; assigneeName: string; dueDate: string }>;
      reports?: Array<{ id: string; reference: string; reportType: string; title: string; authorName: string; summary: string; status: string; periodLabel: string }>;
      missions?: Array<{ id: string; reference: string; title: string; destination: string; agentName: string; startDate: string; endDate: string; totalFcfa: number; status: string }>;
      planningEvents?: Array<{ id: string; title: string; eventType: string; status: string; date: string; startHour: number; durationHours: number; location: string }>;
      gedDocuments?: Array<{ id: string; title: string; category: string; fileName: string; mimeType: string; sizeBytes: number; version: number; confidentiality: string }>;
    };

    const cahier = getCahierCollections();

    if (Array.isArray(body.crmContacts)) {
      for (const rc of body.crmContacts) {
        const existing = store.crmContacts.find((c) => c.id === rc.id);
        const mappedStage =
          rc.stage === 'PROSPECT'
            ? 'NOUVEAU'
            : rc.stage === 'QUALIFIE' || rc.stage === 'PROPOSITION' || rc.stage === 'GAGNE'
            ? rc.stage
            : 'CONTACTE';
        if (existing) {
          existing.name = rc.company || rc.name || existing.name;
          existing.sector = rc.sector || existing.sector;
          if (rc.email) existing.email = rc.email;
          if (rc.phone) existing.phone = rc.phone;
          existing.pipelineStage = mappedStage;
        } else {
          store.crmContacts.unshift({
            id: rc.id,
            ownerUserId: actor.id,
            organizationId: actor.organizationId,
            type: mappedStage === 'GAGNE' ? 'CLIENT' : 'PROSPECT',
            name: rc.company || rc.name,
            email: rc.email || '',
            phone: rc.phone || '',
            ninea: '',
            address: 'Dakar, Sénégal',
            sector: rc.sector || 'Services',
            whatsappOptIn: true,
            pipelineStage: mappedStage,
          });
        }
      }
    }

    if (Array.isArray(body.tasks)) {
      for (const rt of body.tasks) {
        const mappedStatus: TaskStatus =
          rt.status === 'EN_REVUE'
            ? 'EN_REVISION'
            : (['A_FAIRE', 'EN_COURS', 'TERMINE'].includes(rt.status) ? (rt.status as TaskStatus) : 'A_FAIRE');
        const mappedPriority: TaskPriority =
          rt.priority === 'MOYENNE'
            ? 'NORMALE'
            : (['BASSE', 'HAUTE', 'URGENTE'].includes(rt.priority) ? (rt.priority as TaskPriority) : 'NORMALE');
        const existing = store.tasks.find((t) => t.id === rt.id);
        if (existing) {
          existing.title = rt.title || existing.title;
          existing.status = mappedStatus;
          existing.priority = mappedPriority;
          if (rt.dueDate) existing.dueDate = rt.dueDate;
        } else {
          store.tasks.unshift({
            id: rt.id,
            code: `TSK-${rt.id.slice(-6).toUpperCase()}`,
            title: rt.title,
            description: '',
            status: mappedStatus,
            priority: mappedPriority,
            category: (['CRM', 'EVENEMENT', 'FORMATION', 'COMPTABILITE', 'PRESTATION', 'ADMINISTRATION', 'PERSONNEL'].includes(rt.category)
              ? rt.category
              : 'ADMINISTRATION') as TaskCategory,
            ownerUserId: actor.id,
            ownerName: actor.name,
            assigneeUserId: actor.id,
            assigneeName: rt.assigneeName || actor.name,
            organizationId: actor.organizationId,
            space: actor.space,
            dueDate: rt.dueDate || undefined,
            tags: [],
            checklist: [],
            comments: [],
            syncToPlanning: true,
            orderIndex: store.tasks.length + 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (Array.isArray(body.reports)) {
      for (const rr of body.reports) {
        const existing = cahier.workReports.find((r) => r.id === rr.id);
        if (existing) {
          existing.title = rr.title || existing.title;
          existing.executiveSummary = rr.summary || existing.executiveSummary;
        } else {
          cahier.workReports.unshift({
            id: rr.id,
            reference: rr.reference || `RPT-${Date.now()}`,
            type:
              rr.reportType === 'MISSION'
                ? 'RAPPORT_MISSION'
                : rr.reportType === 'DIRECTION'
                ? 'RAPPORT_DIRECTION'
                : 'RAPPORT_TRAVAIL_HEBDO',
            status: rr.status === 'VALIDE' ? 'VALIDE' : rr.status === 'SOUMIS' ? 'SOUMIS' : 'BROUILLON',
            title: rr.title,
            authorUserId: actor.id,
            authorName: rr.authorName || actor.name,
            authorJobTitle: actor.role,
            authorRole: actor.role,
            department: 'Direction & Opérations',
            organizationId: actor.organizationId,
            periodLabel: rr.periodLabel || 'Période en cours',
            startDate: new Date().toISOString().slice(0, 10),
            endDate: new Date().toISOString().slice(0, 10),
            location: 'Dakar, Sénégal',
            linkedTaskCodes: [],
            executiveSummary: rr.summary || '',
            contextAndObjectives: rr.summary || '',
            activitiesAndDeliverables: '',
            difficultiesAndRisks: '',
            recommendationsAndNextSteps: '',
            kpis: [],
            actionPlan: [],
            completenessPct: 100,
            wordCount: (rr.summary || '').split(/\s+/).filter(Boolean).length,
            reviewTrail: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    if (Array.isArray(body.planningEvents)) {
      for (const rp of body.planningEvents) {
        const existing = store.planningEntries.find((p) => p.id === rp.id);
        if (existing) {
          existing.title = rp.title || existing.title;
          existing.date = rp.date || existing.date;
          existing.location = rp.location || existing.location;
        } else {
          store.planningEntries.unshift({
            id: rp.id,
            ownerUserId: actor.id,
            ownerName: actor.name,
            participantUserIds: [actor.id],
            participantNames: [actor.name],
            organizationId: actor.organizationId,
            space: actor.space,
            title: rp.title,
            description: '',
            type: (['REUNION', 'RENDEZ_VOUS', 'ECHEANCE', 'FORMATION', 'PRESTATION'].includes(rp.eventType)
              ? rp.eventType
              : 'REUNION') as PlanningEntryType,
            status: (['PLANIFIE', 'CONFIRME', 'TERMINE', 'ANNULE'].includes(rp.status)
              ? rp.status
              : 'PLANIFIE') as PlanningEntryStatus,
            date: rp.date || new Date().toISOString().slice(0, 10),
            startHour: rp.startHour || 9,
            durationHours: rp.durationHours || 2,
            location: rp.location || 'Dakar',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    scheduleServerSave();
    return res.json({ ok: true });
  });

  // =========================================================================
  // MODULE DE COMPTABILITÉ (SYSCOHADA)
  // =========================================================================

  app.post('/api/accounting/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess, demoUserId } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
      demoUserId?: string;
    };

    let user: AccountingUser | undefined;
    if (demoUserId) {
      user = store.accountingUsers.find((u) => u.id === demoUserId);
    } else if (demoQuickAccess) {
      user = store.accountingUsers.find((u) => u.organizationId === 'tpd-demo-accounting');
    } else if (email && password) {
      user = store.accountingUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Identifiants comptables invalides.' });
    }
    if (user.status === 'SUSPENDED') {
      addAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorSpace: 'accounting',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: user.id,
        targetLabel: `${user.name} (${user.email})`,
        details: 'Tentative de connexion bloquée : compte comptable suspendu.',
        severity: 'WARNING',
      });
      return res.status(403).json({ error: 'Ce compte est suspendu par le Superadmin.' });
    }

    user.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorSpace: 'accounting',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: user.id,
      targetLabel: `${user.name} (${user.email})`,
      details: 'Connexion espace Comptabilité SYSCOHADA.',
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    accountingSessions.set(token, { id: token, user, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_acc_session', token);

    return res.json({
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  app.post('/api/accounting/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_acc_session');
    if (token) accountingSessions.delete(token);
    res.clearCookie('tpd_acc_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/accounting/auth/me', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  app.get('/api/accounting/overview', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });

    const orgId = user.organizationId;
    const fiscalYears = store.accountingFiscalYears.filter((f) => f.organizationId === orgId);
    const journals = store.accountingJournals.filter((j) => j.organizationId === orgId);
    const accounts = store.accountingAccounts.filter((a) => a.organizationId === orgId);
    const entries = store.accountingEntries.filter((e) => e.organizationId === orgId);

    return res.json({ fiscalYears, journals, accounts, entries });
  });

  app.post('/api/accounting/fiscal-years', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { label, startDate, endDate } = req.body as { label?: string; startDate?: string; endDate?: string };
    if (!label || !startDate || !endDate) {
      return res.status(400).json({ error: 'Libellé et dates requis.' });
    }

    const fy = {
      id: `fy-${Date.now()}`,
      organizationId: user.organizationId,
      label: label.trim(),
      startDate,
      endDate,
      status: 'OPEN' as const,
    };
    store.accountingFiscalYears.push(fy);
    return res.status(201).json({ fiscalYear: fy });
  });

  app.post('/api/accounting/journals', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { code, name, type } = req.body as {
      code?: string;
      name?: string;
      type?: 'ACHATS' | 'VENTES' | 'BANQUE' | 'CAISSE' | 'OD';
    };
    if (!code || !name || !type) {
      return res.status(400).json({ error: 'Code, nom et type de journal requis.' });
    }

    const journal = {
      id: `j-${Date.now()}`,
      organizationId: user.organizationId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      type,
    };
    store.accountingJournals.push(journal);
    return res.status(201).json({ journal });
  });

  app.post('/api/accounting/accounts', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { code, label, normalBalance } = req.body as {
      code?: string;
      label?: string;
      normalBalance?: 'DEBIT' | 'CREDIT';
    };
    if (!code || !label) {
      return res.status(400).json({ error: 'Code et libellé SYSCOHADA requis.' });
    }

    const cleanCode = code.trim();
    const account = {
      id: `acc-${Date.now()}`,
      organizationId: user.organizationId,
      code: cleanCode,
      label: label.trim(),
      accountClass: cleanCode[0] || '1',
      normalBalance: normalBalance || (['1', '4', '7'].includes(cleanCode[0]) ? 'CREDIT' : 'DEBIT'),
    };
    store.accountingAccounts.push(account);
    return res.status(201).json({ account });
  });

  app.post('/api/accounting/entries', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { fiscalYearId, journalCode, entryDate, reference, description, lines } = req.body as {
      fiscalYearId?: string;
      journalCode?: string;
      entryDate?: string;
      reference?: string;
      description?: string;
      lines?: AccountingEntryLine[];
    };

    if (!fiscalYearId || !journalCode || !entryDate || !description || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Écriture incomplète : au moins 2 lignes sont requises.' });
    }

    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: `Écriture déséquilibrée : Débit (${totalDebit}) ≠ Crédit (${totalCredit}).`,
      });
    }

    const seq = store.accountingEntries.filter((e) => e.organizationId === user.organizationId).length + 1;
    const entry = {
      id: `ent-${Date.now()}`,
      organizationId: user.organizationId,
      fiscalYearId,
      journalCode,
      entryNumber: `${journalCode}-${entryDate.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
      entryDate,
      reference: reference?.trim() || `REF-${seq}`,
      description: description.trim(),
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        accountLabel: l.accountLabel || l.accountCode,
        label: l.label || description.trim(),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    };
    store.accountingEntries.unshift(entry);
    return res.status(201).json({ entry });
  });

  // =========================================================================
  // MODULE INTRANET DU PERSONNEL
  // =========================================================================

  app.post('/api/intranet/auth/login', (req: Request, res: Response) => {
    const { organizationId, email, password, demoRole, demoUserId } = req.body as {
      organizationId?: string;
      email?: string;
      password?: string;
      demoRole?: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
      demoUserId?: string;
    };

    let user: IntranetUser | undefined;
    if (demoUserId) {
      user = store.intranetUsers.find((u) => u.id === demoUserId);
    } else if (demoRole) {
      user = store.intranetUsers.find(
        (u) => u.organizationId === 'tpd-demo-intranet' && u.role === demoRole,
      );
    } else if (email && password) {
      const targetOrg = organizationId?.trim() || 'tpd-demo-intranet';
      user = store.intranetUsers.find(
        (u) =>
          u.organizationId === targetOrg &&
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          u.passwordHash === simpleHash(password),
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Identifiants intranet invalides.' });
    }
    if (user.status === 'SUSPENDED') {
      addAuditLog({
        actorId: user.id,
        actorName: user.name,
        actorSpace: 'intranet',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: user.id,
        targetLabel: `${user.name} (${user.email})`,
        details: 'Tentative de connexion bloquée : compte intranet suspendu.',
        severity: 'WARNING',
      });
      return res.status(403).json({ error: 'Ce compte est suspendu par le Superadmin.' });
    }

    user.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorSpace: 'intranet',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: user.id,
      targetLabel: `${user.name} (${user.email})`,
      details: `Connexion espace Intranet & CRM (${user.role}).`,
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    intranetSessions.set(token, { id: token, user, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_intranet_session', token);

    return res.json({
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
        title: user.title,
      },
    });
  });

  app.post('/api/intranet/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_intranet_session');
    if (token) intranetSessions.delete(token);
    res.clearCookie('tpd_intranet_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/intranet/auth/me', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
        title: user.title,
      },
    });
  });

  app.get('/api/intranet/workspace', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const channels = store.intranetChannels.filter(
      (c) => c.organizationId === user.organizationId && (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    const allowedChannelIds = new Set(channels.map((c) => c.id));
    const messages = store.intranetMessages.filter((m) => allowedChannelIds.has(m.channelId));
    const topics = store.intranetForumTopics.filter((t) => allowedChannelIds.has(t.channelId));
    const members = store.intranetUsers
      .filter((u) => u.organizationId === user.organizationId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
      }));

    return res.json({ channels, messages, topics, members });
  });

  app.post('/api/intranet/messages', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const { channelId, content, attachment } = req.body as {
      channelId?: string;
      content?: string;
      attachment?: IntranetAttachment;
    };

    if (!channelId || (!content?.trim() && !attachment)) {
      return res.status(400).json({ error: 'Canal et contenu requis.' });
    }

    const channel = store.intranetChannels.find(
      (c) =>
        c.id === channelId &&
        c.organizationId === user.organizationId &&
        (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    if (!channel) {
      return res.status(403).json({ error: 'Accès refusé à ce canal.' });
    }

    if (attachment && attachment.sizeBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'La pièce jointe dépasse la limite de 5 Mo.' });
    }

    const msg = {
      id: `msg-${Date.now()}`,
      organizationId: user.organizationId,
      channelId: channel.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: content?.trim() || '',
      attachment,
      createdAt: new Date().toISOString(),
    };
    store.intranetMessages.push(msg);
    return res.status(201).json({ message: msg });
  });

  app.post('/api/intranet/topics', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const { channelId, title, body } = req.body as { channelId?: string; title?: string; body?: string };
    if (!channelId || !title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Canal, titre et description requis.' });
    }

    const channel = store.intranetChannels.find(
      (c) =>
        c.id === channelId &&
        c.organizationId === user.organizationId &&
        (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    if (!channel) return res.status(403).json({ error: 'Accès refusé à ce canal.' });

    const topic = {
      id: `top-${Date.now()}`,
      organizationId: user.organizationId,
      channelId,
      title: title.trim(),
      body: body.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    store.intranetForumTopics.unshift(topic);
    return res.status(201).json({ topic });
  });

  app.post('/api/intranet/topics/:topicId/replies', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const topic = store.intranetForumTopics.find((t) => t.id === req.params.topicId);
    if (!topic || topic.organizationId !== user.organizationId) {
      return res.status(404).json({ error: 'Sujet introuvable.' });
    }

    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Contenu de réponse requis.' });
    }

    const reply = {
      id: `rep-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    topic.replies.push(reply);
    return res.status(201).json({ reply });
  });

  app.post('/api/intranet/users', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Seul le propriétaire peut créer un compte personnel.' });
    }

    const { name, email, role, title, password } = req.body as {
      name?: string;
      email?: string;
      role?: 'DIRECTION' | 'MANAGER' | 'EMPLOYEE';
      title?: string;
      password?: string;
    };

    if (!name || !email || !role || !password || password.length < 14) {
      return res.status(400).json({
        error: 'Nom, e-mail, rôle et mot de passe temporaire (min. 14 caractères) requis.',
      });
    }

    const created: IntranetUser = {
      id: `int-${Date.now()}`,
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      title: title?.trim() || role,
      passwordHash: simpleHash(password),
    };
    store.intranetUsers.push(created);

    // Add to non-private channels automatically
    store.intranetChannels.forEach((ch) => {
      if (ch.organizationId === user.organizationId && !ch.isPrivate) {
        ch.memberIds.push(created.id);
      }
    });

    return res.status(201).json({
      member: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        title: created.title,
      },
    });
  });

  // =========================================================================
  // MODULE ESPACE APPRENANT B2B (EN LIGNE, HYBRIDE, PRÉSENTIEL)
  // =========================================================================

  app.post('/api/learner/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess, demoUserId } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
      demoUserId?: string;
    };

    let learner: LearnerUser | undefined;
    if (demoUserId) {
      learner = store.learnerUsers.find((u) => u.id === demoUserId);
    } else if (demoQuickAccess) {
      learner = store.learnerUsers[0];
    } else if (email && password) {
      learner = store.learnerUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!learner) {
      return res.status(401).json({ error: 'Identifiants apprenant invalides.' });
    }
    if (learner.status === 'SUSPENDED') {
      addAuditLog({
        actorId: learner.id,
        actorName: learner.name,
        actorSpace: 'learner',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: learner.id,
        targetLabel: `${learner.name} (${learner.email})`,
        details: 'Tentative de connexion bloquée : compte apprenant suspendu.',
        severity: 'WARNING',
      });
      return res.status(403).json({ error: 'Ce compte est suspendu par le Superadmin.' });
    }

    learner.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: learner.id,
      actorName: learner.name,
      actorSpace: 'learner',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: learner.id,
      targetLabel: `${learner.name} (${learner.email})`,
      details: 'Connexion espace Apprenant B2B.',
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    learnerSessions.set(token, { id: token, user: learner, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_learner_session', token);

    return res.json({
      token,
      user: {
        id: learner.id,
        email: learner.email,
        name: learner.name,
        companyName: learner.companyName,
        jobTitle: learner.jobTitle,
      },
    });
  });

  app.post('/api/learner/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_learner_session');
    if (token) learnerSessions.delete(token);
    res.clearCookie('tpd_learner_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/learner/auth/me', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: learner.id,
        email: learner.email,
        name: learner.name,
        companyName: learner.companyName,
        jobTitle: learner.jobTitle,
      },
    });
  });

  function hydrateLearnerCourse(course: LearnerCourse, learnerId: string) {
    const linked = course.linkedCourseId
      ? store.instructorCourses.find((ic) => ic.id === course.linkedCourseId)
      : undefined;
    const matchedInstructor = store.instructorUsers.find(
      (u) =>
        (linked && u.id === linked.instructorId) ||
        u.name.trim().toLowerCase() === course.instructor.trim().toLowerCase(),
    );

    const fallbackCover =
      course.modality === 'PRESENTIEL'
        ? '/src/assets/images/course_events_protocol_1794940323026.jpg'
        : course.category.toLowerCase().includes('finance') || course.category.toLowerCase().includes('syscohada')
        ? '/src/assets/images/course_syscohada_finance_1794940307275.jpg'
        : '/src/assets/images/course_cloud_cyber_1794940322970.jpg';

    const sections = (() => {
      if (course.lessons.length <= 2) {
        return [
          {
            id: `${course.id}-sec-1`,
            title: 'Section 1 : Parcours principal & Validation',
            description: course.scheduleInfo,
            lessonIds: course.lessons.map((l) => l.id),
          },
        ];
      }
      const splitIdx = Math.ceil(course.lessons.length / 2);
      return [
        {
          id: `${course.id}-sec-1`,
          title: 'Section 1 : Fondamentaux & Architecture',
          description: linked?.chapters?.[0]?.description || 'Modules fondamentaux du programme B2B.',
          lessonIds: course.lessons.slice(0, splitIdx).map((l) => l.id),
        },
        {
          id: `${course.id}-sec-2`,
          title: 'Section 2 : Pratique, Cas réels & Certification',
          description: linked?.chapters?.[1]?.description || 'Ateliers pratiques et évaluation certificative.',
          lessonIds: course.lessons.slice(splitIdx).map((l) => l.id),
        },
      ];
    })();

    const objectives = course.lessons.map((l) => l.summary).filter(Boolean);
    const questions = store.learnerCourseQuestions.filter((q) => q.courseId === course.id);
    const notes = store.learnerLessonNotes.filter(
      (n) => n.courseId === course.id && n.learnerId === learnerId,
    );

    return {
      ...course,
      instructorAvatarUrl: matchedInstructor?.avatarUrl || linked?.instructorAvatarUrl,
      description:
        linked?.description ||
        `Formation professionnelle B2B (${course.category}) animée par ${course.instructor} pour ${course.companySponsor}.`,
      coverImage: linked?.images?.[0] || fallbackCover,
      rating: linked?.rating ?? 4.8,
      reviewsCount: Math.max(18, (linked?.enrolledCount ?? 24) * 3),
      level: linked?.level || 'TOUS_NIVEAUX',
      objectives:
        objectives.length > 0
          ? objectives
          : ['Maîtriser les compétences clés du référentiel métier', 'Obtenir votre attestation nominative vérifiable'],
      sections,
      questions,
      notes,
    };
  }

  app.get('/api/learner/dashboard', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Authentification apprenant requise.' });

    const courses = store.learnerCourses
      .filter((c) => c.learnerId === learner.id)
      .map((c) => hydrateLearnerCourse(c, learner.id));
    return res.json({
      learner: {
        id: learner.id,
        email: learner.email,
        name: learner.name,
        companyName: learner.companyName,
        jobTitle: learner.jobTitle,
      },
      courses,
    });
  });

  app.post('/api/learner/lessons/toggle', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Authentification apprenant requise.' });

    const { courseId, lessonId, completed } = req.body as {
      courseId?: string;
      lessonId?: string;
      completed?: boolean;
    };
    const course = store.learnerCourses.find((c) => c.id === courseId && c.learnerId === learner.id);
    if (!course) return res.status(404).json({ error: 'Formation introuvable.' });

    const lesson = course.lessons.find((l) => l.id === lessonId);
    if (!lesson) return res.status(404).json({ error: 'Module pédagogique introuvable.' });

    lesson.completed = typeof completed === 'boolean' ? completed : !lesson.completed;
    const allCompleted = course.lessons.every((l) => l.completed);
    let newlyCertified = false;

    if (allCompleted && !course.certificate) {
      const modalityLabel =
        course.modality === 'EN_LIGNE'
          ? 'En ligne'
          : course.modality === 'HYBRIDE'
          ? 'Hybride'
          : 'Présentiel';
      course.certificate = {
        certificateNumber: `CERT-TPD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
        issuedAt: new Date().toISOString().slice(0, 10),
        mention: `Validé avec succès — Formation B2B (${modalityLabel})`,
      };
      newlyCertified = true;
    }

    // Synchroniser la progression en temps réel vers l'espace Formateur Pro
    if (course.linkedCourseId) {
      const doneCount = course.lessons.filter((l) => l.completed).length;
      const pct = course.lessons.length > 0 ? Math.round((doneCount / course.lessons.length) * 100) : 0;
      const enrollment = store.instructorEnrollments.find(
        (e) => e.courseId === course.linkedCourseId && (e.learnerId === learner.id || e.learnerName === learner.name),
      );
      if (enrollment) {
        enrollment.progressPct = pct;
        enrollment.attendanceStatus = course.certificate
          ? 'CERTIFIE'
          : enrollment.modality === 'EN_LIGNE'
          ? 'EN_LIGNE_ACTIF'
          : 'PRESENT';
      }
    }

    return res.json({ course: hydrateLearnerCourse(course, learner.id), newlyCertified });
  });

  app.post('/api/learner/courses/:courseId/questions', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Authentification apprenant requise.' });

    const course = store.learnerCourses.find(
      (c) => c.id === req.params.courseId && c.learnerId === learner.id,
    );
    if (!course) return res.status(404).json({ error: 'Formation introuvable.' });

    const { lessonId, title, body } = req.body as {
      lessonId?: string;
      title?: string;
      body?: string;
    };
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Objet et détail de votre question requis.' });
    }

    const lesson = course.lessons.find((l) => l.id === lessonId);
    const created = {
      id: `lq-${Date.now()}`,
      courseId: course.id,
      lessonId: lesson?.id,
      lessonTitle: lesson?.title,
      authorId: learner.id,
      authorName: learner.name,
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    store.learnerCourseQuestions.unshift(created);
    return res.status(201).json({
      question: created,
      course: hydrateLearnerCourse(course, learner.id),
    });
  });

  app.post('/api/learner/courses/:courseId/notes', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Authentification apprenant requise.' });

    const course = store.learnerCourses.find(
      (c) => c.id === req.params.courseId && c.learnerId === learner.id,
    );
    if (!course) return res.status(404).json({ error: 'Formation introuvable.' });

    const { lessonId, content } = req.body as { lessonId?: string; content?: string };
    if (!lessonId || !content?.trim()) {
      return res.status(400).json({ error: 'Module et contenu de note requis.' });
    }

    const created = {
      id: `ln-${Date.now()}`,
      courseId: course.id,
      lessonId,
      learnerId: learner.id,
      content: content.trim(),
      updatedAt: new Date().toISOString(),
    };
    store.learnerLessonNotes.unshift(created);
    return res.status(201).json({
      note: created,
      course: hydrateLearnerCourse(course, learner.id),
    });
  });

  app.post('/api/learner/enroll', (req: Request, res: Response) => {
    const learner = getLearnerUser(req);
    if (!learner) return res.status(401).json({ error: 'Authentification apprenant requise.' });

    const { instructorCourseId } = req.body as { instructorCourseId?: string };
    const ic = store.instructorCourses.find((c) => c.id === instructorCourseId && c.status === 'PUBLISHED');
    if (!ic) {
      return res.status(404).json({ error: 'Formation publiée introuvable dans le catalogue.' });
    }

    const existing = store.learnerCourses.find(
      (c) => c.learnerId === learner.id && c.linkedCourseId === ic.id,
    );
    if (existing) {
      return res.json({ course: existing, alreadyEnrolled: true });
    }

    const lessons = ic.chapters.flatMap((ch) =>
      ch.lessons.map((l) => ({
        id: `les-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${ch.title} — ${l.title}`,
        format: (l.type === 'VIDEO'
          ? 'VIDEO'
          : l.type === 'ATELIER'
          ? 'ATELIER'
          : 'SUPPORT_PDF') as LearnerCourse['lessons'][number]['format'],
        durationMinutes: l.durationMinutes || 30,
        summary: l.textContent || l.fileName || ch.description || 'Module pédagogique B2B.',
        completed: false,
      })),
    );
    if (lessons.length === 0) {
      lessons.push({
        id: `les-${Date.now()}`,
        title: 'Module 1 : Introduction & Évaluation',
        format: 'EVALUATION',
        durationMinutes: 45,
        summary: ic.description || 'Parcours certifiant Teranga Prestige.',
        completed: false,
      });
    }

    const parsedHours = Number.parseInt(ic.estimatedDuration, 10) || 14;
    const newCourse: LearnerCourse = {
      id: `lc-${Date.now()}`,
      learnerId: learner.id,
      linkedCourseId: ic.id,
      title: ic.title,
      category: ic.category,
      modality: ic.modality,
      instructor: ic.instructorName,
      companySponsor: learner.companyName,
      startDate: ic.nextSessionDate || new Date().toISOString().slice(0, 10),
      scheduleInfo: ic.locationOrPlatform || 'À votre rythme — Plateforme Teranga',
      durationHours: parsedHours,
      lessons,
    };
    store.learnerCourses.unshift(newCourse);
    ic.enrolledCount += 1;

    const newEnrollment = {
      id: `enr-${Date.now()}`,
      courseId: ic.id,
      courseTitle: ic.title,
      learnerId: learner.id,
      learnerName: learner.name,
      companyName: learner.companyName,
      modality: ic.modality,
      progressPct: 0,
      attendanceStatus: (ic.modality === 'EN_LIGNE' ? 'EN_LIGNE_ACTIF' : 'PRESENT') as InstructorEnrollment['attendanceStatus'],
      enrolledAt: new Date().toISOString().slice(0, 10),
    };
    store.instructorEnrollments.unshift(newEnrollment);

    upsertCommissionForEnrollment(newEnrollment, ic);

    return res.status(201).json({
      course: hydrateLearnerCourse(newCourse, learner.id),
      alreadyEnrolled: false,
    });
  });

  // =========================================================================
  // MODULE ESPACE FORMATEUR PRO (CRÉATION & GESTION DE COURS MULTIFORMATS)
  // =========================================================================

  app.post('/api/instructor/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess, demoUserId } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
      demoUserId?: string;
    };

    let instructor: InstructorUser | undefined;
    if (demoUserId) {
      instructor = store.instructorUsers.find((u) => u.id === demoUserId);
    } else if (demoQuickAccess) {
      instructor = store.instructorUsers[0];
    } else if (email && password) {
      instructor = store.instructorUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!instructor) {
      return res.status(401).json({ error: 'Identifiants formateur invalides.' });
    }
    if (instructor.status === 'SUSPENDED') {
      addAuditLog({
        actorId: instructor.id,
        actorName: instructor.name,
        actorSpace: 'instructor',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: instructor.id,
        targetLabel: `${instructor.name} (${instructor.email})`,
        details: 'Tentative de connexion bloquée : compte formateur suspendu.',
        severity: 'WARNING',
      });
      return res.status(403).json({ error: 'Ce compte est suspendu par le Superadmin.' });
    }

    instructor.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: instructor.id,
      actorName: instructor.name,
      actorSpace: 'instructor',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: instructor.id,
      targetLabel: `${instructor.name} (${instructor.email})`,
      details: 'Connexion espace Formateur Pro.',
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    instructorSessions.set(token, { id: token, user: instructor, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_instructor_session', token);

    return res.json({
      token,
      user: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
        specialty: instructor.specialty,
        city: instructor.city,
        avatarUrl: instructor.avatarUrl,
      },
    });
  });

  app.post('/api/instructor/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_instructor_session');
    if (token) instructorSessions.delete(token);
    res.clearCookie('tpd_instructor_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/instructor/auth/me', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
        specialty: instructor.specialty,
        city: instructor.city,
        avatarUrl: instructor.avatarUrl,
      },
    });
  });

  app.patch('/api/instructor/profile', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });
    const body = req.body as { avatarUrl?: string | null };
    if (body.avatarUrl !== undefined) {
      const check = sanitizeImageInput(body.avatarUrl);
      if (!check.valid) {
        return res.status(400).json({ error: 'Format d’image invalide (PNG, JPG, WebP ou SVG ≤ 5 Mo).' });
      }
      instructor.avatarUrl = check.clear ? undefined : check.value;
      store.instructorCourses.forEach((c) => {
        if (c.instructorId === instructor.id) {
          c.instructorAvatarUrl = instructor.avatarUrl;
        }
      });
    }
    addAuditLog({
      actorId: instructor.id,
      actorName: instructor.name,
      actorSpace: 'instructor',
      action: 'PROFILE_MEDIA_UPDATED',
      targetType: 'USER',
      targetId: instructor.id,
      targetLabel: instructor.name,
      details: instructor.avatarUrl ? 'Photo de profil formateur mise à jour.' : 'Photo de profil formateur retirée.',
      severity: 'INFO',
    });
    return res.json({
      instructor: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
        specialty: instructor.specialty,
        city: instructor.city,
        avatarUrl: instructor.avatarUrl,
      },
    });
  });

  function syncCourseNextSessionDate(courseId: string): void {
    const course = store.instructorCourses.find((c) => c.id === courseId);
    if (!course) return;
    const upcoming = store.courseOrganizationSessions
      .filter(
        (s) =>
          s.courseId === courseId &&
          (s.status === 'PLANIFIEE' || s.status === 'CONFIRMEE' || s.status === 'EN_COURS'),
      )
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))[0];
    if (upcoming) {
      course.nextSessionDate = upcoming.sessionDate;
      const parsedHour = Number.parseInt(upcoming.startTime.split(':')[0] || '', 10);
      if (!Number.isNaN(parsedHour) && parsedHour >= 6 && parsedHour <= 22) {
        course.startHour = parsedHour;
      }
      course.updatedAt = new Date().toISOString();
      store.learnerCourses.forEach((lc) => {
        if (lc.linkedCourseId === course.id) {
          lc.startDate = upcoming.sessionDate;
        }
      });
    }
  }

  function buildTrainingRequestsOverviewForActor(actor: ActiveActor): TrainingRequestsOverviewPayload {
    const isGlobalRole =
      actor.space === 'superadmin' ||
      actor.space === 'instructor' ||
      (actor.space === 'intranet' &&
        (actor.role === 'OWNER' || actor.role === 'DIRECTION' || actor.role === 'MANAGER'));

    const visibleRaw = isGlobalRole
      ? store.trainingRequests
      : store.trainingRequests.filter(
          (r) =>
            r.requesterUserId === actor.id ||
            (actor.organizationName && r.organizationName === actor.organizationName),
        );

    const requests: TrainingRequestRecord[] = visibleRaw.map((r) => {
      let canManage = false;
      if (actor.space === 'superadmin') canManage = true;
      else if (actor.space === 'instructor') canManage = r.instructorId === actor.id;
      else if (
        actor.space === 'intranet' &&
        (actor.role === 'OWNER' || actor.role === 'DIRECTION' || actor.role === 'MANAGER')
      ) {
        canManage = true;
      } else {
        canManage = r.requesterUserId === actor.id;
      }
      return {
        ...r,
        instructorAvatarUrl: r.instructorId
          ? store.instructorUsers.find((u) => u.id === r.instructorId)?.avatarUrl
          : undefined,
        canManage,
      };
    });

    const active = requests.filter((r) => r.stage !== 'REFUSEE');
    const validatedOrRunningCount = requests.filter(
      (r) => r.stage === 'VALIDEE_PLANIFIEE' || r.stage === 'EN_COURS',
    ).length;
    const completedCount = requests.filter((r) => r.stage === 'TERMINEE').length;
    const convertedCount = validatedOrRunningCount + completedCount;

    return {
      requests,
      instructorsCatalog: store.instructorUsers.map((u) => ({
        id: u.id,
        name: u.name,
        specialty: u.specialty,
        city: u.city,
        avatarUrl: u.avatarUrl,
      })),
      kpis: {
        total: requests.length,
        newCount: requests.filter(
          (r) => r.stage === 'NOUVELLE_DEMANDE' || r.stage === 'ANALYSE_BESOIN',
        ).length,
        inProgressCount: requests.filter((r) => r.stage === 'DEVIS_ENVOYE').length,
        validatedOrRunningCount,
        completedCount,
        totalVolumeFcfa: active.reduce(
          (s, r) => s + (r.quotedAmountFcfa ?? r.budgetEstimatedFcfa),
          0,
        ),
        conversionRatePct:
          active.length > 0 ? Math.round((convertedCount / active.length) * 100) : 0,
      },
    };
  }

  app.get('/api/instructor/dashboard', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const courses = store.instructorCourses.filter((c) => c.instructorId === instructor.id);
    const courseIds = new Set(courses.map((c) => c.id));
    const enrollments = store.instructorEnrollments.filter((e) => courseIds.has(e.courseId));
    const sessions = store.courseOrganizationSessions
      .filter((s) => s.instructorId === instructor.id)
      .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    const trainingRequestsPayload = buildTrainingRequestsOverviewForActor({
      id: instructor.id,
      space: 'instructor',
      role: 'INSTRUCTOR',
      name: instructor.name,
      email: instructor.email,
      organizationId: instructor.city,
      organizationName: `Formateur · ${instructor.city}`,
    });

    return res.json({
      instructor: {
        id: instructor.id,
        email: instructor.email,
        name: instructor.name,
        specialty: instructor.specialty,
        city: instructor.city,
        avatarUrl: instructor.avatarUrl,
      },
      courses,
      enrollments,
      sessions,
      trainingRequestsPayload,
    });
  });

  app.post('/api/instructor/courses', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const payload = req.body as Partial<InstructorCourse>;
    if (!payload.title?.trim()) {
      return res.status(400).json({ error: 'Le nom du cours est obligatoire.' });
    }

    const now = new Date().toISOString();
    const created: InstructorCourse = {
      id: `ic-${Date.now()}`,
      instructorId: instructor.id,
      instructorName: instructor.name,
      instructorAvatarUrl: instructor.avatarUrl,
      title: payload.title.trim(),
      category: payload.category || 'Formations & Masterclasses',
      pricingModel: payload.pricingModel || 'ONE_TIME',
      priceFcfa: Number(payload.priceFcfa ?? 0),
      promoPriceFcfa: payload.promoPriceFcfa ? Number(payload.promoPriceFcfa) : undefined,
      description: payload.description?.trim() || '',
      level: payload.level || 'TOUS_NIVEAUX',
      estimatedDuration: payload.estimatedDuration?.trim() || '4h 00min',
      modality: payload.modality || 'EN_LIGNE',
      locationOrPlatform: payload.locationOrPlatform?.trim() || undefined,
      nextSessionDate: payload.nextSessionDate?.trim() || undefined,
      trailerYoutubeUrl: payload.trailerYoutubeUrl?.trim() || undefined,
      chapters: Array.isArray(payload.chapters) ? payload.chapters : [],
      images: Array.isArray(payload.images) ? payload.images.slice(0, 4) : [],
      promoBadge: payload.promoBadge?.trim() || undefined,
      status: payload.status || 'PUBLISHED',
      enrolledCount: 0,
      completionRate: 0,
      rating: 5.0,
      createdAt: now,
      updatedAt: now,
    };

    store.instructorCourses.unshift(created);
    return res.status(201).json({ course: created });
  });

  app.put('/api/instructor/courses/:courseId', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const idx = store.instructorCourses.findIndex(
      (c) => c.id === req.params.courseId && c.instructorId === instructor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Cours introuvable.' });

    const existing = store.instructorCourses[idx];
    const payload = req.body as Partial<InstructorCourse>;
    if (!payload.title?.trim()) {
      return res.status(400).json({ error: 'Le nom du cours est obligatoire.' });
    }

    const updated: InstructorCourse = {
      ...existing,
      title: payload.title.trim(),
      category: payload.category || existing.category,
      pricingModel: payload.pricingModel || existing.pricingModel,
      priceFcfa: Number(payload.priceFcfa ?? existing.priceFcfa),
      promoPriceFcfa: payload.promoPriceFcfa ? Number(payload.promoPriceFcfa) : undefined,
      description: payload.description?.trim() ?? existing.description,
      level: payload.level || existing.level,
      estimatedDuration: payload.estimatedDuration?.trim() || existing.estimatedDuration,
      modality: payload.modality || existing.modality,
      locationOrPlatform: payload.locationOrPlatform?.trim() || undefined,
      nextSessionDate: payload.nextSessionDate?.trim() || undefined,
      trailerYoutubeUrl: payload.trailerYoutubeUrl?.trim() || undefined,
      chapters: Array.isArray(payload.chapters) ? payload.chapters : existing.chapters,
      images: Array.isArray(payload.images) ? payload.images.slice(0, 4) : existing.images,
      promoBadge: payload.promoBadge?.trim() || undefined,
      status: payload.status || existing.status,
      updatedAt: new Date().toISOString(),
    };

    store.instructorCourses[idx] = updated;
    return res.json({ course: updated });
  });

  app.patch('/api/instructor/courses/:courseId/status', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const course = store.instructorCourses.find(
      (c) => c.id === req.params.courseId && c.instructorId === instructor.id,
    );
    if (!course) return res.status(404).json({ error: 'Cours introuvable.' });

    const { status } = req.body as { status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' };
    if (!status || !['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    course.status = status;
    course.updatedAt = new Date().toISOString();
    return res.json({ course });
  });

  app.post('/api/instructor/courses/:courseId/duplicate', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const source = store.instructorCourses.find(
      (c) => c.id === req.params.courseId && c.instructorId === instructor.id,
    );
    if (!source) return res.status(404).json({ error: 'Cours introuvable.' });

    const now = new Date().toISOString();
    const copy: InstructorCourse = {
      ...structuredClone(source),
      id: `ic-${Date.now()}`,
      title: `${source.title} (Copie)`,
      status: 'DRAFT',
      enrolledCount: 0,
      completionRate: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.instructorCourses.unshift(copy);
    return res.status(201).json({ course: copy });
  });

  app.delete('/api/instructor/courses/:courseId', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const idx = store.instructorCourses.findIndex(
      (c) => c.id === req.params.courseId && c.instructorId === instructor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Cours introuvable.' });

    store.instructorCourses.splice(idx, 1);
    store.instructorEnrollments = store.instructorEnrollments.filter((e) => e.courseId !== req.params.courseId);
    return res.json({ ok: true });
  });

  app.patch('/api/instructor/enrollments/:enrollmentId/attendance', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const enrollment = store.instructorEnrollments.find((e) => e.id === req.params.enrollmentId);
    if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable.' });

    const ownerCourse = store.instructorCourses.find(
      (c) => c.id === enrollment.courseId && c.instructorId === instructor.id,
    );
    if (!ownerCourse) {
      return res.status(403).json({ error: 'Vous ne pouvez gérer que les apprenants de vos propres cours.' });
    }

    const { attendanceStatus } = req.body as {
      attendanceStatus?: 'PRESENT' | 'EN_LIGNE_ACTIF' | 'ABSENT' | 'CERTIFIE';
    };
    if (!attendanceStatus) return res.status(400).json({ error: 'Statut requis.' });

    enrollment.attendanceStatus = attendanceStatus;
    if (attendanceStatus === 'CERTIFIE') {
      enrollment.progressPct = 100;
      // Synchroniser automatiquement la délivrance du certificat côté Espace Apprenant
      const learnerCourse = store.learnerCourses.find(
        (c) =>
          c.linkedCourseId === enrollment.courseId &&
          (enrollment.learnerId ? c.learnerId === enrollment.learnerId : true),
      );
      if (learnerCourse) {
        learnerCourse.lessons.forEach((l) => {
          l.completed = true;
        });
        if (!learnerCourse.certificate) {
          learnerCourse.certificate = {
            certificateNumber: `CERT-TPD-2026-${String(Math.floor(1000 + Math.random() * 9000))}`,
            issuedAt: new Date().toISOString().slice(0, 10),
            mention: `Certifié par le formateur ${instructor.name}`,
          };
        }
      }
    }
    return res.json({ enrollment });
  });

  // -------------------------------------------------------------------------
  // ORGANISATION DES COURS FORMATEUR (SÉANCES, COHORTES & CHAPITRES)
  // -------------------------------------------------------------------------

  app.post('/api/instructor/courses/:courseId/reorder-chapters', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const course = store.instructorCourses.find(
      (c) => c.id === req.params.courseId && c.instructorId === instructor.id,
    );
    if (!course) return res.status(404).json({ error: 'Cours introuvable.' });

    const { chapterIds } = req.body as { chapterIds?: string[] };
    if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
      return res.status(400).json({ error: 'Ordre des chapitres requis.' });
    }

    const byId = new Map(course.chapters.map((ch) => [ch.id, ch]));
    const reordered = chapterIds
      .map((id) => byId.get(id))
      .filter((ch): ch is NonNullable<typeof ch> => Boolean(ch));
    const remaining = course.chapters.filter((ch) => !chapterIds.includes(ch.id));
    course.chapters = [...reordered, ...remaining];
    course.updatedAt = new Date().toISOString();

    broadcastTrainingRealtime({
      eventType: 'course_chapters:reordered',
      courseId: course.id,
      instructorId: instructor.id,
    });

    return res.json({ course });
  });

  app.post('/api/instructor/sessions', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const {
      courseId,
      cohortName,
      chapterId,
      modality,
      sessionDate,
      startTime,
      endTime,
      locationOrLink,
      maxSeats,
      enrolledCount,
      status,
      linkedRequestId,
      notes,
      checklist,
    } = req.body as Partial<CourseOrganizationSession>;

    const course = store.instructorCourses.find(
      (c) => c.id === courseId && c.instructorId === instructor.id,
    );
    if (!course) {
      return res.status(404).json({ error: 'Cours associé introuvable pour ce formateur.' });
    }
    if (!cohortName?.trim() || !sessionDate) {
      return res.status(400).json({ error: 'Nom de cohorte et date de séance obligatoires.' });
    }

    const matchedChapter = chapterId
      ? course.chapters.find((ch) => ch.id === chapterId)
      : course.chapters[0];

    const defaultChecklist: CourseSessionChecklistItem[] =
      Array.isArray(checklist) && checklist.length > 0
        ? checklist
        : [
            { id: `chk-${Date.now()}-1`, label: 'Préparer les supports de cours et cas pratiques', done: false },
            { id: `chk-${Date.now()}-2`, label: 'Vérifier la liste d’émargement et les accès salle/visio', done: false },
            { id: `chk-${Date.now()}-3`, label: 'Publier le rappel J-2 aux apprenants', done: false },
          ];

    const now = new Date().toISOString();
    const created: CourseOrganizationSession = {
      id: `cs-${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      instructorId: instructor.id,
      instructorName: instructor.name,
      cohortName: cohortName.trim(),
      chapterId: matchedChapter?.id,
      chapterTitle: matchedChapter?.title,
      modality: modality || course.modality,
      sessionDate,
      startTime: startTime || '09:00',
      endTime: endTime || '13:00',
      locationOrLink:
        locationOrLink?.trim() ||
        course.locationOrPlatform ||
        'Plateforme Visio Teranga',
      maxSeats: Math.max(1, Number(maxSeats || 20)),
      enrolledCount: Math.max(0, Number(enrolledCount || 0)),
      status: status || 'PLANIFIEE',
      linkedRequestId: linkedRequestId || undefined,
      notes: notes?.trim() || undefined,
      checklist: defaultChecklist,
      createdAt: now,
      updatedAt: now,
    };

    store.courseOrganizationSessions.unshift(created);
    syncCourseNextSessionDate(course.id);

    broadcastTrainingRealtime({
      eventType: 'course_session:updated',
      session: created,
      instructorId: instructor.id,
    });

    return res.status(201).json({ session: created });
  });

  app.patch('/api/instructor/sessions/:sessionId', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const session = store.courseOrganizationSessions.find(
      (s) => s.id === req.params.sessionId && s.instructorId === instructor.id,
    );
    if (!session) return res.status(404).json({ error: 'Séance introuvable.' });

    const payload = req.body as Partial<CourseOrganizationSession>;
    if (payload.cohortName !== undefined && payload.cohortName.trim()) {
      session.cohortName = payload.cohortName.trim();
    }
    if (payload.chapterId !== undefined) {
      const course = store.instructorCourses.find((c) => c.id === session.courseId);
      const ch = course?.chapters.find((x) => x.id === payload.chapterId);
      session.chapterId = ch?.id || undefined;
      session.chapterTitle = ch?.title || undefined;
    }
    if (payload.modality) session.modality = payload.modality;
    if (payload.sessionDate) session.sessionDate = payload.sessionDate;
    if (payload.startTime) session.startTime = payload.startTime;
    if (payload.endTime) session.endTime = payload.endTime;
    if (payload.locationOrLink !== undefined) {
      session.locationOrLink = payload.locationOrLink.trim() || session.locationOrLink;
    }
    if (typeof payload.maxSeats === 'number' && payload.maxSeats > 0) {
      session.maxSeats = payload.maxSeats;
    }
    if (typeof payload.enrolledCount === 'number' && payload.enrolledCount >= 0) {
      session.enrolledCount = payload.enrolledCount;
    }
    if (payload.status) session.status = payload.status as CourseSessionStatus;
    if (payload.notes !== undefined) session.notes = payload.notes.trim() || undefined;
    if (Array.isArray(payload.checklist)) session.checklist = payload.checklist;
    session.updatedAt = new Date().toISOString();

    syncCourseNextSessionDate(session.courseId);

    broadcastTrainingRealtime({
      eventType: 'course_session:updated',
      session,
      instructorId: instructor.id,
    });

    return res.json({ session });
  });

  app.delete('/api/instructor/sessions/:sessionId', (req: Request, res: Response) => {
    const instructor = getInstructorUser(req);
    if (!instructor) return res.status(401).json({ error: 'Authentification formateur requise.' });

    const idx = store.courseOrganizationSessions.findIndex(
      (s) => s.id === req.params.sessionId && s.instructorId === instructor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Séance introuvable.' });

    const [removed] = store.courseOrganizationSessions.splice(idx, 1);
    syncCourseNextSessionDate(removed.courseId);

    broadcastTrainingRealtime({
      eventType: 'course_session:updated',
      deletedSessionId: removed.id,
      instructorId: instructor.id,
    });

    return res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // DEMANDES DE FORMATION & SUIVI GLOBAL EN TEMPS RÉEL (SSE + CRUD + CHAT)
  // -------------------------------------------------------------------------

  function upsertCommissionForTrainingRequest(
    reqItem: TrainingRequestRecord,
  ): CommissionRecord | null {
    const eligible: TrainingRequestStage[] = ['VALIDEE_PLANIFIEE', 'EN_COURS', 'TERMINEE'];
    const amount = reqItem.quotedAmountFcfa ?? reqItem.budgetEstimatedFcfa;
    if (!reqItem.instructorId || amount <= 0) return null;

    const existing = store.commissions.find(
      (c) => c.sourceType === 'COURSE_ENROLLMENT' && c.sourceId === reqItem.id,
    );
    const nowIso = new Date().toISOString();

    if (reqItem.stage === 'REFUSEE') {
      if (existing && (existing.status === 'EN_ATTENTE' || existing.status === 'VALIDEE')) {
        existing.status = 'ANNULEE';
        existing.notes = 'Demande de formation sur mesure annulée ou refusée.';
        existing.updatedAt = nowIso;
      }
      return existing || null;
    }

    if (!eligible.includes(reqItem.stage)) return existing || null;

    const instructor = store.instructorUsers.find((u) => u.id === reqItem.instructorId);
    const rule = resolveCommissionRule('INSTRUCTOR', reqItem.instructorId, reqItem.category);
    const calc = computeCommissionBreakdown(amount, rule.ratePercent, rule.fixedFeeFcfa);

    if (existing) {
      if (existing.status === 'EN_ATTENTE' || existing.status === 'VALIDEE') {
        existing.grossAmountFcfa = calc.gross;
        existing.commissionAmountFcfa = calc.commissionAmountFcfa;
        existing.netPartnerAmountFcfa = calc.netPartnerAmountFcfa;
        if (reqItem.stage === 'TERMINEE' && existing.status === 'EN_ATTENTE') {
          existing.status = 'VALIDEE';
          existing.validatedAt = nowIso;
        }
      }
      existing.updatedAt = nowIso;
      return existing;
    }

    const created: CommissionRecord = {
      id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      reference: nextCommissionReference(),
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: reqItem.instructorId,
      beneficiaryName: instructor?.name || reqItem.instructorName || 'Formateur Teranga',
      beneficiaryOrg: instructor?.specialty || 'Formateur Pro Teranga',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: reqItem.id,
      sourceTitle: `${reqItem.title} (${reqItem.reference})`,
      clientOrLearnerName: `${reqItem.requesterName} (${reqItem.organizationName})`,
      category: reqItem.category,
      grossAmountFcfa: calc.gross,
      appliedRatePercent: calc.rate,
      fixedFeeFcfa: calc.fixed,
      commissionAmountFcfa: calc.commissionAmountFcfa,
      netPartnerAmountFcfa: calc.netPartnerAmountFcfa,
      ruleId: rule.id,
      ruleName: rule.name,
      status: reqItem.stage === 'TERMINEE' ? 'VALIDEE' : 'EN_ATTENTE',
      validatedAt: reqItem.stage === 'TERMINEE' ? nowIso : undefined,
      notes: `Convention formation ${reqItem.conventionNumber || reqItem.reference} (${reqItem.participantsCount} participants).`,
      transactionDate: nowIso.slice(0, 10),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.commissions.unshift(created);
    return created;
  }

  app.get('/api/training-requests/stream', (req: Request, res: Response) => {
    const actor = resolveSseActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise pour le flux temps réel.' });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendPacket = (eventName: string, data: unknown) => {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendPacket('connected', {
      ok: true,
      actorId: actor.id,
      actorSpace: actor.space,
      timestamp: new Date().toISOString(),
    });

    const listener = (ev: TrainingRealtimeEvent) => {
      if (
        (ev.eventType === 'course_session:updated' || ev.eventType === 'course_chapters:reordered') &&
        actor.space === 'instructor' &&
        ev.instructorId &&
        ev.instructorId !== actor.id
      ) {
        return;
      }
      sendPacket(ev.eventType, ev);
    };

    trainingRealtimeBus.on('training_event', listener);
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      trainingRealtimeBus.off('training_event', listener);
      res.end();
    });
  });

  app.get('/api/training-requests', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildTrainingRequestsOverviewForActor(actor));
  });

  app.post('/api/training-requests', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const {
      title,
      category,
      courseId,
      instructorId,
      organizationName,
      modality,
      participantsCount,
      desiredStartDate,
      durationHours,
      locationOrCity,
      objectives,
      budgetEstimatedFcfa,
      priority,
    } = req.body as Partial<TrainingRequestRecord>;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'L’intitulé de la demande de formation est obligatoire.' });
    }

    const linkedCourse = courseId
      ? store.instructorCourses.find((c) => c.id === courseId)
      : undefined;
    const resolvedInstructorId = instructorId || linkedCourse?.instructorId;
    const resolvedInstructor = resolvedInstructorId
      ? store.instructorUsers.find((u) => u.id === resolvedInstructorId)
      : undefined;

    const seq = store.trainingRequests.length + 43;
    const now = new Date().toISOString();
    const created: TrainingRequestRecord = {
      id: `tr-req-${Date.now()}`,
      reference: `FRM-REQ-2026-${String(seq).padStart(3, '0')}`,
      title: title.trim(),
      category: category?.trim() || linkedCourse?.category || 'Formations & Masterclasses',
      courseId: linkedCourse?.id,
      courseTitle: linkedCourse?.title,
      instructorId: resolvedInstructor?.id || linkedCourse?.instructorId,
      instructorName: resolvedInstructor?.name || linkedCourse?.instructorName,
      requesterUserId: actor.id,
      requesterName: actor.name,
      requesterEmail: actor.email,
      requesterSpace: actor.space,
      organizationName: organizationName?.trim() || actor.organizationName,
      modality: modality || linkedCourse?.modality || 'HYBRIDE',
      participantsCount: Math.max(1, Number(participantsCount || 12)),
      desiredStartDate: desiredStartDate || '2026-12-10',
      durationHours: Math.max(2, Number(durationHours || 14)),
      locationOrCity: locationOrCity?.trim() || 'Dakar Plateau',
      objectives:
        objectives?.trim() ||
        'Montée en compétence opérationnelle et certification des équipes concernées.',
      budgetEstimatedFcfa: Math.max(0, Number(budgetEstimatedFcfa || 1200000)),
      priority: priority || 'NORMALE',
      stage: 'NOUVELLE_DEMANDE',
      messages: [],
      history: [
        {
          id: `trh-${Date.now()}`,
          actorName: actor.name,
          action: 'Demande de formation soumise sur la plateforme',
          stage: 'NOUVELLE_DEMANDE',
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    store.trainingRequests.unshift(created);
    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: `Création demande de formation ${created.reference}`,
      targetType: 'SYSTEM',
      targetLabel: created.title,
      details: `${created.organizationName} · ${created.participantsCount} participants · ${created.modality}`,
      severity: 'INFO',
    });

    broadcastTrainingRealtime({
      eventType: 'training_request:created',
      request: created,
    });

    return res.status(201).json({ request: created });
  });

  app.patch('/api/training-requests/:requestId/claim', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const reqItem = store.trainingRequests.find((r) => r.id === req.params.requestId);
    if (!reqItem) return res.status(404).json({ error: 'Demande de formation introuvable.' });

    const bodyInstructorId = (req.body as { instructorId?: string })?.instructorId;
    let targetInstructor = actor.space === 'instructor'
      ? store.instructorUsers.find((u) => u.id === actor.id)
      : store.instructorUsers.find((u) => u.id === bodyInstructorId);

    if (!targetInstructor && actor.space === 'superadmin' && store.instructorUsers[0]) {
      targetInstructor = store.instructorUsers[0];
    }
    if (!targetInstructor) {
      return res.status(403).json({ error: 'Seul un formateur certifié ou un Superadmin peut affecter la demande.' });
    }

    const now = new Date().toISOString();
    reqItem.instructorId = targetInstructor.id;
    reqItem.instructorName = targetInstructor.name;
    if (reqItem.stage === 'NOUVELLE_DEMANDE') {
      reqItem.stage = 'ANALYSE_BESOIN';
    }
    reqItem.updatedAt = now;
    reqItem.history.push({
      id: `trh-${Date.now()}`,
      actorName: actor.name,
      action: `Prise en charge par ${targetInstructor.name}`,
      stage: reqItem.stage,
      timestamp: now,
    });

    broadcastTrainingRealtime({
      eventType: 'training_request:updated',
      request: reqItem,
    });

    return res.json({ request: reqItem });
  });

  app.patch('/api/training-requests/:requestId/stage', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const reqItem = store.trainingRequests.find((r) => r.id === req.params.requestId);
    if (!reqItem) return res.status(404).json({ error: 'Demande de formation introuvable.' });

    const isSuper = actor.space === 'superadmin';
    const isManager =
      actor.space === 'intranet' &&
      (actor.role === 'OWNER' || actor.role === 'DIRECTION' || actor.role === 'MANAGER');
    const isAssignedInstructor = actor.space === 'instructor' && reqItem.instructorId === actor.id;
    const isRequester = reqItem.requesterUserId === actor.id;

    if (!isSuper && !isManager && !isAssignedInstructor && !isRequester) {
      return res.status(403).json({ error: 'Permissions insuffisantes sur cette demande.' });
    }

    const {
      stage,
      quotedAmountFcfa,
      instructorId,
      note,
      createSession,
      sessionDate,
      startTime,
      endTime,
      locationOrLink,
      courseId,
    } = req.body as {
      stage?: TrainingRequestStage;
      quotedAmountFcfa?: number;
      instructorId?: string;
      note?: string;
      createSession?: boolean;
      sessionDate?: string;
      startTime?: string;
      endTime?: string;
      locationOrLink?: string;
      courseId?: string;
    };

    const allowedStages: TrainingRequestStage[] = [
      'NOUVELLE_DEMANDE',
      'ANALYSE_BESOIN',
      'DEVIS_ENVOYE',
      'VALIDEE_PLANIFIEE',
      'EN_COURS',
      'TERMINEE',
      'REFUSEE',
    ];
    if (!stage || !allowedStages.includes(stage)) {
      return res.status(400).json({ error: 'Étape de demande invalide.' });
    }

    const now = new Date().toISOString();
    const seq = store.trainingRequests.length + 50;

    if (instructorId && (isSuper || isManager)) {
      const targetInst = store.instructorUsers.find((u) => u.id === instructorId);
      if (targetInst) {
        reqItem.instructorId = targetInst.id;
        reqItem.instructorName = targetInst.name;
      }
    }

    if (typeof quotedAmountFcfa === 'number' && quotedAmountFcfa > 0) {
      reqItem.quotedAmountFcfa = quotedAmountFcfa;
    }

    reqItem.stage = stage;
    if (stage === 'DEVIS_ENVOYE' && !reqItem.quoteNumber) {
      reqItem.quoteNumber = `DEV-FRM-2026-${String(seq).padStart(3, '0')}`;
      if (!reqItem.quotedAmountFcfa) reqItem.quotedAmountFcfa = reqItem.budgetEstimatedFcfa;
    }
    if (stage === 'VALIDEE_PLANIFIEE' || stage === 'EN_COURS' || stage === 'TERMINEE') {
      if (!reqItem.quoteNumber) reqItem.quoteNumber = `DEV-FRM-2026-${String(seq).padStart(3, '0')}`;
      if (!reqItem.conventionNumber) reqItem.conventionNumber = `CONV-FRM-2026-${String(seq).padStart(3, '0')}`;
    }

    let createdSession: CourseOrganizationSession | undefined;
    if (createSession && (reqItem.instructorId || actor.space === 'instructor')) {
      const targetInstId = reqItem.instructorId || actor.id;
      const targetInst = store.instructorUsers.find((u) => u.id === targetInstId);
      const linkedCourse =
        store.instructorCourses.find((c) => c.id === (courseId || reqItem.courseId)) ||
        store.instructorCourses.find((c) => c.instructorId === targetInstId);

      createdSession = {
        id: `cs-${Date.now()}`,
        courseId: linkedCourse?.id || `ic-custom-${Date.now()}`,
        courseTitle: linkedCourse?.title || reqItem.title,
        instructorId: targetInstId,
        instructorName: targetInst?.name || reqItem.instructorName || actor.name,
        cohortName: `Cohorte ${reqItem.organizationName}`,
        chapterId: linkedCourse?.chapters[0]?.id,
        chapterTitle: linkedCourse?.chapters[0]?.title,
        modality: reqItem.modality,
        sessionDate: sessionDate || reqItem.desiredStartDate,
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        locationOrLink: locationOrLink?.trim() || reqItem.locationOrCity,
        maxSeats: Math.max(reqItem.participantsCount + 4, 15),
        enrolledCount: reqItem.participantsCount,
        status: 'CONFIRMEE',
        linkedRequestId: reqItem.id,
        notes: `Séance créée depuis la demande ${reqItem.reference}.`,
        checklist: [
          { id: `chk-${Date.now()}-1`, label: 'Valider la convention & programme adapté', done: true },
          { id: `chk-${Date.now()}-2`, label: 'Transmettre convocation & supports aux participants', done: false },
          { id: `chk-${Date.now()}-3`, label: 'Préparer attestation de fin de formation', done: false },
        ],
        createdAt: now,
        updatedAt: now,
      };
      store.courseOrganizationSessions.unshift(createdSession);
      reqItem.scheduledSessionId = createdSession.id;
      if (linkedCourse) syncCourseNextSessionDate(linkedCourse.id);
      broadcastTrainingRealtime({
        eventType: 'course_session:updated',
        session: createdSession,
        instructorId: targetInstId,
      });
    }

    reqItem.updatedAt = now;
    reqItem.history.push({
      id: `trh-${Date.now()}`,
      actorName: actor.name,
      action: note?.trim() || `Transition vers l’étape ${stage}`,
      stage,
      timestamp: now,
    });

    upsertCommissionForTrainingRequest(reqItem);
    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: `Demande ${reqItem.reference} → ${stage}`,
      targetType: 'SYSTEM',
      targetLabel: reqItem.title,
      details: createdSession
        ? `Séance planifiée (${createdSession.sessionDate}) liée à la demande`
        : `Transition vers étape ${stage}`,
      severity: 'INFO',
    });

    broadcastTrainingRealtime({
      eventType: 'training_request:updated',
      request: reqItem,
    });

    return res.json({ request: reqItem, session: createdSession });
  });

  app.post('/api/training-requests/:requestId/messages', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const reqItem = store.trainingRequests.find((r) => r.id === req.params.requestId);
    if (!reqItem) return res.status(404).json({ error: 'Demande de formation introuvable.' });

    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide.' });
    }

    const now = new Date().toISOString();
    const roleLabel =
      actor.space === 'instructor'
        ? 'Formateur'
        : actor.space === 'superadmin'
          ? 'Superadmin'
          : actor.role || 'Client';

    const message = {
      id: `trm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: roleLabel,
      content: content.trim(),
      createdAt: now,
    };

    reqItem.messages.push(message);
    reqItem.updatedAt = now;

    broadcastTrainingRealtime({
      eventType: 'training_request:message',
      request: reqItem,
    });

    return res.status(201).json({ message, request: reqItem });
  });

  // =========================================================================
  // MODULE ESPACE PRESTATAIRES ÉVÉNEMENTIELS (OFFRES, DEMANDES, DEVIS, FACTURES)
  // =========================================================================

  app.post('/api/provider/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess, demoUserId } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
      demoUserId?: string;
    };

    let provider: ProviderUser | undefined;
    if (demoUserId) {
      provider = store.providerUsers.find((u) => u.id === demoUserId);
    } else if (demoQuickAccess) {
      provider = store.providerUsers[0];
    } else if (email && password) {
      provider = store.providerUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!provider) {
      return res.status(401).json({ error: 'Identifiants prestataire invalides.' });
    }
    if (provider.status === 'SUSPENDED') {
      addAuditLog({
        actorId: provider.id,
        actorName: provider.name,
        actorSpace: 'provider',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: provider.id,
        targetLabel: `${provider.name} (${provider.email})`,
        details: 'Tentative de connexion bloquée : compte prestataire suspendu.',
        severity: 'WARNING',
      });
      return res.status(403).json({ error: 'Ce compte est suspendu par le Superadmin.' });
    }

    provider.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: provider.id,
      actorName: provider.name,
      actorSpace: 'provider',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: provider.id,
      targetLabel: `${provider.name} (${provider.email})`,
      details: 'Connexion espace Prestataire Événementiel.',
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    providerSessions.set(token, { id: token, user: provider, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_provider_session', token);

    return res.json({
      token,
      user: {
        id: provider.id,
        email: provider.email,
        name: provider.name,
        companyName: provider.companyName,
        roleTitle: provider.roleTitle,
        city: provider.city,
        avatarUrl: provider.avatarUrl,
        companyLogoUrl: provider.companyLogoUrl,
      },
    });
  });

  app.post('/api/provider/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_provider_session');
    if (token) providerSessions.delete(token);
    res.clearCookie('tpd_provider_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/provider/auth/me', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: provider.id,
        email: provider.email,
        name: provider.name,
        companyName: provider.companyName,
        roleTitle: provider.roleTitle,
        city: provider.city,
        avatarUrl: provider.avatarUrl,
        companyLogoUrl: provider.companyLogoUrl,
      },
    });
  });

  app.patch('/api/provider/profile', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });
    const body = req.body as { avatarUrl?: string | null; companyLogoUrl?: string | null };

    if (body.avatarUrl !== undefined) {
      const check = sanitizeImageInput(body.avatarUrl);
      if (!check.valid) {
        return res.status(400).json({ error: 'Format photo de profil invalide.' });
      }
      provider.avatarUrl = check.clear ? undefined : check.value;
    }

    if (body.companyLogoUrl !== undefined) {
      const check = sanitizeImageInput(body.companyLogoUrl);
      if (!check.valid) {
        return res.status(400).json({ error: 'Format logo entreprise invalide.' });
      }
      provider.companyLogoUrl = check.clear ? undefined : check.value;
    }

    store.providerOffers.forEach((o) => {
      if (o.providerId === provider.id) {
        o.providerAvatarUrl = provider.avatarUrl;
        o.companyLogoUrl = provider.companyLogoUrl;
      }
    });

    addAuditLog({
      actorId: provider.id,
      actorName: provider.name,
      actorSpace: 'provider',
      action: 'PROFILE_MEDIA_UPDATED',
      targetType: 'USER',
      targetId: provider.id,
      targetLabel: `${provider.name} (${provider.companyName})`,
      details: 'Photo de profil / logo entreprise prestataire mis à jour.',
      severity: 'INFO',
    });

    return res.json({
      provider: {
        id: provider.id,
        email: provider.email,
        name: provider.name,
        companyName: provider.companyName,
        roleTitle: provider.roleTitle,
        city: provider.city,
        avatarUrl: provider.avatarUrl,
        companyLogoUrl: provider.companyLogoUrl,
      },
    });
  });

  app.get('/api/provider/dashboard', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const offers = store.providerOffers.filter((o) => o.providerId === provider.id);
    const requests = store.providerRequests.filter((r) => r.providerId === provider.id);

    return res.json({
      provider: {
        id: provider.id,
        email: provider.email,
        name: provider.name,
        companyName: provider.companyName,
        roleTitle: provider.roleTitle,
        city: provider.city,
        avatarUrl: provider.avatarUrl,
        companyLogoUrl: provider.companyLogoUrl,
      },
      offers,
      requests,
    });
  });

  app.post('/api/provider/offers', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const payload = req.body as Partial<ProviderServiceOffer>;
    if (!payload.title?.trim()) {
      return res.status(400).json({ error: 'Le nom de l’événement / prestation est obligatoire.' });
    }

    const now = new Date().toISOString();
    const created: ProviderServiceOffer = {
      id: `po-${Date.now()}`,
      providerId: provider.id,
      providerName: provider.name,
      providerAvatarUrl: provider.avatarUrl,
      companyName: provider.companyName,
      companyLogoUrl: provider.companyLogoUrl,
      title: payload.title.trim(),
      category: payload.category || 'Traiteur & Gastronomie',
      priceFcfa: Number(payload.priceFcfa ?? 0),
      referencePriceFcfa: payload.referencePriceFcfa ? Number(payload.referencePriceFcfa) : undefined,
      description: payload.description?.trim() || '',
      locationZone: payload.locationZone?.trim() || provider.city,
      capacityGuests: Number(payload.capacityGuests ?? 100),
      includedServices: Array.isArray(payload.includedServices) ? payload.includedServices : [],
      images: Array.isArray(payload.images) ? payload.images.slice(0, 4) : [],
      status: payload.status || 'PUBLISHED',
      requestsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.providerOffers.unshift(created);
    return res.status(201).json({ offer: created });
  });

  app.put('/api/provider/offers/:offerId', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const idx = store.providerOffers.findIndex(
      (o) => o.id === req.params.offerId && o.providerId === provider.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Prestation introuvable.' });

    const existing = store.providerOffers[idx];
    const payload = req.body as Partial<ProviderServiceOffer>;
    if (!payload.title?.trim()) {
      return res.status(400).json({ error: 'Le nom de l’événement / prestation est obligatoire.' });
    }

    const updated: ProviderServiceOffer = {
      ...existing,
      title: payload.title.trim(),
      category: payload.category || existing.category,
      priceFcfa: Number(payload.priceFcfa ?? existing.priceFcfa),
      referencePriceFcfa: payload.referencePriceFcfa ? Number(payload.referencePriceFcfa) : undefined,
      description: payload.description?.trim() ?? existing.description,
      locationZone: payload.locationZone?.trim() || existing.locationZone,
      capacityGuests: Number(payload.capacityGuests ?? existing.capacityGuests),
      includedServices: Array.isArray(payload.includedServices)
        ? payload.includedServices
        : existing.includedServices,
      images: Array.isArray(payload.images) ? payload.images.slice(0, 4) : existing.images,
      status: payload.status || existing.status,
      updatedAt: new Date().toISOString(),
    };

    store.providerOffers[idx] = updated;
    return res.json({ offer: updated });
  });

  app.patch('/api/provider/offers/:offerId/status', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const offer = store.providerOffers.find(
      (o) => o.id === req.params.offerId && o.providerId === provider.id,
    );
    if (!offer) return res.status(404).json({ error: 'Prestation introuvable.' });

    const { status } = req.body as { status?: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' };
    if (!status || !['PUBLISHED', 'DRAFT', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    offer.status = status;
    offer.updatedAt = new Date().toISOString();
    return res.json({ offer });
  });

  app.post('/api/provider/offers/:offerId/duplicate', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const source = store.providerOffers.find(
      (o) => o.id === req.params.offerId && o.providerId === provider.id,
    );
    if (!source) return res.status(404).json({ error: 'Prestation introuvable.' });

    const now = new Date().toISOString();
    const copy: ProviderServiceOffer = {
      ...structuredClone(source),
      id: `po-${Date.now()}`,
      title: `${source.title} (Copie)`,
      status: 'DRAFT',
      requestsCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    store.providerOffers.unshift(copy);
    return res.status(201).json({ offer: copy });
  });

  app.delete('/api/provider/offers/:offerId', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const idx = store.providerOffers.findIndex(
      (o) => o.id === req.params.offerId && o.providerId === provider.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Prestation introuvable.' });

    store.providerOffers.splice(idx, 1);
    return res.json({ ok: true });
  });

  app.post('/api/provider/requests', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const {
      offerId,
      clientName,
      clientCompany,
      clientEmail,
      eventType,
      eventDate,
      eventLocation,
      guestCount,
      notes,
      amountFcfa,
    } = req.body as {
      offerId?: string;
      clientName?: string;
      clientCompany?: string;
      clientEmail?: string;
      eventType?: string;
      eventDate?: string;
      eventLocation?: string;
      guestCount?: number;
      notes?: string;
      amountFcfa?: number;
    };

    const offer =
      store.providerOffers.find((o) => o.id === offerId && o.providerId === provider.id) ||
      store.providerOffers.find((o) => o.providerId === provider.id);

    if (!offer) return res.status(400).json({ error: 'Aucune prestation associée.' });

    const now = new Date().toISOString();
    const created = {
      id: `req-${Date.now()}`,
      providerId: provider.id,
      offerId: offer.id,
      offerTitle: offer.title,
      category: offer.category,
      clientName: clientName?.trim() || 'Mme Aminata Touré',
      clientCompany: clientCompany?.trim() || 'Teranga Corporate Client',
      clientEmail: clientEmail?.trim() || 'contact@client-b2b.sn',
      eventType: eventType?.trim() || 'Réception Corporate & Gala',
      eventDate: eventDate || '2026-12-22',
      eventLocation: eventLocation?.trim() || 'Dakar Plateau',
      guestCount: Number(guestCount || offer.capacityGuests || 120),
      notes: notes?.trim() || 'Demande reçue via le catalogue Teranga Connect.',
      stage: 'NOUVELLE_DEMANDE' as const,
      amountFcfa: Number(amountFcfa || offer.priceFcfa),
      createdAt: now,
      updatedAt: now,
    };

    offer.requestsCount += 1;
    store.providerRequests.unshift(created);
    return res.status(201).json({ request: created });
  });

  app.patch('/api/provider/requests/:requestId/stage', (req: Request, res: Response) => {
    const provider = getProviderUser(req);
    if (!provider) return res.status(401).json({ error: 'Authentification prestataire requise.' });

    const reqItem = store.providerRequests.find(
      (r) => r.id === req.params.requestId && r.providerId === provider.id,
    );
    if (!reqItem) return res.status(404).json({ error: 'Demande introuvable.' });

    const { stage, amountFcfa, notes } = req.body as {
      stage?: ProviderRequestStage;
      amountFcfa?: number;
      notes?: string;
    };
    if (!stage) return res.status(400).json({ error: 'Nouvel état requis.' });

    const seq = store.providerRequests.length + 10;
    reqItem.stage = stage;
    if (typeof amountFcfa === 'number' && amountFcfa > 0) reqItem.amountFcfa = amountFcfa;
    if (notes !== undefined) reqItem.notes = notes.trim();
    reqItem.updatedAt = new Date().toISOString();

    if (stage === 'DEVIS_ENVOYE' && !reqItem.quoteNumber) {
      reqItem.quoteNumber = `DEV-PRV-2026-${String(seq).padStart(3, '0')}`;
    }
    if (stage === 'COMMANDE_CONFIRMEE') {
      if (!reqItem.quoteNumber) reqItem.quoteNumber = `DEV-PRV-2026-${String(seq).padStart(3, '0')}`;
      if (!reqItem.orderNumber) reqItem.orderNumber = `CMD-PRV-2026-${String(seq).padStart(3, '0')}`;
    }
    if (stage === 'FACTURE_EMISE' || stage === 'PAYEE') {
      if (!reqItem.quoteNumber) reqItem.quoteNumber = `DEV-PRV-2026-${String(seq).padStart(3, '0')}`;
      if (!reqItem.orderNumber) reqItem.orderNumber = `CMD-PRV-2026-${String(seq).padStart(3, '0')}`;
      if (!reqItem.invoiceNumber) reqItem.invoiceNumber = `FAC-PRV-2026-${String(seq).padStart(3, '0')}`;
    }

    syncProviderRequestToCrm(reqItem, provider);
    upsertCommissionForProviderRequest(reqItem, provider);

    return res.json({ request: reqItem });
  });

  // =========================================================================
  // MODULE SUPERADMIN (AUTH, SUIVI UTILISATEURS, CRUD, SESSIONS & AUDIT)
  // =========================================================================

  function buildManagedUsers() {
    const intranetRecords = store.intranetUsers.map((u) => {
      const crmCount =
        store.crmContacts.filter((c) => c.ownerUserId === u.id).length +
        store.crmDocuments.filter((d) => d.ownerUserId === u.id).length;
      const evCount = store.platformEvents.filter(
        (e) => e.ownerUserId === u.id || e.assignedUserIds.includes(u.id),
      ).length;
      const msgCount = store.intranetMessages.filter((m) => m.senderId === u.id).length;
      return {
        userId: u.id,
        space: 'intranet' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        subtitle: u.title,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-10T09:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('intranet', u.id),
        ownedRecordsCount: crmCount + evCount + msgCount,
        activitySummary: `${crmCount} CRM · ${evCount} évts · ${msgCount} msgs`,
      };
    });

    const accountingRecords = store.accountingUsers.map((u) => {
      const entriesCount = store.accountingEntries.filter(
        (e) => e.organizationId === u.organizationId,
      ).length;
      return {
        userId: u.id,
        space: 'accounting' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        organizationId: u.organizationId,
        organizationName: u.organizationName,
        subtitle:
          u.role === 'ACCOUNTANT'
            ? 'Directeur Administratif & Financier'
            : u.role === 'OWNER'
            ? 'Propriétaire SYSCOHADA'
            : 'Audit Externe (Lecture seule)',
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-10T09:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('accounting', u.id),
        ownedRecordsCount: entriesCount,
        activitySummary: `${entriesCount} écritures SYSCOHADA`,
      };
    });

    const learnerRecords = store.learnerUsers.map((u) => {
      const myCourses = store.learnerCourses.filter((c) => c.learnerId === u.id);
      const certs = myCourses.filter((c) => Boolean(c.certificate)).length;
      return {
        userId: u.id,
        space: 'learner' as const,
        name: u.name,
        email: u.email,
        role: 'LEARNER',
        organizationId: u.companyName,
        organizationName: u.companyName,
        subtitle: u.jobTitle,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-15T10:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('learner', u.id),
        ownedRecordsCount: myCourses.length + certs,
        activitySummary: `${myCourses.length} cours · ${certs} certif.`,
      };
    });

    const instructorRecords = store.instructorUsers.map((u) => {
      const myCourses = store.instructorCourses.filter((c) => c.instructorId === u.id);
      const ids = new Set(myCourses.map((c) => c.id));
      const enrollments = store.instructorEnrollments.filter((e) => ids.has(e.courseId)).length;
      return {
        userId: u.id,
        space: 'instructor' as const,
        name: u.name,
        email: u.email,
        role: 'INSTRUCTOR',
        organizationId: u.city,
        organizationName: `Formateur · ${u.city}`,
        subtitle: u.specialty,
        city: u.city,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-15T10:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('instructor', u.id),
        ownedRecordsCount: myCourses.length + enrollments,
        activitySummary: `${myCourses.length} cours · ${enrollments} inscrits`,
      };
    });

    const providerRecords = store.providerUsers.map((u) => {
      const offers = store.providerOffers.filter((o) => o.providerId === u.id).length;
      const requests = store.providerRequests.filter((r) => r.providerId === u.id).length;
      return {
        userId: u.id,
        space: 'provider' as const,
        name: u.name,
        email: u.email,
        role: 'PROVIDER',
        organizationId: u.companyName,
        organizationName: u.companyName,
        subtitle: u.roleTitle,
        city: u.city,
        avatarUrl: u.avatarUrl,
        companyLogoUrl: u.companyLogoUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-20T10:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('provider', u.id),
        ownedRecordsCount: offers + requests,
        activitySummary: `${offers} offres · ${requests} demandes`,
      };
    });

    const superadminRecords = store.superadminUsers.map((u) => {
      const logs = store.auditLogs.filter((l) => l.actorId === u.id).length;
      return {
        userId: u.id,
        space: 'superadmin' as const,
        name: u.name,
        email: u.email,
        role: u.role,
        organizationId: 'tpd-superadmin',
        organizationName: 'Administration Plateforme',
        subtitle: u.title,
        avatarUrl: u.avatarUrl,
        status: u.status ?? ('ACTIVE' as UserAccountStatus),
        createdAt: u.createdAt || '2026-01-05T09:00:00Z',
        lastLoginAt: u.lastLoginAt,
        activeSessionsCount: countUserSessions('superadmin', u.id),
        ownedRecordsCount: logs,
        activitySummary: `${logs} actions d’audit`,
      };
    });

    return [
      ...superadminRecords,
      ...intranetRecords,
      ...accountingRecords,
      ...learnerRecords,
      ...instructorRecords,
      ...providerRecords,
    ];
  }

  function buildSuperadminOverview() {
    const users = buildManagedUsers();
    const spaceMeta: Array<{ space: PlatformSpace; label: string }> = [
      { space: 'intranet', label: 'Intranet & CRM' },
      { space: 'accounting', label: 'Comptabilité' },
      { space: 'learner', label: 'Apprenants' },
      { space: 'instructor', label: 'Formateurs' },
      { space: 'provider', label: 'Prestataires' },
      { space: 'superadmin', label: 'Superadmin' },
    ];
    const usersBySpace = spaceMeta.map((m) => {
      const subset = users.filter((u) => u.space === m.space);
      return {
        space: m.space,
        label: m.label,
        total: subset.length,
        active: subset.filter((u) => u.status === 'ACTIVE').length,
        suspended: subset.filter((u) => u.status === 'SUSPENDED').length,
        sessions: subset.reduce((s, u) => s + u.activeSessionsCount, 0),
      };
    });
    const uniqueOrgs = new Set(users.map((u) => u.organizationName).filter(Boolean));
    const moduleStats = {
      crmContacts: store.crmContacts.length,
      crmDocuments: store.crmDocuments.length,
      accountingEntries: store.accountingEntries.length,
      instructorCourses: store.instructorCourses.length,
      learnerEnrollments: store.instructorEnrollments.length,
      providerOffers: store.providerOffers.length,
      providerRequests: store.providerRequests.length,
      platformEvents: store.platformEvents.length,
    };
    const totalTrackedRecords = Object.values(moduleStats).reduce((s, v) => s + v, 0);

    return {
      kpis: {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
        suspendedUsers: users.filter((u) => u.status === 'SUSPENDED').length,
        activeSessionsTotal: users.reduce((s, u) => s + u.activeSessionsCount, 0),
        organizationsCount: uniqueOrgs.size,
        totalTrackedRecords,
      },
      usersBySpace,
      moduleStats,
      users,
      auditLogs: store.auditLogs,
    };
  }

  app.post('/api/superadmin/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess, demoUserId } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
      demoUserId?: string;
    };

    let admin: SuperadminUser | undefined;
    if (demoUserId) {
      admin = store.superadminUsers.find((u) => u.id === demoUserId);
    } else if (demoQuickAccess) {
      admin = store.superadminUsers[0];
    } else if (email && password) {
      admin = store.superadminUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!admin) {
      return res.status(401).json({ error: 'Identifiants Superadmin invalides.' });
    }
    if (admin.status === 'SUSPENDED') {
      addAuditLog({
        actorId: admin.id,
        actorName: admin.name,
        actorSpace: 'superadmin',
        action: 'LOGIN_BLOCKED',
        targetType: 'AUTH',
        targetId: admin.id,
        targetLabel: `${admin.name} (${admin.email})`,
        details: 'Tentative de connexion bloquée : compte Superadmin suspendu.',
        severity: 'CRITICAL',
      });
      return res.status(403).json({ error: 'Ce compte administrateur est suspendu.' });
    }

    admin.lastLoginAt = new Date().toISOString();
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'LOGIN',
      targetType: 'AUTH',
      targetId: admin.id,
      targetLabel: `${admin.name} (${admin.email})`,
      details: `Connexion console Superadmin (${admin.role}).`,
      severity: 'INFO',
    });

    const token = crypto.randomBytes(24).toString('hex');
    superadminSessions.set(token, { id: token, user: admin, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_superadmin_session', token);

    return res.json({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        title: admin.title,
        organizationId: 'tpd-superadmin',
        organizationName: 'Administration Plateforme',
      },
    });
  });

  app.post('/api/superadmin/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_superadmin_session');
    if (token) superadminSessions.delete(token);
    res.clearCookie('tpd_superadmin_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/superadmin/auth/me', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        title: admin.title,
        organizationId: 'tpd-superadmin',
        organizationName: 'Administration Plateforme',
      },
    });
  });

  app.get('/api/superadmin/overview', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });
    return res.json(buildSuperadminOverview());
  });

  app.get('/api/superadmin/users', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });
    return res.json({ users: buildManagedUsers() });
  });

  app.get('/api/superadmin/audit-logs', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });
    return res.json({ auditLogs: store.auditLogs });
  });

  app.post('/api/superadmin/users', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const {
      space,
      name,
      email,
      password,
      role,
      organizationName,
      subtitle,
      city,
      status,
      avatarUrl,
      companyLogoUrl,
    } = req.body as {
      space?: PlatformSpace;
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      organizationName?: string;
      subtitle?: string;
      city?: string;
      status?: UserAccountStatus;
      avatarUrl?: string;
      companyLogoUrl?: string;
    };

    if (!space || !name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({
        error: 'Espace, nom complet, e-mail et mot de passe (min. 6 caractères) requis.',
      });
    }

    const avatarCheck = avatarUrl !== undefined ? sanitizeImageInput(avatarUrl) : { valid: true, value: undefined };
    const logoCheck = companyLogoUrl !== undefined ? sanitizeImageInput(companyLogoUrl) : { valid: true, value: undefined };
    if (!avatarCheck.valid || !logoCheck.valid) {
      return res.status(400).json({ error: 'Format d’image ou de logo invalide.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const nowIso = new Date().toISOString();
    const initialStatus: UserAccountStatus = status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';

    if (space === 'intranet') {
      if (store.intranetUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Intranet & CRM.' });
      }
      const allowedRole: IntranetUser['role'] =
        role === 'OWNER' || role === 'DIRECTION' || role === 'MANAGER' || role === 'EMPLOYEE'
          ? role
          : 'EMPLOYEE';
      const created: IntranetUser = {
        id: `int-${Date.now()}`,
        organizationId: 'tpd-demo-intranet',
        organizationName: organizationName?.trim() || 'Teranga Prestige — Intranet',
        email: cleanEmail,
        name: name.trim(),
        role: allowedRole,
        title: subtitle?.trim() || allowedRole,
        avatarUrl: avatarCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      };
      store.intranetUsers.push(created);
      store.intranetChannels.forEach((ch) => {
        if (ch.organizationId === created.organizationId && !ch.isPrivate) {
          ch.memberIds.push(created.id);
        }
      });
    } else if (space === 'accounting') {
      if (store.accountingUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Comptabilité.' });
      }
      const allowedRole: AccountingUser['role'] =
        role === 'OWNER' || role === 'ACCOUNTANT' || role === 'READ_ONLY' ? role : 'ACCOUNTANT';
      store.accountingUsers.push({
        id: `acc-${Date.now()}`,
        organizationId: 'tpd-demo-accounting',
        organizationName: organizationName?.trim() || 'Senelec Digital (Démo SYSCOHADA)',
        email: cleanEmail,
        name: name.trim(),
        role: allowedRole,
        avatarUrl: avatarCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      });
    } else if (space === 'learner') {
      if (store.learnerUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Espace Apprenant.' });
      }
      store.learnerUsers.push({
        id: `lrn-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        companyName: organizationName?.trim() || 'Entreprise Partenaire B2B',
        jobTitle: subtitle?.trim() || 'Apprenant B2B',
        avatarUrl: avatarCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      });
    } else if (space === 'instructor') {
      if (store.instructorUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Espace Formateur.' });
      }
      store.instructorUsers.push({
        id: `inst-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        specialty: subtitle?.trim() || 'Formateur Expert B2B',
        city: city?.trim() || 'Dakar',
        avatarUrl: avatarCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      });
    } else if (space === 'provider') {
      if (store.providerUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Espace Prestataires.' });
      }
      store.providerUsers.push({
        id: `prov-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        companyName: organizationName?.trim() || `${name.trim()} Services`,
        roleTitle: subtitle?.trim() || 'Prestataire Événementiel',
        city: city?.trim() || 'Dakar',
        avatarUrl: avatarCheck.value,
        companyLogoUrl: logoCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      });
    } else if (space === 'superadmin') {
      if (store.superadminUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        return res.status(409).json({ error: 'Cet e-mail existe déjà dans Superadmin.' });
      }
      const allowedRole: SuperadminUser['role'] = role === 'SECURITY_ADMIN' ? 'SECURITY_ADMIN' : 'SUPERADMIN';
      store.superadminUsers.push({
        id: `sup-${Date.now()}`,
        email: cleanEmail,
        name: name.trim(),
        role: allowedRole,
        title: subtitle?.trim() || 'Administrateur Plateforme',
        avatarUrl: avatarCheck.value,
        passwordHash: simpleHash(password),
        status: initialStatus,
        createdAt: nowIso,
      });
    } else {
      return res.status(400).json({ error: 'Espace utilisateur inconnu.' });
    }

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'USER_CREATED',
      targetType: 'USER',
      targetLabel: `${name.trim()} (${cleanEmail})`,
      details: `Compte créé dans l’espace ${space} (statut : ${initialStatus}).`,
      severity: 'INFO',
    });

    return res.status(201).json(buildSuperadminOverview());
  });

  app.patch('/api/superadmin/users/:space/:userId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const space = req.params.space as PlatformSpace;
    const { userId } = req.params;
    const {
      name,
      email,
      role,
      organizationName,
      subtitle,
      city,
      status,
      password,
      avatarUrl,
      companyLogoUrl,
    } = req.body as {
      name?: string;
      email?: string;
      role?: string;
      organizationName?: string;
      subtitle?: string;
      city?: string;
      status?: UserAccountStatus;
      password?: string;
      avatarUrl?: string | null;
      companyLogoUrl?: string | null;
    };

    const avatarCheck = avatarUrl !== undefined ? sanitizeImageInput(avatarUrl) : undefined;
    const logoCheck = companyLogoUrl !== undefined ? sanitizeImageInput(companyLogoUrl) : undefined;
    if ((avatarCheck && !avatarCheck.valid) || (logoCheck && !logoCheck.valid)) {
      return res.status(400).json({ error: 'Format d’image ou de logo invalide.' });
    }

    if (space === 'superadmin' && userId === admin.id && status === 'SUSPENDED') {
      return res.status(400).json({ error: 'Vous ne pouvez pas suspendre votre propre compte actif.' });
    }

    let foundLabel = '';
    let statusChangedTo: UserAccountStatus | undefined;

    if (space === 'intranet') {
      const user = store.intranetUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (role && ['OWNER', 'DIRECTION', 'MANAGER', 'EMPLOYEE'].includes(role)) {
        user.role = role as IntranetUser['role'];
      }
      if (organizationName?.trim()) user.organizationName = organizationName.trim();
      if (subtitle !== undefined) user.title = subtitle.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('intranet', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else if (space === 'accounting') {
      const user = store.accountingUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (role && ['OWNER', 'ACCOUNTANT', 'READ_ONLY'].includes(role)) {
        user.role = role as AccountingUser['role'];
      }
      if (organizationName?.trim()) user.organizationName = organizationName.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('accounting', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else if (space === 'learner') {
      const user = store.learnerUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (organizationName?.trim()) user.companyName = organizationName.trim();
      if (subtitle !== undefined) user.jobTitle = subtitle.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('learner', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else if (space === 'instructor') {
      const user = store.instructorUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (subtitle !== undefined) user.specialty = subtitle.trim();
      if (city?.trim()) user.city = city.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      store.instructorCourses.forEach((c) => {
        if (c.instructorId === user.id) {
          c.instructorName = user.name;
          c.instructorAvatarUrl = user.avatarUrl;
        }
      });
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('instructor', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else if (space === 'provider') {
      const user = store.providerUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (organizationName?.trim()) user.companyName = organizationName.trim();
      if (subtitle !== undefined) user.roleTitle = subtitle.trim();
      if (city?.trim()) user.city = city.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      if (logoCheck) user.companyLogoUrl = logoCheck.clear ? undefined : logoCheck.value;
      store.providerOffers.forEach((o) => {
        if (o.providerId === user.id) {
          o.providerName = user.name;
          o.companyName = user.companyName;
          o.providerAvatarUrl = user.avatarUrl;
          o.companyLogoUrl = user.companyLogoUrl;
        }
      });
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('provider', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else if (space === 'superadmin') {
      const user = store.superadminUsers.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      if (name?.trim()) user.name = name.trim();
      if (email?.trim()) user.email = email.trim().toLowerCase();
      if (role && ['SUPERADMIN', 'SECURITY_ADMIN'].includes(role)) {
        user.role = role as SuperadminUser['role'];
      }
      if (subtitle !== undefined) user.title = subtitle.trim();
      if (avatarCheck) user.avatarUrl = avatarCheck.clear ? undefined : avatarCheck.value;
      if (password && password.length >= 6) user.passwordHash = simpleHash(password);
      if (status && status !== (user.status ?? 'ACTIVE')) {
        user.status = status;
        statusChangedTo = status;
        if (status === 'SUSPENDED') revokeUserSessions('superadmin', user.id);
      }
      foundLabel = `${user.name} (${user.email})`;
    } else {
      return res.status(400).json({ error: 'Espace invalide.' });
    }

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action:
        statusChangedTo === 'SUSPENDED'
          ? 'USER_SUSPENDED'
          : statusChangedTo === 'ACTIVE'
          ? 'USER_REACTIVATED'
          : 'USER_UPDATED',
      targetType: 'USER',
      targetId: userId,
      targetLabel: foundLabel,
      details:
        statusChangedTo === 'SUSPENDED'
          ? `Compte suspendu et sessions actives révoquées (${space}).`
          : statusChangedTo === 'ACTIVE'
          ? `Compte réactivé dans l’espace ${space}.`
          : `Profil utilisateur mis à jour dans l’espace ${space}.`,
      severity: statusChangedTo === 'SUSPENDED' ? 'WARNING' : 'INFO',
    });

    return res.json(buildSuperadminOverview());
  });

  app.post('/api/superadmin/users/:space/:userId/revoke-sessions', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const space = req.params.space as PlatformSpace;
    const { userId } = req.params;
    const revoked = revokeUserSessions(space, userId);

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'SESSIONS_REVOKED',
      targetType: 'SESSION',
      targetId: userId,
      targetLabel: `${userId} (${space})`,
      details: `${revoked} session(s) active(s) déconnectée(s) à distance.`,
      severity: 'WARNING',
    });

    return res.json({ revoked, ...buildSuperadminOverview() });
  });

  app.delete('/api/superadmin/users/:space/:userId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const space = req.params.space as PlatformSpace;
    const { userId } = req.params;

    if (space === 'superadmin' && userId === admin.id) {
      return res.status(400).json({ error: 'Impossible de supprimer le compte Superadmin actuellement connecté.' });
    }

    let removedLabel = '';
    if (space === 'intranet') {
      const idx = store.intranetUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.intranetUsers[idx].name} (${store.intranetUsers[idx].email})`;
      store.intranetUsers.splice(idx, 1);
    } else if (space === 'accounting') {
      const idx = store.accountingUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.accountingUsers[idx].name} (${store.accountingUsers[idx].email})`;
      store.accountingUsers.splice(idx, 1);
    } else if (space === 'learner') {
      const idx = store.learnerUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.learnerUsers[idx].name} (${store.learnerUsers[idx].email})`;
      store.learnerUsers.splice(idx, 1);
    } else if (space === 'instructor') {
      const idx = store.instructorUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.instructorUsers[idx].name} (${store.instructorUsers[idx].email})`;
      store.instructorUsers.splice(idx, 1);
    } else if (space === 'provider') {
      const idx = store.providerUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.providerUsers[idx].name} (${store.providerUsers[idx].email})`;
      store.providerUsers.splice(idx, 1);
    } else if (space === 'superadmin') {
      const idx = store.superadminUsers.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable.' });
      removedLabel = `${store.superadminUsers[idx].name} (${store.superadminUsers[idx].email})`;
      store.superadminUsers.splice(idx, 1);
    } else {
      return res.status(400).json({ error: 'Espace invalide.' });
    }

    revokeUserSessions(space, userId);
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'USER_DELETED',
      targetType: 'USER',
      targetId: userId,
      targetLabel: removedLabel,
      details: `Compte supprimé définitivement de l’espace ${space}.`,
      severity: 'CRITICAL',
    });

    return res.json(buildSuperadminOverview());
  });

  // =========================================================================
  // MODULE SUPERADMIN — GESTION COMPLÈTE DES COMMISSIONS (FORMATEURS & PRESTATAIRES)
  // =========================================================================

  function resolveCommissionRule(
    beneficiaryType: CommissionBeneficiaryType,
    beneficiaryId: string,
    category: string,
  ): CommissionRule {
    const activeRules = store.commissionRules.filter(
      (r) => r.isActive && r.beneficiaryType === beneficiaryType,
    );
    const userRule = activeRules.find(
      (r) => r.scope === 'USER' && r.targetUserId === beneficiaryId,
    );
    if (userRule) return userRule;

    const categoryRule = activeRules.find(
      (r) =>
        r.scope === 'CATEGORY' &&
        (r.category || '').trim().toLowerCase() === category.trim().toLowerCase(),
    );
    if (categoryRule) return categoryRule;

    const globalRule = activeRules.find((r) => r.scope === 'GLOBAL');
    if (globalRule) return globalRule;

    return {
      id: `fallback-${beneficiaryType.toLowerCase()}`,
      name:
        beneficiaryType === 'INSTRUCTOR'
          ? 'Barème par défaut Formateurs'
          : 'Barème par défaut Prestataires',
      beneficiaryType,
      scope: 'GLOBAL',
      ratePercent: beneficiaryType === 'INSTRUCTOR' ? 15 : 12,
      fixedFeeFcfa: 0,
      isActive: true,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Système',
    };
  }

  function computeCommissionBreakdown(
    grossAmountFcfa: number,
    ratePercent: number,
    fixedFeeFcfa: number,
  ) {
    const gross = Math.max(0, Math.round(grossAmountFcfa));
    const rate = Math.max(0, Math.min(80, Number(ratePercent) || 0));
    const fixed = Math.max(0, Math.round(fixedFeeFcfa || 0));
    const rawCommission = Math.round((gross * rate) / 100) + fixed;
    const commissionAmountFcfa = Math.min(gross, rawCommission);
    const netPartnerAmountFcfa = Math.max(0, gross - commissionAmountFcfa);
    return { gross, rate, fixed, commissionAmountFcfa, netPartnerAmountFcfa };
  }

  function nextCommissionReference(): string {
    const num = store.commissions.length + 1;
    return `COM-2026-${String(num).padStart(3, '0')}`;
  }

  function upsertCommissionForEnrollment(
    enrollment: InstructorEnrollment,
    course: InstructorCourse,
  ): CommissionRecord | null {
    const grossPrice = course.priceFcfa || 0;
    if (grossPrice <= 0 || course.pricingModel === 'FREE') return null;

    const existing = store.commissions.find(
      (c) => c.sourceType === 'COURSE_ENROLLMENT' && c.sourceId === enrollment.id,
    );
    if (existing) return existing;

    const instructor = store.instructorUsers.find((u) => u.id === course.instructorId);
    const rule = resolveCommissionRule('INSTRUCTOR', course.instructorId, course.category);
    const calc = computeCommissionBreakdown(grossPrice, rule.ratePercent, rule.fixedFeeFcfa);
    const nowIso = new Date().toISOString();

    const created: CommissionRecord = {
      id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      reference: nextCommissionReference(),
      beneficiaryType: 'INSTRUCTOR',
      beneficiaryId: course.instructorId,
      beneficiaryName: instructor?.name || course.instructorName,
      beneficiaryOrg: instructor?.specialty || 'Formateur Pro Teranga',
      sourceType: 'COURSE_ENROLLMENT',
      sourceId: enrollment.id,
      sourceTitle: course.title,
      clientOrLearnerName: `${enrollment.learnerName} (${enrollment.companyName})`,
      category: course.category,
      grossAmountFcfa: calc.gross,
      appliedRatePercent: calc.rate,
      fixedFeeFcfa: calc.fixed,
      commissionAmountFcfa: calc.commissionAmountFcfa,
      netPartnerAmountFcfa: calc.netPartnerAmountFcfa,
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'EN_ATTENTE',
      notes: `Inscription synchronisée (${course.modality}).`,
      transactionDate: enrollment.enrolledAt || nowIso.slice(0, 10),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.commissions.unshift(created);
    return created;
  }

  function upsertCommissionForProviderRequest(
    reqItem: ProviderServiceRequest,
    provider?: ProviderUser,
  ): CommissionRecord | null {
    const eligibleStages: ProviderRequestStage[] = [
      'DEVIS_ENVOYE',
      'COMMANDE_CONFIRMEE',
      'FACTURE_EMISE',
      'PAYEE',
    ];
    const resolvedProvider =
      provider || store.providerUsers.find((p) => p.id === reqItem.providerId);
    const existing = store.commissions.find(
      (c) => c.sourceType === 'PROVIDER_REQUEST' && c.sourceId === reqItem.id,
    );
    const nowIso = new Date().toISOString();

    if (reqItem.stage === 'REFUSEE') {
      if (existing && (existing.status === 'EN_ATTENTE' || existing.status === 'VALIDEE')) {
        existing.status = 'ANNULEE';
        existing.notes = 'Demande de prestation marquée comme refusée.';
        existing.updatedAt = nowIso;
      }
      return existing || null;
    }

    if (!eligibleStages.includes(reqItem.stage) || reqItem.amountFcfa <= 0) {
      return existing || null;
    }

    const rule = resolveCommissionRule('PROVIDER', reqItem.providerId, reqItem.category);
    const docTag =
      reqItem.invoiceNumber || reqItem.orderNumber || reqItem.quoteNumber || reqItem.eventType;
    const sourceTitle = `${reqItem.offerTitle} (${docTag})`;

    if (existing) {
      existing.sourceTitle = sourceTitle;
      if (existing.status === 'EN_ATTENTE' || existing.status === 'VALIDEE') {
        const calc = computeCommissionBreakdown(
          reqItem.amountFcfa,
          existing.appliedRatePercent,
          existing.fixedFeeFcfa,
        );
        existing.grossAmountFcfa = calc.gross;
        existing.commissionAmountFcfa = calc.commissionAmountFcfa;
        existing.netPartnerAmountFcfa = calc.netPartnerAmountFcfa;
        if (reqItem.stage === 'PAYEE' && existing.status === 'EN_ATTENTE') {
          existing.status = 'VALIDEE';
          existing.validatedAt = nowIso;
        }
      }
      existing.updatedAt = nowIso;
      return existing;
    }

    const calc = computeCommissionBreakdown(reqItem.amountFcfa, rule.ratePercent, rule.fixedFeeFcfa);
    const initialStatus: CommissionStatus =
      reqItem.stage === 'PAYEE' || reqItem.stage === 'FACTURE_EMISE' || reqItem.stage === 'COMMANDE_CONFIRMEE'
        ? 'VALIDEE'
        : 'EN_ATTENTE';

    const created: CommissionRecord = {
      id: `com-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      reference: nextCommissionReference(),
      beneficiaryType: 'PROVIDER',
      beneficiaryId: reqItem.providerId,
      beneficiaryName: resolvedProvider?.name || 'Prestataire Teranga',
      beneficiaryOrg: resolvedProvider?.companyName || 'Partenaire Événementiel',
      sourceType: 'PROVIDER_REQUEST',
      sourceId: reqItem.id,
      sourceTitle,
      clientOrLearnerName: `${reqItem.clientName} (${reqItem.clientCompany})`,
      category: reqItem.category,
      grossAmountFcfa: calc.gross,
      appliedRatePercent: calc.rate,
      fixedFeeFcfa: calc.fixed,
      commissionAmountFcfa: calc.commissionAmountFcfa,
      netPartnerAmountFcfa: calc.netPartnerAmountFcfa,
      ruleId: rule.id,
      ruleName: rule.name,
      status: initialStatus,
      validatedAt: initialStatus === 'VALIDEE' ? nowIso : undefined,
      notes: `Prestation synchronisée au stade ${reqItem.stage}.`,
      transactionDate: reqItem.updatedAt.slice(0, 10) || nowIso.slice(0, 10),
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.commissions.unshift(created);
    return created;
  }

  function syncAllMissingCommissions(): number {
    let added = 0;
    for (const enr of store.instructorEnrollments) {
      const course = store.instructorCourses.find((c) => c.id === enr.courseId);
      if (!course) continue;
      const before = store.commissions.length;
      upsertCommissionForEnrollment(enr, course);
      if (store.commissions.length > before) added += 1;
    }
    for (const reqItem of store.providerRequests) {
      const before = store.commissions.length;
      upsertCommissionForProviderRequest(reqItem);
      if (store.commissions.length > before) added += 1;
    }
    return added;
  }

  function buildCommissionsOverview() {
    const activeRecords = store.commissions.filter((c) => c.status !== 'ANNULEE');
    const instructorActive = activeRecords.filter((c) => c.beneficiaryType === 'INSTRUCTOR');
    const providerActive = activeRecords.filter((c) => c.beneficiaryType === 'PROVIDER');

    const kpis = {
      totalRecords: store.commissions.length,
      grossVolumeFcfa: activeRecords.reduce((s, c) => s + c.grossAmountFcfa, 0),
      totalCommissionFcfa: activeRecords.reduce((s, c) => s + c.commissionAmountFcfa, 0),
      instructorCommissionFcfa: instructorActive.reduce((s, c) => s + c.commissionAmountFcfa, 0),
      providerCommissionFcfa: providerActive.reduce((s, c) => s + c.commissionAmountFcfa, 0),
      pendingValidationFcfa: activeRecords
        .filter((c) => c.status === 'EN_ATTENTE' || c.status === 'VALIDEE')
        .reduce((s, c) => s + c.commissionAmountFcfa, 0),
      collectedOrSettledFcfa: activeRecords
        .filter((c) => c.status === 'PRELEVEE' || c.status === 'REVERSE_PARTENAIRE')
        .reduce((s, c) => s + c.commissionAmountFcfa, 0),
      netPartnerTotalFcfa: activeRecords.reduce((s, c) => s + c.netPartnerAmountFcfa, 0),
      pendingCount: activeRecords.filter(
        (c) => c.status === 'EN_ATTENTE' || c.status === 'VALIDEE',
      ).length,
      activeRulesCount: store.commissionRules.filter((r) => r.isActive).length,
    };

    const chartByType = [
      {
        type: 'INSTRUCTOR' as const,
        label: 'Formateurs Pro',
        grossFcfa: instructorActive.reduce((s, c) => s + c.grossAmountFcfa, 0),
        commissionFcfa: kpis.instructorCommissionFcfa,
        netPartnerFcfa: instructorActive.reduce((s, c) => s + c.netPartnerAmountFcfa, 0),
        count: instructorActive.length,
      },
      {
        type: 'PROVIDER' as const,
        label: 'Prestataires Événementiels',
        grossFcfa: providerActive.reduce((s, c) => s + c.grossAmountFcfa, 0),
        commissionFcfa: kpis.providerCommissionFcfa,
        netPartnerFcfa: providerActive.reduce((s, c) => s + c.netPartnerAmountFcfa, 0),
        count: providerActive.length,
      },
    ];

    const partnerSummaries = [
      ...store.instructorUsers.map((inst) => {
        const list = activeRecords.filter(
          (c) => c.beneficiaryType === 'INSTRUCTOR' && c.beneficiaryId === inst.id,
        );
        const grossTotalFcfa = list.reduce((s, c) => s + c.grossAmountFcfa, 0);
        const commissionTotalFcfa = list.reduce((s, c) => s + c.commissionAmountFcfa, 0);
        return {
          beneficiaryType: 'INSTRUCTOR' as const,
          beneficiaryId: inst.id,
          beneficiaryName: inst.name,
          beneficiaryOrg: inst.specialty,
          avatarUrl: inst.avatarUrl,
          transactionsCount: list.length,
          grossTotalFcfa,
          commissionTotalFcfa,
          netPartnerTotalFcfa: list.reduce((s, c) => s + c.netPartnerAmountFcfa, 0),
          pendingCommissionFcfa: list
            .filter((c) => c.status === 'EN_ATTENTE' || c.status === 'VALIDEE')
            .reduce((s, c) => s + c.commissionAmountFcfa, 0),
          collectedCommissionFcfa: list
            .filter((c) => c.status === 'PRELEVEE' || c.status === 'REVERSE_PARTENAIRE')
            .reduce((s, c) => s + c.commissionAmountFcfa, 0),
          effectiveRatePercent:
            grossTotalFcfa > 0
              ? Number(((commissionTotalFcfa / grossTotalFcfa) * 100).toFixed(1))
              : resolveCommissionRule('INSTRUCTOR', inst.id, '').ratePercent,
        };
      }),
      ...store.providerUsers.map((prov) => {
        const list = activeRecords.filter(
          (c) => c.beneficiaryType === 'PROVIDER' && c.beneficiaryId === prov.id,
        );
        const grossTotalFcfa = list.reduce((s, c) => s + c.grossAmountFcfa, 0);
        const commissionTotalFcfa = list.reduce((s, c) => s + c.commissionAmountFcfa, 0);
        return {
          beneficiaryType: 'PROVIDER' as const,
          beneficiaryId: prov.id,
          beneficiaryName: prov.name,
          beneficiaryOrg: prov.companyName,
          avatarUrl: prov.avatarUrl,
          companyLogoUrl: prov.companyLogoUrl,
          transactionsCount: list.length,
          grossTotalFcfa,
          commissionTotalFcfa,
          netPartnerTotalFcfa: list.reduce((s, c) => s + c.netPartnerAmountFcfa, 0),
          pendingCommissionFcfa: list
            .filter((c) => c.status === 'EN_ATTENTE' || c.status === 'VALIDEE')
            .reduce((s, c) => s + c.commissionAmountFcfa, 0),
          collectedCommissionFcfa: list
            .filter((c) => c.status === 'PRELEVEE' || c.status === 'REVERSE_PARTENAIRE')
            .reduce((s, c) => s + c.commissionAmountFcfa, 0),
          effectiveRatePercent:
            grossTotalFcfa > 0
              ? Number(((commissionTotalFcfa / grossTotalFcfa) * 100).toFixed(1))
              : resolveCommissionRule('PROVIDER', prov.id, '').ratePercent,
        };
      }),
    ];

    const categoriesSet = new Set<string>([
      ...store.instructorCourses.map((c) => c.category),
      ...store.providerOffers.map((o) => o.category),
      ...store.commissions.map((c) => c.category),
    ]);

    const enrichedRecords = store.commissions.map((rec) => {
      if (rec.beneficiaryType === 'INSTRUCTOR') {
        const inst = store.instructorUsers.find((u) => u.id === rec.beneficiaryId);
        return { ...rec, beneficiaryAvatarUrl: inst?.avatarUrl };
      }
      const prov = store.providerUsers.find((u) => u.id === rec.beneficiaryId);
      return {
        ...rec,
        beneficiaryAvatarUrl: prov?.avatarUrl,
        beneficiaryLogoUrl: prov?.companyLogoUrl,
      };
    });

    return {
      kpis,
      chartByType,
      partnerSummaries,
      rules: store.commissionRules,
      records: enrichedRecords,
      partners: {
        instructors: store.instructorUsers.map((u) => ({
          id: u.id,
          name: u.name,
          subtitle: u.specialty,
          email: u.email,
          avatarUrl: u.avatarUrl,
        })),
        providers: store.providerUsers.map((u) => ({
          id: u.id,
          name: u.name,
          companyName: u.companyName,
          email: u.email,
          avatarUrl: u.avatarUrl,
          companyLogoUrl: u.companyLogoUrl,
        })),
      },
      categories: Array.from(categoriesSet).filter(Boolean).sort(),
    };
  }

  app.get('/api/superadmin/commissions', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });
    return res.json(buildCommissionsOverview());
  });

  app.post('/api/superadmin/commissions/sync', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const createdCount = syncAllMissingCommissions();
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSIONS_SYNCED',
      targetType: 'COMMISSION',
      targetLabel: `${createdCount} nouvelle(s) commission(s)`,
      details: `Synchronisation temps réel avec les inscriptions formateurs et demandes prestataires (${createdCount} ajoutée(s)).`,
      severity: 'INFO',
    });

    return res.json({ createdCount, ...buildCommissionsOverview() });
  });

  app.post('/api/superadmin/commissions', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const {
      beneficiaryType,
      beneficiaryId,
      sourceTitle,
      clientOrLearnerName,
      category,
      grossAmountFcfa,
      appliedRatePercent,
      fixedFeeFcfa,
      status,
      payoutMethod,
      payoutReference,
      notes,
      transactionDate,
    } = req.body as {
      beneficiaryType?: CommissionBeneficiaryType;
      beneficiaryId?: string;
      sourceTitle?: string;
      clientOrLearnerName?: string;
      category?: string;
      grossAmountFcfa?: number;
      appliedRatePercent?: number;
      fixedFeeFcfa?: number;
      status?: CommissionStatus;
      payoutMethod?: CommissionPayoutMethod;
      payoutReference?: string;
      notes?: string;
      transactionDate?: string;
    };

    if (
      !beneficiaryType ||
      !beneficiaryId ||
      !sourceTitle?.trim() ||
      typeof grossAmountFcfa !== 'number' ||
      grossAmountFcfa <= 0
    ) {
      return res.status(400).json({
        error: 'Bénéficiaire, intitulé de prestation et montant brut positif requis.',
      });
    }

    let beneficiaryName = '';
    let beneficiaryOrg = '';
    if (beneficiaryType === 'INSTRUCTOR') {
      const u = store.instructorUsers.find((i) => i.id === beneficiaryId);
      if (!u) return res.status(404).json({ error: 'Formateur introuvable.' });
      beneficiaryName = u.name;
      beneficiaryOrg = u.specialty;
    } else {
      const u = store.providerUsers.find((p) => p.id === beneficiaryId);
      if (!u) return res.status(404).json({ error: 'Prestataire introuvable.' });
      beneficiaryName = u.name;
      beneficiaryOrg = u.companyName;
    }

    const cat = category?.trim() || (beneficiaryType === 'INSTRUCTOR' ? 'Formations & Masterclasses' : 'Prestation Événementielle');
    const rule = resolveCommissionRule(beneficiaryType, beneficiaryId, cat);
    const rate = typeof appliedRatePercent === 'number' ? appliedRatePercent : rule.ratePercent;
    const fixed = typeof fixedFeeFcfa === 'number' ? fixedFeeFcfa : rule.fixedFeeFcfa;
    const calc = computeCommissionBreakdown(grossAmountFcfa, rate, fixed);
    const nowIso = new Date().toISOString();
    const initialStatus: CommissionStatus = status || 'EN_ATTENTE';

    const created: CommissionRecord = {
      id: `com-${Date.now()}`,
      reference: nextCommissionReference(),
      beneficiaryType,
      beneficiaryId,
      beneficiaryName,
      beneficiaryOrg,
      sourceType: 'MANUAL',
      sourceId: `man-${Date.now()}`,
      sourceTitle: sourceTitle.trim(),
      clientOrLearnerName: clientOrLearnerName?.trim() || 'Client B2B Teranga',
      category: cat,
      grossAmountFcfa: calc.gross,
      appliedRatePercent: calc.rate,
      fixedFeeFcfa: calc.fixed,
      commissionAmountFcfa: calc.commissionAmountFcfa,
      netPartnerAmountFcfa: calc.netPartnerAmountFcfa,
      ruleId: appliedRatePercent === undefined ? rule.id : undefined,
      ruleName: appliedRatePercent === undefined ? rule.name : 'Taux personnalisé manuel',
      status: initialStatus,
      payoutMethod,
      payoutReference: payoutReference?.trim() || undefined,
      notes: notes?.trim() || undefined,
      transactionDate: transactionDate || nowIso.slice(0, 10),
      validatedAt:
        initialStatus !== 'EN_ATTENTE' && initialStatus !== 'ANNULEE' ? nowIso : undefined,
      collectedAt:
        initialStatus === 'PRELEVEE' || initialStatus === 'REVERSE_PARTENAIRE' ? nowIso : undefined,
      settledAt: initialStatus === 'REVERSE_PARTENAIRE' ? nowIso : undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.commissions.unshift(created);
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_CREATED',
      targetType: 'COMMISSION',
      targetId: created.id,
      targetLabel: `${created.reference} — ${beneficiaryName}`,
      details: `Commission de ${calc.commissionAmountFcfa.toLocaleString('fr-FR')} FCFA (${calc.rate}%) créée sur ${sourceTitle.trim()}.`,
      severity: 'INFO',
    });

    return res.status(201).json(buildCommissionsOverview());
  });

  app.post('/api/superadmin/commissions/bulk-status', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const { ids, status, payoutMethod, payoutReference } = req.body as {
      ids?: string[];
      status?: CommissionStatus;
      payoutMethod?: CommissionPayoutMethod;
      payoutReference?: string;
    };
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: 'Sélection et nouveau statut requis.' });
    }

    const nowIso = new Date().toISOString();
    let updatedCount = 0;
    for (const item of store.commissions) {
      if (!ids.includes(item.id)) continue;
      item.status = status;
      item.updatedAt = nowIso;
      if (payoutMethod) item.payoutMethod = payoutMethod;
      if (payoutReference?.trim()) item.payoutReference = payoutReference.trim();
      if (status === 'VALIDEE' && !item.validatedAt) item.validatedAt = nowIso;
      if (status === 'PRELEVEE') {
        if (!item.validatedAt) item.validatedAt = nowIso;
        item.collectedAt = nowIso;
      }
      if (status === 'REVERSE_PARTENAIRE') {
        if (!item.validatedAt) item.validatedAt = nowIso;
        if (!item.collectedAt) item.collectedAt = nowIso;
        item.settledAt = nowIso;
      }
      updatedCount += 1;
    }

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSIONS_BULK_UPDATED',
      targetType: 'COMMISSION',
      targetLabel: `${updatedCount} commission(s) → ${status}`,
      details: `Mise à jour groupée de ${updatedCount} commission(s) au statut ${status}.`,
      severity: status === 'ANNULEE' ? 'WARNING' : 'INFO',
    });

    return res.json({ updatedCount, ...buildCommissionsOverview() });
  });

  app.patch('/api/superadmin/commissions/:commissionId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const item = store.commissions.find((c) => c.id === req.params.commissionId);
    if (!item) return res.status(404).json({ error: 'Commission introuvable.' });

    const {
      grossAmountFcfa,
      appliedRatePercent,
      fixedFeeFcfa,
      status,
      payoutMethod,
      payoutReference,
      notes,
      sourceTitle,
      clientOrLearnerName,
    } = req.body as {
      grossAmountFcfa?: number;
      appliedRatePercent?: number;
      fixedFeeFcfa?: number;
      status?: CommissionStatus;
      payoutMethod?: CommissionPayoutMethod;
      payoutReference?: string;
      notes?: string;
      sourceTitle?: string;
      clientOrLearnerName?: string;
    };

    const nextGross = typeof grossAmountFcfa === 'number' && grossAmountFcfa >= 0 ? grossAmountFcfa : item.grossAmountFcfa;
    const nextRate = typeof appliedRatePercent === 'number' ? appliedRatePercent : item.appliedRatePercent;
    const nextFixed = typeof fixedFeeFcfa === 'number' ? fixedFeeFcfa : item.fixedFeeFcfa;

    const calc = computeCommissionBreakdown(nextGross, nextRate, nextFixed);
    item.grossAmountFcfa = calc.gross;
    item.appliedRatePercent = calc.rate;
    item.fixedFeeFcfa = calc.fixed;
    item.commissionAmountFcfa = calc.commissionAmountFcfa;
    item.netPartnerAmountFcfa = calc.netPartnerAmountFcfa;

    if (sourceTitle?.trim()) item.sourceTitle = sourceTitle.trim();
    if (clientOrLearnerName?.trim()) item.clientOrLearnerName = clientOrLearnerName.trim();
    if (payoutMethod) item.payoutMethod = payoutMethod;
    if (payoutReference !== undefined) item.payoutReference = payoutReference.trim() || undefined;
    if (notes !== undefined) item.notes = notes.trim() || undefined;

    const nowIso = new Date().toISOString();
    if (status && status !== item.status) {
      item.status = status;
      if (status === 'VALIDEE' && !item.validatedAt) item.validatedAt = nowIso;
      if (status === 'PRELEVEE') {
        if (!item.validatedAt) item.validatedAt = nowIso;
        item.collectedAt = nowIso;
      }
      if (status === 'REVERSE_PARTENAIRE') {
        if (!item.validatedAt) item.validatedAt = nowIso;
        if (!item.collectedAt) item.collectedAt = nowIso;
        item.settledAt = nowIso;
        if (!item.payoutReference) {
          item.payoutReference = `VIR-COM-${new Date().getFullYear()}-${String(
            Math.floor(100 + Math.random() * 900),
          )}`;
        }
      }
    }
    item.updatedAt = nowIso;

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action:
        status === 'REVERSE_PARTENAIRE'
          ? 'COMMISSION_SETTLED'
          : status === 'ANNULEE'
          ? 'COMMISSION_CANCELLED'
          : 'COMMISSION_UPDATED',
      targetType: 'COMMISSION',
      targetId: item.id,
      targetLabel: `${item.reference} (${item.beneficiaryName})`,
      details: `Statut : ${item.status} · Commission : ${item.commissionAmountFcfa.toLocaleString('fr-FR')} FCFA (${item.appliedRatePercent}%).`,
      severity: status === 'ANNULEE' ? 'WARNING' : 'INFO',
    });

    return res.json(buildCommissionsOverview());
  });

  app.post('/api/superadmin/commissions/:commissionId/recalculate', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const item = store.commissions.find((c) => c.id === req.params.commissionId);
    if (!item) return res.status(404).json({ error: 'Commission introuvable.' });

    const rule = resolveCommissionRule(item.beneficiaryType, item.beneficiaryId, item.category);
    const calc = computeCommissionBreakdown(item.grossAmountFcfa, rule.ratePercent, rule.fixedFeeFcfa);
    item.appliedRatePercent = calc.rate;
    item.fixedFeeFcfa = calc.fixed;
    item.commissionAmountFcfa = calc.commissionAmountFcfa;
    item.netPartnerAmountFcfa = calc.netPartnerAmountFcfa;
    item.ruleId = rule.id;
    item.ruleName = rule.name;
    item.updatedAt = new Date().toISOString();

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_RECALCULATED',
      targetType: 'COMMISSION',
      targetId: item.id,
      targetLabel: item.reference,
      details: `Recalcul selon barème « ${rule.name} » (${calc.rate}% + ${calc.fixed} FCFA).`,
      severity: 'INFO',
    });

    return res.json(buildCommissionsOverview());
  });

  app.delete('/api/superadmin/commissions/:commissionId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const idx = store.commissions.findIndex((c) => c.id === req.params.commissionId);
    if (idx === -1) return res.status(404).json({ error: 'Commission introuvable.' });

    const removed = store.commissions[idx];
    store.commissions.splice(idx, 1);

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_DELETED',
      targetType: 'COMMISSION',
      targetId: removed.id,
      targetLabel: `${removed.reference} — ${removed.beneficiaryName}`,
      details: `Ligne de commission supprimée (${removed.commissionAmountFcfa.toLocaleString('fr-FR')} FCFA).`,
      severity: 'CRITICAL',
    });

    return res.json(buildCommissionsOverview());
  });

  app.post('/api/superadmin/commission-rules', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const {
      name,
      beneficiaryType,
      scope,
      targetUserId,
      category,
      ratePercent,
      fixedFeeFcfa,
      isActive,
    } = req.body as {
      name?: string;
      beneficiaryType?: CommissionBeneficiaryType;
      scope?: CommissionRuleScope;
      targetUserId?: string;
      category?: string;
      ratePercent?: number;
      fixedFeeFcfa?: number;
      isActive?: boolean;
    };

    if (!name?.trim() || !beneficiaryType || !scope || typeof ratePercent !== 'number') {
      return res.status(400).json({ error: 'Nom, type partenaire, portée et taux (%) requis.' });
    }
    if (scope === 'USER' && !targetUserId) {
      return res.status(400).json({ error: 'Veuillez sélectionner le partenaire ciblé.' });
    }
    if (scope === 'CATEGORY' && !category?.trim()) {
      return res.status(400).json({ error: 'Veuillez indiquer la catégorie ciblée.' });
    }

    let targetUserName: string | undefined;
    if (scope === 'USER' && targetUserId) {
      targetUserName =
        beneficiaryType === 'INSTRUCTOR'
          ? store.instructorUsers.find((u) => u.id === targetUserId)?.name
          : store.providerUsers.find((u) => u.id === targetUserId)?.name;
    }

    const created: CommissionRule = {
      id: `rule-${Date.now()}`,
      name: name.trim(),
      beneficiaryType,
      scope,
      targetUserId: scope === 'USER' ? targetUserId : undefined,
      targetUserName: scope === 'USER' ? targetUserName : undefined,
      category: scope === 'CATEGORY' ? category?.trim() : undefined,
      ratePercent: Math.max(0, Math.min(80, ratePercent)),
      fixedFeeFcfa: Math.max(0, Math.round(fixedFeeFcfa || 0)),
      isActive: isActive ?? true,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.name,
    };

    store.commissionRules.unshift(created);
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_RULE_CREATED',
      targetType: 'COMMISSION',
      targetId: created.id,
      targetLabel: created.name,
      details: `Barème créé : ${created.ratePercent}% + ${created.fixedFeeFcfa} FCFA (${created.beneficiaryType} · ${created.scope}).`,
      severity: 'INFO',
    });

    return res.status(201).json(buildCommissionsOverview());
  });

  app.patch('/api/superadmin/commission-rules/:ruleId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const rule = store.commissionRules.find((r) => r.id === req.params.ruleId);
    if (!rule) return res.status(404).json({ error: 'Règle de commission introuvable.' });

    const { name, ratePercent, fixedFeeFcfa, isActive, category, targetUserId } = req.body as {
      name?: string;
      ratePercent?: number;
      fixedFeeFcfa?: number;
      isActive?: boolean;
      category?: string;
      targetUserId?: string;
    };

    if (name?.trim()) rule.name = name.trim();
    if (typeof ratePercent === 'number') rule.ratePercent = Math.max(0, Math.min(80, ratePercent));
    if (typeof fixedFeeFcfa === 'number') rule.fixedFeeFcfa = Math.max(0, Math.round(fixedFeeFcfa));
    if (typeof isActive === 'boolean') rule.isActive = isActive;
    if (rule.scope === 'CATEGORY' && category?.trim()) rule.category = category.trim();
    if (rule.scope === 'USER' && targetUserId) {
      rule.targetUserId = targetUserId;
      rule.targetUserName =
        rule.beneficiaryType === 'INSTRUCTOR'
          ? store.instructorUsers.find((u) => u.id === targetUserId)?.name
          : store.providerUsers.find((u) => u.id === targetUserId)?.name;
    }
    rule.updatedAt = new Date().toISOString();
    rule.updatedBy = admin.name;

    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_RULE_UPDATED',
      targetType: 'COMMISSION',
      targetId: rule.id,
      targetLabel: rule.name,
      details: `Barème mis à jour : ${rule.ratePercent}% + ${rule.fixedFeeFcfa} FCFA (${rule.isActive ? 'Actif' : 'Inactif'}).`,
      severity: 'INFO',
    });

    return res.json(buildCommissionsOverview());
  });

  app.delete('/api/superadmin/commission-rules/:ruleId', (req: Request, res: Response) => {
    const admin = getSuperadminUser(req);
    if (!admin) return res.status(403).json({ error: 'Accès réservé au Superadmin.' });

    const idx = store.commissionRules.findIndex((r) => r.id === req.params.ruleId);
    if (idx === -1) return res.status(404).json({ error: 'Règle introuvable.' });

    const removed = store.commissionRules[idx];
    if (
      removed.scope === 'GLOBAL' &&
      store.commissionRules.filter(
        (r) => r.beneficiaryType === removed.beneficiaryType && r.scope === 'GLOBAL',
      ).length <= 1
    ) {
      return res.status(400).json({
        error: 'Conservez au moins un barème global pour ce type de partenaire (vous pouvez le modifier).',
      });
    }

    store.commissionRules.splice(idx, 1);
    addAuditLog({
      actorId: admin.id,
      actorName: admin.name,
      actorSpace: 'superadmin',
      action: 'COMMISSION_RULE_DELETED',
      targetType: 'COMMISSION',
      targetId: removed.id,
      targetLabel: removed.name,
      details: `Règle de commission supprimée (${removed.beneficiaryType}).`,
      severity: 'WARNING',
    });

    return res.json(buildCommissionsOverview());
  });

  // =========================================================================
  // SYNCHRONISATION PLATEFORME & DONNÉES PERSONNELLES STRICTEMENT ISOLÉES
  // =========================================================================

  app.get('/api/platform/dashboard', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    if (actor.space === 'superadmin') {
      const overview = buildSuperadminOverview();
      const commissionsOverview = buildCommissionsOverview();
      return res.json({
        actor,
        superadminSummary: {
          kpis: overview.kpis,
          commissionKpis: commissionsOverview.kpis,
          usersBySpace: overview.usersBySpace,
          moduleStats: overview.moduleStats,
          recentUsers: overview.users.slice(0, 6),
          recentAuditLogs: overview.auditLogs.slice(0, 6),
        },
      });
    }

    const publishedTrainings = store.instructorCourses.filter((c) => c.status === 'PUBLISHED');

    if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'MANAGER')) {
      const contacts = store.crmContacts.filter((c) => c.ownerUserId === actor.id);
      const docs = store.crmDocuments.filter((d) => d.ownerUserId === actor.id);
      const nonSuppliers = contacts.filter((c) => c.type !== 'SUPPLIER');

      const totalTtc = docs.reduce((s, d) => s + calcServerDocTotals(d).ttc, 0);
      const totalPaid = docs.reduce(
        (s, d) => s + d.payments.reduce((ps, p) => ps + p.amount, 0),
        0,
      );

      const stageCounts = { NOUVEAU: 0, CONTACTE: 0, QUALIFIE: 0, PROPOSITION: 0, GAGNE: 0 };
      nonSuppliers.forEach((c) => {
        const st = c.pipelineStage || (c.type === 'CLIENT' ? 'GAGNE' : 'NOUVEAU');
        stageCounts[st] = (stageCounts[st] || 0) + 1;
      });
      const pipelineData = [
        { stage: 'NOUVEAU', label: 'Nouveau', count: stageCounts.NOUVEAU, fill: '#94a3b8' },
        { stage: 'CONTACTE', label: 'Contacté', count: stageCounts.CONTACTE, fill: '#3b82f6' },
        { stage: 'QUALIFIE', label: 'Qualifié', count: stageCounts.QUALIFIE, fill: '#6366f1' },
        { stage: 'PROPOSITION', label: 'Proposition', count: stageCounts.PROPOSITION, fill: '#f59e0b' },
        { stage: 'GAGNE', label: 'Gagné', count: stageCounts.GAGNE, fill: '#10b981' },
      ];

      const totalLeads = nonSuppliers.length;
      const convertedLeads = stageCounts.GAGNE;
      const qualifiedLeads = stageCounts.QUALIFIE + stageCounts.PROPOSITION + stageCounts.GAGNE;
      const quoteDocs = docs.filter((d) => d.kind === 'QUOTE' && d.status !== 'PAID');
      let draftAmount = 0;
      let draftCount = 0;
      let validatedAmount = 0;
      let validatedCount = 0;
      let partialAmount = 0;
      let partialCount = 0;
      quoteDocs.forEach((q) => {
        const ttc = calcServerDocTotals(q).ttc;
        if (q.status === 'DRAFT') {
          draftAmount += ttc;
          draftCount += 1;
        } else if (q.status === 'VALIDATED') {
          validatedAmount += ttc;
          validatedCount += 1;
        } else {
          partialAmount += ttc;
          partialCount += 1;
        }
      });

      const myEvents = store.platformEvents.filter(
        (e) => e.ownerUserId === actor.id || e.assignedUserIds.includes(actor.id),
      );
      const myChannels = store.intranetChannels.filter(
        (c) => c.organizationId === actor.organizationId && (!c.isPrivate || c.memberIds.includes(actor.id)),
      );
      const myProviderRequests = store.providerRequests.filter((r) => r.requesterUserId === actor.id);
      const accEntries = store.accountingEntries.filter((e) => e.organizationId === 'tpd-demo-accounting');

      return res.json({
        actor,
        crmStats: {
          recentCount: docs.length,
          latestNumber: docs[0]?.number || '—',
          totalTtc,
          totalPaid,
          remainingBalance: Math.max(0, totalTtc - totalPaid),
          pipelineData,
          totalLeads,
          convertedLeads,
          qualifiedLeads,
          conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
          qualificationRate: totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0,
          pendingQuotesCount: quoteDocs.length,
          pendingQuotesTotal: draftAmount + validatedAmount + partialAmount,
          pendingQuotesByStatus: [
            { label: 'Brouillons', amount: draftAmount, count: draftCount, fill: '#94a3b8' },
            { label: 'Envoyés', amount: validatedAmount, count: validatedCount, fill: '#3b82f6' },
            { label: 'En négo.', amount: partialAmount, count: partialCount, fill: '#f59e0b' },
          ],
        },
        events: myEvents,
        trainings: publishedTrainings.slice(0, 4).map((c) => ({
          id: c.id,
          title: c.title,
          date: c.nextSessionDate || '2026-12-01',
          seatsTaken: c.enrolledCount,
          maxSeats: Math.max(25, c.enrolledCount + 5),
          hours: Number.parseInt(c.estimatedDuration, 10) || 14,
          instructor: c.instructorName,
        })),
        intranetChannelsCount: myChannels.length,
        providerRequestsCount: myProviderRequests.length,
        accountingEntriesCount: actor.role === 'OWNER' ? accEntries.length : 0,
      });
    }

    if (actor.space === 'intranet' && actor.role === 'EMPLOYEE') {
      const myEvents = store.platformEvents.filter((e) => e.assignedUserIds.includes(actor.id));
      const myChannels = store.intranetChannels.filter(
        (c) => c.organizationId === actor.organizationId && (!c.isPrivate || c.memberIds.includes(actor.id)),
      );
      const allowedIds = new Set(myChannels.map((c) => c.id));
      const myMessages = store.intranetMessages.filter((m) => allowedIds.has(m.channelId)).slice(-5);
      return res.json({
        actor,
        events: myEvents,
        trainings: publishedTrainings.slice(0, 4).map((c) => ({
          id: c.id,
          title: c.title,
          date: c.nextSessionDate || '2026-12-01',
          seatsTaken: c.enrolledCount,
          maxSeats: Math.max(25, c.enrolledCount + 5),
          hours: Number.parseInt(c.estimatedDuration, 10) || 14,
          instructor: c.instructorName,
        })),
        intranetChannelsCount: myChannels.length,
        recentMessages: myMessages,
      });
    }

    if (actor.space === 'accounting') {
      const entries = store.accountingEntries.filter((e) => e.organizationId === actor.organizationId);
      const journals = store.accountingJournals.filter((j) => j.organizationId === actor.organizationId);
      const accounts = store.accountingAccounts.filter((a) => a.organizationId === actor.organizationId);
      const syncedDocs = store.crmDocuments.filter(
        (d) => (d.kind === 'CUSTOMER_INVOICE' || d.kind === 'SUPPLIER_INVOICE') && d.status !== 'DRAFT',
      );
      const totalVolume = entries.reduce(
        (sum, e) => sum + e.lines.reduce((ls, l) => ls + l.debit, 0),
        0,
      );
      const byJournal = journals.map((j) => {
        const jEntries = entries.filter((e) => e.journalCode === j.code);
        const amount = jEntries.reduce(
          (sum, e) => sum + e.lines.reduce((ls, l) => ls + l.debit, 0),
          0,
        );
        return { code: j.code, name: j.name, count: jEntries.length, amount };
      });
      return res.json({
        actor,
        accountingSummary: {
          entriesCount: entries.length,
          accountsCount: accounts.length,
          journalsCount: journals.length,
          syncedInvoicesCount: syncedDocs.length,
          totalVolume,
          byJournal,
          recentEntries: entries.slice(0, 5),
        },
      });
    }

    if (actor.space === 'learner') {
      const myCourses = store.learnerCourses.filter((c) => c.learnerId === actor.id);
      const enrolledLinkedIds = new Set(myCourses.map((c) => c.linkedCourseId).filter(Boolean));
      const availableCatalog = publishedTrainings.filter((ic) => !enrolledLinkedIds.has(ic.id));
      const totalLessons = myCourses.reduce((s, c) => s + c.lessons.length, 0);
      const doneLessons = myCourses.reduce((s, c) => s + c.lessons.filter((l) => l.completed).length, 0);
      return res.json({
        actor,
        learnerSummary: {
          coursesCount: myCourses.length,
          overallProgress: totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0,
          certificatesCount: myCourses.filter((c) => Boolean(c.certificate)).length,
          availableCatalogCount: availableCatalog.length,
          coursesChart: myCourses.map((c) => {
            const d = c.lessons.filter((l) => l.completed).length;
            return {
              title: c.title.length > 24 ? `${c.title.slice(0, 24)}…` : c.title,
              progress: c.lessons.length > 0 ? Math.round((d / c.lessons.length) * 100) : 0,
              modality: c.modality,
            };
          }),
          courses: myCourses,
        },
      });
    }

    if (actor.space === 'instructor') {
      const myCourses = store.instructorCourses.filter((c) => c.instructorId === actor.id);
      const ids = new Set(myCourses.map((c) => c.id));
      const myEnrollments = store.instructorEnrollments.filter((e) => ids.has(e.courseId));
      const avgCompletion =
        myEnrollments.length > 0
          ? Math.round(myEnrollments.reduce((s, e) => s + e.progressPct, 0) / myEnrollments.length)
          : 0;
      return res.json({
        actor,
        instructorSummary: {
          totalCourses: myCourses.length,
          publishedCourses: myCourses.filter((c) => c.status === 'PUBLISHED').length,
          enrollmentsCount: myEnrollments.length,
          certifiedCount: myEnrollments.filter((e) => e.attendanceStatus === 'CERTIFIE').length,
          avgCompletion,
          coursesChart: myCourses.map((c) => ({
            title: c.title.length > 22 ? `${c.title.slice(0, 22)}…` : c.title,
            enrolled: c.enrolledCount,
            status: c.status,
          })),
          recentEnrollments: myEnrollments.slice(0, 5),
        },
      });
    }

    // provider
    const myOffers = store.providerOffers.filter((o) => o.providerId === actor.id);
    const myRequests = store.providerRequests.filter((r) => r.providerId === actor.id);
    const pipelineFcfa = myRequests
      .filter((r) => r.stage !== 'REFUSEE')
      .reduce((s, r) => s + r.amountFcfa, 0);
    const paidFcfa = myRequests
      .filter((r) => r.stage === 'PAYEE')
      .reduce((s, r) => s + r.amountFcfa, 0);
    const stageLabels: Array<{ stage: ProviderRequestStage; label: string }> = [
      { stage: 'NOUVELLE_DEMANDE', label: 'Nouvelles' },
      { stage: 'DEVIS_ENVOYE', label: 'Devis' },
      { stage: 'COMMANDE_CONFIRMEE', label: 'Commandes' },
      { stage: 'FACTURE_EMISE', label: 'Facturées' },
      { stage: 'PAYEE', label: 'Payées' },
    ];
    return res.json({
      actor,
      providerSummary: {
        offersCount: myOffers.length,
        publishedOffers: myOffers.filter((o) => o.status === 'PUBLISHED').length,
        requestsCount: myRequests.length,
        pipelineFcfa,
        paidFcfa,
        stageChart: stageLabels.map((s) => ({
          label: s.label,
          amount: myRequests.filter((r) => r.stage === s.stage).reduce((sum, r) => sum + r.amountFcfa, 0),
          count: myRequests.filter((r) => r.stage === s.stage).length,
        })),
        recentRequests: myRequests.slice(0, 5),
      },
    });
  });

  app.get('/api/platform/trainings', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    const enrolledIds = new Set(
      actor?.space === 'learner'
        ? store.learnerCourses.filter((c) => c.learnerId === actor.id).map((c) => c.linkedCourseId).filter(Boolean)
        : [],
    );

    const programs = store.instructorCourses
      .filter((c) => c.status === 'PUBLISHED')
      .map((c) => {
        const maxSeats = Math.max(25, c.enrolledCount + 6);
        const registrationStatus =
          c.enrolledCount >= maxSeats ? 'COMPLET' : maxSeats - c.enrolledCount <= 3 ? 'DERNIERES_PLACES' : 'OUVERTE';
        const inst = store.instructorUsers.find((u) => u.id === c.instructorId);
        return {
          id: c.id,
          title: c.title,
          category: c.category,
          instructor: c.instructorName,
          instructorAvatarUrl: inst?.avatarUrl || c.instructorAvatarUrl,
          modality: c.modality,
          durationHours: Number.parseInt(c.estimatedDuration, 10) || 14,
          nextSession: c.nextSessionDate || '2026-12-01',
          startHour: c.startHour,
          enrolled: c.enrolledCount,
          maxSeats,
          feeFcfa: c.priceFcfa,
          certified: true,
          registrationStatus,
          description: c.description,
          locationOrPlatform: c.locationOrPlatform,
          isEnrolled: enrolledIds.has(c.id),
        };
      });

    return res.json({ programs });
  });

  app.post('/api/platform/trainings', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès réservé à la Direction ou au Manager.' });
    }
    const { title, category, instructor, modality, nextSession, durationHours, feeFcfa } = req.body as {
      title?: string;
      category?: string;
      instructor?: string;
      modality?: 'EN_LIGNE' | 'HYBRIDE' | 'PRESENTIEL';
      nextSession?: string;
      durationHours?: number;
      feeFcfa?: number;
    };
    if (!title?.trim()) return res.status(400).json({ error: 'Nom de la formation requis.' });

    const now = new Date().toISOString();
    const created: InstructorCourse = {
      id: `ic-${Date.now()}`,
      instructorId: store.instructorUsers[0]?.id || 'inst-1',
      instructorName: instructor?.trim() || store.instructorUsers[0]?.name || 'Formateur Teranga',
      title: title.trim(),
      category: category?.trim() || 'Management & Leadership',
      pricingModel: 'ONE_TIME',
      priceFcfa: Number(feeFcfa || 350000),
      description: 'Programme certifiant publié depuis le pôle Formation Pro.',
      level: 'TOUS_NIVEAUX',
      estimatedDuration: `${Number(durationHours || 21)}h 00min`,
      modality: modality || 'HYBRIDE',
      locationOrPlatform: modality === 'EN_LIGNE' ? 'Plateforme E-learning Teranga' : 'Campus Teranga Dakar Plateau',
      nextSessionDate: nextSession || '2027-01-19',
      chapters: [
        {
          id: `ch-${Date.now()}`,
          title: 'Chapitre 1 : Fondamentaux & Mise en pratique',
          description: 'Modules de formation professionnelle B2B.',
          lessons: [
            {
              id: `il-${Date.now()}`,
              title: 'Introduction & Support de cours',
              type: 'PDF',
              durationMinutes: 60,
              fileName: 'Support_Formation_Teranga.pdf',
            },
          ],
        },
      ],
      images: [],
      status: 'PUBLISHED',
      enrolledCount: 0,
      completionRate: 0,
      rating: 5.0,
      createdAt: now,
      updatedAt: now,
    };
    store.instructorCourses.unshift(created);
    return res.status(201).json({ course: created });
  });

  app.patch('/api/platform/trainings/:programId/reschedule', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès réservé à la Direction ou au Manager.' });
    }
    const course = store.instructorCourses.find((c) => c.id === req.params.programId);
    if (!course) return res.status(404).json({ error: 'Session de formation introuvable.' });

    const { date, startHour } = req.body as { date?: string; startHour?: number };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date valide (YYYY-MM-DD) requise.' });
    }
    course.nextSessionDate = date;
    if (typeof startHour === 'number' && startHour >= 6 && startHour <= 22) {
      course.startHour = startHour;
    }
    course.updatedAt = new Date().toISOString();

    // Synchroniser la nouvelle date vers les apprenants inscrits
    store.learnerCourses.forEach((lc) => {
      if (lc.linkedCourseId === course.id) {
        lc.startDate = date;
      }
    });

    return res.json({
      program: {
        id: course.id,
        nextSession: course.nextSessionDate,
        startHour: course.startHour,
      },
    });
  });

  app.get('/api/platform/events', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const events = store.platformEvents.filter(
      (e) => e.ownerUserId === actor.id || e.assignedUserIds.includes(actor.id),
    );
    return res.json({ events });
  });

  app.post('/api/platform/events', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') {
      return res.status(403).json({ error: 'Accès intranet requis.' });
    }
    const { title, client, date, venue, capacity } = req.body as {
      title?: string;
      client?: string;
      date?: string;
      venue?: string;
      capacity?: number;
    };
    if (!title?.trim()) return res.status(400).json({ error: 'Intitulé requis.' });

    const created = {
      id: `ev-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      assignedUserIds: [actor.id],
      title: title.trim(),
      client: client?.trim() || actor.organizationName,
      date: date || '2026-12-20',
      venue: venue?.trim() || 'Dakar Plateau',
      capacity: Number(capacity || 150),
      registered: 0,
      budgetFcfa: 5000000,
      status: 'PLANIFIE' as const,
    };
    store.platformEvents.unshift(created);
    return res.status(201).json({ event: created });
  });

  app.post('/api/platform/events/:eventId/register', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const ev = store.platformEvents.find(
      (e) =>
        e.id === req.params.eventId && (e.ownerUserId === actor.id || e.assignedUserIds.includes(actor.id)),
    );
    if (!ev) return res.status(404).json({ error: 'Événement introuvable.' });
    if (ev.registered < ev.capacity) ev.registered += 1;
    return res.json({ event: ev });
  });

  app.patch('/api/platform/events/:eventId/reschedule', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') {
      return res.status(403).json({ error: 'Accès intranet requis.' });
    }
    const ev = store.platformEvents.find(
      (e) =>
        e.id === req.params.eventId && (e.ownerUserId === actor.id || e.assignedUserIds.includes(actor.id)),
    );
    if (!ev) return res.status(404).json({ error: 'Événement introuvable.' });

    const { date, startHour } = req.body as { date?: string; startHour?: number };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date valide (YYYY-MM-DD) requise.' });
    }
    ev.date = date;
    if (typeof startHour === 'number' && startHour >= 6 && startHour <= 22) {
      ev.startHour = startHour;
    }
    return res.json({ event: ev });
  });

  app.get('/api/platform/providers/offers', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const offers = store.providerOffers
      .filter((o) => o.status === 'PUBLISHED')
      .map((o) => {
        const prov = store.providerUsers.find((u) => u.id === o.providerId);
        return {
          ...o,
          providerAvatarUrl: prov?.avatarUrl || o.providerAvatarUrl,
          companyLogoUrl: prov?.companyLogoUrl || o.companyLogoUrl,
        };
      });
    return res.json({ offers });
  });

  app.post('/api/platform/providers/request', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const { offerId, eventType, eventDate, eventLocation, guestCount, notes } = req.body as {
      offerId?: string;
      eventType?: string;
      eventDate?: string;
      eventLocation?: string;
      guestCount?: number;
      notes?: string;
    };

    const offer = store.providerOffers.find((o) => o.id === offerId && o.status === 'PUBLISHED');
    if (!offer) return res.status(404).json({ error: 'Prestation publiée introuvable.' });

    const now = new Date().toISOString();
    const created: ProviderServiceRequest = {
      id: `req-${Date.now()}`,
      providerId: offer.providerId,
      requesterUserId: actor.id,
      requesterOrgId: actor.organizationId,
      offerId: offer.id,
      offerTitle: offer.title,
      category: offer.category,
      clientName: actor.name,
      clientCompany: actor.organizationName,
      clientEmail: actor.email,
      eventType: eventType?.trim() || 'Événement Corporate Teranga',
      eventDate: eventDate || '2026-12-18',
      eventLocation: eventLocation?.trim() || 'Dakar',
      guestCount: Number(guestCount || offer.capacityGuests || 100),
      notes: notes?.trim() || `Demande envoyée depuis l’événementiel par ${actor.name}.`,
      stage: 'NOUVELLE_DEMANDE',
      amountFcfa: offer.priceFcfa,
      createdAt: now,
      updatedAt: now,
    };
    offer.requestsCount += 1;
    store.providerRequests.unshift(created);
    return res.status(201).json({ request: created });
  });

  // =========================================================================
  // CRM & CAMPAGNES (ISOLÉ PAR UTILISATEUR + SYNCHRO SYSCOHADA)
  // =========================================================================

  app.get('/api/crm/overview', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    if (actor.space === 'accounting') {
      const documents = store.crmDocuments.filter(
        (d) => d.kind === 'CUSTOMER_INVOICE' || d.kind === 'SUPPLIER_INVOICE',
      );
      const contactIds = new Set(documents.map((d) => d.contactId));
      const contacts = store.crmContacts.filter((c) => contactIds.has(c.id));
      return res.json({
        contacts,
        documents,
        campaigns: [],
        followUps: [],
        activities: store.crmActivities.filter((a) => a.kind === 'DOCUMENT'),
      });
    }

    if (actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM réservé à votre rôle.' });
    }

    return res.json({
      contacts: store.crmContacts.filter((c) => c.ownerUserId === actor.id),
      documents: store.crmDocuments.filter((d) => d.ownerUserId === actor.id),
      campaigns: store.crmCampaigns.filter((c) => c.ownerUserId === actor.id),
      followUps: store.crmFollowUps.filter((f) => f.ownerUserId === actor.id),
      activities: store.crmActivities.filter((a) => a.ownerUserId === actor.id),
    });
  });

  app.post('/api/crm/contacts', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM refusé.' });
    }
    const payload = req.body as Partial<ServerCrmContact>;
    if (!payload.name?.trim()) return res.status(400).json({ error: 'Nom du contact requis.' });

    const created: ServerCrmContact = {
      id: `c-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      type: payload.type || 'CLIENT',
      name: payload.name.trim(),
      email: payload.email?.trim() || '',
      phone: payload.phone?.trim() || '',
      ninea: payload.ninea?.trim() || '',
      address: payload.address?.trim() || '',
      sector: payload.sector?.trim() || undefined,
      whatsappOptIn: payload.type === 'SUPPLIER' ? false : Boolean(payload.whatsappOptIn ?? true),
      pipelineStage: payload.type === 'SUPPLIER' ? undefined : payload.pipelineStage || 'NOUVEAU',
      lastContactAt: new Date().toISOString().slice(0, 10),
      nextFollowUpDate: payload.nextFollowUpDate || undefined,
    };
    store.crmContacts.unshift(created);
    store.crmActivities.unshift({
      id: `act-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      contactId: created.id,
      contactName: created.name,
      kind: 'NOTE',
      summary: `Création de la fiche ${created.type === 'PROSPECT' ? 'prospect' : created.type === 'CLIENT' ? 'client' : 'fournisseur'}.`,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      author: actor.name,
    });
    return res.status(201).json({ contact: created });
  });

  app.patch('/api/crm/contacts/:contactId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM refusé.' });
    }
    const contact = store.crmContacts.find(
      (c) => c.id === req.params.contactId && c.ownerUserId === actor.id,
    );
    if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

    const { whatsappOptIn, pipelineStage } = req.body as Partial<ServerCrmContact>;
    if (typeof whatsappOptIn === 'boolean') contact.whatsappOptIn = whatsappOptIn;
    if (pipelineStage) {
      contact.pipelineStage = pipelineStage;
      if (pipelineStage === 'GAGNE' && contact.type === 'PROSPECT') contact.type = 'CLIENT';
      contact.lastContactAt = new Date().toISOString().slice(0, 10);
      store.crmActivities.unshift({
        id: `act-${Date.now()}`,
        ownerUserId: actor.id,
        organizationId: actor.organizationId,
        contactId: contact.id,
        contactName: contact.name,
        kind: 'NOTE',
        summary: `Étape pipeline mise à jour : ${pipelineStage}.`,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        author: actor.name,
      });
    }
    return res.json({ contact });
  });

  app.delete('/api/crm/contacts/:contactId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM refusé.' });
    }
    const idx = store.crmContacts.findIndex(
      (c) => c.id === req.params.contactId && c.ownerUserId === actor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Contact introuvable.' });
    store.crmContacts.splice(idx, 1);
    return res.json({ ok: true });
  });

  app.post('/api/crm/documents', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM refusé.' });
    }
    const { kind, contactId, lineLabel, quantity, unitPrice, vatRate, notes } = req.body as {
      kind?: ServerCommercialDocument['kind'];
      contactId?: string;
      lineLabel?: string;
      quantity?: number;
      unitPrice?: number;
      vatRate?: number;
      notes?: string;
    };
    const contact = store.crmContacts.find((c) => c.id === contactId && c.ownerUserId === actor.id);
    if (!contact || !lineLabel?.trim() || !kind) {
      return res.status(400).json({ error: 'Contact et libellé de ligne requis.' });
    }
    const prefixMap: Record<ServerCommercialDocument['kind'], string> = {
      QUOTE: 'DEV',
      CUSTOMER_ORDER: 'CMD',
      DELIVERY_NOTE: 'BL',
      CUSTOMER_INVOICE: 'FAC',
      PURCHASE_ORDER: 'BCF',
      SUPPLIER_INVOICE: 'FF',
    };
    const seq = store.crmDocuments.filter((d) => d.ownerUserId === actor.id && d.kind === kind).length + 1;
    const doc: ServerCommercialDocument = {
      id: `doc-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      kind,
      number: `${prefixMap[kind]}-2026-${String(seq).padStart(3, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      contactId: contact.id,
      contactName: contact.name,
      status: 'DRAFT',
      lines: [
        {
          id: `l-${Date.now()}`,
          label: lineLabel.trim(),
          quantity: Math.max(1, Number(quantity || 1)),
          deliveredQuantity: 0,
          unitPrice: Math.max(0, Number(unitPrice || 0)),
          vatRate: Math.max(0, Number(vatRate ?? 18)),
        },
      ],
      payments: [],
      notes: notes?.trim() || '',
    };
    store.crmDocuments.unshift(doc);
    store.crmActivities.unshift({
      id: `act-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      contactId: contact.id,
      contactName: contact.name,
      kind: 'DOCUMENT',
      summary: `Création de ${doc.number} (${doc.kind}).`,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      author: actor.name,
    });
    return res.status(201).json({ document: doc });
  });

  app.patch('/api/crm/documents/:docId/status', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = store.crmDocuments.find(
      (d) => d.id === req.params.docId && (actor.space === 'accounting' || d.ownerUserId === actor.id),
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    const { status } = req.body as { status?: ServerCommercialDocument['status'] };
    if (!status) return res.status(400).json({ error: 'Statut requis.' });
    doc.status = status;
    if (status === 'VALIDATED' || status === 'PAID') {
      syncDocumentToAccounting(doc, actor.name);
    }
    return res.json({ document: doc });
  });

  app.patch('/api/crm/documents/:docId/deliver', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const doc = store.crmDocuments.find((d) => d.id === req.params.docId && d.ownerUserId === actor.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    const { lineId, delta } = req.body as { lineId?: string; delta?: number };
    doc.lines = doc.lines.map((l) => {
      if (l.id !== lineId) return l;
      const nextDelivered = Math.min(l.quantity, Math.max(0, l.deliveredQuantity + Number(delta || 0)));
      return { ...l, deliveredQuantity: nextDelivered };
    });
    const allDelivered = doc.lines.every((l) => l.deliveredQuantity >= l.quantity);
    const anyDelivered = doc.lines.some((l) => l.deliveredQuantity > 0);
    doc.status = allDelivered ? 'DELIVERED' : anyDelivered ? 'PARTIAL' : doc.status;
    return res.json({ document: doc });
  });

  app.post('/api/crm/documents/:docId/payments', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    const doc = store.crmDocuments.find(
      (d) => d.id === req.params.docId && (actor.space === 'accounting' || d.ownerUserId === actor.id),
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    const { amount, method, reference } = req.body as {
      amount?: number;
      method?: ServerDocumentPayment['method'];
      reference?: string;
    };
    const numericAmount = Number(amount || 0);
    if (numericAmount <= 0) return res.status(400).json({ error: 'Montant positif requis.' });

    const payment: ServerDocumentPayment = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      amount: numericAmount,
      method: method || 'VIREMENT',
      reference: reference?.trim() || `REG-${Date.now().toString().slice(-4)}`,
    };
    doc.payments.push(payment);
    const totals = calcServerDocTotals(doc);
    const totalPaid = doc.payments.reduce((s, p) => s + p.amount, 0);
    doc.status = totalPaid >= totals.ttc ? 'PAID' : 'PARTIAL';

    syncDocumentToAccounting(doc, actor.name);
    syncPaymentToAccounting(doc, payment, actor.name);

    store.crmActivities.unshift({
      id: `act-${Date.now()}`,
      ownerUserId: doc.ownerUserId,
      organizationId: doc.organizationId,
      contactId: doc.contactId,
      contactName: doc.contactName,
      kind: 'DOCUMENT',
      summary: `Règlement de ${numericAmount} FCFA enregistré sur ${doc.number} (synchronisé SYSCOHADA).`,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      author: actor.name,
    });
    return res.status(201).json({ document: doc, payment });
  });

  app.post('/api/crm/campaigns', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet' || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      return res.status(403).json({ error: 'Accès CRM refusé.' });
    }
    const { name, channel, audience, messageTemplate, targetCount } = req.body as {
      name?: string;
      channel?: 'WHATSAPP' | 'EMAIL' | 'MIXTE';
      audience?: 'ALL_CLIENTS_PROSPECTS' | 'QUALIFIED_PROSPECTS' | 'WHATSAPP_OPTIN' | 'UNPAID_INVOICES';
      messageTemplate?: string;
      targetCount?: number;
    };
    if (!name?.trim() || !messageTemplate?.trim()) {
      return res.status(400).json({ error: 'Nom et modèle de message requis.' });
    }
    const created = {
      id: `camp-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      name: name.trim(),
      channel: channel || 'WHATSAPP',
      audience: audience || 'QUALIFIED_PROSPECTS',
      status: 'ACTIVE' as const,
      messageTemplate: messageTemplate.trim(),
      targetCount: Number(targetCount || 0),
      sentConfirmedCount: 0,
      repliesCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    store.crmCampaigns.unshift(created);
    return res.status(201).json({ campaign: created });
  });

  app.patch('/api/crm/campaigns/:campaignId/status', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const camp = store.crmCampaigns.find(
      (c) => c.id === req.params.campaignId && c.ownerUserId === actor.id,
    );
    if (!camp) return res.status(404).json({ error: 'Campagne introuvable.' });
    const { status } = req.body as { status?: 'BROUILLON' | 'ACTIVE' | 'TERMINEE' };
    if (status) camp.status = status;
    return res.json({ campaign: camp });
  });

  app.delete('/api/crm/campaigns/:campaignId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const idx = store.crmCampaigns.findIndex(
      (c) => c.id === req.params.campaignId && c.ownerUserId === actor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Campagne introuvable.' });
    store.crmCampaigns.splice(idx, 1);
    return res.json({ ok: true });
  });

  app.post('/api/crm/followups/batch', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const { items } = req.body as {
      items?: Array<{
        contactId: string;
        contactName: string;
        phone: string;
        campaignId?: string;
        campaignName?: string;
        documentNumber?: string;
        message: string;
      }>;
    };
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Aucun message à préparer.' });
    }
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const created = items.map((it, idx) => ({
      id: `wa-${Date.now()}-${idx}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      contactId: it.contactId,
      contactName: it.contactName,
      phone: it.phone,
      campaignId: it.campaignId,
      campaignName: it.campaignName,
      documentNumber: it.documentNumber,
      message: it.message,
      status: 'A_ENVOYER' as const,
      preparedAt: nowStr,
    }));
    store.crmFollowUps.unshift(...created);
    return res.status(201).json({ followUps: created });
  });

  app.patch('/api/crm/followups/:followUpId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const item = store.crmFollowUps.find(
      (f) => f.id === req.params.followUpId && f.ownerUserId === actor.id,
    );
    if (!item) return res.status(404).json({ error: 'Relance introuvable.' });
    const { status, replyNote } = req.body as {
      status?: 'A_ENVOYER' | 'OUVERT_WHATSAPP' | 'ENVOI_CONFIRME' | 'REPONSE_RECUE' | 'REPORTE';
      replyNote?: string;
    };
    if (!status) return res.status(400).json({ error: 'Statut requis.' });
    const nowStr = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const prevStatus = item.status;
    item.status = status;
    if (replyNote !== undefined) item.replyNote = replyNote;
    if (status === 'ENVOI_CONFIRME' && prevStatus !== 'ENVOI_CONFIRME') {
      item.confirmedSentAt = nowStr;
      if (item.campaignId) {
        const camp = store.crmCampaigns.find((c) => c.id === item.campaignId);
        if (camp) camp.sentConfirmedCount += 1;
      }
      store.crmActivities.unshift({
        id: `act-${Date.now()}`,
        ownerUserId: actor.id,
        organizationId: actor.organizationId,
        contactId: item.contactId,
        contactName: item.contactName,
        kind: 'WHATSAPP',
        summary: `Envoi WhatsApp confirmé manuellement${item.documentNumber ? ` (${item.documentNumber})` : ''}.`,
        createdAt: nowStr,
        author: actor.name,
      });
    }
    if (status === 'REPONSE_RECUE' && prevStatus !== 'REPONSE_RECUE') {
      item.repliedAt = nowStr;
      if (item.campaignId) {
        const camp = store.crmCampaigns.find((c) => c.id === item.campaignId);
        if (camp) camp.repliesCount += 1;
      }
      store.crmActivities.unshift({
        id: `act-${Date.now()}`,
        ownerUserId: actor.id,
        organizationId: actor.organizationId,
        contactId: item.contactId,
        contactName: item.contactName,
        kind: 'WHATSAPP',
        summary: `Réponse WhatsApp reçue${replyNote ? ` : "${replyNote}"` : '.'}`,
        createdAt: nowStr,
        author: actor.name,
      });
    }
    return res.json({ followUp: item });
  });

  app.delete('/api/crm/followups/:followUpId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const idx = store.crmFollowUps.findIndex(
      (f) => f.id === req.params.followUpId && f.ownerUserId === actor.id,
    );
    if (idx === -1) return res.status(404).json({ error: 'Relance introuvable.' });
    store.crmFollowUps.splice(idx, 1);
    return res.json({ ok: true });
  });

  app.post('/api/crm/activities', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor || actor.space !== 'intranet') return res.status(403).json({ error: 'Accès refusé.' });
    const { contactId, kind, summary, nextStep, followUpDate } = req.body as {
      contactId?: string;
      kind?: 'APPEL' | 'WHATSAPP' | 'EMAIL' | 'REUNION' | 'DOCUMENT' | 'NOTE';
      summary?: string;
      nextStep?: string;
      followUpDate?: string;
    };
    const contact = store.crmContacts.find((c) => c.id === contactId && c.ownerUserId === actor.id);
    if (!contact || !summary?.trim()) return res.status(400).json({ error: 'Contact et résumé requis.' });
    const created = {
      id: `act-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      contactId: contact.id,
      contactName: contact.name,
      kind: kind || 'APPEL',
      summary: summary.trim(),
      nextStep: nextStep?.trim() || undefined,
      followUpDate: followUpDate || undefined,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      author: actor.name,
    };
    store.crmActivities.unshift(created);
    if (followUpDate) {
      contact.lastContactAt = new Date().toISOString().slice(0, 10);
      contact.nextFollowUpDate = followUpDate;
    }
    return res.status(201).json({ activity: created });
  });

  // =========================================================================
  // GESTION DES TÂCHES (KANBAN) & GESTION DE PLANNING COMPLÈTE
  // =========================================================================

  function getAssignableUsersForActor(actor: ActiveActor) {
    if (actor.space === 'superadmin') {
      return [
        ...store.intranetUsers
          .filter((u) => u.status !== 'SUSPENDED')
          .map((u) => ({
            userId: u.id,
            name: u.name,
            role: u.role,
            space: 'intranet' as const,
            organizationId: u.organizationId,
          })),
        ...store.accountingUsers
          .filter((u) => u.status !== 'SUSPENDED')
          .map((u) => ({
            userId: u.id,
            name: u.name,
            role: u.role,
            space: 'accounting' as const,
            organizationId: u.organizationId,
          })),
        ...store.instructorUsers
          .filter((u) => u.status !== 'SUSPENDED')
          .map((u) => ({
            userId: u.id,
            name: u.name,
            role: 'INSTRUCTOR',
            space: 'instructor' as const,
            organizationId: u.city,
          })),
        ...store.providerUsers
          .filter((u) => u.status !== 'SUSPENDED')
          .map((u) => ({
            userId: u.id,
            name: u.name,
            role: 'PROVIDER',
            space: 'provider' as const,
            organizationId: u.companyName,
          })),
        ...store.superadminUsers
          .filter((u) => u.status !== 'SUSPENDED')
          .map((u) => ({
            userId: u.id,
            name: u.name,
            role: u.role,
            space: 'superadmin' as const,
            organizationId: 'tpd-superadmin',
          })),
      ];
    }

    if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'MANAGER')) {
      return store.intranetUsers
        .filter((u) => u.status !== 'SUSPENDED' && u.organizationId === actor.organizationId)
        .map((u) => ({
          userId: u.id,
          name: u.name,
          role: u.role,
          space: 'intranet' as const,
          organizationId: u.organizationId,
        }));
    }

    return [
      {
        userId: actor.id,
        name: actor.name,
        role: actor.role,
        space: actor.space,
        organizationId: actor.organizationId,
      },
    ];
  }

  function getVisibleTasksForActor(actor: ActiveActor): PlatformTask[] {
    if (actor.space === 'superadmin') {
      return store.tasks;
    }
    if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'MANAGER')) {
      return store.tasks.filter(
        (t) =>
          t.ownerUserId === actor.id ||
          t.assigneeUserId === actor.id ||
          (t.space === 'intranet' && t.organizationId === actor.organizationId),
      );
    }
    return store.tasks.filter((t) => t.ownerUserId === actor.id || t.assigneeUserId === actor.id);
  }

  function canAccessTask(actor: ActiveActor, task: PlatformTask): boolean {
    if (actor.space === 'superadmin') return true;
    if (task.ownerUserId === actor.id || task.assigneeUserId === actor.id) return true;
    if (
      actor.space === 'intranet' &&
      (actor.role === 'OWNER' || actor.role === 'MANAGER') &&
      task.space === 'intranet' &&
      task.organizationId === actor.organizationId
    ) {
      return true;
    }
    return false;
  }

  function buildTasksOverview(actor: ActiveActor) {
    const tasks = [...getVisibleTasksForActor(actor)].sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    const todayIso = new Date().toISOString().slice(0, 10);
    const todo = tasks.filter((t) => t.status === 'A_FAIRE').length;
    const inProgress = tasks.filter((t) => t.status === 'EN_COURS').length;
    const inReview = tasks.filter((t) => t.status === 'EN_REVISION').length;
    const done = tasks.filter((t) => t.status === 'TERMINE').length;
    const overdue = tasks.filter(
      (t) => t.status !== 'TERMINE' && Boolean(t.dueDate) && (t.dueDate as string) < todayIso,
    ).length;
    const urgent = tasks.filter((t) => t.status !== 'TERMINE' && t.priority === 'URGENTE').length;
    const completionRate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

    return {
      tasks,
      assignableUsers: getAssignableUsersForActor(actor),
      stats: {
        total: tasks.length,
        todo,
        inProgress,
        inReview,
        done,
        overdue,
        urgent,
        completionRate,
      },
    };
  }

  function nextTaskCode(): string {
    const seq = store.tasks.length + 1;
    return `TSK-2026-${String(seq).padStart(3, '0')}`;
  }

  app.get('/api/tasks', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildTasksOverview(actor));
  });

  app.post('/api/tasks', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const {
      title,
      description,
      status,
      priority,
      category,
      assigneeUserId,
      startDate,
      dueDate,
      startHour,
      estimatedHours,
      tags,
      checklist,
      linkedRecordLabel,
      syncToPlanning,
    } = req.body as {
      title?: string;
      description?: string;
      status?: TaskStatus;
      priority?: TaskPriority;
      category?: TaskCategory;
      assigneeUserId?: string;
      startDate?: string;
      dueDate?: string;
      startHour?: number;
      estimatedHours?: number;
      tags?: string[];
      checklist?: Array<{ id?: string; label: string; completed?: boolean }>;
      linkedRecordLabel?: string;
      syncToPlanning?: boolean;
    };

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Le titre de la tâche est requis.' });
    }

    const assignable = getAssignableUsersForActor(actor);
    const chosenAssignee =
      assignable.find((u) => u.userId === assigneeUserId) || {
        userId: actor.id,
        name: actor.name,
      };

    const validStatuses: TaskStatus[] = ['A_FAIRE', 'EN_COURS', 'EN_REVISION', 'TERMINE'];
    const resolvedStatus: TaskStatus = validStatuses.includes(status as TaskStatus)
      ? (status as TaskStatus)
      : 'A_FAIRE';
    const nowIso = new Date().toISOString();

    const normalizedChecklist: TaskChecklistItem[] = Array.isArray(checklist)
      ? checklist
          .filter((c) => c && c.label && c.label.trim())
          .map((c, idx) => ({
            id: c.id || `chk-${Date.now()}-${idx}`,
            label: c.label.trim(),
            completed: Boolean(c.completed),
          }))
      : [];

    const created: PlatformTask = {
      id: `tsk-${Date.now()}`,
      code: nextTaskCode(),
      title: title.trim(),
      description: (description || '').trim(),
      status: resolvedStatus,
      priority: priority || 'NORMALE',
      category: category || 'PERSONNEL',
      ownerUserId: actor.id,
      ownerName: actor.name,
      assigneeUserId: chosenAssignee.userId,
      assigneeName: chosenAssignee.name,
      organizationId: actor.organizationId,
      space: actor.space,
      startDate: startDate || nowIso.slice(0, 10),
      dueDate: dueDate || undefined,
      startHour: typeof startHour === 'number' && !Number.isNaN(startHour) ? startHour : undefined,
      estimatedHours:
        typeof estimatedHours === 'number' && estimatedHours > 0 ? estimatedHours : undefined,
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
      checklist: normalizedChecklist,
      comments: [],
      linkedRecordLabel: linkedRecordLabel?.trim() || undefined,
      syncToPlanning: syncToPlanning !== undefined ? Boolean(syncToPlanning) : Boolean(dueDate),
      orderIndex: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: resolvedStatus === 'TERMINE' ? nowIso : undefined,
    };

    store.tasks.unshift(created);
    return res.status(201).json({ task: created, ...buildTasksOverview(actor) });
  });

  app.patch('/api/tasks/:taskId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const task = store.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (!canAccessTask(actor, task)) return res.status(403).json({ error: 'Accès non autorisé.' });

    const body = req.body as Partial<PlatformTask>;
    if (body.title !== undefined && body.title.trim()) task.title = body.title.trim();
    if (body.description !== undefined) task.description = body.description.trim();
    if (body.status !== undefined) {
      task.status = body.status;
      task.completedAt = body.status === 'TERMINE' ? new Date().toISOString() : undefined;
    }
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.category !== undefined) task.category = body.category;
    if (body.assigneeUserId !== undefined) {
      const assignable = getAssignableUsersForActor(actor);
      const found = assignable.find((u) => u.userId === body.assigneeUserId);
      if (found) {
        task.assigneeUserId = found.userId;
        task.assigneeName = found.name;
      }
    }
    if (body.startDate !== undefined) task.startDate = body.startDate || undefined;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate || undefined;
    if (body.startHour !== undefined) {
      task.startHour =
        typeof body.startHour === 'number' && !Number.isNaN(body.startHour)
          ? Math.max(8, Math.min(19, body.startHour))
          : undefined;
    }
    if (body.estimatedHours !== undefined) {
      task.estimatedHours =
        typeof body.estimatedHours === 'number' && body.estimatedHours > 0
          ? body.estimatedHours
          : undefined;
    }
    if (body.tags !== undefined && Array.isArray(body.tags)) {
      task.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
    }
    if (body.checklist !== undefined && Array.isArray(body.checklist)) {
      task.checklist = body.checklist
        .filter((c) => c && c.label && c.label.trim())
        .map((c, idx) => ({
          id: c.id || `chk-${Date.now()}-${idx}`,
          label: c.label.trim(),
          completed: Boolean(c.completed),
        }));
    }
    if (body.linkedRecordLabel !== undefined) {
      task.linkedRecordLabel = body.linkedRecordLabel?.trim() || undefined;
    }
    if (body.syncToPlanning !== undefined) {
      task.syncToPlanning = Boolean(body.syncToPlanning);
    }
    if (typeof body.orderIndex === 'number') {
      task.orderIndex = body.orderIndex;
    }

    task.updatedAt = new Date().toISOString();
    return res.json({ task, ...buildTasksOverview(actor) });
  });

  app.patch('/api/tasks/:taskId/move', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const task = store.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (!canAccessTask(actor, task)) return res.status(403).json({ error: 'Accès non autorisé.' });

    const { status, orderIndex } = req.body as { status?: TaskStatus; orderIndex?: number };
    const validStatuses: TaskStatus[] = ['A_FAIRE', 'EN_COURS', 'EN_REVISION', 'TERMINE'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut Kanban invalide.' });
    }

    task.status = status;
    task.completedAt = status === 'TERMINE' ? new Date().toISOString() : undefined;
    if (typeof orderIndex === 'number') {
      task.orderIndex = orderIndex;
    }
    task.updatedAt = new Date().toISOString();

    return res.json({ task, ...buildTasksOverview(actor) });
  });

  app.post('/api/tasks/:taskId/comments', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const task = store.tasks.find((t) => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (!canAccessTask(actor, task)) return res.status(403).json({ error: 'Accès non autorisé.' });

    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Le commentaire ne peut pas être vide.' });
    }

    const comment = {
      id: `cmt-${Date.now()}`,
      authorId: actor.id,
      authorName: actor.name,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    task.comments.push(comment);
    task.updatedAt = new Date().toISOString();

    return res.status(201).json({ task, comment, ...buildTasksOverview(actor) });
  });

  app.delete('/api/tasks/:taskId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const idx = store.tasks.findIndex((t) => t.id === req.params.taskId);
    if (idx === -1) return res.status(404).json({ error: 'Tâche introuvable.' });
    if (!canAccessTask(actor, store.tasks[idx])) {
      return res.status(403).json({ error: 'Suppression non autorisée.' });
    }

    store.tasks.splice(idx, 1);
    return res.json(buildTasksOverview(actor));
  });

  // -------------------------------------------------------------------------
  // GESTION DE PLANNING COMPLÈTE (CRÉNEAUX, SYNCHRO TÂCHES/ÉVÉNEMENTS/COURS)
  // -------------------------------------------------------------------------

  function getVisiblePlanningEntriesForActor(actor: ActiveActor): PlanningEntry[] {
    if (actor.space === 'superadmin') return store.planningEntries;
    if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'MANAGER')) {
      return store.planningEntries.filter(
        (e) =>
          e.ownerUserId === actor.id ||
          e.participantUserIds.includes(actor.id) ||
          (e.space === 'intranet' && e.organizationId === actor.organizationId),
      );
    }
    return store.planningEntries.filter(
      (e) => e.ownerUserId === actor.id || e.participantUserIds.includes(actor.id),
    );
  }

  function canAccessPlanningEntry(actor: ActiveActor, entry: PlanningEntry): boolean {
    if (actor.space === 'superadmin') return true;
    if (entry.ownerUserId === actor.id || entry.participantUserIds.includes(actor.id)) return true;
    if (
      actor.space === 'intranet' &&
      (actor.role === 'OWNER' || actor.role === 'MANAGER') &&
      entry.space === 'intranet' &&
      entry.organizationId === actor.organizationId
    ) {
      return true;
    }
    return false;
  }

  function buildPlanningOverview(actor: ActiveActor) {
    const entries = [...getVisiblePlanningEntriesForActor(actor)].sort((a, b) =>
      a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date),
    );

    const syncedTasks = getVisibleTasksForActor(actor).filter(
      (t) => t.syncToPlanning && Boolean(t.dueDate),
    );

    const syncedEvents =
      actor.space === 'superadmin'
        ? store.platformEvents
        : actor.space === 'intranet'
          ? store.platformEvents.filter(
              (e) => e.ownerUserId === actor.id || e.assignedUserIds.includes(actor.id),
            )
          : [];

    const syncedTrainings =
      actor.space === 'instructor'
        ? store.instructorCourses
            .filter((c) => c.instructorId === actor.id)
            .map((c) => ({
              id: c.id,
              title: c.title,
              category: c.category,
              instructor: c.instructorName,
              modality: c.modality,
              durationHours: Number.parseInt(c.estimatedDuration, 10) || 14,
              nextSession: c.nextSessionDate || '2026-11-24',
              startHour: 10,
              enrolled: c.enrolledCount,
              maxSeats: 25,
              feeFcfa: c.priceFcfa,
              certified: true,
            }))
        : actor.space === 'learner'
          ? store.learnerCourses
              .filter((c) => c.learnerId === actor.id)
              .map((c) => ({
                id: c.linkedCourseId || c.id,
                title: c.title,
                category: c.category,
                instructor: c.instructor,
                modality: c.modality,
                durationHours: c.durationHours,
                nextSession: c.startDate || '2026-11-20',
                startHour: 14,
                enrolled: 1,
                maxSeats: 25,
                feeFcfa: 0,
                certified: Boolean(c.certificate),
              }))
          : store.instructorCourses
              .filter((c) => c.status === 'PUBLISHED')
              .map((c) => ({
                id: c.id,
                title: c.title,
                category: c.category,
                instructor: c.instructorName,
                modality: c.modality,
                durationHours: Number.parseInt(c.estimatedDuration, 10) || 14,
                nextSession: c.nextSessionDate || '2026-12-01',
                startHour: 10,
                enrolled: c.enrolledCount,
                maxSeats: Math.max(25, c.enrolledCount + 5),
                feeFcfa: c.priceFcfa,
                certified: true,
              }));

    const syncedProviderRequests =
      actor.space === 'provider'
        ? store.providerRequests.filter((r) => r.providerId === actor.id && r.stage !== 'REFUSEE')
        : actor.space === 'superadmin'
          ? store.providerRequests.filter((r) => r.stage !== 'REFUSEE')
          : [];

    return {
      entries,
      syncedTasks,
      syncedEvents,
      syncedTrainings,
      syncedProviderRequests,
      teamMembers: getAssignableUsersForActor(actor),
    };
  }

  app.get('/api/planning', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildPlanningOverview(actor));
  });

  app.post('/api/planning', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const {
      title,
      description,
      type,
      status,
      date,
      startHour,
      durationHours,
      location,
      participantUserIds,
      linkedTaskId,
    } = req.body as {
      title?: string;
      description?: string;
      type?: PlanningEntryType;
      status?: PlanningEntryStatus;
      date?: string;
      startHour?: number;
      durationHours?: number;
      location?: string;
      participantUserIds?: string[];
      linkedTaskId?: string;
    };

    if (!title?.trim() || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Titre et date valide (AAAA-MM-JJ) requis.' });
    }

    const assignable = getAssignableUsersForActor(actor);
    const chosenIds = Array.isArray(participantUserIds) && participantUserIds.length > 0
      ? participantUserIds
      : [actor.id];
    const chosenNames = chosenIds
      .map((id) => assignable.find((u) => u.userId === id)?.name || (id === actor.id ? actor.name : ''))
      .filter(Boolean);

    const nowIso = new Date().toISOString();
    const created: PlanningEntry = {
      id: `pln-${Date.now()}`,
      ownerUserId: actor.id,
      ownerName: actor.name,
      participantUserIds: chosenIds,
      participantNames: chosenNames.length > 0 ? chosenNames : [actor.name],
      organizationId: actor.organizationId,
      space: actor.space,
      title: title.trim(),
      description: (description || '').trim(),
      type: type || 'REUNION',
      status: status || 'PLANIFIE',
      date,
      startHour: Math.max(8, Math.min(19, Number(startHour ?? 9))),
      durationHours: Math.max(1, Math.min(8, Number(durationHours ?? 1))),
      location: (location || 'En ligne / Bureau').trim(),
      linkedTaskId: linkedTaskId || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.planningEntries.unshift(created);
    return res.status(201).json({ entry: created, ...buildPlanningOverview(actor) });
  });

  app.patch('/api/planning/:entryId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const entry = store.planningEntries.find((e) => e.id === req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Créneau introuvable.' });
    if (!canAccessPlanningEntry(actor, entry)) {
      return res.status(403).json({ error: 'Modification non autorisée.' });
    }

    const body = req.body as Partial<PlanningEntry>;
    if (body.title !== undefined && body.title.trim()) entry.title = body.title.trim();
    if (body.description !== undefined) entry.description = body.description.trim();
    if (body.type !== undefined) entry.type = body.type;
    if (body.status !== undefined) entry.status = body.status;
    if (body.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      entry.date = body.date;
    }
    if (typeof body.startHour === 'number' && !Number.isNaN(body.startHour)) {
      entry.startHour = Math.max(8, Math.min(19, body.startHour));
    }
    if (typeof body.durationHours === 'number' && !Number.isNaN(body.durationHours)) {
      entry.durationHours = Math.max(1, Math.min(8, body.durationHours));
    }
    if (body.location !== undefined) entry.location = body.location.trim();
    if (Array.isArray(body.participantUserIds) && body.participantUserIds.length > 0) {
      const assignable = getAssignableUsersForActor(actor);
      entry.participantUserIds = body.participantUserIds;
      entry.participantNames = body.participantUserIds
        .map((id) => assignable.find((u) => u.userId === id)?.name || '')
        .filter(Boolean);
      if (entry.participantNames.length === 0) entry.participantNames = [actor.name];
    }

    entry.updatedAt = new Date().toISOString();
    return res.json({ entry, ...buildPlanningOverview(actor) });
  });

  app.delete('/api/planning/:entryId', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const idx = store.planningEntries.findIndex((e) => e.id === req.params.entryId);
    if (idx === -1) return res.status(404).json({ error: 'Créneau introuvable.' });
    if (!canAccessPlanningEntry(actor, store.planningEntries[idx])) {
      return res.status(403).json({ error: 'Suppression non autorisée.' });
    }

    store.planningEntries.splice(idx, 1);
    return res.json(buildPlanningOverview(actor));
  });

  // Register Cahier des Charges Modules (HR, Workflows, GED, Memos/Directory, Notifications, Org Admin, Operations, Superadmin Multi-Tenant)
  registerCahierModules(app, {
    getActiveActor,
    addAuditLog: (entry) =>
      addAuditLog({
        ...entry,
        targetType: 'SYSTEM',
        targetLabel: entry.target,
      }),
  });

  const httpServer = http.createServer(app);

  // Register Teams Communication & Collaboration Module (WebSockets, WebRTC Signaling, Co-editing, Files)
  registerTeamsModule(app, {
    server: httpServer,
    getActiveActor,
    resolveActorFromIncoming,
    addAuditLog: (entry) =>
      addAuditLog({
        ...entry,
        targetType: 'SYSTEM',
        targetLabel: entry.target,
      }),
  });

  // Register Marketing & Retargeting Module (Smart Audiences, Multi-channel Campaigns, Retargeting Automations)
  registerMarketingModule(app, {
    getActiveActor,
    addAuditLog: (entry) =>
      addAuditLog({
        ...entry,
        targetType: 'SYSTEM',
        targetLabel: entry.target,
      }),
  });

  // Restore persisted state from disk snapshot if present
  loadServerSnapshot();

  // Error middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  // Mount Vite in dev, or serve static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build dist/index.html introuvable. Exécutez npm run build.');
      }
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`Teranga Prestige Digital prêt sur http://${HOST}:${PORT} (mode ${isProd ? 'production' : 'développement'})`);
  });
}

createServer().catch((err) => {
  console.error('Échec du démarrage du serveur:', err);
  process.exit(1);
});
