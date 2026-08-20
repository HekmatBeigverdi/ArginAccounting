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
| 9 | Audit and Approval Workspace Harmonization | Not started |
| 10 | Accounting Workspace Harmonization | Not started |
| 11 | RTL, Accessibility, Keyboard, and Responsive Hardening | Not started |
| 12 | Loading, Empty, Error, Success, and Feedback Standards | Not started |
| 13 | UI Regression, Monorepo Validation, and Documentation | Not started |
| 14 | Final Review, Merge, and Release | Not started |

## Steps

### Step 1 — Baseline, Branch, and Plan Freeze

- Create `phase/14-ui-foundation-consolidation` from the synchronized `develop` baseline.
- Register Phase 14 in the canonical roadmap and renumber all previously planned phases after Phase 13 by one.
- Freeze this implementation plan and record the Phase 14 scope boundary.
- Confirm Phase 13 remains the latest completed/released milestone and Phase 15 Journal Lifecycle remains untouched.

Exit criteria:

- Remote Phase 14 branch exists from the approved baseline.
- Canonical roadmap identifies Phase 14 as the current target.
- Fixed plan is committed and remotely verifiable.

Status: Completed

Evidence:

- Created remote branch `phase/14-ui-foundation-consolidation` from synchronized `develop` baseline `03f6053bf177538a4974ebec1f19c47770795b8c`.
- Registered Phase 14 — UI Foundation Consolidation as the current target and shifted all previously planned phases after Phase 13 by one; Journal Lifecycle is now Phase 15 and Deployment and Production Hardening is Phase 47.
- Created the fixed implementation plan and Phase 14 implementation record with explicit UI-only scope boundaries and Phase 15 Journal Lifecycle exclusions.
- Reconciled root README, documentation hub, phase index, roadmap reference, and Phase 13 forward references to the new Phase 14/15 numbering.
- Confirmed Phase 13 remains completed and released as `v0.13.0` and no Journal Lifecycle behavior was introduced during Step 1.

### Step 2 — UI Architecture Audit and Design-System Contract

- Inventory current shell, page layouts, forms, tables, filters, badges, feedback states, and workspace patterns across Phases 05–13.
- Classify patterns as reusable, replaceable, or phase-specific.
- Define the component layering contract for tokens, primitives, composites, workspace layouts, and feature pages.
- Define dependency rules so shared presentation components remain independent of domain persistence implementations.

Exit criteria:

- UI architecture audit is recorded.
- Design-system ownership and dependency boundaries are explicit.
- Phase 13 reference patterns and legacy `temporary-*` migration targets are identified.

Status: Completed

Evidence:

- Added `docs/ui/phase-14-ui-architecture-audit.md` with an inventory of Foundation and Accounting presentation generations across Phases 05–13.
- Classified current patterns as reusable, replaceable, reusable-with-harmonization, or feature-specific and recorded explicit migration targets for `TemporaryAppShell`, `temporary-*` page/shell/dashboard classes, stale development copy, starter Vite/Tauri visual rules, and duplicated feature control/status styling.
- Updated `docs/ui/UI_ARCHITECTURE.md` from a future-phase placeholder into the canonical Phase 14 desktop presentation contract.
- Defined five presentation layers: design tokens, shared primitives, shared composites/workspace layouts, feature UI, and route pages, with dependencies pointing downward only.
- Explicitly prohibited shared presentation dependencies on `*-tauri`, SQLite, repository implementations, and feature business types used only for generic rendering.
- Designated Phase 13 Journal Voucher as the interaction-quality reference for dense accounting workflows while keeping Journal-specific semantics feature-owned.
- Confirmed Company/Fiscal/Security route pages already keep feature behavior outside the temporary shell, allowing Phase 14 presentation replacement without moving Domain/Application rules into React.
- No production UI implementation, design tokens, primitives, Journal Lifecycle behavior, persistence changes, or domain-rule changes were introduced in Step 2.

### Step 3 — Design Tokens and Shared UI Primitives

- Establish shared typography, spacing, radius, elevation, border, semantic state, density, and sizing tokens.
- Implement reusable button, input, select, textarea, field, panel, card, badge, toolbar, table, dialog, and feedback primitives needed by existing screens.
- Define consistent focus-visible, disabled, validation, destructive, and read-only states.
- Preserve Persian typography and RTL behavior without embedding business rules in primitives.

Exit criteria:

- Shared primitives are consumable by desktop feature pages.
- Visual states are covered by focused component tests where practical.
- No feature-specific persistence dependency exists in the shared UI layer.

Status: Completed

Evidence:

- Added `apps/desktop/src/styles/design-tokens.css` with Persian-first typography, spacing, radius, border, surface, semantic state, focus, elevation, control-height, page-width, and accounting-table density tokens.
- Added shared primitive styling in `apps/desktop/src/components/ui.css`, including focus-visible, disabled, invalid, read-only, destructive, semantic feedback, contained table overflow, dialog, panel, card, toolbar, badge, and page/stack states.
- Added reusable React form primitives `Button`, `Input`, `Select`, `Textarea`, and `Field` under `components/forms` using native element props and refs.
- Added shared layout primitives `Page`, `Stack`, `Panel`, `Card`, and `Toolbar`; data-display primitives `Badge` and `DataTable`; and feedback primitives `Feedback` and accessible `Dialog`.
- Loaded design tokens and shared primitive CSS before legacy `App.css` so existing screens remain behaviorally unchanged until their owning migration steps while new feature code can consume the shared layer immediately.
- Added `apps/desktop/tests/design-system-primitives.test.ts` to lock token coverage, primitive exports, accessibility markers, visual-state contracts, and the absence of `@argin/*`, SQLite, or Tauri dependencies in the generic form layer.
- Step 3 does not migrate Shell, Dashboard, Company, Fiscal, Security, Audit/Approval, or Accounting pages; those remain assigned to Steps 4–10.
- No domain, application, repository, SQLite, Tauri persistence, or Phase 15 Journal Lifecycle behavior was introduced.

### Step 4 — Final App Shell, Navigation, and Active Context

- Replace the temporary application shell naming and first-generation layout with the final shared desktop shell.
- Implement grouped/collapsible navigation suitable for the growing ERP module set.
- Provide real presentation surfaces for active company, branch, and fiscal-year context using existing application contracts.
- Add consistent page header/breadcrumb/action regions and status surfaces.
- Ensure navigation is permission-aware where existing permission contracts allow it.

Exit criteria:

- Primary routes render inside the final shell.
- Legacy temporary shell classes are removed or isolated to approved transitional cases.
- Active context presentation is no longer hard-coded placeholder text.

Status: Completed

Evidence:

- Added `ActiveContextProvider` to load companies, company branches, and fiscal years from the existing SQLite repository adapters and to select the persisted current fiscal year when available, otherwise falling back deterministically to an open/first year.
- Added the final `AppShell` with Persian RTL brand area, grouped/collapsible navigation, authenticated user surface, breadcrumb/page-title surface, active Company/Branch/Fiscal Year selectors, contained workspace, and offline/SQLite status bar.
- Added navigation permission metadata and filtering for Accounting routes where existing permission contracts are explicit, while preserving application-boundary authorization as the security source of truth.
- Routed all primary authenticated pages through `AppShell` and removed `TemporaryAppShell` from the router and source tree.
- Removed hard-coded shell context values such as `انتخاب نشده` and the fixed `مرکزی` branch; context options now come from persisted Company/Fiscal repositories.
- Kept remaining `temporary-page` and temporary dashboard presentation as explicitly transitional debt owned by Steps 5–9; those classes are no longer part of the global shell implementation.
- Added `apps/desktop/tests/app-shell-ui-contract.test.ts` to lock final-shell routing, grouped/collapsible permission-aware navigation, persisted context loading, removal of former hard-coded context placeholders, responsive containment, and token-based focus states.
- No Journal Lifecycle, accounting-domain, fiscal-domain, company-domain, migration, or persistence-semantic changes were introduced.

### Step 5 — Dashboard Modernization

- Replace the prototype dashboard and stale phase-development text.
- Provide useful current-context summary and shortcuts to implemented modules.
- Surface only data already supported by existing application contracts; do not invent future reporting/domain behavior.
- Provide coherent empty states when company/fiscal context is not selected.

Exit criteria:

- Dashboard no longer describes itself as temporary.
- No stale phase-status text remains in the user-facing dashboard.
- Dashboard follows the shared shell and design system.

Status: Completed

Evidence:

- Replaced the prototype Dashboard markup and `temporary-*` dashboard classes with the shared Phase 14 `Page`, `Panel`, `Card`, `Badge`, and `Feedback` primitives plus dedicated token-based responsive styling.
- Removed stale user-facing development copy, including the temporary-dashboard message, old phase-number references, and "in development" Security wording.
- Added real active Company, Branch, and Fiscal Year summaries sourced from `ActiveContextProvider`; fiscal dates use the existing Solar Hijri presentation formatter.
- Added coherent states for missing Company, missing Fiscal Year, empty Journal results, active-context loading, and Journal read failure, with navigation to already implemented setup/workspace routes.
- Added shortcuts only to already implemented Desktop routes and capabilities; no future reporting or ERP module behavior was invented.
- Reused the existing permission-aware `journals.list` application read contract to display up to five recent Draft vouchers scoped to the active company, fiscal year, and branch.
- Added `apps/desktop/tests/dashboard-ui-contract.test.ts` to lock design-system adoption, stale-copy removal, persisted active-context presentation, existing Journal read-contract usage, empty states, implemented-module shortcuts, responsive layout, and the absence of Phase 15 Journal Lifecycle behavior.
- No accounting-domain, Journal Lifecycle, migration, repository, or persistence-semantic changes were introduced.

### Step 6 — Company and Branch Workspace Consolidation

- Replace the create-only Companies surface with a management workspace using existing Company/Branch capabilities.
- Separate list/selection, create/edit, and branch-oriented presentation where supported by existing contracts.
- Migrate Company forms to shared form, feedback, and layout primitives.
- Remove development-only console output from normal user flows or route diagnostics through approved infrastructure.

Exit criteria:

- Company management is presented as a coherent workspace rather than an alias to the setup form.
- Existing company creation behavior remains regression-safe.
- Persian RTL validation and feedback are consistent with the shared design system.

Status: Completed

Evidence:

- Replaced the create-only `CompanySetupPage` presentation with a persisted Company/Branch management workspace backed by the shared `ActiveContextProvider`.
- Added Company list/selection, active Company identity/status summary, and branch-oriented presentation using existing persisted Company and Branch repository data.
- Preserved company creation through the existing transactional `setupCompany` Application use case and added an `onCreated` callback so the shared context refreshes and selects the newly created Company after success.
- Exposed the already-supported `updateCompanyActivityType` Application use case, preserving its existing permission contract and coding-template recommendation/preview semantics.
- Migrated the Company setup form to shared `Field`, `Input`, `Select`, `Textarea`, `Button`, and `Feedback` primitives while retaining existing validation, tax-profile, address, and head-office inputs.
- Added `company-workspace.css` with token-based RTL layout, selected-row/focus states, branch cards, responsive two-column workspace behavior, and contained creation form presentation.
- Renamed the navigation label from create-only `تعریف شرکت` to `شرکت‌ها و شعب` while preserving the stable `/company/setup` route.
- Removed development-only `console.log`/`console.error` output from the normal Company form flow and from the `setupCompany` transaction without changing transaction or validation behavior.
- Added `addCompanyBranch` over the existing Company Unit of Work/Branch repository, with existing validation, Company existence checking, duplicate code protection, and non-head-office creation semantics.
- Added inline Branch creation to the active Company workspace and corrected `ActiveContextProvider.refresh()` so Branch/Fiscal collections refresh after mutations even when Company ID is unchanged.
- Added focused Company/Branch Application and desktop UI contract tests.

### Step 7 — Fiscal Workspace Consolidation

- Replace the create-only Fiscal Years surface with a management workspace using existing fiscal capabilities.
- Present fiscal years and periods, current/open state, and supported actions without introducing future accounting lifecycle rules.
- Use Solar Hijri presentation consistently while preserving existing durable date conventions.
- Migrate fiscal forms and feedback to shared primitives.

Exit criteria:

- Fiscal Years page is no longer only an alias to New Fiscal Year.
- Supported fiscal state is visible and usable through a coherent workspace.
- Existing fiscal behavior remains regression-safe.

Status: Completed

Evidence:

- Replaced the `FiscalYearsPage` alias to `NewFiscalYearPage` with a persisted management workspace driven by the shared active Company/Fiscal context.
- Added Fiscal Year list/selection, current/status badges, Solar Hijri start/end presentation, and selected-year summary without changing durable Gregorian ISO date storage.
- Added persisted Fiscal Period presentation through the existing `SqliteFiscalPeriodRepository.findByFiscalYearId` read contract, including open/locked/closed state and Solar Hijri date ranges.
- Preserved fiscal-year creation through the existing transactional `createFiscalYear` Application use case and existing single-period behavior; successful creation refreshes and selects the new Fiscal Year in shared context.
- Migrated `FiscalYearForm` to shared form/feedback primitives and shared `PersianDatePicker`; Solar Hijri input is converted at the UI boundary while durable storage remains Gregorian ISO.
- Replaced temporary presentation on the standalone `/fiscal/years/new` route with the shared Phase 14 workspace language while retaining route compatibility.
- Hardened the Fiscal workspace and shared Date Picker against legacy global `App.css` rules after real runtime visual verification exposed button/calendar collisions.
- Added token-based RTL/responsive styling and focused Fiscal/DatePicker contract coverage.
- The Tauri main window was corrected to start at `1366 × 768` before Step 8, with a focused desktop window contract test.
- No fiscal closing/reopening lifecycle, Journal Lifecycle behavior, domain rule, migration, or persistence semantic was added.

### Step 8 — Security Workspace Consolidation

- Harmonize Login, Users, Roles, Permissions, and access-management surfaces.
- Replace ad-hoc page navigation with shared workspace/page patterns.
- Improve permission/role assignment readability without changing security semantics.
- Ensure unauthorized/disabled states and feedback are consistently presented.

Exit criteria:

- Security screens share the common desktop visual language.
- Existing permission enforcement remains at the application boundary.
- Security-focused desktop regression tests pass.

Status: Completed

Evidence:

- Added a shared `SecurityWorkspace` for Users, Roles, and Permissions with consistent Persian RTL page header and tab navigation; removed `temporary-page` wrappers and per-page dashboard back links.
- Migrated Login to shared `Panel`, `Field`, `Input`, `Button`, and `Feedback` primitives while preserving `authenticateUser`, the existing repositories/password hasher, session update, and route replacement behavior.
- Migrated User and Role creation to shared form primitives while preserving the existing `createUser` and `createRole` Application use cases.
- Migrated User, Role, and Permission read surfaces to shared `DataTable`, `Badge`, `Panel`, and explicit loading/empty/error states.
- Migrated Role Permission and User Access assignment surfaces to shared selectors, panels, feedback, and consistent checkbox-choice presentation while preserving `replaceRolePermissions`, `replaceUserRoles`, and `replaceUserBranchAccess` semantics.
- Preserved the System Administrator all-permissions protection and disabled assignment states for inactive permissions, roles, and branches.
- Removed development-only `console.log`/`console.error` use from touched Security flows and replaced silent read failures with Persian feedback.
- Added `security-workspace.css` with token-based responsive layout, focus-visible tab navigation, contained permission/access lists, and consolidated login presentation.
- Security source code no longer consumes legacy `security-panel`, `security-table`, `security-errors`, `security-success`, or `temporary-page` selectors; their inert definitions remain tracked for the final `App.css` cleanup in Steps 11–13.
- Added `apps/desktop/tests/security-workspace-ui-contract.test.ts` to lock workspace consistency, shared-primitives adoption, authentication/assignment boundaries, disabled-state semantics, removal of temporary UI/development console logging, and responsive/focus behavior.
- No Security domain semantics, permission enforcement boundary, persistence schema, or Phase 15 Journal Lifecycle behavior was changed.

### Step 9 — Audit and Approval Workspace Harmonization

- Migrate Audit and Approval list/detail screens to shared layout, filter, badge, table, and feedback patterns.
- Preserve immutable audit semantics and existing approval workflow behavior.
- Standardize status visualization, detail hierarchy, empty states, and navigation.

Exit criteria:

- Audit and Approval screens visually align with the consolidated desktop experience.
- No audit or approval domain behavior changes are introduced.
- Existing Audit/Approval regression coverage remains green.

Status: Not started

### Step 10 — Accounting Workspace Harmonization

- Review Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher workspaces against the new shared design system.
- Extract duplicated patterns into shared components where doing so reduces divergence without weakening feature boundaries.
- Preserve the Journal Voucher workspace as the interaction-quality baseline while removing avoidable one-off styling.
- Verify tables, selectors, toolbars, panels, totals, and responsive overflow behave consistently.

Exit criteria:

- Phase 10–13 workspaces use the consolidated visual language.
- No Phase 15 Journal Lifecycle controls or behavior are introduced.
- Existing accounting desktop tests remain green.

Status: Not started

### Step 11 — RTL, Accessibility, Keyboard, and Responsive Hardening

- Audit logical RTL layout, text alignment, icon direction, numeric alignment, and mixed Persian/Latin content.
- Establish keyboard traversal, focus visibility, labels, semantic landmarks, and accessible control naming.
- Validate desktop window resizing and contained horizontal scrolling for dense accounting tables.
- Remove avoidable fixed-width assumptions that break supported desktop sizes.

Exit criteria:

- Critical desktop flows are keyboard reachable.
- RTL direction and mixed-content presentation are consistent.
- Supported window sizes do not create page-level destructive overflow.

Status: Not started

### Step 12 — Loading, Empty, Error, Success, and Feedback Standards

- Standardize loading, empty, validation-error, technical-error, success, confirmation, and destructive-action feedback.
- Ensure technical diagnostics are available where appropriate without replacing user-facing Persian explanations.
- Prevent silent failures and ambiguous disabled states in consolidated workspaces.
- Reuse notification infrastructure where it is already the correct application contract.

Exit criteria:

- Touched workspaces have explicit asynchronous and empty/error states.
- User-facing feedback is Persian and actionable.
- Technical detail exposure follows a consistent pattern.

Status: Not started

### Step 13 — UI Regression, Monorepo Validation, and Documentation

- Add or update desktop tests for shell, navigation, key Foundation workspaces, and Accounting workspace regressions.
- Run focused package validation and full monorepo install/lint/typecheck/test/build checks.
- Regenerate documentation index and verify documentation diffs.
- Update UI architecture, phase record, roadmap references, changelog, and relevant glossary/conventions.

Exit criteria:

- Required focused and monorepo validations pass with recorded evidence.
- Documentation index is regenerated and clean.
- Phase 14 implementation record accurately describes delivered UI consolidation.

Status: Not started

### Step 14 — Final Review, Merge, and Release

- Review all step evidence and unresolved Change Requests.
- Confirm no Phase 15 Journal Lifecycle behavior leaked into Phase 14.
- Confirm legacy temporary UI debt identified by the Phase 14 audit is either removed or explicitly documented as deferred with rationale.
- Merge the Phase 14 branch according to project branch strategy only after explicit approval.
- Release consistently, verify remote refs/tag/release documentation, and advance the current target to Phase 15 only after explicit approval.

Exit criteria:

- Phase 14 is merged and released through the approved workflow.
- Remote refs/tag and release documentation are verified.
- Canonical roadmap identifies Phase 15 — Journal Lifecycle as the next/current target only after successful closure.

Status: Not started

## Governance

Before every implementation step:

1. Read this fixed plan.
2. Read `docs/development/github-publishing-workflow.md`.
3. Confirm the current branch and remote HEAD.
4. Confirm the previous step exit criteria.
5. State the current step number, scope, expected files, and validation.
6. Update only status/evidence unless an explicit Change Request authorizes plan modification.

## Change Requests

No Change Requests are open at plan creation.
