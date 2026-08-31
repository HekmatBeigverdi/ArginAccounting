import type {
  CreateProductCommand,
  ProductRequestContext,
  ReplaceProductIdentifiersCommand,
  ReplaceProductMasterDataCommand,
  ReplaceProductUnitsCommand,
  SetProductStatusCommand,
  UpdateProductIdentityCommand,
} from "./contracts/product-commands.ts";
import type { ProductApplicationContract } from "./contracts/product-contracts.ts";
import type {
  ProductDto,
  ProductListItemDto,
  ProductPageDto,
  ProductSelectorItemDto,
} from "./contracts/product-dto.ts";
import type {
  GetProductByCodeQuery,
  GetProductByIdQuery,
  ListProductsQuery,
  ProductSelectorQuery,
} from "./contracts/product-queries.ts";
import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
} from "./contracts/product-errors.ts";
import type {
  ProductAuditAction,
  ProductAuditSink,
  ProductAuthorizationPolicy,
  ProductPermission,
} from "./contracts/product-security.ts";
import {
  productCorrelationId,
  productPermissions,
} from "./contracts/product-security.ts";
import type {
  ProductDuplicateCheckResult,
  ProductDuplicateProbe,
} from "./contracts/product-duplicates.ts";
import { ProductService } from "./product-service.ts";

export interface ProductReadSecurityContext {
  readonly actorId: string;
  readonly correlationId: string;
  readonly requestId: string;
}

const normalizedOccurredAt = (value: string): string => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : value;
};

export class SecuredProductService {
  constructor(
    private readonly inner: ProductService,
    private readonly authorization: ProductAuthorizationPolicy,
    private readonly audit: ProductAuditSink,
  ) {}

  async checkDuplicates(
    context: ProductReadSecurityContext & { readonly companyId: string },
    probe: ProductDuplicateProbe,
  ): Promise<ProductDuplicateCheckResult> {
    await this.requireRead(context, context.companyId, productPermissions.view);
    if (probe.companyId !== context.companyId) {
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
    }
    return this.inner.checkDuplicates(probe);
  }

  async create(command: CreateProductCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.create);
    if (command.identifiers !== undefined) {
      await this.requireMutation(command.context, productPermissions.manageIdentifiers);
    }
    if (command.units != null) {
      await this.requireMutation(command.context, productPermissions.manageUnits);
    }
    if (command.masterData !== undefined) {
      await this.requireMutation(command.context, productPermissions.manageMasterData);
    }

    const result = await this.inner.create(command);
    await this.record("product.create", command.context, result.productId, {
      kind: result.kind,
      status: result.status,
      version: result.version,
    });
    return result;
  }

  async updateIdentity(command: UpdateProductIdentityCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.update);
    const result = await this.inner.updateIdentity(command);
    await this.record("product.update-identity", command.context, result.productId, {
      code: result.code,
      kind: result.kind,
      version: result.version,
    });
    return result;
  }

  async replaceIdentifiers(command: ReplaceProductIdentifiersCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.manageIdentifiers);
    const result = await this.inner.replaceIdentifiers(command);
    await this.record("product.replace-identifiers", command.context, result.productId, {
      barcodeCount: result.identifiers.barcodes.length,
      externalIdentifierCount: result.identifiers.externalIdentifiers.length,
      hasTaxpayerGoodsServiceId: result.identifiers.taxpayerGoodsServiceId !== null,
      version: result.version,
    });
    return result;
  }

  async replaceUnits(command: ReplaceProductUnitsCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.manageUnits);
    const result = await this.inner.replaceUnits(command);
    await this.record("product.replace-units", command.context, result.productId, {
      unitCount: result.units?.units.length ?? 0,
      version: result.version,
    });
    return result;
  }

  async replaceMasterData(command: ReplaceProductMasterDataCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.manageMasterData);
    const result = await this.inner.replaceMasterData(command);
    await this.record("product.replace-master-data", command.context, result.productId, {
      taxTreatment: result.masterData.tax.treatment,
      stockTracking: result.masterData.operational.stockTracking,
      version: result.version,
    });
    return result;
  }

  async setStatus(command: SetProductStatusCommand): Promise<ProductDto> {
    await this.requireMutation(command.context, productPermissions.changeStatus);
    const result = await this.inner.setStatus(command);
    if (result.version !== command.expectedVersion) {
      await this.record("product.change-status", command.context, result.productId, {
        status: result.status,
        version: result.version,
      });
    }
    return result;
  }

  private async requireMutation(
    context: ProductRequestContext,
    permission: ProductPermission,
  ): Promise<void> {
    try {
      await this.authorization.require({
        actorId: context.actorId,
        companyId: context.companyId,
        correlationId: productCorrelationId(context),
        requestId: context.requestId,
      }, permission);
    } catch (error) {
      if (error instanceof ProductApplicationError) {
        throw error;
      }
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
    }
  }

  private async requireRead(
    context: ProductReadSecurityContext,
    companyId: string,
    permission: ProductPermission,
  ): Promise<void> {
    try {
      await this.authorization.require({
        actorId: context.actorId,
        companyId,
        correlationId: context.correlationId,
        requestId: context.requestId,
      }, permission);
    } catch (error) {
      if (error instanceof ProductApplicationError) {
        throw error;
      }
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
    }
  }

  private async record(
    action: ProductAuditAction,
    context: ProductRequestContext,
    productId: string,
    metadata: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void> {
    await this.audit.record(Object.freeze({
      action,
      actorId: context.actorId,
      companyId: context.companyId,
      productId,
      correlationId: productCorrelationId(context),
      requestId: context.requestId,
      occurredAt: normalizedOccurredAt(context.occurredAt),
      metadata: Object.freeze({ ...metadata }),
    }));
  }
}

export class SecuredProductReader {
  constructor(
    private readonly inner: Pick<
      ProductApplicationContract,
      "getById" | "getByCode" | "list" | "select"
    >,
    private readonly authorization: ProductAuthorizationPolicy,
    private readonly context: ProductReadSecurityContext,
  ) {}

  async getById(query: GetProductByIdQuery): Promise<ProductDto | null> {
    await this.require(query.companyId);
    return this.inner.getById(query);
  }

  async getByCode(query: GetProductByCodeQuery): Promise<ProductDto | null> {
    await this.require(query.companyId);
    return this.inner.getByCode(query);
  }

  async list(query: ListProductsQuery): Promise<ProductPageDto<ProductListItemDto>> {
    await this.require(query.filter.companyId);
    return this.inner.list(query);
  }

  async select(query: ProductSelectorQuery): Promise<readonly ProductSelectorItemDto[]> {
    await this.require(query.companyId);
    return this.inner.select(query);
  }

  private async require(companyId: string): Promise<void> {
    try {
      await this.authorization.require({
        actorId: this.context.actorId,
        companyId,
        correlationId: this.context.correlationId,
        requestId: this.context.requestId,
      }, productPermissions.view);
    } catch (error) {
      if (error instanceof ProductApplicationError) {
        throw error;
      }
      throw new ProductApplicationError(PRODUCT_APPLICATION_ERROR_CODES.unauthorized);
    }
  }
}
