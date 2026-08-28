# ArginAccounting Release Checklist

Use this checklist before merging a phase branch into `develop`, promoting the integrated state to `main`, creating a semantic tag, or publishing a GitHub Release.

## 1. Scope and Repository State

- [ ] Confirm the intended `phase/*` branch and latest remote head.
- [ ] Confirm all accepted user/reviewer corrections are present.
- [ ] Compare the complete phase diff against `develop`.
- [ ] Remove temporary experiments, debug logging, generated databases, build outputs, and local environment files.
- [ ] Confirm the phase Step Status and Evidence match reality.

## 2. Dependencies

- [ ] Run the repository-declared pnpm version.
- [ ] Confirm `pnpm-lock.yaml` matches workspace manifests.
- [ ] Confirm each new dependency has a documented purpose.

```bash
corepack enable
pnpm install --frozen-lockfile
```

## 3. Focused Validation

Run phase-specific validation first. For Phase 16:

```bash
pnpm validate:phase16
```

This covers focused Accounting, Accounting-Tauri, representative SQLite report query-plan validation, Desktop typecheck/test/build, and monorepo typecheck/test/build.

Validation evidence must identify who executed local commands. Connector-side documentation must not claim local execution it did not perform.

## 4. Repository Validation

At minimum:

```bash
pnpm typecheck
pnpm test
pnpm build
cd apps/desktop/src-tauri
cargo check
cd ../../..
```

Run `pnpm lint` and documentation-index/link validation when configured for the release gate.

## 5. Database and Migrations

- [ ] All new schema changes use ordered migrations.
- [ ] Released migrations remain immutable.
- [ ] Migration registration/order is correct.
- [ ] New indexes/constraints have tests or measured query-path justification.
- [ ] `PRAGMA foreign_key_check` and `PRAGMA integrity_check` are clean where a real migration database is exercised.

Phase 16 migration:

```text
0015_accounting_report_indexes.sql
```

Phase 16 query-plan evidence must cover:

```text
ix_journal_vouchers_reporting_scope
ix_journal_line_dimensions_reporting
```

## 6. Security and Scope

- [ ] New permissions are present in the canonical permission catalog.
- [ ] Application services enforce permissions independently of UI visibility.
- [ ] Company/Branch scope is enforced for protected reads/writes.
- [ ] Errors do not leak cross-scope identifiers.
- [ ] Export/download actions have their own required authorization when applicable.
- [ ] No production password, token, secret, or private environment value is committed.

For Phase 16 verify:

```text
accounting.reports.trial-balance.view
accounting.reports.general-ledger.view
accounting.reports.subsidiary-ledger.view
accounting.reports.journal.view
accounting.reports.dimensions.view
accounting.reports.export
```

## 7. Financial Semantics

- [ ] Canonical financial calculations remain outside React/Tauri/SQL presentation adapters.
- [ ] Posted facts are immutable and reportable according to lifecycle semantics.
- [ ] Reversal preserves original + inverse traceability.
- [ ] Date/Fiscal/Company/Branch/currency scope is deterministic.
- [ ] Hierarchy aggregation does not double count.
- [ ] Export and print reuse canonical result DTOs.

## 8. Desktop Validation

For user-facing phases verify applicable surfaces:

- [ ] Persian RTL presentation.
- [ ] Solar Hijri input/presentation with Gregorian durable dates.
- [ ] Loading, empty, error, focus, density, and contained overflow behavior.
- [ ] Permission-aware navigation/actions.
- [ ] Drill-down/source traceability.
- [ ] Print/Preview/Excel/PDF behavior when delivered.

Phase 16 functional acceptance includes Excel download, full-screen Preview, native Print/Save-as-PDF, and correct landscape output.

## 9. Documentation

Before merge verify:

- [ ] `README.md`
- [ ] `ROADMAP.md`
- [ ] `ARCHITECTURE.md`
- [ ] `CHANGELOG.md`
- [ ] `docs/phases/phase-NN-<slug>.md`
- [ ] fixed implementation plan and validation evidence
- [ ] relevant ADRs
- [ ] relevant security/database/accounting canonical documents
- [ ] domain glossary
- [ ] internal links and next-phase references

## 10. Merge

Only after implementation, documentation, and actual validation evidence are complete:

1. Merge/promote the phase state into `develop` without rewriting history.
2. Verify `develop` contains the intended phase head.
3. Promote the validated integrated state to `main` according to repository policy.
4. Verify `main` points to the intended release state.

Do not force-push shared branches.

## 11. Semantic Tag and GitHub Release

Create the semantic tag from the verified release commit on `main` and publish a GitHub Release using the matching `CHANGELOG.md` section.

For Phase 16 the prepared version is:

```text
v0.16.0
```

## 12. Post-Release

- [ ] Verify the tag points to the intended `main` commit.
- [ ] Verify Release title/notes and artifacts.
- [ ] Confirm `develop` contains the released state.
- [ ] Mark the completed phase and next target in `ROADMAP.md`.
- [ ] Start the next `phase/*` branch from the appropriate current integration baseline.
