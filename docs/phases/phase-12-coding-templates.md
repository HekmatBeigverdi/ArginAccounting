# Phase 12 — Coding Templates

## Status

Implemented. Full validation and delivery evidence are recorded in the fixed Phase 12 plan; merge and release require explicit approval.

## Overview

Phase 12 delivers versioned and auditable coding templates for Iranian service, trading, and manufacturing companies. Templates compose the Phase 10 Chart of Accounts and Phase 11 Accounting Dimensions through deterministic preview, conflict analysis, explicit confirmation, atomic application, non-destructive upgrades, and validated Excel import.

## Delivered Scope

- Company activity types with recommendation-only behavior
- Company-independent draft, published, and retired templates
- Immutable template versions and stable logical item keys
- Built-in service, trading, and manufacturing catalogs
- Accounts, dimensions, members, and account-dimension policies in one validated graph
- Deterministic preview and actionable conflict analysis
- Atomic, retry-safe application with durable history and item mappings
- Non-destructive additive upgrade comparison and drift protection
- Versioned Excel workbook contract, preview, validation, and atomic import
- SQLite migration, repositories, paging, optimistic concurrency, and transaction adapters
- Explicit permissions, post-commit audit/integration events, and correlation context
- Persian RTL desktop workflows with Solar Hijri presentation and Iranian Rial context

## Architecture and Safety

Published template versions are immutable. Operational accounts and dimensions remain company-scoped and locally authoritative. A recommendation never applies coding automatically. Every application revalidates its preview against the current baseline inside a real SQLite transaction, and a request key makes retries idempotent. Upgrade plans never delete or overwrite local changes automatically.

The Domain and Application contracts remain independent from React, Tauri, SQLite, PostgreSQL, transport, and spreadsheet libraries. Stable identifiers, fingerprints, mappings, histories, and correlation metadata preserve compatibility with the future Argin Bridge deployment and synchronization model.

## Data and Migration

Migration `apps/desktop/src-tauri/migrations/0012_coding_templates.sql` adds company activity compatibility, template lifecycle and immutable-version storage, normalized template items, application histories and mappings, and workbook import histories. Existing companies are backfilled to the explicit `custom` activity type.

## Security

The `accounting.coding-templates.*` permission family protects view, create, draft update, publish, retire, preview, apply, upgrade, import, and history operations. Built-in template mutation additionally requires privileged system administration. Authorization is enforced by Application Services, and success events are emitted only after commit.

## User Experience

The Persian RTL desktop workspace provides catalog search, activity-based recommendation, version details, tree preview, conflict details, explicit apply confirmation, upgrade comparison, Excel import, lifecycle management, and application history. Apply failures expose both a Persian user-facing summary and a copyable technical error chain.

## Validation

Focused Phase 12 evidence:

- Accounting Domain and Application: `192/192`
- SQLite Accounting Adapter: `39/39`
- Tauri SQLite transaction lifecycle: `4/4`
- Desktop and Phase 10/11 regression: `36/36`

Frozen install, full Monorepo lint, typecheck, tests, build, and whitespace validation are recorded in the Step 18 evidence of the fixed implementation plan.

## Related Documents

- [Phase 12 Fixed Implementation Plan](phase-12-coding-templates-plan.md)
- [ADR-0012 — Versioned Coding Templates](../adr/ADR-0012-versioned-coding-templates.md)
- [Coding Template Excel Workbook Contract v1.0](../contracts/coding-template-workbook-v1.md)
- [Phase 10 — Chart of Accounts](phase-10-chart-of-accounts.md)
- [Phase 11 — Accounting Dimensions](phase-11-accounting-dimensions.md)

## Next Phase

Phase 13 — Journal Voucher Engine.
