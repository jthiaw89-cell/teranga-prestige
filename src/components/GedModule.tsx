import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  Lock,
  Plus,
  Presentation,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import { buildAuthHeaders } from '../lib/authHeaders';
import type {
  AuthSessionSummary,
  DocumentClassification,
  GedDocumentRecord,
  GedOverviewPayload,
} from '../types';

interface Props {
  session: AuthSessionSummary;
}

interface PendingGedFile {
  fileName: string;
  mimeType: string;
  sizeKb: number;
  fileDataUrl: string;
  ext: string;
}

const ACCEPTED_GED_EXTENSIONS =
  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,.odp,.png,.jpg,.jpeg,.webp,.zip';

const CLASSIF_TONES: Record<DocumentClassification, string> = {
  PUBLIC: 'text-emerald-700 dark:text-emerald-300',
  INTERNE: 'text-blue-700 dark:text-blue-300',
  CONFIDENTIEL: 'text-amber-700 dark:text-amber-300',
  SECRET: 'text-rose-700 dark:text-rose-300 font-semibold',
};

function detectFileExt(fileName?: string, title?: string): string {
  const source = (fileName || title || '').trim().toLowerCase();
  const parts = source.split('.');
  if (parts.length > 1) return parts[parts.length - 1].toUpperCase();
  return 'DOC';
}

function renderFileIcon(ext: string) {
  if (ext === 'XLS' || ext === 'XLSX' || ext === 'ODS' || ext === 'CSV') {
    return <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
  }
  if (ext === 'PPT' || ext === 'PPTX' || ext === 'ODP') {
    return <Presentation className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
}

function readFileAsDataUrl(file: File): Promise<PendingGedFile> {
  return new Promise((resolve, reject) => {
    if (file.size > 18 * 1024 * 1024) {
      reject(new Error(`Le fichier "${file.name}" dépasse la limite de 18 Mo.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeKb: Math.max(1, Math.round(file.size / 1024)),
        fileDataUrl: String(reader.result || ''),
        ext: detectFileExt(file.name),
      });
    };
    reader.onerror = () => reject(new Error(`Lecture impossible pour "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

export const GedModule: React.FC<Props> = ({ session }) => {
  const [data, setData] = useState<GedOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);

  const [activeFolderId, setActiveFolderId] = useState<string>('ALL');
  const [classifFilter, setClassifFilter] = useState<'ALL' | DocumentClassification>('ALL');
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<GedDocumentRecord | null>(null);

  // Upload modal
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upTitle, setUpTitle] = useState('');
  const [upFolderId, setUpFolderId] = useState('fld-gov');
  const [upCategory, setUpCategory] = useState<GedDocumentRecord['category']>('PROCEDURE');
  const [upClassif, setUpClassif] = useState<DocumentClassification>('INTERNE');
  const [upTags, setUpTags] = useState('Officiel, 2026');
  const [upRequireAck, setUpRequireAck] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingGedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const versionFileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Preview state
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    mimeType: string;
    objectUrl: string;
    textContent?: string;
  } | null>(null);

  const loadGed = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ged/overview', {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || 'Chargement GED impossible.');
        return;
      }
      setData(payload as GedOverviewPayload);
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [session.space]);

  useEffect(() => {
    void loadGed(false);
  }, [loadGed]);

  useEffect(() => {
    return () => {
      if (previewDoc?.objectUrl) URL.revokeObjectURL(previewDoc.objectUrl);
    };
  }, [previewDoc]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.documents || []).filter((d) => {
      if (activeFolderId !== 'ALL' && d.folderId !== activeFolderId) return false;
      if (classifFilter !== 'ALL' && d.classification !== classifFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.fileName || '').toLowerCase().includes(q) ||
        d.reference.toLowerCase().includes(q) ||
        d.ownerName.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [activeFolderId, classifFilter, data?.documents, search]);

  async function handleFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    try {
      const readAll = await Promise.all(Array.from(files).map(readFileAsDataUrl));
      setPendingFiles((prev) => [...prev, ...readAll]);
      if (!upTitle.trim() && readAll.length === 1) {
        setUpTitle(readAll[0].fileName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lecture fichier impossible.');
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (pendingFiles.length === 0 && !upTitle.trim()) {
      setError('Sélectionnez au moins un fichier ou saisissez un titre.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const parsedTags = upTags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      let latestPayload: GedOverviewPayload | null = null;

      if (pendingFiles.length === 0) {
        const res = await fetch('/api/ged/documents', {
          method: 'POST',
          headers: buildAuthHeaders(session.space, true),
          credentials: 'include',
          body: JSON.stringify({
            title: upTitle.trim(),
            folderId: upFolderId,
            category: upCategory,
            classification: upClassif,
            tags: parsedTags,
            requiresAcknowledgement: upRequireAck,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Téléversement refusé.');
        latestPayload = payload as GedOverviewPayload;
      } else {
        for (let idx = 0; idx < pendingFiles.length; idx += 1) {
          const file = pendingFiles[idx];
          const titleForDoc =
            pendingFiles.length === 1 && upTitle.trim() ? upTitle.trim() : file.fileName;
          const res = await fetch('/api/ged/documents', {
            method: 'POST',
            headers: buildAuthHeaders(session.space, true),
            credentials: 'include',
            body: JSON.stringify({
              title: titleForDoc,
              folderId: upFolderId,
              category: upCategory,
              classification: upClassif,
              tags: parsedTags.length > 0 ? parsedTags : [file.ext, 'GED'],
              requiresAcknowledgement: upRequireAck,
              fileName: file.fileName,
              mimeType: file.mimeType,
              sizeKb: file.sizeKb,
              fileDataUrl: file.fileDataUrl,
            }),
          });
          const payload = await res.json();
          if (!res.ok) throw new Error(payload.error || `Échec sur ${file.fileName}`);
          latestPayload = payload as GedOverviewPayload;
        }
      }

      if (latestPayload) setData(latestPayload);
      setUploadOpen(false);
      setUpTitle('');
      setPendingFiles([]);
      setNotice(
        pendingFiles.length > 1
          ? `${pendingFiles.length} fichiers indexés dans le coffre-fort GED.`
          : 'Document déposé et indexé dans la GED.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Téléversement refusé.');
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadNewVersion(docId: string, file: File) {
    setError('');
    try {
      const parsed = await readFileAsDataUrl(file);
      const res = await fetch(`/api/ged/documents/${docId}/version`, {
        method: 'POST',
        headers: buildAuthHeaders(session.space, true),
        credentials: 'include',
        body: JSON.stringify({
          changeNote: `Fichier ${parsed.fileName} importé par ${session.name}`,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType,
          fileDataUrl: parsed.fileDataUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Import version impossible.');
      const updated = payload as GedOverviewPayload;
      setData(updated);
      setSelectedDoc(updated.documents.find((d) => d.id === docId) || null);
      setNotice(`Nouvelle version (${parsed.fileName}) enregistrée.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur import version.');
    }
  }

  async function handleDownloadDocument(doc: GedDocumentRecord, versionNumber?: number) {
    setError('');
    try {
      const ver = versionNumber || doc.currentVersion;
      const res = await fetch(`/api/ged/documents/${doc.id}/download?version=${ver}`, {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Téléchargement impossible.');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const verObj = doc.versions.find((v) => v.version === ver);
      a.download = verObj?.fileName || doc.fileName || `${doc.reference}-v${ver}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur téléchargement.');
    }
  }

  async function handlePreviewDocument(doc: GedDocumentRecord) {
    setError('');
    try {
      const res = await fetch(`/api/ged/documents/${doc.id}/download?version=${doc.currentVersion}&inline=1`, {
        headers: buildAuthHeaders(session.space, false),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Aperçu indisponible.');
      const blob = await res.blob();
      const mimeType = res.headers.get('Content-Type') || doc.mimeType || 'application/octet-stream';
      const objectUrl = URL.createObjectURL(blob);
      let textContent: string | undefined;
      if (mimeType.startsWith('text/')) {
        textContent = await blob.text();
      }
      if (previewDoc?.objectUrl) URL.revokeObjectURL(previewDoc.objectUrl);
      setPreviewDoc({
        title: doc.fileName || doc.title,
        mimeType,
        objectUrl,
        textContent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aperçu impossible.');
    }
  }

  async function docAction(id: string, endpoint: 'version' | 'sign' | 'acknowledge' | 'checkout' | 'share') {
    const res = await fetch(`/api/ged/documents/${id}/${endpoint}`, {
      method: 'POST',
      headers: buildAuthHeaders(session.space, true),
      credentials: 'include',
      body: JSON.stringify(endpoint === 'version' ? { changeNote: `Mise à jour par ${session.name}` } : {}),
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error || 'Action impossible.');
      return;
    }
    const updated = payload as GedOverviewPayload;
    setData(updated);
    const refreshed = updated.documents.find((d) => d.id === id) || null;
    setSelectedDoc(refreshed);
    const labels: Record<typeof endpoint, string> = {
      version: 'Nouvelle version enregistrée dans l’historique.',
      sign: 'Signature électronique horodatée apposée.',
      acknowledge: 'Accusé de lecture enregistré.',
      checkout: 'État de verrouillage / check-out mis à jour.',
      share: 'Lien de partage sécurisé temporaire généré.',
    };
    setNotice(labels[endpoint]);
  }

  if (loading && !data) {
    return (
      <div className="h-72 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
    );
  }

  const stats = data?.stats || { totalDocs: 0, pendingAcknowledgements: 0, signedDocs: 0, totalSizeMb: 0 };

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Documents indexés</span>
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.totalDocs}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums">
            {stats.totalSizeMb} Mo
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Accusés de lecture requis</span>
            <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {stats.pendingAcknowledgements}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Documents signés</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            {stats.signedDocs}
          </p>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Bibliothèques actives</span>
            <FolderOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
            {(data?.folders || []).length}
          </p>
        </div>
      </div>

      {/* Main Split View: Folders + Documents + Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Folders Sidebar */}
        <div className="lg:col-span-3 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2 h-fit">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Arborescence GED</span>
            <button
              type="button"
              onClick={() => void loadGed(true)}
              aria-label="Actualiser"
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setActiveFolderId('ALL')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${
              activeFolderId === 'ALL'
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Tous les dossiers accessibles ({(data?.documents || []).length})
          </button>
          {(data?.folders || []).map((fld) => (
            <button
              key={fld.id}
              type="button"
              onClick={() => setActiveFolderId(fld.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                activeFolderId === fld.id
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="truncate">{fld.name}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {fld.classification} · Conservation {fld.retentionYears} ans
              </div>
            </button>
          ))}
        </div>

        {/* Document Table + Actions */}
        <div className="lg:col-span-9 space-y-4">
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher titre, fichier, référence..."
                  className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                />
              </div>
              <select
                value={classifFilter}
                onChange={(e) => setClassifFilter(e.target.value as 'ALL' | DocumentClassification)}
                aria-label="Filtrer par classification"
                className="min-h-[40px] px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                <option value="ALL">Toutes classifications</option>
                <option value="PUBLIC">Public</option>
                <option value="INTERNE">Interne</option>
                <option value="CONFIDENTIEL">Confidentiel</option>
                <option value="SECRET">Secret</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setError('');
                setUploadOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Déposer des fichiers</span>
            </button>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {filteredDocs.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 dark:text-gray-400">
                Aucun document dans ce filtre.
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const acked = doc.acknowledgedByIds.includes(session.userId);
                const ext = doc.fileExtension || detectFileExt(doc.fileName, doc.title);
                return (
                  <div key={doc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                        <span>{doc.reference}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{ext}</span>
                        <span aria-hidden="true">·</span>
                        <span className={CLASSIF_TONES[doc.classification]}>{doc.classification}</span>
                        <span aria-hidden="true">·</span>
                        <span>v{doc.currentVersion}</span>
                        <span aria-hidden="true">·</span>
                        <span>{doc.sizeKb} Ko</span>
                        {doc.checkedOutBy && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-600 dark:text-amber-400">Verrouillé par {doc.checkedOutBy}</span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className="text-left text-sm font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2"
                      >
                        {renderFileIcon(ext)}
                        <span className="truncate">{doc.title}</span>
                      </button>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Déposé par {doc.ownerName} · Rétention {doc.retentionUntil}
                        {doc.signedByName && ` · Signé par ${doc.signedByName}`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {doc.requiresAcknowledgement && !acked && (
                        <button
                          type="button"
                          onClick={() => void docAction(doc.id, 'acknowledge')}
                          className="min-h-[34px] px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          Accuser réception
                        </button>
                      )}
                      {doc.requiresAcknowledgement && acked && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium px-2">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Lu
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handlePreviewDocument(doc)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" /> Aperçu
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDownloadDocument(doc)}
                        className="min-h-[34px] px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" /> Télécharger
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className="min-h-[34px] px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
                      >
                        Gérer / Versions
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Document Detail Panel */}
          {selectedDoc && (
            <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {selectedDoc.reference} · {selectedDoc.fileExtension || detectFileExt(selectedDoc.fileName, selectedDoc.title)} · v{selectedDoc.currentVersion} · {selectedDoc.classification}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                    {selectedDoc.title}
                  </h3>
                </div>
                <button type="button" onClick={() => setSelectedDoc(null)} aria-label="Fermer le panneau">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  ref={versionFileInputRef}
                  type="file"
                  accept={ACCEPTED_GED_EXTENSIONS}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && selectedDoc) {
                      void handleUploadNewVersion(selectedDoc.id, f);
                    }
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => versionFileInputRef.current?.click()}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> Importer fichier v{selectedDoc.currentVersion + 1}
                </button>
                <button
                  type="button"
                  onClick={() => void docAction(selectedDoc.id, 'version')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Révision métadonnées
                </button>
                <button
                  type="button"
                  onClick={() => void docAction(selectedDoc.id, 'sign')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Signer (horodatage)
                </button>
                <button
                  type="button"
                  onClick={() => void docAction(selectedDoc.id, 'checkout')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  {selectedDoc.checkedOutBy ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {selectedDoc.checkedOutBy ? 'Libérer check-out' : 'Verrouiller check-out'}
                </button>
                <button
                  type="button"
                  onClick={() => void docAction(selectedDoc.id, 'share')}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" /> Créer lien expirant
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Historique des versions
                  </h4>
                  <div className="space-y-1.5">
                    {selectedDoc.versions.map((v) => (
                      <div key={v.version} className="flex items-center justify-between gap-2 text-gray-600 dark:text-gray-400">
                        <span className="truncate">v{v.version} — {v.changeNote} ({v.uploadedBy})</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums">{v.sizeKb} Ko</span>
                          <button
                            type="button"
                            onClick={() => void handleDownloadDocument(selectedDoc, v.version)}
                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>v{v.version}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Liens de partage sécurisés
                  </h4>
                  {selectedDoc.shareLinks.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">Aucun lien généré.</p>
                  ) : (
                    selectedDoc.shareLinks.map((lnk) => (
                      <div key={lnk.id} className="font-mono text-gray-600 dark:text-gray-400">
                        /share/{lnk.token} · expire {lnk.expiresAt} ({lnk.accessCount} accès)
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleUpload(e)}
            className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Déposer dans la GED &amp; Coffre-Fort
              </h3>
              <button type="button" onClick={() => setUploadOpen(false)} aria-label="Fermer">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Drag & Drop / File Picker */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                void handleFilesPicked(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
              }}
              className={`rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 bg-gray-50/60 dark:bg-gray-950/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_GED_EXTENSIONS}
                className="hidden"
                onChange={(e) => {
                  void handleFilesPicked(e.target.files);
                  e.target.value = '';
                }}
              />
              <Upload className="w-6 h-6 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                Glisser-déposer ou parcourir des fichiers
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                PDF · Word (.doc/.docx) · Excel (.xls/.xlsx) · PowerPoint (.ppt/.pptx) · TXT · CSV · Images · ZIP (max 18 Mo)
              </div>
            </div>

            {pendingFiles.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {pendingFiles.map((f, idx) => (
                  <div
                    key={`${f.fileName}-${idx}`}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {renderFileIcon(f.ext)}
                      <span className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {f.fileName}
                      </span>
                      <span className="font-mono text-[11px] text-gray-500 shrink-0">
                        {f.ext} · {f.sizeKb} Ko
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-rose-600 shrink-0"
                      aria-label="Retirer fichier"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <input
                type="text"
                required={pendingFiles.length === 0}
                value={upTitle}
                onChange={(e) => setUpTitle(e.target.value)}
                placeholder={
                  pendingFiles.length > 1
                    ? 'Noms automatiques depuis les fichiers sélectionnés'
                    : 'Titre du document dans la GED'
                }
                disabled={pendingFiles.length > 1}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 disabled:opacity-60"
              />
              <select
                value={upFolderId}
                onChange={(e) => setUpFolderId(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              >
                {(data?.folders || []).map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={upCategory}
                  onChange={(e) => setUpCategory(e.target.value as GedDocumentRecord['category'])}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="PROCEDURE">Procédure</option>
                  <option value="CONTRAT">Contrat</option>
                  <option value="BULLETIN_PAIE">Bulletin de paie</option>
                  <option value="ATTESTATION">Attestation</option>
                  <option value="SUPPORT_COURS">Support cours</option>
                  <option value="FACTURE_PIECE">Pièce comptable</option>
                  <option value="GOUVERNANCE">Gouvernance</option>
                </select>
                <select
                  value={upClassif}
                  onChange={(e) => setUpClassif(e.target.value as DocumentClassification)}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNE">Interne</option>
                  <option value="CONFIDENTIEL">Confidentiel</option>
                  <option value="SECRET">Secret</option>
                </select>
              </div>
              <input
                type="text"
                value={upTags}
                onChange={(e) => setUpTags(e.target.value)}
                placeholder="Mots-clés séparés par des virgules"
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100"
              />
              <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={upRequireAck}
                  onChange={(e) => setUpRequireAck(e.target.checked)}
                />
                <span>Exiger un accusé de lecture nominatif</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setUploadOpen(false);
                  setPendingFiles([]);
                }}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={uploading}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold"
              >
                {uploading
                  ? 'Téléversement...'
                  : pendingFiles.length > 1
                  ? `Indexer ${pendingFiles.length} fichiers`
                  : 'Indexer dans la GED'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inline File Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {previewDoc.title}
              </h3>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(previewDoc.objectUrl);
                  setPreviewDoc(null);
                }}
                aria-label="Fermer l'aperçu"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-4 min-h-[420px]">
              {previewDoc.textContent !== undefined ? (
                <pre className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                  {previewDoc.textContent}
                </pre>
              ) : previewDoc.mimeType.startsWith('image/') ? (
                <img
                  src={previewDoc.objectUrl}
                  alt={previewDoc.title}
                  className="max-h-[70vh] mx-auto rounded-lg object-contain"
                />
              ) : previewDoc.mimeType === 'application/pdf' ? (
                <iframe
                  src={previewDoc.objectUrl}
                  title={previewDoc.title}
                  className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-gray-800 bg-white"
                />
              ) : (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <FileText className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                  <span>{previewDoc.title} ({previewDoc.mimeType})</span>
                  <a
                    href={previewDoc.objectUrl}
                    download={previewDoc.title}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Télécharger le fichier
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
