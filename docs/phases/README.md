# Phase Documentation

All phase records live in this directory and follow the permanent [phase template](../templates/phase-template.md) and [documentation governance](../development/documentation-governance.md).

## Completed Implementation

1. [Phase 01 — Architecture Baseline](phase-01-architecture-baseline.md)
2. [Phase 02 — Monorepo Bootstrap](phase-02-monorepo-bootstrap.md)
3. [Phase 03 — Domain Foundation](phase-03-domain-foundation.md)
4. [Phase 04 — Database and SQLite](phase-04-database-sqlite.md)
5. [Phase 05 — Company and Branch](phase-05-company-branch.md)
6. [Phase 06 — Fiscal Management](phase-06-fiscal-management.md)
7. [Phase 07 — Security](phase-07-security.md)
8. [Phase 08 — Audit and Approval](phase-08-audit-approval.md)
9. [Phase 09 — Platform Infrastructure](phase-09-platform-infrastructure.md)
10. [Phase 10 — Chart of Accounts](phase-10-chart-of-accounts.md)
11. [Phase 11 — Accounting Dimensions](phase-11-accounting-dimensions.md)
12. [Phase 12 — Coding Templates](phase-12-coding-templates.md)
13. [Phase 13 — Journal Voucher Engine](phase-13-journal-voucher-engine.md) — completed, merged, and released as `v0.13.0`
14. [Phase 14 — UI Foundation Consolidation](phase-14-ui-foundation-consolidation.md) — completed, merged, and released as `v0.14.0`
   - [Fixed Implementation Plan](phase-14-ui-foundation-consolidation-plan.md)
   - [ADR-0014 — UI Foundation and Global Display Density](../adr/ADR-0014-ui-foundation-and-global-density.md)

## Current Target

15. [Phase 15 — Journal Lifecycle](phase-15-journal-lifecycle.md) — in progress
   - [Fixed Implementation Plan](phase-15-journal-lifecycle-plan.md)
   - [ADR-0015 — Journal Lifecycle Architecture](../adr/ADR-0015-journal-lifecycle.md)
   - [Step 15 Domain and Application Test Matrix](phase-15-step-15-test-matrix.md)
   - [Step 16 Persistence and Desktop Regression Matrix](phase-15-step-16-regression-matrix.md)
   - Current step: Step 16 — Repository, Migration, Permission, and Desktop Regression Tests — Completed
   - Next step: Step 17 — Monorepo Validation and Documentation Completion

## Renumbering Rule

The insertion of Platform Infrastructure as Phase 09 shifted Chart of Accounts and every subsequent roadmap phase by one. The insertion of UI Foundation Consolidation as Phase 14 shifts every previously planned phase after Phase 13 by one. Journal Lifecycle is Phase 15. `ROADMAP.md` is the canonical numbering source.

## Historical Refactor Policy

Phase 01–14 documents retain their implementation history and historical phase numbers. Link repair, status correction, standardized cross-references, and missing-record reconstruction are permitted; claims about validation must remain evidence-based.
