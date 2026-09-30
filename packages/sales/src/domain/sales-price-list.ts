import { SALES_DOMAIN_ERROR_CODES, SalesDomainError } from "./sales-domain-errors.ts";

export const SALES_PRICE_LIST_KINDS = Object.freeze(["base", "wholesale", "customer", "segment"] as const);
export type SalesPriceListKind = (typeof SALES_PRICE_LIST_KINDS)[number];

export interface SalesPriceListItem {
  readonly priceListItemId: string;
  readonly productId: string;
  readonly unitPrice: number;
}

export interface CreateSalesPriceListItemInput {
  readonly priceListItemId: string;
  readonly productId: string;
  readonly unitPrice: number;
}

export interface SalesPriceList {
  readonly priceListId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: SalesPriceListKind;
  readonly isActive: boolean;
  readonly items: readonly SalesPriceListItem[];
}

export interface CreateSalesPriceListInput {
  readonly priceListId: string;
  readonly companyId: string;
  readonly code: string;
  readonly name: string;
  readonly kind: SalesPriceListKind;
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
  if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) {
    return fail(SALES_DOMAIN_ERROR_CODES.priceInvalid, "priceList.items.unitPrice");
  }
  return Object.freeze({
    priceListItemId: required(input.priceListItemId, "priceList.items.priceListItemId"),
    productId: required(input.productId, "priceList.items.productId"),
    unitPrice: input.unitPrice,
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
    isActive: input.isActive ?? true,
    items: Object.freeze(items),
  });
}
