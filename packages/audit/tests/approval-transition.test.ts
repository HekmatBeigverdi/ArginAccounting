import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveApprovalTransition
} from "../src/domain/approval/approval-transition.ts";

import {
  ApprovalInvalidTransitionError
} from "../src/application/approval/approval-application-errors.ts";

import {
  applyApprovalAction
} from "../src/application/approval/apply-approval-action.ts";

import type {
  ApprovalRequest
} from "../src/domain/approval/approval-request.ts";

const actor = {
  type: "user" as const,
  id: "user-1",
  displayName: "Test User"
};

function createRequest(
  status: ApprovalRequest["status"] = "draft"
): ApprovalRequest {
  return {
    id: "approval-1",
    version: 1,
    requestType: "journal-voucher",
    title: "Approve voucher",
    description: null,
    status,
    target: {
      entityType: "journal-voucher",
      entityId: "voucher-1",
      entityDisplayName: "JV-0001"
    },
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fiscal-1"
    },
    requestedBy: actor,
    requestedAt: status === "pending" ? "2026-07-25T10:00:00.000Z" : null,
    decidedBy: null,
    decidedAt: null,
    decisionComment: null,
    createdAt: "2026-07-25T09:00:00.000Z",
    updatedAt: "2026-07-25T09:00:00.000Z",
    history: []
  };
}

describe("approval transition rules", () => {
  const validCases = [
    ["draft", "submit", "pending"],
    ["pending", "approve", "approved"],
    ["pending", "reject", "rejected"],
    ["pending", "return-to-draft", "draft"],
    ["draft", "cancel", "cancelled"],
    ["pending", "cancel", "cancelled"]
  ] as const;

  for (const [from, action, expected] of validCases) {
    it(`moves ${from} with ${action} to ${expected}`, () => {
      assert.equal(resolveApprovalTransition(from, action), expected);
    });
  }

  it("returns null for an invalid transition", () => {
    assert.equal(resolveApprovalTransition("approved", "approve"), null);
  });

  it("does not persist an invalid transition", async () => {
    const request = createRequest("approved");
    let updateCount = 0;
    let historyCount = 0;
    let auditCount = 0;

    const context = {
      clock: { now: () => "2026-07-25T12:00:00.000Z" },
      idGenerator: { generate: () => "generated-id" },
      auditSource: "desktop" as const,
      authorizer: { hasPermission: async () => true },
      approvalRepository: {} as never,
      auditRepository: {} as never,
      unitOfWork: {
        transaction: async <T>(action: (repositories: any) => Promise<T>) => action({
          approval: {
            findById: async () => request,
            update: async (value: ApprovalRequest) => {
              updateCount += 1;
              return value;
            },
            addHistory: async () => {
              historyCount += 1;
            }
          },
          audit: {
            create: async () => {
              auditCount += 1;
            }
          }
        })
      }
    };

    await assert.rejects(
      () => applyApprovalAction(context, {
        approvalRequestId: request.id,
        action: "approve",
        actor
      }),
      ApprovalInvalidTransitionError
    );

    assert.equal(updateCount, 0);
    assert.equal(historyCount, 0);
    assert.equal(auditCount, 0);
  });
});
