# Phase 15 — Step 15 Domain and Application Test Matrix

Step 15 consolidates the persistence-independent verification surface for Journal Lifecycle. Repository, migration, permission-registry persistence, and desktop regression scenarios remain Step 16.

| Area | Required behavior | Evidence |
| --- | --- | --- |
| Domain transition matrix | Every state/action pair is explicitly accepted or rejected | `journal-voucher-lifecycle-matrix.test.ts`, `journal-voucher-lifecycle.test.ts` |
| Transition evidence | Actor, time, previous/new state and version are immutable and deterministic | `journal-voucher-lifecycle.test.ts` |
| Approval integration | submit/approve/reject/return/cancel, current-cycle rules and resubmission semantics | `journal-voucher-approval-integration.test.ts` |
| Posting | exact approved-content evidence, current fiscal/account/dimension validation and immutable posted facts | `journal-voucher-posting.test.ts` |
| Locking/amendment | Draft-only mutation, controlled approved-to-Draft reopen, mandatory reason and Approval-cycle invalidation | `journal-voucher-locking.test.ts` |
| Reversal | exact inverse voucher, original immutability, replacement lineage, replay and double-reversal prevention | `journal-voucher-reversal.test.ts` |
| Application contracts/query | lifecycle DTO/status/trace/capability projection and company-scope not-found semantics | `journal-voucher-lifecycle-contracts.test.ts`, `journal-voucher-lifecycle-matrix.test.ts` |
| Authorization | all lifecycle actions map to registered granular permissions; deny-by-default and self-approval SoD | `journal-voucher-lifecycle-authorization.test.ts`, `journal-voucher-lifecycle-matrix.test.ts` |
| Command handlers/effects | authorization before mutation, post-commit effects, audit-before-event ordering and reversal replay suppression | `journal-voucher-lifecycle-effects.test.ts` |
| Idempotency | reversal same-request replay and different-request double reversal rejection | `journal-voucher-reversal.test.ts` |
| Error semantics | stable `journal.*` Application errors remain distinguishable from infrastructure failures | lifecycle Application tests plus Step 14 presenter tests |
| Scope isolation | company mismatch is indistinguishable from not-found at lifecycle query boundary | `journal-voucher-lifecycle-matrix.test.ts` |

## Step 15 Additions

`packages/accounting/tests/journal-voucher-lifecycle-matrix.test.ts` adds:

- an exhaustive 5-state × 8-Domain-action transition matrix;
- expected target-state and version/evidence assertions for every legal transition;
- rejection assertions for every illegal transition;
- lifecycle capability projection with and without a current Approval cycle;
- company-scope isolation regression coverage;
- one-to-one mapping coverage for all eight lifecycle authorization actions;
- Application permission mapping coverage for every UI lifecycle capability.

## Validation

Run:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
```

The implementation is recorded as complete when the matrix and existing focused tests are committed. Runtime success is recorded only after local or CI execution.