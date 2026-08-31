import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_APPLICATION_ERROR_CODES,
  ProductApplicationError,
  SecuredProductReader,
  SecuredProductService,
  productCorrelationId,
  productPermissions,
  type ProductAuditEvent,
  type ProductAuditSink,
  type ProductAuthorizationContext,
  type ProductAuthorizationPolicy,
  type ProductDto,
  type ProductPermission,
} from "../src/index.ts";
import type { ProductService } from "../src/application/product-service.ts";

const context = Object.freeze({
  requestId: "request-12",
  correlationId: "correlation-12",
  actorId: "user-1",
  companyId: "company-1",
  occurredAt: "2026-08-31T13:30:00.000Z",
});

const dto = Object.freeze({
  productId: "product-1",
  companyId: "company-1",
  code: "P-001",
  title: "Product",
  kind: "product",
  status: "active",
  version: 2,
}) as unknown as ProductDto;

class AllowAuthorization implements ProductAuthorizationPolicy {
  readonly calls: Array<{ context: ProductAuthorizationContext; permission: ProductPermission }> = [];

  async require(authContext: ProductAuthorizationContext, permission: ProductPermission): Promise<void> {
    this.calls.push({ context: authContext, permission });
  }
}

class DenyAuthorization implements ProductAuthorizationPolicy {
  async require(): Promise<void> {
    throw new Error("denied");
  }
}

class CaptureAudit implements ProductAuditSink {
  readonly events: ProductAuditEvent[] = [];

  async record(event: ProductAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

test("product security defines granular master-data permissions", () => {
  assert.equal(productPermissions.view, "master-data.products.view");
  assert.equal(productPermissions.manageIdentifiers, "master-data.products.manage-identifiers");
  assert.equal(productPermissions.manageUnits, "master-data.products.manage-units");
  assert.equal(productPermissions.manageTaxpayerReferenceData, "master-data.products.manage-taxpayer-reference-data");
});

test("correlation id falls back to request id for backward-compatible contexts", () => {
  assert.equal(productCorrelationId(context), "correlation-12");
  assert.equal(productCorrelationId({ ...context, correlationId: null }), "request-12");
});

test("secured mutation checks permission before write and records successful audit", async () => {
  let createCalls = 0;
  const inner = {
    async create(): Promise<ProductDto> {
      createCalls += 1;
      return dto;
    },
  } as unknown as ProductService;
  const authorization = new AllowAuthorization();
  const audit = new CaptureAudit();
  const secured = new SecuredProductService(inner, authorization, audit);

  await secured.create({
    context,
    productId: "product-1",
    code: "P-001",
    title: "Product",
    kind: "product",
  });

  assert.equal(createCalls, 1);
  assert.equal(authorization.calls[0]?.permission, productPermissions.create);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.action, "product.create");
  assert.equal(audit.events[0]?.correlationId, "correlation-12");
  assert.equal(audit.events[0]?.requestId, "request-12");
  assert.equal(audit.events[0]?.productId, "product-1");
});

test("denied mutation never reaches inner service or audit", async () => {
  let createCalls = 0;
  const inner = {
    async create(): Promise<ProductDto> {
      createCalls += 1;
      return dto;
    },
  } as unknown as ProductService;
  const audit = new CaptureAudit();
  const secured = new SecuredProductService(inner, new DenyAuthorization(), audit);

  await assert.rejects(
    () => secured.create({
      context,
      productId: "product-1",
      code: "P-001",
      title: "Product",
      kind: "product",
    }),
    (error: unknown) =>
      error instanceof ProductApplicationError
      && error.code === PRODUCT_APPLICATION_ERROR_CODES.unauthorized,
  );

  assert.equal(createCalls, 0);
  assert.equal(audit.events.length, 0);
});

test("status no-op does not emit an audit mutation", async () => {
  const inner = {
    async setStatus(): Promise<ProductDto> {
      return { ...dto, version: 2 } as ProductDto;
    },
  } as unknown as ProductService;
  const audit = new CaptureAudit();
  const secured = new SecuredProductService(inner, new AllowAuthorization(), audit);

  await secured.setStatus({
    context,
    productId: "product-1",
    expectedVersion: 2,
    active: true,
  });

  assert.equal(audit.events.length, 0);
});

test("secured reader enforces view permission with company scope", async () => {
  const authorization = new AllowAuthorization();
  const inner = {
    async getById(): Promise<ProductDto | null> {
      return dto;
    },
    async getByCode(): Promise<ProductDto | null> {
      return dto;
    },
    async list() {
      return { items: [], page: 1, pageSize: 50, totalItems: 0, totalPages: 0 };
    },
    async select() {
      return [];
    },
  };
  const reader = new SecuredProductReader(inner, authorization, {
    actorId: "user-1",
    correlationId: "correlation-read",
    requestId: "request-read",
  });

  await reader.getById({ companyId: "company-1", productId: "product-1" });

  assert.equal(authorization.calls.length, 1);
  assert.equal(authorization.calls[0]?.permission, productPermissions.view);
  assert.equal(authorization.calls[0]?.context.companyId, "company-1");
});
