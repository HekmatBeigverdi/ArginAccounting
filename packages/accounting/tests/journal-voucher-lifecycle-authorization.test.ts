import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRequest } from "@argin/audit";
import {
  assertJournalVoucherLifecycleAuthorized,
  defaultJournalVoucherSegregationPolicy,
  permissionForAction,
} from "../src/application/journal-voucher-lifecycle-authorization.ts";
import { JournalVoucherLifecycleApplicationError } from "../src/application/journal-voucher-lifecycle-contracts.ts";
import { journalVoucherPermissions } from "../src/application/journal-voucher-permissions.ts";

function approval(requestedById: string): ApprovalRequest {
  return {
    id: "approval-1",
    version: 2,
    requestType: "accounting.journal-voucher",
    title: "JV",
    description: null,
    status: "pending",
    target: { entityType: "accounting.journal-voucher", entityId: "voucher-1", entityDisplayName: "JV-1" },
    scope: { companyId: "company-1", branchId: null, fiscalYearId: "fy-1" },
    requestedBy: { type: "user", id: requestedById, displayName: "Requester" },
    requestedAt: "2026-08-24T06:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-08-24T06:00:00.000Z",
    updatedAt: "2026-08-24T06:00:00.000Z",
    history: [],
  };
}

function deps(granted: readonly string[], currentApproval: ApprovalRequest | null = null) {
  return {
    authorizer: { async hasPermission(permission: string) { return granted.includes(permission); } },
    evidence: { async getCurrentApprovalRequest() { return currentApproval; } },
  };
}

test("maps lifecycle actions to granular permissions", () => {
  assert.equal(permissionForAction("submit"), journalVoucherPermissions.submit);
  assert.equal(permissionForAction("approve"), journalVoucherPermissions.approve);
  assert.equal(permissionForAction("post"), journalVoucherPermissions.post);
  assert.equal(permissionForAction("reverse"), journalVoucherPermissions.reverse);
});

test("denies lifecycle mutation without its explicit permission", async () => {
  await assert.rejects(
    () => assertJournalVoucherLifecycleAuthorized({
      action: "post",
      voucherId: "voucher-1",
      actorId: "user-2",
      dependencies: deps([]),
    }),
    (error: unknown) => error instanceof JournalVoucherLifecycleApplicationError && error.code === "journal.unauthorized",
  );
});

test("allows action when granular permission is granted", async () => {
  await assert.doesNotReject(() => assertJournalVoucherLifecycleAuthorized({
    action: "reverse",
    voucherId: "voucher-1",
    actorId: "user-2",
    dependencies: deps([journalVoucherPermissions.reverse]),
  }));
});

test("default segregation policy prohibits self approval", async () => {
  assert.equal(defaultJournalVoucherSegregationPolicy.prohibitSelfApproval, true);
  await assert.rejects(
    () => assertJournalVoucherLifecycleAuthorized({
      action: "approve",
      voucherId: "voucher-1",
      actorId: "user-1",
      dependencies: deps([journalVoucherPermissions.approve], approval("user-1")),
    }),
    (error: unknown) => error instanceof JournalVoucherLifecycleApplicationError && error.code === "journal.segregation-of-duties-violation",
  );
});

test("a different authorized user may approve", async () => {
  await assert.doesNotReject(() => assertJournalVoucherLifecycleAuthorized({
    action: "approve",
    voucherId: "voucher-1",
    actorId: "user-2",
    dependencies: deps([journalVoucherPermissions.approve], approval("user-1")),
  }));
});
