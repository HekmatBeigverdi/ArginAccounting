import type {
  DatabaseExecutor,
  DatabaseHealth
} from "@argin/database";

interface SqliteVersionRow {
  version: string;
}

interface ForeignKeyRow {
  foreign_keys: number;
}

export async function checkDatabaseHealth(
  database: DatabaseExecutor
): Promise<DatabaseHealth> {
  const versionRow = await database.queryOne<SqliteVersionRow>(
    "SELECT sqlite_version() AS version"
  );

  const foreignKeyRow = await database.queryOne<ForeignKeyRow>(
    "PRAGMA foreign_keys"
  );

  return {
    isConnected: versionRow !== null,
    provider: "sqlite",
    databaseVersion: versionRow?.version ?? "unknown",
    foreignKeysEnabled: foreignKeyRow?.foreign_keys === 1,
    checkedAt: new Date().toISOString()
  };
}
