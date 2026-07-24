# Coding Standards

## Language and Naming

Source identifiers, database identifiers, contracts, tests, commits, and repository documentation use English. End-user UI uses Persian, RTL, Jalali presentation, and Iranian Rial terminology.

## TypeScript

- Enable strict typing; avoid `any` and unsafe assertions.
- Prefer explicit domain types and value objects over primitive obsession.
- Keep domain code free of Tauri, React, SQLite, and transport dependencies.
- Public APIs require stable exports and tests.
- Errors are structured and typed; do not use message parsing for control flow.

## Architecture

Dependencies point inward: UI and infrastructure depend on application/domain contracts, never the reverse. Cross-module access uses public contracts, events, or application services. Direct writes into another module's tables are prohibited.

## Data and Money

Use UTC Gregorian storage and Jalali conversion at boundaries. Never use binary floating point for financial values. Preserve currency and precision explicitly.

## Quality

Changes must include relevant tests, migration notes, permission impact, documentation updates, and validation commands. Formatting-only refactors must not alter behaviour.

## Commits

Use focused conventional messages such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`. Never combine unrelated architectural and cosmetic changes in one commit.
