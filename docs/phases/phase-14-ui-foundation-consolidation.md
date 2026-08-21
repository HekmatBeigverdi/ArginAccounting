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
- `CHANGELOG.md` includes the Phase 14 Unreleased delivery summary and corrected Phase 15/16 forward references.

### Step 14 — Desktop Data Density and Accounting Workspace Optimization

Phase 14 now defines density as a global application preference rather than an Accounting-only presentation rule.

- added three global density levels: `compact`, `comfortable`, and `spacious`;
- `comfortable` is the default and remains materially denser than the pre-Phase-14 Argin interface;
- `compact` targets professional high-density accounting work with approximately 30px table rows and 32px controls/tree rows;
- `spacious` increases controls/tree/table rows to approximately 44px for touch-oriented or readability-focused use;
- the selected density is applied to the document root through `data-density`, so shared Design System tokens affect Shell, navigation, context selectors, shared controls, tables and all current/future workspaces rather than Accounting alone;
- the App Shell exposes the Persian `تراکم نمایش` selector with `فشرده`, `استاندارد`, and `بزرگ` choices;
- the preference is persisted locally under `argin.ui.display-density` and restored at application startup; invalid/missing values safely fall back to `comfortable`;
- Accounting workspaces retain sticky table headers, contained scrolling, compact forms/toolbars and viewport-derived data surfaces, now driven by the selected global density tokens;
- Chart of Accounts hierarchy retains semantic rails, level markers, code-plus-title identity and responsive degradation while its row/control dimensions follow the global density contract;
- added `apps/desktop/tests/display-density-ui-contract.test.ts` alongside the existing desktop-density regression contract;
- no accounting Domain/Application/persistence or Phase 15 Journal Lifecycle behavior was introduced.

## Validation Evidence

Step 13 full repository validation was confirmed successful by the repository owner before Step 14 started. Step 14 now has focused source-contract coverage for both operational density and the three-level global density preference. Its final runtime/typecheck/test/build smoke check remains required before Phase 14 release.

## Remaining Phase 14 Work

Only Step 15 — Final Review, Merge, and Release — remains. Before release, perform the final scope/diff review and the post-Step-14 Desktop validation, then merge/tag/release through the approved GitHub publishing workflow.
