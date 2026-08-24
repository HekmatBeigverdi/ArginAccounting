# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, reversal, authorization, persistence, and traceability while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency — Completed**.

Next step: **Step 12 — Audit, Integration Events, and Notifications**.

Branch: `phase/15-journal-lifecycle`

Baseline release: `v0.14.0`

## Objectives

- Define and implement an explicit Journal Voucher lifecycle state machine.
- Integrate lifecycle approval with the existing generic Approval Workflow foundation.
- Implement final posting with authoritative accounting validation.
- Make posted accounting facts immutable from an audit perspective.
- Add controlled locking, amendment, reversal, and replacement lineage.
- Enforce lifecycle permissions, optimistic concurrency, idempotency, atomicity, and audit evidence.
- Deliver Persian RTL lifecycle actions and traceability using the shared Phase 14 desktop design system.
- Keep Accounting Reports outside this phase and hand off to Phase 16.

## Scope

Included:

- Lifecycle domain model and transition policy.
- Approval integration.
- Posting and immutable posted state.
- Locking and controlled amendment.
- Reversal/replacement lineage.
- Application commands/queries and authorization.
- SQLite lifecycle persistence and migrations.
- Atomicity, optimistic concurrency, and idempotency.
- Audit/integration events and applicable notifications.
- Persian RTL desktop lifecycle UX.
- Full validation and documentation.

Excluded:

- Accounting Reports.
- Automatic posting from operational source modules.
- Later Posting Rules / Source Document Integrity phases.
- PostgreSQL/.NET server and synchronization implementation.
- Destructive mutation of final posted accounting facts.

## Architecture

Phase 15 extends the existing Journal Voucher aggregate and Application contracts rather than replacing them. Domain/Application code remains persistence- and presentation-independent. SQLite is the current adapter; future PostgreSQL/API implementations must preserve the same lifecycle semantics.

Step 2 accepted [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md). `JournalVoucher` remains the authoritative owner of accounting lifecycle state, while the generic Phase 08 `ApprovalRequest` remains a separate reusable aggregate and authoritative owner of approval history/state.

The selected Journal lifecycle graph is:

```text
draft -> pending_approval -> approved -> posted -> reversed
            |                  |
            +----> draft <-----+
```

Steps 4–10 provide lifecycle behavior, authorization, and the durable relational schema. Step 11 now connects those persistence-neutral Application contracts to SQLite transactions without moving business rules into the adapter.

## Domain Model

The authoritative `JournalVoucherStatus` states are:

- `draft`
- `pending_approval`
- `approved`
- `posted`
- `reversed`

`packages/accounting/src/domain/journal-voucher-lifecycle.ts` owns deterministic state transitions. Authorization and persistence remain outside the Domain state machine.

## Approval Integration

`packages/accounting/src/application/journal-voucher-approval-integration.ts` reuses Phase 08 Approval contracts. Submission records the approved-content cycle and Approval decisions drive accepted Journal transitions while preserving Approval as a separate aggregate.

## Final Posting Policy

`packages/accounting/src/application/journal-voucher-posting.ts` requires company ownership, expected version, exact `approved` state, current matching approved Approval evidence, exact submitted-content version, current balance/account/dimension validity, and an open matching fiscal year/period immediately before posting.

Successful posting creates immutable posting evidence containing voucher id, approval request id, submitted content version, posted version, posting actor, canonical ISO posting time, and optional normalized posting reference.

## Locking and Controlled Amendment

Only `draft` is ordinarily editable. `approved` can return to `draft` only through controlled amendment with actor/reason/version/current-approval evidence. Posted/reversed accounting facts cannot be edited in place.

## Reversal and Replacement Lineage

`reverseJournalVoucher` creates a separate posted inverse Journal, transitions the original from `posted -> reversed`, preserves original lines unchanged, supports durable request-id replay, prevents double reversal, and records explicit original/reversal/replacement lineage.

## Application Contracts, Commands, and Queries

Step 8 exposes one persistence-neutral command/query/DTO surface through `@argin/accounting/journal`. `JournalVoucherLifecycleCommandContext` carries actor, company, request/idempotency, correlation, causation, and occurrence metadata. The lifecycle DTO exposes persisted state/version and Approval/Posting/Amendment/Reversal traceability.

State-policy capabilities answer what the lifecycle state allows; user authorization remains a separate concern.

## Authorization, Permissions, and Segregation of Duties

Step 9 adds dedicated permissions for submit, approve, reject, return-to-draft, cancel approval, post, controlled amendment, and reversal. These permissions are registered in the Security default permission catalog and enforced at the Application boundary before lifecycle business execution.

The default segregation policy prohibits self-approval for the active Approval cycle while avoiding unsupported mandatory separation for poster/reverser in small organizations. Stable failures distinguish missing permission from segregation-of-duties violation.

## Data and Migrations

Step 10 adds `apps/desktop/src-tauri/migrations/0014_journal_lifecycle.sql`, registered as migration version 14 (`journal_lifecycle`) in the Tauri SQL migration runner.

The Phase 13 table retains its legacy `status = 'draft'` constraint for upgrade safety. Phase 15 adds `lifecycle_status` as the authoritative lifecycle persistence column with the five-state CHECK constraint and preserves existing Draft rows without destructive table rebuild.

Lifecycle evidence is stored in dedicated relational tables:

- `journal_voucher_approval_cycles`;
- `journal_voucher_posting_evidence`;
- `journal_voucher_amendment_evidence`;
- `journal_voucher_reversal_lineage`.

Protective uniqueness/index rules preserve one current Approval cycle, one posting record, append-only amendment versions, unique original/reversal identities, and unique reversal `(company_id, request_id)` replay keys.

The user executed `pnpm --filter @argin/desktop test` locally after Step 10, fixed the two test-only defects, pushed commit `e9bae35ddfde307f752a287199bbe7b22bfcf3f5`, and confirmed the suite is green. The retained test rules are:

- spread `node:sqlite` result rows into plain objects before strict deep equality;
- use `sqlite_master.tbl_name` when discovering indexes attached to Journal tables rather than filtering index names as if they were table names.

## SQLite Repository, Unit of Work, Concurrency, and Idempotency

Step 11 extends `@argin/accounting-tauri` with the concrete SQLite lifecycle adapter.

`SqliteJournalVoucherRepository` now treats `lifecycle_status` as the persisted lifecycle source of truth. `rehydrateJournalVoucher` restores persisted status rather than silently recreating every loaded voucher as `draft`.

The legacy Phase 13 `status` column remains `draft`. New reversal/compensating vouchers can therefore be inserted with legacy `status='draft'` while their authoritative `lifecycle_status='posted'`, avoiding violation of the original CHECK constraint without weakening the Phase 15 model.

Optimistic lifecycle state changes use `updateLifecycleState`:

```text
UPDATE journal_vouchers
SET lifecycle_status = ?, updated_at = ?, version = ?
WHERE id = ? AND company_id = ? AND version = ?
```

The shared `assertVersionedUpdate` path rejects stale transitions when no row matches the expected version.

`packages/accounting-tauri/src/sqlite-journal-voucher-lifecycle.ts` provides:

- `SqliteJournalVoucherApprovalUnitOfWork`;
- `SqliteJournalVoucherPostingUnitOfWork`;
- `SqliteJournalVoucherAmendmentUnitOfWork`;
- `SqliteJournalVoucherReversalUnitOfWork`;
- `SqliteJournalVoucherLifecycleReader`.

Each multi-write lifecycle operation executes inside one `DatabaseExecutor.transaction(...)` boundary.

Approval integration accepts a `JournalVoucherApprovalGatewayFactory` bound to the exact transaction `DatabaseSession`. This keeps the Journal transition, generic Approval mutation, and approval-cycle persistence eligible to commit or roll back together. Existing Approval-cycle rows are updated through UPSERT when an approved cycle remains current rather than attempting a second insert of the same Approval Request id.

Posting performs the lifecycle CAS update and inserts posting evidence in the same transaction. Controlled amendment performs the lifecycle CAS update, current-cycle close, and amendment evidence insert in one transaction. Reversal performs the original CAS transition, new reversal-voucher persistence, and unique lineage insert in one transaction.

Retry/concurrency protection is layered:

- expected-version CAS protects stale Journal transitions;
- the one-current-cycle partial unique index prevents concurrent duplicate current Approval cycles;
- one-row posting evidence prevents duplicate final posting evidence;
- unique reversal original/reversal identities prevent a second committed reversal chain;
- unique `(company_id, request_id)` reversal lineage prevents duplicate retry outcomes;
- existing Journal `(company_id, request_id)` uniqueness continues to protect retry-sensitive voucher creation.

`SqliteJournalVoucherLifecycleReader` reads current Approval cycle, posting evidence, latest amendment evidence, and reversal/replacement lineage directly from durable tables, so traceability is not reconstructed from descriptions.

Focused adapter tests were added in `packages/accounting-tauri/tests/sqlite-journal-voucher-lifecycle.test.ts` for one-transaction Amendment, one-transaction Reversal, same-session Approval gateway creation, and atomic Posting evidence persistence.

Post-commit audit/integration-event dispatch remains Step 12 by the frozen plan. Step 11 deliberately guarantees database atomicity and leaves event emission outside the transaction boundary for the next step.

## Security

Authorization is deny-by-default at the Application boundary. UI gates are usability only. Granular lifecycle permissions are independently assignable and the default self-approval prohibition is enforced from current Approval evidence rather than client state.

The canonical security documentation is maintained in `docs/security/security-model.md`.

## UI

Later lifecycle UI consumes state-policy capabilities and permission-aware Application results; it does not reproduce authorization or persistence rules in React/Tauri.

## Testing

Focused coverage through Step 11 includes:

- Domain lifecycle legal/illegal paths;
- Approval integration and duplicate-cycle prevention;
- final posting and fiscal/content revalidation;
- draft-only ordinary editability and controlled amendment;
- reversal replay/double-reversal/replacement lineage;
- lifecycle command/query/DTO contracts;
- granular lifecycle permission and self-approval rules;
- migration 14 registration and Phase 13 Draft upgrade;
- lifecycle evidence schema and protective indexes;
- persisted lifecycle-status rehydration boundary;
- optimistic lifecycle update SQL;
- atomic Posting, Amendment, Reversal, and Approval-session adapter behavior.

The exhaustive Domain/Application matrix remains Step 15 and the full persistence/permission/desktop regression matrix remains Step 16.

## Validation

Focused local validation commands after Step 11 are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/desktop test
```

Step 10 desktop validation is confirmed green from the user's local environment after commit `e9bae35ddfde307f752a287199bbe7b22bfcf3f5`. Step 11 code and focused adapter tests are committed, but Step 11 runtime success is not claimed until these updated commands are executed locally or through CI.

## Documentation Impact

Phase 15 maintains the fixed plan, this implementation record, ADR-0015, security model, migration registration, and SQLite lifecycle adapter evidence as implementation progresses. Audit/integration, glossary, roadmap, changelog, and release documentation remain aligned with their scheduled steps.

## Related ADRs

- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md).
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md).
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md).
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md).
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md).
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](../adr/ADR-0009-platform-infrastructure-first.md).
- [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md).

## Step 2 Evidence

- Accepted ADR-0015 and fixed lifecycle/approval ownership, approval/posting separation, immutability, reversal lineage, concurrency, and portability semantics.

## Step 3 Evidence

- Added the five-state Journal Domain model, deterministic transitions, immutable transition evidence, and focused Domain tests.

## Step 4 Evidence

- Reused the generic Approval subsystem and added atomic Journal/Approval orchestration contracts.

## Step 5 Evidence

- Added authoritative final posting and immutable posting evidence. User confirmed the Step 5 focused local Accounting typecheck/tests pass.

## Step 6 Evidence

- Added complete draft-only locking policy and controlled approved-to-draft amendment with traceable evidence.

## Step 7 Evidence

- Added separate inverse posted reversal, durable idempotency, double-reversal prevention, and explicit replacement lineage.

## Step 8 Evidence

- Added canonical lifecycle commands, handlers, reader/query contracts, stable errors, lifecycle DTOs, and list status projection without transport/persistence coupling.

## Step 9 Evidence

- Added eight granular lifecycle permissions, Application-boundary authorization, default self-approval prohibition, stable authorization errors, and focused permission/SoD tests.

## Step 10 Evidence

- Added and registered `0014_journal_lifecycle.sql`.
- Added additive `lifecycle_status` with the five-state relational constraint and deterministic Draft upgrade behavior.
- Added durable Approval-cycle, posting, amendment, and reversal-lineage tables with foreign keys, checks, unique constraints, and query indexes.
- Added migration tests and recorded the user's local correction/green validation commit `e9bae35ddfde307f752a287199bbe7b22bfcf3f5`.

## Step 11 Evidence

- Added persisted lifecycle status rehydration and separated the Phase 13 legacy status column from the authoritative Phase 15 lifecycle column.
- Added expected-version SQLite CAS for lifecycle transitions.
- Added SQLite Approval, Posting, Amendment, and Reversal Unit of Work adapters over the shared database transaction contract.
- Added same-session Approval gateway factory integration and Approval-cycle UPSERT behavior.
- Added atomic posting evidence, amendment evidence, reversal voucher/lineage persistence, and durable lifecycle trace reader.
- Added focused Accounting Tauri lifecycle transaction tests and the explicit `@argin/audit` adapter dependency.
- Preserved event publication as Step 12 post-commit work rather than emitting integration events inside the database transaction.

## Exit Criteria

Phase 15 is complete only when:

- the fixed 18-step plan is satisfied or an explicit approved Change Request records any change,
- lifecycle rules are enforced outside UI,
- posted accounting facts are audit-safe,
- approval/posting/reversal flows are atomic and concurrency-safe,
- required permissions and audit evidence are present,
- migration and adapter behavior are validated,
- desktop lifecycle UX follows project UI standards,
- documentation obligations are complete,
- phase is merged and semantically released.

## Next Phase

Phase 16 — Accounting Reports.
