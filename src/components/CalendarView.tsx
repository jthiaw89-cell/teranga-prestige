import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  GripVertical,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import type { EventRecord, TrainingModality, TrainingProgram } from '../types';

export type CalendarGranularity = 'month' | 'week' | 'day';
export type CalendarFilter = 'all' | 'events' | 'trainings';

export interface CalendarItem {
  id: string;
  kind: 'event' | 'training';
  title: string;
  date: string;
  startHour: number;
  durationHours: number;
  subtitle: string;
  location: string;
  metaLabel: string;
  canDrag: boolean;
  rawEvent?: EventRecord;
  rawProgram?: TrainingProgram;
}

interface CalendarViewProps {
  events: EventRecord[];
  programs: TrainingProgram[];
  defaultFilter?: CalendarFilter;
  canRescheduleEvent: boolean;
  canRescheduleTraining: boolean;
  onReschedule: (
    item: CalendarItem,
    nextDate: string,
    nextStartHour?: number,
  ) => Promise<void> | void;
}

const MODALITY_LABELS: Record<TrainingModality, string> = {
  EN_LIGNE: 'En ligne',
  HYBRIDE: 'Hybride',
  PRESENTIEL: 'Présentiel',
};

const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function parseIsoDate(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  return new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
  return next;
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0 = Sun, 1 = Mon...
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(n)} FCFA`;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  events,
  programs,
  defaultFilter = 'all',
  canRescheduleEvent,
  canRescheduleTraining,
  onReschedule,
}) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const allItems = useMemo<CalendarItem[]>(() => {
    const eventItems: CalendarItem[] = events.map((ev, idx) => ({
      id: ev.id,
      kind: 'event',
      title: ev.title,
      date: ev.date,
      startHour: ev.startHour ?? (9 + (idx % 3) * 2),
      durationHours: 3,
      subtitle: ev.client,
      location: ev.venue,
      metaLabel: `${ev.registered}/${ev.capacity} participants · ${formatFcfa(ev.budgetFcfa)}`,
      canDrag: canRescheduleEvent,
      rawEvent: ev,
    }));

    const trainingItems: CalendarItem[] = programs.map((prog, idx) => ({
      id: prog.id,
      kind: 'training',
      title: prog.title,
      date: prog.nextSession,
      startHour: prog.startHour ?? (10 + (idx % 3) * 2),
      durationHours: Math.min(4, Math.max(2, Math.round(prog.durationHours / 8))),
      subtitle: prog.instructor,
      location: MODALITY_LABELS[prog.modality || 'HYBRIDE'],
      metaLabel: `${prog.enrolled}/${prog.maxSeats} places · ${formatFcfa(prog.feeFcfa)}`,
      canDrag: canRescheduleTraining,
      rawProgram: prog,
    }));

    return [...eventItems, ...trainingItems].sort((a, b) =>
      a.date === b.date ? a.startHour - b.startHour : a.date.localeCompare(b.date),
    );
  }, [canRescheduleEvent, canRescheduleTraining, events, programs]);

  const [granularity, setGranularity] = useState<CalendarGranularity>('month');
  const [filter, setFilter] = useState<CalendarFilter>(defaultFilter);
  const [cursorDate, setCursorDate] = useState<Date>(() => {
    const initialList =
      defaultFilter === 'events'
        ? events.map((e) => e.date)
        : defaultFilter === 'trainings'
        ? programs.map((p) => p.nextSession)
        : [...events.map((e) => e.date), ...programs.map((p) => p.nextSession)];
    const sorted = initialList.filter(Boolean).sort();
    return sorted.length > 0 ? parseIsoDate(sorted[0]) : new Date();
  });

  const [draggedPayload, setDraggedPayload] = useState<{
    id: string;
    kind: 'event' | 'training';
  } | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editHour, setEditHour] = useState(9);

  const visibleItems = useMemo(() => {
    if (filter === 'events') return allItems.filter((i) => i.kind === 'event');
    if (filter === 'trainings') return allItems.filter((i) => i.kind === 'training');
    return allItems;
  }, [allItems, filter]);

  const selectedItem = useMemo(
    () => visibleItems.find((i) => i.id === selectedItemId) ?? null,
    [selectedItemId, visibleItems],
  );

  function selectItem(item: CalendarItem) {
    setSelectedItemId(item.id);
    setEditDate(item.date);
    setEditHour(item.startHour);
  }

  function navigatePeriod(direction: -1 | 1) {
    if (granularity === 'month') {
      setCursorDate((d) => new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else if (granularity === 'week') {
      setCursorDate((d) => addDays(d, direction * 7));
    } else {
      setCursorDate((d) => addDays(d, direction));
    }
  }

  const periodLabel = useMemo(() => {
    if (granularity === 'month') {
      const label = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(cursorDate);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (granularity === 'week') {
      const start = startOfWeekMonday(cursorDate);
      const end = addDays(start, 6);
      const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
      return `Semaine du ${fmt.format(start)} au ${fmt.format(end)} ${end.getFullYear()}`;
    }
    const label = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(cursorDate);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [cursorDate, granularity]);

  const monthCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const gridStart = startOfWeekMonday(firstOfMonth);
    const cells: { date: Date; iso: string; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(gridStart, i);
      cells.push({
        date: d,
        iso: toIsoDate(d),
        inMonth: d.getMonth() === month,
      });
    }
    // Trim trailing 7 cells if the entire last row belongs to next month
    const lastRowInMonth = cells.slice(35).some((c) => c.inMonth);
    return lastRowInMonth ? cells : cells.slice(0, 35);
  }, [cursorDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(cursorDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      return {
        date: d,
        iso: toIsoDate(d),
        shortLabel: WEEKDAY_SHORT[i],
        dayNum: d.getDate(),
        monthShort: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d),
      };
    });
  }, [cursorDate]);

  const cursorIso = useMemo(() => toIsoDate(cursorDate), [cursorDate]);

  function handleDragStart(e: React.DragEvent, item: CalendarItem) {
    if (!item.canDrag) {
      e.preventDefault();
      return;
    }
    setDraggedPayload({ id: item.id, kind: item.kind });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, kind: item.kind }));
  }

  function handleDragOver(e: React.DragEvent, key: string) {
    if (!draggedPayload) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetKey !== key) setDropTargetKey(key);
  }

  function handleDropOnTarget(e: React.DragEvent, nextDate: string, nextHour?: number) {
    e.preventDefault();
    setDropTargetKey(null);
    let payload = draggedPayload;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData('text/plain');
        if (raw) payload = JSON.parse(raw) as { id: string; kind: 'event' | 'training' };
      } catch {
        payload = null;
      }
    }
    setDraggedPayload(null);
    if (!payload) return;

    const item = allItems.find((i) => i.id === payload?.id && i.kind === payload?.kind);
    if (!item || !item.canDrag) return;
    if (item.date === nextDate && (nextHour === undefined || item.startHour === nextHour)) return;

    void onReschedule(item, nextDate, nextHour);
    if (selectedItemId === item.id) {
      setEditDate(nextDate);
      if (nextHour !== undefined) setEditHour(nextHour);
    }
  }

  function renderItemPill(item: CalendarItem, compact = false) {
    const isEvent = item.kind === 'event';
    const isSelected = selectedItemId === item.id;
    const colorClass = isEvent
      ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800/80 hover:border-blue-400 dark:hover:border-blue-600'
      : 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800/80 hover:border-emerald-400 dark:hover:border-emerald-600';

    return (
      <div
        key={`${item.kind}-${item.id}`}
        draggable={item.canDrag}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={() => {
          setDraggedPayload(null);
          setDropTargetKey(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectItem(item);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectItem(item);
          }
        }}
        title={
          item.canDrag
            ? `${item.title} — Glisser-déposer pour replanifier`
            : `${item.title} — Cliquer pour afficher les détails`
        }
        className={`group rounded-lg border px-2 py-1.5 text-left transition-all ${colorClass} ${
          item.canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        } ${isSelected ? 'ring-2 ring-blue-600 dark:ring-blue-400' : ''}`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {isEvent ? (
              <CalendarIcon className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
            ) : (
              <GraduationCap className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <span className="font-mono text-[10px] font-semibold tabular-nums shrink-0 opacity-80">
              {formatHour(item.startHour)}
            </span>
          </div>
          {item.canDrag && (
            <GripVertical className="w-3 h-3 opacity-40 group-hover:opacity-90 shrink-0" />
          )}
        </div>
        <div className={`font-semibold leading-snug text-[11px] mt-0.5 ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}>
          {item.title}
        </div>
        {!compact && (
          <div className="text-[10px] opacity-75 truncate mt-0.5">
            {item.location} · {item.subtitle}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Calendar Top Controls Bar */}
      <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Period Nav */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">
              <button
                type="button"
                onClick={() => navigatePeriod(-1)}
                aria-label="Période précédente"
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCursorDate(new Date())}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 border-x border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => navigatePeriod(1)}
                aria-label="Période suivante"
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 ml-1 whitespace-nowrap">
              {periodLabel}
            </h3>
          </div>

          {/* Right: Filter + Granularity Switchers */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Tout' },
                  { id: 'events', label: 'Événements' },
                  { id: 'trainings', label: 'Formations' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    filter === opt.id
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg">
              {(
                [
                  { id: 'month', label: 'Mois' },
                  { id: 'week', label: 'Semaine' },
                  { id: 'day', label: 'Jour' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setGranularity(opt.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                    granularity === opt.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Upcoming Quick-Jump Strip & Drag Instruction */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-500 dark:text-gray-400 font-medium mr-1">Accès rapide :</span>
            {visibleItems.length === 0 ? (
              <span className="text-gray-400 dark:text-gray-500">Aucun créneau planifié dans ce filtre</span>
            ) : (
              visibleItems.slice(0, 4).map((item) => (
                <button
                  key={`jump-${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => {
                    setCursorDate(parseIsoDate(item.date));
                    selectItem(item);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors whitespace-nowrap ${
                    item.kind === 'event'
                      ? 'border-blue-200 dark:border-blue-800/70 bg-blue-50/60 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100/70'
                      : 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70'
                  }`}
                >
                  <span className="font-mono tabular-nums">{item.date.slice(5).split('-').reverse().join('/')}</span>
                  <span className="max-w-[140px] truncate">{item.title}</span>
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" />
              Événement
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
              Formation
            </span>
          </div>
        </div>
      </div>

      {/* MONTH VIEW */}
      {granularity === 'month' && (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
            {WEEKDAY_SHORT.map((day) => (
              <div
                key={day}
                className="py-2.5 px-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 dark:divide-gray-800">
            {monthCells.map((cell) => {
              const dayItems = visibleItems.filter((i) => i.date === cell.iso);
              const isToday = cell.iso === todayIso;
              const isOver = dropTargetKey === `month-${cell.iso}`;

              return (
                <div
                  key={cell.iso}
                  onDragOver={(e) => handleDragOver(e, `month-${cell.iso}`)}
                  onDragLeave={() => {
                    if (dropTargetKey === `month-${cell.iso}`) setDropTargetKey(null);
                  }}
                  onDrop={(e) => handleDropOnTarget(e, cell.iso)}
                  className={`min-h-[118px] p-2 flex flex-col gap-1.5 transition-colors ${
                    !cell.inMonth
                      ? 'bg-gray-50/60 dark:bg-gray-950/50 text-gray-400 dark:text-gray-600'
                      : 'bg-white dark:bg-gray-900'
                  } ${isOver ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500/70' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setCursorDate(cell.date);
                        setGranularity('day');
                      }}
                      title="Ouvrir la vue jour"
                      className={`w-6 h-6 rounded-md text-xs font-mono tabular-nums inline-flex items-center justify-center transition-colors ${
                        isToday
                          ? 'bg-blue-600 text-white font-bold'
                          : cell.inMonth
                          ? 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-semibold'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {cell.date.getDate()}
                    </button>
                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-gray-400 dark:text-gray-500">
                        {dayItems.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayItems.map((item) => renderItemPill(item, true))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {granularity === 'week' && (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
              <div className="py-3 px-3 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
                Heure
              </div>
              {weekDays.map((wd) => {
                const isToday = wd.iso === todayIso;
                return (
                  <button
                    key={wd.iso}
                    type="button"
                    onClick={() => {
                      setCursorDate(wd.date);
                      setGranularity('day');
                    }}
                    className={`py-2.5 px-2 text-center border-l border-gray-200 dark:border-gray-800 hover:bg-gray-100/70 dark:hover:bg-gray-800 transition-colors ${
                      isToday ? 'bg-blue-50/70 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <div className="text-[11px] font-medium uppercase text-gray-500 dark:text-gray-400">
                      {wd.shortLabel}
                    </div>
                    <div
                      className={`text-sm font-mono tabular-nums font-bold mt-0.5 ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {wd.dayNum} {wd.monthShort}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {HOURS.map((hour) => (
                <div key={hour} className="grid grid-cols-8 min-h-[64px]">
                  <div className="py-2 px-3 text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-950/40 flex items-start">
                    {formatHour(hour)}
                  </div>
                  {weekDays.map((wd) => {
                    const slotItems = visibleItems.filter(
                      (i) => i.date === wd.iso && i.startHour === hour,
                    );
                    const slotKey = `week-${wd.iso}-${hour}`;
                    const isOver = dropTargetKey === slotKey;

                    return (
                      <div
                        key={slotKey}
                        onDragOver={(e) => handleDragOver(e, slotKey)}
                        onDragLeave={() => {
                          if (dropTargetKey === slotKey) setDropTargetKey(null);
                        }}
                        onDrop={(e) => handleDropOnTarget(e, wd.iso, hour)}
                        className={`p-1.5 border-l border-gray-100 dark:border-gray-800 space-y-1 transition-colors ${
                          isOver ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500/70' : ''
                        }`}
                      >
                        {slotItems.map((item) => renderItemPill(item, true))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {granularity === 'day' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
            {HOURS.map((hour) => {
              const slotItems = visibleItems.filter(
                (i) => i.date === cursorIso && i.startHour === hour,
              );
              const slotKey = `day-${cursorIso}-${hour}`;
              const isOver = dropTargetKey === slotKey;

              return (
                <div
                  key={slotKey}
                  onDragOver={(e) => handleDragOver(e, slotKey)}
                  onDragLeave={() => {
                    if (dropTargetKey === slotKey) setDropTargetKey(null);
                  }}
                  onDrop={(e) => handleDropOnTarget(e, cursorIso, hour)}
                  className={`grid grid-cols-12 min-h-[68px] transition-colors ${
                    isOver ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-2 ring-inset ring-blue-500/70' : ''
                  }`}
                >
                  <div className="col-span-2 sm:col-span-2 py-3 px-4 text-xs font-mono tabular-nums font-medium text-gray-500 dark:text-gray-400 bg-gray-50/60 dark:bg-gray-950/40 border-r border-gray-100 dark:border-gray-800">
                    {formatHour(hour)}
                  </div>
                  <div className="col-span-10 sm:col-span-10 p-2 space-y-2">
                    {slotItems.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {slotItems.map((item) => renderItemPill(item, false))}
                      </div>
                    ) : (
                      <div className="h-full min-h-[42px] flex items-center text-[11px] text-gray-300 dark:text-gray-700 select-none">
                        Créneau libre
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Programme du jour
                </h4>
                <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {visibleItems.filter((i) => i.date === cursorIso).length} élément(s)
                </span>
              </div>

              {visibleItems.filter((i) => i.date === cursorIso).length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Aucun créneau le <span className="font-mono">{cursorIso}</span>.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleItems
                    .filter((i) => i.date === cursorIso)
                    .map((item) => renderItemPill(item, false))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SELECTED ITEM INSPECTOR & MANUAL RESCHEDULE BAR */}
      {selectedItem && (
        <div className="border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={
                    selectedItem.kind === 'event'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {selectedItem.kind === 'event' ? 'Événement Corporate' : 'Session de Formation B2B'}
                </span>
                <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">·</span>
                <span className="font-mono text-gray-500 dark:text-gray-400">
                  {selectedItem.date} à {formatHour(selectedItem.startHour)}
                </span>
              </div>
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">{selectedItem.title}</h4>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  {selectedItem.subtitle}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  {selectedItem.location}
                </span>
                <span className="font-mono text-gray-700 dark:text-gray-300">{selectedItem.metaLabel}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemId(null)}
              aria-label="Fermer les détails"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedItem.canDrag && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editDate) return;
                void onReschedule(selectedItem, editDate, editHour);
                setCursorDate(parseIsoDate(editDate));
              }}
              className="flex flex-wrap items-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800"
            >
              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Nouvelle date
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Créneau horaire
                </label>
                <select
                  value={editHour}
                  onChange={(e) => setEditHour(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Replanifier ce créneau
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
