import type { DatabaseSession } from "@argin/database";
import {
  ProductApplicationError,
  createProductIdentifierProfile,
  createProductMasterDataProfile,
  createProductUnitProfile,
  rehydrateProduct,
  type GetProductByCodeQuery,
  type GetProductByIdQuery,
  type ListProductsQuery,
  type ProductDto,
  type ProductDuplicateCandidate,
  type ProductDuplicateDetector,
  type ProductDuplicateProbe,
  type ProductFilter,
  type ProductListItemDto,
  type ProductPageDto,
  type ProductPersistenceState,
  type ProductReader,
  type ProductRepository,
  type ProductSelectorItemDto,
  type ProductSelectorQuery,
  type TaxpayerUnitReferenceValidator,
} from "@argin/product";

interface ProductRow {
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
}

interface IdentifierRow {
  sku: string | null;
  reference_code: string | null;
  taxpayer_goods_service_id: string | null;
}

interface BarcodeRow { barcode: string; }
interface ExternalIdentifierRow { scheme: string; value: string; }
interface UnitRow {
  unit_id: string;
  code: string;
  title: string;
  ratio_to_base: number;
  precision: number;
  rounding_mode: "half-up" | "down" | "up";
  taxpayer_unit_code: string | null;
  is_base: number;
}
interface MasterRow {
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
}
interface CountRow { count: number; }

const asBoolean = (value: number): boolean => value === 1;

async function loadState(
  database: DatabaseSession,
  companyId: string,
  field: "id" | "code",
  value: string,
): Promise<ProductPersistenceState | null> {
  const row = await database.queryOne<ProductRow>(
    `SELECT id, company_id, code, title, kind, status, category_id,
            purchasable, sellable, created_at, updated_at, version
       FROM products
      WHERE company_id = ? AND ${field} = ? AND deleted_at IS NULL`,
    [companyId, value],
  );
  if (!row) return null;

  const [identifier, barcodes, externalIdentifiers, unitRows, master] = await Promise.all([
    database.queryOne<IdentifierRow>(
      "SELECT sku, reference_code, taxpayer_goods_service_id FROM product_identifiers WHERE company_id = ? AND product_id = ?",
      [companyId, row.id],
    ),
    database.query<BarcodeRow>(
      "SELECT barcode FROM product_barcodes WHERE company_id = ? AND product_id = ? ORDER BY barcode",
      [companyId, row.id],
    ),
    database.query<ExternalIdentifierRow>(
      "SELECT scheme, value FROM product_external_identifiers WHERE company_id = ? AND product_id = ? ORDER BY scheme, value",
      [companyId, row.id],
    ),
    database.query<UnitRow>(
      `SELECT unit_id, code, title, ratio_to_base, precision, rounding_mode,
              taxpayer_unit_code, is_base
         FROM product_units
        WHERE company_id = ? AND product_id = ?
        ORDER BY is_base DESC, code, unit_id`,
      [companyId, row.id],
    ),
    database.queryOne<MasterRow>(
      `SELECT brand, model, purchase_description, sales_description,
              default_purchase_unit_id, default_sales_unit_id,
              tax_treatment, vat_rate_basis_points, stock_tracking,
              serial_tracking, lot_tracking, shelf_life_days
         FROM product_master_data
        WHERE company_id = ? AND product_id = ?`,
      [companyId, row.id],
    ),
  ]);

  const identifiers = createProductIdentifierProfile({
    sku: identifier?.sku ?? null,
    referenceCode: identifier?.reference_code ?? null,
    taxpayerGoodsServiceId: identifier?.taxpayer_goods_service_id ?? null,
    barcodes: barcodes.map((item) => item.barcode),
    externalIdentifiers: externalIdentifiers.map((item) => ({
      scheme: item.scheme,
      value: item.value,
    })),
  });

  let units: ProductPersistenceState["units"] = null;
  if (unitRows.length > 0) {
    const base = unitRows.find((item) => item.is_base === 1);
    if (!base) {
      throw new ProductApplicationError(
        "product.application.invalid-request",
        "Persisted Product unit profile has no base unit.",
      );
    }
    units = createProductUnitProfile({
      baseUnit: {
        unitId: base.unit_id,
        code: base.code,
        title: base.title,
        precision: base.precision,
        roundingMode: base.rounding_mode,
        ...(base.taxpayer_unit_code === null
          ? {}
          : { taxpayerUnitCode: base.taxpayer_unit_code }),
      },
      alternateUnits: unitRows
        .filter((item) => item.is_base !== 1)
        .map((item) => ({
          unitId: item.unit_id,
          code: item.code,
          title: item.title,
          ratioToBase: item.ratio_to_base,
          precision: item.precision,
          roundingMode: item.rounding_mode,
          ...(item.taxpayer_unit_code === null
            ? {}
            : { taxpayerUnitCode: item.taxpayer_unit_code }),
        })),
    });
  }

  const masterData = master
    ? createProductMasterDataProfile({
        kind: row.kind,
        commercial: {
          brand: master.brand,
          model: master.model,
          purchaseDescription: master.purchase_description,
          salesDescription: master.sales_description,
          defaultPurchaseUnitId: master.default_purchase_unit_id,
          defaultSalesUnitId: master.default_sales_unit_id,
        },
        tax: {
          treatment: master.tax_treatment,
          vatRateBasisPoints: master.vat_rate_basis_points,
        },
        operational: {
          stockTracking: asBoolean(master.stock_tracking),
          serialTracking: asBoolean(master.serial_tracking),
          lotTracking: asBoolean(master.lot_tracking),
          shelfLifeDays: master.shelf_life_days,
        },
      })
    : createProductMasterDataProfile({ kind: row.kind });

  return Object.freeze({
    product: rehydrateProduct({
      productId: row.id,
      companyId: row.company_id,
      code: row.code,
      title: row.title,
      kind: row.kind,
      status: row.status,
      categoryId: row.category_id,
      capabilities: {
        purchasable: asBoolean(row.purchasable),
        sellable: asBoolean(row.sellable),
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }),
    identifiers,
    units,
    masterData,
    version: row.version,
  });
}

async function insertChildren(
  database: DatabaseSession,
  state: ProductPersistenceState,
): Promise<void> {
  const { product, identifiers, units, masterData } = state;
  await database.execute(
    `INSERT INTO product_identifiers
       (company_id, product_id, sku, reference_code, taxpayer_goods_service_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      product.companyId,
      product.productId,
      identifiers.sku,
      identifiers.referenceCode,
      identifiers.taxpayerGoodsServiceId,
    ],
  );

  for (const barcode of identifiers.barcodes) {
    await database.execute(
      "INSERT INTO product_barcodes (company_id, product_id, barcode) VALUES (?, ?, ?)",
      [product.companyId, product.productId, barcode],
    );
  }

  for (const identifier of identifiers.externalIdentifiers) {
    await database.execute(
      `INSERT INTO product_external_identifiers
         (company_id, product_id, scheme, value)
       VALUES (?, ?, ?, ?)`,
      [product.companyId, product.productId, identifier.scheme, identifier.value],
    );
  }

  if (units) {
    for (const unit of units.units) {
      await database.execute(
        `INSERT INTO product_units
           (company_id, product_id, unit_id, code, title, ratio_to_base,
            precision, rounding_mode, taxpayer_unit_code, is_base)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.companyId,
          product.productId,
          unit.unitId,
          unit.code,
          unit.title,
          unit.ratioToBase,
          unit.precision,
          unit.roundingMode,
          unit.taxpayerUnitCode ?? null,
          unit.unitId === units.baseUnitId ? 1 : 0,
        ],
      );
    }
  }

  await database.execute(
    `INSERT INTO product_master_data
       (company_id, product_id, brand, model, purchase_description,
        sales_description, default_purchase_unit_id, default_sales_unit_id,
        tax_treatment, vat_rate_basis_points, stock_tracking, serial_tracking,
        lot_tracking, shelf_life_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      product.companyId,
      product.productId,
      masterData.commercial.brand,
      masterData.commercial.model,
      masterData.commercial.purchaseDescription,
      masterData.commercial.salesDescription,
      masterData.commercial.defaultPurchaseUnitId,
      masterData.commercial.defaultSalesUnitId,
      masterData.tax.treatment,
      masterData.tax.vatRateBasisPoints,
      masterData.operational.stockTracking ? 1 : 0,
      masterData.operational.serialTracking ? 1 : 0,
      masterData.operational.lotTracking ? 1 : 0,
      masterData.operational.shelfLifeDays,
    ],
  );
}

export class SqliteProductRepository implements ProductRepository {
  constructor(private readonly database: DatabaseSession) {}

  findById(companyId: string, productId: string): Promise<ProductPersistenceState | null> {
    return loadState(this.database, companyId, "id", productId);
  }

  findByCode(companyId: string, code: string): Promise<ProductPersistenceState | null> {
    return loadState(this.database, companyId, "code", code.trim().toUpperCase());
  }

  async add(state: ProductPersistenceState): Promise<void> {
    const product = state.product;
    await this.database.execute(
      `INSERT INTO products
         (id, company_id, code, title, kind, status, category_id,
          purchasable, sellable, created_at, updated_at, version, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        product.productId,
        product.companyId,
        product.code,
        product.title,
        product.kind,
        product.status,
        product.categoryId,
        product.capabilities.purchasable ? 1 : 0,
        product.capabilities.sellable ? 1 : 0,
        product.createdAt,
        product.updatedAt,
        state.version,
      ],
    );
    await insertChildren(this.database, state);
  }

  async update(state: ProductPersistenceState, expectedVersion: number): Promise<void> {
    const product = state.product;
    const result = await this.database.execute(
      `UPDATE products
          SET code = ?, title = ?, kind = ?, status = ?, category_id = ?,
              purchasable = ?, sellable = ?, updated_at = ?, version = ?
        WHERE company_id = ? AND id = ? AND version = ? AND deleted_at IS NULL`,
      [
        product.code,
        product.title,
        product.kind,
        product.status,
        product.categoryId,
        product.capabilities.purchasable ? 1 : 0,
        product.capabilities.sellable ? 1 : 0,
        product.updatedAt,
        state.version,
        product.companyId,
        product.productId,
        expectedVersion,
      ],
    );
    if (result.rowsAffected !== 1) {
      throw new ProductApplicationError(
        "product.application.concurrency-conflict",
        "Product optimistic concurrency check failed.",
      );
    }

    await this.database.execute(
      "DELETE FROM product_master_data WHERE company_id = ? AND product_id = ?",
      [product.companyId, product.productId],
    );
    await this.database.execute(
      "DELETE FROM product_units WHERE company_id = ? AND product_id = ?",
      [product.companyId, product.productId],
    );
    await this.database.execute(
      "DELETE FROM product_external_identifiers WHERE company_id = ? AND product_id = ?",
      [product.companyId, product.productId],
    );
    await this.database.execute(
      "DELETE FROM product_barcodes WHERE company_id = ? AND product_id = ?",
      [product.companyId, product.productId],
    );
    await this.database.execute(
      "DELETE FROM product_identifiers WHERE company_id = ? AND product_id = ?",
      [product.companyId, product.productId],
    );
    await insertChildren(this.database, state);
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

function buildFilter(filter: ProductFilter): { where: string; params: Array<string | number> } {
  const clauses = ["p.company_id = ?", "p.deleted_at IS NULL"];
  const params: Array<string | number> = [filter.companyId];

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

  if (filter.purchasable !== undefined) {
    clauses.push("p.purchasable = ?");
    params.push(filter.purchasable ? 1 : 0);
  }
  if (filter.sellable !== undefined) {
    clauses.push("p.sellable = ?");
    params.push(filter.sellable ? 1 : 0);
  }
  if (filter.stockTracking !== undefined) {
    clauses.push("m.stock_tracking = ?");
    params.push(filter.stockTracking ? 1 : 0);
  }
  if (filter.taxpayerGoodsServiceId?.trim()) {
    clauses.push("i.taxpayer_goods_service_id = ?");
    params.push(filter.taxpayerGoodsServiceId.trim());
  }
  if (filter.sku?.trim()) {
    clauses.push("i.sku = ?");
    params.push(filter.sku.trim().toUpperCase());
  }
  if (filter.barcode?.trim()) {
    clauses.push(
      "EXISTS (SELECT 1 FROM product_barcodes b WHERE b.company_id = p.company_id AND b.product_id = p.id AND b.barcode = ?)",
    );
    params.push(filter.barcode.trim().replace(/\s+/gu, ""));
  }

  return { where: clauses.join(" AND "), params };
}

export class SqliteProductReader implements ProductReader {
  constructor(private readonly database: DatabaseSession) {}

  async getById(query: GetProductByIdQuery): Promise<ProductDto | null> {
    const state = await loadState(this.database, query.companyId, "id", query.productId);
    return state ? toDto(state) : null;
  }

  async getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null> {
    const state = await loadState(
      this.database,
      query.companyId,
      "code",
      query.code.trim().toUpperCase(),
    );
    return state ? toDto(state) : null;
  }

  async list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>> {
    const { where, params } = buildFilter(query.filter);
    const sortMap = {
      code: "p.code",
      title: "p.title",
      kind: "p.kind",
      status: "p.status",
      createdAt: "p.created_at",
      updatedAt: "p.updated_at",
    } as const;
    const sort = query.sort ?? { field: "code" as const, direction: "asc" as const };
    const direction = sort.direction === "desc" ? "DESC" : "ASC";
    const offset = (query.page.page - 1) * query.page.pageSize;

    const count = await this.database.queryOne<CountRow>(
      `SELECT COUNT(*) AS count
         FROM products p
         LEFT JOIN product_identifiers i
           ON i.company_id = p.company_id AND i.product_id = p.id
         LEFT JOIN product_master_data m
           ON m.company_id = p.company_id AND m.product_id = p.id
        WHERE ${where}`,
      params,
    );
    const totalItems = count?.count ?? 0;

    const rows = await this.database.query<{
      id: string;
      code: string;
      title: string;
      kind: "product" | "service";
      status: "active" | "inactive";
      category_id: string | null;
      purchasable: number;
      sellable: number;
      sku: string | null;
      taxpayer_goods_service_id: string | null;
      version: number;
      updated_at: string;
    }>(
      `SELECT p.id, p.code, p.title, p.kind, p.status, p.category_id,
              p.purchasable, p.sellable, i.sku, i.taxpayer_goods_service_id,
              p.version, p.updated_at
         FROM products p
         LEFT JOIN product_identifiers i
           ON i.company_id = p.company_id AND i.product_id = p.id
         LEFT JOIN product_master_data m
           ON m.company_id = p.company_id AND m.product_id = p.id
        WHERE ${where}
        ORDER BY ${sortMap[sort.field]} ${direction}, p.id ASC
        LIMIT ? OFFSET ?`,
      [...params, query.page.pageSize, offset],
    );

    return Object.freeze({
      items: Object.freeze(rows.map((row) => Object.freeze({
        productId: row.id,
        code: row.code,
        title: row.title,
        kind: row.kind,
        status: row.status,
        categoryId: row.category_id,
        purchasable: asBoolean(row.purchasable),
        sellable: asBoolean(row.sellable),
        sku: row.sku,
        taxpayerGoodsServiceId: row.taxpayer_goods_service_id,
        version: row.version,
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
      ...(query.search === undefined ? {} : { search: query.search }),
      ...(query.kinds === undefined ? {} : { kinds: query.kinds }),
      ...(query.statuses === undefined ? {} : { statuses: query.statuses }),
      ...(query.categoryIds === undefined ? {} : { categoryIds: query.categoryIds }),
      ...(query.purchasable === undefined ? {} : { purchasable: query.purchasable }),
      ...(query.sellable === undefined ? {} : { sellable: query.sellable }),
      ...(query.stockTracking === undefined ? {} : { stockTracking: query.stockTracking }),
    };
    const { where, params } = buildFilter(filter);
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
        WHERE ${where}
        ORDER BY p.title ASC, p.code ASC, p.id ASC
        LIMIT ?`,
      [...params, query.limit],
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

export class SqliteProductDuplicateDetector implements ProductDuplicateDetector {
  constructor(private readonly database: DatabaseSession) {}

  async detect(probe: ProductDuplicateProbe): Promise<readonly ProductDuplicateCandidate[]> {
    const candidates = new Map<string, ProductDuplicateCandidate>();
    const exclude = probe.excludeProductId ?? "";
    const base = "p.company_id = ? AND p.id <> ? AND p.deleted_at IS NULL";

    const collect = async (
      reason: ProductDuplicateCandidate["reason"],
      strength: ProductDuplicateCandidate["strength"],
      sql: string,
      params: readonly (string | number | null)[],
    ) => {
      const rows = await this.database.query<{ id: string; code: string; title: string }>(sql, params);
      for (const row of rows) {
        candidates.set(`${row.id}\u0000${reason}`, Object.freeze({
          productId: row.id,
          code: row.code,
          title: row.title,
          reason,
          strength,
        }));
      }
    };

    await collect(
      "code",
      "hard",
      `SELECT p.id, p.code, p.title FROM products p WHERE ${base} AND p.code = ? LIMIT 20`,
      [probe.companyId, exclude, probe.code],
    );
    if (probe.identifiers.sku) {
      await collect("sku", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.sku=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.sku]);
    }
    if (probe.identifiers.referenceCode) {
      await collect("reference-code", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.reference_code=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.referenceCode]);
    }
    if (probe.identifiers.taxpayerGoodsServiceId) {
      await collect("taxpayer-goods-service-id", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.taxpayer_goods_service_id=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.taxpayerGoodsServiceId]);
    }
    for (const barcode of probe.identifiers.barcodes) {
      await collect("barcode", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_barcodes b ON b.company_id=p.company_id AND b.product_id=p.id WHERE ${base} AND b.barcode=? LIMIT 20`, [probe.companyId, exclude, barcode]);
    }
    for (const identifier of probe.identifiers.externalIdentifiers) {
      await collect("external-identifier", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_external_identifiers e ON e.company_id=p.company_id AND e.product_id=p.id WHERE ${base} AND e.scheme=? AND e.value=? LIMIT 20`, [probe.companyId, exclude, identifier.scheme, identifier.value]);
    }
    if (probe.title.trim()) {
      await collect("title", "advisory", `SELECT p.id,p.code,p.title FROM products p WHERE ${base} AND p.title=? LIMIT 20`, [probe.companyId, exclude, probe.title.trim()]);
    }
    if (probe.brand || probe.model) {
      await collect("brand-model", "advisory", `SELECT p.id,p.code,p.title FROM products p JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id WHERE ${base} AND COALESCE(m.brand,'')=COALESCE(?,'') AND COALESCE(m.model,'')=COALESCE(?,'') LIMIT 20`, [probe.companyId, exclude, probe.brand, probe.model]);
    }

    return Object.freeze([...candidates.values()]);
  }
}

export class SqliteTaxpayerUnitReferenceValidator implements TaxpayerUnitReferenceValidator {
  constructor(private readonly database: DatabaseSession) {}

  async isActiveCode(code: string): Promise<boolean> {
    const row = await this.database.queryOne<{ found: number }>(
      "SELECT 1 AS found FROM taxpayer_units WHERE code = ? AND is_active = 1",
      [code.trim()],
    );
    return row !== null;
  }
}
