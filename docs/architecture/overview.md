# Architecture Overview

## Objective

ArginAccounting is a modular accounting platform for Iranian companies.

The initial implementation is a local desktop application, but the architecture must support future web and hybrid deployment without rewriting the accounting core.

## Architectural Style

The system follows a modular monolith architecture.

Each business module owns its domain rules and data access contracts.

Modules communicate through explicit application contracts and domain events.

## Runtime Targets

### Desktop

- Next.js
- React
- TypeScript
- Tauri
- SQLite

### Future Backend

- ASP.NET Core Web API
- Entity Framework Core
- PostgreSQL

### Future Web

- Next.js
- Shared design system
- ASP.NET Core API

### Future Hybrid

- Local SQLite
- Remote PostgreSQL
- Synchronization engine
- Conflict detection
- Idempotent operations

## Layers

UI
Application
Domain
Infrastructure

## Dependency Rule

Dependencies must point inward.

The domain layer must not depend on:

- React
- Next.js
- Tauri
- SQLite
- PostgreSQL
- ASP.NET Core
- Iranian Taxpayer SDK

## Accounting Core Independence

The accounting core must remain independent from:

- User interface
- Database implementation
- Taxpayer system integration
- Printing
- Reporting UI
- Synchronization

## Document Integration

Operational modules generate accounting entries through the posting engine.

Example:

- Sales Invoice
- Stock Issue
- Journal Voucher
- Treasury Receipt
- Tax Submission Draft

Generated documents must remain linked to their source document.
