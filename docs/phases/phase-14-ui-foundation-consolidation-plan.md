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
| 9 | Audit and Approval Workspace Harmonization | Completed |
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
- Registered Phase 14 as the current target, shifted later phases by one, and froze the implementation plan with Phase 15 Journal Lifecycle explicitly excluded.
- Reconciled roadmap/readme/phase references and confirmed Phase 13 remains released as `v0.13.0`.

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

- Added `docs/ui/phase-14-ui-architecture-audit.md` and updated `docs/ui/UI_ARCHITECTURE.md` with the five-layer presentation contract.
- Recorded reusable/replaceable/feature-specific patterns, Phase 13 as the interaction-quality baseline, and explicit migration targets for temporary/global legacy UI.
- Prohibited shared presentation dependencies on persistence adapters/repositories and kept Domain/Application behavior outside React primitives.

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

- Added shared design tokens and reusable form/layout/data-display/feedback/dialog primitives.
- Standardized focus-visible, disabled, invalid, read-only, destructive, semantic state, and dense-table presentation.
- Added focused primitive contracts guarding against business/persistence dependencies.

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

- Added persisted `ActiveContextProvider`, final Persian RTL `AppShell`, grouped/collapsible navigation, context selectors, breadcrumb/title/status surfaces, and permission metadata where supported.
- Removed `TemporaryAppShell` and hard-coded Company/Branch/Fiscal placeholders.
- Added focused shell/navigation/context regression contracts.

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

- Replaced prototype/temporary dashboard presentation with shared Phase 14 primitives and responsive token-based styling.
- Added real active Company/Branch/Fiscal summaries, implemented-module shortcuts, explicit empty/loading/error states, and permission-aware recent Journal reads through existing contracts.
- Added focused dashboard regression coverage without introducing Phase 15 behavior.

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

- Converted Company setup into a persisted Company/Branch management workspace using shared active context and shared UI primitives.
- Preserved `setupCompany` and `updateCompanyActivityType` semantics, then exposed Branch creation through a thin `addCompanyBranch` Application workflow using existing validation/repository boundaries.
- Corrected context refresh after Branch/Fiscal mutations and added focused Company/Branch tests.

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

- Converted Fiscal Years into a persisted year/period management workspace with current/status presentation and Solar Hijri display.
- Preserved `createFiscalYear` behavior and Gregorian durable storage while adding the shared `PersianDatePicker` for Solar Hijri user input.
- Hardened the shared picker and Fiscal layout against legacy `App.css` collisions after runtime visual review; established a `1366 × 768` initial Tauri window baseline.

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

- Added shared Security workspace navigation and migrated Login, Users, Roles, Permissions, Role Permission, and User Access surfaces to shared primitives.
- Preserved existing authentication, creation, assignment, System Administrator, and disabled-state semantics; removed touched development console logging.
- Restored the Login navigation entry and corrected Security workspace tabs to the real `/security/users`, `/security/roles`, and `/security/permissions` routes with regression coverage.
- Legacy Security selectors in `App.css` remain inert and tracked for Steps 11–13 cleanup.

### Step 9 — Audit and Approval Workspace Harmonization

- Migrate Audit and Approval list/detail screens to shared layout, filter, badge, table, and feedback patterns.
- Preserve immutable audit semantics and existing approval workflow behavior.
- Standardize status visualization, detail hierarchy, empty states, and navigation.

Exit criteria:

- Audit and Approval screens visually align with the consolidated desktop experience.
- No audit or approval domain behavior changes are introduced.
- Existing Audit/Approval regression coverage remains green.

Status: Completed

Evidence:

- Migrated Approval list/detail pages to shared `Page`, `Panel`, `Card`, `Field`, `Input`, `Select`, `Textarea`, `Button`, `DataTable`, `Badge`, and `Feedback` primitives.
- Preserved all existing Approval service operations and permission checks: submit, approve, reject, return-to-draft, cancel, and comment; no workflow/domain semantics changed.
- Migrated Audit list/detail pages to the same shared presentation language while preserving `searchAuditEntries`/`getAuditEntry` read-only semantics and immutable before/after/metadata snapshots.
- Standardized Approval status and Audit outcome badge tones, Persian calendar date-time presentation, detail hierarchy, loading/empty/error states, and explicit list/detail navigation.
- Added shared token-based `governance-workspace.css` with responsive layouts and focus-visible navigation; removed obsolete `approval-pages.css` and `audit-pages.css` instead of retaining feature-specific legacy styles.
- Removed development-only console logging from touched Audit/Approval reads/actions and surfaced Persian user-facing error feedback.
- Added `apps/desktop/tests/audit-approval-workspace-ui-contract.test.ts` to lock shared-primitives adoption, workflow delegation, immutable Audit semantics, Persian timestamp presentation, responsive/focus behavior, and removal of legacy/temporary presentation.
- No Audit/Approval Domain, persistence, workflow, or Phase 15 Journal Lifecycle behavior was introduced.

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
