import type { Express, Request, Response } from 'express';
import type {
  AuthSpace,
  MarketingAudienceMember,
  MarketingAudienceRule,
  MarketingAudienceSource,
  MarketingAutomationStep,
  MarketingAutomationWorkflow,
  MarketingCampaignObjective,
  MarketingCampaignRecord,
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingChannelContent,
  MarketingChannelMetric,
  MarketingDispatchLog,
  MarketingDispatchStatus,
  MarketingOverviewPayload,
  MarketingSmartAudience,
  MarketingTriggerEvent,
} from '../src/types.js';
import { store } from './db.js';
import { pushPlatformNotification } from './cahierModules.js';
import { registerModulePersistence } from './persistence.js';

export interface MarketingActor {
  id: string;
  space: AuthSpace;
  role: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
}

export interface RegisterMarketingDeps {
  getActiveActor: (req: Request) => MarketingActor | null;
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

interface StoredAudienceConfig {
  id: string;
  ownerUserId: string;
  organizationId: string;
  name: string;
  sourceScope: MarketingAudienceSource;
  matchMode: 'ALL' | 'ANY';
  rules: MarketingAudienceRule[];
  preferredChannels: MarketingChannel[];
  autoRefresh: boolean;
  createdAt: string;
  updatedAt: string;
}

const smartAudienceConfigs: StoredAudienceConfig[] = [
  {
    id: 'aud-devis-relance',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Devis B2B ouverts >= 500k FCFA',
    sourceScope: 'OPEN_QUOTES',
    matchMode: 'ALL',
    rules: [
      { id: 'r-1', field: 'MIN_AMOUNT_FCFA', operator: 'GTE', value: '500000' },
      { id: 'r-2', field: 'WHATSAPP_OPTIN', operator: 'IS_TRUE', value: 'true' },
    ],
    preferredChannels: ['WHATSAPP', 'EMAIL', 'SMS'],
    autoRefresh: true,
    createdAt: '2026-11-10',
    updatedAt: '2026-11-19',
  },
  {
    id: 'aud-impayes',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Factures partielles & recouvrement',
    sourceScope: 'UNPAID_INVOICES',
    matchMode: 'ALL',
    rules: [
      { id: 'r-3', field: 'MIN_AMOUNT_FCFA', operator: 'GTE', value: '100000' },
      { id: 'r-4', field: 'HAS_PHONE', operator: 'IS_TRUE', value: 'true' },
    ],
    preferredChannels: ['WHATSAPP', 'SMS', 'EMAIL'],
    autoRefresh: true,
    createdAt: '2026-11-11',
    updatedAt: '2026-11-19',
  },
  {
    id: 'aud-formation-leads',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Apprenants & demandes de formation',
    sourceScope: 'TRAINING_REQUESTS',
    matchMode: 'ALL',
    rules: [{ id: 'r-5', field: 'HAS_EMAIL', operator: 'IS_TRUE', value: 'true' }],
    preferredChannels: ['EMAIL', 'PUSH', 'WHATSAPP'],
    autoRefresh: true,
    createdAt: '2026-11-13',
    updatedAt: '2026-11-19',
  },
  {
    id: 'aud-prospects-all',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Décideurs Multi-sources & Événements',
    sourceScope: 'MULTI_SOURCE',
    matchMode: 'ANY',
    rules: [
      { id: 'r-6', field: 'WHATSAPP_OPTIN', operator: 'IS_TRUE', value: 'true' },
      { id: 'r-7', field: 'PIPELINE_STAGE', operator: 'EQUALS', value: 'QUALIFIE' },
    ],
    preferredChannels: ['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'],
    autoRefresh: true,
    createdAt: '2026-11-14',
    updatedAt: '2026-11-19',
  },
];

const marketingCampaigns: MarketingCampaignRecord[] = [
  {
    id: 'mkt-camp-1',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Relance Devis Pro & Offre Q4 2026',
    objective: 'RETARGETING_DEVIS',
    audienceId: 'aud-devis-relance',
    audienceName: 'Devis B2B ouverts >= 500k FCFA',
    channels: ['WHATSAPP', 'EMAIL', 'SMS', 'PUSH'],
    channelMessages: {
      WHATSAPP: {
        body: 'Bonjour {nom}, votre devis de {montant} FCFA reste prioritaire pour la cohorte Q4. Souhaitez-vous confirmer la date de démarrage ?',
      },
      EMAIL: {
        subject: 'Suivi de votre proposition commerciale — {organisation}',
        body: 'Bonjour {nom},\n\nNous revenons vers vous concernant votre dossier ({montant} FCFA). Nos équipes restent disponibles pour finaliser la planification.',
        ctaLabel: 'Valider le devis',
      },
      SMS: {
        body: '{organisation}: Votre devis ({montant} FCFA) est en attente de validation. Repondez OUI pour recevoir un appel.',
      },
      PUSH: {
        title: 'Devis en attente de signature',
        body: '{nom} — Rappel planification dossier ({montant} FCFA).',
      },
    },
    status: 'ACTIVE',
    targetCount: 3,
    dispatchedCount: 6,
    deliveredCount: 6,
    openedOrClickedCount: 4,
    convertedCount: 1,
    revenueRecoveredFcfa: 1500000,
    createdAt: '2026-11-14',
    lastDispatchedAt: '2026-11-19 10:15',
  },
  {
    id: 'mkt-camp-2',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Recouvrement Amiable Factures Partielles',
    objective: 'RECOUVREMENT_FACTURE',
    audienceId: 'aud-impayes',
    audienceName: 'Factures partielles & recouvrement',
    channels: ['WHATSAPP', 'SMS', 'EMAIL'],
    channelMessages: {
      WHATSAPP: {
        body: 'Bonjour {nom}, un solde de {montant} FCFA reste ouvert sur votre compte {organisation}. Merci de nous transmettre votre avis de virement.',
      },
      EMAIL: {
        subject: 'Relevé d’échéance — Solde {montant} FCFA',
        body: 'Bonjour {nom},\n\nUn reliquat de {montant} FCFA demeure en attente de règlement sur votre dossier.',
      },
      SMS: {
        body: '{organisation}: Rappel echeance solde {montant} FCFA. Merci pour votre retour.',
      },
    },
    status: 'ACTIVE',
    targetCount: 2,
    dispatchedCount: 3,
    deliveredCount: 3,
    openedOrClickedCount: 2,
    convertedCount: 1,
    revenueRecoveredFcfa: 1450000,
    createdAt: '2026-11-15',
    lastDispatchedAt: '2026-11-18 15:40',
  },
  {
    id: 'mkt-camp-3',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Activation Cohortes Gouvernance & Cloud',
    objective: 'PROMOTION_FORMATION',
    audienceId: 'aud-formation-leads',
    audienceName: 'Apprenants & demandes de formation',
    channels: ['EMAIL', 'PUSH', 'WHATSAPP'],
    channelMessages: {
      EMAIL: {
        subject: 'Places limitées — Prochaines sessions certifiantes',
        body: 'Bonjour {nom}, confirmez votre inscription à la session de décembre avec prise en charge 3FPT possible.',
      },
      PUSH: {
        title: 'Nouvelle cohorte certifiante ouverte',
        body: 'Finalisez votre dossier de formation avant la clôture des inscriptions.',
      },
      WHATSAPP: {
        body: 'Bonjour {nom}, nos formateurs certifiés ouvrent 8 places supplémentaires pour la session de décembre.',
      },
    },
    status: 'PLANIFIEE',
    scheduledAt: '2026-11-24T09:00',
    targetCount: 3,
    dispatchedCount: 2,
    deliveredCount: 2,
    openedOrClickedCount: 1,
    convertedCount: 0,
    revenueRecoveredFcfa: 0,
    createdAt: '2026-11-18',
  },
];

const marketingAutomations: MarketingAutomationWorkflow[] = [
  {
    id: 'auto-devis-j2',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Séquence Retargeting Devis Sans Réponse',
    triggerEvent: 'DEVIS_SANS_REPONSE',
    triggerDelayDays: 2,
    audienceId: 'aud-devis-relance',
    audienceName: 'Devis B2B ouverts >= 500k FCFA',
    status: 'ACTIVE',
    steps: [
      {
        id: 'st-1',
        stepOrder: 1,
        delayDays: 2,
        channel: 'WHATSAPP',
        condition: 'ALWAYS',
        messageTemplate:
          'Bonjour {nom}, avez-vous pu consulter notre devis ({montant} FCFA) ? Notre équipe reste disponible pour ajuster le périmètre.',
        sentCount: 4,
      },
      {
        id: 'st-2',
        stepOrder: 2,
        delayDays: 5,
        channel: 'EMAIL',
        condition: 'IF_NO_REPLY',
        subject: 'Récapitulatif & créneaux disponibles — {organisation}',
        messageTemplate:
          'Bonjour {nom}, nous vous proposons un point de 15 minutes pour valider votre proposition commerciale.',
        sentCount: 2,
      },
      {
        id: 'st-3',
        stepOrder: 3,
        delayDays: 10,
        channel: 'SMS',
        condition: 'IF_NO_REPLY',
        messageTemplate:
          '{organisation}: Dernier rappel avant expiration de la validite de votre devis ({montant} FCFA).',
        sentCount: 1,
      },
    ],
    enrolledCount: 4,
    completedCount: 2,
    conversionsCount: 1,
    recoveredFcfa: 1500000,
    lastTriggeredAt: '2026-11-19 09:00',
    createdAt: '2026-11-10',
  },
  {
    id: 'auto-facture-impayee',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Relance Automatique Factures Échues',
    triggerEvent: 'FACTURE_IMPAYEE',
    triggerDelayDays: 3,
    audienceId: 'aud-impayes',
    audienceName: 'Factures partielles & recouvrement',
    status: 'ACTIVE',
    steps: [
      {
        id: 'st-4',
        stepOrder: 1,
        delayDays: 3,
        channel: 'EMAIL',
        condition: 'ALWAYS',
        subject: 'Rappel échéance facture — {organisation}',
        messageTemplate:
          'Bonjour {nom}, sauf erreur de notre part, un solde de {montant} FCFA demeure ouvert sur votre facture.',
        sentCount: 3,
      },
      {
        id: 'st-5',
        stepOrder: 2,
        delayDays: 7,
        channel: 'WHATSAPP',
        condition: 'IF_NO_PAYMENT',
        messageTemplate:
          'Bonjour {nom}, relance amiable concernant le règlement de {montant} FCFA. Merci de nous confirmer la date de virement.',
        sentCount: 2,
      },
      {
        id: 'st-6',
        stepOrder: 3,
        delayDays: 12,
        channel: 'PUSH',
        condition: 'IF_NO_PAYMENT',
        messageTemplate: 'Relance recouvrement critique — {nom} ({montant} FCFA)',
        sentCount: 1,
      },
    ],
    enrolledCount: 3,
    completedCount: 1,
    conversionsCount: 1,
    recoveredFcfa: 1450000,
    lastTriggeredAt: '2026-11-18 16:30',
    createdAt: '2026-11-12',
  },
  {
    id: 'auto-formation-abandon',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    name: 'Retargeting Demandes de Formation en Attente',
    triggerEvent: 'INSCRIPTION_FORMATION_INCOMPLETE',
    triggerDelayDays: 1,
    audienceId: 'aud-formation-leads',
    audienceName: 'Apprenants & demandes de formation',
    status: 'EN_PAUSE',
    steps: [
      {
        id: 'st-7',
        stepOrder: 1,
        delayDays: 1,
        channel: 'PUSH',
        condition: 'ALWAYS',
        messageTemplate: 'Dossier formation à finaliser — {nom}',
        sentCount: 2,
      },
      {
        id: 'st-8',
        stepOrder: 2,
        delayDays: 4,
        channel: 'WHATSAPP',
        condition: 'IF_NO_REPLY',
        messageTemplate:
          'Bonjour {nom}, souhaitez-vous que notre conseiller pédagogique vous aide à finaliser la convention de formation ?',
        sentCount: 1,
      },
    ],
    enrolledCount: 2,
    completedCount: 0,
    conversionsCount: 0,
    recoveredFcfa: 0,
    createdAt: '2026-11-16',
  },
];

const marketingDispatches: MarketingDispatchLog[] = [
  {
    id: 'disp-1',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    campaignId: 'mkt-camp-1',
    campaignName: 'Relance Devis Pro & Offre Q4 2026',
    recipientId: 'c-dir-2',
    recipientName: 'CBAO Groupe Attijariwafa Bank',
    recipientEmail: 'evenements@cbao.sn',
    recipientPhone: '+221 78 410 33 21',
    channel: 'WHATSAPP',
    messageBody:
      'Bonjour CBAO Groupe Attijariwafa Bank, votre devis de 3 776 000 FCFA reste prioritaire pour la cohorte Q4. Souhaitez-vous confirmer la date de démarrage ?',
    status: 'OUVERT',
    amountRelatedFcfa: 3776000,
    createdAt: '2026-11-19 10:15',
    updatedAt: '2026-11-19 11:02',
  },
  {
    id: 'disp-2',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    campaignId: 'mkt-camp-1',
    campaignName: 'Relance Devis Pro & Offre Q4 2026',
    recipientId: 'c-dir-2',
    recipientName: 'CBAO Groupe Attijariwafa Bank',
    recipientEmail: 'evenements@cbao.sn',
    recipientPhone: '+221 78 410 33 21',
    channel: 'EMAIL',
    subject: 'Suivi de votre proposition commerciale — Teranga Prestige Digital',
    messageBody:
      'Bonjour CBAO Groupe Attijariwafa Bank, nous revenons vers vous concernant votre dossier (3 776 000 FCFA).',
    status: 'CLIQUE',
    amountRelatedFcfa: 3776000,
    createdAt: '2026-11-19 10:15',
    updatedAt: '2026-11-19 11:45',
  },
  {
    id: 'disp-3',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    campaignId: 'mkt-camp-2',
    campaignName: 'Recouvrement Amiable Factures Partielles',
    recipientId: 'c-dir-1',
    recipientName: 'Sonatel Business SA',
    recipientEmail: 'achats@sonatel.sn',
    recipientPhone: '+221 77 839 10 00',
    channel: 'WHATSAPP',
    messageBody:
      'Bonjour Sonatel Business SA, un solde de 1 450 000 FCFA reste ouvert sur votre compte Teranga Prestige Digital.',
    status: 'CONVERTI',
    amountRelatedFcfa: 1450000,
    createdAt: '2026-11-18 15:40',
    updatedAt: '2026-11-19 08:50',
  },
  {
    id: 'disp-4',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    automationId: 'auto-facture-impayee',
    automationName: 'Relance Automatique Factures Échues',
    recipientId: 'c-dir-1',
    recipientName: 'Sonatel Business SA',
    recipientEmail: 'achats@sonatel.sn',
    recipientPhone: '+221 77 839 10 00',
    channel: 'SMS',
    messageBody: 'Teranga Prestige Digital: Rappel echeance solde 1 450 000 FCFA. Merci pour votre retour.',
    status: 'DELIVRE',
    amountRelatedFcfa: 1450000,
    createdAt: '2026-11-18 16:30',
    updatedAt: '2026-11-18 16:31',
  },
  {
    id: 'disp-5',
    ownerUserId: 'int-u-1',
    organizationId: 'tpd-demo-intranet',
    automationId: 'auto-formation-abandon',
    automationName: 'Retargeting Demandes de Formation en Attente',
    recipientId: 'lrn-1',
    recipientName: 'Awa Mbaye',
    recipientEmail: 'apprenant@teranga-demo.sn',
    recipientPhone: '+221 77 402 18 90',
    channel: 'PUSH',
    subject: 'Dossier formation à finaliser',
    messageBody: 'Finalisez votre convention de formation pour confirmer votre place.',
    status: 'OUVERT',
    amountRelatedFcfa: 450000,
    createdAt: '2026-11-17 14:20',
    updatedAt: '2026-11-17 15:10',
  },
];

function computeDocRemaining(doc: (typeof store.crmDocuments)[number]): number {
  const ttc = doc.lines.reduce((s, l) => s + l.quantity * l.unitPrice * (1 + l.vatRate / 100), 0);
  const paid = doc.payments.reduce((s, p) => s + p.amount, 0);
  return Math.max(0, Math.round(ttc - paid));
}

function daysBetween(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.floor((Date.now() - parsed) / (1000 * 60 * 60 * 24)));
}

function collectCandidatePool(actor: MarketingActor, sourceScope: MarketingAudienceSource): MarketingAudienceMember[] {
  const isSuperadmin = actor.space === 'superadmin';
  const orgContacts = store.crmContacts.filter((c) => {
    if (isSuperadmin) return true;
    if (actor.space === 'accounting') return c.type === 'CLIENT' || c.type === 'PROSPECT';
    return c.organizationId === actor.organizationId || c.ownerUserId === actor.id;
  });

  const orgDocs = store.crmDocuments.filter((d) => {
    if (isSuperadmin) return true;
    if (actor.space === 'accounting') return true;
    return d.organizationId === actor.organizationId || d.ownerUserId === actor.id;
  });

  const candidates = new Map<string, MarketingAudienceMember>();

  const includeCrmContacts = sourceScope === 'CRM_CONTACTS' || sourceScope === 'MULTI_SOURCE';
  const includeQuotes = sourceScope === 'OPEN_QUOTES' || sourceScope === 'MULTI_SOURCE';
  const includeInvoices = sourceScope === 'UNPAID_INVOICES' || sourceScope === 'MULTI_SOURCE';
  const includeTraining = sourceScope === 'TRAINING_REQUESTS' || sourceScope === 'MULTI_SOURCE';
  const includeEvents = sourceScope === 'EVENT_GUESTS' || sourceScope === 'MULTI_SOURCE';

  if (includeCrmContacts) {
    for (const c of orgContacts) {
      if (c.type === 'SUPPLIER') continue;
      const openVal = orgDocs
        .filter((d) => d.contactId === c.id && d.status !== 'PAID')
        .reduce((sum, d) => sum + computeDocRemaining(d), 0);
      const channelsAvailable: MarketingChannel[] = ['PUSH'];
      if (c.email) channelsAvailable.push('EMAIL');
      if (c.phone) channelsAvailable.push('SMS');
      if (c.phone && c.whatsappOptIn) channelsAvailable.push('WHATSAPP');
      candidates.set(c.id, {
        id: c.id,
        name: c.name,
        organizationName: actor.organizationName,
        email: c.email || '',
        phone: c.phone || '',
        sourceLabel: c.type === 'CLIENT' ? 'Client CRM' : 'Prospect CRM',
        pipelineStage: c.pipelineStage,
        sector: c.sector,
        pendingAmountFcfa: openVal,
        lastActivityDate: c.lastContactAt || '2026-11-15',
        channelsAvailable,
      });
    }
  }

  if (includeQuotes) {
    for (const doc of orgDocs.filter((d) => d.kind === 'QUOTE' && d.status !== 'PAID')) {
      const contact = orgContacts.find((c) => c.id === doc.contactId);
      const amount = computeDocRemaining(doc);
      const channelsAvailable: MarketingChannel[] = ['PUSH'];
      if (contact?.email) channelsAvailable.push('EMAIL');
      if (contact?.phone) channelsAvailable.push('SMS');
      if (contact?.phone && contact?.whatsappOptIn) channelsAvailable.push('WHATSAPP');
      const existing = candidates.get(doc.contactId);
      candidates.set(doc.contactId, {
        id: doc.contactId,
        name: doc.contactName,
        organizationName: actor.organizationName,
        email: contact?.email || existing?.email || '',
        phone: contact?.phone || existing?.phone || '',
        sourceLabel: `Devis ${doc.number}`,
        pipelineStage: contact?.pipelineStage || 'PROPOSITION',
        sector: contact?.sector,
        pendingAmountFcfa: (existing?.pendingAmountFcfa || 0) + amount,
        lastActivityDate: doc.date,
        channelsAvailable,
      });
    }
  }

  if (includeInvoices) {
    for (const doc of orgDocs.filter(
      (d) => d.kind === 'CUSTOMER_INVOICE' && (d.status === 'PARTIAL' || d.status === 'VALIDATED'),
    )) {
      const contact = orgContacts.find((c) => c.id === doc.contactId);
      const amount = computeDocRemaining(doc);
      if (amount <= 0) continue;
      const channelsAvailable: MarketingChannel[] = ['PUSH'];
      if (contact?.email) channelsAvailable.push('EMAIL');
      if (contact?.phone) channelsAvailable.push('SMS');
      if (contact?.phone && contact?.whatsappOptIn) channelsAvailable.push('WHATSAPP');
      const existing = candidates.get(doc.contactId);
      candidates.set(doc.contactId, {
        id: doc.contactId,
        name: doc.contactName,
        organizationName: actor.organizationName,
        email: contact?.email || existing?.email || '',
        phone: contact?.phone || existing?.phone || '',
        sourceLabel: `Facture ${doc.number}`,
        pipelineStage: contact?.pipelineStage || 'GAGNE',
        sector: contact?.sector,
        pendingAmountFcfa: (existing?.pendingAmountFcfa || 0) + amount,
        lastActivityDate: doc.date,
        channelsAvailable,
      });
    }
  }

  if (includeTraining) {
    for (const req of store.trainingRequests) {
      const matchedContact = orgContacts.find(
        (c) => c.email && req.requesterEmail && c.email.toLowerCase() === req.requesterEmail.toLowerCase(),
      );
      const phone = matchedContact?.phone || '+221 77 402 18 90';
      const channelsAvailable: MarketingChannel[] = ['PUSH'];
      if (req.requesterEmail) channelsAvailable.push('EMAIL');
      if (phone) {
        channelsAvailable.push('SMS', 'WHATSAPP');
      }
      candidates.set(`tr-${req.id}`, {
        id: req.requesterUserId || req.id,
        name: req.requesterName,
        organizationName: req.organizationName,
        email: req.requesterEmail,
        phone,
        sourceLabel: `Formation · ${req.courseTitle || req.title}`,
        pipelineStage: req.stage,
        sector: req.category || 'Formation Professionnelle',
        pendingAmountFcfa: req.quotedAmountFcfa || req.budgetEstimatedFcfa || 450000,
        lastActivityDate: req.updatedAt.slice(0, 10),
        channelsAvailable,
      });
    }
    for (const learner of store.learnerUsers) {
      if (!candidates.has(learner.id)) {
        candidates.set(learner.id, {
          id: learner.id,
          name: learner.name,
          organizationName: learner.companyName,
          email: learner.email,
          phone: '+221 77 402 18 90',
          sourceLabel: 'Apprenant inscrit',
          pipelineStage: 'ACTIF',
          sector: 'Formation B2B',
          pendingAmountFcfa: 350000,
          lastActivityDate: '2026-11-16',
          channelsAvailable: ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'],
        });
      }
    }
  }

  if (includeEvents) {
    for (const ev of store.platformEvents) {
      if (!isSuperadmin && ev.organizationId !== actor.organizationId && ev.ownerUserId !== actor.id) continue;
      candidates.set(`ev-${ev.id}`, {
        id: `ev-${ev.id}`,
        name: ev.client,
        organizationName: ev.client,
        email: 'protocole@teranga-demo.sn',
        phone: '+221 77 512 09 44',
        sourceLabel: `Événement · ${ev.title}`,
        pipelineStage: ev.status,
        sector: 'Événementiel',
        pendingAmountFcfa: ev.budgetFcfa,
        lastActivityDate: ev.date,
        channelsAvailable: ['PUSH', 'EMAIL', 'SMS', 'WHATSAPP'],
      });
    }
  }

  return Array.from(candidates.values());
}

function matchesRule(member: MarketingAudienceMember, rule: MarketingAudienceRule): boolean {
  const val = rule.value.trim().toLowerCase();
  switch (rule.field) {
    case 'CONTACT_TYPE': {
      const src = member.sourceLabel.toLowerCase();
      const isMatch = val === 'client' ? src.includes('client') || src.includes('facture') : src.includes(val);
      return rule.operator === 'NOT_EQUALS' ? !isMatch : isMatch;
    }
    case 'PIPELINE_STAGE': {
      const stage = (member.pipelineStage || '').toLowerCase();
      return rule.operator === 'NOT_EQUALS' ? stage !== val : stage === val;
    }
    case 'WHATSAPP_OPTIN':
      return member.channelsAvailable.includes('WHATSAPP');
    case 'HAS_EMAIL':
      return Boolean(member.email.trim());
    case 'HAS_PHONE':
      return Boolean(member.phone.trim());
    case 'SECTOR': {
      const sec = (member.sector || '').toLowerCase();
      return rule.operator === 'EQUALS' ? sec === val : sec.includes(val);
    }
    case 'MIN_AMOUNT_FCFA': {
      const threshold = Number(rule.value || 0);
      return member.pendingAmountFcfa >= threshold;
    }
    case 'INACTIVE_DAYS': {
      const minDays = Number(rule.value || 0);
      return daysBetween(member.lastActivityDate) >= minDays;
    }
    default:
      return true;
  }
}

function evaluateSmartAudience(
  actor: MarketingActor,
  config: Pick<StoredAudienceConfig, 'sourceScope' | 'matchMode' | 'rules'>,
): MarketingAudienceMember[] {
  const pool = collectCandidatePool(actor, config.sourceScope);
  if (!config.rules || config.rules.length === 0) return pool;
  return pool.filter((member) => {
    if (config.matchMode === 'ANY') {
      return config.rules.some((r) => matchesRule(member, r));
    }
    return config.rules.every((r) => matchesRule(member, r));
  });
}

function hydrateAudience(actor: MarketingActor, cfg: StoredAudienceConfig): MarketingSmartAudience {
  const matchedTargets = evaluateSmartAudience(actor, cfg);
  return {
    ...cfg,
    matchedCount: matchedTargets.length,
    reachableWhatsapp: matchedTargets.filter((m) => m.channelsAvailable.includes('WHATSAPP')).length,
    reachableSms: matchedTargets.filter((m) => m.channelsAvailable.includes('SMS')).length,
    reachableEmail: matchedTargets.filter((m) => m.channelsAvailable.includes('EMAIL')).length,
    reachablePush: matchedTargets.filter((m) => m.channelsAvailable.includes('PUSH')).length,
    potentialValueFcfa: matchedTargets.reduce((s, m) => s + m.pendingAmountFcfa, 0),
    matchedTargets,
  };
}

function interpolateTemplate(template: string, member: MarketingAudienceMember, actor: MarketingActor): string {
  return template
    .replace(/\{nom\}/gi, member.name)
    .replace(/\{organisation\}/gi, actor.organizationName || member.organizationName)
    .replace(/\{montant\}/gi, new Intl.NumberFormat('fr-FR').format(member.pendingAmountFcfa || 0))
    .replace(/\{secteur\}/gi, member.sector || 'Entreprise');
}

function canAccessMarketing(actor: MarketingActor): boolean {
  if (actor.space === 'superadmin') return true;
  if (actor.space === 'accounting' || actor.space === 'instructor') return true;
  if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'DIRECTION' || actor.role === 'MANAGER')) {
    return true;
  }
  return false;
}

function isOwnedOrAdmin<T extends { organizationId: string; ownerUserId: string }>(
  actor: MarketingActor,
  item: T,
): boolean {
  if (actor.space === 'superadmin') return true;
  if (actor.space === 'intranet' && (actor.role === 'OWNER' || actor.role === 'DIRECTION')) {
    return item.organizationId === actor.organizationId || item.ownerUserId === 'int-u-1';
  }
  return item.organizationId === actor.organizationId || item.ownerUserId === actor.id;
}

function buildOverview(actor: MarketingActor): MarketingOverviewPayload {
  const visibleAudiences = smartAudienceConfigs
    .filter((a) => isOwnedOrAdmin(actor, a))
    .map((a) => hydrateAudience(actor, a));

  const visibleCampaigns = marketingCampaigns
    .filter((c) => isOwnedOrAdmin(actor, c))
    .map((c) => {
      const aud = visibleAudiences.find((a) => a.id === c.audienceId);
      return aud ? { ...c, targetCount: aud.matchedCount, audienceName: aud.name } : c;
    });

  const visibleAutomations = marketingAutomations.filter((w) => isOwnedOrAdmin(actor, w));
  const visibleDispatches = marketingDispatches.filter((d) => isOwnedOrAdmin(actor, d));

  const channels: MarketingChannel[] = ['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'];
  const channelMetrics: MarketingChannelMetric[] = channels.map((ch) => {
    const logs = visibleDispatches.filter((d) => d.channel === ch);
    const dispatched = logs.length;
    const delivered = logs.filter((l) => l.status !== 'ECHOUE' && l.status !== 'EN_ATTENTE').length;
    const engaged = logs.filter((l) => ['OUVERT', 'CLIQUE', 'CONVERTI'].includes(l.status)).length;
    const converted = logs.filter((l) => l.status === 'CONVERTI').length;
    return {
      channel: ch,
      dispatched,
      delivered,
      engaged,
      converted,
      deliveryRate: dispatched > 0 ? Math.round((delivered / dispatched) * 100) : 0,
      conversionRate: dispatched > 0 ? Math.round((converted / dispatched) * 100) : 0,
    };
  });

  const allPool = collectCandidatePool(actor, 'MULTI_SOURCE');
  const totalDispatched = visibleDispatches.length;
  const totalConverted = visibleDispatches.filter((d) => d.status === 'CONVERTI').length;
  const recoveredFromCampaigns = visibleCampaigns.reduce((s, c) => s + c.revenueRecoveredFcfa, 0);
  const recoverablePipelineFcfa = allPool.reduce((s, m) => s + m.pendingAmountFcfa, 0);

  return {
    audiences: visibleAudiences,
    campaigns: visibleCampaigns,
    automations: visibleAutomations,
    dispatches: visibleDispatches,
    channelMetrics,
    summary: {
      totalReachableContacts: allPool.length,
      smartAudiencesCount: visibleAudiences.length,
      activeCampaignsCount: visibleCampaigns.filter((c) => c.status === 'ACTIVE').length,
      activeAutomationsCount: visibleAutomations.filter((a) => a.status === 'ACTIVE').length,
      totalDispatched,
      conversionRate: totalDispatched > 0 ? Math.round((totalConverted / totalDispatched) * 100) : 0,
      recoverablePipelineFcfa,
      recoveredRevenueFcfa: recoveredFromCampaigns,
    },
  };
}

export function registerMarketingModule(app: Express, deps: RegisterMarketingDeps): void {
  app.get('/api/marketing/overview', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès Marketing & Retargeting refusé.' });
    return res.json(buildOverview(actor));
  });

  app.post('/api/marketing/audiences/preview', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const { sourceScope, matchMode, rules } = req.body as {
      sourceScope?: MarketingAudienceSource;
      matchMode?: 'ALL' | 'ANY';
      rules?: MarketingAudienceRule[];
    };

    const targets = evaluateSmartAudience(actor, {
      sourceScope: sourceScope || 'MULTI_SOURCE',
      matchMode: matchMode || 'ALL',
      rules: Array.isArray(rules) ? rules : [],
    });

    return res.json({
      matchedCount: targets.length,
      reachableWhatsapp: targets.filter((m) => m.channelsAvailable.includes('WHATSAPP')).length,
      reachableSms: targets.filter((m) => m.channelsAvailable.includes('SMS')).length,
      reachableEmail: targets.filter((m) => m.channelsAvailable.includes('EMAIL')).length,
      reachablePush: targets.filter((m) => m.channelsAvailable.includes('PUSH')).length,
      potentialValueFcfa: targets.reduce((s, m) => s + m.pendingAmountFcfa, 0),
      matchedTargets: targets,
    });
  });

  app.post('/api/marketing/audiences', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const { name, sourceScope, matchMode, rules, preferredChannels, autoRefresh } = req.body as {
      name?: string;
      sourceScope?: MarketingAudienceSource;
      matchMode?: 'ALL' | 'ANY';
      rules?: MarketingAudienceRule[];
      preferredChannels?: MarketingChannel[];
      autoRefresh?: boolean;
    };

    if (!name?.trim()) return res.status(400).json({ error: 'Nom de l’audience requis.' });

    const nowDate = new Date().toISOString().slice(0, 10);
    const created: StoredAudienceConfig = {
      id: `aud-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      name: name.trim(),
      sourceScope: sourceScope || 'MULTI_SOURCE',
      matchMode: matchMode || 'ALL',
      rules: Array.isArray(rules) ? rules : [],
      preferredChannels:
        Array.isArray(preferredChannels) && preferredChannels.length > 0
          ? preferredChannels
          : ['WHATSAPP', 'EMAIL'],
      autoRefresh: autoRefresh ?? true,
      createdAt: nowDate,
      updatedAt: nowDate,
    };

    smartAudienceConfigs.unshift(created);
    deps.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'AUDIENCE_CREATED',
      target: created.name,
      details: `Segment intelligent créé (${created.sourceScope}).`,
      severity: 'INFO',
    });

    return res.status(201).json(buildOverview(actor));
  });

  app.delete('/api/marketing/audiences/:audienceId', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const idx = smartAudienceConfigs.findIndex(
      (a) => a.id === req.params.audienceId && isOwnedOrAdmin(actor, a),
    );
    if (idx === -1) return res.status(404).json({ error: 'Audience introuvable.' });
    smartAudienceConfigs.splice(idx, 1);
    return res.json(buildOverview(actor));
  });

  app.post('/api/marketing/campaigns', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const { name, objective, audienceId, channels, channelMessages, status, scheduledAt } = req.body as {
      name?: string;
      objective?: MarketingCampaignObjective;
      audienceId?: string;
      channels?: MarketingChannel[];
      channelMessages?: Partial<Record<MarketingChannel, MarketingChannelContent>>;
      status?: MarketingCampaignStatus;
      scheduledAt?: string;
    };

    if (!name?.trim() || !audienceId || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ error: 'Nom, audience et au moins un canal requis.' });
    }

    const aud = smartAudienceConfigs.find((a) => a.id === audienceId && isOwnedOrAdmin(actor, a));
    if (!aud) return res.status(404).json({ error: 'Audience cible introuvable.' });
    const hydrated = hydrateAudience(actor, aud);

    const created: MarketingCampaignRecord = {
      id: `mkt-camp-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      name: name.trim(),
      objective: objective || 'RETARGETING_DEVIS',
      audienceId: hydrated.id,
      audienceName: hydrated.name,
      channels,
      channelMessages: channelMessages || {},
      status: status || 'ACTIVE',
      scheduledAt: scheduledAt || undefined,
      targetCount: hydrated.matchedCount,
      dispatchedCount: 0,
      deliveredCount: 0,
      openedOrClickedCount: 0,
      convertedCount: 0,
      revenueRecoveredFcfa: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    marketingCampaigns.unshift(created);

    // Sync with CRM campaign store if WhatsApp or Email selected
    if (channels.includes('WHATSAPP') || channels.includes('EMAIL')) {
      store.crmCampaigns.unshift({
        id: created.id,
        ownerUserId: actor.id,
        organizationId: actor.organizationId,
        name: created.name,
        channel:
          channels.includes('WHATSAPP') && channels.includes('EMAIL')
            ? 'MIXTE'
            : channels.includes('WHATSAPP')
            ? 'WHATSAPP'
            : 'EMAIL',
        audience: 'ALL_CLIENTS_PROSPECTS',
        status: created.status === 'ACTIVE' ? 'ACTIVE' : 'BROUILLON',
        messageTemplate:
          channelMessages?.WHATSAPP?.body || channelMessages?.EMAIL?.body || created.name,
        targetCount: hydrated.matchedCount,
        sentConfirmedCount: 0,
        repliesCount: 0,
        createdAt: created.createdAt,
      });
    }

    deps.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'CAMPAIGN_CREATED',
      target: created.name,
      details: `Campagne multi-canaux (${channels.join(', ')}) sur ${hydrated.matchedCount} cible(s).`,
      severity: 'INFO',
    });

    return res.status(201).json(buildOverview(actor));
  });

  app.patch('/api/marketing/campaigns/:campaignId/status', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const camp = marketingCampaigns.find(
      (c) => c.id === req.params.campaignId && isOwnedOrAdmin(actor, c),
    );
    if (!camp) return res.status(404).json({ error: 'Campagne introuvable.' });

    const { status } = req.body as { status?: MarketingCampaignStatus };
    if (status) camp.status = status;
    return res.json(buildOverview(actor));
  });

  app.post('/api/marketing/campaigns/:campaignId/dispatch', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const camp = marketingCampaigns.find(
      (c) => c.id === req.params.campaignId && isOwnedOrAdmin(actor, c),
    );
    if (!camp) return res.status(404).json({ error: 'Campagne introuvable.' });

    const aud = smartAudienceConfigs.find((a) => a.id === camp.audienceId);
    const targets = aud ? evaluateSmartAudience(actor, aud) : collectCandidatePool(actor, 'MULTI_SOURCE');
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let createdCount = 0;

    for (const member of targets) {
      for (const ch of camp.channels) {
        if (ch === 'WHATSAPP' && !member.phone) continue;
        if (ch === 'SMS' && !member.phone) continue;
        if (ch === 'EMAIL' && !member.email) continue;

        const tpl = camp.channelMessages[ch];
        const rawBody =
          tpl?.body ||
          `Bonjour {nom}, suivi de votre dossier auprès de {organisation} ({montant} FCFA).`;
        const messageBody = interpolateTemplate(rawBody, member, actor);
        const subject = tpl?.subject ? interpolateTemplate(tpl.subject, member, actor) : undefined;
        const pushTitle = tpl?.title ? interpolateTemplate(tpl.title, member, actor) : camp.name;

        const initialStatus: MarketingDispatchStatus =
          ch === 'WHATSAPP' ? 'EN_ATTENTE' : 'DELIVRE';

        const log: MarketingDispatchLog = {
          id: `disp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          ownerUserId: actor.id,
          organizationId: actor.organizationId,
          campaignId: camp.id,
          campaignName: camp.name,
          recipientId: member.id,
          recipientName: member.name,
          recipientEmail: member.email,
          recipientPhone: member.phone,
          channel: ch,
          subject: ch === 'PUSH' ? pushTitle : subject,
          messageBody,
          status: initialStatus,
          amountRelatedFcfa: member.pendingAmountFcfa,
          createdAt: nowStamp,
          updatedAt: nowStamp,
        };
        marketingDispatches.unshift(log);
        createdCount += 1;
        camp.dispatchedCount += 1;
        if (initialStatus === 'DELIVRE') camp.deliveredCount += 1;

        if (ch === 'WHATSAPP' && store.crmContacts.some((c) => c.id === member.id)) {
          store.crmFollowUps.unshift({
            id: `wa-mkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            ownerUserId: actor.id,
            organizationId: actor.organizationId,
            contactId: member.id,
            contactName: member.name,
            phone: member.phone,
            campaignId: camp.id,
            campaignName: camp.name,
            message: messageBody,
            status: 'A_ENVOYER',
            preparedAt: nowStamp,
          });
        }

        if (ch === 'PUSH') {
          pushPlatformNotification({
            userId: actor.id,
            organizationId: actor.organizationId,
            title: `${pushTitle} — ${member.name}`,
            message: messageBody,
            category: 'SYSTEME',
            priority: 'NORMALE',
            channelsSent: ['IN_APP', 'PUSH_WEB'],
            targetSection: 'marketing',
          });
        }
      }
    }

    camp.status = 'ACTIVE';
    camp.lastDispatchedAt = nowStamp;
    camp.targetCount = targets.length;

    deps.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'CAMPAIGN_DISPATCHED',
      target: camp.name,
      details: `${createdCount} envoi(s) multi-canaux généré(s) (${camp.channels.join(', ')}).`,
      severity: 'INFO',
    });

    return res.json({ dispatchedNow: createdCount, ...buildOverview(actor) });
  });

  app.delete('/api/marketing/campaigns/:campaignId', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const idx = marketingCampaigns.findIndex(
      (c) => c.id === req.params.campaignId && isOwnedOrAdmin(actor, c),
    );
    if (idx === -1) return res.status(404).json({ error: 'Campagne introuvable.' });
    marketingCampaigns.splice(idx, 1);
    return res.json(buildOverview(actor));
  });

  app.post('/api/marketing/automations', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const { name, triggerEvent, triggerDelayDays, audienceId, steps } = req.body as {
      name?: string;
      triggerEvent?: MarketingTriggerEvent;
      triggerDelayDays?: number;
      audienceId?: string;
      steps?: Array<Partial<MarketingAutomationStep>>;
    };

    if (!name?.trim() || !Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Nom et au moins une étape de relance requis.' });
    }

    const aud = audienceId
      ? smartAudienceConfigs.find((a) => a.id === audienceId && isOwnedOrAdmin(actor, a))
      : undefined;

    const created: MarketingAutomationWorkflow = {
      id: `auto-${Date.now()}`,
      ownerUserId: actor.id,
      organizationId: actor.organizationId,
      name: name.trim(),
      triggerEvent: triggerEvent || 'DEVIS_SANS_REPONSE',
      triggerDelayDays: Math.max(0, Number(triggerDelayDays ?? 2)),
      audienceId: aud?.id,
      audienceName: aud?.name,
      status: 'ACTIVE',
      steps: steps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        stepOrder: idx + 1,
        delayDays: Math.max(0, Number(s.delayDays ?? idx * 3 + 1)),
        channel: s.channel || 'WHATSAPP',
        condition: s.condition || (idx === 0 ? 'ALWAYS' : 'IF_NO_REPLY'),
        subject: s.subject?.trim() || undefined,
        messageTemplate:
          s.messageTemplate?.trim() ||
          'Bonjour {nom}, rappel automatique concernant votre dossier auprès de {organisation}.',
        sentCount: 0,
      })),
      enrolledCount: 0,
      completedCount: 0,
      conversionsCount: 0,
      recoveredFcfa: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    marketingAutomations.unshift(created);
    deps.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'AUTOMATION_CREATED',
      target: created.name,
      details: `Workflow de relance (${created.triggerEvent}) avec ${created.steps.length} étape(s).`,
      severity: 'INFO',
    });

    return res.status(201).json(buildOverview(actor));
  });

  app.patch('/api/marketing/automations/:automationId/toggle', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const wf = marketingAutomations.find(
      (a) => a.id === req.params.automationId && isOwnedOrAdmin(actor, a),
    );
    if (!wf) return res.status(404).json({ error: 'Automatisation introuvable.' });

    wf.status = wf.status === 'ACTIVE' ? 'EN_PAUSE' : 'ACTIVE';
    return res.json(buildOverview(actor));
  });

  app.post('/api/marketing/automations/:automationId/run', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const wf = marketingAutomations.find(
      (a) => a.id === req.params.automationId && isOwnedOrAdmin(actor, a),
    );
    if (!wf) return res.status(404).json({ error: 'Automatisation introuvable.' });

    const sourceByTrigger: Record<MarketingTriggerEvent, MarketingAudienceSource> = {
      DEVIS_SANS_REPONSE: 'OPEN_QUOTES',
      FACTURE_IMPAYEE: 'UNPAID_INVOICES',
      INSCRIPTION_FORMATION_INCOMPLETE: 'TRAINING_REQUESTS',
      CONTACT_INACTIF: 'CRM_CONTACTS',
      POST_EVENEMENT: 'EVENT_GUESTS',
    };

    const aud = wf.audienceId ? smartAudienceConfigs.find((a) => a.id === wf.audienceId) : undefined;
    const targets = aud
      ? evaluateSmartAudience(actor, aud)
      : collectCandidatePool(actor, sourceByTrigger[wf.triggerEvent]);

    const firstStep = wf.steps[0];
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let executed = 0;

    if (firstStep) {
      for (const member of targets) {
        if (firstStep.channel === 'EMAIL' && !member.email) continue;
        if ((firstStep.channel === 'SMS' || firstStep.channel === 'WHATSAPP') && !member.phone) continue;

        const messageBody = interpolateTemplate(firstStep.messageTemplate, member, actor);
        const subject = firstStep.subject
          ? interpolateTemplate(firstStep.subject, member, actor)
          : undefined;
        const status: MarketingDispatchStatus =
          firstStep.channel === 'WHATSAPP' ? 'EN_ATTENTE' : 'DELIVRE';

        marketingDispatches.unshift({
          id: `disp-auto-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          ownerUserId: actor.id,
          organizationId: actor.organizationId,
          automationId: wf.id,
          automationName: wf.name,
          recipientId: member.id,
          recipientName: member.name,
          recipientEmail: member.email,
          recipientPhone: member.phone,
          channel: firstStep.channel,
          subject,
          messageBody,
          status,
          amountRelatedFcfa: member.pendingAmountFcfa,
          createdAt: nowStamp,
          updatedAt: nowStamp,
        });

        if (firstStep.channel === 'PUSH') {
          pushPlatformNotification({
            userId: actor.id,
            organizationId: actor.organizationId,
            title: `${wf.name} — ${member.name}`,
            message: messageBody,
            category: 'SYSTEME',
            priority: 'HAUTE',
            channelsSent: ['IN_APP', 'PUSH_WEB'],
            targetSection: 'marketing',
          });
        }

        firstStep.sentCount += 1;
        executed += 1;
      }
    }

    wf.enrolledCount += targets.length;
    wf.lastTriggeredAt = nowStamp;
    wf.status = 'ACTIVE';

    deps.addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      actorSpace: actor.space,
      action: 'AUTOMATION_TRIGGERED',
      target: wf.name,
      details: `${executed} relance(s) déclenchée(s) via ${firstStep?.channel || 'MULTI'}.`,
      severity: 'INFO',
    });

    return res.json({ executedNow: executed, ...buildOverview(actor) });
  });

  app.delete('/api/marketing/automations/:automationId', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const idx = marketingAutomations.findIndex(
      (a) => a.id === req.params.automationId && isOwnedOrAdmin(actor, a),
    );
    if (idx === -1) return res.status(404).json({ error: 'Automatisation introuvable.' });
    marketingAutomations.splice(idx, 1);
    return res.json(buildOverview(actor));
  });

  app.patch('/api/marketing/dispatches/:dispatchId/status', (req: Request, res: Response) => {
    const actor = deps.getActiveActor(req);
    if (!actor) return res.status(401).json({ error: 'Authentification requise.' });
    if (!canAccessMarketing(actor)) return res.status(403).json({ error: 'Accès refusé.' });

    const log = marketingDispatches.find(
      (d) => d.id === req.params.dispatchId && isOwnedOrAdmin(actor, d),
    );
    if (!log) return res.status(404).json({ error: 'Envoi introuvable.' });

    const { status } = req.body as { status?: MarketingDispatchStatus };
    if (!status) return res.status(400).json({ error: 'Statut requis.' });

    const prev = log.status;
    log.status = status;
    log.updatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    if (log.campaignId) {
      const camp = marketingCampaigns.find((c) => c.id === log.campaignId);
      if (camp) {
        if (status === 'DELIVRE' && prev === 'EN_ATTENTE') camp.deliveredCount += 1;
        if ((status === 'OUVERT' || status === 'CLIQUE') && !['OUVERT', 'CLIQUE', 'CONVERTI'].includes(prev)) {
          camp.openedOrClickedCount += 1;
        }
        if (status === 'CONVERTI' && prev !== 'CONVERTI') {
          camp.convertedCount += 1;
          camp.revenueRecoveredFcfa += log.amountRelatedFcfa || 0;
        }
      }
    }

    if (log.automationId) {
      const wf = marketingAutomations.find((a) => a.id === log.automationId);
      if (wf && status === 'CONVERTI' && prev !== 'CONVERTI') {
        wf.conversionsCount += 1;
        wf.completedCount += 1;
        wf.recoveredFcfa += log.amountRelatedFcfa || 0;
      }
    }

    return res.json(buildOverview(actor));
  });

  registerModulePersistence('marketing', {
    getState: () => ({
      smartAudienceConfigs,
      marketingCampaigns,
      marketingAutomations,
      marketingDispatches,
    }),
    restoreState: (data) => {
      const replaceArr = <T,>(arr: T[], incoming: unknown) => {
        if (Array.isArray(incoming)) arr.splice(0, arr.length, ...(incoming as T[]));
      };
      replaceArr(smartAudienceConfigs, data.smartAudienceConfigs);
      replaceArr(marketingCampaigns, data.marketingCampaigns);
      replaceArr(marketingAutomations, data.marketingAutomations);
      replaceArr(marketingDispatches, data.marketingDispatches);
    },
  });
}

export function getMarketingCampaignsList() {
  return marketingCampaigns;
}

