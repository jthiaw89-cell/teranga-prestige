import React, { useState } from 'react';
import { Award, Calendar, GraduationCap, MapPin, Plus, Users } from 'lucide-react';
import type { EventRecord, OrganizationOption, TrainingProgram } from '../types';

interface Props {
  organization: OrganizationOption;
  mode: 'events' | 'training';
}

const INITIAL_EVENTS: EventRecord[] = [
  {
    id: 'ev-1',
    title: 'Forum Économique Souverain de Diamniadio',
    client: 'Ministère de l’Économie Numérique',
    date: '2026-12-04',
    venue: 'CICAD Diamniadio, Dakar',
    capacity: 600,
    registered: 485,
    budgetFcfa: 28500000,
    status: 'EN_COURS',
  },
  {
    id: 'ev-2',
    title: 'Gala Annuel & Remise des Prix Teranga Prestige',
    client: 'Consortium Bancaire UEMOA',
    date: '2026-12-18',
    venue: 'King Fahd Palace, Almadies',
    capacity: 300,
    registered: 240,
    budgetFcfa: 16200000,
    status: 'PLANIFIE',
  },
];

const INITIAL_PROGRAMS: TrainingProgram[] = [
  {
    id: 'tr-1',
    title: 'Gouvernance SYSCOHADA Révisé & Audit Financier',
    category: 'Finance & Conformité',
    durationHours: 35,
    nextSession: '2026-11-25',
    enrolled: 18,
    maxSeats: 24,
    feeFcfa: 450000,
    certified: true,
  },
  {
    id: 'tr-2',
    title: 'Architecture Cloud Souveraine & Cybersécurité',
    category: 'Ingénierie Numérique',
    durationHours: 42,
    nextSession: '2026-12-08',
    enrolled: 21,
    maxSeats: 25,
    feeFcfa: 520000,
    certified: true,
  },
  {
    id: 'tr-3',
    title: 'Direction Protocole & Scénographie Événementielle',
    category: 'Événementiel Corporate',
    durationHours: 28,
    nextSession: '2027-01-12',
    enrolled: 12,
    maxSeats: 20,
    feeFcfa: 380000,
    certified: true,
  },
];

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export const EventsTrainingModule: React.FC<Props> = ({ organization, mode }) => {
  const [events, setEvents] = useState<EventRecord[]>(INITIAL_EVENTS);
  const [programs, setPrograms] = useState<TrainingProgram[]>(INITIAL_PROGRAMS);

  // Add event form
  const [evTitle, setEvTitle] = useState('');
  const [evClient, setEvClient] = useState('');
  const [evDate, setEvDate] = useState('2026-12-20');
  const [evVenue, setEvVenue] = useState('');
  const [evCapacity, setEvCapacity] = useState(150);

  // Add training form
  const [trTitle, setTrTitle] = useState('');
  const [trCategory, setTrCategory] = useState('Management & Leadership');
  const [trHours, setTrHours] = useState(24);
  const [trFee, setTrFee] = useState(350000);

  function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evTitle.trim()) return;
    setEvents((prev) => [
      {
        id: `ev-${Date.now()}`,
        title: evTitle.trim(),
        client: evClient.trim() || organization.name,
        date: evDate,
        venue: evVenue.trim() || organization.city,
        capacity: Number(evCapacity) || 100,
        registered: 0,
        budgetFcfa: 5000000,
        status: 'PLANIFIE',
      },
      ...prev,
    ]);
    setEvTitle('');
    setEvClient('');
    setEvVenue('');
  }

  function addProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!trTitle.trim()) return;
    setPrograms((prev) => [
      {
        id: `tr-${Date.now()}`,
        title: trTitle.trim(),
        category: trCategory,
        durationHours: Number(trHours) || 21,
        nextSession: '2027-01-19',
        enrolled: 0,
        maxSeats: 20,
        feeFcfa: Number(trFee) || 300000,
        certified: true,
      },
      ...prev,
    ]);
    setTrTitle('');
  }

  if (mode === 'events') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Pôle Événementiel Corporate</h2>
          <p className="text-sm text-neutral-500">
            Pilotage des sommets, galas, logistique VIP et jauge participants pour {organization.name}.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={addEvent} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-600" />
              Planifier un événement
            </h3>
            <input
              type="text"
              required
              value={evTitle}
              onChange={(e) => setEvTitle(e.target.value)}
              placeholder="Intitulé de l’événement"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <input
              type="text"
              value={evClient}
              onChange={(e) => setEvClient(e.target.value)}
              placeholder="Commanditaire / Institution"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={evDate}
                onChange={(e) => setEvDate(e.target.value)}
                className="px-3 py-2 text-sm border border-neutral-200 rounded-lg"
              />
              <input
                type="number"
                min={10}
                value={evCapacity}
                onChange={(e) => setEvCapacity(Number(e.target.value))}
                placeholder="Capacité"
                className="px-3 py-2 text-sm border border-neutral-200 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={evVenue}
              onChange={(e) => setEvVenue(e.target.value)}
              placeholder="Lieu (ex. Radisson Blu, Dakar)"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg"
            >
              Ajouter au calendrier
            </button>
          </form>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {events.map((ev) => {
              const fill = Math.min(100, Math.round((ev.registered / ev.capacity) * 100));
              return (
                <div key={ev.id} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded bg-sky-50 text-sky-800 text-xs font-semibold">
                      {ev.status}
                    </span>
                    <span className="font-mono text-xs text-neutral-500">{ev.date}</span>
                  </div>
                  <h4 className="font-bold text-neutral-900">{ev.title}</h4>
                  <div className="text-xs text-neutral-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-neutral-400" />
                      {ev.client}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                      {ev.venue}
                    </div>
                  </div>
                  <div className="pt-2 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-neutral-500">Accréditations</span>
                      <span className="font-mono font-semibold">
                        {ev.registered} / {ev.capacity} ({fill}%)
                      </span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-600 rounded-full" style={{ width: `${fill}%` }} />
                    </div>
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-neutral-500">Budget estimé</span>
                      <span className="font-mono font-semibold text-neutral-900">{formatFcfa(ev.budgetFcfa)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEvents((prev) =>
                        prev.map((item) =>
                          item.id === ev.id && item.registered < item.capacity
                            ? { ...item, registered: item.registered + 1 }
                            : item,
                        ),
                      )
                    }
                    className="w-full py-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800"
                  >
                    + Enregistrer un participant
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Pôle Formation Professionnelle</h2>
        <p className="text-sm text-neutral-500">
          Catalogue des parcours certifiants, cohortes et inscriptions pour {organization.name}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={addProgram} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 h-fit">
          <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-sky-600" />
            Nouveau programme certifiant
          </h3>
          <input
            type="text"
            required
            value={trTitle}
            onChange={(e) => setTrTitle(e.target.value)}
            placeholder="Intitulé de la formation"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
          />
          <input
            type="text"
            value={trCategory}
            onChange={(e) => setTrCategory(e.target.value)}
            placeholder="Domaine"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={7}
              value={trHours}
              onChange={(e) => setTrHours(Number(e.target.value))}
              placeholder="Heures"
              className="px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <input
              type="number"
              min={50000}
              step={10000}
              value={trFee}
              onChange={(e) => setTrFee(Number(e.target.value))}
              placeholder="Tarif FCFA"
              className="px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg"
          >
            Publier au catalogue
          </button>
        </form>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((prog) => (
            <div key={prog.id} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold">
                  {prog.category}
                </span>
                {prog.certified && (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                    <Award className="w-3.5 h-3.5" />
                    Certifiant
                  </span>
                )}
              </div>
              <h4 className="font-bold text-neutral-900">{prog.title}</h4>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Rentrée : {prog.nextSession}
                </span>
                <span className="font-mono">{prog.durationHours}h</span>
              </div>
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-sm">
                <span className="font-mono font-bold text-neutral-900">{formatFcfa(prog.feeFcfa)}</span>
                <span className="text-xs font-mono text-neutral-600">
                  {prog.enrolled}/{prog.maxSeats} apprenants
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPrograms((prev) =>
                    prev.map((item) =>
                      item.id === prog.id && item.enrolled < item.maxSeats
                        ? { ...item, enrolled: item.enrolled + 1 }
                        : item,
                    ),
                  )
                }
                className="w-full py-2 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-semibold text-neutral-800"
              >
                + Inscrire un apprenant
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
