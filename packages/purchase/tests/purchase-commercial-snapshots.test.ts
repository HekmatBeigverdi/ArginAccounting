import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  createPurchaseItemSnapshot,
  createPurchaseSupplierSnapshot,
} from "../src/index.ts";

function assertDomainError(
  action: () => unknown,
  code: string,
  field: string,
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("captures immutable supplier identity and tax display facts", () => {
  const snapshot = createPurchaseSupplierSnapshot({
    companyId: " company-001 ",
    supplierId: " party-001 ",
    code: " SUP-001 ",
    displayName: " تأمین کننده نمونه ",
    classification: "legal-entity",
    nationalCode: null,
    nationalId: "10101234567",
    economicNumber: "411111111111",
    taxFileNumber: "TX-77",
  });

  assert.deepEqual(snapshot, {
    companyId: "company-001",
    supplierId: "party-001",
    code: "SUP-001",
    displayName: "تأمین کننده نمونه",
    classification: "legal-entity",
    nationalCode: null,
    nationalId: "10101234567",
    economicNumber: "411111111111",
    taxFileNumber: "TX-77",
  });
  assert.ok(Object.isFrozen(snapshot));
});

test("captures Product commercial, tax and default purchase-unit facts without prices", () => {
  const snapshot = createPurchaseItemSnapshot({
    itemId: "product-001",
    itemType: "product",
    code: "PRD-001",
    displayName: "کالای نمونه",
    sku: "SKU-001",
    referenceCode: "REF-1",
    taxpayerGoodsServiceId: "2720000014385",
    purchaseDescription: "شرح خرید",
    brand: "Argin",
    model: "A1",
    stockTracking: true,
    taxTreatment: "taxable",
    vatRateBasisPoints: 1000,
    defaultPurchaseUnit: {
      unitId: "unit-box",
      code: "BOX",
      title: "کارتن",
      taxpayerUnitCode: "1611",
    },
  });

  assert.equal(snapshot.taxpayerGoodsServiceId, "2720000014385");
  assert.equal(snapshot.stockTracking, true);
  assert.equal(snapshot.taxTreatment, "taxable");
  assert.equal(snapshot.vatRateBasisPoints, 1000);
  assert.deepEqual(snapshot.defaultPurchaseUnit, {
    unitId: "unit-box",
    code: "BOX",
    title: "کارتن",
    taxpayerUnitCode: "1611",
  });
  assert.equal("unitPrice" in snapshot, false);
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.defaultPurchaseUnit));
});

test("service snapshots cannot claim stock tracking and invalid taxpayer IDs are rejected", () => {
  assertDomainError(
    () => createPurchaseItemSnapshot({
      itemId: "service-001",
      itemType: "service",
      code: "SRV-001",
      displayName: "خدمت نمونه",
      stockTracking: true,
      taxTreatment: "exempt",
      vatRateBasisPoints: null,
    }),
    PURCHASE_DOMAIN_ERROR_CODES.itemSnapshotMismatch,
    "itemSnapshot.stockTracking",
  );

  assertDomainError(
    () => createPurchaseItemSnapshot({
      itemId: "product-002",
      itemType: "product",
      code: "PRD-002",
      displayName: "کالا",
      taxpayerGoodsServiceId: "123",
      stockTracking: false,
      taxTreatment: "unspecified",
      vatRateBasisPoints: null,
    }),
    PURCHASE_DOMAIN_ERROR_CODES.taxpayerIdentifierInvalid,
    "itemSnapshot.taxpayerGoodsServiceId",
  );
});
