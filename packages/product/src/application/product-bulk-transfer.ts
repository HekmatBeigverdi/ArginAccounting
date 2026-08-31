import {
  createProduct,
  type ProductKind,
} from "../domain/product.ts";
import {
  createProductIdentifierProfile,
  type ProductExternalIdentifier,
  type ProductIdentifierProfile,
} from "../domain/product-identifiers.ts";
import {
  createProductMasterDataProfile,
  type ProductMasterDataProfile,
  type ProductTaxTreatment,
} from "../domain/product-master-data.ts";
import {
  createProductUnitProfile,
  type ProductUnitDefinition,
  type ProductUnitProfile,
  type QuantityRoundingMode,
} from "../domain/product-unit.ts";
import type {
  ProductDto,
  ProductPageDto,
} from "./contracts/product-dto.ts";
import type {
  ProductDuplicateCandidate,
  ProductDuplicateDetector,
} from "./contracts/product-duplicates.ts";
import type {
  ProductPersistenceState,
} from "./contracts/product-repository.ts";
import type { TaxpayerUnitReferenceValidator } from "./contracts/product-reference-validation.ts";
import type { ProductUnitOfWork } from "./contracts/product-unit-of-work.ts";
import type {
  ProductAuditSink,
  ProductAuthorizationPolicy,
} from "./contracts/product-security.ts";
import {
  productPermissions,
} from "./contracts/product-security.ts";

export const productImportFields = [
  "kind",
  "code",
  "title",
  "categoryId",
  "purchasable",
  "sellable",
  "sku",
  "referenceCode",
  "barcodes",
  "taxpayerGoodsServiceId",
  "externalIdentifiers",
  "baseUnitId",
  "baseUnitCode",
  "baseUnitTitle",
  "baseUnitPrecision",
  "baseUnitRoundingMode",
  "baseTaxpayerUnitCode",
  "alternateUnits",
  "brand",
  "model",
  "purchaseDescription",
  "salesDescription",
  "defaultPurchaseUnitId",
  "defaultSalesUnitId",
  "taxTreatment",
  "vatRateBasisPoints",
  "stockTracking",
  "serialTracking",
  "lotTracking",
  "shelfLifeDays",
] as const;

export type ProductImportField = (typeof productImportFields)[number];
export type ProductImportColumnMap = Readonly<Partial<Record<ProductImportField, string>>>;
export type ProductTabularRow = Readonly<Record<string, string | null | undefined>>;

export interface ProductBulkContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly occurredAt: string;
}

export interface ProductImportIssue {
  readonly code: string;
  readonly message: string;
}

export interface ProductImportPreviewRow {
  readonly rowNumber: number;
  readonly code: string | null;
  readonly title: string | null;
  readonly kind: ProductKind | null;
  readonly valid: boolean;
  readonly issues: readonly ProductImportIssue[];
  readonly advisoryDuplicateProductIds: readonly string[];
  readonly hardDuplicateProductIds: readonly string[];
}

export interface ProductImportPreview {
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly rows: readonly ProductImportPreviewRow[];
}

export interface ProductImportResult {
  readonly importedCount: number;
  readonly failedCount: number;
  readonly atomic: boolean;
  readonly failures: readonly ProductImportPreviewRow[];
}

export interface ProductImportIdGenerator {
  nextId(): string;
}

export interface ProductExportRow {
  readonly productId: string;
  readonly kind: string;
  readonly code: string;
  readonly title: string;
  readonly status: string;
  readonly categoryId: string;
  readonly purchasable: string;
  readonly sellable: string;
  readonly sku: string;
  readonly referenceCode: string;
  readonly barcodes: string;
  readonly taxpayerGoodsServiceId: string;
  readonly externalIdentifiers: string;
  readonly baseUnitId: string;
  readonly baseUnitCode: string;
  readonly baseUnitTitle: string;
  readonly baseUnitPrecision: string;
  readonly baseUnitRoundingMode: string;
  readonly baseTaxpayerUnitCode: string;
  readonly alternateUnits: string;
  readonly brand: string;
  readonly model: string;
  readonly purchaseDescription: string;
  readonly salesDescription: string;
  readonly defaultPurchaseUnitId: string;
  readonly defaultSalesUnitId: string;
  readonly taxTreatment: string;
  readonly vatRateBasisPoints: string;
  readonly stockTracking: string;
  readonly serialTracking: string;
  readonly lotTracking: string;
  readonly shelfLifeDays: string;
  readonly version: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductExportBatchSink {
  write(rows: readonly ProductExportRow[]): Promise<void>;
}

export interface ProductBulkExportReader {
  readPage(
    companyId: string,
    page: number,
    pageSize: number,
  ): Promise<ProductPageDto<ProductDto>>;
}

interface PreparedRow {
  readonly rowNumber: number;
  readonly state: ProductPersistenceState;
  readonly preview: ProductImportPreviewRow;
}

const IMPORT_PAGE_LIMIT = 200;
const batchDuplicateIssue = Object.freeze({
  code: "product.import.batch-duplicate",
  message: "Duplicate Product code or strong identifier exists in the import batch.",
});

export class ProductBulkTransferService {
  constructor(
    private readonly unitOfWork: ProductUnitOfWork,
    private readonly duplicateDetector: ProductDuplicateDetector,
    private readonly taxpayerUnitReferences: TaxpayerUnitReferenceValidator,
    private readonly exportReader: ProductBulkExportReader,
    private readonly authorization: ProductAuthorizationPolicy,
    private readonly audit: ProductAuditSink,
    private readonly ids: ProductImportIdGenerator,
  ) {}

  async previewImport(
    rows: readonly ProductTabularRow[],
    mapping: ProductImportColumnMap,
    context: ProductBulkContext,
  ): Promise<ProductImportPreview> {
    await this.authorization.require(authContext(context), productPermissions.import);
    const prepared = await this.prepareRows(rows, mapping, context);
    return summarize(prepared.map((entry) => entry.preview));
  }

  async import(
    rows: readonly ProductTabularRow[],
    mapping: ProductImportColumnMap,
    context: ProductBulkContext,
    options: { readonly atomic: boolean },
  ): Promise<ProductImportResult> {
    await this.authorization.require(authContext(context), productPermissions.import);
    const prepared = await this.prepareRows(rows, mapping, context);
    const failures = prepared
      .filter((entry) => !entry.preview.valid)
      .map((entry) => entry.preview);

    if (options.atomic && failures.length > 0) {
      return Object.freeze({
        importedCount: 0,
        failedCount: failures.length,
        atomic: true,
        failures: Object.freeze(failures),
      });
    }

    const validRows = prepared.filter((entry) => entry.preview.valid);
    const result = options.atomic
      ? await this.importAtomically(validRows, context)
      : await this.importBestEffort(validRows, context);
    const allFailures = Object.freeze([...failures, ...result.failures]);

    if (result.importedCount > 0) {
      await this.audit.record(Object.freeze({
        action: "product.import",
        actorId: context.actorId,
        companyId: context.companyId,
        productId: null,
        correlationId: context.correlationId,
        requestId: context.requestId,
        occurredAt: context.occurredAt,
        metadata: Object.freeze({
          importedCount: result.importedCount,
          failedCount: allFailures.length,
          atomic: options.atomic,
        }),
      }));
    }

    return Object.freeze({
      importedCount: result.importedCount,
      failedCount: allFailures.length,
      atomic: options.atomic,
      failures: allFailures,
    });
  }

  async export(
    context: ProductBulkContext,
    sink: ProductExportBatchSink,
    pageSize = IMPORT_PAGE_LIMIT,
  ): Promise<number> {
    await this.authorization.require(authContext(context), productPermissions.export);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > IMPORT_PAGE_LIMIT) {
      throw new Error("product.export.page-size-invalid");
    }

    let page = 1;
    let exportedCount = 0;
    while (true) {
      const result = await this.exportReader.readPage(context.companyId, page, pageSize);
      if (result.items.length === 0) {
        break;
      }
      const batch = Object.freeze(result.items.map(toExportRow));
      await sink.write(batch);
      exportedCount += batch.length;
      if (page >= result.totalPages) {
        break;
      }
      page += 1;
    }

    await this.audit.record(Object.freeze({
      action: "product.export",
      actorId: context.actorId,
      companyId: context.companyId,
      productId: null,
      correlationId: context.correlationId,
      requestId: context.requestId,
      occurredAt: context.occurredAt,
      metadata: Object.freeze({ exportedCount, pageSize }),
    }));
    return exportedCount;
  }

  private async prepareRows(
    rows: readonly ProductTabularRow[],
    mapping: ProductImportColumnMap,
    context: ProductBulkContext,
  ): Promise<readonly PreparedRow[]> {
    const prepared = await Promise.all(
      rows.map((row, index) => this.prepareRow(row, index + 2, mapping, context)),
    );
    const duplicateRows = findBatchDuplicateRows(prepared);
    return Object.freeze(prepared.map((entry) =>
      duplicateRows.has(entry.rowNumber)
        ? withIssue(entry, batchDuplicateIssue.code, batchDuplicateIssue.message)
        : entry));
  }

  private async prepareRow(
    row: ProductTabularRow,
    rowNumber: number,
    mapping: ProductImportColumnMap,
    context: ProductBulkContext,
  ): Promise<PreparedRow> {
    try {
      const state = await mapRowToState(
        row,
        mapping,
        context,
        `preview-product-${rowNumber}`,
        this.taxpayerUnitReferences,
      );
      const candidates = await this.duplicateDetector.detect({
        companyId: context.companyId,
        code: state.product.code,
        title: state.product.title,
        identifiers: state.identifiers,
        brand: state.masterData.commercial.brand,
        model: state.masterData.commercial.model,
      });
      const hard = candidates.filter((candidate) => candidate.strength === "hard");
      const advisory = candidates.filter((candidate) => candidate.strength === "advisory");
      const issues = hard.length > 0
        ? [Object.freeze({
            code: "product.import.hard-duplicate",
            message: "A Product with the same code or strong identifier already exists.",
          })]
        : [];
      return Object.freeze({
        rowNumber,
        state,
        preview: Object.freeze({
          rowNumber,
          code: state.product.code,
          title: state.product.title,
          kind: state.product.kind,
          valid: issues.length === 0,
          issues: Object.freeze(issues),
          advisoryDuplicateProductIds: Object.freeze(uniqueProductIds(advisory)),
          hardDuplicateProductIds: Object.freeze(uniqueProductIds(hard)),
        }),
      });
    } catch (error) {
      const fallback = await fallbackState(context, rowNumber);
      const issue = Object.freeze({
        code: errorCode(error, "product.import.invalid-row"),
        message: error instanceof Error ? error.message : "Invalid Product import row.",
      });
      return Object.freeze({
        rowNumber,
        state: fallback,
        preview: Object.freeze({
          rowNumber,
          code: nullable(readMapped(row, mapping.code)),
          title: nullable(readMapped(row, mapping.title)),
          kind: null,
          valid: false,
          issues: Object.freeze([issue]),
          advisoryDuplicateProductIds: Object.freeze([]),
          hardDuplicateProductIds: Object.freeze([]),
        }),
      });
    }
  }

  private async importAtomically(
    rows: readonly PreparedRow[],
    context: ProductBulkContext,
  ): Promise<{ readonly importedCount: number; readonly failures: readonly ProductImportPreviewRow[] }> {
    let importedCount = 0;
    await this.unitOfWork.run(async ({ products }) => {
      for (const entry of rows) {
        const state = replaceProductId(entry.state, this.ids.nextId());
        if (await products.findByCode(context.companyId, state.product.code)) {
          throw new Error(`product.application.code-conflict:${state.product.code}`);
        }
        await products.add(state);
        importedCount += 1;
      }
    });
    return Object.freeze({ importedCount, failures: Object.freeze([]) });
  }

  private async importBestEffort(
    rows: readonly PreparedRow[],
    context: ProductBulkContext,
  ): Promise<{ readonly importedCount: number; readonly failures: readonly ProductImportPreviewRow[] }> {
    let importedCount = 0;
    const failures: ProductImportPreviewRow[] = [];
    for (const entry of rows) {
      try {
        await this.unitOfWork.run(async ({ products }) => {
          const state = replaceProductId(entry.state, this.ids.nextId());
          if (await products.findByCode(context.companyId, state.product.code)) {
            throw new Error("product.application.code-conflict");
          }
          await products.add(state);
        });
        importedCount += 1;
      } catch (error) {
        failures.push(withWriteFailure(entry.preview, error));
      }
    }
    return Object.freeze({ importedCount, failures: Object.freeze(failures) });
  }
}

async function mapRowToState(
  row: ProductTabularRow,
  mapping: ProductImportColumnMap,
  context: ProductBulkContext,
  productId: string,
  taxpayerUnits: TaxpayerUnitReferenceValidator,
): Promise<ProductPersistenceState> {
  const kind = parseKind(readMapped(row, mapping.kind));
  const capabilities = Object.freeze({
    purchasable: parseBoolean(readMapped(row, mapping.purchasable), true),
    sellable: parseBoolean(readMapped(row, mapping.sellable), true),
  });
  const product = createProduct({
    productId,
    companyId: context.companyId,
    code: readMapped(row, mapping.code),
    title: readMapped(row, mapping.title),
    kind,
    categoryId: nullable(readMapped(row, mapping.categoryId)),
    capabilities,
    createdAt: context.occurredAt,
  });

  const identifiers = createProductIdentifierProfile({
    sku: nullable(readMapped(row, mapping.sku)),
    referenceCode: nullable(readMapped(row, mapping.referenceCode)),
    barcodes: parseList(readMapped(row, mapping.barcodes)),
    taxpayerGoodsServiceId: nullable(readMapped(row, mapping.taxpayerGoodsServiceId)),
    externalIdentifiers: parseExternalIdentifiers(readMapped(row, mapping.externalIdentifiers)),
  });
  const units = parseUnitProfile(row, mapping);
  await assertTaxpayerUnitReferences(units, taxpayerUnits);
  const masterData = createProductMasterDataProfile({
    kind,
    commercial: {
      brand: nullable(readMapped(row, mapping.brand)),
      model: nullable(readMapped(row, mapping.model)),
      purchaseDescription: nullable(readMapped(row, mapping.purchaseDescription)),
      salesDescription: nullable(readMapped(row, mapping.salesDescription)),
      defaultPurchaseUnitId: nullable(readMapped(row, mapping.defaultPurchaseUnitId)),
      defaultSalesUnitId: nullable(readMapped(row, mapping.defaultSalesUnitId)),
    },
    tax: {
      treatment: parseTaxTreatment(readMapped(row, mapping.taxTreatment)),
      vatRateBasisPoints: parseNullableInteger(readMapped(row, mapping.vatRateBasisPoints)),
    },
    operational: {
      stockTracking: parseBoolean(readMapped(row, mapping.stockTracking), false),
      serialTracking: parseBoolean(readMapped(row, mapping.serialTracking), false),
      lotTracking: parseBoolean(readMapped(row, mapping.lotTracking), false),
      shelfLifeDays: parseNullableInteger(readMapped(row, mapping.shelfLifeDays)),
    },
  });
  assertDefaultUnitReferences(masterData, units);

  return Object.freeze({ product, identifiers, units, masterData, version: 1 });
}

function parseUnitProfile(
  row: ProductTabularRow,
  mapping: ProductImportColumnMap,
): Readonly<ProductUnitProfile> | null {
  const baseUnitId = readMapped(row, mapping.baseUnitId);
  const baseUnitCode = readMapped(row, mapping.baseUnitCode);
  const baseUnitTitle = readMapped(row, mapping.baseUnitTitle);
  const anyBase = baseUnitId.length > 0 || baseUnitCode.length > 0 || baseUnitTitle.length > 0;
  if (!anyBase) {
    if (readMapped(row, mapping.alternateUnits).length > 0) {
      throw new Error("product.import.base-unit-required");
    }
    return null;
  }

  const precision = parseInteger(readMapped(row, mapping.baseUnitPrecision), 0);
  const roundingMode = parseRoundingMode(readMapped(row, mapping.baseUnitRoundingMode));
  const baseTaxpayerUnitCode = nullable(readMapped(row, mapping.baseTaxpayerUnitCode));
  const baseUnit = {
    unitId: baseUnitId,
    code: baseUnitCode,
    title: baseUnitTitle,
    precision,
    roundingMode,
    taxpayerUnitCode: baseTaxpayerUnitCode,
  };
  const alternateUnits = parseAlternateUnits(readMapped(row, mapping.alternateUnits));
  return createProductUnitProfile({ baseUnit, alternateUnits });
}

function parseAlternateUnits(value: string): readonly ProductUnitDefinition[] {
  if (!value) return Object.freeze([]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("product.import.alternate-units-json-invalid");
  }
  if (!Array.isArray(parsed)) throw new Error("product.import.alternate-units-json-invalid");
  return Object.freeze(parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("product.import.alternate-units-json-invalid");
    const valueMap = item as Record<string, unknown>;
    return Object.freeze({
      unitId: String(valueMap.unitId ?? ""),
      code: String(valueMap.code ?? ""),
      title: String(valueMap.title ?? ""),
      ratioToBase: Number(valueMap.ratioToBase),
      precision: Number(valueMap.precision ?? 0),
      roundingMode: parseRoundingMode(String(valueMap.roundingMode ?? "half-up")),
      taxpayerUnitCode: nullable(String(valueMap.taxpayerUnitCode ?? "")),
    });
  }));
}

function parseExternalIdentifiers(value: string): readonly ProductExternalIdentifier[] {
  if (!value) return Object.freeze([]);
  return Object.freeze(value.split(/[;|]/u).map((token) => {
    const separator = token.indexOf("=");
    if (separator <= 0 || separator === token.length - 1) {
      throw new Error("product.import.external-identifier-invalid");
    }
    return Object.freeze({
      scheme: token.slice(0, separator).trim(),
      value: token.slice(separator + 1).trim(),
    });
  }));
}

function parseKind(value: string): ProductKind {
  const normalized = value.trim().toLowerCase();
  if (["product", "goods", "item", "کالا"].includes(normalized)) return "product";
  if (["service", "خدمت", "خدمات"].includes(normalized)) return "service";
  throw new Error("product.kind.invalid");
}

function parseTaxTreatment(value: string): ProductTaxTreatment {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "unspecified";
  if (["taxable", "مشمول", "مشمول مالیات"].includes(normalized)) return "taxable";
  if (["exempt", "معاف", "معاف از مالیات"].includes(normalized)) return "exempt";
  if (["not-subject", "not subject", "غیرمشمول", "غیر مشمول"].includes(normalized)) return "not-subject";
  if (["unspecified", "نامشخص"].includes(normalized)) return "unspecified";
  throw new Error("product.tax-treatment.invalid");
}

function parseRoundingMode(value: string): QuantityRoundingMode {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "half-up") return "half-up";
  if (normalized === "down") return "down";
  if (normalized === "up") return "up";
  throw new Error("product.unit.rounding.invalid");
}

function parseBoolean(value: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["true", "1", "yes", "y", "بله", "فعال"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "خیر", "غیرفعال", "غیر فعال"].includes(normalized)) return false;
  throw new Error("product.import.boolean-invalid");
}

function parseInteger(value: string, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("product.import.integer-invalid");
  return parsed;
}

function parseNullableInteger(value: string): number | null {
  if (!value) return null;
  return parseInteger(value, 0);
}

function parseList(value: string): readonly string[] {
  if (!value) return Object.freeze([]);
  return Object.freeze(value.split(/[،,;|]/u).map((item) => item.trim()).filter(Boolean));
}

async function assertTaxpayerUnitReferences(
  units: Readonly<ProductUnitProfile> | null,
  validator: TaxpayerUnitReferenceValidator,
): Promise<void> {
  for (const unit of units?.units ?? []) {
    const code = unit.taxpayerUnitCode;
    if (code && !(await validator.isActiveCode(code))) {
      throw new Error("product.application.taxpayer-unit-reference-invalid");
    }
  }
}

function assertDefaultUnitReferences(
  masterData: Readonly<ProductMasterDataProfile>,
  units: Readonly<ProductUnitProfile> | null,
): void {
  const ids = new Set(units?.units.map((unit) => unit.unitId) ?? []);
  for (const unitId of [
    masterData.commercial.defaultPurchaseUnitId,
    masterData.commercial.defaultSalesUnitId,
  ]) {
    if (unitId !== null && !ids.has(unitId)) {
      throw new Error("product.application.unit-reference-invalid");
    }
  }
}

function replaceProductId(
  state: ProductPersistenceState,
  productId: string,
): ProductPersistenceState {
  const product = createProduct({
    ...state.product,
    productId,
    createdAt: state.product.createdAt,
  });
  return Object.freeze({ ...state, product });
}

async function fallbackState(
  context: ProductBulkContext,
  rowNumber: number,
): Promise<ProductPersistenceState> {
  const product = createProduct({
    productId: `invalid-${rowNumber}`,
    companyId: context.companyId,
    code: `INVALID-${rowNumber}`,
    title: "Invalid import row",
    kind: "product",
    createdAt: context.occurredAt,
  });
  return Object.freeze({
    product,
    identifiers: createProductIdentifierProfile(),
    units: null,
    masterData: createProductMasterDataProfile({ kind: "product" }),
    version: 1,
  });
}

function findBatchDuplicateRows(rows: readonly PreparedRow[]): ReadonlySet<number> {
  const rowNumbersByKey = new Map<string, number[]>();
  for (const entry of rows.filter((row) => row.preview.valid)) {
    for (const key of duplicateKeys(entry.state)) {
      const current = rowNumbersByKey.get(key) ?? [];
      rowNumbersByKey.set(key, [...current, entry.rowNumber]);
    }
  }
  return new Set(
    [...rowNumbersByKey.values()]
      .filter((numbers) => numbers.length > 1)
      .flat(),
  );
}

function duplicateKeys(state: ProductPersistenceState): readonly string[] {
  const ids = state.identifiers;
  return Object.freeze([
    `code:${state.product.code}`,
    ids.sku ? `sku:${ids.sku}` : null,
    ids.referenceCode ? `reference:${ids.referenceCode}` : null,
    ids.taxpayerGoodsServiceId ? `taxpayer:${ids.taxpayerGoodsServiceId}` : null,
    ...ids.barcodes.map((barcode) => `barcode:${barcode}`),
    ...ids.externalIdentifiers.map((identifier) =>
      `external:${identifier.scheme}:${identifier.value}`),
  ].filter((value): value is string => value !== null));
}

function uniqueProductIds(candidates: readonly ProductDuplicateCandidate[]): readonly string[] {
  return [...new Set(candidates.map((candidate) => candidate.productId))];
}

function summarize(rows: readonly ProductImportPreviewRow[]): ProductImportPreview {
  const validRows = rows.filter((row) => row.valid).length;
  return Object.freeze({
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    rows: Object.freeze([...rows]),
  });
}

function withIssue(entry: PreparedRow, code: string, message: string): PreparedRow {
  return Object.freeze({
    ...entry,
    preview: Object.freeze({
      ...entry.preview,
      valid: false,
      issues: Object.freeze([...entry.preview.issues, Object.freeze({ code, message })]),
    }),
  });
}

function withWriteFailure(
  preview: ProductImportPreviewRow,
  error: unknown,
): ProductImportPreviewRow {
  return Object.freeze({
    ...preview,
    valid: false,
    issues: Object.freeze([
      ...preview.issues,
      Object.freeze({
        code: "product.import.write-failed",
        message: error instanceof Error ? error.message : "Product import write failed.",
      }),
    ]),
  });
}

function readMapped(row: ProductTabularRow, sourceColumn: string | undefined): string {
  return sourceColumn ? String(row[sourceColumn] ?? "").trim() : "";
}

function nullable(value: string): string | null {
  return value.length === 0 ? null : value;
}

function errorCode(error: unknown, fallback: string): string {
  return error instanceof Error && "code" in error
    ? String((error as { readonly code: unknown }).code)
    : fallback;
}

function authContext(context: ProductBulkContext) {
  return Object.freeze({
    actorId: context.actorId,
    companyId: context.companyId,
    correlationId: context.correlationId,
    requestId: context.requestId,
  });
}

function toExportRow(product: ProductDto): ProductExportRow {
  const baseUnit = product.units?.units.find((unit) => unit.unitId === product.units?.baseUnitId) ?? null;
  const alternateUnits = product.units?.units.filter((unit) => unit.unitId !== product.units?.baseUnitId) ?? [];
  return Object.freeze({
    productId: product.productId,
    kind: product.kind,
    code: product.code,
    title: product.title,
    status: product.status,
    categoryId: product.categoryId ?? "",
    purchasable: String(product.capabilities.purchasable),
    sellable: String(product.capabilities.sellable),
    sku: product.identifiers.sku ?? "",
    referenceCode: product.identifiers.referenceCode ?? "",
    barcodes: product.identifiers.barcodes.join(";"),
    taxpayerGoodsServiceId: product.identifiers.taxpayerGoodsServiceId ?? "",
    externalIdentifiers: product.identifiers.externalIdentifiers
      .map((identifier) => `${identifier.scheme}=${identifier.value}`)
      .join(";"),
    baseUnitId: baseUnit?.unitId ?? "",
    baseUnitCode: baseUnit?.code ?? "",
    baseUnitTitle: baseUnit?.title ?? "",
    baseUnitPrecision: baseUnit ? String(baseUnit.precision) : "",
    baseUnitRoundingMode: baseUnit?.roundingMode ?? "",
    baseTaxpayerUnitCode: baseUnit?.taxpayerUnitCode ?? "",
    alternateUnits: alternateUnits.length > 0 ? JSON.stringify(alternateUnits) : "",
    brand: product.masterData.commercial.brand ?? "",
    model: product.masterData.commercial.model ?? "",
    purchaseDescription: product.masterData.commercial.purchaseDescription ?? "",
    salesDescription: product.masterData.commercial.salesDescription ?? "",
    defaultPurchaseUnitId: product.masterData.commercial.defaultPurchaseUnitId ?? "",
    defaultSalesUnitId: product.masterData.commercial.defaultSalesUnitId ?? "",
    taxTreatment: product.masterData.tax.treatment,
    vatRateBasisPoints: product.masterData.tax.vatRateBasisPoints === null
      ? ""
      : String(product.masterData.tax.vatRateBasisPoints),
    stockTracking: String(product.masterData.operational.stockTracking),
    serialTracking: String(product.masterData.operational.serialTracking),
    lotTracking: String(product.masterData.operational.lotTracking),
    shelfLifeDays: product.masterData.operational.shelfLifeDays === null
      ? ""
      : String(product.masterData.operational.shelfLifeDays),
    version: String(product.version),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  });
}
