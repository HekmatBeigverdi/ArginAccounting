# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, reversal, authorization, persistence, auditability, integration events, and Persian RTL lifecycle presentation while preserving concurrency safety and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 16 — Repository, Migration, Permission, and Desktop Regression Tests — Completed**.

Next step: **Step 17 — Monorepo Validation and Documentation Completion**.

Branch: `phase/15-journal-lifecycle`

Baseline release: `v0.14.0`

## Objectives

- Implement an explicit Journal Voucher lifecycle state machine.
- Reuse the generic Approval Workflow rather than duplicating approval logic.
- Implement final posting with authoritative accounting validation.
- Make posted accounting facts immutable from an audit perspective.
- Add controlled locking, amendment, reversal, and replacement lineage.
- Enforce lifecycle permissions, optimistic concurrency, idempotency, atomicity, and durable audit evidence.
- Publish post-commit integration events and operational notifications.
- Deliver Persian RTL lifecycle status/action presentation using the Phase 14 desktop design system.
- Keep Accounting Reports outside this phase and hand off to Phase 16.

## Architecture

`JournalVoucher` is the authoritative owner of accounting lifecycle state. The generic Phase 08 `ApprovalRequest` remains the authoritative owner of approval state/history. Approval and final posting are separate decisions.

The accepted lifecycle is:

```text
draft -> pending_approval -> approved -> posted -> reversed
            |                  |
            +----> draft <-----+
```

Only Draft is ordinarily editable. Approved vouchers may return to Draft only through controlled amendment. Posted and reversed accounting facts are immutable in place; correction is performed by separate reversal/replacement records.

Domain/Application remain independent of React, Tauri, SQLite, PostgreSQL, HTTP, and .NET transport concerns.

## Steps 1–4 — Baseline, Domain, and Approval

- Phase 15 branch and fixed 18-step plan were created from the Phase 14 `v0.14.0` baseline.
- ADR-0015 defines lifecycle ownership, approval/posting separation, locking, reversal, concurrency, idempotency, and post-commit event semantics.
- The Journal Domain supports `draft`, `pending_approval`, `approved`, `posted`, and `reversed` with deterministic transition rules and immutable actor/time/version evidence.
- Accounting reuses the existing generic Approval subsystem. Submission creates a current approval cycle for the exact submitted content version; reject/return/cancel return the Journal to Draft; approve moves it to Approved without auto-posting.

## Step 5 — Final Posting

Final posting requires company ownership, matching expected version, exact `approved` state, current matching approved Approval evidence, exact submitted-content version, current double-entry/account/dimension validity, and a current open matching fiscal year/period.

Successful posting creates immutable posting evidence containing Approval request, submitted/posted versions, actor, timestamp, and optional posting reference.

## Step 6 — Locking and Controlled Amendment

Ordinary update/delete is Draft-only. Pending Approval, Approved, Posted, and Reversed vouchers are locked.

Approved vouchers may return to Draft only through the controlled amendment service with expected version, current Approval cycle, actor, mandatory reason, and immutable amendment evidence. The current Approval cycle is closed so prior approval cannot authorize changed content.

## Step 7 — Reversal and Replacement Lineage

Reversal creates a separate posted inverse voucher with new id/number while preserving the original posted lines unchanged. Original, reversal, and optional replacement identities are stored explicitly so traceability never depends on descriptions.

Reversal uses durable `(companyId, requestId)` idempotency and prevents double reversal.

## Step 8 — Application Contracts and Queries

The canonical lifecycle Application surface exports explicit lifecycle commands, expected-version and actor/request/correlation/causation metadata, stable error codes, lifecycle query/reader contracts, and `JournalVoucherLifecycleDto` with Approval/Posting/Amendment/Reversal trace DTOs.

The contracts remain suitable for SQLite now and future Argin Bridge/PostgreSQL/.NET adapters.

## Step 9 — Authorization and Segregation of Duties

Granular permissions exist for submit, approve, reject, return to Draft, cancel Approval, post, reopen for amendment, and reverse.

Authorization is enforced at the Application boundary. UI visibility is usability only. The default segregation policy prohibits self-approval for the active Approval cycle without inventing mandatory poster/reverser separation for small organizations.

## Step 10 — Migration and Persistence Model

Migration `0014_journal_lifecycle.sql` adds authoritative `lifecycle_status` while preserving the Phase 13 legacy `status='draft'` constraint for upgrade safety.

Lifecycle evidence tables include `journal_voucher_approval_cycles`, `journal_voucher_posting_evidence`, `journal_voucher_amendment_evidence`, and `journal_voucher_reversal_lineage`.

Unique indexes and checks protect one current Approval cycle, one posting evidence record, append-only amendment versions, unique reversal identities, and unique reversal request-id replay keys.

The user locally validated the desktop migration tests after correcting two test-only issues in commit `e9bae35ddfde307f752a287199bbe7b22bfcf3f5`. Retained rules for future tests are:

- spread `node:sqlite` rows into plain objects before strict deep equality;
- use `sqlite_master.tbl_name` when discovering indexes attached to a table.

## Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency

`SqliteJournalVoucherRepository` reads/writes `lifecycle_status` as the authoritative lifecycle source while leaving the Phase 13 legacy status column compatible.

Lifecycle CAS updates use `WHERE ... version = expectedVersion` and shared optimistic-concurrency assertions.

SQLite adapters provide atomic Unit of Work boundaries for Approval + Journal cycle persistence, Posting + posting evidence, controlled amendment + Approval-cycle closure + amendment evidence, and original reversal transition + reversal voucher + durable lineage.

The Approval gateway is created against the exact transaction session. Reversal request/original uniqueness and persisted replay prevent duplicate outcomes.

The unnecessary direct `@argin/audit` dependency was removed from `@argin/accounting-tauri` before completion so `pnpm-lock.yaml` remains stable.

The user confirmed Step 11 local validation is green.

## Step 12 — Audit, Integration Events, and Notifications

`journal-voucher-lifecycle-effects.ts` defines canonical lifecycle evidence with action/outcome, actor/company/branch/voucher, previous/new status and version, request/idempotency/correlation/causation ids, Approval request id, posting reference, reversal/replacement ids, and optional reason/comment.

`createJournalVoucherLifecycleAuditRecorder` records this evidence through the existing immutable Audit subsystem.

Canonical lifecycle handlers execute effects only after the Step 11 transaction returns successfully:

```text
transaction commit -> durable audit -> integration event -> optional notification
```

Authorization/SoD denial is audit-only. Replayed reversal suppresses duplicate event publication. Approval requester notifications are limited to approved/rejected/returned/cancelled outcomes.

The user confirmed Step 12 local validation is green.

## Step 13 — Persian RTL Lifecycle Status and Action UI

`apps/desktop/src/features/accounting/journal-voucher-lifecycle-presenter.ts` provides Persian labels for all five lifecycle states, state explanations, lock/editability description, visual tone metadata, Persian version text, next-action labels, and confirmation copy.

The presenter receives `JournalVoucherLifecycleDto.capabilities.actions` and intersects them with the official Application `permissionForCapability` mapping. React therefore does not duplicate transition rules or invent permission codes.

`JournalVoucherLifecycleOverview` is mounted through `JournalVouchersLifecyclePage` on the existing `/accounting/journal-vouchers` workspace. The compact RTL table displays voucher number, Solar Hijri date, canonical lifecycle status, status explanation, lock/editability state, optimistic version, and next actions allowed by both lifecycle policy and current permissions.

The existing editor remains Draft-only, which is the correct lifecycle policy. The user confirmed Step 13 local validation is green.

## Step 14 — Posting, Reversal, Traceability, and Failure UX

Step 14 converts the high-impact lifecycle actions from presentation-only affordances into executable desktop workflows without placing accounting policy in React.

`apps/desktop/src/composition/accounting/create-journal-lifecycle-services.ts` composes canonical Application handlers with the Step 11 SQLite Unit of Work adapters, current Approval evidence, account/fiscal/dimension readers, Journal Number Series, and Step 12 Audit/Event/Notification effects.

The lifecycle overview executes canonical `post` and `reverse` commands with expected-version, actor, request/correlation metadata, occurrence time, optional posting reference, required reversal date, and mandatory reversal reason.

Both operations use deliberate confirmation UX. After success, the UI reloads persisted lifecycle state and reports the new posted version or generated reversal voucher number.

Traceability surfaces expose current Approval, Posting evidence, latest controlled Amendment, and Reversal/Replacement lineage. Stable `journal.*` failures are shown as business rejections with Persian recovery guidance while unknown failures are separated as technical diagnostics.

The user confirmed Step 14 local validation is green.

## Step 15 — Domain and Application Test Matrix

Step 15 consolidates persistence-independent lifecycle verification and adds a cross-cutting matrix instead of duplicating the already-focused test suites.

`packages/accounting/tests/journal-voucher-lifecycle-matrix.test.ts` adds exhaustive verification of all state/action pairs, capability projection, company-scope isolation, optimistic transition evidence, and complete authorization/capability permission mapping.

The existing focused suites remain authoritative for detailed Approval, Posting, locking/amendment, Reversal, stale-version, authorization/SoD, request-id idempotency, post-commit effects, and stable error semantics.

`docs/phases/phase-15-step-15-test-matrix.md` records the requirement-to-test mapping. The user confirmed Step 15 local validation is green.

## Step 16 — Repository, Migration, Permission, and Desktop Regression Tests

Step 16 extends coverage across the persistence and desktop adapter boundary without duplicating Step 15 Domain/Application tests.

New regression coverage includes:

- `packages/accounting-tauri/tests/sqlite-journal-voucher-lifecycle-concurrency.test.ts`: a stale lifecycle compare-and-swap returns zero affected rows and must fail without issuing a second write;
- `apps/desktop/tests/journal-lifecycle-constraints.test.ts`: SQLite enforces one current Approval cycle, one Posting evidence row, amendment-version integrity, unique original/reversal/request lineage, and invalid self-lineage rejection;
- `apps/desktop/tests/journal-lifecycle-desktop-regression.test.ts`: all eight lifecycle permissions remain present in the default Security catalog, Post is hidden without its permission, Post/Reversal remain wired through canonical Application handlers/UoWs rather than direct React SQL, deliberate confirmations remain present, and business errors stay separate from technical diagnostics.

Existing Step 10/11 tests remain the primary coverage for Phase 13 upgrade preservation, migration registration, lifecycle-state constraints, atomic Posting/Amendment/Reversal persistence, and same-session Approval gateway behavior.

`docs/phases/phase-15-step-16-regression-matrix.md` maps every Step 16 requirement to concrete test evidence and retains the two test rules learned from the Step 10 local correction: plain-object conversion for `node:sqlite` row equality and `sqlite_master.tbl_name` for index discovery.

Step 16 implementation is complete. Runtime green is not claimed until the focused Accounting/Accounting-Tauri/Desktop commands are executed locally or through CI.

## Security

Application authorization remains authoritative. Lifecycle UI cannot grant a transition. The default self-approval prohibition remains enforced independently of which actions are displayed. Step 16 additionally protects the default permission registry from silently dropping any lifecycle permission.

## Testing and Validation

Confirmed local validation:

- Step 5 focused Accounting tests/typecheck;
- Step 10 desktop migration tests after the user's correction commit;
- Step 11 local validation;
- Step 12 local validation;
- Step 13 local validation;
- Step 14 local validation;
- Step 15 local validation.

Focused commands for the Step 16 branch state are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
```

Step 16 runtime success is not claimed until these updated checks are executed locally or through CI.

Full monorepo lint/typecheck/test/build validation and final documentation completion remain Step 17.

## Related ADRs

- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md)
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md)
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md)
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md)
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md)
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](../adr/ADR-0009-platform-infrastructure-first.md)
- [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md)

## Exit Criteria

Phase 15 is complete only when all fixed steps are satisfied or explicitly changed through an approved Change Request; lifecycle rules remain enforced outside UI; posted accounting facts remain audit-safe; Approval/Posting/Reversal flows are atomic and concurrency-safe; permissions and audit evidence are present; migration and adapter behavior are validated; desktop lifecycle UX follows project standards; documentation is complete; and the phase is merged and released.

## Next Step

Step 17 — Monorepo Validation and Documentation Completion.

## Next Phase

Phase 16 — Accounting Reports.
