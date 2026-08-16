import assert from "node:assert/strict";
import test from "node:test";

import type { PagedResult } from "@argin/platform";
import type {
  JournalVoucherRepository,
  NormalizedJournalVoucherSearchQuery,
} from "../src/contracts/journal-voucher-repository.ts";
import type {
  JournalVoucherAuthorizer,
} from "../src/contracts/journal-voucher-runtime.ts";
import { createJournalVoucher } from "../src/domain/journal-voucher.ts";
import type { JournalVoucher } from "../src/domain/journal-voucher.ts";
import {
  JournalVoucherApplicationError,
} from "../src/application/journal-voucher-application-error.ts";
import {
  getJournalVoucher,
  listJournalVouchers,
  searchJournalVouchers,
} from "../src/application/journal-voucher-queries.ts";

function voucher(id = "voucher-1", companyId = "company-1"): JournalVoucher {
  return createJournalVoucher({
    id,
    companyId,
    branchId: null,
    number: "000123",
    reference: "REF-123",
    voucherDate: "2026-04-01",
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "period-01",
    description: "سند آزمایشی",
    source: {
      type: "manual",
      sourceId: "source-1",
      requestId: "request-1",
      correlationId: "correlation-1",
      causationId: null,
    },
    lines: [
      {
        id: "line-1",
        order: 1,
        accountId: "account-1",
        description: "بدهکار",
        debit: 1_000,
        credit: 0,
        dimensionAssignments: [
          { dimensionTypeId: "dim-type-1", memberIds: ["member-1"] },
        ],
      },
      {
        id: "line-2",
        order: 2,
        accountId: "account-2",
        description: "بستانکار",
        debit: 0,
        credit: 1_000,
      },
    ],
    createdAt: "2026-04-01T08:00:00.000Z",
  });
}

class QueryRepository implements JournalVoucherRepository {
  lastSearch: NormalizedJournalVoucherSearchQuery | null = null;

  constructor(
    readonly record: JournalVoucher | null = voucher(),
    readonly pageItems: readonly JournalVoucher[] = record ? [record] : [],
  ) {}

  async create(): Promise<void> { throw new Error("not used"); }
  async update(): Promise<void> { throw new Error("not used"); }
  async deleteDraft(): Promise<void> { throw new Error("not used"); }

  async findById(id: string): Promise<JournalVoucher | null> {
    return this.record?.id === id ? this.record : null;
  }

  async findByRequestId(): Promise<JournalVoucher | null> {
    return null;
  }

  async findByNumber(): Promise<JournalVoucher | null> {
    return null;
  }

  async search(
    query: NormalizedJournalVoucherSearchQuery,
  ): Promise<PagedResult<JournalVoucher>> {
    this.lastSearch = query;
    return Object.freeze({
      items: Object.freeze([...this.pageItems]),
      page: query.page,
      pageSize: query.pageSize,
      totalItems: this.pageItems.length,
      totalPages: this.pageItems.length === 0 ? 0 : 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  }
}

function authorizer(allowed = true): JournalVoucherAuthorizer {
  return { hasPermission: async () => allowed };
}

test("get projects voucher detail including lines, money and dimension assignments", async () => {
  const repository = new QueryRepository();
  const result = await getJournalVoucher(
    { companyId: " company-1 ", voucherId: " voucher-1 " },
    repository,
    authorizer(),
  );

  assert.equal(result.id, "voucher-1");
  assert.equal(result.number, "000123");
  assert.equal(result.sourceType, "manual");
  assert.equal(result.sourceId, "source-1");
  assert.deepEqual(result.totalDebit, { amount: 1_000, currency: "IRR" });
  assert.equal(result.lines.length, 2);
  assert.deepEqual(result.lines[0]?.dimensionAssignments, [
    { dimensionTypeId: "dim-type-1", memberIds: ["member-1"] },
  ]);
});

test("read queries require the journal view permission before persistence access", async () => {
  const repository = new QueryRepository();

  await assert.rejects(
    () => getJournalVoucher(
      { companyId: "company-1", voucherId: "voucher-1" },
      repository,
      authorizer(false),
    ),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.unauthorized" &&
      error.details.permission === "accounting.journal-vouchers.view",
  );
});

test("get hides cross-company vouchers behind the stable not-found contract", async () => {
  const repository = new QueryRepository(voucher("voucher-1", "company-2"));

  await assert.rejects(
    () => getJournalVoucher(
      { companyId: "company-1", voucherId: "voucher-1" },
      repository,
      authorizer(),
    ),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.not-found",
  );
});

test("get rejects blank required identifiers before repository lookup", async () => {
  const repository = new QueryRepository();

  await assert.rejects(
    () => getJournalVoucher(
      { companyId: " ", voucherId: "voucher-1" },
      repository,
      authorizer(),
    ),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.invalid-query" &&
      error.details.field === "companyId",
  );
});

test("search normalizes all supported filters before calling persistence", async () => {
  const repository = new QueryRepository();
  const result = await searchJournalVouchers({
    companyId: " company-1 ",
    branchId: null,
    fiscalYearId: " fy-1405 ",
    fiscalPeriodId: " period-01 ",
    accountId: " account-1 ",
    sourceType: " manual ",
    reference: " REF-123 ",
    number: " 000123 ",
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    text: " آزمایشی ",
    page: 2,
    pageSize: 25,
  }, repository, authorizer());

  assert.deepEqual(repository.lastSearch, {
    companyId: "company-1",
    branchId: null,
    fiscalYearId: "fy-1405",
    fiscalPeriodId: "period-01",
    accountId: "account-1",
    sourceType: "manual",
    reference: "REF-123",
    number: "000123",
    dateFrom: "2026-04-01",
    dateTo: "2026-04-30",
    text: "آزمایشی",
    page: 2,
    pageSize: 25,
    offset: 25,
  });
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 25);
  assert.equal(result.items[0]?.id, "voucher-1");
  assert.equal("lines" in (result.items[0] ?? {}), false);
});

test("list uses the same deterministic normalized paged query path", async () => {
  const repository = new QueryRepository();
  const result = await listJournalVouchers(
    { companyId: "company-1", page: 1, pageSize: 10 },
    repository,
    authorizer(),
  );

  assert.equal(repository.lastSearch?.offset, 0);
  assert.equal(result.totalItems, 1);
  assert.equal(result.totalPages, 1);
  assert.deepEqual(result.items[0]?.totalCredit, {
    amount: 1_000,
    currency: "IRR",
  });
});

test("search rejects reversed date ranges through the shared query contract", async () => {
  const repository = new QueryRepository();

  await assert.rejects(
    () => searchJournalVouchers({
      companyId: "company-1",
      dateFrom: "2026-05-01",
      dateTo: "2026-04-01",
    }, repository, authorizer()),
    (error: unknown) =>
      error instanceof JournalVoucherApplicationError &&
      error.code === "journal.invalid-query" &&
      error.details.field === "dateRange",
  );
  assert.equal(repository.lastSearch, null);
});
