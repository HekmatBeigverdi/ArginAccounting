# Purchase Commercial Semantics

Phase 22 Step 4 defines persistence-neutral quantity, unit, currency, price, discount, charge, tax and rounding semantics.

## Quantity and Units

Quantities use canonical positive decimal strings, not floating point. Entered/base quantities and entered/base unit snapshots are preserved. Unit conversion uses exact decimal arithmetic. The base unit has ratio `1`. Quantity rounding supports `half-up`, `down` and `up`.

## Money and Currency

Money uses safe integers in the currency's smallest unit plus an uppercase three-letter ISO code. Negative or unsafe amounts are rejected. Fixed adjustments must use the same currency as unit price. Monetary rounding is `half-away-from-zero`, aligned with the shared Platform Money convention.

## Discounts and Charges

Adjustments are either fixed money amounts or percentage rates stored as integer basis points from 0 to 10,000. Step 4 validates these facts; Step 7 owns ordering, allocation and total calculation.

## Tax

Tax treatment is `unspecified`, `taxable`, `exempt` or `not-subject`. Taxable terms require an integer basis-point rate; other treatments require a null rate. Step 7 calculates tax amounts.

## Lifecycle Boundary

Step 4 defines immutable commercial value objects only. Step 5 decides which lifecycle transitions require complete commercial terms.

## Argin Bridge

Decimal strings, safe-integer money, explicit currency, unit metadata, basis-point rates and rounding rules are serialization-safe authoritative Purchase facts for SQLite Desktop and future PostgreSQL/.NET synchronization.

## Non-Scope

Totals engine is Step 7; Inventory receipt integration is Step 9; valuation Cost Input integration is Step 10; accounting posting is Phase 23.
