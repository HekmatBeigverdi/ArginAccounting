import { normalizePurchaseQuantity } from "./purchase-commercial-semantics.ts";
import type { PurchaseReceiptInvoiceMatchSnapshot } from "./purchase-receipt-invoice-matching.ts";

export const PURCHASE_MATCHING_MODES = Object.freeze(["two-way", "three-way"] as const);
export type PurchaseMatchingMode = (typeof PURCHASE_MATCHING_MODES)[number];

export const PURCHASE_MATCHING_ENGINE_STATUSES = Object.freeze([
  "unmatched",
  "partially-matched",
  "matched",
  "variance",
] as const);
export type PurchaseMatchingEngineStatus =
  (typeof PURCHASE_MATCHING_ENGINE_STATUSES)[number];

export interface PurchaseMatchingPolicy {
  readonly priceToleranceBasisPoints: number;
  readonly requireExactQuantity: true;
}

export interface PurchaseMatchingInvoiceLine {
  readonly invoiceLineId: string;
  readonly productId: string;
  readonly baseQuantity: string;
  readonly unitPriceAmount: number;
  readonly orderLineId: string | null;
}

export interface PurchaseMatchingReceiptLine {
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly sourceInvoiceLineId: string;
  readonly productId: string;
  readonly baseQuantity: string;
}

export interface PurchaseMatchingOrderLine {
  readonly orderLineId: string;
  readonly productId: string;
  readonly baseQuantity: string;
  readonly unitPriceAmount: number;
}

export interface PurchaseMatchingProposal {
  readonly invoiceLineId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly matchedBaseQuantity: string;
}

export interface PurchaseMatchingLineResult {
  readonly invoiceLineId: string;
  readonly productId: string;
  readonly status: PurchaseMatchingEngineStatus;
  readonly invoiceBaseQuantity: string;
  readonly matchedBaseQuantity: string;
  readonly remainingBaseQuantity: string;
  readonly orderQuantityVariance: boolean;
  readonly orderPriceVarianceBasisPoints: number | null;
  readonly priceWithinTolerance: boolean;
}

export interface PurchaseMatchingEvaluation {
  readonly mode: PurchaseMatchingMode;
  readonly status: PurchaseMatchingEngineStatus;
  readonly eligible: boolean;
  readonly lines: readonly PurchaseMatchingLineResult[];
  readonly proposals: readonly PurchaseMatchingProposal[];
}

export interface EvaluatePurchaseMatchingInput {
  readonly invoiceLines: readonly PurchaseMatchingInvoiceLine[];
  readonly receiptLines: readonly PurchaseMatchingReceiptLine[];
  readonly existingMatches: readonly PurchaseReceiptInvoiceMatchSnapshot[];
  readonly orderLines?: readonly PurchaseMatchingOrderLine[];
  readonly policy: PurchaseMatchingPolicy;
}

type Decimal = { coefficient: bigint; scale: number };

function decimal(value: string): Decimal {
  const canonical = normalizePurchaseQuantity(value);
  const [whole = "0", fraction = ""] = canonical.split(".");
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

const pow10 = (scale: number) => 10n ** BigInt(scale);

function align(left: Decimal, right: Decimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * pow10(scale - left.scale),
    right.coefficient * pow10(scale - right.scale),
    scale,
  ];
}

function add(left: string, right: string): string {
  const [a, b, scale] = align(decimal(left), decimal(right));
  return format(a + b, scale);
}

function subtract(left: string, right: string): string {
  const [a, b, scale] = align(decimal(left), decimal(right));
  if (b > a) throw new TypeError("purchase.matching_engine.overmatched");
  return format(a - b, scale);
}

function min(left: string, right: string): string {
  const [a, b] = align(decimal(left), decimal(right));
  return a <= b ? normalizePurchaseQuantity(left) : normalizePurchaseQuantity(right);
}

function isZero(value: string): boolean {
  return decimal(value).coefficient === 0n;
}

function equal(left: string, right: string): boolean {
  const [a, b] = align(decimal(left), decimal(right));
  return a === b;
}

function format(coefficient: bigint, scale: number): string {
  const digits = coefficient.toString().padStart(scale + 1, "0");
  if (scale === 0) return digits;
  return (digits.slice(0, -scale) + "." + digits.slice(-scale))
    .replace(/\.0+$/u, "")
    .replace(/(\.\d*?)0+$/u, "$1");
}

function priceVarianceBasisPoints(invoicePrice: number, orderPrice: number): number {
  if (!Number.isSafeInteger(invoicePrice) || invoicePrice < 0 ||
      !Number.isSafeInteger(orderPrice) || orderPrice < 0) {
    throw new TypeError("purchase.matching_engine.invalid_price");
  }
  if (orderPrice === 0) return invoicePrice === 0 ? 0 : 10000;
  return Math.round(Math.abs(invoicePrice - orderPrice) * 10000 / orderPrice);
}

export function createPurchaseMatchingPolicy(
  priceToleranceBasisPoints = 0,
): PurchaseMatchingPolicy {
  if (!Number.isInteger(priceToleranceBasisPoints) ||
      priceToleranceBasisPoints < 0 ||
      priceToleranceBasisPoints > 10000) {
    throw new TypeError("purchase.matching_engine.invalid_tolerance");
  }
  return Object.freeze({
    priceToleranceBasisPoints,
    requireExactQuantity: true as const,
  });
}

export function evaluatePurchaseMatching(
  input: EvaluatePurchaseMatchingInput,
): PurchaseMatchingEvaluation {
  if (!input || !Array.isArray(input.invoiceLines) || input.invoiceLines.length === 0 ||
      !Array.isArray(input.receiptLines) || !Array.isArray(input.existingMatches) ||
      !input.policy) {
    throw new TypeError("purchase.matching_engine.invalid_input");
  }

  const orderLines = input.orderLines ?? [];
  const mode: PurchaseMatchingMode = orderLines.length > 0 ? "three-way" : "two-way";
  const invoiceIds = new Set<string>();
  const proposalPairs = new Set<string>();
  const proposals: PurchaseMatchingProposal[] = [];
  const results: PurchaseMatchingLineResult[] = [];

  for (const invoice of input.invoiceLines) {
    if (!invoice.invoiceLineId.trim() || !invoice.productId.trim() || invoiceIds.has(invoice.invoiceLineId)) {
      throw new TypeError("purchase.matching_engine.invalid_invoice_line");
    }
    invoiceIds.add(invoice.invoiceLineId);
    const invoiceQty = normalizePurchaseQuantity(invoice.baseQuantity);
    let matched = "0";
    for (const match of input.existingMatches) {
      if (match.invoiceLineId === invoice.invoiceLineId) {
        if (match.productId !== invoice.productId) {
          throw new TypeError("purchase.matching_engine.product_mismatch");
        }
        matched = add(matched, match.matchedBaseQuantity);
      }
    }
    let remaining = subtract(invoiceQty, matched);

    const candidateReceipts = input.receiptLines
      .filter(receipt => receipt.sourceInvoiceLineId === invoice.invoiceLineId)
      .sort((a, b) =>
        a.receiptDocumentId.localeCompare(b.receiptDocumentId) ||
        a.receiptLineId.localeCompare(b.receiptLineId));

    for (const receipt of candidateReceipts) {
      if (receipt.productId !== invoice.productId) {
        throw new TypeError("purchase.matching_engine.product_mismatch");
      }
      const pairKey = [invoice.invoiceLineId, receipt.receiptDocumentId, receipt.receiptLineId].join(":");
      const existing = input.existingMatches.filter(match =>
        match.invoiceLineId === invoice.invoiceLineId &&
        match.receiptDocumentId === receipt.receiptDocumentId &&
        match.receiptLineId === receipt.receiptLineId);
      if (existing.length > 1) throw new TypeError("purchase.matching_engine.duplicate_pair");
      const already = existing[0]?.matchedBaseQuantity ?? "0";
      const receiptRemaining = subtract(receipt.baseQuantity, already);
      if (isZero(receiptRemaining) || isZero(remaining)) continue;
      const quantity = min(receiptRemaining, remaining);
      if (!isZero(quantity) && !proposalPairs.has(pairKey)) {
        proposals.push(Object.freeze({
          invoiceLineId: invoice.invoiceLineId,
          receiptDocumentId: receipt.receiptDocumentId,
          receiptLineId: receipt.receiptLineId,
          productId: invoice.productId,
          matchedBaseQuantity: quantity,
        }));
        proposalPairs.add(pairKey);
        matched = add(matched, quantity);
        remaining = subtract(invoiceQty, matched);
      }
    }

    let orderQuantityVariance = false;
    let orderPriceVarianceBasisPoints: number | null = null;
    let priceWithinTolerance = true;
    if (mode === "three-way") {
      const order = orderLines.find(line => line.orderLineId === invoice.orderLineId);
      if (!order || order.productId !== invoice.productId) {
        orderQuantityVariance = true;
        priceWithinTolerance = false;
      } else {
        orderQuantityVariance = !equal(order.baseQuantity, invoiceQty);
        orderPriceVarianceBasisPoints = priceVarianceBasisPoints(
          invoice.unitPriceAmount,
          order.unitPriceAmount,
        );
        priceWithinTolerance =
          orderPriceVarianceBasisPoints <= input.policy.priceToleranceBasisPoints;
      }
    }

    const quantityStatus: PurchaseMatchingEngineStatus =
      isZero(matched) ? "unmatched" : isZero(remaining) ? "matched" : "partially-matched";
    const hasVariance = mode === "three-way" &&
      (orderQuantityVariance || !priceWithinTolerance);
    results.push(Object.freeze({
      invoiceLineId: invoice.invoiceLineId,
      productId: invoice.productId,
      status: hasVariance ? "variance" : quantityStatus,
      invoiceBaseQuantity: invoiceQty,
      matchedBaseQuantity: matched,
      remainingBaseQuantity: remaining,
      orderQuantityVariance,
      orderPriceVarianceBasisPoints,
      priceWithinTolerance,
    }));
  }

  const status: PurchaseMatchingEngineStatus =
    results.some(line => line.status === "variance") ? "variance"
      : results.every(line => line.status === "matched") ? "matched"
        : results.some(line => line.status !== "unmatched") ? "partially-matched"
          : "unmatched";

  return Object.freeze({
    mode,
    status,
    eligible: status === "matched",
    lines: Object.freeze(results),
    proposals: Object.freeze(proposals),
  });
}
