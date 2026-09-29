# Purchase Workflow Hardening

## Purpose

Phase 23 Step 31 hardens the end-to-end Purchase workflow against duplicate user actions, same-runtime races, stale source state, partial orchestration failure, and replay of Posting execution.

The scope is deliberately placed before the formal Domain/Application, E2E, Bridge/Replay/Failure test gates so those later gates validate a hardened workflow rather than a happy-path-only implementation.

## Mutation serialization

The desktop composition uses a shared Purchase workflow lock keyed by:

```text
companyId + purchaseDocumentId
```

Receipt staging, Purchase matching, valuation-cost resolution, and Purchase Posting execution use the same serialization key.

This prevents two same-runtime operations for one Supplier Invoice from interleaving in a way that could produce stale remaining quantities or competing Posting creation.

Different Purchase documents remain independent and can execute concurrently.

The lock is an orchestration safety belt. Durable repositories/idempotency records remain the persistence authority.

## Receipt double-click / retry identity

Every time the user opens the **Create goods receipt from invoice** flow, the UI generates a submission identity.

That identity is passed through the workspace service and is used in deterministic:

- Purchase request ID;
- operation ID;
- Inventory document ID;
- payload fingerprint.

Two clicks from the same open receipt form therefore share one submission identity and one in-flight/result promise.

A later intentional receipt is created by reopening the flow, which creates a new submission identity.

This distinction prevents accidental duplicate receipts without preventing legitimate repeated partial deliveries with the same quantity and warehouse.

## Stale source protection

Receipt staging reloads the Supplier Invoice inside the serialized workflow and compares its current version with the version from which the user opened the action.

If the Purchase document changed in the meantime, the operation fails with the existing Purchase version-conflict contract and the UI reload path can present current state.

Remaining receipt quantity is recalculated from current linked receipts before staging.

## Matching recovery

Receipt/Invoice match identities remain deterministic by Invoice/Receipt line pair.

Matching executes under the same Supplier Invoice workflow lock. Existing durable matches are read first and only uncovered quantity is proposed.

If a multi-receipt matching run partially succeeds and later fails, a retry reads the committed matches and continues from the remaining proposals rather than duplicating successful matches.

## Cost-resolution recovery

Purchase-backed cost resolution remains idempotent per Inventory movement using the existing deterministic `purchase-cost:<movementId>` identity.

Step 31 serializes the workflow-level invocation so Matching and Cost Resolution cannot overlap for the same invoice within the desktop runtime.

A retry may safely continue after partial cost-resolution success because each movement is independently replay-safe.

## Posting race recovery

Purchase Posting already uses deterministic source-version identity and replay-safe atomic Journal commit.

Step 31 additionally:

- serializes Posting execution with Receipt/Matching/Cost operations for the same Purchase source;
- handles a race during deterministic Purchase Posting aggregate creation by refetching the aggregate if another execution inserted it first;
- preserves SHA-256 payload fingerprint conflict detection;
- preserves deterministic Journal and line identities.

The result is fail-closed: incompatible replay/fingerprint/version state raises an error instead of creating a second accounting effect.

## UI duplicate-action suppression

Receipt staging, matching, cost resolution, and Posting actions have UI busy-state guards in addition to Application/Database replay controls.

UI guards are not relied upon as the correctness boundary; they only improve interaction quality and reduce unnecessary duplicate calls.

## Failure semantics

A failure in a downstream step never silently rewrites an earlier authoritative fact.

Examples:

- Receipt staging failure does not mutate the Supplier Invoice.
- Matching partial success remains durable and retryable.
- Cost-resolution partial success remains durable per movement.
- Posting failure leaves the confirmed Supplier Invoice and Inventory facts intact.
- Journal creation uses replay-safe commit and does not intentionally duplicate a compatible source version.

## Concurrency scope

The desktop workflow lock coordinates one running desktop JavaScript runtime. Cross-runtime/cross-device correctness continues to depend on durable SQLite constraints, optimistic concurrency, idempotency records, stable source identities, and future Argin Bridge server-side CAS/command serialization.

Step 34 is responsible for formal Bridge/replay/failure verification of these durable boundaries.

## Argin Bridge

No in-memory lock or UI submission cache is synchronized.

Bridge authority remains durable business facts and identities:

- Purchase document/version;
- Inventory document/line;
- Purchase receipt/invoice match;
- Inventory valuation/cost-input facts;
- Purchase Posting aggregate;
- Journal Voucher;
- replay/idempotency records.

In-memory serialization is rebuildable runtime coordination only.
