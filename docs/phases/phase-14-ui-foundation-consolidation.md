# Phase 14 — UI Foundation Consolidation

## Status

In progress. Steps 1–8 completed.

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

## Step 4 — Final App Shell and Active Context

Step 4 replaced the global temporary shell and connected the desktop workspace to persisted organizational/fiscal context:

- introduced `ActiveContextProvider`, loading companies, branches, fiscal years, and the persisted current fiscal year through the existing SQLite repository adapters;
- introduced the final Persian RTL `AppShell` with grouped/collapsible navigation, authenticated-user identity, breadcrumb/page-title surface, active-context selectors, contained workspace, and status bar;
- made Accounting navigation visibility permission-aware for routes with explicit existing permission contracts while preserving application-boundary authorization as mandatory enforcement;
- replaced `TemporaryAppShell` in the router and removed the temporary shell source file;
- removed the old hard-coded company/fiscal placeholders from the global shell; Company, Branch, and Fiscal Year selections now come from persisted records;
- retained only page/dashboard-era `temporary-*` presentation as transitional debt explicitly owned by subsequent Phase 14 steps;
- added focused shell regression-contract coverage for final routing, navigation behavior, persisted context sources, placeholder removal, responsive containment, and focus states.

## Step 5 — Dashboard Modernization

Step 5 replaced the prototype dashboard with a context-aware home workspace built only on already-delivered application contracts:

- removed the temporary dashboard classes, stale phase-development wording, and prototype status copy from the Dashboard page;
- adopted the Phase 14 shared `Page`, `Panel`, `Card`, `Badge`, and `Feedback` primitives plus a dedicated token-based responsive dashboard stylesheet;
- added real active Company, Branch, and Fiscal Year summary cards driven by `ActiveContextProvider`, including persisted status and Solar Hijri fiscal-date presentation;
- added coherent no-company, no-fiscal-year, no-journal, loading, and read-error states with links to the already implemented management surfaces;
- added shortcuts only to implemented modules such as Journal Vouchers, Chart of Accounts, Company setup, Fiscal Years, Accounting Dimensions, and System Diagnostics;
- used the existing permission-aware Journal read service to show up to five recent Draft vouchers for the active company/fiscal year/branch without adding reporting, posting, approval, finalization, reversal, or other Phase 15 behavior;
- added `apps/desktop/tests/dashboard-ui-contract.test.ts` to lock removal of temporary/stale dashboard content, active-context usage, existing Journal read-contract usage, empty states, implemented-module shortcuts, and responsive token-based styling.

## Step 6 — Company and Branch Workspace

Step 6 converted the Foundation-era create-only Company screen into a management workspace while keeping business behavior within Company contracts:

- added persisted Company list/selection backed by `ActiveContextProvider`; selecting a Company now also selects the shared application context used by the Shell and Dashboard;
- added Company identity/status summaries and a branch-oriented view using the persisted Branch collection for the active Company;
- retained creation through `setupCompany` and wired its existing `CompanySetupResult` into context refresh/selection after successful creation;
- retained `updateCompanyActivityType` with its existing permission contract and coding-template recommendation semantics;
- migrated the full Company setup form to shared Phase 14 form/feedback primitives and dedicated responsive workspace styling;
- removed development-only console logging from the normal Company form and `setupCompany` Application transaction;
- renamed the navigation surface to `شرکت‌ها و شعب` without changing the stable `/company/setup` route;
- added focused UI contract coverage for the Company/Branch workspace.

### Step 6 follow-up correction before Step 8

A usability review identified that the Branch repository already supported creation but the consolidated Company workspace did not expose that capability. Before starting Step 8:

- added `addCompanyBranch`, a thin Application workflow over the existing Company Unit of Work and Branch repository;
- reused existing `validateBranchInput`, verifies the selected Company, and prevents duplicate branch codes within that Company;
- always creates the added branch as a non-head-office branch, preserving the initial head-office semantics established by `setupCompany`;
- added an inline `+ افزودن شعبه` form to the active Company's Branch card using shared `Field`, `Input`, `Button`, and `Feedback` presentation;
- refreshes shared Company/Branch/Fiscal context after mutation so the new Branch becomes visible without restarting or switching Company;
- added domain/application and desktop UI contract tests for branch creation.

## Step 7 — Fiscal Workspace

Step 7 converted the Fiscal surface from a create-only alias into a coherent management workspace while preserving existing Fiscal application semantics:

- added persisted Fiscal Year list/selection for the active Company, including current/status badges and selected-year summary;
- added Fiscal Period read presentation using the existing repository contract, including open/locked/closed states;
- standardized Fiscal Year and Period start/end presentation through the existing Solar Hijri formatter while durable values remain Gregorian ISO dates;
- retained creation through `createFiscalYear` and its existing single-period command behavior, then refreshes/selects the newly created year in the shared active context;
- migrated the fiscal creation form to Phase 14 shared form and feedback primitives and removed development-only console output;
- migrated the standalone New Fiscal Year route away from `temporary-page` while keeping the route available;
- added token-based responsive workspace styling and focused fiscal UI contract tests;
- introduced no fiscal close/reopen workflow and no Phase 15 Journal Lifecycle behavior.

### Step 7 follow-up corrections before Step 8

Visual verification at the real desktop runtime exposed two presentation problems that source-only checks had not caught:

- legacy `.fiscal-form` and generic button rules in `App.css` were still capable of overriding the new design-system presentation;
- the first shared Solar Hijri picker implementation did not sufficiently isolate its calendar buttons/layout from legacy global CSS.

The Fiscal form and shared `PersianDatePicker` were hardened with explicit containment, reset rules, fixed calendar geometry, seven-column day layout, high stacking context, RTL-aware placement, and regression checks. Solar Hijri remains the user-entry format while the component emits Gregorian ISO values to existing Application/Domain contracts.

## Pre-Step 8 Desktop Baseline Corrections

- The Tauri main window now starts at `1366 × 768`, establishing the minimum desktop composition baseline used by the Phase 14 workspace designs.
- `ActiveContextProvider.refresh()` now refreshes dependent Branch and Fiscal collections even when the active Company ID is unchanged. This is required after creating a Branch or Fiscal Year.

## Step 8 — Security Workspace

Step 8 consolidates the Foundation-era Security screens without changing authentication, authorization, assignment, or persistence semantics:

- added a shared `SecurityWorkspace` with one consistent Users/Roles/Permissions tab surface instead of per-page ad-hoc back links and `temporary-page` wrappers;
- migrated Login to shared `Panel`, `Field`, `Input`, `Button`, and `Feedback` primitives while retaining the existing `authenticateUser` boundary and session flow;
- migrated User and Role creation to shared form primitives and preserved existing `createUser` and `createRole` Application use cases;
- migrated User/Role/Permission listings to shared `DataTable` and `Badge` presentation with explicit loading, empty, and read-error states;
- migrated Role Permission and User Access assignment surfaces to shared selectors, panels, feedback, and consistent checkbox-choice presentation;
- preserved `replaceRolePermissions`, `replaceUserRoles`, and `replaceUserBranchAccess` assignment semantics, including System Administrator protection and inactive permission/role/branch disabled states;
- removed development-only console logging from the touched Security user flows and replaced it with user-facing Persian feedback;
- added `security-workspace.css` with token-based RTL, responsive, focus-visible, contained list, and login presentation;
- added `apps/desktop/tests/security-workspace-ui-contract.test.ts` to lock the shared workspace, design-system adoption, authentication/assignment boundaries, disabled-state semantics, absence of temporary UI and console logging, and responsive/focus behavior.

## Active UI Technical Debt — Must Remain Visible Through Phase 14

`apps/desktop/src/App.css` still contains legacy Vite starter styles and first-generation Foundation selectors. Those rules have already caused real runtime collisions with Phase 14 components. This is an active migration debt, not an accepted final state.

For every remaining Phase 14 UI step:

- check touched screens against legacy `App.css` selectors before closing the step;
- do not add new feature-specific overrides merely to coexist permanently with legacy global rules;
- migrate/remove obsolete rules as their owning Audit/Approval and Accounting workspaces are consolidated;
- Security source code no longer consumes the legacy `security-panel`, `security-table`, `security-errors`, `security-success`, or `temporary-page` presentation selectors; their inert definitions remain part of the final legacy-selector cleanup in Steps 11–13;
- complete a final legacy-selector audit in Steps 11–13 and ensure obsolete Vite/temporary/Foundation presentation rules are removed or explicitly justified before Phase 14 release.

## Validation Evidence

Step-by-step evidence is maintained in the fixed plan. Steps 3–8 and their pre-Step-8 corrections add focused desktop/application source-contract tests. Full focused runtime and monorepo validation remains mandatory at Step 13 after the implementation steps are complete.
