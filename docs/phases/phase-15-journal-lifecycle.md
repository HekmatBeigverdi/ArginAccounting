# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 6 — Locking and Controlled Amendment Policy — Completed**.

Next step: **Step 7 — Reversal and Replacement Lineage**.

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

Step 4 integrates the Journal lifecycle with reusable `@argin/audit` Approval contracts. Step 5 adds authoritative final posting while preserving approval/posting separation. Step 6 now makes editability explicit: only `draft` is ordinarily editable; `approved` can return to `draft` only through controlled amendment; `pending_approval`, `posted`, and `reversed` remain locked against ordinary mutation.

## Domain Model

The authoritative `JournalVoucherStatus` states are:

- `draft`
- `pending_approval`
- `approved`
- `posted`
- `reversed`

`packages/accounting/src/domain/journal-voucher-lifecycle.ts` owns deterministic state transitions. Every successful transition increments optimistic `version`, normalizes occurrence time to ISO UTC, records actor identity, and returns immutable transition evidence.

## Approval Integration

`packages/accounting/src/application/journal-voucher-approval-integration.ts` reuses Phase 08 Approval contracts and fixes the request/target discriminator as `accounting.journal-voucher`.

Submission records `submittedContentVersion` before the Journal `draft -> pending_approval` transition. Approval then moves `pending_approval -> approved`. Reject/return/cancel close the current cycle and return the Journal to `draft`; resubmission creates a new approval cycle.

Approved cycles remain current for posting evidence. Company, branch, fiscal-year, target identity, and Approval status must all match the Journal.

## Final Posting Policy

Step 5 adds `packages/accounting/src/application/journal-voucher-posting.ts`.

`postJournalVoucher` requires company ownership, expected version, exact `approved` state, current matching approved Approval evidence, exact submitted-content version, current balance/account/dimension validity, and an open matching fiscal year/period immediately before posting.

Successful posting creates immutable posting evidence containing voucher id, approval request id, submitted content version, posted version, posting actor, canonical ISO posting time, and optional normalized posting reference.

## Locking and Controlled Amendment

Step 6 adds `packages/accounting/src/application/journal-voucher-locking.ts` as the persistence-neutral editability and amendment policy.

Ordinary edit/delete policy is now explicit:

- `draft`: editable and deletable through normal Draft commands;
- `pending_approval`: locked while approval is pending;
- `approved`: locked against ordinary mutation;
- `posted`: immutable accounting facts;
- `reversed`: immutable accounting facts.

`updateJournalVoucherDraft` and `deleteJournalVoucherDraft` now call `assertJournalVoucherDraftEditable` before expensive validation and again inside the Unit of Work, so a stale/legacy client cannot mutate a voucher that moved out of Draft between reads.

Controlled pre-post amendment is implemented by `reopenApprovedJournalVoucherForAmendment` and is intentionally separate from ordinary Draft editing. It requires:

- company ownership;
- matching expected version;
- current Journal state exactly `approved`;
- a current Approval cycle;
- a real user actor id;
- a non-empty normalized amendment reason.

A successful controlled amendment executes `approved -> draft`, increments Journal version, closes the current Approval cycle so the old approval is historical only, and records immutable amendment evidence containing voucher id, approval request id, previous/reopened versions, actor, timestamp, and reason. Any subsequent approval requires a new Approval cycle.

No controlled amendment exists for `posted` or `reversed`; corrections to posted accounting facts remain reversal/replacement work owned by Step 7.

## Data and Migrations

Persistence of lifecycle state, approval-cycle linkage, posting evidence, controlled-amendment evidence, reversal lineage, and idempotency remains Steps 10 and 11 scope.

Existing Phase 13 Draft vouchers must upgrade without data loss and receive `draft` as their deterministic lifecycle state.

## Security

Actor evidence is retained for posting and controlled amendment, but lifecycle permissions and segregation-of-duties policy remain Step 9 scope. UI visibility is never treated as authorization or transition authority.

## UI

The Journal Voucher workspace will display persisted lifecycle status, allowed actions, confirmations, and approval/posting/reversal traceability using the canonical Phase 14 RTL design system in later UI steps.

## Testing

Focused coverage through Step 6 includes:

- Domain lifecycle legal/illegal paths;
- submit/approve/reject/return/cancel Approval integration;
- duplicate current Approval-cycle prevention;
- valid final posting with current exact approval evidence;
- fiscal-state revalidation immediately before posting;
- stale approval/content-version rejection;
- ordinary editability only in `draft`;
- lock reasons for `pending_approval`, `approved`, `posted`, and `reversed`;
- controlled `approved -> draft` amendment with approval-cycle closure and evidence;
- rejection of controlled amendment without approved state/current cycle/reason.

The exhaustive Domain/Application matrix remains Step 15 scope.

## Validation

Focused local validation commands are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

Step 5 validation is confirmed from the user's local environment: both focused Accounting typecheck and test commands completed successfully after pulling the Step 5 branch state.

Step 6 code and focused tests are committed; Step 6 runtime success is not falsely claimed until the updated branch is run locally or through CI.

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

- Reused the Phase 08 generic Approval model rather than duplicating it.
- Added the Journal/Approval Application orchestration boundary with strict target/scope matching.
- Added submit, approve, reject, return-to-draft, cancel, resubmission-cycle, and current-approval semantics.
- Defined an atomic Journal + Approval + cycle-link Unit of Work contract for the later adapter step.

## Step 5 Evidence

- Added the Final Posting Application boundary and posting evidence contract.
- Required exact approved/current approval/content-version/fiscal/account/dimension validity before final posting.
- Wired final-state immutability into existing Draft update/delete paths.
- Added focused posting and immutable-facts tests.
- User confirmed local `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test` pass for the Step 5 branch state.

## Step 6 Evidence

- Added `journal-voucher-locking.ts` with explicit draft-only editability and deterministic lock reasons for every non-Draft lifecycle state.
- Replaced the earlier final-state-only mutation guard in ordinary Draft update/delete paths with `assertJournalVoucherDraftEditable`, checked both before validation and inside the Unit of Work.
- Added controlled amendment for approved-but-unposted vouchers through `reopenApprovedJournalVoucherForAmendment`.
- Controlled amendment requires expected version, current approval cycle, actor identity, and a normalized mandatory reason.
- Successful amendment closes the current Approval cycle, transitions `approved -> draft`, increments optimistic version, and records actor/time/reason/approval/version evidence.
- Posted and reversed vouchers have no amendment path; accounting correction remains reversal/replacement rather than in-place editing.
- Added focused `journal-voucher-locking.test.ts` coverage for state locks and controlled amendment paths.
- Exported locking/amendment contracts through `@argin/accounting/journal` without SQLite/Tauri/React/PostgreSQL/.NET coupling, preserving Argin Bridge portability.

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
