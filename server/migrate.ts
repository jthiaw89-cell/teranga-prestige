import 'dotenv/config';
import { db } from './db.js';

async function runMigrate(): Promise<void> {
  if (db.isMock) {
    console.log('DATABASE_URL absent : aucune migration SQL distante nécessaire (mode mémoire prêt).');
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS accounting_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS intranet_users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      organization_name TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('Migration terminée.');
}

runMigrate().catch((err) => {
  console.error('Erreur de migration:', err);
  process.exit(1);
});
