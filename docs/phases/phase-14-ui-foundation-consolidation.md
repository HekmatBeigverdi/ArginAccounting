# Phase 14 — UI Foundation Consolidation

## Objective

Consolidate the ArginAccounting desktop UI into one reusable Persian RTL design language before additional accounting and ERP workflows expand the product surface.

The phase preserves existing Domain/Application/Persistence semantics. Presentation changes must not introduce Phase 15 Journal Lifecycle behavior.

## Fixed Plan

The canonical fixed implementation plan is `docs/phases/phase-14-ui-foundation-consolidation-plan.md`. Step names, order, scope, and exit criteria remain governed by that document.

## Delivered Through Step 12

### Steps 1–4 — Foundation and shell

Phase 14 established the five-layer presentation architecture, design tokens/shared primitives, final Persian RTL App Shell, grouped navigation, and persisted Company/Branch/Fiscal active context.

### Steps 5–10 — Workspace consolidation

Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher were consolidated onto the shared desktop presentation language while preserving their existing Application/Domain contracts. Solar Hijri presentation remains the user-facing date standard while durable dates remain Gregorian. Chart of Accounts now uses a semantic expandable hierarchy with parent-preserving search and contained scrolling.

### Step 11 — RTL, Accessibility, Keyboard, and Responsive Hardening

- added a keyboard skip link to a focusable main-content landmark;
- connected collapsible navigation with accessible expanded/control relationships;
- added shared focus-visible, bidirectional mixed-content, tabular numeric, reduced-motion, and overflow-containment rules;
- hardened Shell resizing while preserving local scrolling for dense accounting surfaces;
- added `apps/desktop/tests/accessibility-responsive-ui-contract.test.ts`.

### Step 12 — Loading, Empty, Error, Success, and Feedback Standards

- extended the shared feedback layer with canonical `LoadingState`, `EmptyState`, and `ErrorState` components;
- retained semantic `Feedback` tones for information, success, warning, and error outcomes and added consistent live-region behavior;
- standardized loading semantics with `aria-busy`, explicit empty-state copy/action regions, and actionable error-state regions;
- added optional expandable technical diagnostics so Persian user explanations remain primary while low-level details are available separately when appropriate;
- added token-based state presentation, LTR technical output, and reduced-motion-safe loading behavior;
- added `apps/desktop/tests/feedback-states-ui-contract.test.ts` to lock the reusable feedback contract;
- preserved all Domain/Application/persistence behavior and did not introduce Journal Lifecycle functionality.

## Active UI Technical Debt After Step 12

The original global `App.css` collision source has been retired. Remaining Phase 14 work is deliberately bounded to:

- Step 13: focused/full regression execution evidence, monorepo validation, documentation/index/changelog reconciliation;
- Step 14: desktop data-density and accounting workspace optimization already present in the approved fixed plan;
- Step 15: final review, merge, and release.

Runtime/typecheck/test/build success is not claimed by the GitHub connector. Step 13 remains the formal validation gate.

## Validation Evidence

Source-contract coverage now includes shell/navigation/context, Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Persian Journal dates, design-system primitives, desktop window baseline, Accounting workspace harmonization, accessibility/responsive hardening, and standardized feedback states.
