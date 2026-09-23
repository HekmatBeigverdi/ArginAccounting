# Inventory and Valuation Integration

## Status

Phase 23 Step 12.

Step 12 is the authoritative monetary bridge between Purchase Posting and Phase 21 Inventory Valuation.

## Core Rule

Purchase Posting never recalculates FIFO or Moving Weighted Average.

It consumes immutable valuation snapshots captured in the Purchase Posting Fact:

```text
Purchase / Inventory facts
        ↓
Phase 21 valuation
        ↓
valuationEntryId + movementId + policyId + method + strategyVersion + totalCost
        ↓
Phase 23 posting amount
```

## Supplier Invoice

For a stock Supplier Invoice, Step 7 created:

```text
Inventory Asset   Debit
amount = unresolved
```

Step 12 resolves the amount as the sum of authoritative inbound valuation `totalCost` values linked to that Purchase line.

Inbound valuation must be non-negative.

## Purchase Return

For a stock Purchase Return, Phase 22 creates an outbound compensating Inventory movement.

Phase 21 values that movement with FIFO/MWA and stores a negative signed `totalCost`.

Step 12 converts:

```text
signed totalCost = -8,750
        ↓
Inventory Asset Credit = 8,750
```

The sign is never discarded before deciding accounting direction.

## Purchase Correction

### Commercial replacement

For stock price/cost correction:

```text
corrected authoritative valuation
-
original authoritative valuation
=
accounting valuation delta
```

Positive delta → Inventory Debit.

Negative delta → Inventory Credit.

### Quantity increase

The correction's inbound follow-up movement valuation is consumed directly.

Positive valuation → Inventory Debit.

### Quantity decrease

The correction's outbound compensating movement valuation is consumed directly.

Negative valuation → Inventory Credit.

## Provenance

Every resolved posting keeps valuation provenance:

- Purchase line ID
- valuation entry IDs
- movement IDs
- valuation policy IDs
- FIFO/MWA method
- strategy version
- currency
- signed total cost

This supports audit, replay and future Argin Bridge synchronization without using SQLite row identity.

## Validation

Step 12 rejects:

- missing valuation for a deferred stock component;
- Company mismatch;
- Product mismatch;
- currency mismatch;
- inbound valuation with negative direction;
- outbound valuation with positive direction;
- unsafe monetary aggregation.

## Non-Scope

- FIFO/MWA algorithms — Phase 21
- account resolution — Step 6
- debit/credit business semantics — Steps 7–11
- Journal balancing/construction — Step 13
- atomic persistence — Step 14
- replay/idempotency — Step 15
