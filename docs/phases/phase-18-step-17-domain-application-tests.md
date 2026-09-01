# Phase 18 Step 17 — Domain and Application Tests

Status: Completed

## Purpose

Step 17 consolidates persistence-neutral Product/Service Domain and Application coverage before the repository/migration/Desktop integration suite in Step 18.

## Coverage matrix

| Requirement | Coverage |
| --- | --- |
| Product/Service classification, durable identity, lifecycle, category, capabilities | `product-domain.test.ts` |
| Base/alternate units, ratios, precision, rounding and conversion invariants | `product-unit.test.ts` |
| SKU/reference/barcode/external/13-digit Taxpayer identifiers | `product-identifiers.test.ts` |
| Commercial, tax and operational master-data invariants | `product-master-data.test.ts` |
| Application commands, readers, bounds, errors and Unit of Work contracts | `product-application-contracts.test.ts` |
| Create/update, hard/advisory duplicates, idempotency, expectedVersion and reference validation | `product-application-service.test.ts` |
| Company isolation, idempotency scope separation, complete mutation-version chain and request-context regression | `product-application-regression.test.ts` |
| Authorization, audit semantics and secured read/write boundaries | `product-security.test.ts` |
| Bounded future-module selectors and durable Product identity | `product-selector.test.ts` |
| Bulk Application preview/validation/atomic behavior | `product-bulk-transfer.test.ts` |
| Argin Bridge persistence-neutral envelope invariants | `product-sync-contract.test.ts` |
| Taxpayer unit reference normalization/diff behavior | `taxpayer-unit-reference.test.ts` |
| Shared-platform/ERP dependency direction | `product-integration-boundary.test.ts` |

## New regression coverage

Step 17 adds `packages/product/tests/product-application-regression.test.ts` to lock gaps not already covered by prior focused tests:

- a Product belonging to another company is treated as not found by mutation operations;
- idempotency keys include company scope and mutation target boundaries so equal request ids cannot collide across companies or Products;
- identity, units, master-data and lifecycle mutations must consume the version returned by the preceding mutation and advance optimistic versions deterministically;
- malformed request/correlation input is rejected before Product Unit of Work mutation begins;
- removing a unit profile is rejected while default purchase/sales unit references still depend on that unit.

## Boundary assertions

The test suite remains persistence-neutral in Step 17. It does not require SQLite, Tauri, React, HTTP, PostgreSQL or Argin Bridge transport. Real migration, repository, rollback, query/index, CSV/XLSX adapter and Desktop behavior remain Step 18 responsibilities.

## Validation

Repository-owner validation commands:

```bash
pnpm --filter @argin/product test
pnpm --filter @argin/product typecheck
pnpm --filter @argin/product build
```

The assistant runtime cannot execute the repository package suite because direct GitHub/DNS access is unavailable in that isolated environment. This limitation is not treated as passing test evidence.

## Exit assessment

Core Product/Service Domain and Application behavior now has explicit independent coverage for the frozen Step 17 scope. Step 18 may proceed after repository-owner local validation is accepted.
