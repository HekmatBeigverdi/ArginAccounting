# Phase 20 Performance, Accessibility, Quality, and Documentation Evidence

## Scope

This record implements the Phase 20 Step 21 validation surface. It deliberately distinguishes committed validation gates from execution evidence observed outside GitHub.

## Performance Dataset and Query Plans

`apps/desktop/src-tauri/tests/phase20_inventory_performance.rs` creates a real in-memory SQLite database and seeds 20,000 representative movement facts across companies, products, warehouses and business dates.

The suite runs `EXPLAIN QUERY PLAN` against the same StockKey/date/chronology pattern used by the quantity Kardex and asserts use of:

- `ix_inventory_stock_movements_stock_kardex` for the ordinary movement partition;
- `ix_inventory_compensation_stock_kardex` for the reversal-compensation partition;
- `ix_inventory_stock_movements_product_date` for Product/date movement-feed scans.

The representative Kardex read remains explicitly bounded to `limit + 1`; opening-prefix reads remain chunked at 500 facts. Performance tests intentionally avoid fragile wall-clock assertions and instead gate the stable properties that prevent unbounded/full-scan regressions: bounded result size and accepted SQLite query plans.

## Accessibility and Persian UI Quality

`apps/desktop/tests/phase20-inventory-accessibility-quality.test.ts` protects the Phase 20 Desktop conventions:

- Persian Inventory workspaces remain RTL at the page boundary;
- report mode/view controls retain labelled semantic groups;
- form controls remain associated with visible labels;
- error/status content remains exposed through semantic Feedback/alert/status patterns;
- quantities and durable codes retain explicit LTR islands inside RTL content;
- reporting does not convert canonical quantity strings through JavaScript floating point.

Manual Desktop acceptance must additionally verify keyboard traversal, visible focus, zoom/readability, error recovery, Jalali entry, document lifecycle buttons, aggregate/detailed balance switching, Kardex source drill-down, import preview, Excel export, full-screen print preview and matching Print/PDF orientation.

## Quality Gates

The repository root exposes `pnpm validate:phase20`, which runs:

1. Inventory Domain/Application typecheck and tests;
2. Inventory SQLite adapter typecheck and tests;
3. Warehouse typecheck/tests, including downstream dependency registration;
4. Desktop typecheck/tests/build;
5. real Rust/SQLx Phase 20 migration/rebuild/performance tests;
6. `cargo check` for the Desktop Tauri crate;
7. documentation link validation;
8. full monorepo typecheck, test, build and lint gates.

Documentation utilities are exposed as `pnpm docs:index` and `pnpm docs:check-links`.

## Documentation Reconciliation

Step 21 reconciles the following canonical records:

- Phase 20 fixed plan;
- Inventory module record and module registry/map;
- database dictionary (Inventory tables/view/index policy);
- Inventory security/approval/audit boundary;
- Inventory glossary;
- architecture documents for Domain/Application, persistence, Bridge, ERP/master-data integration, Desktop workspace and quantity reports;
- Domain/Application and SQLite/Desktop testing records;
- generated documentation index.

## Execution Evidence

The Step 20 implementation was explicitly owner-accepted before Step 21 started. No raw local command output for the Step 21 quality gates has been supplied to the assistant yet, and GitHub currently provides no automatic CI status for this branch. Therefore this record does not label the new performance/accessibility/full-monorepo gates as passed until executable output is observed.

## Recommended Local Step 21 Gate

```bash
pnpm docs:index
pnpm validate:phase20
```

Then confirm `git status` is clean. If `docs/index.md` changes after `pnpm docs:index`, commit the regenerated index before final Step 22 review.

## Manual Desktop Acceptance Checklist

- [ ] Inventory document workspace opens with Persian RTL layout.
- [ ] Jalali input/display is correct while persisted business dates remain Gregorian.
- [ ] Keyboard-only navigation reaches filters, line editor, lifecycle actions and report controls.
- [ ] Focus indication remains visible at normal and zoomed display sizes.
- [ ] Error/permission/concurrency feedback is understandable without relying on color alone.
- [ ] Product aggregate quantity equals the sum of visible Warehouse quantities.
- [ ] Detailed Warehouse/Zone/Location view can open the correct StockKey Kardex.
- [ ] Kardex opening/in/out/closing reconciles across pagination.
- [ ] Source drill-down opens the permitted durable source document/line.
- [ ] Import preview blocks invalid rows and imports valid files as Draft only.
- [ ] Excel export opens with the expected Persian headings and exact quantities.
- [ ] Print preview is full-screen, scrollable to the end and has bottom breathing room.
- [ ] Print/Save PDF orientation matches the preview.
- [ ] Warehouse/Zone/Location destructive maintenance is blocked when Inventory dependencies require it.

Manual acceptance remains an owner-run Desktop check; recording the checklist does not fabricate execution.
