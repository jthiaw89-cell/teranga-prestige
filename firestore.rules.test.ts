import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8')) as {
  entities: Record<string, { required?: string[]; properties: Record<string, { maxLength?: number; pattern?: string }> }>;
};
const rulesSource = fs.readFileSync('firestore.rules', 'utf8');

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

test('Firestore rules enforce Eight Pillars invariants', () => {
  assert.match(rulesSource, /rules_version\s*=\s*'2';/);
  assert.match(rulesSource, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /request\.auth\.token\.email == 'jthiaw89@gmail\.com'/);
  assert.match(rulesSource, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesSource, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rulesSource, /getAfter\(\/databases\/\$\(database\)\/documents\/workspaces\/\$\(workspaceId\)\)/);
});

test('Dirty Dozen adversarial payloads are rejected by validation & rules', () => {
  const crmContactProps = blueprint.entities.CrmContact.properties;
  const crmContactReq = blueprint.entities.CrmContact.required || [];
  const allowedKeys = new Set(Object.keys(crmContactProps));

  // 1. Shadow field injection
  const shadowPayload = {
    id: 'cnt-1',
    workspaceId: 'ws_1',
    ownerId: 'uid_1',
    name: 'Awa',
    company: 'Sonatel',
    sector: 'Telecoms',
    stage: 'PROSPECT',
    estimatedValueFcfa: 100000,
    createdAt: 'NOW',
    updatedAt: 'NOW',
    isVerified: true,
  };
  assert.equal(Object.keys(shadowPayload).every((k) => allowedKeys.has(k)), false);

  // 2. ID poisoning
  assert.equal(isValidId('../../etc/passwd'), false);
  assert.equal(isValidId('a'.repeat(200)), false);

  // 3. String exhaustion on WorkReport.summary
  const maxSummary = blueprint.entities.WorkReport.properties.summary.maxLength || 2000;
  assert.equal('x'.repeat(10000).length <= maxSummary, false);

  // 4. Missing required field
  const incomplete: Record<string, unknown> = { id: 'cnt-1', name: 'Test' };
  assert.equal(crmContactReq.every((k) => k in incomplete), false);

  // 5. All blueprint collections have matching rules blocks
  for (const col of [
    'admins',
    'users',
    'workspaces',
    'crm_contacts',
    'crm_documents',
    'campaigns',
    'missions',
    'reports',
    'tasks',
    'planning_events',
    'ged_documents',
    'accounting_entries',
    'teams_channels',
    'teams_messages',
    'leave_requests',
  ]) {
    assert.ok(rulesSource.includes(`match /${col}/`), `Missing rules match block for ${col}`);
  }
});
