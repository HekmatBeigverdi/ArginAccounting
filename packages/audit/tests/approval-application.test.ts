import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createApprovalRequestService
} from "../src/application/approval/create-approval-request-service.ts";

import {
  applyApprovalAction
} from "../src/application/approval/apply-approval-action.ts";

import {
  AuditPermissionDeniedError
} from "../src/application/audit-permissions.ts";

import type {
  ApprovalHistoryEntry
} from "../src/domain/approval/approval-history-entry.ts";

import type {
  ApprovalRequest
} from "../src/domain/approval/approval-request.ts";

import type {
  AuditEntry
} from "../src/domain/audit-entry.ts";

const actor = {
  type: "user" as const,
  id: "user-1",
  displayName: "Test User"
};

function createContext(options?: {
  permissions?: string[];
  failAudit?: boolean;
}) {
  const approvals: ApprovalRequest[] = [];
  const histories: ApprovalHistoryEntry[] = [];
  const audits: AuditEntry[] = [];
  let sequence = 0;
  let transactionCount = 0;

  const approvalRepository = {
    async create(request: ApprovalRequest) {
      approvals.push(request);
    },
    async update(request: ApprovalRequest) {
      const index = approvals.findIndex((item) => item.id === request.id);
      const updated = { ...request, version: request.version + 1 };
      if (index >= 0) approvals[index] = updated;
      return updated;
    },
    async findById(id: string) {
      const request = approvals.find((item) => item.id === id);
      if (!request) return null;
      return {
        ...request,
        history: histories.filter((item) => item.approvalRequestId === id)
      };
    },
    async search() {
      return { items: [], totalCount: 0, offset: 0, limit: 50 };
    },
    async addHistory(history: ApprovalHistoryEntry) {
      histories.push(history);
    }
  };

  const auditRepository = {
    async create(entry: AuditEntry) {
      if (options?.failAudit) throw new Error("audit persistence failed");
      audits.push(entry);
    },
    async findById() {
      return null;
    },
    async search() {
      return { items: [], totalCount: 0, offset: 0, limit: 50 };
    }
  };

  const unitOfWork = {
    async transaction<T>(action: (repositories: any) => Promise<T>): Promise<T> {
      transactionCount += 1;
      const approvalSnapshot = approvals.slice();
      const historySnapshot = histories.slice();
      const auditSnapshot = audits.slice();

      try {
        return await action({
          approval: approvalRepository,
          audit: auditRepository
        });
      } catch (error) {
        approvals.splice(0, approvals.length, ...approvalSnapshot);
        histories.splice(0, histories.length, ...historySnapshot);
        audits.splice(0, audits.length, ...auditSnapshot);
        throw error;
      }
    }
  };

  const permissions = new Set(options?.permissions ?? []);

  return {
    context: {
      clock: { now: () => "2026-07-25T12:00:00.000Z" },
      idGenerator: { generate: () => `generated-${++sequence}` },
      auditSource: "desktop" as const,
      authorizer: {
        hasPermission: async (permission: string) => permissions.has(permission)
      },
      approvalRepository,
      auditRepository,
      unitOfWork
    },
    state: {
      approvals,
      histories,
      audits,
      get transactionCount() {
        return transactionCount;
      }
    }
  };
}

const createCommand = {
  requestType: "journal-voucher",
  title: "Approve voucher",
  description: "Voucher requires manager approval",
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
  createdBy: actor,
  correlationId: "correlation-1"
};

describe("approval application workflow", () => {
  it("creates approval, history and audit in one transaction", async () => {
    const { context, state } = createContext({
      permissions: ["approval.requests.create"]
    });

    const result = await createApprovalRequestService(context, createCommand);

    assert.equal(state.transactionCount, 1);
    assert.equal(state.approvals.length, 1);
    assert.equal(state.histories.length, 1);
    assert.equal(state.audits.length, 1);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0]?.action, "create");
    assert.equal(state.audits[0]?.correlationId, "correlation-1");
  });

  it("rolls back approval and history when audit persistence fails", async () => {
    const { context, state } = createContext({
      permissions: ["approval.requests.create"],
      failAudit: true
    });

    await assert.rejects(
      () => createApprovalRequestService(context, createCommand),
      /audit persistence failed/
    );

    assert.equal(state.approvals.length, 0);
    assert.equal(state.histories.length, 0);
    assert.equal(state.audits.length, 0);
  });

  it("checks permission before opening a transaction", async () => {
    const { context, state } = createContext();

    await assert.rejects(
      () => createApprovalRequestService(context, createCommand),
      AuditPermissionDeniedError
    );

    assert.equal(state.transactionCount, 0);
    assert.equal(state.approvals.length, 0);
  });

  it("submits a draft and records history plus audit atomically", async () => {
    const { context, state } = createContext({
      permissions: [
        "approval.requests.create",
        "approval.requests.submit"
      ]
    });

    const created = await createApprovalRequestService(context, createCommand);
    const submitted = await applyApprovalAction(context, {
      approvalRequestId: created.id,
      action: "submit",
      actor,
      comment: "Ready for review",
      correlationId: "correlation-2"
    });

    assert.equal(submitted.status, "pending");
    assert.equal(submitted.version, 2);
    assert.equal(submitted.history.length, 2);
    assert.equal(state.histories.length, 2);
    assert.equal(state.audits.length, 2);
    assert.equal(state.audits[1]?.correlationId, "correlation-2");
  });
});
