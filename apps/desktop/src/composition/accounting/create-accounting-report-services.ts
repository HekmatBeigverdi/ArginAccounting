import {
  DefaultAccountingReportQueryService,
  type AccountingReportQueryService,
} from "@argin/accounting/reporting-application";
import type { AccountingReportQuery } from "@argin/accounting/reporting";
import {
  assertAccountingReportExportAuthorized,
  SecuredAccountingReportQueryService,
  type AccountingReportAuthorizer,
  type AccountingReportScopeAuthorizer,
  type AccountingReportSecurityDependencies,
} from "@argin/accounting/reporting-security";
import { SqliteAccountingReportDataReader } from "@argin/accounting-tauri";
import { SqliteBranchRepository } from "@argin/company-tauri";
import type { DatabaseSession } from "@argin/database";
import type { AuthSession } from "@argin/security";

export interface AccountingReportDesktopServices {
  readonly queries: AccountingReportQueryService;
  authorizeExport(report: AccountingReportQuery): Promise<void>;
}

export function createAccountingReportServices(input: {
  readonly database: DatabaseSession;
  readonly session: AuthSession | null;
}): AccountingReportDesktopServices {
  const permissions = new Set(input.session?.user.permissions ?? []);
  const branchIds = new Set(input.session?.user.branchIds ?? []);
  const isFullAccess = permissions.has("system.full-access");
  const branches = new SqliteBranchRepository(input.database);

  const authorizer: AccountingReportAuthorizer = {
    async hasPermission(permission) {
      return isFullAccess || permissions.has(permission);
    },
  };

  const scope: AccountingReportScopeAuthorizer = {
    async canAccessCompany(companyId) {
      if (isFullAccess) return true;
      const companyBranches = await branches.findByCompanyId(companyId);
      return companyBranches.some((branch) => branchIds.has(branch.id));
    },
    async canAccessBranch(companyId, branchId) {
      if (isFullAccess) return true;
      if (!branchIds.has(branchId)) return false;
      const branch = await branches.findById(branchId);
      return branch?.companyId === companyId;
    },
    async canAccessAllBranches(companyId) {
      if (isFullAccess) return true;
      const companyBranches = await branches.findByCompanyId(companyId);
      const activeBranches = companyBranches.filter((branch) => branch.status === "active");
      return activeBranches.length > 0 && activeBranches.every((branch) => branchIds.has(branch.id));
    },
  };

  const security: AccountingReportSecurityDependencies = Object.freeze({
    authorizer,
    scope,
  });
  const reader = new SqliteAccountingReportDataReader(input.database);
  const core = new DefaultAccountingReportQueryService(reader);

  return Object.freeze({
    queries: new SecuredAccountingReportQueryService(core, security),
    authorizeExport: (report) => assertAccountingReportExportAuthorized(report, security),
  });
}
