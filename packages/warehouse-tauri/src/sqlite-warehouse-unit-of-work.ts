import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { WarehouseUnitOfWork, WarehouseUnitOfWorkContext } from "@argin/warehouse";

import {
  SqliteWarehouseLocationRepository,
  SqliteWarehouseRepository,
  SqliteWarehouseZoneRepository,
} from "./sqlite-warehouse-repositories.ts";

const contextFor = (database: DatabaseSession): WarehouseUnitOfWorkContext =>
  Object.freeze({
    warehouses: new SqliteWarehouseRepository(database),
    zones: new SqliteWarehouseZoneRepository(database),
    locations: new SqliteWarehouseLocationRepository(database),
  });

export class SqliteWarehouseUnitOfWork implements WarehouseUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  async execute<T>(work: (context: WarehouseUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => work(contextFor(transaction)));
  }
}
