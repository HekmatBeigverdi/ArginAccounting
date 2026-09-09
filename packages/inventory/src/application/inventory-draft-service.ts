import {
  assertInventoryDocumentDeletable,
  assertInventoryDocumentEditable,
  createInventoryDocument,
  rehydrateInventoryDocument,
  type InventoryDocumentSnapshot,
} from "../domain/inventory-document.ts";
import type {
  CreateInventoryDocumentCommand,
  DeleteInventoryDraftCommand,
  SaveInventoryDraftCommand,
} from "./contracts/inventory-commands.ts";
import {
  INVENTORY_APPLICATION_ERROR_CODES as codes,
  InventoryApplicationError,
} from "./contracts/inventory-errors.ts";
import type { InventoryUnitOfWork } from "./contracts/inventory-unit-of-work.ts";

export interface InventoryDraftMutationResult {
  readonly document: InventoryDocumentSnapshot;
  readonly replayed: boolean;
}

const fail = (code: (typeof codes)[keyof typeof codes], field: string | null = null): never => {
  throw new InventoryApplicationError(code, field);
};

const required = (value: string, field: string): string => {
  const normalized = value?.trim();
  if (!normalized) return fail(codes.invalidRequest, field);
  return normalized;
};

export class InventoryDraftService {
  constructor(private readonly uow: InventoryUnitOfWork) {}

  async create(command: CreateInventoryDocumentCommand): Promise<InventoryDraftMutationResult> {
    return this.uow.execute(async (context) => {
      const companyId = required(command.companyId, "companyId");
      const requestKey = required(command.requestKey, "requestKey");
      const fingerprint = required(command.payloadFingerprint, "payloadFingerprint");
      const operation = `create:${required(command.document.documentId, "documentId")}`;
      const prior = await context.idempotency.find(companyId, requestKey);
      if (prior) {
        if (prior.operation !== operation || prior.payloadFingerprint !== fingerprint) {
          return fail(codes.idempotencyConflict, "requestKey");
        }
        const replayed = await context.documents.findById(companyId, prior.documentId);
        if (!replayed) return fail(codes.notFound, "documentId");
        return Object.freeze({ document: replayed, replayed: true });
      }
      const document = createInventoryDocument(command.document);
      if (document.companyId !== companyId) return fail(codes.invalidRequest, "companyId");
      await context.documents.add(document);
      await context.idempotency.add(Object.freeze({
        companyId,
        requestKey,
        operation,
        payloadFingerprint: fingerprint,
        outcomeKind: "document",
        documentId: document.documentId,
        documentVersion: document.version,
        documentStatus: document.status,
        recordedAt: document.createdAt,
      }));
      return Object.freeze({ document, replayed: false });
    });
  }

  async save(command: SaveInventoryDraftCommand): Promise<InventoryDraftMutationResult> {
    return this.uow.execute(async (context) => {
      const companyId = required(command.companyId, "companyId");
      const requestKey = required(command.requestKey, "requestKey");
      const fingerprint = required(command.payloadFingerprint, "payloadFingerprint");
      const documentId = required(command.document.documentId, "documentId");
      const operation = `save:${documentId}`;
      const prior = await context.idempotency.find(companyId, requestKey);
      if (prior) {
        if (prior.operation !== operation || prior.payloadFingerprint !== fingerprint) {
          return fail(codes.idempotencyConflict, "requestKey");
        }
        const replayed = await context.documents.findById(companyId, documentId);
        if (!replayed) return fail(codes.notFound, "documentId");
        return Object.freeze({ document: replayed, replayed: true });
      }
      const current = await context.documents.findById(companyId, documentId);
      if (!current) return fail(codes.notFound, "documentId");
      if (current.version !== command.expectedVersion) return fail(codes.concurrencyConflict, "expectedVersion");
      assertInventoryDocumentEditable(current);
      const requested = rehydrateInventoryDocument(command.document);
      if (requested.companyId !== current.companyId || requested.documentId !== current.documentId) {
        return fail(codes.invalidRequest, "documentId");
      }
      const next = rehydrateInventoryDocument({
        ...requested,
        status: current.status,
        lifecycleHistory: current.lifecycleHistory,
        documentNumber: current.documentNumber,
        createdAt: current.createdAt,
        version: current.version + 1,
      });
      await context.documents.update(next, command.expectedVersion);
      await context.idempotency.add(Object.freeze({
        companyId,
        requestKey,
        operation,
        payloadFingerprint: fingerprint,
        outcomeKind: "document",
        documentId,
        documentVersion: next.version,
        documentStatus: next.status,
        recordedAt: next.updatedAt,
      }));
      return Object.freeze({ document: next, replayed: false });
    });
  }

  async delete(command: DeleteInventoryDraftCommand): Promise<void> {
    await this.uow.execute(async (context) => {
      const current = await context.documents.findById(command.companyId, command.documentId);
      if (!current) return fail(codes.notFound, "documentId");
      if (current.version !== command.expectedVersion) return fail(codes.concurrencyConflict, "expectedVersion");
      assertInventoryDocumentDeletable(current);
      const prior = await context.idempotency.find(command.companyId, command.requestKey);
      const operation = `delete:${command.documentId}`;
      if (prior) {
        if (prior.operation !== operation || prior.payloadFingerprint !== command.payloadFingerprint) {
          return fail(codes.idempotencyConflict, "requestKey");
        }
        return;
      }
      await context.documents.markDraftDeleted(
        command.companyId,
        command.documentId,
        command.expectedVersion,
        command.deletedAt,
      );
      await context.idempotency.add(Object.freeze({
        companyId: command.companyId,
        requestKey: command.requestKey,
        operation,
        payloadFingerprint: command.payloadFingerprint,
        outcomeKind: "deletion",
        documentId: command.documentId,
        documentVersion: current.version + 1,
        documentStatus: current.status,
        recordedAt: command.deletedAt,
      }));
    });
  }
}
