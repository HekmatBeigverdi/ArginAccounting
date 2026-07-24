# Contributing to ArginAccounting

## Language Rules

- Source code identifiers: English
- Database identifiers: English
- API contracts: English
- Technical documentation: English
- Commit messages: English
- User-facing application text: Persian
- Desktop layout: RTL

## Branches

- `main`: stable releases
- `develop`: integration branch
- `phase/*`: phase implementation
- `fix/*`: targeted bug fixes
- `release/*`: release preparation

Create each phase branch from the latest `develop`:

```bash
git switch develop
git pull origin develop
git switch -c phase/NN-short-name
```

A completed phase is merged into `develop` with a non-fast-forward merge:

```bash
git switch develop
git pull origin develop
git merge --no-ff phase/NN-short-name
git push origin develop
```

Do not rewrite shared branch history unless repository recovery explicitly requires it.

## Commit Messages

Use concise English messages following Conventional Commit style where practical.

Examples:

```text
feat(accounting): add chart of accounts domain
fix(audit): reject stale approval updates
docs: document phase 08 architecture
refactor(database): extract transaction executor
test(approval): cover invalid transitions
chore: update workspace configuration
```

A commit should represent one coherent change. Avoid mixing feature implementation, unrelated formatting, and documentation updates in the same commit.

## Pull Requests

A pull request or phase review should include:

- Purpose and scope
- Important architecture decisions
- Database migrations
- Permission additions
- User-facing routes or screens
- Tests added
- Validation commands and results
- Known limitations
- Upgrade or migration notes

## Architecture Boundaries

- Domain packages must not import React, Tauri, SQLite, PostgreSQL, or HTTP frameworks.
- Application services may depend only on domain types and contracts.
- Infrastructure packages implement contracts for a runtime or database.
- UI components consume application services through composition roots.
- Accounting rules must never be implemented inside UI components.
- A module must not directly modify another module's internal tables.

## Database Changes

All schema changes must use ordered, versioned migrations.

A migration must:

1. Have a unique sequential number.
2. Be safe for existing installations.
3. Include required indexes and constraints.
4. Avoid destructive changes unless a documented data migration exists.
5. Be registered in the desktop Tauri migration list.
6. Be validated against both a new database and an upgraded database.

Never edit an already released migration to change its meaning. Add a new migration instead.

## Transactions

Operations that write multiple related records must use a Unit of Work or transaction executor.

Examples:

- Source document and journal voucher
- Approval request, approval history, and audit entry
- Inventory document and stock movements
- Payment and accounting effects

A failed operation must not leave partial records.

## Concurrency

Use optimistic concurrency for mutable records that can be edited by more than one workflow or runtime. Stale updates must raise a specific error and must not silently overwrite newer data.

## Permissions

Permission checks belong at the application boundary. Hiding a button in the UI is not sufficient authorization.

When adding a protected use case:

1. Define a stable permission code.
2. Register it in the permission catalog.
3. Enforce it in the application service.
4. Use it in the UI only for visibility and user experience.
5. Add permission-denial tests.

## Auditability

Critical actions must create immutable audit records when applicable. Audit snapshots must be sanitized before persistence and must never store raw passwords, tokens, secrets, private keys, or equivalent sensitive values.

## Dates and Money

- UI dates use Jalali presentation and input.
- Business dates are stored as Gregorian dates.
- System timestamps are stored in UTC.
- Iranian Rial is the primary accounting unit.
- Monetary values must not use floating-point storage.

## Testing

Every important business rule should have automated tests.

Minimum expectations:

- Valid paths
- Invalid transitions
- Validation failures
- Permission denial
- Atomic rollback
- Concurrency conflicts where applicable
- Query filtering and pagination
- Sensitive-data sanitization

Run package-specific checks while developing, then the full workspace checks before review.

## Required Validation

```bash
pnpm typecheck
pnpm test
pnpm build

cd apps/desktop/src-tauri
cargo check
```

For Phase 08:

```bash
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/audit-tauri test
pnpm --filter @argin/desktop typecheck
```

Do not mark a phase complete when any required command fails.

## Documentation

Update these files when relevant:

- `README.md`
- `ROADMAP.md`
- `ARCHITECTURE.md`
- `CHANGELOG.md`
- Phase documentation under `docs/`
- `RELEASE_CHECKLIST.md`

Technical documentation must describe actual implemented behavior and clearly identify planned or incomplete work.

## Release Preparation

Before creating a tag:

1. Merge the phase branch into `develop`.
2. Run all validation commands.
3. Review migrations and upgrade behavior.
4. Update changelog and roadmap.
5. Confirm no test credentials or secrets are committed.
6. Create the release tag from the intended stable commit.
7. Publish release notes matching the changelog.