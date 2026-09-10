import type { DatabaseExecutor } from "@argin/database";
import type {
  InventoryDocumentDetail,
  InventoryDocumentListItem,
  InventoryPage,
  ListInventoryDocumentsQuery,
} from "@argin/inventory";
import { normalizeInventoryPageRequest } from "@argin/inventory";
import {
  SqliteInventoryDocumentRepository,
  SqliteInventoryMovementRepository,
} from "./sqlite-inventory-repositories.ts";

type CountRow = { count: number | string };
export interface InventoryLineLocationTitles {
  readonly lineId: string;
  readonly productCode: string | null;
  readonly productTitle: string | null;
  readonly warehouseTitle: string | null;
  readonly zoneTitle: string | null;
  readonly locationTitle: string | null;
  readonly destinationWarehouseTitle: string | null;
  readonly destinationZoneTitle: string | null;
  readonly destinationLocationTitle: string | null;
}
type ListRow = {
  id: string;
  company_id: string;
  origin_branch_id: string | null;
  fiscal_year_id: string | null;
  fiscal_period_id: string | null;
  document_type: InventoryDocumentListItem["documentType"];
  status: InventoryDocumentListItem["status"];
  document_number: string | null;
  business_date: string;
  version: number;
  created_at: string;
  updated_at: string;
  line_count: number | string;
};

const sortColumn = Object.freeze({
  businessDate: "d.business_date",
  documentNumber: "d.document_number",
  documentType: "d.document_type",
  status: "d.status",
  createdAt: "d.created_at",
  updatedAt: "d.updated_at",
} as const);

export class SqliteInventoryWorkspaceReader {
  private readonly documents: SqliteInventoryDocumentRepository;
  private readonly movements: SqliteInventoryMovementRepository;

  constructor(private readonly database: DatabaseExecutor) {
    this.documents = new SqliteInventoryDocumentRepository(database);
    this.movements = new SqliteInventoryMovementRepository(database);
  }

  async listDocuments(
    query: ListInventoryDocumentsQuery,
  ): Promise<InventoryPage<InventoryDocumentListItem>> {
    const page = normalizeInventoryPageRequest(query.page);
    const clauses = ["d.company_id=?", "d.deleted_at IS NULL"];
    const params: Array<string | number | null> = [query.filter.companyId];
    const add = (condition: string, value: string | null | undefined) => {
      if (value === undefined) return;
      if (value === null) clauses.push(condition.replace("=?", " IS NULL"));
      else {
        clauses.push(condition);
        params.push(value);
      }
    };
    add("d.origin_branch_id=?", query.filter.branchId);
    add("d.fiscal_year_id=?", query.filter.fiscalYearId);
    add("d.fiscal_period_id=?", query.filter.fiscalPeriodId);
    if (query.filter.documentTypes?.length) {
      clauses.push(
        `d.document_type IN (${query.filter.documentTypes.map(() => "?").join(",")})`,
      );
      params.push(...query.filter.documentTypes);
    }
    if (query.filter.statuses?.length) {
      clauses.push(
        `d.status IN (${query.filter.statuses.map(() => "?").join(",")})`,
      );
      params.push(...query.filter.statuses);
    }
    if (query.filter.businessDateFrom) {
      clauses.push("d.business_date>=?");
      params.push(query.filter.businessDateFrom);
    }
    if (query.filter.businessDateTo) {
      clauses.push("d.business_date<=?");
      params.push(query.filter.businessDateTo);
    }
    if (query.filter.search?.trim()) {
      clauses.push("(d.document_number LIKE ? OR d.description LIKE ?)");
      const term = `%${query.filter.search.trim()}%`;
      params.push(term, term);
    }
    if (query.filter.productId) {
      clauses.push(
        "EXISTS (SELECT 1 FROM inventory_document_lines l WHERE l.company_id=d.company_id AND l.document_id=d.id AND l.product_id=?)",
      );
      params.push(query.filter.productId);
    }
    if (query.filter.warehouseId) {
      clauses.push(
        "EXISTS (SELECT 1 FROM inventory_document_lines l WHERE l.company_id=d.company_id AND l.document_id=d.id AND (l.warehouse_id=? OR l.destination_warehouse_id=?))",
      );
      params.push(query.filter.warehouseId, query.filter.warehouseId);
    }
    const where = clauses.join(" AND ");
    const count = await this.database.queryOne<CountRow>(
      `SELECT COUNT(*) AS count FROM inventory_documents d WHERE ${where}`,
      params,
    );
    const sort = query.sort ?? {
      field: "businessDate" as const,
      direction: "desc" as const,
    };
    const rows = await this.database.query<ListRow>(
      `SELECT d.id,d.company_id,d.origin_branch_id,d.fiscal_year_id,d.fiscal_period_id,d.document_type,d.status,
              d.document_number,d.business_date,d.version,d.created_at,d.updated_at,
              (SELECT COUNT(*) FROM inventory_document_lines l WHERE l.company_id=d.company_id AND l.document_id=d.id) AS line_count
         FROM inventory_documents d
        WHERE ${where}
        ORDER BY ${sortColumn[sort.field]} ${sort.direction === "asc" ? "ASC" : "DESC"}, d.id
        LIMIT ? OFFSET ?`,
      [...params, page.pageSize, (page.page - 1) * page.pageSize],
    );
    return Object.freeze({
      items: Object.freeze(
        rows.map((row) =>
          Object.freeze({
            documentId: row.id,
            companyId: row.company_id,
            branchId: row.origin_branch_id,
            fiscalYearId: row.fiscal_year_id,
            fiscalPeriodId: row.fiscal_period_id,
            documentType: row.document_type,
            status: row.status,
            documentNumber: row.document_number,
            businessDate: row.business_date,
            lineCount: Number(row.line_count),
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }),
        ),
      ),
      page: page.page,
      pageSize: page.pageSize,
      totalItems: Number(count?.count ?? 0),
    });
  }

  async getDocument(
    companyId: string,
    documentId: string,
  ): Promise<InventoryDocumentDetail | null> {
    const document = await this.documents.findById(companyId, documentId);
    if (!document) return null;
    return Object.freeze({
      document,
      movements: await this.movements.listByDocument(companyId, documentId),
    });
  }

  async getLineLocationTitles(
    companyId: string,
    documentId: string,
  ): Promise<readonly InventoryLineLocationTitles[]> {
    return this.database.query<InventoryLineLocationTitles>(
      `SELECT l.id AS lineId, product.code AS productCode, product.title AS productTitle,
              w.title AS warehouseTitle, z.title AS zoneTitle, p.title AS locationTitle,
              dw.title AS destinationWarehouseTitle, dz.title AS destinationZoneTitle,
              dp.title AS destinationLocationTitle
       FROM inventory_document_lines l
       LEFT JOIN products product ON product.company_id=l.company_id AND product.id=l.product_id
       LEFT JOIN warehouses w ON w.company_id=l.company_id AND w.id=l.warehouse_id
       LEFT JOIN warehouse_zones z ON z.company_id=l.company_id AND z.warehouse_id=l.warehouse_id AND z.id=l.zone_id
       LEFT JOIN warehouse_locations p ON p.company_id=l.company_id AND p.warehouse_id=l.warehouse_id AND p.zone_id=l.zone_id AND p.id=l.location_id
       LEFT JOIN warehouses dw ON dw.company_id=l.company_id AND dw.id=l.destination_warehouse_id
       LEFT JOIN warehouse_zones dz ON dz.company_id=l.company_id AND dz.warehouse_id=l.destination_warehouse_id AND dz.id=l.destination_zone_id
       LEFT JOIN warehouse_locations dp ON dp.company_id=l.company_id AND dp.warehouse_id=l.destination_warehouse_id AND dp.zone_id=l.destination_zone_id AND dp.id=l.destination_location_id
       WHERE l.company_id=? AND l.document_id=?`,
      [companyId, documentId],
    );
  }
}
