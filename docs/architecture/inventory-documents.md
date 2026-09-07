# Inventory Document Domain Foundation

## Status and Ownership

Phase 20 Steps 2–4 deliver the draft model, exact quantity/unit snapshots, operational references, scope validation and number reservation in `@argin/inventory`.
The [fixed phase record](../phases/phase-20-inventory-documents-plan.md) owns step status and validation evidence.

Inventory owns quantity documents and their future stock effects. Product owns master definitions/units; Warehouse owns physical master data; Purchases and Sales own their commercial source workflows. The package consumes public `@argin/product` types and the public `@argin/warehouse` operational-reference factory; it has no infrastructure dependency.

## Public Model

| Type | Responsibility |
| --- | --- |
| `InventoryDocumentSnapshot` | Immutable draft aggregate with document/company IDs, document type, optional display number, business date, description, source, ordered lines, version and recording timestamps |
| `InventoryDocumentLineSnapshot` | Owned line with durable line ID, display position, Product ID, description, optional source reference and optional validated operation snapshot |
| `InventoryDocumentType` | `receipt`, `issue`, `opening`, `transfer`, `adjustment` |
| `InventorySourceReference` | Company + source system + source document type + durable document ID + optional durable line ID |
| `InventoryDomainError` | Stable code plus field; consumers never parse prose error messages |

Public factories: `createInventoryDocument`, `createInventoryDocumentLine`, `createInventorySourceReference`; persisted drafts use `rehydrateInventoryDocument`. Public types/constants are exported through `src/index.ts`.

## Identity and Immutability

- IDs are opaque strings, trimmed at the boundary with case and content preserved. They are supplied by callers; Domain never generates random IDs or reads the system clock.
- Document numbers remain strings, preserving leading zeroes. A missing number is `null`; the factory does not allocate a Number Series value or enforce its future uniqueness policy.
- Lines belong to the aggregate. Line IDs and positive safe-integer positions must each be unique within a document. Position gaps are permitted in drafts; output is sorted by position without renumbering/re-identifying lines or mutating caller arrays.
- The same Product ID may occur on multiple distinct lines. Step 3 validates resolved Product identity, Company, stock eligibility and units through `createInventoryLineOperation`; authoritative reads and transaction-time rechecks remain later Application responsibilities.
- Header, source references, line objects and line arrays are defensively copied and frozen. Returned snapshots never share mutable child records with caller input.
- Creation starts at version 1 and status `draft`. Rehydration validates a positive safe-integer version and preserves it; it never increments a version or authorizes a mutation.

## Date Contract

`businessDate` is a real Gregorian `YYYY-MM-DD` calendar date, independent of recording time. Invalid days, leap-day rollover and localized input are rejected. UI Jalali conversion belongs at the boundary.

`createdAt` and `updatedAt` require explicit UTC ISO input: `YYYY-MM-DDTHH:mm:ss[.SSS]Z` (one to three fractional digits when present). They normalize to millisecond ISO UTC strings. Implicit local time and numeric-offset inputs are rejected; adapters normalize offsets before invoking Domain. Updated time cannot precede creation time.

These are syntax/calendar invariants only. Current fiscal-period eligibility and historical locks are checked by Step 4 scope validation; backdated stock effects remain Step 6 and transactional service responsibilities.

## Source References and Argin Bridge

Source references persist durable IDs, never display numbers, product codes or array positions. Header and line sources must match the aggregate Company. `sourceSystem: "inventory"` denotes this bounded context; an Inventory source pointing to the same document ID is rejected. Identical opaque IDs in a different source namespace are not assumed to identify the same entity.

Sources are traceability references, not proof that a source exists or is eligible. They do not perform idempotent delivery, authorization or synchronization. Version, durable header/line identity and UTC metadata support the later [Argin Bridge contract step](../phases/phase-20-inventory-documents-plan.md); source metadata alone does not constitute the final change envelope.

## Deliberate Step Boundaries

- Empty draft line collections are allowed; this model cannot confirm a document or change stock.
- Step 3 adds the quantity and physical-reference contracts below. A draft may keep `operation: null` while incomplete; supplying an operation requires complete, validated quantity/reference structure. A future confirmation service must reject incomplete lines.
- Step 4 provides fiscal/Branch eligibility and shared number reservation; durable orchestration remains in later services.
- Step 5 adds the lifecycle transition matrix; Step 2 rehydration explicitly rejects non-draft statuses.
- Steps 6–8 add movements, stock policy and transaction workflows. Step 9 adds Application/repository ports, Step 10 orchestration, Step 11 migrations, Step 12 Bridge envelopes and Step 13 SQLite implementation.
- No new permission, migration, database table, event, Desktop screen, valuation or posting behavior is delivered by Steps 2–3.

This foundation follows the existing offline-first, independent Domain and modular ownership ADRs; it does not introduce a new transport or persistence architecture decision.

## Exact Quantities and Unit Snapshots

[ADR-0018](../adr/ADR-0018-inventory-quantity-snapshots.md) records the representation decision. Public entry points are `normalizeInventoryQuantity`, `createInventoryQuantitySnapshot` and `rehydrateInventoryQuantitySnapshot`.

- Quantity inputs are decimal strings, with at most 36 integer places and 18 significant fractional places; raw text is bounded to 128 characters. Exponent/localized/comma input is rejected at Domain; UI normalization is a boundary concern. Canonical strings remove redundant leading/trailing zeros and negative zero.
- Selected-unit input precision must respect Phase 18 precision (0–6). Zero entered quantities and conversions rounding to zero are rejected. Negative quantities are supported for quantity adjustments; receipt/issue/opening/transfer documents reject negative operation quantities.
- Unit snapshots copy durable unit ID, display code/title, decimal ratio, precision, rounding mode and official Taxpayer unit mapping for both entered and base units. Base ratio must be 1; duplicate unit IDs/codes and invalid profiles are rejected.
- Conversion performs exact coefficient multiplication and rounds once at base-unit precision. `down` truncates toward zero, `up` rounds away from zero, `half-up` rounds nearest with ties away from zero, matching Phase 18 for both signs.
- Legacy numeric Product ratios are converted from their decimal spelling; exponent spelling is expanded without float multiplication. Ratios above `Number.MAX_SAFE_INTEGER` or outside decimal bounds are rejected. Already-lost upstream precision cannot be reconstructed.
- Example: 2.5 boxes at ratio 12 records entered `2.5`, base `30`. Changing the Product ratio to 24 gives a new operation base `60`, while the earlier snapshot still rehydrates as `30`.
- Rehydration recomputes base quantity from stored units and rejects inconsistent stored amounts. All nested snapshots are copied/frozen and JSON-safe. This detects internal arithmetic drift; it is not a cryptographic authenticity check.

## Operational Reference Validation

`createInventoryLineOperation` consumes a current resolved Product projection, requested Warehouse references and resolved Warehouse/Zone/Location projections. The projection types derive from public Product/Warehouse DTOs; callers must resolve them through Company-scoped upstream readers excluding tombstones.

Products must match the requested durable ID/Company, have a positive version, be active physical products, have stock tracking enabled and a unit profile. Services, inactive/deleted/non-stock products are rejected. Products requiring serial, lot or shelf-life tracking are explicitly unavailable in this quantity-only phase until those deferred tracking capabilities are supported; their requirements are never silently dropped.

`validateInventoryWarehouseReference` checks requested durable IDs against resolved current masters, Company equality, active/non-deleted status and Warehouse → Zone → Location ancestry. Warehouse-only and Warehouse+Zone references are supported; a Location requires its Zone. Unexpected resolved children and missing/mismatched parents fail. The stored reference uses the public Warehouse contract and contains no mutable display code/title.

An optional transfer destination is validated independently in the same Company and must differ from the source stock position. Draft document composition requires a destination for populated transfer operations and rejects destinations on other document types. This defines reference structure only; transfer posting and conservation are implemented in Step 8.

The operation snapshot stores Company, Product ID/version, historical quantity/unit snapshot, source Warehouse reference and optional destination. The containing line must match Product identity; the document must match Company. `rehydrateInventoryLineOperation` validates historical structure/conversion without consulting today's masters, so later inactivity does not prevent reading history.

## Authoritative Write Boundary

Historical rehydration and the structural document factories do not establish current master eligibility. Later Application services must resolve actual masters and revalidate their current eligibility under the committing transaction; never trust caller-provided master projections or treat rehydration as authorization. Branch access and fiscal eligibility use the Step 4 helper; stock confirmation, guards, persistence and Bridge envelopes remain in their existing owning steps.

## Company, Branch and Fiscal Scope

`InventoryDocumentScope` stores `branchId`, `destinationBranchId`, `fiscalYearId` and `fiscalPeriodId`. The whole scope can be null on an incomplete draft; `validateInventoryDocumentScope` requires a complete scope for current eligibility. A null origin means Company-wide scope. A null destination means reuse the origin Branch; an explicit destination is accepted only for transfers. Literal `*` and empty scope IDs are prohibited because the shared numbering key reserves a missing-component marker.

`InventoryScopeReaders` consumes public Company, Branch, Fiscal Year, Fiscal Period, Historical Lock and Warehouse reader contracts. `InventoryScopeContext` is trusted authenticated context, never a client-provided authorization assertion. Company selection must match the document. The Company and both effective Branches must be active and owned by that Company. Actor Branch membership is required at both ends; `system.full-access` bypasses membership only. Cross-Branch transfers require explicit trusted `allowCrossBranchTransfers: true`; cross-Company transfers are excluded. Company-wide warehouses can serve an authorized Branch; Branch-specific warehouses must match the corresponding endpoint. Scope checks capture document and actor data before asynchronous reads.

The selected Company-owned fiscal year must be open with no closure timestamp. Its open period must belong to that year and remain within the year's date interval; both intervals include the business date. Active Company-wide and applicable endpoint Branch locks for `inventory` or `all` reject dates up to and including `lockedThroughDate`. Unrelated locks do not block the operation. Current eligibility is separate from historical rehydration.

## Shared Number Reservation

`reserveInventoryDocumentNumber` validates current scope before calling the public Platform `NumberSeries`. `DEFAULT_INVENTORY_NUMBER_SERIES_DEFINITIONS` provides `inventory.receipt`, `inventory.issue`, `inventory.opening`, `inventory.transfer` and `inventory.adjustment`, starting at 1, incrementing by 1 and padding to six digits. Definitions are supplied to the shared engine by composition; no independent Inventory counter exists.

Uniqueness is scoped by Company + fiscal year + origin Branch (omitted for Company-wide) + document type. Fiscal period and destination Branch are not counter dimensions. Identical display numbers across different scopes are valid. The helper rejects already-numbered documents and mismatched provider scope/type or invalid sequence/format, returns a frozen reservation, and does not modify or save the document.

Steps 10–13 must enforce durable document uniqueness in this same scope, bind readers and number storage to the committing UoW, look up idempotency before allocation and roll back failed reservation/save transactions. The in-memory concurrency test verifies the shared allocator contract only; it does not establish SQLite atomicity, gapless numbering or retry safety. Supplied number strings on structural/historical drafts are not proof of an authorized reservation.

For Argin Bridge, preserve scope and stable document/line/source IDs independently of display numbering. Future Bridge mutations must obtain trusted context server-side and pass the same authoritative services; they must not treat supplied snapshots as permission or replay authority. Formal envelopes remain Step 12.
