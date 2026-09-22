# ADR-0023 — Purchase Posting Boundary and Source Authority

## Status

Accepted for Phase 23 Step 1.

## Context

ArginAccounting already separates three authoritative operational concerns:

- Phase 20 Inventory owns quantity documents and Stock Movement identity.
- Phase 21 Inventory Valuation owns FIFO / Moving Weighted Average valuation results.
- Phase 22 Purchase owns Supplier commercial facts and normal Purchase price entry.

The next requirement is accounting recognition for supplier payable, VAT, Inventory/GRNI/Purchase expense effects, returns and corrections.

If Purchase Posting independently stores or recalculates purchase price, stock quantity or inventory cost, the system would create competing sources of truth and make replay, correction, synchronization and audit unreliable.

ArginAccounting is also offline-first today but must remain compatible with the future Argin Bridge / ASP.NET Core / PostgreSQL architecture.

## Decision

Phase 23 is an accounting-recognition boundary.

It consumes durable authoritative facts from Purchase, Inventory and Inventory Valuation and converts them into deterministic posting intent and Journal Vouchers through existing Accounting/Journal contracts.

Dependency direction is one-way:

```text
Purchase commercial facts
Inventory movement identity
Inventory valuation outputs
          ↓
Purchase Posting
          ↓
Journal / General Ledger
```

### Source authority

- Purchase commercial price, discounts, charges, taxes and supplier context remain Purchase-owned.
- Stock quantity and movement identity remain Inventory-owned.
- FIFO/MWA cost and valuation chronology remain Inventory-Valuation-owned.
- Journal Vouchers and Journal Lines remain Accounting-owned.
- Phase 23 owns only the Purchase-specific mapping/orchestration that joins those authorities into accounting recognition.

### No duplicate price/cost store

Purchase Posting must not create a second editable field or table that becomes an independent authority for:

- supplier unit price;
- discounts;
- charges;
- VAT rate/amount;
- inventory Cost Input;
- FIFO layer cost;
- Moving Weighted Average state.

Persisted Posting snapshots may capture the exact authoritative inputs used for audit/replay, but such snapshots are immutable provenance, not a new editable source of truth.

### Posting behavior

- Only eligible durable source facts can post.
- A complete posting must balance before commit.
- Multi-write posting is atomic.
- Missing account resolution fails explicitly.
- Posted Journal history is not edited in place.
- Correction and cancellation use linked compensating/reversal facts.
- Posting is idempotent by durable source + version/revision + purpose + deterministic payload identity.
- Exact replay returns the original committed outcome.
- Incompatible reuse of identity conflicts.

### Purchase Order

`purchase-order` is non-posting in Phase 23 because it represents commercial intent rather than recognized supplier liability/accounting effect.

### Inventory / GRNI boundary

Phase 23 may support configured Inventory/GRNI accounting treatment, but it cannot infer inventory value by re-running FIFO/MWA or by reusing supplier price where authoritative valuation output is required.

Exact recognition timing and rule semantics are implemented in the dedicated later steps of Phase 23.

### Argin Bridge

Purchase Posting contracts are persistence-neutral and Bridge-ready from inception.

Bridge-compatible posting identity must preserve:

- durable posting ID;
- Company and Branch;
- source type, source ID and source version/revision;
- request ID and operation ID;
- idempotency key;
- payload fingerprint;
- correlation ID and causation ID;
- occurred/effective timestamps;
- reversal/correction lineage;
- schema/version information.

SQLite row IDs are never synchronization identity.

The Bridge synchronizes authoritative posting facts/contracts and provenance. Rebuildable UI summaries, report totals and ledger projections are not independent synchronization authority.

Live synchronization transport is outside Phase 23.

## Consequences

### Positive

- One source of truth remains for Purchase price, quantity and inventory cost.
- Posting can be replayed safely.
- Accounting corrections preserve history.
- Offline SQLite and future server runtimes can share contracts.
- Source-to-ledger reconciliation is structurally possible.
- Sales/Treasury Posting can later reuse the same general posting principles without importing Purchase-specific ownership into their domains.

### Trade-offs

- Phase 23 must depend on explicit public contracts from several modules.
- Account resolution failures must be surfaced instead of hidden with defaults.
- Posting snapshots/provenance add durable data, but are necessary for audit and deterministic replay.
- General Posting Rules remain a later roadmap capability; Phase 23 therefore implements only the minimum Purchase-specific rule boundary needed now, while avoiding a conflicting general framework.

## Rejected Alternatives

### Recalculate Purchase cost inside Posting

Rejected because it duplicates Purchase/Valuation authority and can diverge from the historical facts used by Inventory.

### Let Purchase write Journal tables directly

Rejected because it bypasses Accounting ownership, lifecycle invariants and reusable posting boundaries.

### Store only Journal ID on Purchase

Rejected because it is insufficient for deterministic replay, correction lineage, Bridge synchronization and source-version traceability.

### Implement live Argin Bridge synchronization now

Rejected because Phase 23 must define portable synchronization contracts, while live synchronization transport remains a later roadmap responsibility.
