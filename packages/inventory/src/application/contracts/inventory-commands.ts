import type {
  CreateInventoryDocumentInput,
  InventoryDocumentSnapshot,
  InventoryLifecycleActionInput,
  ReverseInventoryDocumentInput,
} from "../../domain/inventory-document.ts";

export interface InventoryCommandMetadata {
  readonly companyId: string;
  /** Stable client/request identity used by Step 10 idempotency orchestration. */
  readonly requestKey: string;
  /** Canonical payload fingerprint computed by the authoritative Application boundary. */
  readonly payloadFingerprint: string;
}

export interface CreateInventoryDocumentCommand extends InventoryCommandMetadata {
  readonly document: CreateInventoryDocumentInput;
}

export interface SaveInventoryDraftCommand extends InventoryCommandMetadata {
  readonly document: InventoryDocumentSnapshot;
  readonly expectedVersion: number;
}

export interface InventoryLifecycleCommand extends InventoryCommandMetadata {
  readonly documentId: string;
  readonly expectedVersion: number;
  readonly action: InventoryLifecycleActionInput;
}

export interface ReverseInventoryCommand extends InventoryCommandMetadata {
  readonly documentId: string;
  readonly expectedVersion: number;
  readonly action: ReverseInventoryDocumentInput;
}

export interface DeleteInventoryDraftCommand extends InventoryCommandMetadata {
  readonly documentId: string;
  readonly expectedVersion: number;
  readonly deletedAt: string;
}

export interface ConfirmInventoryDocumentCommand extends InventoryLifecycleCommand {
  /** Step 10 resolves durable businessOrder inside the authoritative UoW; callers cannot inject it. */
  readonly allowNegativeStock?: boolean;
}
