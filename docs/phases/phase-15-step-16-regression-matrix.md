# Phase 15 — Step 16 Regression Matrix

Step 16 covers persistence, migration, permission, and desktop regression boundaries. Domain/Application exhaustive behavior remains Step 15; full monorepo validation remains Step 17.

| Requirement | Coverage |
| --- | --- |
| Phase 13 -> Phase 15 deterministic upgrade | `apps/desktop/tests/journal-lifecycle-migration.test.ts` |
| Existing Draft rows remain Draft without data loss | `journal-lifecycle-migration.test.ts` |
| Lifecycle state CHECK constraint | `journal-lifecycle-migration.test.ts` |
| One current Approval cycle per voucher | `journal-lifecycle-constraints.test.ts` |
| One Posting evidence record per voucher | `journal-lifecycle-constraints.test.ts` |
| Amendment version integrity | `journal-lifecycle-constraints.test.ts` |
| Reversal original/reversal/request uniqueness | `journal-lifecycle-constraints.test.ts` |
| Invalid self-lineage rejection | `journal-lifecycle-constraints.test.ts` |
| Atomic Posting persistence | `packages/accounting-tauri/tests/sqlite-journal-voucher-lifecycle.test.ts` |
| Atomic Amendment persistence | `sqlite-journal-voucher-lifecycle.test.ts` |
| Atomic Reversal + lineage persistence | `sqlite-journal-voucher-lifecycle.test.ts` |
| Approval gateway bound to exact transaction session | `sqlite-journal-voucher-lifecycle.test.ts` |
| Expected-version stale lifecycle update rejected | `sqlite-journal-voucher-lifecycle-concurrency.test.ts` |
| Granular lifecycle permissions present in Security registry | `apps/desktop/tests/journal-lifecycle-desktop-regression.test.ts` |
| UI cannot expose Post without Post permission | `journal-lifecycle-desktop-regression.test.ts` |
| Post/Reversal desktop paths use canonical Application handlers/UoWs | `journal-lifecycle-desktop-regression.test.ts` |
| React lifecycle view contains no direct Journal mutation SQL | `journal-lifecycle-desktop-regression.test.ts` |
| High-impact confirmation remains present | `journal-lifecycle-desktop-regression.test.ts` |
| Business failures remain separate from technical diagnostics | `journal-lifecycle-desktop-regression.test.ts` |
| Reversal request replay and duplicate reversal semantics | Step 15 Application tests plus SQLite uniqueness coverage above |
| Node ESM can directly load Security source used by Desktop regression tests | Relative Security imports/exports use explicit `.ts` extensions and Security enables `allowImportingTsExtensions` |

## Regression lesson retained from local validation

The first local `@argin/desktop` run exposed a Node ESM resolution failure in `@argin/security`: the Desktop regression test imports the Security package source directly, but Security still used extensionless relative ESM imports. Commit `cf8e91b6c3956b9863d0204a4905edf1e12a2365` corrected the package by adding explicit `.ts` extensions to relative imports/exports and enabling `allowImportingTsExtensions` in `packages/security/tsconfig.json`.

Retained rule for future phases: if a workspace package's TypeScript source is executed directly by the Node test runner, relative ESM imports/exports must follow the repository's explicit `.ts` extension convention; do not assume the bundler will resolve extensionless source imports during Node tests.

## Local validation for Step 16

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
```

The user confirmed the Step 16 local validation is green after the Security ESM import correction was pushed.
