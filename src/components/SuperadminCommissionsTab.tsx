import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BadgePercent,
  Ban,
  BarChart3,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Eye,
  FileDown,
  Plus,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildAuthHeaders } from '../lib/authHeaders';
import { exportMonthlyCommissionsPdf } from '../lib/commissionPdfExport';
import { CompanyLogo, ProfileAvatar } from './ui/MediaAvatar';
import type {
  CommissionBeneficiaryType,
  CommissionOverviewPayload,
  CommissionPayoutMethod,
  CommissionRecord,
  CommissionRule,
  CommissionRuleScope,
  CommissionStatus,
} from '../types';

interface Props {
  onNotify: (message: string) => void;
  onError: (message: string) => void;
  onSyncAuditLogs?: () => void;
}

type CommissionsSubTab = 'records' | 'rules' | 'partners';
type MonthlyChartRange = '6m' | '12m' | 'active';
type MonthlyChartMode = 'area' | 'bar';

interface MonthlyCommissionPoint {
  monthKey: string;
  monthLabel: string;
  fullMonthLabel: string;
  instructorCommissionFcfa: number;
  providerCommissionFcfa: number;
  totalCommissionFcfa: number;
  grossVolumeFcfa: number;
  operationsCount: number;
}

interface MonthlyTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: MonthlyCommissionPoint }>;
}

const MonthlyCommissionTooltip: React.FC<MonthlyTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const instShare =
    point.totalCommissionFcfa > 0
      ? Math.round((point.instructorCommissionFcfa / point.totalCommissionFcfa) * 100)
      : 0;
  const provShare =
    point.totalCommissionFcfa > 0
      ? Math.round((point.providerCommissionFcfa / point.totalCommissionFcfa) * 100)
      : 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[230px]">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-1.5">
        <span className="font-bold text-gray-900 dark:text-gray-100 capitalize">
          {point.fullMonthLabel}
        </span>
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {point.operationsCount} op.
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          Total commissions
        </span>
        <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
          {formatFcfa(point.totalCommissionFcfa)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          Formateurs Pro ({instShare}%)
        </span>
        <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
          {formatFcfa(point.instructorCommissionFcfa)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Prestataires ({provShare}%)
        </span>
        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          {formatFcfa(point.providerCommissionFcfa)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
        <span>Volume brut encaissé</span>
        <span className="font-mono">{formatFcfa(point.grossVolumeFcfa)}</span>
      </div>
    </div>
  );
};

const STATUS_META: Record<
  CommissionStatus,
  { label: string; badgeClass: string }
> = {
  EN_ATTENTE: {
    label: 'En attente',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  VALIDEE: {
    label: 'Validée',
    badgeClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  PRELEVEE: {
    label: 'Prélevée',
    badgeClass:
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
  },
  REVERSE_PARTENAIRE: {
    label: 'Reversée partenaire',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  ANNULEE: {
    label: 'Annulée',
    badgeClass:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
};

const PAYOUT_METHOD_LABELS: Record<CommissionPayoutMethod, string> = {
  VIREMENT: 'Virement bancaire',
  MOBILE_MONEY: 'Mobile Money (Wave / OM)',
  RETENUE_FACTURE: 'Retenue sur facture',
  CHEQUE: 'Chèque certifié',
};

function formatFcfa(amount: number): string {
  return `${Math.round(amount).toLocaleString('fr-FR')} FCFA`;
}

function formatDateShort(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export const SuperadminCommissionsTab: React.FC<Props> = ({
  onNotify,
  onError,
  onSyncAuditLogs,
}) => {
  const [data, setData] = useState<CommissionOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<CommissionsSubTab>('records');
  const [monthlyRange, setMonthlyRange] = useState<MonthlyChartRange>('6m');
  const [monthlyChartMode, setMonthlyChartMode] = useState<MonthlyChartMode>('area');
  const [selectedPdfMonth, setSelectedPdfMonth] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | CommissionBeneficiaryType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | CommissionStatus>('ALL');
  const [partnerFilter, setPartnerFilter] = useState<string>('ALL');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteCommissionId, setConfirmDeleteCommissionId] = useState<string | null>(null);
  const [confirmDeleteRuleId, setConfirmDeleteRuleId] = useState<string | null>(null);

  // Modals
  const [inspectedCommission, setInspectedCommission] = useState<CommissionRecord | null>(null);
  const [settlementTarget, setSettlementTarget] = useState<{
    record: CommissionRecord;
    targetStatus: 'PRELEVEE' | 'REVERSE_PARTENAIRE';
  } | null>(null);
  const [settlementMethod, setSettlementMethod] = useState<CommissionPayoutMethod>('VIREMENT');
  const [settlementRef, setSettlementRef] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settlementBusy, setSettlementBusy] = useState(false);

  // Create / Edit Commission Modal
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState<CommissionRecord | null>(null);
  const [comBeneficiaryType, setComBeneficiaryType] =
    useState<CommissionBeneficiaryType>('INSTRUCTOR');
  const [comBeneficiaryId, setComBeneficiaryId] = useState('');
  const [comSourceTitle, setComSourceTitle] = useState('');
  const [comClientName, setComClientName] = useState('');
  const [comCategory, setComCategory] = useState('');
  const [comGross, setComGross] = useState('150000');
  const [comRate, setComRate] = useState('15');
  const [comFixedFee, setComFixedFee] = useState('0');
  const [comStatus, setComStatus] = useState<CommissionStatus>('EN_ATTENTE');
  const [comDate, setComDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [comNotes, setComNotes] = useState('');
  const [comSubmitting, setComSubmitting] = useState(false);

  // Create / Edit Rule Modal
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleBeneficiaryType, setRuleBeneficiaryType] =
    useState<CommissionBeneficiaryType>('INSTRUCTOR');
  const [ruleScope, setRuleScope] = useState<CommissionRuleScope>('CATEGORY');
  const [ruleCategory, setRuleCategory] = useState('');
  const [ruleTargetUserId, setRuleTargetUserId] = useState('');
  const [ruleRate, setRuleRate] = useState('15');
  const [ruleFixedFee, setRuleFixedFee] = useState('0');
  const [ruleActive, setRuleActive] = useState(true);
  const [ruleSubmitting, setRuleSubmitting] = useState(false);

  const loadCommissions = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await fetch('/api/superadmin/commissions', {
          headers: buildAuthHeaders('superadmin', false),
          credentials: 'include',
        });
        const payload = await res.json();
        if (!res.ok) {
          onError(payload.error || 'Impossible de charger les commissions.');
          return;
        }
        setData(payload as CommissionOverviewPayload);
      } catch {
        onError('Erreur réseau lors du chargement des commissions.');
      } finally {
        setLoading(false);
      }
    },
    [onError],
  );

  useEffect(() => {
    void loadCommissions(false);
  }, [loadCommissions]);

  const allPartnersForDropdown = useMemo(() => {
    if (!data) return [];
    return [
      ...data.partners.instructors.map((i) => ({
        id: i.id,
        type: 'INSTRUCTOR' as const,
        label: `${i.name} (Formateur Pro)`,
      })),
      ...data.partners.providers.map((p) => ({
        id: p.id,
        type: 'PROVIDER' as const,
        label: `${p.name} — ${p.companyName} (Prestataire)`,
      })),
    ];
  }, [data]);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.records.filter((r) => {
      if (typeFilter !== 'ALL' && r.beneficiaryType !== typeFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (partnerFilter !== 'ALL' && r.beneficiaryId !== partnerFilter) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.beneficiaryName.toLowerCase().includes(q) ||
        r.beneficiaryOrg.toLowerCase().includes(q) ||
        r.sourceTitle.toLowerCase().includes(q) ||
        r.clientOrLearnerName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    });
  }, [data, searchQuery, typeFilter, statusFilter, partnerFilter]);

  function resolveSuggestedRate(
    bType: CommissionBeneficiaryType,
    bId: string,
    cat: string,
  ): { rate: number; fixed: number } {
    if (!data) return { rate: bType === 'INSTRUCTOR' ? 15 : 12, fixed: 0 };
    const active = data.rules.filter((r) => r.isActive && r.beneficiaryType === bType);
    const byUser = active.find((r) => r.scope === 'USER' && r.targetUserId === bId);
    if (byUser) return { rate: byUser.ratePercent, fixed: byUser.fixedFeeFcfa };
    const byCat = active.find(
      (r) => r.scope === 'CATEGORY' && (r.category || '').toLowerCase() === cat.toLowerCase(),
    );
    if (byCat) return { rate: byCat.ratePercent, fixed: byCat.fixedFeeFcfa };
    const byGlobal = active.find((r) => r.scope === 'GLOBAL');
    if (byGlobal) return { rate: byGlobal.ratePercent, fixed: byGlobal.fixedFeeFcfa };
    return { rate: bType === 'INSTRUCTOR' ? 15 : 12, fixed: 0 };
  }

  async function handleSyncFromPlatform() {
    setSyncing(true);
    try {
      const res = await fetch('/api/superadmin/commissions/sync', {
        method: 'POST',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Synchronisation impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      const count = (payload as { createdCount?: number }).createdCount ?? 0;
      onNotify(
        count > 0
          ? `${count} nouvelle(s) commission(s) synchronisée(s) depuis les formateurs et prestataires.`
          : 'Toutes les prestations formateurs et prestataires sont déjà synchronisées.',
      );
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau lors de la synchronisation.');
    } finally {
      setSyncing(false);
    }
  }

  function handleExportCsv() {
    if (filteredRecords.length === 0) {
      onError('Aucune commission à exporter selon les filtres actuels.');
      return;
    }
    const headers = [
      'Reference',
      'Date',
      'Type Partenaire',
      'Partenaire',
      'Organisation',
      'Prestation / Formation',
      'Client / Apprenant',
      'Categorie',
      'Montant Brut (FCFA)',
      'Taux (%)',
      'Frais Fixes (FCFA)',
      'Commission Plateforme (FCFA)',
      'Net Partenaire (FCFA)',
      'Statut',
      'Mode Reglement',
      'Ref Reglement',
    ];
    const rows = filteredRecords.map((r) => [
      r.reference,
      r.transactionDate,
      r.beneficiaryType === 'INSTRUCTOR' ? 'Formateur Pro' : 'Prestataire',
      r.beneficiaryName,
      r.beneficiaryOrg,
      r.sourceTitle,
      r.clientOrLearnerName,
      r.category,
      r.grossAmountFcfa,
      r.appliedRatePercent,
      r.fixedFeeFcfa,
      r.commissionAmountFcfa,
      r.netPartnerAmountFcfa,
      STATUS_META[r.status].label,
      r.payoutMethod ? PAYOUT_METHOD_LABELS[r.payoutMethod] : '',
      r.payoutReference || '',
    ]);
    const escapeCell = (val: string | number) =>
      `"${String(val).replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCell).join(';'), ...rows.map((row) => row.map(escapeCell).join(';'))].join(
        '\n',
      );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-teranga-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onNotify(`Export CSV généré (${filteredRecords.length} ligne(s)).`);
  }

  function handleExportMonthlyPdf(targetMonthKey = selectedPdfMonth) {
    if (!data) return;
    const periodLabel =
      monthlyRange === '12m'
        ? '12 derniers mois'
        : monthlyRange === 'active'
          ? 'Tous les mois avec activité'
          : '6 derniers mois';
    try {
      const { fileName, recordsCount } = exportMonthlyCommissionsPdf({
        records: data.records,
        monthlyRows: activeMonthlyRows,
        selectedMonthKey: targetMonthKey,
        periodLabel,
        generatedBy: 'Superadmin Teranga Prestige',
      });
      onNotify(`Bilan financier PDF téléchargé : ${fileName} (${recordsCount} opération(s)).`);
    } catch {
      onError('Impossible de générer le bilan financier PDF.');
    }
  }

  async function handleQuickStatus(record: CommissionRecord, status: CommissionStatus) {
    setBusyId(record.id);
    try {
      const res = await fetch(`/api/superadmin/commissions/${record.id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Mise à jour impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      onNotify(`${record.reference} passée au statut « ${STATUS_META[status].label} ».`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRecalculate(record: CommissionRecord) {
    setBusyId(record.id);
    try {
      const res = await fetch(`/api/superadmin/commissions/${record.id}/recalculate`, {
        method: 'POST',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Recalcul impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      onNotify(`Commission ${record.reference} recalculée selon le barème actif.`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau lors du recalcul.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCommission(record: CommissionRecord) {
    setBusyId(record.id);
    try {
      const res = await fetch(`/api/superadmin/commissions/${record.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders('superadmin', false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Suppression impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      setConfirmDeleteCommissionId(null);
      setSelectedIds((prev) => prev.filter((id) => id !== record.id));
      onNotify(`Commission ${record.reference} supprimée.`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkStatus(status: CommissionStatus) {
    if (selectedIds.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/superadmin/commissions/bulk-status', {
        method: 'POST',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds, status }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Action groupée impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      const updated = (payload as { updatedCount?: number }).updatedCount ?? selectedIds.length;
      setSelectedIds([]);
      onNotify(`${updated} commission(s) passée(s) à « ${STATUS_META[status].label} ».`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau lors du traitement groupé.');
    } finally {
      setSyncing(false);
    }
  }

  function openCreateCommissionModal() {
    setEditingCommission(null);
    const firstInst = data?.partners.instructors[0]?.id || '';
    const defaultCat = data?.categories[0] || 'Formations & Masterclasses';
    const suggested = resolveSuggestedRate('INSTRUCTOR', firstInst, defaultCat);
    setComBeneficiaryType('INSTRUCTOR');
    setComBeneficiaryId(firstInst);
    setComSourceTitle('');
    setComClientName('');
    setComCategory(defaultCat);
    setComGross('150000');
    setComRate(String(suggested.rate));
    setComFixedFee(String(suggested.fixed));
    setComStatus('EN_ATTENTE');
    setComDate(new Date().toISOString().slice(0, 10));
    setComNotes('');
    setCommissionModalOpen(true);
  }

  function openEditCommissionModal(record: CommissionRecord) {
    setEditingCommission(record);
    setComBeneficiaryType(record.beneficiaryType);
    setComBeneficiaryId(record.beneficiaryId);
    setComSourceTitle(record.sourceTitle);
    setComClientName(record.clientOrLearnerName);
    setComCategory(record.category);
    setComGross(String(record.grossAmountFcfa));
    setComRate(String(record.appliedRatePercent));
    setComFixedFee(String(record.fixedFeeFcfa));
    setComStatus(record.status);
    setComDate(record.transactionDate);
    setComNotes(record.notes || '');
    setCommissionModalOpen(true);
  }

  async function handleCommissionSubmit(e: React.FormEvent) {
    e.preventDefault();
    setComSubmitting(true);
    try {
      const url = editingCommission
        ? `/api/superadmin/commissions/${editingCommission.id}`
        : '/api/superadmin/commissions';
      const method = editingCommission ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({
          beneficiaryType: comBeneficiaryType,
          beneficiaryId: comBeneficiaryId,
          sourceTitle: comSourceTitle,
          clientOrLearnerName: comClientName,
          category: comCategory,
          grossAmountFcfa: Number(comGross),
          appliedRatePercent: Number(comRate),
          fixedFeeFcfa: Number(comFixedFee),
          status: comStatus,
          transactionDate: comDate,
          notes: comNotes,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Enregistrement impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      setCommissionModalOpen(false);
      onNotify(
        editingCommission
          ? `Commission ${editingCommission.reference} mise à jour.`
          : 'Nouvelle commission enregistrée.',
      );
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setComSubmitting(false);
    }
  }

  function openSettlementModal(
    record: CommissionRecord,
    targetStatus: 'PRELEVEE' | 'REVERSE_PARTENAIRE',
  ) {
    setSettlementTarget({ record, targetStatus });
    setSettlementMethod(record.payoutMethod || 'VIREMENT');
    setSettlementRef(
      record.payoutReference ||
        `${targetStatus === 'PRELEVEE' ? 'RET' : 'VIR'}-COM-2026-${String(
          Math.floor(100 + Math.random() * 900),
        )}`,
    );
    setSettlementNotes(record.notes || '');
  }

  async function handleSettlementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settlementTarget) return;
    setSettlementBusy(true);
    try {
      const res = await fetch(`/api/superadmin/commissions/${settlementTarget.record.id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({
          status: settlementTarget.targetStatus,
          payoutMethod: settlementMethod,
          payoutReference: settlementRef,
          notes: settlementNotes,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Validation du règlement impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      onNotify(
        `${settlementTarget.record.reference} : ${STATUS_META[settlementTarget.targetStatus].label} (${settlementRef}).`,
      );
      setSettlementTarget(null);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setSettlementBusy(false);
    }
  }

  function openCreateRuleModal(preset?: {
    beneficiaryType: CommissionBeneficiaryType;
    scope: CommissionRuleScope;
    targetUserId?: string;
    name?: string;
  }) {
    setEditingRule(null);
    const bType = preset?.beneficiaryType || 'PROVIDER';
    setRuleBeneficiaryType(bType);
    setRuleScope(preset?.scope || 'CATEGORY');
    setRuleName(preset?.name || '');
    setRuleCategory(data?.categories[0] || 'Traiteur & Gastronomie');
    setRuleTargetUserId(
      preset?.targetUserId ||
        (bType === 'INSTRUCTOR'
          ? data?.partners.instructors[0]?.id || ''
          : data?.partners.providers[0]?.id || ''),
    );
    setRuleRate(bType === 'INSTRUCTOR' ? '15' : '12');
    setRuleFixedFee('0');
    setRuleActive(true);
    setRuleModalOpen(true);
  }

  function openEditRuleModal(rule: CommissionRule) {
    setEditingRule(rule);
    setRuleBeneficiaryType(rule.beneficiaryType);
    setRuleScope(rule.scope);
    setRuleName(rule.name);
    setRuleCategory(rule.category || '');
    setRuleTargetUserId(rule.targetUserId || '');
    setRuleRate(String(rule.ratePercent));
    setRuleFixedFee(String(rule.fixedFeeFcfa));
    setRuleActive(rule.isActive);
    setRuleModalOpen(true);
  }

  async function handleRuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRuleSubmitting(true);
    try {
      const url = editingRule
        ? `/api/superadmin/commission-rules/${editingRule.id}`
        : '/api/superadmin/commission-rules';
      const method = editingRule ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({
          name: ruleName,
          beneficiaryType: ruleBeneficiaryType,
          scope: ruleScope,
          category: ruleScope === 'CATEGORY' ? ruleCategory : undefined,
          targetUserId: ruleScope === 'USER' ? ruleTargetUserId : undefined,
          ratePercent: Number(ruleRate),
          fixedFeeFcfa: Number(ruleFixedFee),
          isActive: ruleActive,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Enregistrement du barème impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      setRuleModalOpen(false);
      onNotify(editingRule ? `Barème « ${ruleName} » mis à jour.` : `Nouveau barème « ${ruleName} » créé.`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setRuleSubmitting(false);
    }
  }

  async function handleToggleRuleActive(rule: CommissionRule) {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/superadmin/commission-rules/${rule.id}`, {
        method: 'PATCH',
        headers: buildAuthHeaders('superadmin', true),
        credentials: 'include',
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Modification impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      onNotify(`Barème « ${rule.name} » ${!rule.isActive ? 'activé' : 'désactivé'}.`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteRule(rule: CommissionRule) {
    setBusyId(rule.id);
    try {
      const res = await fetch(`/api/superadmin/commission-rules/${rule.id}`, {
        method: 'DELETE',
        headers: buildAuthHeaders('superadmin', false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        onError(payload.error || 'Suppression impossible.');
        return;
      }
      setData(payload as CommissionOverviewPayload);
      setConfirmDeleteRuleId(null);
      onNotify(`Règle « ${rule.name} » supprimée.`);
      onSyncAuditLogs?.();
    } catch {
      onError('Erreur réseau.');
    } finally {
      setBusyId(null);
    }
  }

  // Live calculator for modal preview
  const modalPreview = useMemo(() => {
    const gross = Math.max(0, Number(comGross) || 0);
    const rate = Math.max(0, Math.min(80, Number(comRate) || 0));
    const fixed = Math.max(0, Number(comFixedFee) || 0);
    const commission = Math.min(gross, Math.round((gross * rate) / 100) + fixed);
    const net = Math.max(0, gross - commission);
    return { gross, commission, net };
  }, [comGross, comRate, comFixedFee]);

  // Monthly commissions aggregation for Recharts (Formateurs Pro + Prestataires)
  const { monthlyChartData, activeMonthlyRows, monthlySummary } = useMemo(() => {
    const empty = {
      monthlyChartData: [] as MonthlyCommissionPoint[],
      activeMonthlyRows: [] as MonthlyCommissionPoint[],
      monthlySummary: {
        periodTotalFcfa: 0,
        peakMonthLabel: '—',
        peakMonthFcfa: 0,
        momDeltaPercent: null as number | null,
      },
    };
    if (!data) return empty;

    const bucketMap = new Map<
      string,
      {
        instructor: number;
        provider: number;
        gross: number;
        count: number;
      }
    >();

    for (const rec of data.records) {
      if (rec.status === 'ANNULEE') continue;
      const rawDate = (rec.transactionDate || rec.createdAt || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(rawDate)) continue;
      const entry = bucketMap.get(rawDate) || {
        instructor: 0,
        provider: 0,
        gross: 0,
        count: 0,
      };
      if (rec.beneficiaryType === 'INSTRUCTOR') {
        entry.instructor += rec.commissionAmountFcfa;
      } else {
        entry.provider += rec.commissionAmountFcfa;
      }
      entry.gross += rec.grossAmountFcfa;
      entry.count += 1;
      bucketMap.set(rawDate, entry);
    }

    const sortedKeys = Array.from(bucketMap.keys()).sort();
    const fallbackNow = new Date().toISOString().slice(0, 7);
    const latestKey = sortedKeys[sortedKeys.length - 1] || fallbackNow;

    const buildPoint = (monthKey: string): MonthlyCommissionPoint => {
      const [yStr, mStr] = monthKey.split('-');
      const d = new Date(Number(yStr), Number(mStr) - 1, 1);
      const shortRaw = new Intl.DateTimeFormat('fr-FR', {
        month: 'short',
        year: 'numeric',
      }).format(d);
      const fullRaw = new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric',
      }).format(d);
      const b = bucketMap.get(monthKey) || {
        instructor: 0,
        provider: 0,
        gross: 0,
        count: 0,
      };
      return {
        monthKey,
        monthLabel: shortRaw.charAt(0).toUpperCase() + shortRaw.slice(1),
        fullMonthLabel: fullRaw.charAt(0).toUpperCase() + fullRaw.slice(1),
        instructorCommissionFcfa: b.instructor,
        providerCommissionFcfa: b.provider,
        totalCommissionFcfa: b.instructor + b.provider,
        grossVolumeFcfa: b.gross,
        operationsCount: b.count,
      };
    };

    const activeMonthlyRows = sortedKeys.map(buildPoint);

    let displayKeys: string[] = [];
    if (monthlyRange === 'active') {
      if (sortedKeys.length <= 1) {
        displayKeys = sortedKeys;
      } else {
        const [sy, sm] = sortedKeys[0].split('-').map(Number);
        const [ey, em] = latestKey.split('-').map(Number);
        let curY = sy;
        let curM = sm;
        while (curY < ey || (curY === ey && curM <= em)) {
          displayKeys.push(`${curY}-${String(curM).padStart(2, '0')}`);
          curM += 1;
          if (curM > 12) {
            curM = 1;
            curY += 1;
          }
        }
      }
    } else {
      const windowCount = monthlyRange === '12m' ? 12 : 6;
      const [ey, em] = latestKey.split('-').map(Number);
      for (let i = windowCount - 1; i >= 0; i -= 1) {
        const dt = new Date(ey, em - 1 - i, 1);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        displayKeys.push(key);
      }
    }

    const monthlyChartData = displayKeys.map(buildPoint);
    const periodTotalFcfa = monthlyChartData.reduce((s, p) => s + p.totalCommissionFcfa, 0);
    const peakPoint = monthlyChartData.reduce<MonthlyCommissionPoint | null>(
      (best, cur) =>
        !best || cur.totalCommissionFcfa > best.totalCommissionFcfa ? cur : best,
      null,
    );

    let momDeltaPercent: number | null = null;
    if (activeMonthlyRows.length >= 2) {
      const prev = activeMonthlyRows[activeMonthlyRows.length - 2].totalCommissionFcfa;
      const curr = activeMonthlyRows[activeMonthlyRows.length - 1].totalCommissionFcfa;
      if (prev > 0) {
        momDeltaPercent = Number((((curr - prev) / prev) * 100).toFixed(1));
      }
    }

    return {
      monthlyChartData,
      activeMonthlyRows,
      monthlySummary: {
        periodTotalFcfa,
        peakMonthLabel: peakPoint ? peakPoint.monthLabel : '—',
        peakMonthFcfa: peakPoint ? peakPoint.totalCommissionFcfa : 0,
        momDeltaPercent,
      },
    };
  }, [data, monthlyRange]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Chargement du module de gestion des commissions...
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;
  const allFilteredSelected =
    filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.includes(r.id));

  return (
    <div className="space-y-6">
      {/* KPI Financial Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Volume brut prestations</span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {formatFcfa(kpis.grossVolumeFcfa)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {kpis.totalRecords} opérations enregistrées
          </p>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300 font-medium">
            <span>Commissions plateforme</span>
            <BadgePercent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
            {formatFcfa(kpis.totalCommissionFcfa)}
          </p>
          <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80 mt-0.5">
            Formateurs : {formatFcfa(kpis.instructorCommissionFcfa)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300 font-medium">
            <span>À valider / prélever</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-300">
            {formatFcfa(kpis.pendingValidationFcfa)}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
            {kpis.pendingCount} dossier(s) à traiter
          </p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            <span>Encaissées & soldées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
            {formatFcfa(kpis.collectedOrSettledFcfa)}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
            Prestataires : {formatFcfa(kpis.providerCommissionFcfa)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Net partenaires</span>
            <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <p className="mt-2 text-lg sm:text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {formatFcfa(kpis.netPartnerTotalFcfa)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {kpis.activeRulesCount} barème(s) actif(s)
          </p>
        </div>
      </div>

      {/* Primary Analytics Row: Monthly Evolution Recharts + Pilotage Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                Évolution mensuelle du volume total des commissions
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setMonthlyChartMode('area')}
                  className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${
                    monthlyChartMode === 'area'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  Courbes
                </button>
                <button
                  type="button"
                  onClick={() => setMonthlyChartMode('bar')}
                  className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition ${
                    monthlyChartMode === 'bar'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <BarChart3 className="w-3 h-3" />
                  Barres
                </button>
              </div>

              <select
                value={monthlyRange}
                onChange={(e) => setMonthlyRange(e.target.value as MonthlyChartRange)}
                aria-label="Période d'évolution mensuelle"
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[11px] font-semibold text-gray-700 dark:text-gray-200"
              >
                <option value="6m">6 derniers mois</option>
                <option value="12m">12 derniers mois</option>
                <option value="active">Mois avec activité</option>
              </select>
            </div>
          </div>

          {/* Mini summary metrics strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Volume sur la période
              </div>
              <div className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5">
                {formatFcfa(monthlySummary.periodTotalFcfa)}
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Mois record ({monthlySummary.peakMonthLabel})
              </div>
              <div className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                {formatFcfa(monthlySummary.peakMonthFcfa)}
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Croissance mensuelle (M/M-1)
              </div>
              <div
                className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                  monthlySummary.momDeltaPercent === null
                    ? 'text-gray-500 dark:text-gray-400'
                    : monthlySummary.momDeltaPercent >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {monthlySummary.momDeltaPercent === null
                  ? '—'
                  : `${monthlySummary.momDeltaPercent >= 0 ? '+' : ''}${monthlySummary.momDeltaPercent}%`}
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                Aucune commission.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyChartData}
                  margin={{ top: 10, right: 14, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradInstructorCom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradProviderCom" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <Tooltip content={<MonthlyCommissionTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />

                  {monthlyChartMode === 'area' ? (
                    <>
                      <Area
                        type="monotone"
                        dataKey="instructorCommissionFcfa"
                        name="Formateurs Pro"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#gradInstructorCom)"
                        dot={{ r: 3, fill: '#f97316' }}
                        activeDot={{ r: 5 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="providerCommissionFcfa"
                        name="Prestataires"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#gradProviderCom)"
                        dot={{ r: 3, fill: '#10b981' }}
                        activeDot={{ r: 5 }}
                      />
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="instructorCommissionFcfa"
                        name="Formateurs Pro"
                        stackId="commissions"
                        fill="#f97316"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={38}
                      />
                      <Bar
                        dataKey="providerCommissionFcfa"
                        name="Prestataires"
                        stackId="commissions"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={38}
                      />
                    </>
                  )}

                  <Line
                    type="monotone"
                    dataKey="totalCommissionFcfa"
                    name="Volume Total Commissions"
                    stroke="#2563eb"
                    strokeWidth={2.75}
                    dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col justify-between gap-4">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
            Pilotage & Actions rapides
          </h3>

          <div className="space-y-2">
            <button
              type="button"
              disabled={syncing}
              onClick={() => void handleSyncFromPlatform()}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Synchroniser prestations & cours
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openCreateCommissionModal}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Commission
              </button>
              <button
                type="button"
                onClick={() => openCreateRuleModal()}
                className="min-h-[40px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Barème
              </button>
            </div>

            <div className="pt-1 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={selectedPdfMonth}
                  onChange={(e) => setSelectedPdfMonth(e.target.value)}
                  aria-label="Mois du bilan financier PDF"
                  className="flex-1 min-h-[38px] px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  <option value="ALL">Bilan consolidé (tous mois)</option>
                  {[...activeMonthlyRows].reverse().map((m) => (
                    <option key={m.monthKey} value={m.monthKey}>
                      {m.fullMonthLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleExportMonthlyPdf(selectedPdfMonth)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 transition"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Bilan PDF
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter le registre CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row: Comparative BarChart + Monthly Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
              Ventilation financière Formateurs Pro vs Prestataires Événementiels
            </h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.chartByType}
                margin={{ top: 8, right: 12, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => formatFcfa(Number(value ?? 0))}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="grossFcfa" name="Volume Brut" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="commissionFcfa" name="Commission Plateforme" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={42} />
                <Bar dataKey="netPartnerFcfa" name="Net Partenaire" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
              Synthèse mensuelle par segment
            </h3>
            <button
              type="button"
              onClick={() => handleExportMonthlyPdf('ALL')}
              className="min-h-[34px] px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition"
              title="Télécharger le bilan financier mensuel consolidé en PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-2">Mois</th>
                  <th className="py-2 px-2 text-right">Formateurs</th>
                  <th className="py-2 px-2 text-right">Prestataires</th>
                  <th className="py-2 px-2 text-right">Total</th>
                  <th className="py-2 pl-2 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {activeMonthlyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      Aucune donnée mensuelle active
                    </td>
                  </tr>
                ) : (
                  [...activeMonthlyRows].reverse().map((m) => (
                    <tr key={m.monthKey} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-2.5 pr-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <div>{m.monthLabel}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          {m.operationsCount} opération(s)
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-orange-600 dark:text-orange-400 whitespace-nowrap">
                        {formatFcfa(m.instructorCommissionFcfa)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatFcfa(m.providerCommissionFcfa)}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold tabular-nums text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {formatFcfa(m.totalCommissionFcfa)}
                      </td>
                      <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleExportMonthlyPdf(m.monthKey)}
                          title={`Télécharger le bilan PDF de ${m.fullMonthLabel}`}
                          className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 overflow-x-auto">
          {(
            [
              {
                id: 'records',
                label: `Registre des commissions (${data.records.length})`,
                icon: BadgePercent,
              },
              {
                id: 'rules',
                label: `Barèmes & Règles (${data.rules.length})`,
                icon: SlidersHorizontal,
              },
              {
                id: 'partners',
                label: `Relevés Partenaires (${data.partnerSummaries.length})`,
                icon: Users,
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`min-h-[38px] px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                  active
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-TAB 1: REGISTRE DES COMMISSIONS */}
      {subTab === 'records' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-3.5 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher référence, partenaire, prestation, client..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'ALL' | CommissionBeneficiaryType)}
                className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Tous types</option>
                <option value="INSTRUCTOR">Formateurs Pro</option>
                <option value="PROVIDER">Prestataires</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Tous les partenaires</option>
                {allPartnersForDropdown.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | CommissionStatus)}
                className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="EN_ATTENTE">En attente</option>
                <option value="VALIDEE">Validée</option>
                <option value="PRELEVEE">Prélevée</option>
                <option value="REVERSE_PARTENAIRE">Reversée partenaire</option>
                <option value="ANNULEE">Annulée</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                {selectedIds.length} commission(s) sélectionnée(s)
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleBulkStatus('VALIDEE')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  Valider la sélection
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkStatus('PRELEVEE')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Marquer Prélevée
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkStatus('REVERSE_PARTENAIRE')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  Solder Reversement
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-800 dark:text-blue-200"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}

          {/* Desktop Table (lg+) — sticky Actions column so nothing is ever clipped */}
          <div className="hidden lg:block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-3 px-2.5 w-9">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={(e) =>
                          setSelectedIds(
                            e.target.checked ? filteredRecords.map((r) => r.id) : [],
                          )
                        }
                        className="rounded border-gray-300"
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Réf. & Date</th>
                    <th className="py-3 px-2.5">Partenaire</th>
                    <th className="py-3 px-2.5">Prestation / Cours</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Brut</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Commission</th>
                    <th className="py-3 px-2.5 text-right whitespace-nowrap">Net</th>
                    <th className="py-3 px-2.5">Statut</th>
                    <th className="py-3 px-3 text-right sticky right-0 z-10 bg-gray-50 dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        Aucune commission.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => {
                      const st = STATUS_META[r.status];
                      const isBusy = busyId === r.id;
                      const isChecked = selectedIds.includes(r.id);
                      return (
                        <tr
                          key={r.id}
                          className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="py-3 px-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, r.id]
                                    : prev.filter((id) => id !== r.id),
                                )
                              }
                              className="rounded border-gray-300"
                              aria-label={`Sélectionner ${r.reference}`}
                            />
                          </td>
                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                              {r.reference}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              {formatDateShort(r.transactionDate)}
                            </div>
                          </td>
                          <td className="py-3 px-2.5">
                            <div className="flex items-center gap-2.5">
                              <ProfileAvatar
                                src={r.beneficiaryAvatarUrl}
                                name={r.beneficiaryName}
                                size="sm"
                                tone={r.beneficiaryType === 'INSTRUCTOR' ? 'amber' : 'purple'}
                              />
                              <div className="min-w-0">
                                <div
                                  className={`text-[10px] font-semibold mb-0.5 ${
                                    r.beneficiaryType === 'INSTRUCTOR'
                                      ? 'text-amber-700 dark:text-amber-300'
                                      : 'text-purple-700 dark:text-purple-300'
                                  }`}
                                >
                                  {r.beneficiaryType === 'INSTRUCTOR' ? 'Formateur Pro' : 'Prestataire'}
                                </div>
                                <div className="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[130px]">
                                  {r.beneficiaryName}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 max-w-[140px]">
                                  {r.beneficiaryLogoUrl && (
                                    <CompanyLogo src={r.beneficiaryLogoUrl} name={r.beneficiaryOrg} size="xs" />
                                  )}
                                  <span className="truncate">{r.beneficiaryOrg}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2.5">
                            <div
                              className="font-medium text-gray-900 dark:text-gray-100 max-w-[175px] truncate"
                              title={r.sourceTitle}
                            >
                              {r.sourceTitle}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[175px] truncate">
                              {r.clientOrLearnerName}
                            </div>
                            <div className="text-[10px] font-mono text-gray-400 mt-0.5 truncate max-w-[175px]">
                              {r.category}
                            </div>
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatFcfa(r.grossAmountFcfa)}
                          </td>
                          <td className="py-3 px-2.5 text-right whitespace-nowrap">
                            <div className="font-mono font-bold tabular-nums text-blue-700 dark:text-blue-300">
                              {formatFcfa(r.commissionAmountFcfa)}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                              {r.appliedRatePercent}%{r.fixedFeeFcfa > 0 ? ` +${formatFcfa(r.fixedFeeFcfa)}` : ''}
                            </div>
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                            {formatFcfa(r.netPartnerAmountFcfa)}
                          </td>
                          <td className="py-3 px-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${st.badgeClass}`}
                            >
                              {st.label}
                            </span>
                            {r.payoutReference && (
                              <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 mt-1">
                                {r.payoutReference}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right sticky right-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 border-l border-gray-100 dark:border-gray-800 whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              {r.status === 'EN_ATTENTE' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleQuickStatus(r, 'VALIDEE')}
                                  className="px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold"
                                  title="Valider la commission"
                                >
                                  Valider
                                </button>
                              )}
                              {r.status === 'VALIDEE' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openSettlementModal(r, 'PRELEVEE')}
                                  className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold"
                                  title="Enregistrer le prélèvement"
                                >
                                  Prélever
                                </button>
                              )}
                              {r.status === 'PRELEVEE' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => openSettlementModal(r, 'REVERSE_PARTENAIRE')}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold"
                                  title="Solder et reverser la part partenaire"
                                >
                                  Reverser
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setInspectedCommission(r)}
                                title="Voir détail & bordereau"
                                className="p-1 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleRecalculate(r)}
                                title="Recalculer selon barème actif"
                                className="p-1 rounded-lg text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditCommissionModal(r)}
                                title="Modifier taux / montant / statut"
                                className="p-1 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {r.status !== 'ANNULEE' && r.status !== 'REVERSE_PARTENAIRE' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleQuickStatus(r, 'ANNULEE')}
                                  title="Annuler / exonérer"
                                  className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {confirmDeleteCommissionId === r.id ? (
                                <div className="inline-flex items-center gap-1 ml-0.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleDeleteCommission(r)}
                                    className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-semibold"
                                  >
                                    Suppr.
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteCommissionId(null)}
                                    className="px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 text-[10px]"
                                  >
                                    Non
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCommissionId(r.id)}
                                  title="Supprimer la ligne"
                                  className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
            {filteredRecords.map((r) => {
              const st = STATUS_META[r.status];
              return (
                <div
                  key={r.id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProfileAvatar
                        src={r.beneficiaryAvatarUrl}
                        name={r.beneficiaryName}
                        size="md"
                        tone={r.beneficiaryType === 'INSTRUCTOR' ? 'amber' : 'purple'}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-bold text-gray-900 dark:text-gray-100">
                          {r.reference} · {formatDateShort(r.transactionDate)}
                        </div>
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">
                          {r.beneficiaryName}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          {r.beneficiaryLogoUrl && (
                            <CompanyLogo src={r.beneficiaryLogoUrl} name={r.beneficiaryOrg} size="xs" />
                          )}
                          <span className="truncate">{r.beneficiaryOrg}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.badgeClass}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className="text-xs text-gray-700 dark:text-gray-300">
                    <div className="font-medium">{r.sourceTitle}</div>
                    <div className="text-gray-500">{r.clientOrLearnerName}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Brut</span>
                      <span className="font-mono font-semibold">{formatFcfa(r.grossAmountFcfa)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">
                        Comm. ({r.appliedRatePercent}%)
                      </span>
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatFcfa(r.commissionAmountFcfa)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block">Net partenaire</span>
                      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatFcfa(r.netPartnerAmountFcfa)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {r.status === 'EN_ATTENTE' && (
                      <button
                        type="button"
                        onClick={() => void handleQuickStatus(r, 'VALIDEE')}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                      >
                        Valider
                      </button>
                    )}
                    {r.status === 'VALIDEE' && (
                      <button
                        type="button"
                        onClick={() => openSettlementModal(r, 'PRELEVEE')}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                      >
                        Prélever
                      </button>
                    )}
                    {r.status === 'PRELEVEE' && (
                      <button
                        type="button"
                        onClick={() => openSettlementModal(r, 'REVERSE_PARTENAIRE')}
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                      >
                        Reverser net
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setInspectedCommission(r)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                    >
                      Bordereau
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditCommissionModal(r)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                    >
                      Modifier
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BARÈMES & RÈGLES DE COMMISSION */}
      {subTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openCreateRuleModal()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nouveau barème
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-5 rounded-xl border transition ${
                  rule.isActive
                    ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                    : 'border-gray-200/70 dark:border-gray-800/70 bg-gray-50 dark:bg-gray-950 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                          rule.beneficiaryType === 'INSTRUCTOR'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                        }`}
                      >
                        {rule.beneficiaryType === 'INSTRUCTOR' ? 'Formateurs Pro' : 'Prestataires'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono font-semibold text-gray-700 dark:text-gray-300">
                        {rule.scope === 'USER'
                          ? 'Priorité 1 · Partenaire'
                          : rule.scope === 'CATEGORY'
                          ? 'Priorité 2 · Catégorie'
                          : 'Priorité 3 · Global'}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {rule.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {rule.scope === 'USER'
                        ? `Cible : ${rule.targetUserName || rule.targetUserId}`
                        : rule.scope === 'CATEGORY'
                        ? `Catégorie : ${rule.category}`
                        : 'Appliqué par défaut sur tout l’espace'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                      {rule.ratePercent}%
                    </div>
                    {rule.fixedFeeFcfa > 0 && (
                      <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                        + {formatFcfa(rule.fixedFeeFcfa)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    disabled={busyId === rule.id}
                    onClick={() => void handleToggleRuleActive(rule)}
                    className={`px-2.5 py-1 rounded-full font-semibold text-[11px] inline-flex items-center gap-1 ${
                      rule.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    {rule.isActive ? 'Règle active' : 'Désactivée'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditRuleModal(rule)}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    {confirmDeleteRuleId === rule.id ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === rule.id}
                          onClick={() => void handleDeleteRule(rule)}
                          className="px-2 py-1.5 rounded-lg bg-rose-600 text-white font-semibold"
                        >
                          Confirmer
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRuleId(null)}
                          className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRuleId(rule.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Supprimer ce barème"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: RELEVÉS PAR PARTENAIRE */}
      {subTab === 'partners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.partnerSummaries.map((p) => (
            <div
              key={`${p.beneficiaryType}-${p.beneficiaryId}`}
              className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ProfileAvatar
                    src={p.avatarUrl}
                    name={p.beneficiaryName}
                    size="lg"
                    tone={p.beneficiaryType === 'INSTRUCTOR' ? 'amber' : 'purple'}
                  />
                  <div className="min-w-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold mb-1.5 ${
                        p.beneficiaryType === 'INSTRUCTOR'
                          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                      }`}
                    >
                      {p.beneficiaryType === 'INSTRUCTOR' ? 'Formateur Pro' : 'Prestataire Événementiel'}
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                      {p.beneficiaryName}
                    </h4>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {p.companyLogoUrl && (
                        <CompanyLogo src={p.companyLogoUrl} name={p.beneficiaryOrg} size="xs" />
                      )}
                      <span className="truncate">{p.beneficiaryOrg}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400">Taux effectif</div>
                  <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {p.effectiveRatePercent}%
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <span className="text-[11px] text-gray-400 block">Opérations</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                    {p.transactionsCount}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block">Volume Brut</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {formatFcfa(p.grossTotalFcfa)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block">Commissions dues</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatFcfa(p.commissionTotalFcfa)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-400 block">Net Partenaire</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatFcfa(p.netPartnerTotalFcfa)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPartnerFilter(p.beneficiaryId);
                    setTypeFilter(p.beneficiaryType);
                    setSubTab('records');
                  }}
                  className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 inline-flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Voir ses commissions
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openCreateRuleModal({
                      beneficiaryType: p.beneficiaryType,
                      scope: 'USER',
                      targetUserId: p.beneficiaryId,
                      name: `Accord personnalisé — ${p.beneficiaryName}`,
                    })
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Award className="w-3.5 h-3.5" />
                  Taux dédié
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: CRÉATION / MODIFICATION COMMISSION */}
      {commissionModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCommissionModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingCommission
                  ? `Modifier commission ${editingCommission.reference}`
                  : 'Enregistrer une commission'}
              </h3>
              <button
                type="button"
                onClick={() => setCommissionModalOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCommissionSubmit} className="p-5 overflow-y-auto space-y-4">
              {!editingCommission && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Type de partenaire *
                    </label>
                    <select
                      value={comBeneficiaryType}
                      onChange={(e) => {
                        const nextType = e.target.value as CommissionBeneficiaryType;
                        setComBeneficiaryType(nextType);
                        const firstId =
                          nextType === 'INSTRUCTOR'
                            ? data.partners.instructors[0]?.id || ''
                            : data.partners.providers[0]?.id || '';
                        setComBeneficiaryId(firstId);
                        const sug = resolveSuggestedRate(nextType, firstId, comCategory);
                        setComRate(String(sug.rate));
                        setComFixedFee(String(sug.fixed));
                      }}
                      className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                    >
                      <option value="INSTRUCTOR">Formateur Pro</option>
                      <option value="PROVIDER">Prestataire Événementiel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Partenaire concerné *
                    </label>
                    <select
                      value={comBeneficiaryId}
                      onChange={(e) => {
                        setComBeneficiaryId(e.target.value);
                        const sug = resolveSuggestedRate(
                          comBeneficiaryType,
                          e.target.value,
                          comCategory,
                        );
                        setComRate(String(sug.rate));
                        setComFixedFee(String(sug.fixed));
                      }}
                      className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                    >
                      {(comBeneficiaryType === 'INSTRUCTOR'
                        ? data.partners.instructors
                        : data.partners.providers
                      ).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Intitulé prestation / formation *
                </label>
                <input
                  type="text"
                  required
                  value={comSourceTitle}
                  onChange={(e) => setComSourceTitle(e.target.value)}
                  placeholder="Ex. Traiteur Gala Annuel ou Session Cloud Souverain"
                  className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Client / Apprenant B2B
                  </label>
                  <input
                    type="text"
                    value={comClientName}
                    onChange={(e) => setComClientName(e.target.value)}
                    placeholder="Ex. Sonatel Business SA"
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Catégorie
                  </label>
                  <input
                    type="text"
                    list="commission-categories"
                    value={comCategory}
                    onChange={(e) => setComCategory(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                  <datalist id="commission-categories">
                    {data.categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Montant brut (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={comGross}
                    onChange={(e) => setComGross(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Taux (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step="0.5"
                    required
                    value={comRate}
                    onChange={(e) => setComRate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Frais fixes (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={comFixedFee}
                    onChange={(e) => setComFixedFee(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
              </div>

              {/* Live Preview Strip */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block">Brut</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                    {formatFcfa(modalPreview.gross)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400 block font-semibold">
                    Commission Teranga
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                    {formatFcfa(modalPreview.commission)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400 block font-semibold">
                    Net Partenaire
                  </span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    {formatFcfa(modalPreview.net)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  <select
                    value={comStatus}
                    onChange={(e) => setComStatus(e.target.value as CommissionStatus)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  >
                    <option value="EN_ATTENTE">En attente</option>
                    <option value="VALIDEE">Validée</option>
                    <option value="PRELEVEE">Prélevée</option>
                    <option value="REVERSE_PARTENAIRE">Reversée partenaire</option>
                    <option value="ANNULEE">Annulée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date d’opération
                  </label>
                  <input
                    type="date"
                    value={comDate}
                    onChange={(e) => setComDate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Notes de suivi
                </label>
                <textarea
                  rows={2}
                  value={comNotes}
                  onChange={(e) => setComNotes(e.target.value)}
                  placeholder="Observations financières ou justificatif..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCommissionModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={comSubmitting}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {comSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PRÉLÈVEMENT / REVERSEMENT PARTENAIRE */}
      {settlementTarget && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSettlementTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {settlementTarget.targetStatus === 'PRELEVEE'
                  ? `Enregistrer prélèvement · ${settlementTarget.record.reference}`
                  : `Confirmer reversement partenaire · ${settlementTarget.record.reference}`}
              </h3>
              <button
                type="button"
                onClick={() => setSettlementTarget(null)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSettlementSubmit} className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Partenaire</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {settlementTarget.record.beneficiaryName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Commission Teranga</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {formatFcfa(settlementTarget.record.commissionAmountFcfa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Net à reverser au partenaire</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatFcfa(settlementTarget.record.netPartnerAmountFcfa)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mode de règlement
                </label>
                <select
                  value={settlementMethod}
                  onChange={(e) => setSettlementMethod(e.target.value as CommissionPayoutMethod)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                >
                  <option value="VIREMENT">Virement bancaire</option>
                  <option value="MOBILE_MONEY">Mobile Money (Wave / Orange Money)</option>
                  <option value="RETENUE_FACTURE">Retenue directe sur facture</option>
                  <option value="CHEQUE">Chèque certifié</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Référence de transaction *
                </label>
                <input
                  type="text"
                  required
                  value={settlementRef}
                  onChange={(e) => setSettlementRef(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Commentaire comptable
                </label>
                <textarea
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettlementTarget(null)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={settlementBusy}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  {settlementBusy ? 'Validation...' : 'Confirmer l’opération'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: BARÈME / RÈGLE DE COMMISSION */}
      {ruleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRuleModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {editingRule ? `Modifier le barème : ${editingRule.name}` : 'Créer un barème de commission'}
              </h3>
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRuleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Libellé du barème *
                </label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Ex. Barème VIP Traiteur Dakar"
                  className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Espace concerné *
                  </label>
                  <select
                    value={ruleBeneficiaryType}
                    disabled={Boolean(editingRule)}
                    onChange={(e) => {
                      const next = e.target.value as CommissionBeneficiaryType;
                      setRuleBeneficiaryType(next);
                      setRuleTargetUserId(
                        next === 'INSTRUCTOR'
                          ? data.partners.instructors[0]?.id || ''
                          : data.partners.providers[0]?.id || '',
                      );
                    }}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 disabled:opacity-60"
                  >
                    <option value="INSTRUCTOR">Formateurs Pro</option>
                    <option value="PROVIDER">Prestataires Événementiels</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Portée d’application *
                  </label>
                  <select
                    value={ruleScope}
                    disabled={Boolean(editingRule)}
                    onChange={(e) => setRuleScope(e.target.value as CommissionRuleScope)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 disabled:opacity-60"
                  >
                    <option value="GLOBAL">Global (par défaut)</option>
                    <option value="CATEGORY">Par catégorie métier</option>
                    <option value="USER">Partenaire spécifique</option>
                  </select>
                </div>
              </div>

              {ruleScope === 'CATEGORY' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Catégorie ciblée *
                  </label>
                  <input
                    type="text"
                    required
                    list="rule-categories-list"
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value)}
                    placeholder="Ex. Traiteur & Gastronomie"
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                  <datalist id="rule-categories-list">
                    {data.categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              )}

              {ruleScope === 'USER' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Partenaire ciblé *
                  </label>
                  <select
                    value={ruleTargetUserId}
                    onChange={(e) => setRuleTargetUserId(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  >
                    {(ruleBeneficiaryType === 'INSTRUCTOR'
                      ? data.partners.instructors
                      : data.partners.providers
                    ).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Taux de commission (%) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    step="0.5"
                    required
                    value={ruleRate}
                    onChange={(e) => setRuleRate(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Frais de dossier fixes (FCFA)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={ruleFixedFee}
                    onChange={(e) => setRuleFixedFee(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleActive}
                  onChange={(e) => setRuleActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Activer ce barème immédiatement
              </label>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="min-h-[40px] px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={ruleSubmitting}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  {ruleSubmitting ? 'Sauvegarde...' : 'Enregistrer le barème'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DÉTAIL & BORDEREAU DE COMMISSION */}
      {inspectedCommission && (
        <div
          className="fixed inset-0 z-50 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setInspectedCommission(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Bordereau de Commission · {inspectedCommission.reference}
                </h3>
                <p className="text-xs font-mono text-gray-500">
                  {formatDateShort(inspectedCommission.transactionDate)} ·{' '}
                  {inspectedCommission.beneficiaryType === 'INSTRUCTOR'
                    ? 'Formateur Pro'
                    : 'Prestataire Événementiel'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCommission(null)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 no-print"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Partenaire</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">
                    {inspectedCommission.beneficiaryName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Entité / Spécialité</span>
                  <span className="text-gray-700 dark:text-gray-300 text-right">
                    {inspectedCommission.beneficiaryOrg}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Prestation / Formation</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-right">
                    {inspectedCommission.sourceTitle}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Client / Apprenant</span>
                  <span className="text-gray-700 dark:text-gray-300 text-right">
                    {inspectedCommission.clientOrLearnerName}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Barème appliqué</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {inspectedCommission.ruleName || 'Taux personnalisé'} (
                    {inspectedCommission.appliedRatePercent}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
                <div>
                  <span className="text-[11px] text-gray-400 block">Montant Brut</span>
                  <span className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">
                    {formatFcfa(inspectedCommission.grossAmountFcfa)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 block">
                    Commission ({inspectedCommission.appliedRatePercent}%)
                  </span>
                  <span className="text-sm font-bold font-mono text-blue-700 dark:text-blue-300">
                    {formatFcfa(inspectedCommission.commissionAmountFcfa)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">
                    Net Partenaire
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">
                    {formatFcfa(inspectedCommission.netPartnerAmountFcfa)}
                  </span>
                </div>
              </div>

              {(inspectedCommission.payoutReference || inspectedCommission.notes) && (
                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-1">
                  {inspectedCommission.payoutReference && (
                    <div>
                      <span className="text-gray-500">Règlement : </span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {inspectedCommission.payoutMethod
                          ? `${PAYOUT_METHOD_LABELS[inspectedCommission.payoutMethod]} — `
                          : ''}
                        {inspectedCommission.payoutReference}
                      </span>
                    </div>
                  )}
                  {inspectedCommission.notes && (
                    <div className="text-gray-600 dark:text-gray-400">
                      {inspectedCommission.notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex justify-end gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimer bordereau
              </button>
              <button
                type="button"
                onClick={() => setInspectedCommission(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-gray-900 dark:bg-blue-600 text-white text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
