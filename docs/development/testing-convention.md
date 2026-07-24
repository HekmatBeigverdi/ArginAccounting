# ArginAccounting Testing Convention

## Test Pyramid

- Domain unit tests for invariants, value objects, transitions, and accounting rules.
- Application tests for authorization, orchestration, idempotency, transactions, and error mapping.
- Infrastructure integration tests for SQL, migrations, repositories, concurrency, and runtime adapters.
- UI tests for critical Persian/RTL workflows and accessibility.
- End-to-end tests for high-risk accounting and operational scenarios.

## Minimum Coverage by Change

Every significant use case must cover success, validation failure, permission denial, stale concurrency, rollback for partial failure, filtering/pagination where relevant, and sensitive-data handling.

Accounting changes additionally require balance validation, period/branch/fiscal scope, posting idempotency, reversal/correction behavior, rounding, and source linkage tests.

## Evidence

Phase and PR documentation must record the exact commands executed and their actual results. Planned commands and successful results must be clearly distinguished.

## Stability

Tests must be deterministic, isolated, timezone-aware, locale-aware, and independent of execution order. Fixtures must not contain production secrets or personal data.
