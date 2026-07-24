# ADR-0003 — Modular Monolith

- Status: Accepted
- Date: 2026-07-25

## Context

The ERP requires strong module boundaries but does not yet justify distributed-system complexity.

## Decision

Use a modular monolith with independently owned domain, application, infrastructure, and UI packages.

## Consequences

Modules communicate through public contracts and events. Direct private imports and cross-module table writes are prohibited. Future service extraction remains possible without premature operational overhead.