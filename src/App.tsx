import React, { useState } from 'react';
import {
  Briefcase,
  Building2,
  Calculator,
  CalendarDays,
  FileText,
  GraduationCap,
  MessageSquareLock,
  ShieldCheck,
} from 'lucide-react';
import { AccountingModule } from './components/AccountingModule';
import { CrmDocumentsModule } from './components/CrmDocumentsModule';
import { EventsTrainingModule } from './components/EventsTrainingModule';
import { IntranetModule } from './components/IntranetModule';
import type { OrganizationOption } from './types';

const ORGANIZATIONS: OrganizationOption[] = [
  {
    id: 'tenant-senelec',
    name: 'Senelec Digital',
    sector: 'Énergie & Services Numériques',
    ninea: '000148720 2G1',
    city: 'Dakar, Sénégal',
  },
  {
    id: 'teranga-events',
    name: 'Teranga Prestige Événementiel',
    sector: 'Sommets, Protocoles & Scénographie',
    ninea: '005892104 1C4',
    city: 'Diamniadio, Sénégal',
  },
  {
    id: 'teranga-academy',
    name: 'Institut Teranga Formation',
    sector: 'Formation Professionnelle & Certifications',
    ninea: '006741920 3B2',
    city: 'Dakar Plateau, Sénégal',
  },
];

type ActiveSection = 'crm' | 'accounting' | 'intranet' | 'events' | 'training';

const NAV_ITEMS: { id: ActiveSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'crm', label: 'Commandes & Documents', icon: FileText },
  { id: 'accounting', label: 'Comptabilité SYSCOHADA', icon: Calculator },
  { id: 'intranet', label: 'Intranet Personnel', icon: MessageSquareLock },
  { id: 'events', label: 'Événementiel', icon: CalendarDays },
  { id: 'training', label: 'Formation Pro', icon: GraduationCap },
];

export default function App() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>(ORGANIZATIONS[0].id);
  const [activeSection, setActiveSection] = useState<ActiveSection>('crm');

  const currentOrg = ORGANIZATIONS.find((o) => o.id === selectedOrgId) || ORGANIZATIONS[0];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-sm">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900">
                  Teranga Prestige Digital
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  Souverain
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Bureau numérique · Comptabilité SYSCOHADA · Événementiel · Formation professionnelle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-neutral-400" />
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              aria-label="Organisation active"
              className="px-3 py-1.5 text-sm font-medium bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800"
            >
              {ORGANIZATIONS.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1.5 overflow-x-auto pb-2.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${
                  active
                    ? 'bg-neutral-900 text-white shadow-sm'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeSection === 'crm' && <CrmDocumentsModule organization={currentOrg} />}
        {activeSection === 'accounting' && <AccountingModule />}
        {activeSection === 'intranet' && <IntranetModule />}
        {activeSection === 'events' && <EventsTrainingModule organization={currentOrg} mode="events" />}
        {activeSection === 'training' && <EventsTrainingModule organization={currentOrg} mode="training" />}
      </main>
    </div>
  );
}
