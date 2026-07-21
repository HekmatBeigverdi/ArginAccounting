# Phase 07 — Security and Local Authentication

## Status

Completed

## Objective

Phase 07 establishes the local security foundation for the
ArginAccounting desktop application.

The phase introduces local users, roles, permissions, role-based
authorization, branch access restrictions, password hashing, login
validation, and security bootstrap behavior.

## Scope

This phase includes:

- Local user management
- Local role management
- Permission catalog
- User-to-role assignments
- Role-to-permission assignments
- User-to-branch access assignments
- Argon2id password hashing
- Local authentication
- Failed login tracking
- Temporary account locking
- Security bootstrap
- Initial administrator application service
- Development-only login navigation

## Database

Migration:

`0004_security.sql`

Tables introduced:

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `user_branch_access`

## Authentication

Passwords are never stored in plain text.

Password hashing and verification are performed through Tauri commands
implemented in Rust using Argon2id.

Authentication validates:

- Username normalization
- User status
- Temporary lock state
- Password hash
- Failed login count
- Successful login timestamp

After five failed login attempts, the account is temporarily locked for
fifteen minutes.

## Authorization Model

ArginAccounting uses role-based access control.

The effective authorization path is:

`User -> UserRole -> Role -> RolePermission -> Permission`

Branch access is managed independently:

`User -> UserBranchAccess -> Branch`

This allows users with the same role to have different branch scopes.

## System Administrator Role

Security bootstrap creates the system role:

`SYSTEM-ADMINISTRATOR`

This role receives all active permissions.

The role is system-managed and its permissions cannot be restricted from
the desktop user interface.

## Security Bootstrap

Security bootstrap runs when the desktop application starts.

It performs the following idempotent operations:

1. Upserts the default permission catalog.
2. Creates the system administrator role when missing.
3. Assigns all active permissions to the administrator role.

The bootstrap process does not create a default password or hard-coded
administrator account.

## Initial Administrator

The security application layer includes a service for creating the first
administrator.

The final product setup wizard will use this service when the local
database contains no users.

The first administrator:

- Selects their own username and password
- Receives the `SYSTEM-ADMINISTRATOR` role
- Receives access to selected branches
- Is not created from hard-coded credentials

## Desktop Pages

The following desktop routes are available:

- `/security/users`
- `/security/roles`
- `/security/permissions`
- `/login`

The login route remains development-accessible during this phase.
Mandatory startup authentication will be enabled after the initial setup
and session infrastructure are completed.

## Security Decisions

- Authentication and authorization remain separate concerns.
- Permissions are assigned to roles rather than directly to users.
- Branch access is assigned directly to users.
- System role permissions are maintained by bootstrap.
- No plaintext or hard-coded production password is allowed.
- Business UI remains Persian and RTL.
- Internal security identifiers and permission codes remain English.

## Verification

The phase is considered complete when:

- Security migration applies successfully.
- Default permissions are seeded.
- The system administrator role exists.
- The administrator role owns all active permissions.
- Users can be created.
- Roles can be created.
- Permissions can be assigned to non-system roles.
- Roles can be assigned to users.
- Branch access can be assigned to users.
- Password hashing and verification work.
- Failed login lock behavior works.
- Desktop and workspace type checks pass.
- Desktop application build succeeds.

## Deferred Work

The following items are intentionally deferred:

- Mandatory login on application startup
- Persistent session provider
- Logout workflow
- Initial setup wizard UI
- Password change on first login
- Online identity integration
- Remote authentication
- Token-based web authentication
