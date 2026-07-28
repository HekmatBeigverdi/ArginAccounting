import assert from "node:assert/strict";
import test from "node:test";

import {
  DefaultNumberSeries,
  DuplicateNumberSeriesDefinitionError,
  InMemoryNumberSeriesStore,
  NumberSeriesDefinitionNotFoundError,
  createNumberSeriesScopeKey,
} from "../src/index.ts";

function createService(): DefaultNumberSeries {
  return new DefaultNumberSeries(
    new InMemoryNumberSeriesStore(),
    [
      {
        seriesType: "accounting.journal-voucher",
        initialValue: 1,
        incrementBy: 1,
        padding: 6,
        prefix: "JV-",
      },
    ],
  );
}

test("number series generates a formatted value", async () => {
  const numberSeries = createService();

  const generated = await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fiscal-year-1405",
    },
  });

  assert.equal(generated.sequence, 1);
  assert.equal(generated.formattedValue, "JV-000001");
  assert.equal(
    generated.seriesType,
    "accounting.journal-voucher",
  );
});

test("number series increments sequentially", async () => {
  const numberSeries = createService();

  const request = {
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fiscal-year-1405",
    },
  } as const;

  const first = await numberSeries.next(request);
  const second = await numberSeries.next(request);
  const third = await numberSeries.next(request);

  assert.deepEqual(
    [
      first.formattedValue,
      second.formattedValue,
      third.formattedValue,
    ],
    [
      "JV-000001",
      "JV-000002",
      "JV-000003",
    ],
  );
});

test("number series respects initial value and increment", async () => {
  const numberSeries = new DefaultNumberSeries(
    new InMemoryNumberSeriesStore(),
    [
      {
        seriesType: "sales.invoice",
        initialValue: 100,
        incrementBy: 5,
        padding: 4,
        prefix: "INV-",
        suffix: "-IR",
      },
    ],
  );

  const request = {
    seriesType: "sales.invoice",
    scope: {
      companyId: "company-1",
    },
  } as const;

  const first = await numberSeries.next(request);
  const second = await numberSeries.next(request);

  assert.equal(first.formattedValue, "INV-0100-IR");
  assert.equal(second.formattedValue, "INV-0105-IR");
});

test("each branch has an independent counter", async () => {
  const numberSeries = createService();

  const firstBranchNumber = await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fiscal-year-1405",
    },
  });

  const secondBranchNumber = await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
      branchId: "branch-2",
      fiscalYearId: "fiscal-year-1405",
    },
  });

  assert.equal(
    firstBranchNumber.formattedValue,
    "JV-000001",
  );

  assert.equal(
    secondBranchNumber.formattedValue,
    "JV-000001",
  );
});

test("each fiscal year has an independent counter", async () => {
  const numberSeries = createService();

  await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
      branchId: "branch-1",
      fiscalYearId: "fiscal-year-1404",
    },
  });

  const newFiscalYearNumber =
    await numberSeries.next({
      seriesType: "accounting.journal-voucher",
      scope: {
        companyId: "company-1",
        branchId: "branch-1",
        fiscalYearId: "fiscal-year-1405",
      },
    });

  assert.equal(
    newFiscalYearNumber.formattedValue,
    "JV-000001",
  );
});

test("each company has an independent counter", async () => {
  const numberSeries = createService();

  const companyOne = await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-1",
    },
  });

  const companyTwo = await numberSeries.next({
    seriesType: "accounting.journal-voucher",
    scope: {
      companyId: "company-2",
    },
  });

  assert.equal(companyOne.sequence, 1);
  assert.equal(companyTwo.sequence, 1);
});

test("different series types have independent counters", async () => {
  const numberSeries = new DefaultNumberSeries(
    new InMemoryNumberSeriesStore(),
    [
      {
        seriesType: "sales.invoice",
        prefix: "SI-",
        padding: 4,
      },
      {
        seriesType: "purchases.invoice",
        prefix: "PI-",
        padding: 4,
      },
    ],
  );

  const scope = {
    companyId: "company-1",
    fiscalYearId: "fiscal-year-1405",
  };

  const salesNumber = await numberSeries.next({
    seriesType: "sales.invoice",
    scope,
  });

  const purchaseNumber = await numberSeries.next({
    seriesType: "purchases.invoice",
    scope,
  });

  assert.equal(salesNumber.formattedValue, "SI-0001");
  assert.equal(purchaseNumber.formattedValue, "PI-0001");
});

test("concurrent requests receive unique numbers", async () => {
  const numberSeries = createService();

  const generatedNumbers = await Promise.all(
    Array.from(
      { length: 100 },
      () =>
        numberSeries.next({
          seriesType:
            "accounting.journal-voucher",
          scope: {
            companyId: "company-1",
            branchId: "branch-1",
            fiscalYearId: "fiscal-year-1405",
          },
        }),
    ),
  );

  const sequences = generatedNumbers.map(
    (generated) => generated.sequence,
  );

  assert.equal(new Set(sequences).size, 100);
  assert.deepEqual(
    [...sequences].sort((left, right) => left - right),
    Array.from(
      { length: 100 },
      (_, index) => index + 1,
    ),
  );
});

test("missing definitions produce a platform error", async () => {
  const numberSeries = createService();

  await assert.rejects(
    numberSeries.next({
      seriesType: "sales.invoice",
      scope: {
        companyId: "company-1",
      },
    }),
    (error: unknown) =>
      error instanceof NumberSeriesDefinitionNotFoundError &&
      error.code ===
        "number-series.definition-not-found" &&
      error.seriesType === "sales.invoice",
  );
});

test("duplicate definitions are rejected", () => {
  assert.throws(
    () =>
      new DefaultNumberSeries(
        new InMemoryNumberSeriesStore(),
        [
          {
            seriesType: "sales.invoice",
          },
          {
            seriesType: "sales.invoice",
          },
        ],
      ),
    (error: unknown) =>
      error instanceof
        DuplicateNumberSeriesDefinitionError &&
      error.code ===
        "number-series.duplicate-definition",
  );
});

test("invalid series types are rejected", () => {
  assert.throws(
    () =>
      new DefaultNumberSeries(
        new InMemoryNumberSeriesStore(),
        [
          {
            seriesType: "SalesInvoice",
          },
        ],
      ),
    TypeError,
  );

  assert.throws(
    () =>
      new DefaultNumberSeries(
        new InMemoryNumberSeriesStore(),
        [
          {
            seriesType: "invoice",
          },
        ],
      ),
    TypeError,
  );
});

test("invalid numeric settings are rejected", () => {
  assert.throws(
    () =>
      new DefaultNumberSeries(
        new InMemoryNumberSeriesStore(),
        [
          {
            seriesType: "sales.invoice",
            initialValue: 0,
          },
        ],
      ),
    RangeError,
  );

  assert.throws(
    () =>
      new DefaultNumberSeries(
        new InMemoryNumberSeriesStore(),
        [
          {
            seriesType: "sales.invoice",
            padding: 31,
          },
        ],
      ),
    RangeError,
  );
});

test("scope keys are stable and collision resistant", () => {
  const first = createNumberSeriesScopeKey({
    companyId: "company:1",
    branchId: "branch|1",
    fiscalYearId: "fiscal-year-1405",
  });

  const second = createNumberSeriesScopeKey({
    companyId: "company:1",
    branchId: "branch|2",
    fiscalYearId: "fiscal-year-1405",
  });

  assert.notEqual(first, second);

  assert.equal(
    first,
    createNumberSeriesScopeKey({
      companyId: "company:1",
      branchId: "branch|1",
      fiscalYearId: "fiscal-year-1405",
    }),
  );
});

test("definitions can be inspected", () => {
  const numberSeries = createService();

  assert.equal(numberSeries.definitionCount, 1);
  assert.equal(
    numberSeries.hasDefinition(
      "accounting.journal-voucher",
    ),
    true,
  );

  const definition = numberSeries.getDefinition(
    "accounting.journal-voucher",
  );

  assert.equal(definition?.padding, 6);
  assert.equal(definition?.prefix, "JV-");
});
