import assert from "node:assert/strict";
import test from "node:test";

import type { ProductExportRow } from "@argin/product";
import {
  PRODUCT_TABULAR_LIMITS,
  ProductTabularCodecError,
  createProductCsv,
  createProductXlsx,
  parseProductCsv,
  parseProductXlsx,
} from "../src/index.ts";

const exportRow: ProductExportRow = Object.freeze({
  productId: "product-1",
  kind: "product",
  code: "P-001",
  title: "کالای نمونه",
  status: "active",
  categoryId: "",
  purchasable: "true",
  sellable: "true",
  sku: "SKU-1",
  referenceCode: "",
  barcodes: "6260001;6260002",
  taxpayerGoodsServiceId: "2720000014385",
  externalIdentifiers: "ERP=1001",
  baseUnitId: "unit-each",
  baseUnitCode: "EA",
  baseUnitTitle: "عدد",
  baseUnitPrecision: "0",
  baseUnitRoundingMode: "half-up",
  baseTaxpayerUnitCode: "1627",
  alternateUnits: "",
  brand: "Argin",
  model: "A1",
  purchaseDescription: "",
  salesDescription: "",
  defaultPurchaseUnitId: "unit-each",
  defaultSalesUnitId: "unit-each",
  taxTreatment: "taxable",
  vatRateBasisPoints: "1000",
  stockTracking: "true",
  serialTracking: "false",
  lotTracking: "false",
  shelfLifeDays: "",
  version: "1",
  createdAt: "2026-08-31T14:00:00.000Z",
  updatedAt: "2026-08-31T14:00:00.000Z",
});

test("CSV codec preserves Product headers and Persian values", () => {
  const csv = createProductCsv([exportRow]);
  const parsed = parseProductCsv(csv);

  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.code, "P-001");
  assert.equal(parsed.rows[0]?.title, "کالای نمونه");
  assert.equal(parsed.rows[0]?.taxpayerGoodsServiceId, "2720000014385");
});

test("XLSX codec round-trips Product master-data rows", () => {
  const bytes = createProductXlsx([exportRow]);
  const parsed = parseProductXlsx(bytes);

  assert.ok(bytes.byteLength > 0);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.baseUnitTitle, "عدد");
  assert.equal(parsed.rows[0]?.brand, "Argin");
});

test("codec exposes bounded file, row, and column limits", () => {
  assert.equal(PRODUCT_TABULAR_LIMITS.maximumFileSizeBytes, 20 * 1024 * 1024);
  assert.equal(PRODUCT_TABULAR_LIMITS.maximumRows, 100_000);
  assert.equal(PRODUCT_TABULAR_LIMITS.maximumColumns, 100);
});

test("oversized CSV is rejected before workbook parsing", () => {
  const oversized = "x".repeat(PRODUCT_TABULAR_LIMITS.maximumFileSizeBytes + 1);
  assert.throws(
    () => parseProductCsv(oversized),
    (error: unknown) =>
      error instanceof ProductTabularCodecError
      && error.code === "product.import.file-too-large",
  );
});
