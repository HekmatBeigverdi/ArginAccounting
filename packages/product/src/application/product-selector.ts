import type {
  ProductSelectorItemDto,
} from "./contracts/product-dto.ts";
import type {
  ProductReader,
} from "./contracts/product-reader.ts";
import {
  PRODUCT_QUERY_LIMITS,
  type ProductSelectorQuery,
} from "./contracts/product-queries.ts";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "./contracts/product-errors.ts";
import type {
  ProductKind,
  ProductStatus,
} from "../domain/product.ts";

export const productSelectorUsages = [
  "general",
  "inventory",
  "purchase",
  "sales",
  "taxpayer",
  "manufacturing",
  "cost-accounting",
] as const;

export type ProductSelectorUsage = typeof productSelectorUsages[number];

export interface ProductSelectorRequest {
  readonly companyId: string;
  readonly usage: ProductSelectorUsage;
  readonly search?: string | null;
  readonly kinds?: readonly ProductKind[];
  readonly statuses?: readonly ProductStatus[];
  readonly categoryIds?: readonly string[];
  readonly limit?: number;
}

export interface ProductSelectorOption extends ProductSelectorItemDto {
  readonly durableId: string;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
      `${label} is required.`,
    );
  }
  return normalized;
}

function normalizeLimit(limit: number | undefined): number {
  const value = limit ?? PRODUCT_QUERY_LIMITS.defaultSelectorLimit;
  if (
    !Number.isSafeInteger(value)
    || value < PRODUCT_QUERY_LIMITS.minSelectorLimit
    || value > PRODUCT_QUERY_LIMITS.maxSelectorLimit
  ) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
      `Selector limit must be between ${PRODUCT_QUERY_LIMITS.minSelectorLimit} and ${PRODUCT_QUERY_LIMITS.maxSelectorLimit}.`,
    );
  }
  return value;
}

function usageDefaults(usage: ProductSelectorUsage): Pick<
  ProductSelectorQuery,
  "statuses" | "kinds" | "purchasable" | "sellable" | "stockTracking" | "requiresTaxpayerGoodsServiceId"
> {
  switch (usage) {
    case "inventory":
      return {
        statuses: ["active"],
        kinds: ["product"],
        stockTracking: true,
      };
    case "purchase":
      return {
        statuses: ["active"],
        purchasable: true,
      };
    case "sales":
      return {
        statuses: ["active"],
        sellable: true,
      };
    case "taxpayer":
      return {
        statuses: ["active"],
        requiresTaxpayerGoodsServiceId: true,
      };
    case "manufacturing":
      return {
        statuses: ["active"],
        kinds: ["product"],
      };
    case "cost-accounting":
      return {
        statuses: ["active"],
        kinds: ["product"],
      };
    case "general":
      return {
        statuses: ["active"],
      };
  }
}

function intersect<T extends string>(
  required: readonly T[] | undefined,
  requested: readonly T[] | undefined,
): readonly T[] | undefined {
  if (!required) return requested;
  if (!requested) return required;
  const requestedSet = new Set(requested);
  return required.filter((value) => requestedSet.has(value));
}

export function createProductSelectorQuery(
  request: ProductSelectorRequest,
): ProductSelectorQuery {
  const companyId = requiredText(request.companyId, "companyId");
  if (!productSelectorUsages.includes(request.usage)) {
    throw new ProductApplicationError(
      PRODUCT_APPLICATION_ERROR_CODES.invalidRequest,
      "Product selector usage is invalid.",
    );
  }

  const defaults = usageDefaults(request.usage);
  const kinds = intersect(defaults.kinds, request.kinds);
  const statuses = intersect(defaults.statuses, request.statuses);

  if (kinds?.length === 0 || statuses?.length === 0) {
    return {
      companyId,
      search: request.search?.trim() || null,
      kinds: [],
      statuses: [],
      limit: normalizeLimit(request.limit),
      impossible: true,
    };
  }

  return {
    companyId,
    search: request.search?.trim() || null,
    ...(kinds === undefined ? {} : { kinds }),
    ...(statuses === undefined ? {} : { statuses }),
    ...(request.categoryIds === undefined ? {} : {
      categoryIds: request.categoryIds.map((value) => requiredText(value, "categoryId")),
    }),
    ...(defaults.purchasable === undefined ? {} : { purchasable: defaults.purchasable }),
    ...(defaults.sellable === undefined ? {} : { sellable: defaults.sellable }),
    ...(defaults.stockTracking === undefined ? {} : { stockTracking: defaults.stockTracking }),
    ...(defaults.requiresTaxpayerGoodsServiceId === undefined ? {} : {
      requiresTaxpayerGoodsServiceId: defaults.requiresTaxpayerGoodsServiceId,
    }),
    limit: normalizeLimit(request.limit),
  };
}

export class ProductSelectorService {
  constructor(private readonly reader: Pick<ProductReader, "select">) {}

  async search(request: ProductSelectorRequest): Promise<readonly ProductSelectorOption[]> {
    const query = createProductSelectorQuery(request);
    if (query.impossible) return Object.freeze([]);

    const items = await this.reader.select(query);
    return Object.freeze(items.map((item) => Object.freeze({
      ...item,
      durableId: item.productId,
    })));
  }
}
