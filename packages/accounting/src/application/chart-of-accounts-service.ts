import type { Clock, IdGenerator } from "@argin/platform";
import type { AccountingUnitOfWorkRepositories } from "../contracts/accounting-unit-of-work.ts";
import type { AccountingUnitOfWork } from "../contracts/accounting-unit-of-work.ts";
import type { AccountCodingSettings } from "../domain/account-coding-settings.ts";
import type { Account, CreateAccountInput } from "../domain/account.ts";
import { createAccountCodingSettings } from "../domain/create-account-coding-settings.ts";
import { createAccount } from "../domain/create-account.ts";
import { AccountCodingSettingsValidationError } from "../validation/account-coding-settings-validation-error.ts";
import { assertValidAccountTree } from "../validation/assert-valid-account-tree.ts";
import { validateAccountCodingSettings } from "../validation/validate-account-coding-settings.ts";
import { validateAccount } from "../validation/validate-account.ts";
import { AccountValidationError } from "../validation/account-validation-error.ts";
import { ChartOfAccountsError } from "./chart-of-accounts-error.ts";

export type CreateAccountCommand = Omit<
  CreateAccountInput,
  "id" | "createdAt"
>;

export interface UpdateAccountCommand {
  readonly companyId: string;
  readonly accountId: string;
  readonly expectedVersion: number;
  readonly changes: Partial<Omit<
    CreateAccountInput,
    "id" | "companyId" | "createdAt" | "status"
  >>;
}

export interface UpdateCodingSettingsCommand {
  readonly companyId: string;
  readonly expectedVersion: number;
  readonly groupCodeLength: number;
  readonly generalCodeLength: number;
  readonly subsidiaryCodeLength: number;
  readonly enforceHierarchicalCodes: boolean;
  readonly allowCodeChangeAfterUse: boolean;
}

export interface AccountSearch {
  readonly companyId: string;
  readonly text?: string;
  readonly level?: Account["level"];
  readonly status?: Account["status"];
  readonly parentId?: string | null;
}

export interface AccountTreeNode {
  readonly account: Account;
  readonly children: readonly AccountTreeNode[];
}

export class ChartOfAccountsService {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWork,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  createAccount(command: CreateAccountCommand): Promise<Account> {
    return this.unitOfWork.run(async (repositories) => {
      const settings = await this.requireSettings(
        repositories,
        command.companyId,
      );
      await this.ensureCodeAvailable(
        repositories,
        command.companyId,
        command.code,
      );
      const account = createAccount({
        ...command,
        id: this.idGenerator.generate(),
        createdAt: this.clock.nowIso(),
      });
      const parent = await this.resolveParent(repositories, account);
      assertValidAccountTree(account, parent, settings);
      await repositories.accounts.create(account);
      return account;
    });
  }

  updateAccount(command: UpdateAccountCommand): Promise<Account> {
    return this.unitOfWork.run(async (repositories) => {
      const current = await this.requireAccount(
        repositories,
        command.companyId,
        command.accountId,
      );
      this.assertVersion(current.version, command.expectedVersion);
      const settings = await this.requireSettings(
        repositories,
        command.companyId,
      );
      const candidate = createAccount({
        ...current,
        ...command.changes,
        id: current.id,
        companyId: current.companyId,
        createdAt: current.createdAt,
      });
      const updated = Object.freeze({
        ...candidate,
        status: current.status,
        createdAt: current.createdAt,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertAccount(updated);
      if (updated.code !== current.code) {
        await this.ensureCodeAvailable(
          repositories,
          command.companyId,
          updated.code,
          current.id,
        );
      }
      const parent = await this.resolveParent(repositories, updated);
      assertValidAccountTree(updated, parent, settings);
      await this.assertNoCycle(repositories, updated);
      await repositories.accounts.update(updated);
      return updated;
    });
  }

  setAccountStatus(
    companyId: string,
    accountId: string,
    status: Account["status"],
    expectedVersion: number,
  ): Promise<Account> {
    return this.unitOfWork.run(async (repositories) => {
      const current = await this.requireAccount(
        repositories,
        companyId,
        accountId,
      );
      this.assertVersion(current.version, expectedVersion);
      const updated = Object.freeze({
        ...current,
        status,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertAccount(updated);
      await repositories.accounts.update(updated);
      return updated;
    });
  }

  async getAccountById(
    companyId: string,
    accountId: string,
  ): Promise<Account> {
    return this.unitOfWork.run((repositories) =>
      this.requireAccount(repositories, companyId, accountId)
    );
  }

  async getAccountByCode(
    companyId: string,
    code: string,
  ): Promise<Account> {
    return this.unitOfWork.run(async ({ accounts }) => {
      const account = await accounts.findByCode(companyId, code);
      if (account === null) {
        throw new ChartOfAccountsError(
          "ACCOUNT_NOT_FOUND",
          "حساب موردنظر یافت نشد.",
        );
      }
      return account;
    });
  }

  searchAccounts(query: AccountSearch): Promise<readonly Account[]> {
    return this.unitOfWork.run(async ({ accounts }) => {
      const normalizedText = query.text?.trim().toLocaleLowerCase("fa") ?? "";
      const values = await accounts.findByCompanyId(query.companyId);
      return values.filter((account) =>
        (query.level === undefined || account.level === query.level) &&
        (query.status === undefined || account.status === query.status) &&
        (query.parentId === undefined || account.parentId === query.parentId) &&
        (
          normalizedText.length === 0 ||
          account.code.includes(normalizedText) ||
          account.name.toLocaleLowerCase("fa").includes(normalizedText) ||
          account.englishName?.toLocaleLowerCase("en")
            .includes(normalizedText) === true
        )
      );
    });
  }

  getAccountTree(companyId: string): Promise<readonly AccountTreeNode[]> {
    return this.unitOfWork.run(async ({ accounts }) => {
      const values = await accounts.findByCompanyId(companyId);
      const children = new Map<string | null, Account[]>();
      for (const account of values) {
        const siblings = children.get(account.parentId) ?? [];
        siblings.push(account);
        children.set(account.parentId, siblings);
      }
      const build = (parentId: string | null): AccountTreeNode[] =>
        (children.get(parentId) ?? []).map((account) => ({
          account,
          children: Object.freeze(build(account.id)),
        }));
      return Object.freeze(build(null));
    });
  }

  getCodingSettings(companyId: string): Promise<AccountCodingSettings> {
    return this.unitOfWork.run((repositories) =>
      this.requireSettings(repositories, companyId)
    );
  }

  saveDefaultCodingSettings(
    companyId: string,
  ): Promise<AccountCodingSettings> {
    return this.unitOfWork.run(async ({ codingSettings }) => {
      const existing = await codingSettings.findByCompanyId(companyId);
      if (existing !== null) return existing;
      const settings = createAccountCodingSettings({ companyId });
      await codingSettings.save(settings);
      return settings;
    });
  }

  updateCodingSettings(
    command: UpdateCodingSettingsCommand,
  ): Promise<AccountCodingSettings> {
    return this.unitOfWork.run(async (repositories) => {
      const current = await this.requireSettings(
        repositories,
        command.companyId,
      );
      this.assertVersion(current.version, command.expectedVersion);
      const updated = Object.freeze({
        ...command,
        version: current.version + 1,
      });
      const issues = validateAccountCodingSettings(updated);
      if (issues.length > 0) {
        throw new AccountCodingSettingsValidationError(issues);
      }
      const accounts = await repositories.accounts.findByCompanyId(
        command.companyId,
      );
      for (const account of accounts) {
        const parent = account.parentId === null
          ? null
          : accounts.find(({ id }) => id === account.parentId) ?? null;
        assertValidAccountTree(account, parent, updated);
      }
      await repositories.codingSettings.save(updated);
      return updated;
    });
  }

  private async requireAccount(
    repositories: AccountingUnitOfWorkRepositories,
    companyId: string,
    accountId: string,
  ): Promise<Account> {
    const account = await repositories.accounts.findById(accountId);
    if (account === null || account.companyId !== companyId) {
      throw new ChartOfAccountsError(
        "ACCOUNT_NOT_FOUND",
        "حساب موردنظر یافت نشد.",
      );
    }
    return account;
  }

  private async requireSettings(
    repositories: AccountingUnitOfWorkRepositories,
    companyId: string,
  ): Promise<AccountCodingSettings> {
    const settings = await repositories.codingSettings.findByCompanyId(
      companyId,
    );
    if (settings === null) {
      throw new ChartOfAccountsError(
        "CODING_SETTINGS_NOT_FOUND",
        "تنظیمات کدینگ شرکت یافت نشد.",
      );
    }
    return settings;
  }

  private async resolveParent(
    repositories: AccountingUnitOfWorkRepositories,
    account: Account,
  ): Promise<Account | null> {
    if (account.parentId === null) return null;
    return repositories.accounts.findById(account.parentId);
  }

  private async ensureCodeAvailable(
    repositories: AccountingUnitOfWorkRepositories,
    companyId: string,
    code: string,
    ignoredAccountId?: string,
  ): Promise<void> {
    const existing = await repositories.accounts.findByCode(companyId, code);
    if (existing !== null && existing.id !== ignoredAccountId) {
      throw new ChartOfAccountsError(
        "DUPLICATE_ACCOUNT_CODE",
        "کد حساب در این شرکت قبلاً استفاده شده است.",
      );
    }
  }

  private async assertNoCycle(
    repositories: AccountingUnitOfWorkRepositories,
    account: Account,
  ): Promise<void> {
    let parentId = account.parentId;
    const visited = new Set([account.id]);
    while (parentId !== null) {
      if (visited.has(parentId)) {
        throw new ChartOfAccountsError(
          "ACCOUNT_TREE_CYCLE",
          "تغییر والد باعث ایجاد چرخه در درخت حساب‌ها می‌شود.",
        );
      }
      visited.add(parentId);
      const parent = await repositories.accounts.findById(parentId);
      parentId = parent?.parentId ?? null;
    }
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ChartOfAccountsError(
        "VERSION_MISMATCH",
        "نسخه حساب یا تنظیمات تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
      );
    }
  }

  private assertAccount(account: Account): void {
    const issues = validateAccount(account);
    if (issues.length > 0) throw new AccountValidationError(issues);
  }
}
