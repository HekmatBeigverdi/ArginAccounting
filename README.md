# ArginAccounting

ArginAccounting is a modular, offline-first, Persian accounting platform designed for Iranian companies and accounting professionals.

The first production runtime is a desktop application built with React, TypeScript, Tauri, and SQLite. The domain and application layers are designed for future reuse in an ASP.NET Core Web API, PostgreSQL deployment, web application, and hybrid offline/online environment.

## Product Requirements

- Persian user interface
- RTL layout
- Solar Hijri / Jalali input and presentation
- Iranian Rial as the primary accounting currency
- Optional Toman display
- Fully offline desktop operation
- Versioned SQLite migrations
- Explicit permissions and branch access
- Immutable audit history
- Modular accounting architecture

Source code identifiers, database identifiers, API contracts, GitHub documentation, branch names, and commit messages are written in English.

## Current Status

Phases 01 through 07 are complete. Phase 08, Audit Trail and Approval Workflow, is implemented on `phase/08-audit-approval` and is undergoing final validation and release preparation.

Phase 08 includes:

- Audit entries with actor, source, target, scope, outcome, snapshots, and correlation IDs
- Sensitive-value sanitization
- Approval request state machine and append-only history
- Atomic Approval + History + Audit transactions
- Optimistic concurrency
- Permission-protected application services
- SQLite repositories and Unit of Work
- Desktop composition root and authenticated session integration
- Persian Approval and Audit Viewer pages
- Application and transaction tests

See [ROADMAP.md](ROADMAP.md) for the full delivery plan and [ARCHITECTURE.md](ARCHITECTURE.md) for architectural boundaries.

## Main Modules

- Company and Branch
- Fiscal Management
- Security
- Audit and Approval
- Accounting
- Master Data
- Inventory
- Purchases
- Sales
- Treasury
- Fixed Assets
- Depreciation
- Payroll
- Human Resources
- Manufacturing
- Cost Accounting
- Budgeting
- Contracts and Projects
- Reporting
- Iranian Taxpayer System Integration
- Synchronization

## Repository Structure

```text
apps/
  desktop/             React + Tauri desktop application
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
```

## Prerequisites

- Node.js 22 or later
- pnpm 11
- Rust toolchain
- Tauri system prerequisites for the target operating system

## Install

```bash
pnpm install
```

## Development

Run the desktop application:

```bash
pnpm dev:desktop
```

Run the web workspace when available:

```bash
pnpm dev:web
```

## Validation

Run all TypeScript checks:

```bash
pnpm typecheck
```

Run all tests:

```bash
pnpm test
```

Build all workspaces:

```bash
pnpm build
```

Validate the Tauri/Rust application:

```bash
cd apps/desktop/src-tauri
cargo check
```

Phase 08 package-specific commands:

```bash
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/audit-tauri test
pnpm --filter @argin/desktop typecheck
```

## Architecture Principles

- Modular domain boundaries
- Offline-first and desktop-first delivery
- Database-independent domain logic
- UI-independent application rules
- Explicit repository and Unit of Work contracts
- Atomic financial and workflow operations
- Optimistic concurrency where required
- Immutable posted documents
- Auditability and traceability
- Testability
- Web and PostgreSQL readiness

## Accounting Model

The accounting core is planned to support:

- Hierarchical chart of accounts
- Account groups, general ledgers, and subsidiary ledgers
- Floating detail accounts and reusable dimensions
- Configurable coding templates
- Journal vouchers and balanced debit/credit validation
- Fiscal years and periods
- Approval, posting, reversal, and correction workflows
- Central posting rules
- Drill-down reports
- Iranian accounting terminology and workflows

## Branch Strategy

- `main`: stable releases
- `develop`: integration branch
- `phase/*`: phase development branches
- `fix/*`: bug fixes
- `release/*`: release preparation

A phase branch is merged into `develop` with a non-fast-forward merge after validation and documentation.

## Documentation

- [Vision](VISION.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Phase 08 Audit and Approval](docs/phase-08-audit-approval.md)
- [Release Checklist](RELEASE_CHECKLIST.md)

## License

The repository license and distribution policy must be reviewed before production or third-party distribution.