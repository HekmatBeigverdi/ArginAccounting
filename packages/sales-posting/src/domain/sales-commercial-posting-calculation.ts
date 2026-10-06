import type { SalesLineKind } from "@argin/sales";

import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesAccountsReceivableResolution,
} from "./sales-accounts-receivable-resolution.ts";
import type {
  SalesCommercialPostingInput,
  SalesCommercialPostingLineInput,
} from "./sales-commercial-posting-input.ts";
import type {
  SalesOutputVatAccountResolution,
} from "./sales-output-vat-account-resolution.ts";
import type {
  SalesRevenueAccountResolution,
} from "./sales-revenue-account-resolution.ts";

export type SalesCommercialPostingSide = "debit" | "credit";
export type SalesCommercialPostingComponentRole =
  | "accounts-receivable"
  | "sales-revenue"
  | "output-vat";

export interface SalesCommercialPostingComponent {
  readonly componentId: string;
  readonly role: SalesCommercialPostingComponentRole;
  readonly side: SalesCommercialPostingSide;
  readonly accountId: string;
  readonly amount: number;
  readonly currency: string;
  readonly sourceLineId: string | null;
  readonly customerPartyId: string | null;
  readonly taxId: string | null;
  readonly taxCode: string | null;
}

export interface SalesRevenueResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesRevenueAccountResolution;
}

export interface SalesOutputVatResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesOutputVatAccountResolution;
}

export interface CalculateSalesCommercialPostingInput {
  readonly commercial: SalesCommercialPostingInput;
  readonly accountsReceivable: SalesAccountsReceivableResolution;
  readonly revenueByLine: readonly SalesRevenueResolutionForLine[];
  readonly outputVatByLine: readonly SalesOutputVatResolutionForLine[];
}

export interface SalesCommercialPostingCalculation {
  readonly currency: string;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly balanced: true;
  readonly components: readonly SalesCommercialPostingComponent[];
}

const fail = (code: SalesPostingDomainErrorCode, field: string): never => {
  throw new SalesPostingDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.identityRequired, field);
  }
  return value.trim();
}

function assertSafeMoney(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid, field);
  }
  return value;
}

function sumMoney(values: readonly number[], field: string): number {
  const total = values.reduce((sum, value) => sum + BigInt(assertSafeMoney(value, field)), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid, field);
  }
  return Number(total);
}

function resolutionMap<T extends { readonly lineId: string }>(
  entries: readonly T[],
  field: string,
): Map<string, T> {
  if (!Array.isArray(entries)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid, field);
  }
  const result = new Map<string, T>();
  for (const entry of entries) {
    const lineId = required(entry.lineId, `${field}.lineId`);
    if (result.has(lineId)) {
      return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, `${field}.lineId`);
    }
    result.set(lineId, entry);
  }
  return result;
}

function assertRevenueResolution(
  line: SalesCommercialPostingLineInput,
  companyId: string,
  entry: SalesRevenueResolutionForLine | undefined,
): SalesRevenueAccountResolution {
  if (!entry) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "revenueByLine");
  }
  const resolution = entry.resolution;
  if (
    resolution.accountRole !== "sales-revenue"
    || resolution.lineKind !== line.lineKind
    || resolution.account.companyId !== companyId
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "revenueByLine.resolution");
  }
  return resolution;
}

function assertVatResolution(
  line: SalesCommercialPostingLineInput,
  companyId: string,
  entry: SalesOutputVatResolutionForLine | undefined,
): SalesOutputVatAccountResolution {
  if (!entry) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "outputVatByLine");
  }
  const resolution = entry.resolution;
  if (
    resolution.accountRole !== "output-vat"
    || resolution.account.companyId !== companyId
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "outputVatByLine.resolution");
  }

  const sourceTax = line.terms.taxes.find((tax) => tax.taxId === resolution.taxId);
  if (
    !sourceTax
    || sourceTax.rateBasisPoints !== resolution.rateBasisPoints
    || (sourceTax.taxCode ?? null)?.toUpperCase() !== resolution.taxCode
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "outputVatByLine.tax");
  }

  return resolution;
}

function revenueComponent(
  commercial: SalesCommercialPostingInput,
  line: SalesCommercialPostingLineInput,
  resolution: SalesRevenueAccountResolution,
): SalesCommercialPostingComponent | null {
  const amount = assertSafeMoney(line.totals.taxBaseAmount, "line.totals.taxBaseAmount");
  if (amount === 0) return null;

  return Object.freeze({
    componentId: `commercial:revenue:${line.lineId}`,
    role: "sales-revenue",
    side: "credit",
    accountId: resolution.account.accountId,
    amount,
    currency: commercial.currency,
    sourceLineId: line.lineId,
    customerPartyId: null,
    taxId: null,
    taxCode: null,
  });
}

function vatComponent(
  commercial: SalesCommercialPostingInput,
  line: SalesCommercialPostingLineInput,
  resolution: SalesOutputVatAccountResolution,
): SalesCommercialPostingComponent | null {
  const amount = assertSafeMoney(line.totals.taxAmount, "line.totals.taxAmount");
  if (amount === 0) return null;

  return Object.freeze({
    componentId: `commercial:output-vat:${line.lineId}`,
    role: "output-vat",
    side: "credit",
    accountId: resolution.account.accountId,
    amount,
    currency: commercial.currency,
    sourceLineId: line.lineId,
    customerPartyId: null,
    taxId: resolution.taxId,
    taxCode: resolution.taxCode,
  });
}

export function calculateSalesCommercialPosting(
  input: CalculateSalesCommercialPostingInput,
): SalesCommercialPostingCalculation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid, "input");
  }

  const commercial = input.commercial;
  const ar = input.accountsReceivable;

  if (
    !commercial
    || typeof commercial !== "object"
    || !ar
    || typeof ar !== "object"
  ) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid, "input");
  }

  if (
    ar.accountRole !== "accounts-receivable"
    || ar.customerPartyId !== commercial.customerPartyId
    || ar.account.companyId !== commercial.companyId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "accountsReceivable",
    );
  }

  const revenueMap = resolutionMap(input.revenueByLine, "revenueByLine");
  const vatMap = resolutionMap(input.outputVatByLine, "outputVatByLine");

  if (revenueMap.size !== commercial.lines.length) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "revenueByLine",
    );
  }

  const components: SalesCommercialPostingComponent[] = [];

  for (const line of commercial.lines) {
    const revenue = assertRevenueResolution(
      line,
      commercial.companyId,
      revenueMap.get(line.lineId),
    );
    const revenuePart = revenueComponent(commercial, line, revenue);
    if (revenuePart) components.push(revenuePart);

    if (line.totals.taxAmount > 0) {
      if (line.terms.taxes.length === 0) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingInvalid,
          "line.terms.taxes",
        );
      }

      const vat = assertVatResolution(
        line,
        commercial.companyId,
        vatMap.get(line.lineId),
      );

      const distinctTaxAccounts = new Set(
        line.terms.taxes.map((tax) => {
          if (tax.taxId === vat.taxId) return vat.account.accountId;
          return vat.account.accountId;
        }),
      );
      if (distinctTaxAccounts.size !== 1) {
        return fail(
          SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
          "outputVatByLine.account",
        );
      }

      const vatPart = vatComponent(commercial, line, vat);
      if (vatPart) components.push(vatPart);
    } else if (vatMap.has(line.lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        "outputVatByLine",
      );
    }
  }

  for (const lineId of revenueMap.keys()) {
    if (!commercial.lines.some((line) => line.lineId === lineId)) {
      return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "revenueByLine.lineId");
    }
  }
  for (const lineId of vatMap.keys()) {
    if (!commercial.lines.some((line) => line.lineId === lineId)) {
      return fail(SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch, "outputVatByLine.lineId");
    }
  }

  const receivableAmount = assertSafeMoney(
    commercial.documentTotals.grandTotal,
    "documentTotals.grandTotal",
  );
  if (receivableAmount > 0) {
    components.unshift(Object.freeze({
      componentId: "commercial:accounts-receivable",
      role: "accounts-receivable",
      side: "debit",
      accountId: ar.account.accountId,
      amount: receivableAmount,
      currency: commercial.currency,
      sourceLineId: null,
      customerPartyId: commercial.customerPartyId,
      taxId: null,
      taxCode: null,
    }));
  }

  const totalDebit = sumMoney(
    components.filter((component) => component.side === "debit").map((component) => component.amount),
    "totalDebit",
  );
  const totalCredit = sumMoney(
    components.filter((component) => component.side === "credit").map((component) => component.amount),
    "totalCredit",
  );

  if (totalDebit !== totalCredit) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingUnbalanced,
      "components",
    );
  }

  if (
    totalDebit !== commercial.documentTotals.grandTotal
    || sumMoney(
      commercial.lines.map((line) => line.totals.taxBaseAmount),
      "revenueTotal",
    ) !== commercial.documentTotals.taxBaseAmount
    || sumMoney(
      commercial.lines.map((line) => line.totals.taxAmount),
      "vatTotal",
    ) !== commercial.documentTotals.taxAmount
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.commercialPostingUnbalanced,
      "documentTotals",
    );
  }

  return Object.freeze({
    currency: commercial.currency,
    totalDebit,
    totalCredit,
    balanced: true,
    components: Object.freeze(components),
  });
}
