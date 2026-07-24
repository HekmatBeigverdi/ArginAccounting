import { describe, expect, it } from "vitest";

import {
  resolveApprovalTransition
} from "../src/domain/approval/approval-transition";

import {
  ApprovalInvalidTransitionError
} from "../src/application/approval/approval-application-errors";

import {
  applyApprovalAction
} from "../src/application/approval/apply-approval-action";

import type {
  ApprovalRequest
} from "../src/domain/approval/approval-request";

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
  it.each([
    ["draft", "submit", "pending"],
    ["pending", "approve", "approved"],
    ["pending", "reject", "rejected"],
    ["pending", "return-to-draft", "draft"],
    ["draft", "cancel", "cancelled"],
    ["pending", "cancel", "cancelled"]
  ] as const)("moves %s with %s to %s", (from, action, expected) => {
    expect(resolveApprovalTransition(from, action)).toBe(expected);
  });

  it("returns null for an invalid transition", () => {
    expect(resolveApprovalTransition("approved", "approve")).toBeNull();
  });

  it("throws application error and does not persist an invalid transition", async () => {
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

    await expect(
      applyApprovalAction(context, {
        approvalRequestId: request.id,
        action: "approve",
        actor
      })
    ).rejects.toBeInstanceOf(ApprovalInvalidTransitionError);

    expect(updateCount).toBe(0);
    expect(historyCount).toBe(0);
    expect(auditCount).toBe(0);
  });
});
