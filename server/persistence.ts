import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express, NextFunction, Request, Response } from 'express';
import { store } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '.data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'platform-snapshot.json');

export interface ModulePersistenceHooks {
  getState: () => Record<string, unknown>;
  restoreState: (data: Record<string, unknown>) => void;
}

const moduleRegistry = new Map<string, ModulePersistenceHooks>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function registerModulePersistence(name: string, hooks: ModulePersistenceHooks): void {
  moduleRegistry.set(name, hooks);
}

function replaceArrayInPlace<T>(target: T[], incoming: unknown): void {
  if (!Array.isArray(incoming)) return;
  target.splice(0, target.length, ...(incoming as T[]));
}

function getCoreStoreSnapshot(): Record<string, unknown> {
  return {
    accountingUsers: store.accountingUsers,
    accountingAccounts: store.accountingAccounts,
    accountingJournals: store.accountingJournals,
    accountingFiscalYears: store.accountingFiscalYears,
    accountingEntries: store.accountingEntries,
    intranetUsers: store.intranetUsers,
    intranetChannels: store.intranetChannels,
    intranetMessages: store.intranetMessages,
    intranetForumTopics: store.intranetForumTopics,
    learnerUsers: store.learnerUsers,
    learnerCourses: store.learnerCourses,
    learnerCourseQuestions: store.learnerCourseQuestions,
    learnerLessonNotes: store.learnerLessonNotes,
    instructorUsers: store.instructorUsers,
    instructorCourses: store.instructorCourses,
    instructorEnrollments: store.instructorEnrollments,
    trainingRequests: store.trainingRequests,
    courseOrganizationSessions: store.courseOrganizationSessions,
    providerUsers: store.providerUsers,
    providerOffers: store.providerOffers,
    providerRequests: store.providerRequests,
    superadminUsers: store.superadminUsers,
    auditLogs: store.auditLogs,
    commissionRules: store.commissionRules,
    commissions: store.commissions,
    crmContacts: store.crmContacts,
    crmDocuments: store.crmDocuments,
    crmCampaigns: store.crmCampaigns,
    crmFollowUps: store.crmFollowUps,
    crmActivities: store.crmActivities,
    platformEvents: store.platformEvents,
    tasks: store.tasks,
    planningEntries: store.planningEntries,
  };
}

function restoreCoreStoreSnapshot(data: Record<string, unknown>): void {
  replaceArrayInPlace(store.accountingUsers, data.accountingUsers);
  replaceArrayInPlace(store.accountingAccounts, data.accountingAccounts);
  replaceArrayInPlace(store.accountingJournals, data.accountingJournals);
  replaceArrayInPlace(store.accountingFiscalYears, data.accountingFiscalYears);
  replaceArrayInPlace(store.accountingEntries, data.accountingEntries);
  replaceArrayInPlace(store.intranetUsers, data.intranetUsers);
  replaceArrayInPlace(store.intranetChannels, data.intranetChannels);
  replaceArrayInPlace(store.intranetMessages, data.intranetMessages);
  replaceArrayInPlace(store.intranetForumTopics, data.intranetForumTopics);
  replaceArrayInPlace(store.learnerUsers, data.learnerUsers);
  replaceArrayInPlace(store.learnerCourses, data.learnerCourses);
  replaceArrayInPlace(store.learnerCourseQuestions, data.learnerCourseQuestions);
  replaceArrayInPlace(store.learnerLessonNotes, data.learnerLessonNotes);
  replaceArrayInPlace(store.instructorUsers, data.instructorUsers);
  replaceArrayInPlace(store.instructorCourses, data.instructorCourses);
  replaceArrayInPlace(store.instructorEnrollments, data.instructorEnrollments);
  replaceArrayInPlace(store.trainingRequests, data.trainingRequests);
  replaceArrayInPlace(store.courseOrganizationSessions, data.courseOrganizationSessions);
  replaceArrayInPlace(store.providerUsers, data.providerUsers);
  replaceArrayInPlace(store.providerOffers, data.providerOffers);
  replaceArrayInPlace(store.providerRequests, data.providerRequests);
  replaceArrayInPlace(store.superadminUsers, data.superadminUsers);
  replaceArrayInPlace(store.auditLogs, data.auditLogs);
  replaceArrayInPlace(store.commissionRules, data.commissionRules);
  replaceArrayInPlace(store.commissions, data.commissions);
  replaceArrayInPlace(store.crmContacts, data.crmContacts);
  replaceArrayInPlace(store.crmDocuments, data.crmDocuments);
  replaceArrayInPlace(store.crmCampaigns, data.crmCampaigns);
  replaceArrayInPlace(store.crmFollowUps, data.crmFollowUps);
  replaceArrayInPlace(store.crmActivities, data.crmActivities);
  replaceArrayInPlace(store.platformEvents, data.platformEvents);
  replaceArrayInPlace(store.tasks, data.tasks);
  replaceArrayInPlace(store.planningEntries, data.planningEntries);
}

export function saveServerSnapshotNow(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: {
      savedAt: string;
      core: Record<string, unknown>;
      modules: Record<string, Record<string, unknown>>;
    } = {
      savedAt: new Date().toISOString(),
      core: getCoreStoreSnapshot(),
      modules: {},
    };
    for (const [name, hooks] of moduleRegistry.entries()) {
      payload.modules[name] = hooks.getState();
    }
    const tmpFile = `${SNAPSHOT_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload), 'utf8');
    fs.renameSync(tmpFile, SNAPSHOT_FILE);
  } catch (err) {
    console.warn('[Persistence] Échec sauvegarde locale:', err);
  }
}

export function scheduleServerSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveServerSnapshotNow();
  }, 350);
}

export function loadServerSnapshot(): void {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return;
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as {
      core?: Record<string, unknown>;
      modules?: Record<string, Record<string, unknown>>;
    };
    if (parsed.core) {
      restoreCoreStoreSnapshot(parsed.core);
    }
    if (parsed.modules) {
      for (const [name, hooks] of moduleRegistry.entries()) {
        if (parsed.modules[name]) {
          hooks.restoreState(parsed.modules[name]);
        }
      }
    }
    console.log('[Persistence] État applicatif restauré depuis le stockage persistant.');
  } catch (err) {
    console.warn('[Persistence] Impossible de restaurer le snapshot local:', err);
  }
}

export function attachPersistenceMiddleware(app: Express): void {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode < 400 && !req.path.includes('/auth/logout')) {
          scheduleServerSave();
        }
      });
    }
    next();
  });
}
