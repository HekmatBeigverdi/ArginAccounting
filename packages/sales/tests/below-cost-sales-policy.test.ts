import assert from "node:assert/strict";import test from "node:test";
import {createBelowCostSalesPolicy,evaluateBelowCostSale,evaluateBelowCostSaleWithQuote} from "../src/index.ts";
const policy=(mode:"allow"|"warn"|"require-approval"|"block",minimumMarginBasisPoints=0)=>createBelowCostSalesPolicy({policyId:"p",companyId:"co",revision:2,effectiveFrom:"2026-10-05",mode,minimumMarginBasisPoints});
const snapshot:any={snapshotId:"s",lineId:"l",productId:"ssd",lineKind:"stock-product",capturedAt:"2026-10-05T10:00:00Z",terms:{quantity:1,currency:"IRR",unitPrice:900000},totals:{taxBaseAmount:900000}};
const valuation:any={valuationEntryId:"v",companyId:"co",productId:"ssd",kind:"outbound",currency:"IRR",unitCost:"1000000",totalCost:-1000000,costState:"resolved",revision:3};

test("warn detects SSD sale below authoritative valuation cost",()=>{const x=evaluateBelowCostSale({policy:policy("warn"),snapshot,valuation});assert.equal(x.outcome,"warning");assert.equal(x.marginAmount,-100000);assert.equal(x.marginBasisPoints,-1000);assert.equal(x.valuationEntryId,"v");assert.equal(x.valuationRevision,3);});
test("require approval and block are explicit policy outcomes",()=>{assert.equal(evaluateBelowCostSale({policy:policy("require-approval"),snapshot,valuation}).outcome,"approval-required");assert.equal(evaluateBelowCostSale({policy:policy("block"),snapshot,valuation}).outcome,"blocked");});
test("minimum margin threshold can guard low-margin sales above cost",()=>{const s={...snapshot,terms:{...snapshot.terms,unitPrice:1050000}};assert.equal(evaluateBelowCostSale({policy:policy("warn",1000),snapshot:s,valuation}).outcome,"warning");});
test("service lines never consume inventory cost guard",()=>{const s={...snapshot,lineKind:"service"};assert.equal(evaluateBelowCostSale({policy:policy("block"),snapshot:s,valuation:null}).outcome,"not-applicable");});
test("unresolved cost is explicit and never silently treated as zero",()=>{assert.equal(evaluateBelowCostSale({policy:policy("block"),snapshot,valuation:null}).outcome,"cost-unavailable");});
test("valuation must match company product and currency lineage",()=>{assert.throws(()=>evaluateBelowCostSale({policy:policy("block"),snapshot,valuation:{...valuation,productId:"other"}}));});


test("pre-finalization quote uses current authoritative valuation basis without pretending outbound valuation already exists",()=>{
 const quote:any={quoteId:"q",companyId:"co",productId:"ssd",warehouseId:"wh",businessDate:"2026-10-05",quantity:"1",currency:"IRR",unitCost:"1000000",totalCost:1000000,method:"fifo",strategyVersion:1,valuationBasisRevision:"fifo:p:2:l1@3",quotedAt:"2026-10-05T10:00:00Z"};
 const x=evaluateBelowCostSaleWithQuote({policy:policy("warn"),snapshot,quote});
 assert.equal(x.outcome,"warning");assert.equal(x.marginAmount,-100000);assert.equal(x.marginBasisPoints,-1000);
});
test("missing pre-finalization quote is explicit cost-unavailable",()=>{
 assert.equal(evaluateBelowCostSaleWithQuote({policy:policy("block"),snapshot,quote:null}).outcome,"cost-unavailable");
});


test("discounted net selling price cannot bypass below-cost guard",()=>{
 const discounted={...snapshot,terms:{...snapshot.terms,unitPrice:1200000},totals:{...snapshot.totals,taxBaseAmount:850000}};
 const quote:any={quoteId:"q2",companyId:"co",productId:"ssd",warehouseId:"wh",businessDate:"2026-10-05",quantity:"1",currency:"IRR",unitCost:"1000000",totalCost:1000000,method:"fifo",strategyVersion:1,valuationBasisRevision:"fifo:p:2:l1@3",quotedAt:"2026-10-05T10:00:00Z"};
 const x=evaluateBelowCostSaleWithQuote({policy:policy("warn"),snapshot:discounted,quote});
 assert.equal(x.outcome,"warning");assert.equal(x.sellingUnitPrice,850000);assert.equal(x.marginAmount,-150000);
});
