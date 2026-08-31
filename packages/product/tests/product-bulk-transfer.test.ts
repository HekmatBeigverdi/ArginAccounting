import assert from "node:assert/strict";
import test from "node:test";

import {
  ProductBulkTransferService,
  productPermissions,
  type ProductAuditEvent,
  type ProductAuditSink,
  type ProductAuthorizationContext,
  type ProductAuthorizationPolicy,
  type ProductBulkContext,
  type ProductBulkExportReader,
  type ProductDto,
  type ProductDuplicateCandidate,
  type ProductDuplicateDetector,
  type ProductDuplicateProbe,
  type ProductExportBatchSink,
  type ProductImportColumnMap,
  type ProductPermission,
  type ProductPersistenceState,
  type ProductRepository,
  type ProductUnitOfWork,
  type TaxpayerUnitReferenceValidator,
} from "../src/index.ts";

const context: ProductBulkContext = Object.freeze({
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-13",
  requestId: "req-13",
  occurredAt: "2026-08-31T14:00:00.000Z",
});

const mapping: ProductImportColumnMap = Object.freeze({
  kind: "نوع",
  code: "کد",
  title: "عنوان",
  sku: "SKU",
  barcodes: "بارکد",
  taxpayerGoodsServiceId: "شناسه مودیان",
  brand: "برند",
  model: "مدل",
});

class AllowAuthorization implements ProductAuthorizationPolicy {
  readonly permissions: ProductPermission[] = [];
  async require(_context: ProductAuthorizationContext, permission: ProductPermission): Promise<void> {
    this.permissions.push(permission);
  }
}

class CaptureAudit implements ProductAuditSink {
  readonly events: ProductAuditEvent[] = [];
  async record(event: ProductAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class MemoryRepository implements ProductRepository {
  readonly states: ProductPersistenceState[] = [];
  async findById(companyId: string, productId: string): Promise<ProductPersistenceState | null> {
    return this.states.find((state) =>
      state.product.companyId === companyId && state.product.productId === productId) ?? null;
  }
  async findByCode(companyId: string, code: string): Promise<ProductPersistenceState | null> {
    return this.states.find((state) =>
      state.product.companyId === companyId && state.product.code === code) ?? null;
  }
  async add(state: ProductPersistenceState): Promise<void> {
    this.states.push(state);
  }
  async update(): Promise<void> {
    throw new Error("not used");
  }
}

class MemoryUnitOfWork implements ProductUnitOfWork {
  readonly repository = new MemoryRepository();
  runs = 0;
  async run<T>(operation: (repositories: { products: ProductRepository }) => Promise<T>): Promise<T> {
    this.runs += 1;
    return operation({ products: this.repository });
  }
}

class ActiveTaxpayerUnits implements TaxpayerUnitReferenceValidator {
  async isActiveCode(): Promise<boolean> {
    return true;
  }
}

class NoDuplicates implements ProductDuplicateDetector {
  async detect(): Promise<readonly ProductDuplicateCandidate[]> {
    return [];
  }
}

class SequenceIds {
  private value = 0;
  nextId(): string {
    this.value += 1;
    return `product-import-${this.value}`;
  }
}

const emptyExportReader: ProductBulkExportReader = {
  async readPage(_companyId, page, pageSize) {
    return { items: [], page, pageSize, totalItems: 0, totalPages: 0 };
  },
};

function createService(
  duplicateDetector: ProductDuplicateDetector = new NoDuplicates(),
  exportReader: ProductBulkExportReader = emptyExportReader,
) {
  const unitOfWork = new MemoryUnitOfWork();
  const authorization = new AllowAuthorization();
  const audit = new CaptureAudit();
  const service = new ProductBulkTransferService(
    unitOfWork,
    duplicateDetector,
    new ActiveTaxpayerUnits(),
    exportReader,
    authorization,
    audit,
    new SequenceIds(),
  );
  return { service, unitOfWork, authorization, audit };
}

test("preview normalizes Persian Product rows through Domain rules", async () => {
  const { service, authorization } = createService();
  const preview = await service.previewImport([
    {
      "نوع": "کالا",
      "کد": " p-001 ",
      "عنوان": " کالای نمونه ",
      "SKU": " sku-01 ",
      "بارکد": " 6260001 ; 6260002 ",
      "شناسه مودیان": "2720000014385",
      "برند": " Argin ",
      "مدل": " A1 ",
    },
  ], mapping, context);

  assert.equal(preview.totalRows, 1);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.rows[0]?.code, "P-001");
  assert.equal(preview.rows[0]?.kind, "product");
  assert.equal(authorization.permissions[0], productPermissions.import);
});

test("hard duplicates invalidate import while advisory matches remain informational", async () => {
  const detector: ProductDuplicateDetector = {
    async detect(probe: ProductDuplicateProbe) {
      if (probe.code === "P-HARD") {
        return [{
          productId: "existing-hard",
          code: "P-HARD",
          title: "Existing",
          reason: "code",
          strength: "hard",
        }];
      }
      return [{
        productId: "existing-advisory",
        code: "OTHER",
        title: probe.title,
        reason: "title",
        strength: "advisory",
      }];
    },
  };
  const { service } = createService(detector);
  const preview = await service.previewImport([
    { "نوع": "product", "کد": "P-HARD", "عنوان": "Hard" },
    { "نوع": "product", "کد": "P-OK", "عنوان": "Similar" },
  ], mapping, context);

  assert.equal(preview.rows[0]?.valid, false);
  assert.deepEqual(preview.rows[0]?.hardDuplicateProductIds, ["existing-hard"]);
  assert.equal(preview.rows[1]?.valid, true);
  assert.deepEqual(preview.rows[1]?.advisoryDuplicateProductIds, ["existing-advisory"]);
});

test("atomic import performs no writes when the batch contains duplicate strong keys", async () => {
  const { service, unitOfWork, audit } = createService();
  const result = await service.import([
    { "نوع": "کالا", "کد": "P-001", "عنوان": "A", "بارکد": "6261" },
    { "نوع": "کالا", "کد": "P-002", "عنوان": "B", "بارکد": "6261" },
  ], mapping, context, { atomic: true });

  assert.equal(result.importedCount, 0);
  assert.equal(result.failedCount, 2);
  assert.equal(unitOfWork.runs, 0);
  assert.equal(unitOfWork.repository.states.length, 0);
  assert.equal(audit.events.length, 0);
});

test("valid atomic import writes all rows in one Unit of Work and records one audit event", async () => {
  const { service, unitOfWork, audit } = createService();
  const result = await service.import([
    { "نوع": "کالا", "کد": "P-001", "عنوان": "A" },
    { "نوع": "خدمت", "کد": "S-001", "عنوان": "Service" },
  ], mapping, context, { atomic: true });

  assert.equal(result.importedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.equal(unitOfWork.runs, 1);
  assert.equal(unitOfWork.repository.states.length, 2);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0]?.action, "product.import");
  assert.equal(audit.events[0]?.metadata.atomic, true);
});

test("export is permission-protected and writes bounded batches", async () => {
  const product = {
    productId: "product-1",
    companyId: "company-1",
    kind: "product",
    code: "P-001",
    title: "Product",
    status: "active",
    categoryId: null,
    capabilities: { purchasable: true, sellable: true },
    identifiers: {
      sku: null,
      referenceCode: null,
      barcodes: [],
      taxpayerGoodsServiceId: null,
      externalIdentifiers: [],
    },
    units: null,
    masterData: {
      commercial: {
        brand: null,
        model: null,
        purchaseDescription: null,
        salesDescription: null,
        defaultPurchaseUnitId: null,
        defaultSalesUnitId: null,
      },
      tax: { treatment: "unspecified", vatRateBasisPoints: null },
      operational: {
        stockTracking: false,
        serialTracking: false,
        lotTracking: false,
        shelfLifeDays: null,
      },
    },
    version: 1,
    createdAt: context.occurredAt,
    updatedAt: context.occurredAt,
  } as ProductDto;
  const reader: ProductBulkExportReader = {
    async readPage(_companyId, page, pageSize) {
      return page === 1
        ? { items: [product], page, pageSize, totalItems: 1, totalPages: 1 }
        : { items: [], page, pageSize, totalItems: 1, totalPages: 1 };
    },
  };
  const { service, authorization, audit } = createService(new NoDuplicates(), reader);
  const batches: ProductDto[][] = [];
  const sink: ProductExportBatchSink = {
    async write(rows) {
      batches.push(rows as unknown as ProductDto[]);
    },
  };

  const count = await service.export(context, sink, 50);

  assert.equal(count, 1);
  assert.equal(batches.length, 1);
  assert.equal(authorization.permissions[0], productPermissions.export);
  assert.equal(audit.events[0]?.action, "product.export");
});
