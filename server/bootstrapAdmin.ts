import 'dotenv/config';
import { simpleHash, store } from './db.js';

const orgId = process.env.ACCOUNTING_ORGANIZATION_ID || 'tenant-senelec';
const orgName = process.env.ACCOUNTING_ORGANIZATION_NAME || 'Senelec Digital';
const email = process.env.ACCOUNTING_ADMIN_EMAIL || 'comptabilite@example.sn';
const name = process.env.ACCOUNTING_ADMIN_NAME || 'Administrateur comptable';
const password = process.env.ACCOUNTING_ADMIN_PASSWORD || '';

if (password.length < 14) {
  console.error('ACCOUNTING_ADMIN_PASSWORD doit contenir au moins 14 caractères.');
  process.exit(1);
}

store.accountingUsers.push({
  id: `acc-${Date.now()}`,
  organizationId: orgId,
  organizationName: orgName,
  email,
  name,
  role: 'OWNER',
  passwordHash: simpleHash(password),
});

console.log(`Administrateur comptable initialisé pour ${orgName} (${email}).`);
