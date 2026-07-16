import type { DatabaseExecutor } from "@argin/database";

import { TauriSqliteExecutor } from "./tauri-sqlite-executor";

let databaseInstance: DatabaseExecutor | null = null;

export async function getDesktopDatabase(): Promise<DatabaseExecutor> {
  if (databaseInstance !== null) {
    return databaseInstance;
  }

  databaseInstance = await TauriSqliteExecutor.connect();

  return databaseInstance;
}

export async function closeDesktopDatabase(): Promise<void> {
  if (databaseInstance === null) {
    return;
  }

  await databaseInstance.close();
  databaseInstance = null;
}
