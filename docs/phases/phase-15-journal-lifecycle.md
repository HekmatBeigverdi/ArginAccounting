# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers created by the Phase 13 Journal Voucher Engine. It turns persisted Draft vouchers into governed accounting records through explicit approval, posting, locking, amendment, reversal, authorization, persistence, auditability, integration events, and Persian RTL lifecycle presentation while preserving concurrency safety and double-entry integrity.

The fixed execution sequence is defined in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

In progress.

Current step: **Step 13 — Persian RTL Lifecycle Status and Action UI — Completed**.

Next step: **Step 14 — Posting, Reversal, Traceability, and Failure UX**.

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

Final posting requires:

- company ownership and matching expected version;
- exact `approved` state;
- a current matching approved Approval request;
- exact submitted-content version evidence;
- current double-entry balance;
- eligible accounts and accounting dimensions;
- current open matching fiscal year/period.

Successful posting creates immutable posting evidence containing Approval request, submitted/posted versions, actor, timestamp, and optional posting reference.

## Step 6 — Locking and Controlled Amendment

Ordinary update/delete is Draft-only. Pending Approval, Approved, Posted, and Reversed vouchers are locked.

Approved vouchers may return to Draft only through the controlled amendment service with:

- expected version;
- current Approval cycle;
- actor;
- mandatory reason;
- immutable amendment evidence.

The current Approval cycle is closed so prior approval cannot authorize changed content.

## Step 7 — Reversal and Replacement Lineage

Reversal creates a separate posted inverse voucher with new id/number while preserving the original posted lines unchanged. Original, reversal, and optional replacement identities are stored explicitly so traceability never depends on descriptions.

Reversal uses durable `(companyId, requestId)` idempotency and prevents double reversal.

## Step 8 — Application Contracts and Queries

The canonical lifecycle Application surface exports:

- explicit lifecycle commands;
- expected-version and actor/request/correlation/causation metadata;
- stable error codes;
- lifecycle query/reader contracts;
- `JournalVoucherLifecycleDto` with status/version/capabilities and Approval/Posting/Amendment/Reversal trace DTOs.

The contracts remain suitable for SQLite now and future Argin Bridge/PostgreSQL/.NET adapters.

## Step 9 — Authorization and Segregation of Duties

Granular permissions exist for:

- submit;
- approve;
- reject;
- return to Draft;
- cancel Approval;
- post;
- reopen for amendment;
- reverse.

Authorization is enforced at the Application boundary. UI visibility is usability only. The default segregation policy prohibits self-approval for the active Approval cycle without inventing mandatory poster/reverser separation for small organizations.

## Step 10 — Migration and Persistence Model

Migration `0014_journal_lifecycle.sql` adds authoritative `lifecycle_status` while preserving the Phase 13 legacy `status='draft'` constraint for upgrade safety.

Lifecycle evidence tables include:

- `journal_voucher_approval_cycles`;
- `journal_voucher_posting_evidence`;
- `journal_voucher_amendment_evidence`;
- `journal_voucher_reversal_lineage`.

Unique indexes and checks protect one current Approval cycle, one posting evidence record, append-only amendment versions, unique reversal identities, and unique reversal request-id replay keys.

The user locally validated the desktop migration tests after correcting two test-only issues in commit `e9bae35ddfde307f752a287199bbe7b22bfcf3f5`. Retained rules for future tests are:

- spread `node:sqlite` rows into plain objects before strict deep equality;
- use `sqlite_master.tbl_name` when discovering indexes attached to a table.

## Step 11 — SQLite Repository, Unit of Work, Concurrency, and Idempotency

`SqliteJournalVoucherRepository` reads/writes `lifecycle_status` as the authoritative lifecycle source while leaving the Phase 13 legacy status column compatible.

Lifecycle CAS updates use `WHERE ... version = expectedVersion` and shared optimistic-concurrency assertions.

SQLite adapters provide atomic Unit of Work boundaries for:

- Approval + Journal cycle persistence;
- Posting + posting evidence;
- controlled amendment + Approval-cycle closure + amendment evidence;
- original reversal transition + reversal voucher + durable lineage.

The Approval gateway is created against the exact transaction session. Reversal request/original uniqueness and persisted replay prevent duplicate outcomes.

The unnecessary direct `@argin/audit` dependency was removed from `@argin/accounting-tauri` before completion so `pnpm-lock.yaml` remains stable.

The user confirmed Step 11 local validation is green.

## Step 12 — Audit, Integration Events, and Notifications

`journal-voucher-lifecycle-effects.ts` defines canonical lifecycle evidence with:

- action/outcome;
- actor/company/branch/voucher;
- previous/new status and version;
- request/idempotency, correlation, and causation ids;
- Approval request id;
- posting reference;
- reversal/replacement ids;
- optional reason/comment.

`createJournalVoucherLifecycleAuditRecorder` records the evidence through the existing immutable Audit subsystem.

Canonical lifecycle handlers execute effects only after the Step 11 transaction returns successfully. Ordering is:

```text
transaction commit -> durable audit -> integration event -> optional notification
```

Authorization/SoD denial is audit-only. Replayed reversal suppresses duplicate event publication. Approval requester notifications are limited to approved/rejected/returned/cancelled outcomes.

The user confirmed Step 12 local validation is green.

## Step 13 — Persian RTL Lifecycle Status and Action UI

Step 13 introduces a mounted lifecycle presentation surface on the existing `/accounting/journal-vouchers` workspace.

### Presenter

`apps/desktop/src/features/accounting/journal-voucher-lifecycle-presenter.ts` provides:

- Persian labels for all five lifecycle states;
- state explanations;
- lock/editability description;
- visual tone metadata;
- Persian version text;
- next-action labels;
- confirmation copy for consequential actions.

The presenter receives `JournalVoucherLifecycleDto.capabilities.actions` and intersects them with the official Application `permissionForCapability` mapping. React therefore does not duplicate transition rules or invent permission codes.

The existing `journal-voucher-presenter.ts` status formatter was also made lifecycle-aware instead of always returning `پیش‌نویس`.

### Mounted lifecycle overview

`JournalVoucherLifecycleOverview` is mounted through `JournalVouchersLifecyclePage` on the existing Journal Voucher route.

It reads durable lifecycle data through:

- `SqliteJournalVoucherLifecycleReader`;
- `getJournalVoucherLifecycle`.

The compact RTL table displays:

- voucher number;
- Solar Hijri date;
- canonical lifecycle status;
- status explanation;
- lock/editability state;
- optimistic version;
- next actions allowed by both lifecycle policy and the current user's permissions.

The view includes company selection, refresh, loading, empty, and explicit error states. Styling follows the Phase 14 compact desktop-density direction and remains horizontally scrollable on constrained widths rather than inflating accounting rows.

The existing editor remains Draft-only, which is the correct lifecycle policy. Step 13 does not introduce UI shortcuts that mutate non-Draft vouchers.

### Tests

`apps/desktop/tests/journal-voucher-lifecycle-presenter.test.ts` covers:

- Persian labels for all five states;
- capability/permission intersection;
- `system.full-access` behavior;
- terminal Reversed state;
- confirmation metadata for consequential actions.

Detailed Posting/Reversal execution, traceability navigation, deliberate execution confirmations, and stable business-vs-technical failure mapping remain Step 14 according to the frozen plan.

## Security

Application authorization remains authoritative. The lifecycle overview is a presentation projection only and cannot grant a lifecycle transition.

The default self-approval prohibition remains enforced at the Application boundary independent of which actions are displayed.

## Testing and Validation

Confirmed local validation:

- Step 5 focused Accounting tests/typecheck;
- Step 10 desktop migration tests after the user's correction commit;
- Step 11 local validation;
- Step 12 local validation.

Focused commands for the Step 13 branch state are:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
```

Step 13 runtime success is not claimed until these updated desktop checks are executed locally or through CI.

The exhaustive Domain/Application matrix remains Step 15 and the full persistence/permission/desktop regression matrix remains Step 16.

## Related ADRs

- [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md)
- [ADR-0013 — Journal Voucher Engine Architecture](../adr/ADR-0013-journal-voucher-engine.md)
- [ADR-0008 — Approval Workflow with Optimistic Concurrency](../adr/ADR-0008-approval-optimistic-concurrency.md)
- [ADR-0007 — Immutable Audit Trail](../adr/ADR-0007-immutable-audit-trail.md)
- [ADR-0005 — Repository and Unit of Work](../adr/ADR-0005-repository-unit-of-work.md)
- [ADR-0009 — Shared Platform Infrastructure Before Accounting Core](../adr/ADR-0009-platform-infrastructure-first.md)
- [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md)

## Exit Criteria

Phase 15 is complete only when:

- all fixed steps are satisfied or explicitly changed through an approved Change Request;
- lifecycle rules remain enforced outside UI;
- posted accounting facts remain audit-safe;
- Approval/Posting/Reversal flows are atomic and concurrency-safe;
- permissions and audit evidence are present;
- migration and adapter behavior are validated;
- desktop lifecycle UX follows project standards;
- documentation is complete;
- the phase is merged and released.

## Next Step

Step 14 — Posting, Reversal, Traceability, and Failure UX.

## Next Phase

Phase 16 — Accounting Reports.
