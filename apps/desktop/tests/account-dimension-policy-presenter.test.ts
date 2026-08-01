import assert from "node:assert/strict";
import test from "node:test";

import type {
  Account,
  AccountDimensionPolicy,
  AccountingDimensionType,
} from "@argin/accounting";

import {
  filterAccountDimensionPolicies,
  findAccountDimensionPolicy,
  summarizeAccountDimensionPolicies,
} from "../src/features/accounting/account-dimension-policy-presenter.ts";

const accounts = new Map([
  ["cash", { id: "cash", code: "1101", name: "وجوه نقد" } as Account],
  ["sales", { id: "sales", code: "4101", name: "فروش" } as Account],
]);
const types = new Map([
  ["project", { id: "project", code: "PRJ", name: "پروژه" } as AccountingDimensionType],
  ["branch", { id: "branch", code: "BR", name: "شعبه" } as AccountingDimensionType],
]);
const policies = [
  policy("p1", "cash", "project", "required"),
  policy("p2", "cash", "branch", "optional"),
  policy("p3", "sales", "project", "forbidden"),
];

test("filters policies by account, dimension, requirement and Persian text", () => {
  assert.deepEqual(
    filterAccountDimensionPolicies(policies, accounts, types, {
      text: "وجوه",
      accountId: "cash",
      dimensionTypeId: "project",
      requirement: "required",
    }).map((item) => item.id),
    ["p1"],
  );
  assert.deepEqual(
    filterAccountDimensionPolicies(policies, accounts, types, {
      text: "BR",
      accountId: "",
      dimensionTypeId: "",
      requirement: "all",
    }).map((item) => item.id),
    ["p2"],
  );
});

test("summarizes requirements and detects an existing account/type pair", () => {
  assert.deepEqual(summarizeAccountDimensionPolicies(policies), {
    total: 3,
    required: 1,
    optional: 1,
    forbidden: 1,
  });
  assert.equal(findAccountDimensionPolicy(policies, "cash", "branch")?.id, "p2");
  assert.equal(findAccountDimensionPolicy(policies, "sales", "branch"), undefined);
});

function policy(
  id: string,
  accountId: string,
  dimensionTypeId: string,
  requirement: AccountDimensionPolicy["requirement"],
): AccountDimensionPolicy {
  return { id, accountId, dimensionTypeId, requirement } as AccountDimensionPolicy;
}
