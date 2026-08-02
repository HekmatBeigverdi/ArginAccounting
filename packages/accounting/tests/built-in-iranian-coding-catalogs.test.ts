import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  BUILT_IN_IRANIAN_CODING_CATALOGS,
  getBuiltInIranianCodingCatalog,
  validateCodingTemplateGraph,
} from "../src/index.ts";

test("all three Iranian catalogs pass the shared graph validator", () => {
  assert.deepEqual(BUILT_IN_IRANIAN_CODING_CATALOGS.map((catalog) => catalog.activityType), ["service", "trading", "manufacturing"]);
  for (const catalog of BUILT_IN_IRANIAN_CODING_CATALOGS) {
    assert.deepEqual(validateCodingTemplateGraph(catalog.content), [], catalog.templateCode);
    assert.equal(catalog.version, 1);
    assert.equal(catalog.contractVersion, "1.0");
    assert.equal(Object.isFrozen(catalog.content), true);
  }
});

test("shared accounts and dimensions retain stable logical keys", () => {
  const [service, trading, manufacturing] = BUILT_IN_IRANIAN_CODING_CATALOGS;
  const sharedAccountKeys = ["assets.current.cash", "assets.current.receivables", "liabilities.current.payables", "equity.capital.registered", "expenses.operating.payroll"];
  const sharedDimensionKeys = ["dimension.branch", "dimension.cost-center", "dimension.project", "dimension.party"];
  for (const key of sharedAccountKeys) {
    assert.ok(service.content.accounts.some((item) => item.logicalKey === key));
    assert.ok(trading.content.accounts.some((item) => item.logicalKey === key));
    assert.ok(manufacturing.content.accounts.some((item) => item.logicalKey === key));
  }
  for (const catalog of BUILT_IN_IRANIAN_CODING_CATALOGS) {
    assert.deepEqual(catalog.content.dimensionTypes.map((item) => item.logicalKey), sharedDimensionKeys);
  }
});

test("catalog accounting meaning is explicit and activity-specific", () => {
  const service = getBuiltInIranianCodingCatalog("iran-service-default");
  const trading = getBuiltInIranianCodingCatalog("iran-trading-default");
  const manufacturing = getBuiltInIranianCodingCatalog("iran-manufacturing-default");
  assert.equal(find(service, "revenue.operating.services").reportClassification.incomeStatementSection, "revenue");
  assert.equal(find(trading, "assets.current.inventory").reportClassification.balanceSheetSection, "assets");
  assert.equal(find(manufacturing, "assets.current.work-in-progress").reportClassification.managementTags.includes("در جریان ساخت"), true);
  assert.equal(find(manufacturing, "costs.manufacturing.overhead").reportClassification.incomeStatementSection, "cost_of_sales");
  assert.equal(find(service, "assets.current.cash").reportClassification.cashEquivalent, true);
});

test("receivables and payables require party while profit-and-loss accounts require cost center", () => {
  for (const catalog of BUILT_IN_IRANIAN_CODING_CATALOGS) {
    assert.ok(catalog.content.accountDimensionPolicies.some((item) => item.accountLogicalKey === "assets.current.receivables" && item.dimensionTypeLogicalKey === "dimension.party" && item.requirement === "required"));
    assert.ok(catalog.content.accountDimensionPolicies.some((item) => item.accountLogicalKey === "liabilities.current.payables" && item.dimensionTypeLogicalKey === "dimension.party" && item.requirement === "required"));
    for (const account of catalog.content.accounts.filter((item) => item.postingAllowed && item.statementType === "income_statement")) {
      assert.ok(catalog.content.accountDimensionPolicies.some((item) => item.accountLogicalKey === account.logicalKey && item.dimensionTypeLogicalKey === "dimension.cost-center" && item.requirement === "required"), account.logicalKey);
    }
  }
});

test("catalog snapshots remain stable", () => {
  const snapshots = Object.fromEntries(BUILT_IN_IRANIAN_CODING_CATALOGS.map((catalog) => [catalog.templateCode, sha256(catalog.content)]));
  assert.deepEqual(snapshots, {
    "iran-service-default": "6a0411ce63217a7a0c54f7ea64d88454c21c7e2fa398dc641c7ba0ed4f9482ec",
    "iran-trading-default": "57497b288231d4aef0dd6b050629dce56ba28ee50a131b56d64d687ccb262daf",
    "iran-manufacturing-default": "de0e35036bc16c845c6960228db4646cfbf74c94e0927ac276ddb20146f065d1",
  });
});

function find(catalog: (typeof BUILT_IN_IRANIAN_CODING_CATALOGS)[number], logicalKey: string) {
  const result = catalog.content.accounts.find((item) => item.logicalKey === logicalKey);
  assert.ok(result, logicalKey);
  return result;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
