import type {
  ProductCapabilities,
  ProductKind,
  ProductStatus,
} from "../../domain/product.ts";
import type { ProductIdentifierProfile } from "../../domain/product-identifiers.ts";
import type { ProductMasterDataProfile } from "../../domain/product-master-data.ts";
import type { ProductUnitProfile } from "../../domain/product-unit.ts";

export interface ProductDto {
  readonly productId: string;
  readonly companyId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly categoryId: string | null;
  readonly capabilities: Readonly<ProductCapabilities>;
  readonly identifiers: Readonly<ProductIdentifierProfile>;
  readonly units: Readonly<ProductUnitProfile> | null;
  readonly masterData: Readonly<ProductMasterDataProfile>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductListItemDto {
  readonly productId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly categoryId: string | null;
  readonly purchasable: boolean;
  readonly sellable: boolean;
  readonly sku: string | null;
  readonly taxpayerGoodsServiceId: string | null;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ProductSelectorItemDto {
  readonly productId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly status: ProductStatus;
  readonly purchasable: boolean;
  readonly sellable: boolean;
  readonly defaultPurchaseUnitId: string | null;
  readonly defaultSalesUnitId: string | null;
  readonly taxpayerGoodsServiceId: string | null;
}

export interface ProductPageDto<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}
