# ADR-0008 — Approval Workflow with Optimistic Concurrency

- Status: Accepted
- Date: 2026-07-25

## Context

Approval requests may be acted on concurrently and must preserve a trustworthy history.

## Decision

Approval transitions use an explicit state machine, append-only history, permission checks, and version-based optimistic concurrency. Request, history, and audit changes commit atomically.

## Consequences

Conflicting decisions fail explicitly instead of overwriting each other. Clients must surface conflict and refresh behaviour.