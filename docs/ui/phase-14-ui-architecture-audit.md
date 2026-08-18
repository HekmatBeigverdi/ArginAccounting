# Phase 14 — UI Architecture Audit

## Status

Completed during Phase 14 Step 2 — UI Architecture Audit and Design-System Contract.

## Purpose

This audit records the desktop UI baseline inherited from Phases 05–13 and identifies which patterns Phase 14 must preserve, replace, or keep feature-specific. It is an architecture and ownership record, not a visual redesign or implementation step.

## Audit Scope

Reviewed presentation surfaces include:

- application shell and navigation;
- dashboard and route-level page composition;
- Company and Branch UI from Phase 05;
- Fiscal UI from Phase 06;
- Security UI from Phase 07;
- Audit and Approval UI from Phase 08;
- Chart of Accounts from Phase 10;
- Accounting Dimensions from Phase 11;
- Coding Templates from Phase 12;
- Journal Voucher workspace from Phase 13;
- global CSS and existing UI architecture documentation.

Phase 09 is platform infrastructure and has no comparable feature workspace requiring consolidation beyond shared diagnostics/feedback surfaces.

## Current Generations of UI

### Generation 1 — Foundation / Temporary Presentation

The first generation intentionally optimized for route access and feature delivery before a final Persian UI phase. Its primary markers are:

- `TemporaryAppShell`;
- `temporary-shell`, `temporary-sidebar`, `temporary-nav`, `temporary-topbar`, `temporary-main`, and `temporary-statusbar`;
- `temporary-page`, `temporary-page__header`, and related page classes;
- hard-coded current-context text in the top bar;
- feature-local form/table styling concentrated in `App.css`;
- create-oriented Company and Fiscal routes rather than mature management workspaces;
- ad-hoc return links and page navigation in Foundation pages.

This generation remains structurally useful because routes, page/feature separation, providers, and domain/application boundaries are already independent of the final visual shell. Its visual/layout conventions are replacement targets.

### Generation 2 — Accounting Workspaces

Phases 10–13 introduced more mature workspace patterns:

- feature page headers with eyebrow/title/description/action regions;
- company-scoped toolbars and search/filter controls;
- two-column or list/detail workspace layouts;
- contained table overflow;
- cards/panels with consistent internal hierarchy;
- active/inactive/status badges;
- explicit empty, notice, success, and error surfaces;
- dense accounting tables with right-aligned labels and strong numeric readability;
- responsive collapse rules;
- feature-specific focus styling;
- technical error detail in workflows where operational diagnosis is needed.

Phase 13 Journal Voucher is the strongest interaction-quality reference because it combines list/search, editor/detail modes, dense line entry, dynamic accounting dimensions, totals, state feedback, and responsive overflow containment.

## Pattern Classification

| Area | Current Pattern | Classification | Phase 14 Direction |
| --- | --- | --- | --- |
| Router and route ownership | route-level pages under `pages`, reusable feature UI under `features` | Reusable | Preserve |
| Providers/composition | application contracts supplied outside route components | Reusable | Preserve |
| Temporary shell | `TemporaryAppShell` and `temporary-*` shell classes | Replace | Final shared App Shell in Step 4 |
| Navigation metadata | label/path/group data | Reusable with extension | Add stable IDs, permission/context metadata only where existing contracts support it |
| Global page wrapper | `temporary-page*` | Replace | Shared Page/Workspace primitives |
| Dashboard cards | `temporary-dashboard-*` | Replace | Shared dashboard/workspace cards in Step 5 |
| Company/Fiscal form CSS in `App.css` | feature-local duplicated inputs, buttons, messages | Replace | Shared form/feedback primitives in Steps 3, 6, 7 |
| Security panels/tables | useful two-column management pattern but locally styled | Reusable concept, replace styling | Shared panels/forms/tables in Step 8 |
| Audit/Approval list/detail | established workflow-specific structure | Reusable concept | Harmonize using shared layout/table/badge/feedback primitives in Step 9 |
| Chart of Accounts workspace | toolbar + tree/table + side editor + badges | Reusable | Harmonize in Step 10 |
| Accounting Dimensions workspace | tabs + summary + filters + table + editor | Reusable | Harmonize in Step 10 |
| Coding Templates workspace | template list/detail, tree preview, conflict/status semantics | Feature-specific composites | Preserve feature semantics; consume shared primitives in Step 10 |
| Journal Voucher workspace | list/detail/editor, dense line table, totals, responsive containment | Reference baseline | Preserve interaction quality; extract reusable patterns without copying feature rules |
| Status colors | repeated green/red/amber/slate values across features | Replace | Semantic design tokens in Step 3 |
| Controls | repeated button/input/select/textarea CSS per feature | Replace | Shared primitives in Step 3 |
| Focus states | strongest in newer accounting pages, inconsistent elsewhere | Replace/standardize | One focus-visible contract in Steps 3 and 11 |
| Loading/empty/error/success | present but implemented differently per feature | Replace/standardize | Shared feedback contract in Steps 3 and 12 |
| Dense tables | multiple local table implementations | Reusable concept | Shared table surface/scroll wrapper; feature columns remain feature-owned |
| Responsive rules | page-specific breakpoints and contained overflow | Reusable concept | Consolidate layout behavior; feature-specific density remains local |

## Key Findings

### 1. The old architecture already anticipated Phase 14

`docs/ui/UI_ARCHITECTURE.md` explicitly reserved final shell, dashboard, typography, design tokens, responsive layouts, data tables, dialogs, keyboard shortcuts, and display preferences for a future dedicated Persian UI phase. Phase 14 now owns that deferred responsibility.

### 2. `App.css` contains multiple generations of global styling

The stylesheet contains original Vite/Tauri starter rules, early cards/forms, repeated `:root` definitions, Foundation form styles, temporary shell/page styles, Security styling, and later bootstrap styles. Phase 14 should progressively reduce `App.css` to global reset/root/application-level rules and move reusable visual contracts into the shared UI layer.

### 3. Temporary context presentation is not authoritative

The current shell renders company, branch, and fiscal year as presentation placeholders. Phase 14 Step 4 must consume existing application/composition contracts rather than introducing local shell-owned business state.

### 4. Foundation pages are correctly separated from business logic

Company, Fiscal, and Security route pages already compose feature components rather than embedding domain rules. This validates the original architecture objective: Phase 14 can replace page/shell presentation without rewriting domain/application behavior.

### 5. Accounting pages independently reinvent the same primitives

Chart of Accounts, Accounting Dimensions, Coding Templates, and Journal Voucher each define local versions of buttons, inputs, cards, badges, alerts, toolbars, table wrappers, and responsive layout rules. Their domain-specific composites should remain local, but the visual primitives should converge.

### 6. Journal Voucher is a reference, not a component source to copy blindly

The Journal workspace demonstrates the desired interaction quality, especially focus states, status feedback, list/editor hierarchy, line-entry density, and contained horizontal overflow. Journal-specific classes and accounting behavior must not become generic UI dependencies.

## Legacy Migration Targets

The following are explicit Phase 14 migration targets:

- `TemporaryAppShell`;
- `temporary-shell*`;
- `temporary-sidebar*`;
- `temporary-nav*`;
- `temporary-topbar`;
- `temporary-main`;
- `temporary-statusbar`;
- `temporary-page*`;
- `temporary-dashboard-*`;
- stale development-only labels such as development-version and phase-status copy;
- global starter Vite/Tauri visual rules that are no longer part of the product;
- duplicate feature-level control/status styling that can be safely represented by shared primitives.

Removal is staged. Step 2 identifies these targets; Steps 3–12 perform migrations within their frozen scopes.

## Design-System Layering Contract

The desktop presentation system uses five layers. Dependencies point downward only.

### Layer 1 — Design Tokens

Ownership: `apps/desktop/src/styles/`.

Responsibilities:

- typography families/scales;
- spacing scale;
- radii;
- borders;
- elevation;
- surface/text colors;
- semantic success/warning/error/info colors;
- focus-ring values;
- control/table density and sizing;
- layout width/breakpoint variables where useful.

Tokens contain no React, routing, domain, Tauri, SQLite, repository, or application-service dependency.

### Layer 2 — Shared Primitives

Ownership: `apps/desktop/src/components/` grouped by forms, feedback, data-display, and layout.

Examples:

- Button;
- Input/Select/Textarea surfaces;
- Field/FieldMessage;
- Panel/Card;
- Badge;
- Alert/Notice/EmptyState/LoadingState;
- Table surface and scroll container;
- Dialog/confirmation surface;
- generic Toolbar and action group.

Rules:

- primitives may use React and design tokens;
- primitives receive data/labels/state through props;
- primitives do not import feature packages, repositories, Tauri adapters, SQLite code, or application services;
- primitives do not know accounting permissions, journal states, company rules, or fiscal rules.

### Layer 3 — Shared Composites and Workspace Layouts

Ownership: `apps/desktop/src/components/layout`, `components/data-display`, and application-shell-owned components under `app/` when global context is involved.

Examples:

- PageHeader;
- WorkspaceShell/WorkspaceGrid;
- FilterToolbar;
- ListDetailLayout;
- FormSection;
- Context selector presentation;
- navigation group presentation;
- status bar presentation.

Rules:

- composites coordinate primitives and presentation state;
- global app composites may consume provider-facing presentation contracts supplied by `app/providers`/composition;
- composites still do not execute feature persistence or contain business rules.

### Layer 4 — Feature UI

Ownership: `apps/desktop/src/features/<feature>/`.

Responsibilities:

- business-oriented forms/editors/selectors/matrices;
- translating Application DTO/view-model state into shared primitives;
- feature-local interaction orchestration;
- feature-specific composites such as Journal Entry Table, Coding Template Preview Tree, Account Tree, or Role Permission Matrix.

Rules:

- feature UI may consume domain/application contracts and composition adapters appropriate to the existing architecture;
- persistence implementations must remain behind existing composition/application boundaries;
- feature-specific semantics must not leak into shared primitives.

### Layer 5 — Route Pages

Ownership: `apps/desktop/src/pages/<module>/`.

Responsibilities:

- route-level composition;
- page title/description/actions/breadcrumb metadata;
- composition of one or more feature components;
- route navigation state.

Rules:

- pages must not reimplement the global application shell;
- pages must not own repository/database transactions;
- pages should prefer shared workspace/layout primitives over custom page wrappers.

## Dependency Rules

Allowed direction:

`pages -> features -> shared composites/primitives -> tokens`

`app shell -> shared composites/primitives -> tokens`

Application/domain data reaches pages/features through existing composition/provider/application contracts.

Forbidden dependencies:

- `components/* -> packages/*-tauri`;
- `components/* -> SQLite`;
- `components/* -> repository implementations`;
- design tokens importing React or feature code;
- generic shared components importing Journal, Chart of Accounts, Fiscal, Security, Audit, or Company business types merely to render a visual state;
- route pages bypassing Application boundaries to perform persistence directly.

## Global Context Contract

The final shell may display/select active Company, Branch, and Fiscal Year, but it must not become the source of business truth. The shell consumes presentation-ready context through providers/composition. Feature Application services remain responsible for validating company/branch/fiscal scope.

Navigation visibility may be permission-aware, but UI visibility is never authorization enforcement. Application-boundary permission checks remain mandatory.

## RTL and Localization Contract

- root application direction is RTL;
- layout uses logical properties (`margin-inline`, `padding-inline`, `border-inline-*`) where direction matters;
- Persian labels are right-aligned by default;
- identifiers, account codes, references, and numeric values may opt into LTR/numeric alignment without changing surrounding RTL flow;
- user-facing dates use Solar Hijri while durable/internal dates remain Gregorian;
- primary accounting currency presentation remains Iranian Rial;
- shared primitives must not embed English-only labels.

## Reuse Boundary

Shared means visually/interaction-generic across at least two modules. A component remains feature-local when its behavior is defined by accounting/security/fiscal/company workflow semantics even if its visual shell resembles another component.

Examples:

- `Badge` is shared; `JournalStatusBadge` mapping is feature-owned.
- generic `DataTable` surface is shared; Journal line columns are feature-owned.
- generic `Alert` is shared; Coding Template conflict resolution content is feature-owned.
- generic `FilterToolbar` is shared; Chart of Accounts filter semantics are feature-owned.

## Step 2 Exit Criteria Assessment

- UI architecture audit recorded: satisfied by this document.
- Design-system ownership and dependency boundaries explicit: satisfied by the five-layer contract and dependency rules above.
- Phase 13 reference patterns identified: Journal Voucher is explicitly designated the interaction-quality baseline.
- Legacy `temporary-*` migration targets identified: explicit migration target list recorded above.

No production UI implementation is included in Step 2. Design tokens and shared UI primitives begin in Step 3.
