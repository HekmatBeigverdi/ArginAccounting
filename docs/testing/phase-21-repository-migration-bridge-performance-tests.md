# Phase 21 — Repository, Migration, Bridge and Performance Test Matrix

## Purpose

Step 19 validates the concrete persistence boundary for Inventory Valuation. Unlike Step 18, this step exercises real SQLite semantics where practical: migrations, constraints, triggers, transactions, locking, Cost Input persistence/correction, Bridge serialization from persisted authoritative data, query plans and representative-scale reads.

## Coverage

| Area | Test evidence | Invariant |
| --- | --- | --- |
| Upgrade 27 -> 29 | `inventory-valuation-sqlite-migrations.test.ts` | Existing data survives additive valuation migrations and all Phase 21 tables are created. |
| Policy persistence | `inventory-valuation-sqlite-migrations.test.ts` | Company policy history is append-only at the database boundary. |
| FIFO derived cleanup | `inventory-valuation-sqlite-migrations.test.ts` | Deleting a derived valuation entry cascades its derived FIFO layer; authoritative facts are not cascaded away. |
| Multi-connection locking | `inventory-valuation-sqlite-migrations.test.ts` | `BEGIN IMMEDIATE` excludes a concurrent SQLite writer. |
| Query plan | `inventory-valuation-sqlite-migrations.test.ts` | Product chronology reads use `idx_inventory_valuation_entries_company_product_chronology`. |
| Cost Input persistence | `inventory-inbound-cost-sqlite-integration.test.ts` | Manual inbound cost writes authoritative Cost Input plus eligible derived FIFO valuation in one transaction. |
| Replay | `inventory-inbound-cost-sqlite-integration.test.ts` | Exact request replay returns the prior outcome without duplicate Cost Input, Entry, Layer or idempotency rows. |
| Correction CAS | `inventory-inbound-cost-sqlite-integration.test.ts` | Revision-based correction succeeds once and stale writers are rejected. |
| Rollback | `inventory-inbound-cost-sqlite-integration.test.ts` | Failure while persisting durable idempotency rolls back Cost Input, Entry and FIFO Layer atomically. |
| Bridge round-trip | `inventory-valuation-bridge-performance.test.ts` | Persisted authoritative Cost Input becomes a versioned Bridge envelope and survives JSON serialization without quantity/money/revision drift. |
| Representative scale | `inventory-valuation-bridge-performance.test.ts` | 10,000 persisted valuation entries remain served by the chronology index for bounded Product reads. |

## Test Runtime

The integration harness uses the Node 22 `node:sqlite` runtime module and executes the repository migration SQL directly. A small `DatabaseExecutor` adapter is test-only and deliberately mirrors the production transaction contract with `BEGIN IMMEDIATE`, `COMMIT` and `ROLLBACK`.

The workspace currently pins `@types/node` v20, so the runtime-only `node:sqlite` import carries a narrow `@ts-expect-error` until the monorepo Node type baseline is upgraded. This is not production code and does not alter the Desktop persistence implementation.

## Scope Boundaries

Step 19 does not claim live Argin Bridge transport, distributed acknowledgements, remote retry queues or server conflict resolution; those remain Phase 45. It validates the Phase 21 authoritative envelope shape and serialization using persisted Cost Input data.

Performance coverage is representative, not a formal benchmark SLA. It verifies bounded reads and query-plan/index selection with 10,000 valuation entries. Release-grade cross-platform timing benchmarks, if needed, belong to production hardening.

## Evidence Rule

Committed integration tests are implementation evidence. Step 19 may be marked complete because the required concrete tests exist and are wired into the package test glob, but no statement that they passed locally or in CI may be made unless executable output is actually observed.