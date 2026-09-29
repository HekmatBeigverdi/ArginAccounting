import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import {
  classifyPurchasePostingFact,
} from "./purchase-posting-event-classification.ts";
import type {
  PurchasePostingCommercialAmountsSnapshot,
  PurchasePostingFactSnapshot,
  PurchasePostingLineFactSnapshot,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingAccountRole,
} from "./purchase-posting-rules.ts";
import {
  createPurchaseTaxPolicy,
} from "./purchase-tax-posting.ts";
import type {
  CreatePurchaseTaxPolicyInput,
  PurchaseTaxRecoverability,
} from "./purchase-tax-posting.ts";

export const PURCHASE_CORRECTION_EFFECTS = Object.freeze([
  "commercial-replacement",
  "quantity-decrease",
  "quantity-increase",
] as const);

export type PurchaseCorrectionEffect =
  (typeof PURCHASE_CORRECTION_EFFECTS)[number];

export interface PurchaseCorrectionLineLink {
  readonly originalPurchaseLineId: string;
  readonly correctionPurchaseLineId: string;
  readonly effect: PurchaseCorrectionEffect;
}

export interface PurchaseCorrectionSourceReference {
  readonly originalSupplierInvoiceId: string;
  readonly lineLinks: readonly PurchaseCorrectionLineLink[];
}

export type PurchaseCorrectionPostingSide = "debit" | "credit";

export type PurchaseCorrectionAmountBasis =
  | "commercial-delta"
  | "inventory-valuation-delta";

export interface PurchaseCorrectionPostingComponent {
  readonly componentId: string;
  readonly correctionPurchaseLineId: string | null;
  readonly originalPurchaseLineId: string | null;
  readonly side: PurchaseCorrectionPostingSide;
  readonly accountRole: PurchasePostingAccountRole;
  readonly amountBasis: PurchaseCorrectionAmountBasis;
  readonly amount: number | null;
  readonly currency: string;
  readonly deferredToStep: 12 | null;
  readonly effect: PurchaseCorrectionEffect | "document-payable";
}

export interface PurchaseCorrectionPostingPlan {
  readonly factId: string;
  readonly purchaseDocumentId: string;
  readonly originalSupplierInvoiceId: string;
  readonly eventKind: "purchase-correction-recognition";
  readonly taxRecoverability: PurchaseTaxRecoverability;
  readonly components: readonly PurchaseCorrectionPostingComponent[];
  readonly payableDelta: number;
  readonly currency: string;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid, field);
  }
  return value.trim();
}

function checkedDelta(corrected: number, original: number, field: string): number {
  if (!Number.isSafeInteger(corrected) || !Number.isSafeInteger(original)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionAmountInvalid, field);
  }
  const delta = corrected - original;
  if (!Number.isSafeInteger(delta)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionAmountInvalid, field);
  }
  return delta;
}

function sideForIncrease(delta: number): PurchaseCorrectionPostingSide {
  return delta > 0 ? "debit" : "credit";
}

function payableSide(delta: number): PurchaseCorrectionPostingSide {
  return delta > 0 ? "credit" : "debit";
}

function absolute(delta: number): number {
  return Math.abs(delta);
}

function findLine(
  fact: PurchasePostingFactSnapshot,
  lineId: string,
  field: string,
): PurchasePostingLineFactSnapshot {
  const line = fact.lines.find(item => item.purchaseLineId === lineId);
  if (!line) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid, field);
  }
  return line;
}

function assertCompatibleLines(
  original: PurchasePostingLineFactSnapshot,
  corrected: PurchasePostingLineFactSnapshot,
  field: string,
): void {
  if (
    original.lineKind !== corrected.lineKind
    || original.item.itemId !== corrected.item.itemId
    || original.amounts.currency !== corrected.amounts.currency
  ) {
    fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid, field);
  }
}

function addCommercialComponent(
  components: PurchaseCorrectionPostingComponent[],
  input: {
    readonly id: string;
    readonly correctionLineId: string;
    readonly originalLineId: string;
    readonly delta: number;
    readonly accountRole: PurchasePostingAccountRole;
    readonly currency: string;
    readonly effect: PurchaseCorrectionEffect;
  },
): void {
  if (input.delta === 0) return;
  components.push(Object.freeze({
    componentId: input.id,
    correctionPurchaseLineId: input.correctionLineId,
    originalPurchaseLineId: input.originalLineId,
    side: sideForIncrease(input.delta),
    accountRole: input.accountRole,
    amountBasis: "commercial-delta",
    amount: absolute(input.delta),
    currency: input.currency,
    deferredToStep: null,
    effect: input.effect,
  }));
}

function amountDeltas(
  original: PurchasePostingCommercialAmountsSnapshot,
  corrected: PurchasePostingCommercialAmountsSnapshot,
) {
  return Object.freeze({
    principal: checkedDelta(
      corrected.netAfterDiscount,
      original.netAfterDiscount,
      "line.netAfterDiscount",
    ),
    charge: checkedDelta(
      corrected.chargeAmount,
      original.chargeAmount,
      "line.chargeAmount",
    ),
    tax: checkedDelta(
      corrected.taxAmount,
      original.taxAmount,
      "line.taxAmount",
    ),
    grandTotal: checkedDelta(
      corrected.grandTotal,
      original.grandTotal,
      "line.grandTotal",
    ),
  });
}

export function createPurchaseCorrectionPostingPlan(
  originalInvoiceFact: PurchasePostingFactSnapshot,
  correctionFact: PurchasePostingFactSnapshot,
  referenceInput: PurchaseCorrectionSourceReference,
  taxPolicyInput: CreatePurchaseTaxPolicyInput,
): PurchaseCorrectionPostingPlan {
  if (
    typeof originalInvoiceFact !== "object" || originalInvoiceFact === null
    || typeof correctionFact !== "object" || correctionFact === null
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionInvalid, "fact");
  }

  const originalClassification = classifyPurchasePostingFact(originalInvoiceFact);
  if (
    originalInvoiceFact.documentType !== "supplier-invoice"
    || originalClassification.eventKind !== "supplier-invoice-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionInvalid, "originalInvoiceFact");
  }

  const correctionClassification = classifyPurchasePostingFact(correctionFact);
  if (
    correctionClassification.disposition !== "posting"
    || correctionClassification.eventKind !== "purchase-correction-recognition"
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionInvalid, "correctionFact");
  }

  if (
    originalInvoiceFact.companyId !== correctionFact.companyId
    || originalInvoiceFact.branchId !== correctionFact.branchId
    || originalInvoiceFact.supplier.supplierId !== correctionFact.supplier.supplierId
    || originalInvoiceFact.totals.currency !== correctionFact.totals.currency
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.scopeMismatch, "correctionFact");
  }

  if (typeof referenceInput !== "object" || referenceInput === null || !Array.isArray(referenceInput.lineLinks)) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid, "reference");
  }

  const originalSupplierInvoiceId = required(
    referenceInput.originalSupplierInvoiceId,
    "reference.originalSupplierInvoiceId",
  );
  if (
    originalSupplierInvoiceId !== originalInvoiceFact.purchaseDocumentId
    || originalSupplierInvoiceId === correctionFact.purchaseDocumentId
  ) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid,
      "reference.originalSupplierInvoiceId",
    );
  }

  const taxPolicy = createPurchaseTaxPolicy(taxPolicyInput);
  if (taxPolicy.companyId !== correctionFact.companyId) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.scopeMismatch, "taxPolicy.companyId");
  }

  const seenOriginal = new Set<string>();
  const seenCorrection = new Set<string>();
  const components: PurchaseCorrectionPostingComponent[] = [];

  for (let index = 0; index < referenceInput.lineLinks.length; index += 1) {
    const link = referenceInput.lineLinks[index]!;
    if (!PURCHASE_CORRECTION_EFFECTS.includes(link.effect)) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid,
        `reference.lineLinks[${index}].effect`,
      );
    }
    const originalLineId = required(
      link.originalPurchaseLineId,
      `reference.lineLinks[${index}].originalPurchaseLineId`,
    );
    const correctionLineId = required(
      link.correctionPurchaseLineId,
      `reference.lineLinks[${index}].correctionPurchaseLineId`,
    );
    if (seenOriginal.has(originalLineId) || seenCorrection.has(correctionLineId)) {
      return fail(
        PURCHASE_POSTING_DOMAIN_ERROR_CODES.purchaseCorrectionReferenceInvalid,
        `reference.lineLinks[${index}]`,
      );
    }
    seenOriginal.add(originalLineId);
    seenCorrection.add(correctionLineId);

    const originalLine = findLine(
      originalInvoiceFact,
      originalLineId,
      `reference.lineLinks[${index}].originalPurchaseLineId`,
    );
    const correctedLine = findLine(
      correctionFact,
      correctionLineId,
      `reference.lineLinks[${index}].correctionPurchaseLineId`,
    );
    assertCompatibleLines(originalLine, correctedLine, `reference.lineLinks[${index}]`);

    const deltas = amountDeltas(originalLine.amounts, correctedLine.amounts);

    if (correctedLine.lineKind === "stock-product") {
      const hasInventoryDelta =
        deltas.principal !== 0
        || deltas.charge !== 0
        || (deltas.tax !== 0 && taxPolicy.recoverability === "non-recoverable")
        || link.effect !== "commercial-replacement";

      if (hasInventoryDelta) {
        components.push(Object.freeze({
          componentId: `inventory:${correctionLineId}`,
          correctionPurchaseLineId: correctionLineId,
          originalPurchaseLineId: originalLineId,
          side: deltas.grandTotal >= 0 ? "debit" : "credit",
          accountRole: "inventory-asset",
          amountBasis: "inventory-valuation-delta",
          amount: null,
          currency: correctedLine.amounts.currency,
          deferredToStep: 12,
          effect: link.effect,
        }));
      }

      if (deltas.tax !== 0 && taxPolicy.recoverability === "recoverable") {
        addCommercialComponent(components, {
          id: `tax:${correctionLineId}`,
          correctionLineId,
          originalLineId,
          delta: deltas.tax,
          accountRole: "input-vat-recoverable",
          currency: correctedLine.amounts.currency,
          effect: link.effect,
        });
      }
      continue;
    }

    addCommercialComponent(components, {
      id: `principal:${correctionLineId}`,
      correctionLineId,
      originalLineId,
      delta: deltas.principal,
      accountRole: "purchase-expense",
      currency: correctedLine.amounts.currency,
      effect: link.effect,
    });
    addCommercialComponent(components, {
      id: `charge:${correctionLineId}`,
      correctionLineId,
      originalLineId,
      delta: deltas.charge,
      accountRole: "purchase-charge",
      currency: correctedLine.amounts.currency,
      effect: link.effect,
    });
    if (deltas.tax !== 0) {
      addCommercialComponent(components, {
        id: `tax:${correctionLineId}`,
        correctionLineId,
        originalLineId,
        delta: deltas.tax,
        accountRole: taxPolicy.recoverability === "recoverable"
          ? "input-vat-recoverable"
          : "purchase-expense",
        currency: correctedLine.amounts.currency,
        effect: link.effect,
      });
    }
  }

  const payableDelta = checkedDelta(
    correctionFact.totals.grandTotal,
    originalInvoiceFact.totals.grandTotal,
    "payableDelta",
  );

  if (payableDelta !== 0) {
    components.push(Object.freeze({
      componentId: "supplier-payable",
      correctionPurchaseLineId: null,
      originalPurchaseLineId: null,
      side: payableSide(payableDelta),
      accountRole: "accounts-payable",
      amountBasis: "commercial-delta",
      amount: absolute(payableDelta),
      currency: correctionFact.totals.currency,
      deferredToStep: null,
      effect: "document-payable",
    }));
  }

  return Object.freeze({
    factId: correctionFact.factId,
    purchaseDocumentId: correctionFact.purchaseDocumentId,
    originalSupplierInvoiceId,
    eventKind: "purchase-correction-recognition",
    taxRecoverability: taxPolicy.recoverability,
    components: Object.freeze(components),
    payableDelta,
    currency: correctionFact.totals.currency,
  });
}
