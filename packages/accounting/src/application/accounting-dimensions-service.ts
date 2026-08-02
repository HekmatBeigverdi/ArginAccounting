import type {
  Clock,
  EventBus,
  IdGenerator,
  PagedResult,
} from "@argin/platform";
import type { AccountingDimensionUsageReader } from "../contracts/accounting-dimension-usage-reader.ts";
import type {
  AccountingUnitOfWork,
  AccountingUnitOfWorkRepositories,
} from "../contracts/accounting-unit-of-work.ts";
import type { ChartOfAccountsAuthorizer } from "../contracts/chart-of-accounts-authorizer.ts";
import type {
  AccountDimensionPolicy,
  CreateAccountDimensionPolicyInput,
} from "../domain/account-dimension-policy.ts";
import type {
  AccountingDimensionMember,
  CreateAccountingDimensionMemberInput,
} from "../domain/accounting-dimension-member.ts";
import type {
  AccountingDimensionType,
  CreateAccountingDimensionTypeInput,
} from "../domain/accounting-dimension-type.ts";
import { createAccountDimensionPolicy } from "../domain/create-account-dimension-policy.ts";
import { createAccountingDimensionMember } from "../domain/create-accounting-dimension-member.ts";
import { createAccountingDimensionType } from "../domain/create-accounting-dimension-type.ts";
import { AccountDimensionPolicyValidationError } from "../validation/account-dimension-policy-validation-error.ts";
import { AccountingDimensionMemberValidationError } from "../validation/accounting-dimension-member-validation-error.ts";
import { AccountingDimensionTypeValidationError } from "../validation/accounting-dimension-type-validation-error.ts";
import { validateAccountDimensionPolicy } from "../validation/validate-account-dimension-policy.ts";
import { validateAccountingDimensionMember } from "../validation/validate-accounting-dimension-member.ts";
import { validateAccountingDimensionType } from "../validation/validate-accounting-dimension-type.ts";
import type {
  AccountingDimensionMemberSearchQuery,
  AccountingDimensionTypeSearchQuery,
  AccountDimensionPolicySearchQuery,
} from "../contracts/accounting-dimension-queries.ts";
import {
  normalizeAccountDimensionPolicySearchQuery,
  normalizeAccountingDimensionMemberSearchQuery,
  normalizeAccountingDimensionTypeSearchQuery,
} from "../contracts/accounting-dimension-queries.ts";
import type { ChartOfAccountsContext } from "./chart-of-accounts-context.ts";
import { AccountingDimensionsError } from "./accounting-dimensions-error.ts";
import {
  createAccountingDimensionsEvent,
  type AccountingDimensionsEventType,
} from "./accounting-dimensions-events.ts";
import {
  accountingDimensionsPermissions,
  type AccountingDimensionsPermission,
} from "./accounting-dimensions-permissions.ts";

export type CreateDimensionTypeCommand = Omit<
  CreateAccountingDimensionTypeInput,
  "id" | "createdAt"
>;
export type CreateDimensionMemberCommand = Omit<
  CreateAccountingDimensionMemberInput,
  "id" | "createdAt"
>;
export type CreateDimensionPolicyCommand = Omit<
  CreateAccountDimensionPolicyInput,
  "id" | "createdAt"
>;

export interface UpdateDimensionTypeCommand {
  readonly companyId: string;
  readonly dimensionTypeId: string;
  readonly expectedVersion: number;
  readonly changes: Partial<
    Omit<
      CreateAccountingDimensionTypeInput,
      "id" | "companyId" | "createdAt" | "status"
    >
  >;
}
export interface UpdateDimensionMemberCommand {
  readonly companyId: string;
  readonly memberId: string;
  readonly expectedVersion: number;
  readonly changes: Partial<
    Omit<
      CreateAccountingDimensionMemberInput,
      "id" | "companyId" | "dimensionTypeId" | "createdAt" | "status"
    >
  >;
}
export interface UpdateDimensionPolicyCommand {
  readonly companyId: string;
  readonly policyId: string;
  readonly expectedVersion: number;
  readonly requirement: AccountDimensionPolicy["requirement"];
}

type DimensionRepositories = Required<
  Pick<
    AccountingUnitOfWorkRepositories,
    "dimensionTypes" | "dimensionMembers" | "dimensionPolicies"
  >
>;

export class AccountingDimensionsService {
  constructor(
    private readonly unitOfWork: AccountingUnitOfWork,
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
    private readonly usageReader: AccountingDimensionUsageReader,
    private readonly authorizer: ChartOfAccountsAuthorizer,
    private readonly eventBus: EventBus,
    private readonly context: ChartOfAccountsContext,
  ) {}

  async createDimensionType(
    command: CreateDimensionTypeCommand,
  ): Promise<AccountingDimensionType> {
    await this.requirePermission(accountingDimensionsPermissions.create);
    const created = await this.unitOfWork.run(async (repositories) => {
      const { dimensionTypes } =
        this.requireDimensionRepositories(repositories);
      await this.ensureTypeCodeAvailable(
        dimensionTypes,
        command.companyId,
        command.code,
      );
      const value = createAccountingDimensionType({
        ...command,
        id: this.idGenerator.generate(),
        createdAt: this.clock.nowIso(),
      });
      await dimensionTypes.create(value);
      return value;
    });
    await this.publish("type", "created", "create", null, created);
    return created;
  }

  async updateDimensionType(
    command: UpdateDimensionTypeCommand,
  ): Promise<AccountingDimensionType> {
    await this.requirePermission(accountingDimensionsPermissions.update);
    const result = await this.unitOfWork.run(async (repositories) => {
      const { dimensionTypes } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireType(
        repositories,
        command.companyId,
        command.dimensionTypeId,
      );
      this.assertVersion(current.version, command.expectedVersion);
      const candidate = createAccountingDimensionType({
        ...current,
        ...command.changes,
        id: current.id,
        companyId: current.companyId,
        status: current.status,
        createdAt: current.createdAt,
      });
      const updated = Object.freeze({
        ...candidate,
        status: current.status,
        createdAt: current.createdAt,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertType(updated);
      if (updated.code !== current.code)
        await this.ensureTypeCodeAvailable(
          dimensionTypes,
          command.companyId,
          updated.code,
          current.id,
        );
      if (current.hierarchical && !updated.hierarchical) {
        const memberResult = await repositories.dimensionMembers!.search(
          normalizeAccountingDimensionMemberSearchQuery({
            companyId: command.companyId,
            dimensionTypeId: current.id,
            pagination: { page: 1, pageSize: 1 },
          }),
        );
        if (memberResult.totalItems > 0)
          throw new AccountingDimensionsError(
            "DIMENSION_TYPE_HAS_MEMBERS",
            "نوع بُعد دارای عضو را نمی‌توان از حالت سلسله‌مراتبی خارج کرد.",
          );
      }
      await dimensionTypes.update(updated);
      return { before: current, after: updated };
    });
    await this.publish(
      "type",
      "updated",
      "update",
      result.before,
      result.after,
    );
    return result.after;
  }

  async setDimensionTypeStatus(
    companyId: string,
    dimensionTypeId: string,
    status: AccountingDimensionType["status"],
    expectedVersion: number,
  ): Promise<AccountingDimensionType> {
    await this.requirePermission(accountingDimensionsPermissions.changeStatus);
    const result = await this.unitOfWork.run(async (repositories) => {
      const { dimensionTypes, dimensionMembers } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireType(
        repositories,
        companyId,
        dimensionTypeId,
      );
      this.assertVersion(current.version, expectedVersion);
      if (status === "inactive") {
        const active = await dimensionMembers.search(
          normalizeAccountingDimensionMemberSearchQuery({
            companyId,
            dimensionTypeId,
            status: "active",
            pagination: { page: 1, pageSize: 1 },
          }),
        );
        if (active.totalItems > 0)
          throw new AccountingDimensionsError(
            "DIMENSION_TYPE_HAS_ACTIVE_MEMBERS",
            "نوع بُعد دارای عضو فعال را نمی‌توان غیرفعال کرد.",
          );
      }
      const updated = Object.freeze({
        ...current,
        status,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertType(updated);
      await dimensionTypes.update(updated);
      return { before: current, after: updated };
    });
    await this.publish(
      "type",
      "status-changed",
      "status-change",
      result.before,
      result.after,
    );
    return result.after;
  }

  async deleteDimensionType(
    companyId: string,
    dimensionTypeId: string,
    expectedVersion: number,
  ): Promise<void> {
    await this.requirePermission(accountingDimensionsPermissions.delete);
    const deleted = await this.unitOfWork.run(async (repositories) => {
      const { dimensionTypes, dimensionMembers, dimensionPolicies } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireType(
        repositories,
        companyId,
        dimensionTypeId,
      );
      this.assertVersion(current.version, expectedVersion);
      const members = await dimensionMembers.search(
        normalizeAccountingDimensionMemberSearchQuery({
          companyId,
          dimensionTypeId,
          pagination: { page: 1, pageSize: 1 },
        }),
      );
      if (members.totalItems > 0)
        throw new AccountingDimensionsError(
          "DIMENSION_TYPE_HAS_MEMBERS",
          "نوع بُعد دارای عضو را نمی‌توان حذف کرد.",
        );
      const policies = await dimensionPolicies.search(
        normalizeAccountDimensionPolicySearchQuery({
          companyId,
          dimensionTypeId,
          pagination: { page: 1, pageSize: 1 },
        }),
      );
      if (policies.totalItems > 0)
        throw new AccountingDimensionsError(
          "DIMENSION_TYPE_HAS_POLICIES",
          "نوع بُعد متصل به حساب را نمی‌توان حذف کرد.",
        );
      if (
        await this.usageReader.isDimensionTypeInUse(companyId, dimensionTypeId)
      )
        throw new AccountingDimensionsError(
          "DIMENSION_TYPE_IN_USE",
          "نوع بُعد استفاده‌شده را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.",
        );
      await dimensionTypes.delete(current);
      return current;
    });
    await this.publish("type", "deleted", "delete", deleted, null);
  }

  async createMember(
    command: CreateDimensionMemberCommand,
  ): Promise<AccountingDimensionMember> {
    await this.requirePermission(accountingDimensionsPermissions.create);
    const created = await this.unitOfWork.run(async (repositories) => {
      const { dimensionMembers } =
        this.requireDimensionRepositories(repositories);
      const type = await this.requireType(
        repositories,
        command.companyId,
        command.dimensionTypeId,
      );
      if (type.status !== "active")
        throw new AccountingDimensionsError(
          "DIMENSION_TYPE_INACTIVE",
          "برای نوع بُعد غیرفعال نمی‌توان عضو ایجاد کرد.",
        );
      await this.ensureMemberCodeAvailable(
        dimensionMembers,
        command.companyId,
        command.dimensionTypeId,
        command.code,
      );
      const value = createAccountingDimensionMember({
        ...command,
        id: this.idGenerator.generate(),
        createdAt: this.clock.nowIso(),
      });
      await this.assertMemberParent(repositories, type, value);
      await dimensionMembers.create(value);
      return value;
    });
    await this.publish("member", "created", "create", null, created);
    return created;
  }

  async updateMember(
    command: UpdateDimensionMemberCommand,
  ): Promise<AccountingDimensionMember> {
    await this.requirePermission(accountingDimensionsPermissions.update);
    const result = await this.unitOfWork.run(async (repositories) => {
      const { dimensionMembers } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireMember(
        repositories,
        command.companyId,
        command.memberId,
      );
      this.assertVersion(current.version, command.expectedVersion);
      const type = await this.requireType(
        repositories,
        command.companyId,
        current.dimensionTypeId,
      );
      const candidate = createAccountingDimensionMember({
        ...current,
        ...command.changes,
        id: current.id,
        companyId: current.companyId,
        dimensionTypeId: current.dimensionTypeId,
        status: current.status,
        createdAt: current.createdAt,
      });
      const updated = Object.freeze({
        ...candidate,
        status: current.status,
        createdAt: current.createdAt,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertMember(updated);
      if (updated.code !== current.code)
        await this.ensureMemberCodeAvailable(
          dimensionMembers,
          command.companyId,
          current.dimensionTypeId,
          updated.code,
          current.id,
        );
      await this.assertMemberParent(repositories, type, updated);
      await this.assertNoMemberCycle(repositories, updated);
      await dimensionMembers.update(updated);
      return { before: current, after: updated };
    });
    await this.publish(
      "member",
      "updated",
      "update",
      result.before,
      result.after,
    );
    return result.after;
  }

  async setMemberStatus(
    companyId: string,
    memberId: string,
    status: AccountingDimensionMember["status"],
    expectedVersion: number,
  ): Promise<AccountingDimensionMember> {
    await this.requirePermission(accountingDimensionsPermissions.changeStatus);
    const result = await this.unitOfWork.run(async (repositories) => {
      const { dimensionMembers } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireMember(
        repositories,
        companyId,
        memberId,
      );
      this.assertVersion(current.version, expectedVersion);
      if (status === "active")
        await this.requireActiveType(
          repositories,
          companyId,
          current.dimensionTypeId,
        );
      if (status === "inactive") {
        const children = await dimensionMembers.findChildren(
          companyId,
          memberId,
        );
        if (children.some((child) => child.status === "active"))
          throw new AccountingDimensionsError(
            "DIMENSION_MEMBER_HAS_ACTIVE_CHILDREN",
            "عضو دارای زیرمجموعه فعال را نمی‌توان غیرفعال کرد.",
          );
      }
      const updated = Object.freeze({
        ...current,
        status,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertMember(updated);
      await dimensionMembers.update(updated);
      return { before: current, after: updated };
    });
    await this.publish(
      "member",
      "status-changed",
      "status-change",
      result.before,
      result.after,
    );
    return result.after;
  }

  async deleteMember(
    companyId: string,
    memberId: string,
    expectedVersion: number,
  ): Promise<void> {
    await this.requirePermission(accountingDimensionsPermissions.delete);
    const deleted = await this.unitOfWork.run(async (repositories) => {
      const { dimensionMembers } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requireMember(
        repositories,
        companyId,
        memberId,
      );
      this.assertVersion(current.version, expectedVersion);
      if ((await dimensionMembers.findChildren(companyId, memberId)).length > 0)
        throw new AccountingDimensionsError(
          "DIMENSION_MEMBER_HAS_CHILDREN",
          "عضو دارای زیرمجموعه را نمی‌توان حذف کرد.",
        );
      if (await this.usageReader.isMemberInUse(companyId, memberId))
        throw new AccountingDimensionsError(
          "DIMENSION_MEMBER_IN_USE",
          "عضو استفاده‌شده را نمی‌توان حذف کرد؛ آن را غیرفعال کنید.",
        );
      await dimensionMembers.delete(current);
      return current;
    });
    await this.publish("member", "deleted", "delete", deleted, null);
  }

  async createPolicy(
    command: CreateDimensionPolicyCommand,
  ): Promise<AccountDimensionPolicy> {
    await this.requirePermission(
      accountingDimensionsPermissions.managePolicies,
    );
    const created = await this.unitOfWork.run(async (repositories) => {
      const { dimensionPolicies } =
        this.requireDimensionRepositories(repositories);
      await this.requireActiveAccount(
        repositories,
        command.companyId,
        command.accountId,
      );
      await this.requireActiveType(
        repositories,
        command.companyId,
        command.dimensionTypeId,
      );
      if (
        await dimensionPolicies.findByAccountAndType(
          command.companyId,
          command.accountId,
          command.dimensionTypeId,
        )
      )
        throw new AccountingDimensionsError(
          "DUPLICATE_ACCOUNT_DIMENSION_POLICY",
          "برای این حساب و نوع بُعد قبلاً سیاست تعریف شده است.",
        );
      const value = createAccountDimensionPolicy({
        ...command,
        id: this.idGenerator.generate(),
        createdAt: this.clock.nowIso(),
      });
      await dimensionPolicies.create(value);
      return value;
    });
    await this.publish("policy", "created", "create", null, created);
    return created;
  }

  async updatePolicy(
    command: UpdateDimensionPolicyCommand,
  ): Promise<AccountDimensionPolicy> {
    await this.requirePermission(
      accountingDimensionsPermissions.managePolicies,
    );
    const result = await this.unitOfWork.run(async (repositories) => {
      const { dimensionPolicies } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requirePolicy(
        repositories,
        command.companyId,
        command.policyId,
      );
      this.assertVersion(current.version, command.expectedVersion);
      const updated = Object.freeze({
        ...current,
        requirement: command.requirement,
        updatedAt: this.clock.nowIso(),
        version: current.version + 1,
      });
      this.assertPolicy(updated);
      await dimensionPolicies.update(updated);
      return { before: current, after: updated };
    });
    await this.publish(
      "policy",
      "updated",
      "update",
      result.before,
      result.after,
    );
    return result.after;
  }

  async deletePolicy(
    companyId: string,
    policyId: string,
    expectedVersion: number,
  ): Promise<void> {
    await this.requirePermission(
      accountingDimensionsPermissions.managePolicies,
    );
    const deleted = await this.unitOfWork.run(async (repositories) => {
      const { dimensionPolicies } =
        this.requireDimensionRepositories(repositories);
      const current = await this.requirePolicy(
        repositories,
        companyId,
        policyId,
      );
      this.assertVersion(current.version, expectedVersion);
      await dimensionPolicies.delete(current);
      return current;
    });
    await this.publish("policy", "deleted", "delete", deleted, null);
  }

  async getDimensionType(
    companyId: string,
    id: string,
  ): Promise<AccountingDimensionType> {
    await this.requirePermission(accountingDimensionsPermissions.view);
    return this.unitOfWork.run((r) => this.requireType(r, companyId, id));
  }
  async getMember(
    companyId: string,
    id: string,
  ): Promise<AccountingDimensionMember> {
    await this.requirePermission(accountingDimensionsPermissions.view);
    return this.unitOfWork.run((r) => this.requireMember(r, companyId, id));
  }
  async searchDimensionTypes(
    input: AccountingDimensionTypeSearchQuery,
  ): Promise<PagedResult<AccountingDimensionType>> {
    await this.requirePermission(accountingDimensionsPermissions.view);
    return this.unitOfWork.run((r) =>
      this.requireDimensionRepositories(r).dimensionTypes.search(
        normalizeAccountingDimensionTypeSearchQuery(input),
      ),
    );
  }
  async searchMembers(
    input: AccountingDimensionMemberSearchQuery,
  ): Promise<PagedResult<AccountingDimensionMember>> {
    await this.requirePermission(accountingDimensionsPermissions.view);
    return this.unitOfWork.run((r) =>
      this.requireDimensionRepositories(r).dimensionMembers.search(
        normalizeAccountingDimensionMemberSearchQuery(input),
      ),
    );
  }
  async searchPolicies(
    input: AccountDimensionPolicySearchQuery,
  ): Promise<PagedResult<AccountDimensionPolicy>> {
    await this.requirePermission(accountingDimensionsPermissions.view);
    return this.unitOfWork.run((r) =>
      this.requireDimensionRepositories(r).dimensionPolicies.search(
        normalizeAccountDimensionPolicySearchQuery(input),
      ),
    );
  }

  private requireDimensionRepositories(
    r: AccountingUnitOfWorkRepositories,
  ): DimensionRepositories {
    if (!r.dimensionTypes || !r.dimensionMembers || !r.dimensionPolicies)
      throw new AccountingDimensionsError(
        "DIMENSION_REPOSITORIES_NOT_CONFIGURED",
        "مخزن ابعاد حسابداری هنوز در واحد کار پیکربندی نشده است.",
      );
    return {
      dimensionTypes: r.dimensionTypes,
      dimensionMembers: r.dimensionMembers,
      dimensionPolicies: r.dimensionPolicies,
    };
  }
  private async requirePermission(
    permission: AccountingDimensionsPermission,
  ): Promise<void> {
    if (
      (await this.authorizer.hasPermission("system.full-access")) ||
      (await this.authorizer.hasPermission(permission))
    )
      return;
    throw new AccountingDimensionsError(
      "PERMISSION_DENIED",
      "شما مجوز انجام این عملیات در ابعاد حسابداری را ندارید.",
    );
  }
  private async requireType(
    r: AccountingUnitOfWorkRepositories,
    companyId: string,
    id: string,
  ): Promise<AccountingDimensionType> {
    const value =
      await this.requireDimensionRepositories(r).dimensionTypes.findById(id);
    if (!value || value.companyId !== companyId)
      throw new AccountingDimensionsError(
        "DIMENSION_TYPE_NOT_FOUND",
        "نوع بُعد حسابداری یافت نشد.",
      );
    return value;
  }
  private async requireActiveType(
    r: AccountingUnitOfWorkRepositories,
    companyId: string,
    id: string,
  ): Promise<AccountingDimensionType> {
    const value = await this.requireType(r, companyId, id);
    if (value.status !== "active")
      throw new AccountingDimensionsError(
        "DIMENSION_TYPE_INACTIVE",
        "نوع بُعد حسابداری غیرفعال است.",
      );
    return value;
  }
  private async requireMember(
    r: AccountingUnitOfWorkRepositories,
    companyId: string,
    id: string,
  ): Promise<AccountingDimensionMember> {
    const value =
      await this.requireDimensionRepositories(r).dimensionMembers.findById(id);
    if (!value || value.companyId !== companyId)
      throw new AccountingDimensionsError(
        "DIMENSION_MEMBER_NOT_FOUND",
        "عضو بُعد حسابداری یافت نشد.",
      );
    return value;
  }
  private async requirePolicy(
    r: AccountingUnitOfWorkRepositories,
    companyId: string,
    id: string,
  ): Promise<AccountDimensionPolicy> {
    const value =
      await this.requireDimensionRepositories(r).dimensionPolicies.findById(id);
    if (!value || value.companyId !== companyId)
      throw new AccountingDimensionsError(
        "DIMENSION_POLICY_NOT_FOUND",
        "سیاست حساب و بُعد یافت نشد.",
      );
    return value;
  }
  private async requireActiveAccount(
    r: AccountingUnitOfWorkRepositories,
    companyId: string,
    id: string,
  ): Promise<void> {
    const value = await r.accounts.findById(id);
    if (!value || value.companyId !== companyId)
      throw new AccountingDimensionsError(
        "ACCOUNT_NOT_FOUND",
        "حساب موردنظر یافت نشد.",
      );
    if (value.status !== "active")
      throw new AccountingDimensionsError(
        "ACCOUNT_INACTIVE",
        "برای حساب غیرفعال نمی‌توان سیاست بُعد تعریف کرد.",
      );
  }
  private async ensureTypeCodeAvailable(
    repo: DimensionRepositories["dimensionTypes"],
    companyId: string,
    code: string,
    ignoredId?: string,
  ): Promise<void> {
    const value = await repo.findByCode(companyId, code.trim().toUpperCase());
    if (value && value.id !== ignoredId)
      throw new AccountingDimensionsError(
        "DUPLICATE_DIMENSION_TYPE_CODE",
        "کد نوع بُعد در این شرکت تکراری است.",
      );
  }
  private async ensureMemberCodeAvailable(
    repo: DimensionRepositories["dimensionMembers"],
    companyId: string,
    typeId: string,
    code: string,
    ignoredId?: string,
  ): Promise<void> {
    const value = await repo.findByCode(
      companyId,
      typeId,
      code.trim().toUpperCase(),
    );
    if (value && value.id !== ignoredId)
      throw new AccountingDimensionsError(
        "DUPLICATE_DIMENSION_MEMBER_CODE",
        "کد عضو در این نوع بُعد تکراری است.",
      );
  }
  private async assertMemberParent(
    r: AccountingUnitOfWorkRepositories,
    type: AccountingDimensionType,
    member: AccountingDimensionMember,
  ): Promise<void> {
    if (member.parentId === null) return;
    if (!type.hierarchical)
      throw new AccountingDimensionsError(
        "DIMENSION_TYPE_NOT_HIERARCHICAL",
        "برای نوع بُعد غیرسلسله‌مراتبی نمی‌توان والد تعیین کرد.",
      );
    const parent = await this.requireDimensionRepositories(
      r,
    ).dimensionMembers.findById(member.parentId);
    if (
      !parent ||
      parent.companyId !== member.companyId ||
      parent.dimensionTypeId !== member.dimensionTypeId
    )
      throw new AccountingDimensionsError(
        "DIMENSION_MEMBER_PARENT_MISMATCH",
        "والد عضو باید متعلق به همان شرکت و همان نوع بُعد باشد.",
      );
  }
  private async assertNoMemberCycle(
    r: AccountingUnitOfWorkRepositories,
    member: AccountingDimensionMember,
  ): Promise<void> {
    let parentId = member.parentId;
    const visited = new Set([member.id]);
    while (parentId) {
      if (visited.has(parentId))
        throw new AccountingDimensionsError(
          "DIMENSION_MEMBER_TREE_CYCLE",
          "تغییر والد باعث ایجاد چرخه در اعضای بُعد می‌شود.",
        );
      visited.add(parentId);
      parentId =
        (
          await this.requireDimensionRepositories(r).dimensionMembers.findById(
            parentId,
          )
        )?.parentId ?? null;
    }
  }
  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected)
      throw new AccountingDimensionsError(
        "VERSION_MISMATCH",
        "اطلاعات ابعاد حسابداری تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.",
      );
  }
  private assertType(value: AccountingDimensionType): void {
    const issues = validateAccountingDimensionType(value);
    if (issues.length) throw new AccountingDimensionTypeValidationError(issues);
  }
  private assertMember(value: AccountingDimensionMember): void {
    const issues = validateAccountingDimensionMember(value);
    if (issues.length)
      throw new AccountingDimensionMemberValidationError(issues);
  }
  private assertPolicy(value: AccountDimensionPolicy): void {
    const issues = validateAccountDimensionPolicy(value);
    if (issues.length) throw new AccountDimensionPolicyValidationError(issues);
  }
  private publish(
    kind: "type" | "member" | "policy",
    suffix: "created" | "updated" | "deleted" | "status-changed",
    action: "create" | "update" | "delete" | "status-change",
    before:
      | AccountingDimensionType
      | AccountingDimensionMember
      | AccountDimensionPolicy
      | null,
    after:
      | AccountingDimensionType
      | AccountingDimensionMember
      | AccountDimensionPolicy
      | null,
  ): Promise<void> {
    const value = after ?? before!;
    const eventType =
      `accounting.dimension-${kind}.${suffix}` as AccountingDimensionsEventType;
    return this.eventBus.publish(
      createAccountingDimensionsEvent(
        { clock: this.clock, idGenerator: this.idGenerator },
        this.context,
        {
          eventType,
          action,
          aggregateId: value.id,
          aggregateType:
            kind === "type"
              ? "accounting-dimension-type"
              : kind === "member"
                ? "accounting-dimension-member"
                : "account-dimension-policy",
          aggregateVersion: value.version,
          companyId: value.companyId,
          before,
          after,
        },
      ),
    );
  }
}
