import { PURCHASE_DOCUMENT_STATUSES, PURCHASE_DOCUMENT_TYPES } from "../../domain/purchase-lifecycle.ts";
import type { PurchaseDocumentType } from "../../domain/purchase-lifecycle.ts";
import type { CreatePurchaseDocumentInput, PurchaseDocumentSnapshot } from "../../domain/purchase-document.ts";
import type { PurchaseCommercialTerms } from "../../domain/purchase-commercial-semantics.ts";
import type { PurchaseInventoryReceiptAllocation, PurchaseInventoryReceiptStageResult } from "../../domain/purchase-inventory-receipt-integration.ts";
import type { PurchaseReceiptInvoiceMatchSnapshot } from "../../domain/purchase-receipt-invoice-matching.ts";
import type { PurchaseReceiptBeforeInvoiceCostDecision } from "../../domain/purchase-receipt-before-invoice-policy.ts";
import type { NormalizedPurchaseDocumentListQuery, PurchaseDocumentListQuery } from "./purchase-repository.ts";
import type { PurchaseUnitOfWorkContext } from "./purchase-unit-of-work.ts";

export interface PurchaseOperationContext {
  readonly companyId: string;
  readonly branchId: string;
  readonly requestId: string;
  readonly operationId: string;
  readonly payloadFingerprint: string;
  readonly actorUserId: string;
  readonly occurredAt: string;
}

function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`purchase.application_input_invalid:${field}`);
  return value.trim();
}

function optional(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized || null;
}

function date(value: string | null | undefined, field: string): string | null {
  if (value == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new TypeError(`purchase.application_input_invalid:${field}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new TypeError(`purchase.application_input_invalid:${field}`);
  return value;
}

export function createPurchaseOperationContext(input: PurchaseOperationContext): PurchaseOperationContext {
  const occurredAt = new Date(input.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) throw new TypeError("purchase.application_input_invalid:occurredAt");
  return Object.freeze({
    companyId: required(input.companyId, "companyId"),
    branchId: required(input.branchId, "branchId"),
    requestId: required(input.requestId, "requestId"),
    operationId: required(input.operationId, "operationId"),
    payloadFingerprint: required(input.payloadFingerprint, "payloadFingerprint"),
    actorUserId: required(input.actorUserId, "actorUserId"),
    occurredAt: occurredAt.toISOString(),
  });
}

export function normalizePurchaseDocumentListQuery(input: PurchaseDocumentListQuery): NormalizedPurchaseDocumentListQuery {
  const documentType = input.documentType ?? null;
  const status = input.status ?? null;
  if (documentType !== null && !PURCHASE_DOCUMENT_TYPES.includes(documentType)) throw new TypeError("purchase.application_input_invalid:documentType");
  if (status !== null && !PURCHASE_DOCUMENT_STATUSES.includes(status)) throw new TypeError("purchase.application_input_invalid:status");
  const limit = input.limit ?? 100;
  const offset = input.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new TypeError("purchase.application_input_invalid:limit");
  if (!Number.isSafeInteger(offset) || offset < 0) throw new TypeError("purchase.application_input_invalid:offset");
  const fromBusinessDate = date(input.fromBusinessDate, "fromBusinessDate");
  const toBusinessDate = date(input.toBusinessDate, "toBusinessDate");
  if (fromBusinessDate && toBusinessDate && fromBusinessDate > toBusinessDate) throw new TypeError("purchase.application_input_invalid:businessDateRange");
  return Object.freeze({
    companyId: required(input.companyId, "companyId"),
    branchId: optional(input.branchId),
    supplierId: optional(input.supplierId),
    documentType,
    status,
    fromBusinessDate,
    toBusinessDate,
    limit,
    offset,
  });
}

export interface CreatePurchaseCommand {
  readonly context: PurchaseOperationContext;
  readonly document: CreatePurchaseDocumentInput;
  readonly commercialTermsByLine: Readonly<Record<string, PurchaseCommercialTerms>>;
}

export interface PurchaseLifecycleCommand {
  readonly context: PurchaseOperationContext;
  readonly documentId: string;
  readonly expectedVersion: number;
  readonly reason?: string | null;
  readonly relatedDocumentId?: string | null;
}

export interface EditPurchaseCommand extends PurchaseLifecycleCommand {
  readonly changes: Pick<CreatePurchaseDocumentInput,
    "scope" | "supplierId" | "supplierSnapshot" | "businessDate" | "description" | "correctionReference" | "lines">;
  readonly commercialTermsByLine: Readonly<Record<string, PurchaseCommercialTerms>>;
}

export interface StagePurchaseReceiptCommand {
  readonly context: PurchaseOperationContext;
  readonly purchaseDocumentId: string;
  readonly inventoryDocumentId: string;
  readonly allocations: readonly PurchaseInventoryReceiptAllocation[];
  readonly payloadFingerprint: string;
}

export interface MatchPurchaseReceiptInvoiceCommand {
  readonly context: PurchaseOperationContext;
  readonly match: PurchaseReceiptInvoiceMatchSnapshot;
}

export interface ResolvePurchaseMovementCostCommand {
  readonly context: PurchaseOperationContext;
  readonly movementId: string;
  readonly costInputId: string;
}

export interface GetPurchaseDocumentQuery {
  readonly companyId: string;
  readonly documentId: string;
}

export interface GetPurchaseReceiptCostDecisionQuery {
  readonly companyId: string;
  readonly movementId: string;
}

export interface PurchaseApplicationCommandService {
  create(command: CreatePurchaseCommand): Promise<PurchaseDocumentSnapshot>;
  edit(command: EditPurchaseCommand): Promise<PurchaseDocumentSnapshot>;
  submit(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  approve(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  confirm(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  cancel(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  reopen(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  returnPurchase(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  correct(command: PurchaseLifecycleCommand): Promise<PurchaseDocumentSnapshot>;
  stageInventoryReceipt(command: StagePurchaseReceiptCommand): Promise<PurchaseInventoryReceiptStageResult>;
  matchReceiptInvoice(command: MatchPurchaseReceiptInvoiceCommand): Promise<PurchaseReceiptInvoiceMatchSnapshot>;
  resolveMovementCost(command: ResolvePurchaseMovementCostCommand): Promise<PurchaseReceiptBeforeInvoiceCostDecision>;
}

export interface PurchaseApplicationQueryService {
  getDocument(query: GetPurchaseDocumentQuery): Promise<PurchaseDocumentSnapshot | null>;
  listDocuments(query: PurchaseDocumentListQuery): Promise<readonly PurchaseDocumentSnapshot[]>;
  getReceiptCostDecision(query: GetPurchaseReceiptCostDecisionQuery): Promise<PurchaseReceiptBeforeInvoiceCostDecision | null>;
}

export interface PurchaseNumberReservationPort {
  /** Reserve in the owning Purchase transaction so numbering commits or rolls back with the document. */
  reserve(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly fiscalYearId: string;
    readonly documentType: PurchaseDocumentType;
  }, context: PurchaseUnitOfWorkContext): Promise<string>;
}

export interface PurchaseFiscalEligibilityPort {
  assertOperationAllowed(input: {
    readonly companyId: string;
    readonly branchId: string;
    readonly fiscalYearId: string;
    readonly fiscalPeriodId: string;
    readonly businessDate: string;
  }): Promise<void>;
}
