# Purchase Idempotency, Optimistic Concurrency and Replay Safety

Phase 22 Step 17 finalizes mutation replay semantics for Purchase.

## Durable Mutation Identity

Every Purchase mutation carries one normalized `PurchaseOperationContext` containing:

- `companyId`
- `branchId`
- `requestId`
- `operationId`
- `payloadFingerprint`
- `actorUserId`
- `occurredAt`

`requestId` and `operationId` are independently unique within one Company.

A committed replay is valid only when all of the following still match the stored record:

- Company
- request ID
- operation ID
- normalized operation name
- payload fingerprint

Any reuse where one identity already exists but the other identity, operation, or fingerprint differs is an idempotency conflict.

## Exact Outcome Replay

Migration `0032_purchase_replay_safety.sql` adds `result_json` to `purchase_idempotency`.

Successful outcomes persist the exact returned result envelope together with:

- operation identity
- payload fingerprint
- outcome kind
- outcome durable ID
- optional version/status
- recording timestamp

Replay returns the stored result envelope directly. It does not reload the current aggregate and therefore does not change merely because the Purchase document later progressed through another lifecycle transition.

The idempotency row is append-only: UPDATE and DELETE are rejected.

## Ordering

Replay lookup happens before version checks and before business mutation.

Therefore this sequence is valid:

1. request confirms a mutation successfully;
2. aggregate version later changes;
3. the original request is retried with its original expected version;
4. replay returns the original successful outcome instead of reporting a stale-version error.

A new request with a new operation identity still performs the normal optimistic-version check.

## Atomic Purchase Mutations

For Purchase-local mutations such as create, lifecycle transitions and receipt/invoice Match creation:

- replay check;
- aggregate/commercial/match mutation;
- idempotency outcome write;

occur in the same `PurchaseUnitOfWork` transaction.

With the production SQLite executor using one pinned `BEGIN IMMEDIATE` transaction, two concurrent attempts cannot both commit the same Purchase mutation identity.

## Cross-Bounded-Context Side Effects

Some Purchase commands cross authority boundaries and cannot share one SQLite transaction with the authoritative external module.

### Inventory receipt staging

Purchase performs a replay check before calling Inventory.

Inventory receives the same request ID and payload fingerprint and must keep its existing durable idempotency behavior. After Inventory returns the receipt-draft outcome, Purchase persists its own exact replay result.

A crash between Inventory success and Purchase outcome persistence can cause the request to be sent to Inventory again, but Inventory must replay the already-accepted result rather than create a second receipt draft.

### Valuation recalculation

Cost Input persistence commits before recalculation, matching Step 14.

The Valuation recalculation port receives the Purchase `requestId` and `operationId` and must treat that pair as replay-safe identity. A crash after Cost Input commit can resend the recalculation request, but must not apply duplicate valuation effect.

## Optimistic Concurrency

Purchase aggregate updates retain Company + document ID + expected-version compare-and-swap.

Commercial Fact replacement retains revision compare-and-swap.

Idempotency does not replace optimistic concurrency:

- exact retry of a committed mutation → replay;
- new mutation against stale aggregate version → version conflict;
- same idempotency identity with changed payload → idempotency conflict.

## Argin Bridge

The same identities are suitable for future Argin Bridge envelopes:

- `requestId`
- `operationId`
- `payloadFingerprint`
- aggregate durable ID/version
- optional server revision in synchronized facts

Step 18 defines the actual Bridge synchronization envelope. Step 17 defines local replay truth.

## Verification Boundary

Step 17 adds focused Domain/Application and SQLite-adapter tests for exact replay, payload conflicts, operation-ID conflicts, stale-version replay ordering, downstream side-effect suppression, idempotency repository persistence and migration append-only constraints.

Formal real-database concurrency/restart integration remains Step 23 and final monorepo validation remains Step 24.
