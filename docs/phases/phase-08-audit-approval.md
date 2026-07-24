# Phase 08 — Audit Trail and Approval Workflow

## Status

Implemented and merged into `develop` and `main`. Release validation evidence must be recorded separately; this document does not claim commands were executed successfully.

## Overview

Phase 08 establishes platform-wide traceability, authorization-aware approval workflows, optimistic concurrency, and atomic persistence. The implementation is generic enough for future accounting, inventory, sales, purchases, treasury, master-data, posting, reversal, and integration workflows.

## Delivered Packages

- `@argin/audit`: database-independent audit and approval domain, contracts, permissions, and application services.
- `@argin/audit-tauri`: SQLite query builders, mappers, repositories, pagination, adapters, and Unit of Work.

## Audit Model

Audit entries capture identity, occurrence time, action, outcome, source, actor, organizational scope, target, message, reason, sanitized before/after snapshots, correlation ID, and metadata.

Supported actors are `user`, `system`, and `integration`. Supported sources include `desktop`, `web`, `api`, `system`, `synchronization`, and `integration`. Outcomes are `success`, `failure`, and `denied`.

Sensitive names such as passwords, secrets, tokens, authorization values, credentials, and private keys are sanitized before persistence. Audit history is append-only and is not secret storage.

## Approval Domain

An approval request contains identity, numeric version, type, title, description, current status, target entity, company/branch/fiscal scope, requester, decision actor, timestamps, comment, and append-only history.

### State Machine

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

A comment records history without changing status. Final states are `approved`, `rejected`, and `cancelled`.

Every history record stores action, previous status, new status, actor, comment, and occurrence time. Normal workflows never update or delete history.

## Application Services

Audit use cases record, retrieve, and search entries. Approval use cases create, retrieve, search, submit, approve, reject, return to draft, cancel, and comment.

## Permissions

Audit:

- `audit.entries.view`
- `audit.entries.record`

Approval:

- `approval.requests.view`
- `approval.requests.create`
- `approval.requests.submit`
- `approval.requests.approve`
- `approval.requests.reject`
- `approval.requests.return-to-draft`
- `approval.requests.cancel`
- `approval.requests.comment`

`system.full-access` satisfies the module checks. Authorization occurs before repository or transaction execution whenever possible.

## Atomic Persistence

Creating a request writes the request, initial history, and audit entry in one Unit of Work. Applying an action writes the updated request, new history, and audit entry in one transaction. Any failure rolls back the complete operation.

The SQLite Unit of Work uses `BEGIN IMMEDIATE`, `COMMIT`, and `ROLLBACK`. An asynchronous mutex serializes transactions sharing the same connection. If rollback also fails, an `AggregateError` preserves both failures.

## Optimistic Concurrency

Approval requests start at version `1`. Updates include ID and expected version in the predicate, then increment the version. A stale update raises `ApprovalConcurrencyError`; the UI must reload before another decision.

## Data and Migrations

- `0005_audit_and_approval.sql`: audit entries, approval requests, approval history, and indexes.
- `0006_approval_optimistic_concurrency.sql`: approval request version column.

Released migrations are immutable. Corrections require new migrations.

## Desktop Integration

The composition root builds repositories, Unit of Work, clock, ID generator, permission authorizer, audit context, and approval context. React pages consume `useAuditServices()`.

Routes:

- `/approval/requests`
- `/approval/requests/:id`
- `/audit/entries`
- `/audit/entries/:id`

The UI is Persian and RTL; identifiers, JSON snapshots, and technical values use LTR presentation when required.

## Tests Added

Domain/application tests cover transition rules, invalid transitions, permission denial, atomic create/submit behaviour, version increments, audit creation, query forwarding, and snapshot sanitization.

Infrastructure tests cover commit, rollback, rollback failure, and mutex-based transaction serialization.

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

These commands are required validation steps, not evidence that validation succeeded.

## Known Limitations

- Session storage remains application-memory based.
- Module-specific and multi-level approval policies are future work.
- Direct stale-update integration testing needs a suitable SQLite desktop harness.
- Audit retention, archival, export, and tamper evidence remain future operational concerns.
- UI styling will evolve with the production design system.

## Documentation Impact

This phase is governed by the permanent [Documentation Governance](../development/documentation-governance.md), [Security Model](../security/security-model.md), [Database Design](../database/database-design.md), [Testing Strategy](../development/testing-strategy.md), and [Domain Glossary](../glossary/domain-glossary.md).

## Related ADRs

- [ADR-0004 — SQLite Infrastructure](../adr/ADR-0004-sqlite-infrastructure.md)
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md)
- [ADR-0006 — Application Services](../adr/ADR-0006-application-services.md)
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md)
- [ADR-0008 — Approval Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md)

## Exit Criteria

Implementation is merged. Release closure additionally requires successful workspace checks, migrations on new and upgraded databases, permission seeding, runtime route validation, rollback and concurrency verification, updated release documentation, and confirmation that no secrets or generated artefacts are committed.

## Next Phase

Phase 09 — Platform Infrastructure.