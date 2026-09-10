# Phase 20 — Inventory Documents — Fixed Implementation Plan

## Status

Completed and owner-accepted. All 22 fixed steps are complete. Phase 20 is authorized for promotion from `phase/20-inventory-documents` to `develop` and then `main`. Semantic tag `v0.20.0` and the GitHub Release remain explicit repository-owner actions.

## Governance

This 22-step sequence is frozen. Titles, order, scope and exit criteria changed only through an explicitly approved Change Request; none were required in Phase 20. Owner acceptance and raw executable output remain distinct evidence. Where command output was not pasted into the conversation, this record does not fabricate it.

Mandatory references:

- [Documentation Governance](../development/documentation-governance.md)
- [GitHub Publishing Workflow](../development/github-publishing-workflow.md)
- [Phase Definition of Done](../development/phase-definition-of-done.md)
- [Contributing](../../CONTRIBUTING.md)

## Baseline and Release Target

- Planning baseline: `develop` at `3f20840a2617873be7f954db99f4da52ce61b6c7`.
- Phase branch: `phase/20-inventory-documents`.
- Target version/tag: `0.20.0` / `v0.20.0`.
- Release title: `ArginAccounting v0.20.0 — Inventory Documents`.
- Tag and GitHub Release publication remain manual owner actions.

## Objective and Delivered Scope

Phase 20 delivers the offline quantity-document foundation for receipt, issue, opening, atomic transfer and reasoned quantity adjustment documents; controlled lifecycle and reversal; immutable stock movements; rebuildable on-hand balances; quantity Kardex; Persian RTL Desktop workspace; Draft-only import, Excel export and Print/PDF; Warehouse dependency guards; and persistence-neutral ERP/Argin Bridge contracts.

The implementation preserves durable document/line/movement/transfer/reversal identities, exact decimal quantity strings, Company/Branch/fiscal scope, Product unit snapshots, shared Approval/Audit integration, idempotency, optimistic concurrency, pinned SQLite transactions, deterministic business chronology and future Argin Bridge compatibility.

## Deferred Scope

The following remain intentionally outside Phase 20:

- Phase 21: FIFO/moving-average valuation, cost layers, landed cost and monetary valuation reports.
- Later Purchase/Sales/Manufacturing phases: commercial document ownership and source workflows.
- Accounting posting and Posting Rules.
- Reservations and Available-to-Promise.
- Full stock-count sessions.
- Lot/serial/expiry tracking.
- Two-stage/in-transit transfer logistics.
- Live Argin Bridge transport, acknowledgements, retries, remote conflict resolution and PostgreSQL/.NET synchronization implementation.

## Architecture and Core Invariants

- `@argin/inventory` owns Domain/Application; `@argin/inventory-tauri` owns SQLite/shared Desktop adapters.
- Durable IDs survive future stores and Bridge transport; display numbers, codes and SQLite row positions are never foreign identity.
- Exact quantities and balances are decimal strings; floating-point arithmetic is forbidden for inventory quantity semantics.
- Product unit/conversion metadata is snapshotted so later Master Data edits cannot rewrite history.
- Only confirmation affects stock; Approval and Confirmation remain separate authorities.
- Stock-changing work executes inside one `InventoryUnitOfWork.execute(...)` boundary. Production SQLite uses one pinned SQLx connection with `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`.
- Same Company/request/operation/fingerprint replays the durable outcome; changed payload under the same request identity is an idempotency conflict.
- Ordinary movements and reversal compensations are append-only. `inventory_all_stock_movements` is the authoritative logical quantity ledger.
- `inventory_stock_balances` is a rebuildable projection and is not synchronized as an independent authoritative fact.
- Kardex chronology is `businessDate -> businessOrder -> documentId -> lineId -> movementId`.
- Default negative-stock policy validates every historical running point, including backdated operations.
- Transfer source/destination effects conserve base quantity and are indivisible. Reversal appends linked compensating facts rather than rewriting history.
- Company isolation and Branch visibility apply to documents, selectors, reports and source drill-down.
- Warehouse/Zone/Location maintenance consumes the Inventory dependency guard through Desktop composition without reversing module dependency direction.
- Future ERP modules consume public Inventory quantity-confirmation ports; Phase 21 consumes immutable movement facts.

## Canonical Records

- [Inventory Documents Module](../modules/inventory-documents.md)
- [Inventory Document Domain Foundation](../architecture/inventory-documents.md)
- [Inventory Application Contracts](../architecture/inventory-application-contracts.md)
- [Inventory Application Services](../architecture/inventory-application-services.md)
- [Inventory SQLite Persistence](../architecture/inventory-sqlite-persistence.md)
- [Inventory Transfer, Adjustment and Reversal](../architecture/inventory-transfer-adjustment-workflows.md)
- [Inventory Argin Bridge Contract](../architecture/inventory-argin-bridge-contract.md)
- [Inventory Master Data and ERP Integration](../architecture/inventory-master-data-erp-integration.md)
- [Inventory Desktop Workspace](../architecture/inventory-desktop-workspace.md)
- [Inventory Quantity Reports](../architecture/inventory-quantity-reports.md)
- [Inventory Security, Approval and Audit](../security/inventory-security-approval-audit.md)
- [Inventory Glossary](../glossary/inventory-glossary.md)
- [Database Dictionary](../database/database-dictionary.md)
- [Phase 20 Domain/Application Tests](../testing/phase-20-domain-application-tests.md)
- [Phase 20 SQLite/Desktop Integration Tests](../testing/phase-20-sqlite-desktop-integration-tests.md)
- [Phase 20 Performance/Accessibility/Quality Evidence](../testing/phase-20-performance-accessibility-quality.md)
- [Phase 20 Release Notes](phase-20-release-notes.md)

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, Scope and Plan Freeze | Completed |
| 2 | Inventory Document Domain Model | Completed |
| 3 | Quantity, Units and Operational References | Completed |
| 4 | Company, Branch, Fiscal Scope and Numbering | Completed |
| 5 | Document Lifecycle, Approval and Correction Rules | Completed |
| 6 | Stock Movement Ledger and Balance Rules | Completed |
| 7 | Receipt, Issue and Opening Balance Workflows | Completed |
| 8 | Atomic Transfer and Quantity Adjustment Workflows | Completed |
| 9 | Application, Query and Repository Contracts | Completed |
| 10 | Application Services, Idempotency and Concurrency | Completed |
| 11 | Migration, Schema, Constraints and Indexing | Completed |
| 12 | Argin Bridge and Future Synchronization Contract | Completed |
| 13 | SQLite Repository, Unit of Work and Atomic Confirmation | Completed |
| 14 | Permissions, Audit and Shared Approval Integration | Completed |
| 15 | Master Data Dependency Guards and ERP Integration | Completed |
| 16 | Persian RTL Inventory Document Workspace | Completed |
| 17 | Quantity Kardex, Stock Balances and Source Drill-down | Completed |
| 18 | Import, Export, Print and PDF | Completed |
| 19 | Domain and Application Tests | Completed |
| 20 | SQLite, Migration and Desktop Integration Tests | Completed |
| 21 | Performance, Accessibility, Quality and Documentation | Completed |
| 22 | Final Review, Merge and Release Preparation | Completed |

## Fixed Execution Sequence and Exit Criteria

### Step 1 — Baseline, Branch, Scope and Plan Freeze
Record baseline, create the phase branch, reconcile prior phase status and freeze this numbered plan.

### Step 2 — Inventory Document Domain Model
Define immutable header/line identities and receipt, issue, opening, transfer and adjustment types; separate business date, record timestamp, display number and durable source references.

### Step 3 — Quantity, Units and Operational References
Use exact decimal quantities and Product conversion rules; snapshot entered/base quantities, unit identity and conversion; validate eligible Product and Warehouse/Zone/Location references.

### Step 4 — Company, Branch, Fiscal Scope and Numbering
Enforce Company isolation, Branch access, fiscal-period/date rules and shared Number Series uniqueness. Cross-Company transfers are excluded.

### Step 5 — Document Lifecycle, Approval and Correction Rules
Implement draft/submitted/approved/confirmed/cancelled/reversed transitions. Approval alone has no stock effect; confirmed facts are corrected only by linked reversal.

### Step 6 — Stock Movement Ledger and Balance Rules
Define append-only signed base-unit movement facts and rebuildable balances. Reject negative historical running balance by default and never use floating point.

### Step 7 — Receipt, Issue and Opening Balance Workflows
Implement quantity receipt/issue/opening workflows with eligibility/stock revalidation and fiscal opening uniqueness.

### Step 8 — Atomic Transfer and Quantity Adjustment Workflows
Implement conserving source/destination transfer effects, signed reasoned adjustments and linked append-only reversal behavior with rollback safety.

### Step 9 — Application, Query and Repository Contracts
Define persistence-neutral commands, bounded readers, repositories, UoW, errors, selectors and future ERP source-consumer contracts.

### Step 10 — Application Services, Idempotency and Concurrency
Orchestrate validation, numbering, lifecycle and confirmation with durable request fingerprints, expected versions, transaction-scoped stock validation and same-StockKey race protection.

### Step 11 — Migration, Schema, Constraints and Indexing
Create migration `0026_inventory_documents.sql` with scoped keys, exact quantity encoding, versions, tombstones, movement/opening/balance/business-order/idempotency persistence and indexes.

### Step 12 — Argin Bridge and Future Synchronization Contract
Freeze versioned durable document/movement envelopes, Company scope, idempotency metadata and indivisible transfer/reversal semantics. Derived balance is not authoritative sync state.

### Step 13 — SQLite Repository, Unit of Work and Atomic Confirmation
Implement SQLite repositories and real pinned-connection transaction UoW. Migration `0027_inventory_reversal_persistence.sql` adds compensation storage and the unified movement view.

### Step 14 — Permissions, Audit and Shared Approval Integration
Implement independent view/create/edit/submit/approve/confirm/reverse/cancel/import/export permissions, Company/Branch enforcement and shared Approval/Audit integration with replay-safe identities.

### Step 15 — Master Data Dependency Guards and ERP Integration
Implement Inventory probes for nonzero stock, open documents and historical references; protect Warehouse/Zone/Location maintenance; expose secured ERP confirmation and Phase 21 movement-feed contracts.

### Step 16 — Persian RTL Inventory Document Workspace
Deliver Persian RTL list/detail/line editor, Jalali boundary, LTR codes/quantities, selectors, lifecycle actions, approval/history and stale-version recovery.

### Step 17 — Quantity Kardex, Stock Balances and Source Drill-down
Deliver Product aggregate and Warehouse/Zone/Location quantity views, bounded exact Kardex with opening/in/out/closing reconciliation and durable source document/line drill-down.

### Step 18 — Import, Export, Print and PDF
Deliver preview/validation and retry-safe Draft-only import, Excel export and full-screen RTL Print/PDF with matching preview/output orientation.

### Step 19 — Domain and Application Tests
Cover lifecycle/approval, exact conversion, scope, negative/backdated rules, opening uniqueness, transfer conservation, reversal, idempotency, optimistic races, dependency policy and Bridge invariants.

### Step 20 — SQLite, Migration and Desktop Integration Tests
Cover real SQLite migration/upgrade, constraints, atomic rollback, restart durability, balance rebuild, transfer/reversal indivisibility, Company isolation, import/export and Desktop/guard composition.

### Step 21 — Performance, Accessibility, Quality and Documentation
Validate representative large movement data with bounded queries and `EXPLAIN QUERY PLAN`; protect Persian RTL/accessibility and exact-quantity UI conventions; define focused + monorepo + Rust gates; regenerate/check documentation and reconcile canonical architecture/database/security/glossary/module records.

### Step 22 — Final Review, Merge and Release Preparation
Reconcile owner acceptance and deferred scope, verify the phase branch descends from the Phase 19 `develop` baseline, prepare release documentation and promote phase -> develop -> main. Tag and GitHub Release remain manual owner actions.

## Final Acceptance Record

The repository owner explicitly accepted Steps 1–21 and requested finalization of Step 22 with only Tag/Release creation left manual. Step 22 therefore performs release-state reconciliation and authorized promotion; it does not introduce new functional scope.

The Phase 20 quality gate is defined as:

```bash
pnpm docs:index
pnpm validate:phase20
```

It includes focused Inventory/Warehouse/Desktop checks, real Rust/SQLite integration and performance tests, documentation-link validation, `cargo check`, and full monorepo typecheck/test/build/lint gates. Step 21 owner acceptance is recorded without inventing raw command output that was not pasted into this conversation.

## Release Preparation

Release identity:

- Version: `0.20.0`
- Tag: `v0.20.0`
- Release title: `ArginAccounting v0.20.0 — Inventory Documents`
- Release notes: [Phase 20 Release Notes](phase-20-release-notes.md)

Promotion is authorized in this Step 22. The repository owner performs only the semantic Tag and GitHub Release publication manually after `main` contains the completed phase.

## Next Phase

Phase 21 — Inventory Valuation consumes the immutable Phase 20 movement ledger and source/reversal/transfer identities. It must not rewrite Phase 20 quantity facts.

## Change Requests

None.