import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Phone,
  Plus,
  Printer,
  Search,
  Send,
  Trash2,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CommercialDocument,
  ContactType,
  CrmActivityKind,
  CrmActivityLog,
  CrmCampaign,
  CrmCampaignAudience,
  CrmCampaignStatus,
  CrmContact,
  CrmPipelineStage,
  DocumentKind,
  DocumentLine,
  DocumentPayment,
  DocumentStatus,
  OrganizationOption,
  WhatsappFollowUp,
  WhatsappRelanceStatus,
} from '../types';

import { buildAuthHeaders } from '../lib/authHeaders';
import type { AuthSessionSummary } from './LoginScreen';

interface Props {
  organization: OrganizationOption;
  session?: AuthSessionSummary;
}

type CrmTab = 'overview' | 'contacts' | 'documents' | 'campaigns' | 'whatsapp' | 'activity';

interface CrmStorePayload {
  contacts: CrmContact[];
  documents: CommercialDocument[];
  campaigns: CrmCampaign[];
  followUps: WhatsappFollowUp[];
  activities: CrmActivityLog[];
}

const KIND_LABELS: Record<DocumentKind, string> = {
  QUOTE: 'Devis client',
  CUSTOMER_ORDER: 'Commande client',
  DELIVERY_NOTE: 'Bon de livraison',
  CUSTOMER_INVOICE: 'Facture client',
  PURCHASE_ORDER: 'Bon de commande fournisseur',
  SUPPLIER_INVOICE: 'Facture fournisseur',
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  PARTIAL: 'Partiel',
  DELIVERED: 'Livré',
  PAID: 'Soldé',
};

const PIPELINE_LABELS: Record<CrmPipelineStage, string> = {
  NOUVEAU: 'Nouveau',
  CONTACTE: 'Contacté',
  QUALIFIE: 'Qualifié',
  PROPOSITION: 'Proposition',
  GAGNE: 'Gagné',
};

const PIPELINE_COLORS: Record<CrmPipelineStage, string> = {
  NOUVEAU: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  CONTACTE: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  QUALIFIE: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  PROPOSITION: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  GAGNE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
};

const AUDIENCE_LABELS: Record<CrmCampaignAudience, string> = {
  ALL_CLIENTS_PROSPECTS: 'Tous les clients & prospects',
  QUALIFIED_PROSPECTS: 'Prospects qualifiés (pipeline)',
  WHATSAPP_OPTIN: 'Contacts avec consentement WhatsApp',
  UNPAID_INVOICES: 'Clients avec factures à solder',
};

const CAMPAIGN_STATUS_LABELS: Record<CrmCampaignStatus, string> = {
  BROUILLON: 'Brouillon',
  ACTIVE: 'Active',
  TERMINEE: 'Terminée',
};

const RELANCE_STATUS_LABELS: Record<WhatsappRelanceStatus, string> = {
  A_ENVOYER: 'Préparé (à ouvrir)',
  OUVERT_WHATSAPP: 'Ouvert dans WhatsApp',
  ENVOI_CONFIRME: 'Envoi confirmé',
  REPONSE_RECUE: 'Réponse reçue',
  REPORTE: 'Reporté',
};

const RELANCE_STATUS_BADGE: Record<WhatsappRelanceStatus, string> = {
  A_ENVOYER: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
  OUVERT_WHATSAPP: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
  ENVOI_CONFIRME: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  REPONSE_RECUE: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800/60',
  REPORTE: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
};

const ACTIVITY_LABELS: Record<CrmActivityKind, string> = {
  APPEL: 'Appel téléphonique',
  WHATSAPP: 'Relance WhatsApp',
  EMAIL: 'E-mail / Devis',
  REUNION: 'Réunion client',
  DOCUMENT: 'Pièce commerciale',
  NOTE: 'Note de suivi',
};

function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`;
}

function calcTotals(lines: DocumentLine[]) {
  const ht = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const tva = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice * (l.vatRate / 100), 0);
  return { ht, tva, ttc: ht + tva };
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

function buildWhatsappUrl(phone: string, message: string): string {
  const digits = normalizePhoneDigits(phone);
  const encoded = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export const CrmDocumentsModule: React.FC<Props> = ({ organization, session }) => {
  const activeSpace = session?.space || 'intranet';
  const isReadOnlyAccounting = activeSpace === 'accounting';

  const [activeTab, setActiveTab] = useState<CrmTab>(() =>
    activeSpace === 'accounting' ? 'documents' : 'overview',
  );
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [campaigns, setCampaigns] = useState<CrmCampaign[]>([]);
  const [followUps, setFollowUps] = useState<WhatsappFollowUp[]>([]);
  const [activities, setActivities] = useState<CrmActivityLog[]>([]);
  const [loadingCrm, setLoadingCrm] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  // Contacts state
  const [contactSearch, setContactSearch] = useState('');
  const [contactFilter, setContactFilter] = useState<'ALL' | 'CLIENT' | 'PROSPECT' | 'SUPPLIER' | 'WHATSAPP'>('ALL');
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactType, setContactType] = useState<ContactType>('CLIENT');
  const [contactName, setContactName] = useState('');
  const [contactSector, setContactSector] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNinea, setContactNinea] = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactWhatsappOptIn, setContactWhatsappOptIn] = useState(true);
  const [contactPipelineStage, setContactPipelineStage] = useState<CrmPipelineStage>('NOUVEAU');
  const [contactNextFollowUp, setContactNextFollowUp] = useState('');

  // Documents state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'ALL'>('ALL');
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newKind, setNewKind] = useState<DocumentKind>('QUOTE');
  const [newContactId, setNewContactId] = useState('');
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineQty, setNewLineQty] = useState(1);
  const [newLinePrice, setNewLinePrice] = useState(150000);
  const [newLineVat, setNewLineVat] = useState(18);
  const [newNotes, setNewNotes] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<DocumentPayment['method']>('VIREMENT');
  const [payRef, setPayRef] = useState('');

  // Campaigns state
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campName, setCampName] = useState('');
  const [campChannel, setCampChannel] = useState<CrmCampaign['channel']>('WHATSAPP');
  const [campAudience, setCampAudience] = useState<CrmCampaignAudience>('QUALIFIED_PROSPECTS');
  const [campTemplate, setCampTemplate] = useState(
    `Bonjour {nom}, l’équipe ${organization.name} revient vers vous concernant nos offres du trimestre. Souhaitez-vous fixer un point rapide ?`,
  );
  const [campaignChartMode, setCampaignChartMode] = useState<'campaigns' | 'funnel'>('campaigns');

  // WhatsApp Relances state
  const [waFilter, setWaFilter] = useState<WhatsappRelanceStatus | 'ALL'>('ALL');
  const [waContactId, setWaContactId] = useState('');
  const [waMessageDraft, setWaMessageDraft] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  // Activity log state
  const [activityFilterContactId, setActivityFilterContactId] = useState<string>('ALL');
  const [actContactId, setActContactId] = useState('');
  const [actKind, setActKind] = useState<CrmActivityKind>('APPEL');
  const [actSummary, setActSummary] = useState('');
  const [actNextStep, setActNextStep] = useState('');
  const [actFollowUpDate, setActFollowUpDate] = useState('');

  const refreshCrm = React.useCallback(async () => {
    try {
      const res = await fetch('/api/crm/overview', {
        headers: buildAuthHeaders(activeSpace, false),
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<CrmStorePayload>;
      const loadedDocs = data.documents || [];
      setContacts(data.contacts || []);
      setDocuments(loadedDocs);
      setCampaigns(data.campaigns || []);
      setFollowUps(data.followUps || []);
      setActivities(data.activities || []);
      setSelectedDocId((prev) =>
        prev && loadedDocs.some((d) => d.id === prev) ? prev : loadedDocs[0]?.id ?? null,
      );
    } catch {
      // ignore network error
    }
  }, [activeSpace]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCrm(true);
      await refreshCrm();
      if (!cancelled) setLoadingCrm(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshCrm, session?.userId, organization.id]);

  function notify(msg: string) {
    setBannerMessage(msg);
    window.setTimeout(() => setBannerMessage((curr) => (curr === msg ? null : curr)), 4000);
  }

  // Computed KPI metrics for Vue d'ensemble (matching reference screenshot)
  const kpis = useMemo(() => {
    const whatsappOptInCount = contacts.filter((c) => c.whatsappOptIn).length;
    const clientsProspectsCount = contacts.filter((c) => c.type === 'CLIENT' || c.type === 'PROSPECT').length;
    const suppliersCount = contacts.filter((c) => c.type === 'SUPPLIER').length;
    const qualifiedProspectsCount = contacts.filter(
      (c) =>
        c.type === 'PROSPECT' &&
        (c.pipelineStage === 'QUALIFIE' || c.pipelineStage === 'PROPOSITION' || c.pipelineStage === 'GAGNE'),
    ).length;
    const activeCampaignsCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const pendingWhatsappCount = followUps.filter(
      (f) => f.status === 'A_ENVOYER' || f.status === 'OUVERT_WHATSAPP',
    ).length;

    return {
      totalContacts: contacts.length,
      whatsappOptInCount,
      clientsProspectsCount,
      suppliersCount,
      qualifiedProspectsCount,
      activeCampaignsCount,
      totalCampaignsCount: campaigns.length,
      pendingWhatsappCount,
    };
  }, [campaigns, contacts, followUps]);

  const campaignPipelineData = useMemo(() => {
    return campaigns.map((camp) => {
      const shortName = camp.name.length > 22 ? `${camp.name.slice(0, 20)}…` : camp.name;
      const replyRate =
        camp.sentConfirmedCount > 0
          ? Math.round((camp.repliesCount / camp.sentConfirmedCount) * 100)
          : 0;
      return {
        id: camp.id,
        name: shortName,
        fullName: camp.name,
        channel: camp.channel,
        status: CAMPAIGN_STATUS_LABELS[camp.status],
        cibles: camp.targetCount,
        envois: camp.sentConfirmedCount,
        reponses: camp.repliesCount,
        replyRate,
      };
    });
  }, [campaigns]);

  const campaignFunnelData = useMemo(() => {
    const totalTargets = campaigns.reduce((s, c) => s + c.targetCount, 0);
    const preparedWa = followUps.length;
    const sentConfirmed =
      campaigns.reduce((s, c) => s + c.sentConfirmedCount, 0) ||
      followUps.filter((f) => f.status === 'ENVOI_CONFIRME' || f.status === 'REPONSE_RECUE').length;
    const replies =
      campaigns.reduce((s, c) => s + c.repliesCount, 0) ||
      followUps.filter((f) => f.status === 'REPONSE_RECUE').length;
    return [
      { stage: 'Audience ciblée', volume: totalTargets, fill: '#3b82f6' },
      { stage: 'Messages préparés', volume: preparedWa, fill: '#6366f1' },
      { stage: 'Envois confirmés', volume: sentConfirmed, fill: '#10b981' },
      { stage: 'Réponses reçues', volume: replies, fill: '#0ea5e9' },
    ];
  }, [campaigns, followUps]);

  const sectorConversionData = useMemo(() => {
    const leads = contacts.filter((c) => c.type === 'CLIENT' || c.type === 'PROSPECT');
    const grouped = new Map<
      string,
      { sector: string; total: number; qualified: number; converted: number }
    >();
    for (const c of leads) {
      const sectorName = (c.sector || 'Non renseigné').trim() || 'Non renseigné';
      const entry = grouped.get(sectorName) || {
        sector: sectorName,
        total: 0,
        qualified: 0,
        converted: 0,
      };
      entry.total += 1;
      if (
        c.pipelineStage === 'QUALIFIE' ||
        c.pipelineStage === 'PROPOSITION' ||
        c.pipelineStage === 'GAGNE' ||
        c.type === 'CLIENT'
      ) {
        entry.qualified += 1;
      }
      if (c.pipelineStage === 'GAGNE' || c.type === 'CLIENT') {
        entry.converted += 1;
      }
      grouped.set(sectorName, entry);
    }

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        shortSector: item.sector.length > 18 ? `${item.sector.slice(0, 16)}…` : item.sector,
        conversionRate: item.total > 0 ? Math.round((item.converted / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate || b.total - a.total);
  }, [contacts]);

  const overallLeadConversionRate = useMemo(() => {
    const total = sectorConversionData.reduce((s, d) => s + d.total, 0);
    const converted = sectorConversionData.reduce((s, d) => s + d.converted, 0);
    return total > 0 ? Math.round((converted / total) * 100) : 0;
  }, [sectorConversionData]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      if (contactFilter === 'CLIENT' && c.type !== 'CLIENT') return false;
      if (contactFilter === 'PROSPECT' && c.type !== 'PROSPECT') return false;
      if (contactFilter === 'SUPPLIER' && c.type !== 'SUPPLIER') return false;
      if (contactFilter === 'WHATSAPP' && !c.whatsappOptIn) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.sector || '').toLowerCase().includes(q)
      );
    });
  }, [contactFilter, contactSearch, contacts]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const filteredDocs = useMemo(
    () => (kindFilter === 'ALL' ? documents : documents.filter((d) => d.kind === kindFilter)),
    [documents, kindFilter],
  );

  const filteredFollowUps = useMemo(
    () => (waFilter === 'ALL' ? followUps : followUps.filter((f) => f.status === waFilter)),
    [followUps, waFilter],
  );

  const filteredActivities = useMemo(
    () =>
      activityFilterContactId === 'ALL'
        ? activities
        : activities.filter((a) => a.contactId === activityFilterContactId),
    [activities, activityFilterContactId],
  );

  function handleExportAllCrm() {
    const lines = [
      `EXPORT CRM & CAMPAGNES — ${organization.name} (${new Date().toISOString().slice(0, 10)})`,
      '',
      '=== CONTACTS ===',
      ['Type', 'Nom / Raison sociale', 'Secteur', 'E-mail', 'Téléphone', 'NINEA', 'Consentement WhatsApp', 'Pipeline'].join(';'),
      ...contacts.map((c) =>
        [
          c.type,
          c.name,
          c.sector || '',
          c.email,
          c.phone,
          c.ninea,
          c.whatsappOptIn ? 'OUI' : 'NON',
          c.pipelineStage ? PIPELINE_LABELS[c.pipelineStage] : '',
        ].join(';'),
      ),
      '',
      '=== DOCUMENTS COMMERCIAUX ===',
      ['Numéro', 'Type', 'Date', 'Tiers', 'Statut', 'Total TTC (FCFA)', 'Encaissé (FCFA)'].join(';'),
      ...documents.map((d) => {
        const totals = calcTotals(d.lines);
        const paid = d.payments.reduce((s, p) => s + p.amount, 0);
        return [d.number, KIND_LABELS[d.kind], d.date, d.contactName, STATUS_LABELS[d.status], Math.round(totals.ttc), Math.round(paid)].join(';');
      }),
      '',
      '=== RELANCES WHATSAPP ===',
      ['Contact', 'Téléphone', 'Campagne / Doc', 'Statut', 'Préparé le', 'Confirmé le'].join(';'),
      ...followUps.map((f) =>
        [
          f.contactName,
          f.phone,
          f.campaignName || f.documentNumber || 'Relance directe',
          RELANCE_STATUS_LABELS[f.status],
          f.preparedAt,
          f.confirmedSentAt || '',
        ].join(';'),
      ),
    ];

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-campagnes-${organization.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Export CSV CRM & campagnes téléchargé.');
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim() || isReadOnlyAccounting) return;
    const res = await fetch('/api/crm/contacts', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        type: contactType,
        name: contactName.trim(),
        sector: contactSector.trim() || undefined,
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
        ninea: contactNinea.trim(),
        address: contactAddress.trim(),
        whatsappOptIn: contactType === 'SUPPLIER' ? false : contactWhatsappOptIn,
        pipelineStage: contactType === 'SUPPLIER' ? undefined : contactPipelineStage,
        nextFollowUpDate: contactNextFollowUp || undefined,
      }),
    });
    if (!res.ok) {
      notify('Impossible de créer la fiche contact.');
      return;
    }
    const data = (await res.json()) as { contact: CrmContact };
    setContactName('');
    setContactSector('');
    setContactEmail('');
    setContactPhone('');
    setContactNinea('');
    setContactAddress('');
    setContactNextFollowUp('');
    setShowAddContact(false);
    await refreshCrm();
    notify(`Fiche "${data.contact.name}" enregistrée sur votre compte.`);
  }

  async function handleDeleteContact(contactId: string) {
    if (isReadOnlyAccounting) return;
    const res = await fetch(`/api/crm/contacts/${contactId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(activeSpace, false),
      credentials: 'include',
    });
    if (res.ok) {
      await refreshCrm();
      notify('Fiche contact supprimée.');
    }
  }

  async function toggleWhatsappOptIn(contactId: string) {
    if (isReadOnlyAccounting) return;
    const target = contacts.find((c) => c.id === contactId);
    if (!target) return;
    const res = await fetch(`/api/crm/contacts/${contactId}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ whatsappOptIn: !target.whatsappOptIn }),
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  async function updateContactPipeline(contactId: string, stage: CrmPipelineStage) {
    if (isReadOnlyAccounting) return;
    const res = await fetch(`/api/crm/contacts/${contactId}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ pipelineStage: stage }),
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  async function queueWhatsappForContact(
    contact: CrmContact,
    customMessage?: string,
    docNumber?: string,
    campaign?: CrmCampaign,
  ) {
    if (isReadOnlyAccounting) return;
    const defaultMsg =
      customMessage ||
      `Bonjour ${contact.name}, c’est l’équipe ${organization.name}. Nous souhaitons faire un point de suivi avec vous cette semaine. Êtes-vous disponible ?`;
    const res = await fetch('/api/crm/followups/batch', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        items: [
          {
            contactId: contact.id,
            contactName: contact.name,
            phone: contact.phone,
            campaignId: campaign?.id,
            campaignName: campaign?.name,
            documentNumber: docNumber,
            message: defaultMsg,
          },
        ],
      }),
    });
    if (res.ok) {
      await refreshCrm();
      setActiveTab('whatsapp');
      notify(`Relance WhatsApp préparée pour ${contact.name}.`);
    }
  }

  async function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAccounting) return;
    const contact = contacts.find((c) => c.id === newContactId) || contacts[0];
    if (!contact || !newLineLabel.trim()) return;
    const res = await fetch('/api/crm/documents', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        kind: newKind,
        contactId: contact.id,
        lineLabel: newLineLabel.trim(),
        quantity: Math.max(1, Number(newLineQty)),
        unitPrice: Math.max(0, Number(newLinePrice)),
        vatRate: Math.max(0, Number(newLineVat)),
        notes: newNotes.trim(),
      }),
    });
    if (!res.ok) {
      notify('Erreur lors de la création de la pièce.');
      return;
    }
    const data = (await res.json()) as { document: CommercialDocument };
    setSelectedDocId(data.document.id);
    setShowNewDoc(false);
    setNewLineLabel('');
    setNewNotes('');
    await refreshCrm();
    notify(`${KIND_LABELS[data.document.kind]} ${data.document.number} créé.`);
  }

  async function updateDocStatus(docId: string, status: DocumentStatus) {
    const res = await fetch(`/api/crm/documents/${docId}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await refreshCrm();
      if (status === 'VALIDATED' || status === 'PAID') {
        notify('Document validé et synchronisé avec la comptabilité SYSCOHADA.');
      }
    }
  }

  async function recordPartialDelivery(docId: string, lineId: string, delta: number) {
    if (isReadOnlyAccounting) return;
    const res = await fetch(`/api/crm/documents/${docId}/deliver`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ lineId, delta }),
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoc) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;

    const res = await fetch(`/api/crm/documents/${selectedDoc.id}/payments`, {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        amount,
        method: payMethod,
        reference: payRef.trim() || undefined,
      }),
    });
    if (!res.ok) {
      notify('Impossible d’enregistrer le règlement.');
      return;
    }
    setPayAmount('');
    setPayRef('');
    await refreshCrm();
    notify(`Encaissement de ${formatFcfa(amount)} enregistré et comptabilisé en SYSCOHADA.`);
  }

  function exportCsv(doc: CommercialDocument) {
    const totals = calcTotals(doc.lines);
    const rows = [
      ['Numéro', 'Type', 'Date', 'Tiers', 'Statut', 'Total HT', 'TVA', 'Total TTC'].join(';'),
      [
        doc.number,
        KIND_LABELS[doc.kind],
        doc.date,
        doc.contactName,
        STATUS_LABELS[doc.status],
        totals.ht,
        totals.tva,
        totals.ttc,
      ].join(';'),
      '',
      ['Désignation', 'Quantité', 'Livré', 'PU HT', 'TVA %'].join(';'),
      ...doc.lines.map((l) => [l.label, l.quantity, l.deliveredQuantity, l.unitPrice, l.vatRate].join(';')),
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resolveAudienceContacts(audience: CrmCampaignAudience): CrmContact[] {
    if (audience === 'ALL_CLIENTS_PROSPECTS') {
      return contacts.filter((c) => c.type === 'CLIENT' || c.type === 'PROSPECT');
    }
    if (audience === 'QUALIFIED_PROSPECTS') {
      return contacts.filter(
        (c) =>
          c.type === 'PROSPECT' &&
          (c.pipelineStage === 'QUALIFIE' || c.pipelineStage === 'PROPOSITION' || c.pipelineStage === 'GAGNE'),
      );
    }
    if (audience === 'WHATSAPP_OPTIN') {
      return contacts.filter((c) => Boolean(c.whatsappOptIn));
    }
    const unpaidContactIds = new Set(
      documents
        .filter((d) => d.kind === 'CUSTOMER_INVOICE' && d.status !== 'PAID')
        .map((d) => d.contactId),
    );
    return contacts.filter((c) => unpaidContactIds.has(c.id));
  }

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAccounting || !campName.trim() || !campTemplate.trim()) return;
    const targets = resolveAudienceContacts(campAudience);
    const res = await fetch('/api/crm/campaigns', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        name: campName.trim(),
        channel: campChannel,
        audience: campAudience,
        messageTemplate: campTemplate.trim(),
        targetCount: targets.length,
      }),
    });
    if (!res.ok) return;
    setCampName('');
    setShowNewCampaign(false);
    await refreshCrm();
    notify(`Campagne "${campName.trim()}" créée (${targets.length} contact(s) ciblés).`);
  }

  async function toggleCampaignStatus(camp: CrmCampaign) {
    if (isReadOnlyAccounting) return;
    const nextStatus: CrmCampaignStatus = camp.status === 'ACTIVE' ? 'TERMINEE' : 'ACTIVE';
    const res = await fetch(`/api/crm/campaigns/${camp.id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  async function handleDeleteCampaign(campId: string) {
    if (isReadOnlyAccounting) return;
    const res = await fetch(`/api/crm/campaigns/${campId}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(activeSpace, false),
      credentials: 'include',
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  async function generateWhatsappQueueFromCampaign(campaign: CrmCampaign) {
    if (isReadOnlyAccounting) return;
    const targets = resolveAudienceContacts(campaign.audience).filter((c) => c.phone.trim());
    if (targets.length === 0) {
      notify('Aucun contact éligible avec numéro de téléphone pour ce segment.');
      return;
    }
    const items = targets.map((c) => ({
      contactId: c.id,
      contactName: c.name,
      phone: c.phone,
      campaignId: campaign.id,
      campaignName: campaign.name,
      message: campaign.messageTemplate
        .replace(/\{nom\}/g, c.name)
        .replace(/\{organisation\}/g, organization.name),
    }));
    const res = await fetch('/api/crm/followups/batch', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      await refreshCrm();
      setActiveTab('whatsapp');
      notify(`${items.length} message(s) WhatsApp préparé(s) pour confirmation manuelle.`);
    }
  }

  async function handlePrepareSingleWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAccounting) return;
    const target = contacts.find((c) => c.id === waContactId) || contacts.find((c) => c.type !== 'SUPPLIER');
    if (!target || !waMessageDraft.trim()) return;
    await queueWhatsappForContact(target, waMessageDraft.trim());
    setWaMessageDraft('');
  }

  async function updateRelanceStatus(id: string, status: WhatsappRelanceStatus, replyNote?: string) {
    if (isReadOnlyAccounting) return;
    const existing = followUps.find((f) => f.id === id);
    const res = await fetch(`/api/crm/followups/${id}`, {
      method: 'PATCH',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({ status, replyNote }),
    });
    if (!res.ok) return;
    await refreshCrm();

    if (existing && status === 'ENVOI_CONFIRME' && existing.status !== 'ENVOI_CONFIRME') {
      notify(`Envoi manuel confirmé pour ${existing.contactName}.`);
    } else if (existing && status === 'REPONSE_RECUE' && existing.status !== 'REPONSE_RECUE') {
      notify(`Réponse client enregistrée pour ${existing.contactName}.`);
    }
  }

  async function handleDeleteFollowUp(id: string) {
    if (isReadOnlyAccounting) return;
    const res = await fetch(`/api/crm/followups/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(activeSpace, false),
      credentials: 'include',
    });
    if (res.ok) {
      await refreshCrm();
    }
  }

  function handleCopyMessage(id: string, msg: string) {
    navigator.clipboard?.writeText(msg).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 2000);
  }

  async function handleAddManualActivity(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnlyAccounting) return;
    const target = contacts.find((c) => c.id === actContactId) || contacts[0];
    if (!target || !actSummary.trim()) return;
    const res = await fetch('/api/crm/activities', {
      method: 'POST',
      headers: buildAuthHeaders(activeSpace, true),
      credentials: 'include',
      body: JSON.stringify({
        contactId: target.id,
        kind: actKind,
        summary: actSummary.trim(),
        nextStep: actNextStep.trim() || undefined,
        followUpDate: actFollowUpDate || undefined,
      }),
    });
    if (res.ok) {
      setActSummary('');
      setActNextStep('');
      setActFollowUpDate('');
      await refreshCrm();
      notify(`Interaction enregistrée pour ${target.name}.`);
    }
  }

  const TABS: { id: CrmTab; label: string; badge?: number }[] = isReadOnlyAccounting
    ? [
        { id: 'overview', label: "Vue d'ensemble" },
        { id: 'contacts', label: 'Tiers facturés', badge: contacts.length },
        { id: 'documents', label: 'Factures synchronisées', badge: documents.length },
        { id: 'activity', label: 'Activité' },
      ]
    : [
        { id: 'overview', label: "Vue d'ensemble" },
        { id: 'contacts', label: 'Contacts', badge: contacts.length },
        { id: 'documents', label: 'Commandes & documents', badge: documents.length },
        { id: 'campaigns', label: 'Campagnes', badge: campaigns.length },
        { id: 'whatsapp', label: 'Relances WhatsApp', badge: kpis.pendingWhatsappCount || undefined },
        { id: 'activity', label: 'Activité' },
      ];

  return (
    <div className="space-y-6">
      {/* Header matching CRM & campagnes template */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM &amp; campagnes</h2>

        <button
          type="button"
          onClick={handleExportAllCrm}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter
        </button>
      </div>

      {loadingCrm && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
          Chargement de vos données personnelles CRM &amp; documents...
        </div>
      )}

      {bannerMessage && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2.5 text-sm text-blue-800 dark:text-blue-200 flex items-center justify-between no-print">
          <span>{bannerMessage}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="text-xs font-semibold hover:underline ml-4"
          >
            Fermer
          </button>
        </div>
      )}

      {/* 6 Horizontal Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-print">
        <nav className="flex items-center gap-6 min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 pt-1 text-sm transition-colors inline-flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium border-b-2 border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[11px] font-mono rounded-md ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* TAB 1: VUE D'ENSEMBLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 5 KPI Cards matching the reference design */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => {
                setContactFilter('ALL');
                setActiveTab('contacts');
              }}
              className="text-left p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Contacts</div>
              <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-1">
                {kpis.totalContacts}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                {kpis.whatsappOptInCount} consentements WhatsApp
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setContactFilter('CLIENT');
                setActiveTab('contacts');
              }}
              className="text-left p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Clients / prospects</div>
              <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-1">
                {kpis.clientsProspectsCount}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setContactFilter('SUPPLIER');
                setActiveTab('contacts');
              }}
              className="text-left p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Fournisseurs</div>
              <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-1">
                {kpis.suppliersCount}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setContactFilter('PROSPECT');
                setActiveTab('contacts');
              }}
              className="text-left p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Prospects qualifiés</div>
              <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-1">
                {kpis.qualifiedProspectsCount}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('campaigns')}
              className="text-left p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-3" />
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Campagnes actives</div>
              <div className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-1">
                {kpis.activeCampaignsCount}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                {kpis.totalCampaignsCount} campagne(s) au total
              </div>
            </button>
          </div>

          {/* Recharts Analytics: Pipeline de campagnes & Taux de conversion par secteur */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Chart 1: Pipeline de campagnes */}
            <div className="lg:col-span-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Pipeline de campagnes
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums mt-0.5">
                    {campaigns.length} campagne(s) · {followUps.length} relance(s)
                  </div>
                </div>
                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setCampaignChartMode('campaigns')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      campaignChartMode === 'campaigns'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Par campagne
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignChartMode('funnel')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      campaignChartMode === 'funnel'
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    Entonnoir global
                  </button>
                </div>
              </div>

              {campaigns.length === 0 && followUps.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                  <span>Aucune campagne disponible sur ce périmètre.</span>
                  {!isReadOnlyAccounting && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewCampaign(true);
                        setActiveTab('campaigns');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                    >
                      Créer une campagne
                    </button>
                  )}
                </div>
              ) : campaignChartMode === 'campaigns' && campaignPipelineData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={campaignPipelineData}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                        contentStyle={{
                          borderRadius: '0.75rem',
                          border: '1px solid #e5e7eb',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="cibles" name="Cibles" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="envois" name="Envois confirmés" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="reponses" name="Réponses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={campaignFunnelData}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis
                        dataKey="stage"
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                        contentStyle={{
                          borderRadius: '0.75rem',
                          border: '1px solid #e5e7eb',
                          fontSize: '12px',
                        }}
                        formatter={(value) => [`${value ?? 0}`, 'Volume']}
                      />
                      <Bar dataKey="volume" name="Volume" radius={[6, 6, 0, 0]} maxBarSize={44}>
                        {campaignFunnelData.map((entry) => (
                          <Cell key={entry.stage} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Chart 2: Taux de conversion des leads par secteur */}
            <div className="lg:col-span-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Conversion des leads par secteur
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono tabular-nums mt-0.5">
                    {sectorConversionData.length} secteur(s) · Taux global {overallLeadConversionRate}%
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setContactFilter('ALL');
                    setActiveTab('contacts');
                  }}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Voir les fiches
                </button>
              </div>

              {sectorConversionData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
                  Aucun lead sectorisé disponible.
                </div>
              ) : (
                <>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={sectorConversionData}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                        <XAxis
                          dataKey="shortSector"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 100]}
                          tickFormatter={(v: number) => `${v}%`}
                          tick={{ fontSize: 11, fill: '#059669' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '0.75rem',
                            border: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                          formatter={(value, name) => {
                            if (name === 'Taux conversion (%)') return [`${value ?? 0}%`, name];
                            return [`${value ?? 0}`, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar
                          yAxisId="left"
                          dataKey="total"
                          name="Leads"
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="converted"
                          name="Convertis"
                          fill="#10b981"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="conversionRate"
                          name="Taux conversion (%)"
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#2563eb' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 dark:text-gray-400">
                          <th className="text-left font-medium pb-1.5">Secteur</th>
                          <th className="text-right font-medium pb-1.5">Leads</th>
                          <th className="text-right font-medium pb-1.5">Qualifiés</th>
                          <th className="text-right font-medium pb-1.5">Gagnés</th>
                          <th className="text-right font-medium pb-1.5">Conversion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {sectorConversionData.map((row) => (
                          <tr key={row.sector}>
                            <td className="py-1.5 font-medium text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                              {row.sector}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                              {row.total}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-gray-600 dark:text-gray-400">
                              {row.qualified}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                              {row.converted}
                            </td>
                            <td className="py-1.5 text-right font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400">
                              {row.conversionRate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Operational summary row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Relances WhatsApp à traiter
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('whatsapp')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ouvrir la file ({followUps.length})
                </button>
              </div>
              {followUps.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune relance préparée pour le moment.</p>
              ) : (
                <div className="space-y-2.5">
                  {followUps.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {item.contactName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{item.message}</div>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md border ${RELANCE_STATUS_BADGE[item.status]}`}
                      >
                        {RELANCE_STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Dernières actions de suivi client
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Voir le journal
                </button>
              </div>
              <div className="space-y-2.5">
                {activities.slice(0, 3).map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {act.contactName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{act.summary}</div>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 shrink-0">
                      {act.createdAt.slice(0, 10)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTACTS */}
      {activeTab === 'contacts' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder="Rechercher un client, prospect, tél..."
                  className="pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-64"
                />
              </div>
              {(
                [
                  { id: 'ALL', label: 'Tous' },
                  { id: 'CLIENT', label: 'Clients' },
                  { id: 'PROSPECT', label: 'Prospects' },
                  { id: 'SUPPLIER', label: 'Fournisseurs' },
                  { id: 'WHATSAPP', label: 'Opt-in WhatsApp' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setContactFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    contactFilter === f.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!isReadOnlyAccounting && (
              <button
                type="button"
                onClick={() => setShowAddContact((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Nouveau contact
              </button>
            )}
          </div>

          {showAddContact && (
            <form
              onSubmit={handleAddContact}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Créer une fiche client, prospect ou fournisseur
              </h3>

              <div className="grid grid-cols-3 gap-2 max-w-md">
                {(['CLIENT', 'PROSPECT', 'SUPPLIER'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setContactType(t)}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                      contactType === t
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {t === 'CLIENT' ? 'Client' : t === 'PROSPECT' ? 'Prospect' : 'Fournisseur'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Raison sociale ou nom complet *"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <input
                  type="text"
                  value={contactSector}
                  onChange={(e) => setContactSector(e.target.value)}
                  placeholder="Secteur d'activité"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="E-mail professionnel"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Téléphone WhatsApp (+221...)"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <input
                  type="text"
                  value={contactNinea}
                  onChange={(e) => setContactNinea(e.target.value)}
                  placeholder="NINEA"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg font-mono"
                />
                <input
                  type="text"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                  placeholder="Adresse / Ville"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>

              {contactType !== 'SUPPLIER' && (
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Pipeline :</span>
                    <select
                      value={contactPipelineStage}
                      onChange={(e) => setContactPipelineStage(e.target.value as CrmPipelineStage)}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                    >
                      {(Object.keys(PIPELINE_LABELS) as CrmPipelineStage[]).map((stage) => (
                        <option key={stage} value={stage}>
                          {PIPELINE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Prochaine relance :</span>
                    <input
                      type="date"
                      value={contactNextFollowUp}
                      onChange={(e) => setContactNextFollowUp(e.target.value)}
                      className="px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contactWhatsappOptIn}
                      onChange={(e) => setContactWhatsappOptIn(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Consentement WhatsApp confirmé (opt-in)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                >
                  Enregistrer le contact
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContacts.map((c) => (
              <div
                key={c.id}
                className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          c.type === 'CLIENT'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : c.type === 'PROSPECT'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        }`}
                      >
                        {c.type === 'CLIENT' ? 'Client' : c.type === 'PROSPECT' ? 'Prospect' : 'Fournisseur'}
                      </span>
                      {c.pipelineStage && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${PIPELINE_COLORS[c.pipelineStage]}`}>
                          {PIPELINE_LABELS[c.pipelineStage]}
                        </span>
                      )}
                    </div>

                    {!isReadOnlyAccounting && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteContact(c.id)}
                        className="text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
                        title="Supprimer ce contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {c.sector ? `${c.sector} · ` : ''}
                    {c.address || 'Adresse non renseignée'}
                  </p>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate">{c.email || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="font-mono">{c.phone || '—'}</span>
                    </div>
                    <div className="font-mono text-gray-500 dark:text-gray-400">NINEA : {c.ninea || '—'}</div>
                    {c.nextFollowUpDate && (
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                        Relance prévue : {c.nextFollowUpDate}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {c.type !== 'SUPPLIER' && (
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={c.pipelineStage || 'NOUVEAU'}
                        onChange={(e) => updateContactPipeline(c.id, e.target.value as CrmPipelineStage)}
                        className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-md"
                      >
                        {(Object.keys(PIPELINE_LABELS) as CrmPipelineStage[]).map((stage) => (
                          <option key={stage} value={stage}>
                            Pipeline : {PIPELINE_LABELS[stage]}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => toggleWhatsappOptIn(c.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                          c.whatsappOptIn
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                            : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {c.whatsappOptIn ? 'WhatsApp OK' : 'Sans opt-in'}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {c.type !== 'SUPPLIER' && (
                      <button
                        type="button"
                        onClick={() => queueWhatsappForContact(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Relancer WhatsApp
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setNewContactId(c.id);
                        setShowNewDoc(true);
                        setActiveTab('documents');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActContactId(c.id);
                        setActiveTab('activity');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Suivi
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: COMMANDES & DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Second menu: types de documents commerciaux */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 no-print">
            <nav
              aria-label="Menu des types de documents"
              className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
            >
              {(
                [
                  { id: 'ALL' as const, label: 'Tous les documents' },
                  ...(Object.keys(KIND_LABELS) as DocumentKind[]).map((k) => ({
                    id: k,
                    label: KIND_LABELS[k],
                  })),
                ]
              ).map((item) => {
                const count =
                  item.id === 'ALL'
                    ? documents.length
                    : documents.filter((d) => d.kind === item.id).length;
                const active = kindFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setKindFilter(item.id);
                      if (item.id !== 'ALL') setNewKind(item.id);
                      const nextList =
                        item.id === 'ALL' ? documents : documents.filter((d) => d.kind === item.id);
                      if (nextList.length > 0 && !nextList.some((d) => d.id === selectedDocId)) {
                        setSelectedDocId(nextList[0].id);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        active ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {!isReadOnlyAccounting && (
              <button
                type="button"
                onClick={() => {
                  if (!newContactId) setNewContactId(contacts[0]?.id || '');
                  setShowNewDoc((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                Nouveau document
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4 no-print">

            {showNewDoc && (
              <form
                onSubmit={handleCreateDoc}
                className="bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Créer une pièce commerciale</div>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as DocumentKind)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {(Object.keys(KIND_LABELS) as DocumentKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <select
                  value={newContactId}
                  onChange={(e) => setNewContactId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type === 'CLIENT' ? 'Client' : c.type === 'PROSPECT' ? 'Prospect' : 'Fournisseur'})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newLineLabel}
                  onChange={(e) => setNewLineLabel(e.target.value)}
                  placeholder="Désignation prestation ou produit"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(Number(e.target.value))}
                    placeholder="Qté"
                    className="px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    value={newLinePrice}
                    onChange={(e) => setNewLinePrice(Number(e.target.value))}
                    placeholder="PU HT"
                    className="px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={newLineVat}
                    onChange={(e) => setNewLineVat(Number(e.target.value))}
                    placeholder="TVA %"
                    className="px-2.5 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Conditions / remarques"
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDoc(false)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                  >
                    Créer
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {filteredDocs.length === 0 ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 text-center text-xs text-gray-500 dark:text-gray-400">
                  Aucun document dans cette catégorie.
                </div>
              ) : (
                filteredDocs.map((doc) => {
                  const totals = calcTotals(doc.lines);
                  const paid = doc.payments.reduce((s, p) => s + p.amount, 0);
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        selectedDocId === doc.id
                          ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                          {doc.number}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
                          {STATUS_LABELS[doc.status]}
                        </span>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mt-1">{doc.contactName}</div>
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>{KIND_LABELS[doc.kind]}</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                          {formatFcfa(totals.ttc)}
                        </span>
                      </div>
                      {paid > 0 && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                          Réglé : {formatFcfa(paid)} / {formatFcfa(totals.ttc)}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            {selectedDoc ? (
              <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {KIND_LABELS[selectedDoc.kind]}
                    </div>
                    <h3 className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100 mt-0.5">
                      {selectedDoc.number}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Tiers :{' '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedDoc.contactName}</span>{' '}
                      · Date : {selectedDoc.date}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    {selectedDoc.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => updateDocStatus(selectedDoc.id, 'VALIDATED')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valider
                      </button>
                    )}
                    {!isReadOnlyAccounting && selectedDoc.status !== 'PAID' && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetContact = contacts.find((c) => c.id === selectedDoc.contactId);
                          if (!targetContact) return;
                          const totals = calcTotals(selectedDoc.lines);
                          const paid = selectedDoc.payments.reduce((s, p) => s + p.amount, 0);
                          const remaining = Math.max(0, totals.ttc - paid);
                          const msg =
                            selectedDoc.kind === 'QUOTE'
                              ? `Bonjour ${targetContact.name}, nous revenons vers vous concernant le devis ${selectedDoc.number} d'un montant de ${formatFcfa(totals.ttc)}. Avez-vous besoin de précisions ? — ${organization.name}`
                              : `Bonjour ${targetContact.name}, petit rappel concernant la pièce ${selectedDoc.number} (solde restant : ${formatFcfa(remaining)}). Merci pour votre retour. — ${organization.name}`;
                          void queueWhatsappForContact(targetContact, msg, selectedDoc.number);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Relancer WhatsApp
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportCsv(selectedDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimer / PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                        <th className="py-2 pr-3">Désignation</th>
                        <th className="py-2 px-2 text-right">Qté</th>
                        <th className="py-2 px-2 text-right">Livré</th>
                        <th className="py-2 px-2 text-right">PU HT</th>
                        <th className="py-2 pl-2 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {selectedDoc.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-3 pr-3 font-medium text-gray-900 dark:text-gray-100">{line.label}</td>
                          <td className="py-3 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                            {line.quantity}
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                            <div className="inline-flex items-center gap-1.5">
                              <span>
                                {line.deliveredQuantity}/{line.quantity}
                              </span>
                              {line.deliveredQuantity < line.quantity && (
                                <button
                                  type="button"
                                  onClick={() => recordPartialDelivery(selectedDoc.id, line.id, 1)}
                                  className="no-print p-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                                  title="Enregistrer livraison partielle (+1)"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-mono text-gray-700 dark:text-gray-300">
                            {formatFcfa(line.unitPrice)}
                          </td>
                          <td className="py-3 pl-2 text-right font-mono font-semibold text-gray-900 dark:text-gray-100">
                            {formatFcfa(line.quantity * line.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(() => {
                  const totals = calcTotals(selectedDoc.lines);
                  const totalPaid = selectedDoc.payments.reduce((s, p) => s + p.amount, 0);
                  const remaining = Math.max(0, totals.ttc - totalPaid);
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5" />
                          Suivi des règlements ({selectedDoc.payments.length})
                        </h4>
                        {selectedDoc.payments.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Aucun règlement enregistré.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedDoc.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/60 px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200"
                              >
                                <span>
                                  {p.date} · {p.method} ({p.reference})
                                </span>
                                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                                  {formatFcfa(p.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {remaining > 0 && (
                          <form onSubmit={handleAddPayment} className="no-print flex flex-wrap gap-2 pt-2">
                            <input
                              type="number"
                              min={1}
                              max={remaining}
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              placeholder={`Montant (reste ${remaining})`}
                              className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                            />
                            <select
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value as DocumentPayment['method'])}
                              className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                            >
                              <option value="VIREMENT">Virement</option>
                              <option value="MOBILE_MONEY">Wave / OM</option>
                              <option value="CHEQUE">Chèque</option>
                              <option value="ESPECES">Espèces</option>
                            </select>
                            <input
                              type="text"
                              value={payRef}
                              onChange={(e) => setPayRef(e.target.value)}
                              placeholder="Réf."
                              className="w-24 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-gray-900 dark:bg-blue-600 text-white text-xs font-semibold rounded-lg"
                            >
                              Encaisser
                            </button>
                          </form>
                        )}
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>Total HT</span>
                          <span className="font-mono">{formatFcfa(totals.ht)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600 dark:text-gray-400">
                          <span>TVA</span>
                          <span className="font-mono">{formatFcfa(totals.tva)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-200 dark:border-gray-700">
                          <span>Total TTC</span>
                          <span className="font-mono">{formatFcfa(totals.ttc)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-400 pt-1">
                          <span>Reste à régler</span>
                          <span className="font-mono font-semibold">{formatFcfa(remaining)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-10 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucun document sélectionné.
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* TAB 4: CAMPAGNES */}
      {activeTab === 'campaigns' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Campagnes de suivi &amp; prospection
            </h3>
            <button
              type="button"
              onClick={() => setShowNewCampaign((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Nouvelle campagne
            </button>
          </div>

          {campaignPipelineData.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Pipeline des campagnes (Cibles → Envois → Réponses)
                </h4>
                <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
                  {campaigns.length} campagne(s)
                </span>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={campaignPipelineData}
                    margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#6b7280' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(59, 130, 246, 0.06)' }}
                      contentStyle={{
                        borderRadius: '0.75rem',
                        border: '1px solid #e5e7eb',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="cibles" name="Cibles" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="envois" name="Envois confirmés" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="reponses" name="Réponses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {showNewCampaign && (
            <form
              onSubmit={handleCreateCampaign}
              className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="Nom de la campagne (ex : Vœux & Offres 2027)"
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <select
                  value={campChannel}
                  onChange={(e) => setCampChannel(e.target.value as CrmCampaign['channel'])}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  <option value="WHATSAPP">Canal WhatsApp (manuel)</option>
                  <option value="EMAIL">Canal E-mail</option>
                  <option value="MIXTE">Mixte (WhatsApp + E-mail)</option>
                </select>
                <select
                  value={campAudience}
                  onChange={(e) => setCampAudience(e.target.value as CrmCampaignAudience)}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                >
                  {(Object.keys(AUDIENCE_LABELS) as CrmCampaignAudience[]).map((aud) => (
                    <option key={aud} value={aud}>
                      {AUDIENCE_LABELS[aud]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Modèle de message (variables disponibles : {'{nom}'}, {'{organisation}'})
                </label>
                <textarea
                  rows={3}
                  required
                  value={campTemplate}
                  onChange={(e) => setCampTemplate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Cibles estimées pour ce segment : {resolveAudienceContacts(campAudience).length} fiche(s)
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewCampaign(false)}
                  className="px-3.5 py-2 text-xs font-medium text-gray-600 dark:text-gray-400"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                >
                  Créer la campagne
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {camp.channel} · {AUDIENCE_LABELS[camp.audience]}
                      </span>
                    </div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mt-1">{camp.name}</h4>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      camp.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : camp.status === 'BROUILLON'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {CAMPAIGN_STATUS_LABELS[camp.status]}
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                  {camp.messageTemplate}
                </p>

                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50/70 dark:bg-gray-800/40 rounded-lg p-2.5">
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Cibles</div>
                    <div className="text-sm font-bold font-mono text-gray-900 dark:text-gray-100">
                      {camp.targetCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Envois confirmés</div>
                    <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {camp.sentConfirmedCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">Réponses</div>
                    <div className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                      {camp.repliesCount}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void generateWhatsappQueueFromCampaign(camp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Préparer relances WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleCampaignStatus(camp)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {camp.status === 'ACTIVE' ? 'Clôturer' : 'Réactiver'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCampaign(camp.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
                    title="Supprimer campagne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: RELANCES WHATSAPP */}
      {activeTab === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handlePrepareSingleWhatsapp}
            className="lg:col-span-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Préparer une relance individuelle
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Destinataire
              </label>
              <select
                value={waContactId}
                onChange={(e) => setWaContactId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                {contacts
                  .filter((c) => c.type !== 'SUPPLIER')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || 'Sans tél.'})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Message WhatsApp
              </label>
              <textarea
                rows={4}
                required
                value={waMessageDraft}
                onChange={(e) => setWaMessageDraft(e.target.value)}
                placeholder={`Bonjour, l’équipe ${organization.name} fait suite à votre demande...`}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
            >
              Ajouter à la file WhatsApp
            </button>
          </form>

          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="w-4 h-4 text-gray-400 mr-1" />
                {(
                  [
                    { id: 'ALL', label: 'Toutes' },
                    { id: 'A_ENVOYER', label: 'À ouvrir' },
                    { id: 'OUVERT_WHATSAPP', label: 'Ouverts' },
                    { id: 'ENVOI_CONFIRME', label: 'Envoi confirmé' },
                    { id: 'REPONSE_RECUE', label: 'Réponses reçues' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWaFilter(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      waFilter === f.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {filteredFollowUps.length} relance(s)
              </span>
            </div>

            {filteredFollowUps.length === 0 ? (
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aucune relance WhatsApp dans ce filtre.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFollowUps.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{item.contactName}</h4>
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{item.phone}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.campaignName
                            ? `Campagne : ${item.campaignName}`
                            : item.documentNumber
                            ? `Document : ${item.documentNumber}`
                            : 'Relance directe'}{' '}
                          · Préparé le {item.preparedAt}
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border ${RELANCE_STATUS_BADGE[item.status]}`}
                      >
                        {RELANCE_STATUS_LABELS[item.status]}
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={item.message}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFollowUps((prev) => prev.map((f) => (f.id === item.id ? { ...f, message: val } : f)));
                      }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                    />

                    {item.replyNote && (
                      <div className="text-xs bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 px-3 py-2 rounded-lg">
                        <span className="font-semibold">Réponse notée ({item.repliedAt}) :</span> {item.replyNote}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={buildWhatsappUrl(item.phone, item.message)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            if (item.status === 'A_ENVOYER') {
                              updateRelanceStatus(item.id, 'OUVERT_WHATSAPP');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ouvrir dans WhatsApp
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopyMessage(item.id, item.message)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copié
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copier
                            </>
                          )}
                        </button>

                        {item.status !== 'ENVOI_CONFIRME' && item.status !== 'REPONSE_RECUE' && (
                          <button
                            type="button"
                            onClick={() => updateRelanceStatus(item.id, 'ENVOI_CONFIRME')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmer l&apos;envoi manuel
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status !== 'REPONSE_RECUE' && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={replyDrafts[item.id] || ''}
                              onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Note réponse client..."
                              className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg w-40"
                            />
                            <button
                              type="button"
                              onClick={() => updateRelanceStatus(item.id, 'REPONSE_RECUE', replyDrafts[item.id])}
                              className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                            >
                              Réponse reçue
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteFollowUp(item.id)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400"
                          title="Retirer de la file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ACTIVITÉ */}
      {activeTab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {!isReadOnlyAccounting && (
          <form
            onSubmit={handleAddManualActivity}
            className="lg:col-span-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Enregistrer une interaction client
            </h3>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contact</label>
              <select
                value={actContactId}
                onChange={(e) => setActContactId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type d&apos;action</label>
              <select
                value={actKind}
                onChange={(e) => setActKind(e.target.value as CrmActivityKind)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                {(Object.keys(ACTIVITY_LABELS) as CrmActivityKind[]).map((k) => (
                  <option key={k} value={k}>
                    {ACTIVITY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Compte-rendu *</label>
              <textarea
                rows={3}
                required
                value={actSummary}
                onChange={(e) => setActSummary(e.target.value)}
                placeholder="Résumé de l'échange, besoins identifiés, engagement..."
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <input
                type="text"
                value={actNextStep}
                onChange={(e) => setActNextStep(e.target.value)}
                placeholder="Prochaine étape (optionnel)"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Date de prochaine relance
                </label>
                <input
                  type="date"
                  value={actFollowUpDate}
                  onChange={(e) => setActFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
            >
              Ajouter au journal CRM
            </button>
          </form>
          )}

          <div className={`${isReadOnlyAccounting ? 'lg:col-span-12' : 'lg:col-span-8'} space-y-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Historique des suivis ({filteredActivities.length})
              </h3>
              <select
                value={activityFilterContactId}
                onChange={(e) => setActivityFilterContactId(e.target.value)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg"
              >
                <option value="ALL">Tous les contacts</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {ACTIVITY_LABELS[act.kind]}
                      </span>
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{act.contactName}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">par {act.author}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{act.summary}</p>
                    {act.nextStep && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Prochaine action : {act.nextStep}</span>
                        {act.followUpDate && <span className="font-mono">({act.followUpDate})</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{act.createdAt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
