import assert from "node:assert/strict";
import test from "node:test";
import type { Branch, Company } from "@argin/company";
import type { FiscalPeriod, FiscalYear, HistoricalLock } from "@argin/fiscal";
import { createProduct, createProductMasterDataProfile, createProductUnitProfile } from "@argin/product";
import { classifyWarehouse, createWarehouse } from "@argin/warehouse";
import {
  INVENTORY_APPLICATION_ERROR_CODES as appCodes,
  InventoryApplicationError,
  InventoryApplicationService,
  approveInventoryDocument,
  createInventoryDocument,
  createInventoryLineOperation,
  createInventoryStockMovement,
  rebuildInventoryStockLedger,
  rehydrateInventoryDocument,
  serializeInventoryOpeningBalanceKey,
  serializeInventoryStockKey,
  submitInventoryDocument,
} from "../src/index.ts";
import type {
  ConfirmInventoryDocumentCommand,
  InventoryApplicationServiceDependencies,
  InventoryBalanceProjectionRepository,
  InventoryBusinessOrderRepository,
  InventoryDocumentRepository,
  InventoryDocumentSnapshot,
  InventoryIdempotencyRecord,
  InventoryIdempotencyRepository,
  InventoryMovementRepository,
  InventoryOpeningBalanceRepository,
  InventoryProductReference,
  InventoryScopeContext,
  InventoryScopeReaders,
  InventoryStockBalanceSnapshot,
  InventoryStockMovementSnapshot,
  InventoryUnitOfWork,
  InventoryUnitOfWorkContext,
} from "../src/index.ts";

const companyId = "company-1";
const actorUserId = "user-1";
const createdAt = "2026-09-08T08:00:00Z";
const submitAt = "2026-09-08T08:01:00Z";
const approveAt = "2026-09-08T08:02:00Z";
const confirmAt = "2026-09-08T08:03:00Z";

const units = createProductUnitProfile({
  baseUnit: { unitId: "unit", code: "EA", title: "عدد", precision: 6, roundingMode: "half-up" },
  alternateUnits: [],
});

function product(): InventoryProductReference {
  return {
    ...createProduct({ productId: "product-1", companyId, code: "P1", title: "کالا", kind: "product", createdAt }),
    version: 1,
    units,
    masterData: createProductMasterDataProfile({ kind: "product", operational: { stockTracking: true } }),
  };
}

const warehouse = classifyWarehouse({
  warehouse: createWarehouse({ warehouseId: "warehouse-1", companyId, code: "W1", title: "انبار", createdAt }),
  kind: "general",
});

const company: Company = {
  id: companyId, code: "C1", legalName: "Company", tradeName: null, nationalId: null,
  registrationNumber: null, activityType: "trading", baseCurrency: "IRR", locale: "fa-IR",
  calendar: "jalali", status: "active", createdAt, updatedAt: createdAt,
};
const branch: Branch = {
  id: "branch-1", companyId, code: "B1", name: "Branch", isHeadOffice: true,
  status: "active", createdAt, updatedAt: createdAt,
};
const year: FiscalYear = {
  id: "fy-2026", companyId, code: "Y", title: "Year", startDate: "2026-01-01", endDate: "2026-12-31",
  status: "open", isCurrent: true, closedAt: null, closedBy: null, createdAt, updatedAt: createdAt,
};
const period: FiscalPeriod = {
  id: "fp-09", fiscalYearId: year.id, sequence: 9, code: "P09", title: "Period",
  startDate: "2026-09-01", endDate: "2026-09-30", status: "open", lockReason: null,
  lockedAt: null, lockedBy: null, createdAt, updatedAt: createdAt,
};
const locks: HistoricalLock[] = [];

const scopeReaders: InventoryScopeReaders = {
  companies: { findById: async id => id === companyId ? company : null },
  branches: { findById: async id => id === branch.id ? branch : null },
  fiscalYears: { findById: async id => id === year.id ? year : null },
  fiscalPeriods: { findById: async id => id === period.id ? period : null },
  historicalLocks: { findActiveLocks: async () => locks },
  warehouses: {
    getById: async input => input.warehouseId === warehouse.warehouseId
      ? {
          ...warehouse,
          organizationalScope: { mode: "branch", branchId: branch.id },
          externalIdentifiers: [],
          version: 1,
        }
      : null,
  },
};
const scopeContext: InventoryScopeContext = {
  companyId,
  actor: { id: actorUserId, branchIds: [branch.id], permissions: [] },
  allowCrossBranchTransfers: false,
};

function approvedAdjustment(documentId: string, quantity: string): InventoryDocumentSnapshot {
  const operation = createInventoryLineOperation({
    companyId,
    productId: "product-1",
    product: product(),
    enteredQuantity: quantity,
    unitId: "unit",
    warehouse: { warehouseId: warehouse.warehouseId },
    resolvedWarehouse: { warehouse },
  });
  let document = createInventoryDocument({
    documentId,
    companyId,
    documentType: "adjustment",
    documentNumber: documentId,
    businessDate: "2026-09-08",
    scope: { branchId: branch.id, fiscalYearId: year.id, fiscalPeriodId: period.id },
    lines: [{ lineId: `${documentId}-line`, position: 1, productId: "product-1", operation }],
    createdAt,
  });
  document = submitInventoryDocument(document, { occurredAt: submitAt, actorUserId });
  return approveInventoryDocument(document, { occurredAt: approveAt, actorUserId });
}

class MemoryStore {
  readonly documents = new Map<string, InventoryDocumentSnapshot>();
  readonly movements: InventoryStockMovementSnapshot[] = [];
  readonly balances = new Map<string, InventoryStockBalanceSnapshot>();
  readonly openings = new Set<string>();
  readonly idempotency = new Map<string, InventoryIdempotencyRecord>();
  readonly orders = new Map<string, number>();
}

function repositories(store: MemoryStore): InventoryUnitOfWorkContext {
  const documents: InventoryDocumentRepository = {
    findById: async (company, id) => store.documents.get(`${company}:${id}`) ?? null,
    findByNumber: async () => null,
    add: async document => { store.documents.set(`${document.companyId}:${document.documentId}`, document); },
    update: async (document, expectedVersion) => {
      const key = `${document.companyId}:${document.documentId}`;
      const current = store.documents.get(key);
      if (!current || current.version !== expectedVersion) {
        throw new InventoryApplicationError(appCodes.concurrencyConflict, "expectedVersion");
      }
      store.documents.set(key, document);
    },
    markDraftDeleted: async () => {},
  };
  const movements: InventoryMovementRepository = {
    findById: async (company, id) => store.movements.find(item => item.companyId === company && item.movementId === id) ?? null,
    listByDocument: async (company, id) => store.movements.filter(item => item.companyId === company && item.documentId === id),
    listByStockKey: async stockKey => store.movements.filter(item => serializeInventoryStockKey(item.stockKey) === serializeInventoryStockKey(stockKey)),
    appendBatch: async items => { store.movements.push(...items); },
  };
  const balances: InventoryBalanceProjectionRepository = {
    find: async stockKey => store.balances.get(serializeInventoryStockKey(stockKey)) ?? null,
    replaceBatch: async items => { for (const item of items) store.balances.set(serializeInventoryStockKey(item.stockKey), item); },
  };
  const openings: InventoryOpeningBalanceRepository = {
    exists: async key => store.openings.has(serializeInventoryOpeningBalanceKey(key)),
    addBatch: async keys => { for (const key of keys) store.openings.add(serializeInventoryOpeningBalanceKey(key)); },
  };
  const businessOrders: InventoryBusinessOrderRepository = {
    next: async (company, date) => {
      const key = `${company}:${date}`;
      const next = (store.orders.get(key) ?? 0) + 1;
      store.orders.set(key, next);
      return next;
    },
  };
  const idempotency: InventoryIdempotencyRepository = {
    find: async (company, requestKey) => store.idempotency.get(`${company}:${requestKey}`) ?? null,
    add: async record => {
      const key = `${record.companyId}:${record.requestKey}`;
      if (store.idempotency.has(key)) throw new InventoryApplicationError(appCodes.idempotencyConflict, "requestKey");
      store.idempotency.set(key, record);
    },
  };
  return { documents, movements, balances, openings, businessOrders, idempotency };
}

class SerialMemoryUnitOfWork implements InventoryUnitOfWork {
  private tail: Promise<void> = Promise.resolve();
  constructor(private readonly context: InventoryUnitOfWorkContext) {}
  execute<T>(work: (context: InventoryUnitOfWorkContext) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    return previous.then(() => work(this.context)).finally(release);
  }
}

function serviceFixture(numbering?: InventoryApplicationServiceDependencies["numbering"]) {
  const store = new MemoryStore();
  const context = repositories(store);
  const deps: InventoryApplicationServiceDependencies = {
    uow: new SerialMemoryUnitOfWork(context),
    scopeReaders,
    scopeContext: () => scopeContext,
    masters: {
      product: async (_companyId, productId) => productId === "product-1" ? product() : null,
      warehouse: async () => ({ warehouse }),
    },
    identities: {
      movementId: input => `${input.documentId}:${input.lineId}:${input.role}`,
      transferId: input => `transfer:${input.documentId}`,
    },
    numbering: numbering ?? { assign: async document => document },
  };
  return { store, context, service: new InventoryApplicationService(deps) };
}

test("submission passes its active transaction to numbering and persists the assigned number", async () => {
  let numberingContext: InventoryUnitOfWorkContext | undefined;
  const { store, context, service } = serviceFixture({
    async assign(document, transaction) {
      numberingContext = transaction;
      return rehydrateInventoryDocument({ ...document, documentNumber: "REC-000001" });
    },
  });
  const template = approvedAdjustment("receipt-submit", "2");
  const draft = createInventoryDocument({
    documentId: template.documentId,
    companyId,
    documentType: "receipt",
    businessDate: template.businessDate,
    scope: template.scope,
    lines: template.lines,
    createdAt,
  });
  store.documents.set(`${companyId}:${draft.documentId}`, draft);
  const result = await service.submit(command(draft, "submit-1", "submit-payload"));
  assert.equal(numberingContext, context);
  assert.equal(result.status, "submitted");
  assert.equal(store.documents.get(`${companyId}:${draft.documentId}`)?.documentNumber, "REC-000001");
});

function command(document: InventoryDocumentSnapshot, requestKey: string, fingerprint: string): ConfirmInventoryDocumentCommand {
  return {
    companyId,
    requestKey,
    payloadFingerprint: fingerprint,
    documentId: document.documentId,
    expectedVersion: document.version,
    action: { occurredAt: confirmAt, actorUserId, reason: "Count correction" },
  };
}

async function rejectsCode(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => error instanceof InventoryApplicationError && error.code === code);
}

test("same request key and payload replays original confirmation without a second movement", async () => {
  const { store, service } = serviceFixture();
  const document = approvedAdjustment("adjust-1", "2");
  store.documents.set(`${companyId}:${document.documentId}`, document);
  const first = await service.confirm(command(document, "req-1", "fp-1"));
  const second = await service.confirm(command(document, "req-1", "fp-1"));
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.deepEqual({ documentId: second.documentId, status: second.status, version: second.version }, {
    documentId: first.documentId, status: first.status, version: first.version,
  });
  assert.equal(store.movements.length, 1);
});

test("same request key with a different payload fingerprint conflicts", async () => {
  const { store, service } = serviceFixture();
  const document = approvedAdjustment("adjust-2", "1");
  store.documents.set(`${companyId}:${document.documentId}`, document);
  await service.confirm(command(document, "req-2", "fp-a"));
  await rejectsCode(() => service.confirm(command(document, "req-2", "fp-b")), appCodes.idempotencyConflict);
  assert.equal(store.movements.length, 1);
});

test("stale expected version fails before stock mutation", async () => {
  const { store, service } = serviceFixture();
  const document = approvedAdjustment("adjust-3", "1");
  store.documents.set(`${companyId}:${document.documentId}`, document);
  await rejectsCode(() => service.confirm({ ...command(document, "req-3", "fp-3"), expectedVersion: document.version - 1 }), appCodes.concurrencyConflict);
  assert.equal(store.movements.length, 0);
});

test("two concurrent stock reductions are serialized against authoritative movement facts", async () => {
  const { store, service } = serviceFixture();
  const firstDoc = approvedAdjustment("adjust-race-1", "-4");
  const secondDoc = approvedAdjustment("adjust-race-2", "-4");
  store.documents.set(`${companyId}:${firstDoc.documentId}`, firstDoc);
  store.documents.set(`${companyId}:${secondDoc.documentId}`, secondDoc);
  store.movements.push(createInventoryStockMovement({
    movementId: "seed",
    companyId,
    documentId: "opening-seed",
    lineId: "seed-line",
    productId: "product-1",
    warehouse: { warehouseId: warehouse.warehouseId },
    businessDate: "2026-09-07",
    businessOrder: 1,
    recordedAt: "2026-09-07T08:00:00Z",
    quantityDelta: "5",
  }));
  const results = await Promise.allSettled([
    service.confirm(command(firstDoc, "race-1", "race-fp-1")),
    service.confirm(command(secondDoc, "race-2", "race-fp-2")),
  ]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(results.filter(item => item.status === "rejected").length, 1);
  const rejected = results.find(item => item.status === "rejected") as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof InventoryApplicationError);
  assert.equal(rejected.reason.code, appCodes.stockConflict);
  const ledger = rebuildInventoryStockLedger(store.movements);
  assert.equal(ledger.balances[0]?.quantity, "1");
});
