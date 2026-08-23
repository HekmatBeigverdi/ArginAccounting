# Phase 15 — Journal Lifecycle — Fixed Implementation Plan

## Status

Approved baseline and implementation preparation started. This document is the canonical execution checklist for Phase 15.

## Governance Rule

This plan is frozen for the duration of Phase 15.

Before starting every step:

1. Read this document.
2. Read `docs/development/documentation-governance.md`.
3. Read `docs/development/github-publishing-workflow.md`.
4. Confirm the current branch and latest commit.
5. Confirm the previous step's exit criteria.
6. State the current step number, scope, expected files, and validation commands before implementation.
7. Update only status and evidence sections unless an explicit Change Request is approved.

A step may not be reordered, split, merged, removed, renamed, or materially expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver the complete controlled lifecycle for persisted Journal Vouchers introduced in Phase 13. Phase 15 adds deterministic state transitions, approval integration, final posting, locking/immutability rules, controlled amendment, reversal, authorization, optimistic concurrency, audit/integration evidence, and Persian RTL lifecycle actions while preserving double-entry integrity and keeping accounting reporting in Phase 16.

## Baseline

- Phase 14 — UI Foundation Consolidation is completed, merged, and released as `v0.14.0`.
- `main` identifies Phase 15 — Journal Lifecycle as the current target.
- Phase 13 Journal Voucher Engine provides persisted Draft vouchers, lines, numbering, dimension validation, account/fiscal validation, permissions, audit/integration foundations, SQLite persistence, and desktop entry surfaces.
- Phase 08 provides the reusable audit and approval foundation that Phase 15 must integrate with rather than duplicate.
- Phase 09 provides Unit of Work, optimistic concurrency, idempotency, event, notification, and shared infrastructure contracts relevant to lifecycle commands.
- Phase 14 provides the canonical Persian RTL desktop design system and global display-density contract.

## Scope Boundaries

### Included

- Journal lifecycle state model and transition policy.
- Submit-for-approval, approve, reject/return, post, and reversal workflows as allowed by the final lifecycle policy.
- Final posting validation and immutable posted accounting facts.
- Voucher locking and controlled amendment rules.
- Reversal/replacement lineage and traceability.
- Approval Workflow integration using existing Phase 08 infrastructure.
- Application commands, queries, DTOs, authorization, concurrency, and idempotency contracts.
- Versioned SQLite migration and repository support for lifecycle state/evidence.
- Atomic Unit of Work behavior for multi-write lifecycle operations.
- Audit events, integration events, correlation/causation metadata, and user-facing notifications where applicable.
- Persian RTL lifecycle status, actions, confirmation/error states, and traceability UI.
- Domain, Application, persistence, migration, authorization, UI/regression, and full monorepo validation.
- Canonical documentation, ADR, glossary, changelog, roadmap/status, and release evidence.

### Excluded

- Trial Balance, General Ledger, Subsidiary Ledger, account statements, and other accounting reports; these belong to Phase 16.
- Automatic posting from Sales, Purchase, Inventory, Treasury, Payroll, Taxpayer, or other source modules.
- Posting Rules engine and source-document integrity introduced by later roadmap phases.
- PostgreSQL/.NET server implementation and synchronization.
- Multi-currency realized gain/loss processing.
- Editing accounting facts in-place after final posting when such changes would destroy auditability.
- UI-only shortcuts that bypass Domain/Application lifecycle policy.

## Lifecycle Design Principles

- Double-entry balance and Phase 13 account/dimension/fiscal invariants remain mandatory at final posting.
- Posted accounting facts are append-only from an audit perspective; correction is performed through explicit controlled workflows, not silent mutation.
- Every transition is validated in Domain/Application code and never trusted to React/Tauri presentation state.
- Approval state and accounting posting state must remain explicit and must not be inferred from button visibility.
- Multi-write transitions are atomic.
- Commands that can be retried must be idempotent where duplicate execution could create duplicate accounting or approval effects.
- Optimistic concurrency must prevent stale clients from overwriting newer lifecycle state.
- Correlation, causation, actor, timestamp, and source metadata must be retained for audit and future synchronization.
- Durable dates/timestamps remain Gregorian ISO internally; Persian UI presents Solar Hijri according to project conventions.
- Iranian Rial remains the default accounting presentation currency.
- Domain/Application layers remain independent from React, Tauri, SQLite, PostgreSQL, and transport protocols.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Lifecycle Domain Analysis and ADR | Completed |
| 3 | Journal State Model and Transition Invariants | Completed |
| 4 | Approval Workflow Integration | Completed |
| 5 | Final Posting Policy and Accounting Immutability | Completed |
| 6 | Locking and Controlled Amendment Policy | Completed |
| 7 | Reversal and Replacement Lineage | Not started |
| 8 | Application Contracts, Commands, and Queries | Not started |
| 9 | Authorization, Permissions, and Segregation of Duties | Not started |
| 10 | Migration and Lifecycle Persistence Model | Not started |
| 11 | SQLite Repository, Unit of Work, Concurrency, and Idempotency | Not started |
| 12 | Audit, Integration Events, and Notifications | Not started |
| 13 | Persian RTL Lifecycle Status and Action UI | Not started |
| 14 | Posting, Reversal, Traceability, and Failure UX | Not started |
| 15 | Domain and Application Test Matrix | Not started |
| 16 | Repository, Migration, Permission, and Desktop Regression Tests | Not started |
| 17 | Monorepo Validation and Documentation Completion | Not started |
| 18 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze

- Verify Phase 14 is completed, merged to `main`, and released as `v0.14.0`.
- Verify `ROADMAP.md` identifies Phase 15 — Journal Lifecycle as the current target.
- Create `phase/15-journal-lifecycle` from current `main`.
- Record dependencies, scope boundaries, governance rules, and fixed execution sequence.
- Create the Phase 15 implementation record before business implementation begins.

Exit criteria:

- Branch starts from the released Phase 14 baseline.
- Fixed implementation plan is committed on the Phase 15 branch.
- Phase record exists and identifies Step 1 as completed.
- No Journal Lifecycle production behavior is introduced in Step 1.

Status: Completed

Evidence:

- `main` records Phase 14 as completed and released as `v0.14.0` and Phase 15 as the current target.
- `phase/15-journal-lifecycle` was created from `main` on 2026-08-22.
- This fixed plan establishes the immutable 18-step execution sequence.

### Step 2 — Lifecycle Domain Analysis and ADR

- Reconcile Phase 13 Journal Voucher architecture with Phase 08 Approval, Phase 09 concurrency/idempotency/event infrastructure, fiscal locking rules, and Phase 14 presentation conventions.
- Define the lifecycle aggregate boundary and authoritative ownership of state transitions.
- Define allowed/rejected transition graph, command preconditions, failure semantics, actor requirements, and audit evidence.
- Define approval-versus-posting semantics and rejected alternatives.
- Add the Phase 15 lifecycle ADR.

Exit criteria:

- State ownership, transition semantics, approval relationship, and portability constraints are unambiguous.
- ADR is accepted before lifecycle code is implemented.

Status: Completed

Evidence:

- Added and accepted `ADR-0015 — Journal Lifecycle Architecture` before any production lifecycle implementation.
- Fixed `JournalVoucher` as the authoritative owner of accounting lifecycle state while retaining the Phase 08 `ApprovalRequest` as the authoritative owner of approval state/history.
- Fixed the Journal lifecycle graph as `draft -> pending_approval -> approved -> posted -> reversed`; approval rejection/return/cancellation and controlled pre-post amendment return the voucher to `draft`.
- Fixed approval and posting as separate decisions; manual Journal posting in Phase 15 requires current approval for the exact unmodified voucher version.
- Fixed ordinary editing to `draft` only. `pending_approval`, `approved`, `posted`, and `reversed` are locked against ordinary mutation; posted/reversed accounting facts are immutable.
- Fixed reversal as a separate balanced inverse voucher with durable original/reversal lineage and atomic transition of the original to `reversed`; in-place mutation of posted lines is prohibited.
- Defined expected-version concurrency, durable idempotency for retry-sensitive commands, atomic Journal/Approval coordination, post-commit event publication, audit evidence, stable failure semantics, final fiscal revalidation, and future PostgreSQL/.NET portability constraints.
- Updated the Phase 15 implementation record and ADR registry to reflect the accepted architecture.

### Step 3 — Journal State Model and Transition Invariants

- Implement the lifecycle state/value model selected in Step 2.
- Encode legal transitions and terminal/non-terminal state behavior in Domain code.
- Reject invalid transitions deterministically regardless of UI state.
- Preserve version/timestamp/actor evidence required by later persistence and audit steps.

Exit criteria:

- Legal transitions succeed and illegal transitions fail through focused Domain tests.
- No transition can bypass aggregate invariants.

Status: Completed

Evidence:

- Expanded the authoritative `JournalVoucherStatus` aggregate type to `draft`, `pending_approval`, `approved`, `posted`, and `reversed`, while new vouchers still originate only as `draft`.
- Added `packages/accounting/src/domain/journal-voucher-lifecycle.ts` with the ADR-0015 transition table and persistence-neutral Domain APIs.
- Implemented legal transition discovery/checking and immutable execution through `getAllowedJournalVoucherLifecycleActions`, `canTransitionJournalVoucher`, and `transitionJournalVoucher`.
- Successful transitions increment optimistic version, update canonical ISO occurrence time, and return immutable actor/time/previous-state/new-state/previous-version/new-version evidence.
- Illegal transitions, missing/oversized actor identity, invalid timestamps, and version overflow fail deterministically through `JournalVoucherLifecycleError` without mutating the original aggregate.
- Added focused Domain coverage in `packages/accounting/tests/journal-voucher-lifecycle.test.ts` for the accepted happy path, terminal reversal, reject/return/cancel paths, controlled reopen, illegal transitions, version evidence, actor evidence, and timestamp validation.
- Exported the lifecycle model through `@argin/accounting/journal` with no React, Tauri, SQLite, PostgreSQL, HTTP, or .NET coupling, preserving Argin Bridge portability.

### Step 4 — Approval Workflow Integration

- Integrate Journal Voucher lifecycle with the existing generic Approval Workflow foundation.
- Define submit, approve, reject/return, cancellation, resubmission, and approval evidence semantics as selected by the ADR.
- Prevent duplicate approval implementations inside Accounting.
- Define behavior when approval is disabled/not required by policy, if supported by existing architecture.

Exit criteria:

- Approval lifecycle is expressed through existing reusable contracts.
- Journal state and approval state cannot drift into contradictory persisted conditions.

Status: Completed

Evidence:

- Added `@argin/audit` as an explicit workspace dependency of `@argin/accounting` and reused the Phase 08 `ApprovalRequest`, `ApprovalActor`, `ApprovalTarget`, `ApprovalScope`, and status semantics rather than introducing an Accounting-specific approval state machine.
- Added `packages/accounting/src/application/journal-voucher-approval-integration.ts` as the Application orchestration boundary between the Journal lifecycle and generic Approval subsystem.
- Fixed the Approval request/target discriminator as `accounting.journal-voucher` and requires company, branch, fiscal-year, and voucher identity to match before a Journal state transition is accepted.
- `submitJournalVoucherForApproval` coordinates generic Approval creation/submission with Journal `draft -> pending_approval`, records the submitted content version, and prevents a second current approval cycle.
- `decideJournalVoucherApproval` maps generic Approval outcomes deterministically: `approved -> approved`, `rejected -> draft`, `return-to-draft -> draft`, and `cancelled -> draft` on the Journal lifecycle.
- Rejection, return, and cancellation close the current Journal approval cycle. Any later resubmission therefore creates a new cycle/request instead of treating historical approval evidence as current authorization for changed content.
- An approved cycle remains current so Step 5 can require it as explicit posting evidence through `assertCurrentApprovalForPosting`; Approval does not auto-post the voucher.
- Defined `JournalVoucherApprovalUnitOfWork`/session contracts so Journal state, Approval mutation, and approval-cycle linkage execute inside one atomic boundary. The SQLite implementation of this combined boundary remains Step 11 work.
- Added focused tests in `packages/accounting/tests/journal-voucher-approval-integration.test.ts`.

### Step 5 — Final Posting Policy and Accounting Immutability

- Define and implement final posting preconditions.
- Re-run authoritative balance, account, dimension, fiscal, and eligibility checks immediately before posting.
- Define posted timestamp, actor, posting reference/evidence, and immutable accounting fields.
- Prevent destructive update/delete operations after posting.

Exit criteria:

- Only eligible vouchers can become finally posted.
- Posted accounting facts cannot be silently mutated or deleted.

Status: Completed

Evidence:

- Added `packages/accounting/src/application/journal-voucher-posting.ts` as the persistence-neutral Final Posting policy/orchestration boundary.
- `postJournalVoucher` requires company ownership, expected-version match, Journal state `approved`, a current matching Approval Request, and exact submitted-content version evidence before any posting transition is accepted.
- Final posting re-resolves the fiscal context immediately before commit and requires the resolved fiscal year/period identity to match the voucher; closed/closing/locked fiscal state therefore blocks posting even when the voucher was valid earlier.
- Final posting revalidates double-entry balance/minimum effective structure, current account existence/company/status/level/postability, and current accounting-dimension policies/types/members.
- Successful posting executes the Domain `approved -> posted` transition and creates immutable posting evidence containing voucher id, approval request id, submitted content version, posted version, posting actor, canonical ISO posting time, and optional normalized posting reference.
- Added focused posting/immutability tests.
- User confirmed local `pnpm --filter @argin/accounting typecheck` and `pnpm --filter @argin/accounting test` completed successfully for the Step 5 branch state.

### Step 6 — Locking and Controlled Amendment Policy

- Define locking rules for vouchers in approval/posting-related states.
- Define whether and how unposted vouchers can return to an editable state.
- Implement controlled amendment semantics without weakening audit history.
- Explicitly prevent direct mutation of immutable posted facts.

Exit criteria:

- Editability is derived from lifecycle policy, not UI assumptions.
- Every amendment path is traceable and covered by Domain/Application tests.

Status: Completed

Evidence:

- Added `packages/accounting/src/application/journal-voucher-locking.ts` with explicit draft-only editability and deterministic lock reasons for `pending_approval`, `approved`, `posted`, and `reversed`.
- Wired `assertJournalVoucherDraftEditable` into existing Draft update/delete paths both before expensive validation and again inside the Unit of Work, preventing stale or legacy clients from mutating a voucher after it leaves Draft.
- Added `reopenApprovedJournalVoucherForAmendment` as the sole controlled pre-post amendment path from `approved -> draft`.
- Controlled amendment requires company ownership, matching expected version, exact `approved` state, a current Approval cycle, a user actor id, and a mandatory normalized reason.
- Successful amendment closes the current Approval cycle so the previous approval becomes historical-only, increments Journal version through the Domain transition, and records immutable voucher/approval/version/actor/time/reason evidence.
- `posted` and `reversed` have no amendment path and remain protected from in-place accounting mutation; correction is deferred to reversal/replacement in Step 7.
- Added `packages/accounting/tests/journal-voucher-locking.test.ts` covering draft-only editability, lock reasons, successful controlled amendment, approval-cycle closure, amendment evidence, and required preconditions.
- Exported locking/amendment contracts through `@argin/accounting/journal` without React/Tauri/SQLite/PostgreSQL/.NET coupling, preserving Argin Bridge portability.
- Step 6 focused runtime success is not claimed until the updated branch is executed locally or through CI.

### Step 7 — Reversal and Replacement Lineage

- Implement explicit reversal semantics for posted vouchers according to the ADR.
- Preserve original voucher identity and create durable lineage between original, reversal, and replacement/correcting voucher when applicable.
- Prevent double reversal and invalid reversal chains.
- Preserve original accounting facts unchanged.

Exit criteria:

- Reversal is audit-safe, deterministic, balanced, and idempotent against retry.
- Original/reversal lineage is queryable without reconstructing it from descriptions.

Status: Not started

### Step 8 — Application Contracts, Commands, and Queries

- Define persistence-neutral lifecycle repositories/services and DTO contracts.
- Add lifecycle commands and queries required by the approved state model.
- Define stable Application error codes suitable for Persian presentation.
- Carry request/idempotency, correlation, causation, expected-version, and actor metadata where required.

Exit criteria:

- Application contracts support SQLite now and future PostgreSQL/API adapters without transport coupling.
- All lifecycle mutations pass through explicit command handlers/services.

Status: Not started

### Step 9 — Authorization, Permissions, and Segregation of Duties

- Define granular permissions for submit, approve, reject/return, post, reverse, and controlled amendment operations as applicable.
- Enforce permissions at the Application boundary.
- Define any required segregation-of-duties rule, especially around creator/approver/poster combinations, based on existing project policy.
- Record denied operations in audit evidence where appropriate.

Exit criteria:

- UI visibility is not relied upon for security.
- Permission and actor-policy failures are deterministic and test-covered.

Status: Not started

### Step 10 — Migration and Lifecycle Persistence Model

- Add versioned migration(s) for lifecycle state, approval/posting evidence, lock/amendment metadata, reversal lineage, and idempotency/concurrency fields required by the approved design.
- Add constraints and indexes that protect legal persisted states and common lifecycle queries where relational enforcement is appropriate.
- Preserve migration portability and rollback/upgrade safety according to repository policy.

Exit criteria:

- Clean database and upgrade-from-Phase-14/13 data paths are deterministic.
- Existing Draft vouchers migrate to the correct initial lifecycle state without data loss.

Status: Not started

### Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency

- Persist lifecycle transitions and evidence through SQLite adapters.
- Ensure multi-write lifecycle operations are atomic.
- Use optimistic concurrency/expected version to reject stale transitions.
- Ensure retry-safe lifecycle commands cannot duplicate posting, approval, reversal, or event effects.
- Verify post-commit event publication ordering.

Exit criteria:

- Concurrent and retried lifecycle commands preserve a single valid accounting outcome.
- Failure before commit leaves no partial lifecycle state.

Status: Not started

### Step 12 — Audit, Integration Events, and Notifications

- Emit durable audit evidence for each lifecycle transition.
- Define post-commit integration events with stable payload/version semantics.
- Include actor, company/branch, voucher, transition, correlation, causation, and relevant lineage identifiers.
- Add user notifications only where they provide operational value and fit existing notification architecture.

Exit criteria:

- Every meaningful transition is reconstructable from audit evidence.
- Integration events are emitted only after successful commit.

Status: Not started

### Step 13 — Persian RTL Lifecycle Status and Action UI

- Extend Journal Voucher list/detail/editor surfaces with canonical lifecycle status presentation.
- Add context-sensitive actions based on Application-provided capability/permission state rather than duplicated business rules.
- Add Persian confirmations for consequential actions.
- Preserve compact desktop density, keyboard accessibility, RTL behavior, loading/empty/error states, and Solar Hijri presentation.

Exit criteria:

- Users can understand current lifecycle state and permitted next actions without exposing technical implementation details.
- Presentation does not become the source of truth for transition validity.

Status: Not started

### Step 14 — Posting, Reversal, Traceability, and Failure UX

- Add posted/reversed traceability surfaces including actor/time/reference/lineage details.
- Provide clear Persian failure messages mapped from stable Application errors.
- Preserve separated technical diagnostics for support/debugging where project feedback standards require them.
- Ensure destructive/high-impact actions require deliberate confirmation and cannot be triggered accidentally by keyboard/navigation behavior.

Exit criteria:

- Posting/reversal history is understandable and navigable from the voucher workspace.
- Expected business rejections and unexpected technical failures are visually distinct.

Status: Not started

### Step 15 — Domain and Application Test Matrix

- Add exhaustive transition-table tests.
- Cover approval, posting validation, locking, controlled amendment, reversal, stale version, authorization, idempotent retry, and error mapping.
- Cover company/branch/fiscal scope and Phase 13 balance/account/dimension regressions.

Exit criteria:

- Domain/Application lifecycle behavior is comprehensively covered independent of SQLite and UI.

Status: Not started

### Step 16 — Repository, Migration, Permission, and Desktop Regression Tests

- Test clean/upgrade migrations and persisted lifecycle state/evidence.
- Test atomicity, uniqueness, expected-version behavior, retry/idempotency, and reversal lineage at the SQLite boundary.
- Test permission enforcement and denied transitions.
- Add desktop contract/regression tests for status/actions, confirmations, traceability, accessibility, RTL, and density.

Exit criteria:

- Persistence and desktop adapters cannot violate lifecycle contracts under covered scenarios.
- Existing Phase 13/14 regressions remain green.

Status: Not started

### Step 17 — Monorepo Validation and Documentation Completion

- Run focused package checks and the full monorepo lint/typecheck/test/build sequence required by repository policy.
- Run documentation-index generation/link verification and diff checks.
- Update Phase 15 implementation record, ADR, accounting architecture, permissions/security docs, migration docs, glossary, roadmap status, changelog, and release checklist as applicable.
- Record commands and actual results; do not claim unexecuted validation.

Exit criteria:

- Required validation is green with evidence recorded.
- Documentation Governance obligations for Phase 15 are satisfied.
- Phase 16 — Accounting Reports is clearly identified as the next target without implementing report behavior here.

Status: Not started

### Step 18 — Final Review, Merge, and Release

- Review delivered implementation against every fixed Phase 15 step and scope boundary.
- Resolve or explicitly document any approved deferrals.
- Merge through the repository's approved branch flow.
- Tag and publish the semantic Phase 15 release with release notes.
- Verify `main` and roadmap identify Phase 16 — Accounting Reports as the next target.

Exit criteria:

- Phase 15 is merged and released.
- Release evidence and documentation are consistent with the merged commit.
- No unresolved lifecycle-critical issue is silently carried forward.

Status: Not started

## Change Requests

None.

Any future change request must record:

- requested change,
- reason,
- affected fixed step(s),
- scope impact,
- approval decision,
- resulting plan/status update.
