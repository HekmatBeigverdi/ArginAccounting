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

Run the current phase-specific validation first. For Phase 22:

```bash
pnpm validate:phase22
```

This covers Purchase Domain/Application, Purchase-Tauri SQLite persistence, Inventory/Valuation integration, Desktop tests/build, documentation index/link checks, full monorepo typecheck/test/build/lint, and Rust `cargo check`.

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

Phase 22 migrations:

```text
0030_purchase_workflow.sql
0031_purchase_scope_snapshot.sql
0032_purchase_replay_safety.sql
```

Phase 22 integration evidence must exercise these migrations on real SQLite, including upgrade from the Phase 21 boundary, rollback, restart durability, scoped numbering, append-only Match/replay facts and optimistic concurrency.

## 6. Security and Scope

- [ ] New permissions are present in the canonical permission catalog.
- [ ] Application services enforce permissions independently of UI visibility.
- [ ] Company/Branch scope is enforced for protected reads/writes.
- [ ] Persisted Branch scope is rechecked when authoritative Purchase facts are loaded.
- [ ] Errors do not leak cross-scope identifiers.
- [ ] No production password, token, secret, or private environment value is committed.

For Phase 22 verify the Purchase permission families for document view/create/edit/lifecycle, Approval/Confirmation, Inventory receipt staging, receipt/invoice matching, cost resolution and report/export behavior.

## 7. Bounded-Context Semantics

- [ ] Purchase owns Supplier commercial facts; Product Master Data does not become the mutable Purchase-price store.
- [ ] Inventory remains authoritative for quantity documents and Stock Movements.
- [ ] Inventory Valuation remains authoritative for FIFO/MWA and derived monetary state.
- [ ] Normal Purchase price is entered once and delivered as authoritative Cost Input without duplicate operator entry.
- [ ] Service/non-stock purchases do not create stock Cost Inputs solely because they were purchased.
- [ ] Return/Correction append compensating facts instead of rewriting confirmed Purchase/Inventory history.
- [ ] Purchase does not create Journal Vouchers or supplier payable posting; Phase 23 owns Purchase Posting.
- [ ] Bridge envelopes synchronize authoritative Purchase facts only; report/matching-summary/FIFO-MWA projections remain rebuildable.

## 8. Desktop Validation

For user-facing phases verify applicable surfaces:

- [ ] Persian RTL presentation.
- [ ] Solar Hijri input/presentation with Gregorian durable dates.
- [ ] Loading, empty, error, focus, density, and contained overflow behavior.
- [ ] Permission-aware navigation/actions.
- [ ] Keyboard/accessibility behavior.
- [ ] Bounded list/selector/search behavior.
- [ ] Import/export behavior when delivered.

Phase 22 functional acceptance includes Purchase create/edit/lifecycle, Supplier/Product commercial lines, Jalali dates, Inventory receipt staging, receipt-cost resolution, matching/unresolved-cost visibility, stale-version handling, Persian RTL reports and permission-aware actions.

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

For Phase 22 the prepared version is:

```text
v0.22.0
```

Prepared notes:

```text
docs/phases/phase-22-release-notes.md
```

Phase 22 release is ordered after Phase 21. Do not create `v0.22.0` from a `main` commit that does not already contain the required Phase 21 state.

## 12. Post-Release

- [ ] Verify the tag points to the intended `main` commit.
- [ ] Verify Release title/notes and artifacts.
- [ ] Confirm `develop` contains the released state.
- [ ] Confirm completed phase and next target in `ROADMAP.md`.
- [ ] Start the next `phase/*` branch from the appropriate current integration baseline.
