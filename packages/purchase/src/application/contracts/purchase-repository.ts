import type { PurchaseCommercialTerms } from "../../domain/purchase-commercial-semantics.ts";
import type { PurchaseDocumentSnapshot } from "../../domain/purchase-document.ts";
import type { PurchaseDocumentStatus, PurchaseDocumentType } from "../../domain/purchase-lifecycle.ts";
import type { PurchaseReceiptInvoiceMatchSnapshot } from "../../domain/purchase-receipt-invoice-matching.ts";
import type { PurchaseInventoryValuationCostInputSnapshot } from "../../domain/purchase-inventory-valuation-cost-input.ts";

export interface PurchaseDocumentListQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly supplierId?: string | null;
  readonly documentType?: PurchaseDocumentType | null;
  readonly status?: PurchaseDocumentStatus | null;
  readonly fromBusinessDate?: string | null;
  readonly toBusinessDate?: string | null;
  readonly limit?: number;
  readonly offset?: number;
}

export interface NormalizedPurchaseDocumentListQuery {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly supplierId: string | null;
  readonly documentType: PurchaseDocumentType | null;
  readonly status: PurchaseDocumentStatus | null;
  readonly fromBusinessDate: string | null;
  readonly toBusinessDate: string | null;
  readonly limit: number;
  readonly offset: number;
}

export interface PurchaseDocumentRepository {
  findById(companyId: string, documentId: string): Promise<PurchaseDocumentSnapshot | null>;
  findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string,
    documentType: PurchaseDocumentType,
    documentNumber: string,
  ): Promise<PurchaseDocumentSnapshot | null>;
  list(query: NormalizedPurchaseDocumentListQuery): Promise<readonly PurchaseDocumentSnapshot[]>;
  add(document: PurchaseDocumentSnapshot): Promise<void>;
  update(document: PurchaseDocumentSnapshot, expectedVersion: number): Promise<void>;
}

export interface PurchaseCommercialFactSnapshot {
  readonly companyId: string;
  readonly purchaseDocumentId: string;
  readonly purchaseLineId: string;
  readonly commercialTerms: PurchaseCommercialTerms;
  readonly revision: number;
}

export interface PurchaseCommercialFactRepository {
  findByLine(
    companyId: string,
    purchaseDocumentId: string,
    purchaseLineId: string,
  ): Promise<PurchaseCommercialFactSnapshot | null>;
  listByDocument(companyId: string, purchaseDocumentId: string): Promise<readonly PurchaseCommercialFactSnapshot[]>;
  addBatch(facts: readonly PurchaseCommercialFactSnapshot[]): Promise<void>;
  replaceBatch(
    companyId: string,
    purchaseDocumentId: string,
    facts: readonly PurchaseCommercialFactSnapshot[],
    expectedRevision: number,
  ): Promise<void>;
}

export interface PurchaseReceiptInvoiceMatchRepository {
  findById(companyId: string, matchId: string): Promise<PurchaseReceiptInvoiceMatchSnapshot | null>;
  listByInvoiceLine(
    companyId: string,
    invoiceDocumentId: string,
    invoiceLineId: string,
  ): Promise<readonly PurchaseReceiptInvoiceMatchSnapshot[]>;
  listByReceiptLine(
    companyId: string,
    receiptDocumentId: string,
    receiptLineId: string,
  ): Promise<readonly PurchaseReceiptInvoiceMatchSnapshot[]>;
  add(match: PurchaseReceiptInvoiceMatchSnapshot): Promise<void>;
}

export interface PurchaseUnresolvedValuationCostReference {
  readonly companyId: string;
  readonly movementId: string;
  readonly receiptDocumentId: string;
  readonly receiptLineId: string;
  readonly productId: string;
  readonly reason: "awaiting-supplier-invoice" | "partial-invoice-match" | "supplier-invoice-cost-unavailable";
}

export interface PurchaseValuationCostInputRepository {
  findByMovement(companyId: string, movementId: string): Promise<PurchaseInventoryValuationCostInputSnapshot | null>;
  listUnresolvedByCompany(companyId: string): Promise<readonly PurchaseUnresolvedValuationCostReference[]>;
  add(costInput: PurchaseInventoryValuationCostInputSnapshot): Promise<void>;
  replaceForMovement(
    companyId: string,
    movementId: string,
    costInput: PurchaseInventoryValuationCostInputSnapshot,
  ): Promise<void>;
}
