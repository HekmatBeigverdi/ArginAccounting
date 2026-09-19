import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import type { AuditServices } from "../src/composition/audit/create-audit-services.ts";
import { purchaseLineDrafts, purchaseLineInput } from "../src/pages/purchase/purchase-draft-form.ts";

// Older Fiscal modules use extensionless relative imports under Vite.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { createPurchaseWorkspaceServices } = await import("../src/composition/purchase/create-purchase-workspace-services.ts");
const purchase = await import("@argin/purchase");
const { SqlitePurchaseDocumentRepository } = await import("@argin/purchase-tauri");
const inventory = await import("@argin/inventory");
const { SqliteInventoryDocumentRepository, SqliteInventoryUnitOfWork } = await import("@argin/inventory-tauri");
hooks.deregister();

function fixture(permissions = ["system.full-access"]) {
  const sqlite = new DatabaseSync(":memory:");
  const migrations = new URL("../src-tauri/migrations/", import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, migrations), "utf8"));
  }
  sqlite.exec(`
    INSERT INTO companies (id, code, legal_name, created_at, updated_at)
      VALUES ('company', 'C1', 'Company', '2026-09-19', '2026-09-19');
    INSERT INTO branches (id, company_id, code, name, created_at, updated_at)
      VALUES ('branch', 'company', 'B1', 'Branch', '2026-09-19', '2026-09-19');
    INSERT INTO fiscal_years (id, company_id, code, title, start_date, end_date, status, created_at, updated_at)
      VALUES ('year', 'company', '1405', 'Year', '2026-03-21', '2027-03-20', 'open', '2026-09-19', '2026-09-19');
    INSERT INTO fiscal_periods (id, fiscal_year_id, sequence, code, title, start_date, end_date, created_at, updated_at)
      VALUES ('period', 'year', 1, '06', 'Period', '2026-08-23', '2026-09-22', '2026-09-19', '2026-09-19');
    INSERT INTO parties (id, company_id, code, classification, legal_name, display_name, created_at, updated_at)
      VALUES ('supplier', 'company', 'S1', 'legal-entity', 'Supplier', 'Supplier', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z');
    INSERT INTO party_roles (company_id, party_id, role) VALUES ('company', 'supplier', 'supplier');
    INSERT INTO products (id, company_id, code, title, kind, created_at, updated_at)
      VALUES ('product', 'company', 'P1', 'Product', 'product', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z');
    INSERT INTO product_units (company_id, product_id, unit_id, code, title, ratio_to_base, precision, rounding_mode, is_base)
      VALUES ('company', 'product', 'piece', 'PCS', 'Piece', 1, 0, 'half-up', 1);
    INSERT INTO product_master_data (company_id, product_id, tax_treatment, stock_tracking)
      VALUES ('company', 'product', 'exempt', 1);
  `);
  const parameters = (values: readonly DatabaseValue[]) => values.map(value => typeof value === "boolean" ? Number(value) : value);
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
  let inTransaction = false;
  const database: DatabaseExecutor = {
    ...session,
    async transaction(work) {
      // Production queues nested calls forever; fail immediately to identify the deadlock.
      assert.equal(inTransaction, false, "nested transaction would deadlock the desktop executor");
      inTransaction = true;
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(session);
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      } finally { inTransaction = false; }
    },
    async close() { sqlite.close(); },
  };
  const services = createPurchaseWorkspaceServices({
    database,
    actor: { id: "user", displayName: "User", permissions, branchIds: ["branch"] },
    audit: { async recordAuditEntry() {} } as unknown as AuditServices,
  });
  const input = {
    companyId: "company", branchId: "branch", fiscalYearId: "year", supplierId: "supplier",
    documentType: "supplier-invoice" as const, businessDate: "2026-09-19", description: null,
    lines: [{ productId: "product", quantity: "2", unitId: "piece", unitPrice: 1000,
      discountRateBasisPoints: 0, chargeAmount: 0, description: null }],
  };
  return { sqlite, database, services, input };
}

test("purchase receipt staging reuses its linked draft and later reports the confirmed receipt", async (t) => {
  const { sqlite, database, services, input } = fixture();
  t.after(() => sqlite.close());
  let document = await services.create(input);
  const action = { occurredAt: document.createdAt, actorUserId: "user" };
  document = purchase.submitPurchaseDocument(document, action);
  document = purchase.approvePurchaseDocument(document, action);
  document = purchase.confirmPurchaseDocument(document, action);
  await new SqlitePurchaseDocumentRepository(database).update(document, 1);
  sqlite.exec(`INSERT INTO warehouses (id, company_id, code, title, kind, organizational_scope, created_at, updated_at)
    VALUES ('warehouse', 'company', 'W1', 'Warehouse', 'general', 'company', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z');`);
  const first = await services.stageInventoryReceipt(document, "warehouse");
  assert.equal(first.status, "draft");
  const repeated = await services.stageInventoryReceipt(document, "warehouse");
  assert.equal(repeated.inventoryDocumentId, first.inventoryDocumentId);
  const repository = new SqliteInventoryDocumentRepository(database);
  let receipt = await repository.findById("company", first.inventoryDocumentId);
  assert.ok(receipt);
  receipt = inventory.rehydrateInventoryDocument({ ...receipt, documentNumber: "000008" });
  const receiptAction = { occurredAt: receipt.createdAt, actorUserId: "user" };
  receipt = inventory.submitInventoryDocument(receipt, receiptAction);
  receipt = inventory.approveInventoryDocument(receipt, receiptAction);
  receipt = inventory.confirmInventoryDocument(receipt, receiptAction);
  await repository.update(receipt, 1);
  const afterConfirmation = await services.stageInventoryReceipt(document, "warehouse");
  assert.equal(afterConfirmation.inventoryDocumentId, receipt.documentId);
  assert.equal(afterConfirmation.status, "confirmed");
  const detail = await services.get("company", document.documentId);
  assert.equal(detail?.inventoryReceipt?.documentNumber, "000008");
  assert.equal(detail?.inventoryReceipt?.status, "confirmed");
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM inventory_documents").get()?.count, 1);
  await assert.rejects(new inventory.InventoryDraftService(new SqliteInventoryUnitOfWork(database)).create({
    companyId: "company", requestKey: "duplicate-source", payloadFingerprint: "duplicate-source",
    document: { ...receipt, documentId: "another-receipt", documentNumber: null },
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "inventory.application.source-document-duplicate");
  await assert.rejects(new inventory.InventoryDraftService(new SqliteInventoryUnitOfWork(database)).create({
    companyId: "company", requestKey: "duplicate-number", payloadFingerprint: "duplicate-number",
    document: { ...receipt, documentId: "duplicate-number", sourceReference: null },
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "inventory.application.document-number-duplicate");
});

test("desktop creates and reloads numbered purchase invoices without a nested transaction", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const first = await services.create(input);
  assert.equal(first.documentNumber, "PI-000001");
  assert.equal(first.status, "draft");
  const detail = await services.get("company", first.documentId);
  assert.equal(detail?.totals.grandTotal, 2000);
  assert.equal((await services.create(input)).documentNumber, "PI-000002");
  assert.equal((await services.list("company", "branch", "")).length, 2);
});

test("draft editing persists header and replacement lines while retaining document identity and number", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const original = await services.create(input);
  sqlite.exec(`INSERT INTO parties (id, company_id, code, classification, legal_name, display_name, created_at, updated_at)
    VALUES ('supplier2', 'company', 'S2', 'legal-entity', 'Supplier 2', 'Supplier 2', '2026-09-19T00:00:00Z', '2026-09-19T00:00:00Z');
    INSERT INTO party_roles (company_id, party_id, role) VALUES ('company', 'supplier2', 'supplier');`);
  const edited = await services.edit(original, {
    ...input, supplierId: "supplier2", businessDate: "2026-09-20", description: "Updated invoice",
    lines: [
      { ...input.lines[0]!, quantity: "3", unitPrice: 2000, discountRateBasisPoints: 1000, description: "Changed line" },
      { ...input.lines[0]!, quantity: "1", unitPrice: 500 },
    ],
  });
  assert.equal(edited.documentId, original.documentId);
  assert.equal(edited.documentNumber, "PI-000001");
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.version, original.version + 1);
  const detail = await services.get("company", original.documentId);
  assert.equal(detail?.document.description, "Updated invoice");
  assert.equal(detail?.document.businessDate, "2026-09-20");
  assert.equal(detail?.document.supplierId, "supplier2");
  assert.equal(detail?.document.lines.length, 2);
  assert.equal(detail?.commercialFacts.length, 2);
  assert.equal(detail?.totals.grandTotal, 5900);
  assert.equal((await services.list("company", "branch", "")).length, 1);
  assert.equal((await services.create(input)).documentNumber, "PI-000002");
});

test("draft edit rejects stale versions and cancelled documents", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const original = await services.create(input);
  const edited = await services.edit(original, { ...input, description: "First edit" });
  await assert.rejects(services.edit(original, { ...input, description: "Stale edit" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "PURCHASE_APP_VERSION_CONFLICT");
  const cancelled = await services.cancel(edited, "Cancel test");
  await assert.rejects(services.edit(cancelled, input),
    (error: unknown) => error instanceof Error && "field" in error && error.field === "status");
  assert.equal((await services.get("company", original.documentId))?.document.description, "First edit");
});

test("draft edit requires its own permission", async (t) => {
  const { sqlite, services, input } = fixture(["purchases.documents.create", "purchases.documents.view"]);
  t.after(() => sqlite.close());
  const original = await services.create(input);
  await assert.rejects(services.edit(original, input),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "PURCHASE_APP_UNAUTHORIZED");
  assert.equal((await services.get("company", original.documentId))?.document.version, 1);
});

test("editing a draft preserves the existing line tax snapshot when master data changes", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const original = await services.create(input);
  sqlite.exec("UPDATE product_master_data SET tax_treatment='taxable', vat_rate_basis_points=1000");
  await services.edit(original, { ...input, description: "Header edit", lines: [
    { ...input.lines[0]!, lineId: original.lines[0]!.lineId },
  ] });
  const detail = await services.get("company", original.documentId);
  assert.equal(detail?.document.lines[0]?.lineId, original.lines[0]?.lineId);
  assert.equal(detail?.document.lines[0]?.itemSnapshot.taxTreatment, "exempt");
  assert.equal(detail?.totals.grandTotal, 2000);
});

test("edit form reloads commercial values and saves Persian numeric changes", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const original = await services.create({ ...input, lines: [
    { ...input.lines[0]!, unitPrice: 1200, discountRateBasisPoints: 1250, chargeAmount: 100, description: "Original line" },
  ] });
  const detail = await services.get("company", original.documentId);
  assert.ok(detail);
  const [draft] = purchaseLineDrafts(detail);
  assert.ok(draft);
  assert.equal(draft.quantity, "2");
  assert.equal(draft.unitPrice, "1200");
  assert.equal(draft.discountPercent, "12.5");
  assert.equal(draft.chargeAmount, "100");
  assert.equal(draft.description, "Original line");
  assert.deepEqual(purchaseLineInput(draft), {
    lineId: original.lines[0]!.lineId, productId: "product", quantity: "2", unitId: "piece",
    unitPrice: 1200, discountRateBasisPoints: 1250, chargeAmount: 100, description: "Original line",
  });
  await services.edit(original, { ...input, lines: [purchaseLineInput({ ...draft,
    quantity: "۳", unitPrice: "۲۰۰۰", discountPercent: "۱۰", chargeAmount: "۵۰", description: "Changed line",
  })] });
  const updated = await services.get("company", original.documentId);
  assert.equal(updated?.totals.grandTotal, 5450);
  assert.equal(updated?.document.lines[0]?.description, "Changed line");
});

test("failed draft edit rolls back header, lines and commercial facts together", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  const original = await services.create(input);
  sqlite.exec(`CREATE TRIGGER fail_edit BEFORE INSERT ON purchase_commercial_facts
    BEGIN SELECT RAISE(ABORT, 'simulated edit failure'); END;`);
  await assert.rejects(services.edit(original, { ...input, description: "Must roll back", lines: [
    { ...input.lines[0]!, quantity: "9" },
  ] }), /simulated edit failure/);
  const detail = await services.get("company", original.documentId);
  assert.equal(detail?.document.version, 1);
  assert.equal(detail?.document.description, null);
  assert.equal(detail?.document.lines[0]?.lineId, original.lines[0]?.lineId);
  assert.equal(detail?.totals.grandTotal, 2000);
  sqlite.exec("DROP TRIGGER fail_edit");
  assert.equal((await services.edit(original, input)).version, 2);
});

test("failed purchase persistence rolls back its number reservation and permits retry", async (t) => {
  const { sqlite, services, input } = fixture();
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TRIGGER fail_purchase BEFORE INSERT ON purchase_documents
    BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;`);
  await assert.rejects(services.create(input), /simulated write failure/);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM purchase_documents").get()?.count, 0);
  assert.equal(sqlite.prepare("SELECT count(*) AS count FROM number_series").get()?.count, 0);
  sqlite.exec("DROP TRIGGER fail_purchase");
  assert.equal((await services.create(input)).documentNumber, "PI-000001");
});

test("purchase creation identifies the invalid prerequisite without persisting a document", async (t) => {
  const cases = [
    { name: "missing fiscal year", patch: { fiscalYearId: "missing" }, field: "fiscalYearId" },
    { name: "date outside selected fiscal year", patch: { businessDate: "2027-09-19" }, field: "businessDate" },
    { name: "missing period", sql: "DELETE FROM fiscal_periods", field: "fiscalPeriodId" },
    { name: "missing supplier", patch: { supplierId: "missing" }, field: "supplierId" },
    { name: "inactive supplier", sql: "UPDATE parties SET status = 'inactive'", field: "supplierStatus" },
    { name: "supplier role removed", sql: "DELETE FROM party_roles", field: "supplierRole" },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, async (t) => {
      const { sqlite, services, input } = fixture();
      t.after(() => sqlite.close());
      if (scenario.sql) sqlite.exec(scenario.sql);
      await assert.rejects(services.create({ ...input, ...scenario.patch }),
        (error: unknown) => error instanceof Error && "field" in error && error.field === scenario.field);
      assert.equal(sqlite.prepare("SELECT count(*) AS count FROM purchase_documents").get()?.count, 0);
      assert.equal(sqlite.prepare("SELECT count(*) AS count FROM number_series").get()?.count, 0);
    });
  }
});
