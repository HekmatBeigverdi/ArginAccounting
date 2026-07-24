# Phase 08 — Audit Trail and Approval Workflow

## Purpose

Phase 08 establishes the platform-wide foundation for traceability, approval workflows, authorization, concurrency control, and atomic persistence.

The implementation is generic and is intended to support future accounting documents, inventory documents, sales and purchase workflows, treasury operations, master-data changes, administrative actions, posting, reversal, and external integration events.

## Delivered Packages

### `@argin/audit`

Contains database-independent domain types, validation, contracts, permissions, and application use cases.

### `@argin/audit-tauri`

Contains SQLite query builders, row mappers, repositories, pagination helpers, database adapters, and the SQLite Unit of Work used by the desktop runtime.

## Audit Model

An audit entry contains:

- `id`
- `occurredAt`
- `action`
- `outcome`
- `source`
- `actor`
- `scope`
- `target`
- `message`
- `reason`
- `before`
- `after`
- `correlationId`
- `metadata`

### Actor

Supported actor types:

- `user`
- `system`
- `integration`

### Source

Supported sources:

- `desktop`
- `web`
- `api`
- `system`
- `synchronization`
- `integration`

### Outcome

Supported outcomes:

- `success`
- `failure`
- `denied`

### Snapshot Sanitization

Before and after snapshots are sanitized before persistence. Sensitive key names such as password, secret, token, authorization, credential, private key, and related variants must not retain their original values.

Audit snapshots are diagnostic records, not a substitute for encrypted secret storage.

## Approval Model

An approval request contains:

- Identity and numeric version
- Request type
- Title and description
- Current status
- Target entity
- Company, branch, and fiscal-year scope
- Requesting actor and request time
- Deciding actor and decision time
- Decision comment
- Creation and update timestamps
- Append-only history

## Approval State Machine

```text
draft
  ├─ submit ─────────────→ pending
  └─ cancel ─────────────→ cancelled

pending
  ├─ approve ────────────→ approved
  ├─ reject ─────────────→ rejected
  ├─ return-to-draft ────→ draft
  └─ cancel ─────────────→ cancelled
```

A comment action records history without changing status.

Final states are:

- `approved`
- `rejected`
- `cancelled`

## Approval History

Every action creates an append-only history record containing:

- Action
- Previous status
- New status
- Actor
- Comment
- Occurrence time

History records must not be edited or deleted by normal workflows.

## Application Use Cases

### Audit

- Record audit entry
- Get audit entry
- Search audit entries

### Approval

- Create approval request
- Get approval request
- Search approval requests
- Submit request
- Approve request
- Reject request
- Return request to draft
- Cancel request
- Add comment

## Permissions

### Audit

- `audit.entries.view`
- `audit.entries.record`

### Approval

- `approval.requests.view`
- `approval.requests.create`
- `approval.requests.submit`
- `approval.requests.approve`
- `approval.requests.reject`
- `approval.requests.return-to-draft`
- `approval.requests.cancel`
- `approval.requests.comment`

`system.full-access` satisfies audit and approval permission checks.

Permission checks occur before repository access or transaction execution whenever possible.

## Atomic Persistence

Creating an approval request writes:

1. Approval request
2. Initial approval history
3. Audit entry

Applying an approval action writes:

1. Updated approval request
2. Approval history entry
3. Audit entry

These writes occur inside one Unit of Work transaction. Any failure causes rollback.

## SQLite Transaction Strategy

The desktop Unit of Work uses:

```sql
BEGIN IMMEDIATE;
-- repository writes
COMMIT;
```

On failure:

```sql
ROLLBACK;
```

An asynchronous mutex serializes transactions that share the same database connection.

If rollback also fails, an `AggregateError` preserves both the original and rollback errors.

## Optimistic Concurrency

Approval requests include a `version` column with an initial value of `1`.

Repository updates use the current ID and expected version in the update predicate. A successful update increments the version. When no row matches, the repository raises `ApprovalConcurrencyError`.

The UI must reload the current record after a concurrency conflict before allowing another decision.

## Database Migrations

### `0005_audit_and_approval.sql`

Creates:

- `audit_entries`
- `approval_requests`
- `approval_history`
- Search and relationship indexes

### `0006_approval_optimistic_concurrency.sql`

Adds:

- `approval_requests.version`

Do not modify released migrations. Future schema corrections must use new migration files.

## Desktop Composition

The desktop composition root constructs:

- SQLite audit repository
- SQLite approval repository
- SQLite audit Unit of Work
- Clock
- ID generator
- Permission authorizer based on authenticated-session permissions
- Audit application context
- Approval application context

React pages consume only `useAuditServices()`.

## Desktop Routes

### Approval

- `/approval/requests`
- `/approval/requests/:id`

### Audit

- `/audit/entries`
- `/audit/entries/:id`

The UI is Persian and RTL. Identifiers, JSON snapshots, and technical values use LTR presentation where required.

## Tests

### `@argin/audit`

Covers:

- Approval transition rules
- Invalid transitions
- Permission denial
- Atomic create workflow
- Submit workflow
- Version increment behavior
- Audit creation
- Query forwarding
- Sensitive snapshot sanitization

### `@argin/audit-tauri`

Covers:

- Commit
- Rollback
- Rollback failure
- Transaction serialization through the mutex

## Validation Commands

```bash
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/audit-tauri test
pnpm --filter @argin/desktop typecheck

pnpm typecheck
pnpm test
pnpm build

cd apps/desktop/src-tauri
cargo check
```

## Manual Validation Scenarios

1. Sign in as an administrator and open the Approval list.
2. Create or seed a draft approval request.
3. Submit it and confirm the status becomes pending.
4. Approve or reject it and confirm version increment.
5. Confirm a history record exists for each action.
6. Open Audit Viewer and confirm corresponding audit events exist.
7. Confirm before and after snapshots do not expose sensitive values.
8. Sign in with a restricted user and confirm unauthorized actions are hidden and rejected by the application layer.
9. Open the same request in two sessions and verify stale update protection.
10. Trigger a repository failure in a test environment and verify no partial workflow records remain.

## Known Limitations

- The current session is stored in application memory and is not a complete persistent session-management solution.
- Approval workflows are generic; module-specific approval policies and multi-level approval chains will be introduced in later phases.
- Direct SQLite integration testing of stale concurrent updates requires a Node-compatible SQLite test adapter or desktop integration harness.
- Audit retention, archival, export, and tamper-evidence policies are future operational concerns.
- UI styling remains part of the temporary desktop shell and will evolve with the production design system.

## Exit Criteria

Phase 08 is ready to merge when:

- All package and workspace checks pass.
- Migrations succeed on new and upgraded databases.
- Permission catalog seeding succeeds.
- Approval and Audit routes load without runtime errors.
- Atomic rollback and concurrency behavior are manually verified.
- Roadmap, architecture, changelog, README, and release checklist are updated.
- No credentials, secrets, generated databases, or build artifacts are committed.