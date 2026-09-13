import type { DatabaseExecutor } from "@argin/database";
import type { ProductSelectorItemDto } from "@argin/product";
import { SqliteProductSelectorReader } from "@argin/product-tauri";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import { inventoryValuationPermissions } from "@argin/inventory/valuation-security";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type {
  InventoryValuationAsOfReport,
  InventoryValuationLayerReport,
  InventoryValuationMonetaryKardexReport,
  InventoryValuationRecalculationStatusReport,
  InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
import {
  SqliteInventoryValuationPolicyRepository,
  SqliteInventoryValuationReportReader,
} from "@argin/inventory-tauri";

export interface InventoryValuationWorkspaceServices {
  canView: boolean;
  canManagePolicy: boolean;

  readAsOf(query: {
    companyId: string;
    branchId: string | null;
    asOfBusinessDate: string;
    productId: string | null;
    warehouseId: string | null;
    limit: number;
  }): Promise<InventoryValuationAsOfReport>;

  readKardex(query: {
    companyId: string;
    branchId: string | null;
    productId: string;
    warehouseId: string;
    businessDateFrom: string | null;
    businessDateTo: string | null;
    cursor: string | null;
    limit: number;
  }): Promise<InventoryValuationMonetaryKardexReport>;

  readLayers(query: {
    companyId: string;
    branchId: string | null;
    productId: string | null;
    warehouseId: string | null;
    onlyOpen: boolean;
    limit: number;
  }): Promise<InventoryValuationLayerReport>;

  readUnresolved(query: {
    companyId: string;
    branchId: string | null;
    productId: string | null;
    warehouseId: string | null;
    fromBusinessDate: string | null;
    limit: number;
  }): Promise<InventoryValuationUnresolvedReport>;

  readStatus(
    companyId: string,
    productId: string | null,
  ): Promise<InventoryValuationRecalculationStatusReport>;

  getPolicyHistory(
    companyId: string,
  ): Promise<readonly InventoryValuationPolicySnapshot[]>;

  selectProducts(companyId: string): Promise<readonly ProductSelectorItemDto[]>;

  selectWarehouses(
    companyId: string,
    branchId: string | null,
  ): Promise<readonly WarehouseListItemDto[]>;
}

export function createInventoryValuationWorkspaceServices(
  database: DatabaseExecutor,
  permissions: readonly string[],
  branchIds: readonly string[],
): InventoryValuationWorkspaceServices {
  const reports = new SqliteInventoryValuationReportReader(database);
  const policies = new SqliteInventoryValuationPolicyRepository(database);
  const products = new SqliteProductSelectorReader(database);
  const warehouses = new SqliteWarehouseReader(database);

  const hasFullAccess = permissions.includes("system.full-access");

  function hasPermission(permission: string): boolean {
    return hasFullAccess || permissions.includes(permission);
  }

  function requireViewPermission(): void {
    if (!hasPermission(inventoryValuationPermissions.view)) {
      throw new Error("برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.");
    }
  }

  function requireBranchAccess(branchId: string | null): void {
    if (
      !hasFullAccess &&
      (branchId === null || !branchIds.includes(branchId))
    ) {
      throw new Error("محدوده شعبه مجاز نیست.");
    }
  }

  return {
    canView: hasPermission(inventoryValuationPermissions.view),
    canManagePolicy: hasPermission(inventoryValuationPermissions.policyManage),

    async readAsOf(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      return reports.readAsOf(query);
    },

    async readKardex(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      return reports.readMonetaryKardex(query);
    },

    async readLayers(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      return reports.readLayers(query);
    },

    async readUnresolved(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      return reports.readUnresolved(query);
    },

    async readStatus(companyId, productId) {
      requireViewPermission();
      return reports.readRecalculationStatus({ companyId, productId });
    },

    async getPolicyHistory(companyId) {
      requireViewPermission();
      return policies.listByCompany(companyId);
    },

    async selectProducts(companyId) {
      requireViewPermission();
      return products.select({
        companyId,
        search: null,
        kinds: ["product"],
        statuses: ["active"],
        stockTracking: true,
        limit: 100,
      });
    },

    async selectWarehouses(companyId, branchId) {
      requireViewPermission();
      requireBranchAccess(branchId);
      return warehouses.select({
        companyId,
        branchId: branchId ?? undefined,
        includeCompanyWide: true,
        statuses: ["active"],
        limit: 100,
      });
    },
  };
}
