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
import type { TaxpayerUnitReferenceValidator } from "../../application/contracts/product-reference-validation.ts";
import type {
  ProductUnitOfWork,
  ProductUnitOfWorkRepositories,
} from "../../application/contracts/product-unit-of-work.ts";
import { ProductSqliteRepository } from "./product-sqlite-repository.ts";
import type {
  ProductSqliteConnection,
  ProductSqliteTransactionManager,
} from "./sqlite-contracts.ts";

export class ProductSqliteUnitOfWork implements ProductUnitOfWork {
  constructor(private readonly transactions: ProductSqliteTransactionManager) {}

  run<T>(operation: (repositories: ProductUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    return this.transactions.transaction((connection) =>
      operation({ products: new ProductSqliteRepository(connection) }),
    );
  }
}

export class ProductSqliteDuplicateDetector implements ProductDuplicateDetector {
  constructor(private readonly db: ProductSqliteConnection) {}

  async detect(probe: ProductDuplicateProbe): Promise<readonly ProductDuplicateCandidate[]> {
    const results = new Map<string, ProductDuplicateCandidate>();
    const exclude = probe.excludeProductId ?? "";
    const collect = async (
      reason: ProductDuplicateCandidate["reason"],
      strength: ProductDuplicateCandidate["strength"],
      sql: string,
      params: readonly unknown[],
    ) => {
      const rows = await this.db.select<Record<string, unknown> & { id: string; code: string; title: string }>(sql, params);
      for (const row of rows) {
        results.set(`${row.id}\u0000${reason}`, Object.freeze({
          productId: row.id, code: row.code, title: row.title, reason, strength,
        }));
      }
    };
    const base = `p.company_id=? AND p.id<>? AND p.deleted_at IS NULL`;
    await collect("code", "hard", `SELECT p.id,p.code,p.title FROM products p WHERE ${base} AND p.code=? LIMIT 20`, [probe.companyId, exclude, probe.code]);
    if (probe.identifiers.sku) await collect("sku", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.sku=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.sku]);
    if (probe.identifiers.referenceCode) await collect("reference-code", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.reference_code=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.referenceCode]);
    if (probe.identifiers.taxpayerGoodsServiceId) await collect("taxpayer-goods-service-id", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_identifiers i ON i.company_id=p.company_id AND i.product_id=p.id WHERE ${base} AND i.taxpayer_goods_service_id=? LIMIT 20`, [probe.companyId, exclude, probe.identifiers.taxpayerGoodsServiceId]);
    for (const barcode of probe.identifiers.barcodes) await collect("barcode", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_barcodes b ON b.company_id=p.company_id AND b.product_id=p.id WHERE ${base} AND b.barcode=? LIMIT 20`, [probe.companyId, exclude, barcode]);
    for (const identifier of probe.identifiers.externalIdentifiers) await collect("external-identifier", "hard", `SELECT p.id,p.code,p.title FROM products p JOIN product_external_identifiers e ON e.company_id=p.company_id AND e.product_id=p.id WHERE ${base} AND e.scheme=? AND e.value=? LIMIT 20`, [probe.companyId, exclude, identifier.scheme, identifier.value]);
    if (probe.title.trim()) await collect("title", "advisory", `SELECT p.id,p.code,p.title FROM products p WHERE ${base} AND p.title=? LIMIT 20`, [probe.companyId, exclude, probe.title.trim()]);
    if (probe.brand || probe.model) await collect("brand-model", "advisory", `SELECT p.id,p.code,p.title FROM products p JOIN product_master_data m ON m.company_id=p.company_id AND m.product_id=p.id WHERE ${base} AND COALESCE(m.brand,'')=COALESCE(?,'') AND COALESCE(m.model,'')=COALESCE(?,'') LIMIT 20`, [probe.companyId, exclude, probe.brand, probe.model]);
    return Object.freeze([...results.values()]);
  }
}

export class ProductSqliteTaxpayerUnitValidator implements TaxpayerUnitReferenceValidator {
  constructor(private readonly db: ProductSqliteConnection) {}

  async isActiveCode(code: string): Promise<boolean> {
    const rows = await this.db.select<Record<string, unknown> & { found: number }>(
      `SELECT 1 AS found FROM taxpayer_units WHERE code=? AND is_active=1 LIMIT 1`,
      [code.trim()],
    );
    return rows.length === 1;
  }
}

export class ProductSqliteIdempotencyExecutor implements ProductIdempotencyExecutor {
  constructor(private readonly transactions: ProductSqliteTransactionManager) {}

  async run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T> {
    return this.transactions.transaction(async (db) => {
      const existing = await db.select<Record<string, unknown> & { status: string; result_json: string | null }>(
        `SELECT status,result_json FROM product_idempotency WHERE scope=? AND request_id=? LIMIT 1`,
        [scope, requestId],
      );
      const record = existing[0];
      if (record?.status === "completed" && record.result_json !== null) return JSON.parse(record.result_json) as T;
      if (record?.status === "in-progress") throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.concurrencyConflict);
      await db.execute(`INSERT INTO product_idempotency (scope,request_id,status,result_json,created_at,completed_at) VALUES (?,?,'in-progress',NULL,datetime('now'),NULL)`, [scope, requestId]);
      try {
        const result = await operation();
        await db.execute(`UPDATE product_idempotency SET status='completed',result_json=?,completed_at=datetime('now') WHERE scope=? AND request_id=?`, [JSON.stringify(result), scope, requestId]);
        return result;
      } catch (error) {
        await db.execute(`DELETE FROM product_idempotency WHERE scope=? AND request_id=?`, [scope, requestId]);
        throw error;
      }
    });
  }
}
