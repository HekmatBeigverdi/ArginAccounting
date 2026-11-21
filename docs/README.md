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
- [Sales Posting Reconciliation](accounting/sales-posting-reconciliation.md)
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

- Current implementation target: [Phase 25 — Sales Posting](phases/phase-25-sales-posting.md).
- Phase 25 all 30 fixed steps are complete; canonical Phase 25 Validation #8 passed successfully.
- The fixed 30-step implementation plan remains canonical at [Phase 25 Sales Posting Plan](phases/phase-25-sales-posting-plan.md).
- The accounting reconciliation reference is [Sales Posting Reconciliation and Accounting Examples](accounting/sales-posting-reconciliation.md).
- Phase 25 is based on `main` commit `044a3ed1abbd847da7675c6bf70dcd9510f6f648`, the completed Phase 24 merge baseline, on branch `phase/25-sales-posting`.
- Sales owns selling-price/commercial facts; Inventory owns quantity/movement; Phase 21 owns FIFO/MWA cost; Phase 25 owns Sales-specific accounting orchestration; Accounting owns Journal lifecycle.
- Phase 24 is complete on `main`; semantic `v0.24.0` tag/GitHub Release publication remains manual.
- Phase 25 release target is `v0.25.0` — `ArginAccounting v0.25.0 — Sales Posting`; release-quality PASS is recorded from GitHub Actions run ID `44900925197`.
- Canonical roadmap: [`ROADMAP.md`](../ROADMAP.md)

## Source-of-Truth Policy

Each topic has one canonical document. Other files link to it rather than duplicate normative rules. ADRs explain why a decision was made; canonical documents describe the current rule; phase documents record what changed.
