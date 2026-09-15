# Purchase Company, Branch, Fiscal Scope and Numbering

## Status

Phase 22 Step 6 contract for Purchase Company/Branch/Fiscal scoping and document-number request semantics.

## Ownership Boundary

Purchase captures the fiscal context attached to a commercial document, but `@argin/fiscal` remains authoritative for current fiscal-year/period state, historical locks and number reservation.

Purchase must not implement a second Number Series engine. Number reservation is performed through the existing Fiscal application service and its transaction boundary.

## Purchase Scope Snapshot

Every Purchase aggregate carries a frozen `PurchaseDocumentScope` with:

- `companyId`
- `branchId`
- `fiscalYearId`
- `fiscalPeriodId`
- fiscal-year start/end dates
- fiscal-period start/end dates
- captured fiscal-year status
- captured fiscal-period status
- captured `lockedThroughDate` when present

The Company ID in the scope must match the Purchase aggregate Company ID. Branch, fiscal-year and fiscal-period IDs are durable cross-module identities and must not be replaced by SQLite row IDs.

The captured statuses and date boundaries are historical facts for reproducibility and synchronization. They do not replace a fresh authoritative Fiscal check for later mutations or confirmation.

## Business Date Rules

For creation/rehydration of a Purchase fact in Step 6:

- the business date must be valid Gregorian `YYYY-MM-DD` internal storage;
- it must be within the captured fiscal-year range;
- it must be within the captured fiscal-period range;
- the captured fiscal year must be `open`;
- the captured fiscal period must be `open`;
- a captured historical lock blocks dates on or before `lockedThroughDate`.

Application orchestration in Step 14 must re-check the current authoritative Fiscal state before state-changing operations. A historical snapshot must never be used to bypass a newer period close or historical lock.

## Document Number

`PurchaseDocumentSnapshot` carries nullable `documentNumber`.

A nullable number allows the Domain aggregate to exist before the Application layer reserves a number. The actual number is reserved through `@argin/fiscal.generateDocumentNumber`, not generated inside Purchase Domain.

`createPurchaseNumberSeriesRequest(documentType, scope)` produces a request compatible with the existing Fiscal service:

- `companyId`
- `branchId`
- `fiscalYearId`
- `entityType = purchase:<documentType>`

Examples:

- `purchase:purchase-order`
- `purchase:supplier-invoice`
- `purchase:purchase-return`
- `purchase:purchase-correction`

The Fiscal module owns applicability rules, reservation, sequence concurrency and formatting. Step 14 will orchestrate reservation in the appropriate transaction boundary.

## Argin Bridge

Bridge synchronization must carry the durable Purchase scope identities and the assigned document number as authoritative Purchase facts. A receiving node must not reconstruct historical Purchase scope from its current Fiscal master data.

Current Fiscal authority is still checked locally before a new mutation. This separates historical synchronization facts from mutable operational policy and prevents stale remote scope snapshots from overriding a locally closed/locked period.

## Deferred Concerns

- Pricing/totals: Step 7.
- Application numbering orchestration and transaction boundary: Step 14.
- SQLite schema/indexes: Step 15.
- SQLite repository/UoW: Step 16.
- Optimistic concurrency/idempotency: Step 17.
- Full Bridge envelope: Step 18.
- Full integration/monorepo validation: Steps 23–24.
