# Phase 15 — Step 17 Monorepo Validation and Documentation Completion

## Status

Completed by user confirmation.

Step 16 local regression validation is confirmed green after commit `cf8e91b6c3956b9863d0204a4905edf1e12a2365` corrected Node ESM source resolution in `@argin/security`.

Step 17 completion is recorded from the user's confirmation in the project conversation. Connector sessions did not independently execute the local `pnpm` commands, so the evidence remains explicitly user-confirmed rather than connector-executed.

## Retained regression rule

The Desktop test suite executes workspace TypeScript source directly through the Node test runner. Relative ESM imports/exports in packages exercised this way must use the repository's explicit `.ts` extension convention. A bundler resolving extensionless imports is not evidence that direct Node TypeScript execution will resolve them.

## Validation baseline

Phase branch: `phase/15-journal-lifecycle`

Root monorepo scripts are authoritative:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Focused lifecycle validation set:

```bash
pnpm --filter @argin/accounting typecheck
pnpm --filter @argin/accounting test
pnpm --filter @argin/accounting-tauri typecheck
pnpm --filter @argin/accounting-tauri test
pnpm --filter @argin/security typecheck
pnpm --filter @argin/desktop typecheck
pnpm --filter @argin/desktop test
```

Validation status for Step 17: **confirmed by user**.

## Documentation completion checklist

Step 17 reconciles the implemented Phase 15 behavior with the canonical repository documentation and indexes:

- Journal lifecycle ownership remains in `JournalVoucher` while Approval remains a separate reusable aggregate.
- posted/reversed accounting facts remain immutable in place and correction uses separate reversal lineage.
- granular lifecycle permissions and the self-approval segregation rule remain documented.
- migration `0014`, authoritative `lifecycle_status`, lifecycle evidence tables, concurrency and idempotency constraints remain documented.
- Phase 16 — Accounting Reports remains the next phase after Phase 15 release.
- Phase 15 plan, ADR, test matrices, validation document and manual desktop validation document are indexed from `docs/phases/README.md`.

## Documentation integrity rules retained

1. Phase numbering must remain consistent with `ROADMAP.md`.
2. Validation claims must distinguish user-confirmed local execution from connector-executed evidence.
3. The Step 10 SQLite test lessons remain retained:
   - spread `node:sqlite` rows before strict deep equality;
   - use `sqlite_master.tbl_name` to discover indexes attached to a table.
4. The Step 16 Node ESM lesson remains retained:
   - TypeScript workspace source executed directly by Node tests uses explicit `.ts` relative imports/exports.

## Manual functional validation

Automated validation and manual product validation remain separate evidence.

The Tauri desktop acceptance workflow and final runtime findings are recorded in:

`docs/phases/phase-15-manual-desktop-validation.md`

Final Step 18 acceptance exercised the release-blocking create/submit/separate-user-approval path and exposed several runtime defects that were corrected before merge, including post-commit Audit/Notification failures and stale UI state.

Posting/Reversal continue to have focused Domain/Application/SQLite/Desktop coverage; no new manual Posting/Reversal voucher pair is claimed by the final acceptance record.

## Exit condition

Step 17 is complete. Step 18 final review was subsequently completed through merge preparation; only final semantic tag/GitHub Release publication remains manual.
