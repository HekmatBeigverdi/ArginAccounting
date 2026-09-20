import {
  approvePurchaseDocument,
  cancelPurchaseDocument,
  confirmPurchaseDocument,
  correctPurchaseDocument,
  createPurchaseDocument,
  rehydratePurchaseDocument,
  reopenPurchaseDocument,
  returnPurchaseDocument,
  submitPurchaseDocument,
} from "../domain/purchase-document.ts";
import type { PurchaseDocumentSnapshot } from "../domain/purchase-document.ts";
import type { PurchaseCommercialTerms } from "../domain/purchase-commercial-semantics.ts";
import {
  createPurchaseReceiptInvoiceMatch,
} from "../domain/purchase-receipt-invoice-matching.ts";
import type {
  PurchaseReceiptInvoiceMatchSnapshot,
  PurchaseReceiptMatchingLineReference,
} from "../domain/purchase-receipt-invoice-matching.ts";
import {
  stagePurchaseInventoryReceipt,
} from "../domain/purchase-inventory-receipt-integration.ts";
import type { PurchaseInventoryReceiptPort } from "../domain/purchase-inventory-receipt-integration.ts";
import {
  evaluatePurchaseReceiptBeforeInvoiceCost,
} from "../domain/purchase-receipt-before-invoice-policy.ts";
import type {
  PurchaseReceiptBeforeInvoiceCostDecision,
} from "../domain/purchase-receipt-before-invoice-policy.ts";
import type {
  PurchaseInventoryValuationCommercialFact,
  PurchaseValuationMovementReference,
} from "../domain/purchase-inventory-valuation-cost-input.ts";
import {
  createPurchaseOperationContext,
  normalizePurchaseDocumentListQuery,
} from "./contracts/purchase-application-contracts.ts";
import type {
  CreatePurchaseCommand,
  GetPurchaseDocumentQuery,
  GetPurchaseReceiptCostDecisionQuery,
  MatchPurchaseReceiptInvoiceCommand,
  PurchaseApplicationCommandService,
  PurchaseApplicationQueryService,
  PurchaseFiscalEligibilityPort,
  PurchaseLifecycleCommand,
  PurchaseNumberReservationPort,
  ResolvePurchaseMovementCostCommand,
  StagePurchaseReceiptCommand,
} from "./contracts/purchase-application-contracts.ts";
import type {
  PurchaseCommercialFactSnapshot,
  PurchaseDocumentListQuery,
  PurchaseIdempotencyOutcomeKind,
  PurchaseIdempotencyRecord,
} from "./contracts/purchase-repository.ts";
import type {
  PurchaseUnitOfWork,
  PurchaseUnitOfWorkContext,
} from "./contracts/purchase-unit-of-work.ts";

export type PurchaseApplicationErrorCode =
  | "PURCHASE_APP_INPUT_INVALID"
  | "PURCHASE_APP_NOT_FOUND"
  | "PURCHASE_APP_VERSION_CONFLICT"
  | "PURCHASE_APP_IDEMPOTENCY_CONFLICT"
  | "PURCHASE_APP_SCOPE_MISMATCH"
  | "PURCHASE_APP_DEPENDENCY_INVALID"
  | "PURCHASE_APP_UNAUTHORIZED";

export class PurchaseApplicationError extends Error {
  constructor(
    public readonly code: PurchaseApplicationErrorCode,
    public readonly field: string,
  ) {
    super(`${code}:${field}`);
    this.name = "PurchaseApplicationError";
  }
}

export interface PurchaseReceiptLineReaderPort {
  findConfirmedLine(input: {
    readonly companyId: string;
    readonly receiptDocumentId: string;
    readonly receiptLineId: string;
  }): Promise<PurchaseReceiptMatchingLineReference | null>;
}

export interface PurchaseInventoryMovementReaderPort {
  findById(companyId: string, movementId: string): Promise<PurchaseValuationMovementReference | null>;
}

export interface PurchaseValuationRecalculationPort {
  /** Must treat requestId + operationId as a replay-safe identity. */
  costBasisChanged(input: {
    readonly companyId: string;
    readonly movement: PurchaseValuationMovementReference;
    readonly requestId: string;
    readonly operationId: string;
  }): Promise<void>;
}

export interface PurchaseApplicationServiceDependencies {
  readonly uow: PurchaseUnitOfWork;
  readonly fiscalEligibility: PurchaseFiscalEligibilityPort;
  readonly numberReservation: PurchaseNumberReservationPort;
  readonly inventoryReceipt: PurchaseInventoryReceiptPort;
  readonly receiptLines: PurchaseReceiptLineReaderPort;
  readonly inventoryMovements: PurchaseInventoryMovementReaderPort;
  readonly valuationRecalculation: PurchaseValuationRecalculationPort;
}

export interface PurchaseApplicationServices {
  readonly commands: PurchaseApplicationCommandService;
  readonly queries: PurchaseApplicationQueryService;
}

const fail = (code: PurchaseApplicationErrorCode, field: string): never => {
  throw new PurchaseApplicationError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("PURCHASE_APP_INPUT_INVALID", field);
  return value.trim();
}

function assertDependencies(value: PurchaseApplicationServiceDependencies): void {
  if (!value || typeof value !== "object") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "dependencies");
  if (!value.uow || typeof value.uow.execute !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "uow");
  if (!value.fiscalEligibility || typeof value.fiscalEligibility.assertOperationAllowed !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "fiscalEligibility");
  if (!value.numberReservation || typeof value.numberReservation.reserve !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "numberReservation");
  if (!value.inventoryReceipt || typeof value.inventoryReceipt.stageDraft !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "inventoryReceipt");
  if (!value.receiptLines || typeof value.receiptLines.findConfirmedLine !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "receiptLines");
  if (!value.inventoryMovements || typeof value.inventoryMovements.findById !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "inventoryMovements");
  if (!value.valuationRecalculation || typeof value.valuationRecalculation.costBasisChanged !== "function") return fail("PURCHASE_APP_DEPENDENCY_INVALID", "valuationRecalculation");
}

function assertContextMatchesDocument(
  context: ReturnType<typeof createPurchaseOperationContext>,
  document: PurchaseDocumentSnapshot,
): void {
  if (document.companyId !== context.companyId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "context.companyId");
  if (document.scope.branchId !== context.branchId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "context.branchId");
}

async function assertFiscalAllowed(
  port: PurchaseFiscalEligibilityPort,
  document: Pick<PurchaseDocumentSnapshot, "companyId" | "businessDate" | "scope">,
): Promise<void> {
  await port.assertOperationAllowed({
    companyId: document.companyId,
    branchId: document.scope.branchId,
    fiscalYearId: document.scope.fiscalYearId,
    fiscalPeriodId: document.scope.fiscalPeriodId,
    businessDate: document.businessDate,
  });
}

async function getDocument(
  context: PurchaseUnitOfWorkContext,
  companyId: string,
  documentId: string,
): Promise<PurchaseDocumentSnapshot> {
  const document = await context.documents.findById(required(companyId, "companyId"), required(documentId, "documentId"));
  if (!document) return fail("PURCHASE_APP_NOT_FOUND", "documentId");
  return document;
}

function validateExpectedVersion(document: PurchaseDocumentSnapshot, expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) return fail("PURCHASE_APP_INPUT_INVALID", "expectedVersion");
  if (document.version !== expectedVersion) return fail("PURCHASE_APP_VERSION_CONFLICT", "expectedVersion");
}

function operationName(prefix: string, identity: string): string {
  return `${prefix}:${required(identity, "operationIdentity")}`;
}

function sameIdempotencyRecord(left: PurchaseIdempotencyRecord, right: PurchaseIdempotencyRecord): boolean {
  return left.companyId === right.companyId &&
    left.requestId === right.requestId &&
    left.operationId === right.operationId &&
    left.operation === right.operation &&
    left.payloadFingerprint === right.payloadFingerprint;
}

async function replayIfCommitted<T>(
  repositories: PurchaseUnitOfWorkContext,
  operationContext: ReturnType<typeof createPurchaseOperationContext>,
  operation: string,
): Promise<T | null> {
  const [byRequest, byOperation] = await Promise.all([
    repositories.idempotency.findByRequestId(operationContext.companyId, operationContext.requestId),
    repositories.idempotency.findByOperationId(operationContext.companyId, operationContext.operationId),
  ]);
  if (byRequest === null && byOperation === null) return null;

  const prior = byRequest ?? byOperation!;
  if (
    prior.requestId !== operationContext.requestId ||
    prior.operationId !== operationContext.operationId ||
    prior.operation !== operation ||
    prior.payloadFingerprint !== operationContext.payloadFingerprint ||
    (byRequest !== null && byOperation !== null && !sameIdempotencyRecord(byRequest, byOperation))
  ) {
    return fail("PURCHASE_APP_IDEMPOTENCY_CONFLICT", "requestId");
  }

  try {
    return JSON.parse(prior.resultJson) as T;
  } catch {
    return fail("PURCHASE_APP_DEPENDENCY_INVALID", "idempotency.resultJson");
  }
}

async function persistIdempotentOutcome<T>(
  repositories: PurchaseUnitOfWorkContext,
  operationContext: ReturnType<typeof createPurchaseOperationContext>,
  operation: string,
  outcomeKind: PurchaseIdempotencyOutcomeKind,
  outcomeId: string,
  outcomeVersion: number | null,
  outcomeStatus: string | null,
  result: T,
): Promise<T> {
  await repositories.idempotency.add(Object.freeze({
    companyId: operationContext.companyId,
    requestId: operationContext.requestId,
    operationId: operationContext.operationId,
    operation,
    payloadFingerprint: operationContext.payloadFingerprint,
    outcomeKind,
    outcomeId,
    outcomeVersion,
    outcomeStatus,
    resultJson: JSON.stringify(result),
    recordedAt: operationContext.occurredAt,
  }));
  return result;
}

function commercialFactsFromCreate(
  document: PurchaseDocumentSnapshot,
  termsByLine: Readonly<Record<string, PurchaseCommercialTerms>>,
): readonly PurchaseCommercialFactSnapshot[] {
  if (!termsByLine || typeof termsByLine !== "object") return fail("PURCHASE_APP_INPUT_INVALID", "commercialTermsByLine");
  const facts: PurchaseCommercialFactSnapshot[] = [];
  const validLineIds = new Set(document.lines.map(line => line.lineId));
  for (const key of Object.keys(termsByLine)) {
    if (!validLineIds.has(key)) return fail("PURCHASE_APP_INPUT_INVALID", `commercialTermsByLine.${key}`);
  }
  for (const line of document.lines) {
    const terms = termsByLine[line.lineId];
    if (!terms) return fail("PURCHASE_APP_INPUT_INVALID", `commercialTermsByLine.${line.lineId}`);
    facts.push(Object.freeze({
      companyId: document.companyId,
      purchaseDocumentId: document.documentId,
      purchaseLineId: line.lineId,
      commercialTerms: terms,
      revision: 1,
    }));
  }
  return Object.freeze(facts);
}

function lifecycleAction(command: PurchaseLifecycleCommand) {
  const context = createPurchaseOperationContext(command.context);
  return {
    occurredAt: context.occurredAt,
    actorUserId: context.actorUserId,
    ...(command.reason !== undefined ? { reason: command.reason } : {}),
  };
}

async function buildCostDecision(
  uow: PurchaseUnitOfWork,
  movement: PurchaseValuationMovementReference,
  costInputId: string,
): Promise<PurchaseReceiptBeforeInvoiceCostDecision> {
  return uow.execute(async repositories => {
    const matches = await repositories.matches.listByReceiptLine(
      movement.companyId,
      movement.documentId,
      movement.lineId,
    );
    const facts: PurchaseInventoryValuationCommercialFact[] = [];
    const seen = new Set<string>();
    for (const match of matches) {
      const key = `${match.invoiceDocumentId}:${match.invoiceLineId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const invoice = await repositories.documents.findById(movement.companyId, match.invoiceDocumentId);
      if (!invoice) continue;
      const line = invoice.lines.find(candidate => candidate.lineId === match.invoiceLineId);
      if (!line) continue;
      const commercial = await repositories.commercialFacts.findByLine(
        movement.companyId,
        invoice.documentId,
        line.lineId,
      );
      if (!commercial) continue;
      facts.push(Object.freeze({
        companyId: invoice.companyId,
        purchaseDocumentId: invoice.documentId,
        purchaseLineId: line.lineId,
        documentType: invoice.documentType,
        status: invoice.status,
        lineKind: line.lineKind,
        productId: line.itemId,
        commercialTerms: commercial.commercialTerms,
      }));
    }
    return evaluatePurchaseReceiptBeforeInvoiceCost({
      costInputId,
      movement,
      matches,
      commercialFacts: facts,
    });
  });
}

function uniqueMatches(
  first: readonly PurchaseReceiptInvoiceMatchSnapshot[],
  second: readonly PurchaseReceiptInvoiceMatchSnapshot[],
): readonly PurchaseReceiptInvoiceMatchSnapshot[] {
  const byId = new Map<string, PurchaseReceiptInvoiceMatchSnapshot>();
  for (const match of [...first, ...second]) byId.set(match.matchId, match);
  return Object.freeze([...byId.values()]);
}

export function createPurchaseApplicationServices(
  dependencies: PurchaseApplicationServiceDependencies,
): PurchaseApplicationServices {
  assertDependencies(dependencies);

  const mutateLifecycle = async (
    command: PurchaseLifecycleCommand,
    transition: (document: PurchaseDocumentSnapshot, action: any) => PurchaseDocumentSnapshot,
    prefix: string,
    linkedType?: "purchase-return" | "purchase-correction",
  ): Promise<PurchaseDocumentSnapshot> => {
    const operationContext = createPurchaseOperationContext(command.context);
    const operation = operationName(prefix, command.documentId);
    return dependencies.uow.execute(async repositories => {
      const replay = await replayIfCommitted<PurchaseDocumentSnapshot>(repositories, operationContext, operation);
      if (replay !== null) return replay;

      const current = await getDocument(repositories, operationContext.companyId, command.documentId);
      assertContextMatchesDocument(operationContext, current);
      validateExpectedVersion(current, command.expectedVersion);
      await assertFiscalAllowed(dependencies.fiscalEligibility, current);

      let next: PurchaseDocumentSnapshot;
      if (linkedType) {
        const relatedDocumentId = required(command.relatedDocumentId ?? "", "relatedDocumentId");
        const related = await getDocument(repositories, operationContext.companyId, relatedDocumentId);
        if (
          related.documentType !== linkedType ||
          related.status !== "confirmed" ||
          related.correctionReference?.documentId !== current.documentId
        ) {
          return fail("PURCHASE_APP_INPUT_INVALID", "relatedDocumentId");
        }
        next = transition(current, { ...lifecycleAction(command), relatedDocumentId });
      } else {
        next = transition(current, lifecycleAction(command));
      }
      await repositories.documents.update(next, command.expectedVersion);
      return persistIdempotentOutcome(
        repositories, operationContext, operation, "document",
        next.documentId, next.version, next.status, next,
      );
    });
  };

  const commands: PurchaseApplicationCommandService = Object.freeze<PurchaseApplicationCommandService>({
    async edit(command) {
      const context = createPurchaseOperationContext(command.context);
      const operation = operationName("edit", command.documentId);
      return dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<PurchaseDocumentSnapshot>(repositories, context, operation);
        if (replay !== null) return replay;
        const current = await getDocument(repositories, context.companyId, command.documentId);
        assertContextMatchesDocument(context, current);
        validateExpectedVersion(current, command.expectedVersion);
        if (current.status !== "draft") return fail("PURCHASE_APP_INPUT_INVALID", "status");
        const changes = command.changes;
        if (changes.scope.companyId !== current.companyId ||
            changes.scope.branchId !== current.scope.branchId ||
            changes.scope.fiscalYearId !== current.scope.fiscalYearId) {
          return fail("PURCHASE_APP_SCOPE_MISMATCH", "scope");
        }
        if (!changes.lines?.length) return fail("PURCHASE_APP_INPUT_INVALID", "lines");
        await assertFiscalAllowed(dependencies.fiscalEligibility, current);
        const validated = createPurchaseDocument({
          ...current,
          scope: changes.scope,
          supplierId: changes.supplierId,
          supplierSnapshot: changes.supplierSnapshot,
          businessDate: changes.businessDate,
          description: changes.description ?? null,
          correctionReference: changes.correctionReference ?? null,
          lines: changes.lines,
        });
        const next = rehydratePurchaseDocument({
          ...validated,
          lifecycleHistory: current.lifecycleHistory,
          version: current.version + 1,
          updatedAt: context.occurredAt,
        });
        await assertFiscalAllowed(dependencies.fiscalEligibility, next);
        const facts = commercialFactsFromCreate(next, command.commercialTermsByLine);
        await repositories.documents.update(next, command.expectedVersion);
        await repositories.commercialFacts.removeByDocument(next.companyId, next.documentId);
        await repositories.documents.replaceLines(next);
        await repositories.commercialFacts.addBatch(facts);
        return persistIdempotentOutcome(repositories, context, operation, "document",
          next.documentId, next.version, next.status, next);
      });
    },
    async create(command: CreatePurchaseCommand) {
      const operation = createPurchaseOperationContext(command.context);
      if (command.document.companyId !== operation.companyId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "document.companyId");
      if (command.document.scope.branchId !== operation.branchId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "document.scope.branchId");

      const operationNameValue = operationName("create", command.document.documentId);
      return dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<PurchaseDocumentSnapshot>(repositories, operation, operationNameValue);
        if (replay !== null) return replay;
        await dependencies.fiscalEligibility.assertOperationAllowed({
          companyId: command.document.companyId,
          branchId: command.document.scope.branchId,
          fiscalYearId: command.document.scope.fiscalYearId,
          fiscalPeriodId: command.document.scope.fiscalPeriodId,
          businessDate: command.document.businessDate,
        });
        const documentNumber = command.document.documentNumber ?? await dependencies.numberReservation.reserve({
          companyId: command.document.companyId,
          branchId: command.document.scope.branchId,
          fiscalYearId: command.document.scope.fiscalYearId,
          documentType: command.document.documentType,
        }, repositories);
        const document = createPurchaseDocument({ ...command.document, documentNumber });
        const facts = commercialFactsFromCreate(document, command.commercialTermsByLine);
        await repositories.documents.add(document);
        if (facts.length > 0) await repositories.commercialFacts.addBatch(facts);
        return persistIdempotentOutcome(
          repositories, operation, operationNameValue, "document",
          document.documentId, document.version, document.status, document,
        );
      });
    },

    submit: command => mutateLifecycle(command, submitPurchaseDocument, "submit"),
    approve: command => mutateLifecycle(command, approvePurchaseDocument, "approve"),
    confirm: command => mutateLifecycle(command, confirmPurchaseDocument, "confirm"),
    cancel: command => mutateLifecycle(command, cancelPurchaseDocument, "cancel"),
    reopen: command => mutateLifecycle(command, reopenPurchaseDocument, "reopen"),
    returnPurchase: command => mutateLifecycle(command, returnPurchaseDocument, "return", "purchase-return"),
    correct: command => mutateLifecycle(command, correctPurchaseDocument, "correct", "purchase-correction"),

    async stageInventoryReceipt(command: StagePurchaseReceiptCommand) {
      const operationContext = createPurchaseOperationContext(command.context);
      if (required(command.payloadFingerprint, "payloadFingerprint") !== operationContext.payloadFingerprint) {
        return fail("PURCHASE_APP_IDEMPOTENCY_CONFLICT", "payloadFingerprint");
      }
      const operation = operationName("stage-receipt", `${command.purchaseDocumentId}:${command.inventoryDocumentId}`);
      const snapshotOrReplay = await dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<Awaited<ReturnType<PurchaseInventoryReceiptPort["stageDraft"]>>>(
          repositories, operationContext, operation,
        );
        if (replay !== null) return Object.freeze({ replay, purchase: null, facts: null });
        const purchase = await getDocument(repositories, operationContext.companyId, command.purchaseDocumentId);
        assertContextMatchesDocument(operationContext, purchase);
        const facts = await repositories.commercialFacts.listByDocument(operationContext.companyId, purchase.documentId);
        return Object.freeze({ replay: null, purchase, facts });
      });
      if (snapshotOrReplay.replay !== null) return snapshotOrReplay.replay;

      const result = await stagePurchaseInventoryReceipt(dependencies.inventoryReceipt, {
        purchase: snapshotOrReplay.purchase!,
        inventoryDocumentId: command.inventoryDocumentId,
        commercialFacts: snapshotOrReplay.facts!.map(fact => ({
          purchaseLineId: fact.purchaseLineId,
          commercialTerms: fact.commercialTerms,
        })),
        allocations: command.allocations,
        requestKey: operationContext.requestId,
        payloadFingerprint: operationContext.payloadFingerprint,
      });

      return dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<typeof result>(repositories, operationContext, operation);
        if (replay !== null) return replay;
        return persistIdempotentOutcome(
          repositories, operationContext, operation, "inventory-receipt",
          result.inventoryDocumentId, result.version, result.status, result,
        );
      });
    },

    async matchReceiptInvoice(command: MatchPurchaseReceiptInvoiceCommand) {
      const operationContext = createPurchaseOperationContext(command.context);
      const requested = command.match;
      if (requested.companyId !== operationContext.companyId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "match.companyId");
      const operation = operationName("match", requested.matchId);

      const preReplay = await dependencies.uow.execute(repositories =>
        replayIfCommitted<PurchaseReceiptInvoiceMatchSnapshot>(repositories, operationContext, operation));
      if (preReplay !== null) return preReplay;

      const receiptLine = await dependencies.receiptLines.findConfirmedLine({
        companyId: operationContext.companyId,
        receiptDocumentId: requested.receiptDocumentId,
        receiptLineId: requested.receiptLineId,
      });
      if (!receiptLine) return fail("PURCHASE_APP_NOT_FOUND", "receiptLine");

      return dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<PurchaseReceiptInvoiceMatchSnapshot>(repositories, operationContext, operation);
        if (replay !== null) return replay;

        const invoice = await getDocument(repositories, operationContext.companyId, requested.invoiceDocumentId);
        assertContextMatchesDocument(operationContext, invoice);
        const line = invoice.lines.find(candidate => candidate.lineId === requested.invoiceLineId);
        if (!line) return fail("PURCHASE_APP_NOT_FOUND", "invoiceLineId");
        const fact = await repositories.commercialFacts.findByLine(operationContext.companyId, invoice.documentId, line.lineId);
        if (!fact) return fail("PURCHASE_APP_NOT_FOUND", "commercialFact");
        const invoiceMatches = await repositories.matches.listByInvoiceLine(operationContext.companyId, invoice.documentId, line.lineId);
        const receiptMatches = await repositories.matches.listByReceiptLine(operationContext.companyId, receiptLine.documentId, receiptLine.lineId);
        const match = createPurchaseReceiptInvoiceMatch({
          matchId: requested.matchId,
          invoiceLine: {
            companyId: invoice.companyId,
            documentId: invoice.documentId,
            lineId: line.lineId,
            documentType: "supplier-invoice",
            status: invoice.status,
            productId: line.itemId,
            baseQuantity: fact.commercialTerms.quantity.baseQuantity,
          },
          receiptLine,
          matchedBaseQuantity: requested.matchedBaseQuantity,
          existingMatches: uniqueMatches(invoiceMatches, receiptMatches),
        });
        await repositories.matches.add(match);
        return persistIdempotentOutcome(
          repositories, operationContext, operation, "match",
          match.matchId, null, null, match,
        );
      });
    },

    async resolveMovementCost(command: ResolvePurchaseMovementCostCommand) {
      const operationContext = createPurchaseOperationContext(command.context);
      const operation = operationName("resolve-cost", command.movementId);
      const preReplay = await dependencies.uow.execute(repositories =>
        replayIfCommitted<PurchaseReceiptBeforeInvoiceCostDecision>(repositories, operationContext, operation));
      if (preReplay !== null) return preReplay;

      const movement = await dependencies.inventoryMovements.findById(operationContext.companyId, command.movementId);
      if (!movement) return fail("PURCHASE_APP_NOT_FOUND", "movementId");
      if (movement.companyId !== operationContext.companyId) return fail("PURCHASE_APP_SCOPE_MISMATCH", "movement.companyId");

      const decision = await dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<PurchaseReceiptBeforeInvoiceCostDecision>(repositories, operationContext, operation);
        if (replay !== null) return replay;

        const matches = await repositories.matches.listByReceiptLine(
          movement.companyId,
          movement.documentId,
          movement.lineId,
        );
        const commercialFacts: PurchaseInventoryValuationCommercialFact[] = [];
        const seen = new Set<string>();
        for (const match of matches) {
          const key = `${match.invoiceDocumentId}:${match.invoiceLineId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const invoice = await repositories.documents.findById(operationContext.companyId, match.invoiceDocumentId);
          if (!invoice) continue;
          const line = invoice.lines.find(candidate => candidate.lineId === match.invoiceLineId);
          if (!line) continue;
          const fact = await repositories.commercialFacts.findByLine(operationContext.companyId, invoice.documentId, line.lineId);
          if (!fact) continue;
          commercialFacts.push({
            companyId: invoice.companyId,
            purchaseDocumentId: invoice.documentId,
            purchaseLineId: line.lineId,
            documentType: invoice.documentType,
            status: invoice.status,
            lineKind: line.lineKind,
            productId: line.itemId,
            commercialTerms: fact.commercialTerms,
          });
        }
        const result = evaluatePurchaseReceiptBeforeInvoiceCost({
          costInputId: required(command.costInputId, "costInputId"),
          movement,
          matches,
          commercialFacts,
        });
        if (result.status === "resolved" && result.costInput) {
          const existing = await repositories.costInputs.findByMovement(operationContext.companyId, movement.movementId);
          if (existing) {
            await repositories.costInputs.replaceForMovement(operationContext.companyId, movement.movementId, result.costInput);
          } else {
            await repositories.costInputs.add(result.costInput);
          }
        }
        return result;
      });

      if (decision.status === "resolved") {
        await dependencies.valuationRecalculation.costBasisChanged({
          companyId: operationContext.companyId,
          movement,
          requestId: operationContext.requestId,
          operationId: operationContext.operationId,
        });
      }

      return dependencies.uow.execute(async repositories => {
        const replay = await replayIfCommitted<PurchaseReceiptBeforeInvoiceCostDecision>(repositories, operationContext, operation);
        if (replay !== null) return replay;
        return persistIdempotentOutcome(
          repositories, operationContext, operation, "cost-resolution",
          command.costInputId, null, decision.status, decision,
        );
      });
    },
  });

  const queries: PurchaseApplicationQueryService = Object.freeze({
    async getDocument(query: GetPurchaseDocumentQuery) {
      const companyId = required(query.companyId, "companyId");
      const documentId = required(query.documentId, "documentId");
      return dependencies.uow.execute(repositories => repositories.documents.findById(companyId, documentId));
    },

    async listDocuments(query: PurchaseDocumentListQuery) {
      const normalized = normalizePurchaseDocumentListQuery(query);
      return dependencies.uow.execute(repositories => repositories.documents.list(normalized));
    },

    async getReceiptCostDecision(query: GetPurchaseReceiptCostDecisionQuery) {
      const companyId = required(query.companyId, "companyId");
      const movementId = required(query.movementId, "movementId");
      const movement = await dependencies.inventoryMovements.findById(companyId, movementId);
      if (!movement) return null;
      const existing = await dependencies.uow.execute(repositories => repositories.costInputs.findByMovement(companyId, movementId));
      return buildCostDecision(
        dependencies.uow,
        movement,
        existing?.costInputId ?? `preview:${movementId}`,
      );
    },
  });

  return Object.freeze({ commands, queries });
}
