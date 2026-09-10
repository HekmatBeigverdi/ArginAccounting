import assert from "node:assert/strict";
import test from "node:test";
import { DefaultNumberSeries, InMemoryNumberSeriesStore } from "@argin/platform";
import type { NumberSeries } from "@argin/platform";
import type { Company, Branch } from "@argin/company";
import type { FiscalYear, FiscalPeriod, HistoricalLock } from "@argin/fiscal";
import {
  createInventoryDocument,
  createInventoryDocumentScope,
  validateInventoryDocumentScope,
  reserveInventoryDocumentNumber,
  DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS,
  InventoryDomainError,
  INVENTORY_DOMAIN_ERROR_CODES as codes,
} from "../src/index.ts";
import type {
  CreateInventoryDocumentInput,
  InventoryScopeContext,
  InventoryScopeReaders,
  InventoryDomainErrorCode,
} from "../src/index.ts";

const createdAt = "2026-09-07T00:00:00Z";
const scope = { branchId: "b1", fiscalYearId: "y1", fiscalPeriodId: "p1" };
const documentInput: CreateInventoryDocumentInput = {
  documentId: "d1",
  companyId: "c1",
  documentType: "receipt",
  businessDate: "2026-09-07",
  createdAt,
  scope,
};
const scopeContext: InventoryScopeContext = {
  companyId: "c1",
  actor: { id: "actor", branchIds: ["b1", "b2"], permissions: [] },
};

function createScopeFixture() {
  const company: Company = {
    id: "c1",
    code: "C",
    legalName: "Company",
    tradeName: null,
    nationalId: null,
    registrationNumber: null,
    activityType: "trading",
    baseCurrency: "IRR",
    locale: "fa-IR",
    calendar: "jalali",
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };
  const branch: Branch = {
    id: "b1",
    companyId: "c1",
    code: "B",
    name: "Branch",
    isHeadOffice: true,
    status: "active",
    createdAt,
    updatedAt: createdAt,
  };
  const year: FiscalYear = {
    id: "y1",
    companyId: "c1",
    code: "Y",
    title: "Year",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    status: "open",
    isCurrent: true,
    closedAt: null,
    closedBy: null,
    createdAt,
    updatedAt: createdAt,
  };
  const period: FiscalPeriod = {
    id: "p1",
    fiscalYearId: "y1",
    sequence: 1,
    code: "P",
    title: "Period",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "open",
    lockReason: null,
    lockedAt: null,
    lockedBy: null,
    createdAt,
    updatedAt: createdAt,
  };
  const locks: HistoricalLock[] = [];
  const queriedBranchIds: (string | null)[] = [];
  const readers: InventoryScopeReaders = {
    companies: { findById: async () => company },
    branches: { findById: async (id) => ({ ...branch, id }) },
    fiscalYears: { findById: async () => year },
    fiscalPeriods: { findById: async () => period },
    historicalLocks: {
      findActiveLocks: async (_company, branchId) => {
        queriedBranchIds.push(branchId);
        return locks;
      },
    },
    warehouses: { getById: async () => null },
  };
  return { company, branch, year, period, locks, queriedBranchIds, readers };
}

const createNumberSeries = () =>
  new DefaultNumberSeries(
    new InMemoryNumberSeriesStore(),
    DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS,
  );

async function assertRejectsWithCode(
  action: () => Promise<unknown>,
  code: InventoryDomainErrorCode,
) {
  await assert.rejects(
    action,
    (error: unknown) => error instanceof InventoryDomainError && error.code === code,
  );
}

const createHistoricalLock = (patch: Partial<HistoricalLock> = {}): HistoricalLock => ({
  id: "lock",
  companyId: "c1",
  branchId: null,
  scope: "inventory",
  lockedThroughDate: "2026-09-07",
  reason: "Closed history",
  isActive: true,
  createdBy: null,
  createdAt,
  releasedBy: null,
  releasedAt: null,
  ...patch,
});

test("scope copies/freezes identities and reserves wildcard for shared missing-branch key", () => {
  const input = { ...scope };
  const value = createInventoryDocumentScope(input);
  input.branchId = "changed";
  assert.equal(value.branchId, "b1");
  assert.ok(Object.isFrozen(value));
  for (const field of ["branchId", "destinationBranchId", "fiscalYearId", "fiscalPeriodId"]) {
    for (const invalid of ["*", " ", 1, "x".repeat(129)]) {
      assert.throws(
        () => createInventoryDocumentScope({ ...scope, [field]: invalid }),
        InventoryDomainError,
      );
    }
  }
  assert.throws(
    () =>
      createInventoryDocument({
        ...documentInput,
        scope: { ...scope, destinationBranchId: "b2" },
      }),
    InventoryDomainError,
  );
});

test("incomplete historical drafts remain readable but fail scope validation", async () => {
  const document = createInventoryDocument({ ...documentInput, scope: null });
  assert.equal(document.scope, null);
  await assertRejectsWithCode(
    () => validateInventoryDocumentScope(document, scopeContext, createScopeFixture().readers),
    codes.scopeRequired,
  );
});

test("rejects foreign authenticated company and missing actor branch before reads", async () => {
  const fixture = createScopeFixture();
  fixture.readers.companies.findById = async () => {
    assert.fail("must reject before reader");
  };
  await assertRejectsWithCode(
    () =>
      validateInventoryDocumentScope(
        createInventoryDocument(documentInput),
        { ...scopeContext, companyId: "c2" },
        fixture.readers,
      ),
    codes.companyScopeMismatch,
  );
  await assertRejectsWithCode(
    () =>
      validateInventoryDocumentScope(
        createInventoryDocument(documentInput),
        { ...scopeContext, actor: { ...scopeContext.actor, branchIds: [] } },
        fixture.readers,
      ),
    codes.branchAccessDenied,
  );
});

test("cross-branch transfer requires explicit policy and access to both ends", async () => {
  const document = createInventoryDocument({
    ...documentInput,
    documentType: "transfer",
    scope: { ...scope, destinationBranchId: "b2" },
  });
  const fixture = createScopeFixture();
  await assertRejectsWithCode(
    () => validateInventoryDocumentScope(document, scopeContext, fixture.readers),
    codes.crossBranchTransferDenied,
  );
  await assertRejectsWithCode(
    () =>
      validateInventoryDocumentScope(
        document,
        {
          ...scopeContext,
          allowCrossBranchTransfers: true,
          actor: { ...scopeContext.actor, branchIds: ["b1"] },
        },
        fixture.readers,
      ),
    codes.branchAccessDenied,
  );
  await validateInventoryDocumentScope(
    document,
    { ...scopeContext, allowCrossBranchTransfers: true },
    fixture.readers,
  );
  assert.deepEqual(fixture.queriedBranchIds, ["b1", "b2"]);
});

test("full-access bypasses branch membership only", async () => {
  const fixture = createScopeFixture();
  const admin = {
    ...scopeContext,
    actor: {
      ...scopeContext.actor,
      branchIds: [],
      permissions: ["system.full-access"],
    },
  };
  await validateInventoryDocumentScope(
    createInventoryDocument(documentInput),
    admin,
    fixture.readers,
  );
  fixture.branch.companyId = "foreign";
  await assertRejectsWithCode(
    () =>
      validateInventoryDocumentScope(
        createInventoryDocument(documentInput),
        admin,
        fixture.readers,
      ),
    codes.branchScopeMismatch,
  );
  fixture.company.status = "inactive";
  await assertRejectsWithCode(
    () =>
      validateInventoryDocumentScope(
        createInventoryDocument(documentInput),
        admin,
        fixture.readers,
      ),
    codes.companyScopeMismatch,
  );
});

for (const patch of [
  { companyId: "foreign" },
  { id: "wrong" },
  { status: "closed" },
  { status: "closing" },
  { status: "draft" },
  { closedAt: createdAt },
  { startDate: "2026-10-01" },
  { endDate: "2026-02-30" },
]) {
  test(`rejects invalid fiscal year ${JSON.stringify(patch)}`, async () => {
    const fixture = createScopeFixture();
    Object.assign(fixture.year, patch);
    await assertRejectsWithCode(
      () =>
        validateInventoryDocumentScope(
          createInventoryDocument(documentInput),
          scopeContext,
          fixture.readers,
        ),
      codes.fiscalScopeInvalid,
    );
  });
}

for (const patch of [
  { fiscalYearId: "wrong" },
  { id: "wrong" },
  { status: "locked" },
  { status: "closed" },
  { startDate: "2026-09-08" },
  { endDate: "2026-09-06" },
  { startDate: "2025-12-31" },
  { endDate: "2027-01-01" },
]) {
  test(`rejects invalid fiscal period ${JSON.stringify(patch)}`, async () => {
    const fixture = createScopeFixture();
    Object.assign(fixture.period, patch);
    await assertRejectsWithCode(
      () =>
        validateInventoryDocumentScope(
          createInventoryDocument(documentInput),
          scopeContext,
          fixture.readers,
        ),
      codes.fiscalScopeInvalid,
    );
  });
}

test("inventory/all locks include company and both transfer branches at inclusive boundary", async () => {
  for (const branchId of [null, "b1", "b2"]) {
    for (const lockScope of ["inventory", "all"] as const) {
      const fixture = createScopeFixture();
      fixture.locks.push(createHistoricalLock({ branchId, scope: lockScope }));
      const document = createInventoryDocument({
        ...documentInput,
        documentType: "transfer",
        scope: { ...scope, destinationBranchId: "b2" },
      });
      await assertRejectsWithCode(
        () =>
          validateInventoryDocumentScope(
            document,
            { ...scopeContext, allowCrossBranchTransfers: true },
            fixture.readers,
          ),
        codes.historicalLockBlocked,
      );
    }
  }
});

test("unrelated and released locks do not block current scope", async () => {
  const fixture = createScopeFixture();
  fixture.locks.push(
    ...[
      { companyId: "foreign" },
      { branchId: "b3" },
      { scope: "sales" as const },
      { isActive: false },
      { lockedThroughDate: "2026-09-06" },
    ].map(createHistoricalLock),
  );
  await validateInventoryDocumentScope(
    createInventoryDocument(documentInput),
    scopeContext,
    fixture.readers,
  );
});

test("shared number store reserves unique concurrent sequences and freezes result", async () => {
  const series = createNumberSeries();
  const document = createInventoryDocument(documentInput);
  const reservations = await Promise.all(
    Array.from({ length: 50 }, () =>
      reserveInventoryDocumentNumber(series, document, scopeContext, createScopeFixture().readers),
    ),
  );
  assert.equal(new Set(reservations.map((value) => value.sequence)).size, 50);
  assert.deepEqual(
    reservations.map((value) => value.sequence).sort((a, b) => a - b),
    Array.from({ length: 50 }, (_, i) => i + 1),
  );
  assert.equal(reservations[0]?.formattedValue, "000001");
  assert.ok(Object.isFrozen(reservations[0]?.scope));
  assert.ok(Object.isFrozen(reservations[0]));
  assert.equal(document.documentNumber, null);
});

test("series separate company/year/origin branch/type but not period/destination", async () => {
  const series = createNumberSeries();
  async function reserve(patch: Partial<CreateInventoryDocumentInput> = {}) {
    const input = { ...documentInput, ...patch };
    const fixture = createScopeFixture();
    fixture.company.id = input.companyId;
    fixture.branch.companyId = input.companyId;
    fixture.year.companyId = input.companyId;
    fixture.year.id = input.scope!.fiscalYearId;
    fixture.period.fiscalYearId = fixture.year.id;
    fixture.period.id = input.scope!.fiscalPeriodId;
    return reserveInventoryDocumentNumber(
      series,
      createInventoryDocument(input),
      {
        ...scopeContext,
        companyId: input.companyId,
        allowCrossBranchTransfers: true,
      },
      fixture.readers,
    );
  }
  assert.equal((await reserve()).sequence, 1);
  assert.equal((await reserve({ scope: { ...scope, fiscalPeriodId: "p2" } })).sequence, 2);
  const separateSeriesCases: Partial<CreateInventoryDocumentInput>[] = [
    { companyId: "c2" },
    { scope: { ...scope, fiscalYearId: "y2" } },
    { scope: { ...scope, branchId: "b2" } },
    { scope: { ...scope, branchId: null } },
    { documentType: "issue" },
    { documentType: "opening" },
    { documentType: "adjustment" },
    { documentType: "transfer" },
  ];

  for (const patch of separateSeriesCases) {
    assert.equal((await reserve(patch)).sequence, 1);
  }
  assert.equal(
    (
      await reserve({
        documentType: "transfer",
        scope: { ...scope, destinationBranchId: "b2" },
      })
    ).sequence,
    2,
  );
});

test("scope failure and already-numbered documents never call allocator", async () => {
  const series: NumberSeries = {
    next: async () => assert.fail("must not reserve"),
  };
  await assertRejectsWithCode(
    () =>
      reserveInventoryDocumentNumber(
        series,
        createInventoryDocument({ ...documentInput, documentNumber: "1" }),
        scopeContext,
        createScopeFixture().readers,
      ),
    codes.numberAlreadyAssigned,
  );
  const fixture = createScopeFixture();
  fixture.period.status = "locked";
  await assertRejectsWithCode(
    () =>
      reserveInventoryDocumentNumber(
        series,
        createInventoryDocument(documentInput),
        scopeContext,
        fixture.readers,
      ),
    codes.fiscalScopeInvalid,
  );
});

test("rejects allocator output with foreign scope or invalid sequence/format", async () => {
  for (const patch of [
    { scope: { companyId: "foreign" } },
    { seriesType: "other" },
    { sequence: 0 },
    { sequence: 1.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 },
    { formattedValue: " " },
  ]) {
    const series: NumberSeries = {
      next: async (request) => ({
        ...request,
        sequence: 1,
        formattedValue: "000001",
        ...patch,
      }),
    };
    await assertRejectsWithCode(
      () =>
        reserveInventoryDocumentNumber(
          series,
          createInventoryDocument(documentInput),
          scopeContext,
          createScopeFixture().readers,
        ),
      codes.numberResultInvalid,
    );
  }
});

test("warehouse eligibility uses current readers for both transfer endpoints", async () => {
  const { createProduct, createProductMasterDataProfile, createProductUnitProfile } = await import(
    "@argin/product"
  );
  const { createWarehouse, classifyWarehouse } = await import("@argin/warehouse");
  const { createInventoryLineOperation } = await import("../src/index.ts");
  const makeWarehouse = (warehouseId: string) =>
    classifyWarehouse({
      warehouse: createWarehouse({
        warehouseId,
        companyId: "c1",
        code: warehouseId,
        title: warehouseId,
        createdAt,
      }),
      kind: "general",
    });
  const source = makeWarehouse("w1");
  const destination = makeWarehouse("w2");
  const product = {
    ...createProduct({
      productId: "product",
      companyId: "c1",
      code: "P",
      title: "Product",
      kind: "product",
      createdAt,
    }),
    version: 1,
    units: createProductUnitProfile({
      baseUnit: {
        unitId: "each",
        code: "EA",
        title: "Each",
        precision: 0,
        roundingMode: "half-up",
      },
    }),
    masterData: createProductMasterDataProfile({
      kind: "product",
      operational: { stockTracking: true },
    }),
  };
  const operation = createInventoryLineOperation({
    companyId: "c1",
    productId: "product",
    product,
    enteredQuantity: "1",
    unitId: "each",
    warehouse: { warehouseId: "w1" },
    resolvedWarehouse: { warehouse: source },
    destination: { warehouseId: "w2" },
    resolvedDestination: { warehouse: destination },
  });
  const document = createInventoryDocument({
    ...documentInput,
    documentType: "transfer",
    scope: { ...scope, destinationBranchId: "b2" },
    lines: [{ lineId: "line", position: 1, productId: "product", operation }],
  });
  const fixture = createScopeFixture();
  const transferContext = { ...scopeContext, allowCrossBranchTransfers: true };
  const warehousesById = new Map([
    [
      "w1",
      {
        ...source,
        version: 1,
        externalIdentifiers: [],
        organizationalScope: { mode: "branch" as const, branchId: "b1" },
      },
    ],
    [
      "w2",
      {
        ...destination,
        version: 1,
        externalIdentifiers: [],
        organizationalScope: { mode: "branch" as const, branchId: "b2" },
      },
    ],
  ]);
  fixture.readers.warehouses.getById = async (request) =>
    warehousesById.get(request.warehouseId) ?? null;
  await validateInventoryDocumentScope(document, transferContext, fixture.readers);
  warehousesById.get("w2")!.organizationalScope.branchId = "b1";
  await assertRejectsWithCode(
    () => validateInventoryDocumentScope(document, transferContext, fixture.readers),
    codes.warehouseBranchMismatch,
  );
  warehousesById.get("w2")!.organizationalScope.branchId = "b2";
  warehousesById.get("w1")!.companyId = "foreign";
  await assertRejectsWithCode(
    () => validateInventoryDocumentScope(document, transferContext, fixture.readers),
    codes.warehouseBranchMismatch,
  );
  warehousesById.get("w1")!.companyId = "c1";
  warehousesById.get("w1")!.status = "inactive";
  await assertRejectsWithCode(
    () => validateInventoryDocumentScope(document, transferContext, fixture.readers),
    codes.warehouseBranchMismatch,
  );
});
