# Database Dictionary

This dictionary is the canonical catalog of database objects. It complements migration files and must describe the current schema without replacing the migrations.

## Table Entry Format

For every table record:

- table name and owning module;
- business purpose;
- primary key strategy;
- company, branch, and fiscal scopes;
- important columns and data types;
- foreign keys and delete behavior;
- unique constraints and indexes;
- audit and concurrency columns;
- creating and modifying migrations;
- retention, archival, and sensitivity classification.

## Current High-Level Catalog

| Area | Tables | Introduced |
|---|---|---|
| Company and Branch | Company and branch persistence objects | Phase 05 |
| Fiscal Management | Fiscal years and periods | Phase 06 |
| Security | Users, roles, permissions, assignments, branch access | Phase 07 |
| Audit and Approval | `audit_entries`, `approval_requests`, `approval_history` | Phase 08 |

The detailed column-level catalog must be expanded whenever a migration adds or changes a database object.
