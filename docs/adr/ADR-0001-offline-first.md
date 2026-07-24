# ADR-0001 — Offline-First Architecture

- Status: Accepted
- Date: 2026-07-25

## Context

Iranian accounting users require reliable desktop operation without continuous network access.

## Decision

The first production runtime is a Tauri desktop application with local SQLite persistence. Core workflows must remain usable offline.

## Consequences

Local migrations, deterministic synchronization identifiers, conflict handling, backup, and future sync boundaries are first-class concerns. Cloud-only dependencies are prohibited in core accounting workflows.