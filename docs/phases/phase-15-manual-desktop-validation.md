# Phase 15 — Manual Desktop Validation

This checklist records the end-to-end functional validation of the Journal Lifecycle through the real Tauri desktop application.

## Purpose

Validate the human-facing workflow after automated tests and monorepo validation:

`Draft -> Pending Approval -> Approved -> Posted -> Reversed`

Also validate controlled return/amendment behavior, traceability, permissions, segregation of duties, and Audit visibility.

## Start the Desktop Application

```bash
pnpm dev:desktop
```

Run this validation against `phase/15-journal-lifecycle` after pulling the latest branch HEAD.

## Test Users

Use two different users because the default segregation-of-duties policy prohibits the user who submitted the active Approval cycle from approving that same cycle.

- **User A — Preparer/Submitter**
  - Journal view/create/update-draft/submit permissions.
- **User B — Approver**
  - Journal view/approve permission.
  - May also have Post/Reverse permissions; Phase 15 does not require a distinct poster/reverser actor.

A `system.full-access` administrator may have all permissions, but the self-approval rule still needs to be respected when validating the normal Approval flow.

## Recommended Test Voucher

Create one simple balanced manual voucher using active posting-enabled leaf accounts that already exist in the selected company.

Suggested business case if matching accounts exist:

**Initial cash capital contribution**

| Line | Account | Debit | Credit |
| --- | --- | ---: | ---: |
| 1 | Cash / صندوق | 10,000,000 IRR | 0 |
| 2 | Capital / سرمایه | 0 | 10,000,000 IRR |

Description: `آزمون چرخه عمر سند حسابداری فاز ۱۵`

If those exact accounts do not exist in the current coding template, choose any two active posting-enabled leaf accounts and keep the voucher balanced at the same amount. Do not create artificial accounts merely for this test.

## Functional Workflow

### 1. Draft

Open **حسابداری -> اسناد حسابداری** (`/accounting/journal-vouchers`).

Create and save the balanced voucher.

Expected:

- status is `پیش‌نویس`;
- voucher is editable;
- version is shown;
- Submit for Approval is available when the user has permission;
- list and lifecycle tables refresh automatically after the mutation.

### 2. Submit for Approval

As User A, select **ارسال برای تأیید** and confirm through the internal modal.

Expected:

- status becomes `در انتظار تأیید`;
- ordinary editing is locked;
- an Approval Request is created;
- lifecycle version increments;
- lifecycle/list state refreshes without changing route or manually reloading the page.

### 3. Approval Decision

Sign in as User B and open **گردش تأیید** (`/approval/requests`).

Open the request linked to the test Journal Voucher and approve it.

Expected:

- Approval Request becomes approved;
- Journal status becomes `تأییدشده`;
- related Approval/Journal/Audit views invalidate and reload without manual page navigation solely to force refresh;
- the voucher remains locked against ordinary editing;
- Posting becomes available only with the Post permission;
- the requester notification persists with a valid `accounting.journal-voucher.*` notification type.

Optional negative check: User A must not be able to approve the same current cycle; the application should reject self-approval through the segregation-of-duties rule.

### 4. Final Posting

Using a user with `accounting.journal-vouchers.post`, choose **ثبت نهایی**.

Expected:

- final posting succeeds only if fiscal/account/dimension/balance/current Approval evidence remain valid;
- status becomes `ثبت نهایی`;
- version increments;
- Posting evidence becomes visible;
- ordinary edit/delete is unavailable.

### 5. Reversal

For a full manual end-to-end pass, select **برگشت سند** on a posted voucher, use an open-period date and a traceable reason, and confirm.

Expected:

- original voucher becomes `برگشت‌شده`;
- a separate posted inverse voucher is created;
- original/reversal lineage is visible;
- original accounting facts are not edited in place;
- a second reversal cannot produce another outcome.

## Traceability and Audit Review

Use **اسناد حسابداری**, **گردش تأیید**, and **گزارش ممیزی** to verify Approval linkage, decision history, lifecycle Audit evidence, Posting evidence when posted, and Reversal/Replacement lineage when exercised.

## Failure UX Checks

Final review intentionally exercised real failure paths. The acceptance cycle found and corrected:

- raw Company/Branch identifiers in Journal detail;
- silent Draft Edit/Delete/Submit actions;
- stale lifecycle version snapshots before confirmed actions;
- post-commit Audit transaction failure;
- ambiguous post-commit error reporting after a committed business mutation;
- stale sibling/list UI after mutations;
- invalid Notification type prefix for `sourceModule: accounting`.

Each discovered failure was corrected before merge and relevant regression coverage was added or strengthened.

## Validation Result

Status: **PASS for the runtime acceptance path exercised during Step 18**

Tested branch: `phase/15-journal-lifecycle`

Runtime acceptance confirmed by repository owner: **Yes**

Observed manual path:

- Journal Voucher create/save: PASS
- Draft action execution and confirmation modal: PASS after correction
- Submit for Approval: PASS after correction
- Separate-user Approval: PASS after correction
- Lifecycle version/status update: PASS
- Approval/Audit post-commit path: PASS after Audit correction
- Approval requester Notification: PASS after `accounting.` prefix correction
- Automatic mutation-driven UI refresh: implemented and accepted in final review

Posting/Reversal remain protected by the focused Domain/Application/SQLite/Desktop suites documented in Steps 14–16. This final acceptance conversation did not record a new manual Posting/Reversal voucher-number pair, so no such manual evidence is claimed here.

Final runtime code HEAD before merge included repository-owner correction `68de3737f6e82057b0880d5be0fcc7b88fc23ff6` and the preceding Notification compatibility fix/test commits.

Result: **PASS for the manually exercised release-blocking path; no unresolved runtime defect from the acceptance session remains.**
