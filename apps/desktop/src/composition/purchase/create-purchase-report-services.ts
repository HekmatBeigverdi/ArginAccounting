import type { DatabaseExecutor } from "@argin/database";
import { purchasePermissions, type PurchaseDocumentRegisterReport, type PurchaseInvoiceMatchingReport, type PurchaseOperationalReportQuery, type PurchaseSupplierActivitySummaryReport, type PurchaseUnresolvedCostReport } from "@argin/purchase";
import { SqlitePurchaseOperationalReportReader } from "@argin/purchase-tauri";
import type { PartySelectorDto } from "@argin/party";
import { SqlitePartyReader } from "@argin/party-tauri";

export interface PurchaseReportActor {
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface PurchaseReportFilters {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string | null;
  readonly supplierId?: string | null;
  readonly fromBusinessDate?: string | null;
  readonly toBusinessDate?: string | null;
  readonly limit?: number;
  readonly offset?: number;
}

export interface PurchaseReportServices {
  readonly canView: boolean;
  readonly canViewCompanyWide: boolean;
  selectSuppliers(companyId: string, search?: string): Promise<readonly PartySelectorDto[]>;
  readDocumentRegister(filters: PurchaseReportFilters): Promise<PurchaseDocumentRegisterReport>;
  readSupplierActivity(filters: PurchaseReportFilters): Promise<PurchaseSupplierActivitySummaryReport>;
  readInvoiceMatching(filters: PurchaseReportFilters): Promise<PurchaseInvoiceMatchingReport>;
  readUnresolvedCosts(filters: PurchaseReportFilters): Promise<PurchaseUnresolvedCostReport>;
}

export function createPurchaseReportServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: PurchaseReportActor;
}): PurchaseReportServices {
  const reports = new SqlitePurchaseOperationalReportReader(input.database);
  const parties = new SqlitePartyReader(input.database);
  const fullAccess = input.actor.permissions.includes("system.full-access");
  const canView = fullAccess || input.actor.permissions.includes(purchasePermissions.view);

  const requireView = (): void => {
    if (!canView) throw new Error("برای مشاهده گزارش‌های خرید مجوز کافی ندارید.");
  };

  const requireBranch = (branchId: string | null): void => {
    if (fullAccess) return;
    if (branchId === null) throw new Error("نمای کل شرکت فقط برای کاربر دارای دسترسی کامل مجاز است.");
    if (!input.actor.branchIds.includes(branchId)) {
      throw new Error("شعبه انتخاب‌شده در محدوده دسترسی کاربر نیست.");
    }
  };

  const query = (filters: PurchaseReportFilters): PurchaseOperationalReportQuery => {
    requireView();
    requireBranch(filters.branchId);
    return {
      companyId: filters.companyId,
      branchId: filters.branchId,
      fiscalYearId: filters.fiscalYearId,
      supplierId: filters.supplierId ?? null,
      fromBusinessDate: filters.fromBusinessDate ?? null,
      toBusinessDate: filters.toBusinessDate ?? null,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    };
  };

  return Object.freeze({
    canView,
    canViewCompanyWide: fullAccess,
    async selectSuppliers(companyId, search) {
      requireView();
      return parties.select({
        companyId,
        search: search ?? null,
        roles: ["supplier"],
        statuses: ["active"],
        limit: 100,
      });
    },
    readDocumentRegister: filters => reports.readDocumentRegister(query(filters)),
    readSupplierActivity: filters => reports.readSupplierActivity(query(filters)),
    readInvoiceMatching: filters => reports.readInvoiceMatching(query(filters)),
    readUnresolvedCosts: filters => reports.readUnresolvedCosts(query(filters)),
  });
}
