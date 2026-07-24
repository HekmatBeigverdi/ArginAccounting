# ADR-0004 — SQLite Behind Infrastructure Contracts

- Status: Accepted
- Date: 2026-07-25

## Context

SQLite is appropriate for offline desktop deployment but must not leak into business rules.

## Decision

SQLite and Tauri implementation details stay in `*-tauri` infrastructure packages behind database-neutral contracts.

## Consequences

SQL, connection handling, pragmas, migrations, and serialization are adapter concerns. Domain tests remain database-free; real SQLite integration tests validate infrastructure behaviour.