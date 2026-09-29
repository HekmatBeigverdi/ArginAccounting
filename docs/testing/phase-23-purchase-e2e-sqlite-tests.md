# Purchase End-to-End SQLite Acceptance Matrix

## Purpose

Phase 23 Step 33 validates the real SQLite path from a confirmed Supplier Invoice through Inventory receipt, Purchase matching, Purchase-derived valuation, Purchase Posting and Accounting Journal persistence.

The acceptance target is the integrated durable chain, not isolated mocks:

```text
Supplier Invoice
  -> Inventory Receipt
  -> Stock Movement
  -> Receipt/Invoice Match
  -> Purchase Cost Input
  -> Inventory Valuation Entry
  -> Purchase Posting
  -> Accounting Journal
```

## Core stock-purchase scenario

The Step 33 desktop integration test uses a confirmed stock Supplier Invoice with authoritative Purchase commercial facts, creates and confirms a linked Inventory receipt, persists the stock movement, matches the receipt to the invoice, resolves Purchase cost, projects the cost into Inventory valuation, executes Purchase Posting, and verifies the resulting Journal in SQLite.

The acceptance asserts:

- Purchase source remains the Supplier Invoice;
- receipt source-line trace is preserved;
- matching reaches `matched`;
- Inventory valuation is `resolved`;
- FIFO policy identity/method is retained;
- valuation amount equals the Purchase-derived cost basis;
- Purchase Posting becomes `prepared`;
- Accounting Journal is created as `draft`;
- debit and credit totals are equal;
- Journal lines use rule-resolved Inventory and Accounts Payable accounts;
- Purchase -> Posting -> Journal reconciliation is healthy;
- exact Posting replay returns the existing Journal and does not duplicate Accounting effect.

## Purchase-source valuation projection

Step 33 exposed an integration gap: Purchase cost resolution persisted the authoritative Inventory Cost Input but the source-cost adapter did not materialize the resolved valuation entry required by Purchase Posting.

The source-cost adapter now performs the Inventory-owned projection when an effective valuation policy exists:

- creates/resolves the movement valuation entry;
- creates the FIFO layer when FIFO is active;
- remains replay-safe;
- repairs legacy exact Cost Inputs that are missing their valuation projection;
- does not overwrite a conflicting resolved valuation;
- advances the valuation stream revision only when the projection actually changes.

This does not move valuation ownership into Purchase. Purchase delivers the Cost Input; Inventory remains the owner of valuation entries/layers.

## Replay acceptance

The integrated SQLite scenario executes Purchase Posting twice for the same source version.

Expected result:

- one Purchase Posting aggregate;
- one Journal Voucher;
- one Posting idempotency record;
- second execution reports replay;
- no duplicate Journal lines/economic effect.

## Scope boundary

Step 33 validates the local SQLite E2E business path and durable accounting outcome.

Step 34 remains responsible for broader Bridge synchronization, injected rollback/failure cases, cross-runtime replay/CAS and synchronization-boundary acceptance.
