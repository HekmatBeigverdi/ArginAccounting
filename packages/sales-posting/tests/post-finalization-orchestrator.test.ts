import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  orchestrateSalesPostFinalization,
} from "../src/index.ts";

function commercial(path:"service"|"stock"|"mixed") {
  const lines:any[]=[];
  if(path!=="service") lines.push({lineId:"stock-1",productId:"p1",lineKind:"stock-product"});
  if(path!=="stock") lines.push({lineId:"service-1",productId:"s1",lineKind:"service"});
  return {
    source:{sourceSystem:"sales",sourceType:"sales-invoice",sourceDocumentId:"inv-1",sourceVersion:1,externalReference:null},
    companyId:"c1",branchId:"b1",fiscalYearId:"fy",customerPartyId:"cust",businessDate:"2026-10-07",currency:"IRR",
    documentTotals:{grandTotal:1000},
    lines,
  } as any;
}
const commercialPosting:any={currency:"IRR",totalDebit:1000,totalCredit:1000,balanced:true,components:[]};
const fulfillment=(status:"waiting-for-issue"|"waiting-for-confirmation"|"eligible")=>({
  sourceDocumentId:"inv-1",companyId:"c1",hasStockLines:true,cogsEligible:status==="eligible",
  lines:[{salesLineId:"stock-1",productId:"p1",lineKind:"stock-product",status,inventoryDocumentId:status==="waiting-for-issue"?null:"iss-1",inventoryLineId:status==="waiting-for-issue"?null:"il-1",inventoryDocumentStatus:status==="eligible"?"confirmed":"draft"}],
}) as any;
const issue:any={sourceDocumentId:"inv-1",companyId:"c1",lines:[{salesLineId:"stock-1"}]};
const movement:any={sourceDocumentId:"inv-1",companyId:"c1",lines:[{salesLineId:"stock-1"}]};
const valuation:any={sourceDocumentId:"inv-1",companyId:"c1",ready:true,lines:[{salesLineId:"stock-1"}]};
const cost:any={currency:"IRR",totalDebit:500,totalCredit:500,balanced:true,components:[]};

test("service-only is immediately ready without inventory dependencies",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("service"),commercialPosting});
  assert.equal(r.status,"ready"); assert.equal(r.path,"service-only");
  if(r.status==="ready") assert.equal(r.cost,null);
});
test("stock waits for issue",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("stock"),commercialPosting});
  assert.deepEqual(r,{status:"pending",path:"stock-only",sourceDocumentId:"inv-1",companyId:"c1",reason:"waiting-for-issue",waitingLineIds:["stock-1"]});
});
test("stock waits for confirmation",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("stock"),commercialPosting,stockFulfillment:fulfillment("waiting-for-confirmation")});
  assert.equal(r.status,"pending"); if(r.status==="pending") assert.equal(r.reason,"waiting-for-confirmation");
});
test("confirmed issue waits for movement lineage",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("stock"),commercialPosting,stockFulfillment:fulfillment("eligible"),issueLineage:issue});
  assert.equal(r.status,"pending"); if(r.status==="pending") assert.equal(r.reason,"waiting-for-movement");
});
test("movement waits for valuation",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("stock"),commercialPosting,stockFulfillment:fulfillment("eligible"),issueLineage:issue,movementLineage:movement});
  assert.equal(r.status,"pending"); if(r.status==="pending") assert.equal(r.reason,"waiting-for-valuation");
});
test("stock becomes ready when valuation and cost posting exist",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("stock"),commercialPosting,stockFulfillment:fulfillment("eligible"),issueLineage:issue,movementLineage:movement,valuation,costPosting:cost});
  assert.equal(r.status,"ready"); assert.equal(r.path,"stock-only");
});
test("mixed becomes ready through same resumable chain",()=>{
  const r=orchestrateSalesPostFinalization({commercialInput:commercial("mixed"),commercialPosting,stockFulfillment:fulfillment("eligible"),issueLineage:issue,movementLineage:movement,valuation,costPosting:cost});
  assert.equal(r.status,"ready"); assert.equal(r.path,"mixed");
});
test("non-stock-product is not silently classified",()=>{
  assert.throws(()=>orchestrateSalesPostFinalization({commercialInput:{...commercial("service"),lines:[{lineId:"n1",productId:"n1",lineKind:"non-stock-product"}]} as any,commercialPosting}),
  (e:unknown)=>e instanceof SalesPostingDomainError && e.code===SALES_POSTING_DOMAIN_ERROR_CODES.orchestrationInvalid);
});
