# Phase 12 — Coding Templates: Fixed Implementation Plan

## Status

Approved baseline pending implementation. This document is the canonical execution checklist for Phase 12.

## Governance Rule

This plan is frozen for the duration of Phase 12.

Before starting every step:

1. Read this document.
2. Read the permanent [GitHub Publishing Workflow](../development/github-publishing-workflow.md).
3. Confirm the current branch and latest commit.
4. Confirm the previous step's exit criteria.
5. State the current step number, scope, files expected to change, and validation commands.
6. Update only the status and evidence sections of this document.

A step may not be reordered, split, merged, removed, or expanded without explicit user approval. Newly discovered work must be recorded under **Change Requests** and must not silently alter the sequence.

## Phase Objective

Deliver versioned, auditable coding templates for Iranian service, trading, and manufacturing companies. A template may provision the operational Chart of Accounts, accounting dimension types and members, and account-dimension policies through previewable and atomic workflows. The phase also delivers validated Excel import using a documented workbook contract.

## Design Baseline

- Preserve the Tadbir-inspired three-level operational hierarchy: Group, General, Subsidiary.
- Keep detailed classifications independent as Accounting Dimensions.
- Keep accounting behavior and report classification explicit; never infer them from code prefixes.
- Provide built-in service, trading, and manufacturing templates based on the supplied coding references.
- Allow a privileged system administrator to maintain template drafts and publish new immutable versions.
- Select a suitable built-in template from company activity type while requiring a preview and explicit confirmation before application.
- Never overwrite operational company data silently.
- Preserve Persian UI, Iranian Rial, and Solar Hijri presentation conventions.
- Store durable dates and timestamps in Gregorian ISO format.

## Argin Bridge Constraints

Phase 12 must remain compatible with the Argin Bridge deployment model:

- Local-first desktop operation through Tauri and SQLite.
- Future company-network deployment through a .NET API and PostgreSQL.
- Future offline synchronization without relying on SQLite-only domain behavior.
- Stable opaque identifiers and explicit company scope.
- Deterministic, retry-safe application commands and import batches.
- Version and source metadata sufficient for conflict detection and synchronization.
- Domain and Application contracts independent from React, Tauri, SQLite, PostgreSQL, and transport protocols.
- Atomic local writes behind Unit of Work boundaries.
- Post-commit integration events carrying actor, company, correlation, causation, template version, and import/application identifiers.

## Scope

### Included

- Company activity type required for template recommendation
- Template definitions, lifecycle, immutable published versions, and version items
- Built-in service, trading, and manufacturing template catalogs
- Accounts, account classifications, dimensions, dimension members, and account-dimension policies in templates
- Preview, validation, conflict analysis, atomic apply, retry safety, and application history
- Upgrade comparison and explicitly selected additive changes
- Excel workbook contract, parser boundary, preview, validation, import, and import history
- Permissions, audit events, optimistic concurrency, SQLite persistence, Persian RTL UI, tests, and documentation

### Excluded

- Automatic destructive replacement of a company's existing coding
- Silent template upgrades
- Journal vouchers and journal lines
- Account balance migration or code remapping for posted entries
- PostgreSQL, server API, and synchronization implementation
- Automatic module-owned Party, Product, Warehouse, Project, Contract, or Cost Centre member generation
- Arbitrary spreadsheet formats without the documented workbook contract

## Fixed Execution Sequence

### Step 1 — Baseline, Branch, and Frozen Plan

- Create `phase/12-coding-templates` from the released Phase 11 baseline.
- Record repository, migration, package, permission, event, UI, and test baselines.
- Add this frozen implementation plan.
- Confirm there are no Phase 12 implementation changes before architecture approval.

Exit criteria:

- Branch starts from released Phase 11.
- This file is committed and is the canonical checklist.
- Baseline gaps and dependencies are documented.

### Step 2 — Domain Analysis and ADR

- Reconcile the supplied Tadbir model, sample coding workbooks, and existing Phase 10/11 contracts.
- Define template ownership, draft/published/retired lifecycle, immutable versioning, source provenance, and company application semantics.
- Define safe upgrade behavior and non-destructive conflict policy.
- Add ADR-0012.

Exit criteria:

- Architectural boundaries and rejected alternatives are explicit.
- Account, dimension, policy, Excel, and Argin Bridge decisions are recorded.

### Step 3 — Company Activity Type and Compatibility Policy

- Add service, trading, manufacturing, and other/custom activity types.
- Preserve compatibility for existing companies through an explicit unset/custom migration policy.
- Add update permission, validation, repository mapping, and Persian UI support.
- Define recommendation behavior separately from final user confirmation.

Exit criteria:

- Existing companies remain valid.
- Activity type can recommend but cannot silently apply a template.

### Step 4 — Template Aggregate and Value Objects

- Implement template identity, code, localized name, activity type, ownership, lifecycle, and version.
- Implement immutable published template-version metadata.
- Add normalization and validation errors.
- Keep definitions company-independent until application.

Exit criteria:

- Domain invariants and lifecycle transitions are covered by focused tests.

Status: Completed

Evidence:

- Added company-independent `CodingTemplate` aggregate with explicit activity type, ownership, lifecycle, and optimistic version metadata.
- Added branded template/version identifiers, normalized stable code, localized names, and positive version-number value objects.
- Added immutable published-version metadata with source provenance and SHA-256 content fingerprint validation.
- Added draft-to-published version sequencing and published-to-retired lifecycle guards.
- Added focused domain tests for normalization, validation, independence from company scope, immutability, sequential publishing, and retirement rules.

### Step 5 — Template Item Model

- Model template accounts with stable logical keys and explicit parent logical keys.
- Model report classifications, account flags, and management tags.
- Model dimension types, members, parent relationships, and account-dimension policies.
- Validate cross-item references and the complete template graph.

Exit criteria:

- A complete template can be validated without persistence or UI dependencies.
- Invalid hierarchy, references, duplicate codes, and policy combinations are rejected.

Status: Completed

Evidence:

- Added company-independent account, dimension type, dimension member, and account-dimension policy item contracts using stable logical keys.
- Added explicit account hierarchy, behavior flags, report classifications, management tags, dimension hierarchy, and policy requirements.
- Added a complete in-memory graph validator covering item validity, duplicate keys/codes/policies, missing or cross-type references, hierarchy levels/cycles, and policy compatibility.
- Added immutable validated version content so a complete graph is accepted or rejected before persistence and UI boundaries.
- Added focused tests for valid complete graphs and every required invalid graph category.

### Step 6 — Built-in Iranian Coding Catalogs

- Convert the approved supplied coding data into canonical service, trading, and manufacturing catalogs.
- Keep shared logical keys stable across versions.
- Include explicit accounting nature, normal balance, statement classification, posting flags, dimensions, and policies.
- Add catalog integrity and snapshot tests.

Exit criteria:

- All three catalogs pass the same domain validator.
- No accounting meaning is inferred only from account code.

### Step 7 — Application Contracts and Queries

- Define repositories for templates, versions, application history, and import history.
- Define catalog provider, clock, identifier, authorization, transaction, and event boundaries.
- Define paged template/version queries and company recommendation queries.
- Extend the Accounting Unit of Work without leaking SQLite types.

Exit criteria:

- Contracts support SQLite now and PostgreSQL/API adapters later.

### Step 8 — Preview and Conflict Analysis Engine

- Build a deterministic dry-run plan for accounts, dimensions, members, and policies.
- Classify actions as create, compatible existing, conflict, skipped, or invalid.
- Detect code, logical-key, hierarchy, classification, policy, and scope conflicts.
- Produce actionable Persian-ready issue codes and summaries.

Exit criteria:

- Preview performs no writes.
- The same inputs and baseline produce the same ordered plan.

### Step 9 — Atomic Template Application

- Apply only a validated preview with explicit confirmation.
- Create operational Phase 10/11 entities with template source provenance.
- Persist application history and item mappings.
- Enforce idempotency with an application/request key.
- Roll back every change when any item fails.

Exit criteria:

- Retry does not duplicate data.
- Partial application is impossible.
- Post-commit events are emitted only after success.

### Step 10 — Template Upgrade and Drift Policy

- Compare the currently applied version with a newer published version.
- Identify unchanged, locally modified, newly available, conflicting, and retired items.
- Permit explicit additive upgrades.
- Never overwrite or delete local operational changes automatically.
- Record accepted and skipped upgrade actions.

Exit criteria:

- Upgrade preview is non-destructive and auditable.
- Local customization remains authoritative unless explicitly resolved.

### Step 11 — Excel Workbook Contract and Parser Boundary

- Publish the fixed workbook sheets, columns, types, required fields, enumerations, logical keys, and examples.
- Define parser contracts independent from browser, filesystem, and spreadsheet library.
- Normalize Persian/Arabic digits and whitespace.
- Reject formulas where stored values are required and report cell-level errors.
- Define workbook and row limits.

Exit criteria:

- The Excel contract is documented and versioned.
- Parser output feeds the same template validator as built-in catalogs.

### Step 12 — Excel Preview and Atomic Import

- Parse a workbook into a draft template version.
- Validate all sheets and cross-sheet references.
- Display row/cell errors and a complete dry-run summary.
- Import through a transaction with retry-safe import-batch identity.
- Preserve file fingerprint, contract version, actor, timestamps, and source metadata.

Exit criteria:

- Invalid workbooks write nothing.
- Re-importing the same confirmed batch cannot duplicate data.

### Step 13 — SQLite Migration

- Add migration `0012_coding_templates.sql`.
- Persist templates, versions, version items or normalized item tables, applications, item mappings, and import batches.
- Add uniqueness, lifecycle, scope, version, provenance, and referential constraints.
- Add query and synchronization-oriented indexes.

Exit criteria:

- Migration works from a fresh database and an upgraded Phase 11 database.
- Durable constraints match domain invariants.

### Step 14 — SQLite Repositories and Transactional Adapters

- Implement template, version, history, and import repositories.
- Implement catalog and query adapters.
- Extend the accounting Unit of Work for atomic applications/imports.
- Enforce optimistic concurrency and escaped paged search.

Exit criteria:

- Repository contract tests pass.
- Transaction rollback and stale-version behavior are verified.

### Step 15 — Permissions, Audit, and Integration Events

- Add view, create, update-draft, publish, retire, preview, apply, upgrade, import, and history permissions.
- Reserve built-in template mutation for privileged system administration.
- Emit lifecycle, application, upgrade, and import events after commit.
- Preserve full actor, company, source, correlation, causation, and before/after context.

Exit criteria:

- Application-layer authorization covers every sensitive action.
- Failure and rollback publish no success event.

### Step 16 — Desktop Composition and Persian RTL UI

- Wire repositories and services into desktop composition.
- Add template catalog, version detail, company recommendation, preview, conflict resolution, application history, upgrade comparison, and Excel import experiences.
- Use Persian RTL labels and actionable validation messages.
- Keep dates Solar Hijri in presentation while storing ISO Gregorian values.

Exit criteria:

- UI cannot bypass preview, authorization, or explicit confirmation.
- Existing Chart of Accounts and Dimensions workspaces remain functional.

### Step 17 — Focused and Integration Test Completion

- Complete Domain, Application, catalog snapshot, migration, repository, transaction, permission, audit, presenter, UI, and Excel tests.
- Test service, trading, and manufacturing flows independently.
- Test existing-company compatibility, conflicts, retries, rollback, upgrade drift, and malformed workbooks.
- Verify Phase 10 and 11 regression suites.

Exit criteria:

- Focused suites pass with recorded counts.
- Critical failure-path coverage is present.

### Step 18 — Documentation, Full Validation, Merge, and Release

- Add the final Phase 12 record and update ADR, roadmap, changelog, registries, database dictionary, security model, glossary, and accounting engine documentation.
- Run frozen install, lint, typecheck, all tests, build, and `git diff --check`.
- Review the completed diff against every step and exit criterion in this file.
- Merge to `develop`, release to `main`, tag consistently, and prepare release notes only after explicit approval.

Exit criteria:

- All checks pass and evidence is recorded.
- Documentation matches implementation.
- Phase 12 is merged and released through the approved workflow.

## Step Status

| Step | Title | Status | Evidence |
|---:|---|---|---|
| 1 | Baseline, Branch, and Frozen Plan | Completed | Branch `phase/12-coding-templates` created from released Phase 11 commit `999c215`; package, migration, permission, event, UI, test, account, dimension, and company baselines recorded below; frozen plan committed as `e06c904` |
| 2 | Domain Analysis and ADR | Completed | `ADR-0012` accepts company-independent immutable template versions, deterministic preview, atomic retry-safe apply/import, non-destructive upgrades, one Excel/domain validation path, and Argin Bridge ports |
| 3 | Company Activity Type and Compatibility Policy | Completed | Added explicit `service`, `trading`, `manufacturing`, and `custom` types; existing-company backfill policy remains `custom` for migration 0012; added validation, dedicated update permission, authorized update use case, SQLite mapping, Persian setup selector, recommendation-only policy, and focused tests |
| 4 | Template Aggregate and Value Objects | Completed | Added company-independent template identity, normalized code/name value objects, controlled draft/published/retired lifecycle, immutable sequential version metadata, source provenance, content fingerprint, and optimistic versioning |
| 5 | Template Item Model | Completed | Added immutable account, report classification, dimension type/member, and account-dimension policy graph with stable logical keys and complete shared domain validation |
| 6 | Built-in Iranian Coding Catalogs | Completed | Added immutable version-1 service, trading, and manufacturing catalogs with stable shared keys, explicit accounting/report meaning, activity-specific accounts, four dimension types, policies, integrity tests, and SHA-256 snapshots |
| 7 | Application Contracts and Queries | Not started | — |
| 8 | Preview and Conflict Analysis Engine | Not started | — |
| 9 | Atomic Template Application | Not started | — |
| 10 | Template Upgrade and Drift Policy | Not started | — |
| 11 | Excel Workbook Contract and Parser Boundary | Not started | — |
| 12 | Excel Preview and Atomic Import | Not started | — |
| 13 | SQLite Migration | Not started | — |
| 14 | SQLite Repositories and Transactional Adapters | Not started | — |
| 15 | Permissions, Audit, and Integration Events | Not started | — |
| 16 | Desktop Composition and Persian RTL UI | Not started | — |
| 17 | Focused and Integration Test Completion | Not started | — |
| 18 | Documentation, Full Validation, Merge, and Release | Not started | — |

## Baseline Findings

- Phase 11 is released on `main` at commit `999c215`.
- Phase 10 provides company-scoped accounts, coding settings, explicit classifications, source provenance, optimistic concurrency, permissions, audit events, SQLite repositories, and Persian RTL UI.
- Phase 11 provides independent dimension types and members, account-dimension policies, assignment validation, selectors, SQLite repositories, permissions, events, and Persian RTL UI.
- The current Company model fixes currency to IRR, locale to fa-IR, and calendar to Jalali, but does not yet contain activity type.
- Existing account source provenance already recognizes template and Excel origins; dimension provenance supports system/module sources and must be reconciled explicitly in ADR-0012.
- Journal persistence is absent and remains outside Phase 12.
- No Phase 12 branch or implementation existed at baseline.

## Step 3 Compatibility Record

- New companies must choose an explicit activity type; the Persian form defaults to `custom` so no business activity is inferred.
- Migration `0012` will add the durable `activity_type` column in Step 13 and backfill every existing company with `custom` before enforcing the allowed-value constraint.
- Until Step 13, the SQLite repository detects the Phase 11 schema and reads missing activity values as `custom`, keeping upgraded development databases usable without changing an earlier migration.
- `custom` is the compatibility value for an unknown, mixed, or user-defined activity. It is not a hidden null state.
- Changing activity requires `company.profile.update-activity-type` and updates only company metadata.
- Service, trading, and manufacturing values return a stable template recommendation code. `custom` returns no recommendation.
- Every recommendation explicitly requires a later preview and user confirmation. Company creation and activity changes never apply account coding.

## Change Requests

No change requests recorded.
