import assert from "node:assert/strict";
import test from "node:test";
import {
  SALES_SYNC_CONTRACT_VERSION, SalesSyncContractError, createSalesDocument,
  createSalesDocumentSyncTombstoneEnvelope, createSalesDocumentSyncUpsertEnvelope,
  createSalesLifecycle, createSalesMutationContext, transitionSalesLifecycle,
} from "../src/index.ts";

const mutation=()=>createSalesMutationContext({companyId:"co",branchId:"b",requestId:"req",operationId:"op",operation:"sales-invoice:update",payloadFingerprint:"sha256:x",actorUserId:"u",occurredAt:"2026-10-02T10:00:00Z"});
const document=()=>createSalesDocument({documentId:"inv",documentType:"sales-invoice",companyId:"co",branchId:"b",fiscalYearId:"fy",customer:{partyId:"p",code:"C",displayName:"Customer"},documentNumber:"SI-1",businessDate:"2026-10-02",lines:[{lineId:"l1",position:1,lineKind:"stock-product",productId:"prod",commercialTerms:{quantity:1,currency:"IRR",unitPrice:100,priceOrigin:"manual"}}]});
const base={mutation:mutation(),changedAt:"2026-10-02T10:05:00Z",origin:{sourceSystem:"argin-desktop",sourceInstanceId:"desktop-1"}};

test("upsert preserves mutation identity, local version and authoritative snapshot",()=>{
  let lifecycle=createSalesLifecycle("inv","sales-invoice");lifecycle=transitionSalesLifecycle(lifecycle,{transitionId:"t1",action:"submit",actorId:"u",occurredAt:"2026-10-02T10:01:00Z"});
  const envelope=createSalesDocumentSyncUpsertEnvelope({...base,reference:{companyId:"co",branchId:"b",documentId:"inv",documentNumber:"SI-1"},state:{document:document(),lifecycle,version:2,createdAt:"2026-10-02T09:00:00Z",updatedAt:"2026-10-02T10:02:00Z"}});
  assert.equal(envelope.contractVersion,SALES_SYNC_CONTRACT_VERSION);assert.equal(envelope.requestId,"req");assert.equal(envelope.operationId,"op");assert.equal(envelope.payloadFingerprint,"sha256:x");assert.equal(envelope.localVersion,2);assert.equal(envelope.lifecycleStatus,"submitted");assert.equal(envelope.snapshot.documentId,"inv");
  assert.ok(envelope.dependencies.some(x=>x.entity==="party"&&x.id==="p"));assert.ok(envelope.dependencies.some(x=>x.entity==="product"&&x.id==="prod"));
});

test("reference or mutation scope mismatch is rejected",()=>{
  assert.throws(()=>createSalesDocumentSyncUpsertEnvelope({...base,reference:{companyId:"co",branchId:"other",documentId:"inv",documentNumber:"SI-1"},state:{document:document(),lifecycle:createSalesLifecycle("inv","sales-invoice"),version:1,createdAt:"2026-10-02T09:00:00Z",updatedAt:"2026-10-02T10:02:00Z"}}),(e:unknown)=>e instanceof SalesSyncContractError&&e.code==="sales.sync.snapshot-mismatch");
});

test("external references are unique per source system and external id",()=>{
  assert.throws(()=>createSalesDocumentSyncUpsertEnvelope({...base,externalReferences:[{sourceSystem:"crm",externalId:"1"},{sourceSystem:"CRM",externalId:"1"}],reference:{companyId:"co",branchId:"b",documentId:"inv",documentNumber:"SI-1"},state:{document:document(),lifecycle:createSalesLifecycle("inv","sales-invoice"),version:1,createdAt:"2026-10-02T09:00:00Z",updatedAt:"2026-10-02T10:02:00Z"}}),(e:unknown)=>e instanceof SalesSyncContractError&&e.code==="sales.sync.external-reference-duplicate");
});

test("only a last-known draft may become a synchronization tombstone",()=>{
  const tombstone=createSalesDocumentSyncTombstoneEnvelope({...base,reference:{companyId:"co",branchId:"b",documentId:"inv",documentNumber:"SI-1"},localVersion:3,lastKnownStatus:"draft",deletedAt:"2026-10-02T10:03:00Z"});
  assert.equal(tombstone.changeKind,"tombstone");assert.equal(tombstone.snapshot,null);assert.equal(tombstone.lifecycleStatus,"draft");
  assert.throws(()=>createSalesDocumentSyncTombstoneEnvelope({...base,reference:{companyId:"co",branchId:"b",documentId:"inv",documentNumber:"SI-1"},localVersion:3,lastKnownStatus:"finalized",deletedAt:"2026-10-02T10:03:00Z"}),(e:unknown)=>e instanceof SalesSyncContractError&&e.code==="sales.sync.tombstone-invalid");
});

test("changedAt cannot precede committed state or mutation occurrence",()=>{
  assert.throws(()=>createSalesDocumentSyncUpsertEnvelope({...base,changedAt:"2026-10-02T09:59:00Z",reference:{companyId:"co",branchId:"b",documentId:"inv",documentNumber:"SI-1"},state:{document:document(),lifecycle:createSalesLifecycle("inv","sales-invoice"),version:1,createdAt:"2026-10-02T09:00:00Z",updatedAt:"2026-10-02T10:02:00Z"}}),(e:unknown)=>e instanceof SalesSyncContractError&&e.code==="sales.sync.timestamp-invalid");
});

for (const adjustmentKind of ["discounts", "charges"] as const) {
  test(`upsert preserves saved ${adjustmentKind} in its snapshot`, () => {
    const snapshot = createSalesDocument({
      ...document(),
      ...document().scope,
      lines: [
        {
          lineId: "l1",
          position: 1,
          lineKind: "stock-product",
          productId: "prod",
          commercialTerms: {
            quantity: 2,
            currency: "IRR",
            unitPrice: 10000,
            priceOrigin: "price-list",
            priceListId: "prices",
            priceListItemId: "price-item",
            priceRevisionId: "revision",
            priceRevision: 3,
            [adjustmentKind]: [
              { id: "adjustment-1", mode: "amount", value: 500, reason: "Adjustment" },
              { id: "adjustment-2", mode: "percent", value: 1000 },
            ],
            taxes: [{ taxId: "tax", rateBasisPoints: 900, taxCode: "VAT" }],
          },
        },
        { lineId: "l2", position: 2, lineKind: "service", productId: "service" },
      ],
    });

    const envelope = createSalesDocumentSyncUpsertEnvelope({
      ...base,
      reference: { companyId: "co", branchId: "b", documentId: "inv", documentNumber: "SI-1" },
      state: {
        document: snapshot,
        lifecycle: createSalesLifecycle("inv", "sales-invoice"),
        version: 2,
        createdAt: "2026-10-02T09:00:00Z",
        updatedAt: "2026-10-02T10:02:00Z",
      },
    });

    assert.deepEqual(envelope.snapshot, snapshot);
    assert.ok(Object.isFrozen(envelope.snapshot.lines[0]?.commercialTerms));
  });
}
