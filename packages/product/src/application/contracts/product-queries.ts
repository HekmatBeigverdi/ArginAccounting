import type {
  ProductKind,
  ProductStatus,
} from "../../domain/product.ts";

export const PRODUCT_QUERY_LIMITS = Object.freeze({
  minPageSize: 1,
  maxPageSize: 200,
  defaultPageSize: 50,
  minSelectorLimit: 1,
  maxSelectorLimit: 100,
  defaultSelectorLimit: 20,
});

export type ProductSortField =
  | "code"
  | "title"
  | "kind"
  | "status"
  | "createdAt"
  | "updatedAt";

export type ProductSortDirection = "asc" | "desc";

export interface ProductPageRequest {
  readonly page: number;
  readonly pageSize: number;
}

export interface ProductSort {
  readonly field: ProductSortField;
  readonly direction: ProductSortDirection;
}

export interface ProductFilter {
  readonly companyId: string;
  readonly search?: string | null;
  readonly kinds?: readonly ProductKind[];
  readonly statuses?: readonly ProductStatus[];
  readonly categoryIds?: readonly string[];
  readonly purchasable?: boolean;
  readonly sellable?: boolean;
  readonly stockTracking?: boolean;
  readonly taxpayerGoodsServiceId?: string | null;
  readonly barcode?: string | null;
  readonly sku?: string | null;
  readonly requiresTaxpayerGoodsServiceId?: boolean;
}

export interface ListProductsQuery {
  readonly filter: ProductFilter;
  readonly page: ProductPageRequest;
  readonly sort?: ProductSort;
}

export interface GetProductByIdQuery {
  readonly companyId: string;
  readonly productId: string;
}

export interface GetProductByCodeQuery {
  readonly companyId: string;
  readonly code: string;
}

export interface ProductSelectorQuery {
  readonly companyId: string;
  readonly search?: string | null;
  readonly kinds?: readonly ProductKind[];
  readonly statuses?: readonly ProductStatus[];
  readonly categoryIds?: readonly string[];
  readonly purchasable?: boolean;
  readonly sellable?: boolean;
  readonly stockTracking?: boolean;
  readonly requiresTaxpayerGoodsServiceId?: boolean;
  readonly limit: number;
}
