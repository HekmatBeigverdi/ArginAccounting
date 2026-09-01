import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_DOMAIN_ERROR_CODES,
  ProductDomainError,
  createProductIdentifierProfile,
  normalizeTaxpayerGoodsServiceId,
} from "../src/index.ts";

test("normalizes sku, reference code, barcodes and external identifiers", () => {
  const profile = createProductIdentifierProfile({
    sku: " sku-100 ",
    referenceCode: " ref-200 ",
    barcodes: [" 6261234567890 ", "12345678"],
    externalIdentifiers: [
      { scheme: " supplier ", value: " SUP-10 " },
    ],
  });

  assert.equal(profile.sku, "SKU-100");
  assert.equal(profile.referenceCode, "REF-200");
  assert.deepEqual(profile.barcodes, ["6261234567890", "12345678"]);
  assert.deepEqual(profile.externalIdentifiers, [
    { scheme: "SUPPLIER", value: "SUP-10" },
  ]);
  assert.equal(Object.isFrozen(profile), true);
  assert.equal(Object.isFrozen(profile.barcodes), true);
});

test("accepts exactly thirteen numeric digits for taxpayer goods/service id", () => {
  assert.equal(
    normalizeTaxpayerGoodsServiceId(" 2720000014385 "),
    "2720000014385",
  );

  const profile = createProductIdentifierProfile({
    taxpayerGoodsServiceId: "2720000014385",
  });
  assert.equal(profile.taxpayerGoodsServiceId, "2720000014385");
});

test("rejects malformed taxpayer goods/service ids", () => {
  for (const value of ["272000014385", "27200000143850", "27200000A4385"]) {
    assert.throws(
      () => normalizeTaxpayerGoodsServiceId(value),
      (error: unknown) =>
        error instanceof ProductDomainError &&
        error.code === PRODUCT_DOMAIN_ERROR_CODES.taxpayerGoodsServiceIdInvalid,
    );
  }
});

test("rejects duplicate barcodes and duplicate external identifiers", () => {
  assert.throws(
    () => createProductIdentifierProfile({ barcodes: ["123", " 123 "] }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.barcodeDuplicate,
  );

  assert.throws(
    () =>
      createProductIdentifierProfile({
        externalIdentifiers: [
          { scheme: "erp", value: "A-1" },
          { scheme: " ERP ", value: "A-1" },
        ],
      }),
    (error: unknown) =>
      error instanceof ProductDomainError &&
      error.code === PRODUCT_DOMAIN_ERROR_CODES.externalIdentifierDuplicate,
  );
});
