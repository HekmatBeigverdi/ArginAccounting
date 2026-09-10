import type { ProductDto } from "@argin/product";
import { createWarehouseOperationalReference } from "@argin/warehouse";
import type { WarehouseOperationalReference, WarehouseDto, WarehouseZoneDto, WarehouseLocationDto } from "@argin/warehouse";
import { INVENTORY_DOMAIN_ERROR_CODES as codes, InventoryDomainError } from "./inventory-errors.ts";
import { createInventoryQuantitySnapshot, rehydrateInventoryQuantitySnapshot } from "./inventory-quantity.ts";
import type { InventoryQuantitySnapshot } from "./inventory-quantity.ts";

type DeletionMetadata = { readonly deletedAt?: string | null };
export type InventoryProductReference = Pick<ProductDto, "companyId" | "productId" | "kind" | "status" | "version" | "units" | "masterData"> & DeletionMetadata;
export interface InventoryWarehouseResolution {
  readonly warehouse: (Pick<WarehouseDto, "companyId" | "warehouseId" | "status"> & DeletionMetadata) | null;
  readonly zone?: (Pick<WarehouseZoneDto, "companyId" | "warehouseId" | "zoneId" | "status"> & DeletionMetadata) | null;
  readonly location?: (Pick<WarehouseLocationDto, "companyId" | "warehouseId" | "zoneId" | "locationId" | "status"> & DeletionMetadata) | null;
}
export interface InventoryLineOperationSnapshot {
  readonly companyId: string;
  readonly productId: string;
  readonly productVersion: number;
  readonly quantity: InventoryQuantitySnapshot;
  readonly warehouse: WarehouseOperationalReference;
  readonly destination: WarehouseOperationalReference | null;
}
const fail = (code: (typeof codes)[keyof typeof codes], field: string): never => { throw new InventoryDomainError(code, field); };
function id(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(codes.referenceInvalid, field);
  return value.trim();
}
function reference(input: WarehouseOperationalReference): WarehouseOperationalReference {
  if (!input || typeof input !== "object") return fail(codes.referenceInvalid, "warehouse");
  const warehouseId = id(input.warehouseId, "warehouseId");
  const zoneId = input.zoneId == null ? null : id(input.zoneId, "zoneId");
  const locationId = input.locationId == null ? null : id(input.locationId, "locationId");
  if (locationId && !zoneId) return fail(codes.referenceInvalid, "zoneId");
  return createWarehouseOperationalReference({ warehouseId, zoneId, locationId });
}
/** Resolutions must come from Company-scoped upstream readers, excluding tombstones. */
export function validateInventoryWarehouseReference(
  companyId: string, requested: WarehouseOperationalReference, resolved: InventoryWarehouseResolution,
): WarehouseOperationalReference {
  const company = id(companyId, "companyId");
  const ref = reference(requested);
  const warehouse = resolved?.warehouse;
  if (!warehouse || warehouse.companyId !== company || warehouse.warehouseId !== ref.warehouseId) {
    return fail(codes.referenceMismatch, "warehouse");
  }
  if (warehouse.status !== "active" || warehouse.deletedAt != null) return fail(codes.referenceIneligible, "warehouse");
  if (ref.zoneId) {
    const zone = resolved.zone;
    if (!zone || zone.companyId !== company || zone.warehouseId !== ref.warehouseId || zone.zoneId !== ref.zoneId) {
      return fail(codes.referenceMismatch, "zone");
    }
    if (zone.status !== "active" || zone.deletedAt != null) return fail(codes.referenceIneligible, "zone");
  } else if (resolved.zone != null) return fail(codes.referenceMismatch, "zone");
  if (ref.locationId) {
    const location = resolved.location;
    if (!location || location.companyId !== company || location.warehouseId !== ref.warehouseId ||
        location.zoneId !== ref.zoneId || location.locationId !== ref.locationId) return fail(codes.referenceMismatch, "location");
    if (location.status !== "active" || location.deletedAt != null) return fail(codes.referenceIneligible, "location");
  } else if (resolved.location != null) return fail(codes.referenceMismatch, "location");
  return ref;
}
export function assertInventoryProductEligible(companyId: string, productId: string, product: InventoryProductReference | null): void {
  const company = id(companyId, "companyId"), productIdentity = id(productId, "productId");
  if (!product || product.companyId !== company || product.productId !== productIdentity) return fail(codes.productReferenceMismatch, "product");
  const operational = product.masterData?.operational;
  if (product.kind !== "product" || product.status !== "active" || product.deletedAt != null || !product.units ||
      operational?.stockTracking !== true || operational.serialTracking !== false || operational.lotTracking !== false ||
      operational.shelfLifeDays !== null) return fail(codes.productIneligible, "product");
  if (!Number.isSafeInteger(product.version) || product.version < 1) return fail(codes.versionInvalid, "product.version");
}
export function createInventoryLineOperation(input: {
  readonly companyId: string;
  readonly productId: string;
  readonly product: InventoryProductReference | null;
  readonly enteredQuantity: string;
  readonly unitId: string;
  readonly warehouse: WarehouseOperationalReference;
  readonly resolvedWarehouse: InventoryWarehouseResolution;
  readonly destination?: WarehouseOperationalReference | null;
  readonly resolvedDestination?: InventoryWarehouseResolution | null;
}): InventoryLineOperationSnapshot {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "operation");
  assertInventoryProductEligible(input.companyId, input.productId, input.product);
  const product = input.product;
  if (!product?.units) return fail(codes.productIneligible, "product.units");
  const warehouse = validateInventoryWarehouseReference(input.companyId, input.warehouse, input.resolvedWarehouse);
  const destination = input.destination == null ? null
    : validateInventoryWarehouseReference(input.companyId, input.destination, input.resolvedDestination ?? { warehouse: null });
  if (!destination && input.resolvedDestination != null) return fail(codes.referenceMismatch, "destination");
  return rehydrateInventoryLineOperation({
    companyId: id(input.companyId, "companyId"), productId: id(input.productId, "productId"), productVersion: product.version,
    quantity: createInventoryQuantitySnapshot({ enteredQuantity: input.enteredQuantity, unitId: input.unitId, profile: product.units }),
    warehouse, destination,
  });
}
/** Historical read validates structure and conversion; never reselects mutable masters. */
export function rehydrateInventoryLineOperation(input: InventoryLineOperationSnapshot): InventoryLineOperationSnapshot {
  if (!input || typeof input !== "object") return fail(codes.inputInvalid, "operation");
  if (!Number.isSafeInteger(input.productVersion) || input.productVersion < 1) return fail(codes.versionInvalid, "productVersion");
  const warehouse = reference(input.warehouse);
  const destination = input.destination == null ? null : reference(input.destination);
  if (destination && warehouse.warehouseId === destination.warehouseId &&
      warehouse.zoneId === destination.zoneId && warehouse.locationId === destination.locationId) return fail(codes.operationMismatch, "destination");
  return Object.freeze({
    companyId: id(input.companyId, "companyId"), productId: id(input.productId, "productId"), productVersion: input.productVersion,
    quantity: rehydrateInventoryQuantitySnapshot(input.quantity), warehouse, destination,
  });
}
