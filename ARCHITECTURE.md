# ArginAccounting Architecture

ArginAccounting is a modular, offline-first accounting and ERP platform. The first runtime is a Persian React + TypeScript + Tauri desktop application backed by SQLite. Business rules are designed for future ASP.NET Core, PostgreSQL, web, and synchronized hybrid runtimes.

Detailed documents are indexed in [`docs/architecture/README.md`](docs/architecture/README.md). Architectural rationale is preserved in [`docs/adr/`](docs/adr/README.md).

## Layers

### Domain

Entities, value objects, invariants, state transitions, and domain errors. No dependency on React, Tauri, SQLite, PostgreSQL, HTTP, or file-system APIs.

### Application

Use cases, permissions, orchestration, transactions, repositories, clocks, IDs, concurrency handling, and structured application errors. Depends on contracts, not concrete infrastructure.

### Infrastructure

Runtime and persistence adapters: SQL, row mapping, migrations, transactions, password hashing, background execution, and Tauri commands.

### Presentation

Persian RTL desktop or future web UI. Presentation calls application services and contains no accounting, authorization, transaction, or SQL rules.

## Dependency Direction

```text
Presentation → Composition Root → Application → Domain + Contracts
Infrastructure ───────────────────────────────→ Domain + Contracts
```

Dependencies always point inward. Modules expose public contracts and do not access another module's private implementation or tables.

## Shared Platform Layer — Phase 09

Before Accounting Core, Phase 09 establishes:

- Event Bus
- Money
- Query Framework
- Number Series Engine
- Metadata Engine
- Notification
- Plugin Contracts
- Shared Data Access
- Optimistic Concurrency
- Background Jobs

These capabilities remain domain-neutral and portable. Business modules depend on the platform; the platform never depends on business modules. See [ADR-0009](docs/adr/ADR-0009-platform-infrastructure-first.md).

## Persistence and Transactions

SQLite details remain in infrastructure packages. Business contracts are database-neutral. Schema changes use immutable versioned migrations. Multi-record operations use explicit Unit of Work boundaries and leave no partial financial or workflow state.

See [Database Design](docs/database/database-design.md) and [ADR-0005](docs/adr/ADR-0005-repository-unit-of-work.md).

## Security, Audit, and Approval

Authorization is enforced in application services. Audit entries are append-only and sanitized. Approval transitions use explicit permissions, state rules, atomic history/audit persistence, and optimistic concurrency.

See [Security Model](docs/security/security-model.md), [Phase 08](docs/phases/phase-08-audit-approval.md), [ADR-0007](docs/adr/ADR-0007-immutable-audit-trail.md), and [ADR-0008](docs/adr/ADR-0008-approval-optimistic-concurrency.md).

## Accounting and Posting

The accounting engine owns double-entry invariants, voucher lifecycle, posting eligibility, reversal, and traceability. Operational modules do not write arbitrary journal entries. They submit deterministic, idempotent posting requests to the Posting Engine.

See [Accounting Engine](docs/accounting/accounting-engine.md) and [Posting Engine](docs/accounting/posting-engine.md).

## Date, Time, and Money

- UI dates: Jalali input and presentation
- Stored business dates: Gregorian
- System timestamps: UTC
- Primary accounting currency: Iranian Rial
- Financial values: never binary floating point

## Future Runtime

```text
Desktop / Web Client
        ↓
ASP.NET Core Application API
        ↓
Shared Application and Domain Contracts
        ↓
PostgreSQL Infrastructure
```

Hybrid synchronization must preserve identity, scope, versions, audit evidence, idempotency, and conflict information.

## Non-Negotiable Boundaries

1. Domain logic stays outside UI.
2. Domain and application layers remain database-independent.
3. Cross-module writes use public contracts.
4. Financial and workflow multi-writes are atomic.
5. Posted records and audit history are not silently edited or deleted.
6. Permissions are enforced at the application boundary.
7. All schema changes use migrations.
8. Documentation changes follow [Documentation Governance](docs/development/documentation-governance.md).
9. Repository contracts and technical documentation use English.
10. End-user desktop text uses Persian and RTL.