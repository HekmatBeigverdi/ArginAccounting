# Testing Strategy

## Test Pyramid

- Domain unit tests for invariants and state transitions
- Application tests for authorization, orchestration, and error mapping
- Repository and migration integration tests against real SQLite
- Transaction tests for commit, rollback, idempotency, and concurrency
- UI component and route tests for critical workflows
- End-to-end tests for release-critical scenarios

## Financial Requirements

Tests must cover balancing, rounding, currency precision, fiscal boundaries, duplicate prevention, posting/reversal symmetry, immutable posted state, number-series concurrency, and audit traceability.

## Isolation

Unit tests must not require Tauri or a database. Integration tests use isolated temporary databases and deterministic fixtures.

## Validation Evidence

Phase and release documents record commands actually executed and their outcome. Tests that exist but were not run must never be described as passing.

## Regression Policy

Every defect fix includes a regression test at the lowest effective layer. Schema changes include migration tests from the previous released schema.