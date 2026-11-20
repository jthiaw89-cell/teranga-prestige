import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Kanban,
  List,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { buildAuthHeaders, getSpaceToken } from '../lib/authHeaders';
import { ProfileAvatar } from './ui/MediaAvatar';
import type {
  AuthSpace,
  CourseOrganizationSession,
  InstructorCourse,
  TrainingModality,
  TrainingRequestRecord,
  TrainingRequestStage,
  TrainingRequestsOverviewPayload,
} from '../types';

interface Props {
  actorSpace: AuthSpace;
  actorId?: string;
  actorName?: string;
  actorOrgName?: string;
  coursesCatalog?: InstructorCourse[];
  allowCreateRequest?: boolean;
  initialRequestsPayload?: TrainingRequestsOverviewPayload | null;
  onSessionLinked?: (session: CourseOrganizationSession) => void;
  onNotify?: (msg: string) => void;
}

const STAGE_META: Record<
  TrainingRequestStage,
  { label: string; badgeClass: string; columnAccent: string }
> = {
  NOUVELLE_DEMANDE: {
    label: 'Nouvelle demande',
    badgeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    columnAccent: 'text-blue-600 dark:text-blue-400',
  },
  ANALYSE_BESOIN: {
    label: 'Analyse besoin',
    badgeClass: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
    columnAccent: 'text-indigo-600 dark:text-indigo-400',
  },
  DEVIS_ENVOYE: {
    label: 'Devis envoyé',
    badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    columnAccent: 'text-amber-600 dark:text-amber-400',
  },
  VALIDEE_PLANIFIEE: {
    label: 'Validée & Planifiée',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
    columnAccent: 'text-emerald-600 dark:text-emerald-400',
  },
  EN_COURS: {
    label: 'En cours',
    badgeClass: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    columnAccent: 'text-orange-600 dark:text-orange-400',
  },
  TERMINEE: {
    label: 'Terminée',
    badgeClass: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    columnAccent: 'text-gray-600 dark:text-gray-400',
  },
  REFUSEE: {
    label: 'Refusée / Annulée',
    badgeClass: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
    columnAccent: 'text-rose-600 dark:text-rose-400',
  },
};

const PIPELINE_COLUMNS: TrainingRequestStage[] = [
  'NOUVELLE_DEMANDE',
  'ANALYSE_BESOIN',
  'DEVIS_ENVOYE',
  'VALIDEE_PLANIFIEE',
  'EN_COURS',
  'TERMINEE',
];

const PRIORITY_META: Record<'NORMALE' | 'HAUTE' | 'URGENTE', { label: string; className: string }> = {
  NORMALE: {
    label: 'Normale',
    className: 'text-gray-600 dark:text-gray-400',
  },
  HAUTE: {
    label: 'Haute',
    className: 'text-amber-600 dark:text-amber-400 font-semibold',
  },
  URGENTE: {
    label: 'Urgente',
    className: 'text-rose-600 dark:text-rose-400 font-bold',
  },
};

const MODALITY_LABELS: Record<TrainingModality, string> = {
  EN_LIGNE: 'En ligne',
  HYBRIDE: 'Hybride',
  PRESENTIEL: 'Présentiel',
};

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

function formatShortTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16);
  }
}

export const TrainingRequestsRealtimePanel: React.FC<Props> = ({
  actorSpace,
  actorId,
  actorOrgName,
  coursesCatalog = [],
  allowCreateRequest = true,
  initialRequestsPayload,
  onSessionLinked,
  onNotify,
}) => {
  const [requests, setRequests] = useState<TrainingRequestRecord[]>(
    () => initialRequestsPayload?.requests || [],
  );
  const [instructorsCatalog, setInstructorsCatalog] = useState<
    TrainingRequestsOverviewPayload['instructorsCatalog']
  >(() => initialRequestsPayload?.instructorsCatalog || []);

  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'reconnecting'>(
    'connecting',
  );
  const [lastLiveEventAt, setLastLiveEventAt] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('ALL');
  const [stageFilter, setStageFilter] = useState<TrainingRequestStage | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected request detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quoteDraft, setQuoteDraft] = useState<number>(0);
  const [assignInstructorId, setAssignInstructorId] = useState<string>('');
  const [createLinkedSession, setCreateLinkedSession] = useState<boolean>(true);
  const [sessionDateDraft, setSessionDateDraft] = useState<string>('');
  const [sessionLocationDraft, setSessionLocationDraft] = useState<string>('');
  const [messageDraft, setMessageDraft] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Create request modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Gouvernance & Finance');
  const [newCourseId, setNewCourseId] = useState('');
  const [newInstructorId, setNewInstructorId] = useState('');
  const [newOrgName, setNewOrgName] = useState(actorOrgName || '');
  const [newModality, setNewModality] = useState<TrainingModality>('HYBRIDE');
  const [newParticipants, setNewParticipants] = useState(15);
  const [newStartDate, setNewStartDate] = useState('2026-12-15');
  const [newDurationHours, setNewDurationHours] = useState(14);
  const [newLocation, setNewLocation] = useState('Dakar Plateau');
  const [newBudget, setNewBudget] = useState(1800000);
  const [newPriority, setNewPriority] = useState<'NORMALE' | 'HAUTE' | 'URGENTE'>('HAUTE');
  const [newObjectives, setNewObjectives] = useState('');

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedId) || null,
    [requests, selectedId],
  );

  const onSessionLinkedRef = useRef(onSessionLinked);
  onSessionLinkedRef.current = onSessionLinked;

  const fetchOverview = useCallback(async () => {
    const res = await fetch('/api/training-requests', {
      headers: buildAuthHeaders(actorSpace, false),
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = (await res.json()) as TrainingRequestsOverviewPayload;
    setRequests(data.requests || []);
    setInstructorsCatalog(data.instructorsCatalog || []);
  }, [actorSpace]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  // Real-Time Server-Sent Events subscription
  useEffect(() => {
    const token = getSpaceToken(actorSpace);
    const params = new URLSearchParams();
    params.set('space', actorSpace);
    if (token) params.set('token', token);

    const url = `/api/training-requests/stream?${params.toString()}`;
    setSseStatus('connecting');
    const es = new EventSource(url, { withCredentials: true });

    const mergeIncomingRequest = (incoming?: TrainingRequestRecord) => {
      if (!incoming) return;
      setRequests((prev) => {
        const idx = prev.findIndex((r) => r.id === incoming.id);
        if (idx === -1) return [incoming, ...prev];
        const copy = [...prev];
        copy[idx] = {
          ...incoming,
          canManage: prev[idx].canManage ?? incoming.canManage,
        };
        return copy;
      });
      setLastLiveEventAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };

    es.addEventListener('connected', () => {
      setSseStatus('connected');
    });

    es.addEventListener('training_request:created', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { request?: TrainingRequestRecord };
        mergeIncomingRequest(parsed.request);
      } catch {
        // ignore malformed packet
      }
    });

    es.addEventListener('training_request:updated', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { request?: TrainingRequestRecord };
        mergeIncomingRequest(parsed.request);
      } catch {
        // ignore malformed packet
      }
    });

    es.addEventListener('training_request:message', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { request?: TrainingRequestRecord };
        mergeIncomingRequest(parsed.request);
      } catch {
        // ignore malformed packet
      }
    });

    es.addEventListener('course_session:updated', (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { session?: CourseOrganizationSession };
        if (parsed.session && onSessionLinkedRef.current) {
          onSessionLinkedRef.current(parsed.session);
        }
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      setSseStatus('reconnecting');
    };

    return () => {
      es.close();
    };
  }, [actorSpace]);

  // Synchronize drawer draft inputs when selecting a request
  useEffect(() => {
    if (!selectedRequest) return;
    setQuoteDraft(selectedRequest.quotedAmountFcfa ?? selectedRequest.budgetEstimatedFcfa);
    setAssignInstructorId(selectedRequest.instructorId || '');
    setSessionDateDraft(selectedRequest.desiredStartDate);
    setSessionLocationDraft(selectedRequest.locationOrCity);
  }, [selectedRequest?.id]);

  const kpis = useMemo(() => {
    const active = requests.filter((r) => r.stage !== 'REFUSEE');
    const validatedOrRunning = requests.filter(
      (r) => r.stage === 'VALIDEE_PLANIFIEE' || r.stage === 'EN_COURS',
    ).length;
    const completed = requests.filter((r) => r.stage === 'TERMINEE').length;
    const converted = validatedOrRunning + completed;
    return {
      total: requests.length,
      newAndAnalysis: requests.filter(
        (r) => r.stage === 'NOUVELLE_DEMANDE' || r.stage === 'ANALYSE_BESOIN',
      ).length,
      quotedAndActive:
        requests.filter((r) => r.stage === 'DEVIS_ENVOYE').length + validatedOrRunning,
      totalVolumeFcfa: active.reduce(
        (sum, r) => sum + (r.quotedAmountFcfa ?? r.budgetEstimatedFcfa),
        0,
      ),
      conversionRatePct: active.length > 0 ? Math.round((converted / active.length) * 100) : 0,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (scopeFilter === 'MINE') {
        const isMine =
          actorSpace === 'instructor'
            ? r.instructorId === actorId
            : r.requesterUserId === actorId;
        if (!isMine) return false;
      }
      if (scopeFilter === 'UNASSIGNED' && r.instructorId) return false;
      if (stageFilter !== 'ALL' && r.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hit =
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.organizationName.toLowerCase().includes(q) ||
          (r.instructorName || '').toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [requests, scopeFilter, stageFilter, searchQuery, actorSpace, actorId]);

  async function handleClaimRequest(reqId: string) {
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/training-requests/${reqId}/claim`, {
        method: 'PATCH',
        headers: buildAuthHeaders(actorSpace, true),
        credentials: 'include',
        body: JSON.stringify({
          instructorId: actorSpace === 'instructor' ? actorId : assignInstructorId || undefined,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { request: TrainingRequestRecord };
        setRequests((prev) =>
          prev.map((r) => (r.id === data.request.id ? { ...data.request, canManage: true } : r)),
        );
        onNotify?.(`Demande ${data.request.reference} prise en charge en temps réel.`);
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleTransitionStage(
    reqItem: TrainingRequestRecord,
    nextStage: TrainingRequestStage,
    options?: { createSession?: boolean; customNote?: string },
  ) {
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/training-requests/${reqItem.id}/stage`, {
        method: 'PATCH',
        headers: buildAuthHeaders(actorSpace, true),
        credentials: 'include',
        body: JSON.stringify({
          stage: nextStage,
          quotedAmountFcfa: quoteDraft > 0 ? quoteDraft : undefined,
          instructorId: assignInstructorId || undefined,
          note: options?.customNote,
          createSession: Boolean(options?.createSession),
          sessionDate: sessionDateDraft || reqItem.desiredStartDate,
          locationOrLink: sessionLocationDraft || reqItem.locationOrCity,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          request: TrainingRequestRecord;
          session?: CourseOrganizationSession;
        };
        setRequests((prev) =>
          prev.map((r) =>
            r.id === data.request.id ? { ...data.request, canManage: reqItem.canManage } : r,
          ),
        );
        if (data.session && onSessionLinked) {
          onSessionLinked(data.session);
        }
        onNotify?.(
          data.session
            ? `Demande ${data.request.reference} validée et séance ajoutée dans Organisation des cours.`
            : `Demande ${data.request.reference} passée au stade : ${STAGE_META[nextStage].label}.`,
        );
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !messageDraft.trim()) return;
    const text = messageDraft.trim();
    setMessageDraft('');
    const res = await fetch(`/api/training-requests/${selectedRequest.id}/messages`, {
      method: 'POST',
      headers: buildAuthHeaders(actorSpace, true),
      credentials: 'include',
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const data = (await res.json()) as { request: TrainingRequestRecord };
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.request.id ? { ...data.request, canManage: selectedRequest.canManage } : r,
        ),
      );
    }
  }

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmittingAction(true);
    try {
      const res = await fetch('/api/training-requests', {
        method: 'POST',
        headers: buildAuthHeaders(actorSpace, true),
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory.trim(),
          courseId: newCourseId || undefined,
          instructorId: newInstructorId || undefined,
          organizationName: newOrgName.trim() || undefined,
          modality: newModality,
          participantsCount: Number(newParticipants) || 12,
          desiredStartDate: newStartDate,
          durationHours: Number(newDurationHours) || 14,
          locationOrCity: newLocation.trim() || 'Dakar Plateau',
          budgetEstimatedFcfa: Number(newBudget) || 1200000,
          priority: newPriority,
          objectives: newObjectives.trim(),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { request: TrainingRequestRecord };
        setRequests((prev) => {
          if (prev.some((r) => r.id === data.request.id)) return prev;
          return [{ ...data.request, canManage: true }, ...prev];
        });
        setShowCreateModal(false);
        setNewTitle('');
        setNewObjectives('');
        setSelectedId(data.request.id);
        onNotify?.(`Demande ${data.request.reference} créée et diffusée en temps réel.`);
      }
    } finally {
      setSubmittingAction(false);
    }
  }

  const isTrainerOrAdmin = actorSpace === 'instructor' || actorSpace === 'superadmin';

  return (
    <div className="space-y-6">
      {/* Real-time status & action header */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Suivi Global & Gestion des Demandes de Formation
          </h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
            <span
              className={`w-2 h-2 rounded-full ${
                sseStatus === 'connected'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500 animate-pulse'
              }`}
            />
            {sseStatus === 'connected'
              ? 'Temps réel connecté (SSE)'
              : 'Synchronisation flux...'}
            {lastLiveEventAt ? ` · Dernière MAJ ${lastLiveEventAt}` : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                viewMode === 'kanban'
                  ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              Pipeline Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Suivi tabulaire
            </button>
          </div>

          {allowCreateRequest && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="min-h-[38px] px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle demande
            </button>
          )}
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Portefeuille global
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.total}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            À qualifier / en analyse
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {kpis.newAndAnalysis}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {requests.filter((r) => !r.instructorId && r.stage !== 'REFUSEE').length} ouverte(s) sans formateur
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Devis & sessions engagées
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.quotedAndActive}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Taux de conversion : {kpis.conversionRatePct}%
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Volume global estimé
          </div>
          <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatFcfa(kpis.totalVolumeFcfa)}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScopeFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              scopeFilter === 'ALL'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Suivi global ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setScopeFilter('MINE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              scopeFilter === 'MINE'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            {actorSpace === 'instructor' ? 'Mes demandes assignées' : 'Mes demandes émises'}
          </button>
          {isTrainerOrAdmin && (
            <button
              type="button"
              onClick={() => setScopeFilter('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                scopeFilter === 'UNASSIGNED'
                  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                  : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
              }`}
            >
              Ouvertes à prendre en charge (
              {requests.filter((r) => !r.instructorId && r.stage !== 'REFUSEE').length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end min-w-[240px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Référence, thème, client, formateur..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as TrainingRequestStage | 'ALL')}
            aria-label="Filtrer par étape"
            className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          >
            <option value="ALL">Toutes les étapes</option>
            {(Object.keys(STAGE_META) as TrainingRequestStage[]).map((st) => (
              <option key={st} value={st}>
                {STAGE_META[st].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Pipeline / Table + Optional Side Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className={selectedRequest ? 'xl:col-span-7' : 'xl:col-span-12'}>
          {viewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PIPELINE_COLUMNS.map((colStage) => {
                const colMeta = STAGE_META[colStage];
                const colItems = filteredRequests.filter((r) => r.stage === colStage);
                return (
                  <div
                    key={colStage}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/70 p-3 space-y-3 min-h-[220px]"
                  >
                    <div className="flex items-center justify-between px-1">
                      <span className={`text-xs font-bold ${colMeta.columnAccent}`}>
                        {colMeta.label}
                      </span>
                      <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {colItems.length}
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {colItems.length === 0 ? (
                        <div className="p-4 text-center text-[11px] text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                          Aucune demande.
                        </div>
                      ) : (
                        colItems.map((reqItem) => {
                          const isSelected = reqItem.id === selectedId;
                          const prio = PRIORITY_META[reqItem.priority];
                          return (
                            <div
                              key={reqItem.id}
                              onClick={() => setSelectedId(reqItem.id)}
                              className={`p-3.5 rounded-xl border bg-white dark:bg-gray-900 cursor-pointer transition space-y-2 ${
                                isSelected
                                  ? 'border-orange-500 ring-1 ring-orange-500/40 shadow-sm'
                                  : 'border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-700'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-mono font-semibold text-gray-500 dark:text-gray-400">
                                  {reqItem.reference}
                                </span>
                                <span className={prio.className}>{prio.label}</span>
                              </div>
                              <div className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                                {reqItem.title}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                                <span className="truncate">{reqItem.organizationName}</span>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px]">
                                <span className="font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                                  {formatFcfa(reqItem.quotedAmountFcfa ?? reqItem.budgetEstimatedFcfa)}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {reqItem.participantsCount}
                                  {reqItem.messages.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <MessageSquare className="w-3 h-3 text-blue-500" />
                                      <span>{reqItem.messages.length}</span>
                                    </>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                <span className="min-w-0 truncate">
                                  {reqItem.instructorName ? (
                                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                                      <ProfileAvatar
                                        src={reqItem.instructorAvatarUrl}
                                        name={reqItem.instructorName}
                                        size="xs"
                                        tone="amber"
                                      />
                                      <span className="truncate">{reqItem.instructorName}</span>
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                      Ouverte · Sans formateur
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono shrink-0">{reqItem.desiredStartDate}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4">Réf. & Demande</th>
                      <th className="py-3 px-4">Client / Organisation</th>
                      <th className="py-3 px-4">Formateur</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4">Étape</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredRequests.map((reqItem) => {
                      const stageMeta = STAGE_META[reqItem.stage];
                      return (
                        <tr
                          key={reqItem.id}
                          onClick={() => setSelectedId(reqItem.id)}
                          className={`cursor-pointer transition ${
                            reqItem.id === selectedId
                              ? 'bg-orange-50/50 dark:bg-orange-950/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-mono text-[11px] text-gray-500">
                              {reqItem.reference} · {reqItem.desiredStartDate}
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {reqItem.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {MODALITY_LABELS[reqItem.modality]} · {reqItem.participantsCount} participants · {reqItem.durationHours}h
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {reqItem.organizationName}
                            </div>
                            <div className="text-gray-500">{reqItem.requesterName}</div>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {reqItem.instructorName ? (
                              <span className="inline-flex items-center gap-2 font-medium text-gray-800 dark:text-gray-200">
                                <ProfileAvatar
                                  src={reqItem.instructorAvatarUrl}
                                  name={reqItem.instructorName}
                                  size="xs"
                                  tone="amber"
                                />
                                <span>{reqItem.instructorName}</span>
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                À attribuer
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {formatFcfa(reqItem.quotedAmountFcfa ?? reqItem.budgetEstimatedFcfa)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${stageMeta.badgeClass}`}
                            >
                              {stageMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Side Detail & Real-Time Collaboration Drawer */}
        {selectedRequest && (
          <div className="xl:col-span-5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm space-y-5 sticky top-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                    {selectedRequest.reference}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      STAGE_META[selectedRequest.stage].badgeClass
                    }`}
                  >
                    {STAGE_META[selectedRequest.stage].label}
                  </span>
                  {selectedRequest.quoteNumber && (
                    <span className="font-mono text-[11px] text-gray-500">
                      · {selectedRequest.quoteNumber}
                    </span>
                  )}
                  {selectedRequest.conventionNumber && (
                    <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                      · {selectedRequest.conventionNumber}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {selectedRequest.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Demandeur : {selectedRequest.requesterName} ({selectedRequest.organizationName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Key Specs */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 text-xs">
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span className="font-mono">{selectedRequest.desiredStartDate}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {selectedRequest.participantsCount} pers. · {selectedRequest.durationHours}h
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span className="truncate">
                  {MODALITY_LABELS[selectedRequest.modality]} · {selectedRequest.locationOrCity}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                {selectedRequest.instructorName ? (
                  <ProfileAvatar
                    src={selectedRequest.instructorAvatarUrl}
                    name={selectedRequest.instructorName}
                    size="xs"
                    tone="amber"
                  />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                )}
                <span className="truncate">
                  {selectedRequest.instructorName || 'Non assigné'}
                </span>
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-orange-500" />
                Actions sur la demande
              </div>

              {/* Claim open request */}
              {!selectedRequest.instructorId && actorSpace === 'instructor' && (
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={() => void handleClaimRequest(selectedRequest.id)}
                  className="w-full min-h-[38px] py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition"
                >
                  Prendre en charge cette demande
                </button>
              )}

              {/* Superadmin/Manager trainer assignment */}
              {(actorSpace === 'superadmin' || actorSpace === 'intranet') &&
                instructorsCatalog.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={assignInstructorId}
                      onChange={(e) => setAssignInstructorId(e.target.value)}
                      aria-label="Affecter un formateur"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                    >
                      <option value="">— Sélectionner un formateur —</option>
                      {instructorsCatalog.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name} ({inst.city})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!assignInstructorId || submittingAction}
                      onClick={() => void handleClaimRequest(selectedRequest.id)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                    >
                      Affecter
                    </button>
                  </div>
                )}

              {/* Quote & Session scheduling inputs for authorized managers/trainers */}
              {selectedRequest.canManage && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Montant Devis (FCFA)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={50000}
                        value={quoteDraft}
                        onChange={(e) => setQuoteDraft(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">
                        Date de séance prévue
                      </label>
                      <input
                        type="date"
                        value={sessionDateDraft}
                        onChange={(e) => setSessionDateDraft(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                      />
                    </div>
                  </div>

                  {selectedRequest.stage !== 'VALIDEE_PLANIFIEE' &&
                    selectedRequest.stage !== 'EN_COURS' &&
                    selectedRequest.stage !== 'TERMINEE' && (
                      <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createLinkedSession}
                          onChange={(e) => setCreateLinkedSession(e.target.checked)}
                          className="rounded border-gray-300 text-orange-600"
                        />
                        Créer automatiquement la séance dans « Organisation des cours » à la validation
                      </label>
                    )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedRequest.stage === 'NOUVELLE_DEMANDE' && (
                      <button
                        type="button"
                        disabled={submittingAction}
                        onClick={() => void handleTransitionStage(selectedRequest, 'ANALYSE_BESOIN')}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        Passer en analyse
                      </button>
                    )}

                    {(selectedRequest.stage === 'NOUVELLE_DEMANDE' ||
                      selectedRequest.stage === 'ANALYSE_BESOIN') &&
                      isTrainerOrAdmin && (
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() =>
                            void handleTransitionStage(selectedRequest, 'DEVIS_ENVOYE', {
                              customNote: `Devis émis pour ${formatFcfa(quoteDraft)}`,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Envoyer le devis
                        </button>
                      )}

                    {(selectedRequest.stage === 'DEVIS_ENVOYE' ||
                      selectedRequest.stage === 'ANALYSE_BESOIN') && (
                      <button
                        type="button"
                        disabled={submittingAction}
                        onClick={() =>
                          void handleTransitionStage(selectedRequest, 'VALIDEE_PLANIFIEE', {
                            createSession: createLinkedSession,
                            customNote: 'Devis approuvé & session planifiée',
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valider & Planifier
                      </button>
                    )}

                    {selectedRequest.stage === 'VALIDEE_PLANIFIEE' && isTrainerOrAdmin && (
                      <button
                        type="button"
                        disabled={submittingAction}
                        onClick={() => void handleTransitionStage(selectedRequest, 'EN_COURS')}
                        className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                      >
                        Démarrer la formation
                      </button>
                    )}

                    {selectedRequest.stage === 'EN_COURS' && isTrainerOrAdmin && (
                      <button
                        type="button"
                        disabled={submittingAction}
                        onClick={() => void handleTransitionStage(selectedRequest, 'TERMINEE')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      >
                        Clôturer la formation
                      </button>
                    )}

                    {selectedRequest.stage !== 'TERMINEE' &&
                      selectedRequest.stage !== 'REFUSEE' && (
                        <button
                          type="button"
                          disabled={submittingAction}
                          onClick={() => void handleTransitionStage(selectedRequest, 'REFUSEE')}
                          className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20"
                        >
                          Refuser / Annuler
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>

            {/* Live Chat Thread */}
            <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between text-xs font-bold text-gray-800 dark:text-gray-200">
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                  Fil d’échanges en direct ({selectedRequest.messages.length})
                </span>
                <span className="text-[11px] font-normal text-gray-400">Synchronisé SSE</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {selectedRequest.messages.length === 0 ? (
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 text-[11px] text-gray-400 text-center">
                    Aucun message.
                  </div>
                ) : (
                  selectedRequest.messages.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {m.senderName}{' '}
                          <span className="font-normal text-gray-500">· {m.senderRole}</span>
                        </span>
                        <span className="font-mono text-[10px] text-gray-400">
                          {formatShortTimestamp(m.createdAt)}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{m.content}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  placeholder="Écrire un message instantané..."
                  className="flex-1 px-3 py-2 text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={!messageDraft.trim()}
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  Envoyer
                </button>
              </form>
            </div>

            {/* Audit History */}
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Journal de suivi ({selectedRequest.history.length})
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px]">
                {[...selectedRequest.history].reverse().map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-2 text-gray-600 dark:text-gray-400"
                  >
                    <span>
                      <strong className="text-gray-800 dark:text-gray-200">{h.actorName}</strong> —{' '}
                      {h.action}
                    </span>
                    <span className="font-mono text-[10px] shrink-0">
                      {formatShortTimestamp(h.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Training Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Soumettre une demande de formation sur mesure
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Intitulé du besoin de formation *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex. Déploiement Gouvernance Cloud & Sécurité SI"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Organisation / Direction cliente
                  </label>
                  <input
                    type="text"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Ex. Ministère des Finances / Sonatel"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Domaine
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {coursesCatalog.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Basé sur un cours (optionnel)
                    </label>
                    <select
                      value={newCourseId}
                      onChange={(e) => setNewCourseId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                    >
                      <option value="">Programme 100% sur mesure</option>
                      {coursesCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Formateur cible (laisser vide = demande ouverte)
                  </label>
                  <select
                    value={newInstructorId}
                    onChange={(e) => setNewInstructorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    <option value="">Demande ouverte (à prendre en charge)</option>
                    {instructorsCatalog.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} — {inst.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Modalité
                  </label>
                  <select
                    value={newModality}
                    onChange={(e) => setNewModality(e.target.value as TrainingModality)}
                    className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  >
                    <option value="HYBRIDE">Hybride</option>
                    <option value="PRESENTIEL">Présentiel</option>
                    <option value="EN_LIGNE">En ligne</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Effectif
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newParticipants}
                    onChange={(e) => setNewParticipants(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Durée (h)
                  </label>
                  <input
                    type="number"
                    min={2}
                    value={newDurationHours}
                    onChange={(e) => setNewDurationHours(Number(e.target.value))}
                    className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) =>
                      setNewPriority(e.target.value as 'NORMALE' | 'HAUTE' | 'URGENTE')
                    }
                    className="w-full px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  >
                    <option value="NORMALE">Normale</option>
                    <option value="HAUTE">Haute</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date souhaitée
                  </label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Lieu / Ville
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Budget estimé (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={newBudget}
                    onChange={(e) => setNewBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Objectifs pédagogiques
                </label>
                <textarea
                  rows={2}
                  value={newObjectives}
                  onChange={(e) => setNewObjectives(e.target.value)}
                  placeholder="Compétences visées, livrables attendus, profil des participants..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                >
                  {submittingAction ? 'Diffusion...' : 'Diffuser la demande en temps réel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
