import {
  createProductIdentifierProfile,
  type ProductIdentifierProfile,
} from "../../domain/product-identifiers.ts";
import {
  createProductMasterDataProfile,
  type ProductMasterDataProfile,
} from "../../domain/product-master-data.ts";
import {
  createProductUnitProfile,
  type ProductUnitProfile,
} from "../../domain/product-unit.ts";
import {
  rehydrateProduct,
  type ProductSnapshot,
} from "../../domain/product.ts";
import type {
  ProductDuplicateCandidate,
  ProductDuplicateDetector,
  ProductDuplicateProbe,
  ProductIdempotencyExecutor,
} from "../../application/contracts/product-duplicates.ts";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "../../application/contracts/product-errors.ts";
import type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductFilter,
  ProductSelectorQuery,
} from "../../application/contracts/product-queries.ts";
import type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "../../application/contracts/product-dto.ts";
import type { ProductReader } from "../../application/contracts/product-reader.ts";
import type {
  ProductPersistenceState,
  ProductRepository,
} from "../../application/contracts/product-repository.ts";
import type {
  ProductUnitOfWork,
  ProductUnitOfWorkRepositories,
} from "../../application/contracts/product-unit-of-work.ts";
import type { TaxpayerUnitReferenceValidator } from "../../application/contracts/product-reference-validation.ts";

export interface ProductSqliteResult {
  readonly rowsAffected: number;
  readonly lastInsertId?: number;
}

export interface ProductSqliteConnection {
  select<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<readonly T[]>;
  execute(
    sql: string,
    params?: readonly unknown[],
  ): Promise<ProductSqliteResult>;
}

export interface ProductSqliteTransactionManager {
  transaction<T>(
    operation: (connection: ProductSqliteConnection) => Promise<T>,
  ): Promise<T>;
}

type ProductRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  code: string;
  title: string;
  kind: "product" | "service";
  status: "active" | "inactive";
  category_id: string | null;
  purchasable: number;
  sellable: number;
  created_at: string;
  updated_at: string;
  version: number;
};

type IdentifierRow = Record<string, unknown> & {
  sku: string | null;
  reference_code: string | null;
  taxpayer_goods_service_id: string | null;
};

type BarcodeRow = Record<string, unknown> & { barcode: string };
type ExternalIdRow = Record<string, unknown> & { scheme: string; value: string };
type UnitRow = Record<string, unknown> & {
  unit_id: string;
  code: string;
  title: string;
  ratio_to_base: number;
  precision: number;
  rounding_mode: "half-up" | "down" | "up";
  taxpayer_unit_code: string | null;
  is_base: number;
};
type MasterRow = Record<string, unknown> & {
  brand: string | null;
  model: string | null;
  purchase_description: string | null;
  sales_description: string | null;
  default_purchase_unit_id: string | null;
  default_sales_unit_id: string | null;
  tax_treatment: "unspecified" | "taxable" | "exempt" | "not-subject";
  vat_rate_basis_points: number | null;
  stock_tracking: number;
  serial_tracking: number;
  lot_tracking: number;
  shelf_life_days: number | null;
};

const bool = (value: number): boolean => value === 1;

const toSnapshot = (row: ProductRow): ProductSnapshot => rehydrateProduct({
  productId: row.id,
  companyId: row.company_id,
  code: row.code,
  title: row.title,
  kind: row.kind,
  status: row.status,
  categoryId: row.category_id,
  capabilities: { purchasable: bool(row.purchasable), sellable: bool(row.sellable) },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function loadState(
  connection: ProductSqliteConnection,
  companyId: string,
  whereSql: string,
  value: string,
): Promise<ProductPersistenceState | null> {
  const products = await connection.select<ProductRow>(
    `SELECT id, company_id, code, title, kind, status, category_id, purchasable, sellable,
            created_at, updated_at, version
       FROM products
      WHERE company_id = ? AND ${whereSql} = ?
      LIMIT 1`,
    [companyId, value],
  );
  const row = products[0];
  if (!row) return null;

  const [identifierRows, barcodeRows, externalRows, unitRows, masterRows] = await Promise.all([
    connection.select<IdentifierRow>(
      `SELECT sku, reference_code, taxpayer_goods_service_id
         FROM product_identifiers WHERE company_id = ? AND product_id = ?`,
      [companyId, row.id],
    ),
    connection.select<BarcodeRow>(
      `SELECT barcode FROM product_barcodes
        WHERE company_id = ? AND product_id = ? ORDER BY barcode`,
      [companyId, row.id],
    ),
    connection.select<ExternalIdRow>(
      `SELECT scheme, value FROM product_external_identifiers
        WHERE company_id = ? AND product_id = ? ORDER BY scheme, value`,
      [companyId, row.id],
    ),
    connection.select<UnitRow>(
      `SELECT unit_id, code, title, ratio_to_base, precision, rounding_mode,
              taxpayer_unit_code, is_base
         FROM product_units
        WHERE company_id = ? AND product_id = ?
        ORDER BY is_base DESC, code, unit_id`,
      [companyId, row.id],
    ),
    connection.select<MasterRow>(
      `SELECT brand, model, purchase_description, sales_description,
              default_purchase_unit_id, default_sales_unit_id,
              tax_treatment, vat_rate_basis_points, stock_tracking,
              serial_tracking, lot_tracking, shelf_life_days
         FROM product_master_data
        WHERE company_id = ? AND product_id = ?`,
      [companyId, row.id],
    ),
  ]);

  const identifier = identifierRows[0];
  const identifiers: Readonly<ProductIdentifierProfile> = createProductIdentifierProfile({
    sku: identifier?.sku ?? null,
    referenceCode: identifier?.reference_code ?? null,
    taxpayerGoodsServiceId: identifier?.taxpayer_goods_service_id ?? null,
    barcodes: barcodeRows.map((item) => item.barcode),
    externalIdentifiers: externalRows.map((item) => ({ scheme: item.scheme, value: item.value })),
  });

  let units: Readonly<ProductUnitProfile> | null = null;
  if (unitRows.length > 0) {
    const base = unitRows.find((unit) => unit.is_base === 1);
    if (!base) throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.invalidRequest);
    units = createProductUnitProfile({
      baseUnit: {
        unitId: base.unit_id,
        code: base.code,
        title: base.title,
        precision: base.precision,
        roundingMode: base.rounding_mode,
        taxpayerUnitCode: base.taxpayer_unit_code,
      },
      alternateUnits: unitRows
        .filter((unit) => unit.is_base !== 1)
        .map((unit) => ({
          unitId: unit.unit_id,
          code: unit.code,
          title: unit.title,
          ratioToBase: unit.ratio_to_base,
          precision: unit.precision,
          roundingMode: unit.rounding_mode,
          taxpayerUnitCode: unit.taxpayer_unit_code,
        })),
    });
  }

  const master = masterRows[0];
  const masterData: Readonly<ProductMasterDataProfile> = createProductMasterDataProfile({
    kind: row.kind,
    commercial: master ? {
      brand: master.brand,
      model: master.model,
      purchaseDescription: master.purchase_description,
      salesDescription: master.sales_description,
      defaultPurchaseUnitId: master.default_purchase_unit_id,
      defaultSalesUnitId: master.default_sales_unit_id,
    } : undefined,
    tax: master ? {
      treatment: master.tax_treatment,
      vatRateBasisPoints: master.vat_rate_basis_points,
    } : undefined,
    operational: master ? {
      stockTracking: bool(master.stock_tracking),
      serialTracking: bool(master.serial_tracking),
      lotTracking: bool(master.lot_tracking),
      shelfLifeDays: master.shelf_life_days,
    } : undefined,
  });

  return Object.freeze({
    product: toSnapshot(row),
    identifiers,
    units,
    masterData,
    version: row.version,
  });
}

async function insertChildren(
  connection: ProductSqliteConnection,
  state: ProductPersistenceState,
): Promise<void> {
  const { product, identifiers, units, masterData } = state;
  await connection.execute(
    `INSERT INTO product_identifiers
       (company_id, product_id, sku, reference_code, taxpayer_goods_service_id)
     VALUES (?, ?, ?, ?, ?)`,
    [product.companyId, product.productId, identifiers.sku, identifiers.referenceCode,
      identifiers.taxpayerGoodsServiceId],
  );
  for (const barcode of identifiers.barcodes) {
    await connection.execute(
      `INSERT INTO product_barcodes (company_id, product_id, barcode) VALUES (?, ?, ?)`,
      [product.companyId, product.productId, barcode],
    );
  }
  for (const identifier of identifiers.externalIdentifiers) {
    await connection.execute(
      `INSERT INTO product_external_identifiers
         (company_id, product_id, scheme, value) VALUES (?, ?, ?, ?)`,
      [product.companyId, product.productId, identifier.scheme, identifier.value],
    );
  }
  if (units) {
    for (const unit of units.units) {
      await connection.execute(
        `INSERT INTO product_units
           (company_id, product_id, unit_id, code, title, ratio_to_base, precision,
            rounding_mode, taxpayer_unit_code, is_base)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [product.companyId, product.productId, unit.unitId, unit.code, unit.title,
          unit.ratioToBase, unit.precision, unit.roundingMode, unit.taxpayerUnitCode ?? null,
          unit.unitId === units.baseUnitId ? 1 : 0],
      );
    }
  }
  await connection.execute(
    `INSERT INTO product_master_data
       (company_id, product_id, brand, model, purchase_description, sales_description,
        default_purchase_unit_id, default_sales_unit_id, tax_treatment,
        vat_rate_basis_points, stock_tracking, serial_tracking, lot_tracking, shelf_life_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product.companyId, product.productId, masterData.commercial.brand, masterData.commercial.model,
      masterData.commercial.purchaseDescription, masterData.commercial.salesDescription,
      masterData.commercial.defaultPurchaseUnitId, masterData.commercial.defaultSalesUnitId,
      masterData.tax.treatment, masterData.tax.vatRateBasisPoints,
      masterData.operational.stockTracking ? 1 : 0,
      masterData.operational.serialTracking ? 1 : 0,
      masterData.operational.lotTracking ? 1 : 0,
      masterData.operational.shelfLifeDays],
  );
}

export class ProductSqliteRepository implements ProductRepository {
  constructor(private readonly connection: ProductSqliteConnection) {}

  findById(companyId: string, productId: string): Promise<ProductPersistenceState | null> {
    return loadState(this.connection, companyId, "id", productId);
  }

  findByCode(companyId: string, code: string): Promise<ProductPersistenceState | null> {
    return loadState(this.connection, companyId, "code", code.trim().toUpperCase());
  }

  async add(state: ProductPersistenceState): Promise<void> {
    const p = state.product;
    await this.connection.execute(
      `INSERT INTO products
         (id, company_id, code, title, kind, status, category_id, purchasable, sellable,
          created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [p.productId, p.companyId, p.code, p.title, p.kind, p.status, p.categoryId,
        p.capabilities.purchasable ? 1 : 0, p.capabilities.sellable ? 1 : 0,
        p.createdAt, p.updatedAt, state.version],
    );
    await insertChildren(this.connection, state);
  }

  async update(state: ProductPersistenceState, expectedVersion: number): Promise<void> {
    const p = state.product;
    const result = await this.connection.execute(
      `UPDATE products
          SET code = ?, title = ?, kind = ?, status = ?, category_id = ?,
              purchasable = ?, sellable = ?, updated_at = ?, version = ?
        WHERE company_id = ? AND id = ? AND version = ? AND deleted_at IS NULL`,
      [p.code, p.title, p.kind, p.status, p.categoryId,
        p.capabilities.purchasable ? 1 : 0, p.capabilities.sellable ? 1 : 0,
        p.updatedAt, state.version, p.companyId, p.productId, expectedVersion],
    );
    if (result.rowsAffected !== 1) {
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict);
    }

    await this.connection.execute(`DELETE FROM product_master_data WHERE company_id = ? AND product_id = ?`, [p.companyId, p.productId]);
    await this.connection.execute(`DELETE FROM product_units WHERE company_id = ? AND product_id = ?`, [p.companyId, p.productId]);
    await this.connection.execute(`DELETE FROM product_external_identifiers WHERE company_id = ? AND product_id = ?`, [p.companyId, p.productId]);
    await this.connection.execute(`DELETE FROM product_barcodes WHERE company_id = ? AND product_id = ?`, [p.companyId, p.productId]);
    await this.connection.execute(`DELETE FROM product_identifiers WHERE company_id = ? AND product_id = ?`, [p.companyId, p.productId]);
    await insertChildren(this.connection, state);
  }
}

const toDto = (state: ProductPersistenceState): ProductDto => Object.freeze({
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
    clauses.push("(p.code LIKE ? OR p.title LIKE ?)");
    const term = `%${filter.search.trim()}%`;
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
    clauses.push("EXISTS (SELECT 1 FROM product_barcodes b WHERE b.company_id = p.company_id AND b.product_id = p.id AND b.barcode = ?)");
    params.push(filter.barcode.trim().replace(/\s+/gu, ""));
  }
  return { sql: clauses.join(" AND "), params };
}

export class ProductSqliteReader implements ProductReader {
  constructor(private readonly connection: ProductSqliteConnection) {}

  async getById(query: GetProductByIdQuery): Promise<ProductDto | null> {
    const state = await loadState(this.connection, query.companyId, "id", query.productId);
    return state ? toDto(state) : null;
  }

  async getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null> {
    const state = await loadState(this.connection, query.companyId, "code", query.code.trim().toUpperCase());
    return state ? toDto(state) : null;
  }

  async list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>> {
    const { sql: where, params } = buildFilter(query.filter);
    const sortMap = {
      code: "p.code", title: "p.title", kind: "p.kind", status: "p.status",
      createdAt: "p.created_at", updatedAt: "p.updated_at",
    } as const;
    const sort = query.sort ?? { field: "code" as const, direction: "asc" as const };
    const direction = sort.direction === "desc" ? "DESC" : "ASC";
    const offset = (query.page.page - 1) * query.page.pageSize;
    const countRows = await this.connection.select<Record<string, unknown> & { count: number }>(
      `SELECT COUNT(*) AS count FROM products p
       LEFT JOIN product_identifiers i ON i.company_id = p.company_id AND i.product_id = p.id
       LEFT JOIN product_master_data m ON m.company_id = p.company_id AND m.product_id = p.id
       WHERE ${where}`,
      params,
    );
    const totalItems = countRows[0]?.count ?? 0;
    const rows = await this.connection.select<Record<string, unknown> & {
      id: string; code: string; title: string; kind: "product" | "service";
      status: "active" | "inactive"; category_id: string | null; purchasable: number;
      sellable: number; sku: string | null; taxpayer_goods_service_id: string | null;
      version: number; updated_at: string;
    }>(
      `SELECT p.id, p.code, p.title, p.kind, p.status, p.category_id, p.purchasable,
              p.sellable, i.sku, i.taxpayer_goods_service_id, p.version, p.updated_at
         FROM products p
         LEFT JOIN product_identifiers i ON i.company_id = p.company_id AND i.product_id = p.id
         LEFT JOIN product_master_data m ON m.company_id = p.company_id AND m.product_id = p.id
        WHERE ${where}
        ORDER BY ${sortMap[sort.field]} ${direction}, p.id ASC
        LIMIT ? OFFSET ?`,
      [...params, query.page.pageSize, offset],
    );
    return Object.freeze({
      items: Object.freeze(rows.map((row) => Object.freeze({
        productId: row.id, code: row.code, title: row.title, kind: row.kind,
        status: row.status, categoryId: row.category_id, purchasable: bool(row.purchasable),
        sellable: bool(row.sellable), sku: row.sku,
        taxpayerGoodsServiceId: row.taxpayer_goods_service_id, version: row.version,
        updatedAt: row.updated_at,
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
    const rows = await this.connection.select<Record<string, unknown> & {
      id: string; code: string; title: string; kind: "product" | "service";
      status: "active" | "inactive"; purchasable: number; sellable: number;
      default_purchase_unit_id: string | null; default_sales_unit_id: string | null;
      taxpayer_goods_service_id: string | null;
    }>(
      `SELECT p.id, p.code, p.title, p.kind, p.status, p.purchasable, p.sellable,
              m.default_purchase_unit_id, m.default_sales_unit_id, i.taxpayer_goods_service_id
         FROM products p
         LEFT JOIN product_identifiers i ON i.company_id = p.company_id AND i.product_id = p.id
         LEFT JOIN product_master_data m ON m.company_id = p.company_id AND m.product_id = p.id
        WHERE ${where}
        ORDER BY p.title ASC, p.code ASC, p.id ASC
        LIMIT ?`,
      [...params, query.limit],
    );
    return Object.freeze(rows.map((row) => Object.freeze({
      productId: row.id, code: row.code, title: row.title, kind: row.kind,
      status: row.status, purchasable: bool(row.purchasable), sellable: bool(row.sellable),
      defaultPurchaseUnitId: row.default_purchase_unit_id,
      defaultSalesUnitId: row.default_sales_unit_id,
      taxpayerGoodsServiceId: row.taxpayer_goods_service_id,
    })));
  }
}

export class ProductSqliteUnitOfWork implements ProductUnitOfWork {
  constructor(private readonly transactions: ProductSqliteTransactionManager) {}

  transaction<T>(operation: (repositories: ProductUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    return this.run(operation);
  }

  run<T>(operation: (repositories: ProductUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    return this.transactions.transaction((connection) =>
      operation({ products: new ProductSqliteRepository(connection) }),
    );
  }
}

export class ProductSqliteDuplicateDetector implements ProductDuplicateDetector {
  constructor(private readonly connection: ProductSqliteConnection) {}

  async detect(probe: ProductDuplicateProbe): Promise<readonly ProductDuplicateCandidate[]> {
    const candidates = new Map<string, ProductDuplicateCandidate>();
    const exclude = probe.excludeProductId ?? "";
    const collect = async (reason: ProductDuplicateCandidate["reason"], strength: ProductDuplicateCandidate["strength"], sql: string, params: readonly unknown[]) => {
      const rows = await this.connection.select<Record<string, unknown> & { id: string; code: string; title: string }>(sql, params);
      for (const row of rows) {
        const key = `${row.id}\u0000${reason}`;
        candidates.set(key, Object.freeze({ productId: row.id, code: row.code, title: row.title, reason, strength }));
      }
    };
    const base = `p.company_id = ? AND p.id <> ? AND p.deleted_at IS NULL`;
    await collect("code", "hard", `SELECT p.id, p.code, p.title FROM products p WHERE ${base} AND p.code = ? LIMIT 20`, [probe.companyId, exclude, probe.code]);
    if (probe.identifiers.sku) await collect("sku", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.sku=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.sku]);
    if (probe.identifiers.referenceCode) await collect("reference-code", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.reference_code=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.referenceCode]);
    if (probe.identifiers.taxpayerGoodsServiceId) await collect("taxpayer-goods-service-id", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.taxpayer_goods_service_id=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.taxpayerGoodsServiceId]);
    for (const barcode of probe.identifiers.barcodes) await collect("barcode", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_barcodes b ON b.company_id=p.company_id AND b.product_id=p.id WHERE ${base} AND b.barcode=? LIMIT 20`, [probe.companyId, exclude, barcode]);
    for (const identifier of probe.identifiers.externalIdentifiers) await collect("external-identifier", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_external_identifiers e ON e.company_id=p.company_id AND e.product_id=p.id WHERE ${base} AND e.scheme=? AND e.value=? LIMIT 20`, [probe.companyId, exclude, identifier.scheme, identifier.value]);
    if (probe.title.trim()) await collect("title", "advisory", `SELECT p.id,p.code,p.title FROM products p WHERE ${base} AND p.title=? LIMIT 20`, [probe.companyId, exclude, probe.title.trim()]);
    if (probe.brand || probe.model) await collect("brand-model", "advisory", `SELECT p.id,p.code,p.title FROM products p JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id WHERE ${base} AND COALESCE(m.brand,'')=COALESCE(?,'') AND COALESCE(m.model,'')=COALESCE(?,'') LIMIT 20`, [probe.companyId, exclude, probe.brand, probe.model]);
    return Object.freeze([...candidates.values()]);
  }
}

export class ProductSqliteTaxpayerUnitValidator implements TaxpayerUnitReferenceValidator {
  constructor(private readonly connection: ProductSqliteConnection) {}

  async isActive(code: string): Promise<boolean> {
    const rows = await this.connection.select<Record<string, unknown> & { found: number }>(
      `SELECT 1 AS found FROM taxpayer_units WHERE code = ? AND is_active = 1 LIMIT 1`,
      [code.trim()],
    );
    return rows.length === 1;
  }
}

export class ProductSqliteIdempotencyExecutor implements ProductIdempotencyExecutor {
  constructor(private readonly transactions: ProductSqliteTransactionManager) {}

  async run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T> {
    return this.transactions.transaction(async (connection) => {
      const existing = await connection.select<Record<string, unknown> & { result_json: string | null; status: string }>(
        `SELECT result_json, status FROM product_idempotency
          WHERE scope = ? AND request_id = ? LIMIT 1`,
        [scope, requestId],
      );
      const record = existing[0];
      if (record?.status === "completed" && record.result_json != null) {
        return JSON.parse(record.result_json) as T;
      }
      if (record?.status === "in-progress") {
        throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict);
      }
      await connection.execute(
        `INSERT INTO product_idempotency (scope, request_id, status, result_json, created_at, completed_at)
         VALUES (?, ?, 'in-progress', NULL, datetime('now'), NULL)`,
        [scope, requestId],
      );
      try {
        const result = await operation();
        await connection.execute(
          `UPDATE product_idempotency
              SET status = 'completed', result_json = ?, completed_at = datetime('now')
            WHERE scope = ? AND request_id = ?`,
          [JSON.stringify(result), scope, requestId],
        );
        return result;
      } catch (error) {
        await connection.execute(`DELETE FROM product_idempotency WHERE scope = ? AND request_id = ?`, [scope, requestId]);
        throw error;
      }
    });
  }
}
