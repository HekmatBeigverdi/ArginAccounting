# Inventory Desktop Workspace

## Status

Phase 20 Step 16 defines the Persian RTL desktop workspace for Inventory quantity documents. It consumes the public Inventory Application/SQLite boundaries established in Steps 9–15 and does not introduce valuation, Kardex reporting, import/export, print or PDF behavior.

## Route and Navigation

The workspace is available at `/inventory/documents` and requires `inventory.documents.view` for navigation visibility. Mutation controls are shown only when their dedicated Inventory permission is available.

## Desktop Composition

`createInventoryWorkspaceServices` composes:

- `InventoryDraftService` for create/save/delete of eligible drafts;
- `InventoryApplicationService` for lifecycle and stock-changing confirmation;
- `SecuredInventoryService` for persisted Company/Branch authorization, shared Approval and Audit;
- `SqliteInventoryUnitOfWork` for atomic Inventory persistence;
- `SqliteInventoryWorkspaceReader` for bounded list/detail reads;
- Product and Warehouse public selector/read adapters;
- Company/Fiscal repositories and the shared Fiscal Number Series service.

The React page never writes Inventory stock tables directly. Product, Warehouse and Fiscal master data remain owned by their upstream modules.

## Draft Editor

The workspace supports the five Phase 20 document types: receipt, issue, opening quantity, transfer and quantity adjustment. A draft may contain stable line IDs with Product, exact entered quantity, unit, source Warehouse/Zone/Location, optional transfer destination and description.

Quantity stays a canonical decimal string through the UI/Application boundary. Codes, quantities, document numbers and durable IDs use explicit LTR presentation inside the RTL page.

Product lookup is bounded and excludes services/ineligible stock items. Warehouse lookup is bounded and uses active Company/Branch-visible master records. Zone and Location selection is subordinate to the chosen Warehouse.

## Persian Date Boundary

Internal business dates remain Gregorian `YYYY-MM-DD`. The Desktop input/display boundary uses the Solar Hijri calendar. Jalali input is normalized from Persian/Arabic digits, validated by round-trip conversion and converted to Gregorian before reaching Application persistence.

The open Fiscal Period is resolved through the Fiscal repository before a draft is created. The UI does not store Jalali strings in Inventory tables.

## Lifecycle and Approval

Lifecycle controls reflect the frozen state machine:

- Draft -> Submit
- Submitted -> Approve
- Approved -> Confirm
- Draft/Submitted/Approved -> Cancel
- Confirmed -> Full reversal

Approval and stock confirmation remain separate permissions. Submit/approve/confirm/cancel/reverse use `SecuredInventoryService`; confirmation therefore retains shared Approval gating and the atomic stock UoW from Step 13.

The workspace links to the shared Approval request and renders Inventory lifecycle history with Persian timestamps.

## Concurrency Recovery

Draft saves and lifecycle commands carry `expectedVersion`. If `inventory.application.concurrency-conflict` occurs, the workspace reloads the persisted document and tells the user that a newer version was loaded. User-entered dialog state is not silently converted into an overwrite.

## Accessibility and RTL

The workspace uses native labelled controls, keyboard-operable buttons/selects/details, semantic tables, dialog roles and responsive layout. The page root is RTL while code/quantity/date-entry fields that require stable digit ordering are explicitly LTR.

## Deferred

- Quantity Kardex, balance reporting and source drill-down: Step 17.
- Import/export, print and PDF: Step 18.
- Inventory valuation and cost layers: Phase 21.
- Live Argin Bridge transport/conflict UI: Phase 45.
