import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  createProductMasterDataProfile,
} from "../src/index.ts";

test("creates normalized commercial, tax and operational master data", () => {
  const profile = createProductMasterDataProfile({
    kind: "product",
    commercial: {
      brand: "  Argin  ",
      model: "  A-100 ",
      purchaseDescription: "  Purchase   description ",
      salesDescription: " Sales   description ",
      defaultPurchaseUnitId: " unit-carton ",
      defaultSalesUnitId: " unit-each ",
    },
    tax: {
      treatment: "taxable",
      vatRateBasisPoints: 1_000,
    },
    operational: {
      stockTracking: true,
      serialTracking: true,
      lotTracking: false,
      shelfLifeDays: 365,
    },
  });

  assert.equal(profile.commercial.brand, "Argin");
  assert.equal(profile.commercial.model, "A-100");
  assert.equal(profile.commercial.purchaseDescription, "Purchase description");
  assert.equal(profile.commercial.defaultPurchaseUnitId, "unit-carton");
  assert.equal(profile.commercial.defaultSalesUnitId, "unit-each");
  assert.equal(profile.tax.treatment, "taxable");
  assert.equal(profile.tax.vatRateBasisPoints, 1_000);
  assert.equal(profile.operational.stockTracking, true);
  assert.equal(profile.operational.serialTracking, true);
  assert.equal(profile.operational.shelfLifeDays, 365);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.commercial), true);
  assert.equal(Object.isFrozen(profile.tax), true);
  assert.equal(Object.isFrozen(profile.operational), true);
});

test("uses safe defaults without inventing downstream business state", () => {
  const profile = createProductMasterDataProfile({ kind: "product" });

  assert.deepEqual(profile.commercial, {
    brand: null,
    model: null,
    purchaseDescription: null,
    salesDescription: null,
    defaultPurchaseUnitId: null,
    defaultSalesUnitId: null,
  });
  assert.deepEqual(profile.tax, {
    treatment: "unspecified",
    vatRateBasisPoints: null,
  });
  assert.deepEqual(profile.operational, {
    stockTracking: false,
    serialTracking: false,
    lotTracking: false,
    shelfLifeDays: null,
  });
  assert.equal("stockQuantity" in profile.operational, false);
  assert.equal("purchasePrice" in profile.commercial, false);
  assert.equal("salesPrice" in profile.commercial, false);
  assert.equal("accountId" in profile, false);
});

test("supports exempt and not-subject tax treatments without a VAT rate", () => {
  const exempt = createProductMasterDataProfile({
    kind: "product",
    tax: { treatment: "exempt" },
  });
  const notSubject = createProductMasterDataProfile({
    kind: "service",
    tax: { treatment: "not-subject" },
  });

  assert.equal(exempt.tax.vatRateBasisPoints, null);
  assert.equal(notSubject.tax.vatRateBasisPoints, null);
});

test("rejects malformed VAT configuration", () => {
  assert.throws(
    () =>
      createProductMasterDataProfile({
        kind: "product",
        tax: { treatment: "taxable", vatRateBasisPoints: 10_001 },
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.vatRateInvalid,
  );

  assert.throws(
    () =>
      createProductMasterDataProfile({
        kind: "product",
        tax: { treatment: "exempt", vatRateBasisPoints: 900 },
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.vatRateInvalid,
  );
});

test("keeps service definitions outside inventory tracking behavior", () => {
  assert.throws(
    () =>
      createProductMasterDataProfile({
        kind: "service",
        operational: { stockTracking: true },
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.serviceStockTrackingInvalid,
  );
});

test("requires serial, lot and shelf-life settings to belong to a stock-tracked product", () => {
  for (const operational of [
    { serialTracking: true },
    { lotTracking: true },
    { shelfLifeDays: 30 },
    { stockTracking: true, shelfLifeDays: 0 },
  ]) {
    assert.throws(
      () => createProductMasterDataProfile({ kind: "product", operational }),
      (error: unknown) =>
        error instanceof ProductDomainError &&
        error.code === PRODUCT_DOMAIN_ERROR_CODES.operationalAttributeInvalid,
    );
  }
});
