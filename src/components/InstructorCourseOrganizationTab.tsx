import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  Laptop,
  Layers,
  ListChecks,
  MapPin,
  Plus,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type {
  CourseOrganizationSession,
  CourseSessionChecklistItem,
  CourseSessionStatus,
  InstructorCourse,
  TrainingModality,
} from '../types';

interface Props {
  courses: InstructorCourse[];
  sessions: CourseOrganizationSession[];
  authHeaders: Record<string, string>;
  onSessionsChange: React.Dispatch<React.SetStateAction<CourseOrganizationSession[]>>;
  onCoursesChange: React.Dispatch<React.SetStateAction<InstructorCourse[]>>;
  onNotify: (msg: string) => void;
}

const SESSION_STATUS_META: Record<
  CourseSessionStatus,
  { label: string; badgeClass: string }
> = {
  PLANIFIEE: {
    label: 'Planifiée',
    badgeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  CONFIRMEE: {
    label: 'Confirmée',
    badgeClass: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  EN_COURS: {
    label: 'En cours',
    badgeClass: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  },
  TERMINEE: {
    label: 'Terminée',
    badgeClass: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  },
  REPORTEE: {
    label: 'Reportée',
    badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  ANNULEE: {
    label: 'Annulée',
    badgeClass: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  },
};

const MODALITY_LABELS: Record<TrainingModality, string> = {
  EN_LIGNE: 'En ligne',
  HYBRIDE: 'Hybride',
  PRESENTIEL: 'Présentiel',
};

export const InstructorCourseOrganizationTab: React.FC<Props> = ({
  courses,
  sessions,
  authHeaders,
  onSessionsChange,
  onCoursesChange,
  onNotify,
}) => {
  const [subView, setSubView] = useState<'sessions' | 'curriculum'>('sessions');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<CourseSessionStatus | 'ALL'>('ALL');
  const [selectedCourseIdForCurriculum, setSelectedCourseIdForCurriculum] = useState<string>(
    () => courses[0]?.id || '',
  );

  // Create / Edit session modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSession, setEditingSession] = useState<CourseOrganizationSession | null>(null);
  const [formCourseId, setFormCourseId] = useState<string>(courses[0]?.id || '');
  const [formChapterId, setFormChapterId] = useState<string>('');
  const [formCohortName, setFormCohortName] = useState<string>('');
  const [formModality, setFormModality] = useState<TrainingModality>('HYBRIDE');
  const [formDate, setFormDate] = useState<string>('2026-11-26');
  const [formStartTime, setFormStartTime] = useState<string>('09:00');
  const [formEndTime, setFormEndTime] = useState<string>('13:00');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formMaxSeats, setFormMaxSeats] = useState<number>(20);
  const [formEnrolledCount, setFormEnrolledCount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newChecklistInputs, setNewChecklistInputs] = useState<Record<string, string>>({});

  const activeCurriculumCourse = useMemo(
    () =>
      courses.find((c) => c.id === selectedCourseIdForCurriculum) || courses[0] || null,
    [courses, selectedCourseIdForCurriculum],
  );

  const formCourse = useMemo(
    () => courses.find((c) => c.id === formCourseId) || courses[0] || null,
    [courses, formCourseId],
  );

  const filteredSessions = useMemo(
    () =>
      sessions.filter((s) => {
        const matchCourse = courseFilter === 'ALL' || s.courseId === courseFilter;
        const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
        return matchCourse && matchStatus;
      }),
    [sessions, courseFilter, statusFilter],
  );

  const stats = useMemo(() => {
    const activeSessions = sessions.filter(
      (s) => s.status === 'PLANIFIEE' || s.status === 'CONFIRMEE' || s.status === 'EN_COURS',
    );
    const allChecks = sessions.flatMap((s) => s.checklist || []);
    const doneChecks = allChecks.filter((c) => c.done).length;
    const totalSeats = activeSessions.reduce((sum, s) => sum + s.maxSeats, 0);
    const filledSeats = activeSessions.reduce((sum, s) => sum + s.enrolledCount, 0);
    return {
      activeCount: activeSessions.length,
      readinessPct: allChecks.length > 0 ? Math.round((doneChecks / allChecks.length) * 100) : 100,
      filledSeats,
      totalSeats,
      totalChapters: courses.reduce((sum, c) => sum + c.chapters.length, 0),
    };
  }, [sessions, courses]);

  function openNewSessionModal(prefillCourseId?: string, prefillChapterId?: string) {
    const targetCourse =
      courses.find((c) => c.id === prefillCourseId) || courses[0] || null;
    setEditingSession(null);
    setFormCourseId(targetCourse?.id || '');
    setFormChapterId(prefillChapterId || targetCourse?.chapters[0]?.id || '');
    setFormCohortName('');
    setFormModality(targetCourse?.modality || 'HYBRIDE');
    setFormDate('2026-11-28');
    setFormStartTime('09:00');
    setFormEndTime('13:00');
    setFormLocation(targetCourse?.locationOrPlatform || 'Campus Teranga Dakar Plateau');
    setFormMaxSeats(20);
    setFormEnrolledCount(0);
    setFormNotes('');
    setShowModal(true);
  }

  function openEditSessionModal(s: CourseOrganizationSession) {
    setEditingSession(s);
    setFormCourseId(s.courseId);
    setFormChapterId(s.chapterId || '');
    setFormCohortName(s.cohortName);
    setFormModality(s.modality);
    setFormDate(s.sessionDate);
    setFormStartTime(s.startTime);
    setFormEndTime(s.endTime);
    setFormLocation(s.locationOrLink);
    setFormMaxSeats(s.maxSeats);
    setFormEnrolledCount(s.enrolledCount);
    setFormNotes(s.notes || '');
    setShowModal(true);
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!formCourseId || !formCohortName.trim()) return;
    setSaving(true);
    try {
      if (editingSession) {
        const res = await fetch(`/api/instructor/sessions/${editingSession.id}`, {
          method: 'PATCH',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            cohortName: formCohortName.trim(),
            chapterId: formChapterId || undefined,
            modality: formModality,
            sessionDate: formDate,
            startTime: formStartTime,
            endTime: formEndTime,
            locationOrLink: formLocation.trim(),
            maxSeats: Number(formMaxSeats) || 20,
            enrolledCount: Number(formEnrolledCount) || 0,
            notes: formNotes.trim(),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { session: CourseOrganizationSession };
          onSessionsChange((prev) =>
            prev.map((item) => (item.id === data.session.id ? data.session : item)),
          );
          setShowModal(false);
          onNotify(`Séance « ${data.session.cohortName} » mise à jour et synchronisée.`);
        }
      } else {
        const res = await fetch('/api/instructor/sessions', {
          method: 'POST',
          headers: authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            courseId: formCourseId,
            chapterId: formChapterId || undefined,
            cohortName: formCohortName.trim(),
            modality: formModality,
            sessionDate: formDate,
            startTime: formStartTime,
            endTime: formEndTime,
            locationOrLink: formLocation.trim(),
            maxSeats: Number(formMaxSeats) || 20,
            enrolledCount: Number(formEnrolledCount) || 0,
            notes: formNotes.trim(),
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { session: CourseOrganizationSession };
          onSessionsChange((prev) => {
            if (prev.some((s) => s.id === data.session.id)) return prev;
            return [data.session, ...prev];
          });
          setShowModal(false);
          onNotify(`Séance « ${data.session.cohortName} » planifiée avec checklist pédagogique.`);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSessionStatus(
    sessionId: string,
    status: CourseSessionStatus,
  ) {
    const res = await fetch(`/api/instructor/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { session: CourseOrganizationSession };
    onSessionsChange((prev) =>
      prev.map((s) => (s.id === data.session.id ? data.session : s)),
    );
    onNotify(`Statut de séance mis à jour : ${SESSION_STATUS_META[status].label}.`);
  }

  async function handleToggleChecklist(
    session: CourseOrganizationSession,
    itemId: string,
  ) {
    const nextChecklist: CourseSessionChecklistItem[] = session.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    );
    onSessionsChange((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, checklist: nextChecklist } : s)),
    );
    const res = await fetch(`/api/instructor/sessions/${session.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ checklist: nextChecklist }),
    });
    if (res.ok) {
      const data = (await res.json()) as { session: CourseOrganizationSession };
      onSessionsChange((prev) =>
        prev.map((s) => (s.id === data.session.id ? data.session : s)),
      );
    }
  }

  async function handleAddChecklistItem(session: CourseOrganizationSession) {
    const label = (newChecklistInputs[session.id] || '').trim();
    if (!label) return;
    const nextChecklist: CourseSessionChecklistItem[] = [
      ...session.checklist,
      { id: `chk-${Date.now()}`, label, done: false },
    ];
    setNewChecklistInputs((prev) => ({ ...prev, [session.id]: '' }));
    const res = await fetch(`/api/instructor/sessions/${session.id}`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ checklist: nextChecklist }),
    });
    if (res.ok) {
      const data = (await res.json()) as { session: CourseOrganizationSession };
      onSessionsChange((prev) =>
        prev.map((s) => (s.id === data.session.id ? data.session : s)),
      );
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const res = await fetch(`/api/instructor/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return;
    onSessionsChange((prev) => prev.filter((s) => s.id !== sessionId));
    setConfirmDeleteId(null);
    onNotify('Séance retirée du planning formateur.');
  }

  async function handleMoveChapter(
    course: InstructorCourse,
    index: number,
    direction: -1 | 1,
  ) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= course.chapters.length) return;
    const reordered = [...course.chapters];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);

    onCoursesChange((prev) =>
      prev.map((c) => (c.id === course.id ? { ...c, chapters: reordered } : c)),
    );

    const res = await fetch(`/api/instructor/courses/${course.id}/reorder-chapters`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ chapterIds: reordered.map((ch) => ch.id) }),
    });
    if (res.ok) {
      const data = (await res.json()) as { course: InstructorCourse };
      onCoursesChange((prev) =>
        prev.map((c) => (c.id === data.course.id ? data.course : c)),
      );
      onNotify(`Ordre des chapitres sauvegardé pour « ${course.title} ».`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Compact Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Séances actives & à venir
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.activeCount}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Sur {sessions.length} cohorte(s) enregistrée(s)
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Préparation pédagogique
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.readinessPct}%
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Remplissage des cohortes
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {stats.filledSeats} / {stats.totalSeats}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Séquences & chapitres
          </div>
          <div className="mt-1.5 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.totalChapters}
          </div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Répartis sur {courses.length} cours
          </div>
        </div>
      </div>

      {/* Sub-navigation & Filters */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubView('sessions')}
            className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
              subView === 'sessions'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Séances & Cohortes ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView('curriculum')}
            className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition ${
              subView === 'curriculum'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Structure des chapitres
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {subView === 'sessions' && (
            <>
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                aria-label="Filtrer par cours"
                className="min-h-[38px] px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                <option value="ALL">Tous les cours</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CourseSessionStatus | 'ALL')}
                aria-label="Filtrer par statut de séance"
                className="min-h-[38px] px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PLANIFIEE">Planifiée</option>
                <option value="CONFIRMEE">Confirmée</option>
                <option value="EN_COURS">En cours</option>
                <option value="TERMINEE">Terminée</option>
                <option value="REPORTEE">Reportée</option>
              </select>
            </>
          )}

          <button
            type="button"
            disabled={courses.length === 0}
            onClick={() => openNewSessionModal()}
            className="min-h-[38px] px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Planifier une séance
          </button>
        </div>
      </div>

      {/* View 1: Course Sessions & Checklists */}
      {subView === 'sessions' ? (
        filteredSessions.length === 0 ? (
          <div className="p-10 text-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Aucune séance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map((sess) => {
              const statusMeta = SESSION_STATUS_META[sess.status];
              const doneCount = sess.checklist.filter((c) => c.done).length;
              const totalCount = sess.checklist.length;
              const fillRatio =
                sess.maxSeats > 0
                  ? Math.min(100, Math.round((sess.enrolledCount / sess.maxSeats) * 100))
                  : 0;

              return (
                <div
                  key={sess.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                        <span className="font-mono tabular-nums text-gray-600 dark:text-gray-300 font-semibold">
                          {sess.sessionDate} · {sess.startTime}–{sess.endTime}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
                          {sess.modality === 'EN_LIGNE' ? (
                            <Laptop className="w-3.5 h-3.5" />
                          ) : (
                            <MapPin className="w-3.5 h-3.5" />
                          )}
                          {MODALITY_LABELS[sess.modality]} — {sess.locationOrLink}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {sess.cohortName}
                      </h3>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Cours : <span className="font-semibold text-gray-800 dark:text-gray-200">{sess.courseTitle}</span>
                        {sess.chapterTitle ? ` · ${sess.chapterTitle}` : ''}
                      </div>
                      {sess.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{sess.notes}</p>
                      )}
                    </div>

                    {/* Right controls & capacity */}
                    <div className="flex flex-col items-end gap-2.5 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono tabular-nums font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          {sess.enrolledCount} / {sess.maxSeats} places ({fillRatio}%)
                        </div>
                        <div className="w-36 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-orange-500 rounded-full"
                            style={{ width: `${fillRatio}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {sess.status === 'PLANIFIEE' && (
                          <button
                            type="button"
                            onClick={() => void handleUpdateSessionStatus(sess.id, 'CONFIRMEE')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition"
                          >
                            Confirmer
                          </button>
                        )}
                        {(sess.status === 'PLANIFIEE' || sess.status === 'CONFIRMEE') && (
                          <button
                            type="button"
                            onClick={() => void handleUpdateSessionStatus(sess.id, 'EN_COURS')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 transition"
                          >
                            Démarrer
                          </button>
                        )}
                        {sess.status === 'EN_COURS' && (
                          <button
                            type="button"
                            onClick={() => void handleUpdateSessionStatus(sess.id, 'TERMINEE')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                          >
                            Clôturer
                          </button>
                        )}
                        {sess.status !== 'TERMINEE' && sess.status !== 'REPORTEE' && (
                          <button
                            type="button"
                            onClick={() => void handleUpdateSessionStatus(sess.id, 'REPORTEE')}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                          >
                            Reporter
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditSessionModal(sess)}
                          title="Modifier ou replanifier"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === sess.id ? (
                          <button
                            type="button"
                            onClick={() => void handleDeleteSession(sess.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white"
                          >
                            Confirmer suppr.
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(sess.id)}
                            title="Supprimer la séance"
                            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Readiness Checklist */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5">
                        <ListChecks className="w-3.5 h-3.5 text-orange-500" />
                        Préparation logistique & pédagogique
                      </span>
                      <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400">
                        {doneCount}/{totalCount} tâches validées
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {sess.checklist.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void handleToggleChecklist(sess, item.id)}
                          className={`text-left p-2.5 rounded-lg border text-xs flex items-center gap-2 transition ${
                            item.done
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                              : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:border-orange-300'
                          }`}
                        >
                          {item.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <span className={item.done ? 'line-through opacity-80' : ''}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newChecklistInputs[sess.id] || ''}
                        onChange={(e) =>
                          setNewChecklistInputs((prev) => ({
                            ...prev,
                            [sess.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddChecklistItem(sess);
                          }
                        }}
                        placeholder="Ajouter une tâche de préparation (ex. Tester projecteur / Lien Zoom)..."
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddChecklistItem(sess)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Ajouter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* View 2: Curriculum Chapter Reordering */
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Organisation séquentielle des chapitres
            </h3>
            <select
              value={activeCurriculumCourse?.id || ''}
              onChange={(e) => setSelectedCourseIdForCurriculum(e.target.value)}
              aria-label="Choisir un cours pour organiser ses chapitres"
              className="min-h-[38px] px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {!activeCurriculumCourse || activeCurriculumCourse.chapters.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
              Aucun chapitre.
            </div>
          ) : (
            <div className="space-y-3">
              {activeCurriculumCourse.chapters.map((ch, idx) => {
                const totalMin = ch.lessons.reduce((s, l) => s + (l.durationMinutes || 0), 0);
                return (
                  <div
                    key={ch.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                          Étape {idx + 1}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {ch.lessons.length} leçon(s) · {totalMin} min
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {ch.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleMoveChapter(activeCurriculumCourse, idx, -1)}
                        title="Monter le chapitre"
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === activeCurriculumCourse.chapters.length - 1}
                        onClick={() => void handleMoveChapter(activeCurriculumCourse, idx, 1)}
                        title="Descendre le chapitre"
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewSessionModal(activeCurriculumCourse.id, ch.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 text-xs font-semibold hover:bg-orange-100 dark:hover:bg-orange-900/50"
                      >
                        Planifier séance
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="max-w-xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-orange-500" />
                {editingSession ? 'Modifier / Replanifier la séance' : 'Planifier une séance de cours'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Cours concerné
                </label>
                <select
                  value={formCourseId}
                  disabled={Boolean(editingSession)}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setFormCourseId(nextId);
                    const c = courses.find((x) => x.id === nextId);
                    setFormChapterId(c?.chapters[0]?.id || '');
                    if (c) {
                      setFormModality(c.modality);
                      if (c.locationOrPlatform) setFormLocation(c.locationOrPlatform);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nom de la cohorte / séance *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCohortName}
                    onChange={(e) => setFormCohortName(e.target.value)}
                    placeholder="Ex. Cohorte Décembre — Secteur Public"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Chapitre / Module ciblé
                  </label>
                  <select
                    value={formChapterId}
                    onChange={(e) => setFormChapterId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    <option value="">Programme complet</option>
                    {formCourse?.chapters.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Début
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Fin
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Modalité
                  </label>
                  <select
                    value={formModality}
                    onChange={(e) => setFormModality(e.target.value as TrainingModality)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    <option value="EN_LIGNE">En ligne</option>
                    <option value="HYBRIDE">Hybride</option>
                    <option value="PRESENTIEL">Présentiel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Capacité max
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formMaxSeats}
                    onChange={(e) => setFormMaxSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Inscrits actuels
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formEnrolledCount}
                    onChange={(e) => setFormEnrolledCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Salle physique ou lien de diffusion
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Ex. Salle Plateau B ou https://meet.teranga.sn/..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notes logistiques
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Prérequis matériels, intervenant invité, consignes..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  {saving ? 'Enregistrement...' : editingSession ? 'Mettre à jour' : 'Créer la séance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
