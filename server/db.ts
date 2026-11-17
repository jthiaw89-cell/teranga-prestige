import pg from 'pg';

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

export interface AccountingUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ACCOUNTANT' | 'READ_ONLY';
  passwordHash: string;
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
