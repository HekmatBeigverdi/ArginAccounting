import {
  InventoryDraftImportService,
  InventoryDraftService,
  createInventoryLineOperation,
  inventoryPermissions,
  type InventoryDocumentType,
  type PreparedInventoryImportDocument,
} from "@argin/inventory";
import {
  SqliteInventoryUnitOfWork,
  type InventoryTabularData,
  type InventoryTabularRow,
} from "@argin/inventory-tauri";
import type { DatabaseExecutor } from "@argin/database";
import { SqliteFiscalPeriodRepository } from "@argin/fiscal-tauri";
import { SqliteProductReader } from "@argin/product-tauri";
import { SqliteWarehouseReader } from "@argin/warehouse-tauri";
import type { AuditServices } from "../../composition/audit/create-audit-services";
import { jalaliToGregorian } from "../../pages/inventory/inventory-persian-date";

export interface InventoryImportActor {
  readonly id: string;
  readonly displayName: string;
  readonly permissions: readonly string[];
  readonly branchIds: readonly string[];
}
export interface InventoryImportPreviewIssue {
  readonly code: string;
  readonly message: string;
}
export interface InventoryImportPreviewRow {
  readonly rowNumber: number;
  readonly documentKey: string;
  readonly productCode: string;
  readonly valid: boolean;
  readonly issues: readonly InventoryImportPreviewIssue[];
}
export interface InventoryImportPreview {
  readonly batchId: string;
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly documentCount: number;
  readonly rows: readonly InventoryImportPreviewRow[];
  readonly documents: readonly PreparedInventoryImportDocument[];
}
export interface InventoryImportCommitResult {
  readonly importedCount: number;
  readonly replayedCount: number;
  readonly failures: readonly {
    readonly importKey: string;
    readonly message: string;
  }[];
}

const TYPE_MAP: Readonly<Record<string, InventoryDocumentType>> = Object.freeze(
  {
    receipt: "receipt",
    رسید: "receipt",
    "رسید انبار": "receipt",
    issue: "issue",
    حواله: "issue",
    "حواله انبار": "issue",
    opening: "opening",
    "اول دوره": "opening",
    "موجودی اول دوره": "opening",
    transfer: "transfer",
    انتقال: "transfer",
    "انتقال بین انبارها": "transfer",
    adjustment: "adjustment",
    اصلاح: "adjustment",
    "اصلاح مقدار": "adjustment",
    "اصلاح موجودی": "adjustment",
  },
);
const ALIASES = Object.freeze({
  documentKey: ["کلید سند", "documentKey", "document_key"],
  documentType: ["نوع سند", "documentType", "document_type"],
  businessDate: ["تاریخ", "businessDate", "business_date"],
  documentDescription: [
    "شرح سند",
    "documentDescription",
    "document_description",
  ],
  productCode: ["کد کالا", "productCode", "product_code"],
  quantity: ["مقدار", "quantity"],
  unitCode: ["کد واحد", "unitCode", "unit_code"],
  warehouseCode: ["کد انبار", "warehouseCode", "warehouse_code"],
  zoneCode: ["کد ناحیه", "zoneCode", "zone_code"],
  locationCode: ["کد موقعیت", "locationCode", "location_code"],
  destinationWarehouseCode: [
    "کد انبار مقصد",
    "destinationWarehouseCode",
    "destination_warehouse_code",
  ],
  destinationZoneCode: [
    "کد ناحیه مقصد",
    "destinationZoneCode",
    "destination_zone_code",
  ],
  destinationLocationCode: [
    "کد موقعیت مقصد",
    "destinationLocationCode",
    "destination_location_code",
  ],
  lineDescription: ["شرح ردیف", "lineDescription", "line_description"],
});
type Field = keyof typeof ALIASES;
interface PreparedRow {
  readonly rowNumber: number;
  readonly documentKey: string;
  readonly documentType: InventoryDocumentType;
  readonly businessDate: string;
  readonly documentDescription: string | null;
  readonly productId: string;
  readonly productCode: string;
  readonly lineDescription: string | null;
  readonly operation: ReturnType<typeof createInventoryLineOperation>;
}

interface InventoryImportControllerInput {
  readonly database: DatabaseExecutor;
  readonly actor: InventoryImportActor;
  readonly audit: AuditServices;
}

interface InventoryImportScope {
  readonly companyId: string;
  readonly branchId: string | null;
  readonly fiscalYearId: string;
}

interface InventoryImportPreviewInput extends InventoryImportScope {
  readonly data: InventoryTabularData;
  readonly batchId: string;
}

interface InventoryImportCommitInput extends InventoryImportScope {
  readonly preview: InventoryImportPreview;
}

export function createInventoryImportController(
  input: InventoryImportControllerInput,
) {
  const { database, actor, audit } = input;
  const unitOfWork = new SqliteInventoryUnitOfWork(database);
  const importer = new InventoryDraftImportService(
    new InventoryDraftService(unitOfWork),
    {
      documentId: (batchId, importKey) =>
        `inventory-import:${batchId}:${encodeURIComponent(importKey)}`,
    },
  );
  const products = new SqliteProductReader(database);
  const warehouses = new SqliteWarehouseReader(database);
  const periods = new SqliteFiscalPeriodRepository(database);
  const fullAccess = actor.permissions.includes("system.full-access");
  const canImport =
    fullAccess || actor.permissions.includes(inventoryPermissions.import);

  const requireImport = (branchId: string | null): void => {
    if (!canImport) {
      throw new Error("برای ورود گروهی اسناد انبار مجوز کافی ندارید.");
    }
    if (
      branchId !== null &&
      !fullAccess &&
      !actor.branchIds.includes(branchId)
    ) {
      throw new Error("شعبه انتخاب‌شده خارج از محدوده دسترسی کاربر است.");
    }
  };

  const resolveWarehouse = async (
    companyId: string,
    branchId: string | null,
    warehouseCode: string,
    zoneCode: string,
    locationCode: string,
  ) => {
    const choices = await warehouses.select({
      companyId,
      branchId: branchId ?? undefined,
      includeCompanyWide: true,
      search: warehouseCode,
      statuses: ["active"],
      limit: 20,
    });
    const selected = choices.find(
      (item) => item.code.toUpperCase() === warehouseCode.toUpperCase(),
    );
    if (!selected) {
      throw new Error(
        `انبار فعال با کد «${warehouseCode}» در محدوده دسترسی پیدا نشد.`,
      );
    }
    const warehouse = await warehouses.getById({
      companyId,
      warehouseId: selected.warehouseId,
    });
    if (!warehouse) {
      throw new Error(
        `انبار «${warehouseCode}» در حین اعتبارسنجی در دسترس نیست.`,
      );
    }
    const zones = zoneCode
      ? await warehouses.listZones({
          companyId,
          warehouseId: selected.warehouseId,
          statuses: ["active"],
        })
      : [];
    const zone = zoneCode
      ? (zones.find(
          (item) => item.code.toUpperCase() === zoneCode.toUpperCase(),
        ) ?? null)
      : null;
    if (zoneCode && !zone) {
      throw new Error(
        `ناحیه «${zoneCode}» در انبار ${warehouseCode} پیدا نشد.`,
      );
    }
    const locations =
      locationCode && zone
        ? await warehouses.listLocations({
            companyId,
            warehouseId: selected.warehouseId,
            zoneId: zone.zoneId,
            statuses: ["active"],
          })
        : [];
    const location = locationCode
      ? (locations.find(
          (item) => item.code.toUpperCase() === locationCode.toUpperCase(),
        ) ?? null)
      : null;
    if (locationCode && !location) {
      throw new Error(
        `موقعیت «${locationCode}» در انبار ${warehouseCode} پیدا نشد.`,
      );
    }
    return { warehouse, zone, location };
  };

  async function prepareRow(
    args: InventoryImportScope,
    row: InventoryTabularRow,
    rowNumber: number,
    documentKey: string,
    productCode: string,
  ): Promise<PreparedRow> {
    if (!documentKey) {
      throw new Error("کلید سند الزامی است.");
    }
    const documentType = parseDocumentType(cell(row, "documentType"));
    const businessDate = parseBusinessDate(cell(row, "businessDate"));
    const product = await products.getByCode({
      companyId: args.companyId,
      code: required(productCode, "کد کالا"),
    });
    if (
      !product ||
      product.kind !== "product" ||
      product.status !== "active" ||
      !product.masterData.operational.stockTracking
    ) {
      throw new Error(`کالای انباری فعال با کد «${productCode}» پیدا نشد.`);
    }
    if (!product.units) {
      throw new Error(
        `برای کالای «${productCode}» واحد اندازه‌گیری تعریف نشده است.`,
      );
    }
    const productUnits = product.units;
    const unitCode = cell(row, "unitCode");
    const unit = unitCode
      ? productUnits.units.find((item) => item.code === unitCode.toUpperCase())
      : productUnits.units.find(
          (item) => item.unitId === productUnits.baseUnitId,
        );
    if (!unit) {
      throw new Error(
        `واحد «${unitCode}» برای کالای ${productCode} معتبر نیست.`,
      );
    }
    const source = await resolveWarehouse(
      args.companyId,
      args.branchId,
      required(cell(row, "warehouseCode"), "کد انبار"),
      cell(row, "zoneCode"),
      cell(row, "locationCode"),
    );
    const destinationCode = cell(row, "destinationWarehouseCode");
    if (documentType === "transfer" && !destinationCode) {
      throw new Error("برای سند انتقال، کد انبار مقصد الزامی است.");
    }
    if (documentType !== "transfer" && destinationCode) {
      throw new Error("انبار مقصد فقط برای سند انتقال قابل ثبت است.");
    }
    const destination = destinationCode
      ? await resolveWarehouse(
          args.companyId,
          args.branchId,
          destinationCode,
          cell(row, "destinationZoneCode"),
          cell(row, "destinationLocationCode"),
        )
      : null;
    const operation = createInventoryLineOperation({
      companyId: args.companyId,
      productId: product.productId,
      product,
      enteredQuantity: required(cell(row, "quantity"), "مقدار"),
      unitId: unit.unitId,
      warehouse: {
        warehouseId: source.warehouse.warehouseId,
        zoneId: source.zone?.zoneId ?? null,
        locationId: source.location?.locationId ?? null,
      },
      resolvedWarehouse: source,
      destination: destination
        ? {
            warehouseId: destination.warehouse.warehouseId,
            zoneId: destination.zone?.zoneId ?? null,
            locationId: destination.location?.locationId ?? null,
          }
        : null,
      resolvedDestination: destination,
    });
    const period = await periods.findByDate(args.fiscalYearId, businessDate);
    if (!period || period.status !== "open") {
      throw new Error("برای تاریخ سند دوره مالی باز پیدا نشد.");
    }
    return Object.freeze({
      rowNumber,
      documentKey,
      documentType,
      businessDate,
      documentDescription: nullable(cell(row, "documentDescription")),
      productId: product.productId,
      productCode,
      lineDescription: nullable(cell(row, "lineDescription")),
      operation,
    });
  }

  return Object.freeze({
    canImport,
    async preview(
      args: InventoryImportPreviewInput,
    ): Promise<InventoryImportPreview> {
      requireImport(args.branchId);
      const prepared: PreparedRow[] = [];
      const previewRows: InventoryImportPreviewRow[] = [];
      for (const [index, row] of args.data.rows.entries()) {
        const rowNumber = index + 2;
        const documentKey = cell(row, "documentKey");
        const productCode = cell(row, "productCode");
        const issues: InventoryImportPreviewIssue[] = [];
        try {
          prepared.push(
            await prepareRow(args, row, rowNumber, documentKey, productCode),
          );
        } catch (error) {
          issues.push(
            Object.freeze({
              code: "inventory.import.invalid-row",
              message:
                error instanceof Error ? error.message : "ردیف نامعتبر است.",
            }),
          );
        }
        previewRows.push(
          Object.freeze({
            rowNumber,
            documentKey,
            productCode,
            valid: issues.length === 0,
            issues: Object.freeze(issues),
          }),
        );
      }

      const invalidKeys = new Set(
        previewRows
          .filter((row) => !row.valid)
          .map((row) => row.documentKey)
          .filter(Boolean),
      );
      const groups = new Map<string, PreparedRow[]>();
      for (const row of prepared) {
        const documentRows = groups.get(row.documentKey) ?? [];
        documentRows.push(row);
        groups.set(row.documentKey, documentRows);
      }
      const documents: PreparedInventoryImportDocument[] = [];
      for (const [documentKey, rows] of groups) {
        if (invalidKeys.has(documentKey)) {
          continue;
        }
        const first = rows[0]!;
        if (
          rows.some(
            (row) =>
              row.documentType !== first.documentType ||
              row.businessDate !== first.businessDate ||
              row.documentDescription !== first.documentDescription,
          )
        ) {
          previewRows.forEach((row, index) => {
            if (row.documentKey === documentKey) {
              previewRows[index] = Object.freeze({
                ...row,
                valid: false,
                issues: Object.freeze([
                  ...row.issues,
                  {
                    code: "inventory.import.document-header-mismatch",
                    message:
                      "نوع، تاریخ و شرح همه ردیف‌های یک کلید سند باید یکسان باشد.",
                  },
                ]),
              });
            }
          });
          continue;
        }
        const period = await periods.findByDate(
          args.fiscalYearId,
          first.businessDate,
        );
        if (!period || period.status !== "open") {
          continue;
        }
        documents.push(
          Object.freeze({
            importKey: documentKey,
            document: Object.freeze({
              companyId: args.companyId,
              documentType: first.documentType,
              businessDate: first.businessDate,
              description: first.documentDescription,
              createdAt: new Date().toISOString(),
              scope: {
                branchId: args.branchId,
                destinationBranchId: null,
                fiscalYearId: args.fiscalYearId,
                fiscalPeriodId: period.id,
              },
              lines: Object.freeze(
                rows.map((row, lineIndex) =>
                  Object.freeze({
                    lineId: `inventory-import-line:${args.batchId}:${encodeURIComponent(documentKey)}:${row.rowNumber}`,
                    position: lineIndex + 1,
                    productId: row.productId,
                    description: row.lineDescription,
                    operation: row.operation,
                  }),
                ),
              ),
            }),
          }),
        );
      }
      const invalidRows = previewRows.filter((row) => !row.valid).length;
      return Object.freeze({
        batchId: args.batchId,
        totalRows: previewRows.length,
        validRows: previewRows.length - invalidRows,
        invalidRows,
        documentCount: documents.length,
        rows: Object.freeze(previewRows),
        documents: Object.freeze(documents),
      });
    },

    async commit(
      args: InventoryImportCommitInput,
    ): Promise<InventoryImportCommitResult> {
      requireImport(args.branchId);
      if (args.preview.invalidRows > 0) {
        throw new Error(
          "تا زمانی که خطاهای پیش‌نمایش رفع نشوند ورود انجام نمی‌شود.",
        );
      }
      const result = await importer.import({
        companyId: args.companyId,
        batchId: args.preview.batchId,
        documents: args.preview.documents,
      });
      if (result.imported.length > 0) {
        try {
          await audit.recordAuditEntry({
            id: `inventory:import:${args.preview.batchId}`,
            occurredAt: new Date().toISOString(),
            action: "import",
            outcome: "success",
            source: "desktop",
            actor: {
              type: "user",
              id: actor.id,
              displayName: actor.displayName,
            },
            scope: {
              companyId: args.companyId,
              branchId: args.branchId,
              fiscalYearId: args.fiscalYearId,
            },
            target: {
              entityType: "inventory-import-batch",
              entityId: args.preview.batchId,
              entityDisplayName: "ورود گروهی اسناد انبار",
            },
            reason: null,
            before: null,
            after: null,
            correlationId: args.preview.batchId,
            metadata: {
              importedCount: result.imported.length,
              replayedCount: result.replayedCount,
              batchId: args.preview.batchId,
            },
          });
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !/already|duplicate|unique/i.test(error.message)
          ) {
            throw error;
          }
        }
      }
      return Object.freeze({
        importedCount: result.imported.length,
        replayedCount: result.replayedCount,
        failures: result.failures,
      });
    },
  });
}

export async function inventoryImportBatchId(
  bytes: Uint8Array,
): Promise<string> {
  // Copy only the supplied view into an ArrayBuffer accepted by Web Crypto.
  const buffer = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
function cell(row: InventoryTabularRow, field: Field): string {
  for (const alias of ALIASES[field]) {
    const value = row[alias];
    if (value?.trim()) {
      return value.trim();
    }
  }
  return "";
}
function parseDocumentType(value: string): InventoryDocumentType {
  const normalized = required(value, "نوع سند").toLowerCase();
  const type = TYPE_MAP[normalized];
  if (!type) {
    throw new Error(`نوع سند «${value}» معتبر نیست.`);
  }
  return type;
}
function parseBusinessDate(value: string): string {
  const normalized = required(value, "تاریخ");
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized)
    ? normalized
    : jalaliToGregorian(normalized);
}
function required(value: string, label: string): string {
  const result = value.trim();
  if (!result) {
    throw new Error(`${label} الزامی است.`);
  }
  return result;
}
const nullable = (value: string): string | null => value.trim() || null;
