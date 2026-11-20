import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Award,
  BadgePercent,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calculator,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  DollarSign,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Inbox,
  Megaphone,
  MessageSquareLock,
  Package,
  Plane,
  Presentation,
  Settings2,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
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
import type {
  AuthSessionSummary,
  CrmPipelineStage,
  EventRecord,
  OrganizationOption,
} from '../types';

export type DashboardTargetSection =
  | 'crm'
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
  | 'planning'
  | 'hr'
  | 'workflows'
  | 'ged'
  | 'comms'
  | 'operations'
  | 'missions'
  | 'reports'
  | 'org_admin'
  | 'notifications';

interface Props {
  session: AuthSessionSummary;
  organization: OrganizationOption;
  allowedSections?: string[];
  onNavigate: (section: DashboardTargetSection) => void;
}

interface PipelineChartDatum {
  stage: CrmPipelineStage;
  label: string;
  count: number;
  fill: string;
}

interface PendingQuotesChartDatum {
  label: string;
  amount: number;
  count: number;
  fill: string;
}

interface CrmStatsPayload {
  recentCount: number;
  latestNumber: string;
  totalTtc: number;
  totalPaid: number;
  remainingBalance: number;
  pipelineData: PipelineChartDatum[];
  totalLeads: number;
  convertedLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  qualificationRate: number;
  pendingQuotesCount: number;
  pendingQuotesTotal: number;
  pendingQuotesByStatus: PendingQuotesChartDatum[];
}

interface PlatformDashboardPayload {
  crmStats?: CrmStatsPayload;
  events?: EventRecord[];
  trainings?: Array<{
    id: string;
    title: string;
    date: string;
    seatsTaken: number;
    maxSeats: number;
    hours: number;
    instructor: string;
  }>;
  intranetChannelsCount?: number;
  providerRequestsCount?: number;
  accountingEntriesCount?: number;
  recentMessages?: Array<{
    id: string;
    senderName: string;
    content: string;
    createdAt: string;
  }>;
  accountingSummary?: {
    entriesCount: number;
    accountsCount: number;
    journalsCount: number;
    syncedInvoicesCount: number;
    totalVolume: number;
    byJournal: Array<{ code: string; name: string; count: number; amount: number }>;
    recentEntries: Array<{
      id: string;
      entryNumber: string;
      entryDate: string;
      description: string;
      journalCode: string;
    }>;
  };
  learnerSummary?: {
    coursesCount: number;
    overallProgress: number;
    certificatesCount: number;
    availableCatalogCount: number;
    coursesChart: Array<{ title: string; progress: number; modality: string }>;
  };
  instructorSummary?: {
    totalCourses: number;
    publishedCourses: number;
    enrollmentsCount: number;
    certifiedCount: number;
    avgCompletion: number;
    coursesChart: Array<{ title: string; enrolled: number; status: string }>;
    recentEnrollments: Array<{
      id: string;
      learnerName: string;
      courseTitle: string;
      progressPct: number;
      attendanceStatus: string;
    }>;
  };
  providerSummary?: {
    offersCount: number;
    publishedOffers: number;
    requestsCount: number;
    pipelineFcfa: number;
    paidFcfa: number;
    stageChart: Array<{ label: string; amount: number; count: number }>;
    recentRequests: Array<{
      id: string;
      offerTitle: string;
      clientCompany: string;
      stage: string;
      amountFcfa: number;
      eventDate: string;
    }>;
  };
  superadminSummary?: {
    kpis: {
      totalUsers: number;
      activeUsers: number;
      suspendedUsers: number;
      activeSessionsTotal: number;
      organizationsCount: number;
      totalTrackedRecords: number;
    };
    commissionKpis?: {
      grossVolumeFcfa: number;
      totalCommissionFcfa: number;
      instructorCommissionFcfa: number;
      providerCommissionFcfa: number;
      pendingValidationFcfa: number;
      collectedOrSettledFcfa: number;
      pendingCount: number;
      activeRulesCount: number;
    };
    usersBySpace: Array<{
      space: string;
      label: string;
      total: number;
      active: number;
      suspended: number;
      sessions: number;
    }>;
    recentUsers: Array<{
      userId: string;
      space: string;
      name: string;
      email: string;
      role: string;
      status: string;
      ownedRecordsCount: number;
    }>;
    recentAuditLogs: Array<{
      id: string;
      action: string;
      actorName: string;
      details: string;
      severity: string;
      timestamp: string;
    }>;
  };
}

const ACCOUNTING_DEADLINES = [
  {
    id: 'dl-1',
    title: 'Déclaration TVA mensuelle (DGID)',
    dueDate: '2026-12-15',
    obligation: 'Journal VE & AC — Exercice 2026',
    priority: 'URGENT' as const,
  },
  {
    id: 'dl-2',
    title: 'Cotisations sociales IPRES & CSS',
    dueDate: '2026-12-10',
    obligation: 'Paie & charges sociales',
    priority: 'URGENT' as const,
  },
  {
    id: 'dl-3',
    title: 'Pré-clôture SYSCOHADA Exercice 2026',
    dueDate: '2026-12-31',
    obligation: 'Balance générale & inventaire',
    priority: 'A_VENIR' as const,
  },
];

function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`;
}

function formatShortFcfa(amount: number): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1).replace('.0', '')}M`;
  }
  if (amount >= 1000) {
    return `${Math.round(amount / 1000)}k`;
  }
  return String(Math.round(amount));
}

interface KpiCardProps {
  onClick: () => void;
  icon: React.ReactNode;
  iconBgClass: string;
  trailingIcon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  hintClass?: string;
}

const DashboardKpiCard: React.FC<KpiCardProps> = ({
  onClick,
  icon,
  iconBgClass,
  trailingIcon,
  label,
  value,
  hint,
  hintClass = 'text-gray-500 dark:text-gray-400',
}) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left p-4 sm:p-6 min-h-[76px] rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs hover:shadow-md active:scale-[0.99] touch-manipulation transition-all flex items-center justify-between gap-3 sm:block"
  >
    <div className="hidden sm:flex items-center justify-between mb-4">
      <div className={`p-2 rounded-lg ${iconBgClass}`}>{icon}</div>
      {trailingIcon ?? <TrendingUp className="h-4 w-4 text-green-500" />}
    </div>

    <div className="flex items-center gap-3 min-w-0 sm:block">
      <div className={`p-2.5 rounded-xl shrink-0 sm:hidden ${iconBgClass}`}>{icon}</div>
      <div className="min-w-0">
        <h3 className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate sm:mb-1">
          {label}
        </h3>
        <p className="hidden sm:block text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 truncate">
          {value}
        </p>
        {hint && (
          <p className={`text-[11px] sm:text-xs mt-0.5 sm:mt-1 truncate ${hintClass}`}>{hint}</p>
        )}
      </div>
    </div>

    <div className="sm:hidden text-right shrink-0">
      <p className="text-base font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  </button>
);

interface CrossModuleMetrics {
  hrRemainingDays: number;
  hrPendingApprovals: number;
  workflowInboxCount: number;
  workflowMyCount: number;
  gedDocsCount: number;
  gedAckPending: number;
  commsUnreadMemos: number;
  commsOpenPolls: number;
  opsPendingMail: number;
  opsActiveVisitors: number;
  tasksOpenCount: number;
  notificationsUnread: number;
  tenantsCount: number;
  tenantsMrrFcfa: number;
  missionsOpenCount: number;
  missionsPendingVisa: number;
  reportsTotalCount: number;
  reportsSubmittedCount: number;
}

interface HubWidgetDef {
  id: DashboardTargetSection;
  title: string;
  metric: string;
  icon: React.ReactNode;
  iconBg: string;
}

const SynchronizedModulesHub: React.FC<{
  session: AuthSessionSummary;
  allowedSections: string[];
  metrics: CrossModuleMetrics;
  onNavigate: (section: DashboardTargetSection) => void;
}> = ({ session, allowedSections, metrics, onNavigate }) => {
  const storageKey = `tpd_dash_hidden_widgets_${session.userId}`;
  const [customizing, setCustomizing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  function toggleHidden(id: string) {
    setHiddenIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const catalog: HubWidgetDef[] = [
    {
      id: 'hr',
      title: 'RH, Congés & Pointage',
      metric: `${metrics.hrRemainingDays}j solde${metrics.hrPendingApprovals > 0 ? ` · ${metrics.hrPendingApprovals} à valider` : ''}`,
      icon: <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      id: 'workflows',
      title: 'Demandes & Validations',
      metric:
        metrics.workflowInboxCount > 0
          ? `${metrics.workflowInboxCount} à traiter · ${metrics.workflowMyCount} suivie(s)`
          : `${metrics.workflowMyCount} demande(s) suivie(s)`,
      icon: <GitBranch className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
    },
    {
      id: 'ged',
      title: 'GED & Documents',
      metric: `${metrics.gedDocsCount} doc(s)${metrics.gedAckPending > 0 ? ` · ${metrics.gedAckPending} à lire` : ''}`,
      icon: <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
    },
    {
      id: 'comms',
      title: 'Notes, Sondages & Annuaire',
      metric: `${metrics.commsUnreadMemos} note(s) non lue(s) · ${metrics.commsOpenPolls} sondage(s)`,
      icon: <Megaphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    },
    {
      id: 'operations',
      title: 'Courrier, Visiteurs & Ressources',
      metric: `${metrics.opsPendingMail} courrier(s) · ${metrics.opsActiveVisitors} visiteur(s)`,
      icon: <Inbox className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />,
      iconBg: 'bg-cyan-50 dark:bg-cyan-950/40',
    },
    {
      id: 'missions',
      title: 'Ordres de Mission & Frais',
      metric:
        metrics.missionsPendingVisa > 0
          ? `${metrics.missionsPendingVisa} à viser · ${metrics.missionsOpenCount} total`
          : `${metrics.missionsOpenCount} ordre(s) suivi(s)`,
      icon: <Plane className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      id: 'reports',
      title: 'Rapports Mission & Travail',
      metric:
        metrics.reportsSubmittedCount > 0
          ? `${metrics.reportsSubmittedCount} à viser · ${metrics.reportsTotalCount} total`
          : `${metrics.reportsTotalCount} rapport(s)`,
      icon: <FileCheck2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
      iconBg: 'bg-teal-50 dark:bg-teal-950/40',
    },
    {
      id: 'tasks',
      title: 'Tâches & Kanban',
      metric: `${metrics.tasksOpenCount} tâche(s) active(s)`,
      icon: <CheckSquare className="w-4 h-4 text-violet-600 dark:text-violet-400" />,
      iconBg: 'bg-violet-50 dark:bg-violet-950/40',
    },
    {
      id: 'planning',
      title: 'Planning Unifié',
      metric: 'Planning',
      icon: <CalendarClock className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40',
    },
    {
      id: 'org_admin',
      title: 'Admin Org & Marque Blanche',
      metric: 'Direction',
      icon: <Settings2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
      iconBg: 'bg-rose-50 dark:bg-rose-950/40',
    },
    {
      id: 'tenants',
      title: 'Multi-Tenants & Facturation FCFA',
      metric: `${metrics.tenantsCount} tenant(s) · ${formatShortFcfa(metrics.tenantsMrrFcfa)} FCFA MRR`,
      icon: <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    },
    {
      id: 'notifications',
      title: 'Centre de Notifications',
      metric:
        metrics.notificationsUnread > 0
          ? `${metrics.notificationsUnread} alerte(s) non lue(s)`
          : 'À jour',
      icon: <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40',
    },
  ];

  const available = catalog.filter((w) => allowedSections.includes(w.id));
  if (available.length === 0) return null;

  const visibleWidgets = customizing
    ? available
    : available.filter((w) => !hiddenIds.includes(w.id));

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Modules transversaux &amp; Services ({session.role})
        </h3>
        <button
          type="button"
          onClick={() => setCustomizing((v) => !v)}
          className="self-start sm:self-auto min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {customizing ? 'Terminer personnalisation' : 'Personnaliser widgets'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {visibleWidgets.map((w) => {
          const isHidden = hiddenIds.includes(w.id);
          return (
            <div
              key={w.id}
              className={`rounded-xl border p-3.5 transition ${
                isHidden
                  ? 'border-dashed border-gray-300 dark:border-gray-700 opacity-60 bg-gray-50 dark:bg-gray-950'
                  : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-800 bg-gray-50/40 dark:bg-gray-950/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate(w.id)}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${w.iconBg}`}>{w.icon}</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {w.title}
                  </div>
                </button>
                {customizing ? (
                  <button
                    type="button"
                    onClick={() => toggleHidden(w.id)}
                    aria-label={isHidden ? 'Afficher' : 'Masquer'}
                    className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 shrink-0"
                  >
                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigate(w.id)}
                    aria-label={`Ouvrir ${w.title}`}
                    className="p-1 text-gray-400 hover:text-blue-600 shrink-0"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate(w.id)}
                className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 w-full text-left text-xs font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-300"
              >
                {w.metric}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const Dashboard: React.FC<Props> = ({
  session,
  organization,
  allowedSections = [
    'hr',
    'workflows',
    'ged',
    'comms',
    'operations',
    'tasks',
    'planning',
    'notifications',
  ],
  onNavigate,
}) => {
  const [data, setData] = useState<PlatformDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [crossMetrics, setCrossMetrics] = useState<CrossModuleMetrics>({
    hrRemainingDays: 0,
    hrPendingApprovals: 0,
    workflowInboxCount: 0,
    workflowMyCount: 0,
    gedDocsCount: 0,
    gedAckPending: 0,
    commsUnreadMemos: 0,
    commsOpenPolls: 0,
    opsPendingMail: 0,
    opsActiveVisitors: 0,
    tasksOpenCount: 0,
    notificationsUnread: 0,
    tenantsCount: 0,
    tenantsMrrFcfa: 0,
    missionsOpenCount: 0,
    missionsPendingVisa: 0,
    reportsTotalCount: 0,
    reportsSubmittedCount: 0,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    const headers = buildAuthHeaders(session.space, false);

    fetch('/api/platform/dashboard', { headers, credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload: PlatformDashboardPayload | null) => {
        if (active && payload) {
          setData(payload);
        }
      })
      .catch(() => {
        // handled cleanly below
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Fetch live summaries from Cahier des Charges modules in parallel
    Promise.allSettled([
      fetch('/api/hr/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/workflows/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/ged/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/comms/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/operations/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/notifications/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/tasks', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      session.space === 'superadmin'
        ? fetch('/api/superadmin/tenants/overview', { headers, credentials: 'include' }).then((r) =>
            r.ok ? r.json() : null,
          )
        : Promise.resolve(null),
      fetch('/api/missions/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/reports/overview', { headers, credentials: 'include' }).then((r) => (r.ok ? r.json() : null)),
    ]).then((results) => {
      if (!active) return;
      const val = (idx: number) =>
        results[idx]?.status === 'fulfilled' ? (results[idx] as PromiseFulfilledResult<any>).value : null;

      const hr = val(0);
      const wf = val(1);
      const ged = val(2);
      const comms = val(3);
      const ops = val(4);
      const notifs = val(5);
      const tsk = val(6);
      const ten = val(7);
      const mis = val(8);
      const rpt = val(9);

      const unreadMemos = Array.isArray(comms?.memos)
        ? comms.memos.filter(
            (m: { requireAck: boolean; acknowledgedByUserIds?: string[] }) =>
              m.requireAck && !(m.acknowledgedByUserIds || []).includes(session.userId),
          ).length
        : 0;
      const gedAck = Array.isArray(ged?.documents)
        ? ged.documents.filter(
            (d: { requireAck: boolean; acknowledgedByUserIds?: string[] }) =>
              d.requireAck && !(d.acknowledgedByUserIds || []).includes(session.userId),
          ).length
        : 0;
      const openTasks = Array.isArray(tsk?.tasks)
        ? tsk.tasks.filter((t: { status: string }) => t.status !== 'DONE').length
        : 0;

      setCrossMetrics({
        hrRemainingDays: hr?.myBalance?.remainingDays ?? 0,
        hrPendingApprovals: Array.isArray(hr?.teamPendingLeaves) ? hr.teamPendingLeaves.length : 0,
        workflowInboxCount: Array.isArray(wf?.pendingForMe) ? wf.pendingForMe.length : 0,
        workflowMyCount: Array.isArray(wf?.myRequests) ? wf.myRequests.length : 0,
        gedDocsCount: Array.isArray(ged?.documents) ? ged.documents.length : 0,
        gedAckPending: gedAck,
        commsUnreadMemos: unreadMemos,
        commsOpenPolls: Array.isArray(comms?.polls) ? comms.polls.length : 0,
        opsPendingMail: Array.isArray(ops?.mail)
          ? ops.mail.filter((m: { status: string }) => m.status !== 'TRAITE' && m.status !== 'ARCHIVE').length
          : 0,
        opsActiveVisitors: Array.isArray(ops?.visitors)
          ? ops.visitors.filter((v: { status: string }) => v.status === 'EN_COURS').length
          : 0,
        tasksOpenCount: openTasks,
        notificationsUnread: notifs?.unreadCount ?? 0,
        tenantsCount: ten?.kpis?.totalTenants ?? 0,
        tenantsMrrFcfa: ten?.kpis?.mrrFcfa ?? 0,
        missionsOpenCount: mis?.stats?.total ?? 0,
        missionsPendingVisa: mis?.stats?.inApproval ?? 0,
        reportsTotalCount: rpt?.stats?.total ?? 0,
        reportsSubmittedCount: rpt?.stats?.submitted ?? 0,
      });
    });

    return () => {
      active = false;
    };
  }, [session.space, session.userId]);

  const crmStats = data?.crmStats;
  const conversionDonutData = useMemo(() => {
    if (!crmStats) return [];
    return [
      { name: 'Convertis (Gagné)', value: Math.max(0, crmStats.convertedLeads), fill: '#10b981' },
      {
        name: 'Pipeline actif',
        value: Math.max(0, crmStats.totalLeads - crmStats.convertedLeads),
        fill: '#e2e8f0',
      },
    ];
  }, [crmStats]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Chargement de votre tableau de bord personnel ({session.name})...
      </div>
    );
  }

  // =========================================================================
  // 1. TABLEAU PERSONNEL APPRENANT B2B
  // =========================================================================
  if (session.space === 'learner' && data?.learnerSummary) {
    const ls = data.learnerSummary;
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('learner')}
            icon={<BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Mes formations inscrites"
            value={ls.coursesCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('learner')}
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
            label="Progression globale"
            value={`${ls.overallProgress}%`}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('learner')}
            icon={<Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            iconBgClass="bg-amber-50 dark:bg-amber-900/20"
            label="Certificats obtenus"
            value={ls.certificatesCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('learner')}
            icon={<GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            trailingIcon={<ArrowUpRight className="h-4 w-4 text-purple-500" />}
            label="Nouvelles formations"
            value={ls.availableCatalogCount}
          />
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
              Avancement de mes parcours B2B
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('learner')}
              className="self-start sm:self-auto min-h-[40px] inline-flex items-center text-xs sm:text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
            >
              Ouvrir Espace Apprenant →
            </button>
          </div>
          {ls.coursesChart.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucune formation suivie.
            </div>
          ) : (
            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ls.coursesChart} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="title"
                    tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v ?? 0}%`, 'Progression']} />
                  <Bar dataKey="progress" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 2. TABLEAU PERSONNEL FORMATEUR PRO
  // =========================================================================
  if (session.space === 'instructor' && data?.instructorSummary) {
    const is = data.instructorSummary;
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('instructor')}
            icon={<Presentation className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
            iconBgClass="bg-orange-50 dark:bg-orange-900/20"
            label="Mes cours créés"
            value={is.totalCourses}
            hint={`${is.publishedCourses} publié(s)`}
            hintClass="text-orange-600 dark:text-orange-400"
          />
          <DashboardKpiCard
            onClick={() => onNavigate('instructor')}
            icon={<GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Apprenants suivis"
            value={is.enrollmentsCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('instructor')}
            icon={<Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
            label="Apprenants certifiés"
            value={is.certifiedCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('instructor')}
            icon={<Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            label="Complétion moyenne"
            value={`${is.avgCompletion}%`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Inscriptions par formation ({session.name})
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('instructor')}
                className="self-start sm:self-auto min-h-[36px] inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Gérer mes cours →
              </button>
            </div>
            {is.coursesChart.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucun cours créé.
              </div>
            ) : (
              <div className="h-52 sm:h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={is.coursesChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="title"
                      tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                      tick={{ fontSize: 10, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v ?? 0} apprenant(s)`, 'Inscrits']} />
                    <Bar dataKey="enrolled" fill="#ea580c" radius={[6, 6, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Suivi récent de vos apprenants
            </h3>
            {is.recentEnrollments.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Aucun apprenant inscrit pour l’instant.</p>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {is.recentEnrollments.map((enr) => (
                  <div
                    key={enr.id}
                    className="p-3.5 min-h-[56px] rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {enr.learnerName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{enr.courseTitle}</div>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                      {enr.progressPct}% · {enr.attendanceStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 3. TABLEAU PERSONNEL PRESTATAIRE ÉVÉNEMENTIEL
  // =========================================================================
  if (session.space === 'provider' && data?.providerSummary) {
    const ps = data.providerSummary;
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('provider')}
            icon={<Package className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            iconBgClass="bg-amber-50 dark:bg-amber-900/20"
            label="Mes prestations"
            value={ps.offersCount}
            hint={`${ps.publishedOffers} publiée(s)`}
            hintClass="text-amber-600 dark:text-amber-400"
          />
          <DashboardKpiCard
            onClick={() => onNavigate('provider')}
            icon={<ClipboardList className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Demandes clients"
            value={ps.requestsCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('provider')}
            icon={<Briefcase className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            label="Pipeline prestations"
            value={formatFcfa(ps.pipelineFcfa)}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('provider')}
            icon={<DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
            label="Revenus encaissés"
            value={formatFcfa(ps.paidFcfa)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Volume par étape — {session.organizationName}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('provider')}
                className="self-start sm:self-auto min-h-[36px] inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Ouvrir mon espace →
              </button>
            </div>
            <div className="h-52 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ps.stageChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => formatShortFcfa(v)}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v) => [formatFcfa(Number(v ?? 0)), 'Montant']} />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Dernières demandes reçues
            </h3>
            {ps.recentRequests.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">Aucune demande reçue pour le moment.</p>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {ps.recentRequests.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => onNavigate('provider')}
                    className="w-full text-left p-3.5 min-h-[56px] rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all flex items-center justify-between gap-3 touch-manipulation"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {req.clientCompany}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {req.offerTitle} · {req.eventDate}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono tabular-nums text-xs font-bold text-gray-900 dark:text-gray-100">
                        {formatFcfa(req.amountFcfa)}
                      </div>
                      <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{req.stage}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 3B. TABLEAU EXÉCUTIF SUPERADMIN
  // =========================================================================
  if (session.space === 'superadmin' && data?.superadminSummary) {
    const ss = data.superadminSummary;
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('superadmin')}
            icon={<Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Utilisateurs plateforme"
            value={ss.kpis.totalUsers}
            hint={`${ss.kpis.activeUsers} actif(s) · ${ss.kpis.suspendedUsers} suspendu(s)`}
            hintClass="text-blue-600 dark:text-blue-400"
          />
          <DashboardKpiCard
            onClick={() => onNavigate('superadmin')}
            icon={<Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
            label="Sessions actives"
            value={ss.kpis.activeSessionsTotal}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('superadmin')}
            icon={<ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            iconBgClass="bg-amber-50 dark:bg-amber-900/20"
            label="Organisations isolées"
            value={ss.kpis.organizationsCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('superadmin')}
            icon={<Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            trailingIcon={<ArrowUpRight className="h-4 w-4 text-purple-500" />}
            label="Objets métiers suivis"
            value={ss.kpis.totalTrackedRecords}
          />
        </div>

        {ss.commissionKpis && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/60 dark:from-blue-950/30 dark:via-gray-900 dark:to-emerald-950/20 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <BadgePercent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
                  Commissions Plateforme (Formateurs Pro & Prestataires)
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Total généré :{' '}
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                    {formatFcfa(ss.commissionKpis.totalCommissionFcfa)}
                  </span>{' '}
                  · À valider / prélever :{' '}
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">
                    {formatFcfa(ss.commissionKpis.pendingValidationFcfa)} ({ss.commissionKpis.pendingCount} dossiers)
                  </span>{' '}
                  · {ss.commissionKpis.activeRulesCount} barème(s) actif(s)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('commissions')}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition"
            >
              Gérer les commissions & barèmes
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Comptes & sessions par espace
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('superadmin')}
                className="self-start sm:self-auto min-h-[36px] inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Gérer les utilisateurs →
              </button>
            </div>
            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ss.usersBySpace} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="total" name="Comptes" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="sessions" name="Sessions actives" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Journal de sécurité récent
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('superadmin')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Tout voir
              </button>
            </div>
            <div className="space-y-2.5">
              {ss.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      {log.action}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {log.actorName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 4. TABLEAU PERSONNEL COMPTABILITÉ SYSCOHADA
  // =========================================================================
  if (session.space === 'accounting' && data?.accountingSummary) {
    const as = data.accountingSummary;
    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('accounting')}
            icon={<Calculator className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Écritures SYSCOHADA"
            value={as.entriesCount}
            hint={`${as.journalsCount} journaux`}
            hintClass="text-blue-600 dark:text-blue-400"
          />
          <DashboardKpiCard
            onClick={() => onNavigate('accounting')}
            icon={<DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            iconBgClass="bg-emerald-50 dark:bg-emerald-900/20"
            label="Volume équilibré"
            value={formatFcfa(as.totalVolume)}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('crm')}
            icon={<FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            label="Factures CRM synchronisées"
            value={as.syncedInvoicesCount}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('accounting')}
            icon={<CalendarClock className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
            iconBgClass="bg-orange-50 dark:bg-orange-900/20"
            label="Plan comptable"
            value={as.accountsCount}
            hint={session.role}
            hintClass="text-orange-600 dark:text-orange-400"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <div className="lg:col-span-7 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Répartition des mouvements par journal SYSCOHADA
            </h3>
            <div className="h-52 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={as.byJournal} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => formatShortFcfa(v)}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(v) => [formatFcfa(Number(v ?? 0)), 'Volume']} />
                  <Bar dataKey="amount" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-2.5 sm:space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Dernières écritures comptables
            </h3>
            {as.recentEntries.map((ent) => (
              <button
                key={ent.id}
                type="button"
                onClick={() => onNavigate('accounting')}
                className="w-full text-left p-3.5 min-h-[56px] rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all flex items-center justify-between gap-3 touch-manipulation"
              >
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {ent.entryNumber} · {ent.journalCode}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {ent.description}
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-gray-400 shrink-0">{ent.entryDate}</span>
              </button>
            ))}
          </div>
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 5. TABLEAU PERSONNEL EMPLOYÉ (INTRANET + ÉVÉNEMENTS + FORMATIONS — SANS CRM NI COMPTA)
  // =========================================================================
  if (session.space === 'intranet' && session.role === 'EMPLOYEE') {
    const events = data?.events || [];
    const trainings = data?.trainings || [];
    const messages = data?.recentMessages || [];

    return (
      <div className="space-y-5 sm:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
          <DashboardKpiCard
            onClick={() => onNavigate('intranet')}
            icon={<MessageSquareLock className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            iconBgClass="bg-blue-50 dark:bg-blue-900/20"
            label="Mes canaux Intranet"
            value={data?.intranetChannelsCount ?? 1}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('events')}
            icon={<CalendarDays className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
            iconBgClass="bg-orange-50 dark:bg-orange-900/20"
            label="Mes missions événementielles"
            value={events.length}
          />
          <DashboardKpiCard
            onClick={() => onNavigate('training')}
            icon={<GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
            iconBgClass="bg-purple-50 dark:bg-purple-900/20"
            label="Formations ouvertes"
            value={trainings.length}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Événements assignés à {session.name}
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('events')}
                className="min-h-[36px] inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Voir l’événementiel
              </button>
            </div>
            {events.map((ev) => (
              <div key={ev.id} className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {ev.title}
                  </span>
                  <span className="font-mono tabular-nums text-xs text-blue-600 dark:text-blue-400 shrink-0">
                    {ev.date}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{ev.venue}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs space-y-3 sm:space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Derniers échanges Intranet
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('intranet')}
                className="min-h-[36px] inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Ouvrir le chat
              </button>
            </div>
            {messages.map((m) => (
              <div key={m.id} className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 text-xs space-y-1">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{m.senderName}</div>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{m.content}</p>
              </div>
            ))}
          </div>
        </div>

        <SynchronizedModulesHub
          session={session}
          allowedSections={allowedSections}
          metrics={crossMetrics}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  // =========================================================================
  // 6. TABLEAU PERSONNEL DIRECTION (OWNER) & MANAGER (AVEC STATISTIQUES CRM RECHARTS)
  // =========================================================================
  const events = data?.events || [];
  const trainings = data?.trainings || [];
  const safeCrm: CrmStatsPayload = crmStats || {
    recentCount: 0,
    latestNumber: '—',
    totalTtc: 0,
    totalPaid: 0,
    remainingBalance: 0,
    pipelineData: [],
    totalLeads: 0,
    convertedLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0,
    qualificationRate: 0,
    pendingQuotesCount: 0,
    pendingQuotesTotal: 0,
    pendingQuotesByStatus: [],
  };

  const totalEnrolled = trainings.reduce((sum, t) => sum + t.seatsTaken, 0);
  const totalSeats = trainings.reduce((sum, t) => sum + t.maxSeats, 0);
  const recoveryPct = safeCrm.totalTtc > 0 ? Math.round((safeCrm.totalPaid / safeCrm.totalTtc) * 100) : 0;
  const trainingFillPct = totalSeats > 0 ? Math.round((totalEnrolled / totalSeats) * 100) : 0;
  const urgentDeadlines = ACCOUNTING_DEADLINES.filter((d) => d.priority === 'URGENT').length;

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* 4 KPI Cards (Vertical Tactile List on Mobile, Grid on Tablet/Desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <DashboardKpiCard
          onClick={() => onNavigate('crm')}
          icon={<DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          iconBgClass="bg-blue-50 dark:bg-blue-900/20"
          label="Mon Chiffre CRM TTC"
          value={formatFcfa(safeCrm.totalTtc)}
          hint={`${safeCrm.recentCount} document(s) · Dernier : ${safeCrm.latestNumber}`}
          hintClass="text-green-600 dark:text-green-400"
        />

        {session.role === 'OWNER' ? (
          <DashboardKpiCard
            onClick={() => onNavigate('accounting')}
            icon={<Calculator className="h-5 w-5 text-green-600 dark:text-green-400" />}
            iconBgClass="bg-green-50 dark:bg-green-900/20"
            label="Écritures SYSCOHADA"
            value={data?.accountingEntriesCount ?? 0}
            hint={`${urgentDeadlines} échéance(s)`}
            hintClass="text-green-600 dark:text-green-400"
          />
        ) : (
          <DashboardKpiCard
            onClick={() => onNavigate('events')}
            icon={<Briefcase className="h-5 w-5 text-green-600 dark:text-green-400" />}
            iconBgClass="bg-green-50 dark:bg-green-900/20"
            label="Demandes prestataires"
            value={data?.providerRequestsCount ?? 0}
          />
        )}

        <DashboardKpiCard
          onClick={() => onNavigate('training')}
          icon={<GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
          iconBgClass="bg-purple-50 dark:bg-purple-900/20"
          label="Formations synchronisées"
          value={trainings.length}
          hint={`${totalEnrolled}/${totalSeats} inscrit(s)`}
          hintClass="text-green-600 dark:text-green-400"
        />

        <DashboardKpiCard
          onClick={() => onNavigate('events')}
          icon={<Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          iconBgClass="bg-orange-50 dark:bg-orange-900/20"
          label="Mes événements actifs"
          value={events.length}
          hint={events[0] ? events[0].date : undefined}
          hintClass="text-green-600 dark:text-green-400"
        />
      </div>

      {/* Statistiques CRM (Recharts) — vertical stack on mobile */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Statistiques CRM — {session.name} ({organization.name})
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('crm')}
            className="self-start sm:self-auto min-h-[40px] inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
          >
            Ouvrir mon CRM &amp; campagnes
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Chart 1: Pipeline commercial */}
          <div className="lg:col-span-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pipeline commercial</h4>
              <span className="text-xs font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                {safeCrm.totalLeads} fiche(s)
              </span>
            </div>

            <div className="h-52 sm:h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={safeCrm.pipelineData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value) => [`${value ?? 0} contact(s)`, 'Volume']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={38}>
                    {safeCrm.pipelineData.map((entry) => (
                      <Cell key={entry.stage} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Taux de conversion des leads */}
          <div className="lg:col-span-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Taux de conversion</h4>

            <div className="relative h-44 w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionDonutData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {conversionDonutData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value) => [`${value ?? 0} fiche(s)`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {safeCrm.conversionRate}%
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">convertis</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block">Gagnés</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {safeCrm.convertedLeads}/{safeCrm.totalLeads}
                </span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 dark:text-gray-400 block">Qualification</span>
                <span className="font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                  {safeCrm.qualificationRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Chart 3: Volume de devis en attente */}
          <div className="lg:col-span-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 shadow-xs">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Devis en attente</h4>
                <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {safeCrm.pendingQuotesCount} devis
                </span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {formatFcfa(safeCrm.pendingQuotesTotal)}
                </div>
                <div className="text-[11px] text-gray-400 dark:text-gray-500">Volume TTC</div>
              </div>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={safeCrm.pendingQuotesByStatus}
                  margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v: number) => formatShortFcfa(v)}
                    tick={{ fontSize: 10, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(245, 158, 11, 0.08)' }}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    formatter={(value) => [formatFcfa(Number(value ?? 0)), 'Montant TTC']}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {safeCrm.pendingQuotesByStatus.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Content Grid — Vertical Flow on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {session.role === 'OWNER' ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Prochaines échéances comptables — Direction</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('accounting')}
                  className="min-h-[36px] inline-flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium touch-manipulation"
                >
                  Voir comptabilité
                </button>
              </div>
              <div className="space-y-2.5 sm:space-y-4">
                {ACCOUNTING_DEADLINES.map((dl) => (
                  <button
                    key={dl.id}
                    type="button"
                    onClick={() => onNavigate('accounting')}
                    className="w-full text-left flex items-center gap-3 sm:gap-4 p-3 min-h-[56px] rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation"
                  >
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        dl.priority === 'URGENT'
                          ? 'bg-orange-50 dark:bg-orange-900/20'
                          : 'bg-blue-50 dark:bg-blue-900/20'
                      }`}
                    >
                      <Activity
                        className={`h-4 w-4 ${
                          dl.priority === 'URGENT'
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{dl.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dl.obligation}</p>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                      {dl.dueDate}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Mes événements assignés — {session.name}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onNavigate('events')}
                  className="min-h-[36px] inline-flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium touch-manipulation"
                >
                  Ouvrir Événementiel
                </button>
              </div>
              <div className="space-y-2.5 sm:space-y-4">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => onNavigate('events')}
                    className="w-full text-left flex items-center justify-between gap-3 p-3 min-h-[56px] rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{ev.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {ev.client} · {ev.venue}
                      </p>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                      {ev.date}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Activité personnelle récente
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('crm')}
                className="min-h-[36px] inline-flex items-center text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium touch-manipulation"
              >
                Tout voir
              </button>
            </div>
            <div className="space-y-2.5 sm:space-y-4">
              <button
                type="button"
                onClick={() => onNavigate('crm')}
                className="w-full text-left flex items-center gap-3 sm:gap-4 p-3 min-h-[56px] rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation"
              >
                <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 shrink-0">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    Dernier document CRM : {safeCrm.latestNumber}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    Reste à recouvrer : {formatFcfa(safeCrm.remainingBalance)}
                  </p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">En direct</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('intranet')}
                className="w-full text-left flex items-center gap-3 sm:gap-4 p-3 min-h-[56px] rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.99] transition-all touch-manipulation"
              >
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 shrink-0">
                  <MessageSquareLock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {data?.intranetChannelsCount ?? 1} espace(s) Teams · Canaux &amp; visio synchronisés
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {session.name} · {session.role}
                  </p>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500 shrink-0">Sécurisé</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right / Bottom Column */}
        <div className="space-y-4 sm:space-y-6">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Statistiques rapides
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Mon recouvrement CRM</span>
                <span className="text-sm font-medium font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {recoveryPct}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${recoveryPct}%` }} />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Remplissage formations</span>
                <span className="text-sm font-medium font-mono tabular-nums text-gray-900 dark:text-gray-100">
                  {trainingFillPct}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${trainingFillPct}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Catalogue Formation Pro
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('training')}
                className="min-h-[36px] inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline touch-manipulation"
              >
                Catalogue
              </button>
            </div>
            <div className="space-y-2">
              {trainings.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => onNavigate('training')}
                  className="w-full text-left flex items-center justify-between py-2.5 min-h-[52px] border-b last:border-b-0 border-gray-100 dark:border-gray-800 active:opacity-80 touch-manipulation"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{tr.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {tr.date} · {tr.instructor}
                    </div>
                  </div>
                  <span className="text-sm font-semibold font-mono tabular-nums text-gray-900 dark:text-gray-100 shrink-0">
                    {tr.seatsTaken}/{tr.maxSeats}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SynchronizedModulesHub
        session={session}
        allowedSections={allowedSections}
        metrics={crossMetrics}
        onNavigate={onNavigate}
      />
    </div>
  );
};
