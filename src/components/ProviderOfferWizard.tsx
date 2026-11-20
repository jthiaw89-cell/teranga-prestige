import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  ImagePlus,
  MapPin,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import serviceTraiteurImg from '../assets/images/service_traiteur_gala_1794941483603.jpg';
import serviceDjImg from '../assets/images/service_dj_sonorisation_1794941483737.jpg';
import serviceDecorImg from '../assets/images/service_decor_scenographie_1794941483444.jpg';
import type {
  ProviderIncludedService,
  ProviderOfferStatus,
  ProviderServiceOffer,
} from '../types';

export const PROVIDER_STUDIO_COVERS = [
  { label: 'Traiteur & Gastronomie', url: serviceTraiteurImg },
  { label: 'Animateur DJ & Sonorisation', url: serviceDjImg },
  { label: 'Scénographie & Décor', url: serviceDecorImg },
];

export const PROVIDER_CATEGORIES = [
  'Traiteur & Gastronomie',
  'Animateur & DJ',
  'Sonorisation & Éclairage',
  'Décoration & Scénographie',
  'Conférence & Séminaire',
  'Photographie & Vidéo',
  'Sécurité & Protocole',
  'Logistique & Chapiteaux',
];

export interface ProviderOfferDraft {
  id?: string;
  title: string;
  category: string;
  priceFcfa: number;
  referencePriceFcfa?: number;
  description: string;
  locationZone: string;
  capacityGuests: number;
  includedServices: ProviderIncludedService[];
  images: string[];
  status: ProviderOfferStatus;
}

interface Props {
  initialOffer?: ProviderServiceOffer | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (draft: ProviderOfferDraft, status: ProviderOfferStatus) => Promise<void>;
}

function createEmptyService(): ProviderIncludedService {
  return {
    id: `ps-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: '',
    details: '',
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

export const ProviderOfferWizard: React.FC<Props> = ({
  initialOffer,
  saving = false,
  onCancel,
  onSave,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formError, setFormError] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [draft, setDraft] = useState<ProviderOfferDraft>(() => {
    if (initialOffer) {
      return {
        id: initialOffer.id,
        title: initialOffer.title,
        category: initialOffer.category,
        priceFcfa: initialOffer.priceFcfa,
        referencePriceFcfa: initialOffer.referencePriceFcfa,
        description: initialOffer.description,
        locationZone: initialOffer.locationZone,
        capacityGuests: initialOffer.capacityGuests,
        includedServices: structuredClone(initialOffer.includedServices),
        images: [...initialOffer.images],
        status: initialOffer.status,
      };
    }

    return {
      title: '',
      category: PROVIDER_CATEGORIES[0],
      priceFcfa: 250000,
      referencePriceFcfa: undefined,
      description: '',
      locationZone: 'Dakar, Thiès, Saly',
      capacityGuests: 100,
      includedServices: [createEmptyService()],
      images: [],
      status: 'DRAFT',
    };
  });

  function addService() {
    setDraft((prev) => ({
      ...prev,
      includedServices: [...prev.includedServices, createEmptyService()],
    }));
  }

  function removeService(serviceId: string) {
    setDraft((prev) => ({
      ...prev,
      includedServices: prev.includedServices.filter((s) => s.id !== serviceId),
    }));
  }

  function updateService(serviceId: string, patch: Partial<ProviderIncludedService>) {
    setDraft((prev) => ({
      ...prev,
      includedServices: prev.includedServices.map((s) =>
        s.id === serviceId ? { ...s, ...patch } : s,
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

  async function handleSubmitOffer(targetStatus: ProviderOfferStatus) {
    setFormError('');
    if (!draft.title.trim()) {
      setFormError('Veuillez renseigner le nom de l’événement / prestation à l’étape 1.');
      setStep(1);
      return;
    }
    await onSave(draft, targetStatus);
  }

  const steps: { id: 1 | 2 | 3 | 4; label: string }[] = [
    { id: 1, label: '1. Détails' },
    { id: 2, label: '2. Prestation & logistique' },
    { id: 3, label: '3. Médias & visuels' },
    { id: 4, label: '4. Publication' },
  ];

  const coverPreview = draft.images[0] || PROVIDER_STUDIO_COVERS[0].url;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Top 4-Step Tab Navigation */}
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

      <div className="p-6 sm:p-8 space-y-6">
        {/* ÉTAPE 1 : DÉTAILS */}
        {step === 1 && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Nom de l’événement / prestation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={draft.title}
                onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex. Sonorisation complète pour conférence ou Traiteur Gala VIP"
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
                {PROVIDER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Tarif de la prestation (FCFA)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={draft.priceFcfa}
                  onChange={(e) => setDraft((p) => ({ ...p, priceFcfa: Number(e.target.value) }))}
                  placeholder="Ex. 250000"
                  className="w-full px-4 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Prix de référence barré (FCFA){' '}
                  <span className="font-normal text-gray-400">Optionnel</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={draft.referencePriceFcfa ?? ''}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      referencePriceFcfa: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  placeholder="Ex. 300000"
                  className="w-full px-4 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : PRESTATION & LOGISTIQUE (SANS DATE DE DÉBUT NI DATE DE FIN) */}
        {step === 2 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-orange-500" />
              Prestation & logistique
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                Description et bénéfices client
              </label>
              <textarea
                rows={4}
                value={draft.description}
                onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                placeholder="Décrivez votre prestation événementielle, les équipements fournis, la qualité de service et les bénéfices pour les organisateurs..."
                className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Lieu / zone d’intervention
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={draft.locationZone}
                    onChange={(e) => setDraft((p) => ({ ...p, locationZone: e.target.value }))}
                    placeholder="Ex. Dakar, Thiès, Diamniadio, Saly"
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                  Capacité / nombre de participants
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="number"
                    min={10}
                    value={draft.capacityGuests}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, capacityGuests: Number(e.target.value) || 0 }))
                    }
                    placeholder="100"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* Services inclus */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Services inclus ({draft.includedServices.length})
              </h4>
              <button
                type="button"
                onClick={addService}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold shadow-sm transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Ajouter un service
              </button>
            </div>

            <div className="space-y-3">
              {draft.includedServices.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                  Aucun service.
                </div>
              ) : (
                draft.includedServices.map((srv, idx) => (
                  <div
                    key={srv.id}
                    className="border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
                  >
                    <div className="md:col-span-5">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Service {idx + 1}
                      </label>
                      <input
                        type="text"
                        value={srv.name}
                        onChange={(e) => updateService(srv.id, { name: e.target.value })}
                        placeholder="Ex. Installation son et lumière"
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Détails
                      </label>
                      <textarea
                        rows={2}
                        value={srv.details}
                        onChange={(e) => updateService(srv.id, { details: e.target.value })}
                        placeholder="Matériel, durée, options..."
                        className="w-full px-3.5 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="md:col-span-1 flex md:justify-end md:pt-6">
                      <button
                        type="button"
                        onClick={() => removeService(srv.id)}
                        title="Supprimer ce service"
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : MÉDIAS & VISUELS */}
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
                PNG, JPG ou WebP · jusqu’à 4 images
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

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Ou sélectionner un visuel événementiel Teranga :
              </div>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_STUDIO_COVERS.map((preset) => (
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
                      alt={`Visuel ${idx + 1}`}
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
          </div>
        )}

        {/* ÉTAPE 4 : PUBLICATION */}
        {step === 4 && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Récapitulatif & mise en ligne
            </h3>

            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Aperçu de votre événement / service
              </div>

              <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="relative aspect-[16/10] bg-gray-200 dark:bg-gray-800">
                  <img
                    src={coverPreview}
                    alt={draft.title || 'Aperçu prestation'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                      {draft.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {draft.locationZone || 'Dakar'}
                    </span>
                  </div>

                  <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {draft.title.trim() || 'Nom de votre prestation'}
                  </h4>

                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      Jusqu’à {draft.capacityGuests} pers. · {draft.includedServices.length} services inclus
                    </div>
                    <div className="text-right">
                      {draft.referencePriceFcfa && draft.referencePriceFcfa > draft.priceFcfa && (
                        <div className="text-[11px] font-mono line-through text-gray-400">
                          {new Intl.NumberFormat('fr-FR').format(draft.referencePriceFcfa)} FCFA
                        </div>
                      )}
                      <div className="text-sm font-bold font-mono text-orange-600 dark:text-orange-400">
                        {new Intl.NumberFormat('fr-FR').format(draft.priceFcfa)} FCFA
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer matching screenshots */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Annuler
          </button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
            onClick={() => void handleSubmitOffer('DRAFT')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Enregistrer en brouillon
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold shadow-sm transition"
            >
              Continuer
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmitOffer('PUBLISHED')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving
                ? 'Publication...'
                : initialOffer
                ? 'Mettre à jour la prestation'
                : 'Publier dans le catalogue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
