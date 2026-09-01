import type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "./product-dto.ts";
import type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductSelectorQuery,
} from "./product-queries.ts";

export interface ProductReader {
  getById(query: GetProductByIdQuery): Promise<ProductDto | null>;
  getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null>;
  list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>>;
  select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]>;
}
