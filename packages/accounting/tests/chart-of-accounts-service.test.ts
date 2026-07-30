import assert from "node:assert/strict";
import test from "node:test";
import {
  type Account,
  type AccountCodingSettings,
  type AccountingUnitOfWork,
  type AccountingUnitOfWorkRepositories,
  ChartOfAccountsError,
  ChartOfAccountsService,
  createAccount,
  createAccountCodingSettings,
} from "../src/index.ts";
import {
  FixedClock,
  SequenceIdGenerator,
} from "@argin/platform";

class MemoryRepositories implements AccountingUnitOfWorkRepositories {
  readonly accountValues = new Map<string, Account>();
  readonly settingValues = new Map<string, AccountCodingSettings>();

  readonly accounts = {
    create: async (account: Account) => {
      this.accountValues.set(account.id, account);
    },
    findById: async (id: string) => this.accountValues.get(id) ?? null,
    findByCode: async (companyId: string, code: string) =>
      [...this.accountValues.values()].find(
        (account) =>
          account.companyId === companyId && account.code === code,
      ) ?? null,
    findByCompanyId: async (companyId: string) =>
      [...this.accountValues.values()].filter(
        (account) => account.companyId === companyId,
      ),
    findChildren: async (parentId: string) =>
      [...this.accountValues.values()].filter(
        (account) => account.parentId === parentId,
      ),
    update: async (account: Account) => {
      this.accountValues.set(account.id, account);
    },
  };

  readonly codingSettings = {
    findByCompanyId: async (companyId: string) =>
      this.settingValues.get(companyId) ?? null,
    save: async (settings: AccountCodingSettings) => {
      this.settingValues.set(settings.companyId, settings);
    },
  };
}

class MemoryUnitOfWork implements AccountingUnitOfWork {
  runs = 0;
  constructor(readonly repositories: MemoryRepositories) {}

  async run<T>(
    operation: (
      repositories: AccountingUnitOfWorkRepositories,
    ) => Promise<T>,
  ): Promise<T> {
    this.runs += 1;
    return operation(this.repositories);
  }
}

const timestamp = "2026-07-30T10:00:00.000Z";

function createFixture() {
  const repositories = new MemoryRepositories();
  repositories.settingValues.set(
    "company-1",
    createAccountCodingSettings({ companyId: "company-1" }),
  );
  const unitOfWork = new MemoryUnitOfWork(repositories);
  const service = new ChartOfAccountsService(
    unitOfWork,
    new FixedClock(timestamp),
    new SequenceIdGenerator("account"),
  );
  return { repositories, service, unitOfWork };
}

function group(overrides: Partial<Account> = {}): Account {
  return Object.freeze({
    ...createAccount({
      id: "group-1",
      companyId: "company-1",
      level: "group",
      code: "10",
      name: "دارایی‌ها",
      nature: "debit",
      normalBalance: "debit",
      statementType: "balance_sheet",
      createdAt: timestamp,
    }),
    ...overrides,
  });
}

test("creates a company-scoped account inside one unit of work", async () => {
  const { repositories, service, unitOfWork } = createFixture();
  const result = await service.createAccount({
    companyId: "company-1",
    level: "group",
    code: "10",
    name: "دارایی‌ها",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
  });

  assert.equal(result.id, "account-1");
  assert.equal(result.createdAt, timestamp);
  assert.equal(repositories.accountValues.get(result.id), result);
  assert.equal(unitOfWork.runs, 1);
});

test("rejects a duplicate code within the same company", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());

  await assert.rejects(
    service.createAccount({
      companyId: "company-1",
      level: "group",
      code: "10",
      name: "دارایی جاری",
      nature: "debit",
      normalBalance: "debit",
      statementType: "balance_sheet",
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "DUPLICATE_ACCOUNT_CODE",
  );
});

test("validates parent level and hierarchical code on create", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());

  await assert.rejects(service.createAccount({
    companyId: "company-1",
    parentId: "group-1",
    level: "general",
    code: "2001",
    name: "موجودی نقد",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
  }));
});

test("updates an account and advances its optimistic version", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());

  const updated = await service.updateAccount({
    companyId: "company-1",
    accountId: "group-1",
    expectedVersion: 1,
    changes: { name: "دارایی" },
  });

  assert.equal(updated.name, "دارایی");
  assert.equal(updated.version, 2);
  assert.equal(updated.updatedAt, timestamp);
});

test("rejects an update made with a stale version", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group({ version: 2 }));

  await assert.rejects(
    service.updateAccount({
      companyId: "company-1",
      accountId: "group-1",
      expectedVersion: 1,
      changes: { name: "دارایی" },
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "VERSION_MISMATCH",
  );
});

test("does not expose an account through another company scope", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());

  await assert.rejects(
    service.getAccountById("company-2", "group-1"),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "ACCOUNT_NOT_FOUND",
  );
});

test("activates and deactivates accounts with version control", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());

  const inactive = await service.setAccountStatus(
    "company-1",
    "group-1",
    "inactive",
    1,
  );
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.version, 2);
});

test("builds a sorted repository result as a nested account tree", async () => {
  const { repositories, service } = createFixture();
  const root = group();
  const child = createAccount({
    id: "general-1",
    companyId: "company-1",
    parentId: root.id,
    level: "general",
    code: "1001",
    name: "وجوه نقد",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    createdAt: timestamp,
  });
  repositories.accountValues.set(root.id, root);
  repositories.accountValues.set(child.id, child);

  const tree = await service.getAccountTree("company-1");
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.account.id, root.id);
  assert.equal(tree[0]?.children[0]?.account.id, child.id);
});

test("searches by Persian name and filters account status", async () => {
  const { repositories, service } = createFixture();
  repositories.accountValues.set("group-1", group());
  repositories.accountValues.set(
    "group-2",
    group({
      id: "group-2",
      code: "20" as Account["code"],
      name: "بدهی‌ها" as Account["name"],
      status: "inactive",
    }),
  );

  const result = await service.searchAccounts({
    companyId: "company-1",
    text: "دارایی",
    status: "active",
  });
  assert.deepEqual(result.map(({ id }) => id), ["group-1"]);
});

test("creates defaults and validates coding-setting changes against accounts", async () => {
  const repositories = new MemoryRepositories();
  const service = new ChartOfAccountsService(
    new MemoryUnitOfWork(repositories),
    new FixedClock(timestamp),
    new SequenceIdGenerator("account"),
  );
  const defaults = await service.saveDefaultCodingSettings("company-1");
  repositories.accountValues.set("group-1", group());

  await assert.rejects(service.updateCodingSettings({
    companyId: "company-1",
    expectedVersion: defaults.version,
    groupCodeLength: 3,
    generalCodeLength: 5,
    subsidiaryCodeLength: 7,
    enforceHierarchicalCodes: true,
    allowCodeChangeAfterUse: false,
  }));
});
