import { inventoryPermissions, type InventoryDocumentDetail, type InventoryKardexReport, type InventoryQuantityBalanceReport, type InventoryStockKey } from "@argin/inventory";
import { SqliteInventoryQuantityReportReader, SqliteInventoryWorkspaceReader } from "@argin/inventory-tauri";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteProductSelectorReader } from "@argin/product-tauri";
import type { ProductSelectorItemDto } from "@argin/product";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { WarehouseListItemDto, WarehouseLocationDto, WarehouseZoneDto } from "@argin/warehouse";

export interface InventoryReportActor {
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}

export interface InventoryReportServices {
  readonly canView: boolean;
  readBalances(input: {
    companyId: string;
    branchId: string | null;
    productId?: string | null;
    warehouseId?: string | null;
    zoneId?: string | null;
    locationId?: string | null;
    includeZero?: boolean;
    cursor?: string | null;
    limit?: number;
  }): Promise<InventoryQuantityBalanceReport>;
  readKardex(input: {
    companyId: string;
    branchId: string | null;
    stockKey: InventoryStockKey;
    businessDateFrom?: string | null;
    businessDateTo?: string | null;
    cursor?: string | null;
    limit?: number;
  }): Promise<InventoryKardexReport>;
  getDocument(companyId: string, documentId: string): Promise<InventoryDocumentDetail | null>;
  selectProducts(companyId: string, search?: string): Promise<readonly ProductSelectorItemDto[]>;
  selectWarehouses(companyId: string, branchId: string | null): Promise<readonly WarehouseListItemDto[]>;
  listZones(companyId: string, warehouseId: string): Promise<readonly WarehouseZoneDto[]>;
  listLocations(companyId: string, warehouseId: string, zoneId?: string | null): Promise<readonly WarehouseLocationDto[]>;
}

export function createInventoryReportServices(input: {
  readonly database: DatabaseExecutor;
  readonly actor: InventoryReportActor;
}): InventoryReportServices {
  const reports = new SqliteInventoryQuantityReportReader(input.database);
  const documents = new SqliteInventoryWorkspaceReader(input.database);
  const products = new SqliteProductSelectorReader(input.database);
  const warehouses = new SqliteWarehouseReader(input.database);
  const fullAccess = input.actor.permissions.includes("system.full-access");
  const canView = fullAccess || input.actor.permissions.includes(inventoryPermissions.view);

  const requireView = (): void => {
    if (!canView) throw new Error("برای مشاهده گزارش‌های موجودی مجوز کافی ندارید.");
  };
  const requireBranch = (branchId: string | null): void => {
    if (fullAccess || branchId === null) return;
    if (!input.actor.branchIds.includes(branchId)) throw new Error("شعبه انتخاب‌شده در محدوده دسترسی کاربر نیست.");
  };

  return Object.freeze({
    canView,
    async readBalances(args) {
      requireView(); requireBranch(args.branchId);
      return reports.readBalances({
        companyId: args.companyId,
        branchId: args.branchId,
        productId: args.productId ?? null,
        warehouseId: args.warehouseId ?? null,
        zoneId: args.zoneId ?? null,
        locationId: args.locationId ?? null,
        includeZero: args.includeZero ?? false,
        cursor: args.cursor ?? null,
        limit: args.limit ?? 100,
      });
    },
    async readKardex(args) {
      requireView(); requireBranch(args.branchId);
      return reports.readKardex({
        companyId: args.companyId,
        branchId: args.branchId,
        stockKey: args.stockKey,
        businessDateFrom: args.businessDateFrom ?? null,
        businessDateTo: args.businessDateTo ?? null,
        cursor: args.cursor ?? null,
        limit: args.limit ?? 100,
      });
    },
    async getDocument(companyId, documentId) {
      requireView();
      return documents.getDocument(companyId, documentId);
    },
    async selectProducts(companyId, search) {
      requireView();
      return products.select({ companyId, search: search ?? null, kinds: ["product"], statuses: ["active"], stockTracking: true, limit: 100 });
    },
    async selectWarehouses(companyId, branchId) {
      requireView(); requireBranch(branchId);
      return warehouses.select({ companyId, branchId: branchId ?? undefined, includeCompanyWide: true, statuses: ["active"], limit: 100 });
    },
    async listZones(companyId, warehouseId) {
      requireView();
      return warehouses.listZones({ companyId, warehouseId, statuses: ["active"] });
    },
    async listLocations(companyId, warehouseId, zoneId) {
      requireView();
      return warehouses.listLocations({ companyId, warehouseId, zoneId: zoneId ?? undefined, statuses: ["active"] });
    },
  });
}
