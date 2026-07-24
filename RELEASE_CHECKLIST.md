# ArginAccounting Release Checklist

Use this checklist before merging a phase branch into `develop`, promoting it to `main`, creating a version tag, or publishing a GitHub release.

## 1. Scope and Repository State

- [ ] Confirm the intended phase branch is checked out.
- [ ] Pull the latest remote changes.
- [ ] Confirm the branch contains all user and reviewer corrections.
- [ ] Confirm the branch is not behind `develop`.
- [ ] Review the complete diff against `develop`.
- [ ] Remove temporary experiments, commented-out implementations, and debug logging.
- [ ] Confirm no generated database, build artifact, cache, or local environment file is tracked.

Recommended commands:

```bash
git status
git fetch origin
git log --oneline --decorate -20
git diff --stat origin/develop...HEAD
git diff origin/develop...HEAD
```

## 2. Dependencies and Lockfile

- [ ] Run `pnpm install` using the repository's declared pnpm version.
- [ ] Confirm `pnpm-lock.yaml` matches workspace package files.
- [ ] Confirm no dependency was added without a clear runtime or development purpose.
- [ ] Review dependency licenses and security notices when applicable.

```bash
corepack enable
pnpm install --frozen-lockfile
```

## 3. TypeScript Validation

- [ ] Audit domain package passes type checking.
- [ ] Audit Tauri infrastructure passes type checking.
- [ ] Security package passes type checking.
- [ ] Desktop application passes type checking.
- [ ] Entire workspace passes type checking.

```bash
pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/security typecheck
pnpm --filter @argin/desktop typecheck
pnpm typecheck
```

## 4. Automated Tests

- [ ] Audit application tests pass.
- [ ] Audit Tauri Unit of Work tests pass.
- [ ] Entire workspace test command passes.
- [ ] No test is skipped without a documented reason.

```bash
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri test
pnpm test
```

## 5. Build and Rust Validation

- [ ] Workspace build passes.
- [ ] Desktop frontend build passes.
- [ ] Rust `cargo check` passes.
- [ ] Tauri development application starts successfully.

```bash
pnpm build
pnpm --filter @argin/desktop build

cd apps/desktop/src-tauri
cargo check
cd ../../..

pnpm dev:desktop
```

## 6. Database and Migration Validation

- [ ] Create a new database and run all migrations from the beginning.
- [ ] Upgrade a Phase 07 database through migrations 0005 and 0006.
- [ ] Confirm `audit_entries`, `approval_requests`, and `approval_history` exist.
- [ ] Confirm approval request `version` exists and defaults to `1`.
- [ ] Confirm required indexes and foreign keys exist.
- [ ] Confirm migration registration order in Tauri is correct.
- [ ] Confirm failed migrations do not leave a partially upgraded database.
- [ ] Back up test data before destructive migration testing.

Suggested SQLite checks:

```sql
.tables
.schema audit_entries
.schema approval_requests
.schema approval_history
PRAGMA foreign_key_check;
PRAGMA integrity_check;
```

## 7. Security and Permissions

- [ ] Permission catalog includes all Phase 08 permissions.
- [ ] Existing administrator roles receive intended access after bootstrap.
- [ ] Restricted users cannot call protected application services.
- [ ] UI actions are hidden when permission is absent.
- [ ] Direct application-service calls still reject unauthorized access.
- [ ] No production password, token, key, or secret exists in source code, fixtures, or documentation.
- [ ] Audit snapshots sanitize sensitive keys.

Phase 08 permissions:

```text
audit.entries.view
audit.entries.record
approval.requests.view
approval.requests.create
approval.requests.submit
approval.requests.approve
approval.requests.reject
approval.requests.return-to-draft
approval.requests.cancel
approval.requests.comment
```

## 8. Approval Workflow Validation

- [ ] Draft request can be submitted.
- [ ] Pending request can be approved.
- [ ] Pending request can be rejected.
- [ ] Pending request can return to draft.
- [ ] Draft and pending requests can be cancelled.
- [ ] Comments create history without changing status.
- [ ] Invalid transitions are rejected.
- [ ] Final status metadata is correct.
- [ ] Version increments after each successful update.
- [ ] Stale updates raise a concurrency error.
- [ ] Every action creates approval history.
- [ ] Every state-changing action creates an audit entry.

## 9. Atomicity and Failure Validation

- [ ] Approval creation writes Request + History + Audit atomically.
- [ ] Approval actions write Update + History + Audit atomically.
- [ ] A simulated audit failure rolls back approval writes.
- [ ] A simulated history failure rolls back all writes.
- [ ] Transaction mutex prevents overlapping transactions on the shared SQLite connection.
- [ ] Rollback failure preserves both errors through `AggregateError`.

## 10. Desktop UI Validation

- [ ] Login stores the authenticated session in the provider.
- [ ] Audit composition rebuilds when session permissions change.
- [ ] Approval request list loads.
- [ ] Approval filters and search work.
- [ ] Approval details and timeline load.
- [ ] Approval actions refresh the displayed state.
- [ ] Audit entry list loads.
- [ ] Audit filters and search work.
- [ ] Audit details display actor, scope, target, source, outcome, and correlation ID.
- [ ] Before and after snapshots render safely.
- [ ] Loading, empty, permission, concurrency, and error states are understandable in Persian.
- [ ] RTL layout and LTR technical values display correctly.

## 11. Documentation

- [ ] `README.md` reflects the current phase.
- [ ] `ROADMAP.md` reflects completed and upcoming phases.
- [ ] `ARCHITECTURE.md` matches the implemented dependency direction.
- [ ] `CHANGELOG.md` includes the release version.
- [ ] `CONTRIBUTING.md` includes validation rules.
- [ ] Phase documentation is complete under `docs/`.
- [ ] Known limitations are documented honestly.
- [ ] Release notes do not claim unverified test results.

## 12. Final Phase 08 Commands

Run from the repository root:

```bash
git switch phase/08-audit-approval
git pull origin phase/08-audit-approval

pnpm install --frozen-lockfile

pnpm --filter @argin/audit typecheck
pnpm --filter @argin/audit test
pnpm --filter @argin/audit-tauri typecheck
pnpm --filter @argin/audit-tauri test
pnpm --filter @argin/security typecheck
pnpm --filter @argin/desktop typecheck

pnpm typecheck
pnpm test
pnpm build

cd apps/desktop/src-tauri
cargo check
```

Record failures and their corrections before merging.

## 13. Merge Phase into Develop

Only after every required check passes:

```bash
git switch develop
git pull origin develop
git merge --no-ff phase/08-audit-approval -m "merge: complete phase 08 audit and approval"
git push origin develop
```

## 14. Version Tag and Release

Recommended Phase 08 version:

```text
v0.8.0
```

After validating the intended release commit:

```bash
git tag -a v0.8.0 -m "release: phase 08 audit and approval"
git push origin v0.8.0
```

Create a GitHub release from `v0.8.0` using the `0.8.0` section of `CHANGELOG.md` as the basis for release notes.

## 15. Post-Release

- [ ] Verify the tag points to the intended commit.
- [ ] Verify release notes and downloadable artifacts.
- [ ] Merge or synchronize the stable release into `main` according to repository policy.
- [ ] Confirm `develop` contains the release state.
- [ ] Create `phase/09-chart-of-accounts` from the updated `develop` branch.
- [ ] Mark Phase 08 completed in `ROADMAP.md` after the release is verified.