# Phase 14 — UI Foundation Consolidation

## Status

In progress.

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

## Validation Evidence

Validation evidence will be recorded step-by-step in the fixed plan and summarized here before release.
