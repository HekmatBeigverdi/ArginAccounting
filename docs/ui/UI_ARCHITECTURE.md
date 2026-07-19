# ArginAccounting UI Architecture

## Purpose

This document defines the long-term desktop user interface architecture
for ArginAccounting.

It does not define the final visual design. The final design system,
dashboard widgets, themes, and polished application shell will be
implemented in the dedicated Persian UI phase.

The purpose of this document is to ensure that feature pages developed
before that phase remain modular and can be integrated into the final
application shell without being rewritten.

## Product Direction

ArginAccounting uses Tadbir and other Iranian accounting applications as
references for accounting workflows and functional coverage.

The user interface must not imitate legacy Iranian accounting software.

The final user experience should follow modern professional accounting,
ERP, and financial management application patterns.

## Core Principles

- Persian-first user interface
- Full right-to-left support
- Desktop-first interaction model
- Independent route-based pages
- Modular feature boundaries
- High information density where appropriate
- Keyboard-friendly workflows
- Consistent validation and feedback
- Accessible forms and data tables
- Light and dark appearance support
- No feature forms directly accumulated inside App.tsx

## Application Structure

The desktop application will use the following logical structure:

- Application Root
- Application Router
- Application Shell
- Dashboard
- Module Navigation
- Page Workspace
- Global Context Selectors
- Status Bar
- Feature Pages

## Application Shell

The final application shell will include:

- Collapsible sidebar
- Top navigation bar
- Company selector
- Branch selector
- Fiscal year selector
- Global search
- Notifications
- User menu
- Breadcrumbs
- Page actions
- Workspace content
- Status bar

## Dashboard

The dashboard will be role-aware and module-aware.

Potential dashboard widgets include:

- Sales summary
- Purchase summary
- Cash and bank balances
- Accounts receivable
- Accounts payable
- Due cheques
- Inventory alerts
- Draft journal vouchers
- Taxpayer system transmission status
- Recent user activity
- Quick actions

Dashboard widgets may initially use placeholders until their source
modules are implemented.

## Routing

Every major feature must have its own route.

Example route structure:

- `/dashboard`
- `/company`
- `/company/setup`
- `/company/branches`
- `/fiscal/years`
- `/fiscal/years/new`
- `/fiscal/periods`
- `/fiscal/locks`
- `/fiscal/number-series`
- `/security/users`
- `/security/roles`
- `/security/permissions`
- `/system/diagnostics`

## Page Structure

Each page should be implemented independently from the final shell.

A page may contain:

- Page header
- Breadcrumb metadata
- Primary actions
- Search and filters
- Main content
- Empty state
- Loading state
- Error state

Feature pages must not directly implement the global sidebar, top bar,
company selector, branch selector, or fiscal year selector.

## Feature Structure

Feature-specific reusable components remain inside `features`.

Route-level page composition remains inside `pages`.

Application-wide infrastructure remains inside `app`.

Shared visual primitives remain inside `components`.

Expected structure:

```text
apps/desktop/src/
├── app/
│   ├── router/
│   ├── shell/
│   ├── navigation/
│   └── providers/
├── pages/
│   ├── dashboard/
│   ├── company/
│   ├── fiscal/
│   ├── security/
│   └── system/
├── features/
│   ├── company/
│   ├── fiscal/
│   └── security/
├── components/
│   ├── layout/
│   ├── feedback/
│   ├── forms/
│   └── data-display/
└── styles/

Feature and Page Responsibility

A feature component contains reusable business-oriented UI.

Examples:

CompanySetupForm
FiscalYearForm
UserEditor
RolePermissionMatrix

A page composes one or more features for a route.

Examples:

CompanySetupPage
FiscalYearsPage
NewFiscalYearPage
UsersPage
Temporary Navigation

Before the final Persian UI phase, the application may use a minimal
temporary navigation shell.

The temporary shell must:

Provide access to independent pages
Avoid final visual-design decisions
Avoid duplicating feature logic
Be replaceable without rewriting pages
Preserve route URLs
Final UI Phase

The dedicated Persian UI phase will implement:

Final application shell
Modern dashboard
Production sidebar
Global command palette
Final typography
Design tokens
Light and dark themes
Responsive desktop layouts
Professional data tables
Standard dialogs and drawers
Keyboard shortcuts
User-specific display preferences

The final UI phase should replace temporary presentation components,
not business features or page-level functionality.

Route Stability

Once a route is introduced, it should not be changed without a clear
migration reason.

Stable routes allow:

Menu integration
Permission mapping
Audit references
Deep linking
Future web compatibility
Automated UI testing
Security Integration

Routes and navigation entries will later declare required permissions.

Example conceptual metadata:

{
  path: "/security/users",
  requiredPermission: "security.users.view"
}

Navigation visibility is not sufficient security enforcement.

Permission checks must also exist in application services and future API
endpoints.

Design System Direction

The final interface should be modern and internationally competitive.

The intended direction includes:

Clean surfaces
Clear visual hierarchy
Professional density
Compact accounting tables
Modern forms
Subtle motion
Minimal decoration
Strong numeric readability
Consistent status semantics
Accessible contrast

Tadbir is a workflow reference, not a visual-design reference.

Non-Goals of the Current Refactor

This architecture preparation does not include:

Final dashboard design
Final sidebar appearance
Final themes
Final data-grid implementation
Final responsive behavior
Final command palette
Final icon system

Those items remain part of the established roadmap.
