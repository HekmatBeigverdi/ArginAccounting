# Documentation Governance

## Status

Permanent and mandatory for every phase, module, release, and architectural change.

## Purpose

This file preserves the documentation conventions that must be followed through the final project phase without requiring repeated reminders.

## Canonical Structure

- `docs/phases/` — phase implementation records
- `docs/architecture/` — system-wide architecture
- `docs/adr/` — architectural decisions and their rationale
- `docs/database/` — data architecture and migration policy
- `docs/accounting/` — accounting and posting semantics
- `docs/development/` — engineering handbook
- `docs/security/` — authentication, authorization, audit, and approval
- `docs/glossary/` — shared domain vocabulary
- `docs/vision/` — long-term product direction
- `docs/templates/` — required document templates

Root `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, and `RELEASE_CHECKLIST.md` remain discoverable GitHub entry points. Detailed policy belongs under `docs/`.

## Mandatory Phase Workflow

Every phase must:

1. Create or update `docs/phases/phase-NN-<slug>.md` from the phase template.
2. Update `ROADMAP.md` status and numbering.
3. Update `CHANGELOG.md` under the relevant release.
4. Add or update ADRs for significant architectural decisions.
5. Update affected canonical documents.
6. Update the domain glossary for new business terms.
7. Record migrations, permissions, tests, and validation evidence.
8. Verify all internal links.

A phase is not documentation-complete until these obligations are satisfied.

## Naming Rules

- Lowercase kebab-case for files under `docs/`.
- Two-digit phase numbers: `phase-09-platform-infrastructure.md`.
- ADR names: `ADR-0001-offline-first.md`.
- Use English for repository documentation and identifiers.
- Persian is used for end-user UI and Persian offline guides.

## Source-of-Truth Rules

- Do not duplicate normative rules across files.
- Link to canonical documents.
- ADRs explain why; canonical documents explain the current rule; phase documents explain what changed.
- Historical phase records are append-only except for corrections, link repairs, and explicit status updates.

## Required Phase Sections

Overview, Status, Objectives, Scope, Architecture, Domain Model, Application Services, Data and Migrations, Security, UI, Testing, Validation, Documentation Impact, Related ADRs, Exit Criteria, and Next Phase.

## Definition of Done

Documentation is part of the implementation. A feature is incomplete when public contracts, architecture, migrations, permissions, operational behavior, or validation procedures are undocumented.