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
| Inventory Documents | `@argin/inventory`; SQLite adapter and Desktop integration planned | Draft Domain, quantities and references implemented | 20 | [Phase 20 fixed plan](../phases/phase-20-inventory-documents-plan.md) |

## Inventory Documents — Phase 20 Baseline

- Purpose/ownership: quantity documents, immutable stock movements, on-hand projections and quantity kardex; scope and exclusions are authoritative in the linked phase record.
- Domain foundation: `packages/inventory` created at Step 2; Application ports/services remain planned. SQLite adapter: planned `packages/inventory-tauri`; UI uses Desktop composition.
- Migrations: none introduced; existing baseline ends at 0025. Allocate at Step 11 after rechecking the registry.
- Permissions: planned `inventory` namespace; exact catalog and shared approval integration belong to Step 14.
- Public Domain factories/snapshots: [Inventory document foundation](../architecture/inventory-documents.md). Application/Bridge contracts remain planned at Steps 9/12; upstream Product and Warehouse public ports remain the source of master identity and eligibility.
- Lifecycle: Steps 1–3 complete; drafts with exact quantities and validated operational references are implemented. No stock-changing workflow, SQLite adapter or deprecation.

## Required Fields for Future Entries

Module name, bounded-context purpose, package names, runtime adapters, lifecycle status, owning phase, migrations, permission namespace, public contracts, canonical documents, and deprecation notes.
