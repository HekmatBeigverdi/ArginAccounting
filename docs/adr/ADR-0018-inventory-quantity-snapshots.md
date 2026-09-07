# ADR-0018 — Exact Inventory Quantities and Historical Unit Snapshots

## Status

Accepted for Phase 20 Step 3 within the fixed exact-quantity and historical-unit requirements.

## Context

Inventory quantities must remain deterministic across offline SQLite, future PostgreSQL/.NET adapters and Argin Bridge. Phase 18 Product units expose numeric ratios, precision 0–6 and `half-up`/`down`/`up` rounding. Calling the existing floating-point conversion helper would introduce binary multiplication into stock calculations. Reading current Product units to interpret an old document would change its historical meaning after a unit edit.

## Decision

Represent boundary quantities and copied conversion ratios as canonical decimal strings. Calculate the entered-to-base conversion with BigInt coefficients, powers of ten and one exact quotient/remainder rounding at base-unit precision. Preserve Phase 18 rounding semantics. BigInt remains internal and never appears in JSON snapshots.

Adapt the finite legacy ratio's decimal spelling once; expand supported exponent notation with string operations. Reject unsafe large ratios and unsupported precision explicitly, without changing the Product module or pretending to recover precision already lost upstream.

Store entered/base quantities, both unit identities/labels/codes, ratio, precision, rounding mode and official unit mapping with each operation snapshot. Rehydration recalculates against the stored snapshot and rejects amount drift. It does not consult mutable master data. Current master eligibility is validated separately for new operations and must be rechecked by future authoritative transaction services.

The canonical [Inventory Domain document](../architecture/inventory-documents.md) defines current limits, error behavior and public contracts.

## Consequences

- Quantities above JavaScript's safe-integer limit retain exact digits within the documented decimal bounds.
- Future SQLite/Bridge adapters persist strings rather than serializing BigInt or coercing stock to floating point.
- Product units remain independently owned; this phase consumes their public contracts and preserves historical facts.
- Historical readability and current mutation eligibility are separate operations. A successful historical read is not permission to confirm a new stock effect.
- Full ledger arithmetic, stock policies, transaction atomicity and synchronization processing remain in their fixed later steps.
