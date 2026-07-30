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
| Accounting Dimensions | To be defined | Planned | 11 | `docs/accounting/accounting-engine.md` |
| Coding Templates | To be defined | Planned | 12 | `docs/adr/ADR-0010-chart-of-accounts-model.md` |

## Required Fields for Future Entries

Module name, bounded-context purpose, package names, runtime adapters, lifecycle status, owning phase, migrations, permission namespace, public contracts, canonical documents, and deprecation notes.
