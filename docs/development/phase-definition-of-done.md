# Phase Definition of Done

A phase is complete only when all applicable criteria are satisfied and evidence is recorded.

## Product and Scope

- Objectives and exclusions are implemented as documented.
- User-facing Persian, RTL, Jalali, and Rial requirements are preserved.
- Known limitations and deferred work are explicit.

## Architecture and Code

- Domain boundaries and dependency direction are preserved.
- Public contracts, errors, concurrency, idempotency, and transaction behavior are documented.
- Relevant ADRs and module registry entries are current.

## Data and Security

- Migrations follow the migration convention and database dictionary is current.
- Permissions are enforced at application boundaries.
- Audit, approval, privacy, secret handling, and retention impacts are addressed.

## Accounting

- Accounting convention is satisfied.
- Balance, scope, posting eligibility, source integrity, correction/reversal, and rounding behavior are tested where applicable.

## Quality Evidence

- Required automated and manual validations were actually executed.
- Exact commands, results, failures, and unresolved risks are recorded truthfully.
- No phase is marked validated solely because test files or commands exist.

## Documentation and Delivery

- Phase checklist is complete.
- Roadmap, changelog, canonical documents, dictionaries, registries, ADRs, and generated index are updated.
- Internal links are valid.
- The branch and release procedure follows `CONTRIBUTING.md` and the release checklist.
