# Phase 22 — Purchase Workflow — Fixed Implementation Plan

## Status

Steps 1–3 are complete on `phase/22-purchase-workflow`. The fixed 24-step sequence remains frozen. Step 4 — Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics — is next.

## Governance

This 24-step sequence is frozen. Step title, order, scope, ownership boundary or exit criteria may change only through an explicitly approved Change Request recorded in this canonical phase file. Owner acceptance and executable validation output are separate evidence; this record never invents command output.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)
- [Roadmap](../../ROADMAP.md)
- [Phase 20 — Inventory Documents](phase-20-inventory-documents-plan.md)
- [Phase 21 — Inventory Valuation](phase-21-inventory-valuation-plan.md)
- [Commercial Pricing and Inventory Valuation Boundary](../architecture/commercial-pricing-and-valuation-boundary.md)
- [Purchase Domain Model](../architecture/purchase-domain-model.md)

## Baseline and Release Target

- Development baseline: `phase/21-inventory-valuation` at `a3ca48df64c64ffd81b1ddf107c082b7ce371e89`.
- Phase 22 is intentionally stacked on the current Phase 21 head and must not be released ahead of required Phase 21 promotion/reconciliation.
- Branch: `phase/22-purchase-workflow`.
- Target version/tag: `0.22.0` / `v0.22.0`.
- Release title: `ArginAccounting v0.22.0 — Purchase Workflow`.
- Tag and GitHub Release publication remain manual repository-owner actions.

## Objective

Phase 22 delivers the operational and commercial Purchase workflow without owning accounting posting. It owns supplier Purchase commercial facts and feeds eligible stock costs to Phase 21 while preserving Phase 20 quantity ownership, future Phase 23 posting ownership and Sales price independence.

## Core Invariants

- Purchase owns normal supplier commercial price; Inventory Valuation does not request duplicate manual price entry for a normal Purchase-linked inbound movement.
- Inventory quantity facts remain owned by Phase 20; Inventory monetary valuation remains owned by Phase 21.
- Phase 23 consumes Purchase facts and valuation outputs; Phase 22 never creates accounting journals directly.
- Services/non-stock purchases do not create Inventory Cost Inputs solely because they are purchased.
- Missing/unknown cost is explicit unresolved state and never implicit zero.
- Corrections and returns are linked compensating facts; confirmed history is not silently rewritten.
- Durable IDs are independent of SQLite row identity and survive future PostgreSQL/.NET and Argin Bridge synchronization.
- Same request/operation/fingerprint must be replay-safe; request reuse with different payload is a conflict.
- Company/Branch/fiscal scope is enforced at Application boundaries and persistence queries.
- Master Data changes after document creation must not mutate historical Purchase supplier/item snapshots.

## Argin Bridge Requirements

Authoritative Purchase facts use durable IDs and persistence-neutral contracts for document/line, supplier, Product/Service, Company/Branch/fiscal scope, Inventory/Valuation linkage, lifecycle/correction references, revisions, request identity and chronology. Historical supplier/item snapshots travel with the Purchase fact and are not reconstructed from mutable remote Master Data. Derived Inventory Valuation state remains rebuildable. Live transport/retry/conflict infrastructure remains Phase 45 scope.

## Phase Boundaries

- **Phase 20 — Inventory Documents:** authoritative quantity movement ownership.
- **Phase 21 — Inventory Valuation:** consumes Purchase-provided authoritative Cost Inputs and owns FIFO/MWA.
- **Phase 23 — Purchase Posting:** owns supplier payable, VAT/purchase journal effects and GRNI/Inventory posting.
- **Phase 24 — Sales Workflow:** owns Sales pricing independently from Purchase price.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Purchase Domain Model | Completed |
| 3 | Supplier, Product, Service and Commercial Snapshots | Completed |
| 4 | Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics | Not started |
| 5 | Purchase Document Types and Lifecycle | Not started |
| 6 | Company, Branch, Fiscal Scope and Numbering | Not started |
| 7 | Purchase Pricing and Totals Engine | Not started |
| 8 | Receipt and Invoice Matching Policy | Not started |
| 9 | Inventory Receipt Integration | Not started |
| 10 | Inventory Valuation Cost Input Integration | Not started |
| 11 | Receipt-Before-Invoice and Cost Resolution Policy | Not started |
| 12 | Purchase Return and Correction Workflow | Not started |
| 13 | Application, Query and Repository Contracts | Not started |
| 14 | Application Services and Transaction Boundaries | Not started |
| 15 | Migration, Schema, Constraints and Indexing | Not started |
| 16 | SQLite Repository and Unit of Work | Not started |
| 17 | Idempotency, Optimistic Concurrency and Replay Safety | Not started |
| 18 | Argin Bridge Purchase Synchronization Contract | Not started |
| 19 | Permissions, Approval, Audit and Traceability | Not started |
| 20 | Persian RTL Purchase Workspace | Not started |
| 21 | Purchase Queries and Operational Reports | Not started |
| 22 | Domain and Application Tests | Not started |
| 23 | SQLite, Migration, Inventory, Valuation, Bridge and Desktop Integration Tests | Not started |
| 24 | Monorepo Validation, Documentation, Final Review and Release | Not started |

## Fixed Execution Sequence and Exit Criteria

### Step 1 — Baseline, Branch, Scope and Plan Freeze
Record the Phase 21-based baseline, create the branch, freeze Purchase ownership/non-scope boundaries, Bridge invariants and this numbered plan.

### Step 2 — Purchase Domain Model
Define persistence-neutral Purchase aggregate roots, headers, lines, durable identities, source/correction references and Product/Service stock/non-stock invariants.

### Step 3 — Supplier, Product, Service and Commercial Snapshots
Snapshot supplier identity/display facts and required Product/Service commercial/unit/tax metadata so later Master Data changes do not rewrite historical Purchase facts.

Exit criteria:

- each Purchase header carries an immutable supplier historical snapshot tied to the same `companyId` and `supplierId`;
- each line carries an immutable Product/Service snapshot tied to the same `itemId`/`itemType`;
- stock/non-stock/service classification is consistent with captured `stockTracking`;
- supplier code/display/classification and relevant identity/tax numbers are captured;
- Product/Service code/display, SKU/reference, 13-digit Taxpayer ID, purchase description, brand/model, stock-tracking and tax metadata are captured;
- default purchase-unit identity/display/Taxpayer unit code is captured without introducing quantity arithmetic;
- prices, quantities, discounts, charges and calculated tax amounts remain outside Step 3;
- rehydration re-validates and freezes the same historical snapshots;
- snapshot factories and aggregate integration are covered by executable tests.

### Step 4 — Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics
Define exact quantity/unit conversion, monetary minor-unit representation, currency identity, line/header discounts, charges, taxable bases, tax amounts and deterministic rounding.

### Step 5 — Purchase Document Types and Lifecycle
Define draft/submitted/approved/confirmed/cancelled/returned/corrected states and supported Purchase document types without accounting postings.

### Step 6 — Company, Branch, Fiscal Scope and Numbering
Enforce Company isolation, Branch visibility, fiscal dates/locks and shared Number Series rules.

### Step 7 — Purchase Pricing and Totals Engine
Implement deterministic line/header totals, discounts, charges, taxes and currency totals without floating point or valuation logic.

### Step 8 — Receipt and Invoice Matching Policy
Define partial/multiple receipt/invoice matching, over/under receipt policy and durable duplicate-safe matching identities.

### Step 9 — Inventory Receipt Integration
Integrate Purchase stock lines with Phase 20 receipt confirmation while preserving Inventory quantity ownership and duplicate prevention.

### Step 10 — Inventory Valuation Cost Input Integration
Map eligible confirmed Purchase stock costs to authoritative Phase 21 Cost Inputs through durable Purchase line + Inventory movement linkage.

### Step 11 — Receipt-Before-Invoice and Cost Resolution Policy
Support unresolved or approved provisional inbound cost followed by controlled supplier-invoice resolution/correction and recalculation; unknown cost is never zero.

### Step 12 — Purchase Return and Correction Workflow
Implement linked returns/corrections and coordinated Inventory/Valuation compensation without rewriting original confirmed history.

### Step 13 — Application, Query and Repository Contracts
Define persistence-neutral commands, queries, DTOs, repositories, UoW, errors, matching and Inventory/Valuation ports.

### Step 14 — Application Services and Transaction Boundaries
Orchestrate validation, numbering, lifecycle, matching, Inventory receipt and Cost Input handoff with explicit transaction boundaries.

### Step 15 — Migration, Schema, Constraints and Indexing
Add versioned SQLite schema for Purchase facts, lifecycle, matching, corrections/returns, revisions, idempotency and indexes.

### Step 16 — SQLite Repository and Unit of Work
Implement SQLite repositories and pinned transaction UoW consistent with Desktop infrastructure.

### Step 17 — Idempotency, Optimistic Concurrency and Replay Safety
Implement durable request fingerprints, expected versions, same-document/matching race protection and replay-safe downstream effects.

### Step 18 — Argin Bridge Purchase Synchronization Contract
Freeze versioned authoritative Purchase envelopes, dependency identities, tombstone/correction and replay-safe linkage semantics.

### Step 19 — Permissions, Approval, Audit and Traceability
Add operation-specific permissions, shared Approval/Audit and trace chains from Purchase line to Inventory movement and Cost Input.

### Step 20 — Persian RTL Purchase Workspace
Deliver Persian RTL Purchase list/detail/editor/matching/return/correction surfaces with Jalali boundaries and shared UI standards.

### Step 21 — Purchase Queries and Operational Reports
Deliver bounded Purchase, supplier, Product/Service, matching, unresolved-cost and trace reports without accounting-report ownership.

### Step 22 — Domain and Application Tests
Cover domain invariants, pricing/totals, lifecycle, scope, matching, stock/non-stock, receipt-before-invoice, returns, idempotency and concurrency.

### Step 23 — SQLite, Migration, Inventory, Valuation, Bridge and Desktop Integration Tests
Cover real SQLite upgrades/rollback/restart, cross-module handoff, Cost Input round-trips, replay prevention, Bridge serialization and Desktop composition.

### Step 24 — Monorepo Validation, Documentation, Final Review and Release
Run all validation gates, reconcile canonical docs, verify deferred scope, merge according to workflow and prepare `v0.22.0`.

## Step Evidence

### Step 1

- Verified canonical phase numbering and stacked Phase 21 baseline.
- Created/realigned `phase/22-purchase-workflow` and froze the 24-step plan plus Purchase/Inventory/Valuation/Posting/Sales ownership boundaries.
- Froze Argin Bridge durable identity and replay-safety requirements before implementation.

### Step 2

- Added persistence-neutral `@argin/purchase` package and Purchase aggregate creation/rehydration.
- Added durable document/line IDs, source/correction references and stock-product/non-stock-product/service classification invariants.
- Added canonical Purchase domain architecture documentation and behavior tests.

### Step 3

- Added immutable `PurchaseSupplierSnapshot` with durable Company/Supplier identity, supplier code/display/classification and relevant Iranian identity/tax fields.
- Added immutable `PurchaseItemSnapshot` for Product/Service code/display, SKU/reference, Taxpayer goods/service ID, purchase description, brand/model, stock-tracking and tax treatment/rate.
- Added immutable default purchase-unit snapshot with unit ID/code/title and Taxpayer unit code while deferring conversion arithmetic to Step 4.
- Bound supplier snapshots to Purchase headers and item snapshots to Purchase lines; durable identity/type mismatches are rejected.
- Enforced stock-line consistency: stock Product snapshots must be stock-tracked; non-stock Product/Service lines cannot claim stock tracking.
- Rehydration validates and freezes historical snapshots again so later Master Data edits cannot rewrite the Purchase fact.
- Added tests for supplier snapshot normalization/immutability, Product commercial/tax/unit metadata, 13-digit Taxpayer ID validation, service stock prohibition and aggregate snapshot mismatch rules.
- TDD RED was observed before implementation (`ERR_MODULE_NOT_FOUND` for the not-yet-created snapshot module).
- Fresh local Node execution after implementation: 8 tests passed, 0 failed across the reconstructed Step 3 Purchase source/test set.
- Source-only strict TypeScript validation completed with exit code 0. Full package typecheck including Node test types was not claimed in the isolated verifier because `@types/node` is not installed there; normal workspace validation remains a later gate.

## Change Requests

None.

## Documentation Impact

This file remains the canonical Phase 22 status/evidence record. `docs/architecture/purchase-domain-model.md` now covers Steps 2–3 including historical Master Data snapshot semantics. Database, security, glossary and broader integration documentation remain owned by later fixed steps.
