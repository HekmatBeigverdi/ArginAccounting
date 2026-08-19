# Phase 14 — UI Foundation Consolidation

## Status

In progress. Steps 1–3 completed.

## Objective

Consolidate the ArginAccounting desktop experience into one reusable Persian RTL design system before additional accounting and ERP workflows expand the application surface area.

Phase 14 modernizes the final application shell, dashboard, and first-generation Foundation-phase workspaces; harmonizes the Accounting Core UI delivered in Phases 10–13; and establishes reusable accessibility, responsive, keyboard, and feedback standards for all subsequent phases.

## Scope

- Shared design tokens and reusable UI primitives.
- Final desktop application shell, navigation, and active company/branch/fiscal context presentation.
- Dashboard modernization.
- Company and Branch workspace consolidation.
- Fiscal workspace consolidation.
- Security workspace consolidation.
- Audit and Approval visual/interaction harmonization.
- Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher harmonization.
- Persian RTL, accessibility, keyboard, responsive, loading, empty, error, and success-state hardening.
- UI-focused regression coverage and documentation.

## Explicit Non-Goals

- Journal approval, posting, locking, reversal, finalization, or other Journal Lifecycle behavior. These belong to Phase 15.
- New accounting, inventory, sales, purchase, treasury, taxpayer, or enterprise business capabilities.
- Moving domain/application rules into React components.
- Changing the established local-first Tauri/SQLite architecture.

## Fixed Execution Plan

See [Phase 14 — UI Foundation Consolidation — Fixed Implementation Plan](phase-14-ui-foundation-consolidation-plan.md).

## Baseline

- Phase 13 — Journal Voucher Engine is the latest completed accounting milestone and was released as `v0.13.0`.
- Phase 14 starts from synchronized `develop` at `03f6053bf177538a4974ebec1f19c47770795b8c`.
- Implementation branch: `phase/14-ui-foundation-consolidation`.
- The Phase 13 Journal Voucher workspace is the primary interaction-quality reference for consolidation.

## Renumbering Decision

The insertion of UI Foundation Consolidation as Phase 14 shifts every previously planned phase after Phase 13 by one. Journal Lifecycle therefore becomes Phase 15 and Deployment and Production Hardening becomes Phase 47. `ROADMAP.md` remains the canonical numbering source.

## Step 2 — UI Architecture Baseline

Step 2 established the presentation architecture contract before implementation begins:

- recorded the UI architecture audit in [`../ui/phase-14-ui-architecture-audit.md`](../ui/phase-14-ui-architecture-audit.md);
- replaced the old future-UI placeholder wording in [`../ui/UI_ARCHITECTURE.md`](../ui/UI_ARCHITECTURE.md) with the canonical Phase 14 layering and dependency contract;
- classified Foundation-era `temporary-*` shell/page/dashboard presentation as migration targets while preserving route and feature boundaries;
- classified Accounting Core workspaces as reusable interaction patterns that must converge on shared primitives without moving feature semantics into the design system;
- defined token, primitive, composite/layout, feature-UI, and route-page ownership;
- prohibited shared UI dependencies on Tauri/SQLite persistence implementations and repository implementations;
- preserved Phase 13 Journal Voucher as the interaction-quality reference for dense accounting workflows;
- confirmed Step 2 is documentation/architecture-only and introduces no production UI implementation or Phase 15 Journal Lifecycle behavior.

## Step 3 — Shared Design Foundation

Step 3 introduced the first production design-system layer without migrating feature pages yet:

- added Persian-first design tokens for typography, spacing, shape, elevation, borders, semantic states, focus, density, control sizing, page width, and accounting-table density;
- added reusable native-element form primitives: `Button`, `Input`, `Select`, `Textarea`, and `Field`;
- added shared `Page`, `Stack`, `Panel`, `Card`, and `Toolbar` layout primitives;
- added `Badge` and horizontally contained `DataTable` primitives;
- added semantic `Feedback` and an accessible base `Dialog` contract;
- standardized focus-visible, disabled, invalid, destructive, and read-only visual states in the shared layer;
- loaded the new token and primitive CSS before legacy `App.css`, allowing controlled migration in Steps 4–10 without changing existing feature behavior in Step 3;
- added focused source-contract tests that also guard against generic UI dependencies on Argin business packages, SQLite, or Tauri persistence.

## Validation Evidence

Step-by-step evidence is maintained in the fixed plan. Step 3 adds focused desktop regression-contract coverage; full focused runtime and monorepo validation remains mandatory at Step 13 after the implementation steps are complete.
