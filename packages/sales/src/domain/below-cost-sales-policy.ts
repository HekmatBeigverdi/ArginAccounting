import type { InventoryValuationEntrySnapshot } from "@argin/inventory";
import type { SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";
import { SALES_DOMAIN_ERROR_CODES,SalesDomainError } from "./sales-domain-errors.ts";

export const BELOW_COST_SALES_MODES=["allow","warn","require-approval","block"] as const;
export type BelowCostSalesMode=(typeof BELOW_COST_SALES_MODES)[number];

export interface BelowCostSalesPolicy {
 readonly policyId:string;readonly companyId:string;readonly revision:number;readonly effectiveFrom:string;
 readonly mode:BelowCostSalesMode;
 /** Minimum gross margin in basis points. 0 means selling at cost is acceptable. */
 readonly minimumMarginBasisPoints:number;
}
export interface BelowCostEvaluation {
 readonly outcome:"not-applicable"|"allowed"|"warning"|"approval-required"|"blocked"|"cost-unavailable";
 readonly belowThreshold:boolean;readonly sellingUnitPrice:number;readonly costUnitPrice:string|null;
 readonly marginAmount:number|null;readonly marginBasisPoints:number|null;
 readonly policyId:string;readonly policyRevision:number;
 readonly valuationEntryId:string|null;readonly valuationRevision:number|null;
 readonly reason:"service-or-non-stock"|"within-policy"|"below-cost-policy"|"valuation-unresolved";
}
const fail=(field:string):never=>{throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.inputInvalid,field)};
const moneyFromDecimal=(value:string):number=>{const n=Number(value);if(!Number.isFinite(n)||n<0)return fail("valuation.unitCost");return n;};

export function createBelowCostSalesPolicy(input:BelowCostSalesPolicy):BelowCostSalesPolicy{
 if(!input.policyId?.trim()||!input.companyId?.trim())return fail("belowCostPolicy.identity");
 if(!Number.isSafeInteger(input.revision)||input.revision<1)return fail("belowCostPolicy.revision");
 if(!/^\d{4}-\d{2}-\d{2}$/u.test(input.effectiveFrom))return fail("belowCostPolicy.effectiveFrom");
 if(!BELOW_COST_SALES_MODES.includes(input.mode))return fail("belowCostPolicy.mode");
 if(!Number.isSafeInteger(input.minimumMarginBasisPoints)||input.minimumMarginBasisPoints<0||input.minimumMarginBasisPoints>10000)return fail("belowCostPolicy.minimumMarginBasisPoints");
 return Object.freeze({...input,policyId:input.policyId.trim(),companyId:input.companyId.trim()});
}

export function evaluateBelowCostSale(input:{policy:BelowCostSalesPolicy;snapshot:SalesCommercialSnapshot;valuation:InventoryValuationEntrySnapshot|null}):BelowCostEvaluation{
 const {policy,snapshot,valuation}=input;
 if(snapshot.lineKind!=="stock-product")return Object.freeze({outcome:"not-applicable",belowThreshold:false,sellingUnitPrice:snapshot.terms.unitPrice,costUnitPrice:null,marginAmount:null,marginBasisPoints:null,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:null,valuationRevision:null,reason:"service-or-non-stock"});
 if(!valuation||valuation.costState!=="resolved"||valuation.unitCost===null||valuation.totalCost===null)return Object.freeze({outcome:"cost-unavailable",belowThreshold:false,sellingUnitPrice:snapshot.terms.unitPrice,costUnitPrice:null,marginAmount:null,marginBasisPoints:null,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:valuation?.valuationEntryId??null,valuationRevision:valuation?.revision??null,reason:"valuation-unresolved"});
 if(valuation.companyId!==policy.companyId||valuation.productId!==snapshot.productId||valuation.currency!==snapshot.terms.currency)return fail("belowCostEvaluation.valuationLineage");
 const cost=moneyFromDecimal(valuation.unitCost),selling=snapshot.terms.unitPrice,margin=selling-cost;
 const marginBp=cost===0?10000:Math.round((margin/cost)*10000);
 const below=marginBp<policy.minimumMarginBasisPoints;
 const outcome:BelowCostEvaluation["outcome"]=!below||policy.mode==="allow"?"allowed":policy.mode==="warn"?"warning":policy.mode==="require-approval"?"approval-required":"blocked";
 return Object.freeze({outcome,belowThreshold:below,sellingUnitPrice:selling,costUnitPrice:valuation.unitCost,marginAmount:margin,marginBasisPoints:marginBp,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:valuation.valuationEntryId,valuationRevision:valuation.revision,reason:below?"below-cost-policy":"within-policy"});
}
