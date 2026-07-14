# Contributing to ArginAccounting

## Branches

- main
- develop
- phase/*
- fix/*
- release/*

## Commit Messages

Use English commit messages.

Examples:

feat: add chart of accounts domain
fix: prevent posting unbalanced journal
docs: add accounting architecture decision
refactor: extract posting rule service
test: add journal voucher validation tests

## Pull Requests

Each phase must be developed in a dedicated branch.

A phase branch must be merged into develop using a non-fast-forward merge.

## Documentation

Technical documentation must be written in English.

## Code Language

Code identifiers must be written in English.

## UI Language

User-facing text must be written in Persian.

## Database Changes

Database schema changes must be applied through versioned migrations.

## Accounting Rules

Accounting rules must not be implemented inside UI components.
