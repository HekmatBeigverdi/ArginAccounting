import type {
  PurchaseCommercialFactRepository,
  PurchaseDocumentRepository,
  PurchaseIdempotencyRepository,
  PurchaseReceiptInvoiceMatchRepository,
  PurchaseValuationCostInputRepository,
} from "./purchase-repository.ts";

export interface PurchaseUnitOfWorkContext {
  readonly documents: PurchaseDocumentRepository;
  readonly commercialFacts: PurchaseCommercialFactRepository;
  readonly matches: PurchaseReceiptInvoiceMatchRepository;
  readonly costInputs: PurchaseValuationCostInputRepository;
  readonly idempotency: PurchaseIdempotencyRepository;
}

/**
 * Persistence-neutral Purchase transaction boundary.
 * Step 14 owns orchestration; Step 16 owns the concrete SQLite transaction/rollback implementation.
 */
export interface PurchaseUnitOfWork {
  execute<T>(work: (context: PurchaseUnitOfWorkContext) => Promise<T>): Promise<T>;
}
