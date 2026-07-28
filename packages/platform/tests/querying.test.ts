import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidQueryError,
  QUERY_PAGE_SIZE_DEFAULT,
  QUERY_PAGE_SIZE_MAXIMUM,
  applyProjection,
  applyProjectionToMany,
  createPagedResult,
  normalizePagination,
  normalizeQueryFilters,
  normalizeQuerySorts,
  type QueryProjection,
} from "../src/index.ts";

test("pagination applies stable defaults and calculates offset", () => {
  assert.deepEqual(normalizePagination(), {
    page: 1,
    pageSize: QUERY_PAGE_SIZE_DEFAULT,
    offset: 0,
  });

  assert.deepEqual(
    normalizePagination({ page: 3, pageSize: 25 }),
    { page: 3, pageSize: 25, offset: 50 },
  );
});

test("pagination rejects invalid values and oversized pages", () => {
  for (const request of [
    { page: 0 },
    { page: 1.5 },
    { pageSize: 0 },
    { pageSize: Number.NaN },
  ]) {
    assert.throws(
      () => normalizePagination(request),
      InvalidQueryError,
    );
  }

  assert.throws(
    () =>
      normalizePagination({
        pageSize: QUERY_PAGE_SIZE_MAXIMUM + 1,
      }),
    (error: unknown) =>
      error instanceof InvalidQueryError &&
      error.code === "query.page-size-too-large",
  );
});

test("filters normalize fields and defensively copy dates", () => {
  const date = new Date("2026-07-28T00:00:00.000Z");
  const filters = normalizeQueryFilters(
    [
      {
        field: " issuedAt ",
        operator: "greaterThanOrEqual",
        value: date,
      },
      {
        field: "status",
        operator: "in",
        value: ["draft", "approved"],
      },
      {
        field: "deletedAt",
        operator: "isNull",
      },
    ] as const,
    new Set(["issuedAt", "status", "deletedAt"]),
  );

  assert.equal(filters[0]?.field, "issuedAt");
  assert.notEqual(filters[0]?.value, date);
  assert.equal(
    (filters[0]?.value as Date).toISOString(),
    date.toISOString(),
  );
  assert.deepEqual(filters[1]?.value, [
    "draft",
    "approved",
  ]);
  assert.equal(filters[2]?.value, undefined);
  assert.equal(Object.isFrozen(filters), true);
});

test("filters enforce operator value rules and allowlists", () => {
  const invalidFilters = [
    [{ field: "name", operator: "equal" }],
    [
      {
        field: "name",
        operator: "isNull",
        value: null,
      },
    ],
    [{ field: "name", operator: "in", value: [] }],
    [
      {
        field: "name",
        operator: "contains",
        value: ["a"],
      },
    ],
  ] as const;

  for (const filters of invalidFilters) {
    assert.throws(
      () => normalizeQueryFilters(filters),
      InvalidQueryError,
    );
  }

  assert.throws(
    () =>
      normalizeQueryFilters(
        [
          {
            field: "secret",
            operator: "equal",
            value: true,
          },
        ],
        new Set(["public"]),
      ),
    (error: unknown) =>
      error instanceof InvalidQueryError &&
      error.code === "query.filter-field-not-allowed",
  );
});

test("sorts default direction and reject duplicates", () => {
  assert.deepEqual(
    normalizeQuerySorts([
      { field: "issuedAt" },
      { field: "number", direction: "descending" },
    ]),
    [
      { field: "issuedAt", direction: "ascending" },
      { field: "number", direction: "descending" },
    ],
  );

  assert.throws(
    () =>
      normalizeQuerySorts([
        { field: "number" },
        { field: " number ", direction: "descending" },
      ]),
    (error: unknown) =>
      error instanceof InvalidQueryError &&
      error.code === "query.sort-field-duplicate",
  );
});

test("paged result exposes correct page metadata", () => {
  const result = createPagedResult(
    ["third", "fourth"],
    5,
    normalizePagination({ page: 2, pageSize: 2 }),
  );

  assert.deepEqual(result, {
    items: ["third", "fourth"],
    page: 2,
    pageSize: 2,
    totalItems: 5,
    totalPages: 3,
    hasPreviousPage: true,
    hasNextPage: true,
  });

  assert.deepEqual(
    createPagedResult([], 0, normalizePagination()),
    {
      items: [],
      page: 1,
      pageSize: QUERY_PAGE_SIZE_DEFAULT,
      totalItems: 0,
      totalPages: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  );
});

test("paged result rejects inconsistent input", () => {
  assert.throws(
    () =>
      createPagedResult(
        [1, 2],
        2,
        normalizePagination({ pageSize: 1 }),
      ),
    InvalidQueryError,
  );

  assert.throws(
    () =>
      createPagedResult(
        [],
        -1,
        normalizePagination(),
      ),
    InvalidQueryError,
  );
});

test("projection supports functions and objects", () => {
  interface Invoice {
    readonly id: string;
    readonly amount: number;
  }

  const invoices: readonly Invoice[] = [
    { id: "invoice-1", amount: 100 },
    { id: "invoice-2", amount: 200 },
  ];

  const objectProjection: QueryProjection<
    Invoice,
    string
  > = {
    project: (invoice) => invoice.id,
  };

  assert.equal(
    applyProjection(invoices[0]!, objectProjection),
    "invoice-1",
  );
  assert.deepEqual(
    applyProjectionToMany(
      invoices,
      (invoice) => invoice.amount,
    ),
    [100, 200],
  );
});
