import type { DatabaseExecutor, DatabaseSession } from "@argin/database";
import type { PartyUnitOfWork, PartyUnitOfWorkRepositories } from "@argin/party";

import { SqlitePartyRepository } from "./sqlite-party-store.ts";

function createRepositories(database: DatabaseSession): PartyUnitOfWorkRepositories {
  return Object.freeze({ parties: new SqlitePartyRepository(database) });
}

export class SqlitePartyUnitOfWork implements PartyUnitOfWork {
  constructor(private readonly database: DatabaseExecutor) {}

  async run<T>(operation: (repositories: PartyUnitOfWorkRepositories) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transactionDatabase) => operation(createRepositories(transactionDatabase)));
  }
}
