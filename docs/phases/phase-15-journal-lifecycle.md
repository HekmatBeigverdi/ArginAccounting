# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, and reversal semantics while preserving auditability, concurrency safety, and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 8 — Application Contracts, Commands, and Queries — Completed**.

Next step: **Step 9 — Authorization, Permissions, and Segregation of Duties**.

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

Step 4 integrates the Journal lifecycle with reusable `@argin/audit` Approval contracts. Step 5 adds authoritative final posting while preserving approval/posting separation. Step 6 makes editability explicit. Step 7 completes post-publication correction semantics through a separate inverse voucher plus durable lineage; posted accounting facts are never rewritten in place. Step 8 now exposes those semantics through one canonical persistence-neutral Application command/query/DTO surface suitable for desktop consumers and future Argin Bridge/.NET API adapters.

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

Ordinary edit/delete policy is explicit:

- `draft`: editable and deletable through normal Draft commands;
- `pending_approval`: locked while approval is pending;
- `approved`: locked against ordinary mutation;
- `posted`: immutable accounting facts;
- `reversed`: immutable accounting facts.

`updateJournalVoucherDraft` and `deleteJournalVoucherDraft` call `assertJournalVoucherDraftEditable` before expensive validation and again inside the Unit of Work.

Controlled pre-post amendment is implemented by `reopenApprovedJournalVoucherForAmendment`. A successful amendment executes `approved -> draft`, increments Journal version, closes the current Approval cycle, and records immutable amendment evidence. No controlled amendment exists for `posted` or `reversed`.

## Reversal and Replacement Lineage

Step 7 adds `packages/accounting/src/application/journal-voucher-reversal.ts`.

`reverseJournalVoucher` is a dedicated compensating-posting operation. It requires original voucher ownership, matching expected version, exact `posted` state, durable request/idempotency id, actor identity, timestamp, reversal date, and reason.

The reversal date resolves its own fiscal context and revalidates current fiscal/account/dimension eligibility. A new Journal Voucher is generated with a new stable id and Number Series number. Its lines preserve order, account and dimension assignments while swapping debit and credit amounts, producing the inverse accounting effect of the original posted voucher.

The original voucher remains structurally unchanged and transitions only from `posted -> reversed`. The atomic persistence contract stores the transitioned original, new reversal voucher, and durable lineage together. Optional replacement linkage remains explicit and queryable.

## Application Contracts, Commands, and Queries

Step 8 adds `packages/accounting/src/application/journal-voucher-lifecycle-contracts.ts` as the canonical lifecycle Application contract.

`JournalVoucherLifecycleCommandContext` carries the portable command metadata needed across current desktop and future synchronized/server execution:

- actor id;
- company id;
- request/idempotency id;
- correlation id;
- causation id;
- occurrence timestamp.

Explicit canonical commands now exist for:

- submit for approval;
- approval decision;
- final posting;
- controlled amendment/reopen;
- reversal with optional replacement linkage.

Each mutation carries `expectedVersion` where required. Approval decisions additionally carry Approval expected version. Reversal obtains its durable retry key from the standard request id.

`packages/accounting/src/application/journal-voucher-lifecycle-command-handlers.ts` adapts these canonical commands to the Step 4–7 Application services. Presentation and transport code therefore no longer need to know the different internal service signatures.

Step 8 also adds `JournalVoucherLifecycleDto`, which exposes:

- persisted Journal state/version;
- state-policy capabilities;
- current Approval trace;
- posting evidence;
- latest controlled-amendment evidence;
- reversal/replacement lineage.

The capability set in Step 8 is intentionally state-policy-only. It answers what the lifecycle permits for the state, not whether the current user is authorized. Step 9 combines granular permissions and segregation-of-duties policy with these capabilities.

`packages/accounting/src/application/journal-voucher-lifecycle-queries.ts` defines a persistence-neutral reader and `getJournalVoucherLifecycle` query. SQLite readers are deferred to Steps 10/11.

`JournalVoucherListItemDto` now includes persisted `status`, so list/workspace surfaces can render lifecycle status without an extra detail query.

The stable `JournalVoucherLifecycleApplicationErrorCode` vocabulary covers invalid transition, lock, approval, posting, amendment, reversal, idempotency, authorization, concurrency, and persistence families. Persian presentation can map these stable codes later without parsing technical exception messages.

## Data and Migrations

Persistence of lifecycle state, approval-cycle linkage, posting evidence, controlled-amendment evidence, reversal lineage, idempotency, and lifecycle read models remains Steps 10 and 11 scope.

Existing Phase 13 Draft vouchers must upgrade without data loss and receive `draft` as their deterministic lifecycle state.

## Security

Actor evidence is retained for lifecycle commands. Step 8 state-policy capabilities are not authorization decisions. Granular permissions and segregation-of-duties policy remain Step 9 scope, and UI visibility is never treated as authorization authority.

## UI

The Journal Voucher workspace will consume the canonical lifecycle DTO/capability surface and later combine it with Step 9 authorization. Persian RTL lifecycle UI remains Steps 13 and 14 scope.

## Testing

Focused coverage through Step 8 includes:

- Domain lifecycle legal/illegal paths;
- Approval integration and duplicate-cycle prevention;
- final posting and fiscal/content revalidation;
- draft-only ordinary editability and controlled amendment;
- separate posted inverse reversal, replay, double-reversal prevention, and replacement lineage;
- persisted lifecycle status in Journal list projection;
- Draft lifecycle state-policy capabilities;
- approved current-Approval trace and pre-post actions;
- posted/reversed traceability and terminal capability behavior.

The exhaustive Domain/Application matrix remains Step 15 scope.

## Validation

Focused local validation commands are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

Step 5 validation is confirmed from the user's local environment: both focused Accounting typecheck and test commands completed successfully after pulling the Step 5 branch state.

Step 6–8 code and focused tests are committed; runtime success for the updated Step 8 branch is not claimed until it is executed locally or through CI.

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
- Added controlled amendment for approved-but-unposted vouchers with expected version, current approval cycle, actor identity, reason, cycle closure, and immutable amendment evidence.
- Posted and reversed vouchers have no amendment path.
- Added focused locking tests and exported persistence-neutral contracts.

## Step 7 Evidence

- Added `journal-voucher-reversal.ts` with posted-only reversal semantics, reversal-date revalidation, separate inverse posted Journal creation, atomic lineage, request-id replay/conflict handling, double-reversal prevention, and optional replacement linkage.
- Added focused reversal tests and exported persistence-neutral contracts suitable for Argin Bridge.

## Step 8 Evidence

- Added canonical lifecycle command context and explicit submit/decision/post/reopen/reverse command contracts.
- Added stable lifecycle Application error-code vocabulary suitable for Persian UI mapping and transport-neutral API contracts.
- Added explicit lifecycle command handlers over the Step 4–7 services so consumers do not couple to internal service signatures.
- Added persistence-neutral lifecycle reader/query contracts and the composite `JournalVoucherLifecycleDto` with approval/posting/amendment/reversal traceability.
- Kept lifecycle state capabilities separate from authorization so Step 9 can compose permission and segregation-of-duties rules without contaminating Domain state policy.
- Added lifecycle status to Journal list DTO/projection.
- Added focused lifecycle-contract/query tests.
- Exported the complete Step 8 surface through `@argin/accounting/journal` with no React, Tauri, SQLite, HTTP, PostgreSQL, or .NET coupling.

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
