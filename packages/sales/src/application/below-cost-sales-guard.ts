import type { SalesCommercialSnapshot } from "../domain/sales-commercial-snapshot.ts";
import {
  createBelowCostSalesPolicy,
  evaluateBelowCostSaleWithQuote,
  type BelowCostEvaluation,
  type BelowCostSalesPolicy,
  type SalesInventoryCostQuote,
  type SalesInventoryCostQuotePort,
} from "../domain/below-cost-sales-policy.ts";

export interface BelowCostSalesPolicyRepository {
  findEffective(companyId:string,businessDate:string):Promise<BelowCostSalesPolicy|null>;
  save(policy:BelowCostSalesPolicy,actorId:string,changedAt:string):Promise<void>;
  list(companyId:string):Promise<readonly BelowCostSalesPolicy[]>;
}
export interface BelowCostDecision {
  readonly decisionId:string;readonly companyId:string;readonly documentId:string;readonly lineId:string;
  readonly policyId:string;readonly policyRevision:number;readonly outcome:BelowCostEvaluation["outcome"];
  readonly sellingUnitPrice:number;readonly quotedUnitCost:string|null;readonly marginAmount:number|null;readonly marginBasisPoints:number|null;
  readonly quoteId:string|null;readonly valuationBasisRevision:string|null;readonly warehouseId:string|null;
  readonly approvedBy:string|null;readonly approvalReason:string|null;readonly decidedAt:string;
}
export interface BelowCostSalesDecisionRepository { add(decision:BelowCostDecision):Promise<void>; listByDocument(companyId:string,documentId:string):Promise<readonly BelowCostDecision[]>; }

export interface BelowCostLineRouting { readonly salesLineId:string;readonly warehouseId:string; }

export class BelowCostSalesGuardService {
  constructor(private readonly policies:BelowCostSalesPolicyRepository,private readonly quotes:SalesInventoryCostQuotePort,private readonly decisions:BelowCostSalesDecisionRepository){}
  async evaluate(input:{companyId:string;documentId:string;businessDate:string;snapshots:readonly SalesCommercialSnapshot[];routing:readonly BelowCostLineRouting[]}){
    const configured=await this.policies.findEffective(input.companyId,input.businessDate);
    const policy=configured??createBelowCostSalesPolicy({policyId:"default-warn",companyId:input.companyId,revision:1,effectiveFrom:"1900-01-01",mode:"warn",minimumMarginBasisPoints:0});
    const route=new Map(input.routing.map(x=>[x.salesLineId,x.warehouseId]));
    const results=[] as Array<{snapshot:SalesCommercialSnapshot;quote:SalesInventoryCostQuote|null;evaluation:BelowCostEvaluation}>;
    for(const snapshot of input.snapshots){
      let quote:SalesInventoryCostQuote|null=null;
      if(snapshot.lineKind==="stock-product"){
        const warehouseId=route.get(snapshot.lineId);
        if(!warehouseId) throw new Error("sales.below_cost_warehouse_required");
        quote=await this.quotes.quote({companyId:input.companyId,productId:snapshot.productId,warehouseId,businessDate:input.businessDate,quantity:String(snapshot.terms.quantity),currency:snapshot.terms.currency});
      }
      results.push({snapshot,quote,evaluation:evaluateBelowCostSaleWithQuote({policy,snapshot,quote})});
    }
    return Object.freeze({policy,results:Object.freeze(results)});
  }
  async record(input:{companyId:string;documentId:string;decisionKey:string;actorId:string;approved:boolean;approvalReason?:string|null;evaluated:Awaited<ReturnType<BelowCostSalesGuardService["evaluate"]>>;decidedAt:string}){
    for(const item of input.evaluated.results){
      await this.decisions.add(Object.freeze({
        decisionId:`${input.decisionKey}:${item.snapshot.lineId}`,
        companyId:input.companyId,documentId:input.documentId,lineId:item.snapshot.lineId,
        policyId:input.evaluated.policy.policyId,policyRevision:input.evaluated.policy.revision,outcome:item.evaluation.outcome,
        sellingUnitPrice:item.evaluation.sellingUnitPrice,quotedUnitCost:item.evaluation.costUnitPrice,
        marginAmount:item.evaluation.marginAmount,marginBasisPoints:item.evaluation.marginBasisPoints,
        quoteId:item.quote?.quoteId??null,valuationBasisRevision:item.quote?.valuationBasisRevision??null,warehouseId:item.quote?.warehouseId??null,
        approvedBy:input.approved?input.actorId:null,approvalReason:input.approved?(input.approvalReason?.trim()||null):null,decidedAt:input.decidedAt,
      }));
    }
  }
}
