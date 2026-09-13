import type { DatabaseExecutor } from "@argin/database";
import { SqliteProductSelectorReader } from "@argin/product-tauri";
import type { ProductSelectorItemDto } from "@argin/product";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { WarehouseListItemDto } from "@argin/warehouse";
import {
  inventoryValuationPermissions,
  createInventoryValuationTraceSnapshot,
  type InventoryValuationPolicySnapshot,
  type InventoryValuationTraceSnapshot,
} from "@argin/inventory/valuation-security";
import type {
  InventoryValuationAsOfReport,
  InventoryValuationLayerReport,
  InventoryValuationMonetaryKardexReport,
  InventoryValuationRecalculationStatusReport,
  InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";
import {
  SqliteInventoryValuationCostInputProvider,
  SqliteInventoryValuationEntryRepository,
  SqliteInventoryValuationMovementReader,
  SqliteInventoryValuationPolicyRepository,
  SqliteInventoryValuationReportReader,
} from "@argin/inventory-tauri";

export interface InventoryValuationActor { readonly permissions: readonly string[]; readonly branchIds: readonly string[]; }
export interface InventoryValuationServices {
  readonly canView: boolean;
  readonly canManagePolicy: boolean;
  readonly canRecalculate: boolean;
  readAsOf(input:{companyId:string;branchId:string|null;asOfBusinessDate:string;productId?:string|null;warehouseId?:string|null;limit?:number}):Promise<InventoryValuationAsOfReport>;
  readKardex(input:{companyId:string;branchId:string|null;productId:string;warehouseId:string;businessDateFrom?:string|null;businessDateTo?:string|null;cursor?:string|null;limit?:number}):Promise<InventoryValuationMonetaryKardexReport>;
  readLayers(input:{companyId:string;branchId:string|null;productId?:string|null;warehouseId?:string|null;onlyOpen?:boolean;limit?:number}):Promise<InventoryValuationLayerReport>;
  readUnresolved(input:{companyId:string;branchId:string|null;productId?:string|null;warehouseId?:string|null;fromBusinessDate?:string|null;limit?:number}):Promise<InventoryValuationUnresolvedReport>;
  readStatus(companyId:string,productId?:string|null):Promise<InventoryValuationRecalculationStatusReport>;
  getPolicyHistory(companyId:string):Promise<readonly InventoryValuationPolicySnapshot[]>;
  getTrace(companyId:string,movementId:string):Promise<InventoryValuationTraceSnapshot|null>;
  selectProducts(companyId:string):Promise<readonly ProductSelectorItemDto[]>;
  selectWarehouses(companyId:string,branchId:string|null):Promise<readonly WarehouseListItemDto[]>;
}

export function createInventoryValuationServices(input:{database:DatabaseExecutor;actor:InventoryValuationActor}):InventoryValuationServices {
  const reports=new SqliteInventoryValuationReportReader(input.database);
  const policies=new SqliteInventoryValuationPolicyRepository(input.database);
  const entries=new SqliteInventoryValuationEntryRepository(input.database);
  const movements=new SqliteInventoryValuationMovementReader(input.database);
  const costs=new SqliteInventoryValuationCostInputProvider(input.database);
  const products=new SqliteProductSelectorReader(input.database);
  const warehouses=new SqliteWarehouseReader(input.database);
  const full=input.actor.permissions.includes("system.full-access");
  const can=(permission:string)=>full||input.actor.permissions.includes(permission);
  const requireView=()=>{if(!can(inventoryValuationPermissions.view)) throw new Error("برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.");};
  const requireBranch=(branchId:string|null)=>{if(full)return;if(branchId===null||!input.actor.branchIds.includes(branchId))throw new Error("محدوده شعبه برای این گزارش مجاز نیست.");};
  return Object.freeze({
    canView:can(inventoryValuationPermissions.view),
    canManagePolicy:can(inventoryValuationPermissions.managePolicy),
    canRecalculate:can(inventoryValuationPermissions.recalculate),
    async readAsOf(a){requireView();requireBranch(a.branchId);return reports.readAsOf({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,limit:a.limit??100});},
    async readKardex(a){requireView();requireBranch(a.branchId);return reports.readMonetaryKardex({...a,businessDateFrom:a.businessDateFrom??null,businessDateTo:a.businessDateTo??null,cursor:a.cursor??null,limit:a.limit??100});},
    async readLayers(a){requireView();requireBranch(a.branchId);return reports.readLayers({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,onlyOpen:a.onlyOpen??true,limit:a.limit??100});},
    async readUnresolved(a){requireView();requireBranch(a.branchId);return reports.readUnresolved({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,fromBusinessDate:a.fromBusinessDate??null,limit:a.limit??100});},
    async readStatus(companyId,productId){requireView();return reports.readRecalculationStatus({companyId,productId:productId??null});},
    async getPolicyHistory(companyId){requireView();return policies.listByCompany(companyId);},
    async getTrace(companyId,movementId){requireView();const movement=await movements.findById(companyId,movementId);if(!movement)return null;const entry=await entries.findByMovement(companyId,movementId);if(!entry)return null;const history=await policies.listByCompany(companyId);const policy=[...history].filter(p=>p.effectiveFrom<=movement.businessDate).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??null;const costBasis=await costs.getResolvedInboundCostBasis(companyId,movement);return createInventoryValuationTraceSnapshot({movement,entry,policy,costBasis});},
    async selectProducts(companyId){requireView();return products.select({companyId,search:null,kinds:["product"],statuses:["active"],stockTracking:true,limit:100});},
    async selectWarehouses(companyId,branchId){requireView();requireBranch(branchId);return warehouses.select({companyId,branchId:branchId??undefined,includeCompanyWide:true,statuses:["active"],limit:100});},
  });
}
