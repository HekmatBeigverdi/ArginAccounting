# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 3 — Journal State Model and Transition Invariants — Completed**.

Next step: **Step 4 — Approval Workflow Integration**.

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

Step 2 accepted [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md). `JournalVoucher` remains the authoritative owner of accounting lifecycle state, while the generic Phase 08 `ApprovalRequest` remains a separate reusable aggregate and authoritative owner of approval history/state. Application orchestration coordinates the two atomically when one business action changes both.

The selected Journal lifecycle graph is:

```text
draft -> pending_approval -> approved -> posted -> reversed
            |                  |
            +----> draft <-----+
```

Return, rejection, or cancellation of the active approval cycle moves the Journal voucher from `pending_approval` back to `draft`. Reopening an approved but unposted voucher for amendment also returns it to `draft` and invalidates the previous approval for the modified content.

Approval and posting are explicitly separate decisions. An approved voucher is not posted until final posting validation and the posting command succeed. Manual Journal posting in Phase 15 requires current approval evidence for the exact unmodified voucher version.

Posted accounting lines are immutable. Correction is additive through a separate balanced reversal voucher with durable lineage; the original voucher transitions to `reversed` only atomically with the successful reversal write.

## Domain Model

Baseline concepts inherited from Phase 13:

- Journal Voucher aggregate.
- Journal Line entities.
- Company/Branch/Fiscal context.
- Balance/account/dimension invariants.
- Stable voucher numbering and source metadata.
- Optimistic versioning.

Step 3 promotes the lifecycle states directly into the `JournalVoucherStatus` aggregate type:

- `draft`
- `pending_approval`
- `approved`
- `posted`
- `reversed`

`packages/accounting/src/domain/journal-voucher-lifecycle.ts` implements the accepted transition table and exposes persistence-neutral Domain helpers for legal-action discovery, transition checking, and immutable state transition execution.

Every successful Domain transition increments the optimistic `version`, normalizes the occurrence timestamp to canonical ISO UTC, records actor identity, and returns immutable transition evidence containing previous/new state and previous/new version. Illegal transitions fail deterministically through `JournalVoucherLifecycleError` without changing the original voucher.

Ordinary content editing remains a later locking/Application concern; Step 3 only establishes authoritative state transition invariants. Persistence of non-Draft lifecycle state/evidence remains intentionally deferred to Steps 10 and 11.

## Application Services

Lifecycle operations are explicit Application commands. Domain code owns legal Journal state transitions; Application orchestration owns authorization, approval evidence, cross-aggregate coordination, final accounting validation, optimistic concurrency, idempotency, Unit of Work behavior, audit evidence, and post-commit integration events.

Stable Application failures will distinguish invalid transition, stale version, missing/non-current approval, locked voucher, posting validation failure, fiscal ineligibility, duplicate/already reversed conditions, permission denial, and idempotency conflict.

Cross-aggregate commands that update Journal and Approval state must not commit contradictory partial outcomes. Retried submission/posting/reversal operations must return the existing committed result rather than duplicate approval history, posting evidence, reversal vouchers, audit-success records, or success events.

## Data and Migrations

A versioned migration will be added only after the lifecycle model fixed by ADR-0015 is implemented in Domain/Application contracts. Existing Phase 13 Draft vouchers must upgrade without data loss and receive `draft` as their deterministic lifecycle state.

Lifecycle persistence will eventually include state/version evidence, active approval linkage, posting evidence, controlled-amendment evidence, durable reversal/replacement lineage, and idempotency data required by the accepted architecture.

## Security

Lifecycle actions will use granular permissions enforced at the Application boundary. The architecture records distinct submitting/requesting, approving, posting, amendment, and reversal actors.

ADR-0015 intentionally does not hard-code an organization-specific creator/approver/poster segregation rule; Step 9 will finalize that policy while retaining all actor evidence needed to enforce it deterministically.

## UI

The Journal Voucher workspace will display persisted lifecycle status, allowed actions, confirmations, and approval/posting/reversal traceability using the canonical Phase 14 RTL design system.

The UI does not determine transition validity. Capability/action availability must come from Application rules plus authorization context, and every command revalidates authoritative state/version even if UI capability data is stale.

## Testing

Step 3 adds focused Domain coverage for:

- the accepted happy path `draft -> pending_approval -> approved -> posted -> reversed`;
- terminal `reversed` behavior;
- reject/return/cancel paths back to `draft`;
- controlled reopen from `approved` to `draft`;
- deterministic rejection of illegal transitions independent of UI state;
- optimistic version increment;
- immutable actor/timestamp transition evidence;
- actor and occurrence-time validation.

The exhaustive Domain/Application transition matrix remains Step 15 scope.

## Validation

Focused validation commands for Step 3 are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

The connected execution environment could not reach `github.com` to clone the branch for runtime execution (`Could not resolve host: github.com`). Therefore this record does not falsely claim those commands were executed successfully here. The Domain implementation and focused tests are committed, and the same commands are provided for local verification.

## Documentation Impact

Phase 15 must maintain, as applicable:

- this implementation record,
- the fixed implementation plan,
- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md),
- accounting architecture/semantics,
- security/permissions documentation,
- database/migration documentation,
- glossary,
- `ROADMAP.md`,
- `CHANGELOG.md`,
- release documentation and checklist.

## Related ADRs

- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md) — accepted in Step 2 and authoritative for Phase 15 lifecycle semantics.
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md) — persisted Journal aggregate baseline.
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md) — reusable approval subsystem.
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md).
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md).
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](../adr/ADR-0009-platform-infrastructure-first.md).
- [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md).

## Step 2 Evidence

- Reconciled the Phase 13 Journal aggregate with Phase 08 Approval and Phase 09 concurrency/idempotency/event infrastructure.
- Fixed `JournalVoucher` as the sole owner of accounting lifecycle state and retained `ApprovalRequest` as the sole owner of approval state/history.
- Fixed the Journal state graph as `draft -> pending_approval -> approved -> posted -> reversed`, with reject/return/cancel and controlled pre-post amendment returning to `draft`.
- Fixed approval and posting as separate decisions; Phase 15 manual posting requires current approval for the exact voucher version.
- Fixed ordinary editability to `draft` only and posted/reversed accounting facts as immutable.
- Fixed reversal as a separate inverse balanced voucher with atomic durable lineage; no in-place mutation of the original posted lines is permitted.
- Fixed optimistic-concurrency, idempotency, atomic cross-aggregate coordination, post-commit event ordering, audit evidence, failure semantics, fiscal revalidation, and future PostgreSQL/.NET portability constraints.
- Added and accepted `docs/adr/ADR-0015-journal-lifecycle.md` before production lifecycle code is introduced.

## Step 3 Evidence

- Expanded `JournalVoucherStatus` from Draft-only to the five ADR-0015 lifecycle states while keeping new voucher creation deterministically `draft`.
- Added `journal-voucher-lifecycle.ts` with the authoritative Domain transition table.
- Added `transitionJournalVoucher`, `canTransitionJournalVoucher`, and `getAllowedJournalVoucherLifecycleActions` without React, Tauri, SQLite, PostgreSQL, HTTP, or .NET coupling.
- Successful transitions are immutable, increment optimistic version, update canonical occurrence time, and return actor/time/version/state evidence for later persistence and audit integration.
- Invalid state/action combinations fail with stable Domain lifecycle errors and do not mutate the original voucher.
- Added focused Domain tests in `journal-voucher-lifecycle.test.ts` for legal paths, illegal paths, terminal behavior, amendment return, versioning, actor evidence, and timestamp evidence.
- Exported the lifecycle Domain contract through `@argin/accounting/journal` for later Application and adapter steps.
- Runtime validation was not claimed because the execution environment could not resolve GitHub for a fresh checkout; local validation commands are recorded above.

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
