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

Run the generator after adding, moving, renaming, or deleting documentation files.

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
- [Domain Dictionary](glossary/domain-dictionary.md)
- [Product Vision](vision/product-vision.md)
- [Templates](templates/)

## Current Project State

- Latest completed phase: [Phase 14 — UI Foundation Consolidation](phases/phase-14-ui-foundation-consolidation.md)
- Latest released version: `v0.14.0`
- Phase 14 architecture decision: [ADR-0014 — UI Foundation and Global Display Density](adr/ADR-0014-ui-foundation-and-global-density.md)
- Current delivery target: Phase 15 — Journal Lifecycle
- Canonical roadmap: [`ROADMAP.md`](../ROADMAP.md)

## Source-of-Truth Policy

Each topic has one canonical document. Other files link to it rather than duplicate normative rules. ADRs explain why a decision was made; canonical documents describe the current rule; phase documents record what changed.
