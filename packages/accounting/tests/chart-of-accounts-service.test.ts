import assert from "node:assert/strict";
import test from "node:test";
import {
  type Account,
  type AccountCodingSettings,
  type AccountingUnitOfWork,
  type AccountingUnitOfWorkRepositories,
  ChartOfAccountsError,
  ChartOfAccountsService,
  chartOfAccountsPermissions,
  createAccount,
  createAccountCodingSettings,
  type ChartOfAccountsEvent,
} from "../src/index.ts";
import {
  FixedClock,
  InMemoryEventBus,
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
    delete: async (account: Account) => {
      this.accountValues.delete(account.id);
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

function createFixture(
  permissions: readonly string[] = ["system.full-access"],
  usedAccountIds: readonly string[] = [],
) {
  const repositories = new MemoryRepositories();
  repositories.settingValues.set(
    "company-1",
    createAccountCodingSettings({ companyId: "company-1" }),
  );
  const unitOfWork = new MemoryUnitOfWork(repositories);
  const eventBus = new InMemoryEventBus();
  const events: ChartOfAccountsEvent[] = [];
  for (
    const eventType of [
      "accounting.account.created",
      "accounting.account.updated",
      "accounting.account.status-changed",
      "accounting.account.deleted",
      "accounting.coding-settings.created",
      "accounting.coding-settings.updated",
    ] as const
  ) {
    eventBus.subscribe<ChartOfAccountsEvent>(eventType, (event) => {
      events.push(event);
    });
  }
  const service = new ChartOfAccountsService(
    unitOfWork,
    new FixedClock(timestamp),
    new SequenceIdGenerator("account"),
    {
      hasFinancialActivity: async (_companyId, accountId) =>
        usedAccountIds.includes(accountId),
    },
    {
      hasPermission: async (permission) => permissions.includes(permission),
    },
    eventBus,
    {
      actor: {
        type: "user",
        id: "user-1",
        displayName: "کاربر آزمون",
      },
      source: "desktop",
      correlation: {
        correlationId: "correlation-1",
        causationId: "command-1",
      },
    },
  );
  return { events, repositories, service, unitOfWork };
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
    { hasFinancialActivity: async () => false },
    { hasPermission: async () => true },
    new InMemoryEventBus(),
    {
      actor: {
        type: "system",
        id: null,
        displayName: "آزمون",
      },
    },
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

test("rejects commands without the required application permission", async () => {
  const { repositories, service, unitOfWork } = createFixture([
    chartOfAccountsPermissions.view,
  ]);

  await assert.rejects(
    service.createAccount({
      companyId: "company-1",
      level: "group",
      code: "10",
      name: "دارایی‌ها",
      nature: "debit",
      normalBalance: "debit",
      statementType: "balance_sheet",
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "PERMISSION_DENIED",
  );
  assert.equal(unitOfWork.runs, 0);
  assert.equal(repositories.accountValues.size, 0);
});

test("requires dedicated permissions for code changes and account moves", async () => {
  const { repositories, service } = createFixture([
    chartOfAccountsPermissions.update,
  ]);
  repositories.accountValues.set("group-1", group());

  await assert.rejects(
    service.updateAccount({
      companyId: "company-1",
      accountId: "group-1",
      expectedVersion: 1,
      changes: { code: "20" },
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "PERMISSION_DENIED",
  );
  assert.equal(repositories.accountValues.get("group-1")?.code, "10");
});

test("publishes an auditable account event after a successful commit", async () => {
  const { events, service } = createFixture([
    chartOfAccountsPermissions.create,
  ]);

  const account = await service.createAccount({
    companyId: "company-1",
    level: "group",
    code: "10",
    name: "دارایی‌ها",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "accounting.account.created");
  assert.equal(events[0]?.aggregateId, account.id);
  assert.equal(events[0]?.correlationId, "correlation-1");
  assert.equal(events[0]?.causationId, "command-1");
  assert.equal(events[0]?.payload.actor.id, "user-1");
  assert.equal(events[0]?.payload.before, null);
  assert.equal(events[0]?.payload.after, account);
  assert.equal(events[0]?.metadata.audit, true);
});

test("publishes before and after snapshots for sensitive status changes", async () => {
  const { events, repositories, service } = createFixture([
    chartOfAccountsPermissions.changeStatus,
  ]);
  repositories.accountValues.set("group-1", group());

  const result = await service.setAccountStatus(
    "company-1",
    "group-1",
    "inactive",
    1,
  );

  assert.equal(events[0]?.eventType, "accounting.account.status-changed");
  assert.equal(events[0]?.payload.before?.version, 1);
  assert.equal(events[0]?.payload.after?.version, 2);
  assert.equal(result.status, "inactive");
});

test("rejects deleting an account that has children", async () => {
  const { repositories, service } = createFixture([
    chartOfAccountsPermissions.delete,
  ]);
  const parent = group();
  const child = createAccount({
    id: "general-1",
    companyId: "company-1",
    parentId: parent.id,
    level: "general",
    code: "1001",
    name: "وجوه نقد",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    createdAt: timestamp,
  });
  repositories.accountValues.set(parent.id, parent);
  repositories.accountValues.set(child.id, child);

  await assert.rejects(
    service.deleteAccount({
      companyId: "company-1",
      accountId: parent.id,
      expectedVersion: parent.version,
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "ACCOUNT_HAS_CHILDREN",
  );
  assert.equal(repositories.accountValues.has(parent.id), true);
});

test("rejects deleting a used account and recommends deactivation", async () => {
  const { repositories, service } = createFixture(
    [chartOfAccountsPermissions.delete],
    ["group-1"],
  );
  repositories.accountValues.set("group-1", group());

  await assert.rejects(
    service.deleteAccount({
      companyId: "company-1",
      accountId: "group-1",
      expectedVersion: 1,
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "ACCOUNT_HAS_FINANCIAL_ACTIVITY",
  );
  assert.equal(repositories.accountValues.has("group-1"), true);
});

test("deletes an unused leaf account and publishes its audit snapshot", async () => {
  const { events, repositories, service } = createFixture([
    chartOfAccountsPermissions.delete,
  ]);
  repositories.accountValues.set("group-1", group());

  await service.deleteAccount({
    companyId: "company-1",
    accountId: "group-1",
    expectedVersion: 1,
  });

  assert.equal(repositories.accountValues.has("group-1"), false);
  assert.equal(events[0]?.eventType, "accounting.account.deleted");
  assert.equal(events[0]?.payload.action, "delete");
  const before = events[0]?.payload.before;
  assert.ok(before !== null && before !== undefined && "id" in before);
  assert.equal(before.id, "group-1");
  assert.equal(events[0]?.payload.after, null);
});

test("rejects changing the code of a used account when company policy forbids it", async () => {
  const { repositories, service } = createFixture(
    [
      chartOfAccountsPermissions.update,
      chartOfAccountsPermissions.changeCode,
    ],
    ["group-1"],
  );
  repositories.accountValues.set("group-1", group());

  await assert.rejects(
    service.updateAccount({
      companyId: "company-1",
      accountId: "group-1",
      expectedVersion: 1,
      changes: { code: "20" },
    }),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "ACCOUNT_CODE_CHANGE_AFTER_USE_NOT_ALLOWED",
  );
  assert.equal(repositories.accountValues.get("group-1")?.code, "10");
});

test("allows changing the code of a used account when company policy permits it", async () => {
  const { repositories, service } = createFixture(
    [
      chartOfAccountsPermissions.update,
      chartOfAccountsPermissions.changeCode,
    ],
    ["group-1"],
  );
  repositories.settingValues.set(
    "company-1",
    createAccountCodingSettings({
      companyId: "company-1",
      allowCodeChangeAfterUse: true,
    }),
  );
  repositories.accountValues.set("group-1", group());

  const updated = await service.updateAccount({
    companyId: "company-1",
    accountId: "group-1",
    expectedVersion: 1,
    changes: { code: "20" },
  });

  assert.equal(updated.code, "20");
  assert.equal(updated.version, 2);
});

test("rejects deactivating a parent while it has active children", async () => {
  const { repositories, service } = createFixture([
    chartOfAccountsPermissions.changeStatus,
  ]);
  const parent = group();
  const child = createAccount({
    id: "general-1",
    companyId: "company-1",
    parentId: parent.id,
    level: "general",
    code: "1001",
    name: "وجوه نقد",
    nature: "debit",
    normalBalance: "debit",
    statementType: "balance_sheet",
    createdAt: timestamp,
  });
  repositories.accountValues.set(parent.id, parent);
  repositories.accountValues.set(child.id, child);

  await assert.rejects(
    service.setAccountStatus(
      "company-1",
      parent.id,
      "inactive",
      parent.version,
    ),
    (error) =>
      error instanceof ChartOfAccountsError &&
      error.code === "ACCOUNT_HAS_ACTIVE_CHILDREN",
  );
  assert.equal(repositories.accountValues.get(parent.id)?.status, "active");
});
