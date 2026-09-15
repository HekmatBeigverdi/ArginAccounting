import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
} from "./purchase-domain-errors.ts";
import type { PurchaseDomainErrorCode } from "./purchase-domain-errors.ts";

export type PurchaseReceiptInvoiceMatchStatus =
  | "unmatched"
  | "partially-matched"
  | "fully-matched";

export interface PurchaseInvoiceMatchingLineReference {
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly documentType: "supplier-invoice";
  readonly status: "confirmed" | string;
  readonly productId: string;
  readonly baseQuantity: string;
}

export interface PurchaseReceiptMatchingLineReference {
  readonly companyId: string;
  readonly documentId: string;
  readonly lineId: string;
  readonly documentType: "receipt" | string;
  readonly status: "confirmed" | string;
  readonly productId: string;
  readonly baseQuantity: string;
}

export interface PurchaseReceiptInvoiceMatchSnapshot {
  readonly matchId: string;
  readonly companyId: string;
  readonly invoiceDocumentId: string;
  readonly invoiceLineId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly matchedBaseQuantity: string;
}

export interface CreatePurchaseReceiptInvoiceMatchInput {
  readonly matchId: string;
  readonly invoiceLine: PurchaseInvoiceMatchingLineReference;
  readonly receiptLine: PurchaseReceiptMatchingLineReference;
  readonly matchedBaseQuantity: string;
  readonly existingMatches?: readonly PurchaseReceiptInvoiceMatchSnapshot[];
}

export interface PurchaseInvoiceLineMatchingSummary {
  readonly status: PurchaseReceiptInvoiceMatchStatus;
  readonly invoiceBaseQuantity: string;
  readonly matchedBaseQuantity: string;
  readonly remainingBaseQuantity: string;
  readonly matchCount: number;
}

type Decimal = {
  readonly coefficient: bigint;
  readonly scale: number;
};

const fail = (code: PurchaseDomainErrorCode, field: string): never => {
  throw new PurchaseDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function normalizeQuantity(value: string, field: string, allowZero = false): string {
  if (
    typeof value !== "string" ||
    value.length > 128 ||
    !/^\d+(?:\.\d+)?$/u.test(value.trim())
  ) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, field);
  }

  const [wholeRaw = "", fractionRaw = ""] = value.trim().split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/u, "");
  const fraction = fractionRaw.replace(/0+$/u, "");
  if (whole.length > 36 || fraction.length > 18) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, field);
  }
  const canonical = whole + (fraction ? `.${fraction}` : "");
  if (!allowZero && parseDecimal(canonical, field).coefficient <= 0n) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, field);
  }
  return canonical;
}

function parseDecimal(value: string, field: string): Decimal {
  const [whole = "0", fraction = ""] = value.split(".");
  try {
    return {
      coefficient: BigInt(whole + fraction),
      scale: fraction.length,
    };
  } catch {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, field);
  }
}

function powerOfTen(scale: number): bigint {
  return 10n ** BigInt(scale);
}

function align(left: Decimal, right: Decimal): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function formatDecimal(coefficient: bigint, scale: number): string {
  const digits = coefficient.toString().padStart(scale + 1, "0");
  const text = scale === 0
    ? digits
    : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return normalizeQuantity(text, "quantity", true);
}

function addQuantities(leftValue: string, rightValue: string): string {
  const left = parseDecimal(leftValue, "quantity");
  const right = parseDecimal(rightValue, "quantity");
  const [leftCoefficient, rightCoefficient, scale] = align(left, right);
  return formatDecimal(leftCoefficient + rightCoefficient, scale);
}

function subtractQuantities(leftValue: string, rightValue: string, field: string): string {
  const left = parseDecimal(leftValue, field);
  const right = parseDecimal(rightValue, field);
  const [leftCoefficient, rightCoefficient, scale] = align(left, right);
  const result = leftCoefficient - rightCoefficient;
  if (result < 0n) return fail(PURCHASE_DOMAIN_ERROR_CODES.overMatch, field);
  return formatDecimal(result, scale);
}

function compareQuantities(leftValue: string, rightValue: string): number {
  const left = parseDecimal(leftValue, "quantity");
  const right = parseDecimal(rightValue, "quantity");
  const [leftCoefficient, rightCoefficient] = align(left, right);
  if (leftCoefficient < rightCoefficient) return -1;
  if (leftCoefficient > rightCoefficient) return 1;
  return 0;
}

function normalizeStoredMatch(
  match: PurchaseReceiptInvoiceMatchSnapshot,
  field: string,
): PurchaseReceiptInvoiceMatchSnapshot {
  if (!match || typeof match !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, field);
  }
  return Object.freeze({
    matchId: required(match.matchId, `${field}.matchId`),
    companyId: required(match.companyId, `${field}.companyId`),
    invoiceDocumentId: required(match.invoiceDocumentId, `${field}.invoiceDocumentId`),
    invoiceLineId: required(match.invoiceLineId, `${field}.invoiceLineId`),
    receiptDocumentId: required(match.receiptDocumentId, `${field}.receiptDocumentId`),
    receiptLineId: required(match.receiptLineId, `${field}.receiptLineId`),
    productId: required(match.productId, `${field}.productId`),
    matchedBaseQuantity: normalizeQuantity(
      match.matchedBaseQuantity,
      `${field}.matchedBaseQuantity`,
    ),
  });
}

function normalizeInvoiceLine(
  line: PurchaseInvoiceMatchingLineReference,
): PurchaseInvoiceMatchingLineReference {
  if (!line || typeof line !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, "invoiceLine");
  }
  if (line.documentType !== "supplier-invoice") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible, "invoiceLine.documentType");
  }
  if (line.status !== "confirmed") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible, "invoiceLine.status");
  }
  return Object.freeze({
    companyId: required(line.companyId, "invoiceLine.companyId"),
    documentId: required(line.documentId, "invoiceLine.documentId"),
    lineId: required(line.lineId, "invoiceLine.lineId"),
    documentType: "supplier-invoice",
    status: "confirmed",
    productId: required(line.productId, "invoiceLine.productId"),
    baseQuantity: normalizeQuantity(line.baseQuantity, "invoiceLine.baseQuantity"),
  });
}

function normalizeReceiptLine(
  line: PurchaseReceiptMatchingLineReference,
): PurchaseReceiptMatchingLineReference {
  if (!line || typeof line !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, "receiptLine");
  }
  if (line.documentType !== "receipt") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible, "receiptLine.documentType");
  }
  if (line.status !== "confirmed") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingIneligible, "receiptLine.status");
  }
  return Object.freeze({
    companyId: required(line.companyId, "receiptLine.companyId"),
    documentId: required(line.documentId, "receiptLine.documentId"),
    lineId: required(line.lineId, "receiptLine.lineId"),
    documentType: "receipt",
    status: "confirmed",
    productId: required(line.productId, "receiptLine.productId"),
    baseQuantity: normalizeQuantity(line.baseQuantity, "receiptLine.baseQuantity"),
  });
}

function sumMatches(
  matches: readonly PurchaseReceiptInvoiceMatchSnapshot[],
  predicate: (match: PurchaseReceiptInvoiceMatchSnapshot) => boolean,
): string {
  let total = "0";
  for (const match of matches) {
    if (predicate(match)) total = addQuantities(total, match.matchedBaseQuantity);
  }
  return total;
}

export function createPurchaseReceiptInvoiceMatch(
  input: CreatePurchaseReceiptInvoiceMatchInput,
): PurchaseReceiptInvoiceMatchSnapshot {
  if (!input || typeof input !== "object") {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, "match");
  }
  const matchId = required(input.matchId, "matchId");
  const invoiceLine = normalizeInvoiceLine(input.invoiceLine);
  const receiptLine = normalizeReceiptLine(input.receiptLine);
  const matchedBaseQuantity = normalizeQuantity(
    input.matchedBaseQuantity,
    "matchedBaseQuantity",
  );
  const rawExisting = input.existingMatches ?? [];
  if (!Array.isArray(rawExisting)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, "existingMatches");
  }
  const existing = rawExisting.map((match, index) =>
    normalizeStoredMatch(match, `existingMatches[${index}]`));

  if (invoiceLine.companyId !== receiptLine.companyId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingMismatch, "companyId");
  }
  if (invoiceLine.productId !== receiptLine.productId) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingMismatch, "productId");
  }
  if (existing.some((match) => match.matchId === matchId)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.duplicateMatch, "matchId");
  }
  if (existing.some((match) =>
    match.invoiceDocumentId === invoiceLine.documentId &&
    match.invoiceLineId === invoiceLine.lineId &&
    match.receiptDocumentId === receiptLine.documentId &&
    match.receiptLineId === receiptLine.lineId)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.duplicateMatch, "receiptLine.lineId");
  }

  const invoiceMatchedBefore = sumMatches(existing, (match) =>
    match.companyId === invoiceLine.companyId &&
    match.invoiceDocumentId === invoiceLine.documentId &&
    match.invoiceLineId === invoiceLine.lineId);
  const invoiceMatchedAfter = addQuantities(invoiceMatchedBefore, matchedBaseQuantity);
  if (compareQuantities(invoiceMatchedAfter, invoiceLine.baseQuantity) > 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.overMatch, "invoiceLine.baseQuantity");
  }

  const receiptMatchedBefore = sumMatches(existing, (match) =>
    match.companyId === receiptLine.companyId &&
    match.receiptDocumentId === receiptLine.documentId &&
    match.receiptLineId === receiptLine.lineId);
  const receiptMatchedAfter = addQuantities(receiptMatchedBefore, matchedBaseQuantity);
  if (compareQuantities(receiptMatchedAfter, receiptLine.baseQuantity) > 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.overMatch, "receiptLine.baseQuantity");
  }

  return Object.freeze({
    matchId,
    companyId: invoiceLine.companyId,
    invoiceDocumentId: invoiceLine.documentId,
    invoiceLineId: invoiceLine.lineId,
    receiptDocumentId: receiptLine.documentId,
    receiptLineId: receiptLine.lineId,
    productId: invoiceLine.productId,
    matchedBaseQuantity,
  });
}

export function summarizePurchaseInvoiceLineMatching(
  invoiceLineInput: PurchaseInvoiceMatchingLineReference,
  rawMatches: readonly PurchaseReceiptInvoiceMatchSnapshot[],
): PurchaseInvoiceLineMatchingSummary {
  const invoiceLine = normalizeInvoiceLine(invoiceLineInput);
  if (!Array.isArray(rawMatches)) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingInvalid, "matches");
  }
  const matches = rawMatches.map((match, index) =>
    normalizeStoredMatch(match, `matches[${index}]`));
  const relevant = matches.filter((match) =>
    match.companyId === invoiceLine.companyId &&
    match.invoiceDocumentId === invoiceLine.documentId &&
    match.invoiceLineId === invoiceLine.lineId);

  for (const match of relevant) {
    if (match.productId !== invoiceLine.productId) {
      return fail(PURCHASE_DOMAIN_ERROR_CODES.matchingMismatch, "productId");
    }
  }

  const matchedBaseQuantity = sumMatches(relevant, () => true);
  if (compareQuantities(matchedBaseQuantity, invoiceLine.baseQuantity) > 0) {
    return fail(PURCHASE_DOMAIN_ERROR_CODES.overMatch, "invoiceLine.baseQuantity");
  }
  const remainingBaseQuantity = subtractQuantities(
    invoiceLine.baseQuantity,
    matchedBaseQuantity,
    "invoiceLine.baseQuantity",
  );
  const status: PurchaseReceiptInvoiceMatchStatus =
    compareQuantities(matchedBaseQuantity, "0") === 0
      ? "unmatched"
      : compareQuantities(remainingBaseQuantity, "0") === 0
        ? "fully-matched"
        : "partially-matched";

  return Object.freeze({
    status,
    invoiceBaseQuantity: invoiceLine.baseQuantity,
    matchedBaseQuantity,
    remainingBaseQuantity,
    matchCount: relevant.length,
  });
}
