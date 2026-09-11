# Inventory Valuation Policy

## Purpose

Phase 21 Step 4 defines how ArginAccounting selects an inventory valuation method for a concrete Product/Warehouse movement without coupling that decision to SQLite, Desktop UI or future server infrastructure.

## Policy hierarchy

A Company policy is mandatory and acts as the default. More specific overrides are resolved in this order:

1. Product + Warehouse
2. Product
3. Warehouse
4. Company default

Product overrides intentionally take precedence over a plain Warehouse override. If a specific Product/Warehouse combination needs a different result, an explicit `product_warehouse` policy must be created rather than relying on ambiguous ordering.

## Effective dates

Every policy has `effectiveFrom`. Resolution uses the business date of the Phase 20 movement, not the local clock or persistence timestamp. Future policies therefore do not alter prior valuation.

Two policies with the same scope, identity and effective date are an overlap and are rejected instead of being resolved by storage order.

## Valuation semantics

A policy carries:

- durable `policyId`;
- `companyId`;
- scope (`company`, `product`, `warehouse`, `product_warehouse`);
- Product/Warehouse references required by the selected scope;
- valuation method (`fifo` or `moving_average`);
- strategy version;
- currency;
- effective date;
- optimistic revision.

Strategy behavior itself remains owned by Step 3.

## Historical change safety

A change to method, strategy version, currency or scope identity is a valuation-semantic change. If valuation history already exists and the proposed effective date intersects that history, the change is rejected unless historical recalculation is explicitly approved.

Approval does not perform recalculation in Step 4. It only returns `requiresRecalculation = true`; Step 9 owns deterministic recalculation execution.

A future-dated semantic change after the latest valued business date is allowed without historical recalculation.

## Argin Bridge implications

Policy resolution is deterministic from authoritative inputs and does not depend on SQLite row ids or insertion order. Bridge-safe requirements are:

- durable policy identity;
- stable Company/Product/Warehouse identity;
- explicit strategy version and currency;
- effective-date semantics based on business date;
- revision for future optimistic concurrency;
- overlap rejection instead of last-write-wins ambiguity;
- historical semantic changes surfaced as recalculation requirements.

Future SQLite and PostgreSQL/.NET implementations must resolve the same policy for the same authoritative policy set and movement context.

## Out of scope

Step 4 does not implement persistence, permissions, UI, recalculation execution, negative-stock policy, purchase costing or posting.
