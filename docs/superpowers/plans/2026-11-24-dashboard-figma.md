# Figma Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the desktop dashboard to closely match Figma frame `25:31`, including representative financial statistics until live dashboard aggregates are available.

**Architecture:** Keep the existing React page, data permissions, route system, and shared UI primitives. Rebuild the dashboard body and complete the app shell to match the Figma frame. Keep illustrative statistics in a clearly named local presentation model so they can be replaced with real aggregates later; keep recent journal rows sourced from `journals.list`, falling back across fiscal years when the selected year has no rows.

**Tech Stack:** React 19, TypeScript, React Router, project UI components and CSS custom properties, Vite/Tauri.

**Spec:** `docs/superpowers/specs/2026-11-24-dashboard-figma-design.md`

## Global Constraints

- Implement in the existing `feature/figma-ui-redesign` branch.
- Update `apps/desktop/src/app/shell/app-shell.tsx` and `app-shell.css` to match the Figma shell; leave the user's already changed login, router, app, and Tauri files untouched.
- Preserve Persian RTL, responsive behavior, existing permissions, and current shared component conventions.
- Do not add dependencies or dashboard backend contracts.
- Use the Figma-provided icon assets locally; do not leave temporary Figma asset URLs in source.
- Recent journals remain live data; financial KPI and trend values are illustrative until a real aggregate source is connected.
- Per task instructions, do not add or run tests; keep the change reviewable through the implementation diff.

## Review Focus

- Confirm the complete shell and dashboard match the 1366 × 768 Figma frame without duplicating the top bar or overflowing.
- Persian text and LTR voucher numbers/amounts need correct direction and alignment.
- KPI and chart sample values must remain visibly isolated as presentation data for future replacement.
- Journal loading, query failure, empty fiscal-year, and no-journal states remain clear and permission gated.
- Small-window layout must not force the four KPI cards or recent activity table beyond the workspace width.

---

### Task 1: Rebuild the dashboard body to match the Figma frame

**Files:**
- Modify: `apps/desktop/src/pages/dashboard/dashboard-page.tsx`
- Modify: `apps/desktop/src/pages/dashboard/dashboard-page.css`
- Create: `apps/desktop/src/pages/dashboard/assets/icon-wallet.svg` (download from Figma asset `150b8e62-e773-4d2a-884c-5f01dbb9e475`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-up.svg` (download from Figma asset `6cb76ed5-c32a-40db-b9bd-24874d41f00b`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-filter.svg` (download from Figma asset `fc066041-af70-42e7-bd7e-b2dca237e17a`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-layers.svg` (download from Figma asset `e718e818-1aff-4a8d-8a2b-a19f7659f321`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-doc.svg` (download from Figma asset `2d61df1b-de03-45d6-892a-8aa56ab374b8`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-cart.svg` (download from Figma asset `0311bf29-e97e-40cc-9c3e-2a0f413ab135`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-inventory.svg` (download from Figma asset `a8491cd5-4185-4e76-b4e9-de188ea0de32`)
- Create: `apps/desktop/src/pages/dashboard/assets/icon-chart.svg` (download from Figma asset `d155e132-bcca-4009-bb00-2be0448eae1e`)

**Interfaces:**
- Consume: `useActiveContext()`, `useAuthSession()`, `useAccountingServices().journals`, `formatJournalRials`, `Page`, `Panel`, `Card`, `Badge`, and existing application paths.
- Produce: A Figma-aligned dashboard view inside the existing shell. Keep a local typed presentation data structure for the four KPI cards and seven monthly sales/purchase chart points. KPI display values, in Figma order: sales `۱٬۴۸۰٬۰۰۰٬۰۰۰`, receipts `۳۸۰٬۰۰۰٬۰۰۰`, due payments `۲۱۰٬۰۰۰٬۰۰۰`, inventory value `۹۲۰٬۰۰۰٬۰۰۰`; preserve each Figma subtitle. Use the Figma seven bar-pair proportions and Persian month labels. Actions: journal voucher, sales invoice, purchase invoice, general ledger report. Recent table shows actual fetched vouchers, with Figma columns for number, description, amount, and status adapted to available DTO fields.

- [x] **Step 1: Download the eight named Figma SVG assets** to the paths above, preserving their source dimensions and contents.
- [x] **Step 2: Replace the current hero/context/shortcut stacking in `dashboard-page.tsx` with the Figma content hierarchy:** title/subtitle and new-document action; four KPI cards; trend chart panel and quick-actions panel; recent-journal activity panel. Keep the current journal query, permission check, and loading/error/empty messages. Keep action links on existing routes and only render destinations backed by current routes/permissions.
- [x] **Step 3: Add the typed local KPI and chart presentation data in `dashboard-page.tsx`.** Make the illustrative source easy to replace with live aggregates. Render the chart from its data array using CSS bars, accessible labels, and the Figma sales/purchase color palette; do not use image or canvas snapshots.
- [x] **Step 4: Restyle `dashboard-page.css`** with Figma colors, spacing, radii, card proportions, and layout, expressed through current `--ui-*` tokens where available and scoped dashboard values for Figma-specific shades. Adapt the Figma's 1046px content span to available workspace width; add responsive tablet/mobile arrangements, table containment, keyboard focus, and status/error surfaces.
- [x] **Step 5: Complete the shell in `app-shell.tsx` and `app-shell.css`:** logo/wave brand block; utility search, notifications and profile controls; density selector; active context selectors; right sidebar with icon-led links and Figma spacing. Keep navigation permissions and routes intact.
- [x] **Step 6: Fix recent-journal fallback:** query the selected fiscal year and active branch first. When it has no rows, query the same company and branch without a fiscal-year filter so previous-year documents remain visible. Keep both queries permission gated and retain loading/error/empty states.
- [x] **Step 7: Review the diff** to confirm unrelated user files remain untouched, temporary asset URLs are absent, fallback code is in place, and Figma assets are local and non-empty.
