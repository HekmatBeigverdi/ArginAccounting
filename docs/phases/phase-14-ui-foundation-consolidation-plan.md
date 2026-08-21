# Phase 14 — UI Foundation Consolidation — Fixed Implementation Plan

## Purpose

Phase 14 consolidates the desktop user interface before additional accounting and ERP workflows expand the surface area of the application. It establishes one reusable Persian RTL design language, replaces first-generation temporary shell/workspace patterns, modernizes Foundation-phase screens, and harmonizes the Accounting Core UI established in Phases 10–13.

This plan is fixed for the duration of Phase 14. Step titles, order, scope boundaries, and exit criteria must not be renamed, reordered, split, merged, removed, or materially expanded without an explicit approved Change Request.

## Scope Boundaries

In scope:

- Desktop presentation architecture and shared UI primitives.
- Persian RTL desktop shell, navigation, workspace layout, and context surfaces.
- Dashboard modernization.
- Company/Branch, Fiscal, Security, Audit, and Approval UI consolidation.
- Visual and interaction harmonization of Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher workspaces.
- Accessibility, keyboard interaction, responsive behavior, and consistent loading/empty/error/success states.
- Desktop-first data density, contained workspace scrolling, compact accounting trees/tables/forms, and efficient use of 1080p-class desktop viewports.
- UI-focused regression tests and documentation.

Out of scope:

- Journal Lifecycle behavior such as approval, posting, locking, reversal, or finalization; these belong to Phase 15.
- New accounting domain rules or persistence semantics unrelated to presentation requirements.
- New Master Data, Inventory, Purchase, Sales, Treasury, Posting, Taxpayer, or enterprise-module business capabilities.
- Replacing the established local-first Tauri/SQLite architecture.

## Design Baseline

- Persian is the primary application language and all user-facing desktop surfaces are RTL-first.
- Iranian Rial remains the primary accounting currency presentation.
- Solar Hijri is used for user-facing dates while durable/internal dates remain Gregorian according to existing project conventions.
- Phase 13 Journal Voucher workspace is the primary interaction and visual reference, but reusable patterns must be extracted rather than copied page-by-page.
- Operational accounting surfaces must prefer desktop-first, data-dense workspaces over web/SaaS-style oversized cards, controls, and page-level scrolling.
- Domain and application rules remain outside React components.
- Shared UI components must not depend directly on SQLite or Tauri persistence implementations.

## Step Status

| Step | Title | Status |
| --- | --- | --- |
| 1 | Baseline, Branch, and Plan Freeze | Completed |
| 2 | UI Architecture Audit and Design-System Contract | Completed |
| 3 | Design Tokens and Shared UI Primitives | Completed |
| 4 | Final App Shell, Navigation, and Active Context | Completed |
| 5 | Dashboard Modernization | Completed |
| 6 | Company and Branch Workspace Consolidation | Completed |
| 7 | Fiscal Workspace Consolidation | Completed |
| 8 | Security Workspace Consolidation | Completed |
| 9 | Audit and Approval Workspace Harmonization | Completed |
| 10 | Accounting Workspace Harmonization | Completed |
| 11 | RTL, Accessibility, Keyboard, and Responsive Hardening | Completed |
| 12 | Loading, Empty, Error, Success, and Feedback Standards | Completed |
| 13 | UI Regression, Monorepo Validation, and Documentation | Completed |
| 14 | Desktop Data Density and Accounting Workspace Optimization | Completed |
| 15 | Final Review, Merge, and Release | Completed |

## Steps

### Step 1 — Baseline, Branch, and Plan Freeze
Status: Completed

Evidence:
- Remote Phase 14 branch was created from synchronized `develop` baseline `03f6053bf177538a4974ebec1f19c47770795b8c`.
- Phase 14 was registered as the current target and the fixed scope boundary was recorded.

### Step 2 — UI Architecture Audit and Design-System Contract
Status: Completed

Evidence:
- Added the Phase 14 UI architecture audit and five-layer presentation contract.
- Shared presentation dependencies on persistence adapters/repositories were prohibited.

### Step 3 — Design Tokens and Shared UI Primitives
Status: Completed

Evidence:
- Added shared design tokens and reusable form/layout/data-display/feedback/dialog primitives.
- Standardized focus, disabled, invalid, read-only, destructive, semantic-state, and dense-table presentation.

### Step 4 — Final App Shell, Navigation, and Active Context
Status: Completed

Evidence:
- Added persisted active context, final Persian RTL App Shell, grouped navigation, context selectors, breadcrumb/title/status surfaces, and permission metadata.

### Step 5 — Dashboard Modernization
Status: Completed

Evidence:
- Replaced the prototype dashboard with real active-context summaries, implemented-module shortcuts, and explicit states.

### Step 6 — Company and Branch Workspace Consolidation
Status: Completed

Evidence:
- Converted Company setup into a persisted Company/Branch management workspace and exposed Branch creation through existing application/repository boundaries.

### Step 7 — Fiscal Workspace Consolidation
Status: Completed

Evidence:
- Converted Fiscal Years into a management workspace and standardized Solar Hijri input while preserving Gregorian durable storage.
- Established the 1366 × 768 initial desktop window baseline.

### Step 8 — Security Workspace Consolidation
Status: Completed

Evidence:
- Consolidated Login, Users, Roles, Permissions, Role Permission, and User Access surfaces while preserving security semantics.

### Step 9 — Audit and Approval Workspace Harmonization
Status: Completed

Evidence:
- Migrated Audit and Approval list/detail surfaces to shared primitives while preserving Approval workflow and immutable Audit behavior.

### Step 10 — Accounting Workspace Harmonization
Status: Completed

Evidence:
- Harmonized Chart of Accounts, Dimensions, Coding Templates, and Journal Voucher workspaces.
- Rebuilt Chart of Accounts as a semantic expandable hierarchy and retired legacy global Foundation styling.
- Preserved Solar Hijri Journal dates and excluded Phase 15 Journal Lifecycle behavior.

### Step 11 — RTL, Accessibility, Keyboard, and Responsive Hardening

- Audit logical RTL layout, text alignment, icon direction, numeric alignment, and mixed Persian/Latin content.
- Establish keyboard traversal, focus visibility, labels, semantic landmarks, and accessible control naming.
- Validate desktop window resizing and contained horizontal scrolling for dense accounting tables.
- Remove avoidable fixed-width assumptions that break supported desktop sizes.

Exit criteria:
- Critical desktop flows are keyboard reachable.
- RTL direction and mixed-content presentation are consistent.
- Supported window sizes do not create page-level destructive overflow.

Status: Completed

Evidence:
- Added global skip navigation, focusable main content, accessible collapsible navigation, focus-visible treatment, mixed RTL/LTR isolation, tabular numeric presentation, reduced-motion support, and contained overflow.
- Added `apps/desktop/tests/accessibility-responsive-ui-contract.test.ts`.

### Step 12 — Loading, Empty, Error, Success, and Feedback Standards

- Standardize loading, empty, validation-error, technical-error, success, confirmation, and destructive-action feedback.
- Ensure technical diagnostics are available where appropriate without replacing user-facing Persian explanations.
- Prevent silent failures and ambiguous disabled states in consolidated workspaces.
- Reuse notification infrastructure where it is already the correct application contract.

Exit criteria:
- Touched workspaces have explicit asynchronous and empty/error states.
- User-facing feedback is Persian and actionable.
- Technical detail exposure follows a consistent pattern.

Status: Completed

Evidence:
- Added canonical loading, empty, error, semantic feedback, technical-detail, accessibility, and reduced-motion contracts.
- Added `apps/desktop/tests/feedback-states-ui-contract.test.ts`.

### Step 13 — UI Regression, Monorepo Validation, and Documentation

- Add or update desktop tests for shell, navigation, key Foundation workspaces, and Accounting workspace regressions.
- Run focused package validation and full monorepo install/lint/typecheck/test/build checks.
- Regenerate documentation index and verify documentation diffs.
- Update UI architecture, phase record, roadmap references, changelog, and relevant glossary/conventions.

Exit criteria:
- Required focused and monorepo validations pass with recorded evidence.
- Documentation index is regenerated and clean.
- Phase 14 implementation record accurately describes delivered UI consolidation.

Status: Completed

Evidence:
- Desktop regression contracts cover the consolidated shell, Foundation workspaces, Accounting workspaces, Persian dates, accessibility/responsive behavior, desktop window baseline, and feedback states.
- Repository owner executed the requested frozen install, Desktop typecheck/test/build, full monorepo lint/typecheck/test/build, documentation-index generation, and diff validation on the macOS repository environment.

### Step 14 — Desktop Data Density and Accounting Workspace Optimization

- Establish an explicit desktop density contract for operational ERP/accounting surfaces, with compact sizing tokens for rows, controls, toolbars, spacing, tree nodes, and form layouts instead of page-specific CSS overrides.
- Prefer workspace-height layouts with contained grid/tree scrolling over long page-level vertical scrolling on primary accounting screens.
- Optimize dense Data Grid presentation with compact row heights, sticky headers, practical frozen columns, column resizing/visibility, compact filters, keyboard navigation, and local horizontal overflow where wide accounting data genuinely requires it.
- Optimize Chart of Accounts and other hierarchical selectors for dense desktop use with compact nodes, restrained indentation, code-plus-title presentation, fast expand/collapse, parent-preserving search, and master-detail/split-view patterns where they materially reduce navigation and scrolling.
- Convert operational forms away from oversized SaaS-style vertical stacking toward compact multi-column desktop layouts where field semantics allow it, while preserving readable validation, RTL behavior, and accessible labeling.
- Reduce oversized cards, whitespace, and redundant chrome in high-frequency accounting workflows without reducing clarity or introducing legacy visual styling.
- Preserve responsive degradation for smaller supported windows; desktop density must not be implemented through brittle fixed dimensions.
- Keep all changes within the presentation layer and existing Application contracts; no accounting domain, persistence, Journal Lifecycle, posting, approval, locking, reversal, or finalization behavior may be introduced.

Exit criteria:
- Primary accounting workspaces at a 1080p-class desktop viewport avoid unnecessary page-level vertical scrolling and keep the main data surface visible within the workspace.
- Standard dense tables target approximately 20–30 simultaneously visible data rows where the surrounding workflow permits it, with a typical operational row-height target around 28–32 px unless content requires more.
- Chart of Accounts presents substantially more of the hierarchy in one view than the pre-Step-14 layout while preserving clear parent/child relationships and keyboard accessibility.
- Wide accounting grids use contained horizontal scrolling and/or frozen essential columns rather than forcing the whole application shell to scroll horizontally.
- High-frequency forms use compact desktop layouts without changing validation, domain rules, or Application contracts.
- Existing RTL, accessibility, responsive, and accounting regression coverage remains green.

Status: Completed

Evidence:
- Added reusable operational density tokens, contained workspace scrolling, sticky headers, compact accounting surfaces, and a denser Chart of Accounts hierarchy.
- Added the global `compact`, `comfortable`, and `spacious` density preference with `comfortable` default, persistence, and a Persian App Shell selector.
- Density remains presentation-only and introduces no Journal Lifecycle behavior.

### Step 15 — Final Review, Merge, and Release

- Perform final scope review against this fixed plan.
- Confirm all UI migration targets are complete or explicitly deferred with rationale.
- Merge the completed phase according to repository policy.
- Tag and publish the Phase 14 release with release notes.

Exit criteria:
- Phase 14 is merged through the approved repository flow.
- Release tag and notes are published.
- Roadmap points to Phase 15 — Journal Lifecycle as the next implementation target.

Status: Completed

Evidence:
- Phase 14 was merged into `develop` by `b31ec6baf9cf0d25bc28c58c5b7cae0204731d7d`.
- Phase 14 was released through `main` by `7afbf4aee4b9d6470f1bdb63a658e21cdd29d561`.
- Release tag `v0.14.0` exists.
- Phase 15 — Journal Lifecycle is the next implementation target.
