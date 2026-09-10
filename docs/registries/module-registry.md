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

## Required Fields for Future Entries

Module name, bounded-context purpose, package names, runtime adapters, lifecycle status, owning phase, migrations, permission namespace, public contracts, canonical documents, and deprecation notes.
