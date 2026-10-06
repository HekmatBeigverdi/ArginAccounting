import assert from "node:assert/strict";
import test from "node:test";
import {
  SqliteSalesDocumentRepository,
  SqliteSalesIdempotencyRepository,
  SqliteSalesUnitOfWork,
} from "../src/index.ts";
import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  SalesDomainError, createSalesDocument, createSalesIdempotencyRecord, createSalesLifecycle,
  createSalesMutationContext, transitionSalesLifecycle,
} from "@argin/sales";

class FakeSession implements DatabaseSession {
  rowsAffected=1; calls:{sql:string;parameters:readonly DatabaseValue[]}[]=[];
  async execute(sql:string,parameters:readonly DatabaseValue[]=[]){this.calls.push({sql,parameters});return {rowsAffected:this.rowsAffected};}
  async query<T>(_sql:string,_parameters:readonly DatabaseValue[]=[]):Promise<T[]>{return [];}
  async queryOne<T>(sql:string,_parameters:readonly DatabaseValue[]=[]):Promise<T|null>{
    if(sql.includes("COUNT(*)")) return {count:0} as T;
    return null;
  }
}
const document=()=>createSalesDocument({documentId:"inv-1",documentType:"sales-invoice",companyId:"co-1",branchId:"br-1",fiscalYearId:"fy-1",customer:{partyId:"p-1",code:"C-1",displayName:"Customer"},businessDate:"2026-10-02",lines:[]});

test("document update is a database CAS using expectedVersion",async()=>{
  const db=new FakeSession(); const repo=new SqliteSalesDocumentRepository(db);
  await repo.update({document:document(),lifecycle:createSalesLifecycle("inv-1","sales-invoice"),version:2,createdAt:"2026-10-02T10:00:00Z",updatedAt:"2026-10-02T10:01:00Z"},1);
  const update=db.calls.find(x=>x.sql.startsWith("UPDATE sales_documents"));
  assert.ok(update); assert.match(update.sql,/AND version=\?/); assert.equal(update.parameters.at(-1),1);
});

test("zero-row CAS becomes sales concurrency conflict",async()=>{
  const db=new FakeSession();db.rowsAffected=0;const repo=new SqliteSalesDocumentRepository(db);
  await assert.rejects(()=>repo.update({document:document(),lifecycle:createSalesLifecycle("inv-1","sales-invoice"),version:2,createdAt:"2026-10-02T10:00:00Z",updatedAt:"2026-10-02T10:01:00Z"},1),(e:unknown)=>e instanceof SalesDomainError&&e.code==="sales.concurrency_conflict");
});

test("lifecycle transition is appended in the same repository session",async()=>{
  const db=new FakeSession();const repo=new SqliteSalesDocumentRepository(db);
  let lifecycle=createSalesLifecycle("inv-1","sales-invoice");
  lifecycle=transitionSalesLifecycle(lifecycle,{transitionId:"t1",action:"submit",actorId:"u1",occurredAt:"2026-10-02T10:01:00Z"});
  await repo.add({document:document(),lifecycle,version:1,createdAt:"2026-10-02T10:00:00Z",updatedAt:"2026-10-02T10:01:00Z"});
  assert.ok(db.calls.some(x=>x.sql.includes("INSERT INTO sales_document_lifecycle")));
});

test("idempotency record persists exact result envelope and both durable identities",async()=>{
  const db=new FakeSession();const repo=new SqliteSalesIdempotencyRepository(db);
  const context=createSalesMutationContext({companyId:"co-1",branchId:"br-1",requestId:"req-1",operationId:"op-1",operation:"sales-invoice:create",payloadFingerprint:"sha256:a",actorUserId:"u",occurredAt:"2026-10-02T10:00:00Z"});
  const record=createSalesIdempotencyRecord({context,outcomeKind:"sales-document",outcomeId:"inv-1",outcomeVersion:1,resultJson:JSON.stringify({documentId:"inv-1"}),recordedAt:"2026-10-02T10:00:01Z"});
  await repo.add(record);
  const insert=db.calls.at(-1)!;assert.ok(insert.parameters.includes("req-1"));assert.ok(insert.parameters.includes("op-1"));assert.ok(insert.parameters.includes(record.resultJson));
});

test("unit of work supplies document and idempotency repositories on one transaction session",async()=>{
  const session=new FakeSession();let transactions=0;
  const executor={async transaction<T>(work:(db:DatabaseSession)=>Promise<T>){transactions+=1;return work(session);}} as DatabaseExecutor;
  const uow=new SqliteSalesUnitOfWork(executor);
  await uow.execute(async context=>{assert.ok(context.documents);assert.ok(context.idempotency);return undefined;});
  assert.equal(transactions,1);
});

for (const adjustmentKind of ["discounts", "charges"] as const) {
  test(`findById restores saved ${adjustmentKind} and commercial terms`, async () => {
    const snapshot = createSalesDocument({
      ...document(),
      ...document().scope,
      lines: [
        {
          lineId: "line-1",
          position: 1,
          lineKind: "stock-product",
          productId: "product-1",
          commercialTerms: {
            quantity: 2,
            currency: "IRR",
            unitPrice: 10000,
            priceOrigin: "price-list",
            priceListId: "prices-1",
            priceListItemId: "price-item-1",
            priceRevisionId: "revision-1",
            priceRevision: 3,
            [adjustmentKind]: [
              { id: "adjustment-1", mode: "amount", value: 500, reason: "Adjustment" },
              { id: "adjustment-2", mode: "percent", value: 1000 },
            ],
            taxes: [{ taxId: "tax-1", rateBasisPoints: 900, taxCode: "VAT" }],
          },
        },
        { lineId: "line-2", position: 2, lineKind: "service", productId: "service-1" },
      ],
    });
    class SavedDocumentSession extends FakeSession {
      override async queryOne<T>(): Promise<T | null> {
        return {
          id: snapshot.documentId,
          company_id: snapshot.scope.companyId,
          document_json: JSON.stringify(snapshot),
          version: 4,
          created_at: "2026-10-02T10:00:00Z",
          updated_at: "2026-10-02T10:01:00Z",
        } as T;
      }
    }

    const repository = new SqliteSalesDocumentRepository(new SavedDocumentSession());
    const restored = await repository.findById("co-1", "inv-1");

    assert.deepEqual(restored, {
      document: snapshot,
      lifecycle: createSalesLifecycle("inv-1", "sales-invoice"),
      version: 4,
      createdAt: "2026-10-02T10:00:00Z",
      updatedAt: "2026-10-02T10:01:00Z",
    });
  });
}
