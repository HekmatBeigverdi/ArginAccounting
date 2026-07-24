# ArginAccounting Coding Convention

## Mandatory Principles

- English identifiers and technical contracts; Persian user-facing text.
- Strict TypeScript; avoid implicit `any` and unsafe assertions.
- Domain logic must remain framework-, database-, and UI-independent.
- Prefer explicit value objects, discriminated unions, domain errors, and immutable inputs.
- Application services enforce authorization, orchestration, transaction boundaries, and idempotency.
- Infrastructure implements contracts and contains SQL, Tauri, filesystem, network, and framework details.
- UI components must not contain accounting rules or direct persistence operations.

## Naming

- Packages: `@argin/<module>` and `@argin/<module>-tauri`.
- Files: lowercase kebab-case.
- Types/classes: PascalCase.
- Variables/functions: camelCase.
- Permission codes: `<module>.<resource>.<action>`.
- Database objects: lowercase snake_case.

## Reliability

- Never use floating point for monetary storage or arithmetic.
- Multi-record writes must be atomic.
- Stale updates must fail explicitly.
- Errors must preserve actionable context without exposing secrets.
- Public contracts require tests and documentation.

## Review Gate

A change is not complete until formatting, type checks, tests, build checks, migrations, documentation, and security implications are reviewed. Record only validations that were actually executed.
