# Phase 15 — Journal Lifecycle

## Overview

Phase 15 adds the controlled lifecycle for Journal Vouchers introduced by the Phase 13 Journal Voucher Engine. Persisted Draft vouchers can now move through explicit Approval, final Posting, controlled amendment, immutable reversal, authorization, concurrency, auditability, integration events, notifications, and Persian RTL lifecycle UX without moving accounting policy into React/Tauri infrastructure.

The fixed execution sequence and final evidence are recorded in [Phase 15 — Journal Lifecycle — Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md).

## Status

Implementation and final review are complete.

- Step 17 — Monorepo Validation and Documentation Completion: **Completed by user-confirmed local validation**
- Step 18 — Final Review, Merge, and Release: **Merge/release preparation complete; final semantic tag and GitHub Release publication pending manual repository-owner action**
- Phase branch: `phase/15-journal-lifecycle`
- Develop merge: PR #10 / `e43f8eb5e50dfe7fcce12f70ef28b79a85ffdb62`
- Prepared release version: `v0.15.0`
- Next phase: **Phase 16 — Accounting Reports**

## Architecture

`JournalVoucher` is the authoritative owner of accounting lifecycle state. Generic Phase 08 `ApprovalRequest` remains the authoritative owner of Approval status/history. Approval and final posting are separate decisions.

```text
draft
  -> pending_approval
      -> approved
          -> posted
              -> reversed

pending_approval -> draft   (reject / return / cancel)
approved -> draft           (controlled amendment)
```

Only Draft is ordinarily editable. Posted and Reversed accounting facts are immutable in place. Correction uses separate reversal/replacement lineage.

Domain/Application remain independent of React, Tauri, SQLite, PostgreSQL, HTTP, and .NET transports.

## Final Posting

Posting requires:

- matching company scope and expected version;
- exact `approved` lifecycle status;
- current matching approved Approval evidence for the exact submitted content version;
- current balance/account/dimension validity;
- open matching fiscal year and period.

Successful Posting creates immutable posting evidence and locks ordinary edit/delete behavior.

## Approval and Segregation of Duties

Phase 15 reuses the generic Approval subsystem. Submit creates a current Approval cycle. Approve moves the Journal to Approved but does not auto-post. Reject, Return, and Cancel return the Journal to Draft according to lifecycle policy.

Granular Application permissions cover submit, approve, reject, return, cancel, post, reopen-for-amendment, and reverse. The default policy prohibits self-approval of the active Approval cycle.

## Persistence

Migration `0014_journal_lifecycle.sql` adds authoritative `lifecycle_status` while preserving compatibility with Phase 13 Draft data.

Durable evidence tables cover:

- current/historical Approval cycles;
- Posting evidence;
- controlled Amendment evidence;
- Reversal/Replacement lineage.

SQLite adapters use expected-version compare-and-swap, atomic Unit of Work boundaries, and retry/idempotency protection for sensitive operations.

## Audit, Events, and Notifications

Canonical ordering is:

```text
business transaction commit
-> lifecycle audit
-> integration event
-> optional notification
```

Final review clarified that a post-commit effect failure cannot roll back an already committed business transaction. Diagnostics identify the failing stage as `audit`, `event`, or `notification` and retain the underlying cause.

Runtime acceptance found and corrected two integration defects:

- lifecycle Audit no longer opens an unnecessary nested transaction for the single post-commit Audit insert;
- lifecycle notification types use the required `accounting.journal-voucher.*` prefix for `sourceModule: accounting`.

A real `DefaultNotificationService` regression test protects the notification contract instead of relying only on mocks.

## Desktop UX

The Persian RTL Journal lifecycle workspace now provides:

- canonical status/version presentation;
- user-facing Company/Branch labels;
- executable Draft Edit/Delete/Submit actions;
- internal confirmation modals for consequential actions;
- refreshed persisted snapshots before confirmed mutations;
- Posting/Reversal traceability;
- business error guidance plus expandable technical diagnostics;
- mutation-driven automatic refresh without route switching or page reload.

A shared Desktop invalidation channel also resolves stale sibling-view behavior in User/Role management, Approval lists/details, Audit lists, and related screens.

## Validation

Detailed coverage is split across:

- [Step 15 Domain and Application Test Matrix](phase-15-step-15-test-matrix.md)
- [Step 16 Persistence and Desktop Regression Matrix](phase-15-step-16-regression-matrix.md)
- [Step 17 Monorepo Validation](phase-15-step-17-validation.md)
- [Manual Desktop Validation](phase-15-manual-desktop-validation.md)

Retained test lessons:

- normalize `node:sqlite` row objects before strict deep equality;
- use `sqlite_master.tbl_name` for index ownership discovery;
- Node-executed workspace TypeScript uses explicit `.ts` relative imports/exports when required by the repository convention.

Step 17 focused/full validation is recorded as repository-owner-confirmed local execution. The connector does not claim independent execution of those local `pnpm` commands.

Step 18 runtime acceptance exercised Journal create/save, executable Draft actions, Submit, separate-user Approval, lifecycle status/version updates, Approval/Audit post-commit behavior, Notification persistence, and automatic refresh. All release-blocking defects found during that acceptance session were corrected before merge.

Posting/Reversal remain covered by the focused Domain/Application/SQLite/Desktop suites; the final acceptance conversation did not record a new manual Posting/Reversal voucher pair and this document does not claim otherwise.

## Release State

Phase 15 has been merged into `develop` through PR #10. The prepared semantic release is `v0.15.0`.

The only remaining manual action is final tag/GitHub Release publication by the repository owner after `main` promotion.

## Next Phase

Phase 16 — Accounting Reports.
