import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryValuationOperationContext,
  InventoryValuationApplicationError,
  type InventoryValuationUnitOfWork,
  type InventoryValuationUnitOfWorkContext,
} from "../src/application/contracts/inventory-valuation-contracts.ts";

const emptyContext = {
  entries: {
    async findByMovement() { return null; },
    async listUnresolved() { return []; },
    async listByProductFrom() { return []; },
    async add() {},
    async replaceDerivedFrom() {},
  },
  policies: {
    async listByCompany() { return []; },
    async findCurrent() { return null; },
    async hasAuthoritativeValuation() { return false; },
    async add() {},
  },
  layers: {
    async listByProductFrom() { return []; },
    async replaceDerivedFrom() {},
  },
  states: {
    async get() { return null; },
    async replaceBatch() {},
  },
  movements: {
    async findById() { return null; },
    async listCompanyProductMovements() { return []; },
    async listCompanyMovementsFrom() { return []; },
  },
  costInputs: {
    async getResolvedInboundCostBasis() { return null; },
  },
} satisfies InventoryValuationUnitOfWorkContext;

const fakeUow: InventoryValuationUnitOfWork = {
  async execute<T>(work: (context: InventoryValuationUnitOfWorkContext) => Promise<T>): Promise<T> {
    return work(emptyContext);
  },
};

test("operation context canonicalizes identifiers and UTC timestamp", () => {
  const context = createInventoryValuationOperationContext({
    companyId: " company-1 ",
    requestId: " request-1 ",
    actorId: " user-1 ",
    occurredAt: "2026-09-12T13:30:00+03:30",
  });

  assert.deepEqual(context, {
    companyId: "company-1",
    requestId: "request-1",
    actorId: "user-1",
    occurredAt: "2026-09-12T10:00:00.000Z",
  });
});

test("operation context rejects missing request identity", () => {
  assert.throws(
    () => createInventoryValuationOperationContext({
      companyId: "company-1",
      requestId: " ",
      actorId: "user-1",
      occurredAt: "2026-09-12T10:00:00.000Z",
    }),
    (error: unknown) => error instanceof InventoryValuationApplicationError && error.code === "VALUATION_APP_INPUT_INVALID",
  );
});

test("valuation unit of work exposes all repositories in one application transaction seam", async () => {
  const result = await fakeUow.execute(async (context) => {
    const [policy, entry, basis] = await Promise.all([
      context.policies.findCurrent("company-1"),
      context.entries.findByMovement("company-1", "movement-1"),
      context.costInputs.getResolvedInboundCostBasis("company-1", {} as never),
    ]);
    return { policy, entry, basis };
  });

  assert.deepEqual(result, { policy: null, entry: null, basis: null });
});
