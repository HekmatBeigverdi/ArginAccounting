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

Run the current phase-specific validation first. For Phase 17:

```bash
pnpm validate:phase17
```

This covers Party Domain/Application, Party-Tauri, representative SQLite query-plan/performance validation, Security/Audit boundaries, Desktop typecheck/test/build, and full monorepo typecheck/test/build/lint.

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

Phase 17 migrations:

```text
0016_parties.sql
0017_party_sync_metadata.sql
```

Phase 17 query-plan evidence covers bounded Party list/selector/duplicate paths and requires the expected production index shapes, including company/status/name, role lookup, and official-identity uniqueness.

## 6. Security and Scope

- [ ] New permissions are present in the canonical permission catalog.
- [ ] Application services enforce permissions independently of UI visibility.
- [ ] Company/Branch scope is enforced for protected reads/writes.
- [ ] Errors do not leak cross-scope identifiers.
- [ ] Export/download actions have their own required authorization when applicable.
- [ ] No production password, token, secret, or private environment value is committed.

For Phase 17 verify:

```text
master-data.parties.view
master-data.parties.create
master-data.parties.update
master-data.parties.change-status
master-data.parties.manage-roles
master-data.parties.import
master-data.parties.export
```

## 7. Bounded-Context Semantics

- [ ] Domain/Application rules remain outside React/Tauri/SQL presentation adapters.
- [ ] Durable Party ID remains distinct from display Party code.
- [ ] Customer and Supplier remain Party roles rather than duplicated master entities.
- [ ] Party does not acquire balances, posting, Journal, Sales/Purchase, Treasury, or Inventory business ownership.
- [ ] Future synchronization contracts do not implement network/sync business rules in Party Domain or React.
- [ ] Import/export reuse canonical Domain/Application validation rather than spreadsheet-owned business rules.

## 8. Desktop Validation

For user-facing phases verify applicable surfaces:

- [ ] Persian RTL presentation.
- [ ] Solar Hijri input/presentation with Gregorian durable dates.
- [ ] Loading, empty, error, focus, density, and contained overflow behavior.
- [ ] Permission-aware navigation/actions.
- [ ] Keyboard/accessibility behavior.
- [ ] Bounded list/selector/search behavior.
- [ ] Import/export behavior when delivered.

Phase 17 functional acceptance includes Party create/edit/status/role behavior, localized validation feedback, CSV/XLSX import preview/atomic mode, and reusable Party selector behavior.

## 9. Documentation

Before merge verify:

- [ ] `README.md` where affected
- [ ] `ROADMAP.md`
- [ ] `ARCHITECTURE.md` where affected
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

Create the semantic tag from the verified release commit on `main` and publish a GitHub Release using the matching `CHANGELOG.md` / release-notes section.

For Phase 17 the prepared version is:

```text
v0.17.0
```

Prepared notes:

```text
docs/phases/phase-17-release-notes.md
```

## 12. Post-Release

- [ ] Verify the tag points to the intended `main` commit.
- [ ] Verify Release title/notes and artifacts.
- [ ] Confirm `develop` contains the released state.
- [ ] Confirm completed phase and next target in `ROADMAP.md`.
- [ ] Start the next `phase/*` branch from the appropriate current integration baseline.
