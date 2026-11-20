import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  Download,
  FileCode2,
  FilePlus2,
  FileText,
  FolderKanban,
  GraduationCap,
  Hash,
  History,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Radio,
  Reply,
  Save,
  Search,
  Send,
  Smile,
  Sparkles,
  Square,
  Upload,
  UserPlus,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { buildAuthHeaders, getSpaceToken } from '../lib/authHeaders';
import { ProfileAvatar } from './ui/MediaAvatar';
import type { AuthSessionSummary } from './LoginScreen';
import type {
  OrganizationOption,
  TeamsCollabDoc,
  TeamsConversationKind,
  TeamsConversationRecord,
  TeamsDocCategory,
  TeamsFileCategory,
  TeamsHomeworkStatus,
  TeamsMeetingMode,
  TeamsMeetingRecord,
  TeamsMessageAttachment,
  TeamsMessageRecord,
  TeamsParticipantSummary,
  TeamsPresenceStatus,
  TeamsSharedFile,
  TeamsWorkspacePayload,
} from '../types';

interface Props {
  session?: AuthSessionSummary;
  organization?: OrganizationOption;
}

type ChannelViewTab = 'chat' | 'meetings' | 'collab';

const PRESENCE_META: Record<TeamsPresenceStatus, { label: string; dot: string }> = {
  ONLINE: { label: 'En ligne', dot: 'bg-emerald-500' },
  IN_MEETING: { label: 'En réunion', dot: 'bg-rose-500' },
  BUSY: { label: 'Occupé', dot: 'bg-amber-500' },
  OFFLINE: { label: 'Hors ligne', dot: 'bg-slate-400' },
};

const KIND_META: Record<TeamsConversationKind, { label: string; badge: string }> = {
  CHANNEL: { label: 'Canal', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  PROJECT: { label: 'Projet', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
  FORMATION: { label: 'Formation', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  ONBOARDING: { label: 'Intégration', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  GROUP: { label: 'Groupe', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
  DM: { label: 'Privé', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
};

const QUICK_EMOJIS = ['👍', '🚀', '✅', '❤️', '👏'];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const IntranetModule: React.FC<Props> = ({ session, organization }) => {
  const [workspace, setWorkspace] = useState<TeamsWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const [activeConvId, setActiveConvId] = useState<string>('');
  const [channelTab, setChannelTab] = useState<ChannelViewTab>('chat');
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Messaging state
  const [msgText, setMsgText] = useState('');
  const [replyTo, setReplyTo] = useState<TeamsMessageRecord | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<TeamsMessageAttachment | null>(null);
  const [typingUsersByConv, setTypingUsersByConv] = useState<Record<string, string[]>>({});
  const typingTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Create Channel / DM / Group modal
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvKind, setNewConvKind] = useState<TeamsConversationKind>('PROJECT');
  const [newConvName, setNewConvName] = useState('');
  const [newConvTopic, setNewConvTopic] = useState('');
  const [newConvPrivate, setNewConvPrivate] = useState(false);
  const [newConvMembers, setNewConvMembers] = useState<string[]>([]);

  // Collaborative doc editor state
  const [activeDocId, setActiveDocId] = useState<string>('');
  const [docContentBuffer, setDocContentBuffer] = useState<string>('');
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<TeamsDocCategory>('PROJET');
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const isRemoteDocUpdateRef = useRef(false);
  const docSyncTimerRef = useRef<number | null>(null);

  // Meetings, WebRTC, Screen Share & Recording state
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingMode, setNewMeetingMode] = useState<TeamsMeetingMode>('VIDEO');
  const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [hardwareWarning, setHardwareWarning] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const activeSpace = session?.space || 'intranet';

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/teams/workspace', {
        headers: buildAuthHeaders(activeSpace, false),
        credentials: 'include',
      });
      const json = (await res.json()) as TeamsWorkspacePayload & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Chargement Teams impossible.');
      setWorkspace(json);
      setActiveConvId((prev) =>
        prev && json.conversations.some((c) => c.id === prev)
          ? prev
          : json.conversations[0]?.id || '',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement Teams.');
    } finally {
      setLoading(false);
    }
  }, [activeSpace]);

  useEffect(() => {
    void loadWorkspace(false);
  }, [loadWorkspace]);

  // --- WebRTC Peer Management ---
  const sendWs = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string, meetingId: string): RTCPeerConnection => {
      const existing = peerConnectionsRef.current.get(targetUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendWs('rtc:signal', {
            meetingId,
            targetUserId,
            signalType: 'ice-candidate',
            data: ev.candidate,
          });
        }
      };

      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (stream) {
          setRemoteStreams((prev) => ({ ...prev, [targetUserId]: stream }));
        }
      };

      peerConnectionsRef.current.set(targetUserId, pc);
      return pc;
    },
    [sendWs],
  );

  const handleRtcSignal = useCallback(
    async (sig: {
      meetingId: string;
      fromUserId: string;
      signalType: string;
      data?: unknown;
    }) => {
      if (!activeMeetingId || sig.meetingId !== activeMeetingId) return;
      if (sig.fromUserId === workspace?.currentUser.userId) return;

      if (sig.signalType === 'join-call') {
        const pc = createPeerConnection(sig.fromUserId, sig.meetingId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sendWs('rtc:signal', {
          meetingId: sig.meetingId,
          targetUserId: sig.fromUserId,
          signalType: 'offer',
          data: offer,
        });
      } else if (sig.signalType === 'offer' && sig.data) {
        const pc = createPeerConnection(sig.fromUserId, sig.meetingId);
        await pc.setRemoteDescription(new RTCSessionDescription(sig.data as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWs('rtc:signal', {
          meetingId: sig.meetingId,
          targetUserId: sig.fromUserId,
          signalType: 'answer',
          data: answer,
        });
      } else if (sig.signalType === 'answer' && sig.data) {
        const pc = peerConnectionsRef.current.get(sig.fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.data as RTCSessionDescriptionInit));
        }
      } else if (sig.signalType === 'ice-candidate' && sig.data) {
        const pc = peerConnectionsRef.current.get(sig.fromUserId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(sig.data as RTCIceCandidateInit)).catch(() => {});
        }
      } else if (sig.signalType === 'leave-call') {
        const pc = peerConnectionsRef.current.get(sig.fromUserId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(sig.fromUserId);
        }
        setRemoteStreams((prev) => {
          const copy = { ...prev };
          delete copy[sig.fromUserId];
          return copy;
        });
      }
    },
    [activeMeetingId, createPeerConnection, sendWs, workspace?.currentUser.userId],
  );

  // --- Real WebSocket Connection with Reconnect & State Sync ---
  useEffect(() => {
    let closedByUnmount = false;
    let reconnectTimer: number | null = null;

    const connectWs = () => {
      const token = getSpaceToken(activeSpace) || '';
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws/teams?token=${encodeURIComponent(token)}&space=${encodeURIComponent(activeSpace)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        void loadWorkspace(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data)) as { type: string; payload: any };
          const p = msg.payload || {};

          if (msg.type === 'presence:update') {
            setWorkspace((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                directory: prev.directory.map((d) =>
                  d.userId === p.userId ? { ...d, presence: p.presence } : d,
                ),
                currentUser:
                  prev.currentUser.userId === p.userId
                    ? { ...prev.currentUser, presence: p.presence }
                    : prev.currentUser,
              };
            });
          } else if (msg.type === 'conversation:created' && p.conversation) {
            setWorkspace((prev) => {
              if (!prev) return prev;
              if (prev.conversations.some((c) => c.id === p.conversation.id)) return prev;
              return { ...prev, conversations: [...prev.conversations, p.conversation] };
            });
          } else if (msg.type === 'message:created' && p.message) {
            const incoming = p.message as TeamsMessageRecord;
            setWorkspace((prev) => {
              if (!prev) return prev;
              if (prev.messages.some((m) => m.id === incoming.id)) return prev;
              return {
                ...prev,
                messages: [...prev.messages, incoming],
                conversations: prev.conversations.map((c) =>
                  c.id === incoming.conversationId ? { ...c, lastMessageAt: incoming.createdAt } : c,
                ),
              };
            });
          } else if (msg.type === 'message:reacted' && p.message) {
            const updated = p.message as TeamsMessageRecord;
            setWorkspace((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.map((m) => (m.id === updated.id ? updated : m)),
                  }
                : prev,
            );
          } else if (msg.type === 'typing:update') {
            setTypingUsersByConv((prev) => {
              const curr = prev[p.conversationId] || [];
              const next = p.isTyping
                ? Array.from(new Set([...curr, p.userName]))
                : curr.filter((n) => n !== p.userName);
              return { ...prev, [p.conversationId]: next };
            });
          } else if (msg.type === 'meeting:updated' && p.meeting) {
            const updatedMtg = p.meeting as TeamsMeetingRecord;
            setWorkspace((prev) => {
              if (!prev) return prev;
              const exists = prev.meetings.some((m) => m.id === updatedMtg.id);
              const nextMeetings = exists
                ? prev.meetings.map((m) => (m.id === updatedMtg.id ? updatedMtg : m))
                : [updatedMtg, ...prev.meetings];
              return { ...prev, meetings: nextMeetings };
            });
          } else if (msg.type === 'doc:updated' && p.doc) {
            const updatedDoc = p.doc as TeamsCollabDoc;
            setWorkspace((prev) => {
              if (!prev) return prev;
              const exists = prev.collabDocs.some((d) => d.id === updatedDoc.id);
              const nextDocs = exists
                ? prev.collabDocs.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
                : [updatedDoc, ...prev.collabDocs];
              return { ...prev, collabDocs: nextDocs };
            });
            if (updatedDoc.id === activeDocId && p.editorUserId !== session?.userId) {
              isRemoteDocUpdateRef.current = true;
              setDocContentBuffer(updatedDoc.content);
            }
          } else if (msg.type === 'file:uploaded' && p.file) {
            const uploaded = p.file as TeamsSharedFile;
            setWorkspace((prev) => {
              if (!prev) return prev;
              if (prev.sharedFiles.some((f) => f.id === uploaded.id)) return prev;
              return { ...prev, sharedFiles: [uploaded, ...prev.sharedFiles] };
            });
          } else if (msg.type === 'rtc:signal') {
            void handleRtcSignal(p);
          }
        } catch {
          // ignore invalid frame
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByUnmount) {
          reconnectTimer = window.setTimeout(connectWs, 2500);
        }
      };
    };

    connectWs();

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeSpace, activeDocId, handleRtcSignal, loadWorkspace, session?.userId]);

  // Derived data for selected conversation
  const conversations = workspace?.conversations || [];
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || conversations[0] || null,
    [conversations, activeConvId],
  );

  const convMessages = useMemo(
    () => (workspace?.messages || []).filter((m) => m.conversationId === activeConversation?.id),
    [workspace?.messages, activeConversation?.id],
  );

  const convMeetings = useMemo(
    () => (workspace?.meetings || []).filter((m) => m.conversationId === activeConversation?.id),
    [workspace?.meetings, activeConversation?.id],
  );

  const convDocs = useMemo(
    () => (workspace?.collabDocs || []).filter((d) => d.conversationId === activeConversation?.id),
    [workspace?.collabDocs, activeConversation?.id],
  );

  const convFiles = useMemo(
    () => (workspace?.sharedFiles || []).filter((f) => f.conversationId === activeConversation?.id),
    [workspace?.sharedFiles, activeConversation?.id],
  );

  const activeDoc = useMemo(
    () => convDocs.find((d) => d.id === activeDocId) || convDocs[0] || null,
    [convDocs, activeDocId],
  );

  useEffect(() => {
    if (activeDoc) {
      setActiveDocId(activeDoc.id);
      setDocContentBuffer(activeDoc.content);
      setGradeInput(activeDoc.homeworkGrade || '');
      setFeedbackInput(activeDoc.homeworkFeedback || '');
    } else {
      setDocContentBuffer('');
    }
  }, [activeDoc?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [convMessages.length, activeConversation?.id]);

  // Split conversations into Channels/Projects/Formations vs Direct/Group chats
  const filteredConvs = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    return conversations.filter((c) =>
      !q
        ? true
        : c.name.toLowerCase().includes(q) ||
          (c.topic || '').toLowerCase().includes(q) ||
          (c.linkedProjectCode || '').toLowerCase().includes(q),
    );
  }, [conversations, sidebarSearch]);

  const channelConvs = useMemo(
    () => filteredConvs.filter((c) => c.kind !== 'DM' && c.kind !== 'GROUP'),
    [filteredConvs],
  );
  const directConvs = useMemo(
    () => filteredConvs.filter((c) => c.kind === 'DM' || c.kind === 'GROUP'),
    [filteredConvs],
  );

  // --- Messaging handlers ---
  function handleTyping(val: string) {
    setMsgText(val);
    if (!activeConversation) return;
    sendWs('typing:update', { conversationId: activeConversation.id, isTyping: val.length > 0 });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      sendWs('typing:update', { conversationId: activeConversation.id, isTyping: false });
    }, 1800);
  }

  function handleAttachmentPick(e: React.ChangeEvent<HTMLInputElement>) {
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
    e.target.value = '';
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConversation || (!msgText.trim() && !pendingAttachment)) return;

    const payloadBody = {
      conversationId: activeConversation.id,
      content: msgText.trim(),
      replyToId: replyTo?.id,
      attachment: pendingAttachment ?? undefined,
    };

    setMsgText('');
    setReplyTo(null);
    setPendingAttachment(null);
    sendWs('typing:update', { conversationId: activeConversation.id, isTyping: false });

    const res = await fetch('/api/teams/messages', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify(payloadBody),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & { message?: TeamsMessageRecord; error?: string };
    if (!res.ok) {
      setError(json.error || 'Envoi impossible.');
      return;
    }
    if (json.message) {
      setWorkspace((prev) => {
        if (!prev) return json;
        if (prev.messages.some((m) => m.id === json.message!.id)) return prev;
        return { ...prev, messages: [...prev.messages, json.message!] };
      });
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    const res = await fetch(`/api/teams/messages/${messageId}/react`, {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const json = (await res.json()) as { message: TeamsMessageRecord };
      setWorkspace((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((m) => (m.id === json.message.id ? json.message : m)),
            }
          : prev,
      );
    }
  }

  // --- Create Conversation / Start DM ---
  async function handleCreateConversation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/teams/conversations', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        kind: newConvKind,
        name: newConvName.trim() || undefined,
        topic: newConvTopic.trim() || undefined,
        isPrivate: newConvPrivate,
        memberIds: newConvMembers,
      }),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & {
      conversation?: TeamsConversationRecord;
      error?: string;
    };
    if (!res.ok) {
      setError(json.error || 'Création impossible.');
      return;
    }
    setWorkspace(json);
    if (json.conversation) setActiveConvId(json.conversation.id);
    setNewConvOpen(false);
    setNewConvName('');
    setNewConvTopic('');
    setNewConvMembers([]);
  }

  async function handleQuickDm(targetUserId: string) {
    const res = await fetch('/api/teams/conversations', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ kind: 'DM', memberIds: [targetUserId] }),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & { conversation?: TeamsConversationRecord };
    if (res.ok) {
      setWorkspace(json);
      if (json.conversation) {
        setActiveConvId(json.conversation.id);
        setChannelTab('chat');
      }
    }
  }

  // --- Collaborative Document Co-editing ---
  function handleDocBufferChange(nextVal: string) {
    setDocContentBuffer(nextVal);
    if (isRemoteDocUpdateRef.current) {
      isRemoteDocUpdateRef.current = false;
      return;
    }
    if (!activeDoc) return;
    if (docSyncTimerRef.current) window.clearTimeout(docSyncTimerRef.current);
    docSyncTimerRef.current = window.setTimeout(() => {
      sendWs('doc:update', { docId: activeDoc.id, content: nextVal });
    }, 180);
  }

  async function handleSaveDocSnapshot(extra?: {
    homeworkStatus?: TeamsHomeworkStatus;
    homeworkGrade?: string;
    homeworkFeedback?: string;
  }) {
    if (!activeDoc) return;
    const res = await fetch(`/api/teams/docs/${activeDoc.id}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        content: docContentBuffer,
        saveSnapshot: !extra,
        snapshotSummary: `Sauvegarde par ${workspace?.currentUser.name || session?.name || 'Membre'}`,
        ...extra,
      }),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & { error?: string };
    if (res.ok) {
      setWorkspace(json);
      setNotice(extra?.homeworkStatus ? `Statut devoir : ${extra.homeworkStatus}` : 'Version collaborative enregistrée.');
    } else {
      setError(json.error || 'Sauvegarde impossible.');
    }
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!activeConversation || !newDocTitle.trim()) return;
    const res = await fetch('/api/teams/docs', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        conversationId: activeConversation.id,
        title: newDocTitle.trim(),
        category: newDocCategory,
      }),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & { doc?: TeamsCollabDoc; error?: string };
    if (!res.ok) {
      setError(json.error || 'Création document impossible.');
      return;
    }
    setWorkspace(json);
    if (json.doc) setActiveDocId(json.doc.id);
    setNewDocOpen(false);
    setNewDocTitle('');
    setChannelTab('collab');
  }

  async function handleUploadSharedFile(e: React.ChangeEvent<HTMLInputElement>, category: TeamsFileCategory) {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier supérieur à 5 Mo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch('/api/teams/files', {
        method: 'POST',
        headers: buildAuthHeaders(activeSpace, true),
        credentials: 'include',
        body: JSON.stringify({
          conversationId: activeConversation.id,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl: String(reader.result || ''),
          category,
          homeworkStatus: category === 'DEVOIR' ? 'RENDU' : undefined,
        }),
      });
      const json = (await res.json()) as TeamsWorkspacePayload & { error?: string };
      if (res.ok) {
        setWorkspace(json);
        setNotice(`${file.name} partagé dans l’espace.`);
      } else {
        setError(json.error || 'Partage impossible.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // --- Audio / Video / Screen-share / Recording Lifecycle ---
  const stopLocalMedia = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams({});
    setScreenEnabled(false);
    setRecordingSeconds(0);
  }, []);

  async function joinMeetingCall(meeting: TeamsMeetingRecord) {
    setHardwareWarning(null);
    const wantVideo = meeting.mode !== 'AUDIO';
    setCamEnabled(wantVideo);
    setMicEnabled(true);

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } else {
        setHardwareWarning('Périphérique audio/vidéo indisponible dans ce navigateur (mode salle connectée actif).');
      }
    } catch {
      setHardwareWarning('Accès caméra/micro refusé ou absent — vous restez connecté en mode écoute/partage.');
    }

    setActiveMeetingId(meeting.id);
    setChannelTab('meetings');

    await fetch(`/api/teams/meetings/${meeting.id}/state`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ action: 'JOIN' }),
    }).then(async (r) => {
      if (r.ok) setWorkspace(await r.json());
    });

    sendWs('rtc:signal', { meetingId: meeting.id, signalType: 'join-call' });
  }

  async function startQuickMeeting(mode: TeamsMeetingMode, customTitle?: string) {
    if (!activeConversation) return;
    const res = await fetch('/api/teams/meetings', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        conversationId: activeConversation.id,
        mode,
        title: customTitle?.trim() || undefined,
        startImmediately: true,
      }),
    });
    const json = (await res.json()) as TeamsWorkspacePayload & { meeting?: TeamsMeetingRecord; error?: string };
    if (!res.ok || !json.meeting) {
      setError(json.error || 'Démarrage appel impossible.');
      return;
    }
    setWorkspace(json);
    setNewMeetingOpen(false);
    setNewMeetingTitle('');
    await joinMeetingCall(json.meeting);
  }

  async function leaveOrEndMeeting(meetingId: string, endForAll = false) {
    sendWs('rtc:signal', { meetingId, signalType: 'leave-call' });
    stopLocalMedia();
    setActiveMeetingId(null);

    const res = await fetch(`/api/teams/meetings/${meetingId}/state`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ action: endForAll ? 'END' : 'LEAVE' }),
    });
    if (res.ok) setWorkspace(await res.json());
  }

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  }

  function toggleCam() {
    const next = !camEnabled;
    setCamEnabled(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
  }

  async function toggleScreenShare(meetingId: string) {
    if (screenEnabled) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      setScreenEnabled(false);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      await fetch(`/api/teams/meetings/${meetingId}/state`, {
        method: 'PATCH',
        headers: buildAuthHeaders(activeSpace, true),
        credentials: 'include',
        body: JSON.stringify({ action: 'STOP_SCREEN' }),
      }).then(async (r) => {
        if (r.ok) setWorkspace(await r.json());
      });
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError('Partage d’écran non supporté dans cet environnement.');
        return;
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      setScreenEnabled(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

      const screenTrack = screenStream.getVideoTracks()[0];
      screenTrack.onended = () => {
        void toggleScreenShare(meetingId);
      };

      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && screenTrack) {
          void sender.replaceTrack(screenTrack);
        }
      });

      await fetch(`/api/teams/meetings/${meetingId}/state`, {
        method: 'PATCH',
        headers: buildAuthHeaders(activeSpace, true),
        credentials: 'include',
        body: JSON.stringify({ action: 'START_SCREEN' }),
      }).then(async (r) => {
        if (r.ok) setWorkspace(await r.json());
      });
    } catch {
      setError('Partage d’écran annulé.');
    }
  }

  async function toggleMeetingRecording(meeting: TeamsMeetingRecord) {
    if (meeting.isRecording) {
      // Stop recording
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const duration = Math.max(1, recordingSeconds);
      setRecordingSeconds(0);

      let dataUrl: string | undefined;
      let sizeBytes = 64000;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        const mr = mediaRecorderRef.current;
        await new Promise<void>((resolve) => {
          mr.onstop = () => resolve();
          mr.stop();
        });
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        recordedChunksRef.current = [];
        sizeBytes = blob.size;
        if (blob.size > 0 && blob.size <= 3_500_000) {
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.readAsDataURL(blob);
          });
        }
      }

      const res = await fetch(`/api/teams/meetings/${meeting.id}/state`, {
        method: 'PATCH',
        headers: buildAuthHeaders(activeSpace, true),
        credentials: 'include',
        body: JSON.stringify({
          action: 'STOP_RECORDING',
          recordingDurationSeconds: duration,
          recordingSizeBytes: sizeBytes,
          recordingDataUrl: dataUrl,
        }),
      });
      if (res.ok) {
        setWorkspace(await res.json());
        setNotice('Enregistrement sauvegardé dans la réunion et les fichiers du canal.');
      }
      return;
    }

    // Start recording using active screen/camera stream or synthesized canvas stream
    let streamToRecord = screenStreamRef.current || localStreamRef.current;
    if (!streamToRecord && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 640, 360);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(meeting.title, 32, 180);
      }
      if (typeof canvas.captureStream === 'function') {
        streamToRecord = canvas.captureStream(5);
      }
    }

    if (streamToRecord && typeof MediaRecorder !== 'undefined') {
      try {
        recordedChunksRef.current = [];
        const mr = new MediaRecorder(streamToRecord);
        mr.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data);
        };
        mr.start(1000);
        mediaRecorderRef.current = mr;
      } catch {
        mediaRecorderRef.current = null;
      }
    }

    setRecordingSeconds(0);
    recordTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    const res = await fetch(`/api/teams/meetings/${meeting.id}/state`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ action: 'START_RECORDING' }),
    });
    if (res.ok) setWorkspace(await res.json());
  }

  useEffect(() => {
    return () => {
      stopLocalMedia();
    };
  }, [stopLocalMedia]);

  const activeMeeting = useMemo(
    () => (workspace?.meetings || []).find((m) => m.id === activeMeetingId) || null,
    [workspace?.meetings, activeMeetingId],
  );

  if (loading && !workspace) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500">
        Connexion à l’espace Teams...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Status & Quick Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Teams — Communication &amp; Collaboration
              </h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full inline-flex items-center gap-1 ${
                  wsConnected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                <Radio className="w-3 h-3" />
                {wsConnected ? 'Temps réel WebSocket actif' : 'Reconnexion...'}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {organization?.name || workspace?.currentUser.organizationName} ·{' '}
              {workspace?.stats.onlineUsersCount ?? 0} collaborateurs connectés ·{' '}
              {workspace?.stats.liveMeetingsCount ?? 0} réunion(s) en cours
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={workspace?.currentUser.presence || 'ONLINE'}
            onChange={(e) => sendWs('presence:set', { presence: e.target.value })}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="ONLINE">🟢 En ligne</option>
            <option value="BUSY">🟡 Occupé</option>
            <option value="IN_MEETING">🔴 En réunion</option>
            <option value="OFFLINE">⚪ Absent</option>
          </select>

          <button
            type="button"
            onClick={() => setNewConvOpen(true)}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Canal / Groupe / DM
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split Teams Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT SIDEBAR: Canaux, Projets, Formations, Groupes, DMs & Collègues en ligne */}
        <aside className="lg:col-span-4 xl:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-4 h-fit">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder="Filtrer canaux, projets, collègues..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Canaux, Projets, Formations, Onboarding */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Canaux, Projets &amp; Cours ({channelConvs.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewConvKind('PROJECT');
                  setNewConvOpen(true);
                }}
                className="text-slate-400 hover:text-indigo-600"
                title="Créer un canal"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {channelConvs.map((c) => {
              const active = activeConversation?.id === c.id;
              const Icon =
                c.kind === 'PROJECT'
                  ? FolderKanban
                  : c.kind === 'FORMATION'
                    ? GraduationCap
                    : c.isPrivate
                      ? Lock
                      : Hash;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                      active ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900' : KIND_META[c.kind].badge
                    }`}
                  >
                    {KIND_META[c.kind].label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Groupes & Échanges privés */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Groupes &amp; Privés ({directConvs.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewConvKind('GROUP');
                  setNewConvOpen(true);
                }}
                className="text-slate-400 hover:text-indigo-600"
                title="Nouvelle discussion"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {directConvs.map((c) => {
              const active = activeConversation?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between gap-2 transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-70">{c.memberIds.length}</span>
                </button>
              );
            })}
          </div>

          {/* Directory quick DM / Video Call */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Équipe &amp; Intervenants ({workspace?.directory.length || 0})
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {(workspace?.directory || [])
                .filter((d) => d.userId !== workspace?.currentUser.userId)
                .filter((d) =>
                  !sidebarSearch.trim()
                    ? true
                    : d.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
                      d.title.toLowerCase().includes(sidebarSearch.toLowerCase()),
                )
                .map((person) => {
                  const pm = PRESENCE_META[person.presence];
                  return (
                    <div
                      key={person.userId}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/70"
                    >
                      <button
                        type="button"
                        onClick={() => void handleQuickDm(person.userId)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <div className="relative shrink-0">
                          <ProfileAvatar name={person.name} src={person.avatarUrl} size="sm" />
                          <span
                            className={`w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 absolute -bottom-0.5 -right-0.5 ${pm.dot}`}
                            title={pm.label}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {person.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{person.title}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleQuickDm(person.userId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                        title="Message privé"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </aside>

        {/* MAIN CONVERSATION AREA */}
        <section className="lg:col-span-8 xl:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col min-h-[640px] overflow-hidden">
          {!activeConversation ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Sélectionnez ou créez un canal.
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${KIND_META[activeConversation.kind].badge}`}>
                      {KIND_META[activeConversation.kind].label}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                      {activeConversation.name}
                    </h3>
                    {activeConversation.linkedProjectCode && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {activeConversation.linkedProjectCode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {activeConversation.topic || `${activeConversation.memberIds.length} membre(s)`}
                  </div>
                </div>

                {/* Call & View Switcher Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void startQuickMeeting('AUDIO')}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    Audio
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void startQuickMeeting(
                        activeConversation.kind === 'FORMATION' ? 'COURS_DISTANT' : 'VIDEO',
                      )
                    }
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5" />
                    {activeConversation.kind === 'FORMATION' ? 'Lancer cours visio' : 'Appel Vidéo'}
                  </button>
                </div>
              </div>

              {/* Conversation Sub-tabs */}
              <div className="px-4 pt-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 bg-slate-50/60 dark:bg-slate-950/30">
                <button
                  type="button"
                  onClick={() => setChannelTab('chat')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${
                    channelTab === 'chat'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Messagerie ({convMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChannelTab('meetings')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${
                    channelTab === 'meetings'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  Réunions &amp; Enregistrements ({convMeetings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setChannelTab('collab')}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 transition inline-flex items-center gap-1.5 ${
                    channelTab === 'collab'
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  Coédition &amp; Fichiers ({convDocs.length + convFiles.length})
                </button>
              </div>

              {/* ========================================================= */}
              {/* TAB 1 : MESSAGERIE INSTANTANÉE (WEBSOCKET TEMPS RÉEL)     */}
              {/* ========================================================= */}
              {channelTab === 'chat' && (
                <div className="flex-1 flex flex-col justify-between p-4 space-y-3">
                  {/* Live meeting banner inside channel if a call is running */}
                  {convMeetings.some((m) => m.status === 'EN_COURS') && (
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
                      {convMeetings
                        .filter((m) => m.status === 'EN_COURS')
                        .slice(0, 1)
                        .map((liveMtg) => (
                          <React.Fragment key={liveMtg.id}>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="font-bold text-emerald-900 dark:text-emerald-200">
                                {liveMtg.title}
                              </span>
                              <span className="text-emerald-700 dark:text-emerald-300 font-mono">
                                ({liveMtg.activeParticipantNames.length} participant(s))
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void joinMeetingCall(liveMtg)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                            >
                              {activeMeetingId === liveMtg.id ? 'Revenir à l’appel' : 'Rejoindre la visio'}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>
                  )}

                  {/* Messages Feed */}
                  <div className="flex-1 space-y-3 max-h-[450px] overflow-y-auto pr-1">
                    {convMessages.length === 0 ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Aucun message dans cette conversation.
                      </div>
                    ) : (
                      convMessages.map((m) => {
                        const isSelf = m.senderId === workspace?.currentUser.userId;
                        return (
                          <div
                            key={m.id}
                            className={`rounded-xl p-3 border space-y-1.5 ${
                              isSelf
                                ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200/70 dark:border-indigo-900/60'
                                : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <ProfileAvatar name={m.senderName} src={m.senderAvatarUrl} size="sm" />
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {m.senderName}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                                  {m.senderRole}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setReplyTo(m)}
                                  className="text-slate-400 hover:text-indigo-600 p-1"
                                  title="Répondre"
                                >
                                  <Reply className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            {m.replyToPreview && (
                              <div className="pl-2.5 border-l-2 border-indigo-400 text-[11px] text-slate-500 dark:text-slate-400 italic">
                                {m.replyToPreview}
                              </div>
                            )}

                            {m.content && (
                              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line">
                                {m.content}
                              </p>
                            )}

                            {m.linkedDocId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDocId(m.linkedDocId!);
                                  setChannelTab('collab');
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50"
                              >
                                <FileCode2 className="w-3.5 h-3.5" />
                                Ouvrir document coédité : {m.linkedDocTitle || 'Document'}
                              </button>
                            )}

                            {m.attachment && (
                              <a
                                href={m.attachment.dataUrl}
                                download={m.attachment.filename}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-blue-700 dark:text-blue-300"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                {m.attachment.filename} ({Math.max(1, Math.round(m.attachment.sizeBytes / 1024))} Ko)
                              </a>
                            )}

                            {/* Reactions Bar */}
                            <div className="flex flex-wrap items-center gap-1 pt-0.5">
                              {m.reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => void handleReact(m.id, r.emoji)}
                                  className={`px-2 py-0.5 rounded-full text-[11px] border transition ${
                                    r.userIds.includes(workspace?.currentUser.userId || '')
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-800 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-200'
                                      : 'bg-white border-slate-200 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {r.emoji} {r.userIds.length}
                                </button>
                              ))}
                              <div className="inline-flex items-center gap-0.5 ml-1">
                                {QUICK_EMOJIS.map((em) => (
                                  <button
                                    key={em}
                                    type="button"
                                    onClick={() => void handleReact(m.id, em)}
                                    className="px-1 py-0.5 text-[11px] opacity-50 hover:opacity-100 rounded hover:bg-slate-200/60 dark:hover:bg-slate-700"
                                  >
                                    {em}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Typing Indicator */}
                  {(typingUsersByConv[activeConversation.id] || []).length > 0 && (
                    <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium px-1">
                      {typingUsersByConv[activeConversation.id].join(', ')} écrit...
                    </div>
                  )}

                  {/* Reply / Pending File Preview */}
                  {(replyTo || pendingAttachment) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs">
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {replyTo ? `Réponse à ${replyTo.senderName} : ${replyTo.content.slice(0, 60)}` : ''}
                        {pendingAttachment ? `Fichier prêt : ${pendingAttachment.filename}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(null);
                          setPendingAttachment(null);
                        }}
                        className="text-slate-500 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Message Input Form */}
                  <form onSubmit={handleSendMessage} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label
                      className="cursor-pointer p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      title="Joindre un fichier ou devoir"
                    >
                      <Paperclip className="w-4 h-4" />
                      <input type="file" className="hidden" onChange={handleAttachmentPick} />
                    </label>
                    <input
                      type="text"
                      value={msgText}
                      onChange={(e) => handleTyping(e.target.value)}
                      placeholder={`Écrire dans ${activeConversation.name}...`}
                      className="flex-1 min-w-[180px] px-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Envoyer
                    </button>
                  </form>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2 : RÉUNIONS, VISIOCONFÉRENCES, PARTAGE ÉCRAN & REC   */}
              {/* ========================================================= */}
              {channelTab === 'meetings' && (
                <div className="p-4 space-y-4">
                  {/* Active WebRTC Video / Audio Stage */}
                  {activeMeeting && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 text-white p-4 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-sm font-bold">{activeMeeting.title}</span>
                          {activeMeeting.isRecording && (
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[11px] font-bold inline-flex items-center gap-1">
                              <CircleDot className="w-3 h-3" />
                              REC {formatDuration(recordingSeconds)}
                            </span>
                          )}
                          {activeMeeting.screenSharingUserName && (
                            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-semibold">
                              Partage écran : {activeMeeting.screenSharingUserName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-slate-300">
                          {activeMeeting.activeParticipantNames.length} connecté(s)
                        </span>
                      </div>

                      {hardwareWarning && (
                        <div className="rounded-lg bg-amber-950/70 border border-amber-700 px-3 py-2 text-[11px] text-amber-200">
                          {hardwareWarning}
                        </div>
                      )}

                      {/* Video / Participant Tiles Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {/* Self video / screen tile */}
                        <div className="relative rounded-xl bg-slate-900 border border-slate-800 aspect-video overflow-hidden flex items-center justify-center">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`w-full h-full object-cover ${
                              !localStreamRef.current && !screenStreamRef.current ? 'hidden' : ''
                            }`}
                          />
                          {!localStreamRef.current && !screenStreamRef.current && (
                            <div className="flex flex-col items-center gap-2">
                              <ProfileAvatar
                                name={workspace?.currentUser.name || session?.name || 'Moi'}
                                src={workspace?.currentUser.avatarUrl}
                                size="lg"
                              />
                              <span className="text-xs font-semibold text-slate-200">
                                {workspace?.currentUser.name} (Vous)
                              </span>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-semibold">
                            {screenEnabled ? 'Votre écran partagé' : 'Vous'} {!micEnabled ? '🔇' : ''}
                          </div>
                        </div>

                        {/* Remote Peer Tiles */}
                        {activeMeeting.activeParticipantIds
                          .filter((uid) => uid !== workspace?.currentUser.userId)
                          .map((uid) => {
                            const part = workspace?.directory.find((d) => d.userId === uid);
                            const rStream = remoteStreams[uid];
                            return (
                              <div
                                key={uid}
                                className="relative rounded-xl bg-slate-900 border border-slate-800 aspect-video overflow-hidden flex items-center justify-center"
                              >
                                {rStream ? (
                                  <video
                                    autoPlay
                                    playsInline
                                    ref={(el) => {
                                      if (el && el.srcObject !== rStream) el.srcObject = rStream;
                                    }}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center gap-2">
                                    <ProfileAvatar
                                      name={part?.name || 'Participant'}
                                      src={part?.avatarUrl}
                                      size="lg"
                                    />
                                    <span className="text-xs font-semibold text-slate-200">
                                      {part?.name || 'Participant'}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-semibold">
                                  {part?.name || uid}
                                </div>
                              </div>
                            );
                          })}
                      </div>

                      {/* In-Call Controls */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={toggleMic}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                            micEnabled ? 'bg-slate-800 hover:bg-slate-700' : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                          {micEnabled ? 'Micro actif' : 'Micro coupé'}
                        </button>

                        <button
                          type="button"
                          onClick={toggleCam}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                            camEnabled ? 'bg-slate-800 hover:bg-slate-700' : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          {camEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                          {camEnabled ? 'Caméra' : 'Caméra coupée'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleScreenShare(activeMeeting.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                            screenEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          <MonitorUp className="w-4 h-4" />
                          {screenEnabled ? 'Arrêter partage écran' : 'Partager l’écran'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleMeetingRecording(activeMeeting)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                            activeMeeting.isRecording
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-slate-800 hover:bg-slate-700'
                          }`}
                        >
                          {activeMeeting.isRecording ? (
                            <Square className="w-3.5 h-3.5" />
                          ) : (
                            <CircleDot className="w-4 h-4 text-rose-400" />
                          )}
                          {activeMeeting.isRecording ? 'Arrêter enregistrement' : 'Enregistrer réunion'}
                        </button>

                        <button
                          type="button"
                          onClick={() => void leaveOrEndMeeting(activeMeeting.id, false)}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <PhoneOff className="w-4 h-4" />
                          Quitter
                        </button>

                        {activeMeeting.hostUserId === workspace?.currentUser.userId && (
                          <button
                            type="button"
                            onClick={() => void leaveOrEndMeeting(activeMeeting.id, true)}
                            className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold"
                          >
                            Clôturer pour tous
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meetings Controls Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Réunions, Cours à distance &amp; Enregistrements ({convMeetings.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setNewMeetingOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Planifier / Démarrer réunion
                    </button>
                  </div>

                  {/* Meetings List & Recordings */}
                  <div className="space-y-3">
                    {convMeetings.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center text-xs text-slate-400">
                        Aucune réunion enregistrée sur ce canal.
                      </div>
                    ) : (
                      convMeetings.map((mtg) => (
                        <div
                          key={mtg.id}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    mtg.status === 'EN_COURS'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                      : mtg.status === 'PLANIFIEE'
                                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                  }`}
                                >
                                  {mtg.status === 'EN_COURS'
                                    ? 'EN COURS'
                                    : mtg.status === 'PLANIFIEE'
                                      ? 'PLANIFIÉE'
                                      : 'TERMINÉE'}
                                </span>
                                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                                  {mtg.title}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Organisateur : {mtg.hostName} ·{' '}
                                {new Date(mtg.scheduledAt).toLocaleString('fr-FR')}
                              </div>
                            </div>

                            {mtg.status !== 'TERMINEE' && (
                              <button
                                type="button"
                                onClick={() => void joinMeetingCall(mtg)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                              >
                                <Video className="w-3.5 h-3.5" />
                                {activeMeetingId === mtg.id ? 'Actif' : 'Rejoindre'}
                              </button>
                            )}
                          </div>

                          {mtg.recordings.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                              <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                                Enregistrements ({mtg.recordings.length})
                              </div>
                              {mtg.recordings.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-3 py-2 text-xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <CircleDot className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                      {rec.title}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-500">
                                      {formatDuration(rec.durationSeconds)} · {Math.round(rec.sizeBytes / 1024)} Ko
                                    </span>
                                  </div>
                                  {rec.dataUrl ? (
                                    <a
                                      href={rec.dataUrl}
                                      download={`${rec.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.webm`}
                                      className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      Télécharger
                                    </a>
                                  ) : (
                                    <span className="text-[11px] font-mono text-slate-400">
                                      Archivé · {rec.recordedByName}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3 : COÉDITION TEMPS RÉEL, STOCKAGE FICHIERS & DEVOIRS */}
              {/* ========================================================= */}
              {channelTab === 'collab' && (
                <div className="p-4 grid grid-cols-1 xl:grid-cols-12 gap-4">
                  {/* Left: Collaborative Docs & File Storage List */}
                  <div className="xl:col-span-5 space-y-4">
                    {/* Collaborative Docs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Documents coédités ({convDocs.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewDocCategory(
                              activeConversation.kind === 'FORMATION' ? 'DEVOIR_GROUPE' : 'PROJET',
                            );
                            setNewDocOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <FilePlus2 className="w-3 h-3" />
                          Nouveau doc
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {convDocs.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setActiveDocId(d.id)}
                            className={`w-full text-left rounded-lg border p-2.5 transition ${
                              activeDoc?.id === d.id
                                ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {d.title}
                              </span>
                              {d.homeworkStatus && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 shrink-0">
                                  {d.homeworkStatus}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>Modifié par {d.lastEditedByName}</span>
                              <span>{d.versions.length} version(s)</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Shared Files & Homework Upload */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Fichiers partagés ({convFiles.length})
                        </span>
                        <div className="flex items-center gap-1.5">
                          <label className="cursor-pointer px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-[11px] font-semibold inline-flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            Fichier
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => void handleUploadSharedFile(e, 'DOCUMENT')}
                            />
                          </label>
                          {activeConversation.kind === 'FORMATION' && (
                            <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              Rendre devoir
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => void handleUploadSharedFile(e, 'DEVOIR')}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {convFiles.map((f) => (
                          <div
                            key={f.id}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {f.filename}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {f.category} · {f.uploadedByName} · {Math.max(1, Math.round(f.sizeBytes / 1024))} Ko
                                {f.homeworkStatus ? ` · ${f.homeworkStatus}` : ''}
                              </div>
                            </div>
                            <a
                              href={f.dataUrl}
                              download={f.filename}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50"
                              title="Télécharger"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Live Multi-User Collaborative Editor */}
                  <div className="xl:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 p-3.5 space-y-3">
                    {!activeDoc ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        Créez ou sélectionnez un document collaboratif.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {activeDoc.title}
                            </div>
                            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                              <span>Dernière modif : {activeDoc.lastEditedByName}</span>
                              {activeDoc.activeEditorNames.length > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">
                                  En coédition : {activeDoc.activeEditorNames.join(', ')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleSaveDocSnapshot()}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Save className="w-3.5 h-3.5" />
                              Sauvegarder version
                            </button>
                            <a
                              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(docContentBuffer)}`}
                              download={`${activeDoc.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.md`}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Exporter .md
                            </a>
                          </div>
                        </div>

                        <textarea
                          rows={12}
                          value={docContentBuffer}
                          onChange={(e) => handleDocBufferChange(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-100 leading-relaxed"
                        />

                        {/* Homework Submission / Evaluation Controls when DEVOIR_GROUPE */}
                        {activeDoc.category === 'DEVOIR_GROUPE' && (
                          <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                                Suivi Devoir / Travail de Groupe · Statut : {activeDoc.homeworkStatus || 'BROUILLON'}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleSaveDocSnapshot({ homeworkStatus: 'RENDU' })}
                                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Rendre le devoir
                              </button>
                            </div>

                            {(session?.space === 'instructor' || session?.role === 'OWNER' || session?.role === 'MANAGER') && (
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                                <input
                                  type="text"
                                  value={gradeInput}
                                  onChange={(e) => setGradeInput(e.target.value)}
                                  placeholder="Note (ex. 17/20)"
                                  className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                                />
                                <input
                                  type="text"
                                  value={feedbackInput}
                                  onChange={(e) => setFeedbackInput(e.target.value)}
                                  placeholder="Appréciation formateur..."
                                  className="sm:col-span-6 px-2.5 py-1.5 text-xs rounded border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleSaveDocSnapshot({
                                      homeworkStatus: 'CORRIGE',
                                      homeworkGrade: gradeInput,
                                      homeworkFeedback: feedbackInput,
                                    })
                                  }
                                  className="sm:col-span-3 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                >
                                  Corriger
                                </button>
                              </div>
                            )}

                            {activeDoc.homeworkGrade && (
                              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                Note : {activeDoc.homeworkGrade}
                                {activeDoc.homeworkFeedback ? ` — ${activeDoc.homeworkFeedback}` : ''}
                              </div>
                            )}
                          </div>
                        )}

                        {activeDoc.versions.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <div className="text-[11px] font-bold text-slate-500 inline-flex items-center gap-1">
                              <History className="w-3 h-3" />
                              Historique récent
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {activeDoc.versions.slice(0, 4).map((v) => (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleDocBufferChange(v.contentSnapshot)}
                                  className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                                >
                                  {v.editorName} · {new Date(v.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ================================================================= */}
      {/* MODALS : NOUVEAU CANAL / GROUPE / DM, NOUVELLE RÉUNION, NOUVEAU DOC */}
      {/* ================================================================= */}
      {newConvOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateConversation}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Créer un espace Teams (Canal, Projet, Groupe ou DM)
              </h3>
              <button type="button" onClick={() => setNewConvOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(
                [
                  ['CHANNEL', 'Canal thème'],
                  ['PROJECT', 'Canal projet'],
                  ['FORMATION', 'Cours / Formation'],
                  ['ONBOARDING', 'Intégration RH'],
                  ['GROUP', 'Discussion groupe'],
                  ['DM', 'Échange privé'],
                ] as const
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setNewConvKind(k)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold ${
                    newConvKind === k
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {newConvKind !== 'DM' && (
              <>
                <input
                  type="text"
                  required
                  value={newConvName}
                  onChange={(e) => setNewConvName(e.target.value)}
                  placeholder="Nom du canal ou groupe..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  value={newConvTopic}
                  onChange={(e) => setNewConvTopic(e.target.value)}
                  placeholder="Thème / Objectif..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </>
            )}

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Participants ({newConvMembers.length} sélectionné(s))
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                {(workspace?.directory || [])
                  .filter((d) => d.userId !== workspace?.currentUser.userId)
                  .map((person) => {
                    const checked = newConvMembers.includes(person.userId);
                    return (
                      <label
                        key={person.userId}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-xs"
                      >
                        <span className="truncate">
                          {person.name} <span className="text-slate-400">({person.title})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setNewConvMembers((prev) =>
                              newConvKind === 'DM'
                                ? [person.userId]
                                : checked
                                  ? prev.filter((id) => id !== person.userId)
                                  : [...prev, person.userId],
                            )
                          }
                        />
                      </label>
                    );
                  })}
              </div>
            </div>

            {newConvKind !== 'DM' && newConvKind !== 'GROUP' && (
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={newConvPrivate}
                  onChange={(e) => setNewConvPrivate(e.target.checked)}
                />
                Canal privé (membres invités uniquement)
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewConvOpen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {newMeetingOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Démarrer une réunion ou classe virtuelle
              </h3>
              <button type="button" onClick={() => setNewMeetingOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              type="text"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              placeholder="Objet de la réunion / du cours..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <select
              value={newMeetingMode}
              onChange={(e) => setNewMeetingMode(e.target.value as TeamsMeetingMode)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="VIDEO">Visioconférence Vidéo &amp; Partage d’écran</option>
              <option value="AUDIO">Appel Audio d’équipe</option>
              <option value="REUNION_PROJET">Réunion Projet à distance</option>
              <option value="COURS_DISTANT">Cours / Formation à distance</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewMeetingOpen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void startQuickMeeting(newMeetingMode, newMeetingTitle)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                Démarrer maintenant
              </button>
            </div>
          </div>
        </div>
      )}

      {newDocOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDoc}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Nouveau document collaboratif
              </h3>
              <button type="button" onClick={() => setNewDocOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Titre du document ou devoir..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <select
              value={newDocCategory}
              onChange={(e) => setNewDocCategory(e.target.value as TeamsDocCategory)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="PROJET">Document Projet</option>
              <option value="COMPTE_RENDU">Compte rendu réunion</option>
              <option value="DEVOIR_GROUPE">Devoir / Travail de groupe (Formation)</option>
              <option value="COURS_SUPPORT">Support de cours</option>
              <option value="ONBOARDING">Guide d’intégration</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewDocOpen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                Créer &amp; Coéditer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
