# Phase 15 — Step 17 Monorepo Validation and Documentation Completion

## Status

In progress.

Step 16 local regression validation is confirmed green after commit `cf8e91b6c3956b9863d0204a4905edf1e12a2365` corrected Node ESM source resolution in `@argin/security`.

## Retained regression rule

The Desktop test suite executes workspace TypeScript source directly through the Node test runner. Relative ESM imports/exports in packages exercised this way must use the repository's explicit `.ts` extension convention. A bundler resolving extensionless imports is not evidence that direct Node TypeScript execution will resolve them.

## Validation baseline

Phase branch: `phase/15-journal-lifecycle`

Step 17 starts from the Step 16 validated branch state plus the Security ESM correction.

Root monorepo scripts are authoritative:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused lifecycle validation should be run before or alongside the full monorepo commands:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/security typecheck
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
```

No validation command is recorded as green in this document until it has actually been executed locally or by CI against the current Step 17 HEAD.

## Documentation completion checklist

Step 17 will reconcile the implemented Phase 15 behavior with the canonical repository documentation and indexes:

- `ARCHITECTURE.md` — Journal lifecycle ownership, Approval separation, immutable posting/reversal and adapter boundaries.
- `SECURITY.md` and/or `docs/security/security-model.md` — granular lifecycle permissions and self-approval segregation rule.
- database documentation — migration `0014`, authoritative `lifecycle_status`, lifecycle evidence tables, concurrency/idempotency constraints.
- `docs/glossary.md` — lifecycle terminology where missing.
- `ROADMAP.md` — Phase 15 completion readiness and Phase 16 Accounting Reports as the next target, without prematurely marking Phase 15 released.
- `CHANGELOG.md` — Phase 15 unreleased implementation summary before release closure.
- `docs/index.md`, `docs/README.md`, and `docs/phases/README.md` — Phase 15 ADR/plan/test-matrix/validation links and current step.
- Phase 15 fixed plan and implementation record — validation evidence and any approved deferrals.

## Documentation integrity checks

Before Step 17 can complete:

1. Phase numbering must remain consistent with `ROADMAP.md`.
2. Phase 15 must not be described as merged/released before Step 18.
3. Phase 16 must be identified as the next phase after Phase 15 release.
4. All Phase 15 internal links must resolve.
5. Validation claims must distinguish user-confirmed local execution from implementation-only evidence.
6. The Step 10 SQLite test lessons and Step 16 Node ESM import lesson must remain documented for future phases.

## Exit condition

Step 17 is complete only after focused and full monorepo validation is green on the current HEAD and the canonical documentation/index/link/diff checks are complete with recorded evidence.
