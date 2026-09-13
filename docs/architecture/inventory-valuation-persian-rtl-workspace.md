# Inventory Valuation Persian RTL Workspace

Phase 21 Step 17 adds the Desktop inspection workspace for monetary inventory valuation. It consumes the Step 16 bounded query engine and Step 15 traceability contracts; it does not reimplement valuation arithmetic in React.

## Route and Permission

- Route: `/inventory/valuation`.
- Navigation label: `ارزش‌گذاری موجودی`.
- Required permission: `inventory.valuation.view` (or system full access).
- Policy history remains readable with view permission; policy mutation requires `inventory.valuation.policy.manage` and is not implemented as a shortcut in this read workspace.

## Persian RTL Surfaces

The workspace is `dir="rtl"`, uses the shared Solar Hijri conversion utilities and follows the shared display-density CSS variables. Durable identifiers remain isolated with `bdi`/LTR semantics.

The workspace exposes:

1. As-of inventory value with resolved total and explicit unresolved rows.
2. Monetary Kardex with opening/closing resolved value and canonical cursor pagination.
3. Current open FIFO layers.
4. Unresolved valuation diagnostics.
5. Company valuation-policy history.
6. Valuation currentness/recalculation status.
7. Provenance drill-down from Movement to Cost Input, effective Policy and Valuation Entry.

## Historical Layer Guard

The FIFO layer panel intentionally labels itself as **current open layers**. Current `remainingQuantity` / `remainingCost` must not be presented as historical As-of layer state. Historical monetary position is obtained from the dated valuation-state/report path.

## Argin Bridge Boundary

The UI repeats the authoritative boundary because it is operationally important:

- authoritative: Phase 20 Movement facts, Company Policy history, resolved Cost Inputs;
- rebuildable: Valuation Entry, Cost Layer, Valuation State, report rows, totals and running balances.

The workspace never treats report totals or running balances as independent synchronization truth.

## Composition

- `create-inventory-valuation-workspace-services.ts` composes the Step 16 report reader, Company policy repository and Product/Warehouse selectors.
- `create-inventory-valuation-trace-service.ts` composes Movement, Entry, Policy and Cost Input readers and delegates provenance construction to `createInventoryValuationTraceSnapshot()`.
- `inventory-valuation-panels.tsx` contains presentational report panels.
- `inventory-valuation-workspace-page.tsx` owns user filters, tabs, Persian dates and report loading.

## Deferred

Step 17 does not add accounting posting, Purchase/Sales workflow, Bridge transport, automatic conflict resolution or a new valuation engine. Domain/Application test expansion remains Step 18; real SQLite/Bridge/performance validation remains Step 19.
