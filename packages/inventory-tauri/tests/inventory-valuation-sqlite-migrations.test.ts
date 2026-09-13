import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyMigrations, openTestSqlite } from "./sqlite-test-support.ts";

test("SQLite upgrades a version-27 database through valuation migrations without losing existing data", async () => {
  const db = await openTestSqlite();
  try {
    await applyMigrations(db, 27);
    db.exec("CREATE TABLE phase21_upgrade_probe(id TEXT PRIMARY KEY,value TEXT NOT NULL)");
    db.prepare("INSERT INTO phase21_upgrade_probe(id,value) VALUES(?,?)").run("probe","preserved");
    await applyMigrations(db, 29, 27);
    const probe = db.prepare("SELECT value FROM phase21_upgrade_probe WHERE id=?").get("probe") as { value: string };
    assert.equal(probe.value,"preserved");
    for (const table of [
      "inventory_valuation_policies","inventory_valuation_cost_inputs","inventory_valuation_entries",
      "inventory_valuation_cost_layers","inventory_valuation_states","inventory_valuation_idempotency",
      "inventory_valuation_stream_versions",
    ]) {
      const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table) as { name: string } | undefined;
      assert.equal(row?.name,table);
    }
  } finally { db.close(); }
});

test("valuation policy history is append-only and FIFO layers cascade from derived entries", async () => {
  const db = await openTestSqlite();
  try {
    await applyMigrations(db,29);
    db.exec(`INSERT INTO inventory_valuation_policies(
      policy_id,company_id,method,strategy_version,currency,effective_from,revision)
      VALUES('policy-a','company-a','fifo',1,'IRR','2026-01-01',1)`);
    assert.throws(() => db.exec("UPDATE inventory_valuation_policies SET currency='USD' WHERE policy_id='policy-a'"),/append-only/u);
    db.exec(`INSERT INTO inventory_valuation_entries(
      valuation_entry_id,company_id,product_id,movement_id,document_id,line_id,kind,method,strategy_version,currency,
      warehouse_id,business_date,business_order,quantity,unit_cost,total_cost,cost_state,valued_at,revision)
      VALUES('entry-a','company-a','p1','m1','d1','l1','inbound','fifo',1,'IRR','w1','2026-09-13',1,'1','100',100,'resolved','2026-09-13T00:00:00.000Z',1)`);
    db.exec(`INSERT INTO inventory_valuation_cost_layers(
      cost_layer_id,company_id,product_id,source_movement_id,source_valuation_entry_id,method,strategy_version,currency,
      warehouse_id,opened_business_date,opened_business_order,original_quantity,remaining_quantity,unit_cost,original_cost,remaining_cost,revision)
      VALUES('layer-a','company-a','p1','m1','entry-a','fifo',1,'IRR','w1','2026-09-13',1,'1','1','100',100,100,1)`);
    db.exec("DELETE FROM inventory_valuation_entries WHERE valuation_entry_id='entry-a'");
    assert.equal(db.prepare("SELECT cost_layer_id FROM inventory_valuation_cost_layers WHERE cost_layer_id='layer-a'").get(),undefined);
  } finally { db.close(); }
});

test("BEGIN IMMEDIATE excludes a concurrent writer on the same SQLite file", async () => {
  const dir = await mkdtemp(join(tmpdir(),"argin-phase21-"));
  const filename = join(dir,"valuation.db");
  const first = await openTestSqlite(filename);
  const second = await openTestSqlite(filename);
  try {
    first.exec("CREATE TABLE lock_probe(id INTEGER PRIMARY KEY,value TEXT)");
    first.exec("BEGIN IMMEDIATE");
    first.prepare("INSERT INTO lock_probe(value) VALUES(?)").run("first");
    assert.throws(() => second.exec("BEGIN IMMEDIATE"),/busy|locked/u);
    first.exec("ROLLBACK");
    const row = second.prepare("SELECT COUNT(*) AS count FROM lock_probe").get() as { count: number };
    assert.equal(row.count,0);
  } finally {
    first.close(); second.close(); await rm(dir,{recursive:true,force:true});
  }
});

test("valuation chronology query uses the product chronology index", async () => {
  const db = await openTestSqlite();
  try {
    await applyMigrations(db,29);
    const plan = db.prepare(`EXPLAIN QUERY PLAN SELECT valuation_entry_id FROM inventory_valuation_entries
      WHERE company_id=? AND product_id=? AND business_date<=?
      ORDER BY business_date,business_order,document_id,line_id,movement_id LIMIT 100`)
      .all("c","p","2026-12-29") as Array<{ detail: string }>;
    assert.ok(plan.some((row) => row.detail.includes("idx_inventory_valuation_entries_company_product_chronology")));
  } finally { db.close(); }
});
