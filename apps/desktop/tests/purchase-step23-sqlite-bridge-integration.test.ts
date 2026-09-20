import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import {
  createPurchaseCommercialFactSyncEnvelope,
  createPurchaseCommercialTerms,
  createPurchaseDocument,
  createPurchaseDocumentSyncUpsertEnvelope,
  createPurchaseReceiptInvoiceMatchSyncEnvelope,
  createPurchaseValuationCostInputSyncEnvelope,
} from "@argin/purchase";
import {
  SqlitePurchaseCommercialFactRepository,
  SqlitePurchaseDocumentRepository,
  SqlitePurchaseIdempotencyRepository,
  SqlitePurchaseReceiptInvoiceMatchRepository,
  SqlitePurchaseUnitOfWork,
  SqlitePurchaseValuationCostInputRepository,
} from "@argin/purchase-tauri";

const migrationsDirectory = new URL("../src-tauri/migrations/", import.meta.url);

function migrationFiles() {
  return readdirSync(migrationsDirectory).filter(file => /^\\d{4}_.+\\.sql$/u.test(file)).sort();
}

function applyMigrations(sqlite: DatabaseSync, throughVersion = 32, afterVersion = 0) {
  for (const file of migrationFiles()) {
    const version = Number(file.slice(0, 4));
    if (version <= afterVersion) continue;
    if (version > throughVersion) break;
    sqlite.exec(readFileSync(new URL(file, migrationsDirectory), "utf8"));
  }
}

function executorFor(sqlite: DatabaseSync): DatabaseExecutor {
  const parameters = (values: readonly DatabaseValue[]) =>
    values.map(value => typeof value === "boolean" ? Number(value) : value);
  const session: DatabaseSession = {
    async execute(sql, values = []) {
      const result = sqlite.prepare(sql).run(...parameters(values));
      return { rowsAffected: Number(result.changes) };
    },
    async query<T>(sql: string, values: readonly DatabaseValue[] = []) {
      return sqlite.prepare(sql).all(...parameters(values)) as T[];
    },
    async queryOne<T>(sql: string, values: readonly DatabaseValue[] = []) {
      return (sqlite.prepare(sql).get(...parameters(values)) ?? null) as T | null;
    },
  };
  let active = false;
  return {
    ...session,
    async transaction(work) {
      assert.equal(active, false, "nested SQLite transaction is not allowed");
      active = true;
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(session);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      } finally {
        active = false;
      }
    },
    async close() { sqlite.close(); },
  };
}

function seedMaster(sqlite: DatabaseSync) {
  sqlite.exec(
    "INSERT INTO companies (id,code,legal_name,created_at,updated_at) VALUES ('company','C1','Company','2026-09-20','2026-09-20');" +
    "INSERT INTO branches (id,company_id,code,name,created_at,updated_at) VALUES ('branch','company','B1','Branch','2026-09-20','2026-09-20');" +
    "INSERT INTO fiscal_years (id,company_id,code,title,start_date,end_date,status,created_at,updated_at) VALUES ('year','company','1405','Year','2026-03-21','2027-03-20','open','2026-09-20','2026-09-20');" +
    "INSERT INTO fiscal_periods (id,fiscal_year_id,sequence,code,title,start_date,end_date,status,created_at,updated_at) VALUES ('period','year',1,'06','Period','2026-08-23','2026-09-22','open','2026-09-20','2026-09-20');" +
    "INSERT INTO parties (id,company_id,code,classification,legal_name,display_name,created_at,updated_at) VALUES ('supplier','company','S1','legal-entity','Supplier','Supplier','2026-09-20','2026-09-20');" +
    "INSERT INTO party_roles (company_id,party_id,role) VALUES ('company','supplier','supplier');" +
    "INSERT INTO products (id,company_id,code,title,kind,created_at,updated_at) VALUES ('product','company','P1','Product','product','2026-09-20','2026-09-20');" +
    "INSERT INTO product_units (company_id,product_id,unit_id,code,title,ratio_to_base,precision,rounding_mode,is_base) VALUES ('company','product','piece','PCS','Piece',1,0,'half-up',1);" +
    "INSERT INTO product_master_data (company_id,product_id,tax_treatment,stock_tracking) VALUES ('company','product','taxable',1);" +
    "INSERT INTO warehouses (id,company_id,code,title,kind,organizational_scope,created_at,updated_at) VALUES ('warehouse','company','W1','Warehouse','general','company','2026-09-20','2026-09-20');"
  );
}

const unit = {
  unitId: "piece", code: "PCS", title: "Piece", ratioToBase: "1", precision: 0,
  roundingMode: "half-up" as const, taxpayerUnitCode: "1621",
};

function purchaseFixture() {
  const terms = createPurchaseCommercialTerms({
    enteredQuantity: "2",
    enteredUnit: unit,
    baseUnit: unit,
    unitPrice: { amount: 1000, currency: "IRR" },
    discounts: [],
    charges: [],
    tax: { treatment: "taxable", rateBasisPoints: 1000 },
  });
  const document = createPurchaseDocument({
    scope: {
      companyId: "company",
      branchId: "branch",
      fiscalYearId: "year",
      fiscalPeriodId: "period",
      fiscalYearStartDate: "2026-03-21",
      fiscalYearEndDate: "2027-03-20",
      fiscalPeriodStartDate: "2026-08-23",
      fiscalPeriodEndDate: "2026-09-22",
      fiscalYearStatus: "open",
      fiscalPeriodStatus: "open",
      lockedThroughDate: null,
    },
    documentId: "invoice",
    companyId: "company",
    supplierId: "supplier",
    supplierSnapshot: {
      companyId: "company", supplierId: "supplier", code: "S1", displayName: "Supplier",
      classification: "legal-entity", nationalCode: null, nationalId: "10101234567",
      economicNumber: null, taxFileNumber: null,
    },
    documentType: "supplier-invoice",
    documentNumber: "PI-000001",
    businessDate: "2026-09-20",
    createdAt: "2026-09-20T08:00:00.000Z",
    lines: [{
      lineId: "invoice-line", position: 1, lineKind: "stock-product", itemType: "product",
      itemId: "product",
      itemSnapshot: {
        itemId: "product", itemType: "product", code: "P1", displayName: "Product",
        sku: null, referenceCode: null, taxpayerGoodsServiceId: "2720000014385",
        purchaseDescription: null, brand: null, model: null, stockTracking: true,
        taxTreatment: "taxable", vatRateBasisPoints: 1000,
        defaultPurchaseUnit: { unitId: "piece", code: "PCS", title: "Piece", taxpayerUnitCode: "1621" },
      },
      description: null, sourceReference: null,
    }],
  });
  const fact = {
    companyId: "company", purchaseDocumentId: "invoice", purchaseLineId: "invoice-line",
    commercialTerms: terms, revision: 1,
  };
  return { document, fact };
}

function seedConfirmedReceipt(sqlite: DatabaseSync) {
  sqlite.exec(
    "INSERT INTO inventory_documents (id,company_id,document_type,status,document_number,business_date,origin_branch_id,fiscal_year_id,fiscal_period_id,source_system,source_document_id,version,created_at,updated_at) " +
    "VALUES ('receipt','company','receipt','confirmed','REC-1','2026-09-20','branch','year','period','purchase','invoice',1,'2026-09-20T09:00:00Z','2026-09-20T09:00:00Z');" +
    "INSERT INTO inventory_document_lines (id,company_id,document_id,position,product_id,entered_quantity,base_quantity,entered_unit_id,base_unit_id,quantity_snapshot,warehouse_id,source_system,source_document_id,source_line_id) " +
    "VALUES ('receipt-line','company','receipt',1,'product','2','2','piece','piece','{}','warehouse','purchase','invoice','invoice-line');" +
    "INSERT INTO inventory_stock_movements (movement_id,company_id,document_id,line_id,product_id,warehouse_id,business_date,business_order,recorded_at,quantity_delta) " +
    "VALUES ('movement','company','receipt','receipt-line','product','warehouse','2026-09-20',1,'2026-09-20T09:01:00Z','2');"
  );
}

test("real SQLite upgrades from Phase 21 through Purchase migrations without losing existing data", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    applyMigrations(sqlite, 29);
    sqlite.prepare("INSERT INTO companies(id,code,legal_name,created_at,updated_at) VALUES('preexisting','OLD','Existing','2026-09-20','2026-09-20')").run();
    applyMigrations(sqlite, 32, 29);

    assert.equal(sqlite.prepare("SELECT legal_name FROM companies WHERE id='preexisting'").get()?.legal_name, "Existing");
    for (const table of [
      "purchase_documents", "purchase_document_lines", "purchase_document_lifecycle",
      "purchase_commercial_facts", "purchase_receipt_invoice_matches",
      "purchase_valuation_cost_inputs", "purchase_idempotency",
    ]) {
      assert.equal(sqlite.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name=?").get(table)?.n, 1, table);
    }
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pragma_table_info('purchase_documents') WHERE name='locked_through_date'").get()?.n, 1);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM pragma_table_info('purchase_idempotency') WHERE name='result_json'").get()?.n, 1);
  } finally {
    sqlite.close();
  }
});

test("real Purchase UoW rolls back document and commercial fact together", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = executorFor(sqlite);
  try {
    applyMigrations(sqlite);
    seedMaster(sqlite);
    sqlite.exec("CREATE TRIGGER force_purchase_fact_failure BEFORE INSERT ON purchase_commercial_facts BEGIN SELECT RAISE(ABORT,'forced commercial failure'); END;");
    const { document, fact } = purchaseFixture();
    const uow = new SqlitePurchaseUnitOfWork(database);

    await assert.rejects(() => uow.execute(async context => {
      await context.documents.add(document);
      await context.commercialFacts.addBatch([fact]);
    }), /forced commercial failure/u);

    assert.equal(sqlite.prepare("SELECT count(*) n FROM purchase_documents").get()?.n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM purchase_document_lines").get()?.n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM purchase_commercial_facts").get()?.n, 0);
  } finally {
    await database.close();
  }
});

test("Purchase aggregate and replay evidence survive a real SQLite restart", async () => {
  const path = join(tmpdir(), "argin-purchase-step23-" + process.pid + "-" + Date.now() + ".db");
  if (existsSync(path)) rmSync(path);
  try {
    {
      const sqlite = new DatabaseSync(path);
      const database = executorFor(sqlite);
      applyMigrations(sqlite);
      seedMaster(sqlite);
      const { document, fact } = purchaseFixture();
      await new SqlitePurchaseUnitOfWork(database).execute(async context => {
        await context.documents.add(document);
        await context.commercialFacts.addBatch([fact]);
        await context.idempotency.add({
          companyId: "company", requestId: "request-create", operationId: "operation-create",
          operation: "create:invoice", payloadFingerprint: "fingerprint-create",
          outcomeKind: "document", outcomeId: "invoice", outcomeVersion: 1, outcomeStatus: "draft",
          resultJson: JSON.stringify(document), recordedAt: "2026-09-20T08:00:00.000Z",
        });
      });
      await database.close();
    }

    {
      const sqlite = new DatabaseSync(path);
      const database = executorFor(sqlite);
      const loaded = await new SqlitePurchaseDocumentRepository(database).findById("company", "invoice");
      const replay = await new SqlitePurchaseIdempotencyRepository(database).findByRequestId("company", "request-create");
      assert.equal(loaded?.documentNumber, "PI-000001");
      assert.equal(loaded?.scope.fiscalYearStartDate, "2026-03-21");
      assert.equal(loaded?.scope.fiscalPeriodEndDate, "2026-09-22");
      assert.equal(loaded?.lines[0]?.itemSnapshot.displayName, "Product");
      assert.equal(replay?.operationId, "operation-create");
      assert.deepEqual(JSON.parse(replay!.resultJson), JSON.parse(JSON.stringify(purchaseFixture().document)));

      await assert.rejects(() => new SqlitePurchaseIdempotencyRepository(database).add({
        ...replay!, payloadFingerprint: "changed",
      }), /PURCHASE_APP_IDEMPOTENCY_CONFLICT/u);
      await database.close();
    }
  } finally {
    if (existsSync(path)) rmSync(path);
  }
});

test("persisted Purchase, Match and Cost Input facts round-trip through Bridge envelopes", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = executorFor(sqlite);
  try {
    applyMigrations(sqlite);
    seedMaster(sqlite);
    seedConfirmedReceipt(sqlite);
    const { document, fact } = purchaseFixture();

    await new SqlitePurchaseUnitOfWork(database).execute(async context => {
      await context.documents.add(document);
      await context.commercialFacts.addBatch([fact]);
    });

    const match = {
      matchId: "match", companyId: "company", invoiceDocumentId: "invoice",
      invoiceLineId: "invoice-line", receiptDocumentId: "receipt", receiptLineId: "receipt-line",
      productId: "product", matchedBaseQuantity: "2",
    };
    await new SqlitePurchaseReceiptInvoiceMatchRepository(database).add(match);

    const cost = {
      costInputId: "purchase-cost:movement", companyId: "company", movementId: "movement",
      receiptDocumentId: "receipt", receiptLineId: "receipt-line", productId: "product",
      sources: [{
        matchId: "match", purchaseDocumentId: "invoice", purchaseLineId: "invoice-line",
        receiptDocumentId: "receipt", receiptLineId: "receipt-line", productId: "product",
        matchedBaseQuantity: "2", allocatedBaseCost: 2000,
      }],
      basis: {
        basisLineId: "purchase-cost:movement", movementId: "movement", productId: "product",
        warehouseId: "warehouse", quantity: "2", currency: "IRR", baseCost: 2000,
        landedCost: 0, totalCost: 2000, unitCost: "1000", allocations: [] as const,
      },
    };
    await new SqlitePurchaseValuationCostInputRepository(database).add(cost);

    const persistedDocument = await new SqlitePurchaseDocumentRepository(database).findById("company", "invoice");
    const persistedFact = await new SqlitePurchaseCommercialFactRepository(database).findByLine("company", "invoice", "invoice-line");
    const persistedMatch = await new SqlitePurchaseReceiptInvoiceMatchRepository(database).findById("company", "match");
    const persistedCost = await new SqlitePurchaseValuationCostInputRepository(database).findByMovement("company", "movement");
    assert.ok(persistedDocument && persistedFact && persistedMatch && persistedCost);

    const metadata = {
      operationId: "operation-sync", requestId: "request-sync",
      payloadFingerprint: "sha256:step23", changedAt: "2026-09-20T10:00:00.000Z",
      origin: { sourceSystem: "argin-desktop", sourceInstanceId: "device-1" },
    } as const;
    const envelopes = [
      createPurchaseDocumentSyncUpsertEnvelope({
        ...metadata,
        reference: { companyId: "company", branchId: "branch", documentId: "invoice", documentNumber: "PI-000001" },
        snapshot: persistedDocument,
      }),
      createPurchaseCommercialFactSyncEnvelope({ ...metadata, branchId: "branch", snapshot: persistedFact }),
      createPurchaseReceiptInvoiceMatchSyncEnvelope({ ...metadata, branchId: "branch", snapshot: persistedMatch }),
      createPurchaseValuationCostInputSyncEnvelope({ ...metadata, branchId: "branch", localRevision: 1, snapshot: persistedCost }),
    ];

    assert.deepEqual(JSON.parse(JSON.stringify(envelopes)), envelopes);
    assert.deepEqual(envelopes.map(item => item.entity), [
      "purchase-document", "purchase-commercial-fact",
      "purchase-receipt-invoice-match", "purchase-valuation-cost-input",
    ]);
    assert.deepEqual(envelopes[3]!.dependencies.map(item => item.entity), [
      "inventory-movement", "inventory-document", "inventory-line", "product", "warehouse",
      "purchase-match", "purchase-document", "purchase-line",
    ]);
  } finally {
    await database.close();
  }
});


test("real SQLite constraints enforce numbering, append-only facts and optimistic concurrency", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const database = executorFor(sqlite);
  try {
    applyMigrations(sqlite);
    seedMaster(sqlite);
    seedConfirmedReceipt(sqlite);
    const { document, fact } = purchaseFixture();
    const documents = new SqlitePurchaseDocumentRepository(database);

    await new SqlitePurchaseUnitOfWork(database).execute(async context => {
      await context.documents.add(document);
      await context.commercialFacts.addBatch([fact]);
    });

    const duplicate = createPurchaseDocument({
      ...document,
      documentId: "invoice-duplicate",
      createdAt: "2026-09-20T08:05:00.000Z",
    });
    await assert.rejects(
      () => documents.add(duplicate),
      (error: unknown) => error instanceof Error && "field" in error && error.field === "documentNumber",
    );

    const matchRepository = new SqlitePurchaseReceiptInvoiceMatchRepository(database);
    await matchRepository.add({
      matchId: "immutable-match", companyId: "company", invoiceDocumentId: "invoice",
      invoiceLineId: "invoice-line", receiptDocumentId: "receipt", receiptLineId: "receipt-line",
      productId: "product", matchedBaseQuantity: "2",
    });
    assert.throws(
      () => sqlite.prepare("UPDATE purchase_receipt_invoice_matches SET matched_base_quantity='1' WHERE match_id='immutable-match'").run(),
      /append-only/u,
    );
    assert.throws(
      () => sqlite.prepare("DELETE FROM purchase_receipt_invoice_matches WHERE match_id='immutable-match'").run(),
      /append-only/u,
    );

    const idempotency = new SqlitePurchaseIdempotencyRepository(database);
    await idempotency.add({
      companyId: "company", requestId: "request-immutable", operationId: "operation-immutable",
      operation: "create:invoice", payloadFingerprint: "fingerprint-immutable",
      outcomeKind: "document", outcomeId: "invoice", outcomeVersion: 1, outcomeStatus: "draft",
      resultJson: JSON.stringify(document), recordedAt: "2026-09-20T08:10:00.000Z",
    });
    assert.throws(
      () => sqlite.prepare("UPDATE purchase_idempotency SET payload_fingerprint='changed' WHERE request_id='request-immutable'").run(),
      /append-only/u,
    );

    const stale = { ...document, description: "stale", version: 2, updatedAt: "2026-09-20T08:20:00.000Z" };
    await documents.update(stale, 1);
    await assert.rejects(
      () => documents.update({ ...stale, description: "second", version: 2 }, 1),
      (error: unknown) => error instanceof Error && "code" in error && error.code === "PURCHASE_APP_VERSION_CONFLICT",
    );
  } finally {
    await database.close();
  }
});
