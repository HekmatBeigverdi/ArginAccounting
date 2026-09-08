import type {
  ConfirmInventorySourceDocumentRequest,
  InventoryQuantityConfirmationPort,
  InventorySourceDocumentResult,
} from "./contracts/inventory-consumer.ts";
import type { InventorySecurityContext } from "./contracts/inventory-security.ts";
import type { SecuredInventoryService } from "./secured-inventory-service.ts";

export interface InventoryErpConfirmationAdapterDependencies {
  readonly inventory: Pick<SecuredInventoryService, "confirm">;
  /** Resolve the human/system display context for the actor supplied by the owning ERP module. */
  readonly securityContext?: (actorUserId: string) => InventorySecurityContext;
}

/**
 * Public ERP confirmation adapter. Purchase/Sales/Manufacturing ask Inventory to confirm;
 * they never append movement facts, alter balance projections, or bypass Inventory security/approval.
 */
export class SecuredInventoryQuantityConfirmationPort implements InventoryQuantityConfirmationPort {
  constructor(private readonly dependencies: InventoryErpConfirmationAdapterDependencies) {}

  async confirm(request: ConfirmInventorySourceDocumentRequest): Promise<InventorySourceDocumentResult> {
    const security = this.dependencies.securityContext?.(request.actorUserId) ?? Object.freeze({
      actorId: request.actorUserId,
      actorDisplayName: request.actorUserId,
      correlationId: request.requestKey,
    });

    const result = await this.dependencies.inventory.confirm(security, {
      companyId: request.companyId,
      documentId: request.inventoryDocumentId,
      expectedVersion: request.expectedVersion,
      requestKey: request.requestKey,
      payloadFingerprint: request.payloadFingerprint,
      ...(request.allowNegativeStock === undefined ? {} : { allowNegativeStock: request.allowNegativeStock }),
      action: Object.freeze({
        actorUserId: request.actorUserId,
        occurredAt: request.occurredAt,
      }),
    });

    return Object.freeze({
      inventoryDocumentId: result.documentId,
      status: result.status,
      version: result.version,
    });
  }
}
