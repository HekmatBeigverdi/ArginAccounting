import type {
  InventorySourceDocumentPort,
  InventorySourceDocumentResult,
  StageInventorySourceDocumentRequest,
} from "@argin/inventory";
import type { WarehouseOperationalReference } from "@argin/warehouse";
import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import type { SalesInvoice } from "./sales-invoice.ts";
import type { SalesLifecycleState } from "./sales-lifecycle.ts";

export interface SalesStockIssueLineRouting {
  readonly salesLineId: string;
  readonly unitId: string;
  readonly warehouse: WarehouseOperationalReference;
}

export interface StageSalesInvoiceInventoryIssueInput {
  readonly invoice: SalesInvoice;
  readonly lifecycle: SalesLifecycleState;
  readonly inventoryDocumentId: string;
  readonly lineRouting: readonly SalesStockIssueLineRouting[];
  readonly requestKey: string;
  readonly payloadFingerprint: string;
}

export interface SalesInventoryIssueGateway {
  stage(input: StageSalesInvoiceInventoryIssueInput): Promise<InventorySourceDocumentResult>;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function quantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return fail(SALES_DOMAIN_ERROR_CODES.salesQuantityInvalid, "inventoryIssue.quantity");
  return value.toString();
}

export class InventorySalesIssueGateway implements SalesInventoryIssueGateway {
  constructor(private readonly inventory: InventorySourceDocumentPort) {}

  async stage(input: StageSalesInvoiceInventoryIssueInput): Promise<InventorySourceDocumentResult> {
    if (!input || typeof input !== "object") return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "inventoryIssue");
    if (input.lifecycle.documentId !== input.invoice.document.documentId ||
        input.lifecycle.documentType !== "sales-invoice" ||
        input.lifecycle.status !== "finalized") {
      return fail(SALES_DOMAIN_ERROR_CODES.inventoryIssueFinalizedInvoiceRequired, "inventoryIssue.lifecycle");
    }

    const stockLines = input.invoice.document.lines.filter((line) => line.lineKind === "stock-product");
    if (stockLines.length === 0) return fail(SALES_DOMAIN_ERROR_CODES.inventoryIssueStockLinesRequired, "inventoryIssue.lines");

    const routing = new Map(input.lineRouting.map((item) => [item.salesLineId, item] as const));
    if (routing.size !== input.lineRouting.length || routing.size !== stockLines.length) {
      return fail(SALES_DOMAIN_ERROR_CODES.inventoryIssueRoutingMismatch, "inventoryIssue.lineRouting");
    }

    const lines = stockLines.map((line) => {
      const route = routing.get(line.lineId);
      if (!route || !line.commercialTerms) return fail(SALES_DOMAIN_ERROR_CODES.inventoryIssueRoutingMismatch, "inventoryIssue.lineRouting");
      return Object.freeze({
        sourceLineId: line.lineId,
        productId: line.item.productId,
        enteredQuantity: quantity(line.commercialTerms.quantity),
        unitId: required(route.unitId, "inventoryIssue.unitId"),
        warehouse: route.warehouse,
        description: line.description,
      });
    });

    const request: StageInventorySourceDocumentRequest = Object.freeze({
      companyId: input.invoice.document.scope.companyId,
      inventoryDocumentId: required(input.inventoryDocumentId, "inventoryIssue.inventoryDocumentId"),
      documentType: "issue",
      businessDate: input.invoice.document.businessDate,
      sourceSystem: "sales",
      sourceDocumentType: "sales-invoice",
      sourceDocumentId: input.invoice.document.documentId,
      description: input.invoice.document.description,
      lines: Object.freeze(lines),
      requestKey: required(input.requestKey, "inventoryIssue.requestKey"),
      payloadFingerprint: required(input.payloadFingerprint, "inventoryIssue.payloadFingerprint"),
    });

    return this.inventory.stageDraft(request);
  }
}
