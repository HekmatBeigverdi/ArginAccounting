import assert from "node:assert/strict";
import test from "node:test";
import { SqliteInventoryInboundCostInputService } from "../src/index.ts";
import {
  NodeSqliteExecutor,
  applyMigrations,
  installValuationFixtureSchema,
  openTestSqlite,
  seedFifoPolicy,
  seedInbound,
} from "./sqlite-test-support.ts";

test("manual inbound cost persists atomically, creates FIFO valuation and replays without duplicates", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db,29);
    installValuationFixtureSchema(db);
    seedInbound(db,"company-b","movement-b","3");
    seedFifoPolicy(db,"company-b");
    const service = new SqliteInventoryInboundCostInputService(executor);
    const input = {
      companyId:"company-b", movementId:"movement-b", unitCost:"12.5",
      actorId:"user-1", requestId:"request-b", occurredAt:"2026-09-13T20:00:00+03:30",
    } as const;
    const result = await service.setManualCost(input);
    assert.equal(result.totalCost,38);
    assert.equal(result.valuationCreated,true);
    const replay = await service.setManualCost({...input,unitCost:"12.5000"});
    assert.deepEqual(replay,result);
    for (const table of [
      "inventory_valuation_cost_inputs","inventory_valuation_entries",
      "inventory_valuation_cost_layers","inventory_valuation_idempotency",
    ]) {
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count:number };
      assert.equal(row.count,1,`${table} must contain one durable row`);
    }
  } finally { await executor.close(); }
});

test("manual cost correction uses revision CAS and rejects a stale writer", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db,29);
    installValuationFixtureSchema(db);
    seedInbound(db,"company-c","movement-c","2");
    const service = new SqliteInventoryInboundCostInputService(executor);
    await service.setManualCost({
      companyId:"company-c",movementId:"movement-c",unitCost:"100",actorId:"user-1",
      requestId:"request-c-set",occurredAt:"2026-09-13T17:00:00Z",
    });
    const corrected = await service.correctManualCost({
      companyId:"company-c",movementId:"movement-c",unitCost:"125",actorId:"user-1",
      requestId:"request-c-correct",occurredAt:"2026-09-13T18:00:00Z",
      reason:"supplier correction",expectedRevision:1,
    });
    assert.equal(corrected.totalCost,250);
    const row = db.prepare("SELECT unit_cost,total_cost,revision FROM inventory_valuation_cost_inputs WHERE company_id=? AND movement_id=?")
      .get("company-c","movement-c") as { unit_cost:string; total_cost:number; revision:number };
    assert.deepEqual(row,{unit_cost:"125",total_cost:250,revision:2});
    await assert.rejects(() => service.correctManualCost({
      companyId:"company-c",movementId:"movement-c",unitCost:"130",actorId:"user-2",
      requestId:"request-c-stale",occurredAt:"2026-09-13T18:05:00Z",
      reason:"stale correction",expectedRevision:1,
    }),/VALUATION_COST_INPUT_CONCURRENCY_CONFLICT/u);
  } finally { await executor.close(); }
});

test("transaction rollback removes monetary writes when idempotency persistence fails", async () => {
  const db = await openTestSqlite();
  const executor = new NodeSqliteExecutor(db);
  try {
    await applyMigrations(db,29);
    installValuationFixtureSchema(db);
    seedInbound(db,"company-d","movement-d");
    seedFifoPolicy(db,"company-d");
    db.exec(`CREATE TRIGGER phase21_force_idempotency_failure
      BEFORE INSERT ON inventory_valuation_idempotency BEGIN
      SELECT RAISE(ABORT,'forced idempotency failure'); END;`);
    const service = new SqliteInventoryInboundCostInputService(executor);
    await assert.rejects(() => service.setManualCost({
      companyId:"company-d",movementId:"movement-d",unitCost:"50",actorId:"user-1",
      requestId:"request-d",occurredAt:"2026-09-13T19:00:00Z",
    }),/forced idempotency failure/u);
    for (const table of [
      "inventory_valuation_cost_inputs","inventory_valuation_entries",
      "inventory_valuation_cost_layers","inventory_valuation_idempotency",
    ]) {
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count:number };
      assert.equal(row.count,0,`${table} must roll back`);
    }
  } finally { await executor.close(); }
});
