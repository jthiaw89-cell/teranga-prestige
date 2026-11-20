import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Calculator,
  GraduationCap,
  LogIn,
  Presentation,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { clearAllSpaceTokens, setSpaceToken } from '../lib/authHeaders';
import { auth, googleProvider } from '../lib/firebase';
import { CompanyLogo, ProfileAvatar } from './ui/MediaAvatar';
import type { AccountDirectoryEntry, AuthSessionSummary, AuthSpace } from '../types';

export type { AuthSessionSummary };

interface Props {
  onAuthenticated: (
    session: AuthSessionSummary,
    targetSection:
      | 'dashboard'
      | 'accounting'
      | 'intranet'
      | 'learner'
      | 'instructor'
      | 'provider'
      | 'superadmin',
  ) => void;
}

const FALLBACK_ACCOUNTS: AccountDirectoryEntry[] = [
  {
    userId: 'int-u-1',
    space: 'intranet',
    name: 'Cheikh Tidiane Fall',
    email: 'direction@teranga-demo.sn',
    role: 'OWNER',
    subtitle: 'Directeur Général · Direction',
    organizationId: 'tpd-demo-intranet',
    organizationName: 'Teranga Prestige Digital',
  },
  {
    userId: 'int-u-2',
    space: 'intranet',
    name: 'Fatou Binetou Sarr',
    email: 'manager@teranga-demo.sn',
    role: 'MANAGER',
    subtitle: 'Responsable Pôle Événementiel · Manager',
    organizationId: 'tpd-demo-intranet',
    organizationName: 'Teranga Prestige Digital',
  },
  {
    userId: 'int-u-3',
    space: 'intranet',
    name: 'Moussa Ndiaye',
    email: 'employe@teranga-demo.sn',
    role: 'EMPLOYEE',
    subtitle: 'Chargé de Logistique · Employé',
    organizationId: 'tpd-demo-intranet',
    organizationName: 'Teranga Prestige Digital',
  },
  {
    userId: 'acc-u-1',
    space: 'accounting',
    name: 'Amadou Konté',
    email: 'comptabilite@teranga-demo.sn',
    role: 'ACCOUNTANT',
    subtitle: 'Directeur Administratif & Financier',
    organizationId: 'tpd-demo-accounting',
    organizationName: 'Teranga Prestige Digital',
  },
  {
    userId: 'acc-u-2',
    space: 'accounting',
    name: 'Cabinet Audit Diop & Associés',
    email: 'audit@cabinet-diop.sn',
    role: 'READ_ONLY',
    subtitle: 'Audit Externe (Lecture seule)',
    organizationId: 'tpd-demo-accounting',
    organizationName: 'Teranga Prestige Digital',
  },
  {
    userId: 'lrn-1',
    space: 'learner',
    name: 'Awa Diagne',
    email: 'apprenant@teranga-demo.sn',
    role: 'LEARNER',
    subtitle: 'Cheffe de Projet Digital · Sonatel Business SA',
    organizationId: 'Sonatel Business SA',
    organizationName: 'Sonatel Business SA',
  },
  {
    userId: 'lrn-2',
    space: 'learner',
    name: 'Khadim Ndiaye',
    email: 'k.ndiaye@senelec.sn',
    role: 'LEARNER',
    subtitle: 'Contrôleur de Gestion · Senelec Digital',
    organizationId: 'Senelec Digital',
    organizationName: 'Senelec Digital',
  },
  {
    userId: 'inst-1',
    space: 'instructor',
    name: 'Ibrahima Diallo',
    email: 'formateur@teranga-demo.sn',
    role: 'INSTRUCTOR',
    subtitle: 'Cloud, IA & Systèmes Souverains · Thiès / Dakar',
    organizationId: 'Thiès / Dakar',
    organizationName: 'Formateur · Thiès / Dakar',
  },
  {
    userId: 'inst-2',
    space: 'instructor',
    name: 'Ndeye Fatou Mbaye',
    email: 'n.mbaye@teranga-demo.sn',
    role: 'INSTRUCTOR',
    subtitle: 'Cybersécurité & Audit SYSCOHADA · Dakar Plateau',
    organizationId: 'Dakar Plateau',
    organizationName: 'Formateur · Dakar Plateau',
  },
  {
    userId: 'prov-1',
    space: 'provider',
    name: 'Serigne Ba',
    email: 'prestataire@teranga-demo.sn',
    role: 'PROVIDER',
    subtitle: 'Coordinateur Logistique · Teranex Connect',
    organizationId: 'Teranex Connect Événements',
    organizationName: 'Teranex Connect Événements',
  },
  {
    userId: 'prov-2',
    space: 'provider',
    name: 'Khady Ndiaye',
    email: 'k.ndiaye@teranga-traiteur.sn',
    role: 'PROVIDER',
    subtitle: 'Chef Exécutive · Teranga Gastronomie',
    organizationId: 'Teranga Gastronomie & Réceptions',
    organizationName: 'Teranga Gastronomie & Réceptions',
  },
  {
    userId: 'sup-1',
    space: 'superadmin',
    name: 'Ousmane Diop',
    email: 'superadmin@teranga-demo.sn',
    role: 'SUPERADMIN',
    subtitle: 'Super Administrateur Plateforme',
    organizationId: 'tpd-superadmin',
    organizationName: 'Administration Plateforme',
  },
  {
    userId: 'sup-2',
    space: 'superadmin',
    name: 'Aïssatou Sow',
    email: 'securite@teranga-demo.sn',
    role: 'SECURITY_ADMIN',
    subtitle: 'Responsable Audit, Accès & Sécurité',
    organizationId: 'tpd-superadmin',
    organizationName: 'Administration Plateforme',
  },
];

const SPACE_LABELS: Record<AuthSpace, string> = {
  intranet: 'Intranet & CRM',
  accounting: 'Comptabilité',
  learner: 'Apprenant',
  instructor: 'Formateur',
  provider: 'Prestataire',
  superadmin: 'Superadmin',
};

export const LoginScreen: React.FC<Props> = ({ onAuthenticated }) => {
  const [loginMode, setLoginMode] = useState<AuthSpace>('intranet');
  const [authAction, setAuthAction] = useState<'login' | 'register'>('login');
  const [accounts, setAccounts] = useState<AccountDirectoryEntry[]>(FALLBACK_ACCOUNTS);

  const [organizationId, setOrganizationId] = useState('tpd-demo-intranet');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Self-registration fields for Learner / Instructor / Provider
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regRoleTitle, setRegRoleTitle] = useState('');
  const [regCity, setRegCity] = useState('Dakar');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/directory')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { accounts?: AccountDirectoryEntry[] } | null) => {
        if (data?.accounts && data.accounts.length > 0) {
          setAccounts(data.accounts);
        }
      })
      .catch(() => {
        // fallback already loaded
      });
  }, []);

  async function logoutAllServerSessions() {
    clearAllSpaceTokens();
    await Promise.allSettled([
      fetch('/api/intranet/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/accounting/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/learner/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/instructor/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/provider/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/superadmin/auth/logout', { method: 'POST', credentials: 'include' }),
    ]);
  }

  async function loginWithSpace(space: AuthSpace, demoUserId?: string) {
    setError('');
    setLoading(true);
    try {
      await logoutAllServerSessions();
      const endpoint = `/api/${space}/auth/login`;
      const payload = demoUserId
        ? { demoUserId }
        : space === 'intranet'
        ? { organizationId, email, password }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Identifiants invalides.');
        return;
      }

      setSpaceToken(space, data.token);
      const u = data.user;
      const summary: AuthSessionSummary = {
        userId: u.id,
        space,
        name: u.name,
        email: u.email,
        role:
          space === 'learner'
            ? 'LEARNER'
            : space === 'instructor'
            ? 'INSTRUCTOR'
            : space === 'provider'
            ? 'PROVIDER'
            : u.role,
        organizationId: u.organizationId || u.companyName || u.city || 'teranga-personal',
        organizationName: u.organizationName || u.companyName || (u.city ? `Formateur · ${u.city}` : 'Espace Personnel'),
        subtitle: u.title || u.jobTitle || u.specialty || u.roleTitle,
      };
      onAuthenticated(summary, 'dashboard');
    } catch {
      setError('Impossible de joindre le service d’authentification.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (loginMode !== 'learner' && loginMode !== 'instructor' && loginMode !== 'provider') return;
    setError('');
    setLoading(true);
    try {
      await logoutAllServerSessions();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          space: loginMode,
          name: regName,
          email,
          password,
          organizationOrCompany: regOrg,
          roleOrSpecialty: regRoleTitle,
          city: regCity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Inscription impossible.');
        return;
      }
      setSpaceToken(loginMode, data.token);
      onAuthenticated(data.session as AuthSessionSummary, 'dashboard');
    } catch {
      setError('Service d’inscription indisponible.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await logoutAllServerSessions();
      const credential = await signInWithPopup(auth, googleProvider);
      const user = credential.user;
      if (!user.email) {
        setError('Adresse e-mail Google requise.');
        return;
      }
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          space: loginMode,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoUrl: user.photoURL || undefined,
          firebaseUid: user.uid,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion Google refusée.');
        return;
      }
      setSpaceToken(loginMode, data.token);
      onAuthenticated(data.session as AuthSessionSummary, 'dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setError('Connexion Google impossible. Vérifiez que les fenêtres contextuelles sont autorisées.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (authAction === 'register') {
      void handleRegister(e);
    } else {
      void loginWithSpace(loginMode);
    }
  }

  const spaceAccounts = accounts.filter((a) => a.space === loginMode);
  const canRegister = loginMode === 'learner' || loginMode === 'instructor' || loginMode === 'provider';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center px-4 py-10">
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center mx-auto shadow-sm">
            <Briefcase className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Teranga Prestige Digital
          </h1>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-5">
          {/* 6 Space Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {(
              [
                { id: 'intranet', label: 'Intranet & CRM', icon: Users },
                { id: 'accounting', label: 'Compta', icon: Calculator },
                { id: 'learner', label: 'Apprenant', icon: GraduationCap },
                { id: 'instructor', label: 'Formateur', icon: Presentation },
                { id: 'provider', label: 'Prestataire', icon: Briefcase },
                { id: 'superadmin', label: 'Superadmin', icon: Shield },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = loginMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setLoginMode(tab.id);
                    if (tab.id === 'intranet' || tab.id === 'accounting' || tab.id === 'superadmin') {
                      setAuthAction('login');
                    }
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {canRegister && (
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Espace personnel {SPACE_LABELS[loginMode]}
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setAuthAction('login');
                    setError('');
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    authAction === 'login'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthAction('register');
                    setError('');
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 ${
                    authAction === 'register'
                      ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <UserPlus className="w-3 h-3" />
                  Créer un compte
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGoogleLogin()}
            className="w-full py-2.5 px-4 bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 text-sm font-semibold rounded-lg flex items-center justify-center gap-2.5 transition shadow-xs disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Continuer avec Google ({SPACE_LABELS[loginMode]})</span>
          </button>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {loginMode === 'intranet' && authAction === 'login' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Identifiant d’organisation
                </label>
                <input
                  type="text"
                  required
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  placeholder="tpd-demo-intranet"
                  className="w-full px-3.5 py-2 text-sm font-mono bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {authAction === 'register' && canRegister && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ex. Aminata Diop"
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {loginMode === 'learner'
                      ? 'Entreprise B2B'
                      : loginMode === 'provider'
                      ? 'Entreprise / Enseigne'
                      : 'Ville'}
                  </label>
                  {loginMode === 'instructor' ? (
                    <input
                      type="text"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                      placeholder="Dakar"
                      className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg"
                    />
                  ) : (
                    <input
                      type="text"
                      value={regOrg}
                      onChange={(e) => setRegOrg(e.target.value)}
                      placeholder="Ex. Teranga Services"
                      className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg"
                    />
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {loginMode === 'learner'
                      ? 'Fonction / Poste'
                      : loginMode === 'instructor'
                      ? 'Spécialité pédagogique'
                      : 'Métier / Prestation principale'}
                  </label>
                  <input
                    type="text"
                    value={regRoleTitle}
                    onChange={(e) => setRegRoleTitle(e.target.value)}
                    placeholder={
                      loginMode === 'learner'
                        ? 'Ex. Responsable RH'
                        : loginMode === 'instructor'
                        ? 'Ex. Finance SYSCOHADA & Audit'
                        : 'Ex. Traiteur & Événements VIP'
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Adresse e-mail professionnelle
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={spaceAccounts[0]?.email || 'utilisateur@teranga-demo.sn'}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Mot de passe</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition"
            >
              {authAction === 'register' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {authAction === 'register'
                ? `Créer mon compte ${SPACE_LABELS[loginMode]} isolé`
                : `Se connecter à mon tableau personnel (${SPACE_LABELS[loginMode]})`}
            </button>
          </form>

          {/* Individual User Accounts Directory for this space */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Comptes utilisateurs ({spaceAccounts.length})
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {spaceAccounts.map((acc) => (
                <button
                  key={acc.userId}
                  type="button"
                  disabled={loading}
                  onClick={() => void loginWithSpace(acc.space, acc.userId)}
                  className="text-left p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProfileAvatar
                        src={acc.avatarUrl}
                        name={acc.name}
                        size="sm"
                        tone={
                          acc.space === 'instructor'
                            ? 'amber'
                            : acc.space === 'provider'
                            ? 'purple'
                            : 'blue'
                        }
                      />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 truncate">
                        {acc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {acc.companyLogoUrl && (
                        <CompanyLogo src={acc.companyLogoUrl} name={acc.organizationName} size="xs" />
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 font-mono text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                        {acc.role}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">{acc.subtitle}</div>
                  <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {acc.email}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
