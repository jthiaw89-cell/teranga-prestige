import React, { useCallback, useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  FileText,
  Globe,
  GraduationCap,
  Infinity as InfinityIcon,
  Laptop,
  Layers,
  ListChecks,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  NotebookPen,
  Pause,
  Play,
  PlusCircle,
  Printer,
  Search,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  UserCheck,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { ProfileAvatar } from './ui/MediaAvatar';
import type {
  LearnerCourse,
  LearnerCourseSection,
  LearnerLesson,
  LearnerProfile,
  TrainingModality,
  TrainingProgram,
} from '../types';

const MODALITY_META: Record<
  TrainingModality,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  EN_LIGNE: {
    label: 'En ligne (À votre rythme)',
    badgeClass: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    icon: Laptop,
  },
  HYBRIDE: {
    label: 'Hybride (Visio + Présentiel)',
    badgeClass: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    icon: Layers,
  },
  PRESENTIEL: {
    label: 'Présentiel (Campus / Intra)',
    badgeClass: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    icon: MapPin,
  },
};

const FORMAT_LABELS: Record<'VIDEO' | 'SUPPORT_PDF' | 'ATELIER' | 'EVALUATION', string> = {
  VIDEO: 'Capsule Vidéo',
  SUPPORT_PDF: 'Support PDF',
  ATELIER: 'Atelier Pratique',
  EVALUATION: 'Évaluation Finale',
};

function formatMinutesLabel(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h}h 00`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function getCourseSections(course: LearnerCourse): LearnerCourseSection[] {
  if (course.sections && course.sections.length > 0) return course.sections;
  if (course.lessons.length <= 2) {
    return [
      {
        id: `${course.id}-sec-1`,
        title: 'Section 1 : Parcours principal & Validation',
        description: course.scheduleInfo,
        lessonIds: course.lessons.map((l) => l.id),
      },
    ];
  }
  const splitIdx = Math.ceil(course.lessons.length / 2);
  return [
    {
      id: `${course.id}-sec-1`,
      title: 'Section 1 : Fondamentaux & Architecture',
      lessonIds: course.lessons.slice(0, splitIdx).map((l) => l.id),
    },
    {
      id: `${course.id}-sec-2`,
      title: 'Section 2 : Pratique, Cas réels & Certification',
      lessonIds: course.lessons.slice(splitIdx).map((l) => l.id),
    },
  ];
}

export const LearnerPortalModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('tpd_learner_token'));
  const [learner, setLearner] = useState<LearnerProfile | null>(null);
  const [courses, setCourses] = useState<LearnerCourse[]>([]);
  const [catalog, setCatalog] = useState<(TrainingProgram & { isEnrolled?: boolean; description?: string })[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Portal navigation: list / catalog -> course_overview (image 1) -> course_player (image 2)
  const [portalView, setPortalView] = useState<'my_courses' | 'catalog'>('my_courses');
  const [courseScreen, setCourseScreen] = useState<'directory' | 'overview' | 'player'>('directory');
  const [modalityFilter, setModalityFilter] = useState<TrainingModality | 'ALL'>('ALL');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // Overview states (image 1)
  const [overviewTab, setOverviewTab] = useState<'overview' | 'content' | 'description' | 'instructor'>('overview');
  const [expandedSectionIds, setExpandedSectionIds] = useState<Record<string, boolean>>({});

  // Player states (image 2)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [isPlayingMedia, setIsPlayingMedia] = useState(false);
  const [mediaProgressPct, setMediaProgressPct] = useState(18);
  const [playerBottomTab, setPlayerBottomTab] = useState<'qa' | 'notes'>('qa');
  const [qaScope, setQaScope] = useState<'current' | 'all'>('current');
  const [qaSearch, setQaSearch] = useState('');
  const [qaFormOpen, setQaFormOpen] = useState(false);
  const [qaTitle, setQaTitle] = useState('');
  const [qaBody, setQaBody] = useState('');
  const [qaSubmitting, setQaSubmitting] = useState(false);

  const [noteInput, setNoteInput] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const [certificateCourse, setCertificateCourse] = useState<LearnerCourse | null>(null);
  const [newlyCertifiedBanner, setNewlyCertifiedBanner] = useState<string | null>(null);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Active-Space': 'learner',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadDashboard = useCallback(async (activeToken?: string | null) => {
    const hdrs: Record<string, string> = { 'X-Active-Space': 'learner' };
    if (activeToken) hdrs.Authorization = `Bearer ${activeToken}`;
    const [res, catRes] = await Promise.all([
      fetch('/api/learner/dashboard', { headers: hdrs, credentials: 'include' }),
      fetch('/api/platform/trainings', { headers: hdrs, credentials: 'include' }),
    ]);
    if (res.ok) {
      const data = (await res.json()) as { learner: LearnerProfile; courses: LearnerCourse[] };
      setLearner(data.learner);
      setCourses(data.courses || []);
      setSelectedCourseId((prev) => prev || data.courses?.[0]?.id || null);
    }
    if (catRes.ok) {
      const catData = (await catRes.json()) as {
        programs: (TrainingProgram & { isEnrolled?: boolean; description?: string })[];
      };
      setCatalog(catData.programs || []);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const hdrs: Record<string, string> = { 'X-Active-Space': 'learner' };
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/learner/auth/me', { headers: hdrs, credentials: 'include' });
      if (res.ok) {
        await loadDashboard(token);
      }
    })();
  }, [loadDashboard, token]);

  // Simulated video playback timer when Play is active in Player view
  useEffect(() => {
    if (!isPlayingMedia || courseScreen !== 'player') return;
    const timer = window.setInterval(() => {
      setMediaProgressPct((prev) => {
        if (prev >= 100) {
          setIsPlayingMedia(false);
          return 100;
        }
        return Math.min(100, prev + 2);
      });
    }, 600);
    return () => window.clearInterval(timer);
  }, [isPlayingMedia, courseScreen]);

  async function handleLogin(demoQuickAccess: boolean) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/learner/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(demoQuickAccess ? { demoQuickAccess: true } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion refusée.');
        return;
      }
      sessionStorage.setItem('tpd_learner_token', data.token);
      setToken(data.token);
      await loadDashboard(data.token);
    } catch {
      setError('Service apprenant indisponible.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/learner/auth/logout', { method: 'POST', headers: authHeaders, credentials: 'include' });
    sessionStorage.removeItem('tpd_learner_token');
    setToken(null);
    setLearner(null);
    setCourses([]);
    setCourseScreen('directory');
  }

  function openCourseOverview(course: LearnerCourse) {
    setSelectedCourseId(course.id);
    const secs = getCourseSections(course);
    const initialExpanded: Record<string, boolean> = {};
    secs.forEach((s, idx) => {
      initialExpanded[s.id] = idx === 0;
    });
    setExpandedSectionIds(initialExpanded);
    setOverviewTab('overview');
    setCourseScreen('overview');
  }

  function openCoursePlayer(course: LearnerCourse, lessonId?: string) {
    setSelectedCourseId(course.id);
    const secs = getCourseSections(course);
    const initialExpanded: Record<string, boolean> = {};
    secs.forEach((s) => {
      initialExpanded[s.id] = true;
    });
    setExpandedSectionIds(initialExpanded);
    const fallbackLesson =
      course.lessons.find((l) => !l.completed)?.id || course.lessons[0]?.id || null;
    setActiveLessonId(lessonId || fallbackLesson);
    setIsPlayingMedia(false);
    setMediaProgressPct(15);
    setCourseScreen('player');
  }

  async function toggleLesson(courseId: string, lessonId: string, forceCompleted?: boolean) {
    setNewlyCertifiedBanner(null);
    const res = await fetch('/api/learner/lessons/toggle', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ courseId, lessonId, completed: forceCompleted }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { course: LearnerCourse; newlyCertified: boolean };
    setCourses((prev) => prev.map((c) => (c.id === data.course.id ? data.course : c)));

    if (data.newlyCertified) {
      setNewlyCertifiedBanner(
        `Félicitations ! Votre attestation nominative pour « ${data.course.title} » a été générée et synchronisée avec votre formateur.`,
      );
      setCertificateCourse(data.course);
      try {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      } catch {
        // ignore if canvas unavailable
      }
    } else if (autoplay && courseScreen === 'player' && forceCompleted === true) {
      const idx = data.course.lessons.findIndex((l) => l.id === lessonId);
      const next = idx >= 0 ? data.course.lessons[idx + 1] : undefined;
      if (next) {
        setActiveLessonId(next.id);
        setMediaProgressPct(0);
        setIsPlayingMedia(next.format === 'VIDEO');
      }
    }
  }

  async function handleAskQuestion(e: React.FormEvent, courseId: string) {
    e.preventDefault();
    if (!qaTitle.trim() || !qaBody.trim()) return;
    setQaSubmitting(true);
    try {
      const res = await fetch(`/api/learner/courses/${courseId}/questions`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          lessonId: activeLessonId,
          title: qaTitle,
          body: qaBody,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { course: LearnerCourse };
      setCourses((prev) => prev.map((c) => (c.id === data.course.id ? data.course : c)));
      setQaTitle('');
      setQaBody('');
      setQaFormOpen(false);
    } finally {
      setQaSubmitting(false);
    }
  }

  async function handleSaveNote(e: React.FormEvent, courseId: string) {
    e.preventDefault();
    if (!activeLessonId || !noteInput.trim()) return;
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/learner/courses/${courseId}/notes`, {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({
          lessonId: activeLessonId,
          content: noteInput,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { course: LearnerCourse };
      setCourses((prev) => prev.map((c) => (c.id === data.course.id ? data.course : c)));
      setNoteInput('');
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function enrollInCourse(instructorCourseId: string) {
    const res = await fetch('/api/learner/enroll', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ instructorCourseId }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { course: LearnerCourse };
    await loadDashboard(token);
    setSelectedCourseId(data.course.id);
    setPortalView('my_courses');
    openCourseOverview(data.course);
    setNewlyCertifiedBanner(
      `Inscription confirmée à « ${data.course.title} ». Votre formateur voit désormais votre avancement en direct.`,
    );
  }

  if (!learner) {
    return (
      <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Espace Personnel Apprenant B2B
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
            placeholder="E-mail apprenant B2B (ex. apprenant@teranga-demo.sn)"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe personnel"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(false)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Accéder à mon tableau de bord
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(true)}
            className="w-full py-2.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800 text-sm font-semibold rounded-lg transition"
          >
            Accès Démonstration Apprenant B2B (Awa Diagne — Sonatel Business)
          </button>
        </div>
      </div>
    );
  }

  const filteredCourses =
    modalityFilter === 'ALL' ? courses : courses.filter((c) => c.modality === modalityFilter);
  const activeCourse =
    courses.find((c) => c.id === selectedCourseId) || filteredCourses[0] || courses[0] || null;

  const totalLessons = courses.reduce((s, c) => s + c.lessons.length, 0);
  const completedLessons = courses.reduce(
    (s, c) => s + c.lessons.filter((l) => l.completed).length,
    0,
  );
  const overallProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const completedHours = courses.reduce((s, c) => {
    const ratio = c.lessons.length > 0 ? c.lessons.filter((l) => l.completed).length / c.lessons.length : 0;
    return s + Math.round(c.durationHours * ratio);
  }, 0);
  const totalHours = courses.reduce((s, c) => s + c.durationHours, 0);
  const certificatesEarned = courses.filter((c) => Boolean(c.certificate));

  // Certificate Modal component rendered once at bottom
  const certificateModal = certificateCourse?.certificate && (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white text-gray-900 rounded-2xl border-4 border-double border-amber-500 p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between no-print">
          <span className="text-xs font-mono font-semibold text-emerald-700">
            Document Officiel Vérifiable
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer / Enregistrer PDF
            </button>
            <button
              type="button"
              onClick={() => setCertificateCourse(null)}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-center space-y-3 py-4 border-y border-gray-200">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-widest">
            <Award className="w-4 h-4 text-amber-600" />
            Teranga Prestige Digital · Institut Formation B2B
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 uppercase">
            Attestation de Réussite & Certification
          </h2>
          <p className="text-sm text-gray-600">Nous certifions par la présente que</p>
          <div className="text-2xl font-bold text-blue-700">{learner.name}</div>
          <div className="text-xs font-medium text-gray-600">
            {learner.jobTitle} — {learner.companyName}
          </div>
          <p className="text-sm text-gray-600 pt-2">a suivi et validé avec succès la formation professionnelle :</p>
          <div className="text-lg font-bold text-gray-900">« {certificateCourse.title} »</div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 pt-2">
            <span>Modalité : {MODALITY_META[certificateCourse.modality].label}</span>
            <span>·</span>
            <span>Volume : {certificateCourse.durationHours} heures</span>
            <span>·</span>
            <span>{certificateCourse.certificate.mention}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 text-xs text-gray-600 pt-2">
          <div>
            <div className="font-semibold text-gray-900">Formateur référent</div>
            <div>{certificateCourse.instructor}</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-gray-900">
              N° {certificateCourse.certificate.certificateNumber}
            </div>
            <div>Délivré à Dakar le {certificateCourse.certificate.issuedAt}</div>
          </div>
          <div className="text-right">
            <div className="font-semibold text-gray-900">Direction Pédagogique</div>
            <div>Teranga Prestige Digital</div>
          </div>
        </div>
      </div>
    </div>
  );

  // =========================================================================
  // VUE LECTEUR DE COURS SPLIT-PANE (ADAPTÉE DE L'IMAGE 2)
  // =========================================================================
  if (courseScreen === 'player' && activeCourse) {
    const sections = getCourseSections(activeCourse);
    const activeLesson: LearnerLesson =
      activeCourse.lessons.find((l) => l.id === activeLessonId) || activeCourse.lessons[0];
    const activeIdx = activeCourse.lessons.findIndex((l) => l.id === activeLesson?.id);
    const prevLesson = activeIdx > 0 ? activeCourse.lessons[activeIdx - 1] : null;
    const nextLesson =
      activeIdx >= 0 && activeIdx < activeCourse.lessons.length - 1
        ? activeCourse.lessons[activeIdx + 1]
        : null;
    const activeSection =
      sections.find((s) => s.lessonIds.includes(activeLesson?.id || '')) || sections[0];

    const doneCount = activeCourse.lessons.filter((l) => l.completed).length;
    const totalCount = activeCourse.lessons.length;
    const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    const allQuestions = activeCourse.questions || [];
    const filteredQuestions = allQuestions.filter((q) => {
      if (qaScope === 'current' && activeLesson && q.lessonId !== activeLesson.id) return false;
      if (!qaSearch.trim()) return true;
      const s = qaSearch.toLowerCase();
      return (
        q.title.toLowerCase().includes(s) ||
        q.body.toLowerCase().includes(s) ||
        q.authorName.toLowerCase().includes(s)
      );
    });

    const lessonNotes = (activeCourse.notes || []).filter(
      (n) => !activeLesson || n.lessonId === activeLesson.id,
    );

    const activeElapsedSeconds = activeLesson
      ? Math.round((mediaProgressPct / 100) * activeLesson.durationMinutes * 60)
      : 0;
    const formatClock = (secs: number) =>
      `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

    return (
      <div className="space-y-4 no-print">
        {newlyCertifiedBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              {newlyCertifiedBanner}
            </div>
            <button
              type="button"
              onClick={() => setNewlyCertifiedBanner(null)}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Fermer
            </button>
          </div>
        )}

        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm flex flex-col lg:flex-row min-h-[680px]">
          {/* Left Curriculum Sidebar (Image 2) */}
          {sidebarOpen && (
            <aside className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950 flex flex-col justify-between">
              <div className="flex flex-col flex-1 overflow-y-auto">
                {/* Course Mini Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-3 bg-white dark:bg-gray-900">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setCourseScreen('overview')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Fiche du cours
                    </button>
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      title="Réduire le sommaire"
                      className="hidden lg:inline-flex p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
                      {activeCourse.title}
                    </h3>
                    <div className="mt-2.5 w-full h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct === 100 ? 'bg-emerald-500' : 'bg-gray-900 dark:bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-gray-500 dark:text-gray-400">
                      <span>
                        {doneCount} sur {totalCount} leçons
                      </span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{pct}%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      {activeCourse.rating ?? 4.8}
                      <span className="text-gray-400">({activeCourse.reviewsCount ?? 42})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCourseScreen('overview')}
                      className="inline-flex items-center gap-1 font-semibold hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Ressources
                    </button>
                  </div>
                </div>

                {/* Sections & Lessons Tree */}
                <div className="p-3 space-y-2.5 flex-1">
                  {sections.map((sec) => {
                    const secLessons = activeCourse.lessons.filter((l) => sec.lessonIds.includes(l.id));
                    const secDone = secLessons.filter((l) => l.completed).length;
                    const isOpen = expandedSectionIds[sec.id] ?? true;

                    return (
                      <div
                        key={sec.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSectionIds((prev) => ({ ...prev, [sec.id]: !isOpen }))
                          }
                          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                              {sec.title}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                              {secDone}/{secLessons.length}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-gray-100 dark:border-gray-800 p-1.5 space-y-1">
                            {secLessons.map((les) => {
                              const isCurrent = activeLesson?.id === les.id;
                              const LIcon =
                                les.format === 'VIDEO'
                                  ? Video
                                  : les.format === 'SUPPORT_PDF'
                                  ? FileText
                                  : les.format === 'ATELIER'
                                  ? Users
                                  : Award;

                              return (
                                <button
                                  key={les.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveLessonId(les.id);
                                    setMediaProgressPct(0);
                                    setIsPlayingMedia(false);
                                  }}
                                  className={`w-full px-2.5 py-2.5 rounded-lg text-left flex items-center justify-between gap-2 transition ${
                                    isCurrent
                                      ? 'bg-gray-900 dark:bg-blue-600 text-white shadow-xs'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <LIcon
                                      className={`w-3.5 h-3.5 shrink-0 ${
                                        isCurrent
                                          ? 'text-blue-300 dark:text-white'
                                          : 'text-gray-400 dark:text-gray-500'
                                      }`}
                                    />
                                    <span className="text-xs font-medium truncate">{les.title}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className={`text-[10px] font-mono ${
                                        isCurrent ? 'text-gray-300 dark:text-blue-100' : 'text-gray-400'
                                      }`}
                                    >
                                      {les.durationMinutes}m
                                    </span>
                                    {les.completed ? (
                                      <CheckCircle2
                                        className={`w-4 h-4 ${
                                          isCurrent ? 'text-emerald-400' : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      />
                                    ) : (
                                      <Circle
                                        className={`w-4 h-4 ${
                                          isCurrent ? 'text-gray-400 dark:text-blue-200' : 'text-gray-300 dark:text-gray-600'
                                        }`}
                                      />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Certificate Unlock Box (Image 2 bottom left) */}
              <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                {activeCourse.certificate ? (
                  <button
                    type="button"
                    onClick={() => setCertificateCourse(activeCourse)}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 shadow-xs transition"
                  >
                    <Award className="w-4 h-4" />
                    Certificat débloqué · Ouvrir PDF
                  </button>
                ) : (
                  <div className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-medium text-gray-500 dark:text-gray-400 inline-flex items-center justify-center gap-2">
                    <Award className="w-4 h-4 text-gray-400" />
                    Certificat débloqué à 100% ({pct}%)
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* Right Main Lesson Stage (Image 2) */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Lesson Top Bar */}
            <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {!sidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    title="Afficher le sommaire"
                    className="mt-0.5 p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                    {activeSection?.title}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {activeLesson?.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                      {activeLesson ? FORMAT_LABELS[activeLesson.format] : 'Module'}
                    </span>
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {activeLesson?.durationMinutes ?? 30} min
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {MODALITY_META[activeCourse.modality].label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoplay((v) => !v)}
                  className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span
                    className={`w-7 h-4 rounded-full transition relative inline-block ${
                      autoplay ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${
                        autoplay ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </span>
                  Lecture auto
                </button>

                <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    disabled={!prevLesson}
                    onClick={() => {
                      if (prevLesson) {
                        setActiveLessonId(prevLesson.id);
                        setMediaProgressPct(0);
                        setIsPlayingMedia(false);
                      }
                    }}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                    title="Leçon précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!nextLesson}
                    onClick={() => {
                      if (nextLesson) {
                        setActiveLessonId(nextLesson.id);
                        setMediaProgressPct(0);
                        setIsPlayingMedia(false);
                      }
                    }}
                    className="p-2 border-l border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
                    title="Leçon suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {activeLesson && (
                  <button
                    type="button"
                    onClick={() => void toggleLesson(activeCourse.id, activeLesson.id, !activeLesson.completed)}
                    className={`min-h-[38px] px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs ${
                      activeLesson.completed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    {activeLesson.completed ? 'Terminé ✓' : 'Marquer comme terminé'}
                  </button>
                )}
              </div>
            </div>

            {/* Dark Cinema Media / Content Frame (Image 2 center) */}
            <div className="p-4 sm:p-6 space-y-6">
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 text-white shadow-md">
                {activeLesson?.format === 'VIDEO' ? (
                  <div className="relative min-h-[290px] sm:min-h-[380px] flex flex-col justify-between">
                    {activeCourse.coverImage && (
                      <img
                        src={activeCourse.coverImage}
                        alt={activeLesson.title}
                        className="absolute inset-0 w-full h-full object-cover opacity-35"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/35" />

                    {/* Top badge */}
                    <div className="relative z-10 p-4 flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-white/10 backdrop-blur-xs text-[11px] font-semibold text-blue-200 border border-white/10">
                        Capsule Vidéo HD · {activeCourse.instructor}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white/10 text-[11px] font-mono text-slate-200">
                        {activeLesson.durationMinutes} min
                      </span>
                    </div>

                    {/* Center Play CTA + Prev/Next Overlays (matching image_13dfa1a0.png) */}
                    <div className="relative z-10 px-4 sm:px-8 flex items-center justify-between gap-3 my-auto">
                      <button
                        type="button"
                        disabled={!prevLesson}
                        onClick={() => {
                          if (prevLesson) {
                            setActiveLessonId(prevLesson.id);
                            setMediaProgressPct(0);
                          }
                        }}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/75 text-xs font-semibold text-white/90 disabled:opacity-30 transition"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Précédent
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPlayingMedia((p) => !p)}
                        className="mx-auto w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl transition transform hover:scale-105"
                        aria-label={isPlayingMedia ? 'Mettre en pause' : 'Lire la capsule'}
                      >
                        {isPlayingMedia ? (
                          <Pause className="w-7 h-7" />
                        ) : (
                          <Play className="w-7 h-7 ml-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={!nextLesson}
                        onClick={() => {
                          if (nextLesson) {
                            setActiveLessonId(nextLesson.id);
                            setMediaProgressPct(0);
                          }
                        }}
                        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 hover:bg-black/75 text-xs font-semibold text-white/90 disabled:opacity-30 transition"
                      >
                        Suivant
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Bottom Video Control Bar */}
                    <div className="relative z-10 bg-black/75 backdrop-blur-xs px-4 py-3 space-y-2">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={mediaProgressPct}
                        onChange={(e) => setMediaProgressPct(Number(e.target.value))}
                        className="w-full accent-blue-500 cursor-pointer h-1.5"
                      />
                      <div className="flex items-center justify-between text-xs text-slate-200">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPlayingMedia((p) => !p)}
                            className="hover:text-white"
                          >
                            {isPlayingMedia ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <span className="font-mono text-[11px] tabular-nums">
                            {formatClock(activeElapsedSeconds)} / {formatClock(activeLesson.durationMinutes * 60)}
                          </span>
                          <span className="hidden sm:inline text-slate-400 truncate max-w-[260px]">
                            {activeLesson.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Volume2 className="w-4 h-4" />
                          <span className="text-[11px] font-mono">1080p</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Structured Document / Workshop / Evaluation Stage */
                  <div className="p-6 sm:p-8 min-h-[290px] sm:min-h-[340px] flex flex-col justify-between bg-gradient-to-br from-slate-900 via-[#0B1E40] to-slate-950">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-500/20 text-blue-200 border border-blue-400/30 text-[11px] font-semibold">
                        {activeLesson ? FORMAT_LABELS[activeLesson.format] : 'Module'}
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        Durée estimée : {activeLesson?.durationMinutes ?? 45} min
                      </span>
                    </div>

                    <div className="my-6 max-w-2xl space-y-3">
                      <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                        {activeLesson?.title}
                      </h3>
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1">
                        <div className="font-semibold text-white">Modalité & Planning</div>
                        <div>{activeCourse.scheduleInfo}</div>
                        <div>Formateur référent : {activeCourse.instructor}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        disabled={!prevLesson}
                        onClick={() => prevLesson && setActiveLessonId(prevLesson.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-35"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Précédent
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          activeLesson &&
                          void toggleLesson(activeCourse.id, activeLesson.id, !activeLesson.completed)
                        }
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {activeLesson?.completed
                          ? 'Module validé — Passer au suivant'
                          : 'Valider ce module maintenant'}
                      </button>

                      <button
                        type="button"
                        disabled={!nextLesson}
                        onClick={() => nextLesson && setActiveLessonId(nextLesson.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-35"
                      >
                        Suivant
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Below-Player Tabs: Questions & Réponses + Notes personnelles (Image 2 bottom) */}
              <div className="space-y-4">
                <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setPlayerBottomTab('qa')}
                    className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition inline-flex items-center gap-2 ${
                      playerBottomTab === 'qa'
                        ? 'border-gray-900 dark:border-blue-400 text-gray-900 dark:text-gray-100'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Questions & Réponses
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-mono">
                      {allQuestions.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerBottomTab('notes')}
                    className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 transition inline-flex items-center gap-2 ${
                      playerBottomTab === 'notes'
                        ? 'border-gray-900 dark:border-blue-400 text-gray-900 dark:text-gray-100'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    <NotebookPen className="w-4 h-4" />
                    Notes personnelles
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-mono">
                      {lessonNotes.length}
                    </span>
                  </button>
                </div>

                {playerBottomTab === 'qa' ? (
                  <div className="space-y-4">
                    {/* Q&A Search & Filter Toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={qaSearch}
                          onChange={(e) => setQaSearch(e.target.value)}
                          placeholder="Rechercher dans toutes les questions du cours..."
                          className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() => setQaScope('current')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                            qaScope === 'current'
                              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          Leçon actuelle
                        </button>
                        <button
                          type="button"
                          onClick={() => setQaScope('all')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                            qaScope === 'all'
                              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          Toutes les leçons
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setQaFormOpen((v) => !v)}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                      >
                        Poser une question
                      </button>
                    </div>

                    {qaFormOpen && (
                      <form
                        onSubmit={(e) => void handleAskQuestion(e, activeCourse.id)}
                        className="p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 space-y-3"
                      >
                        <input
                          type="text"
                          required
                          value={qaTitle}
                          onChange={(e) => setQaTitle(e.target.value)}
                          placeholder="Objet de votre question (ex. Cas pratique TVA SYSCOHADA)"
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                        <textarea
                          rows={2}
                          required
                          value={qaBody}
                          onChange={(e) => setQaBody(e.target.value)}
                          placeholder="Précisez votre question pour le formateur..."
                          className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setQaFormOpen(false)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={qaSubmitting}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            {qaSubmitting ? 'Envoi...' : 'Publier la question'}
                          </button>
                        </div>
                      </form>
                    )}

                    {filteredQuestions.length === 0 ? (
                      <div className="p-6 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
                        Aucune question.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredQuestions.map((q) => (
                          <div
                            key={q.id}
                            className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {q.authorName}
                              </span>
                              <span className="font-mono text-[11px] text-gray-400">
                                {q.createdAt.slice(0, 10)}
                              </span>
                            </div>
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {q.title}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{q.body}</p>
                            {q.instructorReply && (
                              <div className="mt-2 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-xs">
                                <div className="font-semibold text-blue-800 dark:text-blue-300 mb-0.5">
                                  Réponse du formateur ({activeCourse.instructor}) :
                                </div>
                                <div className="text-gray-700 dark:text-gray-300">{q.instructorReply}</div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <form
                      onSubmit={(e) => void handleSaveNote(e, activeCourse.id)}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        type="text"
                        required
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder={`Ajouter une note personnelle sur « ${activeLesson?.title || 'ce module'} »...`}
                        className="flex-1 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="submit"
                        disabled={noteSubmitting}
                        className="min-h-[42px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0"
                      >
                        {noteSubmitting ? 'Sauvegarde...' : 'Enregistrer la note'}
                      </button>
                    </form>

                    {lessonNotes.length === 0 ? (
                      <div className="p-5 rounded-xl border border-gray-100 dark:border-gray-800 text-center text-xs text-gray-500 dark:text-gray-400">
                        Aucune note.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {lessonNotes.map((n) => (
                          <div
                            key={n.id}
                            className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950 flex items-start justify-between gap-3"
                          >
                            <p className="text-xs text-gray-800 dark:text-gray-200">{n.content}</p>
                            <span className="font-mono text-[10px] text-gray-400 shrink-0">
                              {n.updatedAt.slice(0, 10)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {certificateModal}
      </div>
    );
  }

  // =========================================================================
  // VUE FICHE COMPLÈTE DU COURS (ADAPTÉE DE L'IMAGE 1)
  // =========================================================================
  if (courseScreen === 'overview' && activeCourse) {
    const sections = getCourseSections(activeCourse);
    const totalLessonMinutes = activeCourse.lessons.reduce((s, l) => s + l.durationMinutes, 0);
    const doneCount = activeCourse.lessons.filter((l) => l.completed).length;
    const pct =
      activeCourse.lessons.length > 0
        ? Math.round((doneCount / activeCourse.lessons.length) * 100)
        : 0;
    const allExpanded = sections.every((s) => expandedSectionIds[s.id]);
    const modMeta = MODALITY_META[activeCourse.modality];

    return (
      <div className="space-y-6 no-print">
        {/* Dark Navy Hero Banner (Image 1) */}
        <div className="rounded-2xl bg-[#0B1E40] dark:bg-[#07142B] text-white p-6 sm:p-8 lg:p-10 shadow-md">
          <div className="max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-blue-200/90">
              <button
                type="button"
                onClick={() => setCourseScreen('directory')}
                className="inline-flex items-center gap-1 font-semibold hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Mes formations
              </button>
              <span className="text-blue-400">&gt;</span>
              <span className="text-white/90 font-medium truncate">{activeCourse.title}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-white/15 text-white text-[11px] font-semibold">
                {activeCourse.category}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-blue-500/30 border border-blue-400/30 text-blue-100 text-[11px] font-semibold">
                {modMeta.label}
              </span>
              {activeCourse.certificate && (
                <span className="px-2.5 py-0.5 rounded bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[11px] font-semibold inline-flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  Certificat délivré
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
              {activeCourse.title}
            </h1>

            {/* Metadata strip */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-blue-100 pt-1">
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <span className="text-amber-400 font-mono">{activeCourse.rating ?? 4.8}</span>
                <span className="inline-flex text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                </span>
                <span className="text-blue-200">({activeCourse.reviewsCount ?? 42} avis B2B)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-300" />
                {activeCourse.durationHours}h ({formatMinutesLabel(totalLessonMinutes)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-300" />
                {activeCourse.lessons.length} leçons
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-300" />
                Français
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-emerald-300" />
                Certificat nominatif inclus
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <ProfileAvatar
                src={activeCourse.instructorAvatarUrl}
                name={activeCourse.instructor}
                size="md"
                tone="blue"
                className="border-white/30"
              />
              <div className="text-xs">
                <div className="text-blue-200">Animé par</div>
                <div className="font-semibold text-white">
                  {activeCourse.instructor} · Sponsor {activeCourse.companySponsor}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Overview Grid with Floating Right Sticky Card (Image 1) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Main Content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Horizontal Sub-Nav */}
            <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
              {(
                [
                  { id: 'overview', label: 'Aperçu' },
                  { id: 'content', label: 'Contenu du cours' },
                  { id: 'description', label: 'Description & Planning' },
                  { id: 'instructor', label: 'Formateur' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOverviewTab(tab.id)}
                  className={`pb-3 text-xs sm:text-sm font-semibold border-b-2 whitespace-nowrap transition ${
                    overviewTab === tab.id
                      ? 'border-gray-900 dark:border-blue-400 text-gray-900 dark:text-gray-100'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {(overviewTab === 'overview' || overviewTab === 'description') && (
              <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  Ce qui est inclus dans cette formation
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(activeCourse.objectives || activeCourse.lessons.map((l) => l.summary)).map(
                    (obj, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{obj}</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {overviewTab === 'instructor' && (
              <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-4">
                <ProfileAvatar
                  src={activeCourse.instructorAvatarUrl}
                  name={activeCourse.instructor}
                  size="xl"
                  tone="blue"
                />
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {activeCourse.instructor}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    Sponsor entreprise : {activeCourse.companySponsor} · Démarrage : {activeCourse.startDate}
                  </div>
                </div>
              </div>
            )}

            {/* Contenu / Curriculum Accordions (Image 1 bottom) */}
            {(overviewTab === 'overview' || overviewTab === 'content') && (
              <div className="p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Contenu de la formation
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono">
                      {sections.length} section(s) · {activeCourse.lessons.length} leçon(s) ·{' '}
                      {formatMinutesLabel(totalLessonMinutes)} de contenu
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      sections.forEach((s) => {
                        next[s.id] = !allExpanded;
                      });
                      setExpandedSectionIds(next);
                    }}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {allExpanded ? 'Tout replier' : 'Tout déplier'}
                  </button>
                </div>

                <div className="space-y-3">
                  {sections.map((sec) => {
                    const secLessons = activeCourse.lessons.filter((l) => sec.lessonIds.includes(l.id));
                    const secDone = secLessons.filter((l) => l.completed).length;
                    const secMinutes = secLessons.reduce((s, l) => s + l.durationMinutes, 0);
                    const isOpen = expandedSectionIds[sec.id] ?? true;

                    return (
                      <div
                        key={sec.id}
                        className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSectionIds((prev) => ({ ...prev, [sec.id]: !isOpen }))
                          }
                          className="w-full px-4 py-3.5 bg-gray-50/80 dark:bg-gray-950 flex items-center justify-between gap-3 text-left hover:bg-gray-100/70 dark:hover:bg-gray-800/50 transition"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              {sec.title}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-gray-500 dark:text-gray-400">
                            <span>
                              {secDone}/{secLessons.length}
                            </span>
                            <span className="hidden sm:inline">
                              {secLessons.length} leçons · {formatMinutesLabel(secMinutes)}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                            {secLessons.map((les) => {
                              const LIcon =
                                les.format === 'VIDEO'
                                  ? Video
                                  : les.format === 'SUPPORT_PDF'
                                  ? FileText
                                  : les.format === 'ATELIER'
                                  ? Users
                                  : Award;
                              return (
                                <button
                                  key={les.id}
                                  type="button"
                                  onClick={() => openCoursePlayer(activeCourse, les.id)}
                                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition group"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <LIcon className="w-4 h-4 text-gray-500 group-hover:text-blue-600 shrink-0" />
                                    <div className="min-w-0">
                                      <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">
                                        {les.title}
                                      </div>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                        {FORMAT_LABELS[les.format]}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                      {les.durationMinutes} min
                                    </span>
                                    {les.completed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 text-blue-600 opacity-70 group-hover:opacity-100" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Sticky Preview Card (Image 1) */}
          <div className="lg:col-span-4 lg:-mt-28">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden sticky top-6">
              <div className="relative h-44 bg-slate-900 overflow-hidden group">
                {activeCourse.coverImage && (
                  <img
                    src={activeCourse.coverImage}
                    alt={activeCourse.title}
                    className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition duration-300"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                <button
                  type="button"
                  onClick={() => openCoursePlayer(activeCourse)}
                  className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-xs font-bold inline-flex items-center gap-1.5 shadow-md hover:bg-gray-100 transition"
                >
                  <Play className="w-3.5 h-3.5 fill-gray-900" />
                  Ouvrir le lecteur
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-600 dark:text-gray-400">Votre progression</span>
                    <span className="font-mono text-gray-900 dark:text-gray-100">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openCoursePlayer(activeCourse)}
                  className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition shadow-sm"
                >
                  {pct === 0
                    ? 'Commencer la formation'
                    : pct === 100
                    ? 'Revoir les leçons'
                    : 'Continuer la formation'}
                </button>

                {activeCourse.certificate && (
                  <button
                    type="button"
                    onClick={() => setCertificateCourse(activeCourse)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                  >
                    <Award className="w-4 h-4" />
                    Afficher mon Certificat PDF
                  </button>
                )}

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    Cette formation inclut :
                  </div>
                  <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <li className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>{activeCourse.durationHours}h de formation ({activeCourse.lessons.length} modules)</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <InfinityIcon className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Accès à votre rythme · {MODALITY_META[activeCourse.modality].label}</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Accessible sur ordinateur et mobile</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Certificat nominatif vérifiable à 100%</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                      <span>Langue : Français</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {certificateModal}
      </div>
    );
  }

  // =========================================================================
  // VUE RÉPERTOIRE DES FORMATIONS APPRENANT + CATALOGUE + CERTIFICATS
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Learner Profile Header */}
      <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {learner.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{learner.name}</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                <Building2 className="w-3 h-3" />
                {learner.companyName}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {learner.jobTitle} · <span className="font-mono">{learner.email}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setPortalView('my_courses')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                portalView === 'my_courses'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Mes formations ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setPortalView('catalog')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 ${
                portalView === 'catalog'
                  ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Catalogue Formateurs ({catalog.length})
            </button>
          </div>

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

      {newlyCertifiedBanner && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            {newlyCertifiedBanner}
          </div>
          <button
            type="button"
            onClick={() => setNewlyCertifiedBanner(null)}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 no-print">
        <div className="p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Parcours B2B inscrits
          </h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{courses.length}</p>
        </div>

        <div className="p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Progression globale
          </h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{overallProgress}%</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            {completedLessons}/{totalLessons} modules validés
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Volume horaire suivi
          </h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {completedHours}h / {totalHours}h
          </p>
        </div>

        <div className="p-5 sm:p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <Award className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Certificats obtenus
          </h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {certificatesEarned.length}
          </p>
        </div>
      </div>

      {portalView === 'catalog' ? (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4 no-print">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Catalogue des Formations Publiées (Espace Formateur Pro)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.map((item) => {
              const modMeta = MODALITY_META[item.modality || 'EN_LIGNE'];
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${modMeta.badgeClass}`}>
                      {modMeta.label}
                    </span>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{item.title}</h4>
                    <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 pt-1">
                      <span className="inline-flex items-center gap-1.5">
                        <ProfileAvatar
                          src={item.instructorAvatarUrl}
                          name={item.instructor}
                          size="xs"
                          tone="blue"
                        />
                        {item.instructor}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        {item.nextSession}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={item.isEnrolled}
                    onClick={() => void enrollInCourse(item.id)}
                    className={`w-full py-2 rounded-lg text-xs font-semibold transition ${
                      item.isEnrolled
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {item.isEnrolled ? 'Déjà inscrit à votre parcours' : 'S’inscrire à cette formation'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-6 no-print">
          {/* Modality Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'ALL', label: 'Toutes' },
                { id: 'EN_LIGNE', label: 'En ligne' },
                { id: 'HYBRIDE', label: 'Hybride' },
                { id: 'PRESENTIEL', label: 'Présentiel' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setModalityFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  modalityFilter === f.id
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredCourses.length === 0 ? (
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucune formation.
              </p>
              <button
                type="button"
                onClick={() => setPortalView('catalog')}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Explorer le catalogue des formateurs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map((course) => {
                const done = course.lessons.filter((l) => l.completed).length;
                const pct =
                  course.lessons.length > 0 ? Math.round((done / course.lessons.length) * 100) : 0;
                const modMeta = MODALITY_META[course.modality];
                const ModIcon = modMeta.icon;

                return (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div
                        onClick={() => openCourseOverview(course)}
                        className="relative h-36 bg-[#0B1E40] cursor-pointer overflow-hidden group"
                      >
                        {course.coverImage && (
                          <img
                            src={course.coverImage}
                            alt={course.title}
                            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${modMeta.badgeClass}`}
                          >
                            <ModIcon className="w-3 h-3" />
                            {modMeta.label}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/55 text-white font-mono text-[11px] font-bold">
                            {pct}%
                          </span>
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {course.rating ?? 4.8}
                          </span>
                          <span className="font-mono text-[11px] text-slate-200">
                            {course.lessons.length} leçons · {course.durationHours}h
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {course.category}
                        </div>
                        <h3
                          onClick={() => openCourseOverview(course)}
                          className="font-bold text-gray-900 dark:text-gray-100 leading-snug cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {course.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <ProfileAvatar
                            src={course.instructorAvatarUrl}
                            name={course.instructor}
                            size="xs"
                            tone="blue"
                          />
                          <span className="truncate">Formateur : {course.instructor}</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              pct === 100 ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="px-5 pb-5 pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCourseOverview(course)}
                        className="flex-1 min-h-[38px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Fiche du cours
                      </button>
                      <button
                        type="button"
                        onClick={() => openCoursePlayer(course)}
                        className="flex-1 min-h-[38px] px-3 py-2 rounded-lg bg-[#0B1E40] dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        {pct === 0 ? 'Démarrer' : pct === 100 ? 'Revoir' : 'Continuer'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mes Certificats & Attestations */}
          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Mes Certificats & Attestations nominatives ({certificatesEarned.length})
            </h3>
            {certificatesEarned.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Aucun certificat.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {certificatesEarned.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2"
                  >
                    <div className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      {c.certificate?.certificateNumber}
                    </div>
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">{c.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Délivré le {c.certificate?.issuedAt} à {learner.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCertificateCourse(c)}
                      className="w-full py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50"
                    >
                      Afficher / Imprimer PDF
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {certificateModal}
    </div>
  );
};
