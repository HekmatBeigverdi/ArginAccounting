import assert from "node:assert/strict";
import test from "node:test";
import {
  INVENTORY_APPLICATION_ERROR_CODES as codes,
  INVENTORY_QUERY_LIMITS,
  InventoryApplicationError,
  normalizeInventoryCursorRequest,
  normalizeInventoryPageRequest,
} from "../src/index.ts";
import type {
  InventoryBusinessOrderRepository,
  InventoryDocumentRepository,
  InventoryIdempotencyRepository,
  InventoryMovementRepository,
  InventoryOpeningBalanceRepository,
  InventoryBalanceProjectionRepository,
  InventoryQueryReader,
  InventoryUnitOfWork,
  InventoryUnitOfWorkContext,
  InventorySourceDocumentPort,
  InventoryQuantityConfirmationPort,
} from "../src/index.ts";

test("document page contract is strictly bounded", () => {
  assert.deepEqual(normalizeInventoryPageRequest({ page: 1, pageSize: 50 }), { page: 1, pageSize: 50 });
  for (const pageSize of [0, -1, INVENTORY_QUERY_LIMITS.maxPageSize + 1, 1.5, NaN]) {
    assert.throws(
      () => normalizeInventoryPageRequest({ page: 1, pageSize }),
      (error: unknown) => error instanceof InventoryApplicationError && error.code === codes.invalidRequest,
    );
  }
  assert.throws(() => normalizeInventoryPageRequest({ page: 0, pageSize: 1 }), InventoryApplicationError);
});

test("kardex/balance cursor contract is bounded and cursor is opaque", () => {
  assert.deepEqual(normalizeInventoryCursorRequest({ limit: 100, cursor: " next-token " }), {
    limit: 100,
    cursor: "next-token",
  });
  assert.deepEqual(normalizeInventoryCursorRequest({ limit: 1 }), { limit: 1, cursor: null });
  assert.throws(
    () => normalizeInventoryCursorRequest({ limit: INVENTORY_QUERY_LIMITS.maxCursorLimit + 1 }),
    InventoryApplicationError,
  );
  assert.throws(() => normalizeInventoryCursorRequest({ limit: 10, cursor: " " }), InventoryApplicationError);
});

test("application error exposes stable code and field without message parsing", () => {
  const error = new InventoryApplicationError(codes.concurrencyConflict, "expectedVersion");
  assert.equal(error.name, "InventoryApplicationError");
  assert.equal(error.message, codes.concurrencyConflict);
  assert.equal(error.code, codes.concurrencyConflict);
  assert.equal(error.field, "expectedVersion");
});

test("unit of work contract groups every confirmation-critical repository", async () => {
  const documents = {} as InventoryDocumentRepository;
  const movements = {} as InventoryMovementRepository;
  const balances = {} as InventoryBalanceProjectionRepository;
  const openings = {} as InventoryOpeningBalanceRepository;
  const businessOrders = {} as InventoryBusinessOrderRepository;
  const idempotency = {} as InventoryIdempotencyRepository;
  const context: InventoryUnitOfWorkContext = {
    documents,
    movements,
    balances,
    openings,
    businessOrders,
    idempotency,
  };
  const uow: InventoryUnitOfWork = {
    execute: async work => work(context),
  };
  const value = await uow.execute(async current => current.businessOrders === businessOrders && current.movements === movements);
  assert.equal(value, true);
});

test("query reader contract keeps document and stock projections separate from repositories", () => {
  const reader: InventoryQueryReader = {
    listDocuments: async query => ({ items: [], page: query.page.page, pageSize: query.page.pageSize, totalItems: 0 }),
    getDocument: async () => null,
    getDocumentByNumber: async () => null,
    readKardex: async () => ({ items: [], nextCursor: null }),
    readBalances: async () => ({ items: [], nextCursor: null }),
  };
  assert.equal(typeof reader.listDocuments, "function");
  assert.equal(typeof reader.readKardex, "function");
});

test("future source consumers stage Inventory drafts and request normal confirmation rather than injecting movements", async () => {
  const staging: InventorySourceDocumentPort = {
    stageDraft: async request => ({ inventoryDocumentId: request.inventoryDocumentId, status: "draft", version: 1 }),
  };
  const confirmation: InventoryQuantityConfirmationPort = {
    confirm: async request => ({ inventoryDocumentId: request.inventoryDocumentId, status: "confirmed", version: request.expectedVersion + 1 }),
  };
  const staged = await staging.stageDraft({
    companyId: "company-1",
    inventoryDocumentId: "inventory-1",
    documentType: "receipt",
    businessDate: "2026-09-08",
    sourceSystem: "purchase",
    sourceDocumentType: "purchase-receipt",
    sourceDocumentId: "purchase-1",
    lines: [{
      sourceLineId: "purchase-line-1",
      productId: "product-1",
      enteredQuantity: "2",
      unitId: "unit-1",
      warehouse: { warehouseId: "warehouse-1" },
    }],
    requestKey: "stage-1",
    payloadFingerprint: "fingerprint-1",
  });
  assert.equal(staged.status, "draft");
  const confirmed = await confirmation.confirm({
    companyId: "company-1",
    inventoryDocumentId: staged.inventoryDocumentId,
    expectedVersion: staged.version,
    actorUserId: "user-1",
    occurredAt: "2026-09-08T08:00:00Z",
    requestKey: "confirm-1",
    payloadFingerprint: "fingerprint-2",
  });
  assert.equal(confirmed.status, "confirmed");
});
