# ADR-0007 — Immutable Audit Trail

- Status: Accepted
- Date: 2026-07-25

## Context

Financial and administrative operations require durable traceability.

## Decision

Audit entries are append-only and capture actor, source, target, scope, outcome, correlation ID, timestamps, and sanitized snapshots where appropriate.

## Consequences

Audit records are never edited as business data. Retention, indexing, privacy sanitization, and query permissions are mandatory design concerns.