import assert from "node:assert/strict";
import test from "node:test";
import { DefaultNumberSeries, InMemoryNumberSeriesStore } from "@argin/platform";
import type { NumberSeries } from "@argin/platform";
import type { Company, Branch } from "@argin/company";
import type { FiscalYear, FiscalPeriod, HistoricalLock } from "@argin/fiscal";
import { createInventoryDocument, createInventoryDocumentScope, validateInventoryDocumentScope, reserveInventoryDocumentNumber, DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS, InventoryDomainError, INVENTORY_DOMAIN_ERROR_CODES as codes } from "../src/index.ts";
import type { CreateInventoryDocumentInput, InventoryScopeContext, InventoryScopeReaders, InventoryDomainErrorCode } from "../src/index.ts";
const at = "2026-09-07T00:00:00Z";
const scope = { branchId: "b1", fiscalYearId: "y1", fiscalPeriodId: "p1" };
const base: CreateInventoryDocumentInput = { documentId: "d1", companyId: "c1", documentType: "receipt", businessDate: "2026-09-07", createdAt: at, scope };
const context: InventoryScopeContext = { companyId: "c1", actor: { id: "actor", branchIds: ["b1", "b2"], permissions: [] } };
function fixture() {
  const company: Company = { id: "c1", code: "C", legalName: "Company", tradeName: null, nationalId: null, registrationNumber: null, activityType: "trading", baseCurrency: "IRR", locale: "fa-IR", calendar: "jalali", status: "active", createdAt: at, updatedAt: at };
  const branch: Branch = { id: "b1", companyId: "c1", code: "B", name: "Branch", isHeadOffice: true, status: "active", createdAt: at, updatedAt: at };
  const year: FiscalYear = { id: "y1", companyId: "c1", code: "Y", title: "Year", startDate: "2026-01-01", endDate: "2026-12-31", status: "open", isCurrent: true, closedAt: null, closedBy: null, createdAt: at, updatedAt: at };
  const period: FiscalPeriod = { id: "p1", fiscalYearId: "y1", sequence: 1, code: "P", title: "Period", startDate: "2026-09-01", endDate: "2026-09-30", status: "open", lockReason: null, lockedAt: null, lockedBy: null, createdAt: at, updatedAt: at };
  const locks: HistoricalLock[] = [];
  const queried: (string | null)[] = [];
  const readers: InventoryScopeReaders = {
    companies: { findById: async () => company }, branches: { findById: async id => ({ ...branch, id }) },
    fiscalYears: { findById: async () => year }, fiscalPeriods: { findById: async () => period },
    historicalLocks: { findActiveLocks: async (_company, branchId) => { queried.push(branchId); return locks; } },
    warehouses: { getById: async () => null },
  };
  return { company, branch, year, period, locks, queried, readers };
}
const engine = () => new DefaultNumberSeries(new InMemoryNumberSeriesStore(), DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS);
async function rejects(action: () => Promise<unknown>, code: InventoryDomainErrorCode) {
  await assert.rejects(action, (error: unknown) => error instanceof InventoryDomainError && error.code === code);
}
const lock = (patch: Partial<HistoricalLock> = {}): HistoricalLock => ({ id: "lock", companyId: "c1", branchId: null, scope: "inventory", lockedThroughDate: "2026-09-07", reason: "Closed history", isActive: true, createdBy: null, createdAt: at, releasedBy: null, releasedAt: null, ...patch });
test("scope copies/freezes identities and reserves wildcard for shared missing-branch key", () => {
  const input = { ...scope };
  const value = createInventoryDocumentScope(input);
  input.branchId = "changed";
  assert.equal(value.branchId, "b1");
  assert.ok(Object.isFrozen(value));
  for (const field of ["branchId", "destinationBranchId", "fiscalYearId", "fiscalPeriodId"]) {
    for (const invalid of ["*", " ", 1, "x".repeat(129)]) assert.throws(() => createInventoryDocumentScope({ ...scope, [field]: invalid }), InventoryDomainError);
  }
  assert.throws(() => createInventoryDocument({ ...base, scope: { ...scope, destinationBranchId: "b2" } }), InventoryDomainError);
});
test("incomplete historical drafts remain readable but cannot reserve numbers", async () => {
  const document = createInventoryDocument({ ...base, scope: null });
  assert.equal(document.scope, null);
  await rejects(() => validateInventoryDocumentScope(document, context, fixture().readers), codes.scopeRequired);
});
test("rejects foreign authenticated company and missing actor branch before reads", async () => {
  const f = fixture();
  f.readers.companies.findById = async () => { assert.fail("must reject before reader"); };
  await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), { ...context, companyId: "c2" }, f.readers), codes.companyScopeMismatch);
  await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), { ...context, actor: { ...context.actor, branchIds: [] } }, f.readers), codes.branchAccessDenied);
});
test("cross-branch transfer requires explicit policy and access to both ends", async () => {
  const document = createInventoryDocument({ ...base, documentType: "transfer", scope: { ...scope, destinationBranchId: "b2" } });
  const f = fixture();
  await rejects(() => validateInventoryDocumentScope(document, context, f.readers), codes.crossBranchTransferDenied);
  await rejects(() => validateInventoryDocumentScope(document, { ...context, allowCrossBranchTransfers: true, actor: { ...context.actor, branchIds: ["b1"] } }, f.readers), codes.branchAccessDenied);
  await validateInventoryDocumentScope(document, { ...context, allowCrossBranchTransfers: true }, f.readers);
  assert.deepEqual(f.queried, ["b1", "b2"]);
});
test("full-access bypasses branch membership only", async () => {
  const f = fixture();
  const admin = { ...context, actor: { ...context.actor, branchIds: [], permissions: ["system.full-access"] } };
  await validateInventoryDocumentScope(createInventoryDocument(base), admin, f.readers);
  f.branch.companyId = "foreign";
  await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), admin, f.readers), codes.branchScopeMismatch);
  f.company.status = "inactive";
  await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), admin, f.readers), codes.companyScopeMismatch);
});
for (const patch of [{ companyId: "foreign" }, { id: "wrong" }, { status: "closed" }, { status: "closing" }, { status: "draft" }, { closedAt: at }, { startDate: "2026-10-01" }, { endDate: "2026-02-30" }]) {
  test(`rejects invalid fiscal year ${JSON.stringify(patch)}`, async () => {
    const f = fixture(); Object.assign(f.year, patch);
    await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), context, f.readers), codes.fiscalScopeInvalid);
  });
}
for (const patch of [{ fiscalYearId: "wrong" }, { id: "wrong" }, { status: "locked" }, { status: "closed" }, { startDate: "2026-09-08" }, { endDate: "2026-09-06" }, { startDate: "2025-12-31" }, { endDate: "2027-01-01" }]) {
  test(`rejects invalid fiscal period ${JSON.stringify(patch)}`, async () => {
    const f = fixture(); Object.assign(f.period, patch);
    await rejects(() => validateInventoryDocumentScope(createInventoryDocument(base), context, f.readers), codes.fiscalScopeInvalid);
  });
}
test("inventory/all locks include company and both transfer branches at inclusive boundary", async () => {
  for (const branchId of [null, "b1", "b2"]) for (const lockScope of ["inventory", "all"] as const) {
    const f = fixture(); f.locks.push(lock({ branchId, scope: lockScope }));
    const document = createInventoryDocument({ ...base, documentType: "transfer", scope: { ...scope, destinationBranchId: "b2" } });
    await rejects(() => validateInventoryDocumentScope(document, { ...context, allowCrossBranchTransfers: true }, f.readers), codes.historicalLockBlocked);
  }
});
test("unrelated and released locks do not block current scope", async () => {
  const f = fixture(); f.locks.push(...[{ companyId: "foreign" }, { branchId: "b3" }, { scope: "sales" as const }, { isActive: false }, { lockedThroughDate: "2026-09-06" }].map(lock));
  await validateInventoryDocumentScope(createInventoryDocument(base), context, f.readers);
});
test("shared number store reserves unique concurrent sequences and freezes result", async () => {
  const series = engine(); const document = createInventoryDocument(base);
  const values = await Promise.all(Array.from({ length: 50 }, () => reserveInventoryDocumentNumber(series, document, context, fixture().readers)));
  assert.equal(new Set(values.map(value => value.sequence)).size, 50);
  assert.deepEqual(values.map(value => value.sequence).sort((a,b) => a-b), Array.from({ length: 50 }, (_,i) => i+1));
  assert.equal(values[0]?.formattedValue, "000001");
  assert.ok(Object.isFrozen(values[0]?.scope)); assert.ok(Object.isFrozen(values[0]));
  assert.equal(document.documentNumber, null);
});
test("series separate company/year/origin branch/type but not period/destination", async () => {
  const series = engine();
  async function reserve(patch: Partial<CreateInventoryDocumentInput> = {}) {
    const input = { ...base, ...patch }; const f = fixture();
    f.company.id = input.companyId; f.branch.companyId = input.companyId; f.year.companyId = input.companyId;
    f.year.id = input.scope!.fiscalYearId; f.period.fiscalYearId = f.year.id; f.period.id = input.scope!.fiscalPeriodId;
    return reserveInventoryDocumentNumber(series, createInventoryDocument(input), { ...context, companyId: input.companyId, allowCrossBranchTransfers: true }, f.readers);
  }
  assert.equal((await reserve()).sequence, 1);
  assert.equal((await reserve({ scope: { ...scope, fiscalPeriodId: "p2" } })).sequence, 2);
  for (const patch of [{ companyId: "c2" }, { scope: { ...scope, fiscalYearId: "y2" } }, { scope: { ...scope, branchId: "b2" } }, { scope: { ...scope, branchId: null } }, ...["issue", "opening", "adjustment", "transfer"].map(documentType => ({ documentType: documentType as CreateInventoryDocumentInput["documentType"] }))]) assert.equal((await reserve(patch)).sequence, 1);
  assert.equal((await reserve({ documentType: "transfer", scope: { ...scope, destinationBranchId: "b2" } })).sequence, 2);
});
test("scope failure and already-numbered documents never call allocator", async () => {
  const series: NumberSeries = { next: async () => assert.fail("must not reserve") };
  await rejects(() => reserveInventoryDocumentNumber(series, createInventoryDocument({ ...base, documentNumber: "1" }), context, fixture().readers), codes.numberAlreadyAssigned);
  const f = fixture(); f.period.status = "locked";
  await rejects(() => reserveInventoryDocumentNumber(series, createInventoryDocument(base), context, f.readers), codes.fiscalScopeInvalid);
});
test("rejects allocator output with foreign scope or invalid sequence/format", async () => {
  for (const patch of [{ scope: { companyId: "foreign" } }, { seriesType: "other" }, { sequence: 0 }, { sequence: 1.5 }, { sequence: Number.MAX_SAFE_INTEGER + 1 }, { formattedValue: " " }]) {
    const series: NumberSeries = { next: async request => ({ ...request, sequence: 1, formattedValue: "000001", ...patch }) };
    await rejects(() => reserveInventoryDocumentNumber(series, createInventoryDocument(base), context, fixture().readers), codes.numberResultInvalid);
  }
});

test("warehouse eligibility uses current readers for both transfer endpoints", async () => {
  const { createProduct, createProductMasterDataProfile, createProductUnitProfile } = await import("@argin/product");
  const { createWarehouse, classifyWarehouse } = await import("@argin/warehouse");
  const { createInventoryLineOperation } = await import("../src/index.ts");
  const makeWarehouse = (warehouseId: string) => classifyWarehouse({ warehouse: createWarehouse({ warehouseId, companyId: "c1", code: warehouseId, title: warehouseId, createdAt: at }), kind: "general" });
  const source = makeWarehouse("w1"); const destination = makeWarehouse("w2");
  const product = { ...createProduct({ productId: "product", companyId: "c1", code: "P", title: "Product", kind: "product", createdAt: at }), version: 1,
    units: createProductUnitProfile({ baseUnit: { unitId: "each", code: "EA", title: "Each", precision: 0, roundingMode: "half-up" } }),
    masterData: createProductMasterDataProfile({ kind: "product", operational: { stockTracking: true } }) };
  const operation = createInventoryLineOperation({ companyId: "c1", productId: "product", product, enteredQuantity: "1", unitId: "each", warehouse: { warehouseId: "w1" }, resolvedWarehouse: { warehouse: source }, destination: { warehouseId: "w2" }, resolvedDestination: { warehouse: destination } });
  const document = createInventoryDocument({ ...base, documentType: "transfer", scope: { ...scope, destinationBranchId: "b2" }, lines: [{ lineId: "line", position: 1, productId: "product", operation }] });
  const f = fixture(); const ctx = { ...context, allowCrossBranchTransfers: true };
  const masters = new Map([["w1", { ...source, version: 1, externalIdentifiers: [], organizationalScope: { mode: "branch" as const, branchId: "b1" } }], ["w2", { ...destination, version: 1, externalIdentifiers: [], organizationalScope: { mode: "branch" as const, branchId: "b2" } }]]);
  f.readers.warehouses.getById = async request => masters.get(request.warehouseId) ?? null;
  await validateInventoryDocumentScope(document, ctx, f.readers);
  masters.get("w2")!.organizationalScope.branchId = "b1";
  await rejects(() => validateInventoryDocumentScope(document, ctx, f.readers), codes.warehouseBranchMismatch);
  masters.get("w2")!.organizationalScope.branchId = "b2";
  masters.get("w1")!.companyId = "foreign";
  await rejects(() => validateInventoryDocumentScope(document, ctx, f.readers), codes.warehouseBranchMismatch);
  masters.get("w1")!.companyId = "c1";
  masters.get("w1")!.status = "inactive";
  await rejects(() => validateInventoryDocumentScope(document, ctx, f.readers), codes.warehouseBranchMismatch);
});
