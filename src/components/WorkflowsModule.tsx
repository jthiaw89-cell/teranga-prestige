import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  FilePlus2,
  GitBranch,
  Inbox,
  MessageSquare,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  UserCheck,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  DynamicFormTemplate,
  WorkflowCategory,
  WorkflowInstanceRecord,
  WorkflowsOverviewPayload,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

type WorkflowTab = 'inbox' | 'new_request' | 'my_requests' | 'builder';

const STATUS_META: Record<WorkflowInstanceRecord['status'], { label: string; cls: string }> = {
  EN_ATTENTE: { label: 'En cours de validation', cls: 'text-amber-700 dark:text-amber-300 font-semibold' },
  COMPLEMENT_REQUIS: { label: 'Complément requis', cls: 'text-orange-700 dark:text-orange-300 font-semibold' },
  APPROUVEE: { label: 'Approuvée', cls: 'text-emerald-700 dark:text-emerald-300 font-semibold' },
  REJETEE: { label: 'Rejetée', cls: 'text-rose-700 dark:text-rose-300 font-semibold' },
  ANNULEE: { label: 'Annulée', cls: 'text-gray-500 dark:text-gray-400' },
};

export const WorkflowsModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<WorkflowsOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<WorkflowTab>('my_requests');

  // Batch selection in Inbox
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // New request form
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl-1');
  const [reqTitle, setReqTitle] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delegation & Builder
  const [delegateName, setDelegateName] = useState('');
  const [delegateStart, setDelegateStart] = useState('2026-11-24');
  const [delegateEnd, setDelegateEnd] = useState('2026-11-28');
  const [delegateScope, setDelegateScope] = useState('Demandes < 300 000 FCFA');

  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplCategory, setNewTplCategory] = useState<WorkflowCategory>('DEMANDE_LIBRE');
  const [newTplSteps, setNewTplSteps] = useState('Manager N+1, Direction');
  const [newTplSla, setNewTplSla] = useState('48');

  const loadWorkflows = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/workflows/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement workflows impossible.');
        return;
      }
      const typed = payload as WorkflowsOverviewPayload;
      setData(typed);
      if (typed.canApprove && typed.inboxRequests.length > 0) {
        setTab((prev) => (prev === 'my_requests' ? 'inbox' : prev));
      }
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadWorkflows(false);
  }, [loadWorkflows]);

  const activeTemplate: DynamicFormTemplate | undefined = useMemo(
    () => (data?.templates || []).find((t) => t.id === selectedTemplateId) || data?.templates?.[0],
    [data?.templates, selectedTemplateId],
  );

  async function submitNewRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTemplate) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/workflows/requests', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          templateId: activeTemplate.id,
          category: activeTemplate.category,
          title: reqTitle.trim() || activeTemplate.title,
          amountFcfa: reqAmount ? Number(reqAmount) : Number(formValues.montantFcfa || 0) || undefined,
          formValues,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Soumission impossible.');
        return;
      }
      setData(payload as WorkflowsOverviewPayload);
      setReqTitle('');
      setReqAmount('');
      setFormValues({});
      setTab('my_requests');
      setNotice(`Demande ${payload.instance?.reference || ''} soumise dans le circuit.`);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWorkflowAction(
    id: string,
    action: 'APPROUVE' | 'REJETE' | 'COMPLEMENT' | 'ANNULE',
  ) {
    setError('');
    try {
      const res = await fetch(`/api/workflows/requests/${id}/action`, {
        method: 'PATCH',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ action, comment: actionNotes[id] || '' }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Action refusée.');
        return;
      }
      setData(payload as WorkflowsOverviewPayload);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      setNotice('Circuit mis à jour avec horodatage.');
    } catch {
      setError('Erreur réseau.');
    }
  }

  async function handleBatchApprove() {
    if (selectedIds.length === 0) return;
    setError('');
    try {
      const res = await fetch('/api/workflows/requests/batch-approve', {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({ ids: selectedIds, comment: 'Validation par lots depuis la boîte À traiter.' }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Validation par lots impossible.');
        return;
      }
      setData(payload as WorkflowsOverviewPayload);
      setSelectedIds([]);
      setNotice(`${selectedIds.length} demande(s) validée(s) par lot.`);
    } catch {
      setError('Erreur réseau.');
    }
  }

  async function postComment(id: string) {
    const content = (commentInputs[id] || '').trim();
    if (!content) return;
    const res = await fetch(`/api/workflows/requests/${id}/comments`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({ content, visibility: 'PUBLIC' }),
    });
    if (res.ok) {
      const payload = await res.json();
      setData(payload as WorkflowsOverviewPayload);
      setCommentInputs((p) => ({ ...p, [id]: '' }));
    }
  }

  async function saveDelegation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/workflows/delegations', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        delegateName,
        startDate: delegateStart,
        endDate: delegateEnd,
        scope: delegateScope,
      }),
    });
    if (res.ok) {
      setData((await res.json()) as WorkflowsOverviewPayload);
      setDelegateName('');
      setNotice('Délégation de signature enregistrée.');
    }
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/workflows/templates', {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify({
        title: newTplTitle,
        category: newTplCategory,
        approvalSteps: newTplSteps.split(',').map((s) => s.trim()).filter(Boolean),
        slaHours: Number(newTplSla) || 48,
      }),
    });
    if (res.ok) {
      setData((await res.json()) as WorkflowsOverviewPayload);
      setNewTplTitle('');
      setNotice('Nouveau modèle de formulaire & circuit publié.');
    }
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const stats = data?.stats || { myPending: 0, toApproveCount: 0, approvedCount: 0, avgTurnaroundHours: 14 };

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
            <span>Boîte « À traiter »</span>
            <Inbox className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.toApproveCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Mes demandes en cours</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.myPending}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Dossiers approuvés</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.approvedCount}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Délai moyen traitement</span>
            <GitBranch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.avgTurnaroundHours} h
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
          {data?.canApprove && (
            <button
              type="button"
              onClick={() => setTab('inbox')}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
                tab === 'inbox' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              À traiter ({stats.toApproveCount})
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('my_requests')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
              tab === 'my_requests' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Toutes les demandes
          </button>
          <button
            type="button"
            onClick={() => setTab('new_request')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
              tab === 'new_request' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            + Nouvelle demande
          </button>
          {(data?.canConfigure || data?.canApprove) && (
            <button
              type="button"
              onClick={() => setTab('builder')}
              className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold ${
                tab === 'builder' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-xs' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Circuits, Formulaires & Délégations
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {tab === 'inbox' && selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void handleBatchApprove()}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Approuver la sélection ({selectedIds.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadWorkflows(true)}
            aria-label="Actualiser"
            className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setTab('new_request')}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Déposer une demande</span>
          </button>
        </div>
      </div>

      {/* INBOX OR ALL REQUESTS */}
      {(tab === 'inbox' || tab === 'my_requests') && (
        <div className="space-y-4">
          {(tab === 'inbox' ? data?.inboxRequests || [] : data?.requests || []).length === 0 ? (
            <div className="p-8 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-center space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tab === 'inbox' ? 'Aucune demande en attente de validation.' : 'Aucune demande enregistrée sur votre périmètre.'}
              </p>
              <button
                type="button"
                onClick={() => setTab('new_request')}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Créer une première demande
              </button>
            </div>
          ) : (
            (tab === 'inbox' ? data?.inboxRequests || [] : data?.requests || []).map((wf) => {
              const st = STATUS_META[wf.status];
              const isSelected = selectedIds.includes(wf.id);
              return (
                <div
                  key={wf.id}
                  className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {tab === 'inbox' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, wf.id] : prev.filter((x) => x !== wf.id),
                            )
                          }
                          aria-label={`Sélectionner ${wf.reference}`}
                          className="mt-1 h-4 w-4 rounded border-gray-300"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                          <span>{wf.reference}</span>
                          <span aria-hidden="true">·</span>
                          <span>{wf.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{wf.requesterName}</span>
                          {wf.amountFcfa ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-gray-800 dark:text-gray-200">
                                {wf.amountFcfa.toLocaleString('fr-FR')} FCFA
                              </span>
                            </>
                          ) : null}
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                          {wf.title}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs ${st.cls}`}>{st.label}</span>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Étape : {wf.currentApproverRole}
                      </div>
                    </div>
                  </div>

                  {/* Form values summary */}
                  {Object.keys(wf.formValues).length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                      {Object.entries(wf.formValues).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-gray-500 dark:text-gray-400">{k} : </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Audit trail & QR */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex flex-wrap items-center gap-3">
                      {wf.history.map((h) => (
                        <span key={h.id}>
                          {h.stepLabel} ({h.action} · {h.actorName})
                        </span>
                      ))}
                    </div>
                    {wf.verificationQrCode && (
                      <span className="inline-flex items-center gap-1 font-mono text-emerald-700 dark:text-emerald-300">
                        <QrCode className="w-3.5 h-3.5" />
                        {wf.verificationQrCode}
                      </span>
                    )}
                  </div>

                  {/* Comments */}
                  {wf.comments.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                      {wf.comments.map((c) => (
                        <div key={c.id} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="font-semibold">{c.authorName} :</span>
                          <span>{c.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions bar */}
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={commentInputs[wf.id] || ''}
                        onChange={(e) => setCommentInputs((p) => ({ ...p, [wf.id]: e.target.value }))}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 min-h-[36px] px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => void postComment(wf.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {data?.canApprove && (wf.status === 'EN_ATTENTE' || wf.status === 'COMPLEMENT_REQUIS') && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="text"
                          value={actionNotes[wf.id] || ''}
                          onChange={(e) => setActionNotes((p) => ({ ...p, [wf.id]: e.target.value }))}
                          placeholder="Visa / motif..."
                          className="w-40 min-h-[36px] px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => void handleWorkflowAction(wf.id, 'APPROUVE')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          Approuver
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleWorkflowAction(wf.id, 'COMPLEMENT')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                        >
                          Complément
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleWorkflowAction(wf.id, 'REJETE')}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                        >
                          Rejeter
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* NEW REQUEST DYNAMIC FORM */}
      {tab === 'new_request' && activeTemplate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 px-2 pb-2 border-b border-gray-100 dark:border-gray-800">
              Catalogue des demandes
            </h3>
            {(data?.templates || []).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(tpl.id);
                  setFormValues({});
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  tpl.id === activeTemplate.id
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="text-xs font-semibold">{tpl.title}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Circuit : {tpl.approvalSteps.join(' → ')} · SLA {tpl.slaHours}h
                </div>
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => void submitNewRequest(e)}
            className="lg:col-span-2 p-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4"
          >
            <div>
              <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {activeTemplate.code} · v{activeTemplate.version} · Circuit : {activeTemplate.approvalSteps.join(' → ')}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{activeTemplate.title}</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Objet résumé de la demande *</label>
                <input
                  type="text"
                  required
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                  placeholder={`Ex. ${activeTemplate.title} — ${session.name}`}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>

              {activeTemplate.fields.map((field) => (
                <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label} {field.required ? '*' : ''}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={formValues[field.key] || ''}
                      onChange={(e) => setFormValues((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Sélectionner...</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      value={formValues[field.key] || ''}
                      onChange={(e) => setFormValues((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      value={formValues[field.key] || ''}
                      onChange={(e) => setFormValues((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[40px] px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold"
              >
                {submitting ? 'Transmission...' : 'Soumettre dans le circuit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FORM BUILDER & DELEGATIONS */}
      {tab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={(e) => void saveTemplate(e)}
            className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <FilePlus2 className="w-4 h-4 text-blue-600" />
              <span>Générateur sans code : nouveau type de demande</span>
            </h3>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                required
                value={newTplTitle}
                onChange={(e) => setNewTplTitle(e.target.value)}
                placeholder="Intitulé du formulaire (ex. Demande avance sur salaire)"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newTplCategory}
                  onChange={(e) => setNewTplCategory(e.target.value as WorkflowCategory)}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="AVANCE_SALAIRE">Avance sur salaire</option>
                  <option value="ATTESTATION">Attestation</option>
                  <option value="ORDRE_MISSION">Ordre de mission</option>
                  <option value="NOTE_FRAIS">Note de frais</option>
                  <option value="MATERIEL">Matériel</option>
                  <option value="DEMANDE_LIBRE">Demande libre</option>
                </select>
                <input
                  type="number"
                  value={newTplSla}
                  onChange={(e) => setNewTplSla(e.target.value)}
                  placeholder="Délai SLA (heures)"
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <input
                type="text"
                value={newTplSteps}
                onChange={(e) => setNewTplSteps(e.target.value)}
                placeholder="Étapes séparées par virgules (ex. Manager N+1, RH, DAF)"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Publier le formulaire & circuit
              </button>
            </div>
          </form>

          <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Délégations & suppléances temporaires</span>
            </h3>
            <form onSubmit={(e) => void saveDelegation(e)} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <input
                type="text"
                required
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder="Nom du suppléant désigné"
                className="sm:col-span-2 min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="date"
                value={delegateStart}
                onChange={(e) => setDelegateStart(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="date"
                value={delegateEnd}
                onChange={(e) => setDelegateEnd(e.target.value)}
                className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                value={delegateScope}
                onChange={(e) => setDelegateScope(e.target.value)}
                placeholder="Périmètre délégué"
                className="sm:col-span-2 min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <button
                type="submit"
                className="sm:col-span-2 min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                Activer la suppléance
              </button>
            </form>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 pt-2">
              {(data?.delegations || []).map((del) => (
                <div key={del.id} className="py-2 text-xs">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {del.delegatorName} → {del.delegateName}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                    {del.startDate} → {del.endDate} · {del.scope}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
