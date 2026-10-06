import type {
  InventorySourceDocumentPort,
  InventorySourceDocumentResult,
  StageInventorySourceDocumentRequest,
} from "@argin/inventory";
import type { WarehouseOperationalReference } from "@argin/warehouse";
import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "../domain/sales-domain-errors.ts";
import type { SalesLifecycleState } from "../domain/sales-lifecycle.ts";
import type { SalesReturn } from "../domain/sales-return.ts";

export interface SalesStockReturnReceiptLineRouting {
  readonly salesReturnLineId: string;
  readonly unitId: string;
  readonly warehouse: WarehouseOperationalReference;
}

export interface StageSalesReturnInventoryReceiptInput {
  readonly salesReturn: SalesReturn;
  readonly lifecycle: SalesLifecycleState;
  readonly inventoryDocumentId: string;
  readonly lineRouting: readonly SalesStockReturnReceiptLineRouting[];
  readonly requestKey: string;
  readonly payloadFingerprint: string;
}

export interface SalesInventoryReturnReceiptGateway {
  stage(input: StageSalesReturnInventoryReceiptInput): Promise<InventorySourceDocumentResult>;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}
function required(value: string, field: string): string {
  if (typeof value !== "string" || !value.trim()) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}
function quantity(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return fail(SALES_DOMAIN_ERROR_CODES.salesQuantityInvalid, "inventoryReturnReceipt.quantity");
  }
  return value.toString();
}

export class InventorySalesReturnReceiptGateway implements SalesInventoryReturnReceiptGateway {
  constructor(private readonly inventory: InventorySourceDocumentPort) {}

  async stage(input: StageSalesReturnInventoryReceiptInput): Promise<InventorySourceDocumentResult> {
    if (!input || typeof input !== "object") {
      return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "inventoryReturnReceipt");
    }
    if (
      input.lifecycle.documentId !== input.salesReturn.document.documentId ||
      input.lifecycle.documentType !== "sales-return" ||
      input.lifecycle.status !== "finalized"
    ) {
      return fail(
        SALES_DOMAIN_ERROR_CODES.inventoryReturnReceiptFinalizedReturnRequired,
        "inventoryReturnReceipt.lifecycle",
      );
    }

    const stockLines = input.salesReturn.document.lines.filter((line) => line.lineKind === "stock-product");
    if (stockLines.length === 0) {
      return fail(SALES_DOMAIN_ERROR_CODES.inventoryReturnReceiptStockLinesRequired, "inventoryReturnReceipt.lines");
    }

    const routing = new Map(input.lineRouting.map((item) => [item.salesReturnLineId, item] as const));
    if (routing.size !== input.lineRouting.length || routing.size !== stockLines.length) {
      return fail(SALES_DOMAIN_ERROR_CODES.inventoryReturnReceiptRoutingMismatch, "inventoryReturnReceipt.lineRouting");
    }

    const lines = stockLines.map((line) => {
      const route = routing.get(line.lineId);
      if (!route || !line.commercialTerms) {
        return fail(SALES_DOMAIN_ERROR_CODES.inventoryReturnReceiptRoutingMismatch, "inventoryReturnReceipt.lineRouting");
      }
      return Object.freeze({
        sourceLineId: line.lineId,
        productId: line.item.productId,
        enteredQuantity: quantity(line.commercialTerms.quantity),
        unitId: required(route.unitId, "inventoryReturnReceipt.unitId"),
        warehouse: route.warehouse,
        description: line.description,
      });
    });

    const request: StageInventorySourceDocumentRequest = Object.freeze({
      companyId: input.salesReturn.document.scope.companyId,
      inventoryDocumentId: required(input.inventoryDocumentId, "inventoryReturnReceipt.inventoryDocumentId"),
      documentType: "receipt",
      businessDate: input.salesReturn.document.businessDate,
      sourceSystem: "sales",
      sourceDocumentType: "sales-return",
      sourceDocumentId: input.salesReturn.document.documentId,
      description: input.salesReturn.document.description,
      lines: Object.freeze(lines),
      requestKey: required(input.requestKey, "inventoryReturnReceipt.requestKey"),
      payloadFingerprint: required(input.payloadFingerprint, "inventoryReturnReceipt.payloadFingerprint"),
    });

    return this.inventory.stageDraft(request);
  }
}
