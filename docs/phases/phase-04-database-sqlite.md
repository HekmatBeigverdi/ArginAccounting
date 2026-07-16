# Phase 04 - Database Abstraction and SQLite

## Goal

Establish the database abstraction layer and connect the desktop
application to a local SQLite database.

## Scope

- Database-independent TypeScript contracts
- Tauri SQLite infrastructure adapter
- Official Tauri SQL plugin
- Versioned Rust-managed migrations
- SQLite connection configuration
- Database health check
- Persian desktop database status
- Tauri SQL permissions

## Architecture

The database contract package does not depend on:

- SQLite
- PostgreSQL
- Tauri
- React
- Next.js
- ASP.NET Core

The Tauri-specific implementation is isolated in:

`@argin/database-tauri`

## Migration Strategy

Desktop migrations are registered through the Tauri SQL plugin.

Each migration has:

- Unique version
- Description
- SQL source
- Migration direction

Migrations are executed transactionally by the plugin.

## Initial Schema

Phase 04 creates infrastructure metadata only.

Business tables are intentionally deferred:

- Company tables: Phase 05
- Fiscal tables: Phase 06
- Accounting tables: Phase 09 and later
- Journal tables: Phase 12

## Database Configuration

- Provider: SQLite
- Database file: `argin-accounting.db`
- Foreign keys: enabled
- Busy timeout: 5000 milliseconds
- Currency metadata: IRR
- UI calendar metadata: Jalali

## Localization

- Desktop UI: Persian
- Direction: RTL
- Storage currency: Iranian Rial
- Business date presentation: Jalali
- Technical identifiers: English

## Acceptance Criteria

- Database contracts pass TypeScript validation
- Tauri SQLite adapter passes TypeScript validation
- Desktop application starts successfully
- SQLite database is created outside the repository
- Initial migration is applied
- Database health check succeeds
- Foreign key enforcement is enabled
- Application restart does not reapply completed migrations incorrectly
