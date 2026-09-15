# Purchase Receipt and Invoice Matching Policy

Phase 22 Step 8 defines the persistence-neutral policy that relates confirmed supplier-invoice lines to confirmed Inventory receipt lines without creating Inventory movements or valuation facts itself.

## Matching Grain

Matching is line-level and uses durable identities. Each match is an immutable fact with its own `matchId`, Purchase invoice document/line IDs, Inventory receipt document/line IDs, Product ID and matched base quantity.

## Eligibility

Only a `supplier-invoice` line whose Purchase document is `confirmed` may be matched. The Inventory side must be a `receipt` line whose Inventory document is `confirmed`. Draft, submitted, approved, cancelled or reversed/non-receipt Inventory facts are not eligible for matching.

## Quantity Basis

Matching uses canonical positive `baseQuantity` strings. This deliberately decouples matching from entered units: an invoice may be entered in cartons while the receipt is entered in pieces, but both are compared in the shared Product base unit.

## Invariants

- Company must match across invoice and receipt references.
- Product must match across invoice and receipt lines.
- `matchId` is durable and unique within the matching fact set.
- The same invoice-line/receipt-line pair cannot be inserted twice.
- Cumulative matches for one invoice line cannot exceed its invoice base quantity.
- Cumulative matches for one receipt line cannot exceed its receipt base quantity, even when that receipt line is considered by more than one invoice line.
- Invalid, zero or negative match quantities are rejected.

## Matching Status

Invoice-line matching status is derived, never manually stored as authority:

- `unmatched`: matched quantity is zero.
- `partially-matched`: matched quantity is positive but below invoice quantity.
- `fully-matched`: matched quantity equals invoice quantity.

The summary also exposes invoice base quantity, matched quantity, remaining quantity and match count.

## Argin Bridge

Each match is an independent durable fact suitable for later sync/idempotency handling. Quantity is serialized as a canonical decimal string and all references use durable cross-store IDs. Derived matching status is rebuildable and should not be synchronized as an authoritative mutable state.

## Boundaries

Step 8 defines matching policy only. Step 9 owns actual Inventory receipt integration, Step 10 owns valuation Cost Input integration, Step 11 owns receipt-before-invoice cost-resolution behavior, and Step 15/16 own persistence.
