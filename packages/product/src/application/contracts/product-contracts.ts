import type {
  CreateProductCommand,
  ReplaceProductIdentifiersCommand,
  ReplaceProductMasterDataCommand,
  ReplaceProductUnitsCommand,
  SetProductStatusCommand,
  UpdateProductIdentityCommand,
} from "./product-commands.ts";
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

export interface ProductApplicationContract {
  create(command: CreateProductCommand): Promise<ProductDto>;
  updateIdentity(command: UpdateProductIdentityCommand): Promise<ProductDto>;
  replaceIdentifiers(command: ReplaceProductIdentifiersCommand): Promise<ProductDto>;
  replaceUnits(command: ReplaceProductUnitsCommand): Promise<ProductDto>;
  replaceMasterData(command: ReplaceProductMasterDataCommand): Promise<ProductDto>;
  setStatus(command: SetProductStatusCommand): Promise<ProductDto>;

  getById(query: GetProductByIdQuery): Promise<ProductDto | null>;
  getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null>;
  list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>>;
  select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]>;
}
