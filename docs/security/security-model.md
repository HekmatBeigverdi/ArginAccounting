# Security Model

## Scope

Security covers identity, authenticated session, roles, permissions, company and branch access, approval authority, audit visibility, and sensitive-data handling.

## Principles

- Deny by default.
- Authorization is enforced in application services, not only in UI.
- Permissions are explicit capabilities, not inferred from page access.
- Company and branch scope is validated for every protected operation.
- Approval authority is separate from document creation where segregation of duties applies.
- Sensitive values are excluded or sanitized in logs and audit snapshots.
- Security-relevant mutations are auditable.

## Session

Desktop sessions expose a stable authenticated principal and selected organizational context. Infrastructure credentials and secrets never enter domain models or persisted audit snapshots.

## Permissions

Permission names follow `<module>.<resource>.<action>`. Seed changes are versioned and tested. UI gates improve usability but never replace backend/application authorization.

## Audit and Approval

Audit history is append-only. Approval transitions require valid state, permission, scope, actor, and optimistic-concurrency version. Multi-record changes commit atomically.

## Future Online Runtime

The future API must preserve the same application authorization contracts and add secure token validation, transport security, rate limits, and server-side tenant enforcement.