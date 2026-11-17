import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import {
  db,
  simpleHash,
  store,
  type AccountingEntryLine,
  type AccountingUser,
  type IntranetAttachment,
  type IntranetUser,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';

interface SessionRecord<T> {
  id: string;
  user: T;
  createdAt: number;
}

const accountingSessions = new Map<string, SessionRecord<AccountingUser>>();
const intranetSessions = new Map<string, SessionRecord<IntranetUser>>();

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    cookies[key] = val;
  }
  return cookies;
}

function extractToken(req: Request, cookieName: string): string | null {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[cookieName]) return cookies[cookieName];
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function setSessionCookie(res: Response, name: string, token: string): void {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getAccountingUser(req: Request): AccountingUser | null {
  const token = extractToken(req, 'tpd_acc_session');
  if (!token) return null;
  return accountingSessions.get(token)?.user ?? null;
}

function getIntranetUser(req: Request): IntranetUser | null {
  const token = extractToken(req, 'tpd_intranet_session');
  if (!token) return null;
  return intranetSessions.get(token)?.user ?? null;
}

async function createServer(): Promise<void> {
  const app = express();

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      mode: db.isMock ? 'in-memory' : 'postgresql',
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // MODULE DE COMPTABILITÉ (SYSCOHADA)
  // =========================================================================

  app.post('/api/accounting/auth/login', (req: Request, res: Response) => {
    const { email, password, demoQuickAccess } = req.body as {
      email?: string;
      password?: string;
      demoQuickAccess?: boolean;
    };

    let user: AccountingUser | undefined;
    if (demoQuickAccess) {
      user = store.accountingUsers.find((u) => u.organizationId === 'tpd-demo-accounting');
    } else if (email && password) {
      user = store.accountingUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.passwordHash === simpleHash(password),
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Identifiants comptables invalides.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    accountingSessions.set(token, { id: token, user, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_acc_session', token);

    return res.json({
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  app.post('/api/accounting/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_acc_session');
    if (token) accountingSessions.delete(token);
    res.clearCookie('tpd_acc_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/accounting/auth/me', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  app.get('/api/accounting/overview', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });

    const orgId = user.organizationId;
    const fiscalYears = store.accountingFiscalYears.filter((f) => f.organizationId === orgId);
    const journals = store.accountingJournals.filter((j) => j.organizationId === orgId);
    const accounts = store.accountingAccounts.filter((a) => a.organizationId === orgId);
    const entries = store.accountingEntries.filter((e) => e.organizationId === orgId);

    return res.json({ fiscalYears, journals, accounts, entries });
  });

  app.post('/api/accounting/fiscal-years', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { label, startDate, endDate } = req.body as { label?: string; startDate?: string; endDate?: string };
    if (!label || !startDate || !endDate) {
      return res.status(400).json({ error: 'Libellé et dates requis.' });
    }

    const fy = {
      id: `fy-${Date.now()}`,
      organizationId: user.organizationId,
      label: label.trim(),
      startDate,
      endDate,
      status: 'OPEN' as const,
    };
    store.accountingFiscalYears.push(fy);
    return res.status(201).json({ fiscalYear: fy });
  });

  app.post('/api/accounting/journals', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { code, name, type } = req.body as {
      code?: string;
      name?: string;
      type?: 'ACHATS' | 'VENTES' | 'BANQUE' | 'CAISSE' | 'OD';
    };
    if (!code || !name || !type) {
      return res.status(400).json({ error: 'Code, nom et type de journal requis.' });
    }

    const journal = {
      id: `j-${Date.now()}`,
      organizationId: user.organizationId,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      type,
    };
    store.accountingJournals.push(journal);
    return res.status(201).json({ journal });
  });

  app.post('/api/accounting/accounts', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { code, label, normalBalance } = req.body as {
      code?: string;
      label?: string;
      normalBalance?: 'DEBIT' | 'CREDIT';
    };
    if (!code || !label) {
      return res.status(400).json({ error: 'Code et libellé SYSCOHADA requis.' });
    }

    const cleanCode = code.trim();
    const account = {
      id: `acc-${Date.now()}`,
      organizationId: user.organizationId,
      code: cleanCode,
      label: label.trim(),
      accountClass: cleanCode[0] || '1',
      normalBalance: normalBalance || (['1', '4', '7'].includes(cleanCode[0]) ? 'CREDIT' : 'DEBIT'),
    };
    store.accountingAccounts.push(account);
    return res.status(201).json({ account });
  });

  app.post('/api/accounting/entries', (req: Request, res: Response) => {
    const user = getAccountingUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification comptable requise.' });
    if (user.role === 'READ_ONLY') return res.status(403).json({ error: 'Accès en lecture seule.' });

    const { fiscalYearId, journalCode, entryDate, reference, description, lines } = req.body as {
      fiscalYearId?: string;
      journalCode?: string;
      entryDate?: string;
      reference?: string;
      description?: string;
      lines?: AccountingEntryLine[];
    };

    if (!fiscalYearId || !journalCode || !entryDate || !description || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'Écriture incomplète : au moins 2 lignes sont requises.' });
    }

    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: `Écriture déséquilibrée : Débit (${totalDebit}) ≠ Crédit (${totalCredit}).`,
      });
    }

    const seq = store.accountingEntries.filter((e) => e.organizationId === user.organizationId).length + 1;
    const entry = {
      id: `ent-${Date.now()}`,
      organizationId: user.organizationId,
      fiscalYearId,
      journalCode,
      entryNumber: `${journalCode}-${entryDate.slice(0, 4)}-${String(seq).padStart(4, '0')}`,
      entryDate,
      reference: reference?.trim() || `REF-${seq}`,
      description: description.trim(),
      lines: lines.map((l) => ({
        accountCode: l.accountCode,
        accountLabel: l.accountLabel || l.accountCode,
        label: l.label || description.trim(),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    };
    store.accountingEntries.unshift(entry);
    return res.status(201).json({ entry });
  });

  // =========================================================================
  // MODULE INTRANET DU PERSONNEL
  // =========================================================================

  app.post('/api/intranet/auth/login', (req: Request, res: Response) => {
    const { organizationId, email, password, demoRole } = req.body as {
      organizationId?: string;
      email?: string;
      password?: string;
      demoRole?: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
    };

    let user: IntranetUser | undefined;
    if (demoRole) {
      user = store.intranetUsers.find(
        (u) => u.organizationId === 'tpd-demo-intranet' && u.role === demoRole,
      );
    } else if (email && password) {
      const targetOrg = organizationId?.trim() || 'tpd-demo-intranet';
      user = store.intranetUsers.find(
        (u) =>
          u.organizationId === targetOrg &&
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          u.passwordHash === simpleHash(password),
      );
    }

    if (!user) {
      return res.status(401).json({ error: 'Identifiants intranet invalides.' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    intranetSessions.set(token, { id: token, user, createdAt: Date.now() });
    setSessionCookie(res, 'tpd_intranet_session', token);

    return res.json({
      token,
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
        title: user.title,
      },
    });
  });

  app.post('/api/intranet/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, 'tpd_intranet_session');
    if (token) intranetSessions.delete(token);
    res.clearCookie('tpd_intranet_session', { path: '/' });
    return res.json({ ok: true });
  });

  app.get('/api/intranet/auth/me', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié.' });
    return res.json({
      user: {
        id: user.id,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        email: user.email,
        name: user.name,
        role: user.role,
        title: user.title,
      },
    });
  });

  app.get('/api/intranet/workspace', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const channels = store.intranetChannels.filter(
      (c) => c.organizationId === user.organizationId && (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    const allowedChannelIds = new Set(channels.map((c) => c.id));
    const messages = store.intranetMessages.filter((m) => allowedChannelIds.has(m.channelId));
    const topics = store.intranetForumTopics.filter((t) => allowedChannelIds.has(t.channelId));
    const members = store.intranetUsers
      .filter((u) => u.organizationId === user.organizationId)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        title: u.title,
      }));

    return res.json({ channels, messages, topics, members });
  });

  app.post('/api/intranet/messages', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const { channelId, content, attachment } = req.body as {
      channelId?: string;
      content?: string;
      attachment?: IntranetAttachment;
    };

    if (!channelId || (!content?.trim() && !attachment)) {
      return res.status(400).json({ error: 'Canal et contenu requis.' });
    }

    const channel = store.intranetChannels.find(
      (c) =>
        c.id === channelId &&
        c.organizationId === user.organizationId &&
        (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    if (!channel) {
      return res.status(403).json({ error: 'Accès refusé à ce canal.' });
    }

    if (attachment && attachment.sizeBytes > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'La pièce jointe dépasse la limite de 5 Mo.' });
    }

    const msg = {
      id: `msg-${Date.now()}`,
      organizationId: user.organizationId,
      channelId: channel.id,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role,
      content: content?.trim() || '',
      attachment,
      createdAt: new Date().toISOString(),
    };
    store.intranetMessages.push(msg);
    return res.status(201).json({ message: msg });
  });

  app.post('/api/intranet/topics', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const { channelId, title, body } = req.body as { channelId?: string; title?: string; body?: string };
    if (!channelId || !title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: 'Canal, titre et description requis.' });
    }

    const channel = store.intranetChannels.find(
      (c) =>
        c.id === channelId &&
        c.organizationId === user.organizationId &&
        (!c.isPrivate || c.memberIds.includes(user.id)),
    );
    if (!channel) return res.status(403).json({ error: 'Accès refusé à ce canal.' });

    const topic = {
      id: `top-${Date.now()}`,
      organizationId: user.organizationId,
      channelId,
      title: title.trim(),
      body: body.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    store.intranetForumTopics.unshift(topic);
    return res.status(201).json({ topic });
  });

  app.post('/api/intranet/topics/:topicId/replies', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user) return res.status(401).json({ error: 'Authentification intranet requise.' });

    const topic = store.intranetForumTopics.find((t) => t.id === req.params.topicId);
    if (!topic || topic.organizationId !== user.organizationId) {
      return res.status(404).json({ error: 'Sujet introuvable.' });
    }

    const { content } = req.body as { content?: string };
    if (!content?.trim()) {
      return res.status(400).json({ error: 'Contenu de réponse requis.' });
    }

    const reply = {
      id: `rep-${Date.now()}`,
      authorId: user.id,
      authorName: user.name,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };
    topic.replies.push(reply);
    return res.status(201).json({ reply });
  });

  app.post('/api/intranet/users', (req: Request, res: Response) => {
    const user = getIntranetUser(req);
    if (!user || user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Seul le propriétaire peut créer un compte personnel.' });
    }

    const { name, email, role, title, password } = req.body as {
      name?: string;
      email?: string;
      role?: 'DIRECTION' | 'MANAGER' | 'EMPLOYEE';
      title?: string;
      password?: string;
    };

    if (!name || !email || !role || !password || password.length < 14) {
      return res.status(400).json({
        error: 'Nom, e-mail, rôle et mot de passe temporaire (min. 14 caractères) requis.',
      });
    }

    const created: IntranetUser = {
      id: `int-${Date.now()}`,
      organizationId: user.organizationId,
      organizationName: user.organizationName,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      title: title?.trim() || role,
      passwordHash: simpleHash(password),
    };
    store.intranetUsers.push(created);

    // Add to non-private channels automatically
    store.intranetChannels.forEach((ch) => {
      if (ch.organizationId === user.organizationId && !ch.isPrivate) {
        ch.memberIds.push(created.id);
      }
    });

    return res.status(201).json({
      member: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        title: created.title,
      },
    });
  });

  // Error middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  });

  // Mount Vite in dev, or serve static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build dist/index.html introuvable. Exécutez npm run build.');
      }
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Teranga Prestige Digital prêt sur http://${HOST}:${PORT} (mode ${isProd ? 'production' : 'développement'})`);
  });
}

createServer().catch((err) => {
  console.error('Échec du démarrage du serveur:', err);
  process.exit(1);
});
