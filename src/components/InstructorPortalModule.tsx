import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Award,
  BookOpen,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileAudio,
  FileSpreadsheet,
  FileText,
  Globe,
  Laptop,
  Layers,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  MapPin,
  Plus,
  Presentation,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Type,
  Users,
  Video,
  X,
} from 'lucide-react';
import courseCloudImg from '../assets/images/course_cloud_cyber_1794940322970.jpg';
import courseFinanceImg from '../assets/images/course_syscohada_finance_1794940307275.jpg';
import courseEventsImg from '../assets/images/course_events_protocol_1794940323026.jpg';
import type {
  CourseLessonType,
  CourseOrganizationSession,
  CourseStatus,
  InstructorCourse,
  InstructorEnrollment,
  InstructorProfile,
  TrainingModality,
  TrainingRequestsOverviewPayload,
} from '../types';
import { CourseCreatorWizard, type CourseWizardDraft } from './CourseCreatorWizard';
import { InstructorCourseOrganizationTab } from './InstructorCourseOrganizationTab';
import { TrainingRequestsRealtimePanel } from './TrainingRequestsRealtimePanel';
import { CompactImageUploader } from './ui/MediaAvatar';

const BUNDLED_COVER_MAP: Record<string, string> = {
  '/src/assets/images/course_cloud_cyber_1794940322970.jpg': courseCloudImg,
  '/src/assets/images/course_syscohada_finance_1794940307275.jpg': courseFinanceImg,
  '/src/assets/images/course_events_protocol_1794940323026.jpg': courseEventsImg,
};

function resolveCover(url?: string): string {
  if (!url) return courseCloudImg;
  return BUNDLED_COVER_MAP[url] || url;
}

const MODALITY_META: Record<
  TrainingModality,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  EN_LIGNE: {
    label: 'En ligne',
    className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    icon: Laptop,
  },
  HYBRIDE: {
    label: 'Hybride',
    className: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    icon: Layers,
  },
  PRESENTIEL: {
    label: 'Présentiel',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    icon: MapPin,
  },
};

const STATUS_META: Record<CourseStatus, { label: string; className: string }> = {
  PUBLISHED: {
    label: 'Publié',
    className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  DRAFT: {
    label: 'Brouillon',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  ARCHIVED: {
    label: 'Archivé',
    className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  },
};

const LESSON_ICON: Record<CourseLessonType, React.ComponentType<{ className?: string }>> = {
  VIDEO: Video,
  PDF: FileText,
  WORD: FileSpreadsheet,
  AUDIO: FileAudio,
  TEXTE: Type,
  ATELIER: Award,
};

const LESSON_LABEL: Record<CourseLessonType, string> = {
  VIDEO: 'Vidéo',
  PDF: 'PDF',
  WORD: 'Word',
  AUDIO: 'Audio',
  TEXTE: 'Texte',
  ATELIER: 'Atelier',
};

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export const InstructorPortalModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('tpd_instructor_token'),
  );
  const [instructor, setInstructor] = useState<InstructorProfile | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [enrollments, setEnrollments] = useState<InstructorEnrollment[]>([]);
  const [sessions, setSessions] = useState<CourseOrganizationSession[]>([]);
  const [trainingRequestsPayload, setTrainingRequestsPayload] =
    useState<TrainingRequestsOverviewPayload | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard views & filters
  const [activeTab, setActiveTab] = useState<
    'courses' | 'organization' | 'requests' | 'wizard' | 'enrollments'
  >('courses');
  const [viewLayout, setViewLayout] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState<TrainingModality | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'ALL'>('ALL');

  // Action states
  const [editingCourse, setEditingCourse] = useState<InstructorCourse | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [previewCourse, setPreviewCourse] = useState<InstructorCourse | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadDashboard = useCallback(async (activeToken?: string | null) => {
    const hdrs: Record<string, string> = {};
    if (activeToken) hdrs.Authorization = `Bearer ${activeToken}`;
    const res = await fetch('/api/instructor/dashboard', { headers: hdrs, credentials: 'include' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      instructor: InstructorProfile;
      courses: InstructorCourse[];
      enrollments: InstructorEnrollment[];
      sessions?: CourseOrganizationSession[];
      trainingRequestsPayload?: TrainingRequestsOverviewPayload;
    };
    setInstructor(data.instructor);
    setCourses(data.courses || []);
    setEnrollments(data.enrollments || []);
    setSessions(data.sessions || []);
    if (data.trainingRequestsPayload) {
      setTrainingRequestsPayload(data.trainingRequestsPayload);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const hdrs: Record<string, string> = {};
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/instructor/auth/me', { headers: hdrs, credentials: 'include' });
      if (res.ok) {
        await loadDashboard(token);
      }
    })();
  }, [loadDashboard, token]);

  async function handleLogin(demoQuickAccess: boolean) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/instructor/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(demoQuickAccess ? { demoQuickAccess: true } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion formateur refusée.');
        return;
      }
      sessionStorage.setItem('tpd_instructor_token', data.token);
      setToken(data.token);
      await loadDashboard(data.token);
    } catch {
      setError('Service formateur indisponible.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/instructor/auth/logout', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
    });
    sessionStorage.removeItem('tpd_instructor_token');
    setToken(null);
    setInstructor(null);
    setCourses([]);
    setEnrollments([]);
  }

  async function handleUpdateAvatar(nextAvatarUrl: string | null) {
    setUploadingAvatar(true);
    try {
      const res = await fetch('/api/instructor/profile', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ avatarUrl: nextAvatarUrl ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner(data.error || 'Mise à jour de la photo impossible.');
        return;
      }
      setInstructor(data.instructor as InstructorProfile);
      setCourses((prev) =>
        prev.map((c) => ({ ...c, instructorAvatarUrl: (data.instructor as InstructorProfile).avatarUrl })),
      );
      setFeedbackBanner(
        nextAvatarUrl ? 'Photo de profil mise à jour.' : 'Photo de profil retirée.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

  function openCreateWizard() {
    setEditingCourse(null);
    setActiveTab('wizard');
  }

  function openEditWizard(course: InstructorCourse) {
    setEditingCourse(course);
    setActiveTab('wizard');
  }

  async function handleSaveCourse(draft: CourseWizardDraft, publishStatus: CourseStatus) {
    setSavingCourse(true);
    try {
      const endpoint = draft.id
        ? `/api/instructor/courses/${draft.id}`
        : '/api/instructor/courses';
      const method = draft.id ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ ...draft, status: publishStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner(data.error || 'Erreur lors de la sauvegarde.');
        return;
      }
      await loadDashboard(token);
      setEditingCourse(null);
      setActiveTab('courses');
      setFeedbackBanner(
        publishStatus === 'PUBLISHED'
          ? `Le cours « ${data.course.title} » est désormais publié dans le catalogue.`
          : `Le cours « ${data.course.title} » a été enregistré en brouillon.`,
      );
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleChangeStatus(course: InstructorCourse, status: CourseStatus) {
    const res = await fetch(`/api/instructor/courses/${course.id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { course: InstructorCourse };
    setCourses((prev) => prev.map((c) => (c.id === data.course.id ? data.course : c)));
    setFeedbackBanner(
      status === 'PUBLISHED'
        ? `« ${course.title} » publié en ligne.`
        : status === 'DRAFT'
        ? `« ${course.title} » repassé en brouillon.`
        : `« ${course.title} » archivé.`,
    );
  }

  async function handleDuplicateCourse(course: InstructorCourse) {
    const res = await fetch(`/api/instructor/courses/${course.id}/duplicate`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = (await res.json()) as { course: InstructorCourse };
    setCourses((prev) => [data.course, ...prev]);
    setFeedbackBanner(`Copie créée : « ${data.course.title} » (Brouillon).`);
  }

  async function handleDeleteCourse(courseId: string) {
    const res = await fetch(`/api/instructor/courses/${courseId}`, {
      method: 'DELETE',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return;
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    setEnrollments((prev) => prev.filter((e) => e.courseId !== courseId));
    setConfirmDeleteId(null);
    setFeedbackBanner('Le cours a été supprimé définitivement.');
  }

  async function handleUpdateAttendance(
    enrollmentId: string,
    attendanceStatus: InstructorEnrollment['attendanceStatus'],
  ) {
    const res = await fetch(`/api/instructor/enrollments/${enrollmentId}/attendance`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ attendanceStatus }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { enrollment: InstructorEnrollment };
    setEnrollments((prev) => prev.map((e) => (e.id === data.enrollment.id ? data.enrollment : e)));
  }

  if (!instructor) {
    return (
      <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
            <Presentation className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Espace Formateur Professionnel
          </h2>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail formateur (ex. formateur@teranga-demo.sn)"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe formateur"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(false)}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Accéder à mon studio formateur
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(true)}
            className="w-full py-2.5 bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800 text-sm font-semibold rounded-lg transition"
          >
            Accès Démonstration Formateur (Ibrahima Diallo — Formateur Principal)
          </button>
        </div>
      </div>
    );
  }

  const publishedCount = courses.filter((c) => c.status === 'PUBLISHED').length;
  const draftCount = courses.filter((c) => c.status === 'DRAFT').length;
  const totalEnrolled = courses.reduce((s, c) => s + c.enrolledCount, 0);
  const totalRevenue = courses.reduce((s, c) => s + c.priceFcfa * c.enrolledCount, 0);
  const avgCompletion =
    publishedCount > 0
      ? Math.round(
          courses
            .filter((c) => c.status === 'PUBLISHED')
            .reduce((s, c) => s + c.completionRate, 0) / publishedCount,
        )
      : 0;

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      !searchQuery.trim() ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModality = modalityFilter === 'ALL' || c.modality === modalityFilter;
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesModality && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Trainer Header Card */}
      <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <CompactImageUploader
            label="Photo de profil"
            variant="avatar"
            name={instructor.name}
            currentUrl={instructor.avatarUrl}
            uploading={uploadingAvatar}
            onUpload={(dataUrl) => handleUpdateAvatar(dataUrl)}
            onRemove={() => handleUpdateAvatar(null)}
            onError={(msg) => setFeedbackBanner(msg)}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Bienvenue, {instructor.name}
              </h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">· {instructor.city}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {instructor.specialty} · <span className="font-mono">{instructor.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={openCreateWizard}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Créer un nouveau cours
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 border border-rose-200 dark:border-rose-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {feedbackBanner}
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <BookOpen className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Cours au catalogue</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{courses.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {publishedCount} publiés · {draftCount} brouillons
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Apprenants B2B</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{totalEnrolled}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {enrollments.length} suivis en cohorte active
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-600">FCFA</span>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Volume facturé</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {new Intl.NumberFormat('fr-FR').format(totalRevenue)}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Star className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Réussite moyenne</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{avgCompletion}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Satisfaction moyenne 4.9 / 5</p>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'courses'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Gestion des cours ({courses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('organization')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'organization'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Organisation des cours ({sessions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Demandes & Suivi temps réel ({trainingRequestsPayload?.kpis.total ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wizard')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'wizard'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            {editingCourse ? `Éditer : ${editingCourse.title}` : '+ Studio création de cours (4 étapes)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enrollments')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'enrollments'
                ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Apprenants & Émargement ({enrollments.length})
          </button>
        </div>

        {activeTab === 'courses' && (
          <div className="flex items-center gap-1 p-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setViewLayout('table')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                viewLayout === 'table'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tableau
            </button>
            <button
              type="button"
              onClick={() => setViewLayout('cards')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold ${
                viewLayout === 'cards'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                  : 'text-gray-500'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cartes
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: GESTION DES COURS */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un cours, une catégorie..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1 rounded-lg">
                {(
                  [
                    { id: 'ALL', label: 'Toutes modalités' },
                    { id: 'EN_LIGNE', label: 'En ligne' },
                    { id: 'HYBRIDE', label: 'Hybride' },
                    { id: 'PRESENTIEL', label: 'Présentiel' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModalityFilter(m.id)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                      modalityFilter === m.id
                        ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CourseStatus | 'ALL')}
                aria-label="Filtrer par statut"
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PUBLISHED">Publiés</option>
                <option value="DRAFT">Brouillons</option>
                <option value="ARCHIVED">Archivés</option>
              </select>
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="p-10 text-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl space-y-3">
              <BookOpen className="w-8 h-8 text-gray-400 mx-auto" />
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Aucun cours ne correspond à vos filtres
              </div>
              <button
                type="button"
                onClick={openCreateWizard}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Créer votre premier cours
              </button>
            </div>
          ) : viewLayout === 'table' ? (
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4">Cours & Formats</th>
                      <th className="py-3 px-4">Modalité</th>
                      <th className="py-3 px-4">Tarif</th>
                      <th className="py-3 px-4">Inscrits</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 text-right">Actions de gestion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredCourses.map((course) => {
                      const mod = MODALITY_META[course.modality];
                      const ModIcon = mod.icon;
                      const st = STATUS_META[course.status];
                      const totalLessons = course.chapters.reduce((s, ch) => s + ch.lessons.length, 0);
                      const lessonTypes = Array.from(
                        new Set(course.chapters.flatMap((ch) => ch.lessons.map((l) => l.type))),
                      );

                      return (
                        <tr
                          key={course.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={resolveCover(course.images[0])}
                                alt={course.title}
                                referrerPolicy="no-referrer"
                                className="w-14 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-xs">
                                  {course.title}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                  <span>{course.category}</span>
                                  <span>·</span>
                                  <span className="font-mono">
                                    {course.chapters.length} ch. / {totalLessons} leçons
                                  </span>
                                  {lessonTypes.map((t) => {
                                    const Icon = LESSON_ICON[t];
                                    return (
                                      <span
                                        key={t}
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                                      >
                                        <Icon className="w-2.5 h-2.5" />
                                        {LESSON_LABEL[t]}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${mod.className}`}
                            >
                              <ModIcon className="w-3 h-3" />
                              {mod.label}
                            </span>
                            {course.nextSessionDate && (
                              <div className="text-[11px] font-mono text-gray-400 mt-1">
                                {course.nextSessionDate}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {course.pricingModel === 'FREE' ? 'Gratuit' : formatFcfa(course.priceFcfa)}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                            {course.enrolledCount}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {confirmDeleteId === course.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-rose-600 font-semibold">Supprimer ?</span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteCourse(course.id)}
                                  className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-semibold"
                                >
                                  Oui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-[11px]"
                                >
                                  Non
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditWizard(course)}
                                  title="Modifier le cours"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Modifier
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setPreviewCourse(course)}
                                  title="Aperçu apprenant"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-blue-700 dark:text-blue-300"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Aperçu
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleChangeStatus(
                                      course,
                                      course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                                    )
                                  }
                                  title={
                                    course.status === 'PUBLISHED'
                                      ? 'Repasser en brouillon'
                                      : 'Publier le cours'
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                                    course.status === 'PUBLISHED'
                                      ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-900/20'
                                      : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20'
                                  }`}
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  {course.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void handleDuplicateCourse(course)}
                                  title="Dupliquer"
                                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>

                                {course.status !== 'ARCHIVED' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleChangeStatus(course, 'ARCHIVED')}
                                    title="Archiver"
                                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(course.id)}
                                  title="Supprimer"
                                  className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => {
                const mod = MODALITY_META[course.modality];
                const ModIcon = mod.icon;
                const st = STATUS_META[course.status];
                const totalLessons = course.chapters.reduce((s, ch) => s + ch.lessons.length, 0);

                return (
                  <div
                    key={course.id}
                    className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800">
                      <img
                        src={resolveCover(course.images[0])}
                        alt={course.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${mod.className}`}
                          >
                            <ModIcon className="w-3 h-3" />
                            {mod.label}
                          </span>
                          <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                            {course.pricingModel === 'FREE' ? 'Gratuit' : formatFcfa(course.priceFcfa)}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{course.title}</h4>
                        <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                          {course.estimatedDuration} · {course.chapters.length} chapitres · {totalLessons} leçons ·{' '}
                          {course.enrolledCount} inscrits
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditWizard(course)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewCourse(course)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                        >
                          Aperçu
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleChangeStatus(
                              course,
                              course.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                            )
                          }
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          {course.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDuplicateCourse(course)}
                          title="Dupliquer"
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteCourse(course.id)}
                          title="Supprimer"
                          className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDIO CRÉATION / ÉDITION 4 ÉTAPES */}
      {activeTab === 'wizard' && (
        <CourseCreatorWizard
          initialCourse={editingCourse}
          saving={savingCourse}
          onCancel={() => {
            setEditingCourse(null);
            setActiveTab('courses');
          }}
          onSave={handleSaveCourse}
        />
      )}

      {/* TAB 3: APPRENANTS & ÉMARGEMENT */}
      {activeTab === 'enrollments' && (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Suivi des apprenants B2B & Émargement
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-3 px-4">Apprenant & Entreprise</th>
                  <th className="py-3 px-4">Formation</th>
                  <th className="py-3 px-4">Modalité</th>
                  <th className="py-3 px-4">Progression</th>
                  <th className="py-3 px-4">Statut émargement</th>
                  <th className="py-3 px-4 text-right">Action formateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enrollments.map((enr) => {
                  const mod = MODALITY_META[enr.modality];
                  return (
                    <tr key={enr.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {enr.learnerName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{enr.companyName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-gray-800 dark:text-gray-200">
                        {enr.courseTitle}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${mod.className}`}>
                          {mod.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${enr.progressPct}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs">{enr.progressPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold">
                        <span
                          className={`px-2 py-0.5 rounded ${
                            enr.attendanceStatus === 'CERTIFIE'
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                              : enr.attendanceStatus === 'ABSENT'
                              ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {enr.attendanceStatus === 'CERTIFIE'
                            ? 'Certifié'
                            : enr.attendanceStatus === 'PRESENT'
                            ? 'Présent émargé'
                            : enr.attendanceStatus === 'EN_LIGNE_ACTIF'
                            ? 'Actif en ligne'
                            : 'Absent'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handleUpdateAttendance(enr.id, 'PRESENT')}
                          className="px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Émarger Présent
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleUpdateAttendance(enr.id, 'CERTIFIE')}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          Certifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ORGANISATION DES COURS (SÉANCES, CHECKLISTS & CHAPITRES) */}
      {activeTab === 'organization' && (
        <InstructorCourseOrganizationTab
          courses={courses}
          sessions={sessions}
          authHeaders={authHeaders}
          onSessionsChange={setSessions}
          onCoursesChange={setCourses}
          onNotify={(msg) => setFeedbackBanner(msg)}
        />
      )}

      {/* TAB 5: DEMANDES DE FORMATION & SUIVI GLOBAL EN TEMPS RÉEL */}
      {activeTab === 'requests' && (
        <TrainingRequestsRealtimePanel
          actorSpace="instructor"
          actorId={instructor.id}
          actorName={instructor.name}
          actorOrgName={`Formateur · ${instructor.city}`}
          coursesCatalog={courses}
          allowCreateRequest={true}
          initialRequestsPayload={trainingRequestsPayload}
          onSessionLinked={(linkedSession) => {
            setSessions((prev) => {
              const idx = prev.findIndex((s) => s.id === linkedSession.id);
              if (idx === -1) return [linkedSession, ...prev];
              const copy = [...prev];
              copy[idx] = linkedSession;
              return copy;
            });
          }}
          onNotify={(msg) => setFeedbackBanner(msg)}
        />
      )}

      {/* Learner Preview Modal */}
      {previewCourse && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl">
            <div className="relative h-52 bg-gray-900">
              <img
                src={resolveCover(previewCourse.images[0])}
                alt={previewCourse.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <button
                type="button"
                onClick={() => setPreviewCourse(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-4 left-6 right-6 text-white">
                <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  {previewCourse.category} · {MODALITY_META[previewCourse.modality].label}
                </div>
                <h3 className="text-xl font-bold mt-1">{previewCourse.title}</h3>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-gray-500">Lieu / Diffusion : </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {previewCourse.locationOrPlatform || 'Plateforme Teranga'}
                  </span>
                </div>
                <div className="font-mono font-bold text-orange-600 dark:text-orange-400">
                  {previewCourse.pricingModel === 'FREE'
                    ? 'Gratuit'
                    : formatFcfa(previewCourse.priceFcfa)}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Programme détaillé ({previewCourse.chapters.length} chapitres)
                </h4>
                {previewCourse.chapters.map((ch, i) => (
                  <div
                    key={ch.id}
                    className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2.5"
                  >
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {ch.title || `Chapitre ${i + 1}`}
                    </div>
                    <div className="space-y-2 pt-1">
                      {ch.lessons.map((l) => {
                        const LIcon = LESSON_ICON[l.type];
                        return (
                          <div
                            key={l.id}
                            className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <LIcon className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {l.title || 'Leçon sans titre'}
                                </div>
                                {l.fileName && (
                                  <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                                    Fichier : {l.fileName}
                                  </div>
                                )}
                                {l.textContent && (
                                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {l.textContent}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className="font-mono text-[11px] text-gray-500 shrink-0">
                              {LESSON_LABEL[l.type]} · {l.durationMinutes} min
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
