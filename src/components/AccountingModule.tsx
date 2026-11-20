import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Download,
  LayoutList,
  Lock,
  Plus,
  Scale,
  Search,
  Table2,
  X,
} from 'lucide-react';

interface AccountingUser {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ACCOUNTANT' | 'READ_ONLY';
}

interface FiscalYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Journal {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Account {
  id: string;
  code: string;
  label: string;
  accountClass: string;
  normalBalance: 'DEBIT' | 'CREDIT';
}

interface EntryLine {
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: number;
  credit: number;
}

interface Entry {
  id: string;
  fiscalYearId: string;
  journalCode: string;
  entryNumber: string;
  entryDate: string;
  reference: string;
  description: string;
  lines: EntryLine[];
  createdBy: string;
}

type AccountingTab = 'entries' | 'balance' | 'accounts' | 'setup';
type LedgerDisplayMode = 'ledger' | 'vouchers';

function formatAmount(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

function formatFcfa(n: number): string {
  return `${formatAmount(n)} FCFA`;
}

export const AccountingModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(
    () => sessionStorage.getItem('tpd_acc_token') || sessionStorage.getItem('tpd_intranet_token'),
  );
  const [user, setUser] = useState<AccountingUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);

  const [view, setView] = useState<AccountingTab>('entries');
  const [displayMode, setDisplayMode] = useState<LedgerDisplayMode>('ledger');
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [journalFilter, setJournalFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountClassFilter, setAccountClassFilter] = useState<string>('ALL');

  // New balanced double-entry form
  const [journalCode, setJournalCode] = useState('VE');
  const [entryDate, setEntryDate] = useState('2026-11-17');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState('411');
  const [creditAccount, setCreditAccount] = useState('706');
  const [amount, setAmount] = useState('500000');

  // New account form
  const [newAccCode, setNewAccCode] = useState('');
  const [newAccLabel, setNewAccLabel] = useState('');

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }, [token]);

  const fetchOverview = useCallback(async (activeToken?: string | null) => {
    const hdrs: Record<string, string> = {};
    if (activeToken) hdrs.Authorization = `Bearer ${activeToken}`;
    const res = await fetch('/api/accounting/overview', { headers: hdrs, credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setFiscalYears(data.fiscalYears || []);
    setJournals(data.journals || []);
    setAccounts(data.accounts || []);
    setEntries(data.entries || []);
  }, []);

  useEffect(() => {
    (async () => {
      const hdrs: Record<string, string> = {};
      if (token) hdrs.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/accounting/auth/me', { headers: hdrs, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        await fetchOverview(token);
      }
    })();
  }, [fetchOverview, token]);

  async function login(demoQuickAccess: boolean) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(demoQuickAccess ? { demoQuickAccess: true } : { email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Connexion refusée.');
        return;
      }
      sessionStorage.setItem('tpd_acc_token', data.token);
      setToken(data.token);
      setUser(data.user);
      await fetchOverview(data.token);
    } catch {
      setError('API comptable indisponible.');
    } finally {
      setLoading(false);
    }
  }

  async function submitDoubleEntry(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    const val = Number(amount);
    const fy = fiscalYears[0]?.id;
    if (!fy || !val || val <= 0 || !description.trim()) {
      setError('Veuillez saisir un libellé et un montant positif.');
      return;
    }

    const dAcc = accounts.find((a) => a.code === debitAccount);
    const cAcc = accounts.find((a) => a.code === creditAccount);
    const res = await fetch('/api/accounting/entries', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({
        fiscalYearId: fy,
        journalCode,
        entryDate,
        reference,
        description,
        lines: [
          {
            accountCode: debitAccount,
            accountLabel: dAcc?.label || debitAccount,
            label: description,
            debit: val,
            credit: 0,
          },
          {
            accountCode: creditAccount,
            accountLabel: cAcc?.label || creditAccount,
            label: description,
            debit: 0,
            credit: val,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Erreur lors de la saisie.');
      return;
    }
    setDescription('');
    setReference('');
    setShowEntryForm(false);
    setSuccessMsg(`Écriture ${data.entry?.entryNumber || ''} comptabilisée en partie double.`);
    await fetchOverview(token);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!newAccCode.trim() || !newAccLabel.trim()) return;
    const res = await fetch('/api/accounting/accounts', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ code: newAccCode, label: newAccLabel }),
    });
    if (res.ok) {
      setSuccessMsg(`Compte ${newAccCode.trim()} ajouté au plan SYSCOHADA.`);
      setNewAccCode('');
      setNewAccLabel('');
      await fetchOverview(token);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Impossible de créer le compte.');
    }
  }

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (journalFilter !== 'ALL' && entry.journalCode !== journalFilter) return false;
      if (!q) return true;
      const matchesHeader =
        entry.entryNumber.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.reference.toLowerCase().includes(q) ||
        entry.journalCode.toLowerCase().includes(q);
      const matchesLine = entry.lines.some(
        (l) =>
          l.accountCode.toLowerCase().includes(q) ||
          l.accountLabel.toLowerCase().includes(q) ||
          l.label.toLowerCase().includes(q),
      );
      return matchesHeader || matchesLine;
    });
  }, [entries, journalFilter, searchQuery]);

  const ledgerTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const entry of filteredEntries) {
      for (const line of entry.lines) {
        totalDebit += line.debit;
        totalCredit += line.credit;
      }
    }
    const diff = Math.abs(totalDebit - totalCredit);
    return {
      totalDebit,
      totalCredit,
      diff,
      isBalanced: diff < 0.01,
    };
  }, [filteredEntries]);

  const trialBalance = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        label: string;
        accountClass: string;
        debit: number;
        credit: number;
      }
    >();

    for (const acc of accounts) {
      map.set(acc.code, {
        code: acc.code,
        label: acc.label,
        accountClass: acc.accountClass,
        debit: 0,
        credit: 0,
      });
    }

    for (const entry of entries) {
      for (const line of entry.lines) {
        const existing = map.get(line.accountCode) || {
          code: line.accountCode,
          label: line.accountLabel,
          accountClass: line.accountCode.slice(0, 1) || '—',
          debit: 0,
          credit: 0,
        };
        existing.debit += line.debit;
        existing.credit += line.credit;
        map.set(line.accountCode, existing);
      }
    }

    return Array.from(map.values())
      .filter((row) => row.debit > 0 || row.credit > 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [accounts, entries]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((a) => {
      if (accountClassFilter !== 'ALL' && a.accountClass !== accountClassFilter) return false;
      if (!q) return true;
      return a.code.toLowerCase().includes(q) || a.label.toLowerCase().includes(q);
    });
  }, [accountClassFilter, accounts, searchQuery]);

  const accountClasses = useMemo(
    () => Array.from(new Set(accounts.map((a) => a.accountClass))).sort(),
    [accounts],
  );

  function exportCsv() {
    const rows =
      view === 'balance'
        ? [
            ['Compte', 'Intitulé', 'Classe', 'Total Débit', 'Total Crédit', 'Solde Débiteur', 'Solde Créditeur'].join(
              ';',
            ),
            ...trialBalance.map((r) => {
              const net = r.debit - r.credit;
              return [
                r.code,
                r.label,
                `Classe ${r.accountClass}`,
                Math.round(r.debit),
                Math.round(r.credit),
                net > 0 ? Math.round(net) : 0,
                net < 0 ? Math.round(Math.abs(net)) : 0,
              ].join(';');
            }),
          ]
        : [
            ['Date', 'Pièce', 'Journal', 'Référence', 'Compte', 'Intitulé', 'Libellé', 'Débit', 'Crédit'].join(';'),
            ...filteredEntries.flatMap((entry) =>
              entry.lines.map((l) =>
                [
                  entry.entryDate,
                  entry.entryNumber,
                  entry.journalCode,
                  entry.reference,
                  l.accountCode,
                  l.accountLabel,
                  entry.description,
                  Math.round(l.debit),
                  Math.round(l.credit),
                ].join(';'),
              ),
            ),
          ];

    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `syscohada-${view}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Comptabilité SYSCOHADA</h2>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail comptable (ex. comptabilite@teranga-demo.sn)"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe comptable"
            className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => login(false)}
            className="w-full py-2.5 bg-gray-900 dark:bg-blue-600 hover:bg-gray-800 dark:hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Se connecter au module comptable
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            disabled={loading}
            onClick={() => login(true)}
            className="w-full py-2.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-sm font-semibold rounded-lg transition-colors"
          >
            Accès Démonstration SYSCOHADA
          </button>
        </div>
      </div>
    );
  }

  const TABS: { id: AccountingTab; label: string; count?: number }[] = [
    { id: 'entries', label: 'Journal & Écritures', count: entries.length },
    { id: 'balance', label: 'Balance générale', count: trialBalance.length },
    { id: 'accounts', label: 'Plan SYSCOHADA', count: accounts.length },
    { id: 'setup', label: 'Exercices & Journaux', count: journals.length },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Compact Sub-Navigation Bar + Contextual Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-0.5">
        <nav className="flex items-center gap-6 overflow-x-auto" aria-label="Vues comptables SYSCOHADA">
          {TABS.map((tab) => {
            const active = view === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`relative pb-3 pt-1 text-sm whitespace-nowrap shrink-0 inline-flex items-center gap-2 border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="text-xs font-mono tabular-nums text-gray-400 dark:text-gray-500">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2.5 pb-2.5">
          <div className="text-xs text-gray-500 dark:text-gray-400 hidden xl:block mr-1">
            {fiscalYears[0]?.label || 'Exercice 2026'}
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{user.organizationName}</span>
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </button>

          {view === 'entries' && user.role !== 'READ_ONLY' && (
            <button
              type="button"
              onClick={() => setShowEntryForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {showEntryForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showEntryForm ? 'Fermer la saisie' : 'Nouvelle écriture'}
            </button>
          )}
        </div>
      </div>

      {/* Feedback messages */}
      {error && (
        <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="text-xs font-semibold hover:underline ml-4">
            Fermer
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-medium flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-xs font-semibold hover:underline ml-4">
            Fermer
          </button>
        </div>
      )}

      {/* 2. 4-Column Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-800">
        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Débits (sélection)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-1">
            {formatFcfa(ledgerTotals.totalDebit)}
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {filteredEntries.length} écriture(s) affichée(s)
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Crédits (sélection)</div>
          <div className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-1">
            {formatFcfa(ledgerTotals.totalCredit)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Contrôle Partie Double</div>
          <div
            className={`text-xl font-bold mt-1 flex items-center gap-2 ${
              ledgerTotals.isBalanced
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <Scale className="w-5 h-5 shrink-0" />
            <span>{ledgerTotals.isBalanced ? 'Équilibré' : 'Déséquilibré'}</span>
          </div>
          <div className="text-xs font-mono tabular-nums text-gray-400 dark:text-gray-500 mt-1">
            Écart : {formatFcfa(ledgerTotals.diff)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Référentiel OHADA</div>
          <div className="text-xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-1">
            {accounts.length} comptes
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {trialBalance.length} compte(s) mouvementé(s)
          </div>
        </div>
      </div>

      {/* TAB 1: JOURNAL & ÉCRITURES (FULL-WIDTH LEDGER + COLLAPSIBLE ENTRY COMPOSER) */}
      {view === 'entries' && (
        <div className="space-y-5">
          {showEntryForm && (
            <form
              onSubmit={submitDoubleEntry}
              className="border border-blue-200 dark:border-blue-800/80 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Nouvelle écriture en partie double
                  </h3>
                </div>
                <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  Équilibre instantané : Débit = Crédit ({formatFcfa(Number(amount || 0))})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Journal auxiliaire
                  </label>
                  <select
                    value={journalCode}
                    onChange={(e) => setJournalCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    {journals.map((j) => (
                      <option key={j.id} value={j.code}>
                        {j.code} — {j.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Date comptable
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Pièce justificative
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex. FAC-2026-099"
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Montant (FCFA) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Libellé de l&apos;opération *
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex. Facturation séminaire direction..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  />
                </div>

                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Compte au Débit
                  </label>
                  <select
                    value={debitAccount}
                    onChange={(e) => setDebitAccount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Compte au Crédit
                  </label>
                  <select
                    value={creditAccount}
                    onChange={(e) => setCreditAccount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.code}>
                        {a.code} — {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEntryForm(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Comptabiliser l&apos;écriture
                </button>
              </div>
            </form>
          )}

          {/* Filter & Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher pièce, compte, libellé..."
                  className="pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-64"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setJournalFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    journalFilter === 'ALL'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  Tous
                </button>
                {journals.map((j) => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setJournalFilter(j.code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      journalFilter === j.code
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {j.code}
                  </button>
                ))}
              </div>
            </div>

            {/* Ledger View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg">
              <button
                type="button"
                onClick={() => setDisplayMode('ledger')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  displayMode === 'ledger'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Tableau unifié
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('vouchers')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  displayMode === 'vouchers'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Fiches par pièce
              </button>
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-10 text-center space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Aucune écriture comptable ne correspond à votre filtre.
              </p>
              <div className="flex justify-center gap-2">
                {(searchQuery || journalFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setJournalFilter('ALL');
                    }}
                    className="px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
                {user.role !== 'READ_ONLY' && (
                  <button
                    type="button"
                    onClick={() => setShowEntryForm(true)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                  >
                    Saisir une écriture
                  </button>
                )}
              </div>
            </div>
          ) : displayMode === 'ledger' ? (
            /* UNIFIED CONTIGUOUS ACCOUNTING LEDGER TABLE */
            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-3">Pièce</th>
                      <th className="py-3 px-3">Journal</th>
                      <th className="py-3 px-3">Compte</th>
                      <th className="py-3 px-4">Intitulé &amp; libellé d&apos;opération</th>
                      <th className="py-3 px-4 text-right">Débit (FCFA)</th>
                      <th className="py-3 px-4 text-right">Crédit (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredEntries.map((entry) => (
                      <React.Fragment key={entry.id}>
                        <tr className="bg-gray-50/50 dark:bg-gray-800/25">
                          <td className="py-2 px-4 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {entry.entryDate}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                            {entry.entryNumber}
                          </td>
                          <td className="py-2 px-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                            {entry.journalCode}
                          </td>
                          <td colSpan={4} className="py-2 px-4 text-xs text-gray-700 dark:text-gray-200">
                            <span className="font-semibold">{entry.description}</span>
                            <span aria-hidden="true" className="mx-2 text-gray-400">·</span>
                            <span className="font-mono text-gray-500 dark:text-gray-400">
                              Réf. {entry.reference}
                            </span>
                            <span aria-hidden="true" className="mx-2 text-gray-400">·</span>
                            <span className="text-gray-400 dark:text-gray-500">Par {entry.createdBy}</span>
                          </td>
                        </tr>
                        {entry.lines.map((line, idx) => (
                          <tr
                            key={`${entry.id}-${idx}`}
                            className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            <td className="py-2.5 px-4 text-xs text-gray-400 dark:text-gray-600" />
                            <td className="py-2.5 px-3 text-xs text-gray-400 dark:text-gray-600" />
                            <td className="py-2.5 px-3 text-xs text-gray-400 dark:text-gray-600" />
                            <td className="py-2.5 px-3 font-mono text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {line.accountCode}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-gray-700 dark:text-gray-300">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{line.accountLabel}</span>
                              {line.label && line.label !== entry.description && (
                                <span className="text-gray-500 dark:text-gray-400"> — {line.label}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {line.debit > 0 ? formatAmount(line.debit) : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                              {line.credit > 0 ? formatAmount(line.credit) : '—'}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs">
                      <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Totaux généraux ({filteredEntries.length} écriture(s))
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatFcfa(ledgerTotals.totalDebit)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatFcfa(ledgerTotals.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            /* COMPACT VOUCHERS GRID VIEW */
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredEntries.map((entry) => {
                const entryDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
                return (
                  <div
                    key={entry.id}
                    className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {entry.entryNumber}
                          <span aria-hidden="true" className="mx-1.5">·</span>
                          Journal {entry.journalCode}
                          <span aria-hidden="true" className="mx-1.5">·</span>
                          {entry.entryDate}
                        </div>
                        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-0.5">
                          {entry.description}
                        </h4>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
                          {formatFcfa(entryDebit)}
                        </div>
                        <div className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                          Réf. {entry.reference}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-800 pt-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 text-left">
                            <th className="py-1 font-medium">Compte</th>
                            <th className="py-1 font-medium">Intitulé</th>
                            <th className="py-1 text-right font-medium">Débit</th>
                            <th className="py-1 text-right font-medium">Crédit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/70">
                          {entry.lines.map((l, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 font-mono font-semibold text-blue-700 dark:text-blue-400">
                                {l.accountCode}
                              </td>
                              <td className="py-1.5 text-gray-700 dark:text-gray-300">{l.accountLabel}</td>
                              <td className="py-1.5 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                                {l.debit > 0 ? formatAmount(l.debit) : '—'}
                              </td>
                              <td className="py-1.5 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                                {l.credit > 0 ? formatAmount(l.credit) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BALANCE GÉNÉRALE DES COMPTES */}
      {view === 'balance' && (
        <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Balance générale des comptes SYSCOHADA
            </h3>
            <span className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400">
              {trialBalance.length} compte(s) mouvementé(s)
            </span>
          </div>

          {trialBalance.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucun mouvement comptable enregistré pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="py-3 px-4">Compte</th>
                    <th className="py-3 px-4">Intitulé SYSCOHADA</th>
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4 text-right">Mvt Débit</th>
                    <th className="py-3 px-4 text-right">Mvt Crédit</th>
                    <th className="py-3 px-4 text-right">Solde Débiteur</th>
                    <th className="py-3 px-4 text-right">Solde Créditeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {trialBalance.map((row) => {
                    const net = row.debit - row.credit;
                    return (
                      <tr key={row.code} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-4 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                          {row.code}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-medium text-gray-900 dark:text-gray-100">
                          {row.label}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                          Classe {row.accountClass}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-gray-700 dark:text-gray-300">
                          {row.debit > 0 ? formatAmount(row.debit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs text-gray-700 dark:text-gray-300">
                          {row.credit > 0 ? formatAmount(row.credit) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {net > 0 ? formatAmount(net) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {net < 0 ? formatAmount(Math.abs(net)) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 font-semibold text-xs">
                    <td colSpan={3} className="py-3 px-4 text-right uppercase text-gray-600 dark:text-gray-300">
                      Totaux Balance
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {formatFcfa(trialBalance.reduce((s, r) => s + r.debit, 0))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      {formatFcfa(trialBalance.reduce((s, r) => s + r.credit, 0))}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatFcfa(
                        trialBalance.reduce((s, r) => s + (r.debit - r.credit > 0 ? r.debit - r.credit : 0), 0),
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatFcfa(
                        trialBalance.reduce((s, r) => s + (r.debit - r.credit < 0 ? Math.abs(r.debit - r.credit) : 0), 0),
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PLAN COMPTABLE SYSCOHADA */}
      {view === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={createAccount}
            className="lg:col-span-4 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl p-5 space-y-4 h-fit"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Ajouter un compte SYSCOHADA
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Numéro de compte *
              </label>
              <input
                type="text"
                required
                value={newAccCode}
                onChange={(e) => setNewAccCode(e.target.value)}
                placeholder="Ex. 627"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Intitulé du compte *
              </label>
              <input
                type="text"
                required
                value={newAccLabel}
                onChange={(e) => setNewAccLabel(e.target.value)}
                placeholder="Ex. Publicité, publications et relations publiques"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Ajouter au plan comptable
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrer par numéro ou intitulé..."
                  className="pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-64"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/80 rounded-lg overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setAccountClassFilter('ALL')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                    accountClassFilter === 'ALL'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Toutes classes
                </button>
                {accountClasses.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setAccountClassFilter(cls)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                      accountClassFilter === cls
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Cl. {cls}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <th className="py-3 px-4">Compte</th>
                    <th className="py-3 px-4">Libellé SYSCOHADA</th>
                    <th className="py-3 px-4">Classe</th>
                    <th className="py-3 px-4">Sens normal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredAccounts.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {a.code}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-medium text-gray-900 dark:text-gray-100">{a.label}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500 dark:text-gray-400">
                        Classe {a.accountClass}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-gray-700 dark:text-gray-300">
                        {a.normalBalance === 'DEBIT' ? 'Débit' : 'Crédit'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: EXERCICES & JOURNAUX */}
      {view === 'setup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Exercices comptables</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {fiscalYears.map((fy) => (
                <div key={fy.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{fy.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      {fy.startDate} → {fy.endDate}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {fy.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Journaux auxiliaires</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {journals.map((j) => (
                <div key={j.id} className="px-5 py-3.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 w-8">
                      {j.code}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{j.name}</span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{j.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
