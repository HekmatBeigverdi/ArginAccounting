# ADR-0002 — Database-Independent Domain

- Status: Accepted
- Date: 2026-07-25

## Context

The project starts on SQLite but targets future PostgreSQL and ASP.NET Core runtimes.

## Decision

Domain and application code must not depend on SQL dialects, database drivers, Tauri commands, or persistence-specific types.

## Consequences

Infrastructure adapters implement repository, query, transaction, and migration contracts. Portability improves at the cost of explicit abstraction and integration testing.