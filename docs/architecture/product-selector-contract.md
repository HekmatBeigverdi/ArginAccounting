# Product/Service Selector Contract

## Status

Phase 18 Step 15 contract.

## Purpose

Future ERP modules must reference Product/Service master data through stable durable identity without depending on React, Tauri, SQLite rows, or display codes as foreign keys.

The canonical consumption path is:

`Consumer module -> SecuredProductSelectorService -> ProductSelectorService -> selector reader adapter`

The SQLite desktop implementation is `SqliteProductSelectorReader`. Future PostgreSQL, HTTP, or Argin Bridge implementations may replace that adapter without changing consumer contracts.

## Durable identity

`productId` is the canonical foreign identity. `code`, `title`, SKU, Taxpayer identifiers, and unit references are display/integration metadata and must not be used as relational identity.

`ProductSelectorOption.durableId` is an explicit alias of `productId` to make this constraint visible to consumers.

## Bounded behavior

Selector requests are bounded to 1..100 rows with a default of 20. There is no unbounded find-all selector API.

Search and filters execute before LIMIT. SQLite search covers display code, title, SKU, and Taxpayer goods/service identifier.

## Consumer profiles

The Application selector translates usage profiles into mandatory constraints:

- `general`: active records.
- `inventory`: active Products with stock tracking enabled.
- `purchase`: active records that are purchasable.
- `sales`: active records that are sellable.
- `taxpayer`: active records with an official Taxpayer goods/service identifier.
- `manufacturing`: active Products.
- `cost-accounting`: active Products.

Callers may narrow kinds, statuses, or categories but cannot relax mandatory profile constraints. An incompatible narrowing resolves to an empty result set.

These profiles define selection eligibility only; they do not implement Inventory, Purchase, Sales, Taxpayer, Manufacturing, or Cost Accounting workflows.

## Security

`SecuredProductSelectorService` requires `master-data.products.view` in the same company scope before querying. A mismatched authorization/request company is rejected.

## Adapter boundary

Consumers depend only on `@argin/product` selector contracts. `@argin/product-tauri` owns SQLite SQL and applies filters before the bounded LIMIT.

No network synchronization, pricing, stock quantity, valuation, document, posting, or Taxpayer submission behavior is part of the selector contract.
