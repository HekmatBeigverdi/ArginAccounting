import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountingDimensionsError,
  AccountingDimensionsService,
  type AccountingDimensionMember,
  type AccountingDimensionType,
  type AccountDimensionPolicy,
  type AccountingUnitOfWork,
  type AccountingUnitOfWorkRepositories,
  createAccount,
  createAccountingDimensionMember,
  createAccountingDimensionType,
} from "../src/index.ts";
import { FixedClock, InMemoryEventBus, SequenceIdGenerator } from "@argin/platform";

const timestamp = "2026-08-01T08:00:00.000Z";

function page<T>(items: readonly T[]) {
  return { items, page: 1, pageSize: 50, totalItems: items.length, totalPages: items.length ? 1 : 0, hasPreviousPage: false, hasNextPage: false };
}

class MemoryRepositories implements AccountingUnitOfWorkRepositories {
  readonly typeValues = new Map<string, AccountingDimensionType>();
  readonly memberValues = new Map<string, AccountingDimensionMember>();
  readonly policyValues = new Map<string, AccountDimensionPolicy>();
  readonly accountValues = new Map<string, ReturnType<typeof createAccount>>();
  readonly accounts = {
    create: async (value: ReturnType<typeof createAccount>) => { this.accountValues.set(value.id, value); },
    findById: async (id: string) => this.accountValues.get(id) ?? null,
    findByCode: async (companyId: string, code: string) => [...this.accountValues.values()].find((v) => v.companyId === companyId && v.code === code) ?? null,
    findByCompanyId: async (companyId: string) => [...this.accountValues.values()].filter((v) => v.companyId === companyId),
    findChildren: async (parentId: string) => [...this.accountValues.values()].filter((v) => v.parentId === parentId),
    update: async (value: ReturnType<typeof createAccount>) => { this.accountValues.set(value.id, value); },
    delete: async (value: ReturnType<typeof createAccount>) => { this.accountValues.delete(value.id); },
  };
  readonly codingSettings = { findByCompanyId: async () => null, save: async () => {} };
  readonly dimensionTypes = {
    create: async (v: AccountingDimensionType) => { this.typeValues.set(v.id, v); },
    findById: async (id: string) => this.typeValues.get(id) ?? null,
    findByCode: async (companyId: string, code: string) => [...this.typeValues.values()].find((v) => v.companyId === companyId && v.code === code) ?? null,
    search: async (q: { companyId: string; status?: string }) => page([...this.typeValues.values()].filter((v) => v.companyId === q.companyId && (!q.status || v.status === q.status))),
    update: async (v: AccountingDimensionType) => { this.typeValues.set(v.id, v); },
    delete: async (v: AccountingDimensionType) => { this.typeValues.delete(v.id); },
  };
  readonly dimensionMembers = {
    create: async (v: AccountingDimensionMember) => { this.memberValues.set(v.id, v); },
    findById: async (id: string) => this.memberValues.get(id) ?? null,
    findByCode: async (companyId: string, typeId: string, code: string) => [...this.memberValues.values()].find((v) => v.companyId === companyId && v.dimensionTypeId === typeId && v.code === code) ?? null,
    findChildren: async (companyId: string, parentId: string) => [...this.memberValues.values()].filter((v) => v.companyId === companyId && v.parentId === parentId),
    search: async (q: { companyId: string; dimensionTypeId?: string; status?: string }) => page([...this.memberValues.values()].filter((v) => v.companyId === q.companyId && (!q.dimensionTypeId || v.dimensionTypeId === q.dimensionTypeId) && (!q.status || v.status === q.status))),
    update: async (v: AccountingDimensionMember) => { this.memberValues.set(v.id, v); },
    delete: async (v: AccountingDimensionMember) => { this.memberValues.delete(v.id); },
  };
  readonly dimensionPolicies = {
    create: async (v: AccountDimensionPolicy) => { this.policyValues.set(v.id, v); },
    findById: async (id: string) => this.policyValues.get(id) ?? null,
    findByAccountAndType: async (companyId: string, accountId: string, typeId: string) => [...this.policyValues.values()].find((v) => v.companyId === companyId && v.accountId === accountId && v.dimensionTypeId === typeId) ?? null,
    findByAccountId: async (companyId: string, accountId: string) => [...this.policyValues.values()].filter((v) => v.companyId === companyId && v.accountId === accountId),
    search: async (q: { companyId: string; dimensionTypeId?: string }) => page([...this.policyValues.values()].filter((v) => v.companyId === q.companyId && (!q.dimensionTypeId || v.dimensionTypeId === q.dimensionTypeId))),
    update: async (v: AccountDimensionPolicy) => { this.policyValues.set(v.id, v); },
    delete: async (v: AccountDimensionPolicy) => { this.policyValues.delete(v.id); },
  };
}

function fixture(options: { permissions?: readonly string[]; usedTypes?: readonly string[]; usedMembers?: readonly string[] } = {}) {
  const repositories = new MemoryRepositories();
  const unitOfWork: AccountingUnitOfWork = { run: async (operation) => operation(repositories) };
  const service = new AccountingDimensionsService(
    unitOfWork, new FixedClock(timestamp), new SequenceIdGenerator("dimension"),
    {
      isDimensionTypeInUse: async (_companyId, id) => options.usedTypes?.includes(id) ?? false,
      isMemberInUse: async (_companyId, id) => options.usedMembers?.includes(id) ?? false,
    },
    { hasPermission: async (permission) => (options.permissions ?? ["system.full-access"]).includes(permission) },
    new InMemoryEventBus(),
    { actor: { type: "user", id: "user-1", displayName: "کاربر آزمون" }, source: "desktop" },
  );
  return { repositories, service };
}

function typeValue(overrides: Partial<AccountingDimensionType> = {}) {
  return Object.freeze({ ...createAccountingDimensionType({ id: "type-1", companyId: "company-1", code: "PROJECT", name: "پروژه", hierarchical: true, createdAt: timestamp }), ...overrides });
}
function memberValue(overrides: Partial<AccountingDimensionMember> = {}) {
  return Object.freeze({ ...createAccountingDimensionMember({ id: "member-1", companyId: "company-1", dimensionTypeId: "type-1", code: "P01", name: "پروژه یک", createdAt: timestamp }), ...overrides });
}
function seedAccount(repositories: MemoryRepositories, overrides: { status?: "active" | "inactive"; companyId?: string } = {}) {
  repositories.accountValues.set("account-1", createAccount({ id: "account-1", companyId: overrides.companyId ?? "company-1", level: "general", code: "1101", name: "حساب", nature: "debit", normalBalance: "debit", statementType: "balance_sheet", status: overrides.status ?? "active", createdAt: timestamp }));
}

test("creates a normalized company-scoped dimension type", async () => {
  const { repositories, service } = fixture();
  const result = await service.createDimensionType({ companyId: "company-1", code: " project ", name: "پروژه" });
  assert.equal(result.code, "PROJECT"); assert.equal(result.id, "dimension-1"); assert.equal(repositories.typeValues.get(result.id), result);
});

test("rejects duplicate type codes within the same company", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue());
  await assert.rejects(service.createDimensionType({ companyId: "company-1", code: "project", name: "پروژه دیگر" }), (e) => e instanceof AccountingDimensionsError && e.code === "DUPLICATE_DIMENSION_TYPE_CODE");
});

test("creates a member only for an active type in the same company", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue());
  const result = await service.createMember({ companyId: "company-1", dimensionTypeId: "type-1", code: " p01 ", name: "پروژه یک" });
  assert.equal(result.code, "P01"); assert.equal(result.dimensionTypeId, "type-1");
});

test("rejects a parent for a non-hierarchical dimension type", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue({ hierarchical: false })); repositories.memberValues.set("parent-1", memberValue({ id: "parent-1" }));
  await assert.rejects(service.createMember({ companyId: "company-1", dimensionTypeId: "type-1", parentId: "parent-1", code: "P02", name: "فرزند" }), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_TYPE_NOT_HIERARCHICAL");
});

test("rejects a member hierarchy cycle on update", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue()); repositories.memberValues.set("member-1", memberValue()); repositories.memberValues.set("child-1", memberValue({ id: "child-1", parentId: "member-1" }));
  await assert.rejects(service.updateMember({ companyId: "company-1", memberId: "member-1", expectedVersion: 1, changes: { parentId: "child-1" } }), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_MEMBER_TREE_CYCLE");
});

test("creates one policy for an active account and active type", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue()); seedAccount(repositories);
  const result = await service.createPolicy({ companyId: "company-1", accountId: "account-1", dimensionTypeId: "type-1", requirement: "required" });
  assert.equal(result.requirement, "required"); assert.equal(repositories.policyValues.get(result.id), result);
});

test("rejects a duplicate account and type policy", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue()); seedAccount(repositories);
  await service.createPolicy({ companyId: "company-1", accountId: "account-1", dimensionTypeId: "type-1", requirement: "required" });
  await assert.rejects(service.createPolicy({ companyId: "company-1", accountId: "account-1", dimensionTypeId: "type-1", requirement: "optional" }), (e) => e instanceof AccountingDimensionsError && e.code === "DUPLICATE_ACCOUNT_DIMENSION_POLICY");
});

test("enforces optimistic concurrency when updating a type", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue({ version: 2 }));
  await assert.rejects(service.updateDimensionType({ companyId: "company-1", dimensionTypeId: "type-1", expectedVersion: 1, changes: { name: "پروژه‌ها" } }), (e) => e instanceof AccountingDimensionsError && e.code === "VERSION_MISMATCH");
});

test("does not delete a dimension member that is already used", async () => {
  const { repositories, service } = fixture({ usedMembers: ["member-1"] }); repositories.memberValues.set("member-1", memberValue());
  await assert.rejects(service.deleteMember("company-1", "member-1", 1), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_MEMBER_IN_USE");
  assert.ok(repositories.memberValues.has("member-1"));
});

test("does not deactivate a type while it has active members", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue()); repositories.memberValues.set("member-1", memberValue());
  await assert.rejects(service.setDimensionTypeStatus("company-1", "type-1", "inactive", 1), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_TYPE_HAS_ACTIVE_MEMBERS");
});

test("does not activate a member under an inactive dimension type", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue({ status: "inactive" })); repositories.memberValues.set("member-1", memberValue({ status: "inactive" }));
  await assert.rejects(service.setMemberStatus("company-1", "member-1", "active", 1), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_TYPE_INACTIVE");
});

test("does not deactivate a member while it has active children", async () => {
  const { repositories, service } = fixture(); repositories.memberValues.set("member-1", memberValue()); repositories.memberValues.set("child-1", memberValue({ id: "child-1", parentId: "member-1" }));
  await assert.rejects(service.setMemberStatus("company-1", "member-1", "inactive", 1), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_MEMBER_HAS_ACTIVE_CHILDREN");
});

test("requires the dedicated permission before opening a unit of work", async () => {
  const { service } = fixture({ permissions: [] });
  await assert.rejects(service.createDimensionType({ companyId: "company-1", code: "PROJECT", name: "پروژه" }), (e) => e instanceof AccountingDimensionsError && e.code === "PERMISSION_DENIED");
});

test("prevents cross-company reads", async () => {
  const { repositories, service } = fixture(); repositories.typeValues.set("type-1", typeValue());
  await assert.rejects(service.getDimensionType("company-2", "type-1"), (e) => e instanceof AccountingDimensionsError && e.code === "DIMENSION_TYPE_NOT_FOUND");
});
