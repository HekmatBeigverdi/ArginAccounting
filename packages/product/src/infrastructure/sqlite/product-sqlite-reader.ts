import type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "../../application/contracts/product-dto.ts";
import type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductFilter,
  ProductSelectorQuery,
} from "../../application/contracts/product-queries.ts";
import type { ProductReader } from "../../application/contracts/product-reader.ts";
import type { ProductSqliteConnection } from "./sqlite-contracts.ts";
import { loadProductState } from "./product-sqlite-repository.ts";

const bool = (value: number) => value === 1;

const toDto = (state: NonNullable<Awaited<ReturnType<typeof loadProductState>>>): ProductDto => Object.freeze({
  productId: state.product.productId,
  companyId: state.product.companyId,
  code: state.product.code,
  title: state.product.title,
  kind: state.product.kind,
  status: state.product.status,
  categoryId: state.product.categoryId,
  capabilities: state.product.capabilities,
  identifiers: state.identifiers,
  units: state.units,
  masterData: state.masterData,
  version: state.version,
  createdAt: state.product.createdAt,
  updatedAt: state.product.updatedAt,
});

function buildFilter(filter: ProductFilter): { sql: string; params: unknown[] } {
  const clauses = ["p.company_id = ?", "p.deleted_at IS NULL"];
  const params: unknown[] = [filter.companyId];
  if (filter.search?.trim()) {
    const term = `%${filter.search.trim()}%`;
    clauses.push("(p.code LIKE ? OR p.title LIKE ?)");
    params.push(term, term);
  }
  const addIn = (column: string, values: readonly string[] | undefined) => {
    if (!values?.length) return;
    clauses.push(`${column} IN (${values.map(() => "?").join(",")})`);
    params.push(...values);
  };
  addIn("p.kind", filter.kinds);
  addIn("p.status", filter.statuses);
  addIn("p.category_id", filter.categoryIds);
  if (filter.purchasable !== undefined) { clauses.push("p.purchasable = ?"); params.push(filter.purchasable ? 1 : 0); }
  if (filter.sellable !== undefined) { clauses.push("p.sellable = ?"); params.push(filter.sellable ? 1 : 0); }
  if (filter.stockTracking !== undefined) { clauses.push("m.stock_tracking = ?"); params.push(filter.stockTracking ? 1 : 0); }
  if (filter.taxpayerGoodsServiceId?.trim()) { clauses.push("i.taxpayer_goods_service_id = ?"); params.push(filter.taxpayerGoodsServiceId.trim()); }
  if (filter.sku?.trim()) { clauses.push("i.sku = ?"); params.push(filter.sku.trim().toUpperCase()); }
  if (filter.barcode?.trim()) {
    clauses.push("EXISTS (SELECT 1 FROM product_barcodes b WHERE b.company_id=p.company_id AND b.product_id=p.id AND b.barcode=?)");
    params.push(filter.barcode.trim().replace(/\s+/gu, ""));
  }
  return { sql: clauses.join(" AND "), params };
}

export class ProductSqliteReader implements ProductReader {
  constructor(private readonly db: ProductSqliteConnection) {}

  async getById(query: GetProductByIdQuery): Promise<ProductDto | null> {
    const state = await loadProductState(this.db, query.companyId, "id", query.productId);
    return state ? toDto(state) : null;
  }

  async getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null> {
    const state = await loadProductState(this.db, query.companyId, "code", query.code.trim().toUpperCase());
    return state ? toDto(state) : null;
  }

  async list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>> {
    const { sql: where, params } = buildFilter(query.filter);
    const sortMap = { code: "p.code", title: "p.title", kind: "p.kind", status: "p.status", createdAt: "p.created_at", updatedAt: "p.updated_at" } as const;
    const sort = query.sort ?? { field: "code" as const, direction: "asc" as const };
    const direction = sort.direction === "desc" ? "DESC" : "ASC";
    const offset = (query.page.page - 1) * query.page.pageSize;
    const countRows = await this.db.select<Record<string, unknown> & { count: number }>(
      `SELECT COUNT(*) AS count FROM products p
       LEFT JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id
       LEFT JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id
       WHERE ${where}`,
      params,
    );
    const totalItems = countRows[0]?.count ?? 0;
    const rows = await this.db.select<Record<string, unknown> & {
      id: string; code: string; title: string; kind: "product" | "service";
      status: "active" | "inactive"; category_id: string | null; purchasable: number;
      sellable: number; sku: string | null; taxpayer_goods_service_id: string | null;
      version: number; updated_at: string;
    }>(
      `SELECT p.id,p.code,p.title,p.kind,p.status,p.category_id,p.purchasable,p.sellable,
              i.sku,i.taxpayer_goods_service_id,p.version,p.updated_at
       FROM products p
       LEFT JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id
       LEFT JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id
       WHERE ${where}
       ORDER BY ${sortMap[sort.field]} ${direction}, p.id ASC
       LIMIT ? OFFSET ?`,
      [...params, query.page.pageSize, offset],
    );
    return Object.freeze({
      items: Object.freeze(rows.map((row) => Object.freeze({
        productId: row.id, code: row.code, title: row.title, kind: row.kind, status: row.status,
        categoryId: row.category_id, purchasable: bool(row.purchasable), sellable: bool(row.sellable),
        sku: row.sku, taxpayerGoodsServiceId: row.taxpayer_goods_service_id,
        version: row.version, updatedAt: row.updated_at,
      }))),
      page: query.page.page,
      pageSize: query.page.pageSize,
      totalItems,
      totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.page.pageSize),
    });
  }

  async select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]> {
    const filter: ProductFilter = {
      companyId: query.companyId,
      ...(query.search !== undefined ? { search: query.search } : {}),
      ...(query.kinds !== undefined ? { kinds: query.kinds } : {}),
      ...(query.statuses !== undefined ? { statuses: query.statuses } : {}),
      ...(query.categoryIds !== undefined ? { categoryIds: query.categoryIds } : {}),
      ...(query.purchasable !== undefined ? { purchasable: query.purchasable } : {}),
      ...(query.sellable !== undefined ? { sellable: query.sellable } : {}),
      ...(query.stockTracking !== undefined ? { stockTracking: query.stockTracking } : {}),
    };
    const { sql: where, params } = buildFilter(filter);
    const rows = await this.db.select<Record<string, unknown> & {
      id: string; code: string; title: string; kind: "product" | "service";
      status: "active" | "inactive"; purchasable: number; sellable: number;
      default_purchase_unit_id: string | null; default_sales_unit_id: string | null;
      taxpayer_goods_service_id: string | null;
    }>(
      `SELECT p.id,p.code,p.title,p.kind,p.status,p.purchasable,p.sellable,
              m.default_purchase_unit_id,m.default_sales_unit_id,i.taxpayer_goods_service_id
       FROM products p
       LEFT JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id
       LEFT JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id
       WHERE ${where}
       ORDER BY p.title ASC,p.code ASC,p.id ASC
       LIMIT ?`,
      [...params, query.limit],
    );
    return Object.freeze(rows.map((row) => Object.freeze({
      productId: row.id, code: row.code, title: row.title, kind: row.kind, status: row.status,
      purchasable: bool(row.purchasable), sellable: bool(row.sellable),
      defaultPurchaseUnitId: row.default_purchase_unit_id,
      defaultSalesUnitId: row.default_sales_unit_id,
      taxpayerGoodsServiceId: row.taxpayer_goods_service_id,
    })));
  }
}
