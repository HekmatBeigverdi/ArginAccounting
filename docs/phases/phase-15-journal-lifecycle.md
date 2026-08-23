# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 1 — Baseline, Branch, and Plan Freeze — Completed**.

Next step: **Step 2 — Lifecycle Domain Analysis and ADR**.

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

Phase 15 extends the existing Journal Voucher aggregate and Application contracts rather than replacing them. Domain/Application code remains persistence- and presentation-independent. SQLite is the current adapter; future PostgreSQL/API implementations must be able to preserve the same lifecycle semantics.

The authoritative lifecycle transition graph and approval/posting relationship will be fixed in Step 2 through the Phase 15 ADR before production lifecycle behavior is implemented.

## Domain Model

Baseline concepts inherited from Phase 13:

- Journal Voucher aggregate.
- Journal Line entities.
- Company/Branch/Fiscal context.
- Balance/account/dimension invariants.
- Stable voucher numbering and source metadata.
- Optimistic versioning.

Phase 15 will add lifecycle state, transition evidence, locking/amendment semantics, posting evidence, and reversal/replacement lineage according to the accepted ADR.

## Application Services

Planned lifecycle operations include explicit command/query contracts for transition actions selected by the final lifecycle policy. All mutations will enforce authorization, expected version, accounting preconditions, atomicity, idempotency where required, and stable error contracts.

## Data and Migrations

A versioned migration will be added only after the lifecycle model is fixed. Existing Phase 13 Draft vouchers must upgrade without data loss and receive a deterministic valid lifecycle state.

## Security

Lifecycle actions will use granular permissions enforced at the Application boundary. Segregation-of-duties constraints will be evaluated explicitly in Step 9 and will not rely on UI visibility.

## UI

The Journal Voucher workspace will display lifecycle status, allowed actions, confirmations, traceability, and stable Persian business errors using the canonical Phase 14 RTL design system, compact density contract, keyboard/accessibility rules, and feedback-state primitives.

## Testing

Planned coverage:

- Domain transition matrix.
- Application lifecycle orchestration.
- Approval/posting/locking/amendment/reversal behavior.
- Permission and actor constraints.
- Concurrency and idempotent retry.
- Migration and SQLite persistence.
- Audit/integration evidence.
- Desktop status/action/traceability regressions.
- Full monorepo validation.

## Validation

Step 1 validates repository/phase baseline only. Production lifecycle validation begins with later implementation steps. Validation results must be recorded only after commands are actually executed.

## Documentation Impact

Phase 15 must maintain, as applicable:

- this implementation record,
- the fixed implementation plan,
- Phase 15 ADR,
- accounting architecture/semantics,
- security/permissions documentation,
- database/migration documentation,
- glossary,
- `ROADMAP.md`,
- `CHANGELOG.md`,
- release documentation and checklist.

## Related ADRs

- Existing Phase 13 Journal Voucher architecture ADR remains the voucher-engine baseline.
- Phase 15 lifecycle ADR: pending Step 2.

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
