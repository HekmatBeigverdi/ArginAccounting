# ArginAccounting Architecture

## Overview

ArginAccounting is a modular, offline-first accounting platform. The first runtime is a Persian desktop application built with React, TypeScript, Tauri, and SQLite. The architecture is designed so that business rules can later be reused by a web application and an ASP.NET Core backend without rewriting the accounting domain.

## Architectural Layers

### Domain

The domain layer contains business entities, value objects, state transitions, accounting invariants, validation rules, and domain errors.

The domain layer must not depend on:

- React or any UI framework
- Tauri
- SQLite or PostgreSQL
- HTTP or ASP.NET Core
- File-system APIs

### Application

The application layer exposes use cases and coordinates domain behavior. It is responsible for:

- Permission checks
- Transaction boundaries
- Repository orchestration
- Clock and ID abstractions
- Application errors
- Atomic multi-entity operations

Application services depend only on contracts, not concrete infrastructure.

### Infrastructure

Infrastructure packages implement application contracts for a specific runtime or storage engine.

Examples:

- `@argin/database-tauri`
- `@argin/security-tauri`
- `@argin/audit-tauri`

Infrastructure responsibilities include:

- SQLite queries
- Row mapping
- Versioned migrations
- Transaction execution
- Password hashing adapters
- Tauri command integration

### Presentation

Presentation code lives in desktop or web applications. UI components may call application services but must not contain accounting rules, permission policy, transaction logic, or direct SQL.

## Monorepo Structure

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
  fiscal/              Fiscal management domain/application
  fiscal-tauri/        Fiscal SQLite infrastructure
  security/            Users, roles, permissions, authentication
  security-tauri/      Security SQLite and Tauri implementation
  audit/               Audit and approval domain/application
  audit-tauri/         Audit and approval SQLite implementation
```

## Dependency Direction

Dependencies point inward:

```text
Desktop UI
    ↓
Composition Root
    ↓
Application Services
    ↓
Domain + Contracts

Infrastructure
    ───────────────→ Domain + Contracts
```

The domain never imports infrastructure or presentation packages.

## Desktop Composition Root

The desktop composition root is the only place that creates concrete repositories and runtime adapters.

For audit and approval, it constructs:

```text
Desktop database
    ↓
SQLite repositories
    ↓
SQLite Unit of Work
    ↓
Permission authorizer, clock, ID generator
    ↓
Audit and approval application contexts
    ↓
React provider and hooks
```

This allows the UI to depend on use cases rather than storage details.

## Database Independence

Business entities and application contracts use database-neutral TypeScript structures. SQLite-specific SQL, rows, pagination, and mapping remain inside infrastructure packages.

Future PostgreSQL repositories must implement the same contracts without changing domain rules or UI workflows.

## Database Migrations

All schema changes are versioned and applied in order. A migration must be additive whenever possible and must preserve existing accounting data.

Phase 08 includes:

- `0005_audit_and_approval.sql`
- `0006_approval_optimistic_concurrency.sql`

## Transactions

Critical operations that write multiple records must be atomic.

Phase 08 persists these records in one transaction:

```text
Approval Request
Approval History
Audit Entry
```

The SQLite Unit of Work uses `BEGIN IMMEDIATE`, `COMMIT`, and `ROLLBACK`, guarded by an asynchronous mutex to prevent overlapping transactions on a shared connection.

## Optimistic Concurrency

Mutable workflow records include a numeric version. Updates use the expected version in the SQL predicate. A stale update raises a domain-specific concurrency error rather than silently overwriting newer data.

Financial documents introduced in later phases must use the same principle where concurrent editing is possible.

## Security and Authorization

Authorization is enforced at application boundaries. UI visibility is a usability concern and is never the only security control.

The current model supports:

- Explicit permissions
- Role-permission assignment
- User-role assignment
- Branch access
- Full-access administrative permission
- Permission adapters independent of the security package

## Audit Architecture

Audit entries are immutable records containing:

- Actor
- Action
- Outcome
- Source
- Scope
- Target
- Message and reason
- Before and after snapshots
- Correlation ID
- Metadata
- UTC occurrence time

Sensitive snapshot fields are sanitized before persistence.

## Approval Architecture

Approval requests support:

```text
draft → pending → approved
                → rejected
                → draft
                → cancelled
```

A request maintains an append-only history. Every state-changing action creates both an approval history entry and a corresponding audit entry.

## Posting Engine

Operational modules must not directly create arbitrary journal entries. Future modules submit accounting effects to a centralized posting engine through explicit posting contracts and rules.

The posting engine will provide:

- Deterministic posting rules
- Idempotency
- Atomic document and journal creation
- Source-document linkage
- Reversal support
- Branch and company overrides

## Date, Time, and Money

- User-facing business dates use the Jalali calendar.
- Business dates are stored as Gregorian dates.
- System timestamps are stored in UTC.
- Iranian Rial is the primary accounting storage unit.
- Monetary values must never use floating-point storage.

## Future Backend and Synchronization

The planned online architecture is:

```text
Web/Desktop Client
    ↓
ASP.NET Core Web API
    ↓
Application and Domain Core
    ↓
PostgreSQL Infrastructure
```

The hybrid architecture adds a synchronization engine between local SQLite and the central API. Synchronization must preserve source identity, versions, audit history, and conflict information.

## Non-Negotiable Boundaries

1. Domain logic must remain outside UI components.
2. Domain packages must remain database-independent.
3. Accounting writes must be atomic.
4. Posted documents must not be silently edited or deleted.
5. Iranian Taxpayer System tables must remain separate from accounting source tables.
6. Permissions must be checked in application services.
7. Audit history must be immutable and queryable.
8. All schema changes must use migrations.
9. Public contracts and technical documentation use English.
10. User-facing application text uses Persian and RTL layout.