import {
  SALES_POSTING_DOMAIN_ERROR_CODES,
  SalesPostingDomainError,
} from "./sales-posting-domain-errors.ts";
import type { SalesPostingDomainErrorCode } from "./sales-posting-domain-errors.ts";
import type {
  SalesResolvedValuationPrerequisiteResult,
  SalesResolvedValuationLineage,
} from "./sales-resolved-valuation-prerequisite.ts";
import type {
  SalesCogsAccountResolution,
} from "./sales-cogs-account-resolution.ts";
import type {
  SalesInventoryAccountResolution,
} from "./sales-inventory-account-resolution.ts";

export type SalesCostPostingSide = "debit" | "credit";
export type SalesCostPostingComponentRole = "cogs" | "inventory-asset";

export interface SalesCogsResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesCogsAccountResolution;
}

export interface SalesInventoryResolutionForLine {
  readonly lineId: string;
  readonly resolution: SalesInventoryAccountResolution;
}

export interface CalculateSalesCostPostingInput {
  readonly valuation: SalesResolvedValuationPrerequisiteResult;
  readonly cogsByLine: readonly SalesCogsResolutionForLine[];
  readonly inventoryByLine: readonly SalesInventoryResolutionForLine[];
}

export interface SalesCostPostingComponent {
  readonly componentId: string;
  readonly role: SalesCostPostingComponentRole;
  readonly side: SalesCostPostingSide;
  readonly accountId: string;
  readonly amount: number;
  readonly currency: string;
  readonly salesLineId: string;
  readonly productId: string;
  readonly movementId: string;
  readonly valuationEntryId: string;
  readonly valuationMethod: SalesResolvedValuationLineage["method"];
  readonly valuationRevision: number;
}

export interface SalesCostPostingCalculation {
  readonly currency: string | null;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly balanced: true;
  readonly components: readonly SalesCostPostingComponent[];
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

function safeNonNegativeMoney(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid, field);
  }
  return value;
}

function absoluteOutboundCost(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value > 0) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid, field);
  }
  return safeNonNegativeMoney(Math.abs(value), field);
}

function sumMoney(values: readonly number[], field: string): number {
  const total = values.reduce(
    (sum, value) => sum + BigInt(safeNonNegativeMoney(value, field)),
    0n,
  );
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid, field);
  }
  return Number(total);
}

function resolutionMap<T extends { readonly lineId: string }>(
  entries: readonly T[],
  field: string,
): Map<string, T> {
  if (!Array.isArray(entries)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid, field);
  }

  const result = new Map<string, T>();
  for (const entry of entries) {
    const lineId = required(entry.lineId, `${field}.lineId`);
    if (result.has(lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        `${field}.lineId`,
      );
    }
    result.set(lineId, entry);
  }
  return result;
}

function assertCogsResolution(
  valuation: SalesResolvedValuationLineage,
  entry: SalesCogsResolutionForLine | undefined,
): SalesCogsAccountResolution {
  if (!entry) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "cogsByLine",
    );
  }

  const resolution = entry.resolution;
  if (
    resolution.accountRole !== "cogs"
    || resolution.salesLineId !== valuation.salesLineId
    || resolution.productId !== valuation.productId
    || resolution.valuationEntryId !== valuation.valuationEntryId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "cogsByLine.resolution",
    );
  }

  return resolution;
}

function assertInventoryResolution(
  valuation: SalesResolvedValuationLineage,
  entry: SalesInventoryResolutionForLine | undefined,
): SalesInventoryAccountResolution {
  if (!entry) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "inventoryByLine",
    );
  }

  const resolution = entry.resolution;
  if (
    resolution.accountRole !== "inventory-asset"
    || resolution.salesLineId !== valuation.salesLineId
    || resolution.productId !== valuation.productId
    || resolution.movementId !== valuation.movementId
    || resolution.valuationEntryId !== valuation.valuationEntryId
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "inventoryByLine.resolution",
    );
  }

  return resolution;
}

function componentsForLine(
  valuation: SalesResolvedValuationLineage,
  cogs: SalesCogsAccountResolution,
  inventory: SalesInventoryAccountResolution,
): readonly SalesCostPostingComponent[] {
  const amount = absoluteOutboundCost(
    valuation.totalCost,
    "valuation.totalCost",
  );

  if (amount === 0) return Object.freeze([]);

  const base = {
    amount,
    currency: valuation.currency,
    salesLineId: valuation.salesLineId,
    productId: valuation.productId,
    movementId: valuation.movementId,
    valuationEntryId: valuation.valuationEntryId,
    valuationMethod: valuation.method,
    valuationRevision: valuation.revision,
  } as const;

  return Object.freeze([
    Object.freeze({
      componentId: `cost:cogs:${valuation.salesLineId}`,
      role: "cogs" as const,
      side: "debit" as const,
      accountId: cogs.account.accountId,
      ...base,
    }),
    Object.freeze({
      componentId: `cost:inventory-relief:${valuation.salesLineId}`,
      role: "inventory-asset" as const,
      side: "credit" as const,
      accountId: inventory.account.accountId,
      ...base,
    }),
  ]);
}

export function calculateSalesCostPosting(
  input: CalculateSalesCostPostingInput,
): SalesCostPostingCalculation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return fail(SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid, "input");
  }

  const valuation = input.valuation;
  if (
    !valuation
    || typeof valuation !== "object"
    || valuation.ready !== true
    || !Array.isArray(valuation.lines)
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid,
      "valuation",
    );
  }

  if (valuation.lines.length === 0) {
    if (input.cogsByLine.length !== 0 || input.inventoryByLine.length !== 0) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        "resolutions",
      );
    }
    return Object.freeze({
      currency: null,
      totalDebit: 0,
      totalCredit: 0,
      balanced: true,
      components: Object.freeze([]),
    });
  }

  const currencies = new Set(valuation.lines.map((line) => line.currency));
  if (currencies.size !== 1) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.costPostingInvalid,
      "valuation.currency",
    );
  }

  const cogsMap = resolutionMap(input.cogsByLine, "cogsByLine");
  const inventoryMap = resolutionMap(input.inventoryByLine, "inventoryByLine");

  if (
    cogsMap.size !== valuation.lines.length
    || inventoryMap.size !== valuation.lines.length
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
      "resolutions",
    );
  }

  const components: SalesCostPostingComponent[] = [];
  for (const line of valuation.lines) {
    const cogs = assertCogsResolution(line, cogsMap.get(line.salesLineId));
    const inventory = assertInventoryResolution(
      line,
      inventoryMap.get(line.salesLineId),
    );

    if (
      cogs.account.companyId !== valuation.companyId
      || inventory.account.companyId !== valuation.companyId
    ) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        "account.companyId",
      );
    }

    components.push(...componentsForLine(line, cogs, inventory));
  }

  for (const lineId of cogsMap.keys()) {
    if (!valuation.lines.some((line) => line.salesLineId === lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        "cogsByLine.lineId",
      );
    }
  }
  for (const lineId of inventoryMap.keys()) {
    if (!valuation.lines.some((line) => line.salesLineId === lineId)) {
      return fail(
        SALES_POSTING_DOMAIN_ERROR_CODES.accountResolutionMismatch,
        "inventoryByLine.lineId",
      );
    }
  }

  const totalDebit = sumMoney(
    components
      .filter((component) => component.side === "debit")
      .map((component) => component.amount),
    "totalDebit",
  );
  const totalCredit = sumMoney(
    components
      .filter((component) => component.side === "credit")
      .map((component) => component.amount),
    "totalCredit",
  );

  const expectedCost = sumMoney(
    valuation.lines.map((line) =>
      absoluteOutboundCost(line.totalCost, "valuation.totalCost")
    ),
    "expectedCost",
  );

  if (
    totalDebit !== totalCredit
    || totalDebit !== expectedCost
    || totalCredit !== expectedCost
  ) {
    return fail(
      SALES_POSTING_DOMAIN_ERROR_CODES.costPostingUnbalanced,
      "components",
    );
  }

  return Object.freeze({
    currency: valuation.lines[0]!.currency,
    totalDebit,
    totalCredit,
    balanced: true,
    components: Object.freeze(components),
  });
}
