import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import { createSalesCommercialSnapshot, type SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";
import { createSalesDocument, type CreateSalesDocumentInput, type SalesDocumentSnapshot } from "./sales-document.ts";
import { calculateSalesDocumentTotals, type SalesDocumentTotals } from "./sales-pricing.ts";

export interface SalesOrder {
  readonly document: SalesDocumentSnapshot & { readonly documentType: "sales-order" };
  readonly commercialSnapshots: readonly SalesCommercialSnapshot[];
  readonly totals: SalesDocumentTotals;
}

export interface CreateSalesOrderInput extends Omit<CreateSalesDocumentInput, "documentType"> {
  readonly capturedAt: string;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

export function createSalesOrder(input: CreateSalesOrderInput): SalesOrder {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "salesOrder");
  const { capturedAt, ...documentInput } = input;
  const document = createSalesDocument({ ...documentInput, documentType: "sales-order" });
  if (document.lines.length === 0) return fail(SALES_DOMAIN_ERROR_CODES.salesOrderLinesRequired, "salesOrder.lines");

  const commercialSnapshots = document.lines.map((line) =>
    createSalesCommercialSnapshot({
      snapshotId: `${document.documentId}:${line.lineId}:commercial`,
      line,
      capturedAt,
    }),
  );
  const totals = calculateSalesDocumentTotals(commercialSnapshots.map((snapshot) => snapshot.totals));

  return Object.freeze({
    document: document as SalesDocumentSnapshot & { readonly documentType: "sales-order" },
    commercialSnapshots: Object.freeze(commercialSnapshots),
    totals,
  });
}
