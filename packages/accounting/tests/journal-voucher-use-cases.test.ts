import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvent, NumberSeries } from "@argin/platform";

import { createAccount } from "../src/domain/create-account.ts";
import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import type {
  JournalVoucherRepository,
} from "../src/contracts/journal-voucher-repository.ts";
import type {
  JournalVoucherRuntimeDependencies,
  JournalVoucherUnitOfWork,
  JournalVoucherUnitOfWorkRepositories,
} from "../src/contracts/journal-voucher-runtime.ts";
import {
  JournalVoucherApplicationError,
} from "../src/application/journal-voucher-application-error.ts";
import {
  createJournalVoucherDraft,
  deleteJournalVoucherDraft,
  updateJournalVoucherDraft,
} from "../src/application/journal-voucher-use-cases.ts";

class MemoryJournalRepository implements JournalVoucherRepository {
  constructor(readonly records = new Map<string, JournalVoucher>()) {}

  async create(voucher: JournalVoucher): Promise<void> {
    if ([...this.records.values()].some((item) =>
      item.companyId === voucher.companyId &&
      item.source.requestId !== null &&
      item.source.requestId === voucher.source.requestId
    )) {
      throw new Error("duplicate request id");
    }
    this.records.set(voucher.id, voucher);
  }

  async findById(id: string): Promise<JournalVoucher | null> {
    return this.records.get(id) ?? null;
  }

  async findByRequestId(companyId: string, requestId: string): Promise<JournalVoucher | null> {
    return [...this.records.values()].find((voucher) =>
      voucher.companyId === companyId && voucher.source.requestId === requestId
    ) ?? null;
  }

  async findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string | null,
    number: string,
  ): Promise<JournalVoucher | null> {
    return [...this.records.values()].find((voucher) =>
      voucher.companyId === companyId &&
      voucher.fiscalYearId === fiscalYearId &&
      voucher.branchId === branchId &&
      voucher.number === number
    ) ?? null;
  }

  async search(): Promise<never> {
    throw new Error("not used by mutation tests");
  }

  async update(voucher: JournalVoucher, expectedVersion: number): Promise<void> {
    const current = this.records.get(voucher.id);
    if (!current || current.version !== expectedVersion) {
      throw new Error("optimistic concurrency version conflict");
    }
    this.records.set(voucher.id, voucher);
  }

  async deleteDraft(id: string, companyId: string, expectedVersion: number): Promise<void> {
    const current = this.records.get(id);
    if (!current || current.companyId !== companyId || current.version !== expectedVersion) {
      throw new Error("optimistic concurrency version conflict");
    }
    this.records.delete(id);
  }
}

class MemoryUnitOfWork implements JournalVoucherUnitOfWork {
  records = new Map<string, JournalVoucher>();
  failAfterOperation = false;
  running = false;

  async run<T>(
    operation: (repositories: JournalVoucherUnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    const transactionRecords = new Map(this.records);
    const repository = new MemoryJournalRepository(transactionRecords);
    this.running = true;
    try {
      const result = await operation({ journals: repository });
      if (this.failAfterOperation) {
        this.failAfterOperation = false;
        throw new Error("forced transaction rollback");
      }
      this.records = transactionRecords;
      return result;
    } finally {
      this.running = false;
    }
  }
}

class CountingNumberSeries implements NumberSeries {
  calls = 0;

  async next(request: Parameters<NumberSeries["next"]>[0]) {
    this.calls += 1;
    return {
      seriesType: request.seriesType,
      scope: request.scope,
      sequence: this.calls,
      formattedValue: String(this.calls).padStart(6, "0"),
    };
  }
}

const fiscal = Object.freeze({
  companyId: "company-1",
  fiscalYearId: "fy-1405",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalYearStatus: "open" as const,
  fiscalPeriodId: "period-01",
  fiscalPeriodStartDate: "2026-03-21",
  fiscalPeriodEndDate: "2026-04-20",
  fiscalPeriodStatus: "open" as const,
});

const debitAccount = createAccount({
  id: "account-debit",
  companyId: "company-1",
  parentId: "general-1",
  level: "subsidiary",
  code: "110101",
  name: "بانک",
  nature: "debit",
  normalBalance: "debit",
  statementType: "balance_sheet",
  postingAllowed: true,
  createdAt: "2026-03-21T00:00:00.000Z",
});

const creditAccount = createAccount({
  id: "account-credit",
  companyId: "company-1",
  parentId: "general-2",
  level: "subsidiary",
  code: "310101",
  name: "سرمایه",
  nature: "credit",
  normalBalance: "credit",
  statementType: "balance_sheet",
  postingAllowed: true,
  createdAt: "2026-03-21T00:00:00.000Z",
});

function command(requestId = "request-1") {
  return {
    context: {
      actorId: "user-1",
      companyId: "company-1",
      branchId: null,
      requestId,
      correlationId: "correlation-1",
      causationId: "causation-1",
    },
    voucherDate: "2026-04-01",
    reference: "REF-1",
    description: "سند افتتاحیه آزمایشی",
    lines: [
      { order: 1, accountId: debitAccount.id, debit: 1_000, credit: 0 },
      { order: 2, accountId: creditAccount.id, debit: 0, credit: 1_000 },
    ],
  } as const;
}

function dependencies(authorized = true) {
  const unitOfWork = new MemoryUnitOfWork();
  const numberSeries = new CountingNumberSeries();
  const published: Array<{ event: DomainEvent; insideTransaction: boolean }> = [];
  let nextId = 0;
  const accounts = new Map([
    [debitAccount.id, debitAccount],
    [creditAccount.id, creditAccount],
  ]);
  const value: JournalVoucherRuntimeDependencies = {
    authorizer: { hasPermission: async () => authorized },
    clock: { now: () => new Date("2026-04-01T08:00:00.000Z") },
    identifiers: { generate: () => `generated-${++nextId}` },
    events: {
      publish: async (event) => {
        published.push({ event, insideTransaction: unitOfWork.running });
      },
      publishMany: async (events) => {
        for (const event of events) {
          published.push({ event, insideTransaction: unitOfWork.running });
        }
      },
    },
    numberSeries,
    accounts: { findById: async (id) => accounts.get(id) ?? null },
    fiscalContext: { resolve: async () => fiscal },
    dimensions: {
      findPoliciesForAccounts: async () => [],
      findTypesByCompanyId: async () => [],
      findMembersByIds: async () => [],
    },
    unitOfWork,
  };
  return { value, unitOfWork, numberSeries, accounts, published };
}

test("create draft commits before publishing its audit/integration event", async () => {
  const runtime = dependencies();
  const result = await createJournalVoucherDraft(command(), runtime.value);

  assert.equal(result.replayed, false);
  assert.equal(result.voucher.number, "000001");
  assert.equal(result.voucher.version, 1);
  assert.equal(result.voucher.source.requestId, "request-1");
  assert.equal(result.voucher.lines.length, 2);
  assert.equal(runtime.numberSeries.calls, 1);
  assert.equal(runtime.unitOfWork.records.size, 1);
  assert.equal(runtime.published.length, 1);
  assert.equal(runtime.published[0]?.insideTransaction, false);
  assert.equal(runtime.published[0]?.event.eventType, "accounting.journal-voucher.created");
  assert.equal(runtime.published[0]?.event.correlationId, "correlation-1");
  assert.equal(runtime.published[0]?.event.causationId, "causation-1");
  assert.equal(runtime.published[0]?.event.metadata.audit, true);
  assert.equal(runtime.published[0]?.event.metadata.integration, true);
});

test("retry with the same request id replays the committed voucher without another number or success event", async () => {
  const runtime = dependencies();
  const first = await createJournalVoucherDraft(command(), runtime.value);
  const retry = await createJournalVoucherDraft(command(), runtime.value);

  assert.equal(retry.replayed, true);
  assert.equal(retry.voucher.id, first.voucher.id);
  assert.equal(retry.voucher.number, first.voucher.number);
  assert.equal(runtime.numberSeries.calls, 1);
  assert.equal(runtime.unitOfWork.records.size, 1);
  assert.equal(runtime.published.length, 1);
});

test("unauthorized create records security audit evidence before rejecting", async () => {
  const runtime = dependencies(false);
  await assert.rejects(
    () => createJournalVoucherDraft(command(), runtime.value),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.unauthorized",
  );
  assert.equal(runtime.numberSeries.calls, 0);
  assert.equal(runtime.unitOfWork.records.size, 0);
  assert.equal(runtime.published.length, 1);
  assert.equal(
    runtime.published[0]?.event.eventType,
    "accounting.journal-voucher.authorization-denied",
  );
  assert.equal(runtime.published[0]?.event.metadata.audit, true);
  assert.equal(runtime.published[0]?.event.metadata.security, true);
  assert.equal(runtime.published[0]?.event.metadata.integration, false);
});

test("ineligible or missing accounts fail before the journal transaction commits", async () => {
  const runtime = dependencies();
  runtime.accounts.delete(creditAccount.id);
  await assert.rejects(
    () => createJournalVoucherDraft(command(), runtime.value),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.account-not-found",
  );
  assert.equal(runtime.numberSeries.calls, 0);
  assert.equal(runtime.unitOfWork.records.size, 0);
  assert.equal(runtime.published.length, 0);
});

test("transaction failure leaves no partial voucher and emits no success event", async () => {
  const runtime = dependencies();
  runtime.unitOfWork.failAfterOperation = true;
  await assert.rejects(
    () => createJournalVoucherDraft(command(), runtime.value),
    /forced transaction rollback/,
  );
  assert.equal(runtime.unitOfWork.records.size, 0);
  assert.equal(runtime.numberSeries.calls, 1);
  assert.equal(runtime.published.length, 0);
});

test("update preserves identity and number, increments version, and publishes after commit", async () => {
  const runtime = dependencies();
  const created = await createJournalVoucherDraft(command(), runtime.value);
  const result = await updateJournalVoucherDraft({
    context: command().context,
    voucherId: created.voucher.id,
    expectedVersion: 1,
    voucherDate: "2026-04-02",
    reference: "REF-2",
    description: "ویرایش سند",
    lines: [
      { id: created.voucher.lines[0]!.id, order: 1, accountId: debitAccount.id, debit: 2_000, credit: 0 },
      { id: created.voucher.lines[1]!.id, order: 2, accountId: creditAccount.id, debit: 0, credit: 2_000 },
    ],
  }, runtime.value);

  assert.equal(result.voucher.id, created.voucher.id);
  assert.equal(result.voucher.number, created.voucher.number);
  assert.equal(result.voucher.createdAt, created.voucher.createdAt);
  assert.equal(result.voucher.version, 2);
  assert.equal(result.voucher.reference, "REF-2");
  assert.equal(runtime.published.at(-1)?.insideTransaction, false);
  assert.equal(
    runtime.published.at(-1)?.event.eventType,
    "accounting.journal-voucher.draft-updated",
  );
  assert.equal(runtime.published.at(-1)?.event.aggregateVersion, 2);
});

test("stale update returns the stable application version-conflict error without update event", async () => {
  const runtime = dependencies();
  const created = await createJournalVoucherDraft(command(), runtime.value);
  await assert.rejects(
    () => updateJournalVoucherDraft({
      context: command().context,
      voucherId: created.voucher.id,
      expectedVersion: 99,
      voucherDate: created.voucher.voucherDate,
      lines: command().lines,
    }, runtime.value),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.version-conflict",
  );
  assert.deepEqual(
    runtime.published.map(({ event }) => event.eventType),
    ["accounting.journal-voucher.created"],
  );
});

test("delete draft removes the aggregate and publishes only after commit", async () => {
  const runtime = dependencies();
  const created = await createJournalVoucherDraft(command(), runtime.value);
  const deleted = await deleteJournalVoucherDraft({
    context: command().context,
    voucherId: created.voucher.id,
    expectedVersion: 1,
  }, runtime.value);

  assert.equal(deleted.id, created.voucher.id);
  assert.equal(runtime.unitOfWork.records.size, 0);
  assert.equal(runtime.published.at(-1)?.insideTransaction, false);
  assert.equal(
    runtime.published.at(-1)?.event.eventType,
    "accounting.journal-voucher.draft-deleted",
  );
});
