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
  PURCHASE_APPROVAL_REQUEST_TYPE,
  PurchaseApplicationError,
  type PurchaseApprovalGateway,
  type PurchaseApprovalReference,
} from "@argin/purchase";

const approvalId = (
  companyId: string,
  documentId: string,
  approvalCycleKey: string,
): string => `purchase-document:${companyId.trim()}:${documentId.trim()}:${approvalCycleKey.trim()}`;

const actor = (id: string, displayName: string): ApprovalActor => ({
  type: "user",
  id: id.trim(),
  displayName: displayName.trim() || id.trim(),
});

const reference = (request: ApprovalRequest): PurchaseApprovalReference => Object.freeze({
  requestId: request.id,
  status: request.status,
});

const conflict = (): never => {
  throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "approval");
};

export class SharedPurchaseApprovalGateway implements PurchaseApprovalGateway {
  constructor(private readonly context: ApprovalCommandContext) {}

  async submit(input: Parameters<PurchaseApprovalGateway["submit"]>[0]): Promise<PurchaseApprovalReference> {
    const id = approvalId(input.companyId, input.documentId, input.approvalCycleKey);
    let request: ApprovalRequest;
    try {
      request = await getApprovalRequest(this.context, id);
    } catch (error) {
      if (!(error instanceof ApprovalNotFoundError)) throw error;
      request = await createApprovalRequestService(this.context, {
        id,
        requestType: PURCHASE_APPROVAL_REQUEST_TYPE,
        title: input.documentNumber ? `Purchase document ${input.documentNumber}` : `Purchase document ${input.documentId}`,
        description: null,
        target: {
          entityType: PURCHASE_APPROVAL_REQUEST_TYPE,
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

  async approve(input: Parameters<PurchaseApprovalGateway["approve"]>[0]): Promise<PurchaseApprovalReference> {
    const id = approvalId(input.companyId, input.documentId, input.approvalCycleKey);
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

  async requireApproved(companyId: string, documentId: string, approvalCycleKey: string): Promise<void> {
    const id = approvalId(companyId, documentId, approvalCycleKey);
    try {
      const request = await getApprovalRequest(this.context, id);
      if (
        request.requestType !== PURCHASE_APPROVAL_REQUEST_TYPE ||
        request.target.entityType !== PURCHASE_APPROVAL_REQUEST_TYPE ||
        request.target.entityId !== documentId ||
        request.scope.companyId !== companyId ||
        request.status !== "approved"
      ) return conflict();
    } catch (error) {
      if (error instanceof ApprovalNotFoundError) return conflict();
      throw error;
    }
  }
}
