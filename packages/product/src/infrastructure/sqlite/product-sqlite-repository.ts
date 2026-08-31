import {
  createProductIdentifierProfile,
} from "../../domain/product-identifiers.ts";
import {
  createProductMasterDataProfile,
} from "../../domain/product-master-data.ts";
import {
  createProductUnitProfile,
} from "../../domain/product-unit.ts";
import { rehydrateProduct } from "../../domain/product.ts";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "../../application/contracts/product-errors.ts";
import type {
  ProductPersistenceState,
  ProductRepository,
} from "../../application/contracts/product-repository.ts";
import type { ProductSqliteConnection } from "./sqlite-contracts.ts";

type ProductRow = Record<string, unknown> & {
  id: string; company_id: string; code: string; title: string;
  kind: "product" | "service"; status: "active" | "inactive";
  category_id: string | null; purchasable: number; sellable: number;
  created_at: string; updated_at: string; version: number;
};
type IdentifierRow = Record<string, unknown> & { sku: string | null; reference_code: string | null; taxpayer_goods_service_id: string | null };
type BarcodeRow = Record<string, unknown> & { barcode: string };
type ExternalRow = Record<string, unknown> & { scheme: string; value: string };
type UnitRow = Record<string, unknown> & {
  unit_id: string; code: string; title: string; ratio_to_base: number; precision: number;
  rounding_mode: "half-up" | "down" | "up"; taxpayer_unit_code: string | null; is_base: number;
};
type MasterRow = Record<string, unknown> & {
  brand: string | null; model: string | null; purchase_description: string | null;
  sales_description: string | null; default_purchase_unit_id: string | null;
  default_sales_unit_id: string | null; tax_treatment: "unspecified" | "taxable" | "exempt" | "not-subject";
  vat_rate_basis_points: number | null; stock_tracking: number; serial_tracking: number;
  lot_tracking: number; shelf_life_days: number | null;
};

const bool = (value: number) => value === 1;

export async function loadProductState(
  db: ProductSqliteConnection,
  companyId: string,
  field: "id" | "code",
  value: string,
): Promise<ProductPersistenceState | null> {
  const rows = await db.select<ProductRow>(
    `SELECT id, company_id, code, title, kind, status, category_id, purchasable, sellable,
            created_at, updated_at, version
       FROM products
      WHERE company_id = ? AND ${field} = ? AND deleted_at IS NULL
      LIMIT 1`,
    [companyId, value],
  );
  const row = rows[0];
  if (!row) return null;

  const [ids, barcodes, external, unitsRows, masters] = await Promise.all([
    db.select<IdentifierRow>(`SELECT sku, reference_code, taxpayer_goods_service_id FROM product_identifiers WHERE company_id=? AND product_id=?`, [companyId, row.id]),
    db.select<BarcodeRow>(`SELECT barcode FROM product_barcodes WHERE company_id=? AND product_id=? ORDER BY barcode`, [companyId, row.id]),
    db.select<ExternalRow>(`SELECT scheme, value FROM product_external_identifiers WHERE company_id=? AND product_id=? ORDER BY scheme,value`, [companyId, row.id]),
    db.select<UnitRow>(`SELECT unit_id, code, title, ratio_to_base, precision, rounding_mode, taxpayer_unit_code, is_base FROM product_units WHERE company_id=? AND product_id=? ORDER BY is_base DESC, code, unit_id`, [companyId, row.id]),
    db.select<MasterRow>(`SELECT brand, model, purchase_description, sales_description, default_purchase_unit_id, default_sales_unit_id, tax_treatment, vat_rate_basis_points, stock_tracking, serial_tracking, lot_tracking, shelf_life_days FROM product_master_data WHERE company_id=? AND product_id=?`, [companyId, row.id]),
  ]);

  const id = ids[0];
  const identifiers = createProductIdentifierProfile({
    sku: id?.sku ?? null,
    referenceCode: id?.reference_code ?? null,
    taxpayerGoodsServiceId: id?.taxpayer_goods_service_id ?? null,
    barcodes: barcodes.map((item) => item.barcode),
    externalIdentifiers: external.map((item) => ({ scheme: item.scheme, value: item.value })),
  });

  let units = null;
  if (unitsRows.length > 0) {
    const base = unitsRows.find((item) => item.is_base === 1);
    if (!base) throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.invalidRequest);
    units = createProductUnitProfile({
      baseUnit: {
        unitId: base.unit_id,
        code: base.code,
        title: base.title,
        precision: base.precision,
        roundingMode: base.rounding_mode,
        ...(base.taxpayer_unit_code !== null ? { taxpayerUnitCode: base.taxpayer_unit_code } : {}),
      },
      alternateUnits: unitsRows.filter((item) => item.is_base !== 1).map((item) => ({
        unitId: item.unit_id,
        code: item.code,
        title: item.title,
        ratioToBase: item.ratio_to_base,
        precision: item.precision,
        roundingMode: item.rounding_mode,
        ...(item.taxpayer_unit_code !== null ? { taxpayerUnitCode: item.taxpayer_unit_code } : {}),
      })),
    });
  }

  const master = masters[0];
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
        tax: { treatment: master.tax_treatment, vatRateBasisPoints: master.vat_rate_basis_points },
        operational: {
          stockTracking: bool(master.stock_tracking), serialTracking: bool(master.serial_tracking),
          lotTracking: bool(master.lot_tracking), shelfLifeDays: master.shelf_life_days,
        },
      })
    : createProductMasterDataProfile({ kind: row.kind });

  return Object.freeze({
    product: rehydrateProduct({
      productId: row.id, companyId: row.company_id, code: row.code, title: row.title,
      kind: row.kind, status: row.status, categoryId: row.category_id,
      capabilities: { purchasable: bool(row.purchasable), sellable: bool(row.sellable) },
      createdAt: row.created_at, updatedAt: row.updated_at,
    }),
    identifiers,
    units,
    masterData,
    version: row.version,
  });
}

async function writeChildren(db: ProductSqliteConnection, state: ProductPersistenceState): Promise<void> {
  const p = state.product;
  await db.execute(`INSERT INTO product_identifiers (company_id,product_id,sku,reference_code,taxpayer_goods_service_id) VALUES (?,?,?,?,?)`, [p.companyId,p.productId,state.identifiers.sku,state.identifiers.referenceCode,state.identifiers.taxpayerGoodsServiceId]);
  for (const barcode of state.identifiers.barcodes) await db.execute(`INSERT INTO product_barcodes (company_id,product_id,barcode) VALUES (?,?,?)`, [p.companyId,p.productId,barcode]);
  for (const item of state.identifiers.externalIdentifiers) await db.execute(`INSERT INTO product_external_identifiers (company_id,product_id,scheme,value) VALUES (?,?,?,?)`, [p.companyId,p.productId,item.scheme,item.value]);
  if (state.units) {
    for (const unit of state.units.units) await db.execute(
      `INSERT INTO product_units (company_id,product_id,unit_id,code,title,ratio_to_base,precision,rounding_mode,taxpayer_unit_code,is_base) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [p.companyId,p.productId,unit.unitId,unit.code,unit.title,unit.ratioToBase,unit.precision,unit.roundingMode,unit.taxpayerUnitCode ?? null,unit.unitId === state.units.baseUnitId ? 1 : 0],
    );
  }
  const m = state.masterData;
  await db.execute(
    `INSERT INTO product_master_data (company_id,product_id,brand,model,purchase_description,sales_description,default_purchase_unit_id,default_sales_unit_id,tax_treatment,vat_rate_basis_points,stock_tracking,serial_tracking,lot_tracking,shelf_life_days) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.companyId,p.productId,m.commercial.brand,m.commercial.model,m.commercial.purchaseDescription,m.commercial.salesDescription,m.commercial.defaultPurchaseUnitId,m.commercial.defaultSalesUnitId,m.tax.treatment,m.tax.vatRateBasisPoints,m.operational.stockTracking?1:0,m.operational.serialTracking?1:0,m.operational.lotTracking?1:0,m.operational.shelfLifeDays],
  );
}

export class ProductSqliteRepository implements ProductRepository {
  constructor(private readonly db: ProductSqliteConnection) {}

  findById(companyId: string, productId: string) { return loadProductState(this.db, companyId, "id", productId); }
  findByCode(companyId: string, code: string) { return loadProductState(this.db, companyId, "code", code.trim().toUpperCase()); }

  async add(state: ProductPersistenceState): Promise<void> {
    const p = state.product;
    await this.db.execute(
      `INSERT INTO products (id,company_id,code,title,kind,status,category_id,purchasable,sellable,created_at,updated_at,version,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)`,
      [p.productId,p.companyId,p.code,p.title,p.kind,p.status,p.categoryId,p.capabilities.purchasable?1:0,p.capabilities.sellable?1:0,p.createdAt,p.updatedAt,state.version],
    );
    await writeChildren(this.db, state);
  }

  async update(state: ProductPersistenceState, expectedVersion: number): Promise<void> {
    const p = state.product;
    const result = await this.db.execute(
      `UPDATE products SET code=?,title=?,kind=?,status=?,category_id=?,purchasable=?,sellable=?,updated_at=?,version=? WHERE company_id=? AND id=? AND version=? AND deleted_at IS NULL`,
      [p.code,p.title,p.kind,p.status,p.categoryId,p.capabilities.purchasable?1:0,p.capabilities.sellable?1:0,p.updatedAt,state.version,p.companyId,p.productId,expectedVersion],
    );
    if (result.rowsAffected !== 1) throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict);
    await this.db.execute(`DELETE FROM product_master_data WHERE company_id=? AND product_id=?`, [p.companyId,p.productId]);
    await this.db.execute(`DELETE FROM product_units WHERE company_id=? AND product_id=?`, [p.companyId,p.productId]);
    await this.db.execute(`DELETE FROM product_external_identifiers WHERE company_id=? AND product_id=?`, [p.companyId,p.productId]);
    await this.db.execute(`DELETE FROM product_barcodes WHERE company_id=? AND product_id=?`, [p.companyId,p.productId]);
    await this.db.execute(`DELETE FROM product_identifiers WHERE company_id=? AND product_id=?`, [p.companyId,p.productId]);
    await writeChildren(this.db, state);
  }
}
