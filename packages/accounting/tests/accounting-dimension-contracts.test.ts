import assert from "node:assert/strict";
import test from "node:test";

import { InvalidQueryError } from "@argin/platform";
import {
  normalizeAccountDimensionPolicySearchQuery,
  normalizeAccountingDimensionMemberSearchQuery,
  normalizeAccountingDimensionTypeSearchQuery,
} from "../src/index.ts";

test("normalizes a company-scoped type search with stable default ordering", () => {
  const query = normalizeAccountingDimensionTypeSearchQuery({
    companyId: " company-1 ",
    text: "  پروژه  ",
  });
  assert.equal(query.companyId, "company-1");
  assert.equal(query.text, "پروژه");
  assert.deepEqual(query.pagination, { page: 1, pageSize: 50, offset: 0 });
  assert.deepEqual(query.sorts, [
    { field: "displayOrder", direction: "ascending" },
    { field: "code", direction: "ascending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("supports member filters for type, status, parent and effective date", () => {
  const query = normalizeAccountingDimensionMemberSearchQuery({
    companyId: "company-1",
    dimensionTypeId: " type-project ",
    status: "active",
    parentId: null,
    effectiveOn: "2026-08-01",
    pagination: { page: 2, pageSize: 25 },
  });
  assert.equal(query.dimensionTypeId, "type-project");
  assert.equal(query.parentId, null);
  assert.equal(query.effectiveOn, "2026-08-01");
  assert.deepEqual(query.pagination, { page: 2, pageSize: 25, offset: 25 });
});

test("preserves custom member ordering and appends id as a stable tie breaker", () => {
  const query = normalizeAccountingDimensionMemberSearchQuery({
    companyId: "company-1",
    sorts: [{ field: "name", direction: "descending" }],
  });
  assert.deepEqual(query.sorts, [
    { field: "name", direction: "descending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("does not duplicate an explicit id tie breaker", () => {
  const query = normalizeAccountingDimensionTypeSearchQuery({
    companyId: "company-1",
    sorts: [{ field: "id", direction: "descending" }],
  });
  assert.deepEqual(query.sorts, [{ field: "id", direction: "descending" }]);
});

test("normalizes account and dimension filters for policy search", () => {
  const query = normalizeAccountDimensionPolicySearchQuery({
    companyId: " company-1 ",
    accountId: " account-100 ",
    dimensionTypeId: " type-project ",
    requirement: "required",
  });
  assert.equal(query.accountId, "account-100");
  assert.equal(query.dimensionTypeId, "type-project");
  assert.equal(query.requirement, "required");
  assert.deepEqual(query.sorts, [
    { field: "accountId", direction: "ascending" },
    { field: "dimensionTypeId", direction: "ascending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("rejects an empty active company scope", () => {
  assert.throws(
    () => normalizeAccountingDimensionTypeSearchQuery({ companyId: " " }),
    (error: unknown) => error instanceof InvalidQueryError &&
      error.code === "accounting.dimension-query.companyId-required",
  );
});

test("rejects invalid effective dates", () => {
  assert.throws(
    () => normalizeAccountingDimensionMemberSearchQuery({
      companyId: "company-1",
      effectiveOn: "2026-02-30",
    }),
    (error: unknown) => error instanceof InvalidQueryError &&
      error.code === "accounting.dimension-query.effective-date-invalid",
  );
});

test("rejects unsupported sort fields at runtime", () => {
  assert.throws(
    () => normalizeAccountingDimensionTypeSearchQuery({
      companyId: "company-1",
      sorts: [{ field: "unknown" as "code" }],
    }),
    (error: unknown) => error instanceof InvalidQueryError &&
      error.code === "query.sort-field-not-allowed",
  );
});
