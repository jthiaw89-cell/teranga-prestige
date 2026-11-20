import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Briefcase,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  FileCheck2,
  FileText,
  Globe,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  MapPin,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import serviceTraiteurImg from '../assets/images/service_traiteur_gala_1794941483603.jpg';
import serviceDjImg from '../assets/images/service_dj_sonorisation_1794941483737.jpg';
import serviceDecorImg from '../assets/images/service_decor_scenographie_1794941483444.jpg';
import type {
  ProviderOfferStatus,
  ProviderProfile,
  ProviderRequestStage,
  ProviderServiceOffer,
  ProviderServiceRequest,
} from '../types';
import {
  PROVIDER_CATEGORIES,
  ProviderOfferWizard,
  type ProviderOfferDraft,
} from './ProviderOfferWizard';
import { CompanyLogo, CompactImageUploader } from './ui/MediaAvatar';

const BUNDLED_COVER_MAP: Record<string, string> = {
  '/src/assets/images/service_traiteur_gala_1794941483603.jpg': serviceTraiteurImg,
  '/src/assets/images/service_dj_sonorisation_1794941483737.jpg': serviceDjImg,
  '/src/assets/images/service_decor_scenographie_1794941483444.jpg': serviceDecorImg,
};

function resolveCover(url?: string): string {
  if (!url) return serviceTraiteurImg;
  return BUNDLED_COVER_MAP[url] || url;
}

const OFFER_STATUS_META: Record<ProviderOfferStatus, { label: string; className: string }> = {
  PUBLISHED: {
    label: 'Publiée',
    className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  DRAFT: {
    label: 'Brouillon',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  ARCHIVED: {
    label: 'Archivée',
    className: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  },
};

const REQUEST_STAGE_META: Record<ProviderRequestStage, { label: string; className: string }> = {
  NOUVELLE_DEMANDE: {
    label: 'Nouvelle demande',
    className: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
  EN_ETUDE: {
    label: 'En traitement',
    className: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  },
  DEVIS_ENVOYE: {
    label: 'Devis envoyé',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  COMMANDE_CONFIRMEE: {
    label: 'Commande confirmée',
    className: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  },
  FACTURE_EMISE: {
    label: 'Facture émise',
    className: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  },
  PAYEE: {
    label: 'Payée',
    className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  REFUSEE: {
    label: 'Refusée',
    className: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  },
};

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export const ProviderPortalModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(() =>
    sessionStorage.getItem('tpd_provider_token'),
  );
  const [provider, setProvider] = useState<ProviderProfile | null>(null);
  const [offers, setOffers] = useState<ProviderServiceOffer[]>([]);
  const [requests, setRequests] = useState<ProviderServiceRequest[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Dashboard tabs & filters
  const [activeTab, setActiveTab] = useState<'offers' | 'requests' | 'missions' | 'wizard'>(
    'offers',
  );
  const [viewLayout, setViewLayout] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<ProviderOfferStatus | 'ALL'>('ALL');
  const [stageFilter, setStageFilter] = useState<ProviderRequestStage | 'ALL'>('ALL');

  // Action states
  const [editingOffer, setEditingOffer] = useState<ProviderServiceOffer | null>(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [previewOffer, setPreviewOffer] = useState<ProviderServiceOffer | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Quote modal & commercial document modal
  const [quoteDraftReq, setQuoteDraftReq] = useState<ProviderServiceRequest | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number>(0);
  const [quoteNotes, setQuoteNotes] = useState<string>('');
  const [documentPreviewReq, setDocumentPreviewReq] = useState<ProviderServiceRequest | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadDashboard = useCallback(async (activeToken?: string | null) => {
    const hdrs: Record<string, string> = {};
    if (activeToken) hdrs.Authorization = `Bearer ${activeToken}`;
    const res = await fetch('/api/provider/dashboard', { headers: hdrs, credentials: 'include' });
    if (!res.ok) return;
    const data = (await res.json()) as {
      provider: ProviderProfile;
      offers: ProviderServiceOffer[];
      requests: ProviderServiceRequest[];
    };
    setProvider(data.provider);
    setOffers(data.offers || []);
    setRequests(data.requests || []);
  }, []);

  useEffect(() => {
    (async () => {
      const hdrs: Record<string, string> = {};
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/provider/auth/me', { headers: hdrs, credentials: 'include' });
      if (res.ok) {
        await loadDashboard(token);
      }
    })();
  }, [loadDashboard, token]);

  // Real-time polling every 15s when authenticated so incoming requests stay live
  useEffect(() => {
    if (!provider) return;
    const timer = window.setInterval(() => {
      void loadDashboard(token);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [provider, token, loadDashboard]);

  async function handleLogin(demoQuickAccess: boolean) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/provider/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(demoQuickAccess ? { demoQuickAccess: true } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion prestataire refusée.');
        return;
      }
      sessionStorage.setItem('tpd_provider_token', data.token);
      setToken(data.token);
      await loadDashboard(data.token);
    } catch {
      setError('Service prestataires indisponible.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/provider/auth/logout', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
    });
    sessionStorage.removeItem('tpd_provider_token');
    setToken(null);
    setProvider(null);
    setOffers([]);
    setRequests([]);
  }

  async function handleUpdateProfileMedia(patch: {
    avatarUrl?: string | null;
    companyLogoUrl?: string | null;
  }) {
    setUploadingMedia(true);
    try {
      const payload: Record<string, string> = {};
      if (patch.avatarUrl !== undefined) payload.avatarUrl = patch.avatarUrl ?? '';
      if (patch.companyLogoUrl !== undefined) payload.companyLogoUrl = patch.companyLogoUrl ?? '';

      const res = await fetch('/api/provider/profile', {
        method: 'PATCH',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner(data.error || 'Mise à jour impossible.');
        return;
      }
      const nextProv = data.provider as ProviderProfile;
      setProvider(nextProv);
      setOffers((prev) =>
        prev.map((o) => ({
          ...o,
          providerAvatarUrl: nextProv.avatarUrl,
          companyLogoUrl: nextProv.companyLogoUrl,
        })),
      );
      setFeedbackBanner('Identité visuelle prestataire enregistrée.');
    } finally {
      setUploadingMedia(false);
    }
  }

  function openCreateWizard() {
    setEditingOffer(null);
    setActiveTab('wizard');
  }

  function openEditWizard(offer: ProviderServiceOffer) {
    setEditingOffer(offer);
    setActiveTab('wizard');
  }

  async function handleSaveOffer(draft: ProviderOfferDraft, targetStatus: ProviderOfferStatus) {
    setSavingOffer(true);
    try {
      const endpoint = draft.id ? `/api/provider/offers/${draft.id}` : '/api/provider/offers';
      const method = draft.id ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ ...draft, status: targetStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackBanner(data.error || 'Erreur lors de la sauvegarde.');
        return;
      }
      await loadDashboard(token);
      setEditingOffer(null);
      setActiveTab('offers');
      setFeedbackBanner(
        targetStatus === 'PUBLISHED'
          ? `Votre prestation « ${data.offer.title} » est publiée sur la plateforme.`
          : `Votre prestation « ${data.offer.title} » a été enregistrée en brouillon.`,
      );
    } finally {
      setSavingOffer(false);
    }
  }

  async function handleChangeOfferStatus(offer: ProviderServiceOffer, status: ProviderOfferStatus) {
    const res = await fetch(`/api/provider/offers/${offer.id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { offer: ProviderServiceOffer };
    setOffers((prev) => prev.map((o) => (o.id === data.offer.id ? data.offer : o)));
    setFeedbackBanner(
      status === 'PUBLISHED'
        ? `« ${offer.title} » publiée dans le catalogue.`
        : status === 'DRAFT'
        ? `« ${offer.title} » repassée en brouillon.`
        : `« ${offer.title} » archivée.`,
    );
  }

  async function handleDuplicateOffer(offer: ProviderServiceOffer) {
    const res = await fetch(`/api/provider/offers/${offer.id}/duplicate`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = (await res.json()) as { offer: ProviderServiceOffer };
    setOffers((prev) => [data.offer, ...prev]);
    setFeedbackBanner(`Prestation dupliquée : « ${data.offer.title} ».`);
  }

  async function handleDeleteOffer(offerId: string) {
    const res = await fetch(`/api/provider/offers/${offerId}`, {
      method: 'DELETE',
      headers: authHeaders,
      credentials: 'include',
    });
    if (!res.ok) return;
    setOffers((prev) => prev.filter((o) => o.id !== offerId));
    setConfirmDeleteId(null);
    setFeedbackBanner('La prestation a été supprimée.');
  }

  async function handleAdvanceRequestStage(
    requestId: string,
    stage: ProviderRequestStage,
    customAmount?: number,
    customNotes?: string,
  ) {
    const res = await fetch(`/api/provider/requests/${requestId}/stage`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        stage,
        ...(typeof customAmount === 'number' ? { amountFcfa: customAmount } : {}),
        ...(customNotes !== undefined ? { notes: customNotes } : {}),
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { request: ProviderServiceRequest };
    setRequests((prev) => prev.map((r) => (r.id === data.request.id ? data.request : r)));
    setQuoteDraftReq(null);
    setFeedbackBanner(
      `Demande de ${data.request.clientCompany} mise à jour : ${REQUEST_STAGE_META[stage].label}.`,
    );
  }

  async function handleSimulateIncomingRequest() {
    const targetOffer = offers.find((o) => o.status === 'PUBLISHED') || offers[0];
    if (!targetOffer) return;
    const res = await fetch('/api/provider/requests', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        offerId: targetOffer.id,
        clientName: 'M. Moussa Diagne',
        clientCompany: 'Groupe Wave Sénégal',
        clientEmail: 'evenements@wave-demo.sn',
        eventType: 'Convention Annuelle & Soirée de Clôture',
        eventDate: '2026-12-27',
        eventLocation: 'Almadies, Dakar',
        guestCount: targetOffer.capacityGuests || 150,
        notes: 'Demande urgente reçue en ligne : merci d’envoyer votre devis sous 24h.',
        amountFcfa: targetOffer.priceFcfa,
      }),
    });
    if (!res.ok) return;
    await loadDashboard(token);
    setActiveTab('requests');
    setFeedbackBanner('Nouvelle demande client reçue en temps réel !');
  }

  if (!provider) {
    return (
      <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Espace Prestataire Événementiel
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
            placeholder="E-mail prestataire (ex. prestataire@teranga-demo.sn)"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe prestataire"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(false)}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-gray-950 text-sm font-bold rounded-lg transition flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Accéder à mon espace prestataire
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleLogin(true)}
            className="w-full py-2.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-sm font-semibold rounded-lg transition"
          >
            Accès Démonstration Prestataire (Serigne Ba — Teranex Connect)
          </button>
        </div>
      </div>
    );
  }

  const publishedOffers = offers.filter((o) => o.status === 'PUBLISHED').length;
  const activeRequestsCount = requests.filter(
    (r) => r.stage === 'NOUVELLE_DEMANDE' || r.stage === 'EN_ETUDE',
  ).length;
  const quotesAndOrdersCount = requests.filter(
    (r) => r.stage === 'DEVIS_ENVOYE' || r.stage === 'COMMANDE_CONFIRMEE',
  ).length;
  const invoicedAndPaidTotal = requests
    .filter((r) => r.stage === 'FACTURE_EMISE' || r.stage === 'PAYEE')
    .reduce((sum, r) => sum + r.amountFcfa, 0);
  const pipelineTotal = requests
    .filter((r) => r.stage !== 'REFUSEE')
    .reduce((sum, r) => sum + r.amountFcfa, 0);

  const filteredOffers = offers.filter((o) => {
    const matchQ =
      !searchQuery.trim() ||
      o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.locationZone.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || o.category === categoryFilter;
    const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchQ && matchCat && matchStatus;
  });

  const filteredRequests = requests.filter((r) => {
    const matchStage = stageFilter === 'ALL' || r.stage === stageFilter;
    const matchQ =
      !searchQuery.trim() ||
      r.clientCompany.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.offerTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStage && matchQ;
  });

  const upcomingMissions = requests.filter(
    (r) =>
      r.stage === 'COMMANDE_CONFIRMEE' ||
      r.stage === 'FACTURE_EMISE' ||
      r.stage === 'DEVIS_ENVOYE',
  );

  return (
    <div className="space-y-6">
      {/* Provider Header */}
      <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 flex flex-col gap-4 shadow-sm no-print">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <CompanyLogo src={provider.companyLogoUrl} name={provider.companyName} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Bienvenue, {provider.name}
                </h2>
                <span className="text-xs text-gray-500 dark:text-gray-400">· {provider.city}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {provider.companyName} — {provider.roleTitle} ·{' '}
                <span className="font-mono">{provider.email}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard(token)}
              title="Actualiser en temps réel"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Temps réel
            </button>
            <button
              type="button"
              onClick={openCreateWizard}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold shadow-sm transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Créer une prestation
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

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-6">
          <CompactImageUploader
            label="Photo de profil"
            variant="avatar"
            name={provider.name}
            currentUrl={provider.avatarUrl}
            uploading={uploadingMedia}
            onUpload={(dataUrl) => handleUpdateProfileMedia({ avatarUrl: dataUrl })}
            onRemove={() => handleUpdateProfileMedia({ avatarUrl: null })}
            onError={(msg) => setFeedbackBanner(msg)}
          />
          <CompactImageUploader
            label="Logo entreprise"
            variant="logo"
            name={provider.companyName}
            currentUrl={provider.companyLogoUrl}
            uploading={uploadingMedia}
            onUpload={(dataUrl) => handleUpdateProfileMedia({ companyLogoUrl: dataUrl })}
            onRemove={() => handleUpdateProfileMedia({ companyLogoUrl: null })}
            onError={(msg) => setFeedbackBanner(msg)}
          />
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 no-print">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Briefcase className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Mes prestations</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {offers.length}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            {publishedOffers} publiées au catalogue
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-mono font-semibold text-blue-600">
              {requests.length} total
            </span>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Demandes à traiter</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {activeRequestsCount}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <FileCheck2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">
            Devis & Commandes
          </h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {quotesAndOrdersCount}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            Pipeline : {formatFcfa(pipelineTotal)}
          </p>
        </div>

        <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-600">FCFA</span>
          </div>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-1">Factures & Revenus</h3>
          <p className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
            {new Intl.NumberFormat('fr-FR').format(invoicedAndPaidTotal)}
          </p>
        </div>
      </div>

      {/* Sub-navigation tabs matching Teranex Connect flow */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'offers'
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Mes événements & prestations ({offers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'requests'
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Demandes, Devis, Commandes & Factures ({requests.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('missions')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'missions'
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            Missions à venir & Revenus ({upcomingMissions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wizard')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'wizard'
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
            }`}
          >
            {editingOffer ? `Éditer : ${editingOffer.title}` : '+ Créer une offre (4 étapes)'}
          </button>
        </div>

        {activeTab === 'offers' && (
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

      {/* TAB 1: MES PRESTATIONS (CATALOGUE + TOUTES ACTIONS) */}
      {activeTab === 'offers' && (
        <div className="space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une prestation, zone..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrer par catégorie"
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                <option value="ALL">Toutes catégories</option>
                {PROVIDER_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ProviderOfferStatus | 'ALL')}
                aria-label="Filtrer par statut"
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                <option value="ALL">Tous statuts</option>
                <option value="PUBLISHED">Publiées</option>
                <option value="DRAFT">Brouillons</option>
                <option value="ARCHIVED">Archivées</option>
              </select>
            </div>
          </div>

          {filteredOffers.length === 0 ? (
            <div className="p-10 text-center border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl space-y-3">
              <Briefcase className="w-8 h-8 text-gray-400 mx-auto" />
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Aucune prestation.
              </div>
              <button
                type="button"
                onClick={openCreateWizard}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 text-gray-950 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                Créer votre première prestation
              </button>
            </div>
          ) : viewLayout === 'table' ? (
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4">Prestation & Catégorie</th>
                      <th className="py-3 px-4">Zone & Capacité</th>
                      <th className="py-3 px-4">Tarif</th>
                      <th className="py-3 px-4">Demandes</th>
                      <th className="py-3 px-4">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredOffers.map((offer) => {
                      const st = OFFER_STATUS_META[offer.status];
                      return (
                        <tr
                          key={offer.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={resolveCover(offer.images[0])}
                                alt={offer.title}
                                referrerPolicy="no-referrer"
                                className="w-14 h-10 rounded-lg object-cover border border-gray-200 dark:border-gray-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-xs">
                                  {offer.title}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                  {offer.category} · {offer.includedServices.length} services inclus
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-gray-600 dark:text-gray-300">
                            <div className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span className="truncate max-w-[160px]">{offer.locationZone}</span>
                            </div>
                            <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                              Capacité : {offer.capacityGuests} pers.
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatFcfa(offer.priceFcfa)}
                            {offer.referencePriceFcfa && offer.referencePriceFcfa > offer.priceFcfa && (
                              <div className="text-[10px] font-normal line-through text-gray-400">
                                {formatFcfa(offer.referencePriceFcfa)}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                            {offer.requestsCount}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${st.className}`}>
                              {st.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {confirmDeleteId === offer.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-rose-600 font-semibold">Supprimer ?</span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteOffer(offer.id)}
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
                                  onClick={() => openEditWizard(offer)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Modifier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPreviewOffer(offer)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-blue-700 dark:text-blue-300"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Aperçu
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleChangeOfferStatus(
                                      offer,
                                      offer.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                                    )
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                                    offer.status === 'PUBLISHED'
                                      ? 'border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-900/20'
                                      : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-900/20'
                                  }`}
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  {offer.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDuplicateOffer(offer)}
                                  title="Dupliquer"
                                  className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                {offer.status !== 'ARCHIVED' && (
                                  <button
                                    type="button"
                                    onClick={() => void handleChangeOfferStatus(offer, 'ARCHIVED')}
                                    title="Archiver"
                                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(offer.id)}
                                  title="Supprimer"
                                  className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
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
              {filteredOffers.map((offer) => {
                const st = OFFER_STATUS_META[offer.status];
                return (
                  <div
                    key={offer.id}
                    className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800">
                      <img
                        src={resolveCover(offer.images[0])}
                        alt={offer.title}
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
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                            {offer.category}
                          </span>
                          <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                            {formatFcfa(offer.priceFcfa)}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100">{offer.title}</h4>
                        <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                          {offer.locationZone} · {offer.capacityGuests} pers. · {offer.includedServices.length} services
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditWizard(offer)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewOffer(offer)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-700 dark:text-blue-300"
                        >
                          Aperçu
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleChangeOfferStatus(
                              offer,
                              offer.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED',
                            )
                          }
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          {offer.status === 'PUBLISHED' ? 'Dépublier' : 'Publier'}
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

      {/* TAB 2: DEMANDES EN TEMPS RÉEL, DEVIS, COMMANDES & FACTURES */}
      {activeTab === 'requests' && (
        <div className="space-y-4 no-print">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Toutes' },
                  { id: 'NOUVELLE_DEMANDE', label: 'Nouvelles' },
                  { id: 'EN_ETUDE', label: 'En traitement' },
                  { id: 'DEVIS_ENVOYE', label: 'Devis' },
                  { id: 'COMMANDE_CONFIRMEE', label: 'Commandes' },
                  { id: 'FACTURE_EMISE', label: 'Factures' },
                  { id: 'PAYEE', label: 'Payées' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStageFilter(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    stageFilter === s.id
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void handleSimulateIncomingRequest()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100"
            >
              <Plus className="w-3.5 h-3.5" />
              Simuler une demande client en direct
            </button>
          </div>

          <div className="space-y-3">
            {filteredRequests.map((reqItem) => {
              const stageMeta = REQUEST_STAGE_META[reqItem.stage];
              return (
                <div
                  key={reqItem.id}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 shadow-sm space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${stageMeta.className}`}>
                          {stageMeta.label}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {reqItem.category}
                        </span>
                        {reqItem.quoteNumber && (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            {reqItem.quoteNumber}
                          </span>
                        )}
                        {reqItem.orderNumber && (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            {reqItem.orderNumber}
                          </span>
                        )}
                        {reqItem.invoiceNumber && (
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                            {reqItem.invoiceNumber}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        {reqItem.eventType} — {reqItem.clientCompany}
                      </h4>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap items-center gap-3">
                        <span>Client : {reqItem.clientName} ({reqItem.clientEmail})</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5" />
                          {reqItem.eventDate}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {reqItem.eventLocation}
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Users className="w-3.5 h-3.5" />
                          {reqItem.guestCount} invités
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 pt-1">
                        Prestation demandée : <span className="font-semibold">{reqItem.offerTitle}</span> — {reqItem.notes}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-400">Montant estimé / facturé</div>
                      <div className="text-lg font-bold font-mono text-gray-900 dark:text-gray-100">
                        {formatFcfa(reqItem.amountFcfa)}
                      </div>
                    </div>
                  </div>

                  {/* Workflow Actions */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {reqItem.stage === 'NOUVELLE_DEMANDE' && (
                        <button
                          type="button"
                          onClick={() => void handleAdvanceRequestStage(reqItem.id, 'EN_ETUDE')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          Prendre en charge
                        </button>
                      )}

                      {(reqItem.stage === 'NOUVELLE_DEMANDE' || reqItem.stage === 'EN_ETUDE') && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setQuoteDraftReq(reqItem);
                              setQuoteAmount(reqItem.amountFcfa);
                              setQuoteNotes(reqItem.notes);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Générer & Envoyer Devis
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAdvanceRequestStage(reqItem.id, 'REFUSEE')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 text-xs font-semibold hover:bg-rose-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Refuser
                          </button>
                        </>
                      )}

                      {reqItem.stage === 'DEVIS_ENVOYE' && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleAdvanceRequestStage(reqItem.id, 'COMMANDE_CONFIRMEE')
                          }
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          Convertir en Commande
                        </button>
                      )}

                      {reqItem.stage === 'COMMANDE_CONFIRMEE' && (
                        <button
                          type="button"
                          onClick={() => void handleAdvanceRequestStage(reqItem.id, 'FACTURE_EMISE')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Émettre la Facture
                        </button>
                      )}

                      {reqItem.stage === 'FACTURE_EMISE' && (
                        <button
                          type="button"
                          onClick={() => void handleAdvanceRequestStage(reqItem.id, 'PAYEE')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Marquer Facture Payée
                        </button>
                      )}
                    </div>

                    {(reqItem.quoteNumber || reqItem.orderNumber || reqItem.invoiceNumber) && (
                      <button
                        type="button"
                        onClick={() => setDocumentPreviewReq(reqItem)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-800 dark:text-gray-200"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        {reqItem.invoiceNumber
                          ? 'Afficher Facture'
                          : reqItem.orderNumber
                          ? 'Afficher Bon de Commande'
                          : 'Afficher Devis'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MISSIONS À VENIR & DISPONIBILITÉS */}
      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          <div className="lg:col-span-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Missions confirmées & devis en attente ({upcomingMissions.length})
            </h3>
            {upcomingMissions.length === 0 ? (
              <p className="text-xs text-gray-500">Aucune mission.</p>
            ) : (
              <div className="space-y-3">
                {upcomingMissions.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        {m.eventType} — {m.clientCompany}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {m.eventDate} · {m.eventLocation} · {m.guestCount} invités
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          REQUEST_STAGE_META[m.stage].className
                        }`}
                      >
                        {REQUEST_STAGE_META[m.stage].label}
                      </span>
                      <div className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {formatFcfa(m.amountFcfa)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4 shadow-sm h-fit">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Synthèse Revenus</h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Factures encaissées</span>
                <span className="font-mono font-bold text-emerald-600">
                  {formatFcfa(
                    requests
                      .filter((r) => r.stage === 'PAYEE')
                      .reduce((s, r) => s + r.amountFcfa, 0),
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500">Factures en attente règlement</span>
                <span className="font-mono font-bold text-orange-600">
                  {formatFcfa(
                    requests
                      .filter((r) => r.stage === 'FACTURE_EMISE')
                      .reduce((s, r) => s + r.amountFcfa, 0),
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Commandes confirmées à facturer</span>
                <span className="font-mono font-bold text-purple-600">
                  {formatFcfa(
                    requests
                      .filter((r) => r.stage === 'COMMANDE_CONFIRMEE')
                      .reduce((s, r) => s + r.amountFcfa, 0),
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STUDIO CRÉATION DE PRESTATION (4 ÉTAPES SANS DATES) */}
      {activeTab === 'wizard' && (
        <div className="no-print">
          <ProviderOfferWizard
            initialOffer={editingOffer}
            saving={savingOffer}
            onCancel={() => {
              setEditingOffer(null);
              setActiveTab('offers');
            }}
            onSave={handleSaveOffer}
          />
        </div>
      )}

      {/* Modal Aperçu d'une prestation */}
      {previewOffer && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 no-print">
          <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl">
            <div className="relative h-56 bg-gray-900">
              <img
                src={resolveCover(previewOffer.images[0])}
                alt={previewOffer.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => setPreviewOffer(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                  {previewOffer.category}
                </span>
                <span className="font-mono text-base font-bold text-orange-600 dark:text-orange-400">
                  {formatFcfa(previewOffer.priceFcfa)}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {previewOffer.title}
              </h3>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Zone : {previewOffer.locationZone}
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Users className="w-3.5 h-3.5" />
                  Jusqu’à {previewOffer.capacityGuests} participants
                </span>
              </div>
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Services inclus ({previewOffer.includedServices.length})
                </h4>
                {previewOffer.includedServices.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800"
                  >
                    <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{s.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.details}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Génération & Envoi de Devis */}
      {quoteDraftReq && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 no-print">
          <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Préparer & Envoyer un Devis
              </h3>
              <button
                type="button"
                onClick={() => setQuoteDraftReq(null)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div>
                Client : <span className="font-semibold">{quoteDraftReq.clientCompany}</span> ({quoteDraftReq.clientName})
              </div>
              <div>Événement : {quoteDraftReq.eventType} ({quoteDraftReq.eventDate})</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Montant total du devis (FCFA)
              </label>
              <input
                type="number"
                min={0}
                step={5000}
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Conditions & précisions logistiques
              </label>
              <textarea
                rows={3}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuoteDraftReq(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleAdvanceRequestStage(
                    quoteDraftReq.id,
                    'DEVIS_ENVOYE',
                    quoteAmount,
                    quoteNotes,
                  )
                }
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-gray-950 text-xs font-bold"
              >
                Envoyer le devis au client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Document Modal (Devis / Commande / Facture) */}
      {documentPreviewReq && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white text-gray-900 rounded-2xl border border-gray-200 p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between no-print">
              <span className="text-xs font-mono font-semibold text-gray-500">
                Pièce Commerciale Prestataire
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer / PDF
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentPreviewReq(null)}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-4 border-b border-gray-200 pb-4">
              <div className="flex items-center gap-3">
                <CompanyLogo src={provider.companyLogoUrl} name={provider.companyName} size="lg" />
                <div>
                  <div className="text-lg font-bold">{provider.companyName}</div>
                  <div className="text-xs text-gray-500">
                    Prestataire : {provider.name} · {provider.city}
                  </div>
                  <div className="text-xs font-mono text-gray-500">{provider.email}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold uppercase text-orange-600">
                  {documentPreviewReq.invoiceNumber
                    ? 'FACTURE PRESTATION'
                    : documentPreviewReq.orderNumber
                    ? 'BON DE COMMANDE CONFIRMÉ'
                    : 'DEVIS ÉVÉNEMENTIEL'}
                </div>
                <div className="font-mono text-xs font-bold mt-1">
                  {documentPreviewReq.invoiceNumber ||
                    documentPreviewReq.orderNumber ||
                    documentPreviewReq.quoteNumber}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Événement du {documentPreviewReq.eventDate}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold text-gray-500 uppercase">Client</div>
                <div className="font-bold text-sm mt-0.5">{documentPreviewReq.clientCompany}</div>
                <div>{documentPreviewReq.clientName}</div>
                <div className="font-mono text-gray-500">{documentPreviewReq.clientEmail}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-500 uppercase">Lieu & Capacité</div>
                <div className="font-semibold mt-0.5">{documentPreviewReq.eventLocation}</div>
                <div>{documentPreviewReq.guestCount} participants</div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-left">
                  <tr>
                    <th className="py-2.5 px-4">Désignation de la prestation</th>
                    <th className="py-2.5 px-4 text-right">Montant HT / Net</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 px-4">
                      <div className="font-bold">{documentPreviewReq.offerTitle}</div>
                      <div className="text-gray-500 mt-0.5">
                        {documentPreviewReq.eventType} — {documentPreviewReq.notes}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      {formatFcfa(documentPreviewReq.amountFcfa)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm font-bold">
              <span>Net à payer (FCFA)</span>
              <span className="font-mono text-lg text-orange-600">
                {formatFcfa(documentPreviewReq.amountFcfa)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
