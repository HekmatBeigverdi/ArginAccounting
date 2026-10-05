import type { InventoryValuationEntrySnapshot } from "@argin/inventory";
import type { SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";
import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export const BELOW_COST_SALES_MODES = ["allow", "warn", "require-approval", "block"] as const;
export type BelowCostSalesMode = (typeof BELOW_COST_SALES_MODES)[number];

export interface BelowCostSalesPolicy {
  readonly policyId: string;
  readonly companyId: string;
  readonly revision: number;
  readonly effectiveFrom: string;
  readonly mode: BelowCostSalesMode;
  /** Minimum margin-over-cost threshold in basis points. 0 means selling at cost is acceptable. */
  readonly minimumMarginBasisPoints: number;
}

export interface BelowCostEvaluation {
  readonly outcome:
    | "not-applicable"
    | "allowed"
    | "warning"
    | "approval-required"
    | "blocked"
    | "cost-unavailable";
  readonly belowThreshold: boolean;
  readonly sellingUnitPrice: number;
  readonly costUnitPrice: string | null;
  readonly marginAmount: number | null;
  readonly marginBasisPoints: number | null;
  readonly policyId: string;
  readonly policyRevision: number;
  readonly valuationEntryId: string | null;
  readonly valuationRevision: number | null;
  readonly reason:
    | "service-or-non-stock"
    | "within-policy"
    | "below-cost-policy"
    | "valuation-unresolved";
}

function fail(field: string): never {
  throw new SalesDomainError(SALES_DOMAIN_ERROR_CODES.inputInvalid, field);
}

function moneyFromDecimal(value: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return fail("valuation.unitCost");
  }
  return amount;
}

function netSellingUnitPrice(snapshot: SalesCommercialSnapshot): number {
  const quantity = snapshot.terms.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return fail("belowCostEvaluation.quantity");
  }
  const netAmountBeforeVat = snapshot.totals.taxBaseAmount;
  const value = netAmountBeforeVat / quantity;
  if (!Number.isFinite(value) || value < 0) {
    return fail("belowCostEvaluation.netSellingUnitPrice");
  }
  return value;
}

export function createBelowCostSalesPolicy(input: BelowCostSalesPolicy): BelowCostSalesPolicy {
  if (!input.policyId?.trim() || !input.companyId?.trim()) {
    return fail("belowCostPolicy.identity");
  }
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    return fail("belowCostPolicy.revision");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.effectiveFrom)) {
    return fail("belowCostPolicy.effectiveFrom");
  }
  if (!BELOW_COST_SALES_MODES.includes(input.mode)) {
    return fail("belowCostPolicy.mode");
  }
  if (
    !Number.isSafeInteger(input.minimumMarginBasisPoints)
    || input.minimumMarginBasisPoints < 0
    || input.minimumMarginBasisPoints > 10000
  ) {
    return fail("belowCostPolicy.minimumMarginBasisPoints");
  }

  return Object.freeze({
    ...input,
    policyId: input.policyId.trim(),
    companyId: input.companyId.trim(),
  });
}

export function evaluateBelowCostSale(input: {
  policy: BelowCostSalesPolicy;
  snapshot: SalesCommercialSnapshot;
  valuation: InventoryValuationEntrySnapshot | null;
}): BelowCostEvaluation {
  const { policy, snapshot, valuation } = input;

  if (snapshot.lineKind !== "stock-product") {
    return Object.freeze({
      outcome: "not-applicable",
      belowThreshold: false,
      sellingUnitPrice: netSellingUnitPrice(snapshot),
      costUnitPrice: null,
      marginAmount: null,
      marginBasisPoints: null,
      policyId: policy.policyId,
      policyRevision: policy.revision,
      valuationEntryId: null,
      valuationRevision: null,
      reason: "service-or-non-stock",
    });
  }

  if (
    !valuation
    || valuation.costState !== "resolved"
    || valuation.unitCost === null
    || valuation.totalCost === null
  ) {
    return Object.freeze({
      outcome: "cost-unavailable",
      belowThreshold: false,
      sellingUnitPrice: netSellingUnitPrice(snapshot),
      costUnitPrice: null,
      marginAmount: null,
      marginBasisPoints: null,
      policyId: policy.policyId,
      policyRevision: policy.revision,
      valuationEntryId: valuation?.valuationEntryId ?? null,
      valuationRevision: valuation?.revision ?? null,
      reason: "valuation-unresolved",
    });
  }

  if (
    valuation.companyId !== policy.companyId
    || valuation.productId !== snapshot.productId
    || valuation.currency !== snapshot.terms.currency
  ) {
    return fail("belowCostEvaluation.valuationLineage");
  }

  const costUnitPrice = moneyFromDecimal(valuation.unitCost);
  const sellingUnitPrice = netSellingUnitPrice(snapshot);
  const marginAmount = sellingUnitPrice - costUnitPrice;
  const marginBasisPoints = costUnitPrice === 0
    ? 10000
    : Math.round((marginAmount / costUnitPrice) * 10000);
  const belowThreshold = marginBasisPoints < policy.minimumMarginBasisPoints;

  let outcome: BelowCostEvaluation["outcome"];
  if (!belowThreshold || policy.mode === "allow") {
    outcome = "allowed";
  } else if (policy.mode === "warn") {
    outcome = "warning";
  } else if (policy.mode === "require-approval") {
    outcome = "approval-required";
  } else {
    outcome = "blocked";
  }

  return Object.freeze({
    outcome,
    belowThreshold,
    sellingUnitPrice,
    costUnitPrice: valuation.unitCost,
    marginAmount,
    marginBasisPoints,
    policyId: policy.policyId,
    policyRevision: policy.revision,
    valuationEntryId: valuation.valuationEntryId,
    valuationRevision: valuation.revision,
    reason: belowThreshold ? "below-cost-policy" : "within-policy",
  });
}


export interface SalesInventoryCostQuote {
  readonly quoteId:string;
  readonly companyId:string;
  readonly productId:string;
  readonly warehouseId:string;
  readonly businessDate:string;
  readonly quantity:string;
  readonly currency:string;
  readonly unitCost:string;
  readonly totalCost:number;
  readonly method:"fifo"|"moving_average";
  readonly strategyVersion:number;
  /** Deterministic revision/fingerprint of the valuation state/layers used for this quote. */
  readonly valuationBasisRevision:string;
  readonly quotedAt:string;
}

export interface SalesInventoryCostQuotePort {
  quote(input:{
    readonly companyId:string;readonly productId:string;readonly warehouseId:string;
    readonly businessDate:string;readonly quantity:string;readonly currency:string;
  }):Promise<SalesInventoryCostQuote|null>;
}

export function evaluateBelowCostSaleWithQuote(input:{
  readonly policy:BelowCostSalesPolicy;readonly snapshot:SalesCommercialSnapshot;readonly quote:SalesInventoryCostQuote|null;
}):BelowCostEvaluation{
  const {policy,snapshot,quote}=input;
  if(snapshot.lineKind!=="stock-product")return Object.freeze({outcome:"not-applicable",belowThreshold:false,sellingUnitPrice:netSellingUnitPrice(snapshot),costUnitPrice:null,marginAmount:null,marginBasisPoints:null,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:null,valuationRevision:null,reason:"service-or-non-stock"});
  if(!quote)return Object.freeze({outcome:"cost-unavailable",belowThreshold:false,sellingUnitPrice:netSellingUnitPrice(snapshot),costUnitPrice:null,marginAmount:null,marginBasisPoints:null,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:null,valuationRevision:null,reason:"valuation-unresolved"});
  if(quote.companyId!==policy.companyId||quote.productId!==snapshot.productId||quote.currency!==snapshot.terms.currency)return fail("belowCostEvaluation.costQuoteLineage");
  const cost=moneyFromDecimal(quote.unitCost),selling=netSellingUnitPrice(snapshot),margin=selling-cost;
  const marginBp=cost===0?10000:Math.round((margin/cost)*10000);
  const below=marginBp<policy.minimumMarginBasisPoints;
  const outcome:BelowCostEvaluation["outcome"]=!below||policy.mode==="allow"?"allowed":policy.mode==="warn"?"warning":policy.mode==="require-approval"?"approval-required":"blocked";
  return Object.freeze({outcome,belowThreshold:below,sellingUnitPrice:selling,costUnitPrice:quote.unitCost,marginAmount:margin,marginBasisPoints:marginBp,policyId:policy.policyId,policyRevision:policy.revision,valuationEntryId:quote.quoteId,valuationRevision:null,reason:below?"below-cost-policy":"within-policy"});
}
