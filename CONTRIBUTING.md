# Contributing to ArginAccounting

All contributions must follow the permanent [Documentation Governance](docs/development/documentation-governance.md), [Coding Standards](docs/development/coding-standards.md), [Module Guidelines](docs/development/module-guidelines.md), and [Testing Strategy](docs/development/testing-strategy.md).

## Language

- Source, database, contracts, commits, and technical documentation: English
- End-user application text: Persian
- Desktop layout: RTL
- Business date presentation: Jalali
- Internal dates: Gregorian; system timestamps: UTC
- Primary accounting currency: Iranian Rial

## Branches

- `main`: stable integrated baseline
- `develop`: integration branch
- `phase/*`: phase work
- `fix/*`: focused corrections
- `release/*`: release preparation
- `docs/*`: documentation-only refactoring

Create phase branches from current `develop`. Merge only after implementation, documentation, and actual validation evidence are complete. Do not rewrite shared history.

## Architecture

- Domain packages never import UI, Tauri, SQL drivers, HTTP frameworks, or file APIs.
- Application services own authorization and orchestration.
- Infrastructure implements ports for a runtime or database.
- UI consumes application services through composition roots.
- Modules do not write directly to another module's tables.
- Financial and workflow multi-writes are atomic.
- Released migrations are immutable.
- Monetary values never use binary floating point.

## Pull Requests

Every pull request must identify purpose, scope, architectural decisions, migrations, permissions, user-facing effects, tests, validation results, known limitations, upgrade notes, and documentation impact.

## Required Validation

```bash
pnpm typecheck
pnpm test
pnpm build
cd apps/desktop/src-tauri
cargo check
```

Run package-specific checks while developing. Never describe tests or builds as passing unless they were executed successfully.

## Documentation Obligations

Every phase must update:

1. `docs/phases/phase-NN-<slug>.md`
2. `ROADMAP.md`
3. `CHANGELOG.md`
4. Relevant canonical documents
5. Relevant ADRs
6. Domain glossary
7. Release checklist when applicable

Use templates under `docs/templates/`. Documentation is part of the Definition of Done.

## Commits

Use focused conventional messages such as:

```text
feat(platform): add money value object
fix(audit): reject stale approval updates
docs: update phase 09 architecture
test(posting): cover idempotent retry
```

Do not mix unrelated behaviour, formatting, and documentation changes in one commit.