import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesInvoice } from "./sales-invoice.ts";
import type { SalesOrder } from "./sales-order.ts";
import type { SalesReturn } from "./sales-return.ts";

export interface SalesLineFulfillment {
  readonly sourceDocumentId: string;
  readonly sourceLineId: string;
  readonly productId: string;
  readonly orderedOrInvoicedQuantity: number;
  readonly matchedQuantity: number;
  readonly remainingQuantity: number;
  readonly complete: boolean;
}

export interface SalesDocumentFulfillment {
  readonly sourceDocumentId: string;
  readonly lines: readonly SalesLineFulfillment[];
  readonly complete: boolean;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function q(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return fail(SALES_DOMAIN_ERROR_CODES.salesQuantityInvalid, "fulfillment.quantity");
  return value;
}
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
function normalized(value: number): number {
  return Number(value.toPrecision(15));
}

export function matchSalesOrderInvoices(
  order: SalesOrder,
  invoices: readonly SalesInvoice[],
): SalesDocumentFulfillment {
  const matched = new Map<string, number>();
  for (const invoice of invoices) {
    const relation = invoice.document.relatedDocumentReference;
    if (!relation || relation.relationType !== "sales-order" || relation.documentId !== order.document.documentId) {
      return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentOrderRelationMismatch, "fulfillment.invoice.relatedDocumentReference");
    }
    for (const line of invoice.document.lines) {
      const source = line.sourceReference;
      if (!source || source.sourceSystem !== "sales" || source.sourceDocumentId !== order.document.documentId || !source.sourceLineId) {
        return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentOrderLineMismatch, "fulfillment.invoice.lines.sourceReference");
      }
      const orderLine = order.document.lines.find((item) => item.lineId === source.sourceLineId);
      if (!orderLine || orderLine.item.productId !== line.item.productId || orderLine.lineKind !== line.lineKind) {
        return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentOrderLineMismatch, "fulfillment.invoice.lines.sourceReference");
      }
      const quantity = q(line.commercialTerms?.quantity ?? 0);
      matched.set(orderLine.lineId, normalized((matched.get(orderLine.lineId) ?? 0) + quantity));
    }
  }

  const lines = order.document.lines.map((line) => {
    const allowed = q(line.commercialTerms?.quantity ?? 0);
    const used = matched.get(line.lineId) ?? 0;
    if (used > allowed) return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentOverInvoice, "fulfillment.invoice.quantity");
    return Object.freeze({
      sourceDocumentId: order.document.documentId,
      sourceLineId: line.lineId,
      productId: line.item.productId,
      orderedOrInvoicedQuantity: allowed,
      matchedQuantity: used,
      remainingQuantity: normalized(allowed - used),
      complete: used === allowed,
    });
  });
  return Object.freeze({ sourceDocumentId: order.document.documentId, lines: Object.freeze(lines), complete: lines.every((x) => x.complete) });
}

export function matchSalesInvoiceReturns(
  invoice: SalesInvoice,
  returns: readonly SalesReturn[],
): SalesDocumentFulfillment {
  const matched = new Map<string, number>();
  for (const salesReturn of returns) {
    const relation = salesReturn.document.relatedDocumentReference;
    if (!relation || relation.relationType !== "sales-invoice" || relation.documentId !== invoice.document.documentId) {
      return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentInvoiceRelationMismatch, "fulfillment.return.relatedDocumentReference");
    }
    for (const line of salesReturn.document.lines) {
      const source = line.sourceReference;
      if (!source || source.sourceSystem !== "sales" || source.sourceDocumentId !== invoice.document.documentId || !source.sourceLineId) {
        return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentInvoiceLineMismatch, "fulfillment.return.lines.sourceReference");
      }
      const invoiceLine = invoice.document.lines.find((item) => item.lineId === source.sourceLineId);
      if (!invoiceLine || invoiceLine.item.productId !== line.item.productId || invoiceLine.lineKind !== line.lineKind) {
        return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentInvoiceLineMismatch, "fulfillment.return.lines.sourceReference");
      }
      const quantity = q(line.commercialTerms?.quantity ?? 0);
      matched.set(invoiceLine.lineId, normalized((matched.get(invoiceLine.lineId) ?? 0) + quantity));
    }
  }

  const lines = invoice.document.lines.map((line) => {
    const allowed = q(line.commercialTerms?.quantity ?? 0);
    const used = matched.get(line.lineId) ?? 0;
    if (used > allowed) return fail(SALES_DOMAIN_ERROR_CODES.fulfillmentOverReturn, "fulfillment.return.quantity");
    return Object.freeze({
      sourceDocumentId: invoice.document.documentId,
      sourceLineId: line.lineId,
      productId: line.item.productId,
      orderedOrInvoicedQuantity: allowed,
      matchedQuantity: used,
      remainingQuantity: normalized(allowed - used),
      complete: used === allowed,
    });
  });
  return Object.freeze({ sourceDocumentId: invoice.document.documentId, lines: Object.freeze(lines), complete: lines.every((x) => x.complete) });
}
