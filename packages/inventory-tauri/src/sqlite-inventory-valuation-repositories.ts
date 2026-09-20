import type { DatabaseSession } from "@argin/database";
import { rehydrateInventoryStockMovement, type InventoryStockMovementSnapshot } from "@argin/inventory";
import type {
  InventoryCostLayerRepository,
  InventoryValuationCostInputProvider,
  InventoryValuationEntryRepository,
  InventoryValuationMovementReader,
  InventoryValuationPolicyRepository,
  InventoryValuationStateReference,
  InventoryValuationStateRepository,
  InventoryValuationStateSnapshot,
  ListInventoryUnresolvedValuationsQuery,
} from "@argin/inventory/valuation-contracts";
import type { InventoryResolvedInboundCostBasis } from "@argin/inventory/inbound-cost";
import type { InventoryValuationRecalculationPlan } from "@argin/inventory/valuation-recalculation";
import type { InventoryValuationPolicySnapshot } from "@argin/inventory/valuation-policy";
import type { InventoryCostLayerSnapshot, InventoryValuationEntrySnapshot } from "@argin/inventory";

type PolicyRow = {
  policy_id:string; company_id:string; method:InventoryValuationPolicySnapshot["method"]; strategy_version:number;
  currency:InventoryValuationPolicySnapshot["currency"]; effective_from:string; previous_policy_id:string|null;
  change_reason:string|null; revision:number;
};
type EntryRow = {
  valuation_entry_id:string; company_id:string; product_id:string; movement_id:string; document_id:string; line_id:string;
  reversal_of_movement_id:string|null; transfer_id:string|null; kind:InventoryValuationEntrySnapshot["kind"];
  method:InventoryValuationEntrySnapshot["method"]; strategy_version:number; currency:InventoryValuationEntrySnapshot["currency"];
  warehouse_id:string; zone_id:string|null; location_id:string|null; business_date:string; business_order:number; quantity:string;
  unit_cost:string|null; total_cost:number|null; cost_state:InventoryValuationEntrySnapshot["costState"];
  unresolved_reason:string|null; valued_at:string|null; revision:number;
};
type LayerRow = {
  cost_layer_id:string; company_id:string; product_id:string; source_movement_id:string; source_valuation_entry_id:string;
  method:InventoryCostLayerSnapshot["method"]; strategy_version:number; currency:InventoryCostLayerSnapshot["currency"];
  warehouse_id:string; zone_id:string|null; location_id:string|null; opened_business_date:string; opened_business_order:number;
  original_quantity:string; remaining_quantity:string; unit_cost:string; original_cost:number; remaining_cost:number; revision:number;
};
type StateRow = {
  company_id:string; product_id:string; warehouse_id:string; zone_key:string; location_key:string; business_date:string;
  policy_id:string; method:InventoryValuationStateSnapshot["method"]; strategy_version:number;
  currency:InventoryValuationStateSnapshot["currency"]; quantity:string; total_cost:number|null; unresolved_count:number;
};
type CostInputRow = {
  basis_line_id:string; movement_id:string; product_id:string; warehouse_id:string; quantity:string;
  currency:InventoryResolvedInboundCostBasis["currency"]; base_cost:number; landed_cost:number; total_cost:number;
  unit_cost:string; allocations_json:string;
};
type MovementRow = {
  movement_id:string; company_id:string; document_id:string; line_id:string; transfer_id:string|null; reversal_of_movement_id:string|null;
  product_id:string; warehouse_id:string; zone_id:string|null; location_id:string|null; business_date:string;
  business_order:number; recorded_at:string; quantity_delta:string;
};

const policyFromRow = (r:PolicyRow):InventoryValuationPolicySnapshot => Object.freeze({
  policyId:r.policy_id, companyId:r.company_id, method:r.method, strategyVersion:r.strategy_version, currency:r.currency,
  effectiveFrom:r.effective_from, previousPolicyId:r.previous_policy_id, changeReason:r.change_reason, revision:r.revision,
});
const entryFromRow = (r:EntryRow):InventoryValuationEntrySnapshot => Object.freeze({
  valuationEntryId:r.valuation_entry_id, companyId:r.company_id, productId:r.product_id,
  stockKey:Object.freeze({companyId:r.company_id,productId:r.product_id,warehouseId:r.warehouse_id,zoneId:r.zone_id,locationId:r.location_id}),
  source:Object.freeze({movementId:r.movement_id,documentId:r.document_id,lineId:r.line_id,reversalOfMovementId:r.reversal_of_movement_id,transferId:r.transfer_id}),
  kind:r.kind, method:r.method, strategyVersion:r.strategy_version, currency:r.currency, businessDate:r.business_date,
  businessOrder:r.business_order, quantity:r.quantity, unitCost:r.unit_cost, totalCost:r.total_cost, costState:r.cost_state,
  unresolvedReason:r.unresolved_reason, valuedAt:r.valued_at, revision:r.revision,
});
const layerFromRow = (r:LayerRow):InventoryCostLayerSnapshot => Object.freeze({
  costLayerId:r.cost_layer_id, companyId:r.company_id, productId:r.product_id,
  stockKey:Object.freeze({companyId:r.company_id,productId:r.product_id,warehouseId:r.warehouse_id,zoneId:r.zone_id,locationId:r.location_id}),
  sourceMovementId:r.source_movement_id, sourceValuationEntryId:r.source_valuation_entry_id, method:r.method,
  strategyVersion:r.strategy_version, currency:r.currency, openedBusinessDate:r.opened_business_date,
  openedBusinessOrder:r.opened_business_order, originalQuantity:r.original_quantity, remainingQuantity:r.remaining_quantity,
  unitCost:r.unit_cost, originalCost:r.original_cost, remainingCost:r.remaining_cost, revision:r.revision,
});
const movementFromRow = (r:MovementRow):InventoryStockMovementSnapshot => rehydrateInventoryStockMovement({
  movementId:r.movement_id, companyId:r.company_id, documentId:r.document_id, lineId:r.line_id,
  businessDate:r.business_date, businessOrder:r.business_order, recordedAt:r.recorded_at,
  stockKey:{companyId:r.company_id,productId:r.product_id,warehouseId:r.warehouse_id,zoneId:r.zone_id,locationId:r.location_id},
  transferId:r.transfer_id, reversalOfMovementId:r.reversal_of_movement_id, quantityDelta:r.quantity_delta,
});
const chronologyWhere = (plan:InventoryValuationRecalculationPlan) => ({
  sql:`business_date > ? OR (business_date = ? AND business_order >= ?)`,
  params:[plan.from.businessDate, plan.from.businessDate, plan.from.businessOrder] as const,
});

export class SqliteInventoryValuationPolicyRepository implements InventoryValuationPolicyRepository {
  constructor(private readonly db:DatabaseSession) {}
  async listByCompany(companyId:string) { return Object.freeze((await this.db.query<PolicyRow>(`SELECT * FROM inventory_valuation_policies WHERE company_id=? ORDER BY effective_from,revision`,[companyId])).map(policyFromRow)); }
  async findCurrent(companyId:string) { const row=await this.db.queryOne<PolicyRow>(`SELECT * FROM inventory_valuation_policies WHERE company_id=? ORDER BY effective_from DESC,revision DESC LIMIT 1`,[companyId]); return row?policyFromRow(row):null; }
  async hasAuthoritativeValuation(companyId:string) { const row=await this.db.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM inventory_valuation_entries WHERE company_id=? AND cost_state='resolved'`,[companyId]); return (row?.n??0)>0; }
  async add(p:InventoryValuationPolicySnapshot) { await this.db.execute(`INSERT INTO inventory_valuation_policies(policy_id,company_id,method,strategy_version,currency,effective_from,previous_policy_id,change_reason,revision) VALUES(?,?,?,?,?,?,?,?,?)`,[p.policyId,p.companyId,p.method,p.strategyVersion,p.currency,p.effectiveFrom,p.previousPolicyId,p.changeReason,p.revision]); }
}

export class SqliteInventoryValuationEntryRepository implements InventoryValuationEntryRepository {
  constructor(private readonly db:DatabaseSession) {}
  async findByMovement(companyId:string,movementId:string) { const r=await this.db.queryOne<EntryRow>(`SELECT * FROM inventory_valuation_entries WHERE company_id=? AND movement_id=?`,[companyId,movementId]); return r?entryFromRow(r):null; }
  async listUnresolved(q:ListInventoryUnresolvedValuationsQuery) {
    const conditions=[`company_id=?`,`cost_state='unresolved'`]; const params:(string|number)[]=[q.companyId];
    if(q.productId){conditions.push(`product_id=?`);params.push(q.productId);} if(q.fromBusinessDate){conditions.push(`business_date>=?`);params.push(q.fromBusinessDate);}
    const limit=Math.max(1,Math.min(q.limit??200,1000)); params.push(limit);
    const rows=await this.db.query<EntryRow>(`SELECT * FROM inventory_valuation_entries WHERE ${conditions.join(" AND ")} ORDER BY business_date,business_order,document_id,line_id,movement_id LIMIT ?`,params);
    return Object.freeze(rows.map(entryFromRow));
  }
  async listByProductFrom(companyId:string,productId:string,businessDate:string,businessOrder:number) { const rows=await this.db.query<EntryRow>(`SELECT * FROM inventory_valuation_entries WHERE company_id=? AND product_id=? AND (business_date>? OR (business_date=? AND business_order>=?)) ORDER BY business_date,business_order,document_id,line_id,movement_id`,[companyId,productId,businessDate,businessDate,businessOrder]); return Object.freeze(rows.map(entryFromRow)); }
  async add(e:InventoryValuationEntrySnapshot) { await this.db.execute(`INSERT INTO inventory_valuation_entries(valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,reversal_of_movement_id,transfer_id,kind,method,strategy_version,currency,warehouse_id,zone_id,location_id,business_date,business_order,quantity,unit_cost,total_cost,cost_state,unresolved_reason,valued_at,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[e.valuationEntryId,e.companyId,e.productId,e.source.movementId,e.source.documentId,e.source.lineId,e.source.reversalOfMovementId,e.source.transferId,e.kind,e.method,e.strategyVersion,e.currency,e.stockKey.warehouseId,e.stockKey.zoneId,e.stockKey.locationId,e.businessDate,e.businessOrder,e.quantity,e.unitCost,e.totalCost,e.costState,e.unresolvedReason,e.valuedAt,e.revision]); }
  async replaceDerivedFrom(plan:InventoryValuationRecalculationPlan,entries:readonly InventoryValuationEntrySnapshot[]) { const c=chronologyWhere(plan); const scope=plan.productId?`company_id=? AND product_id=? AND (${c.sql})`:`company_id=? AND (${c.sql})`; const p=plan.productId?[plan.companyId,plan.productId,...c.params]:[plan.companyId,...c.params]; await this.db.execute(`DELETE FROM inventory_valuation_entries WHERE ${scope}`,p); for(const e of entries) await this.add(e); }
}

export class SqliteInventoryCostLayerRepository implements InventoryCostLayerRepository {
  constructor(private readonly db:DatabaseSession) {}
  async listByProductFrom(companyId:string,productId:string,businessDate:string,businessOrder:number) { const rows=await this.db.query<LayerRow>(`SELECT * FROM inventory_valuation_cost_layers WHERE company_id=? AND product_id=? AND (opened_business_date>? OR (opened_business_date=? AND opened_business_order>=?)) ORDER BY opened_business_date,opened_business_order,cost_layer_id`,[companyId,productId,businessDate,businessDate,businessOrder]); return Object.freeze(rows.map(layerFromRow)); }
  async replaceDerivedFrom(plan:InventoryValuationRecalculationPlan,layers:readonly InventoryCostLayerSnapshot[]) { const date=plan.from.businessDate, order=plan.from.businessOrder; const scope=plan.productId?`company_id=? AND product_id=? AND (opened_business_date>? OR (opened_business_date=? AND opened_business_order>=?))`:`company_id=? AND (opened_business_date>? OR (opened_business_date=? AND opened_business_order>=?))`; const p=plan.productId?[plan.companyId,plan.productId,date,date,order]:[plan.companyId,date,date,order]; await this.db.execute(`DELETE FROM inventory_valuation_cost_layers WHERE ${scope}`,p); for(const l of layers) await this.db.execute(`INSERT INTO inventory_valuation_cost_layers(cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,method,strategy_version,currency,warehouse_id,zone_id,location_id,opened_business_date,opened_business_order,original_quantity,remaining_quantity,unit_cost,original_cost,remaining_cost,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[l.costLayerId,l.companyId,l.productId,l.sourceMovementId,l.sourceValuationEntryId,l.method,l.strategyVersion,l.currency,l.stockKey.warehouseId,l.stockKey.zoneId,l.stockKey.locationId,l.openedBusinessDate,l.openedBusinessOrder,l.originalQuantity,l.remainingQuantity,l.unitCost,l.originalCost,l.remainingCost,l.revision]); }
}

export class SqliteInventoryValuationStateRepository implements InventoryValuationStateRepository {
  constructor(private readonly db:DatabaseSession) {}
  async get(ref:InventoryValuationStateReference) { const r=await this.db.queryOne<StateRow>(`SELECT * FROM inventory_valuation_states WHERE company_id=? AND product_id=? AND warehouse_id=? AND zone_key=? AND location_key=? AND business_date=?`,[ref.companyId,ref.productId,ref.warehouseId,ref.zoneId??"",ref.locationId??"",ref.businessDate]); return r?Object.freeze({reference:Object.freeze({...ref}),policyId:r.policy_id,method:r.method,strategyVersion:r.strategy_version,currency:r.currency,quantity:r.quantity,totalCost:r.total_cost,unresolvedCount:r.unresolved_count}):null; }
  async replaceBatch(states:readonly InventoryValuationStateSnapshot[]) { for(const s of states){ const r=s.reference; await this.db.execute(`INSERT INTO inventory_valuation_states(company_id,product_id,warehouse_id,zone_key,location_key,business_date,policy_id,method,strategy_version,currency,quantity,total_cost,unresolved_count) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(company_id,product_id,warehouse_id,zone_key,location_key,business_date) DO UPDATE SET policy_id=excluded.policy_id,method=excluded.method,strategy_version=excluded.strategy_version,currency=excluded.currency,quantity=excluded.quantity,total_cost=excluded.total_cost,unresolved_count=excluded.unresolved_count`,[r.companyId,r.productId,r.warehouseId,r.zoneId??"",r.locationId??"",r.businessDate,s.policyId,s.method,s.strategyVersion,s.currency,s.quantity,s.totalCost,s.unresolvedCount]); } }
}

export class SqliteInventoryValuationCostInputProvider implements InventoryValuationCostInputProvider {
  constructor(private readonly db:DatabaseSession) {}
  async getResolvedInboundCostBasis(companyId:string,movement:InventoryStockMovementSnapshot) { const r=await this.db.queryOne<CostInputRow>(`SELECT basis_line_id,movement_id,product_id,warehouse_id,quantity,currency,base_cost,landed_cost,total_cost,unit_cost,allocations_json FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?`,[companyId,movement.movementId]); if(!r)return null; return Object.freeze({basisLineId:r.basis_line_id,movementId:r.movement_id,productId:r.product_id,warehouseId:r.warehouse_id,quantity:r.quantity,currency:r.currency,baseCost:r.base_cost,landedCost:r.landed_cost,totalCost:r.total_cost,unitCost:r.unit_cost,allocations:Object.freeze(JSON.parse(r.allocations_json))}) as InventoryResolvedInboundCostBasis; }
}

export class SqliteInventoryValuationMovementReader implements InventoryValuationMovementReader {
  constructor(private readonly db:DatabaseSession) {}
  async findById(companyId:string,movementId:string) { const r=await this.db.queryOne<MovementRow>(`SELECT * FROM inventory_all_stock_movements WHERE company_id=? AND movement_id=?`,[companyId,movementId]); return r?movementFromRow(r):null; }
  async listCompanyProductMovements(companyId:string,productId:string) { const rows=await this.db.query<MovementRow>(`SELECT * FROM inventory_all_stock_movements WHERE company_id=? AND product_id=? ORDER BY business_date,business_order,document_id,line_id,movement_id`,[companyId,productId]); return Object.freeze(rows.map(movementFromRow)); }
  async listCompanyMovementsFrom(companyId:string,businessDate:string) { const rows=await this.db.query<MovementRow>(`SELECT * FROM inventory_all_stock_movements WHERE company_id=? AND business_date>=? ORDER BY business_date,business_order,document_id,line_id,movement_id`,[companyId,businessDate]); return Object.freeze(rows.map(movementFromRow)); }
}
