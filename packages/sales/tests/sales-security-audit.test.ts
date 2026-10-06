import assert from "node:assert/strict";
import test from "node:test";
import {
 SalesDomainError,SecuredSalesMutationService,createSalesDocument,createSalesLifecycle,
 createSalesMutationContext,salesPermissions,transitionSalesLifecycle,type SalesAuditEvent,
} from "../src/index.ts";

const mutation=()=>createSalesMutationContext({companyId:"co",branchId:"b",requestId:"req",operationId:"op",operation:"sales-invoice:submit",payloadFingerprint:"sha256:x",actorUserId:"u",occurredAt:"2026-10-02T10:00:00Z"});
const doc=()=>createSalesDocument({documentId:"inv",documentType:"sales-invoice",companyId:"co",branchId:"b",fiscalYearId:"fy",customer:{partyId:"p",code:"C",displayName:"Customer"},businessDate:"2026-10-02",lines:[]});
const state=(version=1,submitted=false)=>{let lifecycle=createSalesLifecycle("inv","sales-invoice");if(submitted)lifecycle=transitionSalesLifecycle(lifecycle,{transitionId:"t",action:"submit",actorId:"u",occurredAt:"2026-10-02T10:00:00Z"});return {document:doc(),lifecycle,version,createdAt:"2026-10-02T09:00:00Z",updatedAt:"2026-10-02T10:00:00Z"};};

test("authorization receives actor company branch and mutation identities before execution",async()=>{
 const calls:string[]=[];const audit:SalesAuditEvent[]=[];
 const service=new SecuredSalesMutationService({authorization:{async require(ctx,permission){calls.push(`${ctx.actorId}:${ctx.companyId}:${ctx.branchId}:${ctx.requestId}:${ctx.operationId}:${permission}`);}},audit:{async record(e){audit.push(e);}}});
 const result=await service.execute({security:{actorId:"u"},mutation:mutation(),permission:salesPermissions.submit,action:"sales.document.submit",documentId:"inv",before:state(),execute:async()=>{calls.push("execute");return state(2,true);}});
 assert.equal(result.version,2);assert.equal(calls[0],"u:co:b:req:op:sales.documents.submit");assert.equal(calls[1],"execute");assert.equal(audit.length,1);
});

test("authorization failure blocks mutation and audit success record",async()=>{
 let executed=false;let audited=false;
 const service=new SecuredSalesMutationService({authorization:{async require(){throw new Error("denied");}},audit:{async record(){audited=true;}}});
 await assert.rejects(()=>service.execute({security:{actorId:"u"},mutation:mutation(),permission:salesPermissions.submit,action:"sales.document.submit",documentId:"inv",execute:async()=>{executed=true;return state();}}),(e:unknown)=>e instanceof SalesDomainError&&e.code==="sales.unauthorized");
 assert.equal(executed,false);assert.equal(audited,false);
});

test("audit links actor request operation fingerprint and before/after trace",async()=>{
 const events:SalesAuditEvent[]=[];
 const service=new SecuredSalesMutationService({authorization:{async require(){}},audit:{async record(e){events.push(e);}}});
 await service.execute({security:{actorId:"u",correlationId:"corr"},mutation:mutation(),permission:salesPermissions.submit,action:"sales.document.submit",documentId:"inv",reason:"submit",before:state(1),execute:async()=>state(2,true),metadata:{transitionId:"t"}});
 const e=events[0]!;assert.equal(e.actorId,"u");assert.equal(e.requestId,"req");assert.equal(e.operationId,"op");assert.equal(e.correlationId,"corr");assert.equal(e.beforeStatus,"draft");assert.equal(e.afterStatus,"submitted");assert.equal(e.beforeVersion,1);assert.equal(e.afterVersion,2);assert.equal(e.metadata.payloadFingerprint,"sha256:x");
});

test("result cannot escape authorized company branch or target document scope",async()=>{
 const other=createSalesDocument({documentId:"other",documentType:"sales-invoice",companyId:"co",branchId:"b",fiscalYearId:"fy",customer:{partyId:"p",code:"C",displayName:"Customer"},businessDate:"2026-10-02",lines:[]});
 const service=new SecuredSalesMutationService({authorization:{async require(){}},audit:{async record(){}}});
 await assert.rejects(()=>service.execute({security:{actorId:"u"},mutation:mutation(),permission:salesPermissions.edit,action:"sales.document.edit",documentId:"inv",execute:async()=>({...state(),document:other})}),(e:unknown)=>e instanceof SalesDomainError&&e.code==="sales.input_invalid");
});

test("correlation falls back to requestId when caller did not provide one",async()=>{
 const events:SalesAuditEvent[]=[];const service=new SecuredSalesMutationService({authorization:{async require(){}},audit:{async record(e){events.push(e);}}});
 await service.execute({security:{actorId:"u"},mutation:mutation(),permission:salesPermissions.edit,action:"sales.document.edit",documentId:"inv",execute:async()=>state()});
 assert.equal(events[0]?.correlationId,"req");
});
