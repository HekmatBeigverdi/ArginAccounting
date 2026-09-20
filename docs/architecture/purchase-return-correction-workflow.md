# Purchase Return and Correction Workflow

## Purpose

Step 12 defines compensating Purchase behavior after a confirmed supplier invoice. Confirmed commercial history is immutable: a return or correction is represented by a new durable Purchase document, never by rewriting the original invoice.

## Purchase Return

A confirmed `purchase-return` must reference the confirmed `supplier-invoice` it compensates, share Company and Supplier identity, and carry a non-empty reason.

For stock lines, the return produces outbound Inventory intent. Purchase does not delete or edit the original receipt movement and does not manufacture StockMovement facts itself. Inventory remains authoritative for the compensating outbound movement and its lifecycle.

Returned base quantity must be positive and cannot exceed the original Purchase line base quantity. Duplicate original/return line identities in one plan are rejected.

The normal return path does not rewrite the original inbound Cost Input. The physical return becomes a new outbound movement and FIFO/MWA values that movement under the active valuation policy. A backdated return can still cause normal valuation replay according to Inventory chronology, but that is not modeled as mutation of the original Purchase Cost Input.

Partial returns are represented by one or more linked return documents. They must not silently overwrite the original invoice. Whether a complete business return qualifies the original document for the terminal `returned` lifecycle state is decided by the application orchestration after checking cumulative return coverage.

## Purchase Correction

A confirmed `purchase-correction` must reference the confirmed supplier invoice, share Company/Supplier identity, and preserve a reason.

Supported line effects are:

- `commercial-replacement`: commercial amount/cost facts changed while quantity may remain unchanged;
- `quantity-decrease`: corrected quantity is lower and creates outbound compensating Inventory intent for the delta;
- `quantity-increase`: corrected quantity is higher and creates inbound follow-up Inventory intent for the delta.

Corrections never mutate the original document. When confirmed Purchase commercial facts that already supplied authoritative cost to one or more receipt movements change, the correction replaces the active authoritative Purchase Cost Input through the controlled application flow and requests valuation replay with reason `cost_basis_changed` from the earliest affected movement.

No affected movement means there is no historical valuation replay yet; the corrected commercial fact becomes the source used by later matching/cost resolution.

## Inventory and Valuation Ownership

Purchase emits compensating business intent only. Inventory owns receipt/issue/reversal movements and their confirmation. Inventory Valuation owns FIFO/MWA, unresolved state, recalculation planning and derived layers/state.

A return must not use a negative Purchase quantity to mutate an old receipt. A correction must not silently edit an old Cost Input. The application layer in Steps 13–14 will coordinate the durable documents, matches, Inventory operations and valuation recalculation inside explicit transaction boundaries.

## Argin Bridge

Return and correction documents synchronize as independent authoritative Purchase facts with durable IDs and links to the original Purchase document/line. Inventory compensating movements remain Inventory facts. Updated authoritative Cost Inputs remain valuation inputs; FIFO layers and MWA state are rebuildable projections.

Replay must therefore be able to distinguish:

- the original supplier invoice;
- each return/correction document;
- each compensating Inventory movement;
- the replaced/new authoritative Cost Input;
- the valuation recalculation boundary.

No SQLite row identity is part of the cross-store contract.
