# Inventory Document Domain Foundation

## Status and Ownership

Phase 20 Step 2 introduces the structural draft model in `@argin/inventory`.
The [fixed phase record](../phases/phase-20-inventory-documents-plan.md) owns step status and validation evidence.

Inventory owns quantity documents and their future stock effects. Product owns master definitions/units; Warehouse owns physical master data; Purchases and Sales own their commercial source workflows. This package has no runtime dependencies on infrastructure or other modules at Step 2.

## Public Model

| Type | Responsibility |
| --- | --- |
| `InventoryDocumentSnapshot` | Immutable draft aggregate with document/company IDs, document type, optional display number, business date, description, source, ordered lines, version and recording timestamps |
| `InventoryDocumentLineSnapshot` | Owned line with durable line ID, display position, Product ID, description and optional source reference |
| `InventoryDocumentType` | `receipt`, `issue`, `opening`, `transfer`, `adjustment` |
| `InventorySourceReference` | Company + source system + source document type + durable document ID + optional durable line ID |
| `InventoryDomainError` | Stable code plus field; consumers never parse prose error messages |

Public factories: `createInventoryDocument`, `createInventoryDocumentLine`, `createInventorySourceReference`; persisted drafts use `rehydrateInventoryDocument`. Public types/constants are exported through `src/index.ts`.

## Identity and Immutability

- IDs are opaque strings, trimmed at the boundary with case and content preserved. They are supplied by callers; Domain never generates random IDs or reads the system clock.
- Document numbers remain strings, preserving leading zeroes. A missing number is `null`; the factory does not allocate a Number Series value or enforce its future uniqueness policy.
- Lines belong to the aggregate. Line IDs and positive safe-integer positions must each be unique within a document. Position gaps are permitted in drafts; output is sorted by position without renumbering/re-identifying lines or mutating caller arrays.
- The same Product ID may occur on multiple distinct lines. Product existence, Company ownership, service/stock eligibility and units are validated by the later owning contracts.
- Header, source references, line objects and line arrays are defensively copied and frozen. Returned snapshots never share mutable child records with caller input.
- Creation starts at version 1 and status `draft`. Rehydration validates a positive safe-integer version and preserves it; it never increments a version or authorizes a mutation.

## Date Contract

`businessDate` is a real Gregorian `YYYY-MM-DD` calendar date, independent of recording time. Invalid days, leap-day rollover and localized input are rejected. UI Jalali conversion belongs at the boundary.

`createdAt` and `updatedAt` require explicit UTC ISO input: `YYYY-MM-DDTHH:mm:ss[.SSS]Z` (one to three fractional digits when present). They normalize to millisecond ISO UTC strings. Implicit local time and numeric-offset inputs are rejected; adapters normalize offsets before invoking Domain. Updated time cannot precede creation time.

These are syntax/calendar invariants only. Fiscal-period eligibility, historical locks and backdated stock effects belong to Steps 4/6 and the transactional services.

## Source References and Argin Bridge

Source references persist durable IDs, never display numbers, product codes or array positions. Header and line sources must match the aggregate Company. `sourceSystem: "inventory"` denotes this bounded context; an Inventory source pointing to the same document ID is rejected. Identical opaque IDs in a different source namespace are not assumed to identify the same entity.

Sources are traceability references, not proof that a source exists or is eligible. They do not perform idempotent delivery, authorization or synchronization. Version, durable header/line identity and UTC metadata support the later [Argin Bridge contract step](../phases/phase-20-inventory-documents-plan.md); source metadata alone does not constitute the final change envelope.

## Deliberate Step Boundaries

- Empty draft line collections are allowed; this model cannot confirm a document or change stock.
- Step 3 adds exact quantity/UoM snapshots and Warehouse/Zone/Location references. The existing Product conversion helper currently uses JavaScript `number`; inspect and adapt precision at that boundary before using it for exact Inventory quantities. Do not silently reuse floating-point multiplication as the stock ledger arithmetic.
- Step 4 adds fiscal/Branch eligibility and numbering orchestration.
- Step 5 adds the lifecycle transition matrix; Step 2 rehydration explicitly rejects non-draft statuses.
- Steps 6–8 add movements, stock policy and transaction workflows. Step 9 adds Application/repository ports, Step 10 orchestration, Step 11 migrations, Step 12 Bridge envelopes and Step 13 SQLite implementation.
- No new permission, migration, database table, event, Desktop screen, valuation or posting behavior is delivered by Step 2.

This foundation follows the existing offline-first, independent Domain and modular ownership ADRs; it does not introduce a new transport or persistence architecture decision.
