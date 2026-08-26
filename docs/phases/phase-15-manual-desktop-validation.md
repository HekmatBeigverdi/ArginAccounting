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
- Submit for Approval is available when the user has permission.

Record:

- voucher number;
- voucher id if visible;
- initial version;
- screenshot of the Draft row/details.

### 2. Submit for Approval

As User A, select **ارسال برای تأیید** and confirm.

Expected:

- status becomes `در انتظار تأیید`;
- ordinary editing is locked;
- an Approval Request is created;
- lifecycle version increments.

Record the Approval Request id from traceability when available.

### 3. Approval Decision

Sign in as User B and open **گردش تأیید** (`/approval/requests`).

Open the request linked to the test Journal Voucher and approve it.

Expected:

- Approval Request becomes approved;
- returning to **اسناد حسابداری** and refreshing shows `تأییدشده`;
- the voucher remains locked against ordinary editing;
- Posting becomes available only with the Post permission.

Optional negative check: User A must not be able to approve the same current cycle; the application should reject self-approval through the segregation-of-duties rule.

### 4. Final Posting

Using a user with `accounting.journal-vouchers.post`, return to the voucher and choose **ثبت نهایی**.

Confirm the high-impact operation.

Expected:

- final posting succeeds only if the fiscal period, accounts, dimensions, balance, and current Approval evidence remain valid;
- status becomes `ثبت نهایی`;
- version increments;
- Posting evidence becomes visible in traceability;
- ordinary edit/delete is unavailable.

Record:

- posted version;
- posting timestamp;
- posting actor;
- posting reference if entered.

### 5. Reversal

For full Phase 15 end-to-end validation, select **برگشت سند** on the posted voucher.

Use:

- reversal date inside an open fiscal period;
- reason: `آزمون برگشت سند فاز ۱۵`.

Confirm the operation.

Expected:

- original voucher becomes `برگشت‌شده`;
- a separate posted reversal voucher is created;
- reversal lines are the exact accounting inverse of the original lines;
- original/reversal lineage is visible;
- the original accounting facts are not edited in place;
- attempting a second reversal does not create another accounting outcome.

Record:

- reversal voucher number/id;
- original voucher final version;
- screenshot of Reversal traceability.

## Traceability and Audit Review

### Journal traceability

Use **اسناد حسابداری** (`/accounting/journal-vouchers`) and expand the lifecycle traceability surface.

Verify the relevant evidence appears for the tested path:

- Approval Request;
- Posting evidence;
- Amendment evidence if tested;
- Reversal/Replacement lineage.

### Approval history

Use **گردش تأیید** (`/approval/requests`) and open the linked request (`/approval/requests/:id`).

Verify requester, decision actor, status, timestamps, and decision history.

### Audit evidence

Use **گزارش ممیزی** (`/audit/entries`).

Search/filter around the test voucher, actor, or correlation where available and verify lifecycle actions are reconstructable from immutable Audit entries.

## Optional Controlled-Amendment Scenario

Create a second voucher or repeat the workflow only up to `تأییدشده`.

Choose **بازگشایی برای اصلاح**, provide a reason, and confirm.

Expected:

- `approved -> draft`;
- the current Approval cycle closes;
- Amendment evidence records actor, reason, previous/reopened versions and timestamp;
- changed content cannot reuse the previous Approval and must be submitted again.

## Failure UX Checks

At least one safe negative case should be observed, for example:

- stale version after refreshing from another session;
- missing permission;
- self-approval attempt;
- invalid Posting condition.

Expected:

- stable `journal.*` rejection is shown as a Persian business error;
- unknown technical failure is visually separate and exposes technical diagnostics only in its dedicated details area.

## Manual Evidence Record

For the Phase 15 final review, record the following values in the validation result section below or in the Step 18 release evidence:

- branch HEAD tested;
- tester/date;
- company and fiscal year used;
- User A and User B roles (do not record passwords or secrets);
- original voucher number;
- Approval Request id;
- posted version;
- reversal voucher number;
- Audit evidence observed: Yes/No;
- result: PASS/FAIL;
- screenshots or issue references for any failure.

## Validation Result

Status: **Pending manual execution**

Tested HEAD: _not recorded yet_

Result: _not recorded yet_

Notes: _not recorded yet_
