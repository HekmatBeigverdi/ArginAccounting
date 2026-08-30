import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyBulkTransferService,
  partyPermissions,
  type PageResult,
  type Party,
  type PartyAuditEvent,
  type PartyDuplicateLookup,
  type PartyReader,
  type PartyRepository,
  type PartySummaryDto,
  type PartyUnitOfWork
} from "../src/index.ts";

class MemoryPartyRepository implements PartyRepository {
  readonly values: Party[] = [];
  async findById(companyId: string, partyId: string): Promise<Party | null> {
    return this.values.find((party) => party.companyId === companyId && party.id === partyId) ?? null;
  }
  async findByCode(companyId: string, code: string): Promise<Party | null> {
    return this.values.find((party) => party.companyId === companyId && party.code === code) ?? null;
  }
  async add(party: Party): Promise<void> { this.values.push(party); }
  async update(): Promise<void> { throw new Error("not used"); }
}

const context = {
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-1",
  requestId: "req-1",
  occurredAt: "2026-08-30T12:00:00.000Z"
} as const;

const mapping = {
  classification: "نوع",
  code: "کد",
  firstName: "نام",
  lastName: "نام خانوادگی",
  roles: "نقش",
  mobile: "موبایل"
} as const;

function service(repository: MemoryPartyRepository, summaryPages: readonly (readonly PartySummaryDto[])[] = []) {
  let transactions = 0;
  const uow: PartyUnitOfWork = {
    run: async (operation) => {
      transactions += 1;
      return operation({ parties: repository });
    }
  };
  const duplicates: PartyDuplicateLookup = {
    findHardCandidates: async () => [],
    findAdvisoryCandidates: async () => []
  };
  const reader: PartyReader = {
    getById: async () => null,
    select: async () => [],
    list: async (query): Promise<PageResult<PartySummaryDto>> => {
      const items = summaryPages[query.page.page - 1] ?? [];
      return {
        items,
        page: query.page.page,
        pageSize: query.page.pageSize,
        totalItems: summaryPages.reduce((sum, page) => sum + page.length, 0),
        totalPages: summaryPages.length
      };
    }
  };
  const events: PartyAuditEvent[] = [];
  const permissions: string[] = [];
  let id = 0;
  const instance = new PartyBulkTransferService(
    uow,
    duplicates,
    reader,
    { require: async (_context, permission) => { permissions.push(permission); } },
    { record: async (event) => { events.push(event); } },
    { nextId: () => `party-${++id}` }
  );
  return { instance, events, permissions, transactions: () => transactions };
}

test("preview reports duplicates inside the same import file", async () => {
  const repository = new MemoryPartyRepository();
  const { instance } = service(repository);
  const preview = await instance.previewImport([
    { "نوع": "حقیقی", "کد": "1001", "نام": "علی", "نام خانوادگی": "رضایی" },
    { "نوع": "حقیقی", "کد": "1001", "نام": "رضا", "نام خانوادگی": "محمدی" }
  ], mapping, context);

  assert.equal(preview.invalidRows, 2);
  assert.ok(preview.rows.every((row) => row.issues.some((issue) => issue.code === "party.import.batchDuplicate")));
});

test("atomic import writes valid rows in one unit of work with globally scoped child ids", async () => {
  const repository = new MemoryPartyRepository();
  const state = service(repository);
  const result = await state.instance.import([
    { "نوع": "حقیقی", "کد": "1001", "نام": "علی", "نام خانوادگی": "رضایی", "نقش": "مشتری", "موبایل": "09121234567" },
    { "نوع": "حقیقی", "کد": "1002", "نام": "رضا", "نام خانوادگی": "محمدی", "نقش": "supplier", "موبایل": "09121111111" }
  ], mapping, context, { atomic: true });

  assert.equal(result.importedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.equal(state.transactions(), 1);
  assert.equal(repository.values.length, 2);
  assert.notEqual(repository.values[0]?.contacts[0]?.id, repository.values[1]?.contacts[0]?.id);
  assert.ok(repository.values[0]?.contacts[0]?.id.startsWith(`${repository.values[0]?.id}:`));
  assert.equal(state.permissions[0], partyPermissions.import);
  assert.equal(state.events[0]?.action, "party.import");
});

test("atomic import with invalid rows performs no writes", async () => {
  const repository = new MemoryPartyRepository();
  const state = service(repository);
  const result = await state.instance.import([
    { "نوع": "حقیقی", "کد": "1001", "نام": "", "نام خانوادگی": "رضایی" }
  ], mapping, context, { atomic: true });

  assert.equal(result.importedCount, 0);
  assert.equal(result.failedCount, 1);
  assert.equal(state.transactions(), 0);
  assert.equal(repository.values.length, 0);
});

test("export reads bounded pages and writes batches", async () => {
  const repository = new MemoryPartyRepository();
  const row = (id: string, code: string): PartySummaryDto => ({
    id,
    companyId: context.companyId,
    code,
    classification: "natural-person",
    displayName: `شخص ${code}`,
    status: "active",
    roles: ["customer"],
    primaryPhone: null,
    primaryMobile: "09121234567",
    primaryEmail: null,
    updatedAt: context.occurredAt
  });
  const state = service(repository, [[row("p1", "1001")], [row("p2", "1002")]]);
  const batches: unknown[][] = [];
  const count = await state.instance.export(context, { write: async (rows) => { batches.push([...rows]); } }, 1);

  assert.equal(count, 2);
  assert.equal(batches.length, 2);
  assert.equal(state.permissions[0], partyPermissions.export);
  assert.equal(state.events[0]?.action, "party.export");
});
