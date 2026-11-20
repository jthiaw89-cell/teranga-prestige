import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  Layers,
  ListChecks,
  MapPin,
  Plane,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { exportWorkReportPdf } from '../lib/reportPdfExport';
import type { AuthSessionSummary } from './LoginScreen';
import type {
  OrganizationOption,
  WorkReportActionItem,
  WorkReportKpiItem,
  WorkReportMissionOption,
  WorkReportRecord,
  WorkReportStatus,
  WorkReportTaskOption,
  WorkReportTemplate,
  WorkReportType,
  WorkReportsOverviewPayload,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  organization?: OrganizationOption;
}

type ReportsTab = 'list' | 'editor' | 'templates';

const TYPE_META: Record<
  WorkReportType,
  { label: string; shortLabel: string; badgeClass: string }
> = {
  RAPPORT_MISSION: {
    label: 'Rapport de Mission',
    shortLabel: 'Mission',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  RAPPORT_TRAVAIL_HEBDO: {
    label: 'Travail Hebdomadaire',
    shortLabel: 'Hebdo',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  RAPPORT_TRAVAIL_MENSUEL: {
    label: 'Activité Mensuelle',
    shortLabel: 'Mensuel',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  RAPPORT_PROJET: {
    label: 'Avancement Projet',
    shortLabel: 'Projet',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  },
  RAPPORT_DIRECTION: {
    label: 'Rapport de Direction',
    shortLabel: 'Direction',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
};

const STATUS_META: Record<WorkReportStatus, { label: string; className: string }> = {
  BROUILLON: {
    label: 'Brouillon',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  SOUMIS: {
    label: 'Soumis (Attente visa)',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  REVISION_DEMANDEE: {
    label: 'Révision demandée',
    className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
  VALIDE: {
    label: 'Validé',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  ARCHIVE: {
    label: 'Archivé',
    className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  },
};

interface DraftFormState {
  editingId: string | null;
  type: WorkReportType;
  title: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  location: string;
  linkedMissionId: string;
  linkedTaskCodes: string[];
  executiveSummary: string;
  contextAndObjectives: string;
  activitiesAndDeliverables: string;
  difficultiesAndRisks: string;
  recommendationsAndNextSteps: string;
  kpis: WorkReportKpiItem[];
  actionPlan: WorkReportActionItem[];
  attachmentsNote: string;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekStartIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function createEmptyDraft(
  defaultType: WorkReportType = 'RAPPORT_TRAVAIL_HEBDO',
  authorName = '',
): DraftFormState {
  const start = getWeekStartIso();
  const end = getTodayIso();
  return {
    editingId: null,
    type: defaultType,
    title: '',
    periodLabel: defaultType === 'RAPPORT_MISSION' ? `${start} — ${end}` : `Semaine du ${start} au ${end}`,
    startDate: start,
    endDate: end,
    location: 'Dakar Plateau',
    linkedMissionId: '',
    linkedTaskCodes: [],
    executiveSummary: '',
    contextAndObjectives: '',
    activitiesAndDeliverables: '',
    difficultiesAndRisks: '',
    recommendationsAndNextSteps: '',
    kpis: [],
    actionPlan: [
      {
        id: `act-${Date.now()}`,
        action: '',
        owner: authorName,
        deadline: end,
        priority: 'NORMALE',
        status: 'A_LANCER',
      },
    ],
    attachmentsNote: '',
  };
}

function computeDraftCompleteness(d: DraftFormState): { pct: number; words: number } {
  const checks = [
    Boolean(d.title.trim()),
    Boolean(d.periodLabel.trim()),
    Boolean(d.executiveSummary.trim().length >= 20),
    Boolean(d.contextAndObjectives.trim().length >= 20),
    Boolean(d.activitiesAndDeliverables.trim().length >= 20),
    Boolean(d.difficultiesAndRisks.trim()),
    Boolean(d.recommendationsAndNextSteps.trim()),
    Boolean(d.kpis.some((k) => k.label.trim()) || d.actionPlan.some((a) => a.action.trim())),
  ];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const full = [
    d.title,
    d.executiveSummary,
    d.contextAndObjectives,
    d.activitiesAndDeliverables,
    d.difficultiesAndRisks,
    d.recommendationsAndNextSteps,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
  return { pct, words: full ? full.split(/\s+/).filter(Boolean).length : 0 };
}

export const ReportsModule: React.FC<Props> = ({ session, organization }) => {
  const [data, setData] = useState<WorkReportsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ReportsTab>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | WorkReportType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WorkReportStatus>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MINE' | 'TO_REVIEW'>('ALL');

  const [selectedReport, setSelectedReport] = useState<WorkReportRecord | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [showTaskPicker, setShowTaskPicker] = useState(false);

  const [draft, setDraft] = useState<DraftFormState>(() =>
    createEmptyDraft(
      session.role === 'OWNER' || session.role === 'DIRECTION'
        ? 'RAPPORT_DIRECTION'
        : session.role === 'MANAGER'
          ? 'RAPPORT_TRAVAIL_MENSUEL'
          : 'RAPPORT_TRAVAIL_HEBDO',
      session.name,
    ),
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reports/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Chargement impossible.');
      }
      const payload = (await res.json()) as WorkReportsOverviewPayload;
      setData(payload);
      setSelectedReport((prev) =>
        prev ? payload.reports.find((r) => r.id === prev.id) || payload.reports[0] || null : payload.reports[0] || null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const templates = data?.templates || [];
  const missionsCatalog = data?.missionsCatalog || [];
  const tasksCatalog = data?.tasksCatalog || [];

  const activeTemplate = useMemo(
    () => templates.find((t) => t.type === draft.type) || templates[0] || null,
    [templates, draft.type],
  );

  const draftStats = useMemo(() => computeDraftCompleteness(draft), [draft]);

  const filteredReports = useMemo(() => {
    const reports = data?.reports || [];
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (scopeFilter === 'MINE' && r.authorUserId !== session.userId) return false;
      if (scopeFilter === 'TO_REVIEW' && (r.status !== 'SOUMIS' || r.authorUserId === session.userId)) {
        return false;
      }
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.authorName.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        (r.linkedMissionRef || '').toLowerCase().includes(q)
      );
    });
  }, [data?.reports, searchQuery, typeFilter, statusFilter, scopeFilter, session.userId]);

  function applyTemplate(tpl: WorkReportTemplate, keepExistingTitle = false) {
    setDraft((prev) => ({
      ...prev,
      editingId: keepExistingTitle ? prev.editingId : null,
      type: tpl.type,
      title:
        keepExistingTitle && prev.title.trim()
          ? prev.title
          : `${tpl.title.split('(')[0].trim()} — ${session.name}`,
      contextAndObjectives: prev.contextAndObjectives.trim()
        ? prev.contextAndObjectives
        : tpl.contextPrompts[0] || tpl.defaultObjective,
      kpis:
        prev.kpis.length > 0
          ? prev.kpis
          : tpl.suggestedKpis.map((sk, idx) => ({
              id: `kpi-tpl-${Date.now()}-${idx}`,
              label: sk.label,
              targetValue: sk.targetValue,
              actualValue: '',
              unit: sk.unit,
              status: 'EN_COURS',
            })),
    }));
    setActiveTab('editor');
    setFeedback(`Trame « ${tpl.code} » chargée dans l’atelier.`);
  }

  function handleStartNewReport(type: WorkReportType) {
    const tpl = templates.find((t) => t.type === type);
    const fresh = createEmptyDraft(type, session.name);
    if (tpl) {
      fresh.contextAndObjectives = tpl.contextPrompts[0] || tpl.defaultObjective;
      fresh.kpis = tpl.suggestedKpis.map((sk, idx) => ({
        id: `kpi-${Date.now()}-${idx}`,
        label: sk.label,
        targetValue: sk.targetValue,
        actualValue: '',
        unit: sk.unit,
        status: 'EN_COURS',
      }));
    }
    setDraft(fresh);
    setActiveTab('editor');
    setFeedback(null);
    setError(null);
  }

  function handleEditReport(r: WorkReportRecord) {
    setDraft({
      editingId: r.id,
      type: r.type,
      title: r.title,
      periodLabel: r.periodLabel,
      startDate: r.startDate,
      endDate: r.endDate,
      location: r.location || '',
      linkedMissionId: r.linkedMissionId || '',
      linkedTaskCodes: r.linkedTaskCodes || [],
      executiveSummary: r.executiveSummary,
      contextAndObjectives: r.contextAndObjectives,
      activitiesAndDeliverables: r.activitiesAndDeliverables,
      difficultiesAndRisks: r.difficultiesAndRisks,
      recommendationsAndNextSteps: r.recommendationsAndNextSteps,
      kpis: r.kpis.length > 0 ? r.kpis : [],
      actionPlan: r.actionPlan.length > 0 ? r.actionPlan : [],
      attachmentsNote: r.attachmentsNote || '',
    });
    setActiveTab('editor');
    setError(null);
    setFeedback(null);
  }

  function handlePrefillFromMission(missionId: string) {
    const mission: WorkReportMissionOption | undefined = missionsCatalog.find((m) => m.id === missionId);
    if (!mission) {
      setDraft((prev) => ({ ...prev, linkedMissionId: '' }));
      return;
    }

    const budgetLine: WorkReportKpiItem = {
      id: `kpi-mis-${Date.now()}-1`,
      label: 'Exécution budgétaire mission',
      targetValue: `${new Intl.NumberFormat('fr-FR').format(mission.totalEstimatedFcfa)} FCFA`,
      actualValue: mission.actualSpentFcfa
        ? `${new Intl.NumberFormat('fr-FR').format(mission.actualSpentFcfa)} FCFA`
        : `${new Intl.NumberFormat('fr-FR').format(mission.totalEstimatedFcfa)} FCFA`,
      unit: 'FCFA',
      status: 'ATTEINT',
    };
    const daysLine: WorkReportKpiItem = {
      id: `kpi-mis-${Date.now()}-2`,
      label: 'Durée terrain effectuée',
      targetValue: String(mission.daysCount),
      actualValue: String(mission.daysCount),
      unit: 'jours',
      status: 'ATTEINT',
    };

    setDraft((prev) => ({
      ...prev,
      type: 'RAPPORT_MISSION',
      linkedMissionId: mission.id,
      title: prev.title.trim() || `Rapport de mission ${mission.reference} — ${mission.title}`,
      periodLabel: `${mission.departureDate} au ${mission.returnDate} (${mission.daysCount} j)`,
      startDate: mission.departureDate,
      endDate: mission.returnDate,
      location: mission.destination,
      contextAndObjectives:
        prev.contextAndObjectives.trim() ||
        `Dans le cadre de l’ordre de mission ${mission.reference} (${mission.department}), mission conduite à ${mission.destination} par ${mission.agentName} pour : ${mission.title}.`,
      activitiesAndDeliverables:
        prev.activitiesAndDeliverables.trim() ||
        `• Déplacement effectué à ${mission.destination} du ${mission.departureDate} au ${mission.returnDate}.\n• Rencontre des interlocuteurs locaux et exécution des objectifs de l’ordre de mission ${mission.reference}.\n• Rassemblement des justificatifs et état de frais.`,
      kpis: [budgetLine, daysLine],
    }));
    setFeedback(`Données pré-remplies depuis ${mission.reference} (${mission.destination}).`);
  }

  function handleImportTask(task: WorkReportTaskOption) {
    const bullet = `• [${task.code}] ${task.title} (${task.status === 'TERMINE' ? 'Clôturée' : task.status === 'EN_REVISION' ? 'En révision' : 'En cours'}${task.linkedRecordLabel ? ` · ${task.linkedRecordLabel}` : ''})`;
    setDraft((prev) => {
      const codes = prev.linkedTaskCodes.includes(task.code)
        ? prev.linkedTaskCodes
        : [...prev.linkedTaskCodes, task.code];
      const existing = prev.activitiesAndDeliverables.trim();
      const alreadyHasLine = existing.includes(task.code);
      return {
        ...prev,
        linkedTaskCodes: codes,
        activitiesAndDeliverables: alreadyHasLine
          ? existing
          : existing
            ? `${existing}\n${bullet}`
            : bullet,
      };
    });
  }

  function handleImportAllCompletedTasks() {
    const relevant = tasksCatalog.filter((t) => t.status === 'TERMINE' || t.status === 'EN_REVISION').slice(0, 6);
    if (relevant.length === 0) {
      setFeedback('Aucune tâche terminée ou en révision trouvée.');
      return;
    }
    relevant.forEach(handleImportTask);
    setFeedback(`${relevant.length} tâche(s) importée(s) dans les réalisations.`);
    setShowTaskPicker(false);
  }

  function appendPromptToField(
    field:
      | 'contextAndObjectives'
      | 'activitiesAndDeliverables'
      | 'difficultiesAndRisks'
      | 'recommendationsAndNextSteps',
    snippet: string,
  ) {
    setDraft((prev) => {
      const current = prev[field].trim();
      if (current.includes(snippet)) return prev;
      return {
        ...prev,
        [field]: current ? `${current}\n${snippet}` : snippet,
      };
    });
  }

  function handleAssembleExecutiveSummary() {
    const typeLabel = TYPE_META[draft.type].label;
    const firstActivity = draft.activitiesAndDeliverables
      .split('\n')
      .map((l) => l.replace(/^[•\-]\s*/, '').trim())
      .find(Boolean);
    const firstRec = draft.recommendationsAndNextSteps
      .split('\n')
      .map((l) => l.replace(/^[•\-]\s*/, '').trim())
      .find(Boolean);
    const validKpisCount = draft.kpis.filter((k) => k.label.trim()).length;
    const validActionsCount = draft.actionPlan.filter((a) => a.action.trim()).length;

    const parts = [
      `${typeLabel} (${draft.periodLabel || `${draft.startDate} – ${draft.endDate}`}${draft.location ? ` · ${draft.location}` : ''}).`,
      firstActivity ? `Fait marquant : ${firstActivity}.` : '',
      validKpisCount > 0 ? `${validKpisCount} indicateur(s) suivi(s)` + (validActionsCount > 0 ? ` et ${validActionsCount} action(s) planifiée(s).` : '.') : '',
      firstRec ? `Priorité proposée : ${firstRec}.` : '',
    ].filter(Boolean);

    setDraft((prev) => ({
      ...prev,
      executiveSummary: parts.join(' '),
    }));
    setFeedback('Synthèse exécutive assemblée.');
  }

  async function handleSaveReport(submitNow: boolean) {
    if (!draft.title.trim()) {
      setError('Renseignez le titre du rapport.');
      return;
    }
    if (submitNow && (!draft.activitiesAndDeliverables.trim() || !draft.contextAndObjectives.trim())) {
      setError('Complétez le contexte et les réalisations avant soumission.');
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const payloadBody = {
        type: draft.type,
        title: draft.title.trim(),
        periodLabel: draft.periodLabel.trim(),
        startDate: draft.startDate,
        endDate: draft.endDate,
        location: draft.location.trim(),
        linkedMissionId: draft.linkedMissionId || undefined,
        linkedTaskCodes: draft.linkedTaskCodes,
        executiveSummary: draft.executiveSummary.trim(),
        contextAndObjectives: draft.contextAndObjectives.trim(),
        activitiesAndDeliverables: draft.activitiesAndDeliverables.trim(),
        difficultiesAndRisks: draft.difficultiesAndRisks.trim(),
        recommendationsAndNextSteps: draft.recommendationsAndNextSteps.trim(),
        kpis: draft.kpis.filter((k) => k.label.trim()),
        actionPlan: draft.actionPlan.filter((a) => a.action.trim()),
        attachmentsNote: draft.attachmentsNote.trim(),
        submitNow,
      };

      const url = draft.editingId ? `/api/reports/${draft.editingId}` : '/api/reports';
      const method = draft.editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify(payloadBody),
      });
      const json = (await res.json()) as WorkReportsOverviewPayload & {
        report?: WorkReportRecord;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Enregistrement impossible.');

      setData(json);
      if (json.report) {
        setSelectedReport(json.report);
      }
      setActiveTab('list');
      setFeedback(
        submitNow
          ? `Rapport ${json.report?.reference || ''} soumis pour validation.`
          : `Brouillon ${json.report?.reference || ''} enregistré.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewAction(
    reportId: string,
    action: 'SUBMIT' | 'APPROVE' | 'REQUEST_REVISION' | 'ARCHIVE',
  ) {
    if (action === 'REQUEST_REVISION' && !reviewComment.trim()) {
      setError('Indiquez le motif de révision.');
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/review`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ action, note: reviewComment.trim() || undefined }),
      });
      const json = (await res.json()) as WorkReportsOverviewPayload & {
        report?: WorkReportRecord;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Action impossible.');
      setData(json);
      if (json.report) setSelectedReport(json.report);
      setReviewComment('');
      setFeedback('Statut du rapport mis à jour.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteReport(reportId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const json = (await res.json()) as WorkReportsOverviewPayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Suppression impossible.');
      setData(json);
      setSelectedReport(json.reports[0] || null);
      setFeedback('Rapport supprimé.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur suppression.');
    } finally {
      setSaving(false);
    }
  }

  const orgName = organization?.name || session.organizationName || 'Teranga Prestige Digital';

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                Rapports de Mission &amp; Rapports de Travail
              </h2>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {data?.actorRoleGroup === 'DIRECTION'
                  ? 'Mode Direction'
                  : data?.actorRoleGroup === 'MANAGER'
                    ? 'Mode Manager'
                    : 'Mode Employé'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {session.name} · {orgName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartNewReport('RAPPORT_MISSION')}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Plane className="w-3.5 h-3.5" />
            Rapport de Mission
          </button>
          <button
            type="button"
            onClick={() =>
              handleStartNewReport(
                data?.actorRoleGroup === 'DIRECTION'
                  ? 'RAPPORT_DIRECTION'
                  : data?.actorRoleGroup === 'MANAGER'
                    ? 'RAPPORT_TRAVAIL_MENSUEL'
                    : 'RAPPORT_TRAVAIL_HEBDO',
              )
            }
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Rapport de Travail
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total dossiers</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {data?.stats.total ?? 0}
          </div>
          <div className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            {data?.stats.missionReportsCount ?? 0} mission · {data?.stats.workReportsCount ?? 0} travail
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">En attente de visa</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {data?.stats.submitted ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Soumis hiérarchie</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Brouillons / Révisions</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {(data?.stats.drafts ?? 0) + (data?.stats.revisionRequested ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            {data?.stats.revisionRequested ?? 0} à compléter
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Rapports validés</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {data?.stats.validated ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Prêts pour export PDF</div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
            activeTab === 'list'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Registre &amp; Validation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
            activeTab === 'editor'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          {draft.editingId ? 'Édition du rapport' : 'Atelier de Rédaction'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
            activeTab === 'templates'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Modèles par Rôle ({templates.length})
        </button>
      </div>

      {/* Feedback / Errors */}
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
          Chargement des rapports...
        </div>
      ) : null}

      {/* ================================================================= */}
      {/* TAB 1 : REGISTRE & VALIDATION                                     */}
      {/* ================================================================= */}
      {activeTab === 'list' && data && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left column: Filters + Reports list */}
          <div className="xl:col-span-5 space-y-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher référence, titre, auteur, mission..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as 'ALL' | 'MINE' | 'TO_REVIEW')}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Tous périmètres</option>
                  <option value="MINE">Mes rapports</option>
                  {data.canReviewReports && <option value="TO_REVIEW">À viser (Équipe)</option>}
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as 'ALL' | WorkReportType)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">Tous types</option>
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | WorkReportStatus)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 col-span-2 sm:col-span-1"
                >
                  <option value="ALL">Tous statuts</option>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredReports.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center text-xs text-slate-500">
                  Aucun rapport correspondant.
                </div>
              ) : (
                filteredReports.map((r) => {
                  const isSelected = selectedReport?.id === r.id;
                  const tMeta = TYPE_META[r.type];
                  const sMeta = STATUS_META[r.status];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReport(r)}
                      className={`w-full text-left rounded-xl border p-3.5 transition ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-500'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            {r.reference}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${tMeta.badgeClass}`}>
                            {tMeta.shortLabel}
                          </span>
                          {r.linkedMissionRef && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {r.linkedMissionRef}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border shrink-0 ${sMeta.className}`}>
                          {sMeta.label}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {r.title}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="truncate">
                          {r.authorName} · {r.department}
                        </span>
                        <span className="font-mono shrink-0">{r.completenessPct}% · {r.wordCount} mots</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right column: Selected Report Detail & Validation Panel */}
          <div className="xl:col-span-7">
            {!selectedReport ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-xs text-slate-500">
                Sélectionnez un rapport dans la liste.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
                {/* Detail Top */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200">
                        {selectedReport.reference}
                      </span>
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${TYPE_META[selectedReport.type].badgeClass}`}>
                        {TYPE_META[selectedReport.type].label}
                      </span>
                      <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${STATUS_META[selectedReport.status].className}`}>
                        {STATUS_META[selectedReport.status].label}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedReport.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{selectedReport.authorName} ({selectedReport.authorJobTitle})</span>
                      <span>{selectedReport.periodLabel}</span>
                      {selectedReport.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedReport.location}
                        </span>
                      )}
                      {selectedReport.linkedMissionRef && (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-400">
                          <Plane className="w-3.5 h-3.5" />
                          {selectedReport.linkedMissionRef}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => exportWorkReportPdf(selectedReport, orgName)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exporter PDF
                    </button>

                    {(selectedReport.authorUserId === session.userId || data.canFinalValidate) &&
                      selectedReport.status !== 'VALIDE' &&
                      selectedReport.status !== 'ARCHIVE' && (
                        <button
                          type="button"
                          onClick={() => handleEditReport(selectedReport)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Modifier
                        </button>
                      )}

                    {(selectedReport.authorUserId === session.userId || data.canFinalValidate) &&
                      (selectedReport.status === 'BROUILLON' || data.canFinalValidate) && (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDeleteReport(selectedReport.id)}
                          className="min-h-[36px] p-2 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                  </div>
                </div>

                {/* Review alert if revision requested */}
                {selectedReport.reviewNote && (
                  <div
                    className={`rounded-lg border px-3.5 py-2.5 text-xs ${
                      selectedReport.status === 'REVISION_DEMANDEE'
                        ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-200'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
                    }`}
                  >
                    <span className="font-semibold">Visa / Note ({selectedReport.reviewerName || 'Hiérarchie'}) : </span>
                    {selectedReport.reviewNote}
                  </div>
                )}

                {/* Executive Summary */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3.5 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Synthèse exécutive
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {selectedReport.executiveSummary || 'Non renseignée.'}
                  </p>
                </div>

                {/* Structured Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      1. Contexte &amp; Objectifs
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line rounded-lg border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                      {selectedReport.contextAndObjectives || '—'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      2. Activités réalisées &amp; Livrables
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line rounded-lg border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                      {selectedReport.activitiesAndDeliverables || '—'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      3. Difficultés &amp; Risques
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line rounded-lg border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                      {selectedReport.difficultiesAndRisks || '—'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      4. Recommandations &amp; Suites
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line rounded-lg border border-slate-100 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/30">
                      {selectedReport.recommendationsAndNextSteps || '—'}
                    </div>
                  </div>
                </div>

                {/* KPIs Table */}
                {selectedReport.kpis.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Indicateurs chiffrés (KPI)
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold">Indicateur</th>
                            <th className="text-right px-3 py-2 font-semibold">Cible</th>
                            <th className="text-right px-3 py-2 font-semibold">Réalisé</th>
                            <th className="text-center px-3 py-2 font-semibold">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedReport.kpis.map((k) => (
                            <tr key={k.id}>
                              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{k.label}</td>
                              <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                                {k.targetValue} {k.unit || ''}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                                {k.actualValue || '—'} {k.unit || ''}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    k.status === 'ATTEINT'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : k.status === 'ECART'
                                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                  }`}
                                >
                                  {k.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Action Plan */}
                {selectedReport.actionPlan.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Plan d’action
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="text-left px-3 py-2 font-semibold">Action</th>
                            <th className="text-left px-3 py-2 font-semibold">Responsable</th>
                            <th className="text-left px-3 py-2 font-semibold">Échéance</th>
                            <th className="text-center px-3 py-2 font-semibold">Priorité</th>
                            <th className="text-center px-3 py-2 font-semibold">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedReport.actionPlan.map((a) => (
                            <tr key={a.id}>
                              <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{a.action}</td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{a.owner || '—'}</td>
                              <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{a.deadline || '—'}</td>
                              <td className="px-3 py-2 text-center font-semibold">{a.priority}</td>
                              <td className="px-3 py-2 text-center font-mono">{a.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Linked tasks & attachments */}
                {(selectedReport.linkedTaskCodes.length > 0 || selectedReport.attachmentsNote) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    {selectedReport.linkedTaskCodes.map((code) => (
                      <span
                        key={code}
                        className="px-2 py-0.5 rounded bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-mono"
                      >
                        {code}
                      </span>
                    ))}
                    {selectedReport.attachmentsNote && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                        Pièces : {selectedReport.attachmentsNote}
                      </span>
                    )}
                  </div>
                )}

                {/* Validation / Submission Action Bar */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      Circuit de validation
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {selectedReport.reviewTrail.length} étape(s)
                    </span>
                  </div>

                  {/* Author Submit Button if Draft/Revision */}
                  {(selectedReport.status === 'BROUILLON' || selectedReport.status === 'REVISION_DEMANDEE') &&
                    (selectedReport.authorUserId === session.userId || data.canFinalValidate) && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleReviewAction(selectedReport.id, 'SUBMIT')}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Soumettre pour validation
                      </button>
                    )}

                  {/* Manager / Direction Review Controls */}
                  {data.canReviewReports &&
                    selectedReport.status === 'SOUMIS' &&
                    (selectedReport.authorUserId !== session.userId || data.canFinalValidate) && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={reviewComment}
                          onChange={(e) => setReviewComment(e.target.value)}
                          placeholder="Commentaire de visa ou éléments à compléter..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleReviewAction(selectedReport.id, 'APPROVE')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Valider (Visa)
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleReviewAction(selectedReport.id, 'REQUEST_REVISION')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Demander révision
                          </button>
                        </div>
                      </div>
                    )}

                  {selectedReport.status === 'VALIDE' &&
                    (data.canFinalValidate || selectedReport.authorUserId === session.userId) && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleReviewAction(selectedReport.id, 'ARCHIVE')}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        Archiver
                      </button>
                    )}

                  <div className="space-y-1.5 pt-1">
                    {selectedReport.reviewTrail.map((step) => (
                      <div
                        key={step.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] border-t border-slate-200/70 dark:border-slate-800 pt-1.5"
                      >
                        <div className="text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{step.stepLabel}</span> · {step.actorName} ({step.actorRole})
                          {step.note ? ` — « ${step.note} »` : ''}
                        </div>
                        <span className="font-mono text-slate-400">
                          {new Date(step.timestamp).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2 : ATELIER DE RÉDACTION STRUCTURÉ                            */}
      {/* ================================================================= */}
      {activeTab === 'editor' && (
        <div className="space-y-4">
          {/* Smart Pre-fill & Toolbar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draft.type}
                  onChange={(e) => {
                    const nextType = e.target.value as WorkReportType;
                    setDraft((prev) => ({ ...prev, type: nextType }));
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {Object.entries(TYPE_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>

                {/* Pre-fill from Mission Order */}
                <select
                  value={draft.linkedMissionId}
                  onChange={(e) => handlePrefillFromMission(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 font-medium max-w-[260px]"
                >
                  <option value="">Pré-remplir depuis Ordre de Mission...</option>
                  {missionsCatalog.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.reference} · {m.destination} ({m.agentName})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowTaskPicker((v) => !v)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-violet-300 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  Importer Tâches ({tasksCatalog.length})
                </button>

                <button
                  type="button"
                  onClick={handleAssembleExecutiveSummary}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Assembler synthèse
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
                    {draftStats.pct}% · {draftStats.words} mots
                  </span>
                  <div className="w-20 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${draftStats.pct}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLivePreview((v) => !v)}
                  className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showLivePreview ? 'Masquer aperçu' : 'Aperçu'}
                </button>
              </div>
            </div>

            {/* Task Importer Drawer */}
            {showTaskPicker && (
              <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/40 dark:bg-violet-950/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-violet-900 dark:text-violet-200">
                    Tâches disponibles à importer dans les réalisations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleImportAllCompletedTasks}
                      className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-semibold"
                    >
                      Importer tâches terminées/révision
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTaskPicker(false)}
                      className="p-1 text-slate-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {tasksCatalog.map((t) => {
                    const imported = draft.linkedTaskCodes.includes(t.code);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleImportTask(t)}
                        className={`px-2.5 py-1 rounded border text-[11px] font-medium transition ${
                          imported
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-violet-400'
                        }`}
                      >
                        {t.code} · {t.title} ({t.status})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className={`grid grid-cols-1 ${showLivePreview ? 'xl:grid-cols-12' : ''} gap-4`}>
            {/* Structured Editor Form */}
            <div className={`${showLivePreview ? 'xl:col-span-7' : ''} rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4`}>
              {/* Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Titre du rapport *
                  </label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Ex: Rapport de mission Saint-Louis / Rapport hebdomadaire S47..."
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Période couverte
                  </label>
                  <input
                    type="text"
                    value={draft.periodLabel}
                    onChange={(e) => setDraft((p) => ({ ...p, periodLabel: e.target.value }))}
                    placeholder="Ex: Semaine 47 · 16–20 Nov 2026"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lieu / Site / Destination
                  </label>
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                    placeholder="Ex: Dakar Plateau / Diamniadio / Thiès"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date début
                  </label>
                  <input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => setDraft((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date fin
                  </label>
                  <input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Synthèse exécutive */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Synthèse exécutive
                  </label>
                  <button
                    type="button"
                    onClick={handleAssembleExecutiveSummary}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Pré-remplir depuis sections
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={draft.executiveSummary}
                  onChange={(e) => setDraft((p) => ({ ...p, executiveSummary: e.target.value }))}
                  placeholder="Résumé clé à destination du Manager / Directeur..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 1. Contexte & Objectifs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  1. Contexte &amp; Objectifs *
                </label>
                {activeTemplate && activeTemplate.contextPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.contextPrompts.map((snippet, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => appendPromptToField('contextAndObjectives', snippet)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 hover:border-blue-400 text-left line-clamp-1 max-w-full"
                      >
                        + {snippet.slice(0, 68)}...
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={3}
                  value={draft.contextAndObjectives}
                  onChange={(e) => setDraft((p) => ({ ...p, contextAndObjectives: e.target.value }))}
                  placeholder="Cadre de la mission ou du travail, objectifs visés..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 2. Activités & Livrables */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  2. Activités réalisées &amp; Livrables *
                </label>
                {activeTemplate && activeTemplate.achievementPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.achievementPrompts.map((snippet, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => appendPromptToField('activitiesAndDeliverables', snippet)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 hover:border-emerald-400 text-left line-clamp-1 max-w-full"
                      >
                        + {snippet.slice(0, 68)}...
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={4}
                  value={draft.activitiesAndDeliverables}
                  onChange={(e) => setDraft((p) => ({ ...p, activitiesAndDeliverables: e.target.value }))}
                  placeholder="Actions menées, réunions tenues, livrables produits..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 3. KPI Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    3. Indicateurs chiffrés (KPI)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        kpis: [
                          ...p.kpis,
                          {
                            id: `kpi-${Date.now()}`,
                            label: '',
                            targetValue: '',
                            actualValue: '',
                            unit: '%',
                            status: 'EN_COURS',
                          },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter KPI
                  </button>
                </div>

                {draft.kpis.map((kpi, idx) => (
                  <div key={kpi.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={kpi.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          kpis: p.kpis.map((x, i) => (i === idx ? { ...x, label: val } : x)),
                        }));
                      }}
                      placeholder="Indicateur"
                      className="col-span-5 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={kpi.targetValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          kpis: p.kpis.map((x, i) => (i === idx ? { ...x, targetValue: val } : x)),
                        }));
                      }}
                      placeholder="Cible"
                      className="col-span-2 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={kpi.actualValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          kpis: p.kpis.map((x, i) => (i === idx ? { ...x, actualValue: val } : x)),
                        }));
                      }}
                      placeholder="Réalisé"
                      className="col-span-2 px-2 py-1.5 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <select
                      value={kpi.status}
                      onChange={(e) => {
                        const val = e.target.value as WorkReportKpiItem['status'];
                        setDraft((p) => ({
                          ...p,
                          kpis: p.kpis.map((x, i) => (i === idx ? { ...x, status: val } : x)),
                        }));
                      }}
                      className="col-span-2 px-1.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="ATTEINT">ATTEINT</option>
                      <option value="EN_COURS">EN_COURS</option>
                      <option value="ECART">ECART</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({ ...p, kpis: p.kpis.filter((_, i) => i !== idx) }))
                      }
                      className="col-span-1 p-1.5 text-rose-500 hover:text-rose-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 4. Difficultés & Risques */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  4. Difficultés, Écarts &amp; Risques
                </label>
                {activeTemplate && activeTemplate.riskPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.riskPrompts.map((snippet, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => appendPromptToField('difficultiesAndRisks', snippet)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 hover:border-amber-400 text-left line-clamp-1 max-w-full"
                      >
                        + {snippet.slice(0, 68)}...
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={2}
                  value={draft.difficultiesAndRisks}
                  onChange={(e) => setDraft((p) => ({ ...p, difficultiesAndRisks: e.target.value }))}
                  placeholder="Blocages rencontrés, retards, contraintes terrain..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 5. Recommandations */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  5. Recommandations &amp; Prochaines étapes
                </label>
                {activeTemplate && activeTemplate.recommendationPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.recommendationPrompts.map((snippet, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => appendPromptToField('recommendationsAndNextSteps', snippet)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 hover:border-blue-400 text-left line-clamp-1 max-w-full"
                      >
                        + {snippet.slice(0, 68)}...
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={2}
                  value={draft.recommendationsAndNextSteps}
                  onChange={(e) => setDraft((p) => ({ ...p, recommendationsAndNextSteps: e.target.value }))}
                  placeholder="Décisions proposées, besoins d’arbitrage, priorités S+1..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* 6. Plan d'action */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    6. Plan d’action &amp; Responsables
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        actionPlan: [
                          ...p.actionPlan,
                          {
                            id: `act-${Date.now()}`,
                            action: '',
                            owner: session.name,
                            deadline: p.endDate || getTodayIso(),
                            priority: 'NORMALE',
                            status: 'A_LANCER',
                          },
                        ],
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Ajouter action
                  </button>
                </div>

                {draft.actionPlan.map((act, idx) => (
                  <div key={act.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={act.action}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          actionPlan: p.actionPlan.map((x, i) => (i === idx ? { ...x, action: val } : x)),
                        }));
                      }}
                      placeholder="Action à mener"
                      className="col-span-4 px-2.5 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={act.owner}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          actionPlan: p.actionPlan.map((x, i) => (i === idx ? { ...x, owner: val } : x)),
                        }));
                      }}
                      placeholder="Responsable"
                      className="col-span-3 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <input
                      type="date"
                      value={act.deadline}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((p) => ({
                          ...p,
                          actionPlan: p.actionPlan.map((x, i) => (i === idx ? { ...x, deadline: val } : x)),
                        }));
                      }}
                      className="col-span-2 px-1.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <select
                      value={act.priority}
                      onChange={(e) => {
                        const val = e.target.value as WorkReportActionItem['priority'];
                        setDraft((p) => ({
                          ...p,
                          actionPlan: p.actionPlan.map((x, i) => (i === idx ? { ...x, priority: val } : x)),
                        }));
                      }}
                      className="col-span-2 px-1.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="NORMALE">NORMALE</option>
                      <option value="HAUTE">HAUTE</option>
                      <option value="URGENTE">URGENTE</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((p) => ({
                          ...p,
                          actionPlan: p.actionPlan.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 p-1.5 text-rose-500 hover:text-rose-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Attachments Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Références pièces jointes / justificatifs
                </label>
                <input
                  type="text"
                  value={draft.attachmentsNote}
                  onChange={(e) => setDraft((p) => ({ ...p, attachmentsNote: e.target.value }))}
                  placeholder="Ex: PV-INV.pdf, FAC-HTL-882, photos site..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Editor Submit Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Annuler
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveReport(false)}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs font-semibold"
                  >
                    Enregistrer brouillon
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveReport(true)}
                    className="min-h-[38px] px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Soumettre pour validation
                  </button>
                </div>
              </div>
            </div>

            {/* Live Structured Document Preview */}
            {showLivePreview && (
              <div className="xl:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden h-fit sticky top-4">
                <div className="bg-slate-900 text-white p-4 border-b-2 border-emerald-500">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    {TYPE_META[draft.type].label}
                  </div>
                  <div className="text-sm font-bold mt-0.5">{orgName.toUpperCase()}</div>
                  <div className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {draft.title || 'Titre du rapport en cours...'}
                  </div>
                </div>

                <div className="p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Rédacteur</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{session.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Période / Lieu</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {draft.periodLabel || `${draft.startDate} → ${draft.endDate}`}
                      </span>
                    </div>
                  </div>

                  {draft.executiveSummary && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                      <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 mb-0.5">
                        Synthèse exécutive
                      </div>
                      <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">
                        {draft.executiveSummary}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      1. Contexte &amp; Objectifs
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {draft.contextAndObjectives || '—'}
                    </p>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      2. Activités réalisées &amp; Livrables
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {draft.activitiesAndDeliverables || '—'}
                    </p>
                  </div>

                  {draft.kpis.some((k) => k.label.trim()) && (
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                        3. Indicateurs clés
                      </div>
                      <div className="space-y-1">
                        {draft.kpis
                          .filter((k) => k.label.trim())
                          .map((k) => (
                            <div key={k.id} className="flex justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded">
                              <span className="truncate">{k.label}</span>
                              <span className="font-mono font-semibold shrink-0">
                                {k.actualValue || '—'} / {k.targetValue || '—'} {k.unit || ''}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      4. Difficultés &amp; Risques
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {draft.difficultiesAndRisks || '—'}
                    </p>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                      5. Recommandations &amp; Suites
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                      {draft.recommendationsAndNextSteps || '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3 : MODÈLES PAR RÔLE                                          */}
      {/* ================================================================= */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-slate-500">{tpl.code}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${TYPE_META[tpl.type].badgeClass}`}>
                    {TYPE_META[tpl.type].shortLabel}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {tpl.title}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.targetRoles.map((role) => (
                    <span
                      key={role}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      {role === 'ALL'
                        ? 'Tous rôles'
                        : role === 'DIRECTION'
                          ? 'Directeurs'
                          : role === 'MANAGER'
                            ? 'Managers'
                            : 'Employés'}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {tpl.defaultObjective}
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  {tpl.suggestedKpis.length} KPI(s) · {tpl.achievementPrompts.length + tpl.recommendationPrompts.length} bloc(s) de rédaction
                </div>
              </div>

              <button
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
              >
                <FileText className="w-3.5 h-3.5" />
                Utiliser ce modèle
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
