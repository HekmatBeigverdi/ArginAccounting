import {
  ApprovalNotFoundError,
  approveApprovalRequest,
  createApprovalRequestService,
  getApprovalRequest,
  submitApprovalRequest,
  type ApprovalActor,
  type ApprovalCommandContext,
  type ApprovalRequest,
} from "@argin/audit";
import {
  InventoryApplicationError,
  INVENTORY_APPLICATION_ERROR_CODES,
  INVENTORY_APPROVAL_REQUEST_TYPE,
  type InventoryApprovalGateway,
  type InventoryApprovalReference,
} from "@argin/inventory";

const approvalId = (companyId: string, documentId: string): string =>
  `inventory-document:${companyId.trim()}:${documentId.trim()}`;

const actor = (id: string, displayName: string): ApprovalActor => ({
  type: "user",
  id: id.trim(),
  displayName: displayName.trim() || id.trim(),
});

const reference = (request: ApprovalRequest): InventoryApprovalReference => Object.freeze({
  requestId: request.id,
  status: request.status,
});

const conflict = (): never => {
  throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.invalidRequest, "approval");
};

export class SharedInventoryApprovalGateway implements InventoryApprovalGateway {
  constructor(private readonly context: ApprovalCommandContext) {}

  async submit(input: Parameters<InventoryApprovalGateway["submit"]>[0]): Promise<InventoryApprovalReference> {
    const id = approvalId(input.companyId, input.documentId);
    let request: ApprovalRequest;
    try {
      request = await getApprovalRequest(this.context, id);
    } catch (error) {
      if (!(error instanceof ApprovalNotFoundError)) throw error;
      request = await createApprovalRequestService(this.context, {
        id,
        requestType: INVENTORY_APPROVAL_REQUEST_TYPE,
        title: input.documentNumber ? `Inventory document ${input.documentNumber}` : `Inventory document ${input.documentId}`,
        description: null,
        target: {
          entityType: INVENTORY_APPROVAL_REQUEST_TYPE,
          entityId: input.documentId,
          entityDisplayName: input.documentNumber,
        },
        scope: { companyId: input.companyId, branchId: input.branchId, fiscalYearId: null },
        createdBy: actor(input.actorId, input.actorDisplayName),
        correlationId: input.correlationId,
      });
    }

    if (request.status === "pending" || request.status === "approved") return reference(request);
    if (request.status !== "draft") return conflict();
    return reference(await submitApprovalRequest(this.context, {
      approvalRequestId: request.id,
      actor: actor(input.actorId, input.actorDisplayName),
      correlationId: input.correlationId,
    }));
  }

  async approve(input: Parameters<InventoryApprovalGateway["approve"]>[0]): Promise<InventoryApprovalReference> {
    const id = approvalId(input.companyId, input.documentId);
    let request: ApprovalRequest;
    try {
      request = await getApprovalRequest(this.context, id);
    } catch (error) {
      if (error instanceof ApprovalNotFoundError) return conflict();
      throw error;
    }
    if (request.status === "approved") return reference(request);
    if (request.status !== "pending") return conflict();
    return reference(await approveApprovalRequest(this.context, {
      approvalRequestId: request.id,
      actor: actor(input.actorId, input.actorDisplayName),
      comment: input.comment,
      correlationId: input.correlationId,
    }));
  }

  async requireApproved(companyId: string, documentId: string): Promise<void> {
    const id = approvalId(companyId, documentId);
    try {
      const request = await getApprovalRequest(this.context, id);
      if (request.requestType !== INVENTORY_APPROVAL_REQUEST_TYPE ||
          request.target.entityType !== INVENTORY_APPROVAL_REQUEST_TYPE ||
          request.target.entityId !== documentId ||
          request.scope.companyId !== companyId ||
          request.status !== "approved") {
        return conflict();
      }
    } catch (error) {
      if (error instanceof ApprovalNotFoundError) return conflict();
      throw error;
    }
  }
}
