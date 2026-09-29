# Purchase Fulfillment and Accounting Policy

## Purpose

Phase 23 Step 26 freezes the company-level accounting eligibility policy that bridges a confirmed Supplier Invoice to Inventory fulfillment and Purchase Posting without collapsing Purchase, Inventory and Accounting into one document.

The objective is ERP-grade behavior with a simple desktop workflow: operational facts remain separate authorities, while the user can progress from invoice to receipt to accounting without re-entering commercial or accounting data.

## Authority boundaries

- Purchase owns Supplier Invoice commercial facts.
- Inventory owns physical receipt documents, stock movements and on-hand quantity.
- Inventory Valuation owns FIFO / Moving Weighted Average valuation facts.
- Purchase Posting owns accounting eligibility/orchestration and mapping.
- Accounting owns Journal Vouchers and Journal Lines.

A Supplier Invoice must never mutate Inventory quantity directly. A user must never manually re-key the normal purchase Journal merely because the source invoice exists.

## Line fulfillment policy

Purchase lines are classified by the existing canonical Purchase line kind.

| Line kind | Inventory receipt required before Purchase Posting |
| --- | --- |
| `stock-product` | Yes — full authoritative receipt coverage is required |
| `non-stock-product` | No |
| `service` | No |

For stock products, Step 26 deliberately uses a strict **full-receipt-before-posting** gate. Partial receipt remains visible and valid operationally, but it does not make the Supplier Invoice eligible for final Purchase accounting recognition.

Step 28 will own matching calculation. Step 26 consumes fulfillment state only; it does not duplicate receipt quantities or matching authority.

## Company posting mode

The policy supports two company-level modes:

- `automatic`: once the confirmed Supplier Invoice satisfies all required fulfillment/matching gates, the Posting orchestrator may create the Journal automatically.
- `accountant-approval`: once eligible, the invoice waits for an authorized accounting action. That action triggers the Posting engine; it does **not** open a manual Journal-entry form and does not require re-entry of Debit/Credit lines.

The default product behavior can be chosen by company settings in later UI/configuration work. Step 26 freezes the domain vocabulary and eligibility result now.

## Eligibility states

The policy returns one of:

- `blocked`
- `ready-for-automatic-posting`
- `awaiting-accountant-approval`

Blocking reasons include:

- source Supplier Invoice is not confirmed;
- at least one stock line has no receipt;
- at least one stock line is only partially received.

Mixed invoices are supported. Service/non-stock lines are immediately fulfillment-complete, while stock lines must satisfy their receipt gate. The invoice becomes accounting-eligible only when all required line gates are satisfied.

## Relationship to Step 5 event classification

Step 5 classifies a confirmed Supplier Invoice as an accounting event. Step 26 adds an orchestration eligibility gate; it does not rewrite event classification.

Therefore:

```text
confirmed Supplier Invoice
        ↓
accounting event classification
        ↓
fulfillment / matching eligibility
        ↓
posting mode
        ↓
Purchase Posting orchestrator
        ↓
Journal Voucher
```

A confirmed invoice can be an accounting event while still being temporarily blocked from Journal creation because required stock fulfillment has not completed.

## UX rule

The UI must communicate state, not implementation jargon.

For a stock invoice it should eventually be able to show:

```text
Invoice        ✓ Confirmed
Receipt        15 / 20
Matching       Partial
Accounting     Waiting
```

and after completion:

```text
Invoice        ✓ Confirmed
Receipt        20 / 20
Matching       ✓ Complete
Accounting     ✓ Posted / Ready for accountant approval
```

The UI must not ask the user to re-enter Product, quantity, supplier price, VAT, valuation cost, Accounts or Debit/Credit values that are already authoritative elsewhere.

## GR/IR readiness

The policy does not yet force a single accounting model for every company. The Purchase Posting architecture remains compatible with configured GR/IR clearing treatment where receipt and invoice recognition occur at different times.

Step 26 only freezes fulfillment eligibility and posting-mode semantics. Exact GR/IR Journal orchestration belongs to the later orchestration step and existing Posting rules.

## Argin Bridge

The policy is persistence-neutral and deterministic. Bridge synchronization must carry authoritative Purchase/Inventory/Posting facts and durable IDs; derived eligibility can be rebuilt.

No UI-only state, SQLite row ID or duplicated receipt quantity becomes synchronization authority.

## Deferred implementation

- Step 27: invoice-to-Goods-Receipt workflow and no-reentry UX.
- Step 28: 2-way / 3-way Purchase Matching Engine.
- Step 29: automatic/approval Purchase Posting orchestrator.
- Step 30: unified Purchase Accounting Workspace UX.
- Step 31: workflow hardening.
- Steps 32–34: domain/application, E2E and failure/replay validation.
