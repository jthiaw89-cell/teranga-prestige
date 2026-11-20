import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Car,
  CheckCircle2,
  Inbox,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  DocumentClassification,
  InstitutionalMailDirection,
  InstitutionalMailRecord,
  OperationsOverviewPayload,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type OpsTab = 'mail' | 'visitors' | 'resources';

export const OperationsModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<OperationsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<OpsTab>('mail');

  // Mail form
  const [mailDir, setMailDir] = useState<InstitutionalMailDirection>('ARRIVEE');
  const [mailSubject, setMailSubject] = useState('');
  const [mailCorrespondent, setMailCorrespondent] = useState('');
  const [mailImputed, setMailImputed] = useState('Cheikh Tidiane Fall');
  const [mailClassif, setMailClassif] = useState<DocumentClassification>('INTERNE');
  const [mailDueDate, setMailDueDate] = useState('2026-11-26');

  // Visitor form
  const [visName, setVisName] = useState('');
  const [visOrg, setVisOrg] = useState('');
  const [visDoc, setVisDoc] = useState('');
  const [visSite, setVisSite] = useState('Dakar Plateau');
  const [visPurpose, setVisPurpose] = useState('');

  // Resource booking form
  const [resName, setResName] = useState('Salle Conseil Plateau (16 places)');
  const [resDate, setResDate] = useState('2026-11-19');
  const [resStart, setResStart] = useState('10');
  const [resEnd, setResEnd] = useState('12');
  const [resPurpose, setResPurpose] = useState('');

  const loadOps = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/operations/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement impossible.');
        return;
      }
      setData(payload as OperationsOverviewPayload);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadOps(false);
  }, [loadOps]);

  async function addMail(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/operations/mail', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        direction: mailDir,
        subject: mailSubject,
        correspondent: mailCorrespondent,
        imputedToName: mailImputed,
        confidentiality: mailClassif,
        dueDate: mailDueDate,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Enregistrement impossible.');
      return;
    }
    setData(payload as OperationsOverviewPayload);
    setMailSubject('');
    setMailCorrespondent('');
    setNotice('Courrier enregistré et numéroté.');
  }

  async function updateMailStatus(id: string, status: InstitutionalMailRecord['status']) {
    const res = await fetch(`/api/operations/mail/${id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setData((await res.json()) as OperationsOverviewPayload);
    }
  }

  async function addVisitor(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/operations/visitors', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        visitorName: visName,
        organization: visOrg,
        idDocumentNumber: visDoc,
        site: visSite,
        purpose: visPurpose,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Enregistrement visiteur impossible.');
      return;
    }
    setData(payload as OperationsOverviewPayload);
    setVisName('');
    setVisOrg('');
    setVisDoc('');
    setVisPurpose('');
    setNotice('Visiteur enregistré et badge attribué.');
  }

  async function checkoutVisitor(id: string) {
    const res = await fetch(`/api/operations/visitors/${id}/checkout`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      setData((await res.json()) as OperationsOverviewPayload);
      setNotice('Sortie visiteur enregistrée.');
    }
  }

  async function bookResource(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/operations/bookings', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        resourceName: resName,
        date: resDate,
        startHour: Number(resStart),
        endHour: Number(resEnd),
        purpose: resPurpose,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Réservation impossible.');
      return;
    }
    setData(payload as OperationsOverviewPayload);
    setResPurpose('');
    setNotice('Ressource réservée sans conflit.');
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const stats = data?.stats || { openMailCount: 0, visitorsOnSite: 0, bookingsToday: 0 };

  return (
    <div className="space-y-6">
      {(error || notice) && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
            error
              ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
              : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          <span>{error || notice}</span>
          <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Courriers en traitement</span>
            <Inbox className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.openMailCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Visiteurs actuellement sur site</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.visitorsOnSite}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Réservations actives</span>
            <Car className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {(data?.bookings || []).length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'mail', label: 'Courrier Institutionnel', icon: Mail },
              { id: 'visitors', label: 'Visiteurs & Accès', icon: Building2 },
              { id: 'resources', label: 'Salles, Véhicules & Matériel', icon: Car },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 ${
                  tab === t.id ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void loadOps(true)}
          aria-label="Actualiser"
          className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: MAIL */}
      {tab === 'mail' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void addMail(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" /> Enregistrer un courrier
            </h3>
            <select
              value={mailDir}
              onChange={(e) => setMailDir(e.target.value as InstitutionalMailDirection)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ARRIVEE">Courrier Arrivée (Entrant)</option>
              <option value="DEPART">Courrier Départ (Sortant)</option>
            </select>
            <input
              type="text"
              required
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              placeholder="Objet du courrier"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              required
              value={mailCorrespondent}
              onChange={(e) => setMailCorrespondent(e.target.value)}
              placeholder="Expéditeur / Destinataire institutionnel"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              value={mailImputed}
              onChange={(e) => setMailImputed(e.target.value)}
              placeholder="Imputé à (responsable)"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={mailClassif}
                onChange={(e) => setMailClassif(e.target.value as DocumentClassification)}
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="INTERNE">Interne</option>
                <option value="CONFIDENTIEL">Confidentiel</option>
                <option value="SECRET">Secret</option>
              </select>
              <input
                type="date"
                value={mailDueDate}
                onChange={(e) => setMailDueDate(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
            </div>
            <button type="submit" className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Numéroter & Imputer
            </button>
          </form>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {(data?.mail || []).map((m) => (
              <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{m.reference}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.direction}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.confidentiality}</span>
                    <span aria-hidden="true">·</span>
                    <span>Échéance {m.dueDate}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{m.subject}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Correspondant : {m.correspondent} · Imputé à {m.imputedToName}
                  </p>
                </div>
                <select
                  value={m.status}
                  onChange={(e) => void updateMailStatus(m.id, e.target.value as InstitutionalMailRecord['status'])}
                  aria-label={`Statut ${m.reference}`}
                  className="min-h-[36px] px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="ENREGISTRE">Enregistré</option>
                  <option value="IMPUTE">Imputé</option>
                  <option value="EN_TRAITEMENT">En traitement</option>
                  <option value="TRAITE">Traité</option>
                  <option value="ARCHIVE">Archivé</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: VISITORS */}
      {tab === 'visitors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void addVisitor(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Accueil visiteur & badge</h3>
            <input
              type="text"
              required
              value={visName}
              onChange={(e) => setVisName(e.target.value)}
              placeholder="Nom complet du visiteur"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              value={visOrg}
              onChange={(e) => setVisOrg(e.target.value)}
              placeholder="Entreprise / Institution"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              value={visDoc}
              onChange={(e) => setVisDoc(e.target.value)}
              placeholder="N° CNI / Passeport (masqué)"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <select
              value={visSite}
              onChange={(e) => setVisSite(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="Dakar Plateau">Dakar Plateau</option>
              <option value="Diamniadio">CICAD Diamniadio</option>
              <option value="Thiès">Campus Thiès</option>
            </select>
            <input
              type="text"
              value={visPurpose}
              onChange={(e) => setVisPurpose(e.target.value)}
              placeholder="Motif de la visite"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <button type="submit" className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Délivrer badge d’accès
            </button>
          </form>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {(data?.visitors || []).map((v) => (
              <div key={v.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    Badge {v.badgeCode} · {v.site} · Entrée {v.checkInAt.slice(11, 16)}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {v.visitorName} — {v.organization}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Hôte : {v.hostName} · {v.purpose}
                  </div>
                </div>
                {v.status === 'SUR_SITE' ? (
                  <button
                    type="button"
                    onClick={() => void checkoutVisitor(v.id)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sortie
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sorti
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RESOURCES */}
      {tab === 'resources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void bookResource(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3 text-xs"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Réserver une ressource partagée</h3>
            <select
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              {(data?.resourcesCatalog || []).map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={resDate}
              onChange={(e) => setResDate(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={7}
                max={20}
                value={resStart}
                onChange={(e) => setResStart(e.target.value)}
                placeholder="Début (h)"
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="number"
                min={8}
                max={21}
                value={resEnd}
                onChange={(e) => setResEnd(e.target.value)}
                placeholder="Fin (h)"
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
            </div>
            <input
              type="text"
              required
              value={resPurpose}
              onChange={(e) => setResPurpose(e.target.value)}
              placeholder="Objet de la réservation"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <button type="submit" className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Réserver (contrôle conflits)
            </button>
          </form>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {(data?.bookings || []).map((b) => (
              <div key={b.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                    {b.resourceType} · {b.site} · {b.date} · {b.startHour}h–{b.endHour}h
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{b.resourceName}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Réservé par {b.bookedByName} — {b.purpose}
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
