import type { ProductIdentifierProfile } from "../../domain/product-identifiers.ts";

export type ProductDuplicateReason =
  | "code"
  | "sku"
  | "reference-code"
  | "barcode"
  | "taxpayer-goods-service-id"
  | "external-identifier"
  | "title"
  | "brand-model";

export type ProductDuplicateStrength = "hard" | "advisory";

export interface ProductDuplicateCandidate {
  readonly productId: string;
  readonly code: string;
  readonly title: string;
  readonly reason: ProductDuplicateReason;
  readonly strength: ProductDuplicateStrength;
}

export interface ProductDuplicateProbe {
  readonly companyId: string;
  readonly excludeProductId?: string | null;
  readonly code: string;
  readonly title: string;
  readonly identifiers: Readonly<ProductIdentifierProfile>;
  readonly brand: string | null;
  readonly model: string | null;
}

export interface ProductDuplicateDetector {
  detect(probe: ProductDuplicateProbe): Promise<readonly ProductDuplicateCandidate[]>;
}

export interface ProductDuplicateCheckResult {
  readonly hardConflicts: readonly ProductDuplicateCandidate[];
  readonly advisoryCandidates: readonly ProductDuplicateCandidate[];
}

export interface ProductIdempotencyExecutor {
  run<T>(scope: string, requestId: string, operation: () => Promise<T>): Promise<T>;
}
