import assert from "node:assert/strict";
import test from "node:test";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
  calculateSalesReturnCostRestoration,
  resolveSalesReturnReceiptValuation,
} from "../src/index.ts";

function commercial() {
  return {
    source:{sourceSystem:"sales",sourceType:"sales-return",sourceDocumentId:"ret-1",sourceVersion:2,externalReference:null},
    companyId:"c1",branchId:"b1",fiscalYearId:"fy1",customerPartyId:"cust1",
    businessDate:"2026-10-07",currency:"IRR",
    documentTotals:{currency:"IRR",lineCount:1,grossAmount:100,discountAmount:0,netAfterDiscount:100,chargeAmount:0,taxBaseAmount:100,taxAmount:0,grandTotal:100},
    lines:[{snapshotId:"s1",lineId:"ret-line-1",productId:"p1",lineKind:"stock-product",capturedAt:"2026-10-07T10:00:00.000Z",terms:{} as any,totals:{currency:"IRR",grossAmount:100,discountAmount:0,netAfterDiscount:100,chargeAmount:0,taxBaseAmount:100,taxAmount:0,grandTotal:100}}],
  } as any;
}

const lineage:any={
  returnDocumentId:"ret-1",
  originalInvoiceId:"inv-1",
  lines:[{returnLineId:"ret-line-1",originalInvoiceLineId:"inv-line-1",productId:"p1"}],
};

function receipt() {
  return {
    documentId:"receipt-1",companyId:"c1",documentType:"receipt",status:"confirmed",
    lifecycleHistory:[{fromStatus:"approved",toStatus:"confirmed",occurredAt:"2026-10-07T10:05:00.000Z",actorUserId:"u1",reason:null,relatedDocumentId:null}],
    documentNumber:"R-1",businessDate:"2026-10-07",description:null,
    sourceReference:{companyId:"c1",sourceSystem:"sales",documentType:"sales-return",documentId:"ret-1",lineId:null},
    lines:[{lineId:"irl-1",position:1,productId:"p1",description:null,operation:null,sourceReference:{companyId:"c1",sourceSystem:"sales",documentType:"sales-return",documentId:"ret-1",lineId:"ret-line-1"}}],
    version:4,createdAt:"2026-10-07T10:00:00.000Z",updatedAt:"2026-10-07T10:05:00.000Z",
  } as any;
}

const movement:any={
  movementId:"mov-in-1",companyId:"c1",documentId:"receipt-1",lineId:"irl-1",
  businessDate:"2026-10-07",businessOrder:20,recordedAt:"2026-10-07T10:05:00.000Z",
  stockKey:{companyId:"c1",productId:"p1",warehouseId:"wh1",zoneId:null,locationId:null},
  transferId:null,reversalOfMovementId:null,quantityDelta:"1",
};

const valuation:any={
  valuationEntryId:"val-in-1",companyId:"c1",productId:"p1",
  stockKey:movement.stockKey,
  source:{movementId:"mov-in-1",documentId:"receipt-1",lineId:"irl-1",reversalOfMovementId:null,transferId:null},
  kind:"inbound",method:"fifo",strategyVersion:2,currency:"IRR",businessDate:"2026-10-07",businessOrder:20,
  quantity:"1",unitCost:"600",totalCost:600,costState:"resolved",unresolvedReason:null,valuedAt:"2026-10-07T10:06:00.000Z",revision:2,
};

test("resolves confirmed Sales Return receipt -> inbound movement -> resolved valuation", async () => {
  const result=await resolveSalesReturnReceiptValuation(
    commercial(),lineage,receipt(),
    {async listByDocument(){return [movement];}},
    {async findByMovement(){return valuation;}},
  );
  assert.equal(result.length,1);
  assert.equal(result[0]?.returnLineId,"ret-line-1");
  assert.equal(result[0]?.originalInvoiceLineId,"inv-line-1");
  assert.equal(result[0]?.movementId,"mov-in-1");
  assert.equal(result[0]?.valuationEntryId,"val-in-1");
  assert.equal(result[0]?.totalCost,600);
});

test("restores Inventory debit and COGS credit from inbound valuation", async () => {
  const valuationLines=await resolveSalesReturnReceiptValuation(
    commercial(),lineage,receipt(),
    {async listByDocument(){return [movement];}},
    {async findByMovement(){return valuation;}},
  );
  const result=calculateSalesReturnCostRestoration({
    commercial:commercial(),lineage,valuationLines,
    cogsByLine:[{lineId:"ret-line-1",resolution:{ruleId:"cr",accountRole:"cogs",salesLineId:"ret-line-1",productId:"p1",valuationEntryId:"val-in-1",account:{accountId:"cogs",companyId:"c1",code:"5101",name:"COGS",status:"active",postingAllowed:true}}}],
    inventoryByLine:[{lineId:"ret-line-1",resolution:{ruleId:"ir",accountRole:"inventory-asset",salesLineId:"ret-line-1",productId:"p1",movementId:"mov-in-1",valuationEntryId:"val-in-1",warehouseId:"wh1",account:{accountId:"inventory",companyId:"c1",code:"1301",name:"Inventory",status:"active",postingAllowed:true}}}],
  } as any);
  assert.equal(result.totalDebit,600);
  assert.equal(result.totalCredit,600);
  assert.deepEqual(result.components.map(x=>[x.role,x.side,x.amount]),[
    ["inventory-asset","debit",600],
    ["cogs","credit",600],
  ]);
});

test("does not use selling amount as return cost", async () => {
  const valuationLines=await resolveSalesReturnReceiptValuation(
    commercial(),lineage,receipt(),
    {async listByDocument(){return [movement];}},
    {async findByMovement(){return valuation;}},
  );
  assert.equal(commercial().documentTotals.grandTotal,100);
  assert.equal(valuationLines[0]?.totalCost,600);
});

test("unresolved inbound valuation blocks restoration", async () => {
  await assert.rejects(
    ()=>resolveSalesReturnReceiptValuation(
      commercial(),lineage,receipt(),
      {async listByDocument(){return [movement];}},
      {async findByMovement(){return {...valuation,costState:"unresolved",unitCost:null,totalCost:null,valuedAt:null,unresolvedReason:"awaiting-cost"};}},
    ),
    (e:unknown)=>e instanceof SalesPostingDomainError && e.code===SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnValuationUnresolved,
  );
});

test("rejects wrong receipt source or outbound movement", async () => {
  await assert.rejects(
    ()=>resolveSalesReturnReceiptValuation(
      commercial(),lineage,{...receipt(),sourceReference:{...receipt().sourceReference,documentId:"other"}} as any,
      {async listByDocument(){return [movement];}},
      {async findByMovement(){return valuation;}},
    ),
    (e:unknown)=>e instanceof SalesPostingDomainError && e.code===SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
  );

  await assert.rejects(
    ()=>resolveSalesReturnReceiptValuation(
      commercial(),lineage,receipt(),
      {async listByDocument(){return [{...movement,quantityDelta:"-1"}];}},
      {async findByMovement(){return valuation;}},
    ),
    (e:unknown)=>e instanceof SalesPostingDomainError && e.code===SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
  );
});

test("service-only return has no inventory/cost restoration", () => {
  const service={...commercial(),lines:[{...commercial().lines[0],lineKind:"service"}]} as any;
  const result=calculateSalesReturnCostRestoration({
    commercial:service,lineage:{...lineage,lines:[{...lineage.lines[0]}]},
    valuationLines:[],cogsByLine:[],inventoryByLine:[],
  });
  assert.equal(result.currency,null);
  assert.equal(result.totalDebit,0);
  assert.deepEqual(result.components,[]);
});
