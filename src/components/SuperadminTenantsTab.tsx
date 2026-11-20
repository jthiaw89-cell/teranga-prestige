import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  CreditCard,
  LifeBuoy,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  TrendingUp,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { processUploadedImage } from '../lib/imageUpload';
import { CompanyLogo, CompactImageUploader } from './ui/MediaAvatar';
import type {
  AuthSessionSummary,
  SuperadminTenantsPayload,
  TenantInvoiceRecord,
  TenantPlanTier,
  TenantStatus,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type TenantSubTab = 'tenants' | 'billing' | 'support_health';

export const SuperadminTenantsTab: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<SuperadminTenantsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subTab, setSubTab] = useState<TenantSubTab>('tenants');

  // Create Tenant modal
  const [createOpen, setCreateOpen] = useState(false);
  const [tName, setTName] = useState('');
  const [tSubdomain, setTSubdomain] = useState('');
  const [tPlan, setTPlan] = useState<TenantPlanTier>('STANDARD');
  const [tAdminEmail, setTAdminEmail] = useState('');
  const [tFee, setTFee] = useState('150000');
  const [tLogoUrl, setTLogoUrl] = useState('');
  const [updatingLogoId, setUpdatingLogoId] = useState<string | null>(null);

  const loadTenants = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/tenants/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement console multi-tenants impossible.');
        return;
      }
      setData(payload as SuperadminTenantsPayload);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadTenants(false);
  }, [loadTenants]);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/superadmin/tenants', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        name: tName,
        subdomain: tSubdomain,
        plan: tPlan,
        adminEmail: tAdminEmail,
        monthlyFeeFcfa: Number(tFee) || 150000,
        logoUrl: tLogoUrl || undefined,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Création impossible.');
      return;
    }
    setData(payload as SuperadminTenantsPayload);
    setCreateOpen(false);
    setTName('');
    setTSubdomain('');
    setTAdminEmail('');
    setTLogoUrl('');
    setNotice('Organisation créée en période d’essai 30 jours avec facture d’activation générée.');
  }

  async function updateTenantStatus(id: string, status: TenantStatus) {
    const res = await fetch(`/api/superadmin/tenants/${id}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setData((await res.json()) as SuperadminTenantsPayload);
      setNotice('Statut du tenant mis à jour.');
    }
  }

  async function updateTenantLogo(id: string, logoUrl: string) {
    setUpdatingLogoId(id);
    setError('');
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ logoUrl }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Mise à jour logo impossible.');
        return;
      }
      setData(payload as SuperadminTenantsPayload);
      setNotice(logoUrl ? 'Logo de l’organisation mis à jour.' : 'Logo de l’organisation retiré.');
    } catch {
      setError('Erreur réseau.');
    } finally {
      setUpdatingLogoId(null);
    }
  }

  async function handleInlineTenantLogoPick(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpdatingLogoId(id);
    try {
      const dataUrl = await processUploadedImage(file, {
        maxDimension: 512,
        preserveTransparency: true,
        quality: 0.86,
        maxFileSizeMb: 5,
      });
      await updateTenantLogo(id, dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import logo impossible.');
      setUpdatingLogoId(null);
    }
  }

  async function payInvoice(id: string, method: TenantInvoiceRecord['paymentMethod']) {
    const res = await fetch(`/api/superadmin/invoices/${id}/pay`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ paymentMethod: method }),
    });
    if (res.ok) {
      setData((await res.json()) as SuperadminTenantsPayload);
      setNotice(`Paiement ${method} rapproché et facture soldée.`);
    }
  }

  async function updateTicketStatus(id: string, status: 'OUVERT' | 'EN_COURS' | 'RESOLU') {
    const res = await fetch(`/api/superadmin/tickets/${id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setData((await res.json()) as SuperadminTenantsPayload);
    }
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const kpis = data?.kpis || {
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    mrrFcfa: 0,
    arrFcfa: 0,
    churnPct: 0,
    openTickets: 0,
  };

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

      {/* Commercial & SaaS KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Organisations (Tenants)</span>
            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.totalTenants}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {kpis.activeTenants} actives · {kpis.trialTenants} en essai 30j
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>MRR Mensuel Récurrent</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {kpis.mrrFcfa.toLocaleString('fr-FR')} FCFA
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            ARR : {kpis.arrFcfa.toLocaleString('fr-FR')} FCFA · Churn {kpis.churnPct}%
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Encaissements Locaux</span>
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {(data?.invoices || []).filter((i) => i.status === 'PAYEE').length} / {(data?.invoices || []).length}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Tickets Support Ouverts</span>
            <LifeBuoy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.openTickets}
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'tenants', label: 'Organisations & Feature Flags' },
              { id: 'billing', label: 'Facturation FCFA (Wave / OM)' },
              { id: 'support_health', label: 'Supervision Services & Support' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
                subTab === t.id ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadTenants(true)}
            aria-label="Actualiser"
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Provisionner un tenant</span>
          </button>
        </div>
      </div>

      {/* TENANTS LIST */}
      {subTab === 'tenants' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.tenants || []).map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CompanyLogo src={t.logoUrl} name={t.name} size="lg" />
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                      {t.plan} · {t.subdomain}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                      {t.name}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 text-[11px] font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          disabled={updatingLogoId === t.id}
                          onChange={(e) => void handleInlineTenantLogoPick(t.id, e)}
                        />
                        {updatingLogoId === t.id ? 'Envoi...' : t.logoUrl ? 'Modifier logo' : 'Importer logo'}
                      </label>
                      {t.logoUrl && (
                        <button
                          type="button"
                          disabled={updatingLogoId === t.id}
                          onClick={() => void updateTenantLogo(t.id, '')}
                          className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <select
                  value={t.status}
                  onChange={(e) => void updateTenantStatus(t.id, e.target.value as TenantStatus)}
                  aria-label={`Statut ${t.name}`}
                  className="min-h-[34px] px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 shrink-0"
                >
                  <option value="ACTIF">Actif</option>
                  <option value="ESSAI_30J">Essai 30j</option>
                  <option value="SUSPENDU_IMPAYE">Suspendu (lecture seule)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-2 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Utilisateurs</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{t.userCount} / {t.userQuota}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Stockage</div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{t.storageUsedGb} / {t.storageQuotaGb} Go</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-gray-400">Abonnement</div>
                  <div className="font-semibold text-emerald-700 dark:text-emerald-300">{t.monthlyFeeFcfa.toLocaleString('fr-FR')} F</div>
                </div>
              </div>

              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Feature flags : {t.featureFlags.join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BILLING FCFA */}
      {subTab === 'billing' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                <th className="py-3 px-4">Facture</th>
                <th className="py-3 px-4">Organisation</th>
                <th className="py-3 px-4">Période</th>
                <th className="py-3 px-4">Montant</th>
                <th className="py-3 px-4">Canal</th>
                <th className="py-3 px-4">Statut / Rapprochement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.invoices || []).map((inv) => {
                const matchedTenant = (data?.tenants || []).find((tn) => tn.id === inv.tenantId);
                return (
                <tr key={inv.id}>
                  <td className="py-3 px-4 font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3 px-4 text-gray-800 dark:text-gray-200">
                    <div className="flex items-center gap-2">
                      <CompanyLogo src={matchedTenant?.logoUrl} name={inv.tenantName} size="xs" />
                      <span>{inv.tenantName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{inv.periodLabel}</td>
                  <td className="py-3 px-4 font-mono tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                    {inv.amountFcfa.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-300">{inv.paymentMethod}</td>
                  <td className="py-3 px-4">
                    {inv.status === 'PAYEE' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Payée ({inv.paidAt})
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => void payInvoice(inv.id, 'WAVE')}
                          className="min-h-[30px] px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold"
                        >
                          Encaisser Wave
                        </button>
                        <button
                          type="button"
                          onClick={() => void payInvoice(inv.id, 'ORANGE_MONEY')}
                          className="min-h-[30px] px-2.5 py-1 rounded bg-orange-600 text-white text-xs font-semibold"
                        >
                          Orange Money
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
      )}

      {/* SUPPORT & SERVICES HEALTH */}
      {subTab === 'support_health' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-600" /> Santé des services plateforme
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.servicesHealth || []).map((svc) => (
                <div key={svc.service} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{svc.service}</div>
                    <div className="text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                      Disponibilité {svc.uptimePct}% · Latence {svc.latencyMs} ms
                    </div>
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">{svc.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> File tickets support multi-tenants
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.tickets || []).map((tkt) => (
                <div key={tkt.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <div className="font-mono text-gray-500 dark:text-gray-400">
                      {tkt.reference} · {tkt.severity} · SLA {tkt.slaTarget}
                    </div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{tkt.subject}</div>
                    <div className="text-gray-500 dark:text-gray-400">{tkt.tenantName} ({tkt.requesterName})</div>
                  </div>
                  <select
                    value={tkt.status}
                    onChange={(e) => void updateTicketStatus(tkt.id, e.target.value as 'OUVERT' | 'EN_COURS' | 'RESOLU')}
                    aria-label={`Statut ticket ${tkt.reference}`}
                    className="min-h-[34px] px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    <option value="OUVERT">Ouvert</option>
                    <option value="EN_COURS">En cours</option>
                    <option value="RESOLU">Résolu</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE TENANT MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void createTenant(e)}
            className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Provisionner une organisation</h3>
              <button type="button" onClick={() => setCreateOpen(false)} aria-label="Fermer">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950">
                <CompactImageUploader
                  label="Logo entreprise"
                  currentUrl={tLogoUrl}
                  name={tName || 'Organisation'}
                  variant="logo"
                  onUpload={(dataUrl) => setTLogoUrl(dataUrl)}
                  onRemove={() => setTLogoUrl('')}
                  onError={(msg) => setError(msg)}
                />
              </div>
              <input
                type="text"
                required
                value={tName}
                onChange={(e) => setTName(e.target.value)}
                placeholder="Raison sociale / Ministère"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                required
                value={tSubdomain}
                onChange={(e) => setTSubdomain(e.target.value)}
                placeholder="Sous-domaine (ex. port-dakar)"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="email"
                required
                value={tAdminEmail}
                onChange={(e) => setTAdminEmail(e.target.value)}
                placeholder="E-mail administrateur initial"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={tPlan}
                  onChange={(e) => setTPlan(e.target.value as TenantPlanTier)}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="STANDARD">Standard (RLS partagé)</option>
                  <option value="PREMIUM">Premium (Schéma dédié)</option>
                  <option value="SOUVERAIN">Souverain (Instance dédiée)</option>
                </select>
                <input
                  type="number"
                  value={tFee}
                  onChange={(e) => setTFee(e.target.value)}
                  placeholder="Mensualité FCFA"
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                Annuler
              </button>
              <button type="submit" className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                Créer le tenant
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
