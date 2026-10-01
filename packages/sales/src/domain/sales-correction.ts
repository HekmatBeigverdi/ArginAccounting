import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import { createSalesCommercialSnapshot, type SalesCommercialSnapshot } from "./sales-commercial-snapshot.ts";
import { createSalesDocument, type CreateSalesDocumentInput, type SalesDocumentSnapshot } from "./sales-document.ts";
import { calculateSalesDocumentTotals, type SalesDocumentTotals } from "./sales-pricing.ts";

export interface SalesCorrection {
  readonly document: SalesDocumentSnapshot & { readonly documentType: "sales-correction" };
  readonly commercialSnapshots: readonly SalesCommercialSnapshot[];
  readonly totals: SalesDocumentTotals;
}

export interface CreateSalesCorrectionInput extends Omit<CreateSalesDocumentInput, "documentType"> {
  readonly capturedAt: string;
}

function fail(code: (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never {
  throw new SalesDomainError(code, field);
}

export function createSalesCorrection(input: CreateSalesCorrectionInput): SalesCorrection {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "salesCorrection");
  const { capturedAt, ...documentInput } = input;
  const document = createSalesDocument({ ...documentInput, documentType: "sales-correction" });

  if (document.lines.length === 0) {
    return fail(SALES_DOMAIN_ERROR_CODES.salesCorrectionLinesRequired, "salesCorrection.lines");
  }

  const origin = document.relatedDocumentReference;
  if (origin === null || origin.relationType !== "sales-invoice") {
    return fail(SALES_DOMAIN_ERROR_CODES.salesCorrectionInvoiceRequired, "salesCorrection.relatedDocumentReference");
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
      return fail(SALES_DOMAIN_ERROR_CODES.salesCorrectionInvoiceLineRequired, `salesCorrection.lines[${index}].sourceReference`);
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
    document: document as SalesDocumentSnapshot & { readonly documentType: "sales-correction" },
    commercialSnapshots: Object.freeze(commercialSnapshots),
    totals,
  });
}
