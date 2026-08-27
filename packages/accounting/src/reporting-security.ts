import {
  accountingReportPermissions,
  type AccountingReportPermission,
} from "./application/accounting-report-permissions.ts";
import type {
  AccountingReportQueryService,
  DimensionReportQueryRequest,
  GeneralLedgerQueryRequest,
  JournalReportQueryRequest,
  SubsidiaryLedgerQueryRequest,
  TrialBalanceQueryRequest,
} from "./reporting-application.ts";
import type { AccountingReportQuery } from "./reporting.ts";

export interface AccountingReportAuthorizer {
  hasPermission(permission: AccountingReportPermission): Promise<boolean>;
}

export interface AccountingReportScopeAuthorizer {
  canAccessCompany(companyId: string): Promise<boolean>;
  canAccessBranch(companyId: string, branchId: string): Promise<boolean>;
  canAccessAllBranches(companyId: string): Promise<boolean>;
}

export interface AccountingReportSecurityDependencies {
  readonly authorizer: AccountingReportAuthorizer;
  readonly scope: AccountingReportScopeAuthorizer;
}

export type AccountingReportSecurityErrorCode =
  | "report.unauthorized"
  | "report.scope-denied";

export class AccountingReportSecurityError extends Error {
  readonly code: AccountingReportSecurityErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: AccountingReportSecurityErrorCode,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AccountingReportSecurityError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class SecuredAccountingReportQueryService implements AccountingReportQueryService {
  constructor(
    private readonly inner: AccountingReportQueryService,
    private readonly security: AccountingReportSecurityDependencies,
  ) {}

  async trialBalance(request: TrialBalanceQueryRequest) {
    await this.assertReadable(
      accountingReportPermissions.viewTrialBalance,
      request.report,
    );
    return this.inner.trialBalance(request);
  }

  async generalLedger(request: GeneralLedgerQueryRequest) {
    await this.assertReadable(
      accountingReportPermissions.viewGeneralLedger,
      request.report,
    );
    return this.inner.generalLedger(request);
  }

  async subsidiaryLedger(request: SubsidiaryLedgerQueryRequest) {
    await this.assertReadable(
      accountingReportPermissions.viewSubsidiaryLedger,
      request.report,
    );
    return this.inner.subsidiaryLedger(request);
  }

  async journal(request: JournalReportQueryRequest) {
    await this.assertReadable(
      accountingReportPermissions.viewJournal,
      request.report,
    );
    return this.inner.journal(request);
  }

  async dimensions(request: DimensionReportQueryRequest) {
    await this.assertReadable(
      accountingReportPermissions.viewDimensions,
      request.report,
    );
    return this.inner.dimensions(request);
  }

  private async assertReadable(
    permission: AccountingReportPermission,
    report: AccountingReportQuery,
  ): Promise<void> {
    if (!(await this.security.authorizer.hasPermission(permission))) {
      throw new AccountingReportSecurityError(
        "report.unauthorized",
        "شما مجوز مشاهده این گزارش حسابداری را ندارید.",
        { permission },
      );
    }
    await assertAccountingReportScopeAuthorized(report, this.security.scope);
  }
}

export async function assertAccountingReportExportAuthorized(
  report: AccountingReportQuery,
  security: AccountingReportSecurityDependencies,
): Promise<void> {
  if (!(await security.authorizer.hasPermission(accountingReportPermissions.export))) {
    throw new AccountingReportSecurityError(
      "report.unauthorized",
      "شما مجوز خروجی‌گرفتن از گزارش‌های حسابداری را ندارید.",
      { permission: accountingReportPermissions.export },
    );
  }
  await assertAccountingReportScopeAuthorized(report, security.scope);
}

export async function assertAccountingReportScopeAuthorized(
  report: AccountingReportQuery,
  scope: AccountingReportScopeAuthorizer,
): Promise<void> {
  const companyId = report.companyId.trim();
  if (!companyId || !(await scope.canAccessCompany(companyId))) {
    throwScopeDenied();
  }

  const branch = report.branch;
  if (!branch || branch.mode === "all") {
    if (!(await scope.canAccessAllBranches(companyId))) throwScopeDenied();
    return;
  }

  const branchId = branch.branchId.trim();
  if (!branchId || !(await scope.canAccessBranch(companyId, branchId))) {
    throwScopeDenied();
  }
}

function throwScopeDenied(): never {
  throw new AccountingReportSecurityError(
    "report.scope-denied",
    "گزارش در محدوده دسترسی شما قابل مشاهده نیست.",
  );
}
