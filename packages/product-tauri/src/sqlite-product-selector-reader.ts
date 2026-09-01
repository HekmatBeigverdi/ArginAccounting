import type { DatabaseSession } from "@argin/database";
import type {
  ProductSelectorItemDto,
  ProductSelectorQuery,
} from "@argin/product";

const asBoolean = (value: number): boolean => value === 1;

function addInFilter(
  clauses: string[],
  params: Array<string | number>,
  column: string,
  values: readonly string[] | undefined,
): void {
  if (values === undefined) return;
  if (values.length === 0) {
    clauses.push("1 = 0");
    return;
  }
  clauses.push(`${column} IN (${values.map(() => "?").join(",")})`);
  params.push(...values);
}

/**
 * Dedicated bounded selector adapter for downstream ERP modules.
 * It exposes no SQLite types outside this package and applies all filters
 * before LIMIT so consumer-specific profiles cannot under-fill due to
 * in-memory post filtering.
 */
export class SqliteProductSelectorReader {
  constructor(private readonly database: DatabaseSession) {}

  async select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]> {
    const clauses = ["p.company_id = ?", "p.deleted_at IS NULL"];
    const params: Array<string | number> = [query.companyId];

    const search = query.search?.trim();
    if (search) {
      const term = `%${search}%`;
      clauses.push(
        "(p.code LIKE ? OR p.title LIKE ? OR i.sku LIKE ? OR i.taxpayer_goods_service_id LIKE ?)",
      );
      params.push(term, term, term, term);
    }

    addInFilter(clauses, params, "p.kind", query.kinds);
    addInFilter(clauses, params, "p.status", query.statuses);
    addInFilter(clauses, params, "p.category_id", query.categoryIds);

    if (query.purchasable !== undefined) {
      clauses.push("p.purchasable = ?");
      params.push(query.purchasable ? 1 : 0);
    }
    if (query.sellable !== undefined) {
      clauses.push("p.sellable = ?");
      params.push(query.sellable ? 1 : 0);
    }
    if (query.stockTracking !== undefined) {
      clauses.push("m.stock_tracking = ?");
      params.push(query.stockTracking ? 1 : 0);
    }
    if (query.requiresTaxpayerGoodsServiceId) {
      clauses.push(
        "i.taxpayer_goods_service_id IS NOT NULL AND length(trim(i.taxpayer_goods_service_id)) > 0",
      );
    }

    const rows = await this.database.query<{
      id: string;
      code: string;
      title: string;
      kind: "product" | "service";
      status: "active" | "inactive";
      purchasable: number;
      sellable: number;
      default_purchase_unit_id: string | null;
      default_sales_unit_id: string | null;
      taxpayer_goods_service_id: string | null;
    }>(
      `SELECT p.id, p.code, p.title, p.kind, p.status,
              p.purchasable, p.sellable,
              m.default_purchase_unit_id, m.default_sales_unit_id,
              i.taxpayer_goods_service_id
         FROM products p
         LEFT JOIN product_identifiers i
           ON i.company_id = p.company_id AND i.product_id = p.id
         LEFT JOIN product_master_data m
           ON m.company_id = p.company_id AND m.product_id = p.id
        WHERE ${clauses.join(" AND ")}
        ORDER BY
          CASE WHEN p.code = ? THEN 0 ELSE 1 END,
          p.title ASC,
          p.code ASC,
          p.id ASC
        LIMIT ?`,
      [...params, search ?? "", query.limit],
    );

    return Object.freeze(rows.map((row) => Object.freeze({
      productId: row.id,
      code: row.code,
      title: row.title,
      kind: row.kind,
      status: row.status,
      purchasable: asBoolean(row.purchasable),
      sellable: asBoolean(row.sellable),
      defaultPurchaseUnitId: row.default_purchase_unit_id,
      defaultSalesUnitId: row.default_sales_unit_id,
      taxpayerGoodsServiceId: row.taxpayer_goods_service_id,
    })));
  }
}
