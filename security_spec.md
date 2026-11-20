# Security Specification (Phase 0 — Payload-First Security TDD)

## 1. Data Invariants
1. **Identity & Email Verification**: No read or write is permitted unless `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Isolation**: User email, phone, and photo URLs reside strictly in `/users/{userId}/private/{docId}`, readable/writable only by `request.auth.uid == userId` or verified `isAdmin()`.
3. **Master Gate Workspace Membership**: Every workspace subcollection (`/workspaces/{workspaceId}/...`) requires a valid `Workspace` parent and verified membership or ownership (`ownerId == request.auth.uid`), with `ownerId` matching `request.auth.uid` on create and immutable on update.
4. **No Self-Assigned Privileges**: Users cannot write to `/admins/{userId}` or escalate `role` to `SUPERADMIN` / `ADMIN` on their own profile.
5. **Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` is immutable and `updatedAt` must equal `request.time` on update.
6. **Terminal State Locking**: Documents in terminal states (`GAGNE`, `PERDU`, `PAYE`, `ANNULE`, `CLOTURE`, `ARCHIVE`, `TERMINE`, `REJETE`) cannot be mutated by non-admin members.
7. **Volumetric & Type Safety**: Every document ID matches `^[a-zA-Z0-9_\\-]+$` (max 128 chars), every string enforces `.size()` limits matching `firebase-blueprint.json`, and `hasAll` + `hasOnly` forbid shadow/ghost fields.
8. **Secure List Queries (Zero `get()` in `list`)**: `allow list` rules strictly evaluate `resource.data.ownerId == request.auth.uid` (or `request.auth.token.email == 'jthiaw89@gmail.com' && request.auth.token.email_verified == true`), never using `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Create**: `{ "id": "doc-1", ... }` with `auth = null`.
2. **Unverified Email Spoof**: Admin email `jthiaw89@gmail.com` with `email_verified: false`.
3. **Shadow / Ghost Field Injection**: Valid `CrmContact` + `{ "isVerified": true }`.
4. **Identity Spoofing on Create**: `CrmContact` with `ownerId: "other-uid"` != `request.auth.uid`.
5. **Owner Mutation on Update**: Updating `CrmContact.ownerId` from `uid-a` to `uid-b`.
6. **Self-Privilege Escalation**: Writing `/admins/{uid}` as a standard user.
7. **PII Cross-Read**: User B reading `/users/userA/private/profile`.
8. **ID Poisoning**: Document ID `bad..id/../../etc` or 500-char string violating `isValidId()`.
9. **String Exhaustion (Denial of Wallet)**: `WorkReport.summary` with 10,000 characters (> 2000 limit).
10. **Client-Forged Timestamp**: Creating `MissionOrder` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
11. **Terminal State Bypass**: Non-admin modifying `CrmDocument` after `status == 'PAYE'`.
12. **Blanket List Query Scraping**: Querying `/workspaces/ws-1/crm_contacts` without `where('ownerId', '==', uid)`.
