import type { DatabaseExecutor } from "@argin/database";
import type { ProductSelectorItemDto } from "@argin/product";
import { SqliteProductSelectorReader } from "@argin/product-tauri";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import { inventoryValuationPermissions, createInventoryValuationTraceSnapshot, type InventoryValuationTraceSnapshot } from "@argin/inventory/valuation-security";
import type { InventoryValuationAsOfReport, InventoryValuationLayerReport, InventoryValuationMonetaryKardexReport, InventoryValuationRecalculationStatusReport, InventoryValuationUnresolvedReport } from "@argin/inventory/valuation-reports";
import { SqliteInventoryValuationCostInputProvider, SqliteInventoryValuationEntryRepository, SqliteInventoryValuationMovementReader, SqliteInventoryValuationPolicyRepository, SqliteInventoryValuationReportReader } from "@argin/inventory-tauri";

export interface InventoryValuationActor { readonly permissions: readonly string[]; readonly branchIds: readonly string[]; }
export interface InventoryValuationServices {
  readonly canView:boolean; readonly canManagePolicy:boolean; readonly canRecalculate:boolean;
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
  const report=new SqliteInventoryValuationReportReader(input.database);
  const policyRepo=new SqliteInventoryValuationPolicyRepository(input.database);
  const entryRepo=new SqliteInventoryValuationEntryRepository(input.database);
  const movementReader=new SqliteInventoryValuationMovementReader(input.database);
  const costReader=new SqliteInventoryValuationCostInputProvider(input.database);
  const productReader=new SqliteProductSelectorReader(input.database);
  const warehouseReader=new SqliteWarehouseReader(input.database);
  const full=input.actor.permissions.includes("system.full-access");
  const can=(p:string)=>full||input.actor.permissions.includes(p);
  const view=()=>{if(!can(inventoryValuationPermissions.view))throw new Error("برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.");};
  const branch=(id:string|null)=>{if(!full&&(id===null||!input.actor.branchIds.includes(id)))throw new Error("محدوده شعبه برای این گزارش مجاز نیست.");};
  return Object.freeze({
    canView:can(inventoryValuationPermissions.view), canManagePolicy:can(inventoryValuationPermissions.managePolicy), canRecalculate:can(inventoryValuationPermissions.recalculate),
    async readAsOf(a){view();branch(a.branchId);return report.readAsOf({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,limit:a.limit??100});},
    async readKardex(a){view();branch(a.branchId);return report.readMonetaryKardex({...a,businessDateFrom:a.businessDateFrom??null,businessDateTo:a.businessDateTo??null,cursor:a.cursor??null,limit:a.limit??100});},
    async readLayers(a){view();branch(a.branchId);return report.readLayers({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,onlyOpen:a.onlyOpen??true,limit:a.limit??100});},
    async readUnresolved(a){view();branch(a.branchId);return report.readUnresolved({...a,productId:a.productId??null,warehouseId:a.warehouseId??null,fromBusinessDate:a.fromBusinessDate??null,limit:a.limit??100});},
    async readStatus(companyId,productId){view();return report.readRecalculationStatus({companyId,productId:productId??null});},
    async getPolicyHistory(companyId){view();return policyRepo.listByCompany(companyId);},
    async getTrace(companyId,movementId){view();const movement=await movementReader.findById(companyId,movementId);if(!movement)return null;const entry=await entryRepo.findByMovement(companyId,movementId);if(!entry)return null;const policies=await policyRepo.listByCompany(companyId);const policy=[...policies].filter(p=>p.effectiveFrom<=movement.businessDate).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]??null;const costBasis=await costReader.getResolvedInboundCostBasis(companyId,movement);return createInventoryValuationTraceSnapshot({movement,entry,policy,costBasis});},
    async selectProducts(companyId){view();return productReader.select({companyId,search:null,kinds:["product"],statuses:["active"],stockTracking:true,limit:100});},
    async selectWarehouses(companyId,branchId){view();branch(branchId);return warehouseReader.select({companyId,branchId:branchId??undefined,includeCompanyWide:true,statuses:["active"],limit:100});},
  });
}
