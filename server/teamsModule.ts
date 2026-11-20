import type { Express, Request, Response } from 'express';
import type { IncomingMessage } from 'node:http';
import type http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AuthSpace,
  TeamsCollabDoc,
  TeamsConversationKind,
  TeamsConversationRecord,
  TeamsDocCategory,
  TeamsFileCategory,
  TeamsHomeworkStatus,
  TeamsMeetingMode,
  TeamsMeetingRecord,
  TeamsMessageAttachment,
  TeamsMessageRecord,
  TeamsParticipantSummary,
  TeamsPresenceStatus,
  TeamsSharedFile,
  TeamsWorkspacePayload,
} from '../src/types.js';
import { store } from './db.js';
import { registerModulePersistence } from './persistence.js';

export interface TeamsActor {
  id: string;
  space: AuthSpace;
  role: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

export interface RegisterTeamsDeps {
  server: http.Server;
  getActiveActor: (req: Request) => TeamsActor | null;
  resolveActorFromIncoming: (req: IncomingMessage) => TeamsActor | null;
  addAuditLog: (entry: {
    actorId: string;
    actorName: string;
    actorSpace: AuthSpace;
    action: string;
    target: string;
    details: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
  }) => void;
}

// --- Authoritative Server State ---

const teamsConversations: TeamsConversationRecord[] = [
  // Mirror existing intranet channels + extended Teams project / onboarding / formation / group channels
  {
    id: 'ch-general',
    kind: 'CHANNEL',
    name: 'Général',
    slug: 'general',
    topic: 'Annonces officielles et vie d’entreprise pour tout le personnel.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: false,
    memberIds: ['int-u-1', 'int-u-2', 'int-u-3', 'acc-u-1'],
    createdByUserId: 'int-u-1',
    createdByName: 'Cheikh Tidiane Fall',
    lastMessageAt: '2026-11-19T09:05:00Z',
  },
  {
    id: 'ch-direction',
    kind: 'CHANNEL',
    name: 'Direction & Gouvernance',
    slug: 'direction',
    topic: 'Pilotage stratégique, budgets et gouvernance.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: true,
    memberIds: ['int-u-1', 'acc-u-1'],
    createdByUserId: 'int-u-1',
    createdByName: 'Cheikh Tidiane Fall',
    lastMessageAt: '2026-11-18T16:00:00Z',
  },
  {
    id: 'ch-managers',
    kind: 'CHANNEL',
    name: 'Managers & Chefs de Pôle',
    slug: 'managers',
    topic: 'Coordination opérationnelle des pôles Bureau, Événementiel et Formation.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: true,
    memberIds: ['int-u-1', 'int-u-2', 'acc-u-1'],
    createdByUserId: 'int-u-1',
    createdByName: 'Cheikh Tidiane Fall',
    lastMessageAt: '2026-11-19T11:20:00Z',
  },
  {
    id: 'ch-projet-cicad',
    kind: 'PROJECT',
    name: 'Projet — Sommet CICAD Diamniadio',
    slug: 'projet-sommet-cicad',
    topic: 'Suivi à distance logistique, protocole VIP, régie et prestataires.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: false,
    memberIds: ['int-u-1', 'int-u-2', 'int-u-3', 'prov-1', 'acc-u-1'],
    createdByUserId: 'int-u-2',
    createdByName: 'Fatou Binetou Sarr',
    linkedProjectCode: 'PRJ-CICAD-2026',
    lastMessageAt: '2026-11-20T09:15:00Z',
  },
  {
    id: 'ch-onboarding',
    kind: 'ONBOARDING',
    name: 'Intégration Nouveaux Employés',
    slug: 'integration-rh',
    topic: 'Parcours d’accueil, charte SI, outils internes et parrainage.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: false,
    memberIds: ['int-u-1', 'int-u-2', 'int-u-3'],
    createdByUserId: 'int-u-1',
    createdByName: 'Cheikh Tidiane Fall',
    lastMessageAt: '2026-11-18T10:30:00Z',
  },
  {
    id: 'ch-formation-cloud',
    kind: 'FORMATION',
    name: 'Cours — Architecture Cloud & Gouvernance SI',
    slug: 'formation-cloud-si',
    topic: 'Classes à distance, partage de supports, travaux de groupe et remise de devoirs.',
    organizationId: 'global-training',
    isPrivate: false,
    memberIds: ['inst-1', 'inst-2', 'lrn-1', 'lrn-2', 'int-u-2', 'int-u-3', 'sup-1'],
    createdByUserId: 'inst-1',
    createdByName: 'Dr. Mamadou Lamine Diallo',
    linkedCourseTitle: 'Architecture Cloud Souverain & Gouvernance SI',
    lastMessageAt: '2026-11-20T08:40:00Z',
  },
  {
    id: 'grp-eval-projet',
    kind: 'GROUP',
    name: 'Groupe Projet — Protocole & Finance',
    slug: 'groupe-protocole-finance',
    topic: 'Discussion de groupe directe Direction / Pôle Événementiel / DAF.',
    organizationId: 'tpd-demo-intranet',
    isPrivate: true,
    memberIds: ['int-u-1', 'int-u-2', 'acc-u-1'],
    createdByUserId: 'int-u-2',
    createdByName: 'Fatou Binetou Sarr',
    lastMessageAt: '2026-11-19T15:10:00Z',
  },
  {
    id: 'dm-int-u-2-int-u-3',
    kind: 'DM',
    name: 'Fatou Binetou Sarr ↔ Moussa Ndiaye',
    slug: 'dm-fatou-moussa',
    topic: 'Échange privé direct',
    organizationId: 'tpd-demo-intranet',
    isPrivate: true,
    memberIds: ['int-u-2', 'int-u-3'],
    createdByUserId: 'int-u-2',
    createdByName: 'Fatou Binetou Sarr',
    lastMessageAt: '2026-11-20T09:00:00Z',
  },
];

const teamsMessages: TeamsMessageRecord[] = [
  // Mirror initial messages from store.intranetMessages + rich Teams messages
  ...store.intranetMessages.map((m) => ({
    id: m.id,
    conversationId: m.channelId,
    senderId: m.senderId,
    senderName: m.senderName,
    senderRole: m.senderRole,
    content: m.content,
    attachment: m.attachment,
    reactions: [{ emoji: '👍', userIds: ['int-u-2'] }],
    createdAt: m.createdAt,
  })),
  {
    id: 'tmsg-101',
    conversationId: 'ch-projet-cicad',
    senderId: 'int-u-2',
    senderName: 'Fatou Binetou Sarr',
    senderRole: 'MANAGER',
    content:
      'Bonjour l’équipe ! Le conducteur minute par minute du Sommet CICAD est ouvert en coédition dans l’onglet Documents collaboratifs.',
    linkedDocId: 'tdoc-1',
    linkedDocTitle: 'Conducteur Officiel & Logistique — Sommet CICAD',
    reactions: [{ emoji: '🚀', userIds: ['int-u-1', 'int-u-3'] }],
    createdAt: '2026-11-20T08:50:00Z',
  },
  {
    id: 'tmsg-102',
    conversationId: 'ch-projet-cicad',
    senderId: 'int-u-3',
    senderName: 'Moussa Ndiaye',
    senderRole: 'EMPLOYEE',
    content:
      'Bien reçu ! J’ai mis à jour la section matériel régie et ajouté les références des 3 kits audio testés.',
    replyToId: 'tmsg-101',
    replyToPreview: 'Le conducteur minute par minute du Sommet CICAD est ouvert...',
    reactions: [{ emoji: '✅', userIds: ['int-u-2'] }],
    createdAt: '2026-11-20T09:15:00Z',
  },
  {
    id: 'tmsg-103',
    conversationId: 'ch-onboarding',
    senderId: 'int-u-1',
    senderName: 'Cheikh Tidiane Fall',
    senderRole: 'OWNER',
    content:
      'Bienvenue aux nouveaux collaborateurs ! Retrouvez le guide d’intégration et la checklist SI dans les fichiers partagés du canal.',
    linkedDocId: 'tdoc-2',
    linkedDocTitle: 'Livret d’Accueil & Checklist Intégration J1–J30',
    reactions: [{ emoji: '👏', userIds: ['int-u-2', 'int-u-3'] }],
    createdAt: '2026-11-18T10:30:00Z',
  },
  {
    id: 'tmsg-104',
    conversationId: 'ch-formation-cloud',
    senderId: 'inst-1',
    senderName: 'Dr. Mamadou Lamine Diallo',
    senderRole: 'INSTRUCTOR',
    content:
      'Session visio de ce matin prête. Merci aux groupes de déposer le devoir d’architecture avant 18h dans l’espace Coédition / Devoirs.',
    linkedDocId: 'tdoc-3',
    linkedDocTitle: 'Devoir Groupe A — Plan PRA & Souveraineté Données',
    reactions: [{ emoji: '📘', userIds: ['lrn-1'] }],
    createdAt: '2026-11-20T08:40:00Z',
  },
  {
    id: 'tmsg-105',
    conversationId: 'dm-int-u-2-int-u-3',
    senderId: 'int-u-2',
    senderName: 'Fatou Binetou Sarr',
    senderRole: 'MANAGER',
    content: 'Moussa, on fait un appel vidéo rapide de 5 min pour caler le chargement SUV de demain ?',
    reactions: [],
    createdAt: '2026-11-20T09:00:00Z',
  },
];

const teamsMeetings: TeamsMeetingRecord[] = [
  {
    id: 'tmtg-1',
    conversationId: 'ch-projet-cicad',
    conversationName: 'Projet — Sommet CICAD Diamniadio',
    title: 'Point Hebdo Régie & Protocole VIP',
    mode: 'REUNION_PROJET',
    status: 'EN_COURS',
    hostUserId: 'int-u-2',
    hostName: 'Fatou Binetou Sarr',
    scheduledAt: '2026-11-20T09:30:00Z',
    startedAt: '2026-11-20T09:30:00Z',
    activeParticipantIds: ['int-u-2'],
    activeParticipantNames: ['Fatou Binetou Sarr'],
    isRecording: false,
    recordings: [
      {
        id: 'trec-1',
        meetingId: 'tmtg-prev-1',
        conversationId: 'ch-projet-cicad',
        title: 'Revue Scénographie CICAD — Session #1',
        durationSeconds: 1840,
        recordedByName: 'Fatou Binetou Sarr',
        sizeBytes: 14_250_000,
        mimeType: 'video/webm',
        createdAt: '2026-11-18T16:15:00Z',
      },
    ],
    notesSummary: 'Validation implantations salles plénières + coordination navettes VIP.',
  },
  {
    id: 'tmtg-2',
    conversationId: 'ch-formation-cloud',
    conversationName: 'Cours — Architecture Cloud & Gouvernance SI',
    title: 'Classe Virtuelle — Module 3 : Haute Disponibilité & PRA',
    mode: 'COURS_DISTANT',
    status: 'PLANIFIEE',
    hostUserId: 'inst-1',
    hostName: 'Dr. Mamadou Lamine Diallo',
    scheduledAt: '2026-11-20T14:00:00Z',
    activeParticipantIds: [],
    activeParticipantNames: [],
    isRecording: false,
    recordings: [
      {
        id: 'trec-2',
        meetingId: 'tmtg-prev-2',
        conversationId: 'ch-formation-cloud',
        title: 'Cours Module 2 — Replay Architecture Multi-Zone',
        durationSeconds: 3420,
        recordedByName: 'Dr. Mamadou Lamine Diallo',
        sizeBytes: 28_900_000,
        mimeType: 'video/webm',
        createdAt: '2026-11-17T12:00:00Z',
      },
    ],
    notesSummary: 'Cours synchrone avec partage d’écran schéma réseau et séance Q/R.',
  },
];

const teamsCollabDocs: TeamsCollabDoc[] = [
  {
    id: 'tdoc-1',
    conversationId: 'ch-projet-cicad',
    title: 'Conducteur Officiel & Logistique — Sommet CICAD',
    category: 'PROJET',
    content: `# Conducteur Sommet CICAD Diamniadio\n\n## 1. Horaires clés Jour J\n- 07h30 : Ouverture régie audio/vidéo et test micros VIP\n- 08h30 : Accueil délégations et remise badges QR\n- 09h30 : Cérémonie d'ouverture plénière\n\n## 2. Responsabilités\n- Protocole & Scénographie : Fatou Binetou Sarr\n- Logistique & Kits Régie : Moussa Ndiaye\n- Budget & Engagement : Amadou Konté`,
    createdByUserId: 'int-u-2',
    createdByName: 'Fatou Binetou Sarr',
    lastEditedByUserId: 'int-u-3',
    lastEditedByName: 'Moussa Ndiaye',
    activeEditorNames: [],
    versions: [
      {
        id: 'ver-1',
        editorName: 'Fatou Binetou Sarr',
        summary: 'Structure initiale conducteur',
        contentSnapshot: '# Conducteur Sommet CICAD Diamniadio',
        savedAt: '2026-11-19T14:00:00Z',
      },
    ],
    createdAt: '2026-11-19T14:00:00Z',
    updatedAt: '2026-11-20T09:14:00Z',
  },
  {
    id: 'tdoc-2',
    conversationId: 'ch-onboarding',
    title: 'Livret d’Accueil & Checklist Intégration J1–J30',
    category: 'ONBOARDING',
    content: `# Parcours d’Intégration Collaborateur\n\n- [x] Activation compte Intranet, GED et Planning partagé\n- [x] Remise badge d’accès et dotation poste de travail\n- [ ] Lecture des notes de service et charte sécurité\n- [ ] Point d’étape Manager à J+15`,
    createdByUserId: 'int-u-1',
    createdByName: 'Cheikh Tidiane Fall',
    lastEditedByUserId: 'int-u-1',
    lastEditedByName: 'Cheikh Tidiane Fall',
    activeEditorNames: [],
    versions: [],
    createdAt: '2026-11-15T09:00:00Z',
    updatedAt: '2026-11-18T10:30:00Z',
  },
  {
    id: 'tdoc-3',
    conversationId: 'ch-formation-cloud',
    title: 'Devoir Groupe A — Plan PRA & Souveraineté Données',
    category: 'DEVOIR_GROUPE',
    content: `# Devoir de Groupe — Architecture PRA Sénégal\n\n## Objectif\nDéfinir un plan de reprise d'activité (RTO < 2h, RPO < 15 min) pour un portail administratif national.\n\n## Travail du groupe\n1. Réplication asynchrone PostgreSQL vers site secondaire Diamniadio.\n2. Chiffrement KMS local et journalisation immuable.\n3. Tests trimestriels de bascule documentés.`,
    createdByUserId: 'lrn-1',
    createdByName: 'Awa Diagne',
    lastEditedByUserId: 'lrn-1',
    lastEditedByName: 'Awa Diagne',
    activeEditorNames: [],
    homeworkStatus: 'RENDU',
    versions: [],
    createdAt: '2026-11-18T15:00:00Z',
    updatedAt: '2026-11-19T19:40:00Z',
  },
];

const teamsSharedFiles: TeamsSharedFile[] = [
  {
    id: 'tfile-1',
    conversationId: 'ch-projet-cicad',
    filename: 'Plan_Implantation_CICAD_v3.txt',
    mimeType: 'text/plain',
    sizeBytes: 18420,
    dataUrl: 'data:text/plain;charset=utf-8,Plan%20d%27implantation%20CICAD%20Diamniadio%20-%20Salles%20A%2C%20B%2C%20C',
    category: 'DOCUMENT',
    uploadedByUserId: 'int-u-2',
    uploadedByName: 'Fatou Binetou Sarr',
    createdAt: '2026-11-19T10:20:00Z',
  },
  {
    id: 'tfile-2',
    conversationId: 'ch-formation-cloud',
    filename: 'Support_Cours_Module3_PRA.txt',
    mimeType: 'text/plain',
    sizeBytes: 42100,
    dataUrl: 'data:text/plain;charset=utf-8,Support%20de%20cours%20Module%203%20-%20Haute%20Disponibilite%20%26%20PRA',
    category: 'SUPPORT_COURS',
    uploadedByUserId: 'inst-1',
    uploadedByName: 'Dr. Mamadou Lamine Diallo',
    createdAt: '2026-11-19T08:00:00Z',
  },
  {
    id: 'tfile-3',
    conversationId: 'ch-formation-cloud',
    filename: 'Devoir_GroupeA_Awa_Diagne.txt',
    mimeType: 'text/plain',
    sizeBytes: 15200,
    dataUrl: 'data:text/plain;charset=utf-8,Rendu%20Devoir%20Groupe%20A%20-%20Plan%20PRA',
    category: 'DEVOIR',
    uploadedByUserId: 'lrn-1',
    uploadedByName: 'Awa Diagne',
    homeworkStatus: 'RENDU',
    createdAt: '2026-11-19T19:45:00Z',
  },
];

export function registerTeamsModule(app: Express, deps: RegisterTeamsDeps): void {
  const { server, getActiveActor, resolveActorFromIncoming, addAuditLog } = deps;

  // WebSocket client registry & presence tracking
  const socketsByUser = new Map<string, Set<WebSocket>>();
  const socketMeta = new WeakMap<WebSocket, { actor: TeamsActor; openDocId?: string }>();
  const customPresence = new Map<string, TeamsPresenceStatus>();

  function getDirectoryParticipants(): TeamsParticipantSummary[] {
    const getLivePresence = (userId: string): TeamsPresenceStatus => {
      const manual = customPresence.get(userId);
      if (manual) return manual;
      const inMeeting = teamsMeetings.some(
        (m) => m.status === 'EN_COURS' && m.activeParticipantIds.includes(userId),
      );
      if (inMeeting) return 'IN_MEETING';
      if ((socketsByUser.get(userId)?.size || 0) > 0) return 'ONLINE';
      // Demo colleagues active by default when seeded or recently logged
      return ['int-u-1', 'int-u-2', 'int-u-3', 'acc-u-1', 'inst-1', 'lrn-1'].includes(userId)
        ? 'ONLINE'
        : 'OFFLINE';
    };

    return [
      ...store.intranetUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        space: 'intranet' as const,
        title: u.title,
        organizationName: u.organizationName,
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
      ...store.accountingUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        space: 'accounting' as const,
        title: u.role === 'ACCOUNTANT' ? 'Directeur Financier' : 'Direction / Audit',
        organizationName: u.organizationName,
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
      ...store.instructorUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: 'INSTRUCTOR',
        space: 'instructor' as const,
        title: u.specialty,
        organizationName: `Formateur · ${u.city}`,
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
      ...store.learnerUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: 'LEARNER',
        space: 'learner' as const,
        title: u.jobTitle,
        organizationName: u.companyName,
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
      ...store.providerUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: 'PROVIDER',
        space: 'provider' as const,
        title: u.roleTitle,
        organizationName: u.companyName,
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
      ...store.superadminUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        space: 'superadmin' as const,
        title: u.title,
        organizationName: 'Administration Plateforme',
        avatarUrl: u.avatarUrl,
        presence: getLivePresence(u.id),
      })),
    ];
  }

  function syncChannelsFromIntranetStore(): void {
    for (const ch of store.intranetChannels) {
      if (!teamsConversations.some((c) => c.id === ch.id)) {
        teamsConversations.push({
          id: ch.id,
          kind: 'CHANNEL',
          name: ch.name,
          slug: ch.slug,
          topic: ch.description,
          organizationId: ch.organizationId,
          isPrivate: ch.isPrivate,
          memberIds: [...ch.memberIds],
          createdByUserId: ch.memberIds[0] || 'int-u-1',
          createdByName: 'Organisation',
        });
      }
    }
    for (const m of store.intranetMessages) {
      if (!teamsMessages.some((tm) => tm.id === m.id)) {
        teamsMessages.push({
          id: m.id,
          conversationId: m.channelId,
          senderId: m.senderId,
          senderName: m.senderName,
          senderRole: m.senderRole,
          content: m.content,
          attachment: m.attachment,
          reactions: [],
          createdAt: m.createdAt,
        });
      }
    }
  }

  function canAccessConversation(actor: TeamsActor, conv: TeamsConversationRecord): boolean {
    if (actor.space === 'superadmin') return true;
    if (conv.memberIds.includes(actor.id)) return true;
    if (conv.kind === 'DM' || conv.kind === 'GROUP') return false;
    if (!conv.isPrivate) {
      if (conv.kind === 'FORMATION') return true;
      if (actor.space === 'intranet' && conv.organizationId === actor.organizationId) return true;
      if (actor.space === 'accounting' && conv.organizationId === 'tpd-demo-intranet') return true;
    }
    return false;
  }

  function broadcastToUsers(userIds: string[] | 'ALL', eventType: string, payload: unknown, excludeUserId?: string): void {
    const serialized = JSON.stringify({ type: eventType, payload, timestamp: new Date().toISOString() });
    const targetIds = userIds === 'ALL' ? Array.from(socketsByUser.keys()) : userIds;
    for (const uid of targetIds) {
      if (excludeUserId && uid === excludeUserId) continue;
      const set = socketsByUser.get(uid);
      if (!set) continue;
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(serialized);
        }
      }
    }
  }

  function broadcastToConversation(conv: TeamsConversationRecord, eventType: string, payload: unknown, excludeUserId?: string): void {
    if (!conv.isPrivate && (conv.kind === 'FORMATION' || conv.kind === 'CHANNEL' || conv.kind === 'PROJECT' || conv.kind === 'ONBOARDING')) {
      const allConnectedUsers = Array.from(socketsByUser.keys());
      const authorized = allConnectedUsers.filter((uid) => {
        const set = socketsByUser.get(uid);
        if (!set || set.size === 0) return false;
        const firstWs = set.values().next().value as WebSocket | undefined;
        const meta = firstWs ? socketMeta.get(firstWs) : undefined;
        return meta ? canAccessConversation(meta.actor, conv) : conv.memberIds.includes(uid);
      });
      broadcastToUsers(authorized, eventType, payload, excludeUserId);
      return;
    }
    broadcastToUsers(conv.memberIds, eventType, payload, excludeUserId);
  }

  // --- WebSocket Server on /ws/teams ---
  const wss = new WebSocketServer({ server, path: '/ws/teams' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const actor = resolveActorFromIncoming(req);
    if (!actor) {
      ws.close(4001, 'Authentification requise');
      return;
    }

    let userSet = socketsByUser.get(actor.id);
    if (!userSet) {
      userSet = new Set();
      socketsByUser.set(actor.id, userSet);
    }
    userSet.add(ws);
    socketMeta.set(ws, { actor });

    ws.send(
      JSON.stringify({
        type: 'teams:connected',
        payload: { userId: actor.id, name: actor.name },
      }),
    );

    broadcastToUsers('ALL', 'presence:update', {
      userId: actor.id,
      presence: customPresence.get(actor.id) || 'ONLINE',
    });

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw)) as { type?: string; payload?: Record<string, unknown> };
        const p = parsed.payload || {};

        if (parsed.type === 'typing:update') {
          const conversationId = String(p.conversationId || '');
          const conv = teamsConversations.find((c) => c.id === conversationId);
          if (conv && canAccessConversation(actor, conv)) {
            broadcastToConversation(
              conv,
              'typing:update',
              {
                conversationId,
                userId: actor.id,
                userName: actor.name,
                isTyping: Boolean(p.isTyping),
              },
              actor.id,
            );
          }
        } else if (parsed.type === 'presence:set') {
          const next = p.presence as TeamsPresenceStatus;
          if (['ONLINE', 'IN_MEETING', 'BUSY', 'OFFLINE'].includes(next)) {
            customPresence.set(actor.id, next);
            broadcastToUsers('ALL', 'presence:update', { userId: actor.id, presence: next });
          }
        } else if (parsed.type === 'doc:update') {
          const docId = String(p.docId || '');
          const doc = teamsCollabDocs.find((d) => d.id === docId);
          if (!doc) return;
          const conv = teamsConversations.find((c) => c.id === doc.conversationId);
          if (!conv || !canAccessConversation(actor, conv)) return;

          if (typeof p.content === 'string') {
            doc.content = p.content;
            doc.lastEditedByUserId = actor.id;
            doc.lastEditedByName = actor.name;
            doc.updatedAt = new Date().toISOString();
          }
          if (!doc.activeEditorNames.includes(actor.name)) {
            doc.activeEditorNames.push(actor.name);
          }
          const meta = socketMeta.get(ws);
          if (meta) meta.openDocId = docId;

          broadcastToConversation(
            conv,
            'doc:updated',
            { doc, editorUserId: actor.id },
            actor.id,
          );
        } else if (parsed.type === 'doc:leave') {
          const docId = String(p.docId || '');
          const doc = teamsCollabDocs.find((d) => d.id === docId);
          if (doc) {
            doc.activeEditorNames = doc.activeEditorNames.filter((n) => n !== actor.name);
            const conv = teamsConversations.find((c) => c.id === doc.conversationId);
            if (conv) {
              broadcastToConversation(conv, 'doc:updated', { doc, editorUserId: actor.id });
            }
          }
        } else if (parsed.type === 'rtc:signal') {
          const meetingId = String(p.meetingId || '');
          const targetUserId = p.targetUserId ? String(p.targetUserId) : undefined;
          const meeting = teamsMeetings.find((m) => m.id === meetingId);
          if (!meeting) return;
          const conv = teamsConversations.find((c) => c.id === meeting.conversationId);
          if (!conv || !canAccessConversation(actor, conv)) return;

          const signalPayload = {
            meetingId,
            conversationId: meeting.conversationId,
            fromUserId: actor.id,
            fromUserName: actor.name,
            signalType: p.signalType,
            data: p.data,
          };

          if (targetUserId) {
            broadcastToUsers([targetUserId], 'rtc:signal', signalPayload);
          } else {
            broadcastToConversation(conv, 'rtc:signal', signalPayload, actor.id);
          }
        }
      } catch {
        // ignore malformed frame
      }
    });

    ws.on('close', () => {
      const meta = socketMeta.get(ws);
      if (meta?.openDocId) {
        const doc = teamsCollabDocs.find((d) => d.id === meta.openDocId);
        if (doc) {
          doc.activeEditorNames = doc.activeEditorNames.filter((n) => n !== actor.name);
          const conv = teamsConversations.find((c) => c.id === doc.conversationId);
          if (conv) broadcastToConversation(conv, 'doc:updated', { doc });
        }
      }
      const set = socketsByUser.get(actor.id);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          socketsByUser.delete(actor.id);
          broadcastToUsers('ALL', 'presence:update', {
            userId: actor.id,
            presence: customPresence.get(actor.id) || 'ONLINE',
          });
        }
      }
    });
  });

  function buildTeamsWorkspace(actor: TeamsActor): TeamsWorkspacePayload {
    syncChannelsFromIntranetStore();

    const directory = getDirectoryParticipants();
    const currentUser: TeamsParticipantSummary = directory.find((d) => d.userId === actor.id) || {
      userId: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      space: actor.space,
      title: actor.role,
      organizationName: actor.organizationName,
      presence: 'ONLINE',
    };

    const visibleConversations = teamsConversations.filter((c) => canAccessConversation(actor, c));
    const visibleConvIds = new Set(visibleConversations.map((c) => c.id));

    const visibleMessages = teamsMessages.filter((m) => visibleConvIds.has(m.conversationId));
    const visibleMeetings = teamsMeetings.filter((m) => visibleConvIds.has(m.conversationId));
    const visibleDocs = teamsCollabDocs.filter((d) => visibleConvIds.has(d.conversationId));
    const visibleFiles = teamsSharedFiles.filter((f) => visibleConvIds.has(f.conversationId));

    return {
      currentUser,
      conversations: visibleConversations,
      messages: visibleMessages,
      meetings: visibleMeetings,
      collabDocs: visibleDocs,
      sharedFiles: visibleFiles,
      directory,
      stats: {
        conversationsCount: visibleConversations.length,
        unreadTotal: visibleConversations.reduce((s, c) => s + (c.unreadCount || 0), 0),
        liveMeetingsCount: visibleMeetings.filter((m) => m.status === 'EN_COURS').length,
        collabDocsCount: visibleDocs.length,
        sharedFilesCount: visibleFiles.length,
        onlineUsersCount: directory.filter((d) => d.presence === 'ONLINE' || d.presence === 'IN_MEETING').length,
      },
    };
  }

  // --- REST API Routes ---

  app.get('/api/teams/workspace', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    return res.json(buildTeamsWorkspace(actor));
  });

  app.post('/api/teams/conversations', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      kind?: TeamsConversationKind;
      name?: string;
      topic?: string;
      isPrivate?: boolean;
      memberIds?: string[];
      linkedCourseTitle?: string;
      linkedProjectCode?: string;
    };

    const kind: TeamsConversationKind = body.kind || 'CHANNEL';
    const rawMembers = Array.isArray(body.memberIds) ? body.memberIds.filter(Boolean) : [];
    const uniqueMembers = Array.from(new Set([actor.id, ...rawMembers]));

    // Reuse existing 1-to-1 DM if already created
    if (kind === 'DM' && uniqueMembers.length === 2) {
      const existingDm = teamsConversations.find(
        (c) =>
          c.kind === 'DM' &&
          c.memberIds.length === 2 &&
          uniqueMembers.every((uid) => c.memberIds.includes(uid)),
      );
      if (existingDm) {
        return res.status(200).json({ conversation: existingDm, ...buildTeamsWorkspace(actor) });
      }
    }

    const dir = getDirectoryParticipants();
    let resolvedName = body.name?.trim() || '';
    if (kind === 'DM' && !resolvedName) {
      const otherId = uniqueMembers.find((uid) => uid !== actor.id);
      const other = dir.find((d) => d.userId === otherId);
      resolvedName = other ? `${actor.name} ↔ ${other.name}` : 'Discussion privée';
    } else if (kind === 'GROUP' && !resolvedName) {
      const names = uniqueMembers
        .map((uid) => dir.find((d) => d.userId === uid)?.name.split(' ')[0])
        .filter(Boolean);
      resolvedName = `Groupe (${names.slice(0, 3).join(', ')})`;
    }

    if (!resolvedName) {
      return res.status(400).json({ error: 'Nom du canal ou destinataire requis.' });
    }

    const slug = resolvedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `conv-${Date.now()}`;

    const isPrivate = kind === 'DM' || kind === 'GROUP' ? true : Boolean(body.isPrivate);
    const created: TeamsConversationRecord = {
      id: `${kind.toLowerCase()}-${Date.now()}`,
      kind,
      name: resolvedName,
      slug,
      topic: body.topic?.trim() || undefined,
      organizationId: kind === 'FORMATION' ? 'global-training' : actor.organizationId || 'tpd-demo-intranet',
      isPrivate,
      memberIds: uniqueMembers,
      createdByUserId: actor.id,
      createdByName: actor.name,
      linkedCourseTitle: body.linkedCourseTitle?.trim() || undefined,
      linkedProjectCode: body.linkedProjectCode?.trim() || undefined,
      lastMessageAt: new Date().toISOString(),
    };

    teamsConversations.push(created);

    // Sync non-DM/non-GROUP intranet channels for backward compatibility
    if (actor.space === 'intranet' && (kind === 'CHANNEL' || kind === 'PROJECT' || kind === 'ONBOARDING')) {
      store.intranetChannels.push({
        id: created.id,
        organizationId: created.organizationId,
        name: created.name,
        slug: created.slug,
        description: created.topic || created.name,
        isPrivate: created.isPrivate,
        memberIds: [...created.memberIds],
      });
    }

    broadcastToConversation(created, 'conversation:created', { conversation: created });

    return res.status(201).json({ conversation: created, ...buildTeamsWorkspace(actor) });
  });

  app.post('/api/teams/messages', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      conversationId?: string;
      content?: string;
      replyToId?: string;
      attachment?: TeamsMessageAttachment;
      linkedDocId?: string;
      linkedDocTitle?: string;
    };

    if (!body.conversationId || (!body.content?.trim() && !body.attachment && !body.linkedDocId)) {
      return res.status(400).json({ error: 'Canal et message requis.' });
    }

    const conv = teamsConversations.find((c) => c.id === body.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé à cette conversation.' });
    }

    if (body.attachment && body.attachment.sizeBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 5 Mo).' });
    }

    const dir = getDirectoryParticipants();
    const selfProfile = dir.find((d) => d.userId === actor.id);
    const replyTarget = body.replyToId ? teamsMessages.find((m) => m.id === body.replyToId) : undefined;
    const nowIso = new Date().toISOString();

    const msg: TeamsMessageRecord = {
      id: `tmsg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      conversationId: conv.id,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: actor.role,
      senderAvatarUrl: selfProfile?.avatarUrl,
      content: (body.content || '').trim(),
      replyToId: replyTarget?.id,
      replyToPreview: replyTarget ? (replyTarget.content || replyTarget.attachment?.filename || '').slice(0, 80) : undefined,
      attachment: body.attachment,
      linkedDocId: body.linkedDocId,
      linkedDocTitle: body.linkedDocTitle,
      reactions: [],
      createdAt: nowIso,
    };

    teamsMessages.push(msg);
    conv.lastMessageAt = nowIso;

    // Also store attachment in TeamsSharedFile library
    if (body.attachment) {
      const fileRec: TeamsSharedFile = {
        id: body.attachment.id || `tfile-${Date.now()}`,
        conversationId: conv.id,
        filename: body.attachment.filename,
        mimeType: body.attachment.mimeType,
        sizeBytes: body.attachment.sizeBytes,
        dataUrl: body.attachment.dataUrl,
        category: body.attachment.mimeType.startsWith('image/')
          ? 'IMAGE'
          : conv.kind === 'FORMATION'
            ? 'DEVOIR'
            : 'DOCUMENT',
        uploadedByUserId: actor.id,
        uploadedByName: actor.name,
        homeworkStatus: conv.kind === 'FORMATION' && actor.space === 'learner' ? 'RENDU' : undefined,
        createdAt: nowIso,
      };
      teamsSharedFiles.unshift(fileRec);
      broadcastToConversation(conv, 'file:uploaded', { file: fileRec });
    }

    // Mirror into legacy store.intranetMessages if channel exists there
    if (store.intranetChannels.some((ch) => ch.id === conv.id)) {
      store.intranetMessages.push({
        id: msg.id,
        organizationId: conv.organizationId,
        channelId: conv.id,
        senderId: actor.id,
        senderName: actor.name,
        senderRole: actor.role,
        content: msg.content,
        attachment: msg.attachment,
        createdAt: msg.createdAt,
      });
    }

    broadcastToConversation(conv, 'message:created', { message: msg });

    return res.status(201).json({ message: msg, ...buildTeamsWorkspace(actor) });
  });

  app.post('/api/teams/messages/:id/react', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const msg = teamsMessages.find((m) => m.id === req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message introuvable.' });

    const conv = teamsConversations.find((c) => c.id === msg.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const emoji = String((req.body as { emoji?: string }).emoji || '').trim();
    if (!emoji) return res.status(400).json({ error: 'Emoji requis.' });

    let reaction = msg.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, userIds: [actor.id] };
      msg.reactions.push(reaction);
    } else if (reaction.userIds.includes(actor.id)) {
      reaction.userIds = reaction.userIds.filter((uid) => uid !== actor.id);
      if (reaction.userIds.length === 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
      }
    } else {
      reaction.userIds.push(actor.id);
    }

    broadcastToConversation(conv, 'message:reacted', { message: msg });
    return res.json({ message: msg });
  });

  app.post('/api/teams/meetings', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      conversationId?: string;
      title?: string;
      mode?: TeamsMeetingMode;
      scheduledAt?: string;
      startImmediately?: boolean;
      notesSummary?: string;
    };

    if (!body.conversationId) {
      return res.status(400).json({ error: 'Conversation requise.' });
    }

    const conv = teamsConversations.find((c) => c.id === body.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const nowIso = new Date().toISOString();
    const startImmediately = body.startImmediately !== false;
    const mode: TeamsMeetingMode = body.mode || 'VIDEO';
    const title =
      body.title?.trim() ||
      (mode === 'AUDIO'
        ? `Appel audio · ${conv.name}`
        : mode === 'COURS_DISTANT'
          ? `Cours en direct · ${conv.name}`
          : `Visioconférence · ${conv.name}`);

    const meeting: TeamsMeetingRecord = {
      id: `tmtg-${Date.now()}`,
      conversationId: conv.id,
      conversationName: conv.name,
      title,
      mode,
      status: startImmediately ? 'EN_COURS' : 'PLANIFIEE',
      hostUserId: actor.id,
      hostName: actor.name,
      scheduledAt: body.scheduledAt || nowIso,
      startedAt: startImmediately ? nowIso : undefined,
      activeParticipantIds: startImmediately ? [actor.id] : [],
      activeParticipantNames: startImmediately ? [actor.name] : [],
      isRecording: false,
      recordings: [],
      notesSummary: body.notesSummary?.trim() || undefined,
    };

    teamsMeetings.unshift(meeting);

    // Post system-style meeting card into chat
    const sysMsg: TeamsMessageRecord = {
      id: `tmsg-mtg-${Date.now()}`,
      conversationId: conv.id,
      senderId: actor.id,
      senderName: actor.name,
      senderRole: actor.role,
      content: `${startImmediately ? '📞 Réunion démarrée' : '📅 Réunion planifiée'} : ${meeting.title}`,
      reactions: [],
      createdAt: nowIso,
    };
    teamsMessages.push(sysMsg);
    conv.lastMessageAt = nowIso;

    broadcastToConversation(conv, 'meeting:updated', { meeting });
    broadcastToConversation(conv, 'message:created', { message: sysMsg });

    addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'TEAMS_MEETING_CREATED',
      target: meeting.id,
      details: `${meeting.mode} · ${meeting.title}`,
      severity: 'INFO',
    });

    return res.status(201).json({ meeting, ...buildTeamsWorkspace(actor) });
  });

  app.patch('/api/teams/meetings/:id/state', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const meeting = teamsMeetings.find((m) => m.id === req.params.id);
    if (!meeting) return res.status(404).json({ error: 'Réunion introuvable.' });

    const conv = teamsConversations.find((c) => c.id === meeting.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const body = req.body as {
      action:
        | 'JOIN'
        | 'LEAVE'
        | 'START_SCREEN'
        | 'STOP_SCREEN'
        | 'START_RECORDING'
        | 'STOP_RECORDING'
        | 'END';
      recordingDurationSeconds?: number;
      recordingSizeBytes?: number;
      recordingDataUrl?: string;
      notesSummary?: string;
    };

    const nowIso = new Date().toISOString();

    if (body.action === 'JOIN') {
      meeting.status = 'EN_COURS';
      if (!meeting.startedAt) meeting.startedAt = nowIso;
      if (!meeting.activeParticipantIds.includes(actor.id)) {
        meeting.activeParticipantIds.push(actor.id);
        meeting.activeParticipantNames.push(actor.name);
      }
      customPresence.set(actor.id, 'IN_MEETING');
      broadcastToUsers('ALL', 'presence:update', { userId: actor.id, presence: 'IN_MEETING' });
    } else if (body.action === 'LEAVE') {
      meeting.activeParticipantIds = meeting.activeParticipantIds.filter((id) => id !== actor.id);
      meeting.activeParticipantNames = meeting.activeParticipantNames.filter((n) => n !== actor.name);
      if (meeting.screenSharingUserId === actor.id) {
        meeting.screenSharingUserId = undefined;
        meeting.screenSharingUserName = undefined;
      }
      customPresence.set(actor.id, 'ONLINE');
      broadcastToUsers('ALL', 'presence:update', { userId: actor.id, presence: 'ONLINE' });
    } else if (body.action === 'START_SCREEN') {
      meeting.screenSharingUserId = actor.id;
      meeting.screenSharingUserName = actor.name;
    } else if (body.action === 'STOP_SCREEN') {
      meeting.screenSharingUserId = undefined;
      meeting.screenSharingUserName = undefined;
    } else if (body.action === 'START_RECORDING') {
      meeting.isRecording = true;
      meeting.recordingStartedBy = actor.name;
    } else if (body.action === 'STOP_RECORDING') {
      meeting.isRecording = false;
      meeting.recordingStartedBy = undefined;
      const rec = {
        id: `trec-${Date.now()}`,
        meetingId: meeting.id,
        conversationId: meeting.conversationId,
        title: `${meeting.title} — Enregistrement`,
        durationSeconds: Math.max(1, Math.round(Number(body.recordingDurationSeconds) || 12)),
        recordedByName: actor.name,
        sizeBytes: Math.max(1024, Math.round(Number(body.recordingSizeBytes) || 64000)),
        mimeType: 'video/webm',
        dataUrl: body.recordingDataUrl,
        createdAt: nowIso,
      };
      meeting.recordings.unshift(rec);

      if (body.recordingDataUrl) {
        const recFile: TeamsSharedFile = {
          id: `tfile-rec-${Date.now()}`,
          conversationId: meeting.conversationId,
          filename: `${meeting.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.webm`,
          mimeType: 'video/webm',
          sizeBytes: rec.sizeBytes,
          dataUrl: body.recordingDataUrl,
          category: 'ENREGISTREMENT',
          uploadedByUserId: actor.id,
          uploadedByName: actor.name,
          createdAt: nowIso,
        };
        teamsSharedFiles.unshift(recFile);
        broadcastToConversation(conv, 'file:uploaded', { file: recFile });
      }
    } else if (body.action === 'END') {
      meeting.status = 'TERMINEE';
      meeting.endedAt = nowIso;
      meeting.isRecording = false;
      meeting.screenSharingUserId = undefined;
      meeting.screenSharingUserName = undefined;
      for (const uid of meeting.activeParticipantIds) {
        customPresence.set(uid, 'ONLINE');
        broadcastToUsers('ALL', 'presence:update', { userId: uid, presence: 'ONLINE' });
      }
      meeting.activeParticipantIds = [];
      meeting.activeParticipantNames = [];
      if (body.notesSummary?.trim()) {
        meeting.notesSummary = body.notesSummary.trim();
      }
    }

    broadcastToConversation(conv, 'meeting:updated', { meeting });
    return res.json({ meeting, ...buildTeamsWorkspace(actor) });
  });

  app.post('/api/teams/docs', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      conversationId?: string;
      title?: string;
      category?: TeamsDocCategory;
      content?: string;
    };

    if (!body.conversationId || !body.title?.trim()) {
      return res.status(400).json({ error: 'Canal et titre du document requis.' });
    }

    const conv = teamsConversations.find((c) => c.id === body.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const nowIso = new Date().toISOString();
    const category: TeamsDocCategory = body.category || (conv.kind === 'FORMATION' ? 'DEVOIR_GROUPE' : 'PROJET');
    const doc: TeamsCollabDoc = {
      id: `tdoc-${Date.now()}`,
      conversationId: conv.id,
      title: body.title.trim(),
      category,
      content: body.content?.trim() || `# ${body.title.trim()}\n\n`,
      createdByUserId: actor.id,
      createdByName: actor.name,
      lastEditedByUserId: actor.id,
      lastEditedByName: actor.name,
      activeEditorNames: [actor.name],
      homeworkStatus: category === 'DEVOIR_GROUPE' ? 'BROUILLON' : undefined,
      versions: [
        {
          id: `ver-${Date.now()}`,
          editorName: actor.name,
          summary: 'Création du document',
          contentSnapshot: body.content?.trim() || `# ${body.title.trim()}`,
          savedAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    teamsCollabDocs.unshift(doc);
    broadcastToConversation(conv, 'doc:updated', { doc, editorUserId: actor.id });

    return res.status(201).json({ doc, ...buildTeamsWorkspace(actor) });
  });

  app.patch('/api/teams/docs/:id', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const doc = teamsCollabDocs.find((d) => d.id === req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const conv = teamsConversations.find((c) => c.id === doc.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    const body = req.body as {
      title?: string;
      content?: string;
      saveSnapshot?: boolean;
      snapshotSummary?: string;
      homeworkStatus?: TeamsHomeworkStatus;
      homeworkGrade?: string;
      homeworkFeedback?: string;
    };

    const nowIso = new Date().toISOString();
    if (body.title !== undefined && body.title.trim()) doc.title = body.title.trim();
    if (body.content !== undefined) doc.content = body.content;
    if (body.homeworkStatus !== undefined) doc.homeworkStatus = body.homeworkStatus;
    if (body.homeworkGrade !== undefined) doc.homeworkGrade = body.homeworkGrade.trim() || undefined;
    if (body.homeworkFeedback !== undefined) doc.homeworkFeedback = body.homeworkFeedback.trim() || undefined;

    doc.lastEditedByUserId = actor.id;
    doc.lastEditedByName = actor.name;
    doc.updatedAt = nowIso;

    if (body.saveSnapshot) {
      doc.versions.unshift({
        id: `ver-${Date.now()}`,
        editorName: actor.name,
        summary: body.snapshotSummary?.trim() || 'Sauvegarde manuelle',
        contentSnapshot: doc.content,
        savedAt: nowIso,
      });
    }

    broadcastToConversation(conv, 'doc:updated', { doc, editorUserId: actor.id });
    return res.json({ doc, ...buildTeamsWorkspace(actor) });
  });

  app.post('/api/teams/files', (req: Request, res: Response) => {
    const actor = getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });

    const body = req.body as {
      conversationId?: string;
      filename?: string;
      mimeType?: string;
      sizeBytes?: number;
      dataUrl?: string;
      category?: TeamsFileCategory;
      homeworkStatus?: TeamsHomeworkStatus;
    };

    if (!body.conversationId || !body.filename?.trim() || !body.dataUrl) {
      return res.status(400).json({ error: 'Canal, nom de fichier et contenu requis.' });
    }

    const conv = teamsConversations.find((c) => c.id === body.conversationId);
    if (!conv || !canAccessConversation(actor, conv)) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }

    if ((body.sizeBytes || 0) > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Limite de fichier 5 Mo dépassée.' });
    }

    const nowIso = new Date().toISOString();
    const fileRec: TeamsSharedFile = {
      id: `tfile-${Date.now()}`,
      conversationId: conv.id,
      filename: body.filename.trim(),
      mimeType: body.mimeType || 'application/octet-stream',
      sizeBytes: Number(body.sizeBytes) || body.dataUrl.length,
      dataUrl: body.dataUrl,
      category: body.category || 'DOCUMENT',
      uploadedByUserId: actor.id,
      uploadedByName: actor.name,
      homeworkStatus: body.homeworkStatus,
      createdAt: nowIso,
    };

    teamsSharedFiles.unshift(fileRec);
    broadcastToConversation(conv, 'file:uploaded', { file: fileRec });

    return res.status(201).json({ file: fileRec, ...buildTeamsWorkspace(actor) });
  });

  registerModulePersistence('teams', {
    getState: () => ({
      teamsConversations,
      teamsMessages,
      teamsMeetings,
      teamsCollabDocs,
      teamsSharedFiles,
    }),
    restoreState: (data) => {
      const replaceArr = <T,>(arr: T[], incoming: unknown) => {
        if (Array.isArray(incoming)) arr.splice(0, arr.length, ...(incoming as T[]));
      };
      replaceArr(teamsConversations, data.teamsConversations);
      replaceArr(teamsMessages, data.teamsMessages);
      replaceArr(teamsMeetings, data.teamsMeetings);
      replaceArr(teamsCollabDocs, data.teamsCollabDocs);
      replaceArr(teamsSharedFiles, data.teamsSharedFiles);
    },
  });
}

export function getTeamsCollections() {
  return {
    teamsConversations,
    teamsMessages,
  };
}

