import type { DatabaseExecutor } from "@argin/database";

export interface SalesOperationalTrace {
  readonly salesDocumentId:string;
  readonly inventoryDocument: null | { readonly id:string;readonly type:string;readonly status:string;readonly number:string|null };
  readonly movements: readonly { readonly movementId:string;readonly lineId:string;readonly productId:string;readonly quantityDelta:string;readonly businessDate:string }[];
  readonly valuations: readonly { readonly valuationEntryId:string;readonly movementId:string;readonly method:string;readonly costState:string;readonly unitCost:string|null;readonly totalCost:number|null;readonly revision:number }[];
}
export class SqliteSalesOperationalTraceReader {
 constructor(private readonly database:DatabaseExecutor){}
 async read(companyId:string,salesDocumentId:string):Promise<SalesOperationalTrace>{
  const docs=await this.database.query<{id:string;document_type:string;status:string;document_number:string|null}>(
   "SELECT id,document_type,status,document_number FROM inventory_documents WHERE company_id=? AND source_system='sales' AND source_document_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 2",
   [companyId,salesDocumentId],
  );
  if(docs.length>1) throw new Error("sales.operational_trace.inventory_document_ambiguous");
  const d=docs[0];
  if(!d)return Object.freeze({salesDocumentId,inventoryDocument:null,movements:Object.freeze([]),valuations:Object.freeze([])});
  const movements=await this.database.query<{movement_id:string;line_id:string;product_id:string;quantity_delta:string;business_date:string}>(
   "SELECT movement_id,line_id,product_id,quantity_delta,business_date FROM inventory_stock_movements WHERE company_id=? AND document_id=? ORDER BY business_order,movement_id",
   [companyId,d.id],
  );
  const ids=movements.map(x=>x.movement_id);
  const valuations=ids.length?await this.database.query<{valuation_entry_id:string;movement_id:string;method:string;cost_state:string;unit_cost:string|null;total_cost:number|null;revision:number}>(
   "SELECT valuation_entry_id,movement_id,method,cost_state,unit_cost,total_cost,revision FROM inventory_valuation_entries WHERE company_id=? AND movement_id IN ("+ids.map(()=>"?").join(",")+") ORDER BY business_order,valuation_entry_id",
   [companyId,...ids],
  ):[];
  return Object.freeze({
   salesDocumentId,
   inventoryDocument:Object.freeze({id:d.id,type:d.document_type,status:d.status,number:d.document_number}),
   movements:Object.freeze(movements.map(x=>Object.freeze({movementId:x.movement_id,lineId:x.line_id,productId:x.product_id,quantityDelta:x.quantity_delta,businessDate:x.business_date}))),
   valuations:Object.freeze(valuations.map(x=>Object.freeze({valuationEntryId:x.valuation_entry_id,movementId:x.movement_id,method:x.method,costState:x.cost_state,unitCost:x.unit_cost,totalCost:x.total_cost,revision:x.revision}))),
  });
 }
}
