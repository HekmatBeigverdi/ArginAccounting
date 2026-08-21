# Phase 14 — UI Foundation Consolidation

## Objective

Consolidate the ArginAccounting desktop UI into one reusable Persian RTL design language before additional accounting and ERP workflows expand the product surface.

The phase preserves existing Domain/Application/Persistence semantics. Presentation changes must not introduce Phase 15 Journal Lifecycle behavior.

## Fixed Plan

The canonical fixed implementation plan is `docs/phases/phase-14-ui-foundation-consolidation-plan.md`. Step names, order, scope, and exit criteria remain governed by that document.

## Delivered Through Step 11

### Steps 1–4 — Foundation and shell

- froze the Phase 14 branch/plan and shifted later roadmap phases;
- audited the existing UI generations and established the five-layer presentation architecture;
- introduced design tokens plus shared form, layout, data-display, feedback, and dialog primitives;
- replaced the temporary application shell with the final Persian RTL App Shell and persisted Company/Branch/Fiscal active context.

### Step 5 — Dashboard Modernization

- replaced prototype/stale dashboard presentation with real active-context summaries and implemented-module shortcuts;
- retained existing application contracts and explicit loading/empty/error states.

### Step 6 — Company and Branch Workspace Consolidation

- converted Company setup into a persisted Company/Branch workspace;
- preserved Company creation/activity behavior and exposed Branch creation through the existing application/repository boundaries;
- corrected active-context refresh after Branch/Fiscal mutations.

### Step 7 — Fiscal Workspace Consolidation

- converted Fiscal Years into a management workspace;
- standardized Solar Hijri user input through the shared `PersianDatePicker` while retaining Gregorian durable values;
- hardened the date picker and Fiscal layout after runtime collision review;
- established a `1366 × 768` initial Tauri window baseline.

### Step 8 — Security Workspace Consolidation

- consolidated Login, Users, Roles, Permissions, Role Permission, and User Access surfaces;
- retained authentication/authorization and assignment semantics;
- restored Login navigation and corrected Security tab routes.

### Step 9 — Audit and Approval Workspace Harmonization

- migrated Approval and Audit list/detail surfaces to shared primitives and one governance workspace language;
- preserved all existing Approval commands and read-only immutable Audit semantics;
- standardized Persian timestamps, status badges, detail hierarchy, navigation, and feedback.

### Step 10 — Accounting Workspace Harmonization

Step 10 aligns the Accounting Core surfaces from Phases 10–13 without changing their business contracts:

- added `pages/accounting/accounting-workspace.css` as a shared token-based presentation layer for Accounting headers, tabs, toolbars, section hierarchy, and contained dense-surface scrolling;
- aligned Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher with the Phase 14 visual language while preserving their existing Application services and permissions;
- rebuilt Chart of Accounts presentation into a substantially clearer semantic hierarchy: expandable/collapsible branches, group/general/subsidiary level markers, connector rails, parent-preserving filtered search, active/posting metadata, summary counts, compact actions, and contained scrolling;
- improved the Coding Template preview tree with the same hierarchy vocabulary so template preview and live Chart of Accounts no longer look like unrelated UI generations;
- retained the Journal Voucher workspace as the interaction baseline, tokenized its one-off presentation, kept its dense entry table locally scrollable, and preserved the shared Solar Hijri date picker for list filters and voucher date;
- tokenized Accounting Dimensions and aligned its workspace header/company context/tabs/feedback with the shared accounting language while retaining type/member/policy behavior;
- retired the old Vite starter rules and legacy Foundation feature selectors from `App.css`; it is now intentionally limited to document-level defaults. The remaining System Diagnostics consumer was migrated to shared primitives so this cleanup does not remove required styling;
- added `apps/desktop/tests/accounting-workspace-ui-contract.test.ts` to lock shared Accounting presentation, semantic Chart of Accounts hierarchy, template hierarchy cues, contained overflow, global legacy CSS retirement, and the Phase 15 boundary.

No Journal posting, approval, locking, reversal, or finalization behavior was added.

### Step 11 — RTL, Accessibility, Keyboard, and Responsive Hardening

- added an always-available keyboard skip link from the application shell to a focusable main-content landmark;
- connected collapsible navigation headers to their controlled regions with `aria-controls`/`aria-expanded`, retained semantic navigation landmarks, and labelled sidebar/status regions;
- established a cross-workspace `accessibility.css` contract for focus-visible treatment, disabled controls, bidirectional isolation of Latin/code content, tabular numeric presentation, stable local scroll gutters, and reduced-motion preferences;
- hardened the shell against destructive page-level horizontal overflow with `min-width: 0`, bounded workspace/main widths, wrapping status content, and narrow-window layout rules while preserving local scrolling for dense accounting surfaces;
- improved mixed Persian/Latin content behavior with `unicode-bidi: isolate` for LTR/code content and retained logical CSS properties throughout the shell;
- added `apps/desktop/tests/accessibility-responsive-ui-contract.test.ts` to lock keyboard landmarks, focus visibility, reduced-motion support, RTL/mixed-content isolation, local dense-surface scrolling, and narrow-window containment.

No Domain, persistence, authorization, accounting, or Journal Lifecycle semantics were changed in Step 11.

## Active UI Technical Debt After Step 11

The original global `App.css` collision source has been retired rather than deferred: Vite starter selectors, global input/button presentation, `temporary-*`, legacy Company/Fiscal/Security selectors, and obsolete Foundation feature rules no longer live in the global stylesheet.

Steps 12–13 must still perform a repository-wide presentation audit for:

- standardized loading/empty/error/success/technical-detail patterns;
- remaining temporary naming or obsolete presentation classes outside `App.css`;
- focused and monorepo runtime/typecheck/test/build validation evidence;
- final accessibility/responsive regressions discovered by local runtime review.

## Validation Evidence

Focused source-contract coverage now includes shell/navigation/context, Dashboard, Company/Branch, Fiscal, Security, Audit/Approval, Persian Journal dates, design-system primitives, desktop window baseline, Accounting workspace harmonization, and the Step 11 accessibility/responsive contract.

The GitHub connector cannot execute the local Tauri runtime or repository scripts. Full local typecheck/test/build and monorepo validation remains mandatory in Step 13; Step 11 completion records implementation and regression contracts, not a claim that those local commands have already run successfully.
