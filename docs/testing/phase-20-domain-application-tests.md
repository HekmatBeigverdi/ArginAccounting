# Phase 20 — Domain and Application Test Matrix

## Purpose

Step 19 validates Phase 20 quantity-domain and Application invariants without treating SQLite/Tauri integration as proof. Real migration, durable restart, rollback and Desktop composition tests remain Step 20.

## Required invariant coverage

| Invariant | Primary focused coverage |
| --- | --- |
| Document identity, lines and source references | `inventory-document.test.ts`, `inventory-contracts.test.ts` |
| Exact quantity normalization and Product unit snapshots | `inventory-operation.test.ts`, `phase20-domain-application-regression.test.ts` |
| Company / Branch / fiscal scope | `inventory-scope.test.ts` |
| Lifecycle and approval/confirmation separation | `inventory-lifecycle.test.ts`, `inventory-security-integration.test.ts` |
| Receipt / issue / opening confirmation | `inventory-core-workflows.test.ts` |
| Opening uniqueness | `inventory-core-workflows.test.ts`, Application service tests |
| Negative stock and backdated chronology | stock/workflow tests plus `phase20-domain-application-regression.test.ts` |
| Transfer conservation | transfer/adjustment workflow tests plus Bridge regression tests |
| Adjustment reason and signed effect | transfer/adjustment workflow tests |
| Reversal links and immutable compensation | `inventory-reversal.test.ts`, Bridge regression tests |
| Idempotent replay and changed-payload conflict | `inventory-application-service.test.ts` |
| Stale optimistic version | `inventory-application-service.test.ts` |
| Concurrent issues against one StockKey | `inventory-application-service.test.ts` |
| Import deterministic retry identity | `inventory-draft-import-service.test.ts` |
| ERP confirmation security boundary | `inventory-erp-confirmation-port.test.ts` |
| Warehouse dependency guard semantics | `inventory-warehouse-dependency-guard.unit.test.ts` |
| Argin Bridge tombstone / transfer / reversal invariants | `phase20-domain-application-regression.test.ts` and existing sync contract tests |

## Step 19 additions

Step 19 adds regression coverage for exact decimal arithmetic at large precision, historical negative-stock detection caused by backdated facts, exact transfer conservation in Bridge envelopes, reversal dependency ordering, Draft-only Bridge tombstones, and Warehouse dependency guard behavior without a real SQLite database.

The dependency-guard tests use a fake `DatabaseExecutor`; they validate policy composition only. SQL correctness and actual database behavior remain Step 20.

## Concurrency acceptance

`inventory-application-service.test.ts` uses a serial in-memory UoW and launches two stock reductions concurrently against the same StockKey. Only one reduction may succeed when both cannot be satisfied; the second must fail with `inventory.application.stock-conflict`, and the rebuilt authoritative ledger must retain the correct remaining quantity.

This proves the Application invariant. Step 20 must separately prove the same property through the real SQLite transaction implementation.

## Validation command

```bash
pnpm --filter @argin/inventory typecheck
pnpm --filter @argin/inventory test
pnpm --filter @argin/inventory-tauri typecheck
pnpm --filter @argin/inventory-tauri test
```

Do not record these commands as passed until their executable output is observed. Owner acceptance and executable evidence are separate facts.
