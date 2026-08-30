import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  convertProductQuantity,
  createProductUnitProfile,
} from "../src/index.ts";

const profile = createProductUnitProfile({
  baseUnit: {
    unitId: "unit-each",
    code: "ea",
    title: "عدد",
    precision: 0,
    roundingMode: "half-up",
  },
  alternateUnits: [
    {
      unitId: "unit-pack",
      code: "pack",
      title: "بسته",
      ratioToBase: 6,
      precision: 0,
      roundingMode: "half-up",
    },
    {
      unitId: "unit-carton",
      code: "carton",
      title: "کارتن",
      ratioToBase: 24,
      precision: 2,
      roundingMode: "half-up",
    },
  ],
});

test("creates deterministic base and alternate unit definitions", () => {
  assert.equal(profile.baseUnitId, "unit-each");
  assert.equal(profile.units[0]?.ratioToBase, 1);
  assert.equal(profile.units[1]?.code, "PACK");
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.units), true);
  assert.equal(Object.isFrozen(profile.units[0]), true);
});

test("converts quantities through the canonical base ratio", () => {
  assert.equal(convertProductQuantity(profile, 2, "unit-carton", "unit-each"), 48);
  assert.equal(convertProductQuantity(profile, 48, "unit-each", "unit-carton"), 2);
  assert.equal(convertProductQuantity(profile, 4, "unit-pack", "unit-carton"), 1);
});

test("applies target-unit precision and rounding deterministically", () => {
  assert.equal(convertProductQuantity(profile, 1, "unit-pack", "unit-carton"), 0.25);

  const rounded = createProductUnitProfile({
    baseUnit: {
      unitId: "kg",
      code: "kg",
      title: "کیلوگرم",
      precision: 3,
      roundingMode: "half-up",
    },
    alternateUnits: [
      {
        unitId: "bag",
        code: "bag",
        title: "کیسه",
        ratioToBase: 2.5,
        precision: 0,
        roundingMode: "up",
      },
    ],
  });

  assert.equal(convertProductQuantity(rounded, 3, "kg", "bag"), 2);
});

test("rejects non-positive ratios, invalid precision and duplicate units", () => {
  assert.throws(
    () =>
      createProductUnitProfile({
        baseUnit: {
          unitId: "ea",
          code: "EA",
          title: "عدد",
          precision: 0,
          roundingMode: "half-up",
        },
        alternateUnits: [
          {
            unitId: "pack",
            code: "PACK",
            title: "بسته",
            ratioToBase: 0,
            precision: 0,
            roundingMode: "half-up",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.unitRatioInvalid,
  );

  assert.throws(
    () =>
      createProductUnitProfile({
        baseUnit: {
          unitId: "ea",
          code: "EA",
          title: "عدد",
          precision: 7,
          roundingMode: "half-up",
        },
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.unitPrecisionInvalid,
  );

  assert.throws(
    () =>
      createProductUnitProfile({
        baseUnit: {
          unitId: "ea",
          code: "EA",
          title: "عدد",
          precision: 0,
          roundingMode: "half-up",
        },
        alternateUnits: [
          {
            unitId: "pack",
            code: "EA",
            title: "بسته",
            ratioToBase: 6,
            precision: 0,
            roundingMode: "half-up",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.unitDuplicate,
  );
});

test("rejects unknown units and non-finite quantities", () => {
  assert.throws(
    () => convertProductQuantity(profile, 1, "missing", "unit-each"),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.unitNotFound,
  );

  assert.throws(
    () => convertProductQuantity(profile, Number.NaN, "unit-each", "unit-pack"),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.quantityInvalid,
  );
});

test("keeps taxpayer unit code separate from internal unit identity", () => {
  const mapped = createProductUnitProfile({
    baseUnit: {
      unitId: "unit-tax-each",
      code: "EA",
      title: "عدد",
      precision: 0,
      roundingMode: "half-up",
      taxpayerUnitCode: "1627",
    },
  });

  assert.equal(mapped.baseUnitId, "unit-tax-each");
  assert.equal(mapped.units[0]?.taxpayerUnitCode, "1627");
  assert.notEqual(mapped.units[0]?.unitId, mapped.units[0]?.taxpayerUnitCode);

  assert.throws(
    () =>
      createProductUnitProfile({
        baseUnit: {
          unitId: "invalid-tax-unit",
          code: "EA",
          title: "عدد",
          precision: 0,
          roundingMode: "half-up",
          taxpayerUnitCode: "   ",
        },
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.taxpayerUnitCodeInvalid,
  );
});
