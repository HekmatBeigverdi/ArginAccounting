import {
  createJournalVoucher,
} from "@argin/accounting/journal";
import type {
  JournalVoucher,
} from "@argin/accounting/journal";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingDomainErrorCode,
} from "./sales-posting-domain-errors.ts";
import type {
  SalesPostingSourceIdentity,
} from "./sales-posting-source.ts";
import type {
  SalesCommercialPostingCalculation,
  SalesCommercialPostingComponent,
} from "./sales-commercial-posting-calculation.ts";
import type {
  SalesCostPostingCalculation,
  SalesCostPostingComponent,
} from "./sales-cost-posting-calculation.ts";
import type {
  SalesReturnCommercialReversal,
  SalesReturnCommercialReversalComponent,
} from "./sales-return-commercial-reversal.ts";
import type {
  SalesReturnCostRestoration,
  SalesReturnCostRestorationComponent,
} from "./sales-return-cost-restoration.ts";
import {
  createSalesPostingJournalProvenance,
} from "./sales-journal-provenance.ts";
import type {
  SalesJournalLineProvenance,
  SalesPostingJournalProvenance,
} from "./sales-journal-provenance.ts";

export type SalesPostingJournalRole =
  | "accounts-receivable"
  | "sales-revenue"
  | "output-vat"
  | "cogs"
  | "inventory-asset";

export interface SalesPostingJournalComponent {
  readonly componentId: string;
  readonly role: SalesPostingJournalRole;
  readonly side: "debit" | "credit";
  readonly accountId: string;
  readonly amount: number;
  readonly currency: string;
  readonly salesLineId: string | null;
  readonly customerPartyId: string | null;
  readonly productId: string | null;
  readonly inventoryDocumentId: string | null;
  readonly inventoryLineId: string | null;
  readonly movementId: string | null;
  readonly valuationEntryId: string | null;
  readonly valuationMethod: "fifo" | "moving_average" | null;
  readonly valuationRevision: number | null;
  readonly originalInvoiceId: string | null;
  readonly originalInvoiceLineId: string | null;
  readonly taxIds: readonly string[];
  readonly taxCodes: readonly string[];
}

export interface CreateSalesPostingJournalDraftInput {
  readonly journalVoucherId: string;
  readonly journalNumber: string;
  readonly postingId: string;
  readonly source: SalesPostingSourceIdentity;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly voucherDate: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly createdAtUtc: string;
  readonly components: readonly SalesPostingJournalComponent[];
  readonly requestId?: string | null;
  readonly causationId?: string | null;
}

export interface SalesPostingJournalDraftResult {
  readonly journal: JournalVoucher;
  readonly provenance: SalesPostingJournalProvenance;
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.journalDraftInvalid, field);
  }
  return value.trim();
}

function nullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function description(component: SalesPostingJournalComponent): string {
  const suffix = component.salesLineId
    ? ` — ردیف فروش ${component.salesLineId}`
    : "";

  switch (component.role) {
    case "accounts-receivable":
      return `حساب دریافتنی فروش${suffix}`;
    case "sales-revenue":
      return `درآمد فروش${suffix}`;
    case "output-vat":
      return `مالیات بر ارزش افزوده فروش${suffix}`;
    case "cogs":
      return `بهای تمام‌شده کالای فروش‌رفته${suffix}`;
    case "inventory-asset":
      return `موجودی کالا${suffix}`;
  }
}

function lineId(
  journalVoucherId: string,
  index: number,
): string {
  const id = `${required(journalVoucherId, "journalVoucherId")}:line:${index + 1}`;
  if (id.length > 128) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalDraftInvalid,
      "journalLineId",
    );
  }
  return id;
}

function assertComponent(
  component: SalesPostingJournalComponent,
  currency: string,
): void {
  if (
    !Number.isSafeInteger(component.amount)
    || component.amount <= 0
    || component.currency !== currency
    || !component.accountId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalDraftInvalid,
      "components",
    );
  }

  const isValuationRole = component.role === "cogs"
    || component.role === "inventory-asset";
  if (
    component.valuationEntryId !== null
    && (
      !isValuationRole
      || component.movementId === null
      || component.productId === null
      || component.valuationMethod === null
      || component.valuationRevision === null
    )
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
      "components.valuation",
    );
  }
}

export function createSalesPostingJournalDraft(
  input: CreateSalesPostingJournalDraftInput,
): SalesPostingJournalDraftResult {
  if (
    !input
    || typeof input !== "object"
    || !Array.isArray(input.components)
    || input.components.length < 2
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalDraftInvalid,
      "input",
    );
  }

  const currencies = new Set(input.components.map((component) => component.currency));
  if (currencies.size !== 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalDraftInvalid,
      "components.currency",
    );
  }
  const currency = [...currencies][0]!;
  const componentIds = new Set<string>();
  let debit = 0n;
  let credit = 0n;

  const journalLines = input.components.map((component, index) => {
    assertComponent(component, currency);
    if (componentIds.has(component.componentId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.journalProvenanceInvalid,
        "components.componentId",
      );
    }
    componentIds.add(component.componentId);

    if (component.side === "debit") {
      debit += BigInt(component.amount);
    } else {
      credit += BigInt(component.amount);
    }

    return Object.freeze({
      id: lineId(input.journalVoucherId, index),
      order: index + 1,
      accountId: component.accountId,
      description: description(component),
      debit: component.side === "debit" ? component.amount : 0,
      credit: component.side === "credit" ? component.amount : 0,
      dimensionAssignments: Object.freeze([]),
    });
  });

  if (
    debit !== credit
    || debit <= 0n
    || debit > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.journalBalanceMismatch,
      "components",
    );
  }

  const journal = createJournalVoucher({
    id: required(input.journalVoucherId, "journalVoucherId"),
    companyId: required(input.companyId, "companyId"),
    branchId: input.branchId,
    number: required(input.journalNumber, "journalNumber"),
    reference: input.source.sourceDocumentId,
    voucherDate: input.voucherDate,
    fiscalYearId: required(input.fiscalYearId, "fiscalYearId"),
    fiscalPeriodId: required(input.fiscalPeriodId, "fiscalPeriodId"),
    description: `ثبت حسابداری خودکار فروش — ${input.source.sourceType} — ${input.source.sourceDocumentId}`,
    currency: currency as never,
    source: {
      type: "source_document",
      sourceId: input.source.sourceDocumentId,
      requestId: nullable(input.requestId),
      correlationId: required(input.postingId, "postingId"),
      causationId: nullable(input.causationId),
    },
    lines: journalLines,
    createdAt: input.createdAtUtc,
    version: 1,
  });

  const lineProvenance: SalesJournalLineProvenance[] = input.components.map(
    (component, index) => Object.freeze({
      journalLineId: lineId(input.journalVoucherId, index),
      componentId: component.componentId,
      role: component.role,
      salesLineId: component.salesLineId,
      customerPartyId: component.customerPartyId,
      productId: component.productId,
      inventoryDocumentId: component.inventoryDocumentId,
      inventoryLineId: component.inventoryLineId,
      movementId: component.movementId,
      valuationEntryId: component.valuationEntryId,
      valuationMethod: component.valuationMethod,
      valuationRevision: component.valuationRevision,
      originalInvoiceId: component.originalInvoiceId,
      originalInvoiceLineId: component.originalInvoiceLineId,
      taxIds: component.taxIds,
      taxCodes: component.taxCodes,
    }),
  );

  const provenance = createSalesPostingJournalProvenance({
    journal,
    postingId: input.postingId,
    source: input.source,
    lineProvenance,
    createdAtUtc: input.createdAtUtc,
  });

  return Object.freeze({ journal, provenance });
}

function commercialComponent(
  component: SalesCommercialPostingComponent,
): SalesPostingJournalComponent {
  return Object.freeze({
    ...component,
    salesLineId: component.sourceLineId,
    productId: null,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: null,
    valuationEntryId: null,
    valuationMethod: null,
    valuationRevision: null,
    originalInvoiceId: null,
    originalInvoiceLineId: null,
  });
}

function costComponent(
  component: SalesCostPostingComponent,
): SalesPostingJournalComponent {
  return Object.freeze({
    componentId: component.componentId,
    role: component.role,
    side: component.side,
    accountId: component.accountId,
    amount: component.amount,
    currency: component.currency,
    salesLineId: component.salesLineId,
    customerPartyId: null,
    productId: component.productId,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: component.movementId,
    valuationEntryId: component.valuationEntryId,
    valuationMethod: component.valuationMethod,
    valuationRevision: component.valuationRevision,
    originalInvoiceId: null,
    originalInvoiceLineId: null,
    taxIds: Object.freeze([]),
    taxCodes: Object.freeze([]),
  });
}

function returnCommercialComponent(
  component: SalesReturnCommercialReversalComponent,
): SalesPostingJournalComponent {
  return Object.freeze({
    componentId: component.componentId,
    role: component.role,
    side: component.side,
    accountId: component.accountId,
    amount: component.amount,
    currency: component.currency,
    salesLineId: component.returnLineId,
    customerPartyId: component.customerPartyId,
    productId: null,
    inventoryDocumentId: null,
    inventoryLineId: null,
    movementId: null,
    valuationEntryId: null,
    valuationMethod: null,
    valuationRevision: null,
    originalInvoiceId: component.originalInvoiceId,
    originalInvoiceLineId: component.originalInvoiceLineId,
    taxIds: component.taxIds,
    taxCodes: component.taxCodes,
  });
}

function returnCostComponent(
  component: SalesReturnCostRestorationComponent,
  originalInvoiceId: string,
): SalesPostingJournalComponent {
  return Object.freeze({
    componentId: component.componentId,
    role: component.role,
    side: component.side,
    accountId: component.accountId,
    amount: component.amount,
    currency: component.currency,
    salesLineId: component.returnLineId,
    customerPartyId: null,
    productId: component.productId,
    inventoryDocumentId: component.inventoryDocumentId,
    inventoryLineId: component.inventoryLineId,
    movementId: component.movementId,
    valuationEntryId: component.valuationEntryId,
    valuationMethod: component.valuationMethod,
    valuationRevision: component.valuationRevision,
    originalInvoiceId,
    originalInvoiceLineId: component.originalInvoiceLineId,
    taxIds: Object.freeze([]),
    taxCodes: Object.freeze([]),
  });
}

export function salesJournalComponentsFromInvoice(input: {
  readonly commercial: SalesCommercialPostingCalculation;
  readonly cost?: SalesCostPostingCalculation | null;
}): readonly SalesPostingJournalComponent[] {
  return Object.freeze([
    ...input.commercial.components.map(commercialComponent),
    ...(input.cost?.components ?? []).map(costComponent),
  ]);
}

export function salesJournalComponentsFromReturn(input: {
  readonly commercial: SalesReturnCommercialReversal;
  readonly cost?: SalesReturnCostRestoration | null;
}): readonly SalesPostingJournalComponent[] {
  return Object.freeze([
    ...input.commercial.components.map(returnCommercialComponent),
    ...(input.cost?.components ?? []).map((component) =>
      returnCostComponent(component, input.commercial.originalInvoiceId)
    ),
  ]);
}
