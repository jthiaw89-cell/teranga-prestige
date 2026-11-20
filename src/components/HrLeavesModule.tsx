import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calendar,
  Check,
  Clock,
  Download,
  FileCheck2,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  HrOverviewPayload,
  LeaveRequestRecord,
  LeaveTypeCode,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type HrTab = 'leaves' | 'attendance' | 'profile_attestations' | 'team_holidays';

const LEAVE_LABELS: Record<LeaveTypeCode, string> = {
  ANNUEL: 'Congé annuel payé',
  MALADIE: 'Congé maladie',
  MATERNITE_PATERNITE: 'Maternité / Paternité',
  MARIAGE: 'Mariage',
  DECES: 'Décès familial',
  SANS_SOLDE: 'Sans solde',
  RECUPERATION: 'Récupération',
  MISSION: 'Ordre de mission',
};

const STATUS_TEXT: Record<LeaveRequestRecord['status'], { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En attente', cls: 'text-amber-700 dark:text-amber-300 font-semibold' },
  APPROUVE_N1: { label: 'Validé N+1', cls: 'text-blue-700 dark:text-blue-300 font-semibold' },
  APPROUVE: { label: 'Approuvé', cls: 'text-emerald-700 dark:text-emerald-300 font-semibold' },
  REJETE: { label: 'Refusé', cls: 'text-rose-700 dark:text-rose-300 font-semibold' },
  ANNULE: { label: 'Annulé', cls: 'text-gray-500 dark:text-gray-400' },
};

export const HrLeavesModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<HrOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<HrTab>('leaves');

  // Leave request modal
  const [modalOpen, setModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveTypeCode>('ANNUEL');
  const [startDate, setStartDate] = useState('2026-11-26');
  const [endDate, setEndDate] = useState('2026-11-27');
  const [halfDay, setHalfDay] = useState<'FULL' | 'MORNING' | 'AFTERNOON'>('FULL');
  const [reason, setReason] = useState('');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Attendance quick clock form
  const [clockSite, setClockSite] = useState('Dakar Plateau');
  const [clockMode, setClockMode] = useState<'DECLARATIF' | 'QR_SITE' | 'BADGEUSE'>('QR_SITE');
  const [clockStatus, setClockStatus] = useState<'PRESENT' | 'RETARD' | 'TELETRAVAIL'>('PRESENT');
  const [clockNote, setClockNote] = useState('');

  // Decision inline note
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});

  const loadHr = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/hr/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement RH impossible.');
        return;
      }
      setData(payload as HrOverviewPayload);
    } catch {
      setError('Erreur réseau lors du chargement des données RH.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadHr(false);
  }, [loadHr]);

  const ownBalances = useMemo(
    () => (data?.balances || []).filter((b) => b.userId === session.userId),
    [data, session.userId],
  );

  const estimatedWorkingDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    const holidaySet = new Set((data?.holidays || []).map((h) => h.date));
    const s = new Date(`${startDate}T00:00:00`);
    const e = new Date(`${endDate}T00:00:00`);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const dow = cur.getDay();
      const iso = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) count += 1;
      cur.setDate(cur.getDate() + 1);
    }
    if (halfDay !== 'FULL' && count === 1) return 0.5;
    return count;
  }, [data?.holidays, endDate, halfDay, startDate]);

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/hr/leaves', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ leaveType, startDate, endDate, halfDay, reason, attachmentLabel }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Demande refusée.');
        return;
      }
      setData(payload as HrOverviewPayload);
      setModalOpen(false);
      setReason('');
      setAttachmentLabel('');
      setNotice(`Demande ${payload.request?.reference || ''} enregistrée et transmise pour validation.`);
    } catch {
      setError('Erreur réseau lors de l’envoi.');
    } finally {
      setSubmitting(false);
    }
  }

  async function decideLeave(id: string, decision: 'APPROUVE' | 'REJETE' | 'ANNULE') {
    setError('');
    try {
      const res = await fetch(`/api/hr/leaves/${id}/decision`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ decision, note: decisionNote[id] || '' }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Action impossible.');
        return;
      }
      setData(payload as HrOverviewPayload);
      setNotice('Décision RH enregistrée.');
    } catch {
      setError('Erreur réseau.');
    }
  }

  async function handleClock(action: 'IN' | 'OUT') {
    setError('');
    try {
      const res = await fetch('/api/hr/attendance/clock', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ action, site: clockSite, mode: clockMode, status: clockStatus, note: clockNote }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Pointage impossible.');
        return;
      }
      setData(payload as HrOverviewPayload);
      setClockNote('');
      setNotice(action === 'IN' ? 'Pointage d’arrivée enregistré.' : 'Fin de journée enregistrée.');
    } catch {
      setError('Erreur réseau.');
    }
  }

  async function generateAttestation(type: 'TRAVAIL' | 'CONGE' | 'SALAIRE' | 'STAGE') {
    setError('');
    try {
      const res = await fetch('/api/hr/attestations', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Génération impossible.');
        return;
      }
      setData(payload as HrOverviewPayload);
      setNotice(`Attestation ${payload.attestation?.reference || ''} générée avec QR code de vérification.`);
    } catch {
      setError('Erreur réseau.');
    }
  }

  function exportPayrollCsv() {
    if (!data) return;
    const rows = [
      ['Matricule', 'Collaborateur', 'Direction', 'Contrat', 'Congés approuvés (j)', 'Heures sup (h)'].join(';'),
      ...data.profiles.map((p) => {
        const leaveDays = data.leaveRequests
          .filter((l) => l.userId === p.userId && l.status === 'APPROUVE')
          .reduce((s, l) => s + l.workingDays, 0);
        const overtime = data.attendance
          .filter((a) => a.userId === p.userId)
          .reduce((s, a) => s + a.overtimeHours, 0);
        return [p.matricule, p.name, p.department, p.contractType, leaveDays, overtime].join(';');
      }),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `variables_paie_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Export CSV des variables de paie téléchargé.');
  }

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" />
      </div>
    );
  }

  const stats = data?.stats || { headcount: 0, pendingLeaves: 0, approvedDaysThisMonth: 0, presentToday: 0, alertsCount: 0 };

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
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
            aria-label="Fermer"
            className="p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Mon solde congé annuel</span>
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {ownBalances.find((b) => b.leaveType === 'ANNUEL')?.remainingDays ?? 22} j
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            Acquis : {ownBalances.find((b) => b.leaveType === 'ANNUEL')?.acquiredDays ?? 24} j · Récup :{' '}
            {ownBalances.find((b) => b.leaveType === 'RECUPERATION')?.remainingDays ?? 0} j
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Demandes en attente</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.pendingLeaves}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {stats.approvedDaysThisMonth} j validés
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Présences & pointage</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.presentToday} / {stats.headcount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Alertes RH & échéances</span>
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.alertsCount}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'leaves', label: 'Congés & Soldes' },
              { id: 'attendance', label: 'Pointage & Absences' },
              { id: 'profile_attestations', label: 'Dossier & Attestations QR' },
              { id: 'team_holidays', label: data?.canManageTeam ? 'Équipe, Rapports & Fériés SN' : 'Jours Fériés Sénégal' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {data?.canManageTeam && (
            <button
              type="button"
              onClick={exportPayrollCsv}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export Paie CSV</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadHr(true)}
            aria-label="Actualiser"
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Poser un congé</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LEAVES & BALANCES */}
      {tab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Demandes de congés et validations
              </h2>
              <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                {(data?.leaveRequests || []).length} dossier(s)
              </span>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.leaveRequests || []).map((req) => {
                const st = STATUS_TEXT[req.status];
                return (
                  <div key={req.id} className="p-4 sm:p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-2 font-mono tabular-nums">
                        <span>{req.reference}</span>
                        <span aria-hidden="true">·</span>
                        <span>{req.userName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{req.site}</span>
                      </div>
                      <span className={st.cls}>{st.label}</span>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {LEAVE_LABELS[req.leaveType]} — {req.workingDays} jour(s) ouvré(s)
                      </h3>
                      <span className="text-xs font-mono tabular-nums text-gray-600 dark:text-gray-300">
                        {req.startDate} → {req.endDate}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-400">{req.reason}</p>
                    {req.decisionNote && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Note de décision ({req.decidedByName}) : {req.decisionNote}
                      </p>
                    )}

                    {req.status === 'EN_ATTENTE' && (
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {data?.canManageTeam && (
                          <>
                            <input
                              type="text"
                              value={decisionNote[req.id] || ''}
                              onChange={(e) => setDecisionNote((p) => ({ ...p, [req.id]: e.target.value }))}
                              placeholder="Motif / commentaire optionnel..."
                              className="flex-1 min-w-[180px] min-h-[36px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => void decideLeave(req.id, 'APPROUVE')}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approuver</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void decideLeave(req.id, 'REJETE')}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold"
                            >
                              Refuser
                            </button>
                          </>
                        )}
                        {req.userId === session.userId && (
                          <button
                            type="button"
                            onClick={() => void decideLeave(req.id, 'ANNULE')}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium"
                          >
                            Annuler ma demande
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Mes soldes détaillés
              </h3>
              {ownBalances.map((b) => (
                <div key={b.leaveType} className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-gray-200">{LEAVE_LABELS[b.leaveType]}</div>
                    <div className="text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                      Acquis {b.acquiredDays}j · Pris {b.usedDays}j · Attente {b.pendingDays}j
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
                    {b.remainingDays}j
                  </span>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Règles légales Sénégal configurées
              </h3>
              {(data?.leaveRules || []).slice(0, 5).map((r) => (
                <div key={r.code} className="text-xs flex items-center justify-between py-1 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                  <span className="text-gray-700 dark:text-gray-300 truncate pr-2">{r.label}</span>
                  <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
                    {r.annualAllowanceDays}j/an
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ATTENDANCE & CLOCKING */}
      {tab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Pointage journalier
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Site d’affectation</label>
                <select
                  value={clockSite}
                  onChange={(e) => setClockSite(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="Dakar Plateau">Siège Dakar Plateau</option>
                  <option value="Diamniadio">Antenne CICAD Diamniadio</option>
                  <option value="Thiès">Campus Régional Thiès</option>
                  <option value="Télétravail">Télétravail autorisé</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Mode de pointage</label>
                <select
                  value={clockMode}
                  onChange={(e) => setClockMode(e.target.value as 'DECLARATIF' | 'QR_SITE' | 'BADGEUSE')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="QR_SITE">QR Code de site</option>
                  <option value="DECLARATIF">Saisie déclarative mobile</option>
                  <option value="BADGEUSE">Synchronisation badgeuse</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Statut</label>
                <select
                  value={clockStatus}
                  onChange={(e) => setClockStatus(e.target.value as 'PRESENT' | 'RETARD' | 'TELETRAVAIL')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="PRESENT">Présent à l’heure</option>
                  <option value="RETARD">Retard justifié</option>
                  <option value="TELETRAVAIL">Télétravail</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Commentaire optionnel</label>
                <input
                  type="text"
                  value={clockNote}
                  onChange={(e) => setClockNote(e.target.value)}
                  placeholder="Ex. Déplacement client VDN..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleClock('IN')}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Pointer arrivée
                </button>
                <button
                  type="button"
                  onClick={() => void handleClock('OUT')}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Pointer sortie
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Feuille de présence & heures supplémentaires
              </h3>
            </div>
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                  <th className="py-3 px-4">Collaborateur</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Arrivée / Sortie</th>
                  <th className="py-3 px-4">Site & Mode</th>
                  <th className="py-3 px-4">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.attendance || []).map((att) => (
                  <tr key={att.id}>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      {att.userName}
                      {att.note && <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">{att.note}</div>}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-gray-600 dark:text-gray-300">{att.date}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-gray-700 dark:text-gray-200">
                      {att.checkInTime} {att.checkOutTime ? `→ ${att.checkOutTime}` : '· En poste'}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 dark:text-gray-400">
                      {att.site} · {att.mode}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {att.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROFILE & QR ATTESTATIONS */}
      {tab === 'profile_attestations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Mon dossier professionnel numérique
              </h3>
              <span className="text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400">
                {data?.ownProfile?.matricule}
              </span>
            </div>
            {data?.ownProfile && (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Poste & Direction</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {data.ownProfile.jobTitle} · {data.ownProfile.department}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Site & Cycle</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {data.ownProfile.site} · {data.ownProfile.workCycle}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Contrat & Embauche</dt>
                  <dd className="font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5">
                    {data.ownProfile.contractType} · depuis {data.ownProfile.hireDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Responsable hiérarchique</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                    {data.ownProfile.managerName}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Attestations officielles avec QR Code
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(['TRAVAIL', 'CONGE', 'SALAIRE'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => void generateAttestation(t)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/50"
                  >
                    + {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.attestations || []).map((att) => (
                <div key={att.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <QrCode className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        Attestation de {att.type.toLowerCase()} · {att.userName}
                      </div>
                      <div className="font-mono tabular-nums text-gray-500 dark:text-gray-400 truncate">
                        {att.reference} · {att.issuedAt} · Code {att.verificationCode}
                      </div>
                    </div>
                  </div>
                  <FileCheck2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAM REPORTS & SENEGAL HOLIDAYS */}
      {tab === 'team_holidays' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Calendrier officiel des jours fériés — Sénégal 2026
            </h3>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {(data?.holidays || []).map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{h.label}</span>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      ({h.category}{h.isMobile ? ' · date lunaire ajustable' : ''})
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-gray-700 dark:text-gray-300">{h.date}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Alertes RH & conformité contrats</span>
                </h3>
              </div>
              {(data?.alerts || []).length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Aucune alerte contractuelle en cours.</p>
              ) : (
                (data?.alerts || []).map((al) => (
                  <div key={al.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {al.userName} · <span className="font-mono tabular-nums">{al.dueDate}</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{al.message}</p>
                  </div>
                ))
              )}
            </div>

            {data?.canManageTeam && (
              <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Effectif suivi ({data.profiles.length})</span>
                </h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.profiles.map((p) => (
                    <div key={p.userId} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</span>
                        <div className="text-gray-500 dark:text-gray-400">{p.jobTitle} · {p.site}</div>
                      </div>
                      <span className="font-mono tabular-nums text-gray-600 dark:text-gray-300">
                        {p.contractType} · {p.seniorityYears} an(s)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: NEW LEAVE REQUEST */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void submitLeave(e)}
            className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Nouvelle demande de congé
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Fermer">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type de congé</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveTypeCode)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(LEAVE_LABELS) as LeaveTypeCode[]).map((code) => (
                    <option key={code} value={code}>
                      {LEAVE_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date début</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date fin</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Fractionnement</label>
                <select
                  value={halfDay}
                  onChange={(e) => setHalfDay(e.target.value as 'FULL' | 'MORNING' | 'AFTERNOON')}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="FULL">Journées complètes</option>
                  <option value="MORNING">Demi-journée (Matin)</option>
                  <option value="AFTERNOON">Demi-journée (Après-midi)</option>
                </select>
              </div>
              <div className="sm:col-span-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-800 dark:text-blue-200 font-mono tabular-nums flex items-center justify-between">
                <span>Durée calculée (hors week-ends & jours fériés SN) :</span>
                <span className="font-bold">{estimatedWorkingDays} jour(s)</span>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Motif de la demande</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Précisez la continuité de service prévue..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pièce justificative (référence)</label>
                <input
                  type="text"
                  value={attachmentLabel}
                  onChange={(e) => setAttachmentLabel(e.target.value)}
                  placeholder="Ex. Certificat médical / justificatif (optionnel)"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || estimatedWorkingDays <= 0}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {submitting ? 'Envoi...' : 'Soumettre la demande'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
