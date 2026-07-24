# ADR-0005 — Repository and Unit of Work

- Status: Accepted
- Date: 2026-07-25

## Context

Financial and workflow operations frequently update multiple records that must succeed or fail together.

## Decision

Aggregates are persisted through repository contracts and multi-record writes use explicit Unit of Work boundaries.

## Consequences

Application services control transaction scope. Repositories do not silently commit. Atomicity is testable, and alternative persistence adapters can preserve the same semantics.