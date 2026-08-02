import assert from "node:assert/strict";
import test from "node:test";

import type { AccountingDimensionSelectorModel } from "@argin/accounting";
import { updateAccountingDimensionAssignments } from "../src/features/accounting/accounting-dimension-selector-presenter.ts";

const model: AccountingDimensionSelectorModel = {
  companyId: "company-1",
  accountId: "account-1",
  documentDate: "2026-08-02",
  fields: [
    selectorField("type-project", ["project-1"]),
    selectorField("type-cost", ["cost-1"]),
  ],
};

test("updates one dynamic dimension and preserves the other selections", () => {
  assert.deepEqual(
    updateAccountingDimensionAssignments(model, "type-project", ["project-2"]),
    [
      { dimensionTypeId: "type-cost", memberIds: ["cost-1"] },
      { dimensionTypeId: "type-project", memberIds: ["project-2"] },
    ],
  );
});

test("removes an empty selection from the future consumer contract", () => {
  assert.deepEqual(
    updateAccountingDimensionAssignments(model, "type-project", []),
    [{ dimensionTypeId: "type-cost", memberIds: ["cost-1"] }],
  );
});

function selectorField(
  dimensionTypeId: string,
  selectedMemberIds: readonly string[],
) {
  return {
    dimensionTypeId,
    code: dimensionTypeId,
    label: dimensionTypeId,
    requirement: "optional" as const,
    required: false,
    disabled: false,
    multiple: false,
    hierarchical: false,
    selectedMemberIds,
    options: [],
  };
}
