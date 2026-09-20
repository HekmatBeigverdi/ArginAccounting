# Inventory Valuation Persian RTL Workspace

Phase 21 Step 17 adds the Desktop inspection workspace for monetary inventory valuation. It consumes the Step 16 bounded query engine and Step 15 traceability contracts; it does not reimplement valuation arithmetic in React.

CR-21-002 extends Step 17 with a bounded exception path for resolving confirmed inbound movements that have no monetary basis. This does not move commercial Purchase pricing into Inventory Valuation and does not move monetary price into the immutable Phase 20 receipt document; it links a durable authoritative Cost Input to the confirmed inbound movement.

The canonical cross-phase ownership is defined in [Commercial Pricing and Inventory Valuation Boundary](commercial-pricing-and-valuation-boundary.md).

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
8. Exception resolution/correction for eligible confirmed inbound movements whose authoritative cost is missing or historically wrong.

## Inbound Cost Exception UX

### Normal path versus exception path

The normal future Purchase path is:

`Purchase Workflow -> confirmed stock receipt/movement -> automatic Cost Input -> Inventory Valuation`

The user must not re-enter the same supplier price in Inventory Valuation after entering it in Purchase.

The manual valuation surface is reserved for exceptions such as opening inventory, legacy/manual receipts, migration/import, external ERP gaps or controlled historical correction.

### Entry points

The primary entry point is the unresolved diagnostics surface in `/inventory/valuation`. Eligible unresolved inbound rows expose an action such as `رفع بهای ورودی نامشخص` / `تعیین بهای ورودی`.

A confirmed inventory receipt/detail may expose a safe deep-link only when no authoritative upstream Cost Input exists. Once Phase 22 Purchase Workflow is available, Purchase-linked receipts with valid commercial cost should be resolved automatically and should not appear as manual pricing work.

The inventory document itself remains quantity-only and immutable; no confirmed receipt line is edited to store valuation price.

### Form context

The Cost Input form displays these movement facts as read-only context:

- document number/type and business date;
- `movementId`;
- product;
- warehouse;
- confirmed inbound quantity and base unit;
- Company/Branch context;
- current valuation resolution state;
- cost source/provenance where available.

### Editable monetary input

The exception form supports only the monetary data required to resolve the missing authoritative input:

- unit cost and/or total base cost, with deterministic conversion between them;
- currency;
- explicit source type/reference;
- correction reason when replacing/correcting an existing Cost Input;
- already-supported landed-cost components/allocation inputs when applicable.

Monetary persistence uses safe-integer smallest currency units. React must not persist binary floating-point monetary values. Unit/total calculations must follow the same deterministic scale and rounding rules as the inbound-cost domain contracts.

### Resolution states

Missing monetary basis is displayed as `بهای تعیین‌نشده` / unresolved and never as zero.

After successful resolution and recalculation the row becomes resolved and the user can drill through:

`Movement -> Cost Input -> effective Policy -> Valuation Entry / FIFO Layer or MWA state`

### Registered Cost Inputs

Registered Cost Inputs may remain visible in Inventory Valuation for review, provenance and controlled correction. This list is **not** a Purchase price list and is **not** the place to maintain future supplier prices or Sales prices.

The list should answer operational questions such as:

- what cost did this inbound movement receive?
- where did that cost come from?
- has valuation consumed it?
- was it corrected and why?

### Correction

A previously resolved Cost Input is not silently overwritten. `اصلاح بهای ورودی` is a privileged historical-correction operation that requires:

- correction permission;
- a reason;
- durable request identity;
- before/after Audit evidence;
- concurrency validation;
- deterministic downstream recalculation from the earliest affected chronology point.

A future supplier price increase is not a correction; it belongs to a new Purchase transaction. A Sales price change belongs to Sales pricing and never modifies an inbound Cost Input.

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

A manually resolved Cost Input uses durable identity/source metadata and the same versioned Bridge semantics as a future Purchase-provided Cost Input. It is not local UI state and is not a SQLite-only workaround.

Purchase commercial prices remain Purchase facts; Sales price lists/invoice prices remain Sales facts. Bridge sync must not duplicate either of those concepts into Inventory Valuation as independent truth.

## Validation and Acceptance

Focused Step 17 coverage must include:

- unresolved inbound movement is visible and never rendered as zero cost;
- ineligible/non-inbound/unconfirmed movement cannot receive a Cost Input;
- view-only user cannot mutate cost;
- valid manual exception cost resolves the movement;
- invalid currency/amount/quantity context is rejected;
- duplicate identical `requestId` replays safely without duplicate mutation or Audit;
- same request identity with conflicting payload is rejected;
- concurrent stale expected revision is rejected;
- correction requires explicit reason and Audit evidence;
- successful new/corrected Cost Input triggers recalculation wiring;
- FIFO result creates/rebuilds the expected layer;
- MWA result creates/rebuilds the expected average state;
- trace drill-down shows Movement, Cost Input, effective Policy and derived valuation provenance;
- Bridge mapping treats the Cost Input as authoritative sync data;
- a future Purchase-linked receipt with authoritative commercial cost can bypass manual pricing and arrive already resolved.

Owner acceptance for the current Phase 21 fallback path is:

`confirmed receipt without Purchase cost -> unresolved valuation -> manual exception Cost Input -> recalculation -> resolved report -> FIFO/MWA verification`.

The future Phase 22 acceptance path must additionally prove:

`Purchase price entered once -> linked receipt -> automatic Cost Input -> Inventory Valuation without duplicate manual entry`.

## Composition

- `create-inventory-valuation-workspace-services.ts` composes the Step 16 report reader, Company policy repository and Product/Warehouse selectors.
- `create-inventory-valuation-trace-service.ts` composes Movement, Entry, Policy and Cost Input readers and delegates provenance construction to `createInventoryValuationTraceSnapshot()`.
- the Step 17 completion uses a dedicated Application-backed Cost Input mutation service/composition boundary rather than exposing repositories directly to React.
- `inventory-valuation-panels.tsx` contains presentational report/exception panels.
- `inventory-valuation-workspace-page.tsx` owns user filters, tabs, Persian dates and report loading.

## Deferred

Step 17 does not add Purchase/Sales invoice ownership, supplier price-list management, Sales price lists, vendor settlement, accounting posting, Bridge live transport, automatic distributed conflict resolution or a new valuation engine. Phase 22 becomes the normal owner of Purchase price capture and automatic Purchase-to-Cost-Input integration. Phase 24 owns Sales pricing. Domain/Application test expansion remains Step 18; real SQLite/Bridge/performance validation remains Step 19.
