# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 5 — Final Posting Policy and Accounting Immutability — Completed**.

Next step: **Step 6 — Locking and Controlled Amendment Policy**.

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

Step 4 integrates the Journal lifecycle with the reusable `@argin/audit` Approval contracts. Step 5 adds authoritative final posting while preserving approval/posting separation: Approval never auto-posts a voucher.

## Domain Model

The authoritative `JournalVoucherStatus` states are:

- `draft`
- `pending_approval`
- `approved`
- `posted`
- `reversed`

`packages/accounting/src/domain/journal-voucher-lifecycle.ts` owns deterministic state transitions. Every successful transition increments optimistic `version`, normalizes occurrence time to ISO UTC, records actor identity, and returns immutable transition evidence.

Posted and reversed accounting facts are now explicitly protected from direct destructive mutation through the Application mutation path. Full editability/locking policy for the other non-Draft states is Step 6 scope.

## Approval Integration

`packages/accounting/src/application/journal-voucher-approval-integration.ts` reuses Phase 08 Approval contracts and fixes the request/target discriminator as `accounting.journal-voucher`.

Submission records `submittedContentVersion` before the Journal `draft -> pending_approval` transition. Approval then moves `pending_approval -> approved`. Reject/return/cancel close the current cycle and return the Journal to `draft`; resubmission creates a new approval cycle.

Approved cycles remain current for posting evidence. Company, branch, fiscal-year, target identity, and Approval status must all match the Journal.

## Final Posting Policy

Step 5 adds `packages/accounting/src/application/journal-voucher-posting.ts`.

`postJournalVoucher` requires all of the following before final posting:

- the Journal exists in the requested company scope;
- `expectedVersion` matches the current optimistic version;
- Journal state is exactly `approved`;
- a current matching Approval cycle exists;
- the referenced generic Approval Request exists and is `approved`;
- Approval target/company/branch/fiscal scope matches the Journal;
- the approved Journal version is exactly `submittedContentVersion + 2`, representing only the submit and approve lifecycle transitions after content submission;
- current double-entry totals remain balanced and effective;
- every referenced account still exists, belongs to the company, is active, subsidiary-level, and posting-enabled;
- current accounting-dimension policies/types/members still validate all line assignments;
- fiscal context is re-resolved immediately before posting, the same fiscal year/period identity is retained, and both remain open.

Only after these checks does the Domain execute `approved -> posted`.

Successful final posting produces immutable posting evidence containing:

- voucher id;
- approval request id;
- submitted content version;
- posted Journal version;
- posting actor;
- canonical ISO posting timestamp;
- optional normalized posting reference.

The posting/session contract makes the Journal state transition and posting evidence one persistence operation. Concrete SQLite persistence is intentionally deferred to Steps 10 and 11.

## Accounting Immutability

`assertJournalVoucherAccountingFactsMutable` rejects destructive accounting mutation for `posted` and `reversed` vouchers.

The existing `updateJournalVoucherDraft` and `deleteJournalVoucherDraft` paths now invoke this guard both before expensive validation and again inside their Unit of Work before write/delete. This protects finalized facts from stale or legacy clients even before the later UI/capability work exists.

Step 6 will expand the policy from final-state immutability to the complete lock/editability model for `pending_approval` and `approved`, including controlled pre-post amendment.

## Data and Migrations

Persistence of lifecycle state, approval-cycle linkage, posting evidence, controlled-amendment evidence, reversal lineage, and idempotency remains Steps 10 and 11 scope.

Existing Phase 13 Draft vouchers must upgrade without data loss and receive `draft` as their deterministic lifecycle state.

## Security

Posting actor identity is retained in posting evidence, but lifecycle permissions and segregation-of-duties policy remain Step 9 scope. UI visibility is never treated as authorization or transition authority.

## UI

The Journal Voucher workspace will display persisted lifecycle status, allowed actions, confirmations, and approval/posting/reversal traceability using the canonical Phase 14 RTL design system in later UI steps.

## Testing

Focused coverage through Step 5 includes:

- Domain lifecycle legal/illegal paths;
- submit/approve/reject/return/cancel Approval integration;
- duplicate current Approval-cycle prevention;
- valid final posting with current exact approval evidence;
- fiscal-state revalidation immediately before posting;
- stale approval/content-version rejection;
- immutability of `posted` and `reversed` accounting facts.

The exhaustive Domain/Application matrix remains Step 15 scope.

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

- Reused the Phase 08 generic Approval model rather than duplicating it.
- Added the Journal/Approval Application orchestration boundary with strict target/scope matching.
- Added submit, approve, reject, return-to-draft, cancel, resubmission-cycle, and current-approval semantics.
- Defined an atomic Journal + Approval + cycle-link Unit of Work contract for the later adapter step.

## Step 5 Evidence

- Added the Final Posting Application boundary and posting evidence contract.
- Required `approved` state, expected version, current approved Approval Request, exact submitted-content version, and strict Journal/Approval scope identity.
- Revalidated double-entry, accounts, dimensions, and fiscal eligibility immediately before posting.
- Re-resolved and matched the exact fiscal year/period and rejected non-open fiscal state.
- Added `posted` actor/time/reference/version evidence without transport or persistence coupling.
- Wired final-state immutability into existing Draft update/delete paths.
- Added focused posting and immutable-facts tests.
- Preserved Argin Bridge/PostgreSQL/.NET portability; SQLite evidence persistence remains Steps 10/11.

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
