import type { SalesPersistedDocument } from "./sales-persistence.ts";
import type { SalesMutationContext } from "./sales-replay-safety.ts";
import {
  salesCorrelationId,type SalesAuditAction,type SalesAuditSink,type SalesAuthorizationPolicy,
  type SalesPermission,type SalesSecurityContext,
} from "./contracts/sales-security.ts";
import { SalesDomainError } from "../domain/sales-domain-errors.ts";

export interface SecuredSalesMutationDependencies {
 readonly authorization:SalesAuthorizationPolicy;readonly audit:SalesAuditSink;
}
export interface SalesSecuredMutationInput {
 readonly security:SalesSecurityContext;readonly mutation:SalesMutationContext;readonly permission:SalesPermission;
 readonly action:SalesAuditAction;readonly documentId:string|null;readonly reason?:string|null;
 readonly before?:SalesPersistedDocument|null;
 readonly execute:()=>Promise<SalesPersistedDocument>;
 readonly metadata?:Readonly<Record<string,string|number|boolean|null>>;
}

const text=(value:string,field:string):string=>{
 if(typeof value!=="string"||!value.trim())throw new SalesDomainError("sales.input_invalid",field);return value.trim();
};

export class SecuredSalesMutationService {
 constructor(private readonly deps:SecuredSalesMutationDependencies){}
 async execute(input:SalesSecuredMutationInput):Promise<SalesPersistedDocument>{
  const actorId=text(input.security.actorId,"security.actorId");
  const requestId=text(input.mutation.requestId,"mutation.requestId");
  const operationId=text(input.mutation.operationId,"mutation.operationId");
  const correlationId=salesCorrelationId(input.security,requestId);
  try{
   await this.deps.authorization.require(Object.freeze({actorId,companyId:input.mutation.companyId,branchId:input.mutation.branchId,requestId,operationId,correlationId}),input.permission);
  }catch(error){
   if(error instanceof SalesDomainError)throw error;
   throw new SalesDomainError("sales.unauthorized","permission");
  }
  const before=input.before??null;
  if(before&&(before.document.scope.companyId!==input.mutation.companyId||before.document.scope.branchId!==input.mutation.branchId||before.document.documentId!==input.documentId)){
   throw new SalesDomainError("sales.input_invalid","documentScope");
  }
  const after=await input.execute();
  if(after.document.scope.companyId!==input.mutation.companyId||after.document.scope.branchId!==input.mutation.branchId||(input.documentId!==null&&after.document.documentId!==input.documentId)){
   throw new SalesDomainError("sales.input_invalid","resultScope");
  }
  await this.deps.audit.record(Object.freeze({
   action:input.action,actorId,companyId:after.document.scope.companyId,branchId:after.document.scope.branchId,
   documentId:after.document.documentId,requestId,operationId,correlationId,occurredAt:input.mutation.occurredAt,
   beforeStatus:before?.lifecycle.status??null,afterStatus:after.lifecycle.status,
   beforeVersion:before?.version??null,afterVersion:after.version,reason:input.reason?.trim()||null,
   metadata:Object.freeze({operation:input.mutation.operation,payloadFingerprint:input.mutation.payloadFingerprint,...input.metadata}),
  }));
  return after;
 }
}
