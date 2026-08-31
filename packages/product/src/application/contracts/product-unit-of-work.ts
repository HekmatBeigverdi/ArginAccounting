import type { ProductRepository } from "./product-repository.ts";

export interface ProductUnitOfWorkRepositories {
  readonly products: ProductRepository;
}

export interface ProductUnitOfWork {
  run<T>(
    operation: (repositories: ProductUnitOfWorkRepositories) => Promise<T>,
  ): Promise<T>;
}
