# Module Registry

This registry is the canonical inventory of ArginAccounting modules. Update it whenever a module is introduced, renamed, split, merged, deprecated, or released.

| Module | Package/Runtime | Status | Owning Phase | Canonical Documentation |
|---|---|---|---:|---|
| Company and Branch | `@argin/company`, `@argin/company-tauri` | Implemented | 05 | `docs/phases/phase-05-company-branch.md` |
| Fiscal Management | `@argin/fiscal`, `@argin/fiscal-tauri` | Implemented | 06 | `docs/phases/phase-06-fiscal-management.md` |
| Security | `@argin/security`, `@argin/security-tauri` | Implemented | 07 | `docs/security/security-model.md` |
| Audit and Approval | `@argin/audit`, `@argin/audit-tauri` | Implemented | 08 | `docs/phases/phase-08-audit-approval.md` |
| Platform Infrastructure | `@argin/platform`, `@argin/platform-tauri` | Implemented | 09 | `docs/phases/phase-09-platform-infrastructure.md` |
| Accounting — Chart of Accounts | `@argin/accounting`, `@argin/accounting-tauri`, Desktop | Implemented | 10 | `docs/phases/phase-10-chart-of-accounts.md` |
| Accounting Dimensions | `@argin/accounting`, `@argin/accounting-tauri`, Desktop | Implemented | 11 | `docs/phases/phase-11-accounting-dimensions.md` |
| Coding Templates | `@argin/accounting`, `@argin/accounting-tauri`, `@argin/database-tauri`, Desktop | Implemented | 12 | `docs/phases/phase-12-coding-templates.md` |
| Inventory Documents | `@argin/inventory`, `@argin/inventory-tauri`, Desktop | Implemented; Phase 20 Step 21 quality gate pending validation | 20 | [Inventory Documents Module](../modules/inventory-documents.md) |
| Purchase Workflow | `@argin/purchase`, `@argin/purchase-tauri` | Implemented through Phase 22 | 22 | [Phase 22 Purchase Workflow](../phases/phase-22-purchase-workflow-plan.md) |
| Purchase Posting | `@argin/purchase-posting` | Controlled posting reversal implemented through Phase 23 Step 17 | 23 | [Purchase Posting Domain Model](../architecture/purchase-posting-domain-model.md) |

## Inventory Documents — Phase 20 Current State

- Purpose/ownership: quantity receipt, issue, opening, transfer and adjustment documents; controlled lifecycle; immutable quantity movements; rebuildable on-hand projection; quantity Kardex and source drill-down.
- Domain/Application: `packages/inventory` owns exact quantities/unit snapshots, workflows, Application ports/services, idempotency/concurrency, secured lifecycle and Argin Bridge contracts.
- SQLite/Desktop adapter: `packages/inventory-tauri` owns repositories, `SqliteInventoryUnitOfWork`, reporting/feed readers, import/export codecs and Inventory-backed Warehouse dependency guard.
- Migrations: `0026_inventory_documents.sql` defines primary persistence and `0027_inventory_reversal_persistence.sql` adds append-only reversal compensation plus `inventory_all_stock_movements`.
- Transaction boundary: production `@argin/database-tauri` uses a pinned SQLx SQLite connection and `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` for stock-changing UoW execution.
- Permissions: independent view/create/edit/submit/approve/confirm/reverse/cancel/import/export rights with Company/Branch enforcement; confirmation requires shared Approval.
- Desktop: Persian RTL document workspace, aggregate and detailed quantity views, Kardex, Draft import, Excel export and Print/PDF are integrated.
- ERP: future Purchase/Sales/Manufacturing modules use public quantity-confirmation ports; Phase 21 valuation consumes immutable movement feed. Neither writes Inventory tables directly.
- Bridge: durable document/line/movement/transfer/reversal identities are synchronization identities; derived balance projections are not independently authoritative.
- Quality: Phase 20 includes real SQLite migration/rollback/restart/rebuild tests, Desktop integration contracts, bounded readers, accessibility regression gates and representative query-plan tests.

## Purchase Workflow — Phase 22 Current State

- Purpose/ownership: supplier Purchase documents, commercial terms, receipt/invoice matching, Purchase-backed Inventory Cost Input provenance, return/correction workflows and Purchase operational queries.
- Domain/Application: `packages/purchase` owns Purchase Domain facts, Application contracts/services and Inventory/Valuation integration boundaries.
- SQLite adapter: `packages/purchase-tauri` owns the four Purchase repositories and `SqlitePurchaseUnitOfWork`.
- Migrations: `0030_purchase_workflow.sql` defines primary Purchase persistence; `0031_purchase_scope_snapshot.sql` completes the captured historical Fiscal scope required for rehydration.
- Transaction boundary: all Purchase repositories in one UoW use the same transaction-bound `DatabaseSession`; production Desktop uses the pinned SQLite transaction guarantee from `@argin/database-tauri`.
- Inventory ownership: Purchase may read confirmed receipt/movement facts but never writes Inventory tables directly; quantity side effects continue through Inventory ports.
- Valuation ownership: Purchase supplies Cost Input provenance only; FIFO/MWA remains Phase 21 authority.
- Bridge: Step 18 freezes versioned sync envelopes for Purchase documents, commercial facts, receipt/invoice matches and Purchase-backed Cost Inputs; projections and FIFO/MWA state are rebuildable and are not synchronized as authority.
- Security: Step 19 adds independent Purchase permissions, persisted Company/Branch authorization, submission-cycle-aware shared Approval, and deterministic request/operation-traceable shared Audit.
- Desktop: Step 20 adds the Persian RTL Purchase list/detail/commercial-line workspace with Jalali boundary, lifecycle/Approval/history, stale-version recovery, Return/Correction flows and secured Inventory receipt-draft staging.
- Reporting: Step 21 adds bounded operational Purchase reports for document register/totals, Supplier activity, invoice-receipt matching and unresolved Purchase-backed Inventory cost; reports are read-only rebuildable projections.
- Testing: Step 22 expands Purchase Domain/Application regression coverage across command/query boundaries, compensation edge cases, security scope, and replay safety for matching and cost resolution.
- Integration: Step 23 adds real-SQLite Purchase migration/UoW/restart/constraint/Bridge evidence and reconciles the concrete Desktop -> Inventory -> Valuation integration suite.

## Purchase Posting — Phase 23 Current State

- Purpose/ownership: Purchase-specific accounting-recognition boundary between authoritative Purchase/Inventory/Valuation facts and Accounting-owned Journal Vouchers.
- Domain/Application: `packages/purchase-posting` owns Purchase posting semantics through Step 17, including canonical Journal generation, atomic/replay/concurrency controls and coordinated immutable Accounting reversal lineage.
- Non-ownership: it does not own supplier commercial pricing, Inventory quantities, FIFO/MWA valuation state or Journal tables.
- Persistence: none yet; SQLite schema/repository work remains Steps 20–21.
- Bridge: durable source system/type/ID, source version/revision, Company/Branch, request/operation and correlation/causation metadata are established; the actual versioned Argin Bridge envelope remains Step 22.
- Testing: Step 17 adds posted→reversed state, original/reversal Journal lineage, replay/conflict behavior and dual Purchase/Journal concurrency coverage.

## Required Fields for Future Entries

Module name, bounded-context purpose, package names, runtime adapters, lifecycle status, owning phase, migrations, permission namespace, public contracts, canonical documents, and deprecation notes.
