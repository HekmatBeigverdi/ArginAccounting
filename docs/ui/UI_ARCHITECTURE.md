# ArginAccounting UI Architecture

## Purpose

This document defines the canonical desktop presentation architecture for ArginAccounting. Phase 14 — UI Foundation Consolidation owns the transition from the temporary Foundation-era presentation to the reusable Persian RTL design system defined here.

The architecture is intentionally independent from final feature business rules. Domain and Application behavior remains outside React presentation components and persistence remains behind established contracts and composition boundaries.

For the Phase 14 baseline inventory and migration classifications, see [Phase 14 — UI Architecture Audit](phase-14-ui-architecture-audit.md).

## Product Direction

ArginAccounting is Persian-first, RTL-first, desktop-first, local-first accounting and ERP software. Tadbir and other Iranian accounting systems are workflow and functional references, not visual-design templates.

The interface should be modern, professional, information-dense where accounting workflows require it, keyboard-friendly, accessible, and consistent across modules.

## Core Presentation Principles

- Persian is the primary user-facing language.
- RTL is the application layout default.
- Solar Hijri is used for user-facing date presentation while durable/internal dates remain Gregorian according to project conventions.
- Iranian Rial is the primary accounting currency presentation.
- Feature pages remain route-based and independently testable.
- Global shell concerns do not leak into feature pages.
- Shared visual primitives contain no business rules.
- Domain/Application authorization remains authoritative even when navigation is permission-aware.
- Dense accounting tables must contain their own horizontal overflow instead of forcing destructive page-level overflow.
- Focus, keyboard, loading, empty, error, warning, success, disabled, and read-only states are first-class UI contracts.

## Desktop Structure

```text
Application Root
└── Providers / Composition
    └── Router
        ├── Authentication surfaces
        └── App Shell
            ├── Module Navigation
            ├── Active Context
            ├── Page Header / Breadcrumb / Actions
            ├── Route Workspace
            └── Status Surface
```

The App Shell owns global presentation only. Company, Branch, Fiscal, Security, Audit, Approval, and Accounting business rules remain in their existing module/Application boundaries.

## Source Ownership

```text
apps/desktop/src/
├── app/
│   ├── navigation/     global navigation metadata
│   ├── providers/      presentation-facing global providers
│   ├── router/         route ownership and guards
│   └── shell/          global desktop shell
├── components/
│   ├── data-display/   generic visual/data primitives and composites
│   ├── feedback/       generic feedback states
│   ├── forms/          generic form controls and field surfaces
│   └── layout/         generic page/workspace layout components
├── features/           business-oriented reusable UI
├── pages/              route-level composition
└── styles/             global reset and design tokens
```

## Design-System Layering Contract

### Layer 1 — Tokens

Owned by `styles/`.

Tokens define typography, spacing, radii, borders, elevation, surfaces, text colors, semantic state colors, focus-ring values, density, control sizing, and reusable layout variables.

Tokens must not depend on React, routing, business modules, Tauri, SQLite, repositories, or Application services.

### Layer 2 — Shared Primitives

Owned by `components/forms`, `components/feedback`, `components/data-display`, and `components/layout`.

Typical primitives include Button, Input, Select, Textarea, Field, FieldMessage, Card, Panel, Badge, Alert, Notice, EmptyState, LoadingState, table surface/scroll container, Dialog/confirmation surface, Toolbar, and action grouping.

Primitives receive labels/data/state through props and must not know accounting, company, fiscal, audit, approval, or security business semantics.

### Layer 3 — Shared Composites

Owned by shared component folders and, for global concerns, `app/`.

Examples include PageHeader, WorkspaceGrid, ListDetailLayout, FilterToolbar, FormSection, context-selector presentation, navigation-group presentation, and status-bar presentation.

Composites coordinate primitives and presentation state. They do not perform feature persistence.

### Layer 4 — Feature UI

Owned by `features/<feature>/` and feature-specific components close to their owning module.

Feature UI translates existing Application/domain view state into shared primitives and owns semantic composites such as Journal Entry Table, Coding Template Preview Tree, Account Tree, or Role Permission Matrix.

Feature semantics remain feature-owned even when their visual shell is shared.

### Layer 5 — Route Pages

Owned by `pages/<module>/`.

Pages compose feature components, page metadata, actions, and route navigation. They do not reimplement the global shell and must not directly own repository/database transactions.

## Dependency Direction

Allowed presentation direction:

```text
pages -> features -> shared composites/primitives -> tokens
app shell -> shared composites/primitives -> tokens
```

Application/domain state reaches presentation through the existing composition/provider/Application boundaries.

Forbidden dependencies include:

- `components/*` importing `packages/*-tauri`;
- shared components importing SQLite or repository implementations;
- tokens importing React or feature code;
- generic components importing feature business types solely to render a visual state;
- pages bypassing Application boundaries to perform persistence;
- UI permission visibility being treated as authorization enforcement.

## App Shell Contract

The final shell provides:

- grouped, scalable module navigation;
- active company presentation/selection where existing contracts allow it;
- active branch presentation/selection where existing contracts allow it;
- active fiscal-year presentation/selection where existing contracts allow it;
- page header/breadcrumb/action regions;
- global notification/status surfaces where existing infrastructure is appropriate;
- user/session presentation;
- offline/runtime status presentation.

The shell is not the source of business truth. Active context is supplied through providers/composition and remains validated by Application services.

## Navigation Contract

Navigation entries have stable route ownership and may expose presentation metadata such as label, group, icon identifier, ordering, and required permission when a corresponding permission contract already exists.

Hiding a navigation entry is a convenience only. Application services remain responsible for permission enforcement.

Route changes require a migration reason because routes are relevant to navigation, permission mapping, audit references, deep links, future web compatibility, and UI regression tests.

## Page Contract

A normal workspace page may contain:

- PageHeader;
- breadcrumbs/context metadata;
- primary/secondary actions;
- search/filter toolbar;
- main workspace content;
- loading state;
- empty state;
- error/technical detail state where appropriate;
- success/confirmation feedback.

Feature pages must not implement their own global sidebar/topbar/company selector/branch selector/fiscal selector.

## RTL and Mixed-Content Contract

- the root application is RTL;
- logical CSS properties are preferred where direction matters;
- Persian text is right-aligned by default;
- account codes, document numbers, identifiers, references, and numeric values may use LTR/numeric alignment locally;
- LTR content must not reverse the surrounding RTL layout;
- icons with directional meaning must respect RTL semantics;
- keyboard order follows meaningful document order rather than visual hacks.

## Accounting Density Contract

Accounting workspaces prioritize data readability and efficient keyboard/mouse entry over decorative spacing.

Shared table surfaces provide consistent headers, borders, hover/focus states, loading/empty handling, and contained scrolling. Feature modules retain ownership of columns, cell editors, totals, validation, and business actions.

Phase 13 Journal Voucher is the Phase 14 interaction-quality reference for dense list/editor layout, line-entry tables, feedback, focus states, totals, and overflow containment. Its Journal-specific logic is not a generic design-system dependency.

## Feedback Contract

Shared feedback semantics include:

- loading;
- empty;
- informational;
- warning;
- validation error;
- technical error/detail;
- success;
- confirmation/destructive confirmation;
- disabled/read-only explanation where ambiguity would otherwise remain.

User-facing explanations are Persian and actionable. Technical diagnostics may be exposed consistently when useful for support/debugging, but do not replace the user-facing explanation.

## Reuse Rule

A component becomes shared when its interaction/visual semantics are generic across multiple modules. Domain-defined behavior stays feature-local.

Examples:

- shared `Badge`; feature-owned mapping from Journal status to badge tone;
- shared table shell; feature-owned Journal line columns;
- shared Alert; feature-owned Coding Template conflict resolution content;
- shared FilterToolbar; feature-owned Chart of Accounts filter semantics.

## Phase 14 Migration Baseline

The Foundation-era `TemporaryAppShell` and `temporary-*` presentation classes are explicit replacement targets. Their route separation and feature boundaries are preserved, while their visual/layout responsibilities migrate to the final shared shell and design system.

`App.css` is not the long-term design-system owner. During Phase 14 it should progressively converge toward global reset/root/application-level styling while reusable tokens/primitives move to their defined ownership locations.

## Phase Boundaries

Phase 14 consolidates presentation only. Journal approval, posting, locking, reversal, replacement, voiding, finalization, and controlled amendment belong to Phase 15 — Journal Lifecycle.

Later feature phases must consume this design system as part of their own UI delivery rather than creating a third independent presentation generation.
