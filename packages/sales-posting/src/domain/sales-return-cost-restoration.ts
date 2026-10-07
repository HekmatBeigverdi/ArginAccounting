import type {
  InventoryDocumentSnapshot,
  InventoryStockMovementSnapshot,
  InventoryValuationEntrySnapshot,
} from "@argin/inventory";
import type {
  InventoryValuationEntryRepository,
} from "@argin/inventory/valuation-contracts";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingDomainErrorCode,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesCommercialPostingInput,
} from "./sales-commercial-posting-input.ts";
import type {
  SalesReturnCommercialLineage,
} from "./sales-return-commercial-reversal.ts";
import type {
  SalesCogsAccountResolution,
} from "./sales-cogs-account-resolution.ts";
import type {
  SalesInventoryAccountResolution,
} from "./sales-inventory-account-resolution.ts";

export interface SalesReturnReceiptMovementLineage {
  readonly returnLineId: string;
  readonly originalInvoiceLineId: string;
  readonly productId: string;
  readonly inventoryDocumentId: string;
  readonly inventoryLineId: string;
  readonly movementId: string;
  readonly warehouseId: string;
}

export interface SalesReturnResolvedValuationLineage
  extends SalesReturnReceiptMovementLineage {
  readonly valuationEntryId: string;
  readonly method: InventoryValuationEntrySnapshot["method"];
  readonly strategyVersion: number;
  readonly currency: InventoryValuationEntrySnapshot["currency"];
  readonly quantity: string;
  readonly unitCost: string;
  readonly totalCost: number;
  readonly valuedAt: string;
  readonly revision: number;
}

export interface SalesReturnCostRestorationComponent {
  readonly componentId: string;
  readonly role: "inventory-asset" | "cogs";
  readonly side: "debit" | "credit";
  readonly accountId: string;
  readonly amount: number;
  readonly currency: string;
  readonly returnLineId: string;
  readonly originalInvoiceLineId: string;
  readonly productId: string;
  readonly inventoryDocumentId: string;
  readonly inventoryLineId: string;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly valuationMethod: InventoryValuationEntrySnapshot["method"];
  readonly valuationRevision: number;
}

export interface SalesReturnCostRestoration {
  readonly sourceDocumentId: string;
  readonly originalInvoiceId: string;
  readonly companyId: string;
  readonly currency: string | null;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly balanced: true;
  readonly lines: readonly SalesReturnResolvedValuationLineage[];
  readonly components: readonly SalesReturnCostRestorationComponent[];
}

export interface SalesReturnMovementReader {
  listByDocument(
    companyId: string,
    inventoryDocumentId: string,
  ): Promise<readonly InventoryStockMovementSnapshot[]>;
}

export interface SalesReturnCogsResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesCogsAccountResolution;
}

export interface SalesReturnInventoryResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesInventoryAccountResolution;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function safeMoney(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid, field);
  }
  return value;
}

function confirmedAt(document: InventoryDocumentSnapshot): string {
  const transition = [...document.lifecycleHistory]
    .reverse()
    .find((entry) => entry.toStatus === "confirmed");
  if (!transition) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
      "inventoryReceipt.lifecycleHistory",
    );
  }
  return transition.occurredAt;
}

function assertReceipt(
  commercial: SalesCommercialPostingInput,
  receipt: InventoryDocumentSnapshot,
): void {
  if (
    receipt.companyId !== commercial.companyId
    || receipt.documentType !== "receipt"
    || receipt.status !== "confirmed"
    || receipt.sourceReference?.companyId !== commercial.companyId
    || receipt.sourceReference?.sourceSystem !== "sales"
    || receipt.sourceReference?.documentType !== "sales-return"
    || receipt.sourceReference?.documentId !== commercial.source.sourceDocumentId
    || receipt.sourceReference?.lineId !== null
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
      "inventoryReceipt",
    );
  }
}

export async function resolveSalesReturnReceiptValuation(
  commercial: SalesCommercialPostingInput,
  lineage: SalesReturnCommercialLineage,
  receipt: InventoryDocumentSnapshot,
  movements: SalesReturnMovementReader,
  valuations: Pick<InventoryValuationEntryRepository, "findByMovement">,
): Promise<readonly SalesReturnResolvedValuationLineage[]> {
  if (
    commercial.source.sourceType !== "sales-return"
    || lineage.returnDocumentId !== commercial.source.sourceDocumentId
    || lineage.originalInvoiceId.length === 0
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
      "commercial",
    );
  }

  assertReceipt(commercial, receipt);

  const stockLines = commercial.lines.filter(
    (line) => line.lineKind === "stock-product",
  );
  if (stockLines.length === 0) return Object.freeze([]);

  const receiptLineByReturnLine = new Map<string, InventoryDocumentSnapshot["lines"][number]>();
  for (const line of receipt.lines) {
    const source = line.sourceReference;
    if (
      source?.sourceSystem === "sales"
      && source.documentType === "sales-return"
      && source.documentId === commercial.source.sourceDocumentId
      && source.lineId !== null
    ) {
      if (receiptLineByReturnLine.has(source.lineId)) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
          "inventoryReceipt.lines",
        );
      }
      receiptLineByReturnLine.set(source.lineId, line);
    }
  }

  const movementList = await movements.listByDocument(
    commercial.companyId,
    receipt.documentId,
  );
  const confirmed = confirmedAt(receipt);
  const resolved: SalesReturnResolvedValuationLineage[] = [];
  const valuationIds = new Set<string>();

  for (const salesLine of stockLines) {
    const commercialLink = lineage.lines.find(
      (line) => line.returnLineId === salesLine.lineId,
    );
    if (!commercialLink || commercialLink.productId !== salesLine.productId) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "lineage.lines",
      );
    }

    const receiptLine = receiptLineByReturnLine.get(salesLine.lineId);
    if (!receiptLine || receiptLine.productId !== salesLine.productId) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryMissing,
        "inventoryReceipt.lines",
      );
    }

    const candidates = movementList.filter(
      (movement) =>
        movement.companyId === commercial.companyId
        && movement.documentId === receipt.documentId
        && movement.lineId === receiptLine.lineId,
    );
    if (candidates.length !== 1) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryMissing,
        "movement",
      );
    }

    const movement = candidates[0]!;
    if (
      movement.quantityDelta.startsWith("-")
      || movement.quantityDelta === "0"
      || movement.transferId !== null
      || movement.reversalOfMovementId !== null
      || movement.stockKey.productId !== salesLine.productId
      || movement.businessDate !== commercial.businessDate
      || movement.recordedAt !== confirmed
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "movement",
      );
    }

    const valuation = await valuations.findByMovement(
      commercial.companyId,
      movement.movementId,
    );
    if (!valuation) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryMissing,
        "valuation",
      );
    }
    if (
      valuation.companyId !== commercial.companyId
      || valuation.productId !== salesLine.productId
      || valuation.source.movementId !== movement.movementId
      || valuation.source.documentId !== receipt.documentId
      || valuation.source.lineId !== receiptLine.lineId
      || valuation.kind !== "inbound"
      || valuation.costState !== "resolved"
      || valuation.unitCost === null
      || valuation.totalCost === null
      || valuation.valuedAt === null
      || valuation.unresolvedReason !== null
      || valuation.totalCost < 0
    ) {
      return fail(
        valuation.costState === "unresolved"
          ? SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnValuationUnresolved
          : SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "valuation",
      );
    }
    if (valuationIds.has(valuation.valuationEntryId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "valuation.valuationEntryId",
      );
    }
    valuationIds.add(valuation.valuationEntryId);

    resolved.push(Object.freeze({
      returnLineId: salesLine.lineId,
      originalInvoiceLineId: commercialLink.originalInvoiceLineId,
      productId: salesLine.productId,
      inventoryDocumentId: receipt.documentId,
      inventoryLineId: receiptLine.lineId,
      movementId: movement.movementId,
      warehouseId: movement.stockKey.warehouseId,
      valuationEntryId: valuation.valuationEntryId,
      method: valuation.method,
      strategyVersion: valuation.strategyVersion,
      currency: valuation.currency,
      quantity: valuation.quantity,
      unitCost: valuation.unitCost,
      totalCost: valuation.totalCost,
      valuedAt: valuation.valuedAt,
      revision: valuation.revision,
    }));
  }

  return Object.freeze(resolved);
}

function mapByLine<T extends { readonly lineId: string }>(
  values: readonly T[],
  field: string,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const value of values) {
    if (map.has(value.lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        field,
      );
    }
    map.set(value.lineId, value);
  }
  return map;
}

export function calculateSalesReturnCostRestoration(input: {
  readonly commercial: SalesCommercialPostingInput;
  readonly lineage: SalesReturnCommercialLineage;
  readonly valuationLines: readonly SalesReturnResolvedValuationLineage[];
  readonly cogsByLine: readonly SalesReturnCogsResolutionForLine[];
  readonly inventoryByLine: readonly SalesReturnInventoryResolutionForLine[];
}): SalesReturnCostRestoration {
  const stockLines = input.commercial.lines.filter(
    (line) => line.lineKind === "stock-product",
  );

  if (stockLines.length === 0) {
    return Object.freeze({
      sourceDocumentId: input.commercial.source.sourceDocumentId,
      originalInvoiceId: input.lineage.originalInvoiceId,
      companyId: input.commercial.companyId,
      currency: null,
      totalDebit: 0,
      totalCredit: 0,
      balanced: true,
      lines: Object.freeze([]),
      components: Object.freeze([]),
    });
  }

  if (
    input.valuationLines.length !== stockLines.length
    || input.cogsByLine.length !== stockLines.length
    || input.inventoryByLine.length !== stockLines.length
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
      "resolutions",
    );
  }

  const valuationByLine = new Map(
    input.valuationLines.map((line) => [line.returnLineId, line] as const),
  );
  const cogsByLine = mapByLine(input.cogsByLine, "cogsByLine");
  const inventoryByLine = mapByLine(input.inventoryByLine, "inventoryByLine");

  const currencies = new Set(input.valuationLines.map((line) => line.currency));
  if (currencies.size !== 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
      "valuation.currency",
    );
  }

  const components: SalesReturnCostRestorationComponent[] = [];

  for (const stockLine of stockLines) {
    const valuation = valuationByLine.get(stockLine.lineId);
    const cogs = cogsByLine.get(stockLine.lineId)?.resolution;
    const inventory = inventoryByLine.get(stockLine.lineId)?.resolution;

    if (!valuation || !cogs || !inventory) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "resolutions",
      );
    }

    if (
      valuation.productId !== stockLine.productId
      || cogs.accountRole !== "cogs"
      || cogs.salesLineId !== stockLine.lineId
      || cogs.productId !== stockLine.productId
      || cogs.valuationEntryId !== valuation.valuationEntryId
      || inventory.accountRole !== "inventory-asset"
      || inventory.salesLineId !== stockLine.lineId
      || inventory.productId !== stockLine.productId
      || inventory.movementId !== valuation.movementId
      || inventory.valuationEntryId !== valuation.valuationEntryId
      || inventory.warehouseId !== valuation.warehouseId
      || cogs.account.companyId !== input.commercial.companyId
      || inventory.account.companyId !== input.commercial.companyId
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnInventoryInvalid,
        "resolution.lineage",
      );
    }

    const amount = safeMoney(
      valuation.totalCost,
      "valuation.totalCost",
    );
    if (amount === 0) continue;

    const common = {
      amount,
      currency: valuation.currency,
      returnLineId: valuation.returnLineId,
      originalInvoiceLineId: valuation.originalInvoiceLineId,
      productId: valuation.productId,
      inventoryDocumentId: valuation.inventoryDocumentId,
      inventoryLineId: valuation.inventoryLineId,
      movementId: valuation.movementId,
      valuationEntryId: valuation.valuationEntryId,
      valuationMethod: valuation.method,
      valuationRevision: valuation.revision,
    } as const;

    components.push(
      Object.freeze({
        componentId: `return-cost:inventory:${valuation.returnLineId}`,
        role: "inventory-asset" as const,
        side: "debit" as const,
        accountId: inventory.account.accountId,
        ...common,
      }),
      Object.freeze({
        componentId: `return-cost:cogs:${valuation.returnLineId}`,
        role: "cogs" as const,
        side: "credit" as const,
        accountId: cogs.account.accountId,
        ...common,
      }),
    );
  }

  const totalDebit = components
    .filter((component) => component.side === "debit")
    .reduce((sum, component) => sum + component.amount, 0);
  const totalCredit = components
    .filter((component) => component.side === "credit")
    .reduce((sum, component) => sum + component.amount, 0);

  const expected = input.valuationLines.reduce(
    (sum, line) => sum + safeMoney(line.totalCost, "valuation.totalCost"),
    0,
  );

  if (
    totalDebit !== totalCredit
    || totalDebit !== expected
    || totalCredit !== expected
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.salesReturnCostUnbalanced,
      "components",
    );
  }

  return Object.freeze({
    sourceDocumentId: input.commercial.source.sourceDocumentId,
    originalInvoiceId: input.lineage.originalInvoiceId,
    companyId: input.commercial.companyId,
    currency: input.valuationLines[0]?.currency ?? null,
    totalDebit,
    totalCredit,
    balanced: true,
    lines: Object.freeze([...input.valuationLines]),
    components: Object.freeze(components),
  });
}
