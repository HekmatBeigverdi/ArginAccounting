import type { PartyRepository } from "./party-repository.ts";

export interface PartyUnitOfWorkRepositories {
  readonly parties: PartyRepository;
}

export interface PartyUnitOfWork {
  run<T>(
    operation: (repositories: PartyUnitOfWorkRepositories) => Promise<T>
  ): Promise<T>;
}
