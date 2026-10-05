import type { DatabaseExecutor } from "@argin/database";

export interface SalesOperationalTrace {
  readonly salesDocumentId: string;
  readonly inventoryDocument: null | {
    readonly id: string;
    readonly type: string;
    readonly status: string;
    readonly number: string | null;
  };
  readonly movements: readonly {
    readonly movementId: string;
    readonly lineId: string;
    readonly productId: string;
    readonly quantityDelta: string;
    readonly businessDate: string;
  }[];
  readonly valuations: readonly {
    readonly valuationEntryId: string;
    readonly movementId: string;
    readonly method: string;
    readonly costState: string;
    readonly unitCost: string | null;
    readonly totalCost: number | null;
    readonly revision: number;
  }[];
}

interface InventoryDocumentRow {
  id: string;
  document_type: string;
  status: string;
  document_number: string | null;
}

interface StockMovementRow {
  movement_id: string;
  line_id: string;
  product_id: string;
  quantity_delta: string;
  business_date: string;
}

interface ValuationEntryRow {
  valuation_entry_id: string;
  movement_id: string;
  method: string;
  cost_state: string;
  unit_cost: string | null;
  total_cost: number | null;
  revision: number;
}

export class SqliteSalesOperationalTraceReader {
  constructor(private readonly database: DatabaseExecutor) {}

  async read(companyId: string, salesDocumentId: string): Promise<SalesOperationalTrace> {
    // Fetch up to two documents so an ambiguous source link cannot be silently accepted.
    const inventoryDocuments = await this.database.query<InventoryDocumentRow>(
      "SELECT id,document_type,status,document_number FROM inventory_documents WHERE company_id=? AND source_system='sales' AND source_document_id=? AND deleted_at IS NULL ORDER BY created_at,id LIMIT 2",
      [companyId, salesDocumentId],
    );
    if (inventoryDocuments.length > 1) {
      throw new Error("sales.operational_trace.inventory_document_ambiguous");
    }

    const inventoryDocument = inventoryDocuments[0];
    if (!inventoryDocument) {
      return Object.freeze({
        salesDocumentId,
        inventoryDocument: null,
        movements: Object.freeze([]),
        valuations: Object.freeze([]),
      });
    }

    const movementRows = await this.database.query<StockMovementRow>(
      "SELECT movement_id,line_id,product_id,quantity_delta,business_date FROM inventory_stock_movements WHERE company_id=? AND document_id=? ORDER BY business_order,movement_id",
      [companyId, inventoryDocument.id],
    );

    const movementIds = movementRows.map(row => row.movement_id);
    let valuationRows: ValuationEntryRow[] = [];
    if (movementIds.length > 0) {
      const placeholders = movementIds.map(() => "?").join(",");
      valuationRows = await this.database.query<ValuationEntryRow>(
        "SELECT valuation_entry_id,movement_id,method,cost_state,unit_cost,total_cost,revision FROM inventory_valuation_entries WHERE company_id=? AND movement_id IN ("
          + placeholders
          + ") ORDER BY business_order,valuation_entry_id",
        [companyId, ...movementIds],
      );
    }

    return Object.freeze({
      salesDocumentId,
      inventoryDocument: Object.freeze({
        id: inventoryDocument.id,
        type: inventoryDocument.document_type,
        status: inventoryDocument.status,
        number: inventoryDocument.document_number,
      }),
      movements: Object.freeze(movementRows.map(row => Object.freeze({
        movementId: row.movement_id,
        lineId: row.line_id,
        productId: row.product_id,
        quantityDelta: row.quantity_delta,
        businessDate: row.business_date,
      }))),
      valuations: Object.freeze(valuationRows.map(row => Object.freeze({
        valuationEntryId: row.valuation_entry_id,
        movementId: row.movement_id,
        method: row.method,
        costState: row.cost_state,
        unitCost: row.unit_cost,
        totalCost: row.total_cost,
        revision: row.revision,
      }))),
    });
  }
}
