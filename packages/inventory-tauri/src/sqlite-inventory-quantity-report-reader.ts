import type { DatabaseExecutor, DatabaseValue } from "@argin/database";
import {
  INVENTORY_APPLICATION_ERROR_CODES,
  InventoryApplicationError,
  addInventoryStockQuantities,
  createInventoryStockKey,
  normalizeInventoryQuantity,
  rehydrateInventoryStockMovement,
  type InventoryKardexCursorPayload,
  type InventoryKardexReport,
  type InventoryKardexReportEntry,
  type InventoryKardexReportQuery,
  type InventoryQuantityBalanceReport,
  type InventoryQuantityBalanceReportQuery,
  type InventoryQuantityReportReader,
  type InventoryStockKey,
  type InventoryStockMovementSnapshot,
} from "@argin/inventory";

const MAX_LIMIT = 500;
const CHUNK = 500;

interface MovementRow {
  movement_id: string; company_id: string; document_id: string; line_id: string;
  transfer_id: string | null; reversal_of_movement_id: string | null;
  product_id: string; warehouse_id: string; zone_id: string | null; location_id: string | null;
  business_date: string; business_order: number; recorded_at: string; quantity_delta: string;
  document_number: string | null; document_type: "receipt" | "issue" | "opening" | "transfer" | "adjustment";
  line_position: number; source_system: string | null; source_document_type: string | null;
  source_document_id: string | null; source_line_id: string | null;
}
interface BalanceRow {
  stock_key: string; company_id: string; product_id: string; warehouse_id: string;
  zone_id: string | null; location_id: string | null; quantity: string; last_movement_id: string | null;
  product_code: string; product_title: string; warehouse_code: string; warehouse_title: string;
  zone_code: string | null; zone_title: string | null; location_code: string | null; location_title: string | null;
}

function invalid(field: string): never { throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.invalidRequest, field); }
function assertLimit(limit: number): void { if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) invalid("limit"); }
function assertDate(value: string | null | undefined, field: string): void {
  if (value == null) return;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) invalid(field);
}
function encodeCursor(payload: InventoryKardexCursorPayload): string { return encodeURIComponent(JSON.stringify(payload)); }
function decodeCursor(value: string | null | undefined): InventoryKardexCursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<InventoryKardexCursorPayload>;
    if (typeof parsed.businessDate !== "string" || !Number.isSafeInteger(parsed.businessOrder) ||
      typeof parsed.documentId !== "string" || typeof parsed.lineId !== "string" || typeof parsed.movementId !== "string") invalid("cursor");
    return Object.freeze({ businessDate: parsed.businessDate, businessOrder: parsed.businessOrder as number,
      documentId: parsed.documentId, lineId: parsed.lineId, movementId: parsed.movementId });
  } catch { return invalid("cursor"); }
}
const cursorFromRow = (row: { business_date: string; business_order: number; document_id: string; line_id: string; movement_id: string }): InventoryKardexCursorPayload =>
  Object.freeze({ businessDate: row.business_date, businessOrder: row.business_order, documentId: row.document_id, lineId: row.line_id, movementId: row.movement_id });
const stockKeyClauses = (key: InventoryStockKey): { sql: string; params: DatabaseValue[] } => ({
  sql: "m.company_id=? AND m.product_id=? AND m.warehouse_id=? AND COALESCE(m.zone_id,'')=COALESCE(?,'') AND COALESCE(m.location_id,'')=COALESCE(?,'')",
  params: [key.companyId, key.productId, key.warehouseId, key.zoneId, key.locationId],
});
function chronologyAfter(cursor: InventoryKardexCursorPayload): { sql: string; params: DatabaseValue[] } {
  return { sql: `(m.business_date > ? OR (m.business_date = ? AND m.business_order > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id > ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id = ? AND m.movement_id > ?))`,
    params: [cursor.businessDate,cursor.businessDate,cursor.businessOrder,cursor.businessDate,cursor.businessOrder,cursor.documentId,
      cursor.businessDate,cursor.businessOrder,cursor.documentId,cursor.lineId,cursor.businessDate,cursor.businessOrder,cursor.documentId,cursor.lineId,cursor.movementId] };
}
/** Prefix through the cursor itself, because the next page starts strictly after that fact. */
function chronologyThrough(cursor: InventoryKardexCursorPayload): { sql: string; params: DatabaseValue[] } {
  return { sql: `(m.business_date < ? OR (m.business_date = ? AND m.business_order < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id < ?) OR
    (m.business_date = ? AND m.business_order = ? AND m.document_id = ? AND m.line_id = ? AND m.movement_id <= ?))`,
    params: [cursor.businessDate,cursor.businessDate,cursor.businessOrder,cursor.businessDate,cursor.businessOrder,cursor.documentId,
      cursor.businessDate,cursor.businessOrder,cursor.documentId,cursor.lineId,cursor.businessDate,cursor.businessOrder,cursor.documentId,cursor.lineId,cursor.movementId] };
}
function movement(row: MovementRow): InventoryStockMovementSnapshot {
  return rehydrateInventoryStockMovement({ movementId: row.movement_id, companyId: row.company_id, documentId: row.document_id,
    lineId: row.line_id, businessDate: row.business_date, businessOrder: row.business_order, recordedAt: row.recorded_at,
    stockKey: { companyId: row.company_id, productId: row.product_id, warehouseId: row.warehouse_id, zoneId: row.zone_id, locationId: row.location_id },
    transferId: row.transfer_id, reversalOfMovementId: row.reversal_of_movement_id, quantityDelta: row.quantity_delta });
}
const positiveMagnitude = (value: string): string => {
  const normalized = normalizeInventoryQuantity(value); return normalized.startsWith("-") ? normalized.slice(1) : normalized;
};

export class SqliteInventoryQuantityReportReader implements InventoryQuantityReportReader {
  constructor(private readonly database: DatabaseExecutor) {}
  private normalizeKey(query: InventoryKardexReportQuery): InventoryStockKey {
    if (query.companyId !== query.stockKey.companyId) invalid("companyId");
    return createInventoryStockKey({ companyId: query.companyId, productId: query.stockKey.productId, warehouse: query.stockKey });
  }
  /** Exact opening before this page. Every SQLite prefix read is bounded to CHUNK facts. */
  private async openingQuantity(query: InventoryKardexReportQuery, pageCursor: InventoryKardexCursorPayload | null): Promise<string> {
    const base = stockKeyClauses(this.normalizeKey(query)); let total="0"; let chunkCursor:InventoryKardexCursorPayload|null=null;
    while(true){
      const clauses=[base.sql]; const params:DatabaseValue[]=[...base.params];
      if(chunkCursor){const after=chronologyAfter(chunkCursor);clauses.push(after.sql);params.push(...after.params);}
      if(pageCursor){const through=chronologyThrough(pageCursor);clauses.push(through.sql);params.push(...through.params);}
      else if(query.businessDateFrom){clauses.push("m.business_date < ?");params.push(query.businessDateFrom);}
      else return "0";
      const rows=await this.database.query<{business_date:string;business_order:number;document_id:string;line_id:string;movement_id:string;quantity_delta:string}>(
        `SELECT m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id,m.quantity_delta FROM inventory_all_stock_movements m
         WHERE ${clauses.join(" AND ")} ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id LIMIT ?`,[...params,CHUNK]);
      for(const row of rows) total=addInventoryStockQuantities(total,row.quantity_delta);
      if(rows.length<CHUNK) break; chunkCursor=cursorFromRow(rows[rows.length-1]!);
    }
    return total;
  }
  async readKardex(query: InventoryKardexReportQuery): Promise<InventoryKardexReport> {
    assertLimit(query.limit);assertDate(query.businessDateFrom,"businessDateFrom");assertDate(query.businessDateTo,"businessDateTo");
    if(query.businessDateFrom&&query.businessDateTo&&query.businessDateFrom>query.businessDateTo) invalid("businessDateFrom");
    const key=this.normalizeKey(query),cursor=decodeCursor(query.cursor),base=stockKeyClauses(key),clauses=[base.sql],params:DatabaseValue[]=[...base.params];
    if(query.businessDateFrom){clauses.push("m.business_date>=?");params.push(query.businessDateFrom);} if(query.businessDateTo){clauses.push("m.business_date<=?");params.push(query.businessDateTo);}
    if(cursor){const after=chronologyAfter(cursor);clauses.push(after.sql);params.push(...after.params);}
    const rows=await this.database.query<MovementRow>(`SELECT m.*,d.document_number,d.document_type,l.position AS line_position,
      COALESCE(l.source_system,d.source_system) AS source_system,COALESCE(l.source_document_type,d.source_document_type) AS source_document_type,
      COALESCE(l.source_document_id,d.source_document_id) AS source_document_id,COALESCE(l.source_line_id,d.source_line_id) AS source_line_id
      FROM inventory_all_stock_movements m JOIN inventory_documents d ON d.company_id=m.company_id AND d.id=m.document_id
      JOIN inventory_document_lines l ON l.company_id=m.company_id AND l.document_id=m.document_id AND l.id=m.line_id
      WHERE ${clauses.join(" AND ")} ORDER BY m.business_date,m.business_order,m.document_id,m.line_id,m.movement_id LIMIT ?`,[...params,query.limit+1]);
    const hasMore=rows.length>query.limit,pageRows=rows.slice(0,query.limit),openingQuantity=await this.openingQuantity(query,cursor);let running=openingQuantity,incoming="0",outgoing="0";
    const entries:InventoryKardexReportEntry[]=pageRows.map((row)=>{const fact=movement(row);running=addInventoryStockQuantities(running,fact.quantityDelta);
      if(fact.quantityDelta.startsWith("-"))outgoing=addInventoryStockQuantities(outgoing,positiveMagnitude(fact.quantityDelta));else incoming=addInventoryStockQuantities(incoming,fact.quantityDelta);
      return Object.freeze({movement:fact,incomingQuantity:fact.quantityDelta.startsWith("-")?"0":fact.quantityDelta,outgoingQuantity:fact.quantityDelta.startsWith("-")?positiveMagnitude(fact.quantityDelta):"0",runningQuantity:running,
        source:Object.freeze({documentId:row.document_id,documentNumber:row.document_number,documentType:row.document_type,lineId:row.line_id,linePosition:row.line_position,
          sourceSystem:row.source_system,sourceDocumentType:row.source_document_type,sourceDocumentId:row.source_document_id,sourceLineId:row.source_line_id})});});
    const last=pageRows.at(-1);return Object.freeze({stockKey:key,openingQuantity,incomingQuantity:incoming,outgoingQuantity:outgoing,closingQuantity:running,entries:Object.freeze(entries),
      nextCursor:hasMore&&last?encodeCursor(cursorFromRow(last)):null});
  }
  async readBalances(query: InventoryQuantityBalanceReportQuery): Promise<InventoryQuantityBalanceReport> {
    assertLimit(query.limit);const clauses=["b.company_id=?"],params:DatabaseValue[]=[query.companyId];
    const add=(sql:string,value:string|null|undefined)=>{if(value!=null&&value!==""){clauses.push(sql);params.push(value);}};
    add("b.product_id=?",query.productId);add("b.warehouse_id=?",query.warehouseId);add("b.zone_id=?",query.zoneId);add("b.location_id=?",query.locationId);
    if(!query.includeZero)clauses.push("b.quantity NOT IN ('0','0.0','-0','-0.0')");if(query.cursor){clauses.push("b.stock_key > ?");params.push(query.cursor);}
    const rows=await this.database.query<BalanceRow>(`SELECT b.stock_key,b.company_id,b.product_id,b.warehouse_id,b.zone_id,b.location_id,b.quantity,b.last_movement_id,
      p.code AS product_code,p.title AS product_title,w.code AS warehouse_code,w.title AS warehouse_title,z.code AS zone_code,z.title AS zone_title,l.code AS location_code,l.title AS location_title
      FROM inventory_stock_balances b JOIN products p ON p.company_id=b.company_id AND p.id=b.product_id JOIN warehouses w ON w.company_id=b.company_id AND w.id=b.warehouse_id
      LEFT JOIN warehouse_zones z ON z.company_id=b.company_id AND z.warehouse_id=b.warehouse_id AND z.id=b.zone_id
      LEFT JOIN warehouse_locations l ON l.company_id=b.company_id AND l.warehouse_id=b.warehouse_id AND l.zone_id=b.zone_id AND l.id=b.location_id
      WHERE ${clauses.join(" AND ")} ORDER BY b.stock_key LIMIT ?`,[...params,query.limit+1]);
    const hasMore=rows.length>query.limit,pageRows=rows.slice(0,query.limit);return Object.freeze({items:Object.freeze(pageRows.map((row)=>Object.freeze({
      stockKey:Object.freeze({companyId:row.company_id,productId:row.product_id,warehouseId:row.warehouse_id,zoneId:row.zone_id,locationId:row.location_id}),quantity:normalizeInventoryQuantity(row.quantity),
      productCode:row.product_code,productTitle:row.product_title,warehouseCode:row.warehouse_code,warehouseTitle:row.warehouse_title,zoneCode:row.zone_code,zoneTitle:row.zone_title,
      locationCode:row.location_code,locationTitle:row.location_title,lastMovementId:row.last_movement_id}))),nextCursor:hasMore&&pageRows.length?pageRows[pageRows.length-1]!.stock_key:null});
  }
}
