# Phase 17 Step 20 — Final Review, Merge, and Release State

## Status

Final review and release preparation are complete. Phase 17 is approved for promotion through `develop` and `main`. The final semantic GitHub Release `v0.17.0` is intentionally delegated to the repository owner as the only remaining manual action.

## Final Review Result

- Complete Phase 17 diff reviewed against the Phase 16 `main`/`develop` baseline.
- Branch is strictly ahead of the baseline with no divergent baseline commits.
- Repository-owner corrective commits are preserved.
- No Party-to-Accounting reverse dependency or out-of-scope posting/balance/document behavior was introduced.
- Migrations `0016` and `0017`, Party permissions, shared Audit composition, bounded readers/selectors, import/export, UI, future-sync contracts, and documentation are present.
- Step 17 and Step 18 validation are repository-owner confirmed green.
- Step 19 documentation is repository-owner approved.

## Release Version

`v0.17.0`

## Prepared Release Notes

`docs/phases/phase-17-release-notes.md`

## Remaining Manual Action

Create tag/GitHub Release `v0.17.0` from the verified Phase 17 release commit on `main` and use the prepared release notes.
