import assert from "node:assert/strict";
import test from "node:test";
import {
  NodeSqliteExecutor,
  applyMigrations,
  installValuationFixtureSchema,
  openTestSqlite,
  seedFifoPolicy,
  seedInbound,
} from "./sqlite-test-support.ts";
import { SqliteInventorySourceCostInputService } from "../src/index.ts";

test("Phase 23 Step 33 purchase source cost creates resolved Inventory valuation and FIFO layer", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db, 29, 27);
    installValuationFixtureSchema(db);
    seedInbound(db, "company-step33", "movement-step33", "15");
    seedFifoPolicy(db, "company-step33");

    const service = new SqliteInventorySourceCostInputService(executor);
    const basis = {
      basisLineId: "purchase-cost:movement-step33",
      movementId: "movement-step33",
      productId: "p1",
      warehouseId: "w1",
      quantity: "15",
      currency: "IRR" as const,
      baseCost: 25_000_000,
      landedCost: 0,
      totalCost: 25_000_000,
      unitCost: "1666666.6666666667",
      allocations: [],
    };

    await service.accept("company-step33", basis);

    const entry = db.prepare(`
      SELECT movement_id,method,strategy_version,currency,quantity,unit_cost,total_cost,cost_state,revision
        FROM inventory_valuation_entries
       WHERE company_id=? AND movement_id=?
    `).get("company-step33", "movement-step33") as {
      movement_id: string;
      method: string;
      strategy_version: number;
      currency: string;
      quantity: string;
      unit_cost: string;
      total_cost: number;
      cost_state: string;
      revision: number;
    };
    assert.deepEqual({ ...entry }, {
      movement_id: "movement-step33",
      method: "fifo",
      strategy_version: 1,
      currency: "IRR",
      quantity: "15",
      unit_cost: "1666666.6666666667",
      total_cost: 25_000_000,
      cost_state: "resolved",
      revision: 1,
    });

    const layer = db.prepare(`
      SELECT source_movement_id,remaining_quantity,unit_cost,remaining_cost
        FROM inventory_valuation_cost_layers
       WHERE company_id=? AND source_movement_id=?
    `).get("company-step33", "movement-step33") as {
      source_movement_id: string;
      remaining_quantity: string;
      unit_cost: string;
      remaining_cost: number;
    };
    assert.deepEqual({ ...layer }, {
      source_movement_id: "movement-step33",
      remaining_quantity: "15",
      unit_cost: "1666666.6666666667",
      remaining_cost: 25_000_000,
    });

    const before = db.prepare(`
      SELECT revision FROM inventory_valuation_stream_versions
       WHERE company_id=? AND stream_key=?
    `).get("company-step33", "valuation:company-step33:p1") as { revision: number };

    await service.accept("company-step33", basis);

    const after = db.prepare(`
      SELECT revision FROM inventory_valuation_stream_versions
       WHERE company_id=? AND stream_key=?
    `).get("company-step33", "valuation:company-step33:p1") as { revision: number };
    assert.equal(after.revision, before.revision);
    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM inventory_valuation_entries WHERE company_id=?")
        .get("company-step33") as { n: number }).n,
      1,
    );
    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM inventory_valuation_cost_layers WHERE company_id=?")
        .get("company-step33") as { n: number }).n,
      1,
    );
  } finally {
    await executor.close();
  }
});

test("Phase 23 Step 33 source-cost replay repairs a legacy missing valuation projection", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db, 29, 27);
    installValuationFixtureSchema(db);
    seedInbound(db, "company-legacy", "movement-legacy", "2");
    seedFifoPolicy(db, "company-legacy");

    db.prepare(`INSERT INTO inventory_valuation_cost_inputs(
      basis_line_id,company_id,movement_id,product_id,warehouse_id,quantity,currency,
      base_cost,landed_cost,total_cost,unit_cost,allocations_json,revision
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(
      "purchase-cost:movement-legacy","company-legacy","movement-legacy","p1","w1",
      "2","IRR",200,0,200,"100","[]",
    );

    const service = new SqliteInventorySourceCostInputService(executor);
    await service.accept("company-legacy", {
      basisLineId: "purchase-cost:movement-legacy",
      movementId: "movement-legacy",
      productId: "p1",
      warehouseId: "w1",
      quantity: "2",
      currency: "IRR",
      baseCost: 200,
      landedCost: 0,
      totalCost: 200,
      unitCost: "100",
      allocations: [],
    });

    const entry = db.prepare(
      "SELECT cost_state,total_cost FROM inventory_valuation_entries WHERE company_id=? AND movement_id=?",
    ).get("company-legacy", "movement-legacy") as { cost_state: string; total_cost: number };
    assert.deepEqual({ ...entry }, { cost_state: "resolved", total_cost: 200 });
  } finally {
    await executor.close();
  }
});


test("Phase 23 Step 34 source-cost projection rolls back atomically and retries cleanly after failure injection", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db, 29, 27);
    installValuationFixtureSchema(db);
    seedInbound(db, "company-failure", "movement-failure", "4");
    seedFifoPolicy(db, "company-failure");

    db.exec(`
      CREATE TRIGGER phase23_fail_fifo_projection
      BEFORE INSERT ON inventory_valuation_cost_layers
      BEGIN
        SELECT RAISE(ABORT,'forced fifo projection failure');
      END;
    `);

    const service = new SqliteInventorySourceCostInputService(executor);
    const basis = {
      basisLineId: "purchase-cost:movement-failure",
      movementId: "movement-failure",
      productId: "p1",
      warehouseId: "w1",
      quantity: "4",
      currency: "IRR" as const,
      baseCost: 400,
      landedCost: 0,
      totalCost: 400,
      unitCost: "100",
      allocations: [],
    };

    await assert.rejects(
      () => service.accept("company-failure", basis),
      /forced fifo projection failure/u,
    );

    for (const table of [
      "inventory_valuation_cost_inputs",
      "inventory_valuation_entries",
      "inventory_valuation_cost_layers",
      "inventory_valuation_stream_versions",
    ]) {
      const row = db.prepare(`SELECT count(*) AS n FROM ${table} WHERE company_id=?`)
        .get("company-failure") as { n: number };
      assert.equal(row.n, 0, `${table} must roll back`);
    }

    db.exec("DROP TRIGGER phase23_fail_fifo_projection");
    await service.accept("company-failure", basis);

    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM inventory_valuation_cost_inputs WHERE company_id=?")
        .get("company-failure") as { n: number }).n,
      1,
    );
    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM inventory_valuation_entries WHERE company_id=?")
        .get("company-failure") as { n: number }).n,
      1,
    );
    assert.equal(
      (db.prepare("SELECT count(*) AS n FROM inventory_valuation_cost_layers WHERE company_id=?")
        .get("company-failure") as { n: number }).n,
      1,
    );
  } finally {
    await executor.close();
  }
});
