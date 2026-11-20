import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  Car,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileDown,
  FileText,
  MapPin,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { exportMissionOrderPdf } from '../lib/missionPdfExport';
import type {
  AuthSessionSummary,
  MissionAgentCategory,
  MissionCalculationBreakdown,
  MissionDestinationCity,
  MissionOrderRecord,
  MissionOverviewPayload,
  MissionPerDiemTariff,
  MissionStatus,
  MissionTransportMode,
  MissionZone,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type MissionTab = 'list' | 'calculator' | 'create' | 'tariffs';

const ZONE_LABELS: Record<MissionZone, string> = {
  DAKAR_PERIPHERIE: 'Dakar / Diamniadio / Thiès',
  SENEGAL_INTERIEUR: 'Intérieur du Sénégal (Régions)',
  UEMOA_AFRIQUE: 'Zone UEMOA / Afrique',
  HORS_AFRIQUE: 'Hors Afrique (International)',
};

const CATEGORY_LABELS: Record<MissionAgentCategory, string> = {
  CAT_A_HAUTE_DIRECTION: 'Cat. A — Direction / SG / Inspecteurs',
  CAT_B_CADRE: 'Cat. B — Chefs de Service / Cadres',
  CAT_C_EXECUTION: 'Cat. C — Agents / Logistique',
};

const TRANSPORT_LABELS: Record<MissionTransportMode, string> = {
  VEHICULE_ADMIN: 'Véhicule administratif',
  TRANSPORT_PUBLIC: 'Transport public / Train TER / Bus',
  AVION: 'Transport aérien',
  VEHICULE_PERSONNEL: 'Véhicule personnel autorisé',
};

const STATUS_META: Record<
  MissionStatus,
  { label: string; textClass: string; surfaceClass: string }
> = {
  BROUILLON: {
    label: 'Brouillon',
    textClass: 'text-gray-700 dark:text-gray-300',
    surfaceClass: 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900',
  },
  SOUMIS_N1: {
    label: 'Attente Visa N+1',
    textClass: 'text-amber-700 dark:text-amber-300',
    surfaceClass: 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30',
  },
  VISA_DAGE: {
    label: 'Attente Visa DAGE / SG',
    textClass: 'text-blue-700 dark:text-blue-300',
    surfaceClass: 'border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30',
  },
  APPROUVE_SG: {
    label: 'Signé SG — Autorisé',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    surfaceClass: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30',
  },
  EN_MISSION: {
    label: 'En mission',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    surfaceClass: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30',
  },
  RAPPORT_DEPOSE: {
    label: 'Rapport déposé (À liquider)',
    textClass: 'text-violet-700 dark:text-violet-300',
    surfaceClass: 'border-violet-200 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/30',
  },
  CLOTURE: {
    label: 'Clôturé & Soldé',
    textClass: 'text-emerald-800 dark:text-emerald-200',
    surfaceClass: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40',
  },
  REJETE: {
    label: 'Rejeté',
    textClass: 'text-rose-700 dark:text-rose-300',
    surfaceClass: 'border-rose-200 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/30',
  },
};

function formatFcfa(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('fr-FR')} FCFA`;
}

function calcDaysInclusive(dep: string, ret: string): number {
  const s = new Date(`${dep}T00:00:00`);
  const e = new Date(`${ret}T00:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function computeCityTransportEstimate(
  city: MissionDestinationCity | undefined,
  zone: MissionZone,
  transportMode: MissionTransportMode,
): { base: number; toll: number; distanceRoundTripKm: number } {
  const oneWay =
    city?.distanceFromDakarKm ??
    (zone === 'DAKAR_PERIPHERIE' ? 35 : zone === 'SENEGAL_INTERIEUR' ? 240 : zone === 'UEMOA_AFRIQUE' ? 1800 : 4200);
  const distanceRoundTripKm = oneWay * 2;
  const toll =
    transportMode === 'VEHICULE_ADMIN' || transportMode === 'VEHICULE_PERSONNEL'
      ? city?.tollRoundTripFcfa ?? 0
      : 0;

  let base = 0;
  if (transportMode === 'VEHICULE_ADMIN') {
    base = Math.max(10000, Math.round(distanceRoundTripKm * 95));
  } else if (transportMode === 'VEHICULE_PERSONNEL') {
    base = Math.max(12000, Math.round(distanceRoundTripKm * 150));
  } else if (transportMode === 'TRANSPORT_PUBLIC') {
    base = city?.publicTransitRoundTripFcfa ?? Math.max(4000, Math.round(distanceRoundTripKm * 45));
  } else {
    base =
      city?.flightEstimateFcfa ??
      (zone === 'SENEGAL_INTERIEUR' ? 140000 : zone === 'UEMOA_AFRIQUE' ? 390000 : 750000);
  }
  return { base, toll, distanceRoundTripKm };
}

function addDaysToIso(isoDate: string, daysToAdd: number): string {
  const base = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setDate(base.getDate() + Math.max(0, daysToAdd));
  return base.toISOString().slice(0, 10);
}

export const MissionsModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<MissionOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<MissionTab>('list');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | MissionStatus>('ALL');

  const defaultCat: MissionAgentCategory = (() => {
    if (
      session.space === 'superadmin' ||
      (session.space === 'intranet' && (session.role === 'OWNER' || session.role === 'DIRECTION')) ||
      session.space === 'accounting'
    ) {
      return 'CAT_A_HAUTE_DIRECTION';
    }
    if (session.space === 'intranet' && session.role === 'MANAGER') return 'CAT_B_CADRE';
    return 'CAT_C_EXECUTION';
  })();

  // Standalone Senegal Civil Service Per Diem & Transport Calculator state
  const [calcCityId, setCalcCityId] = useState<string>('city-saint-louis');
  const [calcDurationMode, setCalcDurationMode] = useState<'days' | 'dates'>('days');
  const [calcDays, setCalcDays] = useState<number>(4);
  const [calcDepDate, setCalcDepDate] = useState('2026-11-24');
  const [calcRetDate, setCalcRetDate] = useState('2026-11-27');
  const [calcCategory, setCalcCategory] = useState<MissionAgentCategory>(defaultCat);
  const [calcTransportMode, setCalcTransportMode] = useState<MissionTransportMode>('VEHICULE_ADMIN');
  const [calcLodgingCovered, setCalcLodgingCovered] = useState(false);
  const [calcMealsCovered, setCalcMealsCovered] = useState(false);
  const [calcAdvancePct, setCalcAdvancePct] = useState<0 | 50 | 80 | 100>(80);
  const [serverCalc, setServerCalc] = useState<MissionCalculationBreakdown | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Create form + live simulator
  const [title, setTitle] = useState('');
  const [selectedCityId, setSelectedCityId] = useState<string>('city-kaolack');
  const [destination, setDestination] = useState('Kaolack');
  const [zone, setZone] = useState<MissionZone>('SENEGAL_INTERIEUR');
  const [agentCategory, setAgentCategory] = useState<MissionAgentCategory>(defaultCat);
  const [departureDate, setDepartureDate] = useState('2026-11-24');
  const [returnDate, setReturnDate] = useState('2026-11-26');
  const [transportMode, setTransportMode] = useState<MissionTransportMode>('VEHICULE_ADMIN');
  const [vehicleName, setVehicleName] = useState('Berline Direction DK-1092-AA');
  const [customTransport, setCustomTransport] = useState('');
  const [customLodging, setCustomLodging] = useState('');
  const [lodgingCoveredByHost, setLodgingCoveredByHost] = useState(false);
  const [mealsCoveredByHost, setMealsCoveredByHost] = useState(false);
  const [advancePct, setAdvancePct] = useState<0 | 50 | 80 | 100>(80);
  const [submitting, setSubmitting] = useState(false);

  // Reject note state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Mission Report & Expense Settlement modal
  const [reportMission, setReportMission] = useState<MissionOrderRecord | null>(null);
  const [reportSummary, setReportSummary] = useState('');
  const [actualInputs, setActualInputs] = useState<
    Record<string, { actualFcfa: string; receiptRef: string }>
  >({});

  const loadMissions = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/missions/overview', {
          headers: buildAuthHeaders(session.space, false),
          credentials: 'include',
        });
        const payload = await res.json();
        if (!res.ok) {
          setError(payload.error || 'Impossible de charger les ordres de mission.');
          return;
        }
        setData(payload as MissionOverviewPayload);
      } catch {
        setError('Erreur réseau lors du chargement des missions.');
      } finally {
        setLoading(false);
      }
    },
    [session.space],
  );

  useEffect(() => {
    void loadMissions(false);
  }, [loadMissions]);

  const citiesByZone = useMemo(() => {
    const list = data?.destinationCities || [];
    return {
      DAKAR_PERIPHERIE: list.filter((c) => c.zone === 'DAKAR_PERIPHERIE'),
      SENEGAL_INTERIEUR: list.filter((c) => c.zone === 'SENEGAL_INTERIEUR'),
      UEMOA_AFRIQUE: list.filter((c) => c.zone === 'UEMOA_AFRIQUE'),
      HORS_AFRIQUE: list.filter((c) => c.zone === 'HORS_AFRIQUE'),
    };
  }, [data?.destinationCities]);

  // Instant breakdown for the standalone Calculator tab
  const calcPreview = useMemo(() => {
    const city = (data?.destinationCities || []).find((c) => c.id === calcCityId);
    const resolvedZone: MissionZone = city?.zone || 'SENEGAL_INTERIEUR';
    const tariff: MissionPerDiemTariff | undefined = data?.tariffs.find(
      (t) => t.zone === resolvedZone && t.category === calcCategory,
    );
    const days =
      calcDurationMode === 'days'
        ? Math.max(1, Math.min(90, Math.round(calcDays || 1)))
        : Math.max(1, calcDaysInclusive(calcDepDate, calcRetDate));
    const nights = Math.max(0, days - 1);
    const baseDailyRate = tariff?.dailyRateFcfa || 0;
    const effectiveDailyRate = calcMealsCovered ? Math.round(baseDailyRate * 0.5) : baseDailyRate;
    const perDiemTotal = days * effectiveDailyRate;
    const lodgingCeiling = tariff?.lodgingCeilingFcfa || 0;
    const lodgingTotal = calcLodgingCovered ? 0 : nights * lodgingCeiling;
    const tr = computeCityTransportEstimate(city, resolvedZone, calcTransportMode);
    const totalTransport = tr.base + tr.toll;
    const grandTotal = perDiemTotal + lodgingTotal + totalTransport;
    const advanceAmount = Math.round((grandTotal * calcAdvancePct) / 100);
    return {
      city,
      zone: resolvedZone,
      days,
      nights,
      baseDailyRate,
      effectiveDailyRate,
      perDiemTotal,
      lodgingCeiling,
      lodgingTotal,
      transportBase: tr.base,
      toll: tr.toll,
      distanceRoundTripKm: tr.distanceRoundTripKm,
      totalTransport,
      grandTotal,
      advanceAmount,
      balanceAfter: grandTotal - advanceAmount,
    };
  }, [
    calcAdvancePct,
    calcCategory,
    calcCityId,
    calcDays,
    calcDepDate,
    calcDurationMode,
    calcLodgingCovered,
    calcMealsCovered,
    calcRetDate,
    calcTransportMode,
    data?.destinationCities,
    data?.tariffs,
  ]);

  // Live Per Diem & Budget Simulator for the Create Order tab
  const simPreview = useMemo(() => {
    const city = (data?.destinationCities || []).find((c) => c.id === selectedCityId);
    const days = calcDaysInclusive(departureDate, returnDate);
    const tariff = data?.tariffs.find((t) => t.zone === zone && t.category === agentCategory);
    const baseDailyRate = tariff?.dailyRateFcfa || 0;
    const dailyRate = mealsCoveredByHost ? Math.round(baseDailyRate * 0.5) : baseDailyRate;
    const perDiemTotal = days * dailyRate;
    const nights = Math.max(0, days - 1);
    const lodgingCeilingTotal = lodgingCoveredByHost ? 0 : nights * (tariff?.lodgingCeilingFcfa || 0);
    const lodgingTotal = lodgingCoveredByHost
      ? 0
      : customLodging.trim() !== ''
        ? Math.max(0, Number(customLodging) || 0)
        : lodgingCeilingTotal;
    const autoTr = computeCityTransportEstimate(city, zone, transportMode);
    const autoTransportTotal = autoTr.base + autoTr.toll;
    const transportTotal =
      customTransport.trim() !== ''
        ? Math.max(0, Number(customTransport) || 0)
        : autoTransportTotal;
    const grandTotal = perDiemTotal + lodgingTotal + transportTotal;
    const advanceAmount = Math.round((grandTotal * advancePct) / 100);
    return {
      city,
      days,
      nights,
      baseDailyRate,
      dailyRate,
      perDiemTotal,
      lodgingCeilingTotal,
      lodgingTotal,
      autoTransportBase: autoTr.base,
      autoToll: autoTr.toll,
      autoTransportTotal,
      distanceRoundTripKm: autoTr.distanceRoundTripKm,
      transportTotal,
      grandTotal,
      advanceAmount,
    };
  }, [
    advancePct,
    agentCategory,
    customLodging,
    customTransport,
    data?.destinationCities,
    data?.tariffs,
    departureDate,
    lodgingCoveredByHost,
    mealsCoveredByHost,
    returnDate,
    selectedCityId,
    transportMode,
    zone,
  ]);

  async function handleVerifyOnServer() {
    setCalcLoading(true);
    setError('');
    try {
      const res = await fetch('/api/missions/calculate', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          cityId: calcCityId,
          agentCategory: calcCategory,
          departureDate: calcDurationMode === 'dates' ? calcDepDate : undefined,
          returnDate: calcDurationMode === 'dates' ? calcRetDate : undefined,
          daysCount: calcDurationMode === 'days' ? calcDays : undefined,
          transportMode: calcTransportMode,
          lodgingCoveredByHost: calcLodgingCovered,
          mealsCoveredByHost: calcMealsCovered,
          advanceRequestedPct: calcAdvancePct,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Calcul serveur impossible.');
        return;
      }
      setServerCalc(payload as MissionCalculationBreakdown);
      setNotice(`Barème officiel certifié (${(payload as MissionCalculationBreakdown).cityName} · ${formatFcfa((payload as MissionCalculationBreakdown).totalEstimatedFcfa)}).`);
    } catch {
      setError('Erreur réseau lors du calcul.');
    } finally {
      setCalcLoading(false);
    }
  }

  function applyCalculatorToOrder() {
    const city = calcPreview.city;
    setSelectedCityId(city?.id || '');
    setDestination(city?.city || '');
    setZone(calcPreview.zone);
    setAgentCategory(calcCategory);
    setTransportMode(calcTransportMode);
    setLodgingCoveredByHost(calcLodgingCovered);
    setMealsCoveredByHost(calcMealsCovered);
    setCustomLodging('');
    setCustomTransport('');
    setAdvancePct(calcAdvancePct);
    if (calcDurationMode === 'dates') {
      setDepartureDate(calcDepDate);
      setReturnDate(calcRetDate);
    } else {
      const dep = calcDepDate || '2026-11-24';
      setDepartureDate(dep);
      setReturnDate(addDaysToIso(dep, Math.max(0, calcPreview.days - 1)));
    }
    setTab('create');
    setNotice(`Simulation pour ${city?.city || 'la destination'} transférée vers le formulaire d’ordre de mission.`);
  }

  function handleSelectOrderCity(newCityId: string) {
    setSelectedCityId(newCityId);
    if (!newCityId) return;
    const found = (data?.destinationCities || []).find((c) => c.id === newCityId);
    if (found) {
      setDestination(found.city);
      setZone(found.zone);
      setCustomTransport('');
    }
  }

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.missions || []).filter((m) => {
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;
      if (q) {
        const hay = `${m.reference} ${m.title} ${m.destination} ${m.agentName} ${m.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data?.missions, search, statusFilter]);

  async function handleCreateMission(e: React.FormEvent, submitNow: boolean) {
    e.preventDefault();
    if (!title.trim() || !destination.trim()) {
      setError('Veuillez renseigner l’objet et la destination de la mission.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          title: title.trim(),
          cityId: selectedCityId || undefined,
          destination: destination.trim(),
          zone,
          departureDate,
          returnDate,
          agentCategory,
          transportMode,
          vehicleName: transportMode === 'VEHICULE_ADMIN' ? vehicleName : undefined,
          lodgingCoveredByHost,
          mealsCoveredByHost,
          lodgingEstimateFcfa: simPreview.lodgingTotal,
          transportEstimateFcfa: simPreview.transportTotal,
          advanceRequestedPct: advancePct,
          submitNow,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Création de l’ordre de mission impossible.');
        return;
      }
      setData(payload as MissionOverviewPayload);
      setTitle('');
      setCustomLodging('');
      setCustomTransport('');
      setTab('list');
      setNotice(
        submitNow
          ? 'Ordre de mission créé, chiffré selon le barème officiel et transmis au visa N+1.'
          : 'Brouillon d’ordre de mission enregistré.',
      );
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWorkflowAction(
    id: string,
    action: 'SUBMIT' | 'VISA_N1' | 'VISA_DAGE' | 'APPROVE_SG' | 'START_MISSION' | 'REJECT',
    note?: string,
  ) {
    setError('');
    try {
      const res = await fetch(`/api/missions/${id}/workflow`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ action, note }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Action workflow refusée.');
        return;
      }
      setData(payload as MissionOverviewPayload);
      setRejectingId(null);
      setRejectReason('');
      setNotice(
        action === 'APPROVE_SG'
          ? 'Ordre de mission signé SG, publié dans le Calendrier partagé RH et notifié.'
          : action === 'VISA_DAGE'
            ? 'Visa budgétaire DAGE apposé et avance mandatée.'
            : action === 'VISA_N1'
              ? 'Visa N+1 validé — transmis à la DAGE.'
              : action === 'REJECT'
                ? 'Ordre de mission rejeté avec motif enregistré.'
                : 'Statut de la mission mis à jour.',
      );
    } catch {
      setError('Erreur réseau.');
    }
  }

  function openReportModal(mission: MissionOrderRecord) {
    setReportMission(mission);
    setReportSummary(mission.missionReportSummary || '');
    const map: Record<string, { actualFcfa: string; receiptRef: string }> = {};
    for (const l of mission.expenseLines) {
      map[l.id] = {
        actualFcfa: String(l.actualFcfa ?? l.estimatedFcfa),
        receiptRef: l.receiptRef || '',
      };
    }
    setActualInputs(map);
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reportMission || !reportSummary.trim()) return;
    setError('');
    const actualLines = reportMission.expenseLines.map((l) => ({
      id: l.id,
      actualFcfa: Math.max(0, Number(actualInputs[l.id]?.actualFcfa) || 0),
      receiptRef: actualInputs[l.id]?.receiptRef?.trim() || undefined,
    }));
    const res = await fetch(`/api/missions/${reportMission.id}/report`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ missionReportSummary: reportSummary.trim(), actualLines }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Dépôt du rapport impossible.');
      return;
    }
    setData(payload as MissionOverviewPayload);
    setReportMission(null);
    setNotice('Rapport de mission et justificatifs transmis à la DAGE pour liquidation.');
  }

  async function handleSettleMission(id: string) {
    const res = await fetch(`/api/missions/${id}/settle`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ note: 'Pièces justifiées et solde apuré en comptabilité.' }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Liquidation impossible.');
      return;
    }
    setData(payload as MissionOverviewPayload);
    setNotice('Dossier de mission liquidé et clôturé.');
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const stats = data?.stats || {
    total: 0,
    inApproval: 0,
    activeMissions: 0,
    awaitingReport: 0,
    totalCommittedFcfa: 0,
    totalAdvancePaidFcfa: 0,
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
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotice('');
            }}
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {data?.hasPendingReportBlock && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Blocage réglementaire d’avance de frais actif ({data.blockingMissionRef})
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const blocking = data.missions.find((m) => m.reference === data.blockingMissionRef);
              if (blocking) openReportModal(blocking);
            }}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0"
          >
            Déposer le rapport maintenant
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Ordres en circuit de visa</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.inApproval}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            Sur {stats.total} dossier(s) suivi(s)
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Missions autorisées / terrain</span>
            <Plane className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400">
            {stats.activeMissions}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Engagements budgétaires</span>
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {formatFcfa(stats.totalCommittedFcfa)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            Avances mandatées : {formatFcfa(stats.totalAdvancePaidFcfa)}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Rapports & Liquidations</span>
            <ClipboardCheck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.awaitingReport}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'list', label: `Ordres de mission (${data?.missions.length || 0})`, icon: FileText },
              { id: 'calculator', label: 'Calculateur Per Diem & Frais', icon: Calculator },
              { id: 'create', label: 'Nouvel ordre', icon: Plus },
              { id: 'tariffs', label: 'Barèmes officiels Sénégal', icon: ShieldCheck },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition ${
                  tab === t.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
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
          onClick={() => void loadMissions(true)}
          aria-label="Actualiser"
          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </div>

      {/* TAB 1: LIST & WORKFLOW VISAS */}
      {tab === 'list' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher référence, agent, destination..."
                className="w-full min-h-[38px] pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | MissionStatus)}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Tous les statuts</option>
              {(Object.keys(STATUS_META) as MissionStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_META[st].label}
                </option>
              ))}
            </select>
          </div>

          {filteredMissions.length === 0 ? (
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucun ordre de mission.
              </p>
              <button
                type="button"
                onClick={() => setTab('create')}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Créer un ordre de mission
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMissions.map((m) => {
                const st = STATUS_META[m.status];
                const isOwnerAgent = m.agentUserId === session.userId;
                const hasDageVisa = m.approvalTrail.some((a) => a.action === 'VISA_DAGE');
                const canSubmitDraft = m.status === 'BROUILLON' && isOwnerAgent;
                const canDoN1 = m.status === 'SOUMIS_N1' && data?.canValidateN1;
                const canDoDage = m.status === 'VISA_DAGE' && !hasDageVisa && data?.canValidateDage;
                const canDoSg = m.status === 'VISA_DAGE' && data?.canApproveSg;
                const canDepositReport =
                  (m.status === 'APPROUVE_SG' || m.status === 'EN_MISSION') &&
                  (isOwnerAgent || data?.canValidateDage || data?.canApproveSg);
                const canSettle = m.status === 'RAPPORT_DEPOSE' && data?.canValidateDage;

                return (
                  <article
                    key={m.id}
                    className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {m.reference}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-sans font-semibold ${st.textClass}`}>{st.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {m.departureDate} → {m.returnDate} ({m.daysCount} j)
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{m.verificationQrCode}</span>
                        </div>

                        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                          {m.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            {m.agentName} ({m.agentJobTitle})
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {m.destination} · {ZONE_LABELS[m.zone]}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Car className="w-3.5 h-3.5" />
                            {TRANSPORT_LABELS[m.transportMode]}
                            {m.vehicleName ? ` (${m.vehicleName})` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:items-end gap-1 shrink-0 font-mono tabular-nums">
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {formatFcfa(m.totalEstimatedFcfa)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Per diem : {formatFcfa(m.perDiemDailyFcfa)}/j · Avance {m.advanceRequestedPct}% :{' '}
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {formatFcfa(m.advancePaidFcfa)}
                          </span>
                        </div>
                        {m.actualSpentFcfa !== undefined && (
                          <div className="text-xs text-violet-700 dark:text-violet-300 font-semibold">
                            Réel déclaré : {formatFcfa(m.actualSpentFcfa)} (Solde :{' '}
                            {(m.balanceToSettleFcfa || 0) >= 0 ? '+' : ''}
                            {formatFcfa(m.balanceToSettleFcfa || 0)})
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Visual Visa Stepper */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                      {[
                        { label: '1. Soumission', done: m.status !== 'BROUILLON' && m.status !== 'REJETE' },
                        {
                          label: '2. Visa N+1',
                          done: ['VISA_DAGE', 'APPROUVE_SG', 'EN_MISSION', 'RAPPORT_DEPOSE', 'CLOTURE'].includes(m.status),
                        },
                        {
                          label: '3. DAGE & SG',
                          done: ['APPROUVE_SG', 'EN_MISSION', 'RAPPORT_DEPOSE', 'CLOTURE'].includes(m.status),
                        },
                        {
                          label: '4. Rapport',
                          done: ['RAPPORT_DEPOSE', 'CLOTURE'].includes(m.status),
                        },
                        { label: '5. Liquidé', done: m.status === 'CLOTURE' },
                      ].map((step) => (
                        <div
                          key={step.label}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 ${
                            step.done
                              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                              : 'border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950 text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          <CheckCircle2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              step.done ? 'text-emerald-600 dark:text-emerald-400' : 'opacity-40'
                            }`}
                          />
                          <span className="truncate">{step.label}</span>
                        </div>
                      ))}
                    </div>

                    {m.missionReportSummary && (
                      <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 text-xs text-gray-700 dark:text-gray-300">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          Compte rendu de mission :{' '}
                        </span>
                        {m.missionReportSummary}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        Dernière action : {m.approvalTrail[m.approvalTrail.length - 1]?.stepLabel} par{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">
                          {m.approvalTrail[m.approvalTrail.length - 1]?.actorName}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const file = exportMissionOrderPdf(m, session.organizationName);
                            setNotice(`Ordre de mission exporté (${file}).`);
                          }}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1.5"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          PDF Officiel
                        </button>

                        {canSubmitDraft && (
                          <button
                            type="button"
                            onClick={() => void handleWorkflowAction(m.id, 'SUBMIT')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            Soumettre au visa N+1
                          </button>
                        )}

                        {canDoN1 && (
                          <button
                            type="button"
                            onClick={() => void handleWorkflowAction(m.id, 'VISA_N1')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            Apposer Visa N+1
                          </button>
                        )}

                        {canDoDage && (
                          <button
                            type="button"
                            onClick={() => void handleWorkflowAction(m.id, 'VISA_DAGE')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            Visa DAGE & Mandater avance
                          </button>
                        )}

                        {canDoSg && (
                          <button
                            type="button"
                            onClick={() => void handleWorkflowAction(m.id, 'APPROVE_SG')}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                          >
                            Signature Finale SG
                          </button>
                        )}

                        {(canDoN1 || canDoDage) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(m.id);
                              setRejectReason('');
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Rejeter
                          </button>
                        )}

                        {canDepositReport && (
                          <button
                            type="button"
                            onClick={() => openReportModal(m)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold"
                          >
                            Déposer Rapport & Frais réels
                          </button>
                        )}

                        {canSettle && (
                          <button
                            type="button"
                            onClick={() => void handleSettleMission(m.id)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                          >
                            Liquider & Clôturer (DAGE)
                          </button>
                        )}
                      </div>
                    </div>

                    {rejectingId === m.id && (
                      <div className="pt-3 border-t border-rose-200 dark:border-rose-900 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Motif obligatoire du rejet (ex. crédits insuffisants, mission à reporter)..."
                          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20 text-xs text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => void handleWorkflowAction(m.id, 'REJECT', rejectReason)}
                          className="min-h-[38px] px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold"
                        >
                          Confirmer le rejet
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(null)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEDICATED SENEGAL PER DIEM & TRAVEL ALLOWANCE CALCULATOR */}
      {tab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-5 text-xs sm:text-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Calculateur automatique — Fonction publique sénégalaise
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ville / Pays de destination
                </label>
                <select
                  value={calcCityId}
                  onChange={(e) => {
                    setCalcCityId(e.target.value);
                    setServerCalc(null);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <optgroup label="Dakar & Périphérie (Zone 1)">
                    {citiesByZone.DAKAR_PERIPHERIE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} — {c.distanceFromDakarKm * 2} km A/R
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Intérieur du Sénégal — Régions (Zone 2)">
                    {citiesByZone.SENEGAL_INTERIEUR.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} ({c.regionOrCountry}) — {c.distanceFromDakarKm * 2} km A/R
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Zone UEMOA / Afrique (Zone 3)">
                    {citiesByZone.UEMOA_AFRIQUE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} — {c.regionOrCountry}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Hors Afrique / International (Zone 4)">
                    {citiesByZone.HORS_AFRIQUE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} — {c.regionOrCountry}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                  <span className="font-sans font-semibold text-blue-700 dark:text-blue-300">
                    {ZONE_LABELS[calcPreview.zone]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Distance A/R : {calcPreview.distanceRoundTripKm.toLocaleString('fr-FR')} km</span>
                  {calcPreview.toll > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Péage autoroute A/R : {formatFcfa(calcPreview.toll)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Durée de la mission
                  </label>
                  <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-800 p-0.5 bg-gray-50 dark:bg-gray-950 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCalcDurationMode('days')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        calcDurationMode === 'days'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Nombre de jours
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcDurationMode('dates')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition ${
                        calcDurationMode === 'dates'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      Par dates
                    </button>
                  </div>
                </div>

                {calcDurationMode === 'days' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={calcDays}
                      onChange={(e) => {
                        setCalcDays(Math.max(1, Math.min(90, Number(e.target.value) || 1)));
                        setServerCalc(null);
                      }}
                      className="w-28 min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono tabular-nums text-gray-900 dark:text-gray-100"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                      jour(s) · {calcPreview.nights} nuitée(s)
                    </span>
                    <div className="flex flex-wrap gap-1.5 ml-auto">
                      {[1, 2, 3, 5, 7].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setCalcDays(d);
                            setServerCalc(null);
                          }}
                          className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-mono tabular-nums font-semibold ${
                            calcDays === d
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {d} j
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={calcDepDate}
                      onChange={(e) => {
                        setCalcDepDate(e.target.value);
                        setServerCalc(null);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="date"
                      value={calcRetDate}
                      onChange={(e) => {
                        setCalcRetDate(e.target.value);
                        setServerCalc(null);
                      }}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Catégorie / Groupe Fonction publique
                </label>
                <select
                  value={calcCategory}
                  onChange={(e) => {
                    setCalcCategory(e.target.value as MissionAgentCategory);
                    setServerCalc(null);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(CATEGORY_LABELS) as MissionAgentCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Mode de déplacement
                </label>
                <select
                  value={calcTransportMode}
                  onChange={(e) => {
                    setCalcTransportMode(e.target.value as MissionTransportMode);
                    setServerCalc(null);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(TRANSPORT_LABELS) as MissionTransportMode[]).map((tm) => (
                    <option key={tm} value={tm}>
                      {TRANSPORT_LABELS[tm]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcLodgingCovered}
                    onChange={(e) => {
                      setCalcLodgingCovered(e.target.checked);
                      setServerCalc(null);
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Hébergement assuré par l’hôte
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calcMealsCovered}
                    onChange={(e) => {
                      setCalcMealsCovered(e.target.checked);
                      setServerCalc(null);
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Restauration fournie sur place
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Taux d’avance de trésorerie
                </label>
                <div className="flex flex-wrap gap-2">
                  {([0, 50, 80, 100] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => {
                        setCalcAdvancePct(pct);
                        setServerCalc(null);
                      }}
                      className={`min-h-[38px] px-4 py-1.5 rounded-lg border text-xs font-mono tabular-nums font-semibold transition ${
                        calcAdvancePct === pct
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {pct === 0 ? '0% (Sans avance)' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={calcLoading}
                onClick={() => void handleVerifyOnServer()}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {calcLoading ? 'Vérification...' : 'Certifier via barème serveur'}
              </button>
              <button
                type="button"
                onClick={applyCalculatorToOrder}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                Créer un ordre de mission avec ce calcul
              </button>
            </div>
          </div>

          <aside className="lg:col-span-5 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4 h-fit">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Décompte officiel estimatif
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {calcPreview.city?.city || 'Destination'} · {calcPreview.days} j / {calcPreview.nights} nuit(s)
              </p>
            </div>

            <div className="space-y-2.5 text-xs border-y border-gray-100 dark:border-gray-800 py-3.5 font-mono tabular-nums">
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Per diem ({formatFcfa(calcPreview.effectiveDailyRate)}/j × {calcPreview.days} j)
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(calcPreview.perDiemTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Hébergement ({calcLodgingCovered ? 'Pris en charge' : `${formatFcfa(calcPreview.lodgingCeiling)} × ${calcPreview.nights} n`})
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(calcPreview.lodgingTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  {calcTransportMode === 'AVION'
                    ? 'Billet d’avion A/R estimé'
                    : calcTransportMode === 'VEHICULE_ADMIN'
                      ? `Dotation carburant (${calcPreview.distanceRoundTripKm} km A/R)`
                      : calcTransportMode === 'VEHICULE_PERSONNEL'
                        ? `Indemnité km (${calcPreview.distanceRoundTripKm} km A/R)`
                        : 'Transport public / TER / Bus A/R'}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(calcPreview.transportBase)}
                </span>
              </div>
              {calcPreview.toll > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="font-sans text-gray-600 dark:text-gray-400">
                    Péages autoroutiers A/R
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {formatFcfa(calcPreview.toll)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 font-mono tabular-nums">
              <div className="flex justify-between items-baseline">
                <span className="font-sans text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Coût total réglementaire
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatFcfa(calcPreview.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Avance à mandater ({calcAdvancePct}%)
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {formatFcfa(calcPreview.advanceAmount)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Solde à liquider au retour
                </span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatFcfa(calcPreview.balanceAfter)}
                </span>
              </div>
            </div>

            {serverCalc && (
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="font-semibold">
                  Calcul certifié par le serveur : {formatFcfa(serverCalc.totalEstimatedFcfa)}
                </div>
                <div>{serverCalc.legalReference}</div>
              </div>
            )}

          </aside>
        </div>
      )}

      {/* TAB 3: CREATE + LIVE PER DIEM SIMULATOR */}
      {tab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={(e) => void handleCreateMission(e, true)}
            className="lg:col-span-2 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4 text-xs sm:text-sm"
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Émettre un nouvel ordre de mission
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Objet officiel de la mission
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex. Supervision déploiement guichet numérique régional"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Ville de référence (Auto-barème)
                </label>
                <select
                  value={selectedCityId}
                  onChange={(e) => handleSelectOrderCity(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Saisie libre manuelle</option>
                  <optgroup label="Dakar & Périphérie">
                    {citiesByZone.DAKAR_PERIPHERIE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} ({c.distanceFromDakarKm * 2} km A/R)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Intérieur du Sénégal">
                    {citiesByZone.SENEGAL_INTERIEUR.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} ({c.distanceFromDakarKm * 2} km A/R)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Zone UEMOA / Afrique">
                    {citiesByZone.UEMOA_AFRIQUE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} — {c.regionOrCountry}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Hors Afrique">
                    {citiesByZone.HORS_AFRIQUE.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.city} — {c.regionOrCountry}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Destination précise (Lieu / Service)
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ex. Kaolack — Gouvernance / Antenne"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Zone tarifaire (Barème SN)
                </label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as MissionZone)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(ZONE_LABELS) as MissionZone[]).map((z) => (
                    <option key={z} value={z}>
                      {ZONE_LABELS[z]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Catégorie / Groupe indemnitaire
                </label>
                <select
                  value={agentCategory}
                  onChange={(e) => setAgentCategory(e.target.value as MissionAgentCategory)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(CATEGORY_LABELS) as MissionAgentCategory[]).map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Date de départ
                </label>
                <input
                  type="date"
                  required
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Date de retour
                </label>
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className={transportMode === 'VEHICULE_ADMIN' ? '' : 'sm:col-span-2'}>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Moyen de transport
                </label>
                <select
                  value={transportMode}
                  onChange={(e) => {
                    setTransportMode(e.target.value as MissionTransportMode);
                    setCustomTransport('');
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  {(Object.keys(TRANSPORT_LABELS) as MissionTransportMode[]).map((tm) => (
                    <option key={tm} value={tm}>
                      {TRANSPORT_LABELS[tm]}
                    </option>
                  ))}
                </select>
              </div>

              {transportMode === 'VEHICULE_ADMIN' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Véhicule du parc à réserver
                  </label>
                  <select
                    value={vehicleName}
                    onChange={(e) => setVehicleName(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                  >
                    {(data?.vehiclesCatalog || []).map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} — {v.site}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Transport / Carburant (vide = calcul auto)
                </label>
                <input
                  type="number"
                  min="0"
                  value={customTransport}
                  onChange={(e) => setCustomTransport(e.target.value)}
                  placeholder={`Auto : ${simPreview.autoTransportTotal.toLocaleString('fr-FR')} FCFA`}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Hébergement (vide = plafond légal)
                </label>
                <input
                  type="number"
                  min="0"
                  disabled={lodgingCoveredByHost}
                  value={lodgingCoveredByHost ? '0' : customLodging}
                  onChange={(e) => setCustomLodging(e.target.value)}
                  placeholder={`Plafond auto : ${simPreview.lodgingCeilingTotal.toLocaleString('fr-FR')} FCFA`}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-mono tabular-nums disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lodgingCoveredByHost}
                    onChange={(e) => setLodgingCoveredByHost(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span>Hébergement assuré sur place (0 FCFA)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mealsCoveredByHost}
                    onChange={(e) => setMealsCoveredByHost(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span>Restauration fournie (-50 % Per Diem)</span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Avance de trésorerie souhaitée
                </label>
                <div className="flex flex-wrap gap-2">
                  {([0, 50, 80, 100] as const).map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAdvancePct(pct)}
                      className={`min-h-[38px] px-4 py-1.5 rounded-lg border text-xs font-mono tabular-nums font-semibold transition ${
                        advancePct === pct
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                          : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {pct === 0 ? '0% (Sans avance)' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={(e) => void handleCreateMission(e, false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Enregistrer brouillon
              </button>
              <button
                type="submit"
                disabled={submitting || simPreview.days <= 0}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {submitting ? 'Soumission...' : 'Soumettre au visa N+1'}
              </button>
            </div>
          </form>

          {/* Live Per Diem Breakdown Card */}
          <aside className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4 h-fit">
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Décompte prévisionnel automatique
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {simPreview.city ? `${simPreview.city.city} · ${simPreview.distanceRoundTripKm} km A/R` : ZONE_LABELS[zone]}
              </p>
            </div>

            <div className="space-y-2.5 text-xs border-y border-gray-100 dark:border-gray-800 py-3 font-mono tabular-nums">
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">Durée légale</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {simPreview.days} j / {simPreview.nights} nuit(s)
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Per diem ({formatFcfa(simPreview.dailyRate)}/j)
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(simPreview.perDiemTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">Hébergement</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(simPreview.lodgingTotal)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Transport{simPreview.autoToll > 0 && customTransport.trim() === '' ? ' & péages' : ''}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {formatFcfa(simPreview.transportTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 font-mono tabular-nums">
              <div className="flex justify-between items-baseline">
                <span className="font-sans text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Total engagement estimé
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatFcfa(simPreview.grandTotal)}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs">
                <span className="font-sans text-gray-600 dark:text-gray-400">
                  Avance mandatée ({advancePct}%)
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {formatFcfa(simPreview.advanceAmount)}
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* TAB 3: BARÈMES OFFICIELS */}
      {tab === 'tariffs' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Grille de référence des frais de mission & Per Diem (FCFA / jour)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400">
                  <th className="py-3 px-4 font-semibold">Zone géographique</th>
                  <th className="py-3 px-4 font-semibold">Catégorie d’agent</th>
                  <th className="py-3 px-4 font-semibold text-right">Indemnité journalière (Per diem)</th>
                  <th className="py-3 px-4 font-semibold text-right">Plafond hébergement / nuit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(data?.tariffs || []).map((t) => (
                  <tr key={`${t.zone}-${t.category}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                      {t.zoneLabel}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{t.categoryLabel}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300">
                      {formatFcfa(t.dailyRateFcfa)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {formatFcfa(t.lodgingCeilingFcfa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MISSION REPORT & ACTUAL EXPENSES MODAL */}
      {reportMission && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Rapport de mission & justificatifs — {reportMission.reference}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {reportMission.destination} · Avance perçue : {formatFcfa(reportMission.advancePaidFcfa)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportMission(null)}
                aria-label="Fermer"
                className="min-h-[36px] min-w-[36px] rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Compte rendu synthétique des résultats de mission
                </label>
                <textarea
                  rows={3}
                  required
                  value={reportSummary}
                  onChange={(e) => setReportSummary(e.target.value)}
                  placeholder="Activités réalisées, réunions tenues, livrables ou PV signés..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-gray-700 dark:text-gray-300">
                  Déclaration des dépenses réelles & références de pièces
                </div>
                {reportMission.expenseLines.map((line) => (
                  <div
                    key={line.id}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/60 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <div className="sm:col-span-5">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {line.label}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                        Prévu : {formatFcfa(line.estimatedFcfa)}
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        min="0"
                        value={actualInputs[line.id]?.actualFcfa ?? ''}
                        onChange={(e) =>
                          setActualInputs((prev) => ({
                            ...prev,
                            [line.id]: {
                              ...prev[line.id],
                              actualFcfa: e.target.value,
                            },
                          }))
                        }
                        placeholder="Réel FCFA"
                        className="w-full min-h-[36px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 font-mono tabular-nums text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={actualInputs[line.id]?.receiptRef ?? ''}
                        onChange={(e) =>
                          setActualInputs((prev) => ({
                            ...prev,
                            [line.id]: {
                              ...prev[line.id],
                              receiptRef: e.target.value,
                            },
                          }))
                        }
                        placeholder="Réf. facture / reçu"
                        className="w-full min-h-[36px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                const totalActual = reportMission.expenseLines.reduce(
                  (s, l) => s + (Number(actualInputs[l.id]?.actualFcfa) || 0),
                  0,
                );
                const delta = totalActual - reportMission.advancePaidFcfa;
                return (
                  <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30 flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
                    <span>Total dépenses réelles : {formatFcfa(totalActual)}</span>
                    <span className="font-bold text-blue-800 dark:text-blue-200">
                      {delta >= 0
                        ? `Complément dû à l’agent : +${formatFcfa(delta)}`
                        : `Trop-perçu à reverser : ${formatFcfa(Math.abs(delta))}`}
                    </span>
                  </div>
                );
              })()}

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportMission(null)}
                  className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                >
                  Transmettre pour liquidation DAGE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
