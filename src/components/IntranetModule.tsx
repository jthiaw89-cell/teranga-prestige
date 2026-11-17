import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Hash, Lock, LogOut, MessageSquare, Paperclip, Send, UserPlus, Users } from 'lucide-react';

interface IntranetUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: 'OWNER' | 'DIRECTION' | 'MANAGER' | 'EMPLOYEE';
  title: string;
}

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string;
  isPrivate: boolean;
}

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

interface ChatMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  attachment?: Attachment;
  createdAt: string;
}

interface ForumTopic {
  id: string;
  channelId: string;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
  replies: { id: string; authorName: string; content: string; createdAt: string }[];
}

export const IntranetModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('tpd_intranet_token'));
  const [user, setUser] = useState<IntranetUser | null>(null);
  const [orgIdInput, setOrgIdInput] = useState('tpd-demo-intranet');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [members, setMembers] = useState<Omit<IntranetUser, 'organizationId' | 'organizationName'>[]>([]);

  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [mode, setMode] = useState<'chat' | 'forum' | 'team'>('chat');
  const [msgText, setMsgText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  // Forum state
  const [topicTitle, setTopicTitle] = useState('');
  const [topicBody, setTopicBody] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // Create employee state (Owner only)
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState<'DIRECTION' | 'MANAGER' | 'EMPLOYEE'>('EMPLOYEE');
  const [empTitle, setEmpTitle] = useState('');
  const [empPassword, setEmpPassword] = useState('');

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const loadWorkspace = useCallback(
    async (activeToken?: string | null) => {
      const hdrs: Record<string, string> = {};
      if (activeToken) hdrs.Authorization = `Bearer ${activeToken}`;
      const res = await fetch('/api/intranet/workspace', { headers: hdrs, credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setChannels(data.channels || []);
      setMessages(data.messages || []);
      setTopics(data.topics || []);
      setMembers(data.members || []);
      setActiveChannelId((prev) => prev || data.channels?.[0]?.id || '');
    },
    [],
  );

  useEffect(() => {
    (async () => {
      const hdrs: Record<string, string> = {};
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/intranet/auth/me', { headers: hdrs, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await loadWorkspace(token);
      }
    })();
  }, [loadWorkspace, token]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      void loadWorkspace(token);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadWorkspace, token, user]);

  async function login(demoRole?: 'OWNER' | 'MANAGER' | 'EMPLOYEE') {
    setError('');
    const res = await fetch('/api/intranet/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(demoRole ? { demoRole } : { organizationId: orgIdInput, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Connexion refusée.');
      return;
    }
    sessionStorage.setItem('tpd_intranet_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setActiveChannelId('');
    await loadWorkspace(data.token);
  }

  async function logout() {
    await fetch('/api/intranet/auth/logout', { method: 'POST', headers: authHeaders, credentials: 'include' });
    sessionStorage.removeItem('tpd_intranet_token');
    setToken(null);
    setUser(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux (limite 5 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingAttachment({
        id: `att-${Date.now()}`,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl: String(reader.result || ''),
      });
    };
    reader.readAsDataURL(file);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannelId || (!msgText.trim() && !pendingAttachment)) return;
    const res = await fetch('/api/intranet/messages', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        channelId: activeChannelId,
        content: msgText,
        attachment: pendingAttachment ?? undefined,
      }),
    });
    if (res.ok) {
      setMsgText('');
      setPendingAttachment(null);
      await loadWorkspace(token);
    }
  }

  async function createTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannelId || !topicTitle.trim() || !topicBody.trim()) return;
    const res = await fetch('/api/intranet/topics', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ channelId: activeChannelId, title: topicTitle, body: topicBody }),
    });
    if (res.ok) {
      setTopicTitle('');
      setTopicBody('');
      await loadWorkspace(token);
    }
  }

  async function submitReply(topicId: string) {
    const content = replyTexts[topicId];
    if (!content?.trim()) return;
    const res = await fetch(`/api/intranet/topics/${topicId}/replies`, {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setReplyTexts((prev) => ({ ...prev, [topicId]: '' }));
      await loadWorkspace(token);
    }
  }

  async function createEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/intranet/users', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        name: empName,
        email: empEmail,
        role: empRole,
        title: empTitle,
        password: empPassword,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Création impossible.');
      return;
    }
    setEmpName('');
    setEmpEmail('');
    setEmpTitle('');
    setEmpPassword('');
    await loadWorkspace(token);
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Intranet du Personnel</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Canaux isolés par rôle, forums internes et partage sécurisé de documents.
          </p>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs">{error}</div>}

        <div className="space-y-3">
          <input
            type="text"
            value={orgIdInput}
            onChange={(e) => setOrgIdInput(e.target.value)}
            placeholder="Identifiant d’organisation (ex. tpd-demo-intranet)"
            className="w-full px-3.5 py-2 text-sm font-mono border border-neutral-200 rounded-lg"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail professionnel"
            className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="w-full px-3.5 py-2 text-sm border border-neutral-200 rounded-lg"
          />
          <button
            type="button"
            onClick={() => login()}
            className="w-full py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg"
          >
            Connexion employé
          </button>
        </div>

        <div className="pt-4 border-t border-neutral-100 space-y-2">
          <div className="text-xs font-semibold text-neutral-500 uppercase">Profils de démonstration rapides</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => login('OWNER')}
              className="py-2 px-3 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold"
            >
              Direction (Propriétaire)
            </button>
            <button
              type="button"
              onClick={() => login('MANAGER')}
              className="py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold"
            >
              Manager Pôle
            </button>
            <button
              type="button"
              onClick={() => login('EMPLOYEE')}
              className="py-2 px-3 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 text-xs font-semibold"
            >
              Employé
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const channelMessages = messages.filter((m) => m.channelId === activeChannelId);
  const channelTopics = topics.filter((t) => t.channelId === activeChannelId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <aside className="lg:col-span-3 bg-white border border-neutral-200 rounded-xl p-4 space-y-5 h-fit">
        <div className="pb-3 border-b border-neutral-100">
          <div className="font-bold text-sm text-neutral-900">{user.name}</div>
          <div className="text-xs text-neutral-500">{user.title}</div>
          <div className="mt-1 inline-block px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-mono text-[11px] font-semibold">
            {user.role}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Canaux autorisés ({channels.length})
          </div>
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setActiveChannelId(ch.id);
                if (mode === 'team') setMode('chat');
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                activeChannelId === ch.id && mode !== 'team'
                  ? 'bg-neutral-900 text-white font-medium'
                  : 'text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                {ch.isPrivate ? <Lock className="w-3.5 h-3.5 shrink-0" /> : <Hash className="w-3.5 h-3.5 shrink-0" />}
                {ch.name}
              </span>
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-neutral-100 space-y-2">
          <button
            type="button"
            onClick={() => setMode('team')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              mode === 'team' ? 'bg-sky-50 text-sky-800 font-semibold' : 'text-neutral-700 hover:bg-neutral-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Annuaire & Comptes ({members.length})
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-700 hover:bg-rose-50"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <section className="lg:col-span-9 bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs">{error}</div>}

        {mode === 'team' ? (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-neutral-900">Annuaire du personnel</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {members.map((m) => (
                <div key={m.id} className="p-4 rounded-xl border border-neutral-200 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-neutral-900 text-sm">{m.name}</div>
                    <div className="text-xs text-neutral-500">{m.title}</div>
                    <div className="text-xs font-mono text-neutral-400 mt-0.5">{m.email}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-xs">
                    {m.role}
                  </span>
                </div>
              ))}
            </div>

            {user.role === 'OWNER' && (
              <form onSubmit={createEmployee} className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-sky-600" />
                  Créer un compte employé / manager
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="Nom complet"
                    className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="E-mail professionnel"
                    className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  />
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as 'DIRECTION' | 'MANAGER' | 'EMPLOYEE')}
                    className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  >
                    <option value="EMPLOYEE">Employé</option>
                    <option value="MANAGER">Manager</option>
                    <option value="DIRECTION">Direction</option>
                  </select>
                  <input
                    type="text"
                    value={empTitle}
                    onChange={(e) => setEmpTitle(e.target.value)}
                    placeholder="Fonction (ex. Chargé de mission)"
                    className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  />
                </div>
                <input
                  type="password"
                  required
                  minLength={14}
                  value={empPassword}
                  onChange={(e) => setEmpPassword(e.target.value)}
                  placeholder="Mot de passe temporaire (minimum 14 caractères)"
                  className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg"
                >
                  Créer le compte personnel
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100">
              <div>
                <h3 className="font-bold text-neutral-900">#{activeChannel?.name || 'Canal'}</h3>
                <p className="text-xs text-neutral-500">{activeChannel?.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode('chat')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    mode === 'chat' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  Messagerie ({channelMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMode('forum')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    mode === 'forum' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
                  }`}
                >
                  Forum ({channelTopics.length})
                </button>
              </div>
            </div>

            {mode === 'chat' ? (
              <div className="space-y-4">
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {channelMessages.map((m) => (
                    <div key={m.id} className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-100 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-neutral-900">
                          {m.senderName}{' '}
                          <span className="font-mono text-[10px] text-sky-700 ml-1">{m.senderRole}</span>
                        </span>
                        <span className="text-neutral-400 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {m.content && <p className="text-sm text-neutral-800">{m.content}</p>}
                      {m.attachment && (
                        <a
                          href={m.attachment.dataUrl}
                          download={m.attachment.filename}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-neutral-200 text-xs text-sky-700 font-medium"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          {m.attachment.filename} ({Math.round(m.attachment.sizeBytes / 1024)} Ko)
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                <form onSubmit={sendMessage} className="flex flex-wrap items-center gap-2 pt-2 border-t border-neutral-100">
                  <label className="cursor-pointer p-2.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600">
                    <Paperclip className="w-4 h-4" />
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                  <input
                    type="text"
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder={
                      pendingAttachment
                        ? `Pièce jointe prête : ${pendingAttachment.filename}`
                        : `Écrire dans #${activeChannel?.name || ''}...`
                    }
                    className="flex-1 min-w-[200px] px-3.5 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg"
                  >
                    <Send className="w-4 h-4" />
                    Envoyer
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-5">
                <form onSubmit={createTopic} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-sky-600" />
                    Ouvrir un sujet de forum
                  </div>
                  <input
                    type="text"
                    required
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="Titre du sujet"
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  />
                  <textarea
                    rows={2}
                    required
                    value={topicBody}
                    onChange={(e) => setTopicBody(e.target.value)}
                    placeholder="Détails du sujet..."
                    className="w-full px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-lg"
                  >
                    Publier le sujet
                  </button>
                </form>

                <div className="space-y-4">
                  {channelTopics.map((topic) => (
                    <div key={topic.id} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                      <div>
                        <h4 className="font-bold text-neutral-900">{topic.title}</h4>
                        <div className="text-xs text-neutral-500 mt-0.5">Par {topic.authorName}</div>
                        <p className="text-sm text-neutral-700 mt-2">{topic.body}</p>
                      </div>
                      <div className="pl-4 border-l-2 border-neutral-200 space-y-2">
                        {topic.replies.map((r) => (
                          <div key={r.id} className="text-xs bg-neutral-50 p-2.5 rounded-lg">
                            <span className="font-semibold text-neutral-900">{r.authorName} : </span>
                            <span className="text-neutral-700">{r.content}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <input
                            type="text"
                            value={replyTexts[topic.id] || ''}
                            onChange={(e) => setReplyTexts((prev) => ({ ...prev, [topic.id]: e.target.value }))}
                            placeholder="Ajouter une réponse..."
                            className="flex-1 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => submitReply(topic.id)}
                            className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg"
                          >
                            Répondre
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
