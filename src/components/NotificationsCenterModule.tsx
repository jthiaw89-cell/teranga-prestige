import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Mail,
  MessageSquare,
  Moon,
  RefreshCw,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  NotificationItem,
  NotificationPreferences,
  NotificationsOverviewPayload,
} from '../types';

interface Props {
  session: AuthSessionSummary;
  onNavigateSection?: (section: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsCenterModule: React.FC<Props> = ({
  session,
  onNavigateSection,
  onUnreadCountChange,
}) => {
  const [data, setData] = useState<NotificationsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filterCat, setFilterCat] = useState<'ALL' | NotificationItem['category']>('ALL');

  const loadNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/notifications/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement impossible.');
        return;
      }
      const typed = payload as NotificationsOverviewPayload;
      setData(typed);
      onUnreadCountChange?.(typed.unreadCount);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange, session.space]);

  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  const filtered = useMemo(() => {
    return (data?.notifications || []).filter(
      (n) => filterCat === 'ALL' || n.category === filterCat,
    );
  }, [data?.notifications, filterCat]);

  async function markRead(id: string) {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      const typed = (await res.json()) as NotificationsOverviewPayload;
      setData(typed);
      onUnreadCountChange?.(typed.unreadCount);
    }
  }

  async function markAllRead() {
    const res = await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      const typed = (await res.json()) as NotificationsOverviewPayload;
      setData(typed);
      onUnreadCountChange?.(typed.unreadCount);
      setNotice('Toutes les notifications ont été marquées comme lues.');
    }
  }

  async function updatePrefs(patch: Partial<NotificationPreferences>) {
    const res = await fetch('/api/notifications/preferences', {
      method: 'PUT',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const typed = (await res.json()) as NotificationsOverviewPayload;
      setData(typed);
      setNotice('Préférences de notification mises à jour.');
    }
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const prefs = data?.preferences;
  const delivery = data?.deliveryStats;

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
          <button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Alertes non lues</span>
            <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {data?.unreadCount ?? 0}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Délivrabilité multicanale (24h)</span>
            <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {delivery?.deliveryRatePct ?? 99.4}%
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {delivery?.sent24h ?? 0} envois
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Quota SMS local utilisé</span>
            <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {delivery?.smsQuotaUsed ?? 0} / {delivery?.smsQuotaLimit ?? 500}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-2">
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value as 'ALL' | NotificationItem['category'])}
              aria-label="Filtrer par catégorie"
              className="min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Toutes catégories</option>
              <option value="RH">RH & Congés</option>
              <option value="WORKFLOW">Demandes & Validations</option>
              <option value="NOTE_SERVICE">Notes de service</option>
              <option value="GED">GED & Bulletins</option>
              <option value="SYSTEME">Système & Facturation</option>
            </select>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadNotifications(true)}
                aria-label="Actualiser"
                className="min-h-[38px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Tout marquer lu</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                Aucune notification dans cette catégorie.
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    !n.read ? 'bg-blue-50/40 dark:bg-blue-950/15' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                      <span>{n.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className={n.priority === 'URGENTE' ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                        {n.priority}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{n.channelsSent.join(' + ')}</span>
                      <span aria-hidden="true">·</span>
                      <span>{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{n.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {n.targetSection && onNavigateSection && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.read) void markRead(n.id);
                          onNavigateSection(n.targetSection!);
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-blue-600 dark:text-blue-400"
                      >
                        Ouvrir
                      </button>
                    )}
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => void markRead(n.id)}
                        title="Marquer comme lu"
                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Multichannel Preferences */}
        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4 h-fit">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
            Mes préférences de réception
          </h3>
          {prefs && (
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                  <Bell className="w-4 h-4 text-blue-600" /> Centre In-App
                </span>
                <input
                  type="checkbox"
                  checked={prefs.inAppEnabled}
                  onChange={(e) => void updatePrefs({ inAppEnabled: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                  <Mail className="w-4 h-4 text-emerald-600" /> E-mail (SMTP dédié)
                </span>
                <input
                  type="checkbox"
                  checked={prefs.emailEnabled}
                  onChange={(e) => void updatePrefs({ emailEnabled: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                  <MessageSquare className="w-4 h-4 text-amber-600" /> SMS (Urgences & Relances)
                </span>
                <input
                  type="checkbox"
                  checked={prefs.smsEnabled}
                  onChange={(e) => void updatePrefs({ smsEnabled: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                  <Smartphone className="w-4 h-4 text-indigo-600" /> Push Web / Mobile PWA
                </span>
                <input
                  type="checkbox"
                  checked={prefs.pushWebEnabled}
                  onChange={(e) => void updatePrefs({ pushWebEnabled: e.target.checked })}
                />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-800 dark:text-gray-200 font-medium">Résumé quotidien groupé (08h00)</span>
                <input
                  type="checkbox"
                  checked={prefs.dailyDigest}
                  onChange={(e) => void updatePrefs({ dailyDigest: e.target.checked })}
                />
              </label>

              <div className="pt-1 space-y-2">
                <label className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200 font-medium">
                    <Moon className="w-4 h-4 text-gray-500" /> Plage « Ne pas déranger »
                  </span>
                  <input
                    type="checkbox"
                    checked={prefs.quietHoursEnabled}
                    onChange={(e) => void updatePrefs({ quietHoursEnabled: e.target.checked })}
                  />
                </label>
                {prefs.quietHoursEnabled && (
                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <input
                      type="time"
                      value={prefs.quietStart}
                      onChange={(e) => void updatePrefs({ quietStart: e.target.value })}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                    <input
                      type="time"
                      value={prefs.quietEnd}
                      onChange={(e) => void updatePrefs({ quietEnd: e.target.value })}
                      className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
