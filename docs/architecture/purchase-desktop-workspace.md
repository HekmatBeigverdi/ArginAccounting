# Purchase Desktop Workspace

## Status

Phase 22 Step 20 delivers the first Persian RTL Desktop workspace for the Purchase workflow.

The workspace is an Application consumer. It does not own Purchase Domain rules, Inventory movement rules, Approval, Audit, Fiscal numbering, or valuation.

## Route and Navigation

Desktop route:

- `/purchases/documents`

Navigation:

- label: `اسناد خرید`
- group: `خرید و تدارکات`
- required permission: `purchases.documents.view`

## RTL and Localization

The page root is RTL.

Persian is used for labels, lifecycle actions, statuses and dialogs. Fields where digit ordering must remain stable are explicitly LTR, including:

- Jalali date entry;
- quantity;
- unit price;
- discount percentage;
- extra charge.

Purchase business date is stored internally as Gregorian `YYYY-MM-DD`. The UI converts at the boundary to/from Jalali and displays dates with `fa-IR-u-ca-persian`.

Amounts are displayed in Rial. Purchase Domain still owns exact money/rounding semantics.

## Workspace Layout

The workspace follows the existing Inventory list/detail pattern:

- searchable Purchase document list;
- selected-document detail pane;
- status and version;
- commercial line table;
- document totals;
- lifecycle action toolbar;
- lifecycle history;
- modal creation/edit-intent surfaces.

The CSS consumes the shared display-density tokens so the screen follows the selected application density.

## Purchase Creation

The creation workspace supports:

- Purchase Order;
- Supplier Invoice;
- Purchase Return;
- Purchase Correction.

Supplier choices come from active Party master data with the Supplier role.

Product/Service choices come from active purchasable Product master data.

The workspace captures Product/Service and Supplier snapshots through the Purchase Domain snapshot builders rather than copying arbitrary UI DTOs.

For each commercial line the operator enters:

- Product/Service;
- quantity and unit;
- unit price;
- percentage discount;
- fixed additional charge;
- optional description.

Tax treatment and rate are read from Product master data and shown rather than re-entered manually.

The Desktop composition builds `PurchaseCommercialTerms`; pricing/tax totals are calculated by the Phase 22 Purchase pricing engine.

## Draft Editing

Users with `purchases.documents.edit` can open a draft in the populated Purchase form,
change its supplier, date, description and commercial lines, then save changes.
Document ID, number, type, company, branch, fiscal year and lifecycle history are retained.
Existing line tax and unit snapshots are retained when editing the same item and unit.
The form supports the same single percentage discount and fixed charge as creation;
documents with other adjustment combinations are rejected rather than silently simplified.

The secured edit command rechecks draft status, expected version and fiscal eligibility.
Header, lines, commercial facts and replay result are committed in one transaction.
Submitted documents cannot be edited; a document returned to draft can be edited again.
Edits are recorded as `purchase.document.edit` / Audit `update`.

## Return and Correction

Return/correction creation requires a confirmed Supplier Invoice as the original document.

The selected original document supplies the Supplier identity, and the new compensating document records:

- `correctionReference.documentId`;
- required reason.

The compensating Purchase document follows its own normal Submit -> Approve -> Confirm lifecycle.

After the compensating document is confirmed, the original confirmed Supplier Invoice exposes the appropriate secured terminal action:

- link confirmed Purchase Return -> original becomes `returned`;
- link confirmed Purchase Correction -> original becomes `corrected`.

The original Purchase facts are not edited in place.

## Lifecycle, Approval and Security

UI actions are permission-aware and route through `SecuredPurchaseService`:

- Submit;
- Approve;
- Confirm;
- Cancel;
- Reopen;
- Return;
- Correct;
- Inventory receipt staging.

Approval remains separate from Purchase lifecycle and Confirm remains blocked unless the current submission-cycle Approval is approved, as frozen in Step 19.

Lifecycle history is visible in the document detail pane.

## Optimistic Concurrency

Every lifecycle command carries the selected aggregate version.

When `PURCHASE_APP_VERSION_CONFLICT` is returned, the UI reloads the selected Purchase document and shows a localized stale-version message. It does not silently overwrite another mutation.

## Fiscal and Numbering Composition

Creation captures the current active Company/Branch/Fiscal Year context.

Desktop composition resolves the matching Fiscal Period and active Purchase historical lock, creating the historical `PurchaseDocumentScope` snapshot.

Current mutations also pass through `validateOperationDate`.

Document numbering continues to use the shared Fiscal Number Series and `generateDocumentNumber`; the UI never calculates Purchase numbers itself.

When an applicable Purchase number series does not yet exist, Desktop composition provisions the default Purchase series for that document type and then uses the shared Fiscal generator.

## Inventory Receipt Staging

For a confirmed Purchase Order or Supplier Invoice with stock-product lines, an authorized user can choose a destination Warehouse and request an Inventory receipt draft.

Once a receipt exists, Purchase displays its current Inventory number and status instead of the creation button.
The link is resolved from Inventory's persisted source reference, including receipts created before this UI update.
Repeated requests return the existing receipt, including after Inventory confirmation; concurrent creation is
also protected by the existing unique source constraint. Source conflicts are distinguished from duplicate numbers.

The Purchase workspace sends source intent through the Purchase -> Inventory contract.

The Desktop adapter:

- reads the persisted Purchase source;
- resolves current Product/Warehouse master data needed by Inventory;
- builds Inventory-owned line operations;
- calls `InventoryDraftService`.

It never inserts or updates Inventory SQL directly and never confirms stock automatically.

The created Inventory document remains a Draft and must follow Inventory's own secured lifecycle.

## Commercial Read Model

Step 20 uses the existing Purchase repositories for the workspace detail:

- Purchase aggregate;
- line Commercial Facts.

Line and document totals are derived using the frozen Purchase pricing engine.

Step 20 intentionally does not introduce the broader operational Purchase reports owned by Step 21.

## Desktop Dependencies

`@argin/desktop` now consumes:

- `@argin/purchase`;
- `@argin/purchase-tauri`;

in addition to the existing Party, Product, Warehouse, Fiscal, Inventory and Audit capabilities required for composition.

## Deferred Scope

Step 20 does not implement:

- Purchase operational reports are delivered by Step 21 in [Purchase Operational Reports](purchase-operational-reports.md); Step 20 itself remains the transactional document workspace.
- final exhaustive Domain/Application test expansion — Step 22;
- full real-SQLite/Desktop/Bridge integration matrix — Step 23;
- accounting posting — Phase 23;
- arbitrary persisted Draft editing, because the current frozen Purchase Application contract creates the complete Draft atomically rather than exposing an update-Draft command.

The last point is an Application-contract boundary, not an alternate write path in the UI.

## Confirmed Receipt Matching and Cost Recovery

A confirmed Supplier Invoice with a confirmed linked receipt exposes **تطبیق و ثبت هزینه رسید**.
This is an explicit secured write, separate from viewing a document or report. It requires both
`purchases.matching.manage` and `purchases.cost-resolution.manage` in the persisted invoice branch.
The action also works for receipts created before this integration was added.

Only durable Purchase source document/line references are used; matching is never inferred from
product names, dates, or equal quantities. The existing Purchase application validates invoice and
receipt status, Company, Product and cumulative base quantity. Partial or conflicting existing
matches require review and are not silently expanded. Receipt quantity movements are not changed.

The workflow invokes the secured matching and cost-resolution commands with stable operation IDs.
Retries preserve match identity and the completed outcome. The Inventory adapter consumes the exact
Purchase cost basis (including discounts and line charges, excluding VAT), without recalculating it
from a rounded unit cost. Existing manual cost inputs are rejected before creating Purchase facts.

Cost delivery is separate from Purchase persistence, as required by the application boundary. A
failed delivery can be retried using the same action. Reports retain such movements as pending.
Inventory owns the monetary projections: accepting a source basis advances the valuation stream
revision and makes the basis available to the existing valuation workflow; it does not invent FIFO
layers, post journals, or rewrite historical valuation entries.
