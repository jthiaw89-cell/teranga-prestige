import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Briefcase,
  Calendar,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Send,
  UserCheck,
  Users,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { CalendarView, type CalendarItem } from './CalendarView';
import { TrainingRequestsRealtimePanel } from './TrainingRequestsRealtimePanel';
import { CompanyLogo, ProfileAvatar } from './ui/MediaAvatar';
import type {
  AuthSessionSummary,
  EventRecord,
  OrganizationOption,
  ProviderServiceOffer,
  TrainingModality,
  TrainingProgram,
  TrainingRegistrationStatus,
} from '../types';

interface Props {
  organization: OrganizationOption;
  mode: 'events' | 'training';
  session?: AuthSessionSummary;
}

const MODALITY_LABELS: Record<TrainingModality, string> = {
  EN_LIGNE: 'En ligne',
  HYBRIDE: 'Hybride',
  PRESENTIEL: 'Présentiel',
};

function computeRegistrationStatus(enrolled: number, maxSeats: number): TrainingRegistrationStatus {
  if (enrolled >= maxSeats) return 'COMPLET';
  if (maxSeats - enrolled <= 3) return 'DERNIERES_PLACES';
  return 'OUVERTE';
}

const REG_STATUS_META: Record<TrainingRegistrationStatus, { label: string; className: string }> = {
  OUVERTE: {
    label: 'Inscriptions ouvertes',
    className: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  },
  DERNIERES_PLACES: {
    label: 'Dernières places',
    className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  },
  COMPLET: {
    label: 'Complet',
    className: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
  },
};

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export const EventsTrainingModule: React.FC<Props> = ({ organization, mode, session }) => {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [providerOffers, setProviderOffers] = useState<ProviderServiceOffer[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add event form
  const [evTitle, setEvTitle] = useState('');
  const [evClient, setEvClient] = useState('');
  const [evDate, setEvDate] = useState('2026-12-20');
  const [evVenue, setEvVenue] = useState('');
  const [evCapacity, setEvCapacity] = useState(150);

  // Request provider quote modal
  const [requestOffer, setRequestOffer] = useState<ProviderServiceOffer | null>(null);
  const [reqEventType, setReqEventType] = useState('Sommet & Réception Corporate');
  const [reqDate, setReqDate] = useState('2026-12-18');
  const [reqLocation, setReqLocation] = useState('Dakar Plateau');
  const [reqGuests, setReqGuests] = useState(150);
  const [reqNotes, setReqNotes] = useState('');

  // Events & Training view modes
  const [eventsView, setEventsView] = useState<'cards' | 'calendar'>('cards');
  const [trainingView, setTrainingView] = useState<'list' | 'cards' | 'calendar' | 'requests'>('list');
  const [trTitle, setTrTitle] = useState('');
  const [trCategory, setTrCategory] = useState('Management & Leadership');
  const [trInstructor, setTrInstructor] = useState('');
  const [trModality, setTrModality] = useState<TrainingModality>('HYBRIDE');
  const [trStartDate, setTrStartDate] = useState('2027-01-19');
  const [trHours, setTrHours] = useState(24);
  const [trFee, setTrFee] = useState(350000);

  const activeSpace = session?.space || 'intranet';

  const loadData = useCallback(async () => {
    const hdrs = buildAuthHeaders(activeSpace, false);
    const [evRes, trRes, offRes] = await Promise.all([
      fetch('/api/platform/events', { headers: hdrs, credentials: 'include' }),
      fetch('/api/platform/trainings', { headers: hdrs, credentials: 'include' }),
      mode === 'events'
        ? fetch('/api/platform/providers/offers', { headers: hdrs, credentials: 'include' })
        : Promise.resolve(null),
    ]);
    if (evRes.ok) {
      const d = (await evRes.json()) as { events: EventRecord[] };
      setEvents(d.events || []);
    }
    if (trRes.ok) {
      const d = (await trRes.json()) as { programs: TrainingProgram[] };
      setPrograms(d.programs || []);
    }
    if (offRes && offRes.ok) {
      const d = (await offRes.json()) as { offers: ProviderServiceOffer[] };
      setProviderOffers(d.offers || []);
    }
  }, [activeSpace, mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function notify(msg: string) {
    setFeedback(msg);
    window.setTimeout(() => setFeedback((c) => (c === msg ? null : c)), 4500);
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evTitle.trim()) return;
    const res = await fetch('/api/platform/events', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        title: evTitle.trim(),
        client: evClient.trim() || organization.name,
        date: evDate,
        venue: evVenue.trim() || organization.city,
        capacity: Number(evCapacity) || 100,
      }),
    });
    if (res.ok) {
      const d = (await res.json()) as { event: EventRecord };
      setEvents((prev) => [d.event, ...prev]);
      setEvTitle('');
      setEvClient('');
      setEvVenue('');
      notify(`Événement « ${d.event.title} » ajouté à votre calendrier personnel.`);
    }
  }

  async function registerParticipant(eventId: string) {
    const res = await fetch(`/api/platform/events/${eventId}/register`, {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
    });
    if (res.ok) {
      const d = (await res.json()) as { event: EventRecord };
      setEvents((prev) => prev.map((item) => (item.id === d.event.id ? d.event : item)));
    }
  }

  async function submitProviderRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestOffer) return;
    const res = await fetch('/api/platform/providers/request', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        offerId: requestOffer.id,
        eventType: reqEventType,
        eventDate: reqDate,
        eventLocation: reqLocation,
        guestCount: reqGuests,
        notes: reqNotes,
      }),
    });
    if (res.ok) {
      notify(
        `Demande transmise en temps réel à ${requestOffer.companyName} (${requestOffer.providerName}).`,
      );
      setRequestOffer(null);
      setReqNotes('');
      void loadData();
    }
  }

  async function addProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!trTitle.trim()) return;
    const res = await fetch('/api/platform/trainings', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        title: trTitle.trim(),
        category: trCategory,
        instructor: trInstructor.trim() || undefined,
        modality: trModality,
        nextSession: trStartDate,
        durationHours: Number(trHours) || 21,
        feeFcfa: Number(trFee) || 300000,
      }),
    });
    if (res.ok) {
      setTrTitle('');
      setTrInstructor('');
      notify('Programme publié au catalogue et synchronisé avec Espace Formateur & Espace Apprenant.');
      await loadData();
    } else {
      const err = (await res.json()) as { error?: string };
      notify(err.error || 'Action réservée à la Direction ou au Manager.');
    }
  }

  const canCreateTraining = session?.role === 'OWNER' || session?.role === 'MANAGER';

  async function handleReschedule(
    item: CalendarItem,
    nextDate: string,
    nextStartHour?: number,
  ) {
    if (item.kind === 'event') {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === item.id
            ? { ...ev, date: nextDate, startHour: nextStartHour ?? ev.startHour }
            : ev,
        ),
      );
      const res = await fetch(`/api/platform/events/${item.id}/reschedule`, {
        method: 'PATCH',
        headers: buildAuthHeaders(activeSpace, true),
        credentials: 'include',
        body: JSON.stringify({ date: nextDate, startHour: nextStartHour }),
      });
      if (res.ok) {
        notify(
          `Événement « ${item.title} » replanifié au ${nextDate}${
            nextStartHour !== undefined ? ` à ${String(nextStartHour).padStart(2, '0')}h00` : ''
          }.`,
        );
      } else {
        await loadData();
        notify('Impossible de replanifier cet événement.');
      }
      return;
    }

    setPrograms((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? { ...p, nextSession: nextDate, startHour: nextStartHour ?? p.startHour }
          : p,
      ),
    );
    const res = await fetch(`/api/platform/trainings/${item.id}/reschedule`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ date: nextDate, startHour: nextStartHour }),
    });
    if (res.ok) {
      notify(
        `Formation « ${item.title} » replanifiée au ${nextDate}${
          nextStartHour !== undefined ? ` à ${String(nextStartHour).padStart(2, '0')}h00` : ''
        } (synchronisée avec les formateurs & apprenants).`,
      );
    } else {
      await loadData();
      notify('Replanification des formations réservée à la Direction ou au Manager.');
    }
  }

  if (mode === 'events') {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pôle Événementiel Corporate</h2>

          <div className="flex items-center gap-1.5 p-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setEventsView('cards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                eventsView === 'cards'
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Vue cartes
            </button>
            <button
              type="button"
              onClick={() => setEventsView('calendar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                eventsView === 'calendar'
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Calendrier
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {feedback}
          </div>
        )}

        {eventsView === 'calendar' ? (
          <CalendarView
            events={events}
            programs={programs}
            defaultFilter="events"
            canRescheduleEvent={true}
            canRescheduleTraining={canCreateTraining}
            onReschedule={handleReschedule}
          />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form
            onSubmit={addEvent}
            className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" />
              Planifier un événement personnel
            </h3>
            <input
              type="text"
              required
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="Intitulé de l’événement"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
            />
            <input
              type="text"
              value={evClient}
              onChange={(e) => setEvClient(e.target.value)}
              placeholder="Commanditaire / Institution"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
              />
              <input
                type="number"
                min={10}
                value={evCapacity}
                onChange={(e) => setEvCapacity(Number(e.target.value))}
                placeholder="Capacité"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={evVenue}
              onChange={(e) => setEvVenue(e.target.value)}
              placeholder="Lieu (ex. Radisson Blu, Dakar)"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Ajouter à mon calendrier
            </button>
          </form>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => {
              const fill = Math.min(100, Math.round((ev.registered / ev.capacity) * 100));
              return (
                <div
                  key={ev.id}
                  className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                      {ev.status}
                    </span>
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{ev.date}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-100">{ev.title}</h4>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {ev.client}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {ev.venue}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Accréditations</span>
                      <span className="font-mono font-semibold">
                        {ev.registered} / {ev.capacity} ({fill}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${fill}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Budget estimé</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                        {formatFcfa(ev.budgetFcfa)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void registerParticipant(ev.id)}
                    className="w-full py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-semibold text-gray-800 dark:text-gray-200"
                  >
                    + Enregistrer un participant
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {/* Live synchronized Provider Offers Catalog */}
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-500" />
            Catalogue des Prestataires Événementiels ({providerOffers.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providerOffers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                      {offer.category}
                    </span>
                    <span className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100">
                      {formatFcfa(offer.priceFcfa)}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{offer.title}</h4>
                  <div className="flex items-center gap-2 pt-0.5">
                    <CompanyLogo src={offer.companyLogoUrl} name={offer.companyName} size="sm" />
                    <ProfileAvatar src={offer.providerAvatarUrl} name={offer.providerName} size="xs" tone="amber" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {offer.companyName} ({offer.providerName}) · {offer.locationZone} · max {offer.capacityGuests} pers.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRequestOffer(offer);
                    setReqGuests(offer.capacityGuests);
                  }}
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Solliciter / Demander un devis
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Quote Request Modal */}
        {requestOffer && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <form
              onSubmit={submitProviderRequest}
              className="max-w-lg w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <CompanyLogo src={requestOffer.companyLogoUrl} name={requestOffer.companyName} size="md" />
                <ProfileAvatar src={requestOffer.providerAvatarUrl} name={requestOffer.providerName} size="sm" tone="amber" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 truncate">
                    Demande en temps réel — {requestOffer.companyName}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{requestOffer.title}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Type d’événement
                  </label>
                  <input
                    type="text"
                    required
                    value={reqEventType}
                    onChange={(e) => setReqEventType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Lieu</label>
                  <input
                    type="text"
                    required
                    value={reqLocation}
                    onChange={(e) => setReqLocation(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Participants
                  </label>
                  <input
                    type="number"
                    min={10}
                    value={reqGuests}
                    onChange={(e) => setReqGuests(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Besoins logistiques
                </label>
                <textarea
                  rows={3}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Précisez vos horaires, menus ou équipements souhaités..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestOffer(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
                >
                  Envoyer au prestataire
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // TRAINING MODE (Synchronized with InstructorCourses)
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Pôle Formation Professionnelle</h2>

        <div className="flex items-center gap-1.5 p-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setTrainingView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              trainingView === 'list'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Vue liste
          </button>
          <button
            type="button"
            onClick={() => setTrainingView('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              trainingView === 'cards'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Vue cartes
          </button>
          <button
            type="button"
            onClick={() => setTrainingView('calendar')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              trainingView === 'calendar'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendrier
          </button>
          <button
            type="button"
            onClick={() => setTrainingView('requests')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              trainingView === 'requests'
                ? 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Demandes (Temps réel)
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      )}

      {trainingView === 'requests' ? (
        <TrainingRequestsRealtimePanel
          actorSpace={activeSpace}
          actorId={session?.userId}
          actorName={session?.name}
          actorOrgName={organization.name}
          allowCreateRequest={true}
          onNotify={notify}
        />
      ) : trainingView === 'calendar' ? (
        <CalendarView
          events={events}
          programs={programs}
          defaultFilter="trainings"
          canRescheduleEvent={true}
          canRescheduleTraining={canCreateTraining}
          onReschedule={handleReschedule}
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canCreateTraining && (
          <form
            onSubmit={addProgram}
            className="lg:col-span-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3 h-fit"
          >
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Publier un programme certifiant
            </h3>
            <input
              type="text"
              required
              value={trTitle}
              onChange={(e) => setTrTitle(e.target.value)}
              placeholder="Nom de la formation"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
            />
            <input
              type="text"
              value={trInstructor}
              onChange={(e) => setTrInstructor(e.target.value)}
              placeholder="Nom du formateur"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={trModality}
                onChange={(e) => setTrModality(e.target.value as TrainingModality)}
                aria-label="Modalité B2B"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                <option value="EN_LIGNE">En ligne</option>
                <option value="HYBRIDE">Hybride</option>
                <option value="PRESENTIEL">Présentiel</option>
              </select>
              <input
                type="date"
                value={trStartDate}
                onChange={(e) => setTrStartDate(e.target.value)}
                aria-label="Date de début"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={trCategory}
              onChange={(e) => setTrCategory(e.target.value)}
              placeholder="Domaine"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={7}
                value={trHours}
                onChange={(e) => setTrHours(Number(e.target.value))}
                placeholder="Heures"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
              <input
                type="number"
                min={0}
                step={10000}
                value={trFee}
                onChange={(e) => setTrFee(Number(e.target.value))}
                placeholder="Tarif FCFA"
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Publier au catalogue synchronisé
            </button>
          </form>
        )}

        <div className={canCreateTraining ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {trainingView === 'list' ? (
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Sessions de formation ({programs.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4">Nom de la formation</th>
                      <th className="py-3 px-4">Formateur</th>
                      <th className="py-3 px-4">Date de début</th>
                      <th className="py-3 px-4">Statut d’inscription</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {programs.map((prog) => {
                      const status =
                        prog.registrationStatus || computeRegistrationStatus(prog.enrolled, prog.maxSeats);
                      const badge = REG_STATUS_META[status];
                      return (
                        <tr
                          key={prog.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{prog.title}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold">
                                {MODALITY_LABELS[prog.modality || 'HYBRIDE']}
                              </span>
                              <span>{prog.category}</span>
                              <span>·</span>
                              <span className="font-mono">{prog.durationHours}h</span>
                              <span>·</span>
                              <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                                {formatFcfa(prog.feeFcfa)}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300 text-xs font-medium">
                              <ProfileAvatar src={prog.instructorAvatarUrl} name={prog.instructor} size="xs" tone="blue" />
                              <span>{prog.instructor}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {prog.nextSession}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                              <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                {prog.enrolled}/{prog.maxSeats} places
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programs.map((prog) => {
                const status = prog.registrationStatus || computeRegistrationStatus(prog.enrolled, prog.maxSeats);
                const badge = REG_STATUS_META[status];
                return (
                  <div
                    key={prog.id}
                    className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className={`px-2 py-0.5 rounded font-semibold ${badge.className}`}>{badge.label}</span>
                      {prog.certified && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                          <Award className="w-3.5 h-3.5" />
                          Certifiant
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100">{prog.title}</h4>
                    <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <ProfileAvatar src={prog.instructorAvatarUrl} name={prog.instructor} size="xs" tone="blue" />
                      <span>{prog.instructor}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Début : {prog.nextSession}
                      </span>
                      <span className="font-mono">{prog.durationHours}h</span>
                    </div>
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
                      <span className="font-mono font-bold text-gray-900 dark:text-gray-100">
                        {formatFcfa(prog.feeFcfa)}
                      </span>
                      <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                        {prog.enrolled}/{prog.maxSeats} apprenants
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
