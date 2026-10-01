import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import { createSalesCommercialSnapshot, type SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";
import { createSalesDocument, type CreateSalesDocumentInput, type SalesDocumentSnapshot } from "./sales-document.ts";
import { calculateSalesDocumentTotals, type SalesDocumentTotals } from "./sales-pricing.ts";

export interface SalesReturn {
  readonly document: SalesDocumentSnapshot & { readonly documentType: "sales-return" };
  readonly commercialSnapshots: readonly SalesCommercialSnapshot[];
  readonly totals: SalesDocumentTotals;
}

export interface CreateSalesReturnInput extends Omit<CreateSalesDocumentInput, "documentType"> {
  readonly capturedAt: string;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

export function createSalesReturn(input: CreateSalesReturnInput): SalesReturn {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "salesReturn");
  const { capturedAt, ...documentInput } = input;
  const document = createSalesDocument({ ...documentInput, documentType: "sales-return" });

  if (document.lines.length === 0) {
    return fail(SALES_DOMAIN_ERROR_CODES.salesReturnLinesRequired, "salesReturn.lines");
  }

  const origin = document.relatedDocumentReference;
  if (origin === null || origin.relationType !== "sales-invoice") {
    return fail(SALES_DOMAIN_ERROR_CODES.salesReturnInvoiceRequired, "salesReturn.relatedDocumentReference");
  }

  for (let index = 0; index < document.lines.length; index += 1) {
    const line = document.lines[index]!;
    const source = line.sourceReference;
    if (
      source === null ||
      source.sourceSystem !== "sales" ||
      source.sourceDocumentId !== origin.documentId ||
      source.sourceLineId === null
    ) {
      return fail(SALES_DOMAIN_ERROR_CODES.salesReturnInvoiceLineRequired, `salesReturn.lines[${index}].sourceReference`);
    }
  }

  const commercialSnapshots = document.lines.map((line) =>
    createSalesCommercialSnapshot({
      snapshotId: `${document.documentId}:${line.lineId}:commercial`,
      line,
      capturedAt,
    }),
  );

  const totals = calculateSalesDocumentTotals(
    commercialSnapshots.map((snapshot) => snapshot.totals),
  );

  return Object.freeze({
    document: document as SalesDocumentSnapshot & { readonly documentType: "sales-return" },
    commercialSnapshots: Object.freeze(commercialSnapshots),
    totals,
  });
}
