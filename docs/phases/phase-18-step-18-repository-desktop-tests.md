# Phase 18 Step 18 — Repository, Migration, Import/Export, and Desktop Tests

## Status

Completed.

## Scope

Step 18 validates persistence and user-facing integration paths without expanding Product/Service business scope.

## Added coverage

### Real SQLite migration/schema coverage

`apps/desktop/tests/product-migrations-integration.test.ts` uses Node `DatabaseSync` with `:memory:` and applies the real desktop migrations required by Product (`0002`, `0018`, `0019`, `0020`, `0021`). It covers:

- migration registration for versions 18–21;
- Product schema upgrade and master-data persistence;
- official Taxpayer unit foreign-key mapping;
- company-scoped strong identifier uniqueness;
- same identifier reuse across different companies;
- same-company child foreign-key enforcement;
- rejection of unknown Taxpayer unit codes;
- tombstone metadata persistence;
- idempotency status/result constraints;
- rollback of a multi-table Product write when a child constraint fails.

### Adapter regression coverage

`packages/product-tauri/tests/product-persistence-regression.test.ts` covers:

- failed idempotent operations remove the in-progress claim so a retry can proceed;
- an existing in-progress request maps to the stable Product concurrency error;
- selector SQL excludes tombstones before limiting results;
- Taxpayer selector requirements are pushed into SQL rather than post-filtered;
- selector lookup remains company-scoped and searches code/title/SKU/Taxpayer identifiers;
- selector limits remain query parameters rather than unbounded loads.

Existing `product-sqlite-adapters.test.ts` continues to cover transaction-backed Unit of Work, stale optimistic updates, deterministic SQLite UNIQUE error mapping, and completed idempotency replay.

### Import/export coverage

Existing Step 13 suites remain authoritative and are part of Step 18 validation:

- `packages/product/tests/product-bulk-transfer.test.ts` — preview, duplicate diagnostics, atomic no-write behavior, Unit of Work, permissions/audit and bounded export;
- `packages/product-tauri/tests/product-tabular-codec.test.ts` — CSV/XLSX round trip and tabular limits.

### Desktop integration contract

`apps/desktop/tests/product-workspace-ui-contract.test.ts` locks the Product desktop integration for:

- route and permission-aware navigation;
- bounded list page size;
- loading/empty/error state presence;
- field-level `aria-invalid` error presentation;
- click-controlled, viewport-aware help behavior;
- Taxpayer unit reference-data selection;
- no direct Product SQL embedded in the React workspace.

Full accessibility/performance/monorepo validation remains Step 19 by frozen scope.

## Validation commands

```bash
pnpm --filter @argin/product test
pnpm --filter @argin/product-tauri test
pnpm --filter @argin/desktop test
pnpm --filter @argin/product typecheck
pnpm --filter @argin/product-tauri typecheck
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/product build
pnpm --filter @argin/product-tauri build
pnpm --filter @argin/desktop build
```

The connected assistant environment does not provide a trustworthy local pnpm workspace execution context, so repository test success is not claimed without local/CI execution. Step 18 completion here records implemented automated coverage and the exact validation surface; Step 19 owns full monorepo execution and quality gates.

## Exit criteria

Persistence, migration, import/export, selector, and Desktop integration paths now have focused automated regression coverage within Phase 18 scope. No Warehouse, Inventory transaction, Purchase/Sales document, Pricing, Posting, Taxpayer submission, or synchronization workflow was introduced.
