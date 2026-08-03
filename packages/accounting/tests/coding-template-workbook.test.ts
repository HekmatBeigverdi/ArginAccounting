import assert from "node:assert/strict";
import test from "node:test";

import {
  CODING_TEMPLATE_WORKBOOK_CONTRACT_VERSION,
  CODING_TEMPLATE_WORKBOOK_LIMITS,
  CODING_TEMPLATE_WORKBOOK_SHEETS,
  IRAN_SERVICE_CODING_CATALOG,
  normalizeCodingTemplateWorkbookCell,
  normalizeCodingTemplateWorkbookText,
  validateCodingTemplateGraph,
  type CodingTemplateWorkbookParser,
} from "../src/index.ts";

test("publishes the immutable version 1.0 workbook shape and limits", () => {
  assert.equal(CODING_TEMPLATE_WORKBOOK_CONTRACT_VERSION, "1.0");
  assert.deepEqual(CODING_TEMPLATE_WORKBOOK_SHEETS.map((sheet) => sheet.name), [
    "Metadata", "Accounts", "DimensionTypes", "DimensionMembers", "AccountDimensionPolicies",
  ]);
  assert.equal(CODING_TEMPLATE_WORKBOOK_SHEETS[0]?.maximumDataRows, 1);
  assert.equal(CODING_TEMPLATE_WORKBOOK_SHEETS[1]?.maximumDataRows, CODING_TEMPLATE_WORKBOOK_LIMITS.maximumAccounts);
  assert.ok(CODING_TEMPLATE_WORKBOOK_SHEETS.every((sheet) => Object.isFrozen(sheet) && Object.isFrozen(sheet.columns)));
});

test("declares required columns, enumerations, types, and examples", () => {
  const accounts = CODING_TEMPLATE_WORKBOOK_SHEETS.find((sheet) => sheet.name === "Accounts");
  assert.ok(accounts);
  assert.deepEqual(accounts.columns.find((column) => column.name === "level")?.allowedValues, ["group", "general", "subsidiary"]);
  assert.equal(accounts.columns.find((column) => column.name === "logicalKey")?.required, true);
  assert.equal(accounts.columns.find((column) => column.name === "displayOrder")?.type, "integer");
  assert.equal(accounts.columns.find((column) => column.name === "persianName")?.example, "صندوق ریالی");
});

test("normalizes Persian and Arabic digits and whitespace deterministically", () => {
  assert.equal(normalizeCodingTemplateWorkbookText("  حساب\t۱۲۳\u00a0٤٥٦  "), "حساب 123 456");
  assert.equal(normalizeCodingTemplateWorkbookText("۱۲۳۴۵۶۷۸۹۰"), "1234567890");
  assert.equal(normalizeCodingTemplateWorkbookText("١٢٣٤٥٦٧٨٩٠"), "1234567890");
});

test("rejects formulas even when a spreadsheet library exposes a cached value", () => {
  const result = normalizeCodingTemplateWorkbookCell(
    { kind: "formula", expression: "=A1", cachedValue: "1101" },
    { sheet: "Accounts", row: 2, column: "code", address: "D2" },
  );
  assert.equal(result.value, null);
  assert.equal(result.issue?.code, "formula_not_allowed");
  assert.deepEqual(result.issue?.location, { sheet: "Accounts", row: 2, column: "code", address: "D2" });
});

test("normalizes stored strings without changing numbers and booleans", () => {
  const location = { sheet: "Accounts", row: 2, column: "code", address: "D2" } as const;
  assert.equal(normalizeCodingTemplateWorkbookCell({ kind: "stored", value: " ۱۱۰۱ " }, location).value, "1101");
  assert.equal(normalizeCodingTemplateWorkbookCell({ kind: "stored", value: 1101 }, location).value, 1101);
  assert.equal(normalizeCodingTemplateWorkbookCell({ kind: "stored", value: true }, location).value, true);
  assert.equal(normalizeCodingTemplateWorkbookCell({ kind: "blank" }, location).value, null);
});

test("parser port is asynchronous and independent from filesystem and spreadsheet objects", async () => {
  const parser: CodingTemplateWorkbookParser = {
    async parse(source) {
      assert.equal(source.fileName, "coding.xlsx");
      assert.ok(source.bytes instanceof Uint8Array);
      return {
        success: true,
        metadata: { contractVersion: "1.0", templateCode: "iran-service-default", persianName: "خدماتی", englishName: null, activityType: "service" },
        content: IRAN_SERVICE_CODING_CATALOG.content,
        issues: [],
      };
    },
  };
  const result = await parser.parse({ fileName: "coding.xlsx", bytes: new Uint8Array([80, 75]) });
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(validateCodingTemplateGraph(result.content), []);
});
