import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import {
  INVENTORY_VALUATION_REPORT_MAX_LIMIT,
  type InventoryValuationAsOfQuery,
  type InventoryValuationAsOfReport,
  type InventoryValuationKardexCursor,
  type InventoryValuationLayerQuery,
  type InventoryValuationLayerReport,
  type InventoryValuationMonetaryKardexQuery,
  type InventoryValuationMonetaryKardexReport,
  type InventoryValuationRecalculationStatusQuery,
  type InventoryValuationRecalculationStatusReport,
  type InventoryValuationReportReader,
  type InventoryValuationUnresolvedQuery,
  type InventoryValuationUnresolvedReport,
} from "@argin/inventory/valuation-reports";

const invalid = (field: string): never => { throw new Error(`VALUATION_REPORT_INPUT_INVALID:${field}`); };
const required = (value: string, field: string): string => {
  if (typeof value !== "string" || !value.trim()) return invalid(field);
  return value.trim();
};
const date = (value: string | null | undefined, field: string): string | null => {
  if (value == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) return invalid(field);
  return value;
};
const limit = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1 || value > INVENTORY_VALUATION_REPORT_MAX_LIMIT) return invalid("limit");
  return value;
};
const encodeCursor = (value: InventoryValuationKardexCursor): string => encodeURIComponent(JSON.stringify(value));
const decodeCursor = (value: string | null | undefined): InventoryValuationKardexCursor | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<InventoryValuationKardexCursor>;
    if (typeof parsed.businessDate !== "string" || !Number.isSafeInteger(parsed.businessOrder) || typeof parsed.documentId !== "string" || typeof parsed.lineId !== "string" || typeof parsed.movementId !== "string") return invalid("cursor");
    return Object.freeze({ businessDate: parsed.businessDate, businessOrder: parsed.businessOrder!, documentId: parsed.documentId, lineId: parsed.lineId, movementId: parsed.movementId });
  } catch { return invalid("cursor"); }
};
const chronologyAfter = (alias: string, c: InventoryValuationKardexCursor) => ({
  sql: `(${alias}.business_date>? OR (${alias}.business_date=? AND ${alias}.business_order>?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id>?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id>?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id=? AND ${alias}.movement_id>?))`,
  params: [c.businessDate,c.businessDate,c.businessOrder,c.businessDate,c.businessOrder,c.documentId,c.businessDate,c.businessOrder,c.documentId,c.lineId,c.businessDate,c.businessOrder,c.documentId,c.lineId,c.movementId] as DatabaseValue[],
});
const chronologyBeforeOrEqual = (alias: string, c: InventoryValuationKardexCursor) => ({
  sql: `(${alias}.business_date<? OR (${alias}.business_date=? AND ${alias}.business_order<?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id<?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id<?) OR (${alias}.business_date=? AND ${alias}.business_order=? AND ${alias}.document_id=? AND ${alias}.line_id=? AND ${alias}.movement_id<=?))`,
  params: [c.businessDate,c.businessDate,c.businessOrder,c.businessDate,c.businessOrder,c.documentId,c.businessDate,c.businessOrder,c.documentId,c.lineId,c.businessDate,c.businessOrder,c.documentId,c.lineId,c.movementId] as DatabaseValue[],
});

interface StateRow { product_id:string; warehouse_id:string; zone_key:string; location_key:string; business_date:string; policy_id:string; method:"fifo"|"moving_average"; strategy_version:number; currency:string; quantity:string; total_cost:number|null; unresolved_count:number; }
interface EntryRow { valuation_entry_id:string; movement_id:string; document_id:string; line_id:string; product_id:string; warehouse_id:string; business_date:string; business_order:number; kind:"inbound"|"outbound"|"transfer"|"reversal"; method:"fifo"|"moving_average"; currency:string; quantity:string; unit_cost:string|null; total_cost:number|null; cost_state:"resolved"|"unresolved"; unresolved_reason:string|null; }
interface LayerRow { cost_layer_id:string; product_id:string; warehouse_id:string; zone_id:string|null; location_id:string|null; source_movement_id:string; source_valuation_entry_id:string; opened_business_date:string; opened_business_order:number; currency:string; original_quantity:string; remaining_quantity:string; unit_cost:string; original_cost:number; remaining_cost:number; revision:number; }
interface CountRow { n:number; }
interface DateRow { d:string|null; }
interface RevisionRow { revision:number; }

function visibilitySql(branchId: string | null | undefined, alias="w"): {sql:string;params:DatabaseValue[]} {
  if (branchId == null) return {sql:"1=1",params:[]};
  return {sql:`(${alias}.organizational_scope='company' OR ${alias}.branch_id=?)`,params:[branchId]};
}

export class SqliteInventoryValuationReportReader implements InventoryValuationReportReader {
  constructor(private readonly db: DatabaseExecutor) {}

  async readAsOf(query: InventoryValuationAsOfQuery): Promise<InventoryValuationAsOfReport> {
    const companyId=required(query.companyId,"companyId"), asOf=date(query.asOfBusinessDate,"asOfBusinessDate")!, max=limit(query.limit);
    const clauses=["s.company_id=?"], params:DatabaseValue[]=[companyId];
    if(query.productId){clauses.push("s.product_id=?");params.push(required(query.productId,"productId"));}
    if(query.warehouseId){clauses.push("s.warehouse_id=?");params.push(required(query.warehouseId,"warehouseId"));}
    clauses.push("s.business_date<=?");params.push(asOf);
    const visibility=visibilitySql(query.branchId,"w"); clauses.push(visibility.sql); params.push(...visibility.params);
    const rows=await this.db.query<StateRow>(`WITH ranked AS (
      SELECT s.*,ROW_NUMBER() OVER(PARTITION BY s.company_id,s.product_id,s.warehouse_id,s.zone_key,s.location_key ORDER BY s.business_date DESC) rn
      FROM inventory_valuation_states s JOIN warehouses w ON w.company_id=s.company_id AND w.id=s.warehouse_id AND w.deleted_at IS NULL
      WHERE ${clauses.join(" AND ")}
    ) SELECT * FROM ranked WHERE rn=1 ORDER BY product_id,warehouse_id,zone_key,location_key LIMIT ?`,[...params,max+1]);
    const page=rows.slice(0,max); let resolvedTotalCost=0, unresolvedRowCount=0;
    const mapped=page.map(r=>{ if(r.total_cost!==null) resolvedTotalCost+=r.total_cost; if(r.unresolved_count>0||r.total_cost===null) unresolvedRowCount++; return Object.freeze({productId:r.product_id,warehouseId:r.warehouse_id,zoneId:r.zone_key||null,locationId:r.location_key||null,businessDate:r.business_date,policyId:r.policy_id,method:r.method,strategyVersion:r.strategy_version,currency:r.currency,quantity:r.quantity,totalCost:r.total_cost,unresolvedCount:r.unresolved_count}); });
    return Object.freeze({asOfBusinessDate:asOf,rows:Object.freeze(mapped),resolvedTotalCost,unresolvedRowCount,truncated:rows.length>max});
  }

  async readMonetaryKardex(query: InventoryValuationMonetaryKardexQuery): Promise<InventoryValuationMonetaryKardexReport> {
    const companyId=required(query.companyId,"companyId"), productId=required(query.productId,"productId"), warehouseId=required(query.warehouseId,"warehouseId"), max=limit(query.limit);
    const from=date(query.businessDateFrom,"businessDateFrom"), to=date(query.businessDateTo,"businessDateTo"); if(from&&to&&from>to) invalid("businessDateFrom");
    const visibility=visibilitySql(query.branchId,"w");
    const wh=await this.db.queryOne<{ok:number}>(`SELECT 1 ok FROM warehouses w WHERE w.company_id=? AND w.id=? AND w.deleted_at IS NULL AND ${visibility.sql}`,[companyId,warehouseId,...visibility.params]); if(!wh) invalid("warehouseId");
    const cursor=decodeCursor(query.cursor);
    const base=["e.company_id=?","e.product_id=?","e.warehouse_id=?"], baseParams:DatabaseValue[]=[companyId,productId,warehouseId];
    let openingResolvedCost=0;
    if(cursor){ const through=chronologyBeforeOrEqual("e",cursor); const row=await this.db.queryOne<{v:number|null}>(`SELECT COALESCE(SUM(CASE WHEN e.cost_state='resolved' THEN e.total_cost ELSE 0 END),0) v FROM inventory_valuation_entries e WHERE ${base.join(" AND ")} AND ${through.sql}`,[...baseParams,...through.params]); openingResolvedCost=row?.v??0; }
    else if(from){ const row=await this.db.queryOne<{v:number|null}>(`SELECT COALESCE(SUM(CASE WHEN e.cost_state='resolved' THEN e.total_cost ELSE 0 END),0) v FROM inventory_valuation_entries e WHERE ${base.join(" AND ")} AND e.business_date<?`,[...baseParams,from]); openingResolvedCost=row?.v??0; }
    const clauses=[...base], params=[...baseParams]; if(from){clauses.push("e.business_date>=?");params.push(from);} if(to){clauses.push("e.business_date<=?");params.push(to);} if(cursor){const after=chronologyAfter("e",cursor);clauses.push(after.sql);params.push(...after.params);}
    const rows=await this.db.query<EntryRow>(`SELECT e.* FROM inventory_valuation_entries e WHERE ${clauses.join(" AND ")} ORDER BY e.business_date,e.business_order,e.document_id,e.line_id,e.movement_id LIMIT ?`,[...params,max+1]);
    const page=rows.slice(0,max); let running=openingResolvedCost, unresolvedCount=0;
    const entries=page.map(r=>{ if(r.cost_state==='resolved'&&r.total_cost!==null) running+=r.total_cost; else unresolvedCount++; return Object.freeze({valuationEntryId:r.valuation_entry_id,movementId:r.movement_id,documentId:r.document_id,lineId:r.line_id,businessDate:r.business_date,businessOrder:r.business_order,kind:r.kind,method:r.method,currency:r.currency,quantity:r.quantity,unitCost:r.unit_cost,monetaryDelta:r.total_cost,runningResolvedCost:running,costState:r.cost_state,unresolvedReason:r.unresolved_reason}); });
    const last=page.at(-1); const nextCursor=rows.length>max&&last?encodeCursor({businessDate:last.business_date,businessOrder:last.business_order,documentId:last.document_id,lineId:last.line_id,movementId:last.movement_id}):null;
    return Object.freeze({openingResolvedCost,entries:Object.freeze(entries),closingResolvedCost:running,unresolvedCount,nextCursor});
  }

  async readLayers(query: InventoryValuationLayerQuery): Promise<InventoryValuationLayerReport> {
    const companyId=required(query.companyId,"companyId"), max=limit(query.limit); const clauses=["l.company_id=?"], params:DatabaseValue[]=[companyId];
    if(query.productId){clauses.push("l.product_id=?");params.push(required(query.productId,"productId"));} if(query.warehouseId){clauses.push("l.warehouse_id=?");params.push(required(query.warehouseId,"warehouseId"));} if(query.onlyOpen!==false) clauses.push("l.remaining_quantity<>'0'");
    const visibility=visibilitySql(query.branchId,"w");clauses.push(visibility.sql);params.push(...visibility.params);
    const rows=await this.db.query<LayerRow>(`SELECT l.* FROM inventory_valuation_cost_layers l JOIN warehouses w ON w.company_id=l.company_id AND w.id=l.warehouse_id AND w.deleted_at IS NULL WHERE ${clauses.join(" AND ")} ORDER BY l.opened_business_date,l.opened_business_order,l.cost_layer_id LIMIT ?`,[...params,max+1]);
    const mapped=rows.slice(0,max).map(r=>Object.freeze({costLayerId:r.cost_layer_id,productId:r.product_id,warehouseId:r.warehouse_id,zoneId:r.zone_id,locationId:r.location_id,sourceMovementId:r.source_movement_id,sourceValuationEntryId:r.source_valuation_entry_id,openedBusinessDate:r.opened_business_date,openedBusinessOrder:r.opened_business_order,currency:r.currency,originalQuantity:r.original_quantity,remainingQuantity:r.remaining_quantity,unitCost:r.unit_cost,originalCost:r.original_cost,remainingCost:r.remaining_cost,revision:r.revision}));
    return Object.freeze({rows:Object.freeze(mapped),truncated:rows.length>max});
  }

  async readUnresolved(query: InventoryValuationUnresolvedQuery): Promise<InventoryValuationUnresolvedReport> {
    const companyId=required(query.companyId,"companyId"), max=limit(query.limit), from=date(query.fromBusinessDate,"fromBusinessDate"); const clauses=["e.company_id=?","e.cost_state='unresolved'"],params:DatabaseValue[]=[companyId];
    if(query.productId){clauses.push("e.product_id=?");params.push(required(query.productId,"productId"));} if(query.warehouseId){clauses.push("e.warehouse_id=?");params.push(required(query.warehouseId,"warehouseId"));} if(from){clauses.push("e.business_date>=?");params.push(from);} const visibility=visibilitySql(query.branchId,"w");clauses.push(visibility.sql);params.push(...visibility.params);
    const rows=await this.db.query<EntryRow>(`SELECT e.* FROM inventory_valuation_entries e JOIN warehouses w ON w.company_id=e.company_id AND w.id=e.warehouse_id AND w.deleted_at IS NULL WHERE ${clauses.join(" AND ")} ORDER BY e.business_date,e.business_order,e.document_id,e.line_id,e.movement_id LIMIT ?`,[...params,max+1]);
    const mapped=rows.slice(0,max).map(r=>Object.freeze({valuationEntryId:r.valuation_entry_id,movementId:r.movement_id,productId:r.product_id,warehouseId:r.warehouse_id,businessDate:r.business_date,businessOrder:r.business_order,quantity:r.quantity,method:r.method,currency:r.currency,reason:r.unresolved_reason??"upstream_cost_unresolved"}));
    return Object.freeze({rows:Object.freeze(mapped),truncated:rows.length>max});
  }

  async readRecalculationStatus(query: InventoryValuationRecalculationStatusQuery): Promise<InventoryValuationRecalculationStatusReport> {
    const companyId=required(query.companyId,"companyId"), productId=query.productId?required(query.productId,"productId"):null; const movementWhere=productId?"company_id=? AND product_id=?":"company_id=?", mp:DatabaseValue[]=productId?[companyId,productId]:[companyId];
    const latestMovement=await this.db.queryOne<DateRow>(`SELECT MAX(business_date) d FROM inventory_all_stock_movements WHERE ${movementWhere}`,mp);
    const latestValued=await this.db.queryOne<DateRow>(`SELECT MAX(business_date) d FROM inventory_valuation_entries WHERE ${movementWhere}`,mp);
    const unresolved=await this.db.queryOne<CountRow>(`SELECT COUNT(*) n FROM inventory_valuation_entries WHERE ${movementWhere} AND cost_state='unresolved'`,mp);
    const missing=await this.db.queryOne<CountRow>(`SELECT COUNT(*) n FROM inventory_all_stock_movements m LEFT JOIN inventory_valuation_entries e ON e.company_id=m.company_id AND e.movement_id=m.movement_id WHERE ${productId?"m.company_id=? AND m.product_id=?":"m.company_id=?"} AND e.valuation_entry_id IS NULL`,mp);
    const streamKey=productId?`valuation:${companyId}:${productId}`:`policy:${companyId}`; const rev=await this.db.queryOne<RevisionRow>(`SELECT revision FROM inventory_valuation_stream_versions WHERE company_id=? AND stream_key=?`,[companyId,streamKey]);
    const noMovements=!latestMovement?.d; const attention=(unresolved?.n??0)>0||(missing?.n??0)>0||(!noMovements&&!latestValued?.d);
    return Object.freeze({companyId,productId,latestMovementBusinessDate:latestMovement?.d??null,latestValuedBusinessDate:latestValued?.d??null,unresolvedCount:(unresolved?.n??0)+(missing?.n??0),streamRevision:rev?.revision??0,status:noMovements?"empty":attention?"attention-required":"current"});
  }
}
