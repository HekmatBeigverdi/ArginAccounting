# Phase 23 — Manual Desktop Acceptance Evidence

## Scope

This record captures owner-executed Desktop acceptance observations performed after Steps 26–34 and the corrective work that followed. It is evidence for Phase 23 documentation and final release review; it is not a substitute for the Step 36 automated release gate.

## Accepted workflow observations

The owner exercised the Persian RTL Purchase workspace with real Desktop data and verified the intended operational path around Supplier Invoices, Inventory receipts, Purchase matching, Inventory valuation, Purchase Posting and Accounting Journal visibility.

The acceptance sequence included:

- Supplier Invoice with a stock-tracked Product.
- Multiple confirmed Inventory receipts for one Supplier Invoice.
- Full quantity fulfillment across 8 + 12 units for a 20-unit invoice.
- Durable Purchase matching.
- Purchase Cost Input / valuation handoff.
- Automatic and explicit Purchase Posting execution.
- Accounting Journal creation as a draft.
- Five-stage Purchase-to-Accounting progress visualization.
- Journal detail review from Accounting.
- Product inventory-tracking UX and non-stock behavior.
- Desktop shell behavior with fixed application chrome and independently scrollable content/navigation regions.

## Defects found and resolved during manual acceptance

### Projected vs committed matching

The UI initially treated deterministic matching proposals as if they were already durable Match facts. This caused the Cost Resolution action to appear before Receipt/Invoice matches were actually committed.

Resolution:

- Matching evaluation now exposes projected and committed status independently.
- Cost Resolution and UI gating use committed durable Match state.
- The UI distinguishes “ready to match” from “matched”.

### Inventory-tracking UX

A Product can be a Product master record while still being non-stock when Inventory Tracking is disabled. This was technically correct but unclear to operators.

Resolution:

- Product workspace explains the warehouse/receipt consequences of Inventory Tracking.
- Product detail shows stock-tracked vs non-stock state.
- Purchase lines visibly distinguish stock-tracked and non-stock products.

### Core Purchase Posting rule bootstrap

A confirmed eligible invoice could reach Posting with no Purchase-specific account mapping configured.

Resolution:

- The Desktop composition bootstraps core Purchase Posting mappings from built-in Argin coding-template accounts when safe and unambiguous.
- Inventory Asset and Accounts Payable mappings are created only from known built-in logical account identities.
- Missing or ambiguous mappings still fail closed.

### Supplier PARTY dimension materialization

Built-in Accounts Payable requires the PARTY accounting dimension. A Supplier did not always have the corresponding Accounting Dimension Member.

Resolution:

- Purchase Posting materializes the module-owned PARTY member from authoritative Supplier identity.
- Durable Supplier ID remains the source reference.
- Journal generation no longer relies on a display-name identity.

### Persian Journal descriptions

Generated Journal Line descriptions exposed internal component identifiers such as principal:<uuid> and supplier-payable.

Resolution:

- Purchase-generated Journal and line descriptions are now Persian and business-readable.
- Internal component IDs remain internal identities and are no longer end-user descriptions.

### Source-owned Journal mutation

A Purchase-generated draft Journal initially exposed generic edit/delete actions. Direct deletion reached an SQLite FK failure because Purchase Posting references the Journal.

Resolution:

- Purchase-generated Journals are treated as source-owned system Journals.
- Generic direct edit/delete is blocked in Application services.
- Accounting UI and lifecycle UI hide those actions and explain source ownership.
- Manual draft Journals retain ordinary draft edit/delete behavior.
- Corrections use source workflow or controlled reversal/correction paths.

### Confirmed invoice changed from non-stock to stock-tracked Product

A Supplier Invoice can be confirmed while its Product Snapshot says Inventory Tracking is disabled, after which the Product master may be corrected to enable Inventory Tracking. Rewriting the confirmed invoice in place would violate historical snapshot integrity.

Resolution:

- The workspace detects Inventory Tracking drift between the confirmed invoice snapshot and current Product master.
- If no Inventory Receipt or accounting effect exists, the operator can execute a controlled classification replacement.
- The historical invoice is marked corrected and preserved.
- A replacement Supplier Invoice is created with current Product classification while retaining authoritative commercial terms.
- The replacement carries a durable source reference back to the original invoice.
- A non-economic orphan draft Purchase Posting left by a failed prior attempt does not block the correction and is safely removed.
- If a real accounting or Inventory effect exists, the simple replacement path is blocked and controlled reversal/correction is required.

### Durable Cost Resolution UI state

After Purchase Cost Input had already been persisted, the Cost Resolution button remained visible.

Resolution:

- Purchase workspace now exposes durable Receipt Cost Resolution state from persisted movement/Cost Input facts.
- Completed Cost Resolution hides the duplicate action and displays a completed status instead.

### Desktop application shell

The application previously allowed whole-document scrolling, which made the Tauri desktop runtime feel like a web page.

Resolution:

- Root document scrolling is disabled in Desktop runtime.
- Header/context area and status footer remain fixed.
- Main workspace content scrolls independently.
- Sidebar brand and user areas remain fixed while Navigation scrolls independently.
- Print media explicitly releases the viewport lock.

## Important historical behavior

A confirmed Purchase document keeps its captured Product/Supplier/commercial snapshot. Later Master Data edits do not silently rewrite historical Purchase facts.

For Inventory classification mistakes discovered after confirmation:

```text
confirmed historical invoice
        ↓
controlled classification replacement
        ↓
historical invoice = corrected
replacement invoice = current Product snapshot
        ↓
normal receipt / matching / valuation / posting workflow
```

## Release evidence boundary

This manual acceptance confirms the concrete user-facing scenarios listed above.

It does not claim:

- full monorepo tests passed;
- full typecheck/build/lint passed;
- Rust cargo check passed;
- documentation link/index generation passed;
- Phase 23 merge/tag/release completed.

Those remain Step 36 release-gate responsibilities and must be recorded only after actual execution.
