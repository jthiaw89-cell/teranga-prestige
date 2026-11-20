import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  FileCheck2,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Home,
  Inbox,
  Megaphone,
  Plane,
  Presentation,
  Settings2,
  Shield,
  Target,
  Users,
  Video,
} from 'lucide-react';
import { AccountingModule } from './components/AccountingModule';
import { CommsDirectoryModule } from './components/CommsDirectoryModule';
import { CrmDocumentsModule } from './components/CrmDocumentsModule';
import { Dashboard } from './components/Dashboard';
import { EventsTrainingModule } from './components/EventsTrainingModule';
import { GedModule } from './components/GedModule';
import { HrLeavesModule } from './components/HrLeavesModule';
import { InstructorPortalModule } from './components/InstructorPortalModule';
import { IntranetModule } from './components/IntranetModule';
import { LearnerPortalModule } from './components/LearnerPortalModule';
import { LoginScreen, type AuthSessionSummary } from './components/LoginScreen';
import { MarketingModule } from './components/MarketingModule';
import { MissionsModule } from './components/MissionsModule';
import { NotificationsCenterModule } from './components/NotificationsCenterModule';
import { OperationsModule } from './components/OperationsModule';
import { OrgAdminModule } from './components/OrgAdminModule';
import { PlanningModule } from './components/PlanningModule';
import { ProviderPortalModule } from './components/ProviderPortalModule';
import { ReportsModule } from './components/ReportsModule';
import { SuperadminPortalModule } from './components/SuperadminPortalModule';
import { SuperadminTenantsTab } from './components/SuperadminTenantsTab';
import { TasksKanbanModule } from './components/TasksKanbanModule';
import { WorkflowsModule } from './components/WorkflowsModule';
import {
  PlatformShell,
  type SidebarNavItem,
} from './components/ui/dashboard-with-collapsible-sidebar';
import { buildAuthHeaders, clearAllSpaceTokens } from './lib/authHeaders';
import { useFirebase } from './lib/FirebaseProvider';
import type {
  NotificationItem,
  NotificationsOverviewPayload,
  OrgAdminOverviewPayload,
  OrganizationOption,
} from './types';

const ORGANIZATIONS: OrganizationOption[] = [
  {
    id: 'tpd-demo-intranet',
    name: 'Teranga Prestige Digital',
    sector: 'Direction & Services Corporate',
    ninea: '000148720 2G1',
    city: 'Dakar, Sénégal',
    logoUrl: '/src/assets/images/logo_org_teranga_1795100810532.jpg',
  },
  {
    id: 'teranga-events',
    name: 'Teranga Prestige Événementiel',
    sector: 'Sommets, Protocoles & Scénographie',
    ninea: '005892104 1C4',
    city: 'Diamniadio, Sénégal',
    logoUrl: '/src/assets/images/logo_company_teranex_1795100810852.jpg',
  },
  {
    id: 'teranga-academy',
    name: 'Institut Teranga Formation',
    sector: 'Formation Professionnelle & Certifications',
    ninea: '006741920 3B2',
    city: 'Dakar Plateau, Sénégal',
    logoUrl: '/src/assets/images/logo_org_academy_1795100810596.jpg',
  },
];

export type ActiveSection =
  | 'dashboard'
  | 'hr'
  | 'workflows'
  | 'ged'
  | 'comms'
  | 'operations'
  | 'missions'
  | 'reports'
  | 'org_admin'
  | 'notifications'
  | 'crm'
  | 'marketing'
  | 'accounting'
  | 'intranet'
  | 'events'
  | 'training'
  | 'learner'
  | 'instructor'
  | 'provider'
  | 'superadmin'
  | 'tenants'
  | 'commissions'
  | 'tasks'
  | 'planning';

const ALL_NAV_ITEMS: SidebarNavItem[] = [
  { id: 'dashboard', title: 'Mon Tableau de bord', icon: Home },
  { id: 'hr', title: 'RH, Congés & Pointage', icon: Users },
  { id: 'missions', title: 'Ordres de Mission', icon: Plane },
  { id: 'reports', title: 'Rapports Mission & Travail', icon: FileCheck2 },
  { id: 'workflows', title: 'Demandes & Validations', icon: GitBranch },
  { id: 'ged', title: 'GED & Documents', icon: FolderOpen },
  { id: 'comms', title: 'Notes & Annuaire', icon: Megaphone },
  { id: 'operations', title: 'Courrier & Ressources', icon: Inbox },
  { id: 'tasks', title: 'Tâches & Kanban', icon: CheckSquare },
  { id: 'planning', title: 'Planning', icon: CalendarClock },
  { id: 'superadmin', title: 'Superadmin & Utilisateurs', icon: Shield },
  { id: 'tenants', title: 'Tenants & Facturation', icon: Building2 },
  { id: 'commissions', title: 'Commissions & Barèmes', icon: BadgePercent },
  { id: 'org_admin', title: 'Admin Org & Marque', icon: Settings2 },
  { id: 'crm', title: 'CRM & campagnes', icon: FileText },
  { id: 'marketing', title: 'Marketing & Retargeting', icon: Target },
  { id: 'accounting', title: 'SYSCOHADA', icon: Calculator },
  { id: 'intranet', title: 'Teams & Équipes', icon: Video },
  { id: 'events', title: 'Événementiel', icon: CalendarDays },
  { id: 'training', title: 'Formation Pro', icon: GraduationCap },
  { id: 'learner', title: 'Espace Apprenant', icon: BookOpen },
  { id: 'instructor', title: 'Espace Formateur', icon: Presentation },
  { id: 'provider', title: 'Espace Prestataires', icon: Briefcase },
  { id: 'notifications', title: 'Notifications', icon: Bell },
];

const SECTION_META: Record<ActiveSection, { title: string }> = {
  dashboard: { title: 'Mon Tableau de bord personnel' },
  hr: { title: 'RH, Congés & Pointage Sénégal' },
  workflows: { title: 'Demandes & Circuits de Validation' },
  ged: { title: 'GED & Coffre-Fort Documentaire' },
  comms: { title: 'Notes de Service, Sondages & Annuaire' },
  operations: { title: 'Courrier Institutionnel, Visiteurs & Ressources' },
  missions: { title: 'Ordres de Mission & Frais de Déplacement' },
  reports: { title: 'Outil de Rapports de Mission & Rapports de Travail' },
  org_admin: { title: 'Administration Organisation & Marque Blanche' },
  notifications: { title: 'Centre de Notifications Intelligentes' },
  superadmin: { title: 'Administration Superadmin' },
  tenants: { title: 'Console Multi-Tenants & Facturation FCFA' },
  commissions: { title: 'Gestion des Commissions' },
  crm: { title: 'CRM & campagnes' },
  marketing: { title: 'Marketing & Retargeting' },
  accounting: { title: 'Comptabilité SYSCOHADA' },
  intranet: { title: 'Teams — Communication & Collaboration' },
  events: { title: 'Pôle Événementiel' },
  training: { title: 'Formation Professionnelle' },
  learner: { title: 'Espace Apprenant B2B' },
  instructor: { title: 'Espace Formateur Pro' },
  provider: { title: 'Espace Prestataires Événementiels' },
  tasks: { title: 'Gestion des Tâches & Tableau Kanban' },
  planning: { title: 'Planning & Agenda Unifié' },
};

function getAllowedSections(session: AuthSessionSummary): ActiveSection[] {
  if (session.space === 'superadmin') {
    return [
      'dashboard',
      'superadmin',
      'tenants',
      'commissions',
      'training',
      'marketing',
      'missions',
      'reports',
      'workflows',
      'ged',
      'comms',
      'intranet',
      'tasks',
      'planning',
      'notifications',
    ];
  }
  if (session.space === 'learner') {
    return ['dashboard', 'learner', 'intranet', 'workflows', 'ged', 'comms', 'tasks', 'planning', 'notifications'];
  }
  if (session.space === 'instructor') {
    return ['dashboard', 'instructor', 'marketing', 'intranet', 'workflows', 'ged', 'comms', 'tasks', 'planning', 'notifications'];
  }
  if (session.space === 'provider') {
    return ['dashboard', 'provider', 'intranet', 'workflows', 'ged', 'comms', 'tasks', 'planning', 'notifications'];
  }
  if (session.space === 'accounting') {
    return [
      'dashboard',
      'accounting',
      'crm',
      'marketing',
      'missions',
      'reports',
      'workflows',
      'ged',
      'hr',
      'comms',
      'intranet',
      'tasks',
      'planning',
      'notifications',
    ];
  }
  // intranet
  if (session.role === 'OWNER' || session.role === 'DIRECTION') {
    return [
      'dashboard',
      'hr',
      'missions',
      'reports',
      'workflows',
      'ged',
      'comms',
      'operations',
      'org_admin',
      'tasks',
      'planning',
      'crm',
      'marketing',
      'accounting',
      'intranet',
      'events',
      'training',
      'notifications',
    ];
  }
  if (session.role === 'MANAGER') {
    return [
      'dashboard',
      'hr',
      'missions',
      'reports',
      'workflows',
      'ged',
      'comms',
      'operations',
      'tasks',
      'planning',
      'crm',
      'marketing',
      'intranet',
      'events',
      'training',
      'notifications',
    ];
  }
  return [
    'dashboard',
    'hr',
    'missions',
    'reports',
    'workflows',
    'ged',
    'comms',
    'operations',
    'tasks',
    'planning',
    'intranet',
    'events',
    'training',
    'notifications',
  ];
}

export default function App() {
  const [session, setSession] = useState<AuthSessionSummary | null>(() => {
    try {
      const saved = sessionStorage.getItem('tpd_portal_session');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as Partial<AuthSessionSummary>;
      if (!parsed.userId || !parsed.space) return null;
      return parsed as AuthSessionSummary;
    } catch {
      return null;
    }
  });
  const [selectedOrgId, setSelectedOrgId] = useState<string>(ORGANIZATIONS[0].id);
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([]);
  const [brandAccentColor, setBrandAccentColor] = useState<string | undefined>(undefined);
  const [brandCustomName, setBrandCustomName] = useState<string | undefined>(undefined);
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | undefined>(undefined);

  const fetchShellSync = useCallback(async () => {
    if (!session) return;
    const headers = buildAuthHeaders(session.space, false);
    try {
      const [notifRes, adminRes] = await Promise.allSettled([
        fetch('/api/notifications/overview', { headers, credentials: 'include' }),
        fetch('/api/org-admin/overview', { headers, credentials: 'include' }),
      ]);
      if (notifRes.status === 'fulfilled' && notifRes.value.ok) {
        const notifData = (await notifRes.value.json()) as NotificationsOverviewPayload;
        setUnreadNotificationsCount(notifData.unreadCount);
        setRecentNotifications(notifData.notifications.slice(0, 6));
      }
      if (adminRes.status === 'fulfilled' && adminRes.value.ok) {
        const orgData = (await adminRes.value.json()) as OrgAdminOverviewPayload;
        if (orgData.theme?.primaryColor) {
          setBrandAccentColor(orgData.theme.primaryColor);
        }
        if (orgData.theme?.displayName && session.space === 'intranet') {
          setBrandCustomName(orgData.theme.displayName);
        }
        setBrandLogoUrl(orgData.theme?.logoUrl);
      }
    } catch {
      // silent sync
    }
  }, [session]);

  const { authReady, firebaseUser, syncWorkspaceNow, signOutFirebase } = useFirebase();

  useEffect(() => {
    void fetchShellSync();
  }, [fetchShellSync, activeSection]);

  useEffect(() => {
    if (!session || !authReady || !firebaseUser || !firebaseUser.emailVerified) return;
    void syncWorkspaceNow(session).then(() => {
      void fetchShellSync();
    });
  }, [session, authReady, firebaseUser, syncWorkspaceNow, fetchShellSync]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    if (!session) return;
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    void fetchShellSync();
  }, [fetchShellSync, session]);

  const allowedSections = useMemo(
    () => (session ? getAllowedSections(session) : []),
    [session],
  );

  const visibleNavItems = useMemo(
    () =>
      ALL_NAV_ITEMS.filter((item) => allowedSections.includes(item.id as ActiveSection)).map(
        (item) =>
          item.id === 'notifications' && unreadNotificationsCount > 0
            ? { ...item, notifs: unreadNotificationsCount }
            : item,
      ),
    [allowedSections, unreadNotificationsCount],
  );

  const personalOrgs = useMemo(() => {
    if (!session) return ORGANIZATIONS;
    if (session.space === 'intranet' && session.role === 'OWNER') {
      return ORGANIZATIONS;
    }
    return [
      {
        id: session.organizationId,
        name: session.organizationName,
        subtitle: session.subtitle || session.role,
        logoUrl: session.companyLogoUrl || brandLogoUrl || ORGANIZATIONS.find((o) => o.id === session.organizationId)?.logoUrl,
      },
    ];
  }, [session, brandLogoUrl]);

  const currentOrg: OrganizationOption = useMemo(() => {
    if (!session) return ORGANIZATIONS[0];
    const match = ORGANIZATIONS.find((o) => o.id === selectedOrgId);
    if (session.space === 'intranet' && session.role === 'OWNER' && match) {
      return match.id === session.organizationId && brandLogoUrl !== undefined
        ? { ...match, logoUrl: brandLogoUrl }
        : match;
    }
    return {
      id: session.organizationId,
      name: session.organizationName,
      sector: session.subtitle || session.role,
      ninea: 'COMPTE PERSONNEL',
      city: 'Dakar, Sénégal',
      logoUrl: session.companyLogoUrl || brandLogoUrl,
    };
  }, [selectedOrgId, session, brandLogoUrl]);

  function handleAuthenticated(nextSession: AuthSessionSummary) {
    sessionStorage.setItem('tpd_portal_session', JSON.stringify(nextSession));
    setSession(nextSession);
    setSelectedOrgId(nextSession.organizationId || ORGANIZATIONS[0].id);
    setActiveSection('dashboard');
    setBrandAccentColor(undefined);
    setBrandCustomName(undefined);
    setBrandLogoUrl(nextSession.companyLogoUrl);
  }

  async function handleSignOut() {
    clearAllSpaceTokens();
    await Promise.allSettled([
      signOutFirebase(),
      fetch('/api/intranet/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/accounting/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/learner/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/instructor/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/provider/auth/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/superadmin/auth/logout', { method: 'POST', credentials: 'include' }),
    ]);
    setSession(null);
    setActiveSection('dashboard');
    setUnreadNotificationsCount(0);
    setRecentNotifications([]);
    setBrandAccentColor(undefined);
    setBrandCustomName(undefined);
    setBrandLogoUrl(undefined);
  }

  if (!session) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  const safeSection: ActiveSection = allowedSections.includes(activeSection)
    ? activeSection
    : 'dashboard';
  const meta = SECTION_META[safeSection];

  return (
    <PlatformShell
      key={session.userId}
      brandTitle={brandCustomName || session.organizationName}
      brandSubtitle={session.subtitle || session.role}
      brandLogoUrl={currentOrg.logoUrl || brandLogoUrl}
      organizations={personalOrgs.map((o) => ({
        id: o.id,
        name: o.name,
        subtitle: 'subtitle' in o ? o.subtitle : o.sector,
        logoUrl: o.id === session.organizationId && brandLogoUrl !== undefined ? brandLogoUrl : o.logoUrl,
      }))}
      selectedOrganizationId={currentOrg.id}
      onSelectOrganization={setSelectedOrgId}
      navItems={visibleNavItems}
      activeId={safeSection}
      onSelectNav={(id) => {
        if (allowedSections.includes(id as ActiveSection)) {
          setActiveSection(id as ActiveSection);
        }
      }}
      pageTitle={meta.title}
      userName={session.name}
      userRole={session.role}
      onSignOut={() => void handleSignOut()}
      unreadNotificationsCount={unreadNotificationsCount}
      recentNotifications={recentNotifications}
      onOpenNotifications={() => setActiveSection('notifications')}
      onMarkAllNotificationsRead={() => void handleMarkAllNotificationsRead()}
      accentColor={brandAccentColor}
    >
      {safeSection === 'dashboard' && (
        <Dashboard
          key={`dash-${session.userId}`}
          session={session}
          organization={currentOrg}
          allowedSections={allowedSections}
          onNavigate={(section) => {
            if (allowedSections.includes(section as ActiveSection)) {
              setActiveSection(section as ActiveSection);
            }
          }}
        />
      )}
      {safeSection === 'hr' && <HrLeavesModule key={`hr-${session.userId}`} session={session} />}
      {safeSection === 'workflows' && (
        <WorkflowsModule key={`wf-${session.userId}`} session={session} />
      )}
      {safeSection === 'ged' && <GedModule key={`ged-${session.userId}`} session={session} />}
      {safeSection === 'comms' && (
        <CommsDirectoryModule key={`comms-${session.userId}`} session={session} />
      )}
      {safeSection === 'operations' && (
        <OperationsModule key={`ops-${session.userId}`} session={session} />
      )}
      {safeSection === 'missions' && (
        <MissionsModule key={`mis-${session.userId}`} session={session} />
      )}
      {safeSection === 'reports' && (
        <ReportsModule key={`rpt-${session.userId}`} session={session} organization={currentOrg} />
      )}
      {safeSection === 'org_admin' && (
        <OrgAdminModule
          key={`org-${session.userId}`}
          session={session}
          onThemeUpdated={(color, displayName, logoUrl) => {
            setBrandAccentColor(color);
            setBrandCustomName(displayName);
            setBrandLogoUrl(logoUrl);
          }}
        />
      )}
      {safeSection === 'notifications' && (
        <NotificationsCenterModule
          key={`notif-${session.userId}`}
          session={session}
          onUnreadCountChange={(count) => setUnreadNotificationsCount(count)}
          onNavigateSection={(sec) => {
            if (allowedSections.includes(sec as ActiveSection)) {
              setActiveSection(sec as ActiveSection);
            }
          }}
        />
      )}
      {safeSection === 'crm' && (
        <CrmDocumentsModule key={`crm-${session.userId}`} organization={currentOrg} session={session} />
      )}
      {safeSection === 'marketing' && (
        <MarketingModule key={`mkt-${session.userId}`} session={session} organization={currentOrg} />
      )}
      {safeSection === 'accounting' && <AccountingModule key={`acc-${session.userId}`} />}
      {safeSection === 'intranet' && (
        <IntranetModule key={`int-${session.userId}`} session={session} organization={currentOrg} />
      )}
      {safeSection === 'events' && (
        <EventsTrainingModule key={`ev-${session.userId}`} organization={currentOrg} mode="events" session={session} />
      )}
      {safeSection === 'training' && (
        <EventsTrainingModule key={`tr-${session.userId}`} organization={currentOrg} mode="training" session={session} />
      )}
      {safeSection === 'learner' && <LearnerPortalModule key={`lrn-${session.userId}`} />}
      {safeSection === 'instructor' && <InstructorPortalModule key={`inst-${session.userId}`} />}
      {safeSection === 'provider' && <ProviderPortalModule key={`prov-${session.userId}`} />}
      {(safeSection === 'superadmin' || safeSection === 'commissions') && (
        <SuperadminPortalModule
          key={`sup-${session.userId}`}
          session={session}
          initialTab={safeSection === 'commissions' ? 'commissions' : 'users'}
        />
      )}
      {safeSection === 'tenants' && (
        <SuperadminTenantsTab key={`ten-${session.userId}`} session={session} />
      )}
      {safeSection === 'tasks' && (
        <TasksKanbanModule
          key={`tsk-${session.userId}`}
          session={session}
          onNavigatePlanning={() => setActiveSection('planning')}
        />
      )}
      {safeSection === 'planning' && (
        <PlanningModule
          key={`pln-${session.userId}`}
          session={session}
          onNavigateTasks={() => setActiveSection('tasks')}
        />
      )}
    </PlatformShell>
  );
}

