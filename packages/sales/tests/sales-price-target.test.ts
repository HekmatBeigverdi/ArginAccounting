import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesPriceList,
  createSalesPriceListTarget,
  isSalesPriceListTargetEligible,
  resolveSalesPriceList,
} from "../src/index.ts";

const item = (id: string, price: number) => ({
  priceListItemId: id, productId: "p",
  revisions: [{ priceRevisionId: id + "-r1", revision: 1, currency: "IRR", unitPrice: price, effectiveFrom: "2026-01-01" }],
});

test("creates explicit targets for all price-list kinds", () => {
  assert.deepEqual(createSalesPriceListTarget("base"), { kind: "base" });
  assert.deepEqual(createSalesPriceListTarget("wholesale"), { kind: "wholesale" });
  assert.deepEqual(createSalesPriceListTarget("customer", { customerPartyId: "party-1" }), { kind: "customer", customerPartyId: "party-1" });
  assert.deepEqual(createSalesPriceListTarget("segment", { customerSegmentId: "vip" }), { kind: "segment", customerSegmentId: "vip" });
});

test("enforces target shape by price-list kind", () => {
  assert.throws(() => createSalesPriceListTarget("customer"), (e: unknown) => e instanceof SalesDomainError);
  assert.throws(() => createSalesPriceListTarget("segment", { customerPartyId: "p" }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_list_target_invalid");
  assert.throws(() => createSalesPriceListTarget("base", { customerPartyId: "p" }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.price_list_target_invalid");
});

test("evaluates base wholesale customer and segment eligibility from pricing context", () => {
  const context = { customerPartyId: "party-1", customerSegmentIds: ["vip"], wholesale: true } as const;
  assert.equal(isSalesPriceListTargetEligible({ kind: "base" }, context), true);
  assert.equal(isSalesPriceListTargetEligible({ kind: "wholesale" }, context), true);
  assert.equal(isSalesPriceListTargetEligible({ kind: "customer", customerPartyId: "party-1" }, context), true);
  assert.equal(isSalesPriceListTargetEligible({ kind: "customer", customerPartyId: "party-2" }, context), false);
  assert.equal(isSalesPriceListTargetEligible({ kind: "segment", customerSegmentId: "vip" }, context), true);
});

test("resolves customer then segment then wholesale then base from real pricing context", () => {
  const mk = (id: string, kind: "base"|"wholesale"|"customer"|"segment", price: number, target?: {customerPartyId?: string; customerSegmentId?: string}) =>
    createSalesPriceList({ priceListId: id, companyId: "c", code: id, name: id, kind, target, items: [item(id, price)] });
  const lists = [
    { priceList: mk("base", "base", 100) },
    { priceList: mk("wholesale", "wholesale", 90) },
    { priceList: mk("segment", "segment", 80, { customerSegmentId: "vip" }) },
    { priceList: mk("customer", "customer", 70, { customerPartyId: "party-1" }) },
  ];
  const customer = resolveSalesPriceList("c", "p", lists, "2026-09-30", "IRR", { customerPartyId: "party-1", customerSegmentIds: ["vip"], wholesale: true });
  assert.equal(customer?.priceListId, "customer");
  const segment = resolveSalesPriceList("c", "p", lists, "2026-09-30", "IRR", { customerPartyId: "party-2", customerSegmentIds: ["vip"], wholesale: true });
  assert.equal(segment?.priceListId, "segment");
  const wholesale = resolveSalesPriceList("c", "p", lists, "2026-09-30", "IRR", { customerPartyId: "party-2", wholesale: true });
  assert.equal(wholesale?.priceListId, "wholesale");
  const base = resolveSalesPriceList("c", "p", lists, "2026-09-30", "IRR", { customerPartyId: "party-2" });
  assert.equal(base?.priceListId, "base");
});
