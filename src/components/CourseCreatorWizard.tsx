import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  FileAudio,
  FileSpreadsheet,
  FileText,
  ImagePlus,
  Laptop,
  Layers,
  MapPin,
  Plus,
  Save,
  Trash2,
  Type,
  Upload,
  Video,
  X,
} from 'lucide-react';
import courseCloudImg from '../assets/images/course_cloud_cyber_1794940322970.jpg';
import courseFinanceImg from '../assets/images/course_syscohada_finance_1794940307275.jpg';
import courseEventsImg from '../assets/images/course_events_protocol_1794940323026.jpg';
import type {
  CourseLessonType,
  CourseLevel,
  CoursePricingModel,
  CourseStatus,
  InstructorChapter,
  InstructorCourse,
  InstructorLesson,
  TrainingModality,
} from '../types';

export const STUDIO_COURSE_COVERS = [
  { label: 'Cloud & Cybersécurité', url: courseCloudImg },
  { label: 'Finance & SYSCOHADA', url: courseFinanceImg },
  { label: 'Événementiel & Sommets', url: courseEventsImg },
];

const CATEGORIES = [
  'Formations & Masterclasses',
  'Ingénierie Numérique & Cloud',
  'Finance & Conformité',
  'Événementiel Corporate',
  'Management & Leadership',
];

const PRICING_MODELS: { value: CoursePricingModel; label: string }[] = [
  { value: 'ONE_TIME', label: 'Paiement unique' },
  { value: 'B2B_LICENSE', label: 'Licence Entreprise B2B' },
  { value: 'SUBSCRIPTION', label: 'Abonnement mensuel' },
  { value: 'FREE', label: 'Gratuit / Intra-entreprise' },
];

const LEVELS: { value: CourseLevel; label: string }[] = [
  { value: 'TOUS_NIVEAUX', label: 'Tous niveaux' },
  { value: 'DEBUTANT', label: 'Débutant' },
  { value: 'INTERMEDIAIRE', label: 'Intermédiaire' },
  { value: 'AVANCE', label: 'Avancé / Expert' },
];

const LESSON_TYPE_META: Record<
  CourseLessonType,
  { label: string; accept: string; icon: React.ComponentType<{ className?: string }> }
> = {
  VIDEO: { label: 'Vidéo', accept: 'video/*', icon: Video },
  PDF: { label: 'Document PDF', accept: '.pdf,application/pdf', icon: FileText },
  WORD: {
    label: 'Document Word (.docx)',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    icon: FileSpreadsheet,
  },
  AUDIO: { label: 'Audio / Podcast', accept: 'audio/*', icon: FileAudio },
  TEXTE: { label: 'Texte / Article', accept: '', icon: Type },
  ATELIER: { label: 'Atelier / Évaluation', accept: '.pdf,.doc,.docx', icon: Award },
};

const MODALITY_LABELS: Record<TrainingModality, string> = {
  EN_LIGNE: 'À distance (En ligne)',
  HYBRIDE: 'Hybride (Visio + Présentiel)',
  PRESENTIEL: 'Présentiel (Salle / Campus)',
};

export interface CourseWizardDraft {
  id?: string;
  title: string;
  category: string;
  pricingModel: CoursePricingModel;
  priceFcfa: number;
  promoPriceFcfa?: number;
  description: string;
  level: CourseLevel;
  estimatedDuration: string;
  modality: TrainingModality;
  locationOrPlatform: string;
  nextSessionDate: string;
  trailerYoutubeUrl: string;
  chapters: InstructorChapter[];
  images: string[];
  promoBadge: string;
  status: CourseStatus;
}

interface Props {
  initialCourse?: InstructorCourse | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (draft: CourseWizardDraft, publishStatus: CourseStatus) => Promise<void>;
}

function createEmptyLesson(): InstructorLesson {
  return {
    id: `il-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: '',
    type: 'VIDEO',
    durationMinutes: 20,
    resourceUrl: '',
    fileName: '',
    textContent: '',
    isFreePreview: false,
  };
}

function createEmptyChapter(index: number): InstructorChapter {
  return {
    id: `ch-${Date.now()}-${index}`,
    title: '',
    description: '',
    lessons: [],
  };
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 960;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const CourseCreatorWizard: React.FC<Props> = ({
  initialCourse,
  saving = false,
  onCancel,
  onSave,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState<CourseWizardDraft>(() => {
    if (initialCourse) {
      return {
        id: initialCourse.id,
        title: initialCourse.title,
        category: initialCourse.category,
        pricingModel: initialCourse.pricingModel,
        priceFcfa: initialCourse.priceFcfa,
        promoPriceFcfa: initialCourse.promoPriceFcfa,
        description: initialCourse.description,
        level: initialCourse.level,
        estimatedDuration: initialCourse.estimatedDuration,
        modality: initialCourse.modality,
        locationOrPlatform: initialCourse.locationOrPlatform || '',
        nextSessionDate: initialCourse.nextSessionDate || '2026-12-10',
        trailerYoutubeUrl: initialCourse.trailerYoutubeUrl || '',
        chapters: structuredClone(initialCourse.chapters),
        images: [...initialCourse.images],
        promoBadge: initialCourse.promoBadge || '',
        status: initialCourse.status,
      };
    }

    return {
      title: '',
      category: CATEGORIES[0],
      pricingModel: 'ONE_TIME',
      priceFcfa: 45000,
      promoPriceFcfa: undefined,
      description: '',
      level: 'TOUS_NIVEAUX',
      estimatedDuration: '',
      modality: 'EN_LIGNE',
      locationOrPlatform: 'Plateforme E-learning Teranga',
      nextSessionDate: '2026-12-10',
      trailerYoutubeUrl: '',
      chapters: [createEmptyChapter(1)],
      images: [],
      promoBadge: '',
      status: 'DRAFT',
    };
  });

  const totalLessons = draft.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);

  function addChapter() {
    setDraft((prev) => ({
      ...prev,
      chapters: [...prev.chapters, createEmptyChapter(prev.chapters.length + 1)],
    }));
  }

  function removeChapter(chapterId: string) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.filter((ch) => ch.id !== chapterId),
    }));
  }

  function updateChapter(chapterId: string, patch: Partial<InstructorChapter>) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) => (ch.id === chapterId ? { ...ch, ...patch } : ch)),
    }));
  }

  function addLesson(chapterId: string) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, lessons: [...ch.lessons, createEmptyLesson()] } : ch,
      ),
    }));
  }

  function removeLesson(chapterId: string, lessonId: string) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === chapterId
          ? { ...ch, lessons: ch.lessons.filter((l) => l.id !== lessonId) }
          : ch,
      ),
    }));
  }

  function updateLesson(chapterId: string, lessonId: string, patch: Partial<InstructorLesson>) {
    setDraft((prev) => ({
      ...prev,
      chapters: prev.chapters.map((ch) =>
        ch.id === chapterId
          ? {
              ...ch,
              lessons: ch.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
            }
          : ch,
      ),
    }));
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = Math.max(0, 4 - draft.images.length);
    const slice = Array.from(files).slice(0, remaining);
    const compressed: string[] = [];
    for (const f of slice) {
      try {
        const dataUrl = await compressImageToDataUrl(f);
        compressed.push(dataUrl);
      } catch {
        // ignore invalid image
      }
    }
    if (compressed.length > 0) {
      setDraft((prev) => ({ ...prev, images: [...prev.images, ...compressed].slice(0, 4) }));
    }
  }

  function handleAddImageUrl() {
    const clean = imageUrlInput.trim();
    if (!clean || draft.images.length >= 4) return;
    setDraft((prev) => ({ ...prev, images: [...prev.images, clean].slice(0, 4) }));
    setImageUrlInput('');
  }

  function handleRemoveImage(idx: number) {
    setDraft((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));
  }

  async function handleSubmitCourse(targetStatus: CourseStatus) {
    setFormError('');
    if (!draft.title.trim()) {
      setFormError('Veuillez renseigner le nom de la formation à l’étape 1.');
      setStep(1);
      return;
    }
    if (targetStatus === 'PUBLISHED' && totalLessons === 0) {
      setFormError('Ajoutez au moins une leçon dans un chapitre avant de publier.');
      setStep(2);
      return;
    }
    await onSave(draft, targetStatus);
  }

  const steps: { id: 1 | 2 | 3 | 4; label: string }[] = [
    { id: 1, label: '1. Détails' },
    { id: 2, label: '2. Contenu & livraison' },
    { id: 3, label: '3. Médias & visuels' },
    { id: 4, label: '4. Publication' },
  ];

  const lessonBreakdown = draft.chapters.reduce<Record<CourseLessonType, number>>(
    (acc, ch) => {
      ch.lessons.forEach((l) => {
        acc[l.type] = (acc[l.type] || 0) + 1;
      });
      return acc;
    },
    { VIDEO: 0, PDF: 0, WORD: 0, AUDIO: 0, TEXTE: 0, ATELIER: 0 },
  );

  const coverPreview = draft.images[0] || STUDIO_COURSE_COVERS[0].url;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Top 4-Step Tab Navigation matching the model screenshots */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {steps.map((s) => {
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`py-3.5 px-4 text-xs sm:text-sm font-semibold text-center border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : isCompleted
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {formError && (
        <div className="mx-6 mt-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {formError}
        </div>
      )}

      {/* Step Content */}
      <div className="p-6 sm:p-8 space-y-6">
        {step === 1 && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Nom du produit <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex. Formation complète : de zéro à expert"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Catégorie <span className="text-rose-500">*</span>
              </label>
              <select
                value={draft.category}
                onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Modèle de tarification <span className="text-rose-500">*</span>
              </label>
              <select
                value={draft.pricingModel}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, pricingModel: e.target.value as CoursePricingModel }))
                }
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
              >
                {PRICING_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Prix (FCFA) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={draft.pricingModel === 'FREE' ? 0 : draft.priceFcfa}
                  disabled={draft.pricingModel === 'FREE'}
                  onChange={(e) => setDraft((p) => ({ ...p, priceFcfa: Number(e.target.value) }))}
                  placeholder="45000"
                  className="w-full px-4 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Prix promotionnel barré (FCFA){' '}
                  <span className="font-normal text-gray-400">Optionnel</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={draft.promoPriceFcfa ?? ''}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      promoPriceFcfa: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  placeholder="Ex. 65000"
                  className="w-full px-4 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Description du produit / Bénéfices clients
              </label>
              <textarea
                rows={4}
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                placeholder="Décrivez les compétences et bénéfices obtenus par les apprenants."
                className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Programme & chapitres de la formation
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Niveau requis
                </label>
                <select
                  value={draft.level}
                  onChange={(e) => setDraft((p) => ({ ...p, level: e.target.value as CourseLevel }))}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
                >
                  {LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Durée totale estimée
                </label>
                <input
                  type="text"
                  value={draft.estimatedDuration}
                  onChange={(e) => setDraft((p) => ({ ...p, estimatedDuration: e.target.value }))}
                  placeholder="Ex. 5h 30min"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Modalité
                </label>
                <select
                  value={draft.modality}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, modality: e.target.value as TrainingModality }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
                >
                  <option value="EN_LIGNE">À distance (En ligne)</option>
                  <option value="HYBRIDE">Hybride (Visio + Présentiel)</option>
                  <option value="PRESENTIEL">Présentiel (Campus / Intra)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  {draft.modality === 'EN_LIGNE'
                    ? 'Plateforme de diffusion'
                    : draft.modality === 'HYBRIDE'
                    ? 'Salle & Lien visioconférence'
                    : 'Lieu / Salle de formation (Présentiel)'}
                </label>
                <input
                  type="text"
                  value={draft.locationOrPlatform}
                  onChange={(e) => setDraft((p) => ({ ...p, locationOrPlatform: e.target.value }))}
                  placeholder="Ex. Campus Teranga Dakar Plateau ou Lien Visio"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Date de prochaine session / ouverture
                </label>
                <input
                  type="date"
                  value={draft.nextSessionDate}
                  onChange={(e) => setDraft((p) => ({ ...p, nextSessionDate: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Vidéo bande-annonce (YouTube)
              </label>
              <input
                type="url"
                value={draft.trailerYoutubeUrl}
                onChange={(e) => setDraft((p) => ({ ...p, trailerYoutubeUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
              />
            </div>

            {/* Modules & Chapitres Header */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Modules & chapitres ({draft.chapters.length})
              </h4>
              <button
                type="button"
                onClick={addChapter}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Ajouter un chapitre
              </button>
            </div>

            {/* Chapters List */}
            <div className="space-y-4">
              {draft.chapters.map((chapter, idx) => (
                <div
                  key={chapter.id}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-2xl p-5 space-y-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="md:col-span-5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Chapitre {idx + 1}
                      </label>
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateChapter(chapter.id, { title: e.target.value })}
                        placeholder="Titre du chapitre"
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={chapter.description}
                        onChange={(e) => updateChapter(chapter.id, { description: e.target.value })}
                        placeholder="Objectifs du chapitre"
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-1 flex md:justify-end md:pt-6">
                      <button
                        type="button"
                        onClick={() => removeChapter(chapter.id)}
                        title="Supprimer le chapitre"
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <BookOpen className="w-3.5 h-3.5 text-gray-500" />
                      Leçons ({chapter.lessons.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => addLesson(chapter.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold transition whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter une leçon
                    </button>
                  </div>

                  {chapter.lessons.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Ce chapitre doit contenir au moins une leçon.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {chapter.lessons.map((lesson, lIdx) => {
                        const meta = LESSON_TYPE_META[lesson.type];
                        const TypeIcon = meta.icon;
                        return (
                          <div
                            key={lesson.id}
                            className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 space-y-3"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                              <div className="sm:col-span-5">
                                <input
                                  type="text"
                                  value={lesson.title}
                                  onChange={(e) =>
                                    updateLesson(chapter.id, lesson.id, { title: e.target.value })
                                  }
                                  placeholder={`Leçon ${lIdx + 1} : Titre du contenu`}
                                  className="w-full px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                                />
                              </div>

                              <div className="sm:col-span-4">
                                <div className="relative">
                                  <select
                                    value={lesson.type}
                                    onChange={(e) =>
                                      updateLesson(chapter.id, lesson.id, {
                                        type: e.target.value as CourseLessonType,
                                      })
                                    }
                                    aria-label="Type de contenu"
                                    className="w-full pl-3 pr-2 py-2 text-xs font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                                  >
                                    <option value="VIDEO">Vidéo (MP4 / YouTube)</option>
                                    <option value="PDF">Document PDF (.pdf)</option>
                                    <option value="WORD">Document Word (.docx)</option>
                                    <option value="AUDIO">Audio / Podcast (.mp3)</option>
                                    <option value="TEXTE">Texte / Article structuré</option>
                                    <option value="ATELIER">Atelier / Évaluation</option>
                                  </select>
                                </div>
                              </div>

                              <div className="sm:col-span-2 flex items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  value={lesson.durationMinutes}
                                  onChange={(e) =>
                                    updateLesson(chapter.id, lesson.id, {
                                      durationMinutes: Number(e.target.value) || 10,
                                    })
                                  }
                                  className="w-full px-2.5 py-2 text-xs font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                                />
                                <span className="text-[11px] text-gray-500">min</span>
                              </div>

                              <div className="sm:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeLesson(chapter.id, lesson.id)}
                                  title="Supprimer cette leçon"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Resource input based on type */}
                            {lesson.type === 'TEXTE' ? (
                              <textarea
                                rows={2}
                                value={lesson.textContent || ''}
                                onChange={(e) =>
                                  updateLesson(chapter.id, lesson.id, { textContent: e.target.value })
                                }
                                placeholder="Saisissez le texte pédagogique, les définitions clés ou le guide écrit de la leçon..."
                                className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                              />
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg">
                                  <TypeIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <input
                                    type="text"
                                    value={lesson.resourceUrl || ''}
                                    onChange={(e) =>
                                      updateLesson(chapter.id, lesson.id, {
                                        resourceUrl: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      lesson.type === 'VIDEO'
                                        ? 'Lien vidéo (YouTube, Vimeo, MP4)...'
                                        : `Lien ou référence ${meta.label}...`
                                    }
                                    className="w-full text-xs bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                                  />
                                </div>

                                {meta.accept && (
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
                                    <Upload className="w-3.5 h-3.5" />
                                    {lesson.fileName ? lesson.fileName : `Importer ${meta.label}`}
                                    <input
                                      type="file"
                                      accept={meta.accept}
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          updateLesson(chapter.id, lesson.id, {
                                            fileName: file.name,
                                            resourceUrl: lesson.resourceUrl || file.name,
                                          });
                                        }
                                      }}
                                    />
                                  </label>
                                )}

                                <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(lesson.isFreePreview)}
                                    onChange={(e) =>
                                      updateLesson(chapter.id, lesson.id, {
                                        isFreePreview: e.target.checked,
                                      })
                                    }
                                    className="rounded border-gray-300"
                                  />
                                  Aperçu gratuit
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-4xl mx-auto space-y-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Médias & visuels de présentation
            </h3>

            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleImageFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 shadow-sm"
              >
                <Upload className="w-4 h-4" />
                Importer des photos
              </button>
            </div>

            <div
              onClick={() => imageInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-400 dark:hover:border-orange-500 transition bg-gray-50/40 dark:bg-gray-950/40"
            >
              <ImagePlus className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Choisissez une ou plusieurs images
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Ajouter une image par URL (https://...)"
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap"
              >
                Ajouter URL
              </button>
            </div>

            {/* Quick Studio Cover Presets */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Ou sélectionner un visuel Teranga Studio :
              </div>
              <div className="flex flex-wrap gap-2">
                {STUDIO_COURSE_COVERS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={draft.images.length >= 4 || draft.images.includes(preset.url)}
                    onClick={() =>
                      setDraft((p) => ({ ...p, images: [...p.images, preset.url].slice(0, 4) }))
                    }
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:border-orange-400 text-xs font-medium text-gray-700 dark:text-gray-300 disabled:opacity-40"
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded object-cover"
                    />
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                {draft.images.map((imgSrc, idx) => (
                  <div
                    key={`${imgSrc.slice(0, 24)}-${idx}`}
                    className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 aspect-[4/3] bg-gray-100 dark:bg-gray-800"
                  >
                    <img
                      src={imgSrc}
                      alt={`Aperçu ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded bg-black/75 text-white text-[11px] font-semibold">
                        Couverture
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      aria-label="Retirer l'image"
                      className="absolute right-2 top-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Badge promotionnel ou étiquette de mise en valeur{' '}
                <span className="font-normal text-gray-400">Optionnel</span>
              </label>
              <input
                type="text"
                value={draft.promoBadge}
                onChange={(e) => setDraft((p) => ({ ...p, promoBadge: e.target.value }))}
                placeholder="Ex. Certifiant B2B, Nouveau, Offre de lancement"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Récapitulatif & mise en ligne
            </h3>

            {/* APERÇU DE VOTRE OFFRE */}
            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Aperçu de votre offre
              </div>

              <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="relative aspect-[16/10] bg-gray-200 dark:bg-gray-800">
                  <img
                    src={coverPreview}
                    alt={draft.title || 'Aperçu du cours'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {draft.promoBadge && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-400 text-gray-950 text-[11px] font-bold shadow">
                      {draft.promoBadge}
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      {draft.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                      {draft.modality === 'EN_LIGNE' ? (
                        <Laptop className="w-3.5 h-3.5 text-blue-500" />
                      ) : draft.modality === 'HYBRIDE' ? (
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      {MODALITY_LABELS[draft.modality]}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {draft.title.trim() || 'Titre de votre formation'}
                  </h4>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {draft.estimatedDuration || '4h 00min'} · {draft.chapters.length} chapitres ·{' '}
                      {totalLessons} leçons
                    </div>
                    <div className="text-right">
                      {draft.promoPriceFcfa && draft.promoPriceFcfa > draft.priceFcfa && (
                        <div className="text-[11px] font-mono line-through text-gray-400">
                          {new Intl.NumberFormat('fr-FR').format(draft.promoPriceFcfa)} FCFA
                        </div>
                      )}
                      <div className="text-sm font-bold font-mono text-orange-600 dark:text-orange-400">
                        {draft.pricingModel === 'FREE'
                          ? 'Gratuit'
                          : `${new Intl.NumberFormat('fr-FR').format(draft.priceFcfa)} FCFA`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Formats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 text-center">
                {(Object.keys(LESSON_TYPE_META) as CourseLessonType[]).map((t) => (
                  <div
                    key={t}
                    className="p-2.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs"
                  >
                    <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                      {lessonBreakdown[t]}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {LESSON_TYPE_META[t].label.split(' ')[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Annuler
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Précédent
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSubmitCourse('DRAFT')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Enregistrer en brouillon
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shadow-sm"
            >
              Suivant
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmitCourse('PUBLISHED')}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving
                ? 'Enregistrement...'
                : initialCourse
                ? 'Mettre à jour et publier'
                : 'Publier le cours'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
