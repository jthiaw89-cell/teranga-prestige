import 'dotenv/config';
import crypto from 'node:crypto';
import { simpleHash, store } from './db.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refus d’exécution en production.');
  process.exit(1);
}

if (!process.argv.includes('--confirm-local-test-database')) {
  console.error('Ajoutez --confirm-local-test-database pour confirmer la création des profils de démonstration.');
  process.exit(1);
}

const genPassword = (): string => crypto.randomBytes(12).toString('base64url');
const accountingPwd = genPassword();
const intranetPwd = genPassword();

store.accountingUsers.forEach((u) => {
  if (u.organizationId === 'tpd-demo-accounting') {
    u.passwordHash = simpleHash(accountingPwd);
  }
});

store.intranetUsers.forEach((u) => {
  if (u.organizationId === 'tpd-demo-intranet') {
    u.passwordHash = simpleHash(intranetPwd);
  }
});

console.log('Profils de démonstration locaux prêts :');
console.log(`- Comptabilité (tpd-demo-accounting) : mot de passe = ${accountingPwd}`);
console.log(`- Intranet (tpd-demo-intranet) : mot de passe = ${intranetPwd}`);
