# Phase 09 — Platform Infrastructure

## Status

Implemented and validated.

## Overview

This phase establishes shared platform capabilities before the accounting, inventory, sales, purchases, treasury, and extended ERP modules are implemented. Completing them now prevents repeated cross-module refactoring.

## Objectives

- Event Bus
- Money value objects and currency policy
- Query Framework
- Number Series Engine
- Metadata Engine
- Notification infrastructure
- Plugin Contracts
- Shared Data Access
- Standard Optimistic Concurrency
- Background Jobs

## Scope

The phase defines contracts, domain-neutral implementations, SQLite/Tauri adapters where required, tests, documentation, and desktop composition. It does not implement Chart of Accounts or business-module workflows.

## Architecture

Platform contracts must remain domain-neutral, deterministic, testable, and portable to the future ASP.NET Core/PostgreSQL runtime. Business modules depend on these contracts; the platform must not depend on business modules.

## Required Deliverables

- Shared packages with stable public exports
- Error and result conventions
- Transaction and Unit of Work integration
- Idempotency and correlation contracts
- Concurrency tokens and conflict errors
- Persistent job and notification models where applicable
- Plugin compatibility/version contracts
- Query filtering, sorting, projection, and pagination contracts
- Comprehensive unit and SQLite integration tests

## Security

Background work, notifications, metadata access, and plugin execution must preserve company/branch scope, actor context where available, permission boundaries, and audit correlation.

## Validation

Validation evidence must record commands actually executed. Existing but unexecuted tests must not be reported as passing.

## Documentation Impact

Update architecture, database, testing, security, module guidelines, glossary, ADRs, roadmap, changelog, and release checklist.

## Exit Criteria

All ten platform capabilities have approved contracts, implementations, tests, composition wiring, migrations where required, canonical documentation, and successful validation evidence.

## Implemented Capabilities

- Event Bus with typed events and handlers
- Money value objects and Iranian rial currency policy
- Command and Query buses
- Filtering, sorting, projection, and pagination contracts
- Number Series Engine
- Metadata Engine
- Notification contracts and persistent SQLite notification store
- Plugin compatibility and version contracts
- Shared Data Access and Unit of Work contracts
- Standard Optimistic Concurrency
- Persistent SQLite Background Jobs
- Company, branch, actor, and correlation context preservation for background jobs
- Desktop composition for platform services

## Database Migrations

- `0007_background_jobs.sql`
- `0008_notifications.sql`
- `0009_background_job_context.sql`

## Validation Evidence

The following checks were executed successfully on the completed phase branch:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @argin/platform test
pnpm --filter @argin/platform-tauri test

cd apps/desktop/src-tauri
cargo fmt --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
cargo build
```

Validation results:

- `@argin/platform`: 131 tests passed
- `@argin/platform-tauri`: 27 tests passed
- Monorepo type checking passed
- Monorepo lint passed
- Monorepo tests passed
- Monorepo build passed
- Rust formatting, Clippy, tests, and build passed
- Desktop application build passed

## Known Limitations

- Platform Infrastructure provides domain-neutral contracts and adapters only.
- Accounting-specific queries, notifications, jobs, and number series begin in Phase 10 and later phases.
- Remote server-backed implementations remain part of the future hybrid runtime.

## Next Phase

Phase 10 — Chart of Accounts.
