import type { DatabaseSession } from "@argin/database";
import {
  fifoInventoryValuationStrategy,
  movingAverageInventoryValuationStrategy,
  type InventoryFifoLayerState,
  type InventoryMovingAverageState,
} from "@argin/inventory/valuation-strategy";
import type {
  BelowCostDecision,
  BelowCostSalesDecisionRepository,
  BelowCostSalesPolicy,
  BelowCostSalesPolicyRepository,
  SalesInventoryCostQuote,
  SalesInventoryCostQuotePort,
} from "@argin/sales";
import { createBelowCostSalesPolicy } from "@argin/sales";

type PolicyRow={policy_id:string;company_id:string;revision:number;effective_from:string;mode:BelowCostSalesPolicy["mode"];minimum_margin_basis_points:number};
type DecisionRow={decision_id:string;company_id:string;document_id:string;line_id:string;policy_id:string;policy_revision:number;outcome:BelowCostDecision["outcome"];selling_unit_price:number;quoted_unit_cost:string|null;margin_amount:number|null;margin_basis_points:number|null;quote_id:string|null;valuation_basis_revision:string|null;warehouse_id:string|null;approved_by:string|null;approval_reason:string|null;decided_at:string};

const policy=(r:PolicyRow)=>createBelowCostSalesPolicy({policyId:r.policy_id,companyId:r.company_id,revision:r.revision,effectiveFrom:r.effective_from,mode:r.mode,minimumMarginBasisPoints:r.minimum_margin_basis_points});
const decision=(r:DecisionRow):BelowCostDecision=>Object.freeze({
  decisionId:r.decision_id,companyId:r.company_id,documentId:r.document_id,lineId:r.line_id,policyId:r.policy_id,policyRevision:r.policy_revision,outcome:r.outcome,
  sellingUnitPrice:r.selling_unit_price,quotedUnitCost:r.quoted_unit_cost,marginAmount:r.margin_amount,marginBasisPoints:r.margin_basis_points,
  quoteId:r.quote_id,valuationBasisRevision:r.valuation_basis_revision,warehouseId:r.warehouse_id,approvedBy:r.approved_by,approvalReason:r.approval_reason,decidedAt:r.decided_at,
});

export class SqliteBelowCostSalesPolicyRepository implements BelowCostSalesPolicyRepository{
  constructor(private readonly db:DatabaseSession){}
  async findEffective(companyId:string,businessDate:string){
    const r=await this.db.queryOne<PolicyRow>(
      "SELECT policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points FROM sales_below_cost_policies WHERE company_id=? AND effective_from<=? ORDER BY effective_from DESC,revision DESC LIMIT 1",
      [companyId,businessDate],
    );
    return r?policy(r):null;
  }
  async list(companyId:string){
    return Object.freeze((await this.db.query<PolicyRow>(
      "SELECT policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points FROM sales_below_cost_policies WHERE company_id=? ORDER BY effective_from,revision",
      [companyId],
    )).map(policy));
  }
  async save(p:BelowCostSalesPolicy,actorId:string,changedAt:string){
    await this.db.execute(
      "INSERT INTO sales_below_cost_policies(policy_id,company_id,revision,effective_from,mode,minimum_margin_basis_points,actor_id,changed_at) VALUES(?,?,?,?,?,?,?,?)",
      [p.policyId,p.companyId,p.revision,p.effectiveFrom,p.mode,p.minimumMarginBasisPoints,actorId,changedAt],
    );
  }
}

export class SqliteBelowCostSalesDecisionRepository implements BelowCostSalesDecisionRepository{
  constructor(private readonly db:DatabaseSession){}
  async add(d:BelowCostDecision){
    await this.db.execute(
      "INSERT OR REPLACE INTO sales_below_cost_decisions(decision_id,company_id,document_id,line_id,policy_id,policy_revision,outcome,selling_unit_price,quoted_unit_cost,margin_amount,margin_basis_points,quote_id,valuation_basis_revision,warehouse_id,approved_by,approval_reason,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [d.decisionId,d.companyId,d.documentId,d.lineId,d.policyId,d.policyRevision,d.outcome,d.sellingUnitPrice,d.quotedUnitCost,d.marginAmount,d.marginBasisPoints,d.quoteId,d.valuationBasisRevision,d.warehouseId,d.approvedBy,d.approvalReason,d.decidedAt],
    );
  }
  async listByDocument(companyId:string,documentId:string){
    return Object.freeze((await this.db.query<DecisionRow>(
      "SELECT * FROM sales_below_cost_decisions WHERE company_id=? AND document_id=? ORDER BY decided_at,line_id",
      [companyId,documentId],
    )).map(decision));
  }
}

type ValuationPolicyRow={policy_id:string;method:"fifo"|"moving_average";strategy_version:number;currency:string;revision:number};
type LayerRow={cost_layer_id:string;remaining_quantity:string;remaining_cost:number;currency:string;revision:number;source_valuation_entry_id:string;opened_business_date:string;opened_business_order:number};
type StateRow={zone_key:string;location_key:string;business_date:string;quantity:string;total_cost:number|null;unresolved_count:number;currency:string;strategy_version:number;policy_id:string};

export class SqliteSalesInventoryCostQuotePort implements SalesInventoryCostQuotePort{
  constructor(private readonly db:DatabaseSession){}
  async quote(input:{companyId:string;productId:string;warehouseId:string;businessDate:string;quantity:string;currency:string}):Promise<SalesInventoryCostQuote|null>{
    const p=await this.db.queryOne<ValuationPolicyRow>(
      "SELECT policy_id,method,strategy_version,currency,revision FROM inventory_valuation_policies WHERE company_id=? AND effective_from<=? ORDER BY effective_from DESC,revision DESC LIMIT 1",
      [input.companyId,input.businessDate],
    );
    if(!p||p.currency!==input.currency)return null;
    const quotedAt=new Date().toISOString();

    if(p.method==="fifo"){
      const rows=await this.db.query<LayerRow>(
        "SELECT cost_layer_id,remaining_quantity,remaining_cost,currency,revision,source_valuation_entry_id,opened_business_date,opened_business_order FROM inventory_valuation_cost_layers WHERE company_id=? AND product_id=? AND warehouse_id=? AND remaining_quantity<>'0' ORDER BY opened_business_date,opened_business_order,cost_layer_id",
        [input.companyId,input.productId,input.warehouseId],
      );
      if(!rows.length||rows.some(x=>x.currency!==input.currency))return null;
      try{
        const state:InventoryFifoLayerState[]=rows.map(x=>({layerId:x.cost_layer_id,remainingQuantity:x.remaining_quantity,remainingCost:x.remaining_cost,currency:x.currency}));
        const result=fifoInventoryValuationStrategy.issue({layers:state},{quantity:input.quantity,currency:input.currency});
        const basis="fifo:"+p.policy_id+":"+p.revision+":"+rows.map(x=>x.cost_layer_id+"@"+x.revision).join("|");
        return Object.freeze({
          quoteId:"quote:"+input.productId+":"+input.warehouseId+":"+basis+":"+input.quantity,
          companyId:input.companyId,productId:input.productId,warehouseId:input.warehouseId,businessDate:input.businessDate,
          quantity:result.quantity,currency:result.currency,unitCost:result.unitCost,totalCost:result.totalCost,
          method:"fifo",strategyVersion:p.strategy_version,valuationBasisRevision:basis,quotedAt,
        });
      }catch{return null;}
    }

    const rows=await this.db.query<StateRow>(
      "SELECT zone_key,location_key,business_date,quantity,total_cost,unresolved_count,currency,strategy_version,policy_id FROM inventory_valuation_states WHERE company_id=? AND product_id=? AND warehouse_id=? AND business_date<=? ORDER BY business_date DESC",
      [input.companyId,input.productId,input.warehouseId,input.businessDate],
    );
    const latest=new Map<string,StateRow>();
    for(const row of rows){const key=row.zone_key+"|"+row.location_key;if(!latest.has(key))latest.set(key,row);}
    const values=[...latest.values()];
    if(!values.length||values.some(x=>x.unresolved_count>0||x.total_cost===null||x.currency!==input.currency))return null;
    const quantity=values.reduce((a,x)=>a+Number(x.quantity),0);
    const total=values.reduce((a,x)=>a+(x.total_cost??0),0);
    if(!Number.isFinite(quantity)||quantity<=0||quantity<Number(input.quantity))return null;
    try{
      const state:InventoryMovingAverageState={quantity:String(quantity),totalCost:total,currency:input.currency};
      const result=movingAverageInventoryValuationStrategy.issue(state,{quantity:input.quantity,currency:input.currency});
      const basis="moving_average:"+p.policy_id+":"+p.revision+":"+values.map(x=>x.zone_key+"/"+x.location_key+"@"+x.business_date).join("|");
      return Object.freeze({
        quoteId:"quote:"+input.productId+":"+input.warehouseId+":"+basis+":"+input.quantity,
        companyId:input.companyId,productId:input.productId,warehouseId:input.warehouseId,businessDate:input.businessDate,
        quantity:result.quantity,currency:result.currency,unitCost:result.unitCost,totalCost:result.totalCost,
        method:"moving_average",strategyVersion:p.strategy_version,valuationBasisRevision:basis,quotedAt,
      });
    }catch{return null;}
  }
}
