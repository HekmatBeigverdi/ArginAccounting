import type { DatabaseSession } from "@argin/database";
import {
  SalesDomainError,
  createSalesDocument,
  createSalesLifecycle,
  transitionSalesLifecycle,
  type SalesDocumentRepository,
  type SalesDocumentSnapshot,
  type SalesIdempotencyReader,
  type SalesIdempotencyRecord,
  type SalesIdempotencyWriter,
  type SalesLifecycleState,
  type SalesPersistedDocument,
} from "@argin/sales";

type DocumentRow = {
  id: string; company_id: string; document_json: string; version: number;
  created_at: string; updated_at: string;
};
type TransitionRow = {
  transition_id: string; action: "submit"|"approve"|"reject"|"finalize"|"cancel";
  actor_id: string; occurred_at: string; reason: string|null;
};
type IdempotencyRow = {
  company_id:string; request_id:string; operation_id:string; operation:string; payload_fingerprint:string;
  outcome_kind:SalesIdempotencyRecord["outcomeKind"]; outcome_id:string; outcome_version:number|null;
  outcome_status:string|null; result_json:string; recorded_at:string;
};

const fail = (code: ConstructorParameters<typeof SalesDomainError>[0], field: string): never => {
  throw new SalesDomainError(code, field);
};
const parse = <T>(value:string, field:string):T => {
  try { return JSON.parse(value) as T; } catch { return fail("sales.input_invalid", field); }
};
const rehydrateDocument = (snapshot: SalesDocumentSnapshot): SalesDocumentSnapshot => createSalesDocument({
  documentId:snapshot.documentId, documentType:snapshot.documentType,
  companyId:snapshot.scope.companyId, branchId:snapshot.scope.branchId, fiscalYearId:snapshot.scope.fiscalYearId,
  customer:snapshot.customer, documentNumber:snapshot.documentNumber, businessDate:snapshot.businessDate,
  description:snapshot.description, sourceReference:snapshot.sourceReference,
  relatedDocumentReference:snapshot.relatedDocumentReference,
  lines:snapshot.lines.map(line=>({
    lineId:line.lineId, position:line.position, lineKind:line.lineKind, productId:line.item.productId,
    itemType:line.item.itemType, description:line.description, sourceReference:line.sourceReference,
    commercialTerms:line.commercialTerms,
  })),
});
const hydrateLifecycle = async(db:DatabaseSession, document:SalesDocumentSnapshot):Promise<SalesLifecycleState> => {
  let state=createSalesLifecycle(document.documentId,document.documentType);
  const rows=await db.query<TransitionRow>(
    "SELECT transition_id,action,actor_id,occurred_at,reason FROM sales_document_lifecycle WHERE company_id=? AND document_id=? ORDER BY sequence",
    [document.scope.companyId,document.documentId],
  );
  for(const row of rows) state=transitionSalesLifecycle(state,{
    transitionId:row.transition_id, action:row.action, actorId:row.actor_id, occurredAt:row.occurred_at, reason:row.reason,
  });
  return state;
};
const appendLifecycle=async(db:DatabaseSession,state:SalesPersistedDocument):Promise<void>=>{
  const row=await db.queryOne<{count:number}>("SELECT COUNT(*) AS count FROM sales_document_lifecycle WHERE company_id=? AND document_id=?",[state.document.scope.companyId,state.document.documentId]);
  const persisted=Number(row?.count??0);
  for(let i=persisted;i<state.lifecycle.transitions.length;i+=1){
    const t=state.lifecycle.transitions[i]; if(!t) continue;
    await db.execute(
      "INSERT INTO sales_document_lifecycle (company_id,document_id,sequence,transition_id,from_status,to_status,action,actor_id,occurred_at,reason) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [state.document.scope.companyId,state.document.documentId,i+1,t.transitionId,t.fromStatus,t.toStatus,t.action,t.actorId,t.occurredAt,t.reason],
    );
  }
};

export class SqliteSalesDocumentRepository implements SalesDocumentRepository {
  constructor(private readonly db:DatabaseSession){}
  async findById(companyId:string,documentId:string):Promise<SalesPersistedDocument|null>{
    const row=await this.db.queryOne<DocumentRow>("SELECT id,company_id,document_json,version,created_at,updated_at FROM sales_documents WHERE company_id=? AND id=?",[companyId,documentId]);
    if(!row)return null;
    const document=rehydrateDocument(parse<SalesDocumentSnapshot>(row.document_json,"sales.document_json"));
    return Object.freeze({document,lifecycle:await hydrateLifecycle(this.db,document),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at});
  }
  async add(state:SalesPersistedDocument):Promise<void>{
    if(state.version!==1)return fail("sales.version_invalid","version");
    await this.db.execute(
      "INSERT INTO sales_documents (id,company_id,branch_id,fiscal_year_id,document_type,customer_id,document_number,business_date,status,document_json,version,created_at,updated_at,sync_origin,sync_changed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [state.document.documentId,state.document.scope.companyId,state.document.scope.branchId,state.document.scope.fiscalYearId,state.document.documentType,state.document.customer.partyId,state.document.documentNumber,state.document.businessDate,state.lifecycle.status,JSON.stringify(state.document),state.version,state.createdAt,state.updatedAt,"local",state.updatedAt],
    );
    await appendLifecycle(this.db,state);
  }
  async update(state:SalesPersistedDocument,expectedVersion:number):Promise<void>{
    if(state.version!==expectedVersion+1)return fail("sales.version_invalid","version");
    const result=await this.db.execute(
      "UPDATE sales_documents SET branch_id=?,fiscal_year_id=?,customer_id=?,document_number=?,business_date=?,status=?,document_json=?,version=?,updated_at=?,sync_changed_at=? WHERE company_id=? AND id=? AND version=?",
      [state.document.scope.branchId,state.document.scope.fiscalYearId,state.document.customer.partyId,state.document.documentNumber,state.document.businessDate,state.lifecycle.status,JSON.stringify(state.document),state.version,state.updatedAt,state.updatedAt,state.document.scope.companyId,state.document.documentId,expectedVersion],
    );
    if(result.rowsAffected!==1)return fail("sales.concurrency_conflict","expectedVersion");
    await appendLifecycle(this.db,state);
  }
}

const mapIdempotency=(r:IdempotencyRow):SalesIdempotencyRecord=>Object.freeze({
  companyId:r.company_id,requestId:r.request_id,operationId:r.operation_id,operation:r.operation,payloadFingerprint:r.payload_fingerprint,
  outcomeKind:r.outcome_kind,outcomeId:r.outcome_id,outcomeVersion:r.outcome_version,outcomeStatus:r.outcome_status,resultJson:r.result_json,recordedAt:r.recorded_at,
});
export class SqliteSalesIdempotencyRepository implements SalesIdempotencyReader,SalesIdempotencyWriter{
  constructor(private readonly db:DatabaseSession){}
  async findByRequestId(companyId:string,requestId:string){const r=await this.db.queryOne<IdempotencyRow>("SELECT * FROM sales_idempotency WHERE company_id=? AND request_id=?",[companyId,requestId]);return r?mapIdempotency(r):null;}
  async findByOperationId(companyId:string,operationId:string){const r=await this.db.queryOne<IdempotencyRow>("SELECT * FROM sales_idempotency WHERE company_id=? AND operation_id=?",[companyId,operationId]);return r?mapIdempotency(r):null;}
  async add(r:SalesIdempotencyRecord):Promise<void>{
    try{await this.db.execute("INSERT INTO sales_idempotency (company_id,request_id,operation_id,operation,payload_fingerprint,outcome_kind,outcome_id,outcome_version,outcome_status,result_json,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",[r.companyId,r.requestId,r.operationId,r.operation,r.payloadFingerprint,r.outcomeKind,r.outcomeId,r.outcomeVersion,r.outcomeStatus,r.resultJson,r.recordedAt]);}
    catch(error){const t=String(error).toLowerCase();if(t.includes("unique"))return fail("sales.idempotency_conflict","idempotency");throw error;}
  }
}
