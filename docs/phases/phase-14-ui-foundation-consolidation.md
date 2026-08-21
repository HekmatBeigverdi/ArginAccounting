# Phase 14 — UI Foundation Consolidation

## Objective

Consolidate the ArginAccounting desktop UI into one reusable Persian RTL design language before additional accounting and ERP workflows expand the product surface.

The phase preserves existing Domain/Application/Persistence semantics. Presentation changes must not introduce Phase 15 Journal Lifecycle behavior.

## Fixed Plan

The canonical fixed implementation plan is `docs/phases/phase-14-ui-foundation-consolidation-plan.md`. Step names, order, scope, and exit criteria remain governed by that document.

## Delivered Through Step 14

### Steps 1–4 — Foundation and shell

Phase 14 established the five-layer presentation architecture, design tokens/shared primitives, final Persian RTL App Shell, grouped navigation, and persisted Company/Branch/Fiscal active context.

### Steps 5–10 — Workspace consolidation

Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher were consolidated onto the shared desktop presentation language while preserving their existing Application/Domain contracts. Solar Hijri presentation remains the user-facing date standard while durable dates remain Gregorian. Chart of Accounts uses a semantic expandable hierarchy with parent-preserving search and contained scrolling.

### Step 11 — RTL, Accessibility, Keyboard, and Responsive Hardening

Keyboard skip navigation, semantic/focusable main content, accessible collapsible navigation, focus-visible treatment, mixed RTL/LTR isolation, tabular numeric presentation, reduced-motion support, and page-overflow containment were standardized with regression coverage.

### Step 12 — Loading, Empty, Error, Success, and Feedback Standards

Canonical Loading/Empty/Error state primitives, semantic live regions, optional separated technical diagnostics, token-based state presentation, and reduced-motion-safe loading behavior were added without changing application semantics.

### Step 13 — UI Regression, Monorepo Validation, and Documentation

- regression contracts cover the consolidated shell and all primary Phase 14 workspaces;
- repository owner confirmed frozen install, Desktop typecheck/test/build, full monorepo lint/typecheck/test/build, generated documentation index, clean status review, and `git diff --check` completed successfully on macOS;
- `CHANGELOG.md` now includes the Phase 14 Unreleased delivery summary and corrected Phase 15/16 forward references;
- canonical plan and implementation record were synchronized with validation evidence.

### Step 14 — Desktop Data Density and Accounting Workspace Optimization

- introduced reusable operational density tokens rather than feature-specific sizing overrides: 32px controls/tree rows, approximately 30px table rows, compact cells/panels/toolbars, and viewport-derived workspace height;
- made Accounting headers, tabs, toolbars, panels and tables materially more compact while retaining Persian RTL readability and accessible controls;
- standardized sticky table headers and locally contained vertical/horizontal scrolling so wide/dense accounting data does not force the whole application shell to scroll;
- densified Chart of Accounts hierarchy from the earlier large-card row treatment to a 32px operational tree target with restrained indentation, compact expand controls/level markers, code-plus-title identity, hierarchy rails and locally contained viewport-height scrolling;
- kept the Chart editor side surface compact and independently scrollable on wide desktop layouts, with responsive fallback to normal document flow on smaller windows;
- added `apps/desktop/tests/desktop-density-ui-contract.test.ts` to lock the density tokens, sticky/local scrolling, compact Chart hierarchy and responsive degradation;
- no accounting Domain/Application/persistence or Phase 15 Journal Lifecycle behavior was introduced.

## Validation Evidence

Step 13 full repository validation was confirmed successful by the repository owner before Step 14 started. Step 14 adds focused source-contract regression coverage; its presentation changes should receive the normal local Desktop typecheck/test/build smoke check before final Phase 14 release.

## Remaining Phase 14 Work

Only Step 15 — Final Review, Merge, and Release — remains. Before release, perform the final scope/diff review and the post-Step-14 Desktop validation, then merge/tag/release through the approved GitHub publishing workflow.
