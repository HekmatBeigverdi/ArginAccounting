# Phase 18 Step 15 — Product/Service Selector and Future Module Consumption Contract

Status: Completed

## Evidence

- Added persistence-neutral `ProductSelectorService` in `@argin/product` with bounded selector requests (`1..100`, default `20`).
- Added explicit consumer usages: `general`, `inventory`, `purchase`, `sales`, `taxpayer`, `manufacturing`, and `cost-accounting`.
- Consumer usages translate to mandatory eligibility constraints without implementing downstream workflows: inventory requires active stock-tracked Products; purchase requires active purchasable records; sales requires active sellable records; taxpayer requires active records with an official Taxpayer goods/service identifier; manufacturing and cost-accounting require active Products; general defaults to active records.
- Caller-provided kind/status/category filters may narrow a usage profile but cannot relax its mandatory constraints. Incompatible intersections produce an empty selector result rather than widening eligibility.
- Added `ProductSelectorOption.durableId` as an explicit alias of canonical `productId`. Display code/title and external identifiers remain metadata and must not be used as foreign identity.
- Added `SecuredProductSelectorService` so every selector query requires `master-data.products.view` in the same company scope before execution.
- Extended selector query contracts with `requiresTaxpayerGoodsServiceId` to support Taxpayer consumers without post-filtering bounded results.
- Added `SqliteProductSelectorReader` in `@argin/product-tauri`. It applies search/capability/status/kind/category/Taxpayer filters in SQL before `LIMIT`, excludes tombstones, remains company-scoped, and returns only selector DTOs.
- Selector search covers code, title, SKU, and Taxpayer goods/service identifier and uses deterministic ordering with exact-code preference followed by title/code/id.
- Exported selector contracts and the SQLite selector adapter from their package public APIs.
- Added focused `packages/product/tests/product-selector.test.ts` coverage for usage profiles, mandatory-filter intersection, durable identity, authorization/company isolation, and selector limit enforcement.
- Added `docs/architecture/product-selector-contract.md` documenting the consumer/adapter boundary and downstream ownership constraints.
- No Warehouse, Inventory, Purchase, Sales, Taxpayer submission, Manufacturing, Cost Accounting, pricing, valuation, posting, Argin Bridge transport, or Phase 45 synchronization workflow was implemented.

## Validation

Local validation remains required because the assistant runtime cannot execute the repository pnpm toolchain against GitHub:

```bash
pnpm --filter @argin/product test
pnpm --filter @argin/product typecheck
pnpm --filter @argin/product build
pnpm --filter @argin/product-tauri test
pnpm --filter @argin/product-tauri typecheck
pnpm --filter @argin/product-tauri build
```

The frozen Phase 18 sequence is unchanged. Step 16 has not started.
