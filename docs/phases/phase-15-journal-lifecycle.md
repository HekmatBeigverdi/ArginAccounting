# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, reversal, authorization, persistence, and traceability while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 10 — Migration and Lifecycle Persistence Model — Completed**.

Next step: **Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency**.

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

Steps 4–9 provide approval integration, final posting, controlled amendment, reversal/lineage, canonical Application contracts, and explicit authorization/segregation. Step 10 now adds the durable relational model needed for lifecycle state and evidence without prematurely implementing the SQLite repositories that consume it.

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

State-policy capabilities answer what the lifecycle state allows; user authorization is a separate concern resolved by Step 9.

## Authorization, Permissions, and Segregation of Duties

Step 9 adds dedicated permissions for submit, approve, reject, return-to-draft, cancel approval, post, controlled amendment, and reversal. These permissions are registered in the Security default permission catalog and enforced at the Application boundary before lifecycle business execution.

The default segregation policy prohibits self-approval for the active Approval cycle while avoiding unsupported mandatory separation for poster/reverser in small organizations. Stable failures distinguish missing permission from segregation-of-duties violation.

## Data and Migrations

Step 10 adds `apps/desktop/src-tauri/migrations/0014_journal_lifecycle.sql`, registered as migration version 14 (`journal_lifecycle`) in the Tauri SQL migration runner.

The Phase 13 table has a legacy `status` constraint fixed to `draft`. Rather than rebuilding `journal_vouchers` and risking child foreign-key rewrites during upgrade, the Phase 15 migration is additive and introduces:

- `lifecycle_status` on `journal_vouchers` as the authoritative lifecycle persistence column;
- a CHECK constraint limited to `draft`, `pending_approval`, `approved`, `posted`, and `reversed`;
- a company/status/date index for lifecycle list and workspace queries.

Existing Phase 13 rows receive `lifecycle_status = 'draft'` by default. Their ids, numbers, lines, dimensions, totals, timestamps, request ids, and optimistic versions are not rewritten.

Lifecycle evidence is stored in dedicated relational tables:

- `journal_voucher_approval_cycles`: Approval linkage, submitted-content version, current/closed state, and history;
- `journal_voucher_posting_evidence`: one durable posting record per voucher with Approval/version/actor/time/reference evidence;
- `journal_voucher_amendment_evidence`: append-only controlled-amendment history keyed by voucher/reopened version;
- `journal_voucher_reversal_lineage`: unique original/reversal linkage, optional replacement, company/request idempotency key, actor/time/reason.

Protective relational rules include:

- one current Approval cycle per voucher through a partial unique index;
- one posting-evidence row per voucher;
- deterministic amendment version progression;
- unique original and reversal identities in reversal lineage;
- unique `(company_id, request_id)` reversal replay key;
- same-company foreign keys to Journal Vouchers;
- bounded actor/reference/reason/request fields and distinct-identity checks;
- indexes for Approval history, posting evidence, latest amendment, lifecycle status, and replacement lineage.

Concrete expected-version SQL updates, transaction composition, repository mapping to `lifecycle_status`, and retry execution remain Step 11.

## Security

Authorization is deny-by-default at the Application boundary. UI gates are usability only. Granular lifecycle permissions are independently assignable and the default self-approval prohibition is enforced from current Approval evidence rather than client state.

The canonical security documentation is maintained in `docs/security/security-model.md`.

## UI

Later lifecycle UI consumes state-policy capabilities and permission-aware Application results; it does not reproduce authorization or persistence rules in React/Tauri.

## Testing

Focused coverage through Step 10 includes:

- Domain lifecycle legal/illegal paths;
- Approval integration and duplicate-cycle prevention;
- final posting and fiscal/content revalidation;
- draft-only ordinary editability and controlled amendment;
- reversal replay/double-reversal/replacement lineage;
- lifecycle command/query/DTO contracts;
- granular lifecycle permission and self-approval rules;
- migration 14 registration in the desktop runner;
- upgrade of existing Phase 13 Draft vouchers to `lifecycle_status = 'draft'` without data loss;
- enforcement of the five allowed lifecycle states;
- creation of lifecycle evidence tables and protective indexes.

The exhaustive Domain/Application matrix remains Step 15 and the full migration/repository regression suite remains Step 16.

## Validation

Focused local validation commands are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/desktop test
```

Step 5 validation is confirmed from the user's local environment. Step 6–10 code and focused tests are committed; runtime success for the updated Step 10 branch is not claimed until it is executed locally or through CI.

## Documentation Impact

Phase 15 maintains the fixed plan, this implementation record, ADR-0015, security model, migration registration, and persistence-model evidence as implementation progresses. Audit/integration, glossary, roadmap, changelog, and release documentation remain aligned with their scheduled steps.

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
- Added migration tests for registration, Phase 13 upgrade, lifecycle-state validation, and schema/index creation.
- Kept Repository/UoW/concurrency/idempotent execution in Step 11.

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
