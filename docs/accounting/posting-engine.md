# Posting Engine

## Purpose

The Posting Engine converts approved source documents into deterministic accounting entries without embedding source-module business logic in the accounting core.

## Contract

A source module submits a posting request containing source identity, operation, company and branch scope, fiscal context, document date, currency values, dimensions, and rule inputs. The engine resolves a versioned posting rule and returns a balanced journal proposal or explicit validation errors.

## Principles

- Deterministic: identical inputs and rule versions produce identical outputs.
- Idempotent: a source operation cannot create duplicate postings.
- Traceable: every generated line links to source, rule, and correlation ID.
- Atomic: source status, posting record, journal voucher, number series, and audit evidence commit together.
- Versioned: rule changes never reinterpret historical postings.
- Reversible: cancellation uses explicit reversal policy rather than deletion.
- Extensible: modules integrate through contracts, not direct accounting-table writes.

## Rule Model

Rules will define applicability, conditions, account resolution, debit/credit formulas, dimensions, descriptions, aggregation, currency treatment, and validation requirements.

## Failure Behaviour

Failures return structured errors and leave no partial financial state. Retryable infrastructure failures are distinguished from domain validation failures.

## Security

Posting requires explicit permission and approved source state. Generated entries remain subject to fiscal-period, account, dimension, and concurrency validation.
