import type { DatabaseSession } from "@argin/database";
import type { SalesDocumentType } from "@argin/sales";

export const SALES_NUMBER_SERIES_TYPES:Readonly<Record<SalesDocumentType,string>>=Object.freeze({
 "sales-order":"sales.order","sales-invoice":"sales.invoice","sales-return":"sales.return","sales-correction":"sales.correction",
});
const PREFIX:Readonly<Record<SalesDocumentType,string>>=Object.freeze({
 "sales-order":"SO-","sales-invoice":"SI-","sales-return":"SR-","sales-correction":"SC-",
});
export async function ensureSalesNumberSeries(session:DatabaseSession,input:{companyId:string;branchId:string;fiscalYearId:string;documentType:SalesDocumentType}):Promise<void>{
 const entityType=SALES_NUMBER_SERIES_TYPES[input.documentType],timestamp=new Date().toISOString();
 const code=[entityType,input.branchId,input.fiscalYearId].join(":");
 await session.execute(
  `INSERT INTO number_series
   (id,company_id,branch_id,fiscal_year_id,entity_type,code,prefix,suffix,next_number,padding_length,reset_policy,is_active,version,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,'',1,6,'never',1,1,?,?
   WHERE NOT EXISTS (
    SELECT 1 FROM number_series WHERE company_id=? AND entity_type=? AND branch_id=? AND fiscal_year_id=?
   )`,
  [crypto.randomUUID(),input.companyId,input.branchId,input.fiscalYearId,entityType,code,PREFIX[input.documentType],timestamp,timestamp,input.companyId,entityType,input.branchId,input.fiscalYearId],
 );
}
