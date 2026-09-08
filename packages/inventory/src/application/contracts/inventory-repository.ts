import type { InventoryDocumentSnapshot, InventoryDocumentType } from "../../domain/inventory-document.ts";
import type { InventoryOpeningBalanceKey } from "../inventory-core-workflows.ts";
import type {
  InventoryStockBalanceSnapshot,
  InventoryStockKey,
  InventoryStockMovementSnapshot,
} from "../../domain/inventory-stock.ts";

export interface InventoryDocumentRepository {
  findById(companyId: string, documentId: string): Promise<InventoryDocumentSnapshot | null>;
  findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string | null,
    documentType: InventoryDocumentType,
    documentNumber: string,
  ): Promise<InventoryDocumentSnapshot | null>;
  add(document: InventoryDocumentSnapshot): Promise<void>;
  update(document: InventoryDocumentSnapshot, expectedVersion: number): Promise<void>;
  markDraftDeleted(companyId: string, documentId: string, expectedVersion: number, deletedAt: string): Promise<void>;
}

export interface InventoryMovementRepository {
  findById(companyId: string, movementId: string): Promise<InventoryStockMovementSnapshot | null>;
  listByDocument(companyId: string, documentId: string): Promise<readonly InventoryStockMovementSnapshot[]>;
  /** Returns authoritative facts for one StockKey in canonical business chronology. */
  listByStockKey(stockKey: InventoryStockKey): Promise<readonly InventoryStockMovementSnapshot[]>;
  appendBatch(movements: readonly InventoryStockMovementSnapshot[]): Promise<void>;
}

export interface InventoryBalanceProjectionRepository {
  find(stockKey: InventoryStockKey): Promise<InventoryStockBalanceSnapshot | null>;
  /** Projection only; immutable movements remain authoritative. */
  replaceBatch(balances: readonly InventoryStockBalanceSnapshot[]): Promise<void>;
}

export interface InventoryOpeningBalanceRepository {
  exists(key: InventoryOpeningBalanceKey): Promise<boolean>;
  addBatch(keys: readonly InventoryOpeningBalanceKey[]): Promise<void>;
}

export interface InventoryBusinessOrderRepository {
  /** Allocates a durable positive order within Company + businessDate inside the active UoW. */
  next(companyId: string, businessDate: string): Promise<number>;
}

export type InventoryIdempotencyOutcomeKind = "document" | "confirmation" | "reversal" | "deletion";

export interface InventoryIdempotencyRecord {
  readonly companyId: string;
  readonly requestKey: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly outcomeKind: InventoryIdempotencyOutcomeKind;
  readonly documentId: string;
  readonly documentVersion: number | null;
  readonly recordedAt: string;
}

export interface InventoryIdempotencyRepository {
  find(companyId: string, requestKey: string): Promise<InventoryIdempotencyRecord | null>;
  add(record: InventoryIdempotencyRecord): Promise<void>;
}
