import {
  createJournalVoucher,
} from "@argin/accounting/journal";
import type {
  CreateJournalVoucherInput,
  JournalVoucher,
} from "@argin/accounting/journal";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
} from "./purchase-posting-domain-errors.ts";
import type { PurchasePostingDomainErrorCode } from "./purchase-posting-domain-errors.ts";
import type {
  PurchasePostingFactSnapshot,
  PurchasePostingLineKind,
} from "./purchase-posting-facts.ts";
import type {
  PurchasePostingEventKind,
} from "./purchase-posting-event-classification.ts";
import {
  resolvePurchasePostingAccount,
} from "./purchase-posting-rules.ts";
import type {
  PurchasePostingAccountReader,
  PurchasePostingAccountRole,
  PurchasePostingRule,
} from "./purchase-posting-rules.ts";
import type {
  PurchasePostingTraceContext,
} from "./purchase-posting-source-reference.ts";
import type {
  ResolvedSupplierInvoicePostingPlan,
  ResolvedPurchaseReturnPostingPlan,
  ResolvedPurchaseCorrectionPostingPlan,
} from "./inventory-valuation-integration.ts";
import type {
  PurchaseTaxPostingPlan,
} from "./purchase-tax-posting.ts";
import type {
  PurchaseChargePostingPlan,
} from "./purchase-charge-posting.ts";

export interface PurchasePostingDraftComponent {
  readonly componentId: string;
  readonly sourceLineId: string | null;
  readonly side: "debit" | "credit";
  readonly accountRole: PurchasePostingAccountRole;
  readonly amount: number;
  readonly currency: string;
}

export interface PurchasePostingDraftJournalMetadata {
  readonly voucherId: string;
  readonly voucherNumber: string;
  readonly lineIds: readonly string[];
  readonly createdAt: string;
  readonly reference?: string | null;
  readonly description?: string | null;
}

export interface CreatePurchasePostingDraftJournalInput {
  readonly fact: PurchasePostingFactSnapshot;
  readonly eventKind: Exclude<PurchasePostingEventKind, "none">;
  readonly components: readonly PurchasePostingDraftComponent[];
  readonly rules: readonly PurchasePostingRule[];
  readonly accounts: PurchasePostingAccountReader;
  readonly trace: PurchasePostingTraceContext;
  readonly journal: PurchasePostingDraftJournalMetadata;
}

const fail = (code: PurchasePostingDomainErrorCode, field: string): never => {
  throw new PurchasePostingDomainError(code, field);
};

function component(
  value: {
    readonly componentId: string;
    readonly lineId: string | null;
    readonly side: "debit" | "credit";
    readonly accountRole: PurchasePostingAccountRole;
    readonly amount: number | null;
    readonly currency: string;
    readonly deferredToStep: number | null;
  },
): PurchasePostingDraftComponent | null {
  if (value.deferredToStep !== null || value.amount === null) {
    return fail(
      PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalComponentUnresolved,
      value.componentId,
    );
  }
  if (!Number.isSafeInteger(value.amount) || value.amount < 0) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, value.componentId);
  }
  if (value.amount === 0) return null;

  return Object.freeze({
    componentId: value.componentId,
    sourceLineId: value.lineId,
    side: value.side,
    accountRole: value.accountRole,
    amount: value.amount,
    currency: value.currency,
  });
}

export function createSupplierInvoiceDraftComponents(
  posting: ResolvedSupplierInvoicePostingPlan,
  tax: PurchaseTaxPostingPlan,
  charges: PurchaseChargePostingPlan,
): readonly PurchasePostingDraftComponent[] {
  if (
    posting.factId !== tax.factId
    || posting.purchaseDocumentId !== tax.purchaseDocumentId
    || posting.factId !== charges.factId
    || posting.purchaseDocumentId !== charges.purchaseDocumentId
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "supplierInvoicePlans");
  }

  const result: PurchasePostingDraftComponent[] = [];

  for (const item of posting.components) {
    if (item.amountBasis === "deferred-tax" || item.amountBasis === "deferred-charge") {
      continue;
    }
    const normalized = component({
      componentId: item.componentId,
      lineId: item.purchaseLineId,
      side: item.side,
      accountRole: item.accountRole,
      amount: item.amount,
      currency: item.currency,
      deferredToStep: item.deferredToStep,
    });
    if (normalized) result.push(normalized);
  }

  for (const item of tax.components) {
    if (item.deferredToStep === 12) {
      continue;
    }
    const normalized = component({
      componentId: item.componentId,
      lineId: item.purchaseLineId,
      side: item.side,
      accountRole: item.accountRole,
      amount: item.taxAmount,
      currency: item.currency,
      deferredToStep: item.deferredToStep,
    });
    if (normalized) result.push(normalized);
  }

  for (const item of charges.components) {
    if (item.includedInPurchaseCostInput || item.deferredToStep === 12) {
      continue;
    }
    const normalized = component({
      componentId: item.componentId,
      lineId: item.purchaseLineId,
      side: item.side,
      accountRole: item.accountRole,
      amount: item.chargeAmount,
      currency: item.currency,
      deferredToStep: item.deferredToStep,
    });
    if (normalized) result.push(normalized);
  }

  return Object.freeze(result);
}

export function createPurchaseReturnDraftComponents(
  posting: ResolvedPurchaseReturnPostingPlan,
): readonly PurchasePostingDraftComponent[] {
  const result: PurchasePostingDraftComponent[] = [];
  for (const item of posting.components) {
    const normalized = component({
      componentId: item.componentId,
      lineId: item.purchaseLineId,
      side: item.side,
      accountRole: item.accountRole,
      amount: item.amount,
      currency: item.currency,
      deferredToStep: item.deferredToStep,
    });
    if (normalized) result.push(normalized);
  }
  return Object.freeze(result);
}

export function createPurchaseCorrectionDraftComponents(
  posting: ResolvedPurchaseCorrectionPostingPlan,
): readonly PurchasePostingDraftComponent[] {
  const result: PurchasePostingDraftComponent[] = [];
  for (const item of posting.components) {
    const normalized = component({
      componentId: item.componentId,
      lineId: item.correctionPurchaseLineId,
      side: item.side,
      accountRole: item.accountRole,
      amount: item.amount,
      currency: item.currency,
      deferredToStep: item.deferredToStep,
    });
    if (normalized) result.push(normalized);
  }
  return Object.freeze(result);
}

function lineKind(
  fact: PurchasePostingFactSnapshot,
  sourceLineId: string | null,
): PurchasePostingLineKind | null {
  if (sourceLineId === null) return null;
  const line = fact.lines.find(item => item.purchaseLineId === sourceLineId);
  if (!line) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "component.sourceLineId");
  }
  return line.lineKind;
}

function assertCanonicalTimestamp(value: string): string {
  if (typeof value !== "string") {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "journal.createdAt");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "journal.createdAt");
  }
  return value;
}

function totals(components: readonly PurchasePostingDraftComponent[]): {
  readonly debit: number;
  readonly credit: number;
} {
  let debit = 0;
  let credit = 0;

  for (const item of components) {
    if (!Number.isSafeInteger(item.amount) || item.amount <= 0) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, item.componentId);
    }
    if (item.side === "debit") debit += item.amount;
    else credit += item.amount;

    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "components");
    }
  }

  return Object.freeze({ debit, credit });
}

export async function createPurchasePostingDraftJournal(
  input: CreatePurchasePostingDraftJournalInput,
): Promise<JournalVoucher> {
  if (!Array.isArray(input.components) || input.components.length < 2) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "components");
  }
  if (
    !Array.isArray(input.journal.lineIds)
    || input.journal.lineIds.length !== input.components.length
    || new Set(input.journal.lineIds).size !== input.journal.lineIds.length
  ) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalLineIdsInvalid, "journal.lineIds");
  }

  for (const item of input.components) {
    if (item.currency !== input.fact.totals.currency) {
      return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalInvalid, "component.currency");
    }
  }

  const balance = totals(input.components);
  if (balance.debit !== balance.credit) {
    return fail(PURCHASE_POSTING_DOMAIN_ERROR_CODES.draftJournalUnbalanced, "components");
  }

  const lines = [];
  for (let index = 0; index < input.components.length; index += 1) {
    const item = input.components[index]!;
    const resolution = await resolvePurchasePostingAccount(
      input.rules,
      {
        companyId: input.fact.companyId,
        branchId: input.fact.branchId,
        eventKind: input.eventKind,
        lineKind: lineKind(input.fact, item.sourceLineId),
        accountRole: item.accountRole,
      },
      input.accounts,
    );

    lines.push({
      id: input.journal.lineIds[index]!,
      order: index + 1,
      accountId: resolution.account.accountId,
      description: item.componentId,
      debit: item.side === "debit" ? item.amount : 0,
      credit: item.side === "credit" ? item.amount : 0,
      dimensionAssignments: [],
    });
  }

  return createJournalVoucher({
    id: input.journal.voucherId,
    companyId: input.fact.companyId,
    branchId: input.fact.branchId,
    number: input.journal.voucherNumber,
    reference: input.journal.reference ?? input.fact.documentNumber,
    voucherDate: input.fact.businessDate,
    fiscalYearId: input.fact.fiscalYearId,
    fiscalPeriodId: input.fact.fiscalPeriodId,
    description: input.journal.description ?? `Purchase posting: ${input.fact.purchaseDocumentId}`,
    currency: input.fact.totals.currency as NonNullable<CreateJournalVoucherInput["currency"]>,
    source: {
      type: "source_document",
      sourceId: input.fact.purchaseDocumentId,
      requestId: input.trace.requestId,
      correlationId: input.trace.correlationId,
      causationId: input.trace.causationId,
    },
    lines,
    createdAt: assertCanonicalTimestamp(input.journal.createdAt),
    version: 1,
  });
}
