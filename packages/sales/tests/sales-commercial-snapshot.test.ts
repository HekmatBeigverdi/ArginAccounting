import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesCommercialSnapshot,
  createSalesDocumentLine,
  verifySalesCommercialSnapshot,
} from "../src/index.ts";

const line = () => createSalesDocumentLine({
  lineId: "line-1", position: 1, lineKind: "stock-product", productId: "product-1",
  commercialTerms: {
    quantity: 2.5, currency: "IRR", unitPrice: 100, priceOrigin: "price-list",
    priceListId: "pl", priceListItemId: "pli", priceRevisionId: "rev-1", priceRevision: 1,
    discounts: [{ id: "d", mode: "percent", value: 1000 }],
    charges: [{ id: "c", mode: "amount", value: 20 }],
    taxes: [{ taxId: "vat", rateBasisPoints: 1000, taxCode: "VAT" }],
  },
});

test("captures immutable commercial inputs and deterministic totals", () => {
  const snapshot = createSalesCommercialSnapshot({ snapshotId: "snap-1", line: line(), capturedAt: "2026-10-01T12:00:00Z" });
  assert.equal(snapshot.lineId, "line-1");
  assert.equal(snapshot.productId, "product-1");
  assert.equal(snapshot.terms.priceRevisionId, "rev-1");
  assert.equal(snapshot.totals.grandTotal, 270);
  assert.equal(verifySalesCommercialSnapshot(snapshot), true);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.terms.discounts), true);
});

test("historical snapshot does not depend on later price-list state", () => {
  const snapshot = createSalesCommercialSnapshot({ snapshotId: "snap-2", line: line(), capturedAt: "2026-10-01T12:00:00Z" });
  assert.equal(snapshot.terms.unitPrice, 100);
  assert.equal(snapshot.terms.priceRevision, 1);
  assert.equal(snapshot.totals.grossAmount, 250);
});

test("rejects snapshot creation when a line has no commercial terms", () => {
  const noTerms = createSalesDocumentLine({ lineId: "line-2", position: 1, lineKind: "service", productId: "service-1" });
  assert.throws(() => createSalesCommercialSnapshot({ snapshotId: "snap-3", line: noTerms, capturedAt: "2026-10-01T12:00:00Z" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_terms_required");
});

test("detects totals inconsistent with captured commercial facts", () => {
  const snapshot = createSalesCommercialSnapshot({ snapshotId: "snap-4", line: line(), capturedAt: "2026-10-01T12:00:00Z" });
  const tampered = { ...snapshot, totals: { ...snapshot.totals, grandTotal: snapshot.totals.grandTotal + 1 } };
  assert.equal(verifySalesCommercialSnapshot(tampered), false);
});

test("rejects invalid capture timestamps", () => {
  assert.throws(() => createSalesCommercialSnapshot({ snapshotId: "snap-5", line: line(), capturedAt: "not-a-date" }),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.commercial_snapshot_invalid");
});
