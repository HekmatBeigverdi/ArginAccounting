# Inventory Valuation Persian RTL Workspace

Phase 21 Step 17 adds the Desktop inspection workspace for monetary inventory valuation. It consumes the Step 16 bounded query engine and Step 15 traceability contracts; it does not reimplement valuation arithmetic in React.

CR-21-002 extends Step 17 with the missing bounded mutation path for resolving confirmed inbound movements that have no monetary basis. This does not move monetary price into the immutable Phase 20 receipt document; it links a durable authoritative Cost Input to the confirmed inbound movement.

## Route and Permission

- Route: `/inventory/valuation`.
- Navigation label: `ارزش‌گذاری موجودی`.
- Required view permission: `inventory.valuation.view` (or system full access).
- Policy history remains readable with view permission; policy mutation requires `inventory.valuation.policy.manage` and is not implemented as a shortcut in this read workspace.
- Entering or correcting an inbound Cost Input requires the operation-specific Step 15 valuation cost permission. View permission alone never authorizes monetary mutation.

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
8. Inbound Cost Input resolution/correction for eligible confirmed inbound movements.

## Inbound Cost Input UX

### Entry points

The primary entry point is the unresolved diagnostics surface in `/inventory/valuation`. Every eligible unresolved inbound row exposes `تعیین بهای ورودی`.

A confirmed inventory receipt/detail may expose a safe deep-link/action labelled `ثبت بهای ورودی` that navigates to the valuation workflow with the movement preselected. The inventory document itself remains quantity-only and immutable; no confirmed receipt line is edited to store valuation price.

### Form context

The Cost Input form displays these movement facts as read-only context:

- document number/type and business date;
- `movementId`;
- product;
- warehouse;
- confirmed inbound quantity and base unit;
- Company/Branch context;
- current valuation resolution state.

### Editable monetary input

The bounded form supports:

- unit cost and/or total base cost, with deterministic conversion between them;
- currency;
- source type (`manual` plus contract-supported future ERP/Purchase source identities);
- source reference/description where available;
- effective/source date only where required by the Application contract;
- already-supported landed-cost components/allocation inputs when applicable.

Monetary persistence uses safe-integer smallest currency units. React must not persist binary floating-point monetary values. Unit/total calculations must follow the same deterministic scale and rounding rules as the inbound-cost domain contracts.

### Resolution states

Missing monetary basis is displayed as `بهای تعیین‌نشده` / unresolved and never as zero.

After successful resolution and recalculation the row becomes resolved and the user can drill through:

`Movement -> Cost Input -> effective Policy -> Valuation Entry / FIFO Layer or MWA state`

### Correction

A previously resolved Cost Input is not silently overwritten. `اصلاح بهای ورودی` is a privileged explicit operation that requires:

- correction permission;
- a reason;
- durable request identity;
- before/after Audit evidence;
- concurrency validation;
- deterministic downstream recalculation from the earliest affected chronology point.

## Application Boundary

The UI never writes Cost Input rows directly to SQLite. It calls the valuation Application mutation contract with durable operation context including Company, actor, request identity and expected stream revision/version as required by Step 13.

The mutation must:

1. validate that the referenced Phase 20 movement exists, is confirmed, is inbound and belongs to the active Company/Product scope;
2. validate quantity/currency/money inputs;
3. authorize the monetary mutation;
4. create or explicitly correct the authoritative resolved Cost Input linked by `movementId`;
5. preserve idempotency and optimistic concurrency semantics;
6. append non-duplicated Audit/trace evidence;
7. invalidate and recalculate valuation from the earliest affected chronology point rather than patching derived projection rows directly;
8. return a result that lets the workspace refresh unresolved/currentness/value/layer reports.

## FIFO and Moving Weighted Average Result

The Cost Input is method-neutral authoritative input. The Company policy effective for the movement chronology determines its derived valuation result.

For FIFO, recalculation creates/rebuilds the appropriate cost layer with original quantity, remaining quantity, original monetary basis and remaining monetary value.

For Moving Weighted Average, recalculation incorporates the inbound quantity and cost into the deterministic moving-average monetary pool/state.

The UI does not ask the user to choose FIFO/MWA per receipt.

## Historical Layer Guard

The FIFO layer panel intentionally labels itself as **current open layers**. Current `remainingQuantity` / `remainingCost` must not be presented as historical As-of layer state. Historical monetary position is obtained from the dated valuation-state/report path.

## Argin Bridge Boundary

The UI repeats the authoritative boundary because it is operationally important:

- authoritative: Phase 20 Movement facts, Company Policy history, resolved Cost Inputs;
- rebuildable: Valuation Entry, Cost Layer, Valuation State, report rows, totals and running balances.

A manually resolved Cost Input uses durable identity/source metadata and the same versioned Bridge semantics as a future ERP/Purchase-provided Cost Input. It is not local UI state and is not a SQLite-only workaround.

The workspace never treats report totals or running balances as independent synchronization truth.

## Validation and Acceptance

Focused Step 17 coverage must include:

- unresolved inbound movement is visible and never rendered as zero cost;
- ineligible/non-inbound/unconfirmed movement cannot receive a Cost Input;
- view-only user cannot mutate cost;
- valid manual cost resolves the movement;
- invalid currency/amount/quantity context is rejected;
- duplicate identical `requestId` replays safely without duplicate mutation or Audit;
- same request identity with conflicting payload is rejected;
- concurrent stale expected revision is rejected;
- correction requires explicit reason and Audit evidence;
- successful new/corrected Cost Input triggers recalculation wiring;
- FIFO result creates/rebuilds the expected layer;
- MWA result creates/rebuilds the expected average state;
- trace drill-down shows Movement, Cost Input, effective Policy and derived valuation provenance;
- Bridge mapping treats the Cost Input as authoritative sync data.

Owner acceptance is the concrete end-to-end scenario:

`confirmed receipt -> unresolved valuation -> enter inbound cost -> recalculation -> resolved report -> FIFO/MWA verification`.

Step 17 remains reopened until this path is implemented and accepted.

## Composition

- `create-inventory-valuation-workspace-services.ts` composes the Step 16 report reader, Company policy repository and Product/Warehouse selectors.
- `create-inventory-valuation-trace-service.ts` composes Movement, Entry, Policy and Cost Input readers and delegates provenance construction to `createInventoryValuationTraceSnapshot()`.
- the Step 17 completion must add a dedicated Application-backed Cost Input mutation service/composition boundary rather than exposing repositories directly to React.
- `inventory-valuation-panels.tsx` contains presentational report panels.
- `inventory-valuation-workspace-page.tsx` owns user filters, tabs, Persian dates and report loading.

## Deferred

Step 17 does not add accounting posting, Purchase/Sales invoice ownership, vendor settlement, Bridge live transport, automatic distributed conflict resolution or a new valuation engine. Future Purchase/ERP modules may supply the same authoritative Cost Input automatically through the bounded Application contract. Domain/Application test expansion remains Step 18; real SQLite/Bridge/performance validation remains Step 19.
