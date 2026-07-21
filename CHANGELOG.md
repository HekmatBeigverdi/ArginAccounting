# Changelog

All notable changes to this project will be documented here.

---

## [0.7.0] - Unreleased

### Added

- Local user management
- Role management
- Permission catalog
- Role permission assignment
- User role assignment
- User branch access assignment
- Local login page
- Argon2id password hashing through Tauri commands
- Failed login tracking and temporary account locking
- Security bootstrap on desktop startup
- System administrator role
- Initial administrator application service

### Database

- Added `users`
- Added `roles`
- Added `permissions`
- Added `user_roles`
- Added `role_permissions`
- Added `user_branch_access`

### Security

- Passwords are never stored in plain text
- Authentication and authorization are separated
- Permissions are assigned through roles
- Branch access is assigned directly to users
- The system administrator role receives all active permissions
- No hard-coded production administrator password is introduced

### Desktop

- Added `/login`
- Added `/security/users`
- Added `/security/roles`
- Added `/security/permissions`
- Added temporary development navigation to the login page

### Architecture

- Added security domain and application services
- Added SQLite security repositories
- Added Tauri password hashing commands
- Added desktop security bootstrap provider
