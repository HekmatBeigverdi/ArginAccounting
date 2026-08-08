import type { DatabaseExecutor } from "@argin/database";

import { TauriSqliteExecutor } from "./tauri-sqlite-executor";

let databaseInstance: DatabaseExecutor | null = null;
let databaseConnectionPromise: Promise<DatabaseExecutor> | null = null;

export async function getDesktopDatabase(): Promise<DatabaseExecutor> {
  if (databaseInstance !== null) {
    return databaseInstance;
  }

  if (databaseConnectionPromise === null) {
    databaseConnectionPromise = TauriSqliteExecutor.connect()
      .then((database) => {
        databaseInstance = database;
        return database;
      })
      .catch((error: unknown) => {
        databaseConnectionPromise = null;
        throw error;
      });
  }

  return databaseConnectionPromise;
}

export async function closeDesktopDatabase(): Promise<void> {
  const database = databaseInstance ??
    (databaseConnectionPromise === null
      ? null
      : await databaseConnectionPromise);

  if (database === null) {
    return;
  }

  await database.close();
  databaseInstance = null;
  databaseConnectionPromise = null;
}
