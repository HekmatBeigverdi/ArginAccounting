# Phase 17 Step 18 — Monorepo, Performance, Accessibility, and Quality Validation

## Status

Validation framework complete. Repository-owner execution of the unified command is required before Step 18 is considered green.

## Representative Party Dataset and Query Plans

`packages/party-tauri/scripts/validate-party-performance.ts` creates a temporary SQLite database with 50,000 Party rows, of which 40,000 belong to the target company. It adds representative customer/supplier roles and uses the production index shapes from the Party migrations.

The validator requires SQLite query plans to use:

- `ix_parties_company_status_name` for bounded company/status list and selector paths;
- `ix_party_roles_company_role_party` for role-filtered selector eligibility;
- `uq_parties_company_national_code` for official-identity duplicate lookup.

It also verifies the scoped active count (36,000 rows) and reports wall-clock time only as diagnostic evidence. No machine-specific latency threshold is used.

## Bounded/N+1 Quality Guards

Existing repository tests plus Step 17/18 coverage verify that Party list/search remains SQL-paged, selectors remain capped, exports stream by bounded pages, duplicate advisory queries are capped, and the desktop page does not introduce an unbounded `findAll()` path.

## Accessibility, RTL, Keyboard, and Density

`apps/desktop/tests/party-step18-quality-contract.test.ts` protects the accepted desktop behavior:

- deferred search and 40-row paging;
- searchable/filterable regions with busy/status semantics;
- keyboard-selectable Party rows;
- modal dialog semantics;
- accessible combobox/listbox/option selector semantics;
- ArrowUp/ArrowDown/Enter/Escape selector behavior;
- Persian/Solar-Hijri presentation with explicit LTR islands for identifiers;
- RTL layout contract;
- Phase 14 density variables and responsive breakpoints;
- CSV/XLSX import preview and atomic-mode controls.

## Unified Validation Command

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm validate:phase17
```

`validate:phase17` executes:

```bash
pnpm --filter @argin/party typecheck
pnpm --filter @argin/party test
pnpm --filter @argin/party-tauri typecheck
pnpm --filter @argin/party-tauri test
pnpm --filter @argin/party-tauri validate:performance
pnpm --filter @argin/security typecheck
pnpm --filter @argin/security test
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
pnpm --filter @argin/desktop build
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

The performance validator requires the `sqlite3` CLI. It introduces no runtime package dependency.

## Validation Evidence

- Step 17 repository/migration/import/Desktop validation: confirmed green by the repository owner before Step 18 started.
- Step 18 focused quality tests: pending unified local execution.
- Step 18 representative SQLite query-plan validator: pending unified local execution.
- Step 18 full monorepo typecheck/test/build/lint: pending unified local execution.

After the unified command is green, update the frozen Phase 17 plan so Steps 1–18 are `Completed` and record the execution result before starting Step 19.
