# ArginAccounting Documentation

This directory is the canonical documentation hub for the project. Root-level files remain concise GitHub entry points and link to detailed documents here.

## Permanent Rules

All contributors and future phases must follow:

- [Documentation Governance](development/documentation-governance.md)
- [Documentation Architecture v2](development/documentation-architecture-v2.md)
- [Phase Definition of Done](development/phase-definition-of-done.md)
- [Phase Checklist](templates/phase-checklist.md)

These documents are mandatory through the final project phase.

## Generated Index

- [Complete documentation index](index.md)
- Generator: `node scripts/generate-doc-index.mjs`
- Local link validator: `node scripts/check-doc-links.mjs`

Run the generator after adding, moving, renaming, or deleting documentation files and validate links before phase closure.

## Canonical Sections

- [Phases](phases/README.md)
- [Architecture](architecture/README.md)
- [Architecture Decision Records](adr/README.md)
- [Architecture Decision Registry](registries/architecture-decision-registry.md)
- [Module Registry](registries/module-registry.md)
- [Database Design](database/database-design.md)
- [Database Dictionary](database/database-dictionary.md)
- [Migration Convention](database/migration-convention.md)
- [Accounting Engine](accounting/accounting-engine.md)
- [Posting Engine](accounting/posting-engine.md)
- [Accounting Convention](accounting/accounting-convention.md)
- [Coding Convention](development/coding-convention.md)
- [Testing Convention](development/testing-convention.md)
- [Security Model](security/security-model.md)
- [Domain Glossary](glossary/domain-glossary.md)
- [Inventory Glossary](glossary/inventory-glossary.md)
- [Domain Dictionary](glossary/domain-dictionary.md)
- [Product Vision](vision/product-vision.md)
- [Templates](templates/)

## Current Project State

- Current implementation target: [Phase 20 — Inventory Documents](phases/phase-20-inventory-documents-plan.md)
- Phase 20 module record: [Inventory Documents Module](modules/inventory-documents.md)
- Phase 20 quantity foundation, SQLite/Desktop integration and quality gates are implemented through Step 21; full Step 21 executable/manual validation remains owner-run before final Step 22 closure.
- Next architectural dependency: Phase 21 Inventory Valuation consumes immutable Phase 20 movement facts without rewriting quantity history.
- Canonical roadmap: [`ROADMAP.md`](../ROADMAP.md)

## Source-of-Truth Policy

Each topic has one canonical document. Other files link to it rather than duplicate normative rules. ADRs explain why a decision was made; canonical documents describe the current rule; phase documents record what changed.
