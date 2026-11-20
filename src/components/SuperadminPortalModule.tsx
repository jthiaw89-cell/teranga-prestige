import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgePercent,
  Ban,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildAuthHeaders } from '../lib/authHeaders';
import { SuperadminCommissionsTab } from './SuperadminCommissionsTab';
import { SuperadminTenantsTab } from './SuperadminTenantsTab';
import { CompanyLogo, CompactImageUploader, ProfileAvatar } from './ui/MediaAvatar';
import type {
  AuthSessionSummary,
  AuthSpace,
  ManagedUserRecord,
  PlatformAuditLog,
  SuperadminOverviewPayload,
  UserAccountStatus,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  initialTab?: SuperadminTab;
}

type SuperadminTab = 'users' | 'tenants' | 'commissions' | 'analytics' | 'audit';

const SPACE_META: Record<
  AuthSpace,
  { label: string; badgeClass: string }
> = {
  intranet: {
    label: 'Intranet & CRM',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  accounting: {
    label: 'Comptabilité',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  learner: {
    label: 'Apprenant B2B',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  instructor: {
    label: 'Formateur Pro',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  provider: {
    label: 'Prestataire',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  superadmin: {
    label: 'Superadmin',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
};

const ROLE_OPTIONS_BY_SPACE: Record<AuthSpace, Array<{ value: string; label: string }>> = {
  intranet: [
    { value: 'OWNER', label: 'OWNER — Direction / Propriétaire' },
    { value: 'DIRECTION', label: 'DIRECTION — Membre Direction' },
    { value: 'MANAGER', label: 'MANAGER — Manager Pôle & CRM' },
    { value: 'EMPLOYEE', label: 'EMPLOYEE — Collaborateur' },
  ],
  accounting: [
    { value: 'OWNER', label: 'OWNER — Propriétaire SYSCOHADA' },
    { value: 'ACCOUNTANT', label: 'ACCOUNTANT — Chef Comptable / DAF' },
    { value: 'READ_ONLY', label: 'READ_ONLY — Audit Externe' },
  ],
  learner: [{ value: 'LEARNER', label: 'LEARNER — Apprenant B2B' }],
  instructor: [{ value: 'INSTRUCTOR', label: 'INSTRUCTOR — Formateur Pro' }],
  provider: [{ value: 'PROVIDER', label: 'PROVIDER — Prestataire Événementiel' }],
  superadmin: [
    { value: 'SUPERADMIN', label: 'SUPERADMIN — Administrateur Plateforme' },
    { value: 'SECURITY_ADMIN', label: 'SECURITY_ADMIN — Audit & Sécurité' },
  ],
};

function formatDateTime(iso?: string): string {
  if (!iso) return 'Jamais connecté';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const SuperadminPortalModule: React.FC<Props> = ({ session, initialTab }) => {
  const [overview, setOverview] = useState<SuperadminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [activeTab, setActiveTab] = useState<SuperadminTab>(initialTab || 'users');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [spaceFilter, setSpaceFilter] = useState<'ALL' | AuthSpace>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserAccountStatus>('ALL');
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');
  const [auditSearch, setAuditSearch] = useState('');

  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  const [inspectedUser, setInspectedUser] = useState<ManagedUserRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUserRecord | null>(null);

  const [formSpace, setFormSpace] = useState<AuthSpace>('intranet');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('MANAGER');
  const [formOrg, setFormOrg] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formCity, setFormCity] = useState('Dakar');
  const [formStatus, setFormStatus] = useState<UserAccountStatus>('ACTIVE');
  const [formPassword, setFormPassword] = useState('');
  const [formAvatarUrl, setFormAvatarUrl] = useState('');
  const [formCompanyLogoUrl, setFormCompanyLogoUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchOverview = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const res = await fetch('/api/superadmin/overview', {
        headers: buildAuthHeaders('superadmin', false),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Impossible de charger les données Superadmin.');
        return;
      }
      setOverview(data as SuperadminOverviewPayload);
    } catch {
      setError('Connexion au serveur Superadmin impossible.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview(false);
  }, [fetchOverview]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFormOpen(false);
        setInspectedUser(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function openCreateModal() {
    setEditingUser(null);
    setFormSpace('intranet');
    setFormName('');
    setFormEmail('');
    setFormRole('MANAGER');
    setFormOrg('Teranga Prestige — Intranet');
    setFormSubtitle('');
    setFormCity('Dakar');
    setFormStatus('ACTIVE');
    setFormPassword('');
    setFormAvatarUrl('');
    setFormCompanyLogoUrl('');
    setError('');
    setFormOpen(true);
  }

  function openEditModal(u: ManagedUserRecord) {
    setEditingUser(u);
    setFormSpace(u.space);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormOrg(u.organizationName);
    setFormSubtitle(u.subtitle);
    setFormCity(u.city || 'Dakar');
    setFormStatus(u.status);
    setFormPassword('');
    setFormAvatarUrl(u.avatarUrl || '');
    setFormCompanyLogoUrl(u.companyLogoUrl || '');
    setError('');
    setFormOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setError('');
    setNotice('');
    try {
      const url = editingUser
        ? `/api/superadmin/users/${editingUser.space}/${editingUser.userId}`
        : '/api/superadmin/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({
          space: formSpace,
          name: formName,
          email: formEmail,
          role: formRole,
          organizationName: formOrg,
          subtitle: formSubtitle,
          city: formCity,
          status: formStatus,
          password: formPassword.trim() || undefined,
          avatarUrl: formAvatarUrl,
          companyLogoUrl: formSpace === 'provider' ? formCompanyLogoUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Échec de l’enregistrement utilisateur.');
        return;
      }
      setOverview(data as SuperadminOverviewPayload);
      setFormOpen(false);
      setNotice(
        editingUser
          ? `Compte de ${formName} mis à jour avec succès.`
          : `Nouveau compte ${formName} créé et activé.`,
      );
      if (inspectedUser && editingUser && inspectedUser.userId === editingUser.userId) {
        const refreshed = (data as SuperadminOverviewPayload).users.find(
          (item) => item.userId === editingUser.userId && item.space === editingUser.space,
        );
        setInspectedUser(refreshed || null);
      }
    } catch {
      setError('Erreur réseau lors de la sauvegarde.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleToggleStatus(u: ManagedUserRecord) {
    const nextStatus: UserAccountStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const key = `status:${u.space}:${u.userId}`;
    setBusyActionKey(key);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/superadmin/users/${u.space}/${u.userId}`, {
        method: 'PATCH',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Modification du statut impossible.');
        return;
      }
      const nextOverview = data as SuperadminOverviewPayload;
      setOverview(nextOverview);
      setNotice(
        nextStatus === 'SUSPENDED'
          ? `Compte de ${u.name} suspendu et sessions actives révoquées.`
          : `Compte de ${u.name} réactivé.`,
      );
      if (inspectedUser?.userId === u.userId && inspectedUser?.space === u.space) {
        setInspectedUser(
          nextOverview.users.find((x) => x.userId === u.userId && x.space === u.space) || null,
        );
      }
    } catch {
      setError('Erreur lors du changement de statut.');
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleRevokeSessions(u: ManagedUserRecord) {
    const key = `revoke:${u.space}:${u.userId}`;
    setBusyActionKey(key);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/superadmin/users/${u.space}/${u.userId}/revoke-sessions`, {
        method: 'POST',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Révocation impossible.');
        return;
      }
      const nextOverview = data as SuperadminOverviewPayload & { revoked?: number };
      setOverview(nextOverview);
      setNotice(`${nextOverview.revoked ?? 0} session(s) fermée(s) pour ${u.name}.`);
      if (inspectedUser?.userId === u.userId && inspectedUser?.space === u.space) {
        setInspectedUser(
          nextOverview.users.find((x) => x.userId === u.userId && x.space === u.space) || null,
        );
      }
    } catch {
      setError('Erreur réseau lors de la révocation des sessions.');
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleDeleteUser(u: ManagedUserRecord) {
    const key = `del:${u.space}:${u.userId}`;
    setBusyActionKey(key);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`/api/superadmin/users/${u.space}/${u.userId}`, {
        method: 'DELETE',
        headers: buildAuthHeaders('superadmin', false),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Suppression impossible.');
        return;
      }
      setOverview(data as SuperadminOverviewPayload);
      setConfirmDeleteKey(null);
      if (inspectedUser?.userId === u.userId && inspectedUser?.space === u.space) {
        setInspectedUser(null);
      }
      setNotice(`Compte ${u.name} (${u.email}) supprimé définitivement.`);
    } catch {
      setError('Erreur réseau lors de la suppression.');
    } finally {
      setBusyActionKey(null);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.users.filter((u) => {
      if (spaceFilter !== 'ALL' && u.space !== spaceFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.organizationName.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q)
      );
    });
  }, [overview, searchQuery, spaceFilter, statusFilter]);

  const filteredAuditLogs = useMemo(() => {
    if (!overview) return [];
    const q = auditSearch.trim().toLowerCase();
    return overview.auditLogs.filter((log) => {
      if (auditSeverityFilter !== 'ALL' && log.severity !== auditSeverityFilter) return false;
      if (!q) return true;
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        (log.targetLabel || '').toLowerCase().includes(q)
      );
    });
  }, [overview, auditSeverityFilter, auditSearch]);

  const inspectedUserLogs = useMemo(() => {
    if (!overview || !inspectedUser) return [];
    return overview.auditLogs
      .filter(
        (l) =>
          l.actorId === inspectedUser.userId ||
          l.targetId === inspectedUser.userId ||
          (l.targetLabel || '').includes(inspectedUser.email),
      )
      .slice(0, 12);
  }, [overview, inspectedUser]);

  if (loading && !overview) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Chargement de la console Superadmin & suivi utilisateurs...
      </div>
    );
  }

  const kpis = overview?.kpis ?? {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    activeSessionsTotal: 0,
    organizationsCount: 0,
    totalTrackedRecords: 0,
  };

  const statusPieData = [
    { name: 'Actifs', value: kpis.activeUsers, fill: '#10b981' },
    { name: 'Suspendus', value: kpis.suspendedUsers, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Utilisateurs</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.totalUsers}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Comptes actifs</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {kpis.activeUsers}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Suspendus</span>
            <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            {kpis.suspendedUsers}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Sessions actives</span>
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.activeSessionsTotal}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Organisations</span>
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.organizationsCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Objets suivis</span>
            <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {kpis.totalTrackedRecords}
          </p>
        </div>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs + Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto">
          {(
            [
              { id: 'users', label: `Utilisateurs (${overview?.users.length ?? 0})`, icon: Users },
              { id: 'tenants', label: 'Tenants & Facturation FCFA', icon: Building2 },
              { id: 'commissions', label: 'Commissions & Barèmes', icon: BadgePercent },
              { id: 'analytics', label: 'Analytique & Modules', icon: Activity },
              { id: 'audit', label: `Journal d’audit (${overview?.auditLogs.length ?? 0})`, icon: ShieldAlert },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition touch-manipulation ${
                  active
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchOverview(true)}
            disabled={refreshing}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5 transition touch-manipulation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition touch-manipulation"
          >
            <UserPlus className="w-4 h-4" />
            Nouvel utilisateur
          </button>
        </div>
      </div>

      {/* TAB 1: GESTION & SUIVI DES UTILISATEURS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, e-mail, organisation ou rôle..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-4">
              <select
                value={spaceFilter}
                onChange={(e) => setSpaceFilter(e.target.value as 'ALL' | AuthSpace)}
                className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Tous les espaces ({overview?.users.length ?? 0})</option>
                <option value="intranet">Intranet & CRM</option>
                <option value="accounting">Comptabilité SYSCOHADA</option>
                <option value="learner">Apprenants B2B</option>
                <option value="instructor">Formateurs Pro</option>
                <option value="provider">Prestataires Événementiels</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | UserAccountStatus)}
                className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Comptes actifs ({kpis.activeUsers})</option>
                <option value="SUSPENDED">Comptes suspendus ({kpis.suspendedUsers})</option>
              </select>
            </div>
          </div>

          {/* Desktop Table (lg+) */}
          <div className="hidden lg:block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-3 px-3">Utilisateur</th>
                    <th className="py-3 px-3">Espace & Rôle</th>
                    <th className="py-3 px-3">Organisation / Entité</th>
                    <th className="py-3 px-3">Activité suivie</th>
                    <th className="py-3 px-3">Sessions & Dernier accès</th>
                    <th className="py-3 px-3">Statut</th>
                    <th className="py-3 px-3 text-right sticky right-0 z-10 bg-gray-50 dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        Aucun utilisateur ne correspond à vos filtres.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const spaceInfo = SPACE_META[u.space];
                      const delKey = `${u.space}:${u.userId}`;
                      const isSelf = u.space === 'superadmin' && u.userId === session.userId;
                      return (
                        <tr
                          key={delKey}
                          className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <ProfileAvatar
                                src={u.avatarUrl}
                                name={u.name}
                                size="sm"
                                tone={
                                  u.space === 'instructor'
                                    ? 'amber'
                                    : u.space === 'provider'
                                    ? 'purple'
                                    : 'blue'
                                }
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                                  <span className="truncate">{u.name}</span>
                                  {isSelf && (
                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-mono shrink-0">
                                      Vous
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                  {u.email}
                                </div>
                                <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                  {u.subtitle}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${spaceInfo.badgeClass}`}
                            >
                              {spaceInfo.label}
                            </span>
                            <div className="font-mono text-[11px] text-gray-600 dark:text-gray-300 mt-1">
                              {u.role}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-gray-700 dark:text-gray-300">
                            <div className="flex items-center gap-2">
                              {u.companyLogoUrl && (
                                <CompanyLogo src={u.companyLogoUrl} name={u.organizationName} size="xs" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium max-w-[175px] truncate" title={u.organizationName}>
                                  {u.organizationName}
                                </div>
                                <div className="text-[10px] font-mono text-gray-400">{u.userId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-mono font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                              {u.ownedRecordsCount} élément(s)
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {u.activitySummary}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                  u.activeSessionsCount > 0
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {u.activeSessionsCount} session(s)
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatDateTime(u.lastLoginAt)}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            {u.status === 'ACTIVE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Actif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">
                                <Ban className="w-3 h-3" />
                                Suspendu
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right sticky right-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setInspectedUser(u)}
                                title="Suivi détaillé"
                                className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                title="Modifier le compte"
                                className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              {!isSelf && (
                                <button
                                  type="button"
                                  disabled={busyActionKey === `status:${delKey}`}
                                  onClick={() => void handleToggleStatus(u)}
                                  title={u.status === 'ACTIVE' ? 'Suspendre le compte' : 'Réactiver le compte'}
                                  className={`p-2 rounded-lg transition ${
                                    u.status === 'ACTIVE'
                                      ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                      : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  }`}
                                >
                                  {u.status === 'ACTIVE' ? (
                                    <Ban className="w-4 h-4" />
                                  ) : (
                                    <UserCheck className="w-4 h-4" />
                                  )}
                                </button>
                              )}
                              {u.activeSessionsCount > 0 && !isSelf && (
                                <button
                                  type="button"
                                  disabled={busyActionKey === `revoke:${delKey}`}
                                  onClick={() => void handleRevokeSessions(u)}
                                  title="Déconnecter les sessions actives"
                                  className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                                >
                                  <LogOut className="w-4 h-4" />
                                </button>
                              )}
                              {!isSelf && (
                                <>
                                  {confirmDeleteKey === delKey ? (
                                    <div className="inline-flex items-center gap-1 ml-1">
                                      <button
                                        type="button"
                                        disabled={busyActionKey === `del:${delKey}`}
                                        onClick={() => void handleDeleteUser(u)}
                                        className="px-2 py-1 rounded-md bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-700"
                                      >
                                        Confirmer
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteKey(null)}
                                        className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300"
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteKey(delKey)}
                                      title="Supprimer le compte"
                                      className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
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

          {/* Mobile & Tablet Vertical Cards (< lg) */}
          <div className="lg:hidden space-y-3">
            {filteredUsers.length === 0 ? (
              <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center text-sm text-gray-500">
                Aucun utilisateur ne correspond à vos filtres.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const spaceInfo = SPACE_META[u.space];
                const delKey = `${u.space}:${u.userId}`;
                const isSelf = u.space === 'superadmin' && u.userId === session.userId;
                return (
                  <div
                    key={delKey}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ProfileAvatar
                          src={u.avatarUrl}
                          name={u.name}
                          size="md"
                          tone={
                            u.space === 'instructor'
                              ? 'amber'
                              : u.space === 'provider'
                              ? 'purple'
                              : 'blue'
                          }
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                            {u.name} {isSelf ? '· Vous' : ''}
                          </div>
                          <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-md border font-semibold ${spaceInfo.badgeClass}`}>
                        {spaceInfo.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 font-mono text-gray-700 dark:text-gray-300">
                        {u.role}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400 truncate">
                        {u.companyLogoUrl && (
                          <CompanyLogo src={u.companyLogoUrl} name={u.organizationName} size="xs" />
                        )}
                        <span className="truncate">{u.organizationName}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                      <div>
                        <span className="text-[11px] text-gray-400 block">Activité</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                          {u.activitySummary}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block">Dernière connexion</span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {formatDateTime(u.lastLoginAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => setInspectedUser(u)}
                        className="min-h-[42px] flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Suivi
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(u)}
                        className="min-h-[42px] flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center justify-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Modifier
                      </button>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(u)}
                          className={`min-h-[42px] px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                            u.status === 'ACTIVE'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Suspendre' : 'Réactiver'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANALYTIQUE & MODULES PLATEFORME */}
      {activeTab === 'analytics' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Répartition des utilisateurs & sessions actives par espace
                </h3>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.usersBySpace} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Comptes totaux" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="sessions" name="Sessions actives" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-4 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                État de conformité des comptes
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {statusPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between px-2 py-1 rounded bg-emerald-50/70 dark:bg-emerald-950/30">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Actifs</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {kpis.activeUsers}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded bg-rose-50/70 dark:bg-rose-950/30">
                  <span className="text-rose-700 dark:text-rose-300 font-medium">Suspendus</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                    {kpis.suspendedUsers}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Volume des données synchronisées par pôle
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Contacts CRM', value: overview.moduleStats.crmContacts },
                { label: 'Devis & Factures CRM', value: overview.moduleStats.crmDocuments },
                { label: 'Écritures SYSCOHADA', value: overview.moduleStats.accountingEntries },
                { label: 'Formations Pro', value: overview.moduleStats.instructorCourses },
                { label: 'Inscriptions B2B', value: overview.moduleStats.learnerEnrollments },
                { label: 'Offres Prestataires', value: overview.moduleStats.providerOffers },
                { label: 'Demandes Prestations', value: overview.moduleStats.providerRequests },
                { label: 'Événements Corporate', value: overview.moduleStats.platformEvents },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
                  <div className="mt-1 text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1B: GESTION MULTI-TENANTS & FACTURATION FCFA */}
      {activeTab === 'tenants' && (
        <SuperadminTenantsTab session={session} />
      )}

      {/* TAB 1C: GESTION COMPLÈTE DES COMMISSIONS FORMATEURS & PRESTATAIRES */}
      {activeTab === 'commissions' && (
        <SuperadminCommissionsTab
          onNotify={(msg) => setNotice(msg)}
          onError={(err) => setError(err)}
          onSyncAuditLogs={() => void fetchOverview(true)}
        />
      )}

      {/* TAB 3: JOURNAL D'AUDIT & SÉCURITÉ */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filtrer les journaux par utilisateur, action ou détail..."
                className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={auditSeverityFilter}
                onChange={(e) =>
                  setAuditSeverityFilter(e.target.value as 'ALL' | 'INFO' | 'WARNING' | 'CRITICAL')
                }
                className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Toutes les sévérités</option>
                <option value="INFO">INFO — Activité standard</option>
                <option value="WARNING">WARNING — Suspensions & blocages</option>
                <option value="CRITICAL">CRITICAL — Suppressions & alertes</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {filteredAuditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucun événement.
              </div>
            ) : (
              filteredAuditLogs.map((log: PlatformAuditLog) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                          log.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                            : log.severity === 'WARNING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {log.actorName}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">
                        [{SPACE_META[log.actorSpace]?.label || log.actorSpace}]
                      </span>
                      {log.targetLabel && (
                        <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                          → {log.targetLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{log.details}</p>
                  </div>
                  <div className="text-[11px] font-mono text-gray-400 shrink-0">
                    {formatDateTime(log.timestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL: SUIVI DÉTAILLÉ UTILISATEUR */}
      {inspectedUser && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectedUser(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ProfileAvatar
                  src={inspectedUser.avatarUrl}
                  name={inspectedUser.name}
                  size="lg"
                  tone={
                    inspectedUser.space === 'instructor'
                      ? 'amber'
                      : inspectedUser.space === 'provider'
                      ? 'purple'
                      : 'blue'
                  }
                />
                {inspectedUser.companyLogoUrl && (
                  <CompanyLogo
                    src={inspectedUser.companyLogoUrl}
                    name={inspectedUser.organizationName}
                    size="sm"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                    Suivi du compte : {inspectedUser.name}
                  </h3>
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
                    {inspectedUser.email} · {inspectedUser.userId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedUser(null)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <span className="text-[11px] text-gray-400 block">Espace</span>
                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                    {SPACE_META[inspectedUser.space].label}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <span className="text-[11px] text-gray-400 block">Rôle</span>
                  <span className="text-xs font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {inspectedUser.role}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <span className="text-[11px] text-gray-400 block">Sessions actives</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {inspectedUser.activeSessionsCount}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                  <span className="text-[11px] text-gray-400 block">Objets suivis</span>
                  <span className="text-xs font-mono font-bold text-gray-900 dark:text-gray-100">
                    {inspectedUser.ownedRecordsCount}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Organisation / Entité</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {inspectedUser.organizationName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Intitulé / Spécialité</span>
                  <span className="text-gray-800 dark:text-gray-200">{inspectedUser.subtitle}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Résumé d’activité</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {inspectedUser.activitySummary}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Créé le</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {formatDateTime(inspectedUser.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Dernière connexion</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {formatDateTime(inspectedUser.lastLoginAt)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Historique d’audit lié à ce compte
                </h4>
                {inspectedUserLogs.length === 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Aucune trace.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inspectedUserLogs.map((l) => (
                      <div
                        key={l.id}
                        className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950 text-xs flex items-start justify-between gap-3"
                      >
                        <div>
                          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 mr-2">
                            {l.action}
                          </span>
                          <span className="text-gray-700 dark:text-gray-300">{l.details}</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">
                          {formatDateTime(l.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex flex-wrap items-center justify-end gap-2">
              {inspectedUser.activeSessionsCount > 0 &&
                !(inspectedUser.space === 'superadmin' && inspectedUser.userId === session.userId) && (
                  <button
                    type="button"
                    onClick={() => void handleRevokeSessions(inspectedUser)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Déconnecter sessions
                  </button>
                )}
              <button
                type="button"
                onClick={() => {
                  const target = inspectedUser;
                  setInspectedUser(null);
                  openEditModal(target);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Modifier ce compte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRÉATION / MODIFICATION UTILISATEUR */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setFormOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingUser ? (
                  <Edit3 className="w-4 h-4 text-blue-600" />
                ) : (
                  <Plus className="w-4 h-4 text-blue-600" />
                )}
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {editingUser ? `Modifier : ${editingUser.name}` : 'Créer un compte utilisateur'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Espace plateforme *
                  </label>
                  <select
                    value={formSpace}
                    disabled={Boolean(editingUser)}
                    onChange={(e) => {
                      const nextSpace = e.target.value as AuthSpace;
                      setFormSpace(nextSpace);
                      setFormRole(ROLE_OPTIONS_BY_SPACE[nextSpace][0].value);
                    }}
                    className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  >
                    <option value="intranet">Intranet & CRM</option>
                    <option value="accounting">Comptabilité SYSCOHADA</option>
                    <option value="learner">Apprenant B2B</option>
                    <option value="instructor">Formateur Pro</option>
                    <option value="provider">Prestataire Événementiel</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Rôle attribué *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {ROLE_OPTIONS_BY_SPACE[formSpace].map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex. Mariama Sy"
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Adresse e-mail *
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="utilisateur@teranga-demo.sn"
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {formSpace !== 'instructor' && formSpace !== 'superadmin' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Organisation / Entreprise
                    </label>
                    <input
                      type="text"
                      value={formOrg}
                      onChange={(e) => setFormOrg(e.target.value)}
                      placeholder="Ex. Sonatel Business SA"
                      className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Fonction / Spécialité
                  </label>
                  <input
                    type="text"
                    value={formSubtitle}
                    onChange={(e) => setFormSubtitle(e.target.value)}
                    placeholder="Ex. Responsable Commercial"
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {(formSpace === 'instructor' || formSpace === 'provider') && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Ville
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="Dakar"
                      className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Statut du compte
                  </label>
                  <select
                    value={formStatus}
                    disabled={Boolean(
                      editingUser &&
                        editingUser.space === 'superadmin' &&
                        editingUser.userId === session.userId,
                    )}
                    onChange={(e) => setFormStatus(e.target.value as UserAccountStatus)}
                    className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-60"
                  >
                    <option value="ACTIVE">Actif</option>
                    <option value="SUSPENDED">Suspendu</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950 flex flex-wrap items-center gap-5">
                <CompactImageUploader
                  label="Photo de profil"
                  currentUrl={formAvatarUrl}
                  name={formName || 'Utilisateur'}
                  variant="avatar"
                  onUpload={(dataUrl) => setFormAvatarUrl(dataUrl)}
                  onRemove={() => setFormAvatarUrl('')}
                  onError={(msg) => setError(msg)}
                />
                {formSpace === 'provider' && (
                  <CompactImageUploader
                    label="Logo entreprise"
                    currentUrl={formCompanyLogoUrl}
                    name={formOrg || 'Entreprise'}
                    variant="logo"
                    onUpload={(dataUrl) => setFormCompanyLogoUrl(dataUrl)}
                    onRemove={() => setFormCompanyLogoUrl('')}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 inline-flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                  {editingUser
                    ? 'Réinitialiser le mot de passe (laisser vide pour conserver)'
                    : 'Mot de passe initial (min. 6 caractères) *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={editingUser && !formPassword ? undefined : 6}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[42px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold"
                >
                  {formSubmitting
                    ? 'Enregistrement...'
                    : editingUser
                    ? 'Enregistrer les modifications'
                    : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
