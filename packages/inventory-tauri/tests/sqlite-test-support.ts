import { readFile, readdir } from "node:fs/promises";
import type { DatabaseExecuteResult, DatabaseExecutor, DatabaseSession, DatabaseValue } from "@argin/database";

type Statement = {
  run(...parameters: readonly unknown[]): { changes: number | bigint };
  all(...parameters: readonly unknown[]): unknown[];
  get(...parameters: readonly unknown[]): unknown;
};

export type TestSqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): Statement;
  close(): void;
};

type SqliteConstructor = new (filename: string) => TestSqliteDatabase;

export async function openTestSqlite(filename = ":memory:"): Promise<TestSqliteDatabase> {
  // @ts-expect-error Node 22 provides node:sqlite while workspace @types/node is still v20.
  const module = await import("node:sqlite") as { DatabaseSync: SqliteConstructor };
  return new module.DatabaseSync(filename);
}

const migrationsDirectory = new URL("../../../apps/desktop/src-tauri/migrations/", import.meta.url);

export async function applyMigrations(
  db: TestSqliteDatabase,
  throughVersion = 29,
  afterVersion = 0,
): Promise<void> {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d{4}_.+\.sql$/u.test(name))
    .sort();
  for (const name of names) {
    const version = Number(name.slice(0, 4));
    if (version <= afterVersion) continue;
    if (version > throughVersion) break;
    db.exec(await readFile(new URL(name, migrationsDirectory), "utf8"));
  }
}

export class NodeSqliteExecutor implements DatabaseExecutor {
  constructor(readonly database: TestSqliteDatabase) {}

  async execute(sql: string, parameters: readonly DatabaseValue[] = []): Promise<DatabaseExecuteResult> {
    return { rowsAffected: Number(this.database.prepare(sql).run(...parameters).changes) };
  }

  async query<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...parameters) as T[];
  }

  async queryOne<T>(sql: string, parameters: readonly DatabaseValue[] = []): Promise<T | null> {
    return (this.database.prepare(sql).get(...parameters) ?? null) as T | null;
  }

  async transaction<T>(operation: (transaction: DatabaseSession) => Promise<T>): Promise<T> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = await operation(this);
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> { this.database.close(); }
}

export function installValuationFixtureSchema(db: TestSqliteDatabase): void {
  db.exec(`CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT NOT NULL, company_id TEXT NOT NULL, organizational_scope TEXT NOT NULL DEFAULT 'company',
    branch_id TEXT NULL, deleted_at TEXT NULL, PRIMARY KEY(company_id,id));
    CREATE TABLE IF NOT EXISTS inventory_all_stock_movements (
    movement_id TEXT PRIMARY KEY NOT NULL, company_id TEXT NOT NULL, document_id TEXT NOT NULL,
    line_id TEXT NOT NULL, product_id TEXT NOT NULL, warehouse_id TEXT NOT NULL,
    zone_id TEXT NULL, location_id TEXT NULL, business_date TEXT NOT NULL, business_order INTEGER NOT NULL,
    quantity_delta TEXT NOT NULL, reversal_of_movement_id TEXT NULL, transfer_id TEXT NULL);`);
}

export function seedInbound(db: TestSqliteDatabase, companyId: string, movementId: string, quantity = "3"): void {
  db.prepare("INSERT OR IGNORE INTO warehouses(id,company_id,organizational_scope) VALUES('w1',?,'company')").run(companyId);
  db.prepare(`INSERT INTO inventory_all_stock_movements(
    movement_id,company_id,document_id,line_id,product_id,warehouse_id,business_date,business_order,quantity_delta)
    VALUES(?,?,?,?,'p1','w1','2026-09-13',1,?)`)
    .run(movementId, companyId, `d:${movementId}`, `l:${movementId}`, quantity);
}

export function seedFifoPolicy(db: TestSqliteDatabase, companyId: string): void {
  db.prepare(`INSERT INTO inventory_valuation_policies(
    policy_id,company_id,method,strategy_version,currency,effective_from,previous_policy_id,change_reason,revision)
    VALUES(?,?,'fifo',1,'IRR','2026-01-01',NULL,NULL,1)`).run(`policy:${companyId}`, companyId);
}
