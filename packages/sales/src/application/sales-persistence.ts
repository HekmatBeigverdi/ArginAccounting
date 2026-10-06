import type { SalesDocumentSnapshot } from "../domain/sales-document.ts";
import type { SalesLifecycleState } from "../domain/sales-lifecycle.ts";
import type {
  SalesIdempotencyReader,
  SalesIdempotencyWriter,
} from "./sales-replay-safety.ts";

export interface SalesPersistedDocument {
  readonly document: SalesDocumentSnapshot;
  readonly lifecycle: SalesLifecycleState;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SalesDocumentRepository {
  findById(companyId: string, documentId: string): Promise<SalesPersistedDocument | null>;
  add(state: SalesPersistedDocument): Promise<void>;
  update(state: SalesPersistedDocument, expectedVersion: number): Promise<void>;
}

export interface SalesUnitOfWorkContext {
  readonly documents: SalesDocumentRepository;
  readonly idempotency: SalesIdempotencyReader & SalesIdempotencyWriter;
}

export interface SalesUnitOfWork {
  execute<T>(work: (context: SalesUnitOfWorkContext) => Promise<T>): Promise<T>;
}
