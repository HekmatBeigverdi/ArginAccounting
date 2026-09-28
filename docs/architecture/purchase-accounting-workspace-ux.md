# Purchase Accounting Workspace UX

## Purpose

Phase 23 Step 30 turns the Purchase Posting surface into a single operational workspace that explains where a Supplier Invoice is in the end-to-end Purchase-to-Accounting flow and what the user should do next.

The workspace is explanatory and orchestration-focused. It does not introduce a second accounting-entry path and does not ask the user to re-enter commercial amounts, Debit/Credit sides, or account mappings.

## Workflow visualization

For Supplier Invoices the workspace renders five stages:

1. Supplier Invoice confirmation.
2. Inventory receipt fulfillment.
3. Purchase matching.
4. Purchase Posting preparation.
5. Accounting Journal creation/lifecycle state.

Each stage has a compact semantic status. Service and non-stock invoices explicitly show that Inventory receipt and stock matching are not required.

## Contextual next action

The workspace derives one human-readable next action from the current state, for example:

- confirm the Supplier Invoice;
- complete remaining Inventory receipt;
- resolve a Purchase matching variance;
- match confirmed receipts;
- retry accounting Posting;
- continue the Accounting Journal lifecycle.

The UI never mutates authoritative status merely to make the workflow look complete.

## Failure UX

Automatic Posting failures are displayed as an actionable panel that makes two points explicit:

- the confirmed Purchase document remains valid;
- after the configuration/dependency problem is fixed, the user may retry **Create accounting posting**.

This keeps commercial confirmation independent from downstream accounting configuration.

## Journal summary

Once a Journal exists, the workspace shows:

- Purchase Posting status and source version;
- Journal number and Journal lifecycle status;
- debit/credit balance;
- chain reconciliation health;
- trace from Purchase source through Posting to Journal/Reversal;
- Journal lines.

Journal lines resolve Accounting account IDs to human-readable account code and name for display. The durable account ID remains authoritative.

## Permission boundary

The workspace keeps independent permission checks for:

- view;
- trace;
- execute;
- reverse.

Account-label lookup requires Purchase Posting view permission and remains company-scoped.

## Responsive behavior

The five-stage workflow uses a multi-column desktop layout and progressively collapses to three columns and then one column for narrow screens.

No fixed desktop-only width is required to understand the flow.

## Argin Bridge

All workflow colors, labels, step completion indicators, and next-action text are projections.

Bridge synchronization authority remains the durable Purchase document/source version, matching facts, Inventory facts, Purchase Posting aggregate, Journal Voucher and reversal/idempotency lineage.
