# Figma UI Design Roadmap

## Purpose and Scope

This is the UI design track for ArginAccounting. Its UI-01 through UI-12 labels are independent design-step identifiers and do not change the software phase numbering in `ROADMAP.md`.

The track guides Figma design and implementation handoff for the existing React + TypeScript + Tauri product. Existing UI architecture and Phase 14 standards remain authoritative for behavior, implementation boundaries, Persian RTL, accessibility, density, and responsive containment.

## Roadmap

| Step | Design scope | Expected output | Status |
|---|---|---|---|
| **UI-01 — Foundations and shell** | Transfer the actual tokens from `design-tokens.css` into Figma Variables and Styles; finalize the application shell, grouped navigation, breadcrumbs, company/branch/fiscal-year selection, and display density. | Foundations page, component library, and shell matching the application. | **Completed** |
| **UI-02 — Dashboard and shared pages** | Real dashboard, sign-in, system status, companies and branches, fiscal years, users, roles and permissions, audit, and approval workflow. | Frames for the main workflows and access states. | **Ready for review** |
| **UI-03 — Accounting** | Chart of Accounts tree, accounting dimensions, coding templates, journal list and editor, approval/finalization lifecycle, and Reports Center. | Dense accounting UI with tables, details, and traceability back to source journals. | Planned |
| **UI-04 — Master data** | Parties, products and services, warehouses, and selectors reused by purchasing, sales, and documents. | List, detail, and form screens plus selector components. | Planned |
| **UI-05 — Inventory and valuation** | Receipts and issues, transfers, Kardex and stock reports, FIFO/MWA policy, tracing, and valuation rebuild. | Document and report flows that show quantity and value lineage. | Planned |
| **UI-06 — Purchases and accounting posting** | Purchase documents and commercial lines, invoice-to-receipt matching, returns and corrections, reports, posting status and trace. | Complete purchase flow from entry through accounting journal and error recovery. | Planned |
| **UI-07 — Sales and accounting posting** | Complete the current Figma frame against the actual Sales page: list and detail, form, finalization, below-cost handling, return and correction, inventory fulfillment, trace, and posting recovery. | Full Sales lifecycle design, not only an invoice table. | Planned |
| **UI-08 — Treasury, software phases 26–30** | Cash and banks, receipts and payments, cheques and receivables, settlement and reconciliation, posting rules, and source-document integrity. | Treasury pages and discrepancy/reconciliation flows. | Planned |
| **UI-09 — Iranian Taxpayer System, software phases 31–35** | Tax settings, product/service mapping, preview and validation, signing, submission, inquiry, retry, and error history. | Traceable flow from Sales invoice to the Taxpayer System response. | Planned |
| **UI-10 — Enterprise modules, software phases 36–43** | Fixed assets and depreciation; payroll and HR; manufacturing and cost accounting; budgeting; contracts and projects. | Each module designed according to its data dependencies and accounting-posting ownership. | Planned |
| **UI-11 — Product completion, software phases 44–47** | Advanced reporting, synchronization, backup and restore, deployment status, and system health. | Monitoring and operations pages, including offline and connection-error states. | Planned |
| **UI-12 — Final UI acceptance** | Accessibility, RTL/LTR, numbers and dates, density modes, and window behavior. | Implementation-ready specifications with Figma frames mapped to code routes and components. | Planned |

## Cross-Cutting Acceptance Requirements

Every step must design the states relevant to its screens:

- Loading and empty
- Validation error and technical error
- Success
- No permission and read-only
- Offline and recovery

Cover all three project density modes and desktop sizing, especially **1366 × 768**. Preserve Persian RTL, isolate LTR values where appropriate, use Jalali dates in the UI, and keep financial figures and document states unambiguous.

## Figma File Organization

Organize the Figma file into these pages:

1. Foundations and Components
2. Shell and Dashboard
3. Dashboard and Administration (UI-02 supporting workflows)
4. Accounting
5. Master Data and Inventory
6. Purchases and Sales
7. Treasury
8. Tax
9. Enterprise Operations

## UI-01 Acceptance Checklist

- Read token values and names from the repository's actual `design-tokens.css`; do not invent or substitute design tokens.
- Create or reconcile Figma Variables and Styles against those values, including the actual product typeface and density tokens.
- Reconcile the Figma shell with the running application's real shell, grouped navigation, breadcrumb behavior, active company/branch/fiscal-year context, and density selector.
- Build the foundations page and reusable component library from the project's existing design system.
- Include RTL/LTR examples and the relevant feedback, permission, read-only, offline, and recovery states.
- Validate the primary desktop shell at 1366 × 768 and verify that the output remains editable and component-based.

## UI-01 Delivery Record

- Figma file: [ArginAccounting — UI Design System](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8)
- [Foundations and Components page](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=8-33)
- [Shell and Dashboard page](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=6-32)
- [Shared shell states](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=11-112)
- The foundations page contains color, spacing, radius, typography, layout, and three-mode density Variables; color, text, and elevation Styles; and editable shell components.
- The shell page contains comfortable, compact, and spacious app-shell frames, each at 1366 × 768, plus editable samples for loading, empty, validation/technical errors, success, no permission, read-only, and offline/recovery.
- The shell uses the actual RTL navigation/context-selector structure and values from the project CSS tokens. Screenshot inspection confirmed the three desktop frames and state specimens render at their specified sizes.
- **Review state:** Approved by the project owner on 2026-11-22; UI-01 is complete.

## UI-02 Delivery Record

- [Dashboard and Administration page](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-31)
- [Sign-in screen](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-14)
- [System status](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-129)
- [Companies and branches](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-221)
- [Fiscal years](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-298)
- [Users](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-376)
- [Roles and permissions](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-464)
- [Audit report](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-544)
- [Approval workflow](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=25-634)
- [UI-02 authentication and administration states](https://www.figma.com/design/4Y0RnCKwv87exbbqimoja8?node-id=29-13)
- The nine editable desktop frames cover sign-in, dashboard, system health, company/branch management, fiscal years, users, role-permission matrix, audit, and approval detail/timeline. Frames are designed at 1366 × 768 using the approved RTL shell, density selector, active company/branch/fiscal-year context, and local status surface where applicable.
- Eight shared examples cover loading, empty lists, invalid sign-in, insufficient permissions, read-only fiscal year, technical system error, audit with no results, and successful approval submission.
- Visual review checked the dashboard, sign-in, system status, company/branch, roles/permissions, approval, and shared-state frames. The dashboard now follows the visual direction of the approved [Desktop UI Exploration](https://www.figma.com/design/GWMTmgehOGAk4OSqcloENC/ArginAccounting-%E2%80%94-Desktop-UI-Exploration?node-id=13-2): softer rounded surfaces, icon-led KPIs, an activity chart, a quick-action panel, and a clean recent-documents table. The administration screens now share matching line icons, active navigation, context selectors, and the company status card. Button/title overlap was corrected; all frames remain editable and within their 1366 × 768 bounds.
- **Review state:** Ready for project-owner review. Record acceptance here after reviewing the Figma output.

## Branch and Delivery

- Design and implementation branch: `feature/figma-ui-redesign`.
- Base: `main` at `90e59134f326f6a8357578e7fc66afea0a108592` when the branch was created.
- Do not change software phase numbering.
- Keep work isolated on this branch. Do not merge, release, or deploy as part of the design steps.
- Mark a UI step complete only after its Figma output and acceptance evidence are reviewed.

## References

- [UI Architecture](UI_ARCHITECTURE.md)
- [Phase 14 — UI Foundation Consolidation](../phases/phase-14-ui-foundation-consolidation.md)
- [Phase 14 UI Architecture Audit](phase-14-ui-architecture-audit.md)
- [Product Vision](../vision/product-vision.md)
