import assert from "node:assert/strict";
import test from "node:test";

import {
  createJournalVoucher,
  type JournalVoucher,
  type JournalVoucherStatus,
} from "../src/domain/journal-voucher.ts";
import {
  canTransitionJournalVoucher,
  transitionJournalVoucher,
  type JournalVoucherLifecycleAction,
} from "../src/domain/journal-voucher-lifecycle.ts";
import {
  getJournalVoucherLifecycle,
  type JournalVoucherLifecycleReader,
} from "../src/application/journal-voucher-lifecycle-queries.ts";
import {
  JournalVoucherLifecycleApplicationError,
} from "../src/application/journal-voucher-lifecycle-contracts.ts";
import {
  permissionForAction,
  permissionForCapability,
  type JournalVoucherLifecycleAuthorizedAction,
} from "../src/application/journal-voucher-lifecycle-authorization.ts";
import { journalVoucherPermissions } from "../src/application/journal-voucher-permissions.ts";

const statuses: readonly JournalVoucherStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "reversed",
];

const actions: readonly JournalVoucherLifecycleAction[] = [
  "submit_for_approval",
  "approval_approved",
  "approval_returned",
  "approval_rejected",
  "approval_cancelled",
  "reopen_for_amendment",
  "post",
  "reverse",
];

const expectedTransitions: Readonly<
  Record<JournalVoucherStatus, Partial<Record<JournalVoucherLifecycleAction, JournalVoucherStatus>>>
> = Object.freeze({
  draft: Object.freeze({ submit_for_approval: "pending_approval" }),
  pending_approval: Object.freeze({
    approval_approved: "approved",
    approval_returned: "draft",
    approval_rejected: "draft",
    approval_cancelled: "draft",
  }),
  approved: Object.freeze({
    reopen_for_amendment: "draft",
    post: "posted",
  }),
  posted: Object.freeze({ reverse: "reversed" }),
  reversed: Object.freeze({}),
});

function voucher(status: JournalVoucherStatus, companyId = "company-1"): JournalVoucher {
  const draft = createJournalVoucher({
    id: "voucher-1",
    companyId,
    branchId: "branch-1",
    number: "JV-000001",
    voucherDate: "2026-08-24",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "fp-06",
    currency: "IRR",
    lines: [
      { id: "line-1", order: 1, accountId: "cash", debit: 1_000, credit: 0 },
      { id: "line-2", order: 2, accountId: "revenue", debit: 0, credit: 1_000 },
    ],
    createdAt: "2026-08-24T10:00:00.000Z",
    version: 7,
  });
  return Object.freeze({ ...draft, status });
}

function readerFor(
  status: JournalVoucherStatus,
  options: { currentApproval?: boolean; companyId?: string } = {},
): JournalVoucherLifecycleReader {
  const current = voucher(status, options.companyId ?? "company-1");
  const currentApproval = options.currentApproval ??
    (status === "pending_approval" || status === "approved" || status === "posted");

  return {
    async findVoucher() { return current; },
    async findCurrentApprovalCycle() {
      if (!currentApproval) return null;
      return {
        approvalRequestId: "approval-1",
        voucherId: current.id,
        submittedContentVersion: 5,
        isCurrent: true,
      };
    },
    async findPostingEvidence() { return null; },
    async findLatestAmendmentEvidence() { return null; },
    async findReversalLineage() { return null; },
  };
}

test("domain transition table is exhaustive across every lifecycle state/action pair", () => {
  for (const status of statuses) {
    for (const action of actions) {
      const expected = expectedTransitions[status][action];
      assert.equal(
        canTransitionJournalVoucher(status, action),
        expected !== undefined,
        `${status} / ${action}`,
      );

      const current = voucher(status);
      if (expected === undefined) {
        assert.throws(
          () => transitionJournalVoucher(current, {
            action,
            actorId: "actor-1",
            occurredAt: "2026-08-24T10:05:00.000Z",
          }),
          `${status} must reject ${action}`,
        );
        continue;
      }

      const result = transitionJournalVoucher(current, {
        action,
        actorId: "actor-1",
        occurredAt: "2026-08-24T10:05:00.000Z",
      });
      assert.equal(result.voucher.status, expected, `${status} / ${action}`);
      assert.equal(result.voucher.version, current.version + 1);
      assert.equal(result.evidence.previousStatus, status);
      assert.equal(result.evidence.newStatus, expected);
    }
  }
});

test("lifecycle query capability matrix matches state and current approval evidence", async () => {
  const cases = [
    ["draft", true, ["edit", "delete", "submit_for_approval"]],
    ["pending_approval", true, ["approve", "reject", "return_to_draft", "cancel_approval"]],
    ["pending_approval", false, []],
    ["approved", true, ["reopen_for_amendment", "post"]],
    ["approved", false, ["reopen_for_amendment"]],
    ["posted", true, ["reverse"]],
    ["reversed", false, []],
  ] as const;

  for (const [status, currentApproval, expectedActions] of cases) {
    const result = await getJournalVoucherLifecycle(
      { companyId: "company-1", voucherId: "voucher-1" },
      readerFor(status, { currentApproval }),
    );
    assert.deepEqual(result.capabilities.actions, expectedActions, status);
    assert.equal(result.capabilities.editable, status === "draft");
    assert.equal(result.capabilities.deletable, status === "draft");
  }
});

test("lifecycle query enforces company scope as not-found", async () => {
  await assert.rejects(
    () => getJournalVoucherLifecycle(
      { companyId: "company-2", voucherId: "voucher-1" },
      readerFor("draft", { companyId: "company-1" }),
    ),
    (error: unknown) =>
      error instanceof JournalVoucherLifecycleApplicationError &&
      error.code === "journal.not-found",
  );
});

test("all lifecycle authorization actions map to distinct registered permissions", () => {
  const authorizationActions: readonly JournalVoucherLifecycleAuthorizedAction[] = [
    "submit",
    "approve",
    "reject",
    "return-to-draft",
    "cancel-approval",
    "post",
    "reopen-for-amendment",
    "reverse",
  ];

  const mapped = authorizationActions.map(permissionForAction);
  assert.equal(new Set(mapped).size, authorizationActions.length);
  for (const permission of mapped) {
    assert.ok(Object.values(journalVoucherPermissions).includes(permission));
  }
});

test("every UI lifecycle capability has an Application permission mapping", () => {
  const capabilities = [
    "edit",
    "delete",
    "submit_for_approval",
    "approve",
    "reject",
    "return_to_draft",
    "cancel_approval",
    "reopen_for_amendment",
    "post",
    "reverse",
  ] as const;

  for (const capability of capabilities) {
    const permission = permissionForCapability(capability);
    assert.ok(Object.values(journalVoucherPermissions).includes(permission));
  }
});
