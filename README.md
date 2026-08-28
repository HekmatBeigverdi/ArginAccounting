# ArginAccounting

ArginAccounting is a modular, offline-first, Persian accounting and ERP platform designed for Iranian companies and accounting professionals.

The first production runtime is a desktop application built with React, TypeScript, Tauri, and SQLite. Domain and application contracts are designed for future reuse in ASP.NET Core, PostgreSQL, web, and hybrid offline/online runtimes.

## Product Requirements

- Persian and RTL user interface
- Solar Hijri / Jalali input and presentation
- Gregorian UTC internal date-time storage
- Iranian Rial as the primary accounting currency
- Fully offline desktop operation
- Versioned SQLite migrations
- Explicit permissions and organizational scope
- Immutable audit history
- Modular accounting and ERP architecture

Source identifiers, database identifiers, API contracts, GitHub documentation, branches, and commits use English.

## Current Status

- Phase 01–16: implementation completed and integrated
- Prepared release: Phase 16 — Accounting Reports (`v0.16.0`), semantic tag/GitHub Release publication pending repository-owner action
- Current target: Phase 17 — Parties

Phase 16 adds the first production-grade reporting layer over posted Journal facts: common report queries, balance/turnover semantics, Trial Balance, General Ledger, Subsidiary Ledger, Journal and Accounting Dimension reports, granular report/export permissions, optimized SQLite reads, Persian RTL report UX, drill-down/Journal traceability, Excel export, native Print/PDF, and query-plan/performance validation.

See the canonical [Roadmap](ROADMAP.md), [Documentation Hub](docs/README.md), [Phase 16 implementation record](docs/phases/phase-16-accounting-reports.md), [Phase 16 fixed implementation plan](docs/phases/phase-16-accounting-reports-plan.md), and [ADR-0016](docs/adr/ADR-0016-accounting-reports.md).

## Main Modules

Company and Branch, Fiscal Management, Security, Audit and Approval, Accounting, Master Data, Inventory, Purchases, Sales, Treasury, Fixed Assets, Depreciation, Payroll, Human Resources, Manufacturing, Cost Accounting, Budgeting, Contracts and Projects, Reporting, Iranian Taxpayer System Integration, and Synchronization.

## Repository Structure

```text
apps/
  desktop/             React + Tauri desktop runtime
  web/                 Future web runtime

packages/
  config/              Shared TypeScript configuration
  database/            Database-neutral contracts
  database-tauri/      SQLite/Tauri database implementation
  company/             Company and branch domain/application
  company-tauri/       Company SQLite infrastructure
  fiscal/              Fiscal domain/application
  fiscal-tauri/        Fiscal SQLite infrastructure
  security/            Security domain/application
  security-tauri/      Security SQLite/Tauri infrastructure
  audit/               Audit and approval domain/application
  audit-tauri/         Audit and approval SQLite infrastructure
  accounting/          Accounting domain/application, including Journal and Reporting contracts
  accounting-tauri/    SQLite accounting/reporting infrastructure

docs/
  adr/                  Architecture decisions
  accounting/           Accounting and posting/reporting semantics
  architecture/         System architecture
  database/             Data architecture
  development/          Engineering handbook and governance
  glossary/             Domain terminology
  phases/               Phase records
  security/             Security model
  templates/            Required documentation templates
  vision/               Product direction
```

## Prerequisites

- Node.js 22 or later
- pnpm 11
- Rust toolchain
- Tauri system prerequisites for the target operating system

## Development

```bash
pnpm install
pnpm dev:desktop
```

## Validation

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/generate-doc-index.mjs
git diff --check
cd apps/desktop/src-tauri
cargo check
```

For the Phase 16 release gate, `pnpm validate:phase16` runs focused Accounting/SQLite/Desktop validation plus monorepo validation and the representative SQLite report query-plan check.

Validation commands are requirements, not proof of success. Phase and release documents must record commands actually executed and their outcomes.

## Architecture Principles

- Modular domain boundaries
- Offline-first and desktop-first delivery
- Database-independent domain logic
- UI-independent application rules
- Explicit repositories and Unit of Work
- Atomic financial and workflow operations
- Optimistic concurrency
- Immutable posted documents and audit history
- Canonical report semantics over posted accounting facts
- Testability and future runtime portability

## Branch Strategy

- `main`: stable integrated baseline
- `develop`: integration branch
- `phase/*`: phase implementation
- `fix/*`: focused corrections
- `release/*`: release preparation when required
- `docs/*`: documentation-only refactoring

## Documentation

- [Documentation Hub](docs/README.md)
- [Documentation Governance](docs/development/documentation-governance.md)
- [Product Vision](docs/vision/product-vision.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Phase 16 — Accounting Reports](docs/phases/phase-16-accounting-reports.md)
- [Phase 16 Fixed Implementation Plan](docs/phases/phase-16-accounting-reports-plan.md)
- [ADR-0016 — Accounting Reports](docs/adr/ADR-0016-accounting-reports.md)
- [ADR Registry](docs/adr/README.md)
- [Database Design](docs/database/database-design.md)
- [Accounting Engine](docs/accounting/accounting-engine.md)
- [Posting Engine](docs/accounting/posting-engine.md)
- [Security Model](docs/security/security-model.md)
- [Testing Strategy](docs/development/testing-strategy.md)
- [Domain Glossary](docs/glossary/domain-glossary.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Release Checklist](RELEASE_CHECKLIST.md)

## License

The repository license and distribution policy must be reviewed before production or third-party distribution.
