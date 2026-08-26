import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { JournalVoucher } from "@argin/accounting/journal";
import type {
  DatabaseExecuteResult,
  DatabaseSession,
  DatabaseValue,
} from "@argin/database";
import { SqliteJournalVoucherRepository } from "../src/index.ts";

class StaleSession implements DatabaseSession {
  readonly executed: Array<{ sql: string; parameters: readonly DatabaseValue[] }> = [];

  async execute(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<DatabaseExecuteResult> {
    this.executed.push({ sql, parameters });
    return { rowsAffected: 0 };
  }

  async query<T>(): Promise<T[]> { return []; }
  async queryOne<T>(): Promise<T | null> { return null; }
}

function voucher(): JournalVoucher {
  return {
    id: "voucher-1",
    companyId: "company-1",
    branchId: null,
    number: "000001",
    reference: null,
    voucherDate: "2026-08-24",
    fiscalYearId: "fy-1",
    fiscalPeriodId: "period-1",
    description: null,
    status: "posted",
    currency: "IRR",
    source: {
      type: "manual",
      sourceId: null,
      requestId: null,
      correlationId: null,
      causationId: null,
    },
    lines: [],
    totalDebit: { amount: 0, currency: "IRR" },
    totalCredit: { amount: 0, currency: "IRR" },
    createdAt: "2026-08-24T09:00:00.000Z",
    updatedAt: "2026-08-24T10:00:00.000Z",
    version: 5,
  } as unknown as JournalVoucher;
}

describe("sqlite journal lifecycle optimistic concurrency", () => {
  it("rejects a stale lifecycle compare-and-swap without a second write", async () => {
    const database = new StaleSession();
    const repository = new SqliteJournalVoucherRepository(database);

    await assert.rejects(
      () => repository.updateLifecycleState(voucher(), 4),
      (error: unknown) =>
        error instanceof Error &&
        /version|concurr|stale/iu.test(`${error.name} ${error.message}`),
    );

    assert.equal(database.executed.length, 1);
    assert.match(database.executed[0]!.sql, /WHERE id = \? AND company_id = \? AND version = \?/u);
    assert.deepEqual(database.executed[0]!.parameters.slice(-3), ["voucher-1", "company-1", 4]);
  });
});
