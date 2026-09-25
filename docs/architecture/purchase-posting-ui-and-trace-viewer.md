# Purchase Posting UI and Trace Viewer

## Status

Phase 23 Step 25.

Step 25 adds the Desktop presentation layer for the Purchase Posting and reconciliation contracts completed in Steps 23–24.

## Placement

The Posting UI is embedded directly in the existing Purchase Documents workspace.

When a Purchase document is selected, the operator sees:

```text
Purchase commercial detail
  -> Purchase Posting panel
  -> Accounting Journal trace
```

No separate re-entry screen is introduced.

## UI Ownership

The React layer does not:

- recalculate Purchase prices;
- recalculate tax;
- recalculate FIFO or Moving Weighted Average;
- choose Accounts;
- create Journal Lines from raw form values;
- mutate Accounting lifecycle directly.

Those responsibilities remain in the Domain/Application contracts from earlier Phase 23 steps.

## Posting Summary

For a reconciled Posting, the panel displays:

- Purchase Posting status;
- Accounting Journal number;
- Accounting Journal lifecycle status;
- Journal balanced amount;
- reconciliation health.

When multiple source versions/revisions exist, the operator can choose the relevant Posting outcome.

## No Posting Yet

If no Purchase Posting exists, the UI explains the current eligibility state:

- Purchase Order: no direct Accounting recognition;
- non-confirmed document: wait for confirmation;
- confirmed document without execute permission: read-only message;
- confirmed document with execute permission: ready for Application-level Posting orchestration.

The UI deliberately does not fabricate a Posting by reconstructing facts in React.

## Trace Viewer

With `purchases.posting.trace.view`, the operator can expand the trace:

```text
Purchase Document
  -> Purchase Posting
  -> Accounting Journal
  -> optional Reversal Journal
```

The Accounting Journal Line table shows:

- line order;
- Account ID;
- Debit;
- Credit.

The data is read from the canonical Accounting Journal returned by Step 24 reconciliation.

## Reconciliation Diagnostics

When reconciliation is unhealthy, the panel displays the deterministic Step 24 diagnostic messages for:

- missing Posting;
- missing Journal;
- source mismatch;
- Company/Branch mismatch;
- imbalance;
- lifecycle mismatch;
- missing/invalid reversal lineage.

The UI does not silently repair any of these conditions.

## Permissions

The Desktop workspace evaluates:

- `purchases.posting.view`;
- `purchases.posting.trace.view`;
- `purchases.posting.execute`;
- `purchases.posting.reverse`.

Company/Branch access is also checked against the signed-in actor's Branch scope.

The low-level SQLite reconciliation reader is never exposed directly to an unauthorized operator.

## Read Model

The Desktop composition uses:

```text
SqlitePurchasePostingReconciliationReader
```

through `createPurchasePostingWorkspaceServices`.

This preserves the Step 24 authoritative read path and does not create a new UI projection table.

## Action Boundary

Step 25 intentionally does not implement accounting formulas inside UI callbacks.

Mutation actions must call the secured Application service from Steps 14–23 using authoritative Purchase/Valuation facts.

The current panel exposes permission/eligibility state and the completed read/trace experience; it does not create a parallel UI-owned posting engine.

## Responsive Presentation

The Posting summary uses a four-cell desktop grid and collapses to two columns on narrower windows.

The trace and Journal Line sections remain horizontally safe for desktop-window resizing.

## Tests

Desktop contract tests verify:

- the Purchase page embeds the Posting panel;
- source ID/type are passed from the selected Purchase document;
- reconciliation and trace UI are present;
- Journal Lines are rendered from canonical Journal data;
- no commercial price/tax re-entry fields are introduced;
- Posting view/trace/execute/reverse permissions remain distinct;
- Desktop declares the required Posting packages.

## Non-Scope

- duplicate commercial-entry UI;
- custom Journal-entry editor;
- Accounting approval/posting UI replacement;
- automatic repair of reconciliation issues;
- Phase 26+ broader automated tests.
