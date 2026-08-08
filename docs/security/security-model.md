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

Permission names follow `<module>.<resource>.<action>`. Seed changes are versioned and tested. UI gates improve usability but never replace application authorization.

### Chart of Accounts

- `accounting.chart-of-accounts.view`
- `accounting.chart-of-accounts.create`
- `accounting.chart-of-accounts.update`
- `accounting.chart-of-accounts.move`
- `accounting.chart-of-accounts.change-status`
- `accounting.chart-of-accounts.manage-settings`
- `accounting.chart-of-accounts.delete`

`system.full-access` covers all Chart of Accounts operations. Mutations preserve company scope, actor identity, source, correlation ID, and causation ID in audit events.

### Accounting Dimensions

- `accounting.dimensions.view`
- `accounting.dimensions.create`
- `accounting.dimensions.update`
- `accounting.dimensions.change-status`
- `accounting.dimensions.delete`
- `accounting.dimensions.manage-policies`

Dimension operations are company-scoped and authorized at the Application Service boundary. Mutations use optimistic concurrency and publish complete before/after audit evidence only after the transaction commits.

### Coding Templates

- `accounting.coding-templates.view`
- `accounting.coding-templates.create`
- `accounting.coding-templates.update-draft`
- `accounting.coding-templates.publish`
- `accounting.coding-templates.retire`
- `accounting.coding-templates.preview`
- `accounting.coding-templates.apply`
- `accounting.coding-templates.upgrade`
- `accounting.coding-templates.import`
- `accounting.coding-templates.view-history`

Template lifecycle and company application/import commands are authorized at the Application Service boundary. Built-in mutation is restricted to privileged system administration. Atomic failure and rollback publish no success event; committed events preserve actor, company, source, correlation, causation, version, fingerprint, and request identity.

## Audit and Approval

Audit history is append-only. Approval transitions require valid state, permission, scope, actor, and optimistic-concurrency version. Multi-record changes commit atomically.

Chart of Accounts changes publish audit events only after successful commit. Physical deletion records the complete previous account snapshot. Used accounts cannot be deleted; policy-controlled code changes and stale versions are rejected at the application boundary.

## Future Online Runtime

The future API must preserve the same application authorization contracts and add secure token validation, transport security, rate limits, and server-side tenant enforcement.
