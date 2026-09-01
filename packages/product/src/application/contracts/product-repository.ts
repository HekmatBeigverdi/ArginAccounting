import type { ProductSnapshot } from "../../domain/product.ts";
import type { ProductIdentifierProfile } from "../../domain/product-identifiers.ts";
import type { ProductMasterDataProfile } from "../../domain/product-master-data.ts";
import type { ProductUnitProfile } from "../../domain/product-unit.ts";

export interface ProductPersistenceState {
  readonly product: ProductSnapshot;
  readonly identifiers: Readonly<ProductIdentifierProfile>;
  readonly units: Readonly<ProductUnitProfile> | null;
  readonly masterData: Readonly<ProductMasterDataProfile>;
  readonly version: number;
}

export interface ProductRepository {
  findById(companyId: string, productId: string): Promise<ProductPersistenceState | null>;
  findByCode(companyId: string, code: string): Promise<ProductPersistenceState | null>;
  add(state: ProductPersistenceState): Promise<void>;
  update(state: ProductPersistenceState, expectedVersion: number): Promise<void>;
}
