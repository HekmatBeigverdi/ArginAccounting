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

Run the current phase-specific validation first. For Phase 23, execute the focused commands recorded in the canonical Phase 23 plan, covering Purchase, Purchase-Tauri, Purchase-Posting, Purchase-Posting-Tauri, Inventory-Tauri and Desktop. Then run the repository-wide gates:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm lint
node scripts/generate-doc-index.mjs
node scripts/check-doc-links.mjs
cd apps/desktop/src-tauri
cargo check
cd ../../..
```

If a dedicated `validate:phase23` script is present by Step 36, use it as the canonical wrapper and still record its observed output.

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

Phase 23 migration:

```text
0033_purchase_posting.sql
```

Phase 23 integration evidence must exercise Purchase Posting persistence on real SQLite, including Posting Rules, expected-version CAS, append-only replay evidence, controlled reversal lineage, Journal linkage, rollback/failure recovery and exact replay. Upstream Purchase migrations 0030–0032 remain required input state.

## 6. Security and Scope

- [ ] New permissions are present in the canonical permission catalog.
- [ ] Application services enforce permissions independently of UI visibility.
- [ ] Company/Branch scope is enforced for protected reads/writes.
- [ ] Persisted Branch scope is rechecked when authoritative Purchase facts are loaded.
- [ ] Errors do not leak cross-scope identifiers.
- [ ] No production password, token, secret, or private environment value is committed.

For Phase 23 verify independent Purchase Posting view/execute/trace/reverse permissions in addition to upstream Purchase document, receipt, matching and cost-resolution permissions. Source-owned Journals must not expose generic draft edit/delete mutations.

## 7. Bounded-Context Semantics

- [ ] Purchase owns Supplier commercial facts; Product Master Data does not become the mutable Purchase-price store.
- [ ] Inventory remains authoritative for quantity documents and Stock Movements.
- [ ] Inventory Valuation remains authoritative for FIFO/MWA and derived monetary state.
- [ ] Normal Purchase price is entered once and delivered as authoritative Cost Input without duplicate operator entry.
- [ ] Service/non-stock purchases do not require Inventory receipts solely because they were purchased.
- [ ] Stock Purchase accounting waits for durable fulfillment/matching and resolved valuation.
- [ ] Purchase Posting resolves accounts through explicit rules and fails closed on missing/ambiguous mappings.
- [ ] Purchase-generated Journal drafts are source-owned; direct generic edit/delete is blocked.
- [ ] Return/Correction/Reversal append linked compensating facts instead of rewriting posted history.
- [ ] Confirmed Purchase snapshots are not rewritten after Product Master Data changes; safe pre-effect classification correction uses a traced replacement invoice.
- [ ] Bridge envelopes synchronize authoritative Purchase Posting/source/reversal/replay facts; UI summaries and FIFO/MWA projections remain rebuildable.

## 8. Desktop Validation

For user-facing phases verify applicable surfaces:

- [ ] Persian RTL presentation.
- [ ] Solar Hijri input/presentation with Gregorian durable dates.
- [ ] Loading, empty, error, focus, density, and contained overflow behavior.
- [ ] Permission-aware navigation/actions.
- [ ] Keyboard/accessibility behavior.
- [ ] Bounded list/selector/search behavior.
- [ ] Import/export behavior when delivered.

Phase 23 functional acceptance includes stock/non-stock fulfillment behavior, partial confirmed receipts, committed matching, Purchase Cost Resolution, automatic/explicit Posting, balanced Journal creation, readable Persian Journal descriptions, source-owned Journal protection, controlled inventory-classification replacement and fixed desktop-shell scrolling behavior.

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

For Phase 23 the prepared version is:

```text
v0.23.0
```

Prepared notes:

```text
docs/phases/phase-23-release-notes.md
```

Create `v0.23.0` only from the verified Phase 23 release commit on `main` after Step 36 validation and promotion.

## 12. Post-Release

- [ ] Verify the tag points to the intended `main` commit.
- [ ] Verify Release title/notes and artifacts.
- [ ] Confirm `develop` contains the released state.
- [ ] Confirm completed phase and next target in `ROADMAP.md`.
- [ ] Start the next `phase/*` branch from the appropriate current integration baseline.
