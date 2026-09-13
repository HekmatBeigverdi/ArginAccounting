import type { DatabaseExecutor } from "@argin/database";
import type { ProductSelectorItemDto } from "@argin/product";
import { SqliteProductSelectorReader } from "@argin/product-tauri";
import type { WarehouseListItemDto } from "@argin/warehouse";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import { inventoryValuationPermissions } from "@argin/inventory/valuation-security";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type { InventoryValuationAsOfReport, InventoryValuationLayerReport, InventoryValuationMonetaryKardexReport, InventoryValuationRecalculationStatusReport, InventoryValuationUnresolvedReport } from "@argin/inventory/valuation-reports";
import { SqliteInventoryValuationPolicyRepository, SqliteInventoryValuationReportReader } from "@argin/inventory-tauri";

export interface InventoryValuationWorkspaceServices {
  canView:boolean; canManagePolicy:boolean;
  readAsOf(a:{companyId:string;branchId:string|null;asOfBusinessDate:string;productId:string|null;warehouseId:string|null;limit:number}):Promise<InventoryValuationAsOfReport>;
  readKardex(a:{companyId:string;branchId:string|null;productId:string;warehouseId:string;businessDateFrom:string|null;businessDateTo:string|null;cursor:string|null;limit:number}):Promise<InventoryValuationMonetaryKardexReport>;
  readLayers(a:{companyId:string;branchId:string|null;productId:string|null;warehouseId:string|null;onlyOpen:boolean;limit:number}):Promise<InventoryValuationLayerReport>;
  readUnresolved(a:{companyId:string;branchId:string|null;productId:string|null;warehouseId:string|null;fromBusinessDate:string|null;limit:number}):Promise<InventoryValuationUnresolvedReport>;
  readStatus(companyId:string,productId:string|null):Promise<InventoryValuationRecalculationStatusReport>;
  getPolicyHistory(companyId:string):Promise<readonly InventoryValuationPolicySnapshot[]>;
  selectProducts(companyId:string):Promise<readonly ProductSelectorItemDto[]>;
  selectWarehouses(companyId:string,branchId:string|null):Promise<readonly WarehouseListItemDto[]>;
}

export function createInventoryValuationWorkspaceServices(database:DatabaseExecutor, permissions:readonly string[], branchIds:readonly string[]):InventoryValuationWorkspaceServices{
  const reports=new SqliteInventoryValuationReportReader(database), policies=new SqliteInventoryValuationPolicyRepository(database), products=new SqliteProductSelectorReader(database), warehouses=new SqliteWarehouseReader(database);
  const full=permissions.includes("system.full-access"), can=(p:string)=>full||permissions.includes(p), requireView=()=>{if(!can(inventoryValuationPermissions.view))throw new Error("برای مشاهده ارزش‌گذاری موجودی مجوز کافی ندارید.");}, requireBranch=(id:string|null)=>{if(!full&&(id===null||!branchIds.includes(id)))throw new Error("محدوده شعبه مجاز نیست.");};
  return {canView:can(inventoryValuationPermissions.view),canManagePolicy:can(inventoryValuationPermissions.policyManage),
    async readAsOf(a){requireView();requireBranch(a.branchId);return reports.readAsOf(a);}, async readKardex(a){requireView();requireBranch(a.branchId);return reports.readMonetaryKardex(a);}, async readLayers(a){requireView();requireBranch(a.branchId);return reports.readLayers(a);}, async readUnresolved(a){requireView();requireBranch(a.branchId);return reports.readUnresolved(a);}, async readStatus(companyId,productId){requireView();return reports.readRecalculationStatus({companyId,productId});}, async getPolicyHistory(companyId){requireView();return policies.listByCompany(companyId);}, async selectProducts(companyId){requireView();return products.select({companyId,search:null,kinds:["product"],statuses:["active"],stockTracking:true,limit:100});}, async selectWarehouses(companyId,branchId){requireView();requireBranch(branchId);return warehouses.select({companyId,branchId:branchId??undefined,includeCompanyWide:true,statuses:["active"],limit:100});}};
}
