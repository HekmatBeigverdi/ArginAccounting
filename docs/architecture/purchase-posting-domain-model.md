# Purchase Posting Domain Model

## Status

Phase 23 Step 2 domain foundation.

Source facts/snapshots, source identity, event classification, account-resolution rules, Journal construction, persistence and Bridge envelopes remain owned by later Phase 23 steps.

## Bounded Context

`@argin/purchase-posting` is a separate accounting-recognition bounded context.

It does not extend `@argin/purchase` with accounting ownership. This separation preserves the authority boundaries established in ADR-0023:

- Purchase owns supplier commercial facts.
- Inventory owns quantity/movement facts.
- Inventory Valuation owns FIFO/MWA monetary valuation.
- Accounting owns Journal Vouchers and Journal Lines.
- Purchase Posting owns only the deterministic accounting-recognition orchestration between those authorities.

## Aggregate

The Step 2 aggregate is intentionally small and persistence-neutral:

```text
PurchasePostingAggregate
├── postingId
├── companyId
├── branchId
├── status
├── journalVoucherId
├── version
├── createdAt
└── updatedAt
```

No SQLite row ID is part of the domain identity.

## Status Vocabulary

The frozen base vocabulary is:

- `draft` — Posting aggregate exists but no accounting proposal has been finalized.
- `prepared` — deterministic posting preparation has completed; Journal commit has not yet occurred.
- `posted` — posting is linked to an Accounting-owned Journal Voucher.
- `reversed` — the posted accounting effect has been reversed through the controlled reversal path.

Step 2 defines the vocabulary and rehydration invariants only. Lifecycle commands and reversal semantics are implemented in their owning later steps.

## Core Invariants

- `postingId`, `companyId` and `branchId` are durable non-empty identities.
- New aggregates start as `draft`, version `1`, without a Journal Voucher.
- `draft` and `prepared` cannot already reference a Journal Voucher.
- `posted` and `reversed` must reference the Accounting-owned Journal Voucher that represents the original posting result.
- Version is a positive safe integer.
- System timestamps are canonical UTC ISO timestamps.
- `updatedAt` cannot precede `createdAt`.
- The aggregate is immutable/frozen after normalization.
- Domain construction and rehydration do not depend on React, Tauri, SQLite, PostgreSQL, HTTP or Argin Bridge transport.

## Deferred to Later Steps

Step 2 deliberately does not define:

- Purchase commercial fact snapshots — Step 3.
- durable source identity/version contracts — Step 4.
- posting event classification — Step 5.
- Posting Rules/account resolution — Step 6.
- supplier-invoice/VAT/charge/return/correction formulas — Steps 7–11.
- Inventory Valuation integration — Step 12.
- Journal proposal construction — Step 13.
- atomic commit — Step 14.
- idempotency/replay and optimistic concurrency — Steps 15–16.
- reversal command behavior — Step 17.
- Fiscal/Dimension details — Steps 18–19.
- SQLite persistence — Steps 20–21.
- Argin Bridge envelope — Step 22.

This prevents Step 2 from becoming a premature general Posting Engine implementation.

## Argin Bridge Compatibility

The model is Bridge-ready by construction because its aggregate identity and scope are durable strings rather than SQLite row identity, timestamps are canonical UTC, and all state is serializable.

Step 22 will add the actual versioned Bridge contract and synchronization envelope.
