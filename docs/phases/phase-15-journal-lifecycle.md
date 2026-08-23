# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 4 — Approval Workflow Integration — Completed**.

Next step: **Step 5 — Final Posting Policy and Accounting Immutability**.

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

Step 4 implements the Application integration boundary using the existing `@argin/audit` Approval contracts. Accounting does not duplicate Approval states or transitions. Submission creates/submits a generic Approval Request and moves the Journal voucher to `pending_approval`; Approval decisions then drive the corresponding Journal transition.

Approval and posting remain separate decisions. An approved voucher is not posted until Step 5 final posting validation succeeds.

## Domain Model

Step 3 promotes the lifecycle states directly into the `JournalVoucherStatus` aggregate type:

- `draft`
- `pending_approval`
- `approved`
- `posted`
- `reversed`

`packages/accounting/src/domain/journal-voucher-lifecycle.ts` implements the accepted transition table and persistence-neutral Domain helpers.

Every successful Domain transition increments optimistic `version`, normalizes occurrence time to ISO UTC, records actor identity, and returns immutable transition evidence. Illegal transitions fail deterministically without mutating the source voucher.

## Application Services

Step 4 adds `packages/accounting/src/application/journal-voucher-approval-integration.ts`.

The integration reuses Phase 08 types from `@argin/audit`, including `ApprovalRequest`, `ApprovalActor`, `ApprovalTarget`, and `ApprovalScope`. The canonical request and target discriminator is `accounting.journal-voucher`.

`submitJournalVoucherForApproval`:

- requires the expected Journal version;
- rejects a second current approval cycle;
- creates/submits the generic Approval Request;
- validates voucher target/company/branch/fiscal scope;
- records the submitted content version;
- transitions Journal `draft -> pending_approval`.

`decideJournalVoucherApproval` maps generic Approval outcomes to Journal state:

- `approved -> approved`;
- `rejected -> draft`;
- `return-to-draft -> draft`;
- `cancelled -> draft`.

Reject/return/cancel close the current approval cycle. A later resubmission therefore creates a new Approval cycle instead of treating historical approval evidence as current authorization for changed content.

Approved cycles remain current and can be validated by `assertCurrentApprovalForPosting` in Step 5. Approval never automatically posts a Journal Voucher.

`JournalVoucherApprovalUnitOfWork` defines one atomic cross-aggregate transaction boundary for Journal state, generic Approval mutation, and approval-cycle linkage. The concrete SQLite implementation is intentionally deferred to Step 11; the Application contract prevents a design that intentionally commits contradictory partial Journal/Approval state.

No configurable approval-bypass policy is introduced because Phase 08 currently has no canonical bypass-policy contract. Manual Journal posting in Phase 15 therefore continues to require current approval evidence per ADR-0015.

## Data and Migrations

Persistence of lifecycle state, approval-cycle linkage, posting evidence, controlled-amendment evidence, reversal lineage, and idempotency remains Steps 10 and 11 scope.

Existing Phase 13 Draft vouchers must upgrade without data loss and receive `draft` as their deterministic lifecycle state.

## Security

Step 4 preserves Approval actor identity and Journal actor evidence but does not finalize lifecycle permissions or segregation-of-duties rules. Those remain Step 9 scope.

UI visibility is never treated as authorization or transition authority.

## UI

The Journal Voucher workspace will display persisted lifecycle status, allowed actions, confirmations, and approval/posting/reversal traceability using the canonical Phase 14 RTL design system in later UI steps.

## Testing

Focused coverage now includes:

- Domain lifecycle happy/illegal paths from Step 3;
- Journal submission through the shared Approval contract;
- approval decision mapping to Journal `approved`;
- rejection returning the Journal to `draft` and closing the cycle;
- prevention of a second current approval cycle.

The exhaustive Domain/Application transition matrix remains Step 15 scope.

## Validation

Focused local validation commands are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

Successful runtime validation is not claimed in this connected environment because package execution was not available here. The implementation and focused tests are committed for local verification.

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

- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md).
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md).
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md).
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md).
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md).
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](../adr/ADR-0009-platform-infrastructure-first.md).
- [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md).

## Step 2 Evidence

- Accepted ADR-0015 and fixed the lifecycle/approval ownership model.
- Fixed approval and posting as separate decisions and posted facts as immutable.

## Step 3 Evidence

- Added the five-state Journal Domain model and deterministic transition table.
- Added immutable transition evidence and focused Domain tests.
- Kept the Domain contract persistence/transport neutral for Argin Bridge portability.

## Step 4 Evidence

- Added `@argin/audit` as an Accounting workspace dependency and reused the Phase 08 generic Approval model rather than duplicating it.
- Added the Journal/Approval Application orchestration boundary with canonical request/target identity and strict company/branch/fiscal matching.
- Added submit, approve, reject, return-to-draft, and cancel integration semantics.
- Fixed resubmission to use a new approval cycle after reject/return/cancel.
- Added a combined atomic Unit of Work contract for Journal + Approval + cycle-link writes; concrete SQLite coordination remains Step 11.
- Added explicit current-approved-evidence validation for later posting.
- Added focused Approval integration tests.
- Preserved transport/persistence neutrality and Argin Bridge/PostgreSQL/.NET portability.

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
