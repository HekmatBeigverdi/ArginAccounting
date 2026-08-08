import assert from "node:assert/strict";
import test from "node:test";

import {
  CODING_TEMPLATE_WORKBOOK_SHEETS,
  IRAN_SERVICE_CODING_CATALOG,
  validateCodingTemplateGraph,
} from "@argin/accounting";
import { utils, write } from "xlsx";
import {
  WebCryptoCodingTemplateWorkbookFingerprintProvider,
  XlsxCodingTemplateWorkbookParser,
} from "../src/xlsx-coding-template-workbook-parser.ts";

const { content } = IRAN_SERVICE_CODING_CATALOG;

function metadataRows(): unknown[][] {
  return [[
    "1.0",
    "excel-service",
    "الگوی خدماتی اکسل",
    "Excel service",
    "service",
  ]];
}

function accountRows(): unknown[][] {
  return content.accounts.map((item) => [
    item.logicalKey,
    item.parentLogicalKey,
    item.level,
    item.code,
    item.persianName,
    item.englishName,
    item.nature,
    item.normalBalance,
    item.statementType,
    item.reportClassification.balanceSheetSection,
    item.reportClassification.incomeStatementSection,
    item.reportClassification.cashFlowCategory,
    item.reportClassification.cashEquivalent,
    item.reportClassification.receivable,
    item.reportClassification.payable,
    item.reportClassification.managementTags.join("|"),
    item.postingAllowed,
    item.currencyEnabled,
    item.revaluationEnabled,
    item.trackingEnabled,
    item.dueDateEnabled,
    item.activeByDefault,
    item.displayOrder,
  ]);
}

function dimensionTypeRows(): unknown[][] {
  return content.dimensionTypes.map((item) => [
    item.logicalKey,
    item.code,
    item.persianName,
    item.englishName,
    item.hierarchical,
    item.allowMultipleMembers,
    item.activeByDefault,
    item.displayOrder,
  ]);
}

function dimensionMemberRows(): unknown[][] {
  return content.dimensionMembers.map((item) => [
    item.logicalKey,
    item.dimensionTypeLogicalKey,
    item.parentLogicalKey,
    item.code,
    item.persianName,
    item.englishName,
    item.activeByDefault,
    item.displayOrder,
  ]);
}

function accountDimensionPolicyRows(): unknown[][] {
  return content.accountDimensionPolicies.map((item) => [
    item.accountLogicalKey,
    item.dimensionTypeLogicalKey,
    item.requirement,
  ]);
}

function workbookRows(): Record<string, unknown[][]> {
  return {
    Metadata: metadataRows(),
    Accounts: accountRows(),
    DimensionTypes: dimensionTypeRows(),
    DimensionMembers: dimensionMemberRows(),
    AccountDimensionPolicies: accountDimensionPolicyRows(),
  };
}

function setMetadataFormula(workbook: ReturnType<typeof utils.book_new>): void {
  workbook.Sheets.Metadata!.B2 = {
    t: "s",
    f: 'CONCAT("excel","-service")',
    v: "excel-service",
  };
}

function workbookBytes(formula = false): Uint8Array {
  const workbook = utils.book_new();
  const rows = workbookRows();

  for (const definition of CODING_TEMPLATE_WORKBOOK_SHEETS) {
    const worksheet = utils.aoa_to_sheet([
      definition.columns.map((column) => column.name),
      ...rows[definition.name]!,
    ]);
    utils.book_append_sheet(workbook, worksheet, definition.name);
  }

  if (formula) {
    setMetadataFormula(workbook);
  }

  return write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("parses a real in-memory xlsx workbook into shared template content", async () => {
  const parser = new XlsxCodingTemplateWorkbookParser();
  const result = await parser.parse({
    fileName: "service.xlsx",
    bytes: workbookBytes(),
  });

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.metadata.templateCode, "excel-service");
  assert.equal(
    result.content.accounts.length,
    IRAN_SERVICE_CODING_CATALOG.content.accounts.length,
  );
  assert.deepEqual(validateCodingTemplateGraph(result.content), []);
});

test("rejects formulas from a real xlsx even when a cached value exists", async () => {
  const parser = new XlsxCodingTemplateWorkbookParser();
  const result = await parser.parse({
    fileName: "formula.xlsx",
    bytes: workbookBytes(true),
  });

  assert.equal(result.success, false);
  if (result.success) return;

  assert.equal(
    result.issues.some(
      (issue) =>
        issue.code === "formula_not_allowed"
        && issue.location?.address === "B2",
    ),
    true,
  );
});

test("creates a lowercase SHA-256 fingerprint for preview freshness and provenance", async () => {
  const provider = new WebCryptoCodingTemplateWorkbookFingerprintProvider();

  assert.equal(
    await provider.sha256(new Uint8Array([1, 2, 3])),
    "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
  );
});
