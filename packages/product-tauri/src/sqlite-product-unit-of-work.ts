import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type {
  ProductUnitOfWork,
  ProductUnitOfWorkRepositories,
} from "@argin/product";

import { SqliteProductRepository } from "./sqlite-product-repository.ts";

function createRepositories(database: DatabaseSession): ProductUnitOfWorkRepositories {
  return Object.freeze({
    products: new SqliteProductRepository(database),
  });
}

export class SqliteProductUnitOfWork implements ProductUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  async run<T>(
    operation: (repositories: ProductUnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transactionDatabase) =>
      operation(createRepositories(transactionDatabase)),
    );
  }
}
