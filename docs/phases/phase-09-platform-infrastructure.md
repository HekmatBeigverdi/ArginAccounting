# Phase 09 — Platform Infrastructure

## Status

Planned.

## Overview

This phase establishes shared platform capabilities before the accounting, inventory, sales, purchases, treasury, and extended ERP modules are implemented. Completing them now prevents repeated cross-module refactoring.

## Objectives

- Event Bus
- Money value objects and currency policy
- Query Framework
- Number Series Engine
- Metadata Engine
- Notification infrastructure
- Plugin Contracts
- Shared Data Access
- Standard Optimistic Concurrency
- Background Jobs

## Scope

The phase defines contracts, domain-neutral implementations, SQLite/Tauri adapters where required, tests, documentation, and desktop composition. It does not implement Chart of Accounts or business-module workflows.

## Architecture

Platform contracts must remain domain-neutral, deterministic, testable, and portable to the future ASP.NET Core/PostgreSQL runtime. Business modules depend on these contracts; the platform must not depend on business modules.

## Required Deliverables

- Shared packages with stable public exports
- Error and result conventions
- Transaction and Unit of Work integration
- Idempotency and correlation contracts
- Concurrency tokens and conflict errors
- Persistent job and notification models where applicable
- Plugin compatibility/version contracts
- Query filtering, sorting, projection, and pagination contracts
- Comprehensive unit and SQLite integration tests

## Security

Background work, notifications, metadata access, and plugin execution must preserve company/branch scope, actor context where available, permission boundaries, and audit correlation.

## Validation

Validation evidence must record commands actually executed. Existing but unexecuted tests must not be reported as passing.

## Documentation Impact

Update architecture, database, testing, security, module guidelines, glossary, ADRs, roadmap, changelog, and release checklist.

## Exit Criteria

All ten platform capabilities have approved contracts, implementations, tests, composition wiring, migrations where required, canonical documentation, and successful validation evidence.

## Next Phase

Phase 10 — Chart of Accounts.
