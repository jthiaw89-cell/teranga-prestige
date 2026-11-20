import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  GitBranch,
  Mail,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Target,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type { AuthSessionSummary } from './LoginScreen';
import type {
  MarketingAudienceMember,
  MarketingAudienceRule,
  MarketingAudienceSource,
  MarketingAutomationStep,
  MarketingCampaignObjective,
  MarketingCampaignRecord,
  MarketingChannel,
  MarketingChannelContent,
  MarketingDispatchStatus,
  MarketingOverviewPayload,
  MarketingRuleField,
  MarketingRuleOperator,
  MarketingStepCondition,
  MarketingTriggerEvent,
  OrganizationOption,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  organization: OrganizationOption;
}

type MarketingTab = 'overview' | 'audiences' | 'campaigns' | 'automations' | 'dispatches';

const CHANNEL_META: Record<
  MarketingChannel,
  { label: string; icon: React.ComponentType<{ className?: string }>; accentText: string }
> = {
  WHATSAPP: { label: 'WhatsApp', icon: MessageCircle, accentText: 'text-emerald-600 dark:text-emerald-400' },
  SMS: { label: 'SMS', icon: Smartphone, accentText: 'text-amber-600 dark:text-amber-400' },
  EMAIL: { label: 'Email', icon: Mail, accentText: 'text-blue-600 dark:text-blue-400' },
  PUSH: { label: 'Push', icon: BellRing, accentText: 'text-indigo-600 dark:text-indigo-400' },
};

const SOURCE_LABELS: Record<MarketingAudienceSource, string> = {
  MULTI_SOURCE: 'Multi-sources (CRM + Devis + Formations)',
  CRM_CONTACTS: 'Contacts & Prospects CRM',
  OPEN_QUOTES: 'Devis ouverts non signés',
  UNPAID_INVOICES: 'Factures partielles / échues',
  TRAINING_REQUESTS: 'Demandes de formation & apprenants',
  EVENT_GUESTS: 'Invités & clients événementiel',
};

const RULE_FIELD_LABELS: Record<MarketingRuleField, string> = {
  MIN_AMOUNT_FCFA: 'Montant dossier min (FCFA)',
  WHATSAPP_OPTIN: 'Consentement WhatsApp actif',
  PIPELINE_STAGE: 'Étape pipeline',
  CONTACT_TYPE: 'Type fiche (client / prospect)',
  SECTOR: 'Secteur d’activité',
  INACTIVE_DAYS: 'Inactivité min (jours)',
  HAS_EMAIL: 'Email renseigné',
  HAS_PHONE: 'Téléphone renseigné',
};

const OBJECTIVE_LABELS: Record<MarketingCampaignObjective, string> = {
  RETARGETING_DEVIS: 'Relance devis',
  RECOUVREMENT_FACTURE: 'Recouvrement facture',
  ABANDON_INSCRIPTION: 'Abandon inscription',
  REACTIVATION_CLIENT: 'Réactivation client',
  EVENEMENT_VIP: 'Invitation VIP',
  PROMOTION_FORMATION: 'Promotion formation',
};

const TRIGGER_LABELS: Record<MarketingTriggerEvent, string> = {
  DEVIS_SANS_REPONSE: 'Devis sans réponse',
  FACTURE_IMPAYEE: 'Facture impayée / partielle',
  INSCRIPTION_FORMATION_INCOMPLETE: 'Inscription formation en attente',
  CONTACT_INACTIF: 'Contact inactif',
  POST_EVENEMENT: 'Suivi post-événement',
};

const CONDITION_LABELS: Record<MarketingStepCondition, string> = {
  ALWAYS: 'Toujours exécuter',
  IF_NO_REPLY: 'Si aucune réponse',
  IF_NO_PAYMENT: 'Si aucun règlement',
};

const DISPATCH_STATUS_LABELS: Record<MarketingDispatchStatus, string> = {
  EN_ATTENTE: 'À envoyer',
  ENVOYE: 'Envoyé',
  DELIVRE: 'Délivré',
  OUVERT: 'Ouvert',
  CLIQUE: 'Cliqué',
  CONVERTI: 'Converti',
  ECHOUE: 'Échec',
};

function formatFcfa(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value || 0))} FCFA`;
}

function buildWhatsappHref(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildMailtoHref(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const MarketingModule: React.FC<Props> = ({ session, organization }) => {
  const [data, setData] = useState<MarketingOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MarketingTab>('overview');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Audience Builder State
  const [showAudienceForm, setShowAudienceForm] = useState(false);
  const [audName, setAudName] = useState('');
  const [audSource, setAudSource] = useState<MarketingAudienceSource>('OPEN_QUOTES');
  const [audMatchMode, setAudMatchMode] = useState<'ALL' | 'ANY'>('ALL');
  const [audChannels, setAudChannels] = useState<MarketingChannel[]>(['WHATSAPP', 'EMAIL', 'SMS']);
  const [audRules, setAudRules] = useState<MarketingAudienceRule[]>([
    { id: 'rule-init-1', field: 'MIN_AMOUNT_FCFA', operator: 'GTE', value: '300000' },
  ]);
  const [previewResult, setPreviewResult] = useState<{
    matchedCount: number;
    reachableWhatsapp: number;
    reachableSms: number;
    reachableEmail: number;
    reachablePush: number;
    potentialValueFcfa: number;
    matchedTargets: MarketingAudienceMember[];
  } | null>(null);
  const [selectedAudienceId, setSelectedAudienceId] = useState<string>('');

  // Campaign Builder State
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campName, setCampName] = useState('');
  const [campObjective, setCampObjective] = useState<MarketingCampaignObjective>('RETARGETING_DEVIS');
  const [campAudienceId, setCampAudienceId] = useState('');
  const [campChannels, setCampChannels] = useState<MarketingChannel[]>(['WHATSAPP', 'EMAIL', 'SMS', 'PUSH']);
  const [campChannelTab, setCampChannelTab] = useState<MarketingChannel>('WHATSAPP');
  const [campScheduledAt, setCampScheduledAt] = useState('');
  const [campMessages, setCampMessages] = useState<Partial<Record<MarketingChannel, MarketingChannelContent>>>({
    WHATSAPP: {
      body: 'Bonjour {nom}, votre dossier de {montant} FCFA reste ouvert chez {organisation}. Souhaitez-vous un point de validation ?',
    },
    SMS: {
      body: '{organisation}: Suivi dossier {nom} ({montant} FCFA). Repondez OUI pour confirmation.',
    },
    EMAIL: {
      subject: 'Suivi de votre dossier — {organisation}',
      body: 'Bonjour {nom},\n\nNous faisons suite à votre demande ({montant} FCFA). Notre équipe reste mobilisée.',
    },
    PUSH: {
      title: 'Action requise sur votre dossier',
      body: '{nom} — Finalisez votre validation ({montant} FCFA).',
    },
  });

  // Automation Builder State
  const [showAutomationForm, setShowAutomationForm] = useState(false);
  const [autoName, setAutoName] = useState('');
  const [autoTrigger, setAutoTrigger] = useState<MarketingTriggerEvent>('DEVIS_SANS_REPONSE');
  const [autoDelay, setAutoDelay] = useState(2);
  const [autoAudienceId, setAutoAudienceId] = useState('');
  const [autoSteps, setAutoSteps] = useState<Array<Partial<MarketingAutomationStep>>>([
    {
      delayDays: 2,
      channel: 'WHATSAPP',
      condition: 'ALWAYS',
      messageTemplate: 'Bonjour {nom}, avez-vous pu consulter notre proposition ({montant} FCFA) ?',
    },
    {
      delayDays: 5,
      channel: 'EMAIL',
      condition: 'IF_NO_REPLY',
      subject: 'Relance proposition — {organisation}',
      messageTemplate: 'Bonjour {nom}, nous restons à votre disposition pour planifier votre projet.',
    },
    {
      delayDays: 9,
      channel: 'SMS',
      condition: 'IF_NO_REPLY',
      messageTemplate: '{organisation}: Dernier rappel sur votre offre ({montant} FCFA).',
    },
  ]);

  // Dispatch Filter State
  const [dispatchChannelFilter, setDispatchChannelFilter] = useState<'ALL' | MarketingChannel>('ALL');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<'ALL' | MarketingDispatchStatus>('ALL');
  const [dispatchSearch, setDispatchSearch] = useState('');

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const json = (await res.json()) as MarketingOverviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Erreur chargement Marketing');
      setData(json);
      if (json.audiences.length > 0) {
        setSelectedAudienceId((prev) => prev || json.audiences[0].id);
        setCampAudienceId((prev) => prev || json.audiences[0].id);
        setAutoAudienceId((prev) => prev || json.audiences[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const runAudiencePreview = useCallback(async () => {
    try {
      const res = await fetch('/api/marketing/audiences/preview', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          sourceScope: audSource,
          matchMode: audMatchMode,
          rules: audRules,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setPreviewResult(json);
      }
    } catch {
      // ignore preview error
    }
  }, [audMatchMode, audRules, audSource, session.space]);

  useEffect(() => {
    if (showAudienceForm) {
      void runAudiencePreview();
    }
  }, [showAudienceForm, runAudiencePreview]);

  async function handleCreateAudience(e: React.FormEvent) {
    e.preventDefault();
    if (!audName.trim()) return;
    setBusyId('create-audience');
    try {
      const res = await fetch('/api/marketing/audiences', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          name: audName.trim(),
          sourceScope: audSource,
          matchMode: audMatchMode,
          rules: audRules,
          preferredChannels: audChannels,
          autoRefresh: true,
        }),
      });
      const json = (await res.json()) as MarketingOverviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Erreur création audience');
      setData(json);
      if (json.audiences[0]) {
        setSelectedAudienceId(json.audiences[0].id);
      }
      setAudName('');
      setShowAudienceForm(false);
      flashNotice('Audience intelligente enregistrée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur création audience');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAudience(id: string) {
    const res = await fetch(`/api/marketing/audiences/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(session.space, false),
      credentials: 'include',
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
      flashNotice('Audience supprimée.');
    }
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campName.trim() || !campAudienceId || campChannels.length === 0) return;
    setBusyId('create-campaign');
    try {
      const res = await fetch('/api/marketing/campaigns', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          name: campName.trim(),
          objective: campObjective,
          audienceId: campAudienceId,
          channels: campChannels,
          channelMessages: campMessages,
          status: campScheduledAt ? 'PLANIFIEE' : 'ACTIVE',
          scheduledAt: campScheduledAt || undefined,
        }),
      });
      const json = (await res.json()) as MarketingOverviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Erreur création campagne');
      setData(json);
      setCampName('');
      setCampScheduledAt('');
      setShowCampaignForm(false);
      flashNotice('Campagne multi-canaux créée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur campagne');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDispatchCampaign(camp: MarketingCampaignRecord) {
    setBusyId(`dispatch-${camp.id}`);
    try {
      const res = await fetch(`/api/marketing/campaigns/${camp.id}/dispatch`, {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
      });
      const json = (await res.json()) as MarketingOverviewPayload & {
        dispatchedNow?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Erreur diffusion');
      setData(json);
      flashNotice(`${json.dispatchedNow || 0} message(s) généré(s) sur ${camp.channels.join(', ')}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur diffusion');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleCampaignStatus(camp: MarketingCampaignRecord) {
    const nextStatus = camp.status === 'ACTIVE' ? 'EN_PAUSE' : 'ACTIVE';
    const res = await fetch(`/api/marketing/campaigns/${camp.id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
    }
  }

  async function handleDeleteCampaign(id: string) {
    const res = await fetch(`/api/marketing/campaigns/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(session.space, false),
      credentials: 'include',
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
      flashNotice('Campagne supprimée.');
    }
  }

  async function handleCreateAutomation(e: React.FormEvent) {
    e.preventDefault();
    if (!autoName.trim() || autoSteps.length === 0) return;
    setBusyId('create-automation');
    try {
      const res = await fetch('/api/marketing/automations', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          name: autoName.trim(),
          triggerEvent: autoTrigger,
          triggerDelayDays: autoDelay,
          audienceId: autoAudienceId || undefined,
          steps: autoSteps,
        }),
      });
      const json = (await res.json()) as MarketingOverviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Erreur automatisation');
      setData(json);
      setAutoName('');
      setShowAutomationForm(false);
      flashNotice('Séquence de relance automatisée créée.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur automatisation');
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleAutomation(id: string) {
    const res = await fetch(`/api/marketing/automations/${id}/toggle`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
    }
  }

  async function handleRunAutomation(id: string) {
    setBusyId(`run-${id}`);
    try {
      const res = await fetch(`/api/marketing/automations/${id}/run`, {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
      });
      const json = (await res.json()) as MarketingOverviewPayload & {
        executedNow?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Erreur exécution');
      setData(json);
      flashNotice(`Cycle exécuté : ${json.executedNow || 0} relance(s) générée(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur exécution');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteAutomation(id: string) {
    const res = await fetch(`/api/marketing/automations/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(session.space, false),
      credentials: 'include',
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
      flashNotice('Automatisation supprimée.');
    }
  }

  async function handleUpdateDispatchStatus(id: string, status: MarketingDispatchStatus) {
    const res = await fetch(`/api/marketing/dispatches/${id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const json = (await res.json()) as MarketingOverviewPayload;
      setData(json);
      flashNotice(`Statut mis à jour : ${DISPATCH_STATUS_LABELS[status]}.`);
    }
  }

  const selectedAudience = useMemo(
    () => data?.audiences.find((a) => a.id === selectedAudienceId) || data?.audiences[0] || null,
    [data?.audiences, selectedAudienceId],
  );

  const filteredDispatches = useMemo(() => {
    const rows = data?.dispatches || [];
    const q = dispatchSearch.trim().toLowerCase();
    return rows.filter((d) => {
      if (dispatchChannelFilter !== 'ALL' && d.channel !== dispatchChannelFilter) return false;
      if (dispatchStatusFilter !== 'ALL' && d.status !== dispatchStatusFilter) return false;
      if (
        q &&
        !d.recipientName.toLowerCase().includes(q) &&
        !d.messageBody.toLowerCase().includes(q) &&
        !(d.campaignName || d.automationName || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data?.dispatches, dispatchChannelFilter, dispatchSearch, dispatchStatusFilter]);

  function toggleChannelSelection(
    list: MarketingChannel[],
    setter: React.Dispatch<React.SetStateAction<MarketingChannel[]>>,
    ch: MarketingChannel,
  ) {
    setter(list.includes(ch) ? (list.length > 1 ? list.filter((c) => c !== ch) : list) : [...list, ch]);
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-24 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse"
            />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
      </div>
    );
  }

  const summary = data?.summary || {
    totalReachableContacts: 0,
    smartAudiencesCount: 0,
    activeCampaignsCount: 0,
    activeAutomationsCount: 0,
    totalDispatched: 0,
    conversionRate: 0,
    recoverablePipelineFcfa: 0,
    recoveredRevenueFcfa: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header & Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Marketing &amp; Retargeting
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{organization.name}</span>
            <span aria-hidden="true">·</span>
            <span>WhatsApp / SMS / Email / Push</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{summary.totalReachableContacts} cibles actives</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void fetchOverview()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Actualiser
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('campaigns');
              setShowCampaignForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvelle campagne
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-fit">
        {(
          [
            { id: 'overview', label: 'Vue d’ensemble' },
            { id: 'audiences', label: `Audiences (${data?.audiences.length || 0})` },
            { id: 'campaigns', label: `Campagnes (${data?.campaigns.length || 0})` },
            { id: 'automations', label: `Automatisations (${data?.automations.length || 0})` },
            { id: 'dispatches', label: `File d’envoi (${data?.dispatches.length || 0})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 4 KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Pipeline récupérable</span>
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                {formatFcfa(summary.recoverablePipelineFcfa)}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                {summary.smartAudiencesCount} segments actifs
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Revenus convertis</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatFcfa(summary.recoveredRevenueFcfa)}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                Conversion {summary.conversionRate}%
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Envois multi-canaux</span>
                <Send className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                {summary.totalDispatched}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                {summary.activeCampaignsCount} campagne(s) active(s)
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Workflows de relance</span>
                <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-2 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                {summary.activeAutomationsCount}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                {summary.totalReachableContacts} cibles éligibles
              </div>
            </div>
          </div>

          {/* Performance par canal */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Performance par canal
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('dispatches')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Voir le journal
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    <th className="text-left font-medium px-5 py-3">Canal</th>
                    <th className="text-right font-medium px-4 py-3">Envois</th>
                    <th className="text-right font-medium px-4 py-3">Délivrés</th>
                    <th className="text-right font-medium px-4 py-3">Engagés</th>
                    <th className="text-right font-medium px-4 py-3">Convertis</th>
                    <th className="text-right font-medium px-5 py-3">Taux conversion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {(data?.channelMetrics || []).map((m) => {
                    const meta = CHANNEL_META[m.channel];
                    const Icon = meta.icon;
                    return (
                      <tr key={m.channel} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5 font-medium text-gray-900 dark:text-gray-100">
                            <Icon className={`w-4 h-4 ${meta.accentText}`} />
                            <span>{meta.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                          {m.dispatched}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                          {m.delivered} ({m.deliveryRate}%)
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                          {m.engaged}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                          {m.converted}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100 font-semibold">
                          {m.conversionRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Actions: Automations + Active Campaigns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Automatisations de relance
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('automations')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Configurer
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.automations || []).map((wf) => (
                  <div key={wf.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {wf.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono tabular-nums">
                        {TRIGGER_LABELS[wf.triggerEvent]} · {wf.steps.length} étapes · {wf.enrolledCount} inscrits
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === `run-${wf.id}`}
                      onClick={() => void handleRunAutomation(wf.id)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap shrink-0"
                    >
                      Exécuter
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Campagnes prioritaires
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('campaigns')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Tout gérer
                </button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.campaigns || []).map((camp) => (
                  <div key={camp.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {camp.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-mono tabular-nums">
                        {camp.channels.join(' / ')} · {camp.targetCount} cibles · {formatFcfa(camp.revenueRecoveredFcfa)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === `dispatch-${camp.id}`}
                      onClick={() => void handleDispatchCampaign(camp)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      Diffuser
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIENCES INTELLIGENTES */}
      {activeTab === 'audiences' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Audiences intelligentes dynamiques
            </h3>
            <button
              type="button"
              onClick={() => setShowAudienceForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAudienceForm ? 'Fermer l’éditeur' : 'Créer un segment'}
            </button>
          </div>

          {showAudienceForm && (
            <form
              onSubmit={handleCreateAudience}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={audName}
                  onChange={(e) => setAudName(e.target.value)}
                  placeholder="Nom du segment (ex : Devis > 1M sans retour)"
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
                <select
                  value={audSource}
                  onChange={(e) => setAudSource(e.target.value as MarketingAudienceSource)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(SOURCE_LABELS) as MarketingAudienceSource[]).map((src) => (
                    <option key={src} value={src}>
                      {SOURCE_LABELS[src]}
                    </option>
                  ))}
                </select>
                <select
                  value={audMatchMode}
                  onChange={(e) => setAudMatchMode(e.target.value as 'ALL' | 'ANY')}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="ALL">Toutes les règles (ET)</option>
                  <option value="ANY">Au moins une règle (OU)</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Critères de ciblage
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAudRules((prev) => [
                        ...prev,
                        {
                          id: `rule-${Date.now()}`,
                          field: 'WHATSAPP_OPTIN',
                          operator: 'IS_TRUE',
                          value: 'true',
                        },
                      ])
                    }
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Ajouter un critère
                  </button>
                </div>

                {audRules.map((rule, idx) => (
                  <div key={rule.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <select
                      value={rule.field}
                      onChange={(e) => {
                        const field = e.target.value as MarketingRuleField;
                        setAudRules((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, field } : r)),
                        );
                      }}
                      className="sm:col-span-5 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    >
                      {(Object.keys(RULE_FIELD_LABELS) as MarketingRuleField[]).map((f) => (
                        <option key={f} value={f}>
                          {RULE_FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                    <select
                      value={rule.operator}
                      onChange={(e) => {
                        const operator = e.target.value as MarketingRuleOperator;
                        setAudRules((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, operator } : r)),
                        );
                      }}
                      className="sm:col-span-3 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    >
                      <option value="GTE">Supérieur ou égal</option>
                      <option value="EQUALS">Égal à</option>
                      <option value="CONTAINS">Contient</option>
                      <option value="NOT_EQUALS">Différent de</option>
                      <option value="IS_TRUE">Actif / Vrai</option>
                    </select>
                    <input
                      type="text"
                      value={rule.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAudRules((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, value: val } : r)),
                        );
                      }}
                      placeholder="Valeur..."
                      className="sm:col-span-3 px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setAudRules((prev) => prev.filter((_, i) => i !== idx))}
                      className="sm:col-span-1 p-2 text-gray-400 hover:text-rose-600 justify-self-end"
                      aria-label="Retirer critère"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Canaux prioritaires :</span>
                  {(['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'] as MarketingChannel[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannelSelection(audChannels, setAudChannels, ch)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        audChannels.includes(ch)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {CHANNEL_META[ch].label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  {previewResult && (
                    <span className="text-xs font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {previewResult.matchedCount} cible(s) · {formatFcfa(previewResult.potentialValueFcfa)}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={busyId === 'create-audience'}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Enregistrer l’audience
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-3">
              {(data?.audiences || []).map((aud) => (
                <div
                  key={aud.id}
                  onClick={() => setSelectedAudienceId(aud.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedAudienceId(aud.id);
                  }}
                  className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                    selectedAudience?.id === aud.id
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                      : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {aud.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {SOURCE_LABELS[aud.sourceScope]}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteAudience(aud.id);
                      }}
                      className="p-1 text-gray-400 hover:text-rose-600 shrink-0"
                      aria-label="Supprimer audience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {aud.matchedCount} cibles
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      WA:{aud.reachableWhatsapp} / SMS:{aud.reachableSms} / Mail:{aud.reachableEmail} / Push:{aud.reachablePush}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      {formatFcfa(aud.potentialValueFcfa)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden h-fit">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {selectedAudience ? selectedAudience.name : 'Aperçu du segment'}
                  </h4>
                </div>
                {selectedAudience && (
                  <button
                    type="button"
                    onClick={() => {
                      setCampAudienceId(selectedAudience.id);
                      setActiveTab('campaigns');
                      setShowCampaignForm(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Créer une campagne
                  </button>
                )}
              </div>

              {!selectedAudience || selectedAudience.matchedTargets.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Aucune cible correspondante pour ce segment.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                        <th className="text-left font-medium px-4 py-3">Contact</th>
                        <th className="text-left font-medium px-4 py-3">Source</th>
                        <th className="text-left font-medium px-4 py-3">Canaux</th>
                        <th className="text-right font-medium px-4 py-3">Enjeu FCFA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedAudience.matchedTargets.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 dark:text-gray-100">{m.name}</div>
                            <div className="text-gray-500 dark:text-gray-400 font-mono">
                              {m.phone || m.email || 'Push interne'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{m.sourceLabel}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {m.channelsAvailable.join(' · ')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {formatFcfa(m.pendingAmountFcfa)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAMPAGNES MULTI-CANAUX */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Campagnes multi-canaux (WhatsApp, SMS, Email, Push)
            </h3>
            <button
              type="button"
              onClick={() => setShowCampaignForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {showCampaignForm ? 'Fermer' : 'Nouvelle campagne'}
            </button>
          </div>

          {showCampaignForm && (
            <form
              onSubmit={handleCreateCampaign}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="Nom de la campagne"
                  className="md:col-span-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
                <select
                  value={campObjective}
                  onChange={(e) => setCampObjective(e.target.value as MarketingCampaignObjective)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(OBJECTIVE_LABELS) as MarketingCampaignObjective[]).map((obj) => (
                    <option key={obj} value={obj}>
                      {OBJECTIVE_LABELS[obj]}
                    </option>
                  ))}
                </select>
                <select
                  value={campAudienceId}
                  onChange={(e) => setCampAudienceId(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(data?.audiences || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.matchedCount})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Canaux activés :</span>
                  {(['WHATSAPP', 'SMS', 'EMAIL', 'PUSH'] as MarketingChannel[]).map((ch) => {
                    const active = campChannels.includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => {
                          toggleChannelSelection(campChannels, setCampChannels, ch);
                          setCampChannelTab(ch);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {CHANNEL_META[ch].label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="datetime-local"
                    value={campScheduledAt}
                    onChange={(e) => setCampScheduledAt(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Channel message composer */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {campChannels.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setCampChannelTab(ch)}
                      className={`px-3 py-1 rounded-md text-xs font-medium ${
                        campChannelTab === ch
                          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      Contenu {CHANNEL_META[ch].label}
                    </button>
                  ))}
                  <span className="text-xs text-gray-400 font-mono ml-auto">
                    {'{nom} {organisation} {montant} {secteur}'}
                  </span>
                </div>

                {(campChannelTab === 'EMAIL' || campChannelTab === 'PUSH') && (
                  <input
                    type="text"
                    value={
                      campChannelTab === 'EMAIL'
                        ? campMessages.EMAIL?.subject || ''
                        : campMessages.PUSH?.title || ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setCampMessages((prev) => ({
                        ...prev,
                        [campChannelTab]: {
                          ...prev[campChannelTab],
                          ...(campChannelTab === 'EMAIL' ? { subject: val } : { title: val }),
                        },
                      }));
                    }}
                    placeholder={campChannelTab === 'EMAIL' ? 'Objet de l’email' : 'Titre de la notification Push'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                )}

                <textarea
                  rows={3}
                  value={campMessages[campChannelTab]?.body || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCampMessages((prev) => ({
                      ...prev,
                      [campChannelTab]: {
                        ...prev[campChannelTab],
                        body: val,
                      },
                    }));
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCampaignForm(false)}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'create-campaign'}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Créer la campagne
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data?.campaigns || []).map((camp) => (
              <div
                key={camp.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {OBJECTIVE_LABELS[camp.objective]} · {camp.channels.join(' / ')} · {camp.status}
                    </div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1 truncate">
                      {camp.name}
                    </h4>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      Audience : {camp.audienceName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCampaign(camp.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 shrink-0"
                    aria-label="Supprimer campagne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Cibles</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {camp.targetCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Envois</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {camp.dispatchedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Engagés</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      {camp.openedOrClickedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Convertis</div>
                    <div className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {camp.convertedCount}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatFcfa(camp.revenueRecoveredFcfa)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleCampaignStatus(camp)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {camp.status === 'ACTIVE' ? 'Mettre en pause' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `dispatch-${camp.id}`}
                      onClick={() => void handleDispatchCampaign(camp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Diffuser
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: AUTOMATISATIONS DE RELANCE */}
      {activeTab === 'automations' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Scénarios de relance automatisés
            </h3>
            <button
              type="button"
              onClick={() => setShowAutomationForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAutomationForm ? 'Fermer' : 'Nouvelle séquence'}
            </button>
          </div>

          {showAutomationForm && (
            <form
              onSubmit={handleCreateAutomation}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={autoName}
                  onChange={(e) => setAutoName(e.target.value)}
                  placeholder="Nom de la séquence"
                  className="md:col-span-2 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
                <select
                  value={autoTrigger}
                  onChange={(e) => setAutoTrigger(e.target.value as MarketingTriggerEvent)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(TRIGGER_LABELS) as MarketingTriggerEvent[]).map((tr) => (
                    <option key={tr} value={tr}>
                      {TRIGGER_LABELS[tr]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">Délai (j) :</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={autoDelay}
                    onChange={(e) => setAutoDelay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Étapes de relance multi-canaux
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAutoSteps((prev) => [
                        ...prev,
                        {
                          delayDays: (prev[prev.length - 1]?.delayDays || 0) + 3,
                          channel: 'SMS',
                          condition: 'IF_NO_REPLY',
                          messageTemplate: 'Rappel : {nom}, dossier en attente ({montant} FCFA).',
                        },
                      ])
                    }
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Ajouter une étape
                  </button>
                </div>

                {autoSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <span className="sm:col-span-2 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                        Étape {idx + 1}
                      </span>
                      <div className="sm:col-span-2 flex items-center gap-1">
                        <span className="text-xs text-gray-500">J+</span>
                        <input
                          type="number"
                          min={0}
                          value={step.delayDays ?? 1}
                          onChange={(e) => {
                            const delayDays = Number(e.target.value);
                            setAutoSteps((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, delayDays } : s)),
                            );
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                      <select
                        value={step.channel || 'WHATSAPP'}
                        onChange={(e) => {
                          const channel = e.target.value as MarketingChannel;
                          setAutoSteps((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, channel } : s)),
                          );
                        }}
                        className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                        <option value="EMAIL">Email</option>
                        <option value="PUSH">Push</option>
                      </select>
                      <select
                        value={step.condition || 'IF_NO_REPLY'}
                        onChange={(e) => {
                          const condition = e.target.value as MarketingStepCondition;
                          setAutoSteps((prev) =>
                            prev.map((s, i) => (i === idx ? { ...s, condition } : s)),
                          );
                        }}
                        className="sm:col-span-4 px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      >
                        {(Object.keys(CONDITION_LABELS) as MarketingStepCondition[]).map((c) => (
                          <option key={c} value={c}>
                            {CONDITION_LABELS[c]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setAutoSteps((prev) => prev.filter((_, i) => i !== idx))}
                        className="sm:col-span-1 p-1.5 text-gray-400 hover:text-rose-600 justify-self-end"
                        aria-label="Supprimer étape"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={step.messageTemplate || ''}
                      onChange={(e) => {
                        const messageTemplate = e.target.value;
                        setAutoSteps((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, messageTemplate } : s)),
                        );
                      }}
                      placeholder="Modèle de message ({nom}, {organisation}, {montant})"
                      className="w-full px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAutomationForm(false)}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busyId === 'create-automation'}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Activer la séquence
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {(data?.automations || []).map((wf) => (
              <div
                key={wf.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <GitBranch className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{TRIGGER_LABELS[wf.triggerEvent]}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">J+{wf.triggerDelayDays}</span>
                      <span aria-hidden="true">·</span>
                      <span>{wf.status}</span>
                    </div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
                      {wf.name}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleToggleAutomation(wf.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {wf.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {wf.status === 'ACTIVE' ? 'Pause' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `run-${wf.id}`}
                      onClick={() => void handleRunAutomation(wf.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Exécuter le cycle
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAutomation(wf.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600"
                      aria-label="Supprimer automatisation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Sequence steps row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {wf.steps.map((st) => {
                    const meta = CHANNEL_META[st.channel];
                    const Icon = meta.icon;
                    return (
                      <div
                        key={st.id}
                        className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900 dark:text-gray-100">
                            <Icon className={`w-3.5 h-3.5 ${meta.accentText}`} />
                            J+{st.delayDays} · {meta.label}
                          </span>
                          <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400">
                            {st.sentCount} envoi(s)
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {CONDITION_LABELS[st.condition]}
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                          {st.messageTemplate}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums text-gray-600 dark:text-gray-400">
                  <span>Inscrits : {wf.enrolledCount}</span>
                  <span>Terminés : {wf.completedCount}</span>
                  <span>Conversions : {wf.conversionsCount}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Récupéré : {formatFcfa(wf.recoveredFcfa)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: FILE D'ENVOI & JOURNAL MULTI-CANAUX */}
      {activeTab === 'dispatches' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400 mr-1" />
              {(['ALL', 'WHATSAPP', 'SMS', 'EMAIL', 'PUSH'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setDispatchChannelFilter(ch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    dispatchChannelFilter === ch
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {ch === 'ALL' ? 'Tous canaux' : CHANNEL_META[ch].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dispatchSearch}
                  onChange={(e) => setDispatchSearch(e.target.value)}
                  placeholder="Filtrer destinataire..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
              </div>
              <select
                value={dispatchStatusFilter}
                onChange={(e) =>
                  setDispatchStatusFilter(e.target.value as 'ALL' | MarketingDispatchStatus)
                }
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Tous statuts</option>
                {(Object.keys(DISPATCH_STATUS_LABELS) as MarketingDispatchStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {DISPATCH_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            {filteredDispatches.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucun envoi correspondant aux filtres sélectionnés.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                      <th className="text-left font-medium px-4 py-3">Destinataire</th>
                      <th className="text-left font-medium px-4 py-3">Canal</th>
                      <th className="text-left font-medium px-4 py-3">Origine &amp; Message</th>
                      <th className="text-right font-medium px-4 py-3">Enjeu</th>
                      <th className="text-left font-medium px-4 py-3">Statut</th>
                      <th className="text-right font-medium px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredDispatches.map((d) => {
                      const meta = CHANNEL_META[d.channel];
                      const Icon = meta.icon;
                      return (
                        <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {d.recipientName}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 font-mono">
                              {d.channel === 'EMAIL'
                                ? d.recipientEmail || '—'
                                : d.recipientPhone || d.recipientEmail || 'Push'}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className="inline-flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                              <Icon className={`w-3.5 h-3.5 ${meta.accentText}`} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top max-w-md">
                            <div className="text-gray-500 dark:text-gray-400">
                              {d.campaignName || d.automationName || 'Envoi direct'} · {d.createdAt}
                            </div>
                            <div className="text-gray-800 dark:text-gray-200 mt-0.5 line-clamp-2">
                              {d.messageBody}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-right font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatFcfa(d.amountRelatedFcfa)}
                          </td>
                          <td className="px-4 py-3 align-top whitespace-nowrap font-medium text-gray-700 dark:text-gray-300">
                            {DISPATCH_STATUS_LABELS[d.status]}
                          </td>
                          <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {d.channel === 'WHATSAPP' && d.recipientPhone && (
                                <a
                                  href={buildWhatsappHref(d.recipientPhone, d.messageBody)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => void handleUpdateDispatchStatus(d.id, 'ENVOYE')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Ouvrir
                                </a>
                              )}
                              {d.channel === 'EMAIL' && d.recipientEmail && (
                                <a
                                  href={buildMailtoHref(
                                    d.recipientEmail,
                                    d.subject || d.campaignName || 'Relance',
                                    d.messageBody,
                                  )}
                                  onClick={() => void handleUpdateDispatchStatus(d.id, 'ENVOYE')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                                >
                                  <Mail className="w-3 h-3" />
                                  Envoyer
                                </a>
                              )}
                              {d.status !== 'OUVERT' && d.status !== 'CONVERTI' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateDispatchStatus(d.id, 'OUVERT')}
                                  className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Ouvert
                                </button>
                              )}
                              {d.status !== 'CONVERTI' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateDispatchStatus(d.id, 'CONVERTI')}
                                  className="px-2 py-1 rounded-md bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[11px] font-semibold"
                                >
                                  Converti
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
