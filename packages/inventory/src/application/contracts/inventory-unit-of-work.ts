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
 * Persistence-neutral transaction boundary.
 *
 * For stock-changing work, an implementation must make all reads and writes in one committing
 * transaction and must either serialize conflicting StockKey mutations or surface an optimistic/
 * serialization conflict. Idempotency lookup/insert and business-order allocation participate in
 * the same transaction. Step 13 provides the concrete SQLite implementation and rollback behavior.
 */
export interface InventoryUnitOfWork {
  execute<T>(work: (context: InventoryUnitOfWorkContext) => Promise<T>): Promise<T>;
}
