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
- Phase 13 provides persisted Draft Journal Vouchers, numbering, validation, permissions, SQLite persistence, and desktop entry surfaces.
- Phase 08 provides reusable Audit and Approval foundations.
- Phase 09 provides Unit of Work, optimistic concurrency, idempotency, events, notifications, and shared infrastructure contracts.
- Phase 14 provides the canonical Persian RTL desktop design system and global display-density contract.

## Scope Boundaries

Included: Journal lifecycle state/policy, approval integration, posting, locking/amendment, reversal/replacement lineage, commands/queries/DTOs, authorization, SQLite persistence, atomicity/concurrency/idempotency, audit/integration events/notifications, Persian RTL lifecycle UX, validation, documentation, and release evidence.

Excluded: Accounting Reports, automatic posting from operational modules, later Posting Rules/Source Document Integrity work, PostgreSQL/.NET synchronization implementation, realized FX gain/loss processing, and destructive in-place mutation of final posted accounting facts.

## Lifecycle Design Principles

- Double-entry and account/dimension/fiscal invariants remain mandatory at final posting.
- Posted facts are append-only from an audit perspective.
- Domain/Application owns transition validity; UI never does.
- Approval and accounting posting remain explicit separate states/decisions.
- Multi-write transitions are atomic.
- Retry-sensitive commands are idempotent.
- Expected-version concurrency prevents stale writes.
- Correlation, causation, actor, timestamp, and source metadata remain durable.
- Durable dates/timestamps remain Gregorian ISO internally; Persian UI presents Solar Hijri.
- Domain/Application remain independent from React, Tauri, SQLite, PostgreSQL, HTTP, and .NET.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | Lifecycle Domain Analysis and ADR | Completed |
| 3 | Journal State Model and Transition Invariants | Completed |
| 4 | Approval Workflow Integration | Completed |
| 5 | Final Posting Policy and Accounting Immutability | Completed |
| 6 | Locking and Controlled Amendment Policy | Completed |
| 7 | Reversal and Replacement Lineage | Completed |
| 8 | Application Contracts, Commands, and Queries | Completed |
| 9 | Authorization, Permissions, and Segregation of Duties | Completed |
| 10 | Migration and Lifecycle Persistence Model | Completed |
| 11 | SQLite Repository, Unit of Work, Concurrency, and Idempotency | Completed |
| 12 | Audit, Integration Events, and Notifications | Completed |
| 13 | Persian RTL Lifecycle Status and Action UI | Completed |
| 14 | Posting, Reversal, Traceability, and Failure UX | Completed |
| 15 | Domain and Application Test Matrix | Completed |
| 16 | Repository, Migration, Permission, and Desktop Regression Tests | Completed |
| 17 | Monorepo Validation and Documentation Completion | In progress |
| 18 | Final Review, Merge, and Release | Not started |

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Plan Freeze

- Verify Phase 14 release baseline and Phase 15 roadmap target.
- Create `phase/15-journal-lifecycle` from current `main`.
- Freeze dependencies, scope, governance, and the 18-step sequence.

Exit: branch and fixed plan exist; no lifecycle behavior introduced.

Status: Completed

Evidence: Phase 14 `v0.14.0` baseline confirmed; Phase 15 branch and fixed plan created.

### Step 2 — Lifecycle Domain Analysis and ADR

- Reconcile Phase 13 Journal architecture with Approval, concurrency/idempotency/event infrastructure, fiscal locking, and UI conventions.
- Define state ownership, transitions, approval-vs-posting semantics, failure behavior, actor/evidence requirements, and rejected alternatives.

Exit: lifecycle architecture is unambiguous and accepted before implementation.

Status: Completed

Evidence: ADR-0015 accepted; Journal owns accounting lifecycle state, generic Approval owns approval state/history; approval != posting; posted facts immutable; reversal is separate inverse voucher; expected-version/idempotency/post-commit event rules fixed.

### Step 3 — Journal State Model and Transition Invariants

- Implement lifecycle states and legal transitions in Domain code.
- Reject illegal transitions deterministically and retain version/actor/time evidence.

Exit: legal transitions succeed and illegal transitions fail through focused Domain tests.

Status: Completed

Evidence: five-state model (`draft`, `pending_approval`, `approved`, `posted`, `reversed`) and deterministic transition table implemented/exported/tested.

### Step 4 — Approval Workflow Integration

- Reuse generic Approval Workflow for submit/approve/reject/return/cancel/resubmit semantics.
- Prevent contradictory Journal and Approval persisted states.

Exit: Approval remains reusable and Journal/Approval coordination has one atomic contract.

Status: Completed

Evidence: persistence-neutral Journal/Approval orchestration, approval-cycle linkage, resubmission semantics, and posting evidence assertion implemented/tested.

### Step 5 — Final Posting Policy and Accounting Immutability

- Re-run balance/account/dimension/fiscal eligibility immediately before posting.
- Require current Approval for exact submitted content.
- Create posting evidence and prevent destructive post-posting mutation.

Exit: only eligible vouchers post; posted facts cannot be silently changed/deleted.

Status: Completed

Evidence: final posting policy and immutable posting evidence implemented; user confirmed focused local Accounting typecheck/tests pass.

### Step 6 — Locking and Controlled Amendment Policy

- Derive editability from lifecycle policy.
- Lock non-Draft ordinary mutation.
- Provide controlled `approved -> draft` amendment with traceable reason/actor/version/Approval-cycle closure.

Exit: all ordinary editing is Draft-only and amendment is explicit/traceable.

Status: Completed

Evidence: locking/amendment contracts, use-case guards, cycle invalidation, evidence, exports, and focused tests added.

### Step 7 — Reversal and Replacement Lineage

- Reverse only posted vouchers using a separate exact inverse posted voucher.
- Preserve original facts and durable original/reversal/replacement lineage.
- Prevent double reversal and duplicate retry effects.

Exit: reversal is balanced, deterministic, audit-safe, idempotent, and queryable by lineage.

Status: Completed

Evidence: inverse voucher creation, original `posted -> reversed`, request-id replay, double-reversal prevention, optional replacement linkage, and focused tests implemented.

### Step 8 — Application Contracts, Commands, and Queries

- Define persistence-neutral lifecycle commands, queries, DTOs, stable errors, metadata, and reader/service contracts.

Exit: SQLite and future PostgreSQL/API adapters can share the same lifecycle Application boundary.

Status: Completed

Evidence: canonical lifecycle context/commands/handlers/query DTOs, trace DTOs, list status projection, and focused tests added.

### Step 9 — Authorization, Permissions, and Segregation of Duties

- Add granular submit/approve/reject/return/cancel/post/reopen/reverse permissions.
- Enforce authorization at Application boundary.
- Apply existing-policy-based segregation rules.

Exit: UI is never the security authority and actor-policy failures are deterministic/tested.

Status: Completed

Evidence: eight lifecycle permissions registered/enforced; default self-approval prohibition added; denied/SoD errors and tests added. Denied-operation durable audit was scheduled for Step 12.

### Step 10 — Migration and Lifecycle Persistence Model

- Add versioned lifecycle migration, state/evidence tables, constraints, indexes, lineage, and idempotency keys.
- Preserve upgrade safety for existing Phase 13 Draft vouchers.

Exit: clean/upgrade paths deterministic; existing Draft data preserved.

Status: Completed

Evidence: `0014_journal_lifecycle.sql` registered; additive authoritative `lifecycle_status`; Approval-cycle, Posting, Amendment, Reversal tables/indexes/constraints; migration tests. User fixed and pushed `e9bae35ddfde307f752a287199bbe7b22bfcf3f5` and confirmed desktop tests green. Retained test rules: spread `node:sqlite` rows before strict deep equality and use `sqlite_master.tbl_name` for attached-index discovery.

### Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency

- Persist lifecycle transitions/evidence through SQLite adapters.
- Make multi-write operations atomic.
- Use expected-version optimistic concurrency.
- Preserve retry safety for approval/posting/reversal effects.

Exit: concurrent/retried commands preserve a single valid outcome and failed transactions leave no partial state.

Status: Completed

Evidence:

- `SqliteJournalVoucherRepository` now reads/writes authoritative `lifecycle_status` while keeping legacy Phase 13 `status='draft'` compatible.
- `updateLifecycleState` uses expected-version CAS and shared version-conflict assertion.
- Added SQLite Approval, Posting, Amendment, Reversal UoWs and lifecycle reader.
- Approval gateway uses the exact transaction session; Approval cycle uses UPSERT when remaining current.
- Posting state/evidence, amendment state/cycle/evidence, and original/reversal/lineage writes are atomic.
- Reversal request/original uniqueness and persisted replay path protect idempotency.
- Removed unnecessary direct `@argin/audit` dependency from `accounting-tauri` so `pnpm-lock.yaml` remains stable.
- User confirmed Step 11 local validation is green.

### Step 12 — Audit, Integration Events, and Notifications

- Emit durable audit evidence for each meaningful lifecycle transition and authorization denial.
- Publish stable integration events only after successful commit.
- Carry actor/company/branch/voucher/transition/correlation/causation and relevant Approval/Posting/Reversal identifiers.
- Add notifications only where operationally useful.

Exit: meaningful transitions are reconstructable from audit evidence and Integration Events cannot publish before commit.

Status: Completed

Evidence:

- Added `journal-voucher-lifecycle-effects.ts` with canonical lifecycle audit evidence containing action/outcome, actor, previous/new status/version, request/correlation/causation, Approval request, Posting reference, Reversal/Replacement ids, and reason.
- Added `createJournalVoucherLifecycleAuditRecorder` over the existing immutable Audit subsystem with success/denied outcomes and before/after snapshots.
- Canonical handlers execute lifecycle effects only after the Step 11 transaction returns successfully; ordering is `commit -> durable audit -> integration event -> optional notification`.
- Stable schema-version-1 events cover submit, approve, reject, return, cancel, post, reopen, and reverse.
- Authorization/SoD denial is audit-only and does not publish an integration event.
- Replayed reversal suppresses duplicate integration-event publication.
- Approval requester receives in-app notifications for approved/rejected/returned/cancelled outcomes; Posting/Reversal avoid redundant self-notification.
- Added focused `journal-voucher-lifecycle-effects.test.ts` coverage for audit-before-event ordering, Approval notification, and audit-only denial.
- Preserved `exactOptionalPropertyTypes` compatibility by conditionally omitting absent event/notification properties.
- User confirmed Step 12 local validation is green.

### Step 13 — Persian RTL Lifecycle Status and Action UI

- Extend Journal list/detail/editor with canonical lifecycle status presentation.
- Use Application-provided capability/permission state for actions.
- Add Persian confirmations while preserving compact desktop density, keyboard accessibility, RTL, loading/empty/error states, and Solar Hijri presentation.

Exit: users understand state and allowed next actions; presentation is not source of truth.

Status: Completed

Evidence:

- Added `journal-voucher-lifecycle-presenter.ts` with canonical Persian labels/descriptions for `draft`, `pending_approval`, `approved`, `posted`, and `reversed`, lock state, visual tone, version text, action labels, and confirmation copy.
- Presenter intersects `JournalVoucherLifecycleDto.capabilities.actions` with the official Application `permissionForCapability` mapping; React does not duplicate transition or permission codes.
- Added `JournalVoucherLifecycleOverview` to the main `/accounting/journal-vouchers` route, reading current persisted lifecycle through `SqliteJournalVoucherLifecycleReader` and `getJournalVoucherLifecycle`.
- The mounted compact RTL table exposes voucher number, Solar Hijri date, lifecycle state/explanation, lock/editability, version, and the next actions currently allowed by both state policy and user permissions.
- Kept the existing editor Draft-only, matching lifecycle policy; non-Draft mutation rules remain outside presentation.
- Added compact responsive styling aligned with Phase 14 desktop-density conventions and explicit loading, empty, refresh, and error states.
- Made the existing journal presenter lifecycle-status label aware for compatibility with later detail integration.
- Added desktop presenter tests covering all five Persian state labels, capability/permission intersection, full-access behavior, terminal reversed state, and confirmation metadata for consequential actions.
- User confirmed Step 13 local validation is green.

### Step 14 — Posting, Reversal, Traceability, and Failure UX

- Add posted/reversed traceability surfaces.
- Map stable Application errors to clear Persian messages while keeping technical diagnostics separate.
- Require deliberate confirmation for high-impact actions.

Exit: Posting/Reversal history is navigable and business rejections are visually distinct from technical failures.

Status: Completed

Evidence:

- Added `create-journal-lifecycle-services.ts` as the desktop composition boundary for real Posting/Reversal execution using canonical Application handlers, Step 11 SQLite UoWs, current Approval evidence, final account/fiscal/dimension validation, Number Series, and Step 12 post-commit effects.
- `AccountingProvider` now exposes `journalLifecycle` alongside the Phase 13 Journal services without moving SQL or business policy into React.
- The lifecycle overview executes `post` and `reverse` through canonical commands with expected version, actor, request/correlation ids, occurrence time, optional posting reference, required reversal date, and required reversal reason.
- High-impact operations use an explicit modal plus final confirmation. Reversal cannot proceed without a traceable reason.
- Successful commands refresh the persisted lifecycle immediately and surface the new posted/reversed version or generated reversal voucher number.
- Added expandable traceability for current Approval request, Posting evidence, latest controlled Amendment, and original/reversal/replacement lineage. Approval request ids link to the existing Approval details route.
- Stable `journal.*` failures are presented as business rejections with Persian recovery guidance and without leaking raw technical detail. Unknown failures are visually separated as technical errors with expandable diagnostics.
- Added focused presenter coverage for business-vs-technical error classification and explicit irreversible confirmation copy for Post/Reversal.
- Preserved Step 12 ordering: lifecycle transaction commits before Audit/Integration Event/Notification effects; desktop composition does not nest Audit inside the Posting/Reversal transaction.
- User confirmed Step 14 local validation is green.

### Step 15 — Domain and Application Test Matrix

- Add exhaustive transition, Approval, Posting, locking/amendment, reversal, stale-version, authorization, idempotency, error mapping, and scope regression tests.

Exit: Domain/Application lifecycle behavior is comprehensively covered independent of SQLite/UI.

Status: Completed

Evidence:

- Added `packages/accounting/tests/journal-voucher-lifecycle-matrix.test.ts` as the cross-cutting Domain/Application contract matrix.
- The matrix evaluates every one of the 5 lifecycle states against all 8 Domain lifecycle actions, asserting both legal target states and rejection of every illegal state/action pair.
- Every successful transition in the matrix verifies optimistic version increment and previous/new state evidence.
- Added capability projection coverage for Draft, Pending Approval with/without a current cycle, Approved with/without a current cycle, Posted, and terminal Reversed states.
- Added company-scope isolation coverage: a voucher from another company resolves as stable `journal.not-found` rather than leaking cross-company existence.
- Added complete mapping checks for all eight lifecycle authorization actions and every UI lifecycle capability against the registered Journal permission vocabulary.
- Existing focused tests remain the authoritative detailed coverage for Approval submit/decision/resubmission, final Posting and stale approval/fiscal revalidation, Draft-only locking/controlled amendment, expected-version failures, exact inverse Reversal, request-id replay/double-reversal prevention, authorization/SoD, post-commit audit/event ordering, and stable error semantics.
- Added `docs/phases/phase-15-step-15-test-matrix.md` to map each Step 15 requirement to its concrete test evidence and keep Step 16 persistence/desktop responsibilities separate.
- User confirmed Step 15 local validation is green.

### Step 16 — Repository, Migration, Permission, and Desktop Regression Tests

- Test clean/upgrade migrations, persisted lifecycle evidence, atomicity, uniqueness, expected-version, retry/idempotency, reversal lineage, permissions, and desktop UX regressions.

Exit: persistence and desktop adapters cannot violate lifecycle contracts under covered scenarios.

Status: Completed

Evidence:

- Existing migration regression keeps deterministic Phase 13 Draft upgrade, migration registration, five-state CHECK protection, evidence-table creation, and protective-index discovery covered.
- Added `apps/desktop/tests/journal-lifecycle-constraints.test.ts` using real in-memory SQLite to prove one-current-Approval-cycle uniqueness, one Posting evidence row, Amendment version integrity, reversal original/reversal/request uniqueness, and invalid self-lineage rejection.
- Added `packages/accounting-tauri/tests/sqlite-journal-voucher-lifecycle-concurrency.test.ts` to prove `updateLifecycleState` stale expected-version CAS fails when no row is affected and does not issue a follow-up write.
- Existing `sqlite-journal-voucher-lifecycle.test.ts` remains the focused evidence for one-transaction Posting, Amendment, Reversal/lineage, and exact-session Approval gateway composition.
- Added `apps/desktop/tests/journal-lifecycle-desktop-regression.test.ts` to ensure all eight lifecycle permissions remain in the default Security registry, Post is not exposed without its explicit permission, and real Post/Reversal execution remains routed through canonical Application handlers/UoWs rather than direct React SQL.
- Desktop regression also protects deliberate confirmation and the separation of stable business rejection from expandable technical diagnostics.
- Added `docs/phases/phase-15-step-16-regression-matrix.md` mapping persistence/migration/permission/desktop requirements to their concrete tests.
- Preserved the Step 10 test rules: convert `node:sqlite` result rows to plain objects before strict equality and use `sqlite_master.tbl_name` when discovering indexes attached to a table.
- Local Desktop validation initially exposed extensionless relative ESM imports in `@argin/security`; commit `cf8e91b6c3956b9863d0204a4905edf1e12a2365` corrected Security source imports/exports to explicit `.ts` paths and enabled `allowImportingTsExtensions`.
- Retained regression rule: workspace TypeScript source executed directly by the Node test runner must use the repository's explicit `.ts` relative ESM import/export convention; bundler-only resolution is not sufficient evidence for Node test execution.
- User confirmed Step 16 local validation is green after the Security ESM correction.

### Step 17 — Monorepo Validation and Documentation Completion

- Run required focused and full monorepo lint/typecheck/test/build validation.
- Complete documentation/index/link/diff checks and update architecture/security/database/glossary/roadmap/changelog/release evidence.

Exit: validation green with recorded evidence; Phase 16 clearly identified as next target.

Status: In progress

Evidence so far:

- Added `docs/phases/phase-15-step-17-validation.md` with the authoritative focused/full validation commands, documentation completion checklist, integrity checks, and the retained Security ESM regression rule.
- Root validation scripts confirmed as `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- `docs/phases/README.md` now identifies Step 17 as the current in-progress step and Step 18 as next.
- No Step 17 validation command is claimed green until executed locally or through CI against the current Step 17 HEAD.

### Step 18 — Final Review, Merge, and Release

- Review every fixed step/scope boundary.
- Resolve approved deferrals.
- Merge through approved branch flow, tag/release Phase 15, and verify Phase 16 next target.

Exit: Phase 15 merged/released with consistent evidence and no silent lifecycle-critical issue.

Status: Not started

## Change Requests

None.

Any future change request must record requested change, reason, affected fixed step(s), scope impact, approval decision, and resulting plan/status update.
