import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { AuthSessionSummary } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

function sanitizeId(raw: string | undefined | null, prefix: string): string {
  const cleaned = String(raw || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || `${prefix}_${Date.now()}`;
}

function truncate(raw: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return fallback.slice(0, maxLen);
  return s.slice(0, maxLen);
}

function clampNum(raw: unknown, min = 0): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

export function getWorkspaceIdForUser(uid: string): string {
  return sanitizeId(`ws_${uid}`, 'ws');
}

export async function ensureUserAndWorkspace(
  firebaseUser: User,
  session: AuthSessionSummary,
): Promise<string> {
  const uid = sanitizeId(firebaseUser.uid, 'usr');
  const workspaceId = getWorkspaceIdForUser(uid);

  const userRef = doc(db, 'users', uid);
  const userPath = `users/${uid}`;
  const validRole = [
    'OWNER',
    'DIRECTION',
    'MANAGER',
    'EMPLOYEE',
    'ACCOUNTANT',
    'READ_ONLY',
    'LEARNER',
    'INSTRUCTOR',
    'PROVIDER',
    'SUPERADMIN',
    'SECURITY_ADMIN',
  ].includes(session.role)
    ? session.role
    : 'OWNER';
  const safeRole =
    ['SUPERADMIN', 'SECURITY_ADMIN'].includes(validRole) &&
    firebaseUser.email?.toLowerCase() !== 'jthiaw89@gmail.com'
      ? 'OWNER'
      : validRole;

  try {
    const existingUser = await getDoc(userRef);
    if (!existingUser.exists()) {
      await setDoc(userRef, {
        uid,
        displayName: truncate(session.name || firebaseUser.displayName, 120, 'Utilisateur'),
        role: safeRole,
        space: session.space,
        organizationId: sanitizeId(session.organizationId, 'org'),
        organizationName: truncate(session.organizationName, 140, 'Teranga Prestige Digital'),
        subtitle: truncate(session.subtitle, 160, safeRole),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: truncate(session.name || firebaseUser.displayName, 120, 'Utilisateur'),
        space: session.space,
        organizationId: sanitizeId(session.organizationId, 'org'),
        organizationName: truncate(session.organizationName, 140, 'Teranga Prestige Digital'),
        subtitle: truncate(session.subtitle, 160, safeRole),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  const privateRef = doc(db, 'users', uid, 'private', 'profile');
  const privatePath = `users/${uid}/private/profile`;
  try {
    const existingPrivate = await getDoc(privateRef);
    const emailVal = truncate(firebaseUser.email || session.email, 160, 'user@teranga.sn');
    const photoVal = truncate(firebaseUser.photoURL || '', 500);
    if (!existingPrivate.exists()) {
      await setDoc(privateRef, {
        uid,
        email: emailVal,
        ...(photoVal ? { photoUrl: photoVal } : {}),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privateRef, {
        email: emailVal,
        ...(photoVal ? { photoUrl: photoVal } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  const wsRef = doc(db, 'workspaces', workspaceId);
  const memberRef = doc(db, 'workspaces', workspaceId, 'members', uid);
  try {
    const existingWs = await getDoc(wsRef);
    if (!existingWs.exists()) {
      const batch = writeBatch(db);
      batch.set(wsRef, {
        workspaceId,
        ownerId: uid,
        name: truncate(session.organizationName, 140, 'Teranga Prestige Digital'),
        sector: 'Services & Digital',
        city: 'Dakar, Sénégal',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(memberRef, {
        uid,
        workspaceId,
        role: 'OWNER',
        displayName: truncate(session.name || firebaseUser.displayName, 120, 'Utilisateur'),
        joinedAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      const existingMember = await getDoc(memberRef);
      if (!existingMember.exists()) {
        await setDoc(memberRef, {
          uid,
          workspaceId,
          role: 'OWNER',
          displayName: truncate(session.name || firebaseUser.displayName, 120, 'Utilisateur'),
          joinedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaces/${workspaceId}`);
  }

  return workspaceId;
}

interface SnapshotApiResponse {
  crmContacts?: Array<Record<string, unknown>>;
  crmDocuments?: Array<Record<string, unknown>>;
  campaigns?: Array<Record<string, unknown>>;
  missions?: Array<Record<string, unknown>>;
  reports?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  planningEvents?: Array<Record<string, unknown>>;
  gedDocuments?: Array<Record<string, unknown>>;
  accountingEntries?: Array<Record<string, unknown>>;
  teamsChannels?: Array<Record<string, unknown>>;
  teamsMessages?: Array<Record<string, unknown>>;
  leaveRequests?: Array<Record<string, unknown>>;
}

const syncedHashes = new Map<string, string>();
const knownExistingDocIds = new Set<string>();
const knownTerminalDocIds = new Set<string>();

function mapCrmStage(raw: unknown): 'PROSPECT' | 'QUALIFIE' | 'PROPOSITION' | 'GAGNE' | 'PERDU' {
  const s = String(raw || '');
  if (s === 'QUALIFIE' || s === 'PROPOSITION' || s === 'GAGNE' || s === 'PERDU') return s;
  return 'PROSPECT';
}

function mapDocKind(
  raw: unknown,
):
  | 'DEVIS'
  | 'COMMANDE_CLIENT'
  | 'BON_LIVRAISON'
  | 'FACTURE_CLIENT'
  | 'COMMANDE_FOURNISSEUR'
  | 'FACTURE_FOURNISSEUR' {
  switch (String(raw || '')) {
    case 'CUSTOMER_ORDER':
    case 'COMMANDE_CLIENT':
      return 'COMMANDE_CLIENT';
    case 'DELIVERY_NOTE':
    case 'BON_LIVRAISON':
      return 'BON_LIVRAISON';
    case 'CUSTOMER_INVOICE':
    case 'FACTURE_CLIENT':
      return 'FACTURE_CLIENT';
    case 'PURCHASE_ORDER':
    case 'COMMANDE_FOURNISSEUR':
      return 'COMMANDE_FOURNISSEUR';
    case 'SUPPLIER_INVOICE':
    case 'FACTURE_FOURNISSEUR':
      return 'FACTURE_FOURNISSEUR';
    default:
      return 'DEVIS';
  }
}

function mapDocStatus(
  raw: unknown,
): 'BROUILLON' | 'EMIS' | 'PARTIEL' | 'PAYE' | 'VALIDE' | 'ANNULE' {
  switch (String(raw || '')) {
    case 'VALIDATED':
    case 'VALIDE':
      return 'VALIDE';
    case 'PARTIAL':
    case 'PARTIEL':
      return 'PARTIEL';
    case 'PAID':
    case 'PAYE':
      return 'PAYE';
    case 'DELIVERED':
    case 'EMIS':
      return 'EMIS';
    case 'ANNULE':
      return 'ANNULE';
    default:
      return 'BROUILLON';
  }
}

function mapMissionStatus(
  raw: unknown,
): 'BROUILLON' | 'SOUMIS' | 'APPROUVE' | 'EN_COURS' | 'CLOTURE' | 'REJETE' {
  const s = String(raw || '');
  if (s.includes('APPROUVE') || s === 'SIGNEE') return 'APPROUVE';
  if (s.includes('SOUMIS') || s.includes('ATTENTE')) return 'SOUMIS';
  if (s === 'EN_COURS') return 'EN_COURS';
  if (s === 'CLOTURE' || s === 'LIQUIDEE') return 'CLOTURE';
  if (s === 'REJETE') return 'REJETE';
  return 'BROUILLON';
}

function mapTaskPriority(raw: unknown): 'BASSE' | 'MOYENNE' | 'HAUTE' | 'URGENTE' {
  const s = String(raw || '');
  if (s === 'BASSE' || s === 'HAUTE' || s === 'URGENTE') return s;
  return 'MOYENNE';
}

function mapTaskStatus(raw: unknown): 'A_FAIRE' | 'EN_COURS' | 'EN_REVUE' | 'TERMINE' {
  const s = String(raw || '');
  if (s === 'EN_REVISION' || s === 'EN_REVUE') return 'EN_REVUE';
  if (s === 'EN_COURS' || s === 'TERMINE') return s;
  return 'A_FAIRE';
}

function mapPlanningType(
  raw: unknown,
): 'REUNION' | 'RENDEZ_VOUS' | 'ECHEANCE' | 'FORMATION' | 'PRESTATION' {
  const s = String(raw || '');
  if (s === 'RENDEZ_VOUS' || s === 'ECHEANCE' || s === 'FORMATION' || s === 'PRESTATION') return s;
  return 'REUNION';
}

function mapPlanningStatus(raw: unknown): 'PLANIFIE' | 'CONFIRME' | 'TERMINE' | 'ANNULE' {
  const s = String(raw || '');
  if (s === 'CONFIRME' || s === 'TERMINE' || s === 'ANNULE') return s;
  return 'PLANIFIE';
}

function mapConfidentiality(raw: unknown): 'PUBLIC' | 'INTERNE' | 'CONFIDENTIEL' | 'SECRET' {
  const s = String(raw || '');
  if (s === 'PUBLIC' || s === 'CONFIDENTIEL' || s === 'SECRET') return s;
  return 'INTERNE';
}

function mapLeaveStatus(raw: unknown): 'EN_ATTENTE' | 'APPROUVE' | 'REJETE' | 'ANNULE' {
  const s = String(raw || '');
  if (s === 'APPROUVE' || s === 'REJETE' || s === 'ANNULE') return s;
  return 'EN_ATTENTE';
}

async function upsertWorkspaceRecord(
  workspaceId: string,
  subcollection: string,
  docId: string,
  createPayload: Record<string, unknown>,
  updatePayload: Record<string, unknown>,
  terminalStatus?: boolean,
): Promise<void> {
  const cacheKey = `${workspaceId}/${subcollection}/${docId}`;
  const fingerprint = JSON.stringify(createPayload);
  if (syncedHashes.get(cacheKey) === fingerprint) return;

  const ref = doc(db, 'workspaces', workspaceId, subcollection, docId);
  const path = `workspaces/${workspaceId}/${subcollection}/${docId}`;

  try {
    if (!knownExistingDocIds.has(cacheKey)) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        knownExistingDocIds.add(cacheKey);
        const existingData = snap.data();
        const st = String(existingData?.status || existingData?.stage || '');
        if (
          ['GAGNE', 'PERDU', 'PAYE', 'ANNULE', 'COMPLETED', 'CLOTURE', 'REJETE', 'ARCHIVE', 'TERMINE', 'APPROUVE'].includes(st)
        ) {
          knownTerminalDocIds.add(cacheKey);
        }
      }
    }

    if (!knownExistingDocIds.has(cacheKey)) {
      await setDoc(ref, {
        ...createPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      knownExistingDocIds.add(cacheKey);
    } else if (!knownTerminalDocIds.has(cacheKey)) {
      await updateDoc(ref, {
        ...updatePayload,
        updatedAt: serverTimestamp(),
      });
    }

    if (terminalStatus) knownTerminalDocIds.add(cacheKey);
    syncedHashes.set(cacheKey, fingerprint);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function hydrateWorkspaceFromFirestore(
  workspaceId: string,
  uid: string,
  authHeaders: Record<string, string>,
): Promise<{ hydratedCount: number }> {
  const collectionsToPull = [
    'crm_contacts',
    'crm_documents',
    'campaigns',
    'missions',
    'reports',
    'tasks',
    'planning_events',
    'ged_documents',
    'accounting_entries',
    'teams_channels',
    'teams_messages',
    'leave_requests',
  ] as const;

  const pulled: Record<string, Array<Record<string, unknown>>> = {};
  let totalCount = 0;

  for (const colName of collectionsToPull) {
    const colPath = `workspaces/${workspaceId}/${colName}`;
    try {
      const q = query(collection(db, 'workspaces', workspaceId, colName), where('ownerId', '==', uid));
      const snap = await getDocs(q);
      const rows: Array<Record<string, unknown>> = [];
      snap.forEach((docSnap) => {
        const key = `${colPath}/${docSnap.id}`;
        knownExistingDocIds.add(key);
        const data = docSnap.data() as Record<string, unknown>;
        const st = String(data.status || data.stage || '');
        if (
          ['GAGNE', 'PERDU', 'PAYE', 'ANNULE', 'COMPLETED', 'CLOTURE', 'REJETE', 'ARCHIVE', 'TERMINE', 'APPROUVE'].includes(st)
        ) {
          knownTerminalDocIds.add(key);
        }
        rows.push(data);
      });
      pulled[colName] = rows;
      totalCount += rows.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, colPath);
    }
  }

  if (totalCount > 0) {
    await fetch('/api/persistence/hydrate', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        crmContacts: pulled.crm_contacts,
        tasks: pulled.tasks,
        reports: pulled.reports,
        missions: pulled.missions,
        planningEvents: pulled.planning_events,
        gedDocuments: pulled.ged_documents,
      }),
    });
  }

  return { hydratedCount: totalCount };
}

export async function syncBackendSnapshotToFirestore(
  workspaceId: string,
  uid: string,
  authHeaders: Record<string, string>,
): Promise<void> {
  const res = await fetch('/api/persistence/snapshot', {
    headers: authHeaders,
    credentials: 'include',
  });
  if (!res.ok) return;
  const snap = (await res.json()) as SnapshotApiResponse;

  const jobs: Promise<void>[] = [];

  for (const c of (snap.crmContacts || []).slice(0, 40)) {
    const id = sanitizeId(String(c.id || ''), 'cnt');
    const stage = mapCrmStage(c.pipelineStage);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      name: truncate(String(c.name || ''), 140, 'Contact'),
      company: truncate(String(c.name || ''), 140, 'Entreprise'),
      sector: truncate(String(c.sector || ''), 100, 'Services'),
      email: truncate(String(c.email || ''), 160),
      phone: truncate(String(c.phone || ''), 40),
      stage,
      estimatedValueFcfa: clampNum(c.estimatedValueFcfa, 0),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'crm_contacts',
        id,
        payload,
        {
          name: payload.name,
          company: payload.company,
          sector: payload.sector,
          email: payload.email,
          phone: payload.phone,
          stage: payload.stage,
          estimatedValueFcfa: payload.estimatedValueFcfa,
        },
        stage === 'GAGNE' || stage === 'PERDU',
      ),
    );
  }

  for (const d of (snap.crmDocuments || []).slice(0, 40)) {
    const id = sanitizeId(String(d.id || ''), 'doc');
    const lines = Array.isArray(d.lines) ? (d.lines as Array<{ quantity?: number; unitPrice?: number; vatRate?: number }>) : [];
    const totalHt = lines.reduce((acc, l) => acc + clampNum(l.quantity, 0) * clampNum(l.unitPrice, 0), 0);
    const tvaAmount = lines.reduce(
      (acc, l) => acc + clampNum(l.quantity, 0) * clampNum(l.unitPrice, 0) * (clampNum(l.vatRate, 0) / 100),
      0,
    );
    const totalTtc = totalHt + tvaAmount;
    const payments = Array.isArray(d.payments) ? (d.payments as Array<{ amount?: number }>) : [];
    const paidAmount = payments.reduce((acc, p) => acc + clampNum(p.amount, 0), 0);
    const status = mapDocStatus(d.status);

    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      docType: mapDocKind(d.kind),
      reference: truncate(String(d.number || id), 80, id),
      tierName: truncate(String(d.contactName || ''), 140, 'Client'),
      totalHt,
      tvaAmount,
      totalTtc,
      paidAmount,
      status,
      issueDate: truncate(String(d.date || ''), 30, new Date().toISOString().slice(0, 10)),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'crm_documents',
        id,
        payload,
        {
          paidAmount: payload.paidAmount,
          status: payload.status,
          totalHt: payload.totalHt,
          tvaAmount: payload.tvaAmount,
          totalTtc: payload.totalTtc,
        },
        status === 'PAYE' || status === 'ANNULE',
      ),
    );
  }

  for (const cmp of (snap.campaigns || []).slice(0, 30)) {
    const id = sanitizeId(String(cmp.id || ''), 'cmp');
    const channels = Array.isArray(cmp.channels) ? (cmp.channels as string[]) : [];
    const channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PUSH' | 'MULTI' =
      channels.length > 1
        ? 'MULTI'
        : channels[0] === 'WHATSAPP' || channels[0] === 'SMS' || channels[0] === 'EMAIL' || channels[0] === 'PUSH'
        ? channels[0]
        : 'MULTI';
    const rawSt = String(cmp.status || 'ACTIVE');
    const status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' =
      rawSt === 'DRAFT' || rawSt === 'PAUSED' || rawSt === 'COMPLETED' ? rawSt : 'ACTIVE';

    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      name: truncate(String(cmp.name || ''), 160, 'Campagne'),
      objective: truncate(String(cmp.objective || ''), 60, 'RETARGETING'),
      channel,
      audienceName: truncate(String(cmp.audienceName || ''), 140, 'Audience CRM'),
      status,
      targetCount: clampNum(cmp.targetCount, 0),
      dispatchedCount: clampNum(cmp.dispatchedCount, 0),
      convertedCount: clampNum(cmp.convertedCount, 0),
      revenueRecoveredFcfa: clampNum(cmp.revenueRecoveredFcfa, 0),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'campaigns',
        id,
        payload,
        {
          name: payload.name,
          status: payload.status,
          targetCount: payload.targetCount,
          dispatchedCount: payload.dispatchedCount,
          convertedCount: payload.convertedCount,
          revenueRecoveredFcfa: payload.revenueRecoveredFcfa,
        },
        status === 'COMPLETED',
      ),
    );
  }

  for (const m of (snap.missions || []).slice(0, 30)) {
    const id = sanitizeId(String(m.id || ''), 'om');
    const status = mapMissionStatus(m.status);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      reference: truncate(String(m.reference || id), 80, id),
      title: truncate(String(m.title || ''), 180, 'Ordre de mission'),
      destination: truncate(String(m.destination || ''), 120, 'Dakar'),
      agentName: truncate(String(m.agentName || ''), 120, 'Collaborateur'),
      startDate: truncate(String(m.departureDate || ''), 30),
      endDate: truncate(String(m.returnDate || ''), 30),
      totalFcfa: clampNum(m.totalEstimatedFcfa, 0),
      status,
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'missions',
        id,
        payload,
        {
          title: payload.title,
          destination: payload.destination,
          startDate: payload.startDate,
          endDate: payload.endDate,
          totalFcfa: payload.totalFcfa,
          status: payload.status,
        },
        status === 'CLOTURE' || status === 'REJETE',
      ),
    );
  }

  for (const r of (snap.reports || []).slice(0, 30)) {
    const id = sanitizeId(String(r.id || ''), 'rpt');
    const rawType = String(r.type || '');
    const reportType: 'MISSION' | 'TRAVAIL' | 'DIRECTION' | 'HEBDO' =
      rawType.includes('MISSION') ? 'MISSION' : rawType.includes('DIRECTION') ? 'DIRECTION' : 'TRAVAIL';
    const rawStatus = String(r.status || 'BROUILLON');
    const status: 'BROUILLON' | 'SOUMIS' | 'VALIDE' | 'ARCHIVE' =
      rawStatus === 'SOUMIS' || rawStatus === 'VALIDE' || rawStatus === 'ARCHIVE' ? rawStatus : 'BROUILLON';
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      reference: truncate(String(r.reference || id), 80, id),
      reportType,
      title: truncate(String(r.title || ''), 180, 'Rapport'),
      authorName: truncate(String(r.authorName || ''), 120, 'Auteur'),
      summary: truncate(String(r.executiveSummary || ''), 2000),
      status,
      periodLabel: truncate(String(r.periodLabel || ''), 80),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'reports',
        id,
        payload,
        {
          title: payload.title,
          summary: payload.summary,
          status: payload.status,
          periodLabel: payload.periodLabel,
        },
        status === 'ARCHIVE',
      ),
    );
  }

  for (const t of (snap.tasks || []).slice(0, 40)) {
    const id = sanitizeId(String(t.id || ''), 'tsk');
    const status = mapTaskStatus(t.status);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      title: truncate(String(t.title || ''), 180, 'Tâche'),
      category: truncate(String(t.category || ''), 60, 'ADMINISTRATION'),
      priority: mapTaskPriority(t.priority),
      status,
      assigneeName: truncate(String(t.assigneeName || ''), 120, 'Équipe'),
      dueDate: truncate(String(t.dueDate || ''), 30),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'tasks',
        id,
        payload,
        {
          title: payload.title,
          category: payload.category,
          priority: payload.priority,
          status: payload.status,
          assigneeName: payload.assigneeName,
          dueDate: payload.dueDate,
        },
        status === 'TERMINE',
      ),
    );
  }

  for (const p of (snap.planningEvents || []).slice(0, 40)) {
    const id = sanitizeId(String(p.id || ''), 'pln');
    const status = mapPlanningStatus(p.status);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      title: truncate(String(p.title || ''), 180, 'Événement'),
      eventType: mapPlanningType(p.type),
      status,
      date: truncate(String(p.date || ''), 30, new Date().toISOString().slice(0, 10)),
      startHour: Math.min(24, Math.max(0, clampNum(p.startHour, 9))),
      durationHours: Math.min(24, Math.max(1, clampNum(p.durationHours, 1))),
      location: truncate(String(p.location || ''), 160),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'planning_events',
        id,
        payload,
        {
          title: payload.title,
          eventType: payload.eventType,
          status: payload.status,
          date: payload.date,
          startHour: payload.startHour,
          durationHours: payload.durationHours,
          location: payload.location,
        },
        status === 'TERMINE' || status === 'ANNULE',
      ),
    );
  }

  for (const g of (snap.gedDocuments || []).slice(0, 40)) {
    const id = sanitizeId(String(g.id || ''), 'ged');
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      title: truncate(String(g.title || ''), 180, 'Document'),
      category: truncate(String(g.category || ''), 80, 'AUTRE'),
      fileName: truncate(String(g.title || ''), 200, 'document.pdf'),
      mimeType: truncate(String(g.mimeType || ''), 120, 'application/pdf'),
      sizeBytes: Math.round(clampNum(g.sizeKb, 0) * 1024),
      version: Math.max(1, Math.round(clampNum(g.currentVersion, 1))),
      confidentiality: mapConfidentiality(g.classification),
    };
    jobs.push(
      upsertWorkspaceRecord(workspaceId, 'ged_documents', id, payload, {
        title: payload.title,
        category: payload.category,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        version: payload.version,
        confidentiality: payload.confidentiality,
      }),
    );
  }

  for (const a of (snap.accountingEntries || []).slice(0, 40)) {
    const id = sanitizeId(String(a.id || ''), 'acc');
    const lines = Array.isArray(a.lines) ? (a.lines as Array<{ debit?: number; credit?: number }>) : [];
    const totalDebit = lines.reduce((sum, l) => sum + clampNum(l.debit, 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + clampNum(l.credit, 0), 0);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      entryNumber: truncate(String(a.entryNumber || id), 60, id),
      journalCode: truncate(String(a.journalCode || 'OD'), 20, 'OD'),
      entryDate: truncate(String(a.entryDate || ''), 30),
      reference: truncate(String(a.reference || ''), 80),
      description: truncate(String(a.description || ''), 240),
      totalDebit,
      totalCredit,
    };
    jobs.push(
      upsertWorkspaceRecord(workspaceId, 'accounting_entries', id, payload, {
        reference: payload.reference,
        description: payload.description,
        totalDebit: payload.totalDebit,
        totalCredit: payload.totalCredit,
      }),
    );
  }

  for (const ch of (snap.teamsChannels || []).slice(0, 25)) {
    const id = sanitizeId(String(ch.id || ''), 'ch');
    const kindRaw = String(ch.kind || 'CHANNEL');
    const kind: 'CHANNEL' | 'PROJECT' | 'ONBOARDING' | 'FORMATION' | 'GROUP' | 'DM' =
      ['CHANNEL', 'PROJECT', 'ONBOARDING', 'FORMATION', 'GROUP', 'DM'].includes(kindRaw)
        ? (kindRaw as 'CHANNEL' | 'PROJECT' | 'ONBOARDING' | 'FORMATION' | 'GROUP' | 'DM')
        : 'CHANNEL';
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      name: truncate(String(ch.name || ''), 120, 'Canal'),
      kind,
      topic: truncate(String(ch.topic || ''), 300),
      isPrivate: Boolean(ch.isPrivate),
      lastMessageAt: truncate(String(ch.lastMessageAt || ''), 40),
    };
    jobs.push(
      upsertWorkspaceRecord(workspaceId, 'teams_channels', id, payload, {
        name: payload.name,
        topic: payload.topic,
        lastMessageAt: payload.lastMessageAt,
      }),
    );
  }

  for (const lr of (snap.leaveRequests || []).slice(0, 30)) {
    const id = sanitizeId(String(lr.id || ''), 'lvr');
    const status = mapLeaveStatus(lr.status);
    const payload = {
      id,
      workspaceId,
      ownerId: uid,
      employeeName: truncate(String(lr.userName || ''), 120, 'Employé'),
      leaveType: truncate(String(lr.leaveType || 'ANNUEL'), 40, 'ANNUEL'),
      startDate: truncate(String(lr.startDate || ''), 30),
      endDate: truncate(String(lr.endDate || ''), 30),
      daysCount: Math.max(1, clampNum(lr.workingDays, 1)),
      status,
      reason: truncate(String(lr.reason || ''), 500),
    };
    jobs.push(
      upsertWorkspaceRecord(
        workspaceId,
        'leave_requests',
        id,
        payload,
        {
          status: payload.status,
          reason: payload.reason,
        },
        status !== 'EN_ATTENTE',
      ),
    );
  }

  await Promise.allSettled(jobs);
}

export function attachWorkspaceListeners(
  workspaceId: string,
  uid: string,
  onSyncEvent: () => void,
): () => void {
  const watched = ['crm_contacts', 'tasks', 'reports', 'planning_events'] as const;
  const unsubs: Unsubscribe[] = [];

  for (const colName of watched) {
    const colPath = `workspaces/${workspaceId}/${colName}`;
    const q = query(collection(db, 'workspaces', workspaceId, colName), where('ownerId', '==', uid));
    const unsub = onSnapshot(
      q,
      () => {
        onSyncEvent();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, colPath);
      },
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}
