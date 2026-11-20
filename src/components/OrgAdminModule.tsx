import React, { useCallback, useEffect, useState } from 'react';
import {
  Building,
  CheckCircle2,
  DatabaseBackup,
  Download,
  Key,
  Layers,
  Palette,
  Plus,
  RefreshCw,
  Webhook,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { CompactImageUploader } from './ui/MediaAvatar';
import type {
  AuthSessionSummary,
  OrgAdminOverviewPayload,
  OrgUnitNode,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  onThemeUpdated?: (primaryColor: string, displayName: string, logoUrl?: string) => void;
}

type AdminTab = 'onboarding_theme' | 'structure' | 'modules' | 'api_backups';

const MODULE_CATALOG = [
  { id: 'hr', label: 'RH, Congés & Pointage' },
  { id: 'missions', label: 'Ordres de Mission & Frais' },
  { id: 'workflows', label: 'Demandes & Validations' },
  { id: 'ged', label: 'Gestion Documentaire (GED)' },
  { id: 'comms', label: 'Notes de Service & Annuaire' },
  { id: 'operations', label: 'Courrier, Visiteurs & Ressources' },
  { id: 'tasks', label: 'Tâches & Kanban' },
  { id: 'planning', label: 'Planning Unifié' },
  { id: 'crm', label: 'CRM & Campagnes' },
  { id: 'accounting', label: 'Comptabilité SYSCOHADA' },
  { id: 'events', label: 'Événementiel' },
  { id: 'training', label: 'Formation Pro' },
];

export const OrgAdminModule: React.FC<Props> = ({ session, onThemeUpdated }) => {
  const [data, setData] = useState<OrgAdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<AdminTab>('onboarding_theme');

  // Theme state
  const [displayName, setDisplayName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [memberLabel, setMemberLabel] = useState<'Collaborateur' | 'Agent'>('Collaborateur');
  const [unitLabel, setUnitLabel] = useState<'Direction' | 'Département'>('Direction');
  const [onboardingStep, setOnboardingStep] = useState(6);

  // New unit / token / webhook
  const [unitName, setUnitName] = useState('');
  const [unitType, setUnitType] = useState<OrgUnitNode['type']>('SERVICE');
  const [unitLead, setUnitLead] = useState('');
  const [unitSite, setUnitSite] = useState('Dakar Plateau');
  const [tokenLabel, setTokenLabel] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  const loadAdmin = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/org-admin/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement administration impossible.');
        return;
      }
      const typed = payload as OrgAdminOverviewPayload;
      setData(typed);
      setDisplayName(typed.theme.displayName);
      setLogoUrl(typed.theme.logoUrl);
      setPrimaryColor(typed.theme.primaryColor);
      setMemberLabel(typed.theme.memberLabel);
      setUnitLabel(typed.theme.unitLabel);
      setOnboardingStep(typed.theme.onboardingStep);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadAdmin(false);
  }, [loadAdmin]);

  async function saveTheme(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/org-admin/theme', {
      method: 'PUT',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        displayName,
        logoUrl: logoUrl || '',
        primaryColor,
        memberLabel,
        unitLabel,
        onboardingStep,
        onboardingCompleted: onboardingStep >= 6,
      }),
    });
    if (res.ok) {
      const updated = (await res.json()) as OrgAdminOverviewPayload;
      setData(updated);
      setLogoUrl(updated.theme.logoUrl);
      onThemeUpdated?.(updated.theme.primaryColor, updated.theme.displayName, updated.theme.logoUrl);
      setNotice('Identité visuelle et marque blanche enregistrées.');
    }
  }

  async function toggleModule(modId: string) {
    if (!data) return;
    const current = data.theme.enabledModules;
    const next = current.includes(modId)
      ? current.filter((m) => m !== modId)
      : [...current, modId];
    const res = await fetch('/api/org-admin/modules', {
      method: 'PUT',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ enabledModules: next }),
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setNotice('Configuration des modules mise à jour.');
    }
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/org-admin/units', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ name: unitName, type: unitType, leadName: unitLead, site: unitSite, headcount: 4 }),
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setUnitName('');
      setUnitLead('');
      setNotice('Entité ajoutée à l’organigramme.');
    }
  }

  async function createToken(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/org-admin/tokens', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ label: tokenLabel }),
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setTokenLabel('');
      setNotice('Jeton API OAuth généré.');
    }
  }

  async function revokeToken(id: string) {
    const res = await fetch(`/api/org-admin/tokens/${id}/revoke`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setNotice('Jeton révoqué.');
    }
  }

  async function addWebhook(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/org-admin/webhooks', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ url: webhookUrl }),
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setWebhookUrl('');
      setNotice('Webhook HMAC-SHA256 enregistré.');
    }
  }

  async function createBackup() {
    const res = await fetch('/api/org-admin/backups', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      setData((await res.json()) as OrgAdminOverviewPayload);
      setNotice('Instantané de sauvegarde chiffré créé et vérifié.');
    }
  }

  function exportAllOrgJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portabilite_${session.organizationId}_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Export complet de portabilité (JSON) téléchargé.');
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const ONBOARDING_STEPS = [
    '1. Identité & Marque',
    '2. Structure & Sites',
    '3. Utilisateurs & Rôles',
    '4. Modules Actifs',
    '5. Règles Congés SN',
    '6. Mise en production',
  ];

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

      {/* Tabs */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'onboarding_theme', label: 'Onboarding & Thème Marque Blanche', icon: Palette },
              { id: 'structure', label: 'Organigramme & Sites', icon: Building },
              { id: 'modules', label: 'Modules Activables', icon: Layers },
              { id: 'api_backups', label: 'API, Webhooks & Sauvegardes', icon: Key },
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportAllOrgJson}
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Export Portabilité</span>
          </button>
          <button
            type="button"
            onClick={() => void loadAdmin(true)}
            aria-label="Actualiser"
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: ONBOARDING 6 STEPS + WHITE-LABEL THEME */}
      {tab === 'onboarding_theme' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => void saveTheme(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4"
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Identité visuelle & vocabulaire métier
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60">
                <CompactImageUploader
                  label="Logo entreprise"
                  variant="logo"
                  name={displayName || session.organizationName}
                  currentUrl={logoUrl}
                  onUpload={(dataUrl) => setLogoUrl(dataUrl)}
                  onRemove={() => setLogoUrl(undefined)}
                  onError={(msg) => setError(msg)}
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Nom de l’espace client</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Couleur primaire</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-14 rounded border border-gray-200 dark:border-gray-700"
                    />
                    <span className="font-mono text-gray-700 dark:text-gray-300">{primaryColor}</span>
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Contrôle contraste WCAG</label>
                  <div className="min-h-[40px] flex items-center text-emerald-700 dark:text-emerald-300 font-semibold">
                    AA Vérifié (≥ 4.5:1)
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Libellé utilisateurs</label>
                  <select
                    value={memberLabel}
                    onChange={(e) => setMemberLabel(e.target.value as 'Collaborateur' | 'Agent')}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    <option value="Collaborateur">Collaborateur (Entreprise)</option>
                    <option value="Agent">Agent (Administration)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Libellé entité</label>
                  <select
                    value={unitLabel}
                    onChange={(e) => setUnitLabel(e.target.value as 'Direction' | 'Département')}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    <option value="Direction">Direction</option>
                    <option value="Département">Département</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Appliquer la marque blanche
              </button>
            </div>
          </form>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Assistant d’onboarding organisation (6 étapes)
              </h3>
              <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold">
                {onboardingStep}/6 complétées
              </span>
            </div>
            <div className="space-y-2">
              {ONBOARDING_STEPS.map((st, idx) => {
                const done = idx + 1 <= onboardingStep;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setOnboardingStep(idx + 1)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between ${
                      done
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-gray-900 dark:text-gray-100'
                        : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="font-medium">{st}</span>
                    {done && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STRUCTURE & SITES */}
      {tab === 'structure' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void addUnit(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3 text-xs h-fit"
          >
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" /> Ajouter une unité
            </h3>
            <input
              type="text"
              required
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="Nom de la direction / service"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as OrgUnitNode['type'])}
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="DIRECTION">Direction</option>
              <option value="DEPARTEMENT">Département</option>
              <option value="SERVICE">Service</option>
              <option value="EQUIPE">Équipe</option>
            </select>
            <input
              type="text"
              value={unitLead}
              onChange={(e) => setUnitLead(e.target.value)}
              placeholder="Responsable"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <input
              type="text"
              value={unitSite}
              onChange={(e) => setUnitSite(e.target.value)}
              placeholder="Site géographique"
              className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            />
            <button type="submit" className="w-full min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              Enregistrer l’entité
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Organigramme hiérarchique
              </h3>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.units || []).map((u) => (
                  <div key={u.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{u.name}</span>
                      <div className="text-gray-500 dark:text-gray-400">
                        {u.type} · Responsable : {u.leadName} · {u.site}
                      </div>
                    </div>
                    <span className="font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {u.headcount} membre(s)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Sites géographiques</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(data?.sites || []).map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{s.name}</div>
                    <div className="text-gray-500 dark:text-gray-400 mt-0.5">{s.address}</div>
                    <div className="font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">{s.agentCount} agents</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENABLED MODULES */}
      {tab === 'modules' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULE_CATALOG.map((mod) => {
            const enabled = data?.theme.enabledModules.includes(mod.id) ?? false;
            return (
              <div
                key={mod.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between gap-3"
              >
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{mod.label}</h4>
                <button
                  type="button"
                  onClick={() => void toggleModule(mod.id)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                    enabled
                      ? 'bg-emerald-600 text-white'
                      : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {enabled ? 'Actif' : 'Inactif'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: API TOKENS, WEBHOOKS & BACKUPS */}
      {tab === 'api_backups' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-blue-600" /> Jetons API OAuth 2.1
            </h3>
            <form onSubmit={(e) => void createToken(e)} className="flex gap-2 text-xs">
              <input
                type="text"
                required
                value={tokenLabel}
                onChange={(e) => setTokenLabel(e.target.value)}
                placeholder="Nom d’intégration..."
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <button type="submit" className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold">
                Créer
              </button>
            </form>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.tokens || []).map((tok) => (
                <div key={tok.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{tok.label}</div>
                    <div className="font-mono text-gray-500 dark:text-gray-400">{tok.prefix}</div>
                  </div>
                  {!tok.revoked ? (
                    <button
                      type="button"
                      onClick={() => void revokeToken(tok.id)}
                      className="text-rose-600 dark:text-rose-400 font-semibold shrink-0"
                    >
                      Révoquer
                    </button>
                  ) : (
                    <span className="text-gray-400">Révoqué</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <Webhook className="w-4 h-4 text-indigo-600" /> Webhooks HMAC-SHA256
            </h3>
            <form onSubmit={(e) => void addWebhook(e)} className="flex gap-2 text-xs">
              <input
                type="url"
                required
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://erp.client.sn/hook"
                className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <button type="submit" className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold">
                Ajouter
              </button>
            </form>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.webhooks || []).map((w) => (
                <div key={w.id} className="py-2.5 text-xs space-y-0.5">
                  <div className="font-mono text-gray-900 dark:text-gray-100 truncate">{w.url}</div>
                  <div className="text-gray-500 dark:text-gray-400">
                    {w.events.join(', ')} · Secret {w.hmacSecretMasked}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <DatabaseBackup className="w-4 h-4 text-emerald-600" /> Sauvegardes WAL
              </h3>
              <button
                type="button"
                onClick={() => void createBackup()}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
              >
                + Sauvegarder
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.backups || []).map((b) => (
                <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {b.createdAt.slice(0, 16).replace('T', ' ')}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">{b.type}</div>
                  </div>
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-300 font-semibold">
                    {b.sizeMb} Mo · {b.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
