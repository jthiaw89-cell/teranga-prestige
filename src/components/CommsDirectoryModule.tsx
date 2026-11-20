import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  CheckCircle2,
  Mail,
  Megaphone,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import { CompanyLogo, ProfileAvatar } from './ui/MediaAvatar';
import type {
  AuthSessionSummary,
  CommsOverviewPayload,
  OfficialMemoImportance,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type CommsTab = 'memos' | 'polls' | 'directory';

const IMPORTANCE_TONES: Record<OfficialMemoImportance, { label: string; cls: string }> = {
  INFORMATION: { label: 'Information', cls: 'text-blue-700 dark:text-blue-300' },
  IMPORTANT: { label: 'Important', cls: 'text-amber-700 dark:text-amber-300 font-semibold' },
  URGENT: { label: 'Urgent', cls: 'text-rose-700 dark:text-rose-300 font-bold' },
};

export const CommsDirectoryModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<CommsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<CommsTab>('memos');

  const [dirSearch, setDirSearch] = useState('');
  const [dirSiteFilter, setDirSiteFilter] = useState('ALL');

  // New Memo Modal
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoBody, setMemoBody] = useState('');
  const [memoImportance, setMemoImportance] = useState<OfficialMemoImportance>('IMPORTANT');
  const [memoAudience, setMemoAudience] = useState('Toute l’organisation');
  const [memoRequireAck, setMemoRequireAck] = useState(true);
  const [memoPinned, setMemoPinned] = useState(false);

  // New Poll
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('Option A, Option B, Option C');

  const loadComms = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/comms/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement impossible.');
        return;
      }
      setData(payload as CommsOverviewPayload);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadComms(false);
  }, [loadComms]);

  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    return (data?.directory || []).filter((m) => {
      if (dirSiteFilter !== 'ALL' && m.site !== dirSiteFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.jobTitle.toLowerCase().includes(q) ||
        m.department.toLowerCase().includes(q) ||
        m.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [data?.directory, dirSearch, dirSiteFilter]);

  const sites = useMemo(
    () => Array.from(new Set((data?.directory || []).map((m) => m.site))),
    [data?.directory],
  );

  async function ackMemo(id: string) {
    const res = await fetch(`/api/comms/memos/${id}/read`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      setData((await res.json()) as CommsOverviewPayload);
      setNotice('Accusé de lecture enregistré.');
    }
  }

  async function remindMemo(id: string) {
    const res = await fetch(`/api/comms/memos/${id}/remind`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
    });
    if (res.ok) {
      setData((await res.json()) as CommsOverviewPayload);
      setNotice('Relance multicanale envoyée aux non-lecteurs.');
    }
  }

  async function publishMemo(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/comms/memos', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        title: memoTitle,
        body: memoBody,
        importance: memoImportance,
        audienceLabel: memoAudience,
        requiresAck: memoRequireAck,
        pinned: memoPinned,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Publication impossible.');
      return;
    }
    setData(payload as CommsOverviewPayload);
    setMemoOpen(false);
    setMemoTitle('');
    setMemoBody('');
    setNotice('Note de service numérotée publiée.');
  }

  async function votePoll(pollId: string, optionId: string) {
    const res = await fetch(`/api/comms/polls/${pollId}/vote`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ optionId }),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Vote impossible.');
      return;
    }
    setData(payload as CommsOverviewPayload);
    setNotice('Participation enregistrée.');
  }

  async function createPoll(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/comms/polls', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        question: pollQuestion,
        options: pollOptions.split(',').map((s) => s.trim()).filter(Boolean),
        anonymous: true,
      }),
    });
    if (res.ok) {
      setData((await res.json()) as CommsOverviewPayload);
      setPollOpen(false);
      setPollQuestion('');
      setNotice('Sondage interne publié.');
    }
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const stats = data?.stats || { publishedMemos: 0, unreadRequiredMemos: 0, openPolls: 0, directoryCount: 0 };

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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Notes de service publiées</span>
            <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.publishedMemos}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Lectures obligatoires à signer</span>
            <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.unreadRequiredMemos}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Sondages internes ouverts</span>
            <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.openPolls}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Annuaire collaborateurs</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.directoryCount}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {(
            [
              { id: 'memos', label: 'Notes de service & Annonces' },
              { id: 'polls', label: 'Sondages internes' },
              { id: 'directory', label: 'Annuaire interne' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
                tab === t.id ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadComms(true)}
            aria-label="Actualiser"
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {tab === 'polls' && (
            <button
              type="button"
              onClick={() => setPollOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau sondage</span>
            </button>
          )}
          {data?.canPublishMemo && tab !== 'polls' && (
            <button
              type="button"
              onClick={() => setMemoOpen(true)}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Publier une note</span>
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: OFFICIAL MEMOS */}
      {tab === 'memos' && (
        <div className="space-y-4">
          {(data?.memos || []).map((memo) => {
            const imp = IMPORTANCE_TONES[memo.importance];
            const hasRead = memo.readByUserIds.includes(session.userId);
            const readRate = Math.min(100, Math.round((memo.readByUserIds.length / Math.max(1, memo.targetAudienceCount)) * 100));
            return (
              <article
                key={memo.id}
                className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                    {memo.pinned && <Pin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                    <span>{memo.reference}</span>
                    <span aria-hidden="true">·</span>
                    <span className={imp.cls}>{imp.label}</span>
                    <span aria-hidden="true">·</span>
                    <span>{memo.audienceLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{memo.publishedAt.slice(0, 10)}</span>
                  </div>
                  <span className="font-mono tabular-nums text-xs">
                    Taux de lecture : {readRate}% ({memo.readByUserIds.length}/{memo.targetAudienceCount})
                  </span>
                </div>

                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{memo.title}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{memo.body}</p>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Signataire : {memo.authorName} ({memo.authorRole})
                    {memo.lastReminderAt && ` · Relancée le ${memo.lastReminderAt.slice(0, 10)}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {memo.requiresAck && !hasRead && (
                      <button
                        type="button"
                        onClick={() => void ackMemo(memo.id)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        J’ai lu et pris connaissance
                      </button>
                    )}
                    {hasRead && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" /> Lecture confirmée
                      </span>
                    )}
                    {data?.canPublishMemo && (
                      <button
                        type="button"
                        onClick={() => void remindMemo(memo.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Relancer les non-lecteurs
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* TAB 2: POLLS */}
      {tab === 'polls' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(data?.polls || []).map((poll) => {
            const hasVoted = poll.votedUserIds.includes(session.userId);
            const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
            return (
              <div
                key={poll.id}
                className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
              >
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{poll.anonymous ? 'Sondage anonyme' : 'Sondage nominatif'} · par {poll.createdByName}</span>
                  <span className="font-mono tabular-nums">{totalVotes} vote(s)</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{poll.question}</h3>
                <div className="space-y-2 pt-1">
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={hasVoted}
                        onClick={() => void votePoll(poll.id, opt.id)}
                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-medium text-gray-900 dark:text-gray-100">
                          <span>{opt.label}</span>
                          <span className="font-mono tabular-nums">{pct}% ({opt.votes})</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 3: DIRECTORY */}
      {tab === 'directory' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dirSearch}
                onChange={(e) => setDirSearch(e.target.value)}
                placeholder="Rechercher par nom, poste, direction, compétence..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
            </div>
            <select
              value={dirSiteFilter}
              onChange={(e) => setDirSiteFilter(e.target.value)}
              aria-label="Filtrer par site"
              className="min-h-[40px] px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
            >
              <option value="ALL">Tous les sites</option>
              {sites.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDirectory.map((member) => (
              <div
                key={member.userId}
                className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <ProfileAvatar src={member.avatarUrl} name={member.name} size="md" tone="blue" />
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{member.name}</h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{member.jobTitle}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 shrink-0">{member.role}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {member.companyLogoUrl && (
                    <CompanyLogo src={member.companyLogoUrl} name={member.department} size="xs" />
                  )}
                  <span className="truncate">{member.department} · {member.site}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{member.hidePersonalPhone ? 'Numéro masqué (confidentialité)' : member.phone}</span>
                  </div>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  Compétences : {member.skills.join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Publish Memo Modal */}
      {memoOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void publishMemo(e)}
            className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Publier une note de service</h3>
              <button type="button" onClick={() => setMemoOpen(false)} aria-label="Fermer">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={memoTitle}
                onChange={(e) => setMemoTitle(e.target.value)}
                placeholder="Titre de la note officielle"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={memoImportance}
                  onChange={(e) => setMemoImportance(e.target.value as OfficialMemoImportance)}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="INFORMATION">Information</option>
                  <option value="IMPORTANT">Important</option>
                  <option value="URGENT">Urgent (alerte multicanale)</option>
                </select>
                <input
                  type="text"
                  value={memoAudience}
                  onChange={(e) => setMemoAudience(e.target.value)}
                  placeholder="Audience ciblée"
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <textarea
                rows={4}
                required
                value={memoBody}
                onChange={(e) => setMemoBody(e.target.value)}
                placeholder="Contenu complet de la note de service..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={memoRequireAck} onChange={(e) => setMemoRequireAck(e.target.checked)} />
                <span>Accusé de réception obligatoire avec suivi de lecture</span>
              </label>
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={memoPinned} onChange={(e) => setMemoPinned(e.target.checked)} />
                <span>Épingler en tête de portail</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMemoOpen(false)} className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                Annuler
              </button>
              <button type="submit" className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                Publier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Poll Modal */}
      {pollOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void createPoll(e)}
            className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Créer un sondage interne</h3>
              <button type="button" onClick={() => setPollOpen(false)} aria-label="Fermer">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Question posée aux équipes"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                required
                value={pollOptions}
                onChange={(e) => setPollOptions(e.target.value)}
                placeholder="Choix séparés par des virgules"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPollOpen(false)} className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                Annuler
              </button>
              <button type="submit" className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                Publier le sondage
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
