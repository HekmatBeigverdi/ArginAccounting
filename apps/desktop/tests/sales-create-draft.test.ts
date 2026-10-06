import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";
import { SqliteSalesDocumentRepository } from "@argin/sales-tauri";
import { createSalesDraft, type SalesDraftInput, type SalesDraftPorts } from "../src/composition/sales/create-sales-draft.ts";

// Fiscal modules use extensionless relative imports under Vite.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL) {
      const candidate = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const input: SalesDraftInput = {
  submissionId: "submission-1", companyId: "company-1", branchId: "branch-1", fiscalYearId: "year-1",
  customerId: "customer-1", documentType: "sales-invoice", businessDate: "2026-10-04",
  description: "فروش آزمایشی", relatedDocumentId: "",
  lines: [{ productId: "product-1", quantity: 2, unitPrice: 1000, discountRateBasisPoints: 1000, taxRateBasisPoints: 900 }],
};
const actor = { id: "user-1", displayName: "کاربر", permissions: ["sales.documents.create"], branchIds: ["branch-1"] };

function setup() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE companies (id TEXT PRIMARY KEY); INSERT INTO companies VALUES ('company-1'); CREATE TABLE branches (id TEXT PRIMARY KEY); INSERT INTO branches VALUES ('branch-1'); CREATE TABLE fiscal_years (id TEXT PRIMARY KEY); INSERT INTO fiscal_years VALUES ('year-1'); CREATE TABLE test_audit (action TEXT)");
  sqlite.exec(readFileSync(new URL("../src-tauri/migrations/0035_sales_workflow.sql", import.meta.url), "utf8"));
  sqlite.exec(readFileSync(new URL("../src-tauri/migrations/0036_sales_below_cost_guard.sql", import.meta.url), "utf8"));
  const fiscalMigration = readFileSync(new URL("../src-tauri/migrations/0003_fiscal_management.sql", import.meta.url), "utf8");
  sqlite.exec(fiscalMigration.slice(fiscalMigration.indexOf("CREATE TABLE number_series")));
  const params = (values: readonly DatabaseValue[]) => values.map(value => typeof value === "boolean" ? Number(value) : value);
  const session: DatabaseSession = {
    async execute(sql, values = []) { return { rowsAffected: Number(sqlite.prepare(sql).run(...params(values)).changes) }; },
    async query<T>(sql: string, values: readonly DatabaseValue[] = []) { return sqlite.prepare(sql).all(...params(values)) as T[]; },
    async queryOne<T>(sql: string, values: readonly DatabaseValue[] = []) { return (sqlite.prepare(sql).get(...params(values)) ?? null) as T | null; },
  };
  const database: DatabaseExecutor = {
    ...session,
    async close() { sqlite.close(); },
    async transaction(work) {
      sqlite.exec("BEGIN IMMEDIATE");
      try { const result = await work(session); sqlite.exec("COMMIT"); return result; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const ports: SalesDraftPorts = {
    async validateScope() {},
    async getCustomer() { return { id: "customer-1", companyId: "company-1", code: "C1", displayName: "مشتری", status: "active", classification: "natural-person", roles: ["customer"] }; },
    async getProduct() { return { productId: "product-1", companyId: "company-1", title: "کالا", kind: "product", status: "active", sellable: true, stockTracking: true }; },
    async recordAudit(db, event) { await db.execute("INSERT INTO test_audit VALUES (?)", [event.action]); },
  };
  return { database, ports, sqlite };
}

test("create persists a draft, commercial terms, audit and replay record; reload and retry preserve identity", async () => {
  const { database, ports, sqlite } = setup();
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const reloaded = await new SqliteSalesDocumentRepository(database).findById(input.companyId, created.documentId);
    assert.deepEqual(reloaded?.document, created);
    assert.equal(reloaded?.lifecycle.status, "draft");
    assert.equal(reloaded?.version, 1);
    assert.equal(created.customer.displayName, "مشتری");
    assert.equal(created.lines[0]?.lineKind, "stock-product");
    assert.equal(created.lines[0]?.commercialTerms?.quantity, 2);
    assert.equal(created.lines[0]?.commercialTerms?.discounts[0]?.value, 1000);
    assert.deepEqual(await createSalesDraft(database, actor, input, ports), created);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_documents").get()?.n, 1);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM test_audit").get()?.n, 1);
    await assert.rejects(createSalesDraft(database, actor, { ...input, description: "changed" }, ports));
  } finally { await database.close(); }
});

for (const invalidActor of [{ ...actor, permissions: [] }, { ...actor, branchIds: [] }]) {
  test("create denies missing permission or branch access before writing", async () => {
    const { database, ports, sqlite } = setup();
    try {
      await assert.rejects(createSalesDraft(database, invalidActor, input, ports));
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_documents").get()?.n, 0);
    } finally { await database.close(); }
  });
}

for (const invalid of [
  { ...input, lines: [] },
  { ...input, businessDate: "2026-02-30" },
  { ...input, lines: [{ ...input.lines[0]!, quantity: 0 }] },
  { ...input, lines: [{ ...input.lines[0]!, unitPrice: -1 }] },
  { ...input, documentType: "sales-return" as const },
  { ...input, documentType: "sales-correction" as const, relatedDocumentId: "missing" },
]) {
  test("invalid drafts leave no partial document or replay record", async () => {
    const { database, ports, sqlite } = setup();
    try {
      await assert.rejects(createSalesDraft(database, actor, invalid, ports));
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_documents").get()?.n, 0);
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_idempotency").get()?.n, 0);
    } finally { await database.close(); }
  });
}

for (const failure of ["scope", "customer", "product", "audit"] as const) {
  test(`${failure} failure rolls back the draft and idempotency`, async () => {
    const { database, ports, sqlite } = setup();
    if (failure === "scope") ports.validateScope = async () => { throw new Error("دوره مالی بسته است"); };
    if (failure === "customer") ports.getCustomer = async () => ({ id: "customer-1", companyId: "other", code: "C1", displayName: "مشتری", status: "active", classification: "natural-person", roles: ["customer"] });
    if (failure === "product") ports.getProduct = async () => ({ productId: "product-1", companyId: "company-1", title: "کالا", kind: "product", status: "active", sellable: false, stockTracking: true });
    if (failure === "audit") ports.recordAudit = async () => { throw new Error("audit unavailable"); };
    try {
      await assert.rejects(createSalesDraft(database, actor, input, ports));
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_documents").get()?.n, 0);
      assert.equal(sqlite.prepare("SELECT count(*) AS n FROM sales_idempotency").get()?.n, 0);
    } finally { await database.close(); }
  });
}

test("return drafts preserve original discounts, charges and taxes with durable line references", async () => {
  const { createSalesDocument, createSalesLifecycle, transitionSalesLifecycle } = await import("@argin/sales");
  const { database, ports } = setup();
  try {
    const original = createSalesDocument({
      ...input, documentId: "original", customer: { partyId: "customer-1", code: "C1", displayName: "مشتری" },
      lines: [{ lineId: "source-line", position: 1, lineKind: "stock-product", productId: "product-1", commercialTerms: {
        quantity: 2, unitPrice: 1000, currency: "IRR", priceOrigin: "manual",
        discounts: [{ id: "discount", mode: "amount", value: 100 }],
        charges: [{ id: "charge", mode: "amount", value: 50 }],
        taxes: [{ taxId: "tax", rateBasisPoints: 900, taxCode: "VAT" }],
      } }],
    });
    let lifecycle = createSalesLifecycle("original", "sales-invoice");
    for (const action of ["submit", "approve", "finalize"] as const) lifecycle = transitionSalesLifecycle(lifecycle, { transitionId: action, action, actorId: actor.id, occurredAt: "2026-10-04T10:00:00Z" });
    await new SqliteSalesDocumentRepository(database).add({ document: original, lifecycle, version: 1, createdAt: "2026-10-04T10:00:00Z", updatedAt: "2026-10-04T10:00:00Z" });
    const created = await createSalesDraft(database, actor, {
      ...input, documentType: "sales-return", relatedDocumentId: original.documentId,
      lines: [{ ...input.lines[0]!, sourceLineId: "source-line", discountRateBasisPoints: 0, taxRateBasisPoints: 0 }],
    }, ports);
    assert.equal(created.relatedDocumentReference?.relationType, "sales-invoice");
    assert.equal(created.lines[0]?.sourceReference?.sourceLineId, "source-line");
    assert.deepEqual(created.lines[0]?.commercialTerms?.discounts, original.lines[0]?.commercialTerms?.discounts);
    assert.deepEqual(created.lines[0]?.commercialTerms?.charges, original.lines[0]?.commercialTerms?.charges);
    assert.deepEqual(created.lines[0]?.commercialTerms?.taxes, original.lines[0]?.commercialTerms?.taxes);
  } finally { await database.close(); }
});

test("service invoice lifecycle persists submit, approve, finalize and terminal-state restrictions", async () => {
  const { transitionSalesDocument } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports, sqlite } = setup();
  const operator = { ...actor, permissions: ["system.full-access"] };
  // This fixture exercises the sales lifecycle without requiring inventory valuation or issue staging.
  const getProduct = ports.getProduct;
  ports.getProduct = async (...args) => {
    const product = await getProduct(...args);
    assert.ok(product);
    return { ...product, kind: "service", stockTracking: false };
  };
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const scope = { companyId: input.companyId, branchId: input.branchId, fiscalYearId: input.fiscalYearId, documentId: created.documentId };
    let version = 1;
    for (const [action, status] of [["submit", "submitted"], ["approve", "approved"], ["finalize", "finalized"]] as const) {
      const command = { ...scope, action, expectedVersion: version, submissionId: action };
      const result = await transitionSalesDocument(database, operator, command, ports);
      assert.equal(result.lifecycle.status, status);
      assert.equal(result.version, ++version);
      assert.deepEqual(await transitionSalesDocument(database, operator, command, ports), result);
    }
    const persisted = await new SqliteSalesDocumentRepository(database).findById(input.companyId, created.documentId);
    assert.equal(persisted?.lifecycle.transitions.length, 3);
    assert.equal(sqlite.prepare("SELECT status FROM sales_documents").get()?.status, "finalized");
    await assert.rejects(transitionSalesDocument(database, operator, { ...scope, action: "cancel", expectedVersion: version, submissionId: "cancel-final" }, ports));
    assert.equal(sqlite.prepare("SELECT count(*) n FROM test_audit").get()?.n, 4);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sales_below_cost_decisions").get()?.n, 1);
    assert.equal(sqlite.prepare("SELECT outcome FROM sales_below_cost_decisions").get()?.outcome, "not-applicable");
  } finally { await database.close(); }
});

test("stock invoice finalization requires warehouse routing and leaves no partial decision", async () => {
  const { transitionSalesDocument } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports, sqlite } = setup();
  const operator = { ...actor, permissions: ["system.full-access"] };
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const scope = { companyId: input.companyId, branchId: input.branchId, fiscalYearId: input.fiscalYearId, documentId: created.documentId };
    let version = 1;
    for (const action of ["submit", "approve"] as const) {
      await transitionSalesDocument(database, operator, {
        ...scope, action, expectedVersion: version++, submissionId: action,
      }, ports);
    }

    await assert.rejects(transitionSalesDocument(database, operator, {
      ...scope, action: "finalize", expectedVersion: version, submissionId: "finalize",
    }, ports), /sales\.below_cost_warehouse_required/u);

    const persisted = await new SqliteSalesDocumentRepository(database).findById(input.companyId, created.documentId);
    assert.equal(persisted?.lifecycle.status, "approved");
    assert.equal(persisted?.version, version);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sales_below_cost_decisions").get()?.n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sales_idempotency WHERE request_id='finalize'").get()?.n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM test_audit").get()?.n, 3);
  } finally { await database.close(); }
});

test("mutations reject missing permission, wrong scope, stale version and invalid skips without writes", async () => {
  const { transitionSalesDocument } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports } = setup();
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const command = { companyId: input.companyId, branchId: input.branchId, fiscalYearId: input.fiscalYearId, documentId: created.documentId, action: "submit" as const, expectedVersion: 1, submissionId: "submit" };
    const operator = { ...actor, permissions: ["sales.documents.submit", "sales.documents.approve"] };
    await assert.rejects(transitionSalesDocument(database, actor, command, ports));
    await assert.rejects(transitionSalesDocument(database, operator, { ...command, branchId: "other" }, ports));
    await assert.rejects(transitionSalesDocument(database, operator, { ...command, fiscalYearId: "other" }, ports));
    await assert.rejects(transitionSalesDocument(database, operator, { ...command, expectedVersion: 5 }, ports));
    await assert.rejects(transitionSalesDocument(database, operator, { ...command, action: "approve" }, ports));
    assert.equal((await new SqliteSalesDocumentRepository(database).findById(input.companyId, created.documentId))?.version, 1);
  } finally { await database.close(); }
});

test("edit updates draft in place, preserves line identity and cannot overwrite a submitted or stale document", async () => {
  const { editSalesDraft, transitionSalesDocument } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports, sqlite } = setup();
  const operator = { ...actor, permissions: ["system.full-access"] };
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const edit = { ...input, documentId: created.documentId, expectedVersion: 1, submissionId: "edit", description: "توضیح جدید", lines: [{ ...input.lines[0]!, lineId: created.lines[0]!.lineId, unitPrice: 2000 }] };
    const edited = await editSalesDraft(database, operator, edit, ports);
    assert.equal(edited.document.documentId, created.documentId);
    assert.equal(edited.document.lines[0]?.lineId, created.lines[0]?.lineId);
    assert.equal(edited.document.lines[0]?.commercialTerms?.unitPrice, 2000);
    assert.equal(edited.version, 2);
    assert.deepEqual(await editSalesDraft(database, operator, edit, ports), edited);
    await assert.rejects(editSalesDraft(database, operator, { ...edit, submissionId: "stale" }, ports));
    await transitionSalesDocument(database, operator, { ...edit, action: "submit", expectedVersion: 2, submissionId: "submit-edited" }, ports);
    await assert.rejects(editSalesDraft(database, operator, { ...edit, expectedVersion: 3, submissionId: "edit-submitted" }, ports));
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sales_documents").get()?.n, 1);
  } finally { await database.close(); }
});

test("cancel and reject persist, while audit errors roll back lifecycle and replay records", async () => {
  const { transitionSalesDocument } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports, sqlite } = setup();
  const operator = { ...actor, permissions: ["system.full-access"] };
  try {
    const created = await createSalesDraft(database, actor, input, ports);
    const scope = { companyId: input.companyId, branchId: input.branchId, fiscalYearId: input.fiscalYearId, documentId: created.documentId };
    const audit = ports.recordAudit;
    ports.recordAudit = async () => { throw new Error("audit failed"); };
    await assert.rejects(transitionSalesDocument(database, operator, { ...scope, action: "submit", expectedVersion: 1, submissionId: "submit-fail" }, ports));
    assert.equal(sqlite.prepare("SELECT status FROM sales_documents").get()?.status, "draft");
    assert.equal(sqlite.prepare("SELECT count(*) n FROM sales_document_lifecycle").get()?.n, 0);
    ports.recordAudit = audit;
    await transitionSalesDocument(database, operator, { ...scope, action: "submit", expectedVersion: 1, submissionId: "submit-ok" }, ports);
    const rejected = await transitionSalesDocument(database, operator, { ...scope, action: "reject", expectedVersion: 2, submissionId: "reject", reason: "نیاز به اصلاح" }, ports);
    assert.equal(rejected.lifecycle.status, "draft");
    const cancelled = await transitionSalesDocument(database, operator, { ...scope, action: "cancel", expectedVersion: 3, submissionId: "cancel", reason: "لغو سفارش" }, ports);
    assert.equal(cancelled.lifecycle.status, "cancelled");
    assert.equal(cancelled.lifecycle.transitions.at(-1)?.reason, "لغو سفارش");
  } finally { await database.close(); }
});

test("editing a description preserves existing discount/tax identifiers and metadata", async () => {
  const { createSalesDocument, createSalesLifecycle } = await import("@argin/sales");
  const { editSalesDraft } = await import("../src/composition/sales/mutate-sales-document.ts");
  const { database, ports } = setup();
  try {
    const document = createSalesDocument({
      ...input, documentId: "metadata-draft", customer: { partyId: "customer-1", code: "C1", displayName: "مشتری" },
      lines: [{ lineId: "line-stable", position: 1, lineKind: "stock-product", productId: "product-1", commercialTerms: {
        quantity: 2, unitPrice: 1000, currency: "IRR", priceOrigin: "manual",
        discounts: [{ id: "discount-stable", mode: "percent", value: 1000, reason: "تخفیف توافقی" }],
        taxes: [{ taxId: "tax-stable", rateBasisPoints: 900, taxCode: "VAT" }],
      } }],
    });
    await new SqliteSalesDocumentRepository(database).add({ document, lifecycle: createSalesLifecycle(document.documentId, document.documentType), version: 1, createdAt: "2026-10-04T10:00:00Z", updatedAt: "2026-10-04T10:00:00Z" });
    const result = await editSalesDraft(database, { ...actor, permissions: ["sales.documents.edit"] }, {
      ...input, submissionId: "edit-metadata", documentId: document.documentId, expectedVersion: 1,
      description: "توضیح جدید", lines: [{ ...input.lines[0]!, lineId: "line-stable" }],
    }, ports);
    assert.deepEqual(result.document.lines[0]?.commercialTerms?.discounts, document.lines[0]?.commercialTerms?.discounts);
    assert.deepEqual(result.document.lines[0]?.commercialTerms?.taxes, document.lines[0]?.commercialTerms?.taxes);
  } finally { await database.close(); }
});
