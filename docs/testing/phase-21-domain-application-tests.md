# Phase 21 — Domain and Application Test Matrix

## Purpose

Step 18 consolidates the persistence-neutral test evidence for Inventory Valuation. It validates monetary rules and Application contracts without treating SQLite, Bridge transport, query plans, crash/restart behavior, or representative-scale performance as Domain/Application concerns.

## Coverage Matrix

| Area | Primary test evidence | Invariant |
| --- | --- | --- |
| FIFO strategy | `inventory-valuation-strategy.test.ts` | Oldest layer first, deterministic partial allocation, exact remainder conservation, no invented negative-stock cost. |
| Moving Weighted Average | `inventory-valuation-strategy.test.ts` | Weighted pool, deterministic rounding, exact full exhaustion, deterministic replay. |
| Inbound and landed cost | `inventory-inbound-cost.test.ts` | Quantity/value/weight allocation, monetary conservation, currency validation, source traceability. |
| Company valuation policy | `inventory-valuation-policy.test.ts` | Company scope, effective chronology, controlled transition, mutation lock, immutable history checks. |
| Ordinary outflow | `inventory-outflow-cost.test.ts` | Effective policy, FIFO/MWA issue costing, insufficient basis and transfer/reversal deferral. |
| Transfer continuity | `inventory-transfer-cost.test.ts` | Quantity/cost conservation across warehouses and exact carried monetary basis. |
| Adjustment and reversal | `inventory-adjustment-reversal-valuation.test.ts` | Exact positive basis, negative issue semantics and linked monetary compensation without history rewrite. |
| Backdated recalculation | `inventory-valuation-recalculation.test.ts` | Earliest affected point, cross-warehouse Product scope, Company policy scope and canonical replay order. |
| Negative/unknown cost | `inventory-cost-resolution-policy.test.ts` | Block/defer policy and explicit unresolved state; unknown cost is never silently zero. |
| Application contracts | `inventory-valuation-application-contracts.test.ts` | Canonical operation identity/time and one UoW seam for valuation repositories. |
| Idempotency/concurrency helpers | `inventory-valuation-concurrency.test.ts` | Exact request/fingerprint replay, stale revision rejection and Company/Product stream identity. |
| Guarded mutation orchestration | `inventory-valuation-guarded-mutation.test.ts` | Replay lookup -> CAS -> mutation -> durable outcome ordering, replay short-circuit, conflict-before-CAS and no success record after failed mutation. |
| Authorization/audit/trace | `inventory-valuation-security.test.ts` | Permission separation, provenance construction, scope mismatch rejection and unresolved trace preservation. |
| Argin Bridge contract | `inventory-valuation-sync.test.ts` | Authoritative Policy/Cost Input envelopes, movement/policy dependencies, exact metadata and derived-entity exclusion. |

## Scope and Isolation

Step 18 is intentionally persistence-neutral. Its tests must not depend on SQLite row identity, file-system state, network transport, wall-clock timing, or live Bridge infrastructure.

The following belong to Step 19 and are not claimed by Step 18:

- real SQLite migration/upgrade behavior;
- `BEGIN IMMEDIATE` rollback under actual driver failure;
- multi-connection races;
- real unique-constraint/error mapping;
- Bridge serialization round-trips against persistence adapters;
- query-plan/index validation;
- representative-scale report/performance tests;
- restart/crash durability.

## Validation Evidence Rule

Committed test definitions are implementation evidence, not proof that the commands passed. A Step 18 completion record may claim executable success only when local or CI output is actually observed and recorded. Otherwise it must state that the tests are committed but execution was not observed.
