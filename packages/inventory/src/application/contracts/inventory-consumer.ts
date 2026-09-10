import type { WarehouseOperationalReference } from "@argin/warehouse";
import type { InventoryDocumentStatus } from "../../domain/inventory-document.ts";

export type InventorySourceQuantityDocumentType = "receipt" | "issue" | "transfer";

export interface InventorySourceQuantityLine {
  readonly sourceLineId: string;
  readonly productId: string;
  readonly enteredQuantity: string;
  readonly unitId: string;
  readonly warehouse: WarehouseOperationalReference;
  readonly destination?: WarehouseOperationalReference | null;
  readonly description?: string | null;
}

/**
 * Future Purchase/Sales/Manufacturing modules submit durable source identity and business intent,
 * never raw StockMovement facts or editable balance values.
 */
export interface StageInventorySourceDocumentRequest {
  readonly companyId: string;
  readonly inventoryDocumentId: string;
  readonly documentType: InventorySourceQuantityDocumentType;
  readonly businessDate: string;
  readonly sourceSystem: string;
  readonly sourceDocumentType: string;
  readonly sourceDocumentId: string;
  readonly description?: string | null;
  readonly lines: readonly InventorySourceQuantityLine[];
  readonly requestKey: string;
  readonly payloadFingerprint: string;
}

export interface InventorySourceDocumentResult {
  readonly inventoryDocumentId: string;
  readonly status: InventoryDocumentStatus;
  readonly version: number;
}

export interface InventorySourceDocumentPort {
  /** Creates/updates an Inventory-owned draft; it does not alter stock or bypass lifecycle approval. */
  stageDraft(request: StageInventorySourceDocumentRequest): Promise<InventorySourceDocumentResult>;
}

export interface ConfirmInventorySourceDocumentRequest {
  readonly companyId: string;
  readonly inventoryDocumentId: string;
  readonly expectedVersion: number;
  readonly actorUserId: string;
  readonly occurredAt: string;
  readonly requestKey: string;
  readonly payloadFingerprint: string;
  readonly allowNegativeStock?: boolean;
}

export interface InventoryQuantityConfirmationPort {
  /** Requests normal Inventory confirmation; authorization/approval/stock/UoW rules remain authoritative. */
  confirm(request: ConfirmInventorySourceDocumentRequest): Promise<InventorySourceDocumentResult>;
}

/** Stable immutable movement feed consumed by valuation and later ERP modules. */
export interface InventoryMovementFeedEntry {
  readonly movementId: string;
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly transferId: string | null;
  readonly reversalOfMovementId: string | null;
  readonly productId: string;
  readonly warehouse: WarehouseOperationalReference;
  readonly businessDate: string;
  readonly businessOrder: number;
  readonly recordedAt: string;
  readonly quantityDelta: string;
}

export interface InventoryMovementFeedRequest {
  readonly companyId: string;
  readonly afterMovementId?: string | null;
  readonly limit: number;
}

export interface InventoryMovementFeedPage {
  readonly items: readonly InventoryMovementFeedEntry[];
  readonly nextMovementId: string | null;
}

export interface InventoryMovementFeedReader {
  /**
   * Returns immutable quantity facts in deterministic business chronology.
   * Consumers must never mutate these facts or treat balance projections as an equivalent feed.
   */
  read(request: InventoryMovementFeedRequest): Promise<InventoryMovementFeedPage>;
}
