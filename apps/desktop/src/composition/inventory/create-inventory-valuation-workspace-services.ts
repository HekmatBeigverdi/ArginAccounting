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
  SqliteInventoryInboundCostInputService,
  SqliteInventoryValuationPolicyRepository,
  SqliteInventoryValuationReportReader,
  SqliteInventoryValuationStatusReader,
  type InventoryInboundCostCandidate,
  type InventoryResolvedInboundCost,
  type SetManualInventoryInboundCostResult,
} from "@argin/inventory-tauri";

export type InventoryInboundCostDisplayCandidate = InventoryInboundCostCandidate & {
  readonly documentLabel: string;
  readonly productLabel: string;
  readonly warehouseLabel: string;
};

export type InventoryResolvedInboundCostDisplay = InventoryResolvedInboundCost & {
  readonly documentLabel: string;
  readonly productLabel: string;
  readonly warehouseLabel: string;
};

type DocumentLabelRow = { id: string; document_number: string | null };
type ProductLabelRow = { id: string; code: string; title: string };
type WarehouseLabelRow = { id: string; code: string; title: string };
type ReversalRow = { reversal_of_movement_id: string };
type BusinessRow = {
  readonly documentId: string;
  readonly productId: string;
  readonly warehouseId: string;
};
type MovementRow = { readonly movementId: string };

const shortId = (value: string) =>
  value.length > 12 ? `${value.slice(0, 8)}…` : value;

export interface InventoryValuationWorkspaceServices {
  canView: boolean;
  canManagePolicy: boolean;
  canResolveCostInput: boolean;
  canCorrectCostInput: boolean;

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

  readInboundCostCandidates(query: {
    companyId: string;
    branchId: string | null;
    productId: string | null;
    warehouseId: string | null;
    fromBusinessDate: string | null;
    limit: number;
  }): Promise<readonly InventoryInboundCostDisplayCandidate[]>;

  readResolvedInboundCosts(query: {
    companyId: string;
    branchId: string | null;
    productId: string | null;
    warehouseId: string | null;
    fromBusinessDate: string | null;
    limit: number;
  }): Promise<readonly InventoryResolvedInboundCostDisplay[]>;

  setManualInboundCost(input: {
    companyId: string;
    movementId: string;
    unitCost: string;
    actorId: string;
    requestId: string;
    occurredAt: string;
  }): Promise<SetManualInventoryInboundCostResult>;

  correctManualInboundCost(input: {
    companyId: string;
    movementId: string;
    unitCost: string;
    reason: string;
    expectedRevision: number;
    actorId: string;
    requestId: string;
    occurredAt: string;
  }): Promise<SetManualInventoryInboundCostResult>;

  readStatus(
    companyId: string,
    productId: string | null,
  ): Promise<InventoryValuationRecalculationStatusReport>;
  getPolicyHistory(
    companyId: string,
  ): Promise<readonly InventoryValuationPolicySnapshot[]>;
  selectProducts(
    companyId: string,
  ): Promise<readonly ProductSelectorItemDto[]>;
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
  const statusReader = new SqliteInventoryValuationStatusReader(database);
  const policies = new SqliteInventoryValuationPolicyRepository(database);
  const inboundCosts = new SqliteInventoryInboundCostInputService(database);
  const products = new SqliteProductSelectorReader(database);
  const warehouses = new SqliteWarehouseReader(database);
  const hasFullAccess = permissions.includes("system.full-access");

  function hasPermission(permission: string): boolean {
    return hasFullAccess || permissions.includes(permission);
  }

  function requireViewPermission(): void {
    if (!hasPermission(inventoryValuationPermissions.view))
      throw new Error("برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.");
  }

  function requireCostResolutionPermission(): void {
    if (!hasPermission(inventoryValuationPermissions.resolve))
      throw new Error("برای ثبت بهای ورودی مجوز کافی ندارید.");
  }

  function requireCostCorrectionPermission(): void {
    if (!hasPermission(inventoryValuationPermissions.costInputCorrect))
      throw new Error("برای اصلاح بهای ورودی مجوز کافی ندارید.");
  }

  function requireBranchAccess(branchId: string | null): void {
    if (
      !hasFullAccess &&
      (branchId === null || !branchIds.includes(branchId))
    )
      throw new Error("محدوده شعبه مجاز نیست.");
  }

  async function excludeReversedInboundCandidates<T extends MovementRow>(
    companyId: string,
    rows: readonly T[],
  ): Promise<readonly T[]> {
    if (rows.length === 0) return Object.freeze([]);

    const movementIds = [...new Set(rows.map((row) => row.movementId))];
    const reversed = await database.query<ReversalRow>(
      `SELECT DISTINCT reversal_of_movement_id
       FROM inventory_all_stock_movements
       WHERE company_id=?
         AND reversal_of_movement_id IN (${movementIds.map(() => "?").join(",")})`,
      [companyId, ...movementIds],
    );

    if (reversed.length === 0) return Object.freeze([...rows]);
    const reversedIds = new Set(
      reversed.map((row) => row.reversal_of_movement_id),
    );
    return Object.freeze(
      rows.filter((row) => !reversedIds.has(row.movementId)),
    );
  }

  async function addBusinessLabels<T extends BusinessRow>(
    companyId: string,
    rows: readonly T[],
  ) {
    if (rows.length === 0) return Object.freeze([]);
    const documentIds = [...new Set(rows.map((row) => row.documentId))];
    const productIds = [...new Set(rows.map((row) => row.productId))];
    const warehouseIds = [...new Set(rows.map((row) => row.warehouseId))];
    const [documentRows, productRows, warehouseRows] = await Promise.all([
      database.query<DocumentLabelRow>(
        `SELECT id,document_number FROM inventory_documents WHERE company_id=? AND id IN (${documentIds.map(() => "?").join(",")})`,
        [companyId, ...documentIds],
      ),
      database.query<ProductLabelRow>(
        `SELECT id,code,title FROM products WHERE company_id=? AND id IN (${productIds.map(() => "?").join(",")})`,
        [companyId, ...productIds],
      ),
      database.query<WarehouseLabelRow>(
        `SELECT id,code,title FROM warehouses WHERE company_id=? AND id IN (${warehouseIds.map(() => "?").join(",")})`,
        [companyId, ...warehouseIds],
      ),
    ]);
    const documentMap = new Map(
      documentRows.map((row) => [row.id, row.document_number]),
    );
    const productMap = new Map(
      productRows.map((row) => [row.id, `${row.code} — ${row.title}`]),
    );
    const warehouseMap = new Map(
      warehouseRows.map((row) => [row.id, `${row.code} — ${row.title}`]),
    );
    return Object.freeze(
      rows.map((row) =>
        Object.freeze({
          ...row,
          documentLabel:
            documentMap.get(row.documentId) ?? `سند ${shortId(row.documentId)}`,
          productLabel:
            productMap.get(row.productId) ?? shortId(row.productId),
          warehouseLabel:
            warehouseMap.get(row.warehouseId) ?? shortId(row.warehouseId),
        }),
      ),
    );
  }

  return {
    canView: hasPermission(inventoryValuationPermissions.view),
    canManagePolicy: hasPermission(inventoryValuationPermissions.policyManage),
    canResolveCostInput: hasPermission(inventoryValuationPermissions.resolve),
    canCorrectCostInput: hasPermission(
      inventoryValuationPermissions.costInputCorrect,
    ),

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
    async readInboundCostCandidates(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      const candidates = await inboundCosts.listCandidates(query);
      const activeCandidates = await excludeReversedInboundCandidates(
        query.companyId,
        candidates,
      );
      return addBusinessLabels(query.companyId, activeCandidates);
    },
    async readResolvedInboundCosts(query) {
      requireViewPermission();
      requireBranchAccess(query.branchId);
      return addBusinessLabels(
        query.companyId,
        await inboundCosts.listResolved(query),
      );
    },
    async setManualInboundCost(input) {
      requireCostResolutionPermission();
      return inboundCosts.setManualCost(input);
    },
    async correctManualInboundCost(input) {
      requireCostCorrectionPermission();
      return inboundCosts.correctManualCost(input);
    },
    async readStatus(companyId, productId) {
      requireViewPermission();
      return statusReader.read({ companyId, productId });
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
