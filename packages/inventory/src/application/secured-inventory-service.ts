import type { InventoryDocumentSnapshot } from "../domain/inventory-document.ts";
import type { InventoryDocumentRepository } from "./contracts/inventory-repository.ts";
import type {
  InventoryApprovalGateway,
  InventoryAuditAction,
  InventoryAuditSink,
  InventoryAuthorizationPolicy,
  InventoryPermission,
  InventorySecurityContext,
} from "./contracts/inventory-security.ts";
import { inventoryCorrelationId, inventoryPermissions } from "./contracts/inventory-security.ts";
import type {
  ConfirmInventoryDocumentCommand,
  InventoryLifecycleCommand,
  ReverseInventoryCommand,
} from "./contracts/inventory-commands.ts";
import {
  INVENTORY_APPLICATION_ERROR_CODES,
  InventoryApplicationError,
} from "./contracts/inventory-errors.ts";
import { InventoryApplicationService, type InventoryApplicationMutationResult } from "./inventory-application-service.ts";

export interface SecuredInventoryServiceDependencies {
  readonly application: InventoryApplicationService;
  readonly documents: Pick<InventoryDocumentRepository, "findById">;
  readonly authorization: InventoryAuthorizationPolicy;
  readonly approval: InventoryApprovalGateway;
  readonly audit: InventoryAuditSink;
}

const normalizeActorName = (security: InventorySecurityContext): string =>
  security.actorDisplayName?.trim() || security.actorId.trim();

const occurredAtOf = (command: InventoryLifecycleCommand | ConfirmInventoryDocumentCommand | ReverseInventoryCommand): string =>
  command.action.occurredAt;

const reasonOf = (command: InventoryLifecycleCommand | ConfirmInventoryDocumentCommand | ReverseInventoryCommand): string | null =>
  command.action.reason?.trim() || null;

export class SecuredInventoryService {
  constructor(private readonly deps: SecuredInventoryServiceDependencies) {}

  async submit(security: InventorySecurityContext, command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    const before = await this.requireDocument(security, command, inventoryPermissions.submit);
    const result = await this.deps.application.submit(command);
    if (!result.replayed) {
      await this.deps.approval.submit({
        companyId: before.companyId,
        branchId: before.scope?.branchId ?? null,
        documentId: before.documentId,
        documentNumber: before.documentNumber,
        actorId: security.actorId,
        actorDisplayName: normalizeActorName(security),
        correlationId: inventoryCorrelationId(security, command.requestKey),
      });
      await this.record("inventory.document.submit", security, command, before, result);
    }
    return result;
  }

  async approve(security: InventorySecurityContext, command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    const before = await this.requireDocument(security, command, inventoryPermissions.approve);
    await this.deps.approval.approve({
      companyId: before.companyId,
      documentId: before.documentId,
      actorId: security.actorId,
      actorDisplayName: normalizeActorName(security),
      correlationId: inventoryCorrelationId(security, command.requestKey),
      comment: reasonOf(command),
    });
    const result = await this.deps.application.approve(command);
    if (!result.replayed) await this.record("inventory.document.approve", security, command, before, result);
    return result;
  }

  async confirm(security: InventorySecurityContext, command: ConfirmInventoryDocumentCommand): Promise<InventoryApplicationMutationResult> {
    const before = await this.requireDocument(security, command, inventoryPermissions.confirm);
    await this.deps.approval.requireApproved(before.companyId, before.documentId);
    const result = await this.deps.application.confirm(command);
    if (!result.replayed) await this.record("inventory.document.confirm", security, command, before, result);
    return result;
  }

  async reverse(security: InventorySecurityContext, command: ReverseInventoryCommand): Promise<InventoryApplicationMutationResult> {
    const before = await this.requireDocument(security, command, inventoryPermissions.reverse);
    const result = await this.deps.application.reverse(command);
    if (!result.replayed) await this.record("inventory.document.reverse", security, command, before, result, {
      reversalDocumentId: command.action.reversalDocumentId,
      reversalBusinessDate: command.businessDate,
    });
    return result;
  }

  async cancel(security: InventorySecurityContext, command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    const before = await this.requireDocument(security, command, inventoryPermissions.cancel);
    const result = await this.deps.application.cancel(command);
    if (!result.replayed) await this.record("inventory.document.cancel", security, command, before, result);
    return result;
  }

  private async requireDocument(
    security: InventorySecurityContext,
    command: { readonly companyId: string; readonly documentId: string; readonly requestKey: string },
    permission: InventoryPermission,
  ): Promise<InventoryDocumentSnapshot> {
    const document = await this.deps.documents.findById(command.companyId, command.documentId);
    if (!document) throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.notFound, "documentId");
    try {
      await this.deps.authorization.require({
        actorId: security.actorId,
        companyId: document.companyId,
        branchId: document.scope?.branchId ?? null,
        requestId: command.requestKey,
        correlationId: inventoryCorrelationId(security, command.requestKey),
      }, permission);
    } catch (error) {
      if (error instanceof InventoryApplicationError) throw error;
      throw new InventoryApplicationError(INVENTORY_APPLICATION_ERROR_CODES.unauthorized);
    }
    return document;
  }

  private async record(
    action: InventoryAuditAction,
    security: InventorySecurityContext,
    command: InventoryLifecycleCommand | ConfirmInventoryDocumentCommand | ReverseInventoryCommand,
    before: InventoryDocumentSnapshot,
    result: InventoryApplicationMutationResult,
    metadata: Readonly<Record<string, string | number | boolean | null>> = {},
  ): Promise<void> {
    await this.deps.audit.record(Object.freeze({
      action,
      actorId: security.actorId,
      companyId: before.companyId,
      branchId: before.scope?.branchId ?? null,
      documentId: before.documentId,
      requestId: command.requestKey,
      correlationId: inventoryCorrelationId(security, command.requestKey),
      occurredAt: occurredAtOf(command),
      beforeStatus: before.status,
      afterStatus: result.status,
      reason: reasonOf(command),
      metadata: Object.freeze({ version: result.version, ...metadata }),
    }));
  }
}
