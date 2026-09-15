import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  assertPurchaseBusinessDateAllowed,
  createPurchaseDocumentScope,
  createPurchaseNumberSeriesRequest,
} from "../src/index.ts";

function assertDomainError(action: () => unknown, code: string, field: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

const scopeInput = {
  companyId: "company-001",
  branchId: "branch-001",
  fiscalYearId: "fy-1405",
  fiscalPeriodId: "fp-1405-06",
  fiscalYearStartDate: "2026-03-21",
  fiscalYearEndDate: "2027-03-20",
  fiscalPeriodStartDate: "2026-08-23",
  fiscalPeriodEndDate: "2026-09-22",
  fiscalYearStatus: "open" as const,
  fiscalPeriodStatus: "open" as const,
  lockedThroughDate: "2026-09-01",
};

test("creates an immutable Company/Branch/Fiscal scope and accepts a valid business date", () => {
  const scope = createPurchaseDocumentScope(scopeInput);
  assert.equal(scope.companyId, "company-001");
  assert.equal(scope.branchId, "branch-001");
  assert.equal(scope.fiscalYearId, "fy-1405");
  assert.equal(scope.fiscalPeriodId, "fp-1405-06");
  assert.ok(Object.isFrozen(scope));
  assert.doesNotThrow(() => assertPurchaseBusinessDateAllowed(scope, "2026-09-15"));
});

test("rejects business dates outside the fiscal period or inside a historical lock", () => {
  const scope = createPurchaseDocumentScope(scopeInput);
  assertDomainError(
    () => assertPurchaseBusinessDateAllowed(scope, "2026-08-20"),
    PURCHASE_DOMAIN_ERROR_CODES.fiscalDateInvalid,
    "businessDate",
  );
  assertDomainError(
    () => assertPurchaseBusinessDateAllowed(scope, "2026-09-01"),
    PURCHASE_DOMAIN_ERROR_CODES.fiscalDateLocked,
    "businessDate",
  );
});

test("rejects non-open fiscal year or period for new Purchase operations", () => {
  const closedYear = createPurchaseDocumentScope({ ...scopeInput, fiscalYearStatus: "closed" });
  assertDomainError(
    () => assertPurchaseBusinessDateAllowed(closedYear, "2026-09-15"),
    PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeBlocked,
    "scope.fiscalYearStatus",
  );
  const lockedPeriod = createPurchaseDocumentScope({ ...scopeInput, fiscalPeriodStatus: "locked" });
  assertDomainError(
    () => assertPurchaseBusinessDateAllowed(lockedPeriod, "2026-09-15"),
    PURCHASE_DOMAIN_ERROR_CODES.fiscalScopeBlocked,
    "scope.fiscalPeriodStatus",
  );
});

test("builds the shared Fiscal Number Series request from Purchase type and scope", () => {
  const scope = createPurchaseDocumentScope(scopeInput);
  assert.deepEqual(createPurchaseNumberSeriesRequest("supplier-invoice", scope), {
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: "fy-1405",
    entityType: "purchase:supplier-invoice",
  });
});
