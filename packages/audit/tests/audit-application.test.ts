import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  recordAuditEntry
} from "../src/application/audit/record-audit-entry.ts";

import {
  searchAuditEntries
} from "../src/application/audit/search-audit-entries.ts";

import {
  AuditPermissionDeniedError
} from "../src/application/audit-permissions.ts";

import type {
  AuditEntry
} from "../src/domain/audit-entry.ts";

function createContext(permissions: string[]) {
  const entries: AuditEntry[] = [];
  const permissionSet = new Set(permissions);

  const auditRepository = {
    async create(entry: AuditEntry) {
      entries.push(entry);
    },
    async findById(id: string) {
      return entries.find((entry) => entry.id === id) ?? null;
    },
    async search(query: any) {
      const items = entries.filter((entry) => {
        if (query.action && entry.action !== query.action) return false;
        if (query.outcome && entry.outcome !== query.outcome) return false;
        if (query.entityType && entry.target.entityType !== query.entityType) return false;
        return true;
      });

      return {
        items,
        totalCount: items.length,
        offset: query.offset ?? 0,
        limit: query.limit ?? 50
      };
    }
  };

  return {
    context: {
      clock: { now: () => "2026-07-25T14:00:00.000Z" },
      idGenerator: { generate: () => "audit-1" },
      authorizer: {
        hasPermission: async (permission: string) => permissionSet.has(permission)
      },
      auditRepository
    },
    entries
  };
}

describe("audit application services", () => {
  it("records a sanitized audit entry", async () => {
    const { context, entries } = createContext([
      "audit.entries.record"
    ]);

    const entry = await recordAuditEntry(context, {
      action: "update",
      source: "desktop",
      actor: {
        type: "user",
        id: "user-1",
        displayName: "Test User"
      },
      target: {
        entityType: "user",
        entityId: "user-2",
        entityDisplayName: "Second User"
      },
      before: {
        username: "second",
        password: "secret-before"
      },
      after: {
        username: "second-updated",
        password: "secret-after"
      }
    });

    assert.equal(entries.length, 1);
    assert.equal(entry.id, "audit-1");
    assert.equal(entry.occurredAt, "2026-07-25T14:00:00.000Z");
    assert.notEqual(entry.before?.password, "secret-before");
    assert.notEqual(entry.after?.password, "secret-after");
  });

  it("passes query filters to the repository", async () => {
    const { context } = createContext([
      "audit.entries.record",
      "audit.entries.view"
    ]);

    await recordAuditEntry(context, {
      action: "approve",
      source: "desktop",
      actor: {
        type: "user",
        id: "user-1",
        displayName: "Approver"
      },
      target: {
        entityType: "journal-voucher",
        entityId: "voucher-1",
        entityDisplayName: "JV-0001"
      }
    });

    const result = await searchAuditEntries(context, {
      action: "approve",
      entityType: "journal-voucher",
      offset: 0,
      limit: 25
    });

    assert.equal(result.totalCount, 1);
    assert.equal(result.items[0]?.action, "approve");
    assert.equal(result.limit, 25);
  });

  it("rejects reading audit entries without permission", async () => {
    const { context } = createContext([]);

    await assert.rejects(
      () => searchAuditEntries(context, { limit: 10 }),
      AuditPermissionDeniedError
    );
  });
});
