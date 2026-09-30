import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";
import { createSalesPriceRevision, type CreateSalesPriceRevisionInput, type SalesPriceRevision } from "./sales-price-revision.ts";
import { createSalesPriceListTarget, type SalesPriceListTarget } from "./sales-price-target.ts";

export const SALES_PRICE_LIST_KINDS = Object.freeze(["base", "wholesale", "customer", "segment"] as const);
export type SalesPriceListKind = (typeof SALES_PRICE_LIST_KINDS)[number];

export interface SalesPriceListItem {
  readonly priceListItemId: string;
  readonly productId: string;
  readonly revisions: readonly SalesPriceRevision[];
}

export interface CreateSalesPriceListItemInput {
  readonly priceListItemId: string;
  readonly productId: string;
  readonly revisions: readonly CreateSalesPriceRevisionInput[];
}

export interface SalesPriceList {
  readonly priceListId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: SalesPriceListKind;
  readonly target: SalesPriceListTarget;
  readonly isActive: boolean;
  readonly items: readonly SalesPriceListItem[];
}

export interface CreateSalesPriceListInput {
  readonly priceListId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: SalesPriceListKind;
  readonly target?: { readonly customerPartyId?: string | null; readonly customerSegmentId?: string | null };
  readonly isActive?: boolean;
  readonly items?: readonly CreateSalesPriceListItemInput[];
}

const fail = (code: keyof typeof SALES_DOMAIN_ERROR_CODES extends never ? never : (typeof SALES_DOMAIN_ERROR_CODES)[keyof typeof SALES_DOMAIN_ERROR_CODES], field: string): never => {
  throw new SalesDomainError(code, field);
};

function required(value: string, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) return fail(SALES_DOMAIN_ERROR_CODES.identityRequired, field);
  return value.trim();
}

export function createSalesPriceListItem(input: CreateSalesPriceListItemInput): SalesPriceListItem {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "priceListItem");
  if (!Array.isArray(input.revisions) || input.revisions.length === 0) return fail(SALES_DOMAIN_ERROR_CODES.priceRevisionInvalid, "priceList.items.revisions");
  const revisions = input.revisions.map(createSalesPriceRevision).sort((a, b) => a.revision - b.revision);
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const revision of revisions) {
    if (ids.has(revision.priceRevisionId) || numbers.has(revision.revision)) return fail(SALES_DOMAIN_ERROR_CODES.duplicatePriceRevision, "priceList.items.revisions");
    ids.add(revision.priceRevisionId); numbers.add(revision.revision);
  }
  for (let i = 1; i < revisions.length; i++) {
    const previous = revisions[i - 1]!;
    const current = revisions[i]!;
    if (previous.effectiveTo === null || current.effectiveFrom <= previous.effectiveTo) return fail(SALES_DOMAIN_ERROR_CODES.priceRevisionOverlap, "priceList.items.revisions");
  }
  return Object.freeze({
    priceListItemId: required(input.priceListItemId, "priceList.items.priceListItemId"),
    productId: required(input.productId, "priceList.items.productId"),
    revisions: Object.freeze(revisions),
  });
}

export function createSalesPriceList(input: CreateSalesPriceListInput): SalesPriceList {
  if (typeof input !== "object" || input === null) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "priceList");
  if (!SALES_PRICE_LIST_KINDS.includes(input.kind)) return fail(SALES_DOMAIN_ERROR_CODES.priceListKindInvalid, "priceList.kind");
  const rawItems = input.items ?? [];
  if (!Array.isArray(rawItems)) return fail(SALES_DOMAIN_ERROR_CODES.inputInvalid, "priceList.items");
  const itemIds = new Set<string>();
  const productIds = new Set<string>();
  const items = rawItems.map((raw) => {
    const item = createSalesPriceListItem(raw);
    if (itemIds.has(item.priceListItemId)) return fail(SALES_DOMAIN_ERROR_CODES.duplicatePriceListItemId, "priceList.items.priceListItemId");
    if (productIds.has(item.productId)) return fail(SALES_DOMAIN_ERROR_CODES.duplicatePriceListProduct, "priceList.items.productId");
    itemIds.add(item.priceListItemId);
    productIds.add(item.productId);
    return item;
  });
  return Object.freeze({
    priceListId: required(input.priceListId, "priceList.priceListId"),
    companyId: required(input.companyId, "priceList.companyId"),
    code: required(input.code, "priceList.code"),
    name: required(input.name, "priceList.name"),
    kind: input.kind,
    target: createSalesPriceListTarget(input.kind, input.target),
    isActive: input.isActive ?? true,
    items: Object.freeze(items),
  });
}
