# Phase 23 — Purchase Posting & Accounting Integration — Release Notes

## Target

- Version: 0.23.0
- Tag: v0.23.0
- Release title: ArginAccounting v0.23.0 — Purchase Posting & Accounting Integration
- Status: final validation passed; promotion prepared; semantic tag/GitHub Release publication is manual

## Highlights

Phase 23 connects authoritative Purchase, Inventory and Inventory Valuation facts to Accounting-owned Journal Vouchers without duplicate operator entry.

The release adds:

- deterministic Purchase Posting aggregates and source identity;
- Purchase-specific Posting Rules and account-role resolution;
- Supplier Invoice accounting for stock, service and non-stock lines;
- recoverable Input VAT and Purchase Charge handling;
- fulfillment policy and partial Goods Receipt workflow;
- two-way and PO-aware three-way Purchase Matching;
- authoritative Purchase-backed Inventory Cost resolution;
- automatic Posting orchestration into balanced Accounting Journal drafts;
- replay-safe/idempotent execution and expected-version concurrency;
- controlled Posting reversal and source-to-ledger reconciliation;
- versioned Argin Bridge Posting/Rule/Reversal contracts;
- Persian RTL Purchase-to-Accounting workspace and trace viewer.

## Manual acceptance refinements

Owner-executed Desktop acceptance identified and resolved additional integration/UX defects before documentation closure:

- projected Matching proposals are no longer mistaken for committed Match facts;
- Inventory Tracking consequences are explicit in Product/Purchase UI;
- core built-in Purchase Posting mappings can bootstrap safely from known coding-template accounts;
- Supplier PARTY Accounting Dimension membership is materialized from durable Supplier identity;
- Purchase-generated Journal descriptions are Persian and business-readable;
- source-owned system Journals cannot be generically edited/deleted;
- confirmed non-stock → stock-tracked classification mistakes can use a controlled replacement invoice before downstream effects exist;
- orphan non-economic Draft Posting residue from a failed attempt does not block that safe replacement path;
- completed Purchase Cost Resolution no longer leaves a duplicate action visible;
- the Tauri Desktop shell uses fixed application chrome with independent workspace/navigation scrolling.

## Integrity model

- Purchase owns commercial facts.
- Inventory owns quantity documents and movements.
- Inventory Valuation owns FIFO/MWA valuation state.
- Purchase Posting owns Purchase-specific accounting recognition and source/replay semantics.
- Accounting owns Journal lifecycle.
- Confirmed historical Purchase snapshots are not silently rewritten after Master Data changes.
- Posted/reversed accounting history is not edited in place; correction uses compensating source/reversal workflows.

## Validation status

All 36 Phase 23 steps are complete.

GitHub Actions `Phase 23 Validation` run `36632952159` passed on the final implementation head used by PR #26. The `validate:phase23` gate includes focused Phase 23 package checks, Desktop tests/build, full monorepo typecheck/test/build/lint, documentation generation/link validation and Rust `cargo check`.

Semantic tag and GitHub Release publication remain manual repository-owner actions after verified `main` promotion.
