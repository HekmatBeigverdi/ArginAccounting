# Phase 24 — Sales Workflow — Release Notes

## Target

- Version: 0.24.0
- Tag: v0.24.0
- Release title: ArginAccounting v0.24.0 — Sales Workflow
- Status: implementation and owner acceptance complete; final promotion and semantic tag/GitHub Release publication are manual

## Highlights

Phase 24 delivers the commercial Sales workflow while preserving the boundary between selling price, Inventory quantity and Inventory valuation.

The release adds:

- versioned Sales price lists, effective dating, customer/segment pricing and deterministic price resolution;
- Sales Order, Sales Invoice, Sales Return and Sales Correction aggregates with immutable commercial snapshots;
- discounts, charges, Output VAT inputs, deterministic totals and rounding;
- lifecycle, approval, optimistic concurrency, replay safety and payload fingerprinting;
- official Sales Number Series allocation atomically at Finalize, scoped by Company, Branch, Fiscal Year and document type;
- stock Sales Invoice -> Inventory Issue Draft staging and Sales Return -> Inventory Receipt Draft staging without bypassing Inventory ownership;
- explicit selling-price vs FIFO/MWA cost/COGS boundary;
- fulfillment/matching and operational Sales -> Inventory -> Movement -> Valuation trace;
- CR-24-01 below-cost governance with allow/warn/require-approval/block policies, minimum margin threshold, authoritative pre-finalization cost quote and append-only decision trace;
- SQLite persistence, migration, transaction boundary and Argin Bridge-ready contracts;
- granular permissions, Audit and traceability;
- Persian RTL Sales workspace, XLSX/CSV Draft import, Excel export and A4 landscape Print/PDF preview;
- automated/E2E contracts and canonical `pnpm validate:phase24` quality gate.

## Integrity model

- Sales owns commercial selling facts and never writes selling price as Inventory Cost Input.
- Inventory owns quantity documents and movements.
- Inventory Valuation owns FIFO/MWA cost and authoritative COGS valuation.
- Finalizing a stock Sales Invoice stages an Inventory Issue Draft; it does not itself reduce stock.
- Finalizing a stock Sales Return stages an Inventory Receipt Draft; it does not itself restore stock.
- Official document numbers are allocated only at Finalize and participate in the same transaction as finalization and downstream Inventory staging.
- Phase 24 stops at operational valuation trace. Revenue, Output VAT, Accounts Receivable and COGS/Inventory Relief Journal posting remain Phase 25 responsibilities.
- Finalized commercial history is immutable in place; returns/corrections preserve explicit lineage.
- Durable IDs, mutation identity, versions and source references remain Argin Bridge-ready.

## Validation status

All 30 Phase 24 steps are complete and Step 29 was owner-accepted.

The canonical release-quality command is:

`pnpm validate:phase24`

It covers focused Sales/Sales-Tauri validation, Inventory and valuation dependencies, Fiscal/NumberSeries, Security, Desktop tests/build, documentation generation/link checks, full monorepo typecheck/test/build/lint and Rust/Tauri compilation.

Final merge/promotion to `develop` and `main`, semantic tag creation and GitHub Release publication remain manual repository-owner actions.
