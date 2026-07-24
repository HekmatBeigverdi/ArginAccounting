# ADR-0006 — Application Service Boundary

- Status: Accepted
- Date: 2026-07-25

## Context

Authorization, transaction orchestration, auditing, and error handling must not be scattered across UI components.

## Decision

Use explicit application services for use-case orchestration. UI invokes application contracts; domain objects enforce invariants; infrastructure implements ports.

## Consequences

Use cases are testable without UI or database dependencies. Additional code is accepted in exchange for clear security and transaction boundaries.