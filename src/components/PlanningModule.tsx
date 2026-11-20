import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  GripVertical,
  List,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  EventRecord,
  PlanningEntry,
  PlanningEntryStatus,
  PlanningEntryType,
  PlanningOverviewPayload,
  PlatformTask,
  ProviderServiceRequest,
  SenegalHoliday,
  SharedAvailabilityPayload,
  SharedUnavailabilityBlock,
  TrainingProgram,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  onNavigateTasks?: () => void;
}

type PlanningViewMode = 'month' | 'week' | 'day' | 'agenda' | 'shared';
type PlanningSourceFilter = 'all' | 'entries' | 'tasks' | 'events_trainings';

type UnifiedSource = 'entry' | 'task' | 'event' | 'training' | 'provider_request';

interface UnifiedPlanningItem {
  id: string;
  source: UnifiedSource;
  title: string;
  date: string;
  startHour: number;
  durationHours: number;
  typeLabel: string;
  statusLabel: string;
  location: string;
  participantsLabel: string;
  description: string;
  canDrag: boolean;
  toneClass: string;
  rawEntry?: PlanningEntry;
  rawTask?: PlatformTask;
  rawEvent?: EventRecord;
  rawTraining?: TrainingProgram;
  rawProviderRequest?: ProviderServiceRequest;
}

const ENTRY_TYPE_LABELS: Record<PlanningEntryType, string> = {
  REUNION: 'Réunion',
  RENDEZ_VOUS: 'Rendez-vous',
  EVENEMENT: 'Événement',
  FORMATION: 'Formation',
  PRESTATION: 'Prestation',
  BLOC_TEMPS: 'Bloc focus',
  ECHEANCE: 'Échéance',
};

const ENTRY_STATUS_LABELS: Record<PlanningEntryStatus, string> = {
  PLANIFIE: 'Planifié',
  CONFIRME: 'Confirmé',
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  ANNULE: 'Annulé',
};

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function parseIsoDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export const PlanningModule: React.FC<Props> = ({ session, onNavigateTasks }) => {
  const [data, setData] = useState<PlanningOverviewPayload | null>(null);
  const [sharedData, setSharedData] = useState<SharedAvailabilityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const [viewMode, setViewMode] = useState<PlanningViewMode>('week');
  const [sourceFilter, setSourceFilter] = useState<PlanningSourceFilter>('all');
  const [cursorDate, setCursorDate] = useState<Date>(() => parseIsoDate(toIsoDate(new Date())));

  // Shared HR Availability Calendar state
  const [showSharedOverlay, setShowSharedOverlay] = useState(true);
  const [sharedSearch, setSharedSearch] = useState('');
  const [sharedDeptFilter, setSharedDeptFilter] = useState('ALL');
  const [sharedStatusFilter, setSharedStatusFilter] = useState<
    'ALL' | 'ABSENT_WEEK' | 'AVAILABLE_TODAY'
  >('ALL');
  const [selectedUnavailability, setSelectedUnavailability] =
    useState<SharedUnavailabilityBlock | null>(null);

  const [draggedItem, setDraggedItem] = useState<{ id: string; source: UnifiedSource } | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);

  // Create / Edit Planning Entry Modal
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlanningEntry | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PlanningEntryType>('REUNION');
  const [formStatus, setFormStatus] = useState<PlanningEntryStatus>('PLANIFIE');
  const [formDate, setFormDate] = useState(todayIso);
  const [formStartHour, setFormStartHour] = useState('9');
  const [formDuration, setFormDuration] = useState('2');
  const [formLocation, setFormLocation] = useState('');
  const [formParticipantIds, setFormParticipantIds] = useState<string[]>([session.userId]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);

  // Quick reschedule fields for synced items (Tasks / Events / Trainings)
  const [syncEditDate, setSyncEditDate] = useState('');
  const [syncEditHour, setSyncEditHour] = useState(9);

  const loadPlanning = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const [planningRes, sharedRes] = await Promise.all([
          fetch('/api/planning', {
            headers: buildAuthHeaders(session.space, false),
            credentials: 'include',
          }),
          fetch('/api/planning/shared-availability', {
            headers: buildAuthHeaders(session.space, false),
            credentials: 'include',
          }),
        ]);
        const payload = await planningRes.json();
        if (!planningRes.ok) {
          setError(payload.error || 'Impossible de charger le planning.');
          return;
        }
        setData(payload as PlanningOverviewPayload);
        if (sharedRes.ok) {
          const sharedPayload = (await sharedRes.json()) as SharedAvailabilityPayload;
          setSharedData(sharedPayload);
        }
      } catch {
        setError('Erreur réseau lors du chargement du planning.');
      } finally {
        setLoading(false);
      }
    },
    [session.space],
  );

  useEffect(() => {
    void loadPlanning(false);
  }, [loadPlanning]);

  const canRescheduleTraining =
    session.space === 'superadmin' ||
    session.space === 'instructor' ||
    (session.space === 'intranet' && (session.role === 'OWNER' || session.role === 'MANAGER'));

  const allItems = useMemo<UnifiedPlanningItem[]>(() => {
    if (!data) return [];

    const entryItems: UnifiedPlanningItem[] = data.entries.map((entry) => ({
      id: entry.id,
      source: 'entry',
      title: entry.title,
      date: entry.date,
      startHour: entry.startHour,
      durationHours: entry.durationHours,
      typeLabel: ENTRY_TYPE_LABELS[entry.type],
      statusLabel: ENTRY_STATUS_LABELS[entry.status],
      location: entry.location || 'Bureau / En ligne',
      participantsLabel: entry.participantNames.join(', '),
      description: entry.description,
      canDrag: true,
      toneClass:
        entry.status === 'ANNULE'
          ? 'bg-gray-100 dark:bg-gray-800/80 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 line-through'
          : 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100',
      rawEntry: entry,
    }));

    const taskItems: UnifiedPlanningItem[] = data.syncedTasks
      .filter((t) => Boolean(t.dueDate))
      .map((task) => ({
        id: task.id,
        source: 'task',
        title: `${task.code} · ${task.title}`,
        date: task.dueDate as string,
        startHour: task.startHour ?? 10,
        durationHours: Math.max(1, Math.min(4, Math.round(task.estimatedHours || 1))),
        typeLabel: 'Tâche Kanban',
        statusLabel: task.status === 'TERMINE' ? 'Terminée' : task.priority,
        location: task.linkedRecordLabel || 'Tableau Kanban',
        participantsLabel: task.assigneeName,
        description: task.description,
        canDrag: true,
        toneClass:
          task.status === 'TERMINE'
            ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
            : 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100',
        rawTask: task,
      }));

    const eventItems: UnifiedPlanningItem[] = data.syncedEvents.map((ev, idx) => ({
      id: ev.id,
      source: 'event',
      title: ev.title,
      date: ev.date,
      startHour: ev.startHour ?? 9 + (idx % 3) * 2,
      durationHours: 3,
      typeLabel: 'Événement',
      statusLabel: ev.status,
      location: ev.venue,
      participantsLabel: `${ev.registered}/${ev.capacity} participants`,
      description: `Client : ${ev.client}`,
      canDrag: true,
      toneClass:
        'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-100',
      rawEvent: ev,
    }));

    const trainingItems: UnifiedPlanningItem[] = data.syncedTrainings.map((tr, idx) => ({
      id: tr.id,
      source: 'training',
      title: tr.title,
      date: tr.nextSession,
      startHour: tr.startHour ?? 10 + (idx % 3) * 2,
      durationHours: Math.min(4, Math.max(2, Math.round(tr.durationHours / 8))),
      typeLabel: 'Formation Pro',
      statusLabel: tr.modality || 'HYBRIDE',
      location: `${tr.enrolled}/${tr.maxSeats} inscrits`,
      participantsLabel: tr.instructor,
      description: `Catégorie : ${tr.category}`,
      canDrag: canRescheduleTraining,
      toneClass:
        'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100',
      rawTraining: tr,
    }));

    const providerItems: UnifiedPlanningItem[] = data.syncedProviderRequests.map((req) => ({
      id: req.id,
      source: 'provider_request',
      title: `${req.offerTitle} (${req.clientCompany})`,
      date: req.eventDate,
      startHour: 9,
      durationHours: 3,
      typeLabel: 'Prestation client',
      statusLabel: req.stage.replace(/_/g, ' '),
      location: req.eventLocation,
      participantsLabel: `${req.clientName} · ${req.guestCount} inv.`,
      description: req.notes || req.eventType,
      canDrag: false,
      toneClass:
        'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100',
      rawProviderRequest: req,
    }));

    return [...entryItems, ...taskItems, ...eventItems, ...trainingItems, ...providerItems].sort(
      (a, b) => (a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date)),
    );
  }, [canRescheduleTraining, data]);

  const visibleItems = useMemo(() => {
    if (sourceFilter === 'entries') return allItems.filter((i) => i.source === 'entry');
    if (sourceFilter === 'tasks') return allItems.filter((i) => i.source === 'task');
    if (sourceFilter === 'events_trainings') {
      return allItems.filter(
        (i) => i.source === 'event' || i.source === 'training' || i.source === 'provider_request',
      );
    }
    return allItems;
  }, [allItems, sourceFilter]);

  const selectedItem = useMemo(
    () => visibleItems.find((i) => `${i.source}:${i.id}` === selectedItemKey) || null,
    [visibleItems, selectedItemKey],
  );

  // Weekly load KPI calculations
  const weekStats = useMemo(() => {
    const start = startOfWeekMonday(cursorDate);
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(addDays(start, 6));
    const weekItems = allItems.filter((i) => i.date >= startIso && i.date <= endIso);
    const totalHours = weekItems.reduce((s, i) => s + i.durationHours, 0);
    const confirmedEntries = (data?.entries || []).filter((e) => e.status === 'CONFIRME').length;
    return {
      weekItemsCount: weekItems.length,
      totalHours,
      confirmedEntries,
      syncedTasksCount: data?.syncedTasks.length || 0,
      eventsAndTrainingsCount:
        (data?.syncedEvents.length || 0) +
        (data?.syncedTrainings.length || 0) +
        (data?.syncedProviderRequests.length || 0),
    };
  }, [allItems, cursorDate, data]);

  function openCreateEntryModal(
    presetDate?: string,
    presetHour?: number,
    presetParticipantIds?: string[],
  ) {
    setEditingEntry(null);
    setConfirmDeleteEntryId(null);
    setFormTitle('');
    setFormDescription('');
    setFormType('REUNION');
    setFormStatus('PLANIFIE');
    setFormDate(presetDate || toIsoDate(cursorDate));
    setFormStartHour(String(presetHour ?? 9));
    setFormDuration('2');
    setFormLocation('Salle Teranga Plateau / Visio');
    const uniqueParticipants = Array.from(
      new Set([session.userId, ...(presetParticipantIds || [])]),
    );
    setFormParticipantIds(uniqueParticipants);
    setEntryModalOpen(true);
  }

  function openEditEntryModal(entry: PlanningEntry) {
    setEditingEntry(entry);
    setConfirmDeleteEntryId(null);
    setFormTitle(entry.title);
    setFormDescription(entry.description);
    setFormType(entry.type);
    setFormStatus(entry.status);
    setFormDate(entry.date);
    setFormStartHour(String(entry.startHour));
    setFormDuration(String(entry.durationHours));
    setFormLocation(entry.location);
    setFormParticipantIds(
      entry.participantUserIds.length > 0 ? entry.participantUserIds : [session.userId],
    );
    setEntryModalOpen(true);
  }

  async function handleSubmitEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('Le titre du créneau est requis.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const url = editingEntry ? `/api/planning/${editingEntry.id}` : '/api/planning';
      const method = editingEntry ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim(),
          type: formType,
          status: formStatus,
          date: formDate,
          startHour: Number(formStartHour),
          durationHours: Number(formDuration),
          location: formLocation.trim(),
          participantUserIds: formParticipantIds,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Enregistrement impossible.');
        return;
      }
      setData(payload as PlanningOverviewPayload);
      setEntryModalOpen(false);
      setNotice(
        editingEntry
          ? `Créneau « ${formTitle.trim()} » mis à jour.`
          : `Créneau planifié le ${formDate} à ${formatHour(Number(formStartHour))}.`,
      );
    } catch {
      setError('Erreur réseau lors de la sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    try {
      const res = await fetch(`/api/planning/${entryId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Suppression impossible.');
        return;
      }
      setData(payload as PlanningOverviewPayload);
      setConfirmDeleteEntryId(null);
      setEntryModalOpen(false);
      setSelectedItemKey(null);
      setNotice('Créneau supprimé du planning.');
    } catch {
      setError('Erreur réseau.');
    }
  }

  async function handleRescheduleItem(
    item: UnifiedPlanningItem,
    nextDate: string,
    nextHour?: number,
  ) {
    if (!item.canDrag) return;
    setError('');
    try {
      if (item.source === 'entry') {
        const res = await fetch(`/api/planning/${item.id}`, {
          method: 'PATCH',
          headers: buildAuthHeaders(session.space, true),
          credentials: 'include',
          body: JSON.stringify({
            date: nextDate,
            ...(nextHour !== undefined ? { startHour: nextHour } : {}),
          }),
        });
        if (!res.ok) {
          const payload = await res.json();
          setError(payload.error || 'Replanification impossible.');
          return;
        }
      } else if (item.source === 'task') {
        const res = await fetch(`/api/tasks/${item.id}`, {
          method: 'PATCH',
          headers: buildAuthHeaders(session.space, true),
          credentials: 'include',
          body: JSON.stringify({
            dueDate: nextDate,
            ...(nextHour !== undefined ? { startHour: nextHour } : {}),
            syncToPlanning: true,
          }),
        });
        if (!res.ok) {
          const payload = await res.json();
          setError(payload.error || 'Replanification impossible.');
          return;
        }
      } else if (item.source === 'event') {
        const res = await fetch(`/api/platform/events/${item.id}/reschedule`, {
          method: 'PATCH',
          headers: buildAuthHeaders(session.space, true),
          credentials: 'include',
          body: JSON.stringify({
            date: nextDate,
            ...(nextHour !== undefined ? { startHour: nextHour } : {}),
          }),
        });
        if (!res.ok) {
          const payload = await res.json();
          setError(payload.error || 'Replanification événement impossible.');
          return;
        }
      } else if (item.source === 'training') {
        const res = await fetch(`/api/platform/trainings/${item.id}/reschedule`, {
          method: 'PATCH',
          headers: buildAuthHeaders(session.space, true),
          credentials: 'include',
          body: JSON.stringify({
            nextSession: nextDate,
            ...(nextHour !== undefined ? { startHour: nextHour } : {}),
          }),
        });
        if (!res.ok) {
          const payload = await res.json();
          setError(payload.error || 'Replanification formation impossible.');
          return;
        }
      }

      await loadPlanning(true);
      setNotice(
        `« ${item.title} » replanifié au ${nextDate}${
          nextHour !== undefined ? ` à ${formatHour(nextHour)}` : ''
        }.`,
      );
    } catch {
      setError('Erreur réseau lors de la replanification.');
    }
  }

  function handleSelectItem(item: UnifiedPlanningItem) {
    if (item.source === 'entry' && item.rawEntry) {
      openEditEntryModal(item.rawEntry);
      return;
    }
    setSelectedItemKey(`${item.source}:${item.id}`);
    setSyncEditDate(item.date);
    setSyncEditHour(item.startHour);
  }

  function stepNavigation(direction: -1 | 1) {
    if (viewMode === 'month') {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else if (viewMode === 'week' || viewMode === 'agenda' || viewMode === 'shared') {
      setCursorDate((d) => addDays(d, direction * 7));
    } else {
      setCursorDate((d) => addDays(d, direction));
    }
  }

  const periodTitle = useMemo(() => {
    if (viewMode === 'month') {
      const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
        cursorDate,
      );
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (viewMode === 'week' || viewMode === 'agenda' || viewMode === 'shared') {
      const start = startOfWeekMonday(cursorDate);
      const end = addDays(start, 6);
      const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
      return `Semaine du ${fmt.format(start)} au ${fmt.format(end)} ${end.getFullYear()}`;
    }
    const dayLabel = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(cursorDate);
    return dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
  }, [cursorDate, viewMode]);

  const monthCells = useMemo(() => {
    const first = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const gridStart = startOfWeekMonday(first);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(cursorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursorDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, UnifiedPlanningItem[]>();
    for (const item of visibleItems) {
      const list = map.get(item.date) || [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [visibleItems]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, SenegalHoliday>();
    for (const h of sharedData?.holidays || []) {
      map.set(h.date, h);
    }
    return map;
  }, [sharedData]);

  const getAbsencesForDate = useCallback(
    (dateIso: string): SharedUnavailabilityBlock[] => {
      if (!sharedData) return [];
      return sharedData.unavailabilities.filter(
        (b) => dateIso >= b.startDate && dateIso <= b.endDate,
      );
    },
    [sharedData],
  );

  const sharedDepartments = useMemo(() => {
    const set = new Set<string>();
    for (const c of sharedData?.colleagues || []) {
      if (c.department) set.add(c.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [sharedData]);

  const weekIsoList = useMemo(() => weekDays.map((d) => toIsoDate(d)), [weekDays]);

  const sharedSummary = useMemo(() => {
    const colleagues = sharedData?.colleagues || [];
    const absentTodayIds = new Set(
      (sharedData?.unavailabilities || [])
        .filter((b) => todayIso >= b.startDate && todayIso <= b.endDate)
        .map((b) => b.userId),
    );
    const absentWeekCount = colleagues.filter((c) =>
      weekIsoList.some((iso) =>
        (sharedData?.unavailabilities || []).some(
          (b) => b.userId === c.userId && iso >= b.startDate && iso <= b.endDate,
        ),
      ),
    ).length;
    const holidaysThisWeek = weekIsoList.filter((iso) => holidayByDate.has(iso)).length;
    return {
      totalColleagues: colleagues.length,
      absentTodayCount: absentTodayIds.size,
      availableTodayCount: Math.max(0, colleagues.length - absentTodayIds.size),
      absentWeekCount,
      holidaysThisWeek,
    };
  }, [holidayByDate, sharedData, todayIso, weekIsoList]);

  const filteredSharedColleagues = useMemo(() => {
    const q = sharedSearch.trim().toLowerCase();
    return (sharedData?.colleagues || []).filter((c) => {
      if (sharedDeptFilter !== 'ALL' && c.department !== sharedDeptFilter) return false;
      if (q) {
        const matches =
          c.name.toLowerCase().includes(q) ||
          c.jobTitle.toLowerCase().includes(q) ||
          c.department.toLowerCase().includes(q) ||
          c.site.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (sharedStatusFilter === 'ABSENT_WEEK') {
        const hasWeekBlock = weekIsoList.some((iso) =>
          (sharedData?.unavailabilities || []).some(
            (b) => b.userId === c.userId && iso >= b.startDate && iso <= b.endDate,
          ),
        );
        if (!hasWeekBlock) return false;
      } else if (sharedStatusFilter === 'AVAILABLE_TODAY') {
        const absentToday = (sharedData?.unavailabilities || []).some(
          (b) => b.userId === c.userId && todayIso >= b.startDate && todayIso <= b.endDate,
        );
        if (absentToday) return false;
      }
      return true;
    });
  }, [
    sharedData,
    sharedDeptFilter,
    sharedSearch,
    sharedStatusFilter,
    todayIso,
    weekIsoList,
  ]);

  const modalConflicts = useMemo(() => {
    const holidayConflict = holidayByDate.get(formDate) || null;
    const participantConflicts = (sharedData?.unavailabilities || []).filter(
      (b) =>
        formParticipantIds.includes(b.userId) &&
        formDate >= b.startDate &&
        formDate <= b.endDate,
    );
    return { holidayConflict, participantConflicts };
  }, [formDate, formParticipantIds, holidayByDate, sharedData]);

  function onDropToSlot(dateIso: string, hour?: number) {
    setDropTargetKey(null);
    if (!draggedItem) return;
    const item = visibleItems.find(
      (i) => i.id === draggedItem.id && i.source === draggedItem.source,
    );
    setDraggedItem(null);
    if (item && item.canDrag) {
      void handleRescheduleItem(item, dateIso, hour);
    }
  }

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Chargement de votre planning synchronisé...
      </div>
    );
  }

  const teamMembers = data?.teamMembers || [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 flex items-center justify-between gap-3 text-xs font-medium text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="hover:underline">
            Fermer
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-between gap-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice('')} className="hover:underline">
            Fermer
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Charge de la semaine</span>
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {weekStats.totalHours} h
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono tabular-nums">
            {weekStats.weekItemsCount} créneau(x) cette semaine
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Rendez-vous & réunions</span>
            <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {data?.entries.length || 0}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono tabular-nums">
            {weekStats.confirmedEntries} confirmé(s)
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Tâches Kanban liées</span>
            <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {weekStats.syncedTasksCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Événements & sessions</span>
            <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {weekStats.eventsAndTrainingsCount}
          </p>
        </div>
      </div>

      {/* Calendar Workspace Container */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {/* Controls Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-0.5">
                <button
                  type="button"
                  onClick={() => stepNavigation(-1)}
                  aria-label="Période précédente"
                  className="min-h-[34px] min-w-[34px] rounded-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCursorDate(parseIsoDate(todayIso))}
                  className="min-h-[34px] px-3 rounded-md text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800"
                >
                  Aujourd’hui
                </button>
                <button
                  type="button"
                  onClick={() => stepNavigation(1)}
                  aria-label="Période suivante"
                  className="min-h-[34px] min-w-[34px] rounded-md flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                {periodTitle}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onNavigateTasks && (
                <button
                  type="button"
                  onClick={onNavigateTasks}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Tâches Kanban
                </button>
              )}
              <button
                type="button"
                onClick={() => void loadPlanning(true)}
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualiser
              </button>
              <button
                type="button"
                onClick={() => openCreateEntryModal()}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Nouveau créneau
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* View Mode Selector */}
            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
              {(
                [
                  { id: 'month', label: 'Mois', icon: CalendarIcon },
                  { id: 'week', label: 'Semaine', icon: CalendarDays },
                  { id: 'day', label: 'Jour', icon: Clock },
                  { id: 'agenda', label: 'Agenda', icon: List },
                  { id: 'shared', label: 'Calendrier partagé', icon: Users },
                ] as const
              ).map((v) => {
                const Icon = v.icon;
                const active = viewMode === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setViewMode(v.id)}
                    className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                      active
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {v.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {viewMode !== 'shared' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSharedOverlay((prev) => !prev)}
                    className={`min-h-[34px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                      showSharedOverlay
                        ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    {showSharedOverlay ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    Indisponibilités RH
                    {sharedSummary.absentWeekCount > 0 && (
                      <span className="font-mono tabular-nums opacity-80">
                        ({sharedSummary.absentWeekCount})
                      </span>
                    )}
                  </button>

                  {/* Source Filters */}
                  <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                    {(
                      [
                        { id: 'all', label: `Tout (${allItems.length})` },
                        { id: 'entries', label: 'Créneaux & RDV' },
                        { id: 'tasks', label: 'Tâches' },
                        { id: 'events_trainings', label: 'Événements & Cours' },
                      ] as const
                    ).map((f) => {
                      const active = sourceFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setSourceFilter(f.id)}
                          className={`min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                            active
                              ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* MONTH VIEW */}
        {viewMode === 'month' && (
          <div className="overflow-x-auto">
            <div className="min-w-[740px]">
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                {WEEKDAY_SHORT.map((day) => (
                  <div
                    key={day}
                    className="py-2.5 px-3 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-r last:border-r-0 border-gray-200 dark:border-gray-800"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cellDate) => {
                  const dateIso = toIsoDate(cellDate);
                  const isCurrentMonth = cellDate.getMonth() === cursorDate.getMonth();
                  const isToday = dateIso === todayIso;
                  const dayItems = itemsByDate.get(dateIso) || [];
                  const dayHoliday = showSharedOverlay ? holidayByDate.get(dateIso) : undefined;
                  const dayAbsences = showSharedOverlay ? getAbsencesForDate(dateIso) : [];
                  const isDropActive = dropTargetKey === `month:${dateIso}`;

                  return (
                    <div
                      key={dateIso}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dropTargetKey !== `month:${dateIso}`) {
                          setDropTargetKey(`month:${dateIso}`);
                        }
                      }}
                      onDragLeave={() => {
                        if (dropTargetKey === `month:${dateIso}`) setDropTargetKey(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        onDropToSlot(dateIso);
                      }}
                      className={`group min-h-[124px] p-2 border-b border-r border-gray-200 dark:border-gray-800 flex flex-col gap-1.5 transition-colors ${
                        isDropActive
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : isCurrentMonth
                            ? 'bg-white dark:bg-gray-900'
                            : 'bg-gray-50/70 dark:bg-gray-950/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCursorDate(cellDate);
                            setViewMode('day');
                          }}
                          className={`text-xs font-mono tabular-nums px-1.5 py-0.5 rounded ${
                            isToday
                              ? 'bg-blue-600 text-white font-bold'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {cellDate.getDate()}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateEntryModal(dateIso, 9)}
                          title={`Planifier le ${dateIso}`}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {dayHoliday && (
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/70 rounded px-1.5 py-0.5 truncate">
                          Férié · {dayHoliday.label}
                        </div>
                      )}

                      {dayAbsences.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setCursorDate(cellDate);
                            setViewMode('shared');
                          }}
                          title={dayAbsences.map((a) => `${a.userName} (${a.displayLabel})`).join(', ')}
                          className="w-full text-left text-[10px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/70 rounded px-1.5 py-0.5 inline-flex items-center gap-1 truncate hover:bg-rose-100/80 dark:hover:bg-rose-900/40"
                        >
                          <CalendarOff className="w-3 h-3 shrink-0" />
                          <span className="truncate font-mono tabular-nums">
                            {dayAbsences.length} indisp. RH
                          </span>
                        </button>
                      )}

                      <div className="space-y-1">
                        {dayItems.slice(0, 3).map((item) => (
                          <button
                            key={`${item.source}:${item.id}`}
                            type="button"
                            draggable={item.canDrag}
                            onDragStart={() =>
                              setDraggedItem({ id: item.id, source: item.source })
                            }
                            onDragEnd={() => {
                              setDraggedItem(null);
                              setDropTargetKey(null);
                            }}
                            onClick={() => handleSelectItem(item)}
                            className={`w-full text-left rounded-md border px-2 py-1 text-[11px] transition ${item.toneClass}`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono text-[10px] opacity-80">
                              <span>{formatHour(item.startHour)}</span>
                              <span className="truncate">{item.typeLabel}</span>
                            </div>
                            <div className="font-semibold truncate">{item.title}</div>
                          </button>
                        ))}
                        {dayItems.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCursorDate(cellDate);
                              setViewMode('day');
                            }}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1"
                          >
                            +{dayItems.length - 3} autre(s)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {viewMode === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <div className="py-3 px-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                  Heure
                </div>
                {weekDays.map((d, idx) => {
                  const iso = toIsoDate(d);
                  const isToday = iso === todayIso;
                  const dayHoliday = showSharedOverlay ? holidayByDate.get(iso) : undefined;
                  const dayAbsences = showSharedOverlay ? getAbsencesForDate(iso) : [];
                  return (
                    <div
                      key={iso}
                      className="py-2.5 px-2 text-center border-r last:border-r-0 border-gray-200 dark:border-gray-800 space-y-1"
                    >
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {WEEKDAY_SHORT[idx]}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCursorDate(d);
                          setViewMode('day');
                        }}
                        className={`mt-0.5 text-sm font-mono tabular-nums px-2 py-0.5 rounded ${
                          isToday
                            ? 'bg-blue-600 text-white font-bold'
                            : 'text-gray-900 dark:text-gray-100 hover:bg-gray-200/70 dark:hover:bg-gray-800'
                        }`}
                      >
                        {d.getDate()}
                      </button>
                      {dayHoliday && (
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 truncate px-1">
                          Férié · {dayHoliday.label}
                        </div>
                      )}
                      {dayAbsences.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewMode('shared')}
                          title={dayAbsences
                            .map((a) => `${a.userName} (${a.displayLabel})`)
                            .join(' · ')}
                          className="w-full text-[10px] font-medium text-rose-700 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-800/70 rounded px-1.5 py-0.5 inline-flex items-center justify-center gap-1 truncate hover:bg-rose-100 dark:hover:bg-rose-900/40"
                        >
                          <CalendarOff className="w-3 h-3 shrink-0" />
                          <span className="truncate font-mono tabular-nums">
                            {dayAbsences.length} indisp.
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b last:border-b-0 border-gray-100 dark:border-gray-800"
                >
                  <div className="py-3 px-2 text-center text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40">
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((d) => {
                    const iso = toIsoDate(d);
                    const slotKey = `week:${iso}:${hour}`;
                    const slotItems = (itemsByDate.get(iso) || []).filter(
                      (i) => i.startHour === hour,
                    );
                    const isDropActive = dropTargetKey === slotKey;

                    return (
                      <div
                        key={slotKey}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dropTargetKey !== slotKey) setDropTargetKey(slotKey);
                        }}
                        onDragLeave={() => {
                          if (dropTargetKey === slotKey) setDropTargetKey(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          onDropToSlot(iso, hour);
                        }}
                        className={`group min-h-[66px] p-1.5 border-r last:border-r-0 border-gray-100 dark:border-gray-800 space-y-1 transition-colors ${
                          isDropActive ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        {slotItems.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => openCreateEntryModal(iso, hour)}
                            className="w-full h-full min-h-[50px] rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 border border-dashed border-gray-300 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3" />
                            Planifier
                          </button>
                        ) : (
                          slotItems.map((item) => (
                            <button
                              key={`${item.source}:${item.id}`}
                              type="button"
                              draggable={item.canDrag}
                              onDragStart={() =>
                                setDraggedItem({ id: item.id, source: item.source })
                              }
                              onDragEnd={() => {
                                setDraggedItem(null);
                                setDropTargetKey(null);
                              }}
                              onClick={() => handleSelectItem(item)}
                              className={`w-full text-left rounded-lg border px-2 py-1.5 text-[11px] transition ${item.toneClass}`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[10px] opacity-80">
                                <span className="font-mono tabular-nums">
                                  {formatHour(item.startHour)}–{formatHour(item.startHour + item.durationHours)}
                                </span>
                                {item.canDrag && <GripVertical className="w-3 h-3 shrink-0" />}
                              </div>
                              <div className="font-semibold line-clamp-2 leading-snug mt-0.5">
                                {item.title}
                              </div>
                              <div className="text-[10px] opacity-75 truncate mt-0.5">
                                {item.location}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DAY VIEW */}
        {viewMode === 'day' && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {showSharedOverlay &&
              (() => {
                const cursorIso = toIsoDate(cursorDate);
                const dayHoliday = holidayByDate.get(cursorIso);
                const dayAbsences = getAbsencesForDate(cursorIso);
                if (!dayHoliday && dayAbsences.length === 0) return null;
                return (
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      {dayHoliday && (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          Jour férié Sénégal : {dayHoliday.label}
                        </span>
                      )}
                      {dayAbsences.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 text-rose-700 dark:text-rose-300">
                          <CalendarOff className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold">Indisponibilités RH :</span>
                          <span>
                            {dayAbsences
                              .map((a) => `${a.userName} (${a.displayLabel})`)
                              .join(' · ')}
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewMode('shared')}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
                    >
                      Ouvrir le calendrier partagé
                    </button>
                  </div>
                );
              })()}
            {HOURS.map((hour) => {
              const iso = toIsoDate(cursorDate);
              const slotKey = `day:${iso}:${hour}`;
              const slotItems = (itemsByDate.get(iso) || []).filter((i) => i.startHour === hour);
              const isDropActive = dropTargetKey === slotKey;

              return (
                <div
                  key={hour}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dropTargetKey !== slotKey) setDropTargetKey(slotKey);
                  }}
                  onDragLeave={() => {
                    if (dropTargetKey === slotKey) setDropTargetKey(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDropToSlot(iso, hour);
                  }}
                  className={`flex flex-col sm:flex-row min-h-[72px] transition-colors ${
                    isDropActive ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                  }`}
                >
                  <div className="sm:w-24 px-4 py-3 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 bg-gray-50/60 dark:bg-gray-950/40 sm:border-r border-gray-100 dark:border-gray-800 shrink-0">
                    {formatHour(hour)}
                  </div>
                  <div className="flex-1 p-2.5 flex flex-wrap items-center gap-2.5">
                    {slotItems.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openCreateEntryModal(iso, hour)}
                        className="px-3 py-1.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un créneau à {formatHour(hour)}
                      </button>
                    ) : (
                      slotItems.map((item) => (
                        <button
                          key={`${item.source}:${item.id}`}
                          type="button"
                          draggable={item.canDrag}
                          onDragStart={() =>
                            setDraggedItem({ id: item.id, source: item.source })
                          }
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDropTargetKey(null);
                          }}
                          onClick={() => handleSelectItem(item)}
                          className={`flex-1 min-w-[240px] text-left rounded-xl border p-3 space-y-1 transition ${item.toneClass}`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px] opacity-80">
                            <span>
                              {item.typeLabel} · {item.statusLabel}
                            </span>
                            <span className="font-mono tabular-nums">
                              {formatHour(item.startHour)} – {formatHour(item.startHour + item.durationHours)}
                            </span>
                          </div>
                          <div className="text-sm font-bold">{item.title}</div>
                          <div className="flex flex-wrap items-center gap-3 text-xs opacity-80">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.location}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {item.participantsLabel}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AGENDA LIST VIEW */}
        {viewMode === 'agenda' && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {visibleItems.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucun créneau.
              </div>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={`${item.source}:${item.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-28 shrink-0 font-mono tabular-nums text-xs">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{item.date}</div>
                      <div className="text-gray-500 dark:text-gray-400">
                        {formatHour(item.startHour)}–{formatHour(item.startHour + item.durationHours)}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {item.typeLabel} · {item.statusLabel}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectItem(item)}
                        className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                      >
                        {item.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {item.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {item.participantsLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 shrink-0"
                  >
                    Gérer
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* SHARED HR TEAM AVAILABILITY VIEW */}
        {viewMode === 'shared' && (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {/* Permission Scope Notice */}
            <div className="p-4 bg-gray-50/70 dark:bg-gray-950/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shrink-0">
                  {sharedData?.permissionScope === 'COLLEAGUE_MASKED' ||
                  sharedData?.permissionScope === 'SELF_ONLY' ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Shield className="w-4 h-4" />
                  )}
                </div>
                <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                  {sharedData?.permissionTitle || 'Chargement des permissions RH...'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-gray-700 dark:text-gray-300 shrink-0">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Disponibles aujourd’hui : </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {sharedSummary.availableTodayCount}/{sharedSummary.totalColleagues}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Absents semaine : </span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {sharedSummary.absentWeekCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Filters & Legend */}
            <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={sharedSearch}
                    onChange={(e) => setSharedSearch(e.target.value)}
                    placeholder="Rechercher un collègue, service..."
                    className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-gray-100"
                  />
                </div>

                {sharedDepartments.length > 1 && (
                  <select
                    value={sharedDeptFilter}
                    onChange={(e) => setSharedDeptFilter(e.target.value)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-gray-100"
                  >
                    <option value="ALL">Tous les services</option>
                    {sharedDepartments.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  value={sharedStatusFilter}
                  onChange={(e) =>
                    setSharedStatusFilter(
                      e.target.value as 'ALL' | 'ABSENT_WEEK' | 'AVAILABLE_TODAY',
                    )
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-gray-100"
                >
                  <option value="ALL">Toute l’équipe ({sharedSummary.totalColleagues})</option>
                  <option value="ABSENT_WEEK">Avec indisponibilité cette semaine</option>
                  <option value="AVAILABLE_TODAY">Disponibles aujourd’hui</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Disponible (cliquer pour planifier)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Absence validée
                </span>
                {sharedData?.canViewPendingLeaves && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    En attente N+1
                  </span>
                )}
              </div>
            </div>

            {/* Matrix Grid (Colleagues × 7 Weekdays) */}
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <div className="px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                    Collaborateur / Service
                  </div>
                  {weekDays.map((d, idx) => {
                    const iso = toIsoDate(d);
                    const isToday = iso === todayIso;
                    const hol = holidayByDate.get(iso);
                    return (
                      <div
                        key={iso}
                        className={`px-2 py-2.5 text-center border-r last:border-r-0 border-gray-200 dark:border-gray-800 ${
                          isToday ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                        }`}
                      >
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          {WEEKDAY_SHORT[idx]}
                        </div>
                        <div
                          className={`text-xs font-mono tabular-nums font-bold mt-0.5 ${
                            isToday
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {String(d.getDate()).padStart(2, '0')}/
                          {String(d.getMonth() + 1).padStart(2, '0')}
                        </div>
                        {hol && (
                          <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 truncate mt-0.5">
                            {hol.label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {filteredSharedColleagues.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Aucun collaborateur.
                  </div>
                ) : (
                  filteredSharedColleagues.map((colleague) => (
                    <div
                      key={colleague.userId}
                      className="grid grid-cols-[240px_repeat(7,minmax(0,1fr))] border-b last:border-b-0 border-gray-100 dark:border-gray-800 hover:bg-gray-50/40 dark:hover:bg-gray-800/20"
                    >
                      <div className="px-4 py-3 border-r border-gray-200 dark:border-gray-800 flex flex-col justify-center min-w-0">
                        <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                          {colleague.name}
                          {colleague.isSelf && (
                            <span className="ml-1.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                              · Vous
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {colleague.jobTitle} · {colleague.site}
                        </div>
                      </div>

                      {weekDays.map((d) => {
                        const iso = toIsoDate(d);
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const hol = holidayByDate.get(iso);
                        const block = (sharedData?.unavailabilities || []).find(
                          (b) =>
                            b.userId === colleague.userId &&
                            iso >= b.startDate &&
                            iso <= b.endDate,
                        );

                        if (block) {
                          const isPending = block.status === 'EN_ATTENTE';
                          return (
                            <div
                              key={iso}
                              className="p-1.5 border-r last:border-r-0 border-gray-100 dark:border-gray-800 flex items-stretch"
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedUnavailability(block)}
                                className={`w-full min-h-[46px] rounded-lg border px-2 py-1.5 text-left transition flex flex-col justify-center gap-0.5 ${
                                  isPending
                                    ? 'border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/40'
                                    : 'border-rose-200 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 hover:bg-rose-100/80 dark:hover:bg-rose-900/50'
                                }`}
                              >
                                <div className="flex items-center gap-1 text-[10px] font-semibold leading-tight">
                                  {isPending ? (
                                    <Clock className="w-3 h-3 shrink-0" />
                                  ) : block.masked ? (
                                    <Lock className="w-3 h-3 shrink-0" />
                                  ) : (
                                    <CalendarOff className="w-3 h-3 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {isPending ? 'En attente N+1' : block.statusLabel}
                                  </span>
                                </div>
                                <div className="text-[11px] font-medium truncate">
                                  {block.displayLabel}
                                </div>
                                {block.halfDay !== 'FULL' && (
                                  <div className="text-[10px] opacity-80">
                                    {block.halfDay === 'MORNING' ? 'Matin' : 'Après-midi'}
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        }

                        if (hol) {
                          return (
                            <div
                              key={iso}
                              className="p-1.5 border-r last:border-r-0 border-gray-100 dark:border-gray-800 flex items-center justify-center bg-amber-50/40 dark:bg-amber-950/20"
                            >
                              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 text-center line-clamp-2">
                                Jour férié
                              </span>
                            </div>
                          );
                        }

                        if (isWeekend) {
                          return (
                            <div
                              key={iso}
                              className="p-1.5 border-r last:border-r-0 border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50/70 dark:bg-gray-950/50"
                            >
                              <span className="text-[11px] text-gray-400 dark:text-gray-600">
                                Week-end
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={iso}
                            className="p-1.5 border-r last:border-r-0 border-gray-100 dark:border-gray-800 flex items-stretch"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openCreateEntryModal(iso, 9, [colleague.userId])
                              }
                              title={`Planifier un créneau avec ${colleague.name} le ${iso}`}
                              className="group w-full min-h-[46px] rounded-lg border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 flex flex-col items-center justify-center gap-0.5 transition"
                            >
                              <UserCheck className="w-3.5 h-3.5 text-emerald-600/70 dark:text-emerald-400/70 group-hover:text-emerald-700 dark:group-hover:text-emerald-300" />
                              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                                Disponible
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected Unavailability Inspector */}
            {selectedUnavailability && (
              <div className="p-4 bg-gray-50/60 dark:bg-gray-950/60 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    {selectedUnavailability.statusLabel} · {selectedUnavailability.startDate}
                    {selectedUnavailability.endDate !== selectedUnavailability.startDate
                      ? ` → ${selectedUnavailability.endDate}`
                      : ''}
                    {selectedUnavailability.halfDay !== 'FULL'
                      ? ` · ${
                          selectedUnavailability.halfDay === 'MORNING'
                            ? 'Matin uniquement'
                            : 'Après-midi uniquement'
                        }`
                      : ''}
                  </div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {selectedUnavailability.userName} — {selectedUnavailability.displayLabel}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {selectedUnavailability.department} · {selectedUnavailability.site}
                  </div>
                  {!selectedUnavailability.masked && selectedUnavailability.reason ? (
                    <p className="text-xs text-gray-700 dark:text-gray-300 pt-1">
                      Motif : {selectedUnavailability.reason}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pt-1 inline-flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      Motif masqué
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUnavailability(null)}
                  className="min-h-[34px] px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 self-start"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* INSPECTOR FOR SYNCED ITEMS (TASKS / EVENTS / TRAININGS / PROVIDER) */}
      {selectedItem && (
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {selectedItem.typeLabel} · {selectedItem.statusLabel}
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                {selectedItem.title}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {selectedItem.location} · {selectedItem.participantsLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedItemKey(null)}
              aria-label="Fermer l'inspecteur"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedItem.canDrag && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Nouvelle date
                </label>
                <input
                  type="date"
                  value={syncEditDate}
                  onChange={(e) => setSyncEditDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Heure de début
                </label>
                <select
                  value={syncEditHour}
                  onChange={(e) => setSyncEditHour(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-gray-100"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void handleRescheduleItem(selectedItem, syncEditDate, syncEditHour)}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Replanifier
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PLANNING ENTRY MODAL */}
      {entryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingEntry ? 'Modifier le créneau' : 'Planifier un nouveau créneau'}
              </h2>
              <button
                type="button"
                onClick={() => setEntryModalOpen(false)}
                aria-label="Fermer"
                className="min-h-[36px] min-w-[36px] rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEntry} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Intitulé du créneau
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex. Comité de suivi Sommet Économique"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Type d’activité
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as PlanningEntryType)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {(Object.keys(ENTRY_TYPE_LABELS) as PlanningEntryType[]).map((tp) => (
                      <option key={tp} value={tp}>
                        {ENTRY_TYPE_LABELS[tp]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as PlanningEntryStatus)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {(Object.keys(ENTRY_STATUS_LABELS) as PlanningEntryStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {ENTRY_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Heure de début
                  </label>
                  <select
                    value={formStartHour}
                    onChange={(e) => setFormStartHour(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {formatHour(h)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Durée
                  </label>
                  <select
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 8].map((d) => (
                      <option key={d} value={d}>
                        {d} heure{d > 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Lieu ou lien visioconférence
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Ex. Salle Plateau, CICAD Diamniadio ou Lien Visio"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              {teamMembers.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Participants associés
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {teamMembers.map((m) => {
                      const checked = formParticipantIds.includes(m.userId);
                      const absentOnDate = (sharedData?.unavailabilities || []).find(
                        (b) =>
                          b.userId === m.userId &&
                          formDate >= b.startDate &&
                          formDate <= b.endDate,
                      );
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() =>
                            setFormParticipantIds((prev) =>
                              checked
                                ? prev.length > 1
                                  ? prev.filter((id) => id !== m.userId)
                                  : prev
                                : [...prev, m.userId],
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition inline-flex items-center gap-1.5 ${
                            checked
                              ? absentOnDate
                                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                                : 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                              : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          <span>{m.name}</span>
                          {absentOnDate && (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">
                              · Indisponible
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(modalConflicts.holidayConflict || modalConflicts.participantConflicts.length > 0) && (
                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    Alerte disponibilité RH le {formDate}
                  </div>
                  {modalConflicts.holidayConflict && (
                    <div>Jour férié Sénégal : {modalConflicts.holidayConflict.label}</div>
                  )}
                  {modalConflicts.participantConflicts.map((c) => (
                    <div key={c.id}>
                      {c.userName} : {c.displayLabel} ({c.statusLabel})
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ordre du jour / Notes
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Points à aborder, objectifs de la séance..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {editingEntry &&
                    (confirmDeleteEntryId === editingEntry.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeleteEntry(editingEntry.id)}
                          className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEntryId(null)}
                          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                        >
                          Non
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteEntryId(editingEntry.id)}
                        className="px-3 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                      </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEntryModalOpen(false)}
                    className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[40px] px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {submitting
                      ? 'Enregistrement...'
                      : editingEntry
                        ? 'Enregistrer'
                        : 'Planifier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
