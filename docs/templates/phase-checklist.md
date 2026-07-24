# Phase Checklist

## Planning

- [ ] Phase number and name match `ROADMAP.md`
- [ ] Scope, exclusions, risks, and dependencies documented
- [ ] Relevant ADRs identified
- [ ] Package, module, permission, migration, and UI impact identified

## Implementation

- [ ] Domain rules implemented outside UI and infrastructure
- [ ] Application services enforce permissions and transactions
- [ ] Infrastructure implements contracts without leaking dependencies inward
- [ ] Multi-record writes are atomic
- [ ] Concurrency and idempotency are addressed
- [ ] Persian/RTL, Jalali, and Rial requirements are preserved

## Database

- [ ] New migrations follow migration convention
- [ ] Released migrations remain unchanged
- [ ] Database dictionary updated
- [ ] New and upgrade scenarios documented

## Testing and Validation

- [ ] Required test categories implemented
- [ ] Commands actually executed are recorded with real results
- [ ] Manual scenarios are recorded
- [ ] No unverified success claim exists

## Documentation

- [ ] Phase document follows template
- [ ] ROADMAP and CHANGELOG updated
- [ ] Canonical documents updated
- [ ] Module and ADR registries updated
- [ ] Domain and database dictionaries updated
- [ ] Generated document index refreshed
- [ ] Internal links checked

## Release Readiness

- [ ] Known limitations recorded
- [ ] Secrets, generated databases, and build artifacts excluded
- [ ] Definition of Done satisfied
- [ ] Merge and release strategy confirmed
