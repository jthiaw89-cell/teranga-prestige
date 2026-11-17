import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Plus,
  Printer,
  Trash2,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  CommercialDocument,
  ContactType,
  CrmContact,
  DocumentKind,
  DocumentLine,
  DocumentPayment,
  DocumentStatus,
  OrganizationOption,
} from '../types';

interface Props {
  organization: OrganizationOption;
}

const KIND_LABELS: Record<DocumentKind, string> = {
  QUOTE: 'Devis client',
  CUSTOMER_ORDER: 'Commande client',
  DELIVERY_NOTE: 'Bon de livraison',
  CUSTOMER_INVOICE: 'Facture client',
  PURCHASE_ORDER: 'Bon de commande fournisseur',
  SUPPLIER_INVOICE: 'Facture fournisseur',
};

const KIND_PREFIX: Record<DocumentKind, string> = {
  QUOTE: 'DEV',
  CUSTOMER_ORDER: 'CMD',
  DELIVERY_NOTE: 'BL',
  CUSTOMER_INVOICE: 'FAC',
  PURCHASE_ORDER: 'BCF',
  SUPPLIER_INVOICE: 'FF',
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  DRAFT: 'Brouillon',
  VALIDATED: 'Validé',
  PARTIAL: 'Partiel',
  DELIVERED: 'Livré',
  PAID: 'Soldé',
};

function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} FCFA`;
}

function calcTotals(lines: DocumentLine[]) {
  const ht = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const tva = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice * (l.vatRate / 100), 0);
  return { ht, tva, ttc: ht + tva };
}

function getInitialData(orgId: string): { contacts: CrmContact[]; documents: CommercialDocument[] } {
  const contacts: CrmContact[] = [
    {
      id: 'c-1',
      type: 'CLIENT',
      name: 'Sonatel Business SA',
      email: 'achats@sonatel.sn',
      phone: '+221 33 839 10 00',
      ninea: '004218765 2G3',
      address: 'Cité Keur Gorgui, Dakar',
    },
    {
      id: 'c-2',
      type: 'SUPPLIER',
      name: 'Dakar Audio & Scénographie SARL',
      email: 'contact@dakaraudio.sn',
      phone: '+221 77 540 22 10',
      ninea: '007912340 1A2',
      address: 'Zone Industrielle Sodida, Dakar',
    },
  ];

  const documents: CommercialDocument[] = [
    {
      id: 'doc-1',
      kind: 'CUSTOMER_INVOICE',
      number: 'FAC-2026-001',
      date: '2026-11-10',
      contactId: 'c-1',
      contactName: 'Sonatel Business SA',
      status: 'PARTIAL',
      lines: [
        {
          id: 'l-1',
          label: 'Organisation Forum Transformation Numérique (250 pers.)',
          quantity: 1,
          deliveredQuantity: 1,
          unitPrice: 2500000,
          vatRate: 18,
        },
      ],
      payments: [
        {
          id: 'p-1',
          date: '2026-11-12',
          amount: 1500000,
          method: 'VIREMENT',
          reference: 'VIR-CBAO-4412',
        },
      ],
      notes: `Facture rattachée à l’organisation ${orgId}`,
    },
  ];

  return { contacts, documents };
}

export const CrmDocumentsModule: React.FC<Props> = ({ organization }) => {
  const storageKey = `tpd_crm_v1_${organization.id}`;

  const [subTab, setSubTab] = useState<'documents' | 'contacts'>('documents');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'ALL'>('ALL');

  // New contact form
  const [contactType, setContactType] = useState<ContactType>('CLIENT');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactNinea, setContactNinea] = useState('');
  const [contactAddress, setContactAddress] = useState('');

  // New document form
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [newKind, setNewKind] = useState<DocumentKind>('QUOTE');
  const [newContactId, setNewContactId] = useState('');
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineQty, setNewLineQty] = useState(1);
  const [newLinePrice, setNewLinePrice] = useState(150000);
  const [newLineVat, setNewLineVat] = useState(18);
  const [newNotes, setNewNotes] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<DocumentPayment['method']>('VIREMENT');
  const [payRef, setPayRef] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { contacts: CrmContact[]; documents: CommercialDocument[] };
        setContacts(parsed.contacts || []);
        setDocuments(parsed.documents || []);
        setSelectedDocId(parsed.documents?.[0]?.id ?? null);
        return;
      }
    } catch {
      // ignore invalid storage
    }
    const seeded = getInitialData(organization.id);
    setContacts(seeded.contacts);
    setDocuments(seeded.documents);
    setSelectedDocId(seeded.documents[0]?.id ?? null);
  }, [organization.id, storageKey]);

  useEffect(() => {
    if (contacts.length === 0 && documents.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ contacts, documents }));
    } catch {
      // ignore storage quota errors
    }
  }, [contacts, documents, storageKey]);

  const selectedDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) ?? null,
    [documents, selectedDocId],
  );

  const filteredDocs = useMemo(
    () => (kindFilter === 'ALL' ? documents : documents.filter((d) => d.kind === kindFilter)),
    [documents, kindFilter],
  );

  function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactName.trim()) return;
    const created: CrmContact = {
      id: `c-${Date.now()}`,
      type: contactType,
      name: contactName.trim(),
      email: contactEmail.trim(),
      phone: contactPhone.trim(),
      ninea: contactNinea.trim(),
      address: contactAddress.trim(),
    };
    setContacts((prev) => [created, ...prev]);
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setContactNinea('');
    setContactAddress('');
  }

  function handleCreateDoc(e: React.FormEvent) {
    e.preventDefault();
    const contact = contacts.find((c) => c.id === newContactId) || contacts[0];
    if (!contact || !newLineLabel.trim()) return;
    const seq = documents.filter((d) => d.kind === newKind).length + 1;
    const doc: CommercialDocument = {
      id: `doc-${Date.now()}`,
      kind: newKind,
      number: `${KIND_PREFIX[newKind]}-2026-${String(seq).padStart(3, '0')}`,
      date: new Date().toISOString().slice(0, 10),
      contactId: contact.id,
      contactName: contact.name,
      status: 'DRAFT',
      lines: [
        {
          id: `l-${Date.now()}`,
          label: newLineLabel.trim(),
          quantity: Math.max(1, Number(newLineQty)),
          deliveredQuantity: 0,
          unitPrice: Math.max(0, Number(newLinePrice)),
          vatRate: Math.max(0, Number(newLineVat)),
        },
      ],
      payments: [],
      notes: newNotes.trim(),
    };
    setDocuments((prev) => [doc, ...prev]);
    setSelectedDocId(doc.id);
    setShowNewDoc(false);
    setNewLineLabel('');
    setNewNotes('');
  }

  function updateDocStatus(docId: string, status: DocumentStatus) {
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, status } : d)));
  }

  function recordPartialDelivery(docId: string, lineId: string, delta: number) {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id !== docId) return d;
        const lines = d.lines.map((l) => {
          if (l.id !== lineId) return l;
          const nextDelivered = Math.min(l.quantity, Math.max(0, l.deliveredQuantity + delta));
          return { ...l, deliveredQuantity: nextDelivered };
        });
        const allDelivered = lines.every((l) => l.deliveredQuantity >= l.quantity);
        const anyDelivered = lines.some((l) => l.deliveredQuantity > 0);
        const status: DocumentStatus = allDelivered ? 'DELIVERED' : anyDelivered ? 'PARTIAL' : d.status;
        return { ...d, lines, status };
      }),
    );
  }

  function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDoc) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) return;

    const payment: DocumentPayment = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      amount,
      method: payMethod,
      reference: payRef.trim() || `REG-${Date.now().toString().slice(-4)}`,
    };

    const totals = calcTotals(selectedDoc.lines);
    const nextPaid = selectedDoc.payments.reduce((s, p) => s + p.amount, 0) + amount;
    const nextStatus: DocumentStatus = nextPaid >= totals.ttc ? 'PAID' : 'PARTIAL';

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === selectedDoc.id ? { ...d, payments: [...d.payments, payment], status: nextStatus } : d,
      ),
    );
    setPayAmount('');
    setPayRef('');
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
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.number}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-neutral-900">Commandes & Documents CRM</h2>
          <p className="text-sm text-neutral-500">
            Stockage local navigateur isolé pour <span className="font-semibold text-neutral-700">{organization.name}</span> — Devis, Commandes, Bons de livraison, Factures & Règlements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('documents')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
              subTab === 'documents'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Documents ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('contacts')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border transition ${
              subTab === 'contacts'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            <Users className="w-4 h-4" />
            Contacts ({contacts.length})
          </button>
        </div>
      </div>

      {subTab === 'contacts' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleAddContact} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              Nouveau contact client / fournisseur
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['CLIENT', 'SUPPLIER'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContactType(t)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border ${
                    contactType === t
                      ? 'bg-sky-50 border-sky-500 text-sky-800'
                      : 'bg-white border-neutral-200 text-neutral-600'
                  }`}
                >
                  {t === 'CLIENT' ? 'Client' : 'Fournisseur'}
                </button>
              ))}
            </div>
            <input
              type="text"
              required
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Raison sociale"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="E-mail professionnel"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="Téléphone (+221...)"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <input
              type="text"
              value={contactNinea}
              onChange={(e) => setContactNinea(e.target.value)}
              placeholder="NINEA"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              placeholder="Adresse complète"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg transition"
            >
              Enregistrer le contact
            </button>
          </form>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {contacts.map((c) => (
              <div key={c.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        c.type === 'CLIENT' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {c.type === 'CLIENT' ? 'Client' : 'Fournisseur'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setContacts((prev) => prev.filter((item) => item.id !== c.id))}
                      className="text-neutral-400 hover:text-rose-600"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-neutral-900">{c.name}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{c.address || 'Adresse non renseignée'}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-100 text-xs text-neutral-600 space-y-1">
                  <div>E-mail : {c.email || '—'}</div>
                  <div>Tél : {c.phone || '—'}</div>
                  <div className="font-mono">NINEA : {c.ninea || '—'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4 no-print">
            <div className="flex items-center justify-between gap-2">
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as DocumentKind | 'ALL')}
                className="px-3 py-2 text-sm bg-white border border-neutral-200 rounded-lg"
              >
                <option value="ALL">Tous les documents</option>
                {(Object.keys(KIND_LABELS) as DocumentKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setNewContactId(contacts[0]?.id || '');
                  setShowNewDoc((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Nouveau document
              </button>
            </div>

            {showNewDoc && (
              <form onSubmit={handleCreateDoc} className="bg-white border border-sky-200 rounded-xl p-4 space-y-3">
                <div className="text-sm font-semibold text-neutral-900">Créer une pièce commerciale</div>
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as DocumentKind)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
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
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type === 'CLIENT' ? 'Client' : 'Fournisseur'})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  value={newLineLabel}
                  onChange={(e) => setNewLineLabel(e.target.value)}
                  placeholder="Désignation prestation ou produit"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={1}
                    value={newLineQty}
                    onChange={(e) => setNewLineQty(Number(e.target.value))}
                    placeholder="Qté"
                    className="px-2.5 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    value={newLinePrice}
                    onChange={(e) => setNewLinePrice(Number(e.target.value))}
                    placeholder="PU HT"
                    className="px-2.5 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={newLineVat}
                    onChange={(e) => setNewLineVat(Number(e.target.value))}
                    placeholder="TVA %"
                    className="px-2.5 py-2 text-sm border border-neutral-200 rounded-lg"
                  />
                </div>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Conditions / remarques"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewDoc(false)}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg"
                  >
                    Créer
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {filteredDocs.map((doc) => {
                const totals = calcTotals(doc.lines);
                const paid = doc.payments.reduce((s, p) => s + p.amount, 0);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-4 rounded-xl border transition ${
                      selectedDocId === doc.id
                        ? 'bg-sky-50/70 border-sky-400'
                        : 'bg-white border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-sky-700">{doc.number}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
                        {STATUS_LABELS[doc.status]}
                      </span>
                    </div>
                    <div className="font-semibold text-neutral-900 mt-1">{doc.contactName}</div>
                    <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                      <span>{KIND_LABELS[doc.kind]}</span>
                      <span className="font-mono font-semibold text-neutral-800">{formatFcfa(totals.ttc)}</span>
                    </div>
                    {paid > 0 && (
                      <div className="text-[11px] text-emerald-700 mt-1">
                        Réglé : {formatFcfa(paid)} / {formatFcfa(totals.ttc)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7">
            {selectedDoc ? (
              <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">
                      {KIND_LABELS[selectedDoc.kind]}
                    </div>
                    <h3 className="text-2xl font-bold font-mono text-neutral-900 mt-0.5">{selectedDoc.number}</h3>
                    <div className="text-sm text-neutral-600 mt-1">
                      Tiers : <span className="font-semibold text-neutral-900">{selectedDoc.contactName}</span> · Date :{' '}
                      {selectedDoc.date}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    {selectedDoc.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => updateDocStatus(selectedDoc.id, 'VALIDATED')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valider
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => exportCsv(selectedDoc)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 text-neutral-700 text-xs font-medium rounded-lg hover:bg-neutral-50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimer / PDF
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                        <th className="py-2 pr-3">Désignation</th>
                        <th className="py-2 px-2 text-right">Qté</th>
                        <th className="py-2 px-2 text-right">Livré</th>
                        <th className="py-2 px-2 text-right">PU HT</th>
                        <th className="py-2 pl-2 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {selectedDoc.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-3 pr-3 font-medium text-neutral-900">{line.label}</td>
                          <td className="py-3 px-2 text-right font-mono">{line.quantity}</td>
                          <td className="py-3 px-2 text-right font-mono">
                            <div className="inline-flex items-center gap-1.5">
                              <span>
                                {line.deliveredQuantity}/{line.quantity}
                              </span>
                              {line.deliveredQuantity < line.quantity && (
                                <button
                                  type="button"
                                  onClick={() => recordPartialDelivery(selectedDoc.id, line.id, 1)}
                                  className="no-print p-1 rounded bg-neutral-100 hover:bg-sky-100 text-sky-700"
                                  title="Enregistrer livraison partielle (+1)"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-mono">{formatFcfa(line.unitPrice)}</td>
                          <td className="py-3 pl-2 text-right font-mono font-semibold">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-100">
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <Wallet className="w-3.5 h-3.5" />
                          Suivi des règlements ({selectedDoc.payments.length})
                        </h4>
                        {selectedDoc.payments.length === 0 ? (
                          <p className="text-xs text-neutral-400">Aucun règlement enregistré.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {selectedDoc.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs bg-neutral-50 px-3 py-2 rounded-lg"
                              >
                                <span>
                                  {p.date} · {p.method} ({p.reference})
                                </span>
                                <span className="font-mono font-semibold text-emerald-700">{formatFcfa(p.amount)}</span>
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
                              className="flex-1 min-w-[140px] px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg"
                            />
                            <select
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value as DocumentPayment['method'])}
                              className="px-2 py-1.5 text-xs border border-neutral-200 rounded-lg"
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
                              className="w-24 px-2 py-1.5 text-xs border border-neutral-200 rounded-lg"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg"
                            >
                              Encaisser
                            </button>
                          </form>
                        )}
                      </div>

                      <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-neutral-600">
                          <span>Total HT</span>
                          <span className="font-mono">{formatFcfa(totals.ht)}</span>
                        </div>
                        <div className="flex justify-between text-neutral-600">
                          <span>TVA</span>
                          <span className="font-mono">{formatFcfa(totals.tva)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-neutral-900 pt-2 border-t border-neutral-200">
                          <span>Total TTC</span>
                          <span className="font-mono">{formatFcfa(totals.ttc)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-emerald-700 pt-1">
                          <span>Reste à régler</span>
                          <span className="font-mono font-semibold">{formatFcfa(remaining)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">
                Sélectionnez un document pour afficher le détail, les livraisons et les règlements.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
