import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Columns3,
  Edit3,
  Link2,
  List,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  PlatformTask,
  TaskAssigneeOption,
  TaskCategory,
  TaskChecklistItem,
  TaskPriority,
  TasksOverviewPayload,
  TaskStatus,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  onNavigatePlanning?: () => void;
}

type TaskViewMode = 'kanban' | 'list' | 'deadlines';

const KANBAN_COLUMNS: Array<{
  status: TaskStatus;
  label: string;
  accentText: string;
}> = [
  {
    status: 'A_FAIRE',
    label: 'À faire',
    accentText: 'text-gray-700 dark:text-gray-200',
  },
  {
    status: 'EN_COURS',
    label: 'En cours',
    accentText: 'text-blue-700 dark:text-blue-300',
  },
  {
    status: 'EN_REVISION',
    label: 'En révision',
    accentText: 'text-amber-700 dark:text-amber-300',
  },
  {
    status: 'TERMINE',
    label: 'Terminé',
    accentText: 'text-emerald-700 dark:text-emerald-300',
  },
];

const PRIORITY_META: Record<TaskPriority, { label: string; textClass: string }> = {
  URGENTE: { label: 'Urgente', textClass: 'text-rose-600 dark:text-rose-400 font-semibold' },
  HAUTE: { label: 'Haute', textClass: 'text-amber-600 dark:text-amber-400 font-semibold' },
  NORMALE: { label: 'Normale', textClass: 'text-blue-600 dark:text-blue-400 font-medium' },
  BASSE: { label: 'Basse', textClass: 'text-gray-500 dark:text-gray-400' },
};

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  CRM: 'CRM & Commercial',
  EVENEMENT: 'Événementiel',
  FORMATION: 'Formation Pro',
  COMPTABILITE: 'Comptabilité',
  PRESTATION: 'Prestation',
  ADMINISTRATION: 'Administration',
  PERSONNEL: 'Personnel',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  A_FAIRE: 'À faire',
  EN_COURS: 'En cours',
  EN_REVISION: 'En révision',
  TERMINE: 'Terminé',
};

function defaultCategoryForSpace(space: AuthSessionSummary['space']): TaskCategory {
  if (space === 'accounting') return 'COMPTABILITE';
  if (space === 'learner' || space === 'instructor') return 'FORMATION';
  if (space === 'provider') return 'PRESTATION';
  if (space === 'superadmin') return 'ADMINISTRATION';
  return 'CRM';
}

function formatDateFr(dateStr?: string): string {
  if (!dateStr) return 'Sans échéance';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(d);
}

export const TasksKanbanModule: React.FC<Props> = ({ session, onNavigatePlanning }) => {
  const [data, setData] = useState<TasksOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [viewMode, setViewMode] = useState<TaskViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TaskPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TaskCategory>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<TaskStatus | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // Task Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<PlatformTask | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('A_FAIRE');
  const [formPriority, setFormPriority] = useState<TaskPriority>('NORMALE');
  const [formCategory, setFormCategory] = useState<TaskCategory>(() =>
    defaultCategoryForSpace(session.space),
  );
  const [formAssigneeId, setFormAssigneeId] = useState(session.userId);
  const [formStartDate, setFormStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formDueDate, setFormDueDate] = useState('');
  const [formStartHour, setFormStartHour] = useState('10');
  const [formEstimatedHours, setFormEstimatedHours] = useState('2');
  const [formTags, setFormTags] = useState('');
  const [formLinkedRecord, setFormLinkedRecord] = useState('');
  const [formSyncToPlanning, setFormSyncToPlanning] = useState(true);
  const [formChecklist, setFormChecklist] = useState<TaskChecklistItem[]>([]);
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const loadTasks = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/tasks', {
          headers: buildAuthHeaders(session.space, false),
          credentials: 'include',
        });
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error || 'Impossible de charger vos tâches.');
          return;
        }
        setData(payload as TasksOverviewPayload);
      } catch {
        setError('Erreur réseau lors du chargement des tâches.');
      } finally {
        setLoading(false);
      }
    },
    [session.space],
  );

  useEffect(() => {
    void loadTasks(false);
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.tasks.filter((t) => {
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (assigneeFilter === 'MINE' && t.assigneeUserId !== session.userId) return false;
      if (
        assigneeFilter !== 'ALL' &&
        assigneeFilter !== 'MINE' &&
        t.assigneeUserId !== assigneeFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.assigneeName.toLowerCase().includes(q) ||
        (t.linkedRecordLabel || '').toLowerCase().includes(q) ||
        t.tags.some((tg) => tg.toLowerCase().includes(q))
      );
    });
  }, [data, searchQuery, priorityFilter, categoryFilter, assigneeFilter, session.userId]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, PlatformTask[]> = {
      A_FAIRE: [],
      EN_COURS: [],
      EN_REVISION: [],
      TERMINE: [],
    };
    for (const t of filteredTasks) {
      map[t.status].push(t);
    }
    return map;
  }, [filteredTasks]);

  function openCreateModal(initialStatus: TaskStatus = 'A_FAIRE') {
    setEditingTask(null);
    setConfirmDeleteId(null);
    setFormTitle('');
    setFormDescription('');
    setFormStatus(initialStatus);
    setFormPriority('NORMALE');
    setFormCategory(defaultCategoryForSpace(session.space));
    setFormAssigneeId(session.userId);
    setFormStartDate(todayIso);
    setFormDueDate('');
    setFormStartHour('10');
    setFormEstimatedHours('2');
    setFormTags('');
    setFormLinkedRecord('');
    setFormSyncToPlanning(true);
    setFormChecklist([]);
    setNewChecklistLabel('');
    setNewCommentText('');
    setModalOpen(true);
  }

  function openEditModal(task: PlatformTask) {
    setEditingTask(task);
    setConfirmDeleteId(null);
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormCategory(task.category);
    setFormAssigneeId(task.assigneeUserId);
    setFormStartDate(task.startDate || todayIso);
    setFormDueDate(task.dueDate || '');
    setFormStartHour(String(task.startHour ?? 10));
    setFormEstimatedHours(String(task.estimatedHours ?? 2));
    setFormTags(task.tags.join(', '));
    setFormLinkedRecord(task.linkedRecordLabel || '');
    setFormSyncToPlanning(task.syncToPlanning);
    setFormChecklist(task.checklist || []);
    setNewChecklistLabel('');
    setNewCommentText('');
    setModalOpen(true);
  }

  async function handleMoveTask(task: PlatformTask, targetStatus: TaskStatus) {
    if (task.status === targetStatus) return;
    setBusyTaskId(task.id);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${task.id}/move`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ status: targetStatus }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Déplacement impossible.');
        return;
      }
      setData(payload as TasksOverviewPayload);
      setNotice(`Tâche ${task.code} déplacée vers « ${STATUS_LABELS[targetStatus]} ».`);
    } catch {
      setError('Erreur réseau lors du déplacement.');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleToggleChecklistInline(task: PlatformTask, itemId: string) {
    const nextChecklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item,
    );
    setBusyTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ checklist: nextChecklist }),
      });
      const payload = await res.json();
      if (res.ok) {
        setData(payload as TasksOverviewPayload);
        if (editingTask?.id === task.id && payload.task) {
          setEditingTask(payload.task as PlatformTask);
          setFormChecklist((payload.task as PlatformTask).checklist);
        }
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handleSubmitTask(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }
    setSubmitting(true);
    setError('');

    const tagsArray = formTags
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const body = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      status: formStatus,
      priority: formPriority,
      category: formCategory,
      assigneeUserId: formAssigneeId,
      startDate: formStartDate || undefined,
      dueDate: formDueDate || undefined,
      startHour: formDueDate ? Number(formStartHour) || 10 : undefined,
      estimatedHours: Number(formEstimatedHours) || undefined,
      tags: tagsArray,
      checklist: formChecklist,
      linkedRecordLabel: formLinkedRecord.trim() || undefined,
      syncToPlanning: Boolean(formDueDate && formSyncToPlanning),
    };

    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Enregistrement impossible.');
        return;
      }
      setData(payload as TasksOverviewPayload);
      setModalOpen(false);
      setNotice(
        editingTask
          ? `Tâche ${editingTask.code} mise à jour.`
          : `Nouvelle tâche créée dans « ${STATUS_LABELS[formStatus]} ».`,
      );
    } catch {
      setError('Erreur réseau lors de la sauvegarde.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    setBusyTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Suppression impossible.');
        return;
      }
      setData(payload as TasksOverviewPayload);
      setConfirmDeleteId(null);
      if (editingTask?.id === taskId) {
        setModalOpen(false);
      }
      setNotice('Tâche supprimée.');
    } catch {
      setError('Erreur réseau lors de la suppression.');
    } finally {
      setBusyTaskId(null);
    }
  }

  async function handlePostComment() {
    if (!editingTask || !newCommentText.trim()) return;
    setBusyTaskId(editingTask.id);
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}/comments`, {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ content: newCommentText.trim() }),
      });
      const payload = await res.json();
      if (res.ok) {
        setData(payload as TasksOverviewPayload);
        if (payload.task) {
          setEditingTask(payload.task as PlatformTask);
        }
        setNewCommentText('');
      }
    } finally {
      setBusyTaskId(null);
    }
  }

  function addChecklistItemToForm() {
    if (!newChecklistLabel.trim()) return;
    setFormChecklist((prev) => [
      ...prev,
      { id: `chk-${Date.now()}`, label: newChecklistLabel.trim(), completed: false },
    ]);
    setNewChecklistLabel('');
  }

  const deadlineGroups = useMemo(() => {
    const overdue: PlatformTask[] = [];
    const thisWeek: PlatformTask[] = [];
    const upcoming: PlatformTask[] = [];
    const unscheduled: PlatformTask[] = [];

    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);

    for (const t of filteredTasks) {
      if (!t.dueDate) {
        unscheduled.push(t);
      } else if (t.status !== 'TERMINE' && t.dueDate < todayIso) {
        overdue.push(t);
      } else if (t.dueDate <= weekEndIso) {
        thisWeek.push(t);
      } else {
        upcoming.push(t);
      }
    }

    const byDate = (a: PlatformTask, b: PlatformTask) =>
      (a.dueDate || '9999').localeCompare(b.dueDate || '9999');

    return [
      { key: 'overdue', title: 'Échéances dépassées', items: overdue.sort(byDate), urgent: true },
      { key: 'week', title: 'Cette semaine & Aujourd’hui', items: thisWeek.sort(byDate), urgent: false },
      { key: 'upcoming', title: 'Prochaines échéances', items: upcoming.sort(byDate), urgent: false },
      { key: 'none', title: 'Sans date limite', items: unscheduled, urgent: false },
    ];
  }, [filteredTasks, todayIso]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Chargement de votre espace tâches & tableau Kanban...
      </div>
    );
  }

  const stats = data?.stats || {
    total: 0,
    todo: 0,
    inProgress: 0,
    inReview: 0,
    done: 0,
    overdue: 0,
    urgent: 0,
    completionRate: 0,
  };
  const assignableUsers: TaskAssigneeOption[] = data?.assignableUsers || [];

  return (
    <div className="space-y-6">
      {/* Feedback Banners */}
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
            <span>Portefeuille de tâches</span>
            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.total}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono tabular-nums">
            {stats.todo} à faire · {stats.done} terminée(s)
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>En cours & révision</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.inProgress + stats.inReview}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono tabular-nums">
            {stats.inProgress} actives · {stats.inReview} en validation
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Taux d’avancement</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.completionRate}%
          </p>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Priorités & retards</span>
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.urgent + stats.overdue}
          </p>
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-mono tabular-nums">
            {stats.urgent} urgente(s) · {stats.overdue} en retard
          </p>
        </div>
      </div>

      {/* Main Toolbar: View Switcher + Filters + Actions */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            {(
              [
                { id: 'kanban', label: 'Tableau Kanban', icon: Columns3 },
                { id: 'list', label: 'Liste détaillée', icon: List },
                { id: 'deadlines', label: 'Échéances', icon: CalendarCheck2 },
              ] as const
            ).map((v) => {
              const Icon = v.icon;
              const active = viewMode === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setViewMode(v.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
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
            {onNavigatePlanning && (
              <button
                type="button"
                onClick={onNavigatePlanning}
                className="min-h-[40px] px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5" />
                Ouvrir le Planning
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadTasks(true)}
              title="Actualiser"
              className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('A_FAIRE')}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
            >
              <Plus className="w-4 h-4" />
              Nouvelle tâche
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par titre, référence TSK, mot-clé ou dossier..."
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | TaskPriority)}
              aria-label="Filtrer par priorité"
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Toutes priorités</option>
              <option value="URGENTE">Urgente</option>
              <option value="HAUTE">Haute</option>
              <option value="NORMALE">Normale</option>
              <option value="BASSE">Basse</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | TaskCategory)}
              aria-label="Filtrer par catégorie"
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Toutes catégories</option>
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filtrer par responsable"
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Tous responsables</option>
              <option value="MINE">Mes tâches</option>
              {assignableUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VIEW 1: KANBAN BOARD */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
          {KANBAN_COLUMNS.map((col, colIndex) => {
            const colTasks = tasksByStatus[col.status];
            const isDropActive = dropColumn === col.status;

            return (
              <section
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dropColumn !== col.status) setDropColumn(col.status);
                }}
                onDragLeave={() => {
                  if (dropColumn === col.status) setDropColumn(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropColumn(null);
                  const droppedId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                  setDraggedTaskId(null);
                  if (!droppedId || !data) return;
                  const found = data.tasks.find((t) => t.id === droppedId);
                  if (found && found.status !== col.status) {
                    void handleMoveTask(found, col.status);
                  }
                }}
                className={`rounded-xl border p-3.5 transition-colors min-h-[340px] flex flex-col gap-3 ${
                  isDropActive
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-800 bg-gray-100/70 dark:bg-gray-900/60'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-200/80 dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-bold ${col.accentText}`}>{col.label}</h2>
                    <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                      {colTasks.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateModal(col.status)}
                    title={`Ajouter une tâche dans ${col.label}`}
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center transition"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-5 text-center text-xs text-gray-500 dark:text-gray-400">
                      Aucune tâche.
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const priorityMeta = PRIORITY_META[task.priority];
                      const doneChecklist = task.checklist.filter((c) => c.completed).length;
                      const totalChecklist = task.checklist.length;
                      const isOverdue =
                        task.status !== 'TERMINE' &&
                        Boolean(task.dueDate) &&
                        (task.dueDate as string) < todayIso;
                      const prevCol = colIndex > 0 ? KANBAN_COLUMNS[colIndex - 1] : null;
                      const nextCol =
                        colIndex < KANBAN_COLUMNS.length - 1 ? KANBAN_COLUMNS[colIndex + 1] : null;
                      const isBusy = busyTaskId === task.id;

                      return (
                        <article
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', task.id);
                            setDraggedTaskId(task.id);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDropColumn(null);
                          }}
                          className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2.5 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-700 transition-colors ${
                            draggedTaskId === task.id ? 'opacity-50' : ''
                          } ${isBusy ? 'opacity-70' : ''}`}
                        >
                          {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
                          <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className="font-mono tabular-nums">{task.code}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{CATEGORY_LABELS[task.category]}</span>
                              <span aria-hidden="true">·</span>
                              <span className={priorityMeta.textClass}>{priorityMeta.label}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              aria-label={`Modifier ${task.title}`}
                              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Primary Title */}
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            className="w-full text-left text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 leading-snug"
                          >
                            {task.title}
                          </button>

                          {task.linkedRecordLabel && (
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                              <Link2 className="w-3 h-3 shrink-0" />
                              <span className="truncate">{task.linkedRecordLabel}</span>
                            </div>
                          )}

                          {/* Interactive Checklist Summary */}
                          {totalChecklist > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                                <span>Sous-tâches</span>
                                <span>
                                  {doneChecklist}/{totalChecklist}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
                                  style={{
                                    width: `${Math.round((doneChecklist / totalChecklist) * 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="space-y-1 pt-0.5">
                                {task.checklist.slice(0, 2).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleToggleChecklistInline(task, item.id)}
                                    className="w-full text-left flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                                  >
                                    <span
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        item.completed
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'border-gray-300 dark:border-gray-700'
                                      }`}
                                    >
                                      {item.completed && <Check className="w-2.5 h-2.5" />}
                                    </span>
                                    <span
                                      className={`truncate ${
                                        item.completed ? 'line-through text-gray-400 dark:text-gray-500' : ''
                                      }`}
                                    >
                                      {item.label}
                                    </span>
                                  </button>
                                ))}
                                {totalChecklist > 2 && (
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                                    +{totalChecklist - 2} autre(s) sous-tâche(s)
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Bottom Row: Assignee + Due Date + Touch Column Move Buttons */}
                          <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-2 min-w-0 text-gray-500 dark:text-gray-400">
                              <span className="inline-flex items-center gap-1 truncate">
                                <User className="w-3 h-3 shrink-0" />
                                <span className="truncate">{task.assigneeName}</span>
                              </span>
                              {task.dueDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`font-mono tabular-nums whitespace-nowrap ${
                                      isOverdue
                                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                        : ''
                                    }`}
                                  >
                                    {formatDateFr(task.dueDate)}
                                  </span>
                                </>
                              )}
                              {task.comments.length > 0 && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-0.5 font-mono tabular-nums">
                                    <MessageSquare className="w-3 h-3" />
                                    {task.comments.length}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {prevCol && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleMoveTask(task, prevCol.status)}
                                  title={`Déplacer vers ${prevCol.label}`}
                                  aria-label={`Déplacer vers ${prevCol.label}`}
                                  className="min-h-[28px] min-w-[28px] rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                              {nextCol && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleMoveTask(task, nextCol.status)}
                                  title={`Déplacer vers ${nextCol.label}`}
                                  aria-label={`Déplacer vers ${nextCol.label}`}
                                  className="min-h-[28px] min-w-[28px] rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* VIEW 2: LIST & TABLE */}
      {viewMode === 'list' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-4">Réf.</th>
                  <th className="py-3 px-4">Tâche & contexte</th>
                  <th className="py-3 px-3">Catégorie</th>
                  <th className="py-3 px-3">Priorité</th>
                  <th className="py-3 px-3">Statut Kanban</th>
                  <th className="py-3 px-3">Responsable</th>
                  <th className="py-3 px-3">Échéance</th>
                  <th className="py-3 px-3 text-right">Sous-tâches</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      Aucune tâche ne correspond à vos filtres.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const doneChk = task.checklist.filter((c) => c.completed).length;
                    const pMeta = PRIORITY_META[task.priority];
                    const isOverdue =
                      task.status !== 'TERMINE' &&
                      Boolean(task.dueDate) &&
                      (task.dueDate as string) < todayIso;

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {task.code}
                        </td>
                        <td className="py-3 px-4 min-w-[220px]">
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                          >
                            {task.title}
                          </button>
                          {task.linkedRecordLabel && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {task.linkedRecordLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {CATEGORY_LABELS[task.category]}
                        </td>
                        <td className={`py-3 px-3 whitespace-nowrap ${pMeta.textClass}`}>
                          {pMeta.label}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <select
                            value={task.status}
                            disabled={busyTaskId === task.id}
                            onChange={(e) => void handleMoveTask(task, e.target.value as TaskStatus)}
                            aria-label={`Changer le statut de ${task.title}`}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-xs font-medium text-gray-800 dark:text-gray-200"
                          >
                            <option value="A_FAIRE">À faire</option>
                            <option value="EN_COURS">En cours</option>
                            <option value="EN_REVISION">En révision</option>
                            <option value="TERMINE">Terminé</option>
                          </select>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {task.assigneeName}
                        </td>
                        <td
                          className={`py-3 px-3 font-mono tabular-nums whitespace-nowrap ${
                            isOverdue
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {formatDateFr(task.dueDate)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {task.checklist.length > 0 ? `${doneChk}/${task.checklist.length}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Ouvrir
                            </button>
                            {confirmDeleteId === task.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteTask(task.id)}
                                  className="px-2 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                                >
                                  Confirmer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                                >
                                  Non
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(task.id)}
                                aria-label={`Supprimer ${task.title}`}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: DEADLINES TIMELINE */}
      {viewMode === 'deadlines' && (
        <div className="space-y-4">
          {deadlineGroups.map((grp) => (
            <div
              key={grp.key}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                <h3
                  className={`text-sm font-bold ${
                    grp.urgent ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {grp.title}
                </h3>
                <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {grp.items.length} tâche(s)
                </span>
              </div>

              {grp.items.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-2">
                  Aucune tâche dans cette section.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {grp.items.map((task) => {
                    const pMeta = PRIORITY_META[task.priority];
                    return (
                      <div
                        key={task.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="font-mono tabular-nums">{task.code}</span>
                            <span aria-hidden="true">·</span>
                            <span className={pMeta.textClass}>{pMeta.label}</span>
                            <span aria-hidden="true">·</span>
                            <span>{STATUS_LABELS[task.status]}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEditModal(task)}
                            className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 text-left"
                          >
                            {task.title}
                          </button>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {task.assigneeName}
                            {task.syncToPlanning ? ' · Synchronisée avec le Planning' : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono tabular-nums text-gray-700 dark:text-gray-300">
                            {formatDateFr(task.dueDate)}
                            {task.startHour !== undefined ? ` à ${String(task.startHour).padStart(2, '0')}:00` : ''}
                          </span>
                          {task.status !== 'TERMINE' && (
                            <button
                              type="button"
                              onClick={() => void handleMoveTask(task, 'TERMINE')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Terminer
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT TASK MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingTask ? `Modifier ${editingTask.code}` : 'Nouvelle tâche'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
                className="min-h-[36px] min-w-[36px] rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Titre de la tâche
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex. Valider le cahier des charges Sommet Dakar"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description & livrables attendus
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Précisez le contexte, les actions clés et les critères de validation..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Colonne Kanban
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    <option value="A_FAIRE">À faire</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="EN_REVISION">En révision</option>
                    <option value="TERMINE">Terminé</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Priorité
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    <option value="BASSE">Basse</option>
                    <option value="NORMALE">Normale</option>
                    <option value="HAUTE">Haute</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as TaskCategory)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Responsable
                  </label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {assignableUsers.length === 0 ? (
                      <option value={session.userId}>{session.name}</option>
                    ) : (
                      assignableUsers.map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {u.name} ({u.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Dossier / Référence liée
                  </label>
                  <input
                    type="text"
                    value={formLinkedRecord}
                    onChange={(e) => setFormLinkedRecord(e.target.value)}
                    placeholder="Ex. DEV-2026-041 · Sonatel Business"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Échéance
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Créneau horaire
                  </label>
                  <select
                    value={formStartHour}
                    onChange={(e) => setFormStartHour(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  >
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Charge (heures)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formEstimatedHours}
                    onChange={(e) => setFormEstimatedHours(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formSyncToPlanning}
                    onChange={(e) => setFormSyncToPlanning(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Synchroniser automatiquement sur mon Planning (si une échéance est définie)
                </label>
              </div>

              {/* Checklist Builder */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Sous-tâches / Liste de contrôle ({formChecklist.filter((c) => c.completed).length}/{formChecklist.length})
                  </span>
                </div>
                {formChecklist.length > 0 && (
                  <div className="space-y-1.5">
                    {formChecklist.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800"
                      >
                        <label className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => {
                              setFormChecklist((prev) =>
                                prev.map((c) =>
                                  c.id === item.id ? { ...c, completed: !c.completed } : c,
                                ),
                              );
                            }}
                            className="rounded border-gray-300"
                          />
                          <span className={item.completed ? 'line-through text-gray-400' : ''}>
                            {item.label}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setFormChecklist((prev) => prev.filter((c) => c.id !== item.id))
                          }
                          aria-label="Retirer sous-tâche"
                          className="text-gray-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newChecklistLabel}
                    onChange={(e) => setNewChecklistLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addChecklistItemToForm();
                      }
                    }}
                    placeholder="Ajouter une étape ou sous-tâche..."
                    className="flex-1 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={addChecklistItemToForm}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Comments Thread (Edit Mode) */}
              {editingTask && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                  <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Commentaires ({editingTask.comments.length})
                  </span>
                  {editingTask.comments.length > 0 && (
                    <div className="space-y-2 max-h-36 overflow-y-auto">
                      {editingTask.comments.map((c) => (
                        <div
                          key={c.id}
                          className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">
                              {c.authorName}
                            </span>
                            <span className="font-mono tabular-nums">
                              {c.createdAt.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{c.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Ajouter un commentaire de suivi..."
                      className="flex-1 min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handlePostComment()}
                      disabled={!newCommentText.trim() || busyTaskId === editingTask.id}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold disabled:opacity-50"
                    >
                      Publier
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {editingTask &&
                    (confirmDeleteId === editingTask.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleDeleteTask(editingTask.id)}
                          className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                        >
                          Confirmer suppression
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(editingTask.id)}
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
                    onClick={() => setModalOpen(false)}
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
                      : editingTask
                        ? 'Enregistrer les modifications'
                        : 'Créer la tâche'}
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
