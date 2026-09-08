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
