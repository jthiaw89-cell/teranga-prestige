import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Calculator, Lock, LogOut, Plus, ShieldCheck } from 'lucide-react';

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

function formatFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} FCFA`;
}

export const AccountingModule: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('tpd_acc_token'));
  const [user, setUser] = useState<AccountingUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<'entries' | 'accounts' | 'setup'>('entries');

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

  async function logout() {
    await fetch('/api/accounting/auth/logout', { method: 'POST', headers: authHeaders, credentials: 'include' });
    sessionStorage.removeItem('tpd_acc_token');
    setToken(null);
    setUser(null);
  }

  async function submitDoubleEntry(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
    await fetchOverview(token);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccLabel.trim()) return;
    const res = await fetch('/api/accounting/accounts', {
      method: 'POST',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify({ code: newAccCode, label: newAccLabel }),
    });
    if (res.ok) {
      setNewAccCode('');
      setNewAccLabel('');
      await fetchOverview(token);
    }
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Comptabilité SYSCOHADA</h2>
            <p className="text-xs text-neutral-500">
              Authentification comptable isolée et écritures en partie double équilibrées.
            </p>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium">{error}</div>}

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail comptable (ex. comptabilite@teranga-demo.sn)"
            className="w-full px-3.5 py-2.5 text-sm border border-neutral-200 rounded-lg"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe comptable"
            className="w-full px-3.5 py-2.5 text-sm border border-neutral-200 rounded-lg"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => login(false)}
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold rounded-lg transition"
          >
            Se connecter au module comptable
          </button>
        </div>

        <div className="pt-4 border-t border-neutral-100">
          <button
            type="button"
            disabled={loading}
            onClick={() => login(true)}
            className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-sm font-semibold rounded-lg transition"
          >
            Accès Démonstration SYSCOHADA (tpd-demo-accounting)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-neutral-900">{user.organizationName}</div>
            <div className="text-xs text-neutral-500">
              {user.name} · <span className="font-mono">{user.role}</span> · {fiscalYears[0]?.label || 'Exercice actif'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setView('entries')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              view === 'entries' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            Journal & Écritures ({entries.length})
          </button>
          <button
            type="button"
            onClick={() => setView('accounts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              view === 'accounts' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            Plan SYSCOHADA ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setView('setup')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              view === 'setup' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'
            }`}
          >
            Exercices & Journaux
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100"
          >
            <LogOut className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium">{error}</div>}

      {view === 'entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form onSubmit={submitDoubleEntry} className="lg:col-span-4 bg-white border border-neutral-200 rounded-xl p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-sky-600" />
              Saisie en partie double
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={journalCode}
                onChange={(e) => setJournalCode(e.target.value)}
                className="px-2.5 py-2 text-xs border border-neutral-200 rounded-lg"
              >
                {journals.map((j) => (
                  <option key={j.id} value={j.code}>
                    {j.code} — {j.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="px-2.5 py-2 text-xs border border-neutral-200 rounded-lg"
              />
            </div>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Pièce justificative (ex. FAC-2026-099)"
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Libellé de l’opération"
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg"
            />
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Compte au Débit</label>
              <select
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-neutral-200 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-500 mb-1">Compte au Crédit</label>
              <select
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-neutral-200 rounded-lg"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.code} — {a.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Montant FCFA (Débit = Crédit)"
              className="w-full px-3 py-2 text-xs font-mono border border-neutral-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Comptabiliser l’écriture équilibrée
            </button>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {entries.map((entry) => (
              <div key={entry.id} className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-sky-700 mr-2">{entry.entryNumber}</span>
                    <span className="font-semibold text-sm text-neutral-900">{entry.description}</span>
                  </div>
                  <div className="text-xs text-neutral-500 font-mono">
                    {entry.entryDate} · Réf: {entry.reference}
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-neutral-400 border-b border-neutral-100 text-left">
                      <th className="py-1">Compte</th>
                      <th className="py-1">Intitulé</th>
                      <th className="py-1 text-right">Débit</th>
                      <th className="py-1 text-right">Crédit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {entry.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td className="py-1.5 font-mono font-semibold text-neutral-800">{l.accountCode}</td>
                        <td className="py-1.5 text-neutral-600">{l.accountLabel}</td>
                        <td className="py-1.5 text-right font-mono text-neutral-900">
                          {l.debit > 0 ? formatFcfa(l.debit) : '—'}
                        </td>
                        <td className="py-1.5 text-right font-mono text-neutral-900">
                          {l.credit > 0 ? formatFcfa(l.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'accounts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={createAccount} className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 h-fit">
            <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-600" />
              Ajouter un compte SYSCOHADA
            </h3>
            <input
              type="text"
              required
              value={newAccCode}
              onChange={(e) => setNewAccCode(e.target.value)}
              placeholder="Numéro de compte (ex. 627)"
              className="w-full px-3 py-2 text-sm font-mono border border-neutral-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={newAccLabel}
              onChange={(e) => setNewAccLabel(e.target.value)}
              placeholder="Intitulé du compte"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-lg"
            >
              Ajouter au plan comptable
            </button>
          </form>

          <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="py-2.5 px-4">Compte</th>
                  <th className="py-2.5 px-4">Libellé SYSCOHADA</th>
                  <th className="py-2.5 px-4">Classe</th>
                  <th className="py-2.5 px-4">Sens normal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2.5 px-4 font-mono font-semibold text-sky-700">{a.code}</td>
                    <td className="py-2.5 px-4 text-neutral-800">{a.label}</td>
                    <td className="py-2.5 px-4 text-xs text-neutral-500">Classe {a.accountClass}</td>
                    <td className="py-2.5 px-4 text-xs font-mono">{a.normalBalance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'setup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-neutral-900">Exercices comptables</h3>
            {fiscalYears.map((fy) => (
              <div key={fy.id} className="p-3 rounded-lg bg-neutral-50 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-neutral-900">{fy.label}</div>
                  <div className="text-xs text-neutral-500 font-mono">
                    {fy.startDate} → {fy.endDate}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-semibold">
                  {fy.status}
                </span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-neutral-900">Journaux auxiliaires</h3>
            {journals.map((j) => (
              <div key={j.id} className="p-3 rounded-lg bg-neutral-50 flex items-center justify-between text-sm">
                <div>
                  <span className="font-mono font-bold text-sky-700 mr-2">{j.code}</span>
                  <span className="font-medium text-neutral-800">{j.name}</span>
                </div>
                <span className="text-xs text-neutral-500 font-mono">{j.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
