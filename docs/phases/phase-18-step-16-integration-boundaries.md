# Phase 18 Step 16 — Shared Platform and ERP Integration Boundaries

## Status

Completed.

## Scope completed

- Verified Product/Service reuse of existing Company scope, Security permissions, shared Audit, shared database/Unit of Work, optimistic concurrency, bounded queries/selectors, and Gregorian durable metadata.
- Added canonical architecture documentation at `docs/architecture/product-shared-platform-integration.md`.
- Defined Product as company-scoped Master Data; Branch does not own or duplicate Product identity.
- Defined forward-only downstream consumption through durable `productId` / Step 15 selector contracts.
- Defined explicit ownership boundaries with Party, Warehouse, Inventory, Purchases, Sales, Pricing, Taxpayer, Manufacturing, Cost Accounting, Accounting/Posting, and Phase 45 Synchronization.
- Recorded that Product owns definitions/eligibility/master identifiers/unit/tax/operational attributes but not quantities, balances, stock movements, valuation, transaction documents, prices, discounts, postings, BOM/production, cost allocation, or Taxpayer transport workflows.
- Preserved Party and Product as peer Master Data contexts; future documents compose Party and Product references without reverse dependencies from Product.
- Kept price/list-price behavior outside Product. Any future pricing feature must receive an explicit owning module/phase rather than adding mutable transactional price state to Product Master Data.
- Added `packages/product/tests/product-integration-boundary.test.ts` to lock dependency direction, stable Product identity, and absence of downstream transactional fields from the selector/master contract.

## Shared platform decisions

- `companyId` remains the authoritative Product scope.
- Product does not introduce a second Branch model, Security store, Audit store, Approval engine, metadata subsystem, transaction manager, event bus, notification store, or background-job framework.
- Product mutations continue to use `expectedVersion`; SQLite enforces version predicates.
- Product multi-table writes continue through the shared `@argin/database` transaction abstraction.
- Product audit remains a persistence-neutral event mapped into shared Audit in Desktop composition.
- Selector/read boundaries remain bounded; downstream consumers must not use unbounded Product loading.
- Argin Bridge Product sync metadata remains Step 10's contract; network synchronization remains Phase 45.

## Ownership summary

- Product: Product/Service definition and reusable master attributes.
- Party: customer/supplier/person/legal-entity identity and roles.
- Warehouse: warehouse/location master data.
- Inventory: stock quantities, movements, balances, serial/lot state, documents.
- Inventory Valuation: valuation/cost layers.
- Purchases: purchase documents, supplier commercial transaction terms/costs.
- Sales/Pricing: sales documents, price lists/prices/discounts/customer-specific pricing.
- Taxpayer phases: invoice projection, signing, submission, inquiry/correction/network behavior.
- Manufacturing: BOM/routing/production.
- Cost Accounting: cost allocation/calculation/balances.
- Accounting/Posting: accounts, journal vouchers, posting rules and balances.
- Synchronization Phase 45: Bridge transport, acknowledgements, conflict resolution and distributed sync behavior.

## Validation

Focused validation commands:

```bash
pnpm --filter @argin/product test
pnpm --filter @argin/product typecheck
pnpm --filter @argin/product build
```

The assistant runtime does not claim these commands passed because direct local pnpm execution against the repository is not available in the connected GitHub environment. The added tests are repository evidence and local execution remains required.

## Scope exclusions preserved

No Warehouse, Inventory, Purchase, Sales, Pricing, Taxpayer transaction, Manufacturing, Cost Accounting, Posting, network Bridge, or synchronization workflow was implemented in Step 16.

Step 17 is not started by this completion record.
