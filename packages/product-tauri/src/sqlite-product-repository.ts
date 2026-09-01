import type { DatabaseSession } from "@argin/database";
import {
  ProductApplicationError,
  type ProductPersistenceState,
  type ProductRepository,
} from "@argin/product";

import { SqliteProductRepository as BaseSqliteProductRepository } from "./sqlite-product-store.ts";

function mapSqliteConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes("unique constraint failed: products.id")
  ) {
    throw new ProductApplicationError(
      "product.application.duplicate-identifier",
      "Product durable id already exists.",
    );
  }

  if (
    normalized.includes("unique constraint failed: products.company_id, products.code") ||
    normalized.includes("uq_products_company_code")
  ) {
    throw new ProductApplicationError(
      "product.application.code-conflict",
      "Product code already exists in the company scope.",
    );
  }

  if (
    normalized.includes("product_identifiers.company_id, product_identifiers.sku") ||
    normalized.includes("product_identifiers.company_id, product_identifiers.reference_code") ||
    normalized.includes("product_identifiers.company_id, product_identifiers.taxpayer_goods_service_id") ||
    normalized.includes("product_barcodes.company_id, product_barcodes.barcode") ||
    normalized.includes("product_external_identifiers.company_id, product_external_identifiers.scheme, product_external_identifiers.value") ||
    normalized.includes("uq_product_identifiers_company_sku") ||
    normalized.includes("uq_product_identifiers_company_reference_code") ||
    normalized.includes("uq_product_identifiers_company_taxpayer_id") ||
    normalized.includes("uq_product_barcodes_company_barcode") ||
    normalized.includes("uq_product_external_identifiers_company_scheme_value")
  ) {
    throw new ProductApplicationError(
      "product.application.duplicate-identifier",
      "Product identifier already exists in the company scope.",
    );
  }

  throw error;
}

export class SqliteProductRepository implements ProductRepository {
  private readonly inner: BaseSqliteProductRepository;

  constructor(database: DatabaseSession) {
    this.inner = new BaseSqliteProductRepository(database);
  }

  findById(companyId: string, productId: string): Promise<ProductPersistenceState | null> {
    return this.inner.findById(companyId, productId);
  }

  findByCode(companyId: string, code: string): Promise<ProductPersistenceState | null> {
    return this.inner.findByCode(companyId, code);
  }

  async add(state: ProductPersistenceState): Promise<void> {
    try {
      await this.inner.add(state);
    } catch (error) {
      if (error instanceof ProductApplicationError) throw error;
      mapSqliteConflict(error);
    }
  }

  async update(state: ProductPersistenceState, expectedVersion: number): Promise<void> {
    try {
      await this.inner.update(state, expectedVersion);
    } catch (error) {
      if (error instanceof ProductApplicationError) throw error;
      mapSqliteConflict(error);
    }
  }
}
