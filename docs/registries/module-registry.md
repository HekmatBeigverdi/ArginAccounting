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
| Inventory Documents | `@argin/inventory`, `@argin/inventory-tauri`; Desktop integration pending | Domain/Application/SQLite persistence implemented through Step 13 | 20 | [Phase 20 fixed plan](../phases/phase-20-inventory-documents-plan.md) |

## Inventory Documents — Phase 20 Current State

- Purpose/ownership: quantity documents, immutable stock movements, on-hand projections and quantity kardex; scope and exclusions are authoritative in the linked phase record.
- Domain/Application: `packages/inventory` owns immutable documents, exact quantities, lifecycle, stock workflows, Application ports/services, idempotency/concurrency orchestration and Argin Bridge contracts.
- SQLite adapter: `packages/inventory-tauri` is implemented at Step 13 with repositories and `SqliteInventoryUnitOfWork`.
- Migrations: `0026_inventory_documents.sql` defines the primary schema; `0027_inventory_reversal_persistence.sql` adds the append-only reversal compensation partition and unified movement view required by the accepted reversal identity model.
- Transaction boundary: production `@argin/database-tauri` connections use a Rust-side pinned SQLx SQLite connection with `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` for real atomic UoW execution.
- Permissions: planned `inventory` namespace; exact catalog and shared approval integration belong to Step 14.
- Bridge: Step 12 contracts preserve durable document/line/movement/transfer/reversal identities and do not synchronize balance projections as authoritative facts.
- Desktop workspace/query UI remains Step 16+; master-data dependency guards and ERP integration remain Step 15.

## Required Fields for Future Entries

Module name, bounded-context purpose, package names, runtime adapters, lifecycle status, owning phase, migrations, permission namespace, public contracts, canonical documents, and deprecation notes.
