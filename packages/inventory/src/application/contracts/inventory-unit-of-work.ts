import type {
  InventoryBalanceProjectionRepository,
  InventoryBusinessOrderRepository,
  InventoryDocumentRepository,
  InventoryIdempotencyRepository,
  InventoryMovementRepository,
  InventoryOpeningBalanceRepository,
} from "./inventory-repository.ts";

export interface InventoryUnitOfWorkContext {
  readonly documents: InventoryDocumentRepository;
  readonly movements: InventoryMovementRepository;
  readonly balances: InventoryBalanceProjectionRepository;
  readonly openings: InventoryOpeningBalanceRepository;
  readonly businessOrders: InventoryBusinessOrderRepository;
  readonly idempotency: InventoryIdempotencyRepository;
}

/**
 * Persistence-neutral transaction boundary. Implementations in Step 13 must ensure work either
 * commits completely or rolls back completely; this contract itself does not implement transactions.
 */
export interface InventoryUnitOfWork {
  execute<T>(work: (context: InventoryUnitOfWorkContext) => Promise<T>): Promise<T>;
}
