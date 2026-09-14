# Phase 22 — Purchase Workflow — Fixed Implementation Plan

## Status

Step 1 is complete on `phase/22-purchase-workflow`. The fixed 24-step sequence is frozen. Step 2 — Purchase Domain Model — is next.

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

## Baseline and Release Target

- Development baseline: `phase/21-inventory-valuation` at `a3ca48df64c64ffd81b1ddf107c082b7ce371e89`.
- Baseline note: Phase 21 is not yet promoted to `main`; Phase 22 is intentionally stacked on the current Phase 21 head so Purchase Workflow can consume the valuation contracts already delivered there.
- Promotion rule: Phase 22 must not be released independently ahead of the required Phase 21 promotion/reconciliation.
- Branch: `phase/22-purchase-workflow`.
- Target version/tag: `0.22.0` / `v0.22.0`.
- Release title: `ArginAccounting v0.22.0 — Purchase Workflow`.
- Tag and GitHub Release publication remain manual repository-owner actions.

## Objective

Phase 22 delivers the operational and commercial Purchase workflow without owning accounting posting. It provides supplier-scoped Purchase documents, exact commercial line pricing, discounts/charges/tax/currency semantics, lifecycle and correction rules, stock receipt linkage, authoritative inbound Cost Input delivery to Phase 21 Inventory Valuation, returns, bounded reports, Persian RTL Desktop workflows, durable persistence and Argin Bridge-compatible contracts.

The phase preserves one-entry commercial ownership: normal supplier purchase price is entered in Purchase and is not re-entered manually in Inventory Valuation. For stock items, confirmed Purchase facts are linked to authoritative Inventory receipt/movement facts and supply the authoritative monetary Cost Input consumed by FIFO or Moving Weighted Average. Missing upstream commercial cost remains explicit and never silently becomes zero.

## Explicit Scope

Phase 22 owns:

- supplier-linked Purchase commercial documents and durable source identity;
- Purchase header/line lifecycle and correction chains;
- Product/Service quantity, unit, commercial price, discount, charge, tax and currency facts;
- stock/non-stock/service purchase distinctions;
- linkage to Phase 20 Inventory receipt/movement facts;
- authoritative inbound Cost Input handoff to Phase 21 for stock items;
- receipt-before-invoice and invoice-before/without-stock edge policies;
- Purchase returns and linked compensation semantics;
- idempotency, optimistic concurrency, permissions, Audit and Argin Bridge-ready envelopes;
- Persian RTL Purchase workspace and operational Purchase reports.

## Explicit Non-Scope

The following are outside Phase 22:

- Phase 23 Purchase Posting: supplier payable, purchase/VAT journals, GRNI/Inventory accounting treatment and posting reconciliation;
- Sales Workflow and Sales pricing;
- Treasury settlement, payment/cheque workflows and bank reconciliation;
- changing Phase 21 FIFO/MWA policy or valuation algorithms;
- editing confirmed Phase 20 quantity history;
- using Purchase price as Sales price;
- full live Argin Bridge transport, acknowledgements, distributed retries or remote conflict resolution;
- Taxpayer System invoice projection/submission phases.

## Core Invariants

- Purchase owns normal supplier commercial price; Inventory Valuation does not request duplicate manual price entry for a normal Purchase-linked inbound movement.
- Selling price and supplier purchase price remain separate commercial facts.
- Inventory quantity facts remain owned by Phase 20; confirmed Purchase workflows link to them rather than rewriting them.
- Inventory monetary valuation remains owned by Phase 21; Purchase supplies authoritative Cost Input facts but does not implement FIFO/MWA itself.
- Phase 23 consumes Purchase facts and valuation outputs; Phase 22 never creates accounting journals directly.
- Services/non-stock purchases do not create Inventory Cost Inputs solely because they are purchased.
- Missing/unknown cost is explicit unresolved state and never implicit zero.
- Corrections and returns are linked compensating facts; confirmed historical source facts are not silently mutated.
- Exact quantities use decimal-string semantics from Product/Inventory contracts; monetary values use safe integer/minor-unit semantics with explicit currency and rounding rules.
- Durable IDs are independent of SQLite row identity and must survive future PostgreSQL/.NET and Bridge synchronization.
- Same request/operation/fingerprint replays the durable result; reuse of request identity with different payload is a conflict.
- Company/Branch/fiscal scope is enforced at Application boundaries and persistence queries.
- All multi-write Purchase + Inventory/Valuation handoffs are atomic at the local transaction boundary or use an explicit durable handoff/outbox-style boundary where cross-module transaction ownership makes direct atomicity impossible.

## Argin Bridge Requirements

Phase 22 is Bridge-ready from the Domain/Application boundary rather than being retrofitted later.

Authoritative synchronized Purchase facts must use durable IDs and versioned persistence-neutral contracts for at least:

- purchase document ID and line ID;
- supplier/Party durable ID;
- Product/Service durable ID;
- Company, Branch and fiscal scope;
- inventory receipt/movement linkage identity;
- valuation Cost Input/source identity;
- currency and commercial monetary facts;
- lifecycle/correction/return references;
- entity revision / expected version;
- request ID, operation ID and idempotency fingerprint;
- effective/business chronology and record timestamps;
- origin/source metadata and tombstone semantics where deletion is legally/operationally allowed.

Bridge rules:

- Purchase document/line commercial facts are authoritative in Purchase.
- Inventory movement facts remain authoritative in Inventory.
- Valuation Cost Inputs are authoritative monetary inputs linked to Purchase source identity; derived valuation Entry/Layer/State remains rebuildable Phase 21 state.
- Sync replay must never duplicate a receipt, Cost Input, return or future accounting effect.
- SQLite Desktop and future PostgreSQL/.NET Server implementations must interpret the same versioned Purchase contracts identically.
- Live transport, acknowledgements, dependency queues, distributed retries and remote conflict resolution remain Phase 45 scope.

## Phase Boundaries

### Phase 21 — Inventory Valuation
Consumes Purchase-provided authoritative Cost Inputs for stock inbound movements. Purchase must not duplicate valuation algorithms.

### Phase 23 — Purchase Posting
Consumes Phase 22 commercial facts and Phase 21 valuation outputs. Supplier payable, VAT/purchase accounting and GRNI/Inventory posting are deferred to Phase 23.

### Phase 24 — Sales Workflow
Sales commercial pricing is independent. Purchase price is never promoted into a global Sales price.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Purchase Domain Model | Not started |
| 3 | Supplier, Product, Service and Commercial Snapshots | Not started |
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
Record the Phase 21-based development baseline, create the Phase 22 branch, freeze Purchase ownership/non-scope boundaries, Argin Bridge invariants and this numbered plan.

Exit criteria:

- `phase/22-purchase-workflow` exists from the recorded Phase 21 head;
- canonical Phase 22 plan exists under `docs/phases/`;
- Purchase vs Inventory vs Valuation vs Posting vs Sales ownership is explicit;
- Bridge requirements are defined before Domain implementation;
- Step Status identifies Step 1 as completed and every later step as not started.

### Step 2 — Purchase Domain Model
Define persistence-neutral Purchase aggregate roots, headers, lines, durable identities, source/correction references and invariants for Product, Service and stock/non-stock lines.

### Step 3 — Supplier, Product, Service and Commercial Snapshots
Snapshot supplier identity/display facts and required Product/Service commercial/unit/tax metadata so later Master Data changes do not rewrite historical Purchase facts.

### Step 4 — Quantity, Unit, Currency, Price, Discount, Charge and Tax Semantics
Define exact quantity/unit conversion, monetary minor-unit representation, currency identity, line/header discounts, charges, taxable bases, tax amounts and deterministic rounding.

### Step 5 — Purchase Document Types and Lifecycle
Define draft/submitted/approved/confirmed/cancelled/returned/corrected states and supported Purchase document types without creating accounting postings.

### Step 6 — Company, Branch, Fiscal Scope and Numbering
Enforce Company isolation, Branch visibility, fiscal dates/locks and shared Number Series rules for Purchase documents.

### Step 7 — Purchase Pricing and Totals Engine
Implement deterministic line/header totals, discounts, charges, taxes and currency totals without floating-point arithmetic or hidden valuation logic.

### Step 8 — Receipt and Invoice Matching Policy
Define partial/multiple receipt and invoice matching, over/under receipt policy, duplicate-link prevention and durable matching identities.

### Step 9 — Inventory Receipt Integration
Integrate Purchase stock lines with Phase 20 receipt confirmation contracts while preserving Inventory ownership of quantity movements and preventing duplicate stock effects.

### Step 10 — Inventory Valuation Cost Input Integration
Map eligible confirmed Purchase stock costs to authoritative Phase 21 Cost Inputs using durable Purchase line + Inventory movement linkage, explicit currency/rounding and deterministic correction semantics.

### Step 11 — Receipt-Before-Invoice and Cost Resolution Policy
Support unresolved or explicitly approved provisional inbound cost followed by controlled supplier-invoice resolution/correction and downstream deterministic recalculation; never default unknown cost to zero.

### Step 12 — Purchase Return and Correction Workflow
Implement linked Purchase returns/corrections and coordinated Inventory/Valuation compensation without rewriting original confirmed history.

### Step 13 — Application, Query and Repository Contracts
Define commands, queries, DTOs, repositories, Unit of Work, selectors, errors, matching ports and Inventory/Valuation integration ports independent of SQLite/Tauri.

### Step 14 — Application Services and Transaction Boundaries
Orchestrate validation, numbering, lifecycle, matching, Inventory receipt and Cost Input handoff with explicit atomic/local durable transaction boundaries.

### Step 15 — Migration, Schema, Constraints and Indexing
Add versioned SQLite schema for Purchase headers/lines, monetary facts, lifecycle, matching, corrections/returns, revisions, idempotency and required indexes.

### Step 16 — SQLite Repository and Unit of Work
Implement SQLite repositories and pinned transaction UoW consistent with existing Desktop infrastructure and cross-module integration requirements.

### Step 17 — Idempotency, Optimistic Concurrency and Replay Safety
Implement durable request identity/fingerprint, expected-version checks, same-document/matching race protection and replay-safe downstream Inventory/Valuation effects.

### Step 18 — Argin Bridge Purchase Synchronization Contract
Freeze versioned authoritative Purchase envelopes, dependency identities, tombstone/correction rules and replay-safe Inventory/Valuation linkage semantics.

### Step 19 — Permissions, Approval, Audit and Traceability
Add operation-specific Purchase permissions, shared Approval/Audit integration and trace chains from Purchase line to Inventory movement and Valuation Cost Input.

### Step 20 — Persian RTL Purchase Workspace
Deliver Persian RTL list/detail/editor/matching/return/correction surfaces, Solar Hijri boundaries, LTR codes/amounts where required, loading/empty/error/focus states and stale-version recovery.

### Step 21 — Purchase Queries and Operational Reports
Deliver bounded Purchase document, supplier, Product/Service, receipt/invoice match, unresolved-cost and trace reports without becoming accounting-report ownership.

### Step 22 — Domain and Application Tests
Cover domain invariants, pricing/totals, lifecycle, scope, matching, stock/non-stock rules, receipt-before-invoice, returns, idempotency and concurrency behavior.

### Step 23 — SQLite, Migration, Inventory, Valuation, Bridge and Desktop Integration Tests
Cover real SQLite upgrades/constraints/rollback/restart, cross-module handoff, Cost Input round-trips, duplicate replay prevention, Bridge serialization, Desktop composition and representative query-plan/performance checks.

### Step 24 — Monorepo Validation, Documentation, Final Review and Release
Run full validation gates, reconcile canonical architecture/security/database/glossary docs, update roadmap/changelog/status records, verify deferred scope, merge according to workflow and prepare `v0.22.0`.

## Step Evidence

### Step 1

- Verified canonical `ROADMAP.md`: Phase 22 is Purchase Workflow; Phase 23 is Purchase Posting; Sales Workflow is Phase 24.
- Verified `main` still represents the Phase 20 release baseline while `phase/21-inventory-valuation` contains the active Phase 21 implementation.
- Recorded Phase 21 head `a3ca48df64c64ffd81b1ddf107c082b7ce371e89` as the stacked development baseline for Phase 22.
- Created/realigned `phase/22-purchase-workflow` to that Phase 21 head.
- Froze the 24-step Phase 22 sequence and Purchase/Inventory/Valuation/Posting/Sales ownership boundaries.
- Froze Argin Bridge durable identity, replay-safety and authoritative-vs-derived-state requirements before Purchase Domain implementation.
- No Product/Inventory/Valuation production behavior is changed by Step 1.

## Change Requests

None.

## Documentation Impact

Step 1 adds this canonical Phase 22 record. Cross-cutting Purchase architecture, database, security, glossary and testing documents are created only by the steps that own those concerns; routine per-step evidence files are not created.
