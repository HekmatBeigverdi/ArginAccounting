import type { InventoryProductReference, InventoryWarehouseResolution } from "../domain/inventory-operation.ts";
import {
  createInventoryStockKey,
  rebuildInventoryStockLedger,
  type InventoryStockBalanceSnapshot,
  type InventoryStockMovementSnapshot,
} from "../domain/inventory-stock.ts";
import type { InventoryDocumentSnapshot, InventoryDocumentStatus } from "../domain/inventory-document.ts";
import {
  approveInventoryDocument,
  cancelInventoryDocument,
  rehydrateInventoryDocument,
  submitInventoryDocument,
} from "../domain/inventory-document.ts";
import { INVENTORY_DOMAIN_ERROR_CODES, InventoryDomainError } from "../domain/inventory-errors.ts";
import {
  confirmInventoryReceiptIssueOpening,
  serializeInventoryOpeningBalanceKey,
  type InventoryLineConfirmationResolution,
  type InventoryLineMovementIdentity,
  type InventoryOpeningBalanceKey,
} from "./inventory-core-workflows.ts";
import {
  confirmInventoryQuantityAdjustment,
  confirmInventoryTransfer,
  reverseInventoryStockEffects,
  type InventoryReversalMovementIdentity,
  type InventoryTransferLineMovementIdentity,
  type InventoryTransferLineResolution,
} from "./inventory-transfer-adjustment-workflows.ts";
import {
  validateInventoryDocumentScope,
  type InventoryScopeContext,
  type InventoryScopeReaders,
} from "./inventory-scope-validation.ts";
import type {
  ConfirmInventoryDocumentCommand,
  InventoryLifecycleCommand,
  ReverseInventoryCommand,
} from "./contracts/inventory-commands.ts";
import {
  INVENTORY_APPLICATION_ERROR_CODES as appCodes,
  InventoryApplicationError,
} from "./contracts/inventory-errors.ts";
import type {
  InventoryIdempotencyOutcomeKind,
  InventoryIdempotencyRecord,
} from "./contracts/inventory-repository.ts";
import type { InventoryUnitOfWork, InventoryUnitOfWorkContext } from "./contracts/inventory-unit-of-work.ts";

export interface InventoryApplicationMutationResult {
  readonly documentId: string;
  readonly status: InventoryDocumentStatus;
  readonly version: number;
  readonly replayed: boolean;
}

export interface InventoryApplicationIdentityFactory {
  movementId(input: {
    readonly documentId: string;
    readonly lineId: string;
    readonly role: "single" | "source" | "destination" | "reversal";
  }): string;
  transferId(input: { readonly documentId: string }): string;
}

export interface InventoryCurrentMasterResolver {
  product(companyId: string, productId: string): Promise<InventoryProductReference | null>;
  warehouse(
    companyId: string,
    reference: { readonly warehouseId: string; readonly zoneId?: string | null; readonly locationId?: string | null },
  ): Promise<InventoryWarehouseResolution>;
}

export interface InventoryNumberingGateway {
  /** Called only when submission requires a display number and the document has none. */
  assign(document: InventoryDocumentSnapshot): Promise<InventoryDocumentSnapshot>;
}

export interface InventoryApplicationServiceDependencies {
  readonly uow: InventoryUnitOfWork;
  readonly scopeReaders: InventoryScopeReaders;
  readonly scopeContext: (companyId: string, actorUserId: string) => InventoryScopeContext;
  readonly masters: InventoryCurrentMasterResolver;
  readonly identities: InventoryApplicationIdentityFactory;
  readonly numbering: InventoryNumberingGateway;
}

const fail = (code: (typeof appCodes)[keyof typeof appCodes], field: string | null = null): never => {
  throw new InventoryApplicationError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(appCodes.invalidRequest, field);
  return value.trim();
}

function assertExpectedVersion(document: InventoryDocumentSnapshot, expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || document.version !== expectedVersion) {
    fail(appCodes.concurrencyConflict, "expectedVersion");
  }
}

function operationName(prefix: string, documentId: string): string {
  return `${prefix}:${required(documentId, "documentId")}`;
}

function replayResult(record: InventoryIdempotencyRecord): InventoryApplicationMutationResult {
  return Object.freeze({
    documentId: record.documentId,
    status: record.documentStatus,
    version: record.documentVersion ?? 0,
    replayed: true,
  });
}

async function idempotencyStart(
  context: InventoryUnitOfWorkContext,
  input: { readonly companyId: string; readonly requestKey: string; readonly payloadFingerprint: string },
  operation: string,
): Promise<InventoryApplicationMutationResult | null> {
  const companyId = required(input.companyId, "companyId");
  const requestKey = required(input.requestKey, "requestKey");
  const fingerprint = required(input.payloadFingerprint, "payloadFingerprint");
  const prior = await context.idempotency.find(companyId, requestKey);
  if (!prior) return null;
  if (prior.operation !== operation || prior.payloadFingerprint !== fingerprint) {
    return fail(appCodes.idempotencyConflict, "requestKey");
  }
  return replayResult(prior);
}

async function persistOutcome(
  context: InventoryUnitOfWorkContext,
  input: { readonly companyId: string; readonly requestKey: string; readonly payloadFingerprint: string },
  operation: string,
  outcomeKind: InventoryIdempotencyOutcomeKind,
  document: InventoryDocumentSnapshot,
  recordedAt: string,
): Promise<InventoryApplicationMutationResult> {
  await context.idempotency.add(Object.freeze({
    companyId: input.companyId,
    requestKey: input.requestKey,
    operation,
    payloadFingerprint: input.payloadFingerprint,
    outcomeKind,
    documentId: document.documentId,
    documentVersion: document.version,
    documentStatus: document.status,
    recordedAt,
  }));
  return Object.freeze({
    documentId: document.documentId,
    status: document.status,
    version: document.version,
    replayed: false,
  });
}

function mapDomainError(error: unknown): never {
  if (!(error instanceof InventoryDomainError)) throw error;
  if (error.code === INVENTORY_DOMAIN_ERROR_CODES.negativeStock) return fail(appCodes.stockConflict, error.field);
  if (error.code === INVENTORY_DOMAIN_ERROR_CODES.openingDuplicate) return fail(appCodes.duplicateOpening, error.field);
  if (error.code === INVENTORY_DOMAIN_ERROR_CODES.duplicateMovementId ||
      error.code === INVENTORY_DOMAIN_ERROR_CODES.duplicateMovementSource) {
    return fail(appCodes.duplicateMovement, error.field);
  }
  return fail(appCodes.invalidRequest, error.field);
}

async function loadDocument(
  context: InventoryUnitOfWorkContext,
  companyId: string,
  documentId: string,
): Promise<InventoryDocumentSnapshot> {
  const document = await context.documents.findById(required(companyId, "companyId"), required(documentId, "documentId"));
  if (!document) return fail(appCodes.notFound, "documentId");
  return rehydrateInventoryDocument(document);
}

async function buildAuthoritativeLedger(
  context: InventoryUnitOfWorkContext,
  document: InventoryDocumentSnapshot,
): Promise<ReturnType<typeof rebuildInventoryStockLedger>> {
  const byMovementId = new Map<string, InventoryStockMovementSnapshot>();
  for (const line of document.lines) {
    if (!line.operation) continue;
    const references = [line.operation.warehouse, line.operation.destination]
      .filter((item): item is NonNullable<typeof item> => item !== null);
    for (const warehouse of references) {
      const stockKey = createInventoryStockKey({
        companyId: document.companyId,
        productId: line.productId,
        warehouse,
      });
      for (const movement of await context.movements.listByStockKey(stockKey)) {
        byMovementId.set(movement.movementId, movement);
      }
    }
  }
  return rebuildInventoryStockLedger([...byMovementId.values()], { allowNegativeStock: true });
}

async function resolveCoreLines(
  deps: InventoryApplicationServiceDependencies,
  document: InventoryDocumentSnapshot,
): Promise<readonly InventoryLineConfirmationResolution[]> {
  return Promise.all(document.lines.map(async line => {
    if (!line.operation) return fail(appCodes.invalidRequest, "line.operation");
    return Object.freeze({
      lineId: line.lineId,
      product: await deps.masters.product(document.companyId, line.productId),
      warehouse: await deps.masters.warehouse(document.companyId, line.operation.warehouse),
    });
  }));
}

function coreMovementIdentities(
  deps: InventoryApplicationServiceDependencies,
  document: InventoryDocumentSnapshot,
): readonly InventoryLineMovementIdentity[] {
  return Object.freeze(document.lines.map(line => Object.freeze({
    lineId: line.lineId,
    movementId: deps.identities.movementId({
      documentId: document.documentId,
      lineId: line.lineId,
      role: "single",
    }),
  })));
}

async function existingOpeningKeys(
  context: InventoryUnitOfWorkContext,
  document: InventoryDocumentSnapshot,
): Promise<readonly InventoryOpeningBalanceKey[]> {
  if (document.documentType !== "opening" || !document.scope) return [];
  const result: InventoryOpeningBalanceKey[] = [];
  for (const line of document.lines) {
    if (!line.operation) continue;
    const key: InventoryOpeningBalanceKey = Object.freeze({
      companyId: document.companyId,
      fiscalYearId: document.scope.fiscalYearId,
      stockKey: createInventoryStockKey({
        companyId: document.companyId,
        productId: line.productId,
        warehouse: line.operation.warehouse,
      }),
    });
    if (await context.openings.exists(key)) result.push(key);
  }
  return result;
}

async function resolveTransferLines(
  deps: InventoryApplicationServiceDependencies,
  document: InventoryDocumentSnapshot,
): Promise<readonly InventoryTransferLineResolution[]> {
  return Promise.all(document.lines.map(async line => {
    if (!line.operation?.destination) return fail(appCodes.invalidRequest, "line.operation.destination");
    return Object.freeze({
      lineId: line.lineId,
      product: await deps.masters.product(document.companyId, line.productId),
      sourceWarehouse: await deps.masters.warehouse(document.companyId, line.operation.warehouse),
      destinationWarehouse: await deps.masters.warehouse(document.companyId, line.operation.destination),
    });
  }));
}

function transferMovementIdentities(
  deps: InventoryApplicationServiceDependencies,
  document: InventoryDocumentSnapshot,
): readonly InventoryTransferLineMovementIdentity[] {
  return Object.freeze(document.lines.map(line => Object.freeze({
    lineId: line.lineId,
    sourceMovementId: deps.identities.movementId({
      documentId: document.documentId,
      lineId: line.lineId,
      role: "source",
    }),
    destinationMovementId: deps.identities.movementId({
      documentId: document.documentId,
      lineId: line.lineId,
      role: "destination",
    }),
  })));
}

function newOpeningKeys(
  all: readonly InventoryOpeningBalanceKey[],
  existing: readonly InventoryOpeningBalanceKey[],
): readonly InventoryOpeningBalanceKey[] {
  const prior = new Set(existing.map(serializeInventoryOpeningBalanceKey));
  return Object.freeze(all.filter(key => !prior.has(serializeInventoryOpeningBalanceKey(key))));
}

export class InventoryApplicationService {
  constructor(private readonly deps: InventoryApplicationServiceDependencies) {}

  private async lifecycle(
    command: InventoryLifecycleCommand,
    kind: "submit" | "approve" | "cancel",
  ): Promise<InventoryApplicationMutationResult> {
    const operation = operationName(kind, command.documentId);
    return this.deps.uow.execute(async context => {
      const replay = await idempotencyStart(context, command, operation);
      if (replay) return replay;
      let current = await loadDocument(context, command.companyId, command.documentId);
      assertExpectedVersion(current, command.expectedVersion);
      try {
        if (kind === "submit" && current.documentNumber === null) {
          current = await this.deps.numbering.assign(current);
        }
        const next = kind === "submit"
          ? submitInventoryDocument(current, command.action)
          : kind === "approve"
            ? approveInventoryDocument(current, command.action)
            : cancelInventoryDocument(current, command.action);
        await context.documents.update(next, command.expectedVersion);
        return persistOutcome(context, command, operation, "document", next, command.action.occurredAt);
      } catch (error) {
        return mapDomainError(error);
      }
    });
  }

  submit(command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    return this.lifecycle(command, "submit");
  }

  approve(command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    return this.lifecycle(command, "approve");
  }

  cancel(command: InventoryLifecycleCommand): Promise<InventoryApplicationMutationResult> {
    return this.lifecycle(command, "cancel");
  }

  async confirm(command: ConfirmInventoryDocumentCommand): Promise<InventoryApplicationMutationResult> {
    const operation = operationName("confirm", command.documentId);
    return this.deps.uow.execute(async context => {
      const replay = await idempotencyStart(context, command, operation);
      if (replay) return replay;

      const document = await loadDocument(context, command.companyId, command.documentId);
      assertExpectedVersion(document, command.expectedVersion);
      const ledger = await buildAuthoritativeLedger(context, document);
      const businessOrder = await context.businessOrders.next(document.companyId, document.businessDate);
      const scopeContext = this.deps.scopeContext(document.companyId, command.action.actorUserId);

      try {
        let confirmed: InventoryDocumentSnapshot;
        let movements: readonly InventoryStockMovementSnapshot[];
        let balances: readonly InventoryStockBalanceSnapshot[];
        let openingKeysToAdd: readonly InventoryOpeningBalanceKey[] = [];

        if (document.documentType === "receipt" || document.documentType === "issue" || document.documentType === "opening") {
          const existingOpenings = await existingOpeningKeys(context, document);
          const result = await confirmInventoryReceiptIssueOpening({
            document,
            action: command.action,
            scopeContext,
            scopeReaders: this.deps.scopeReaders,
            businessOrder,
            movementIdentities: coreMovementIdentities(this.deps, document),
            lineResolutions: await resolveCoreLines(this.deps, document),
            ledger,
            openingKeys: existingOpenings,
            allowNegativeStock: command.allowNegativeStock,
          });
          confirmed = result.document;
          movements = result.movements;
          balances = result.ledger.balances;
          openingKeysToAdd = document.documentType === "opening"
            ? newOpeningKeys(result.openingKeys, existingOpenings)
            : [];
        } else if (document.documentType === "transfer") {
          const result = await confirmInventoryTransfer({
            document,
            action: command.action,
            scopeContext,
            scopeReaders: this.deps.scopeReaders,
            transferId: this.deps.identities.transferId({ documentId: document.documentId }),
            businessOrder,
            movementIdentities: transferMovementIdentities(this.deps, document),
            lineResolutions: await resolveTransferLines(this.deps, document),
            ledger,
            allowNegativeStock: command.allowNegativeStock,
          });
          confirmed = result.document;
          movements = result.movements;
          balances = result.ledger.balances;
        } else {
          const result = await confirmInventoryQuantityAdjustment({
            document,
            action: command.action,
            scopeContext,
            scopeReaders: this.deps.scopeReaders,
            businessOrder,
            movementIdentities: coreMovementIdentities(this.deps, document),
            lineResolutions: await resolveCoreLines(this.deps, document),
            ledger,
            allowNegativeStock: command.allowNegativeStock,
          });
          confirmed = result.document;
          movements = result.movements;
          balances = result.ledger.balances;
        }

        await context.movements.appendBatch(movements);
        await context.balances.replaceBatch(balances);
        if (openingKeysToAdd.length) await context.openings.addBatch(openingKeysToAdd);
        await context.documents.update(confirmed, command.expectedVersion);
        return persistOutcome(
          context,
          command,
          operation,
          "confirmation",
          confirmed,
          command.action.occurredAt,
        );
      } catch (error) {
        return mapDomainError(error);
      }
    });
  }

  async reverse(command: ReverseInventoryCommand): Promise<InventoryApplicationMutationResult> {
    const operation = operationName("reverse", command.documentId);
    return this.deps.uow.execute(async context => {
      const replay = await idempotencyStart(context, command, operation);
      if (replay) return replay;

      const document = await loadDocument(context, command.companyId, command.documentId);
      assertExpectedVersion(document, command.expectedVersion);
      const scopeContext = this.deps.scopeContext(document.companyId, command.action.actorUserId);

      try {
        await validateInventoryDocumentScope(
          Object.freeze({ ...document, businessDate: command.businessDate }),
          scopeContext,
          this.deps.scopeReaders,
        );
        const originals = await context.movements.listByDocument(document.companyId, document.documentId);
        if (!originals.length) return fail(appCodes.invalidRequest, "movements");
        const ledger = await buildAuthoritativeLedger(context, document);
        const businessOrder = await context.businessOrders.next(document.companyId, command.businessDate);
        const identities: InventoryReversalMovementIdentity[] = originals.map(movement => Object.freeze({
          originalMovementId: movement.movementId,
          reversalMovementId: this.deps.identities.movementId({
            documentId: command.action.reversalDocumentId,
            lineId: movement.lineId,
            role: "reversal",
          }),
        }));
        const result = reverseInventoryStockEffects({
          document,
          action: command.action,
          businessDate: command.businessDate,
          businessOrder,
          movementIdentities: identities,
          ledger,
          allowNegativeStock: false,
        });
        await context.movements.appendBatch(result.movements);
        await context.balances.replaceBatch(result.ledger.balances);
        await context.documents.update(result.document, command.expectedVersion);
        return persistOutcome(
          context,
          command,
          operation,
          "reversal",
          result.document,
          command.action.occurredAt,
        );
      } catch (error) {
        return mapDomainError(error);
      }
    });
  }
}
