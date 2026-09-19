import type {
  CreatePurchaseCommand,
  EditPurchaseCommand,
  GetPurchaseDocumentQuery,
  GetPurchaseReceiptCostDecisionQuery,
  MatchPurchaseReceiptInvoiceCommand,
  PurchaseLifecycleCommand,
  ResolvePurchaseMovementCostCommand,
  StagePurchaseReceiptCommand,
} from "./contracts/purchase-application-contracts.ts";
import type { PurchaseDocumentListQuery, PurchaseDocumentRepository } from "./contracts/purchase-repository.ts";
import type { PurchaseDocumentSnapshot } from "../domain/purchase-document.ts";
import {
  purchaseCorrelationId,
  purchasePermissions,
  type PurchaseApprovalGateway,
  type PurchaseAuditAction,
  type PurchaseAuditSink,
  type PurchaseAuthorizationPolicy,
  type PurchasePermission,
  type PurchaseSecurityContext,
} from "./contracts/purchase-security.ts";
import { PurchaseApplicationError, type PurchaseApplicationServices } from "./purchase-application-service.ts";

export interface SecuredPurchaseServiceDependencies {
  readonly application: PurchaseApplicationServices;
  readonly documents: Pick<PurchaseDocumentRepository, "findById">;
  readonly authorization: PurchaseAuthorizationPolicy;
  readonly approval: PurchaseApprovalGateway;
  readonly audit: PurchaseAuditSink;
}

const actorName = (security: PurchaseSecurityContext): string =>
  security.actorDisplayName?.trim() || security.actorId.trim();

const approvalCycleKey = (document: PurchaseDocumentSnapshot): string => {
  for (let index = document.lifecycleHistory.length - 1; index >= 0; index -= 1) {
    const transition = document.lifecycleHistory[index];
    if (transition?.toStatus === "submitted") return transition.occurredAt;
  }
  throw new PurchaseApplicationError("PURCHASE_APP_INPUT_INVALID", "approvalCycle");
};

export class SecuredPurchaseService {
  constructor(public readonly deps: SecuredPurchaseServiceDependencies) {}

  async edit(security: PurchaseSecurityContext, command: EditPurchaseCommand): Promise<PurchaseDocumentSnapshot> {
    const before = await this.requireDocument(security, command, purchasePermissions.edit);
    const result = await this.deps.application.commands.edit(command);
    await this.record("purchase.document.edit", security, command.context, before, result, null, {
      version: result.version,
    });
    return result;
  }

  async create(security: PurchaseSecurityContext, command: CreatePurchaseCommand): Promise<PurchaseDocumentSnapshot> {
    await this.require(
      security,
      command.context.companyId,
      command.context.branchId,
      command.context.requestId,
      command.context.operationId,
      purchasePermissions.create,
    );
    const result = await this.deps.application.commands.create(command);
    await this.record("purchase.document.create", security, command.context, null, result, null, {
      documentType: result.documentType,
      version: result.version,
    });
    return result;
  }

  async submit(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    const before = await this.requireDocument(security, command, purchasePermissions.submit);
    const result = await this.deps.application.commands.submit(command);
    await this.deps.approval.submit({
      companyId: result.companyId,
      branchId: result.scope.branchId,
      documentId: result.documentId,
      documentNumber: result.documentNumber,
      approvalCycleKey: approvalCycleKey(result),
      actorId: security.actorId,
      actorDisplayName: actorName(security),
      correlationId: purchaseCorrelationId(security, command.context.requestId),
    });
    await this.record("purchase.document.submit", security, command.context, before, result, command.reason ?? null, {
      version: result.version,
    });
    return result;
  }

  async approve(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    const before = await this.requireDocument(security, command, purchasePermissions.approve);
    const cycleKey = approvalCycleKey(before);
    await this.deps.approval.approve({
      companyId: before.companyId,
      documentId: before.documentId,
      approvalCycleKey: cycleKey,
      actorId: security.actorId,
      actorDisplayName: actorName(security),
      correlationId: purchaseCorrelationId(security, command.context.requestId),
      comment: command.reason?.trim() || null,
    });
    const result = await this.deps.application.commands.approve(command);
    await this.record("purchase.document.approve", security, command.context, before, result, command.reason ?? null, {
      version: result.version,
      approvalCycleKey: cycleKey,
    });
    return result;
  }

  async confirm(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    const before = await this.requireDocument(security, command, purchasePermissions.confirm);
    const cycleKey = approvalCycleKey(before);
    await this.deps.approval.requireApproved(before.companyId, before.documentId, cycleKey);
    const result = await this.deps.application.commands.confirm(command);
    await this.record("purchase.document.confirm", security, command.context, before, result, command.reason ?? null, {
      version: result.version,
      approvalCycleKey: cycleKey,
    });
    return result;
  }

  async cancel(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    return this.lifecycle(security, command, purchasePermissions.cancel, "purchase.document.cancel", value => this.deps.application.commands.cancel(value));
  }

  async reopen(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    return this.lifecycle(security, command, purchasePermissions.reopen, "purchase.document.reopen", value => this.deps.application.commands.reopen(value));
  }

  async returnPurchase(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    return this.lifecycle(security, command, purchasePermissions.return, "purchase.document.return", value => this.deps.application.commands.returnPurchase(value), {
      relatedDocumentId: command.relatedDocumentId ?? null,
    });
  }

  async correct(security: PurchaseSecurityContext, command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot> {
    return this.lifecycle(security, command, purchasePermissions.correct, "purchase.document.correct", value => this.deps.application.commands.correct(value), {
      relatedDocumentId: command.relatedDocumentId ?? null,
    });
  }

  async stageInventoryReceipt(security: PurchaseSecurityContext, command: StagePurchaseReceiptCommand) {
    const before = await this.requireDocumentById(
      security, command.context, command.purchaseDocumentId, purchasePermissions.stageReceipt,
    );
    const result = await this.deps.application.commands.stageInventoryReceipt(command);
    await this.record("purchase.inventory-receipt.stage", security, command.context, before, before, null, {
      inventoryDocumentId: result.inventoryDocumentId,
      inventoryStatus: result.status,
      inventoryVersion: result.version,
    });
    return result;
  }

  async matchReceiptInvoice(security: PurchaseSecurityContext, command: MatchPurchaseReceiptInvoiceCommand) {
    const before = await this.requireDocumentById(
      security, command.context, command.match.invoiceDocumentId, purchasePermissions.manageMatching,
    );
    const result = await this.deps.application.commands.matchReceiptInvoice(command);
    await this.record("purchase.match.create", security, command.context, before, before, null, {
      matchId: result.matchId,
      receiptDocumentId: result.receiptDocumentId,
      receiptLineId: result.receiptLineId,
      invoiceLineId: result.invoiceLineId,
    });
    return result;
  }

  async resolveMovementCost(security: PurchaseSecurityContext, command: ResolvePurchaseMovementCostCommand) {
    await this.require(
      security,
      command.context.companyId,
      command.context.branchId,
      command.context.requestId,
      command.context.operationId,
      purchasePermissions.resolveCost,
    );
    const result = await this.deps.application.commands.resolveMovementCost(command);
    await this.deps.audit.record(Object.freeze({
      action: "purchase.cost.resolve",
      actorId: security.actorId,
      companyId: command.context.companyId,
      branchId: command.context.branchId,
      documentId: null,
      requestId: command.context.requestId,
      operationId: command.context.operationId,
      correlationId: purchaseCorrelationId(security, command.context.requestId),
      occurredAt: command.context.occurredAt,
      beforeStatus: null,
      afterStatus: null,
      reason: null,
      metadata: Object.freeze({
        movementId: command.movementId,
        costInputId: command.costInputId,
        resolutionStatus: result.status,
        unresolvedReason: result.reason,
      }),
    }));
    return result;
  }

  async getDocument(
    security: PurchaseSecurityContext,
    operation: { requestId: string; operationId: string; branchId: string },
    query: GetPurchaseDocumentQuery,
  ) {
    await this.require(security, query.companyId, operation.branchId, operation.requestId, operation.operationId, purchasePermissions.view);
    const result = await this.deps.application.queries.getDocument(query);
    if (result && result.scope.branchId !== operation.branchId) {
      await this.require(security, result.companyId, result.scope.branchId, operation.requestId, operation.operationId, purchasePermissions.view);
    }
    return result;
  }

  async listDocuments(
    security: PurchaseSecurityContext,
    operation: { requestId: string; operationId: string; branchId: string },
    query: PurchaseDocumentListQuery,
  ) {
    const branchId = query.branchId ?? operation.branchId;
    await this.require(security, query.companyId, branchId, operation.requestId, operation.operationId, purchasePermissions.view);
    return this.deps.application.queries.listDocuments({ ...query, branchId });
  }

  async getReceiptCostDecision(
    security: PurchaseSecurityContext,
    operation: { requestId: string; operationId: string; branchId: string },
    query: GetPurchaseReceiptCostDecisionQuery,
  ) {
    await this.require(security, query.companyId, operation.branchId, operation.requestId, operation.operationId, purchasePermissions.view);
    return this.deps.application.queries.getReceiptCostDecision(query);
  }

  private async lifecycle(
    security: PurchaseSecurityContext,
    command: PurchaseLifecycleCommand,
    permission: PurchasePermission,
    action: PurchaseAuditAction,
    mutate: (command: PurchaseLifecycleCommand) => Promise<PurchaseDocumentSnapshot>,
    metadata: Readonly<Record<string, string | number | boolean | null>> = {},
  ): Promise<PurchaseDocumentSnapshot> {
    const before = await this.requireDocument(security, command, permission);
    const result = await mutate(command);
    await this.record(action, security, command.context, before, result, command.reason ?? null, {
      version: result.version,
      ...metadata,
    });
    return result;
  }

  private async requireDocument(
    security: PurchaseSecurityContext,
    command: PurchaseLifecycleCommand,
    permission: PurchasePermission,
  ): Promise<PurchaseDocumentSnapshot> {
    return this.requireDocumentById(security, command.context, command.documentId, permission);
  }

  private async requireDocumentById(
    security: PurchaseSecurityContext,
    context: { companyId: string; requestId: string; operationId: string },
    documentId: string,
    permission: PurchasePermission,
  ): Promise<PurchaseDocumentSnapshot> {
    const document = await this.deps.documents.findById(context.companyId, documentId);
    if (!document) throw new PurchaseApplicationError("PURCHASE_APP_NOT_FOUND", "documentId");
    await this.require(
      security, document.companyId, document.scope.branchId,
      context.requestId, context.operationId, permission,
    );
    return document;
  }

  private async require(
    security: PurchaseSecurityContext,
    companyId: string,
    branchId: string,
    requestId: string,
    operationId: string,
    permission: PurchasePermission,
  ): Promise<void> {
    try {
      await this.deps.authorization.require({
        actorId: security.actorId,
        companyId,
        branchId,
        requestId,
        operationId,
        correlationId: purchaseCorrelationId(security, requestId),
      }, permission);
    } catch (error) {
      if (error instanceof PurchaseApplicationError) throw error;
      throw new PurchaseApplicationError("PURCHASE_APP_UNAUTHORIZED", "permission");
    }
  }

  private async record(
    action: PurchaseAuditAction,
    security: PurchaseSecurityContext,
    context: { companyId: string; branchId: string; requestId: string; operationId: string; occurredAt: string },
    before: PurchaseDocumentSnapshot | null,
    after: PurchaseDocumentSnapshot,
    reason: string | null,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    await this.deps.audit.record(Object.freeze({
      action,
      actorId: security.actorId,
      companyId: after.companyId,
      branchId: after.scope.branchId,
      documentId: after.documentId,
      requestId: context.requestId,
      operationId: context.operationId,
      correlationId: purchaseCorrelationId(security, context.requestId),
      occurredAt: context.occurredAt,
      beforeStatus: before?.status ?? null,
      afterStatus: after.status,
      reason: reason?.trim() || null,
      metadata: Object.freeze({ ...metadata }),
    }));
  }
}
