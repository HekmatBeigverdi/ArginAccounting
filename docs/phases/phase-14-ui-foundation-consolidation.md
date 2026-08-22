# Phase 14 — UI Foundation Consolidation

## Objective

Consolidate the ArginAccounting desktop UI into one reusable Persian RTL design language before additional accounting and ERP workflows expand the product surface.

The phase preserves existing Domain/Application/Persistence semantics. Presentation changes do not introduce Phase 15 Journal Lifecycle behavior.

## Fixed Plan

The canonical fixed implementation plan is `docs/phases/phase-14-ui-foundation-consolidation-plan.md`. The final record preserves the original 15-step names, order, scope, and exit criteria.

## Delivered

Phase 14 established the five-layer presentation architecture, shared design tokens/primitives, final Persian RTL App Shell, grouped navigation, persisted Company/Branch/Fiscal active context, and consolidated Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher presentation.

Solar Hijri remains the user-facing date standard while durable dates remain Gregorian. Accessibility, keyboard focus, RTL/LTR isolation, responsive containment, loading/empty/error feedback, and desktop accounting density were standardized without moving Domain/Application rules into React.

### Global Display Density

Density is a global application preference rather than an Accounting-only rule:

- `compact` — professional high-density accounting work;
- `comfortable` — default, while remaining denser than the pre-Phase-14 interface;
- `spacious` — touch/readability-oriented presentation.

The selected density is applied through root `data-density` Design System tokens, exposed by the Persian App Shell selector, persisted locally, and restored at startup. Accounting workspaces use contained scrolling, sticky headers, compact operational surfaces, and a denser Chart of Accounts hierarchy while retaining responsive degradation.

## Architecture Decision

The architectural rationale and durable presentation contract are recorded in [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md). The canonical current UI rules remain in [UI Architecture](../ui/UI_ARCHITECTURE.md).

## Validation

Focused Desktop contracts cover shell/navigation/context, Foundation and Accounting workspaces, Persian dates, accessibility/responsive behavior, feedback states, desktop density, and the global three-level density preference. The repository owner executed the requested frozen install, Desktop typecheck/test/build, full monorepo lint/typecheck/test/build, documentation-index generation, and diff validation during the Phase 14 release gate.

## Final Delivery

- Phase branch: `phase/14-ui-foundation-consolidation`.
- Merged to `develop`: `b31ec6baf9cf0d25bc28c58c5b7cae0204731d7d`.
- Released through `main`: `7afbf4aee4b9d6470f1bdb63a658e21cdd29d561`.
- Release tag: `v0.14.0`.
- Phase 14 status: Completed.
- Next target: Phase 15 — Journal Lifecycle.
