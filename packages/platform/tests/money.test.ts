import assert from "node:assert/strict";
import test from "node:test";

import {
  Money,
  PlatformError,
  sumMoney,
} from "../src/index.ts";

test("Money uses IRR as the default currency", () => {
  const money = Money.fromRials(1_500_000);

  assert.equal(money.amount, 1_500_000);
  assert.equal(money.currency, "IRR");
  assert.equal(money.toString(), "1500000 IRR");
});

test("Money accepts zero and negative amounts", () => {
  assert.equal(Money.zero().isZero, true);
  assert.equal(Money.fromRials(10).isPositive, true);
  assert.equal(Money.fromRials(-10).isNegative, true);
});

test("Money rejects non-integer rial amounts", () => {
  assert.throws(
    () => Money.fromRials(10.5),
    (error: unknown) =>
      error instanceof PlatformError &&
      error.code === "money.amount-out-of-range",
  );
});

test("Money rejects unsafe integer amounts", () => {
  assert.throws(
    () => Money.fromRials(Number.MAX_SAFE_INTEGER + 1),
    (error: unknown) =>
      error instanceof PlatformError &&
      error.code === "money.amount-out-of-range",
  );
});

test("Money adds and subtracts values of the same currency", () => {
  const first = Money.fromRials(1_000);
  const second = Money.fromRials(250);

  assert.equal(first.add(second).amount, 1_250);
  assert.equal(first.subtract(second).amount, 750);
});

test("Money prevents calculations with different currencies", () => {
  const rials = Money.create(1_000, "IRR");
  const euros = Money.create(10, "EUR");

  assert.throws(
    () => rials.add(euros),
    (error: unknown) =>
      error instanceof PlatformError &&
      error.code === "money.currency-mismatch",
  );
});

test("Money multiplication rounds half away from zero", () => {
  assert.equal(
    Money.fromRials(105).multiply(0.1).amount,
    11,
  );

  assert.equal(
    Money.fromRials(-105).multiply(0.1).amount,
    -11,
  );
});

test("Money supports explicit rounding modes", () => {
  const money = Money.fromRials(105);

  assert.equal(money.multiply(0.1, "floor").amount, 10);
  assert.equal(money.multiply(0.1, "ceiling").amount, 11);
  assert.equal(money.multiply(0.1, "truncate").amount, 10);
});

test("Money calculates percentages in rials", () => {
  const invoiceAmount = Money.fromRials(10_000);

  assert.equal(invoiceAmount.percentage(10).amount, 1_000);
  assert.equal(invoiceAmount.percentage(9).amount, 900);
});

test("Money prevents division by zero", () => {
  assert.throws(
    () => Money.fromRials(1_000).divide(0),
    (error: unknown) =>
      error instanceof PlatformError &&
      error.code === "money.division-by-zero",
  );
});

test("Money allocation preserves the original total", () => {
  const allocations = Money.fromRials(100).allocate(3);

  assert.deepEqual(
    allocations.map((item) => item.amount),
    [34, 33, 33],
  );

  assert.equal(sumMoney(allocations).amount, 100);
});

test("negative Money allocation preserves the original total", () => {
  const allocations = Money.fromRials(-100).allocate(3);

  assert.deepEqual(
    allocations.map((item) => item.amount),
    [-34, -33, -33],
  );

  assert.equal(sumMoney(allocations).amount, -100);
});

test("Money serializes as a database-friendly value", () => {
  const money = Money.fromRials(250_000);

  assert.deepEqual(money.toJSON(), {
    amount: 250_000,
    currency: "IRR",
  });

  assert.equal(
    JSON.stringify(money),
    '{"amount":250000,"currency":"IRR"}',
  );
});

test("sumMoney returns zero for an empty collection", () => {
  const total = sumMoney([]);

  assert.equal(total.amount, 0);
  assert.equal(total.currency, "IRR");
});
