import type {
  ProductCapabilities,
  ProductKind,
} from "../../domain/product.ts";
import type { CreateProductIdentifierProfileInput } from "../../domain/product-identifiers.ts";
import type { CreateProductMasterDataProfileInput } from "../../domain/product-master-data.ts";
import type { CreateProductUnitProfileInput } from "../../domain/product-unit.ts";

export interface ProductRequestContext {
  readonly requestId: string;
  readonly actorId: string;
  readonly companyId: string;
  readonly occurredAt: string;
}

export interface CreateProductCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly code: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly categoryId?: string | null;
  readonly capabilities?: ProductCapabilities;
  readonly identifiers?: CreateProductIdentifierProfileInput;
  readonly units?: CreateProductUnitProfileInput | null;
  readonly masterData?: Omit<CreateProductMasterDataProfileInput, "kind">;
}

export interface UpdateProductIdentityCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly expectedVersion: number;
  readonly code: string;
  readonly title: string;
  readonly categoryId: string | null;
  readonly capabilities: ProductCapabilities;
}

export interface ReplaceProductIdentifiersCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly expectedVersion: number;
  readonly identifiers: CreateProductIdentifierProfileInput;
}

export interface ReplaceProductUnitsCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly expectedVersion: number;
  readonly units: CreateProductUnitProfileInput | null;
}

export interface ReplaceProductMasterDataCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly expectedVersion: number;
  readonly masterData: Omit<CreateProductMasterDataProfileInput, "kind">;
}

export interface SetProductStatusCommand {
  readonly context: ProductRequestContext;
  readonly productId: string;
  readonly expectedVersion: number;
  readonly active: boolean;
}
