import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvent, NumberSeries } from "@argin/platform";

import {
  createAccount,
  type Account,
  type AccountDimensionPolicy,
  type AccountingDimensionMember,
  type AccountingDimensionType,
} from "../src/index.ts";
import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import type { JournalVoucherRepository } from "../src/contracts/journal-voucher-repository.ts";
import type {
  JournalVoucherRuntimeDependencies,
  JournalVoucherUnitOfWork,
  JournalVoucherUnitOfWorkRepositories,
} from "../src/contracts/journal-voucher-runtime.ts";
import type { JournalFiscalContext } from "../src/validation/journal-voucher-eligibility.ts";
import { JournalVoucherApplicationError } from "../src/application/journal-voucher-application-error.ts";
import {
  createJournalVoucherDraft,
  deleteJournalVoucherDraft,
  updateJournalVoucherDraft,
} from "../src/application/journal-voucher-use-cases.ts";

class MemoryRepository implements JournalVoucherRepository {
  constructor(readonly records: Map<string, JournalVoucher>) {}

  async create(voucher: JournalVoucher): Promise<void> {
    this.records.set(voucher.id, voucher);
  }

  async findById(id: string): Promise<JournalVoucher | null> {
    return this.records.get(id) ?? null;
  }

  async findByRequestId(companyId: string, requestId: string): Promise<JournalVoucher | null> {
    return [...this.records.values()].find(
      (voucher) => voucher.companyId === companyId && voucher.source.requestId === requestId,
    ) ?? null;
  }

  async findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string | null,
    number: string,
  ): Promise<JournalVoucher | null> {
    return [...this.records.values()].find(
      (voucher) =>
        voucher.companyId === companyId &&
        voucher.fiscalYearId === fiscalYearId &&
        voucher.branchId === branchId &&
        voucher.number === number,
    ) ?? null;
  }

  async search(): Promise<never> {
    throw new Error("not used by edge-case mutation tests");
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

  async run<T>(
    operation: (repositories: JournalVoucherUnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    const transactionRecords = new Map(this.records);
    const result = await operation({ journals: new MemoryRepository(transactionRecords) });
    this.records = transactionRecords;
    return result;
  }
}

class CountingSeries implements NumberSeries {
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

const openFiscal: JournalFiscalContext = Object.freeze({
  companyId: "company-1",
  fiscalYearId: "fy-1405",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalYearStatus: "open",
  fiscalPeriodId: "period-01",
  fiscalPeriodStartDate: "2026-03-21",
  fiscalPeriodEndDate: "2026-04-20",
  fiscalPeriodStatus: "open",
});

function postingAccount(id: string, nature: "debit" | "credit", overrides: Partial<Account> = {}): Account {
  return createAccount({
    id,
    companyId: "company-1",
    parentId: nature === "debit" ? "general-assets" : "general-equity",
    level: "subsidiary",
    code: nature === "debit" ? "110101" : "310101",
    name: nature === "debit" ? "بانک" : "سرمایه",
    nature,
    normalBalance: nature,
    statementType: "balance_sheet",
    postingAllowed: true,
    status: "active",
    createdAt: "2026-03-21T00:00:00.000Z",
    ...overrides,
  });
}

const debitAccount = postingAccount("account-debit", "debit");
const creditAccount = postingAccount("account-credit", "credit");

function baseCommand() {
  return {
    context: {
      actorId: "user-1",
      companyId: "company-1",
      branchId: null,
      requestId: "request-edge-1",
      correlationId: "correlation-edge-1",
    },
    voucherDate: "2026-04-01",
    description: "آزمون مسیرهای مرزی سند",
    lines: [
      { order: 1, accountId: debitAccount.id, debit: 1_000, credit: 0 },
      { order: 2, accountId: creditAccount.id, debit: 0, credit: 1_000 },
    ],
  } as const;
}

function runtime() {
  const unitOfWork = new MemoryUnitOfWork();
  const numberSeries = new CountingSeries();
  const accounts = new Map<string, Account>([
    [debitAccount.id, debitAccount],
    [creditAccount.id, creditAccount],
  ]);
  const published: DomainEvent[] = [];
  let fiscal: JournalFiscalContext = openFiscal;
  let policies: readonly AccountDimensionPolicy[] = [];
  let dimensionTypes: readonly AccountingDimensionType[] = [];
  let members: readonly AccountingDimensionMember[] = [];
  let nextId = 0;

  const dependencies: JournalVoucherRuntimeDependencies = {
    authorizer: { hasPermission: async () => true },
    clock: { now: () => new Date("2026-04-01T08:00:00.000Z") },
    identifiers: { generate: () => `edge-generated-${++nextId}` },
    events: {
      publish: async (event) => { published.push(event); },
      publishMany: async (events) => { published.push(...events); },
    },
    numberSeries,
    accounts: { findById: async (id) => accounts.get(id) ?? null },
    fiscalContext: { resolve: async () => fiscal },
    dimensions: {
      findPoliciesForAccounts: async () => policies,
      findTypesByCompanyId: async () => dimensionTypes,
      findMembersByIds: async () => members,
    },
    unitOfWork,
  };

  return {
    dependencies,
    unitOfWork,
    numberSeries,
    accounts,
    published,
    setFiscal(value: JournalFiscalContext) { fiscal = value; },
    setDimensions(input: {
      policies?: readonly AccountDimensionPolicy[];
      types?: readonly AccountingDimensionType[];
      members?: readonly AccountingDimensionMember[];
    }) {
      policies = input.policies ?? [];
      dimensionTypes = input.types ?? [];
      members = input.members ?? [];
    },
  };
}

function assertApplicationError(code: string) {
  return (error: unknown) =>
    error instanceof JournalVoucherApplicationError && error.code === code;
}

test("create rejects locked fiscal period before numbering or persistence", async () => {
  const testRuntime = runtime();
  testRuntime.setFiscal({ ...openFiscal, fiscalPeriodStatus: "locked" });

  await assert.rejects(
    () => createJournalVoucherDraft(baseCommand(), testRuntime.dependencies),
    assertApplicationError("journal.validation-failed"),
  );

  assert.equal(testRuntime.numberSeries.calls, 0);
  assert.equal(testRuntime.unitOfWork.records.size, 0);
  assert.equal(testRuntime.published.length, 0);
});

test("create rejects inactive account at the application boundary", async () => {
  const testRuntime = runtime();
  testRuntime.accounts.set(
    debitAccount.id,
    postingAccount(debitAccount.id, "debit", { status: "inactive" }),
  );

  await assert.rejects(
    () => createJournalVoucherDraft(baseCommand(), testRuntime.dependencies),
    assertApplicationError("journal.validation-failed"),
  );

  assert.equal(testRuntime.numberSeries.calls, 0);
  assert.equal(testRuntime.unitOfWork.records.size, 0);
});

test("create rejects non-postable account at the application boundary", async () => {
  const testRuntime = runtime();
  testRuntime.accounts.set(
    debitAccount.id,
    postingAccount(debitAccount.id, "debit", { postingAllowed: false }),
  );

  await assert.rejects(
    () => createJournalVoucherDraft(baseCommand(), testRuntime.dependencies),
    assertApplicationError("journal.validation-failed"),
  );

  assert.equal(testRuntime.numberSeries.calls, 0);
  assert.equal(testRuntime.unitOfWork.records.size, 0);
});

test("create maps an unbalanced aggregate failure to the stable application validation error", async () => {
  const testRuntime = runtime();
  const command = baseCommand();

  await assert.rejects(
    () => createJournalVoucherDraft({
      ...command,
      lines: [
        command.lines[0],
        { ...command.lines[1], credit: 900 },
      ],
    }, testRuntime.dependencies),
    assertApplicationError("journal.validation-failed"),
  );

  assert.equal(testRuntime.numberSeries.calls, 1);
  assert.equal(testRuntime.unitOfWork.records.size, 0);
  assert.equal(testRuntime.published.length, 0);
});

test("create rejects a missing required dimension before persistence", async () => {
  const testRuntime = runtime();
  const now = "2026-03-21T00:00:00.000Z";
  testRuntime.setDimensions({
    policies: [{
      id: "policy-cost-center",
      companyId: "company-1",
      accountId: debitAccount.id,
      dimensionTypeId: "dimension-cost-center",
      requirement: "required",
      createdAt: now,
      updatedAt: now,
      version: 1,
    }],
    types: [{
      id: "dimension-cost-center",
      companyId: "company-1",
      code: "CC",
      name: "مرکز هزینه",
      englishName: null,
      hierarchical: false,
      allowMultipleMembers: false,
      status: "active",
      displayOrder: 1,
      source: "manual",
      sourceReferenceId: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }],
  });

  await assert.rejects(
    () => createJournalVoucherDraft(baseCommand(), testRuntime.dependencies),
    assertApplicationError("journal.dimension-validation-failed"),
  );

  assert.equal(testRuntime.numberSeries.calls, 1);
  assert.equal(testRuntime.unitOfWork.records.size, 0);
  assert.equal(testRuntime.published.length, 0);
});

test("cross-company update is hidden as not-found and leaves the voucher unchanged", async () => {
  const testRuntime = runtime();
  const created = await createJournalVoucherDraft(baseCommand(), testRuntime.dependencies);
  const eventsBefore = testRuntime.published.length;

  await assert.rejects(
    () => updateJournalVoucherDraft({
      context: {
        ...baseCommand().context,
        companyId: "company-2",
        requestId: null,
      },
      voucherId: created.voucher.id,
      expectedVersion: created.voucher.version,
      voucherDate: created.voucher.voucherDate,
      lines: baseCommand().lines,
    }, testRuntime.dependencies),
    assertApplicationError("journal.not-found"),
  );

  assert.equal(testRuntime.unitOfWork.records.get(created.voucher.id)?.version, 1);
  assert.equal(testRuntime.published.length, eventsBefore);
});

test("cross-company delete is hidden as not-found and does not remove the voucher", async () => {
  const testRuntime = runtime();
  const created = await createJournalVoucherDraft(baseCommand(), testRuntime.dependencies);
  const eventsBefore = testRuntime.published.length;

  await assert.rejects(
    () => deleteJournalVoucherDraft({
      context: {
        ...baseCommand().context,
        companyId: "company-2",
        requestId: null,
      },
      voucherId: created.voucher.id,
      expectedVersion: created.voucher.version,
    }, testRuntime.dependencies),
    assertApplicationError("journal.not-found"),
  );

  assert.ok(testRuntime.unitOfWork.records.has(created.voucher.id));
  assert.equal(testRuntime.published.length, eventsBefore);
});
