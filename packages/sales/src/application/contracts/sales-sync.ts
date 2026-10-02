import { createSalesDocument, type SalesDocumentSnapshot } from "../../domain/sales-document.ts";
import type { SalesPersistedDocument } from "../sales-persistence.ts";
import type { SalesMutationContext } from "../sales-replay-safety.ts";

export const SALES_SYNC_CONTRACT_VERSION = 1 as const;
export const SALES_SYNC_CHANGE_KINDS = Object.freeze(["upsert", "tombstone"] as const);

export interface SalesSyncOrigin { readonly sourceSystem:string; readonly sourceInstanceId:string|null; }
export interface SalesSyncExternalReference { readonly sourceSystem:string; readonly externalId:string; }
export type SalesSyncDependency =
  | Readonly<{entity:"branch"|"fiscal-year"|"party"|"product"|"sales-document"|"sales-line";id:string}>;

interface MetadataInput {
  readonly mutation: SalesMutationContext;
  readonly changedAt:string;
  readonly origin:SalesSyncOrigin;
  readonly serverRevision?:number|null;
  readonly externalReferences?:readonly SalesSyncExternalReference[];
}
interface Metadata {
  readonly contractVersion:typeof SALES_SYNC_CONTRACT_VERSION;
  readonly requestId:string; readonly operationId:string; readonly operation:string; readonly payloadFingerprint:string;
  readonly actorUserId:string; readonly changedAt:string; readonly origin:Readonly<SalesSyncOrigin>;
  readonly serverRevision:number|null; readonly externalReferences:readonly Readonly<SalesSyncExternalReference>[];
}
export interface SalesSyncDocumentReference {
  readonly companyId:string; readonly branchId:string; readonly documentId:string; readonly documentNumber:string|null;
}
interface Base extends Metadata {
  readonly entity:"sales-document"; readonly reference:Readonly<SalesSyncDocumentReference>;
  readonly localVersion:number; readonly dependencies:readonly SalesSyncDependency[];
}
export interface SalesDocumentSyncUpsertEnvelope extends Base {
  readonly changeKind:"upsert"; readonly deletedAt:null;
  readonly lifecycleStatus:SalesPersistedDocument["lifecycle"]["status"];
  readonly snapshot:Readonly<SalesDocumentSnapshot>;
}
export interface SalesDocumentSyncTombstoneEnvelope extends Base {
  readonly changeKind:"tombstone"; readonly deletedAt:string; readonly lifecycleStatus:"draft"; readonly snapshot:null;
}
export type SalesDocumentSyncEnvelope=SalesDocumentSyncUpsertEnvelope|SalesDocumentSyncTombstoneEnvelope;

export class SalesSyncContractError extends Error {
  constructor(public readonly code:
    |"sales.sync.text-required"|"sales.sync.timestamp-invalid"|"sales.sync.version-invalid"
    |"sales.sync.reference-invalid"|"sales.sync.snapshot-mismatch"|"sales.sync.metadata-mismatch"
    |"sales.sync.tombstone-invalid"|"sales.sync.external-reference-invalid"|"sales.sync.external-reference-duplicate"
  ){super(code);this.name="SalesSyncContractError";}
}
const fail=(code:SalesSyncContractError["code"]):never=>{throw new SalesSyncContractError(code);};
const text=(v:string):string=>typeof v==="string"&&v.trim()?v.trim():fail("sales.sync.text-required");
const timestamp=(v:string):string=>{const n=Date.parse(v);if(typeof v!=="string"||!v.trim()||!Number.isFinite(n))return fail("sales.sync.timestamp-invalid");return new Date(n).toISOString();};
const positive=(v:number):number=>Number.isSafeInteger(v)&&v>=1?v:fail("sales.sync.version-invalid");
const metadata=(input:MetadataInput):Metadata=>{
  const m=input.mutation;
  if(!m||typeof m!=="object")return fail("sales.sync.metadata-mismatch");
  const changedAt=timestamp(input.changedAt);
  if(Date.parse(m.occurredAt)>Date.parse(changedAt))return fail("sales.sync.timestamp-invalid");
  const revision=input.serverRevision??null;if(revision!==null)positive(revision);
  const refs=input.externalReferences??[];if(!Array.isArray(refs))return fail("sales.sync.external-reference-invalid");
  const seen=new Set<string>();const normalized=refs.map(r=>{if(!r||typeof r!=="object")return fail("sales.sync.external-reference-invalid");const x=Object.freeze({sourceSystem:text(r.sourceSystem),externalId:text(r.externalId)});const key=x.sourceSystem.toUpperCase()+"\0"+x.externalId;if(seen.has(key))return fail("sales.sync.external-reference-duplicate");seen.add(key);return x;});
  return Object.freeze({contractVersion:SALES_SYNC_CONTRACT_VERSION,requestId:text(m.requestId),operationId:text(m.operationId),operation:text(m.operation),payloadFingerprint:text(m.payloadFingerprint),actorUserId:text(m.actorUserId),changedAt,origin:Object.freeze({sourceSystem:text(input.origin.sourceSystem),sourceInstanceId:input.origin.sourceInstanceId==null?null:text(input.origin.sourceInstanceId)}),serverRevision:revision,externalReferences:Object.freeze(normalized)});
};
const reference=(r:SalesSyncDocumentReference)=>{if(!r||typeof r!=="object")return fail("sales.sync.reference-invalid");return Object.freeze({companyId:text(r.companyId),branchId:text(r.branchId),documentId:text(r.documentId),documentNumber:r.documentNumber==null?null:text(r.documentNumber)});};
const deps=(snapshot:SalesDocumentSnapshot):readonly SalesSyncDependency[]=>{
  const values:SalesSyncDependency[]=[
    {entity:"branch",id:snapshot.scope.branchId},{entity:"fiscal-year",id:snapshot.scope.fiscalYearId},{entity:"party",id:snapshot.customer.partyId},
    ...snapshot.lines.map(l=>({entity:"product" as const,id:l.item.productId})),
  ];
  if(snapshot.relatedDocumentReference)values.push({entity:"sales-document",id:snapshot.relatedDocumentReference.documentId});
  for(const line of snapshot.lines)if(line.sourceReference?.sourceSystem==="sales"){values.push({entity:"sales-document",id:line.sourceReference.sourceDocumentId});if(line.sourceReference.sourceLineId)values.push({entity:"sales-line",id:line.sourceReference.sourceLineId});}
  const seen=new Set<string>();return Object.freeze(values.filter(x=>{const k=x.entity+"\0"+x.id;if(seen.has(k))return false;seen.add(k);return true;}).map(x=>Object.freeze(x)));
};
const rehydrate=(s:SalesDocumentSnapshot)=>createSalesDocument({documentId:s.documentId,documentType:s.documentType,companyId:s.scope.companyId,branchId:s.scope.branchId,fiscalYearId:s.scope.fiscalYearId,customer:s.customer,documentNumber:s.documentNumber,businessDate:s.businessDate,description:s.description,sourceReference:s.sourceReference,relatedDocumentReference:s.relatedDocumentReference,lines:s.lines.map(l=>({lineId:l.lineId,position:l.position,lineKind:l.lineKind,productId:l.item.productId,itemType:l.item.itemType,description:l.description,sourceReference:l.sourceReference,commercialTerms:l.commercialTerms}))});

export function createSalesDocumentSyncUpsertEnvelope(input:MetadataInput&{readonly state:SalesPersistedDocument;readonly reference:SalesSyncDocumentReference}):Readonly<SalesDocumentSyncUpsertEnvelope>{
  const meta=metadata(input),ref=reference(input.reference),state=input.state;let snapshot:SalesDocumentSnapshot;
  try{snapshot=rehydrate(state.document);}catch{return fail("sales.sync.snapshot-mismatch");}
  if(snapshot.scope.companyId!==ref.companyId||snapshot.scope.branchId!==ref.branchId||snapshot.documentId!==ref.documentId||snapshot.documentNumber!==ref.documentNumber||input.mutation.companyId!==ref.companyId||input.mutation.branchId!==ref.branchId)return fail("sales.sync.snapshot-mismatch");
  if(Date.parse(state.updatedAt)>Date.parse(meta.changedAt))return fail("sales.sync.timestamp-invalid");
  return Object.freeze({...meta,entity:"sales-document",changeKind:"upsert",reference:ref,localVersion:positive(state.version),dependencies:deps(snapshot),deletedAt:null,lifecycleStatus:state.lifecycle.status,snapshot});
}

export function createSalesDocumentSyncTombstoneEnvelope(input:MetadataInput&{readonly reference:SalesSyncDocumentReference;readonly localVersion:number;readonly lastKnownStatus:string;readonly deletedAt:string}):Readonly<SalesDocumentSyncTombstoneEnvelope>{
  const meta=metadata(input),ref=reference(input.reference),deletedAt=timestamp(input.deletedAt);
  if(input.lastKnownStatus!=="draft"||Date.parse(deletedAt)>Date.parse(meta.changedAt)||input.mutation.companyId!==ref.companyId||input.mutation.branchId!==ref.branchId)return fail("sales.sync.tombstone-invalid");
  return Object.freeze({...meta,entity:"sales-document",changeKind:"tombstone",reference:ref,localVersion:positive(input.localVersion),dependencies:Object.freeze([{entity:"branch",id:ref.branchId}] as const),deletedAt,lifecycleStatus:"draft",snapshot:null});
}
