import 'dotenv/config';
import { simpleHash, store } from './db.js';

const orgId = process.env.INTRANET_ORGANIZATION_ID || 'tenant-senelec';
const orgName = process.env.INTRANET_ORGANIZATION_NAME || 'Senelec Digital';
const email = process.env.INTRANET_ADMIN_EMAIL || 'admin-intranet@example.sn';
const name = process.env.INTRANET_ADMIN_NAME || 'Administrateur intranet';
const password = process.env.INTRANET_ADMIN_PASSWORD || '';

if (password.length < 14) {
  console.error('INTRANET_ADMIN_PASSWORD doit contenir au moins 14 caractères.');
  process.exit(1);
}

store.intranetUsers.push({
  id: `int-${Date.now()}`,
  organizationId: orgId,
  organizationName: orgName,
  email,
  name,
  role: 'OWNER',
  title: 'Administrateur Intranet',
  passwordHash: simpleHash(password),
});

console.log(`Administrateur intranet initialisé pour ${orgName} (${email}).`);
