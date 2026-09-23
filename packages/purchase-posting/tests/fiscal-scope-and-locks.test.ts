import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_POSTING_DOMAIN_ERROR_CODES,
  PurchasePostingDomainError,
  assertPurchasePostingFiscalScope,
} from "../src/index.ts";

function context(overrides: Partial<{
  companyId: string;
  fiscalYearId: string;
  fiscalYearStartDate: string;
  fiscalYearEndDate: string;
  fiscalYearStatus: "draft" | "open" | "closing" | "closed";
  fiscalPeriodId: string;
  fiscalPeriodStartDate: string;
  fiscalPeriodEndDate: string;
  fiscalPeriodStatus: "open" | "locked" | "closed";
}> = {}) {
  return {
    companyId: "company-001",
    fiscalYearId: "fy-1405",
    fiscalYearStartDate: "2026-03-21",
    fiscalYearEndDate: "2027-03-20",
    fiscalYearStatus: "open" as const,
    fiscalPeriodId: "fp-07",
    fiscalPeriodStartDate: "2026-09-01",
    fiscalPeriodEndDate: "2026-09-30",
    fiscalPeriodStatus: "open" as const,
    ...overrides,
  };
}

function deps(input?: {
  ctx?: ReturnType<typeof context> | null;
  lockedScopes?: readonly ("all" | "accounting" | "purchases")[];
  lockedThroughDate?: string;
}) {
  return {
    fiscalContext: {
      async resolve() {
        return input?.ctx === undefined ? context() : input.ctx;
      },
    },
    historicalLocks: {
      async findActiveLocks(
        _companyId: string,
        _branchId: string | null,
        scope: "all" | "accounting" | "purchases",
      ) {
        return input?.lockedScopes?.includes(scope)
          ? [{ scope, lockedThroughDate: input.lockedThroughDate ?? "2026-09-23" }]
          : [];
      },
    },
  };
}

const scope = {
  companyId: "company-001",
  branchId: "branch-001",
  fiscalYearId: "fy-1405",
  fiscalPeriodId: "fp-07",
  operationDate: "2026-09-23",
};

test("accepts posting date inside matching open fiscal year and period", async () => {
  const resolved = await assertPurchasePostingFiscalScope(scope, deps());
  assert.equal(resolved.fiscalYearId, "fy-1405");
  assert.equal(resolved.fiscalPeriodId, "fp-07");
});

test("rejects missing fiscal context", async () => {
  await assert.rejects(
    () => assertPurchasePostingFiscalScope(scope, deps({ ctx: null })),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalContextMissing);
      return true;
    },
  );
});

test("rejects fiscal year mismatch", async () => {
  await assert.rejects(
    () => assertPurchasePostingFiscalScope(scope, deps({
      ctx: context({ fiscalYearId: "fy-other" }),
    })),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalScopeMismatch);
      return true;
    },
  );
});

test("rejects closed fiscal year", async () => {
  await assert.rejects(
    () => assertPurchasePostingFiscalScope(scope, deps({
      ctx: context({ fiscalYearStatus: "closed" }),
    })),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalYearNotOpen);
      return true;
    },
  );
});

for (const status of ["locked", "closed"] as const) {
  test(`rejects fiscal period status ${status}`, async () => {
    await assert.rejects(
      () => assertPurchasePostingFiscalScope(scope, deps({
        ctx: context({ fiscalPeriodStatus: status }),
      })),
      (error: unknown) => {
        assert.ok(error instanceof PurchasePostingDomainError);
        assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalPeriodNotOpen);
        return true;
      },
    );
  });
}

test("rejects operation date outside resolved period", async () => {
  await assert.rejects(
    () => assertPurchasePostingFiscalScope(scope, deps({
      ctx: context({
        fiscalPeriodStartDate: "2026-10-01",
        fiscalPeriodEndDate: "2026-10-31",
      }),
    })),
    (error: unknown) => {
      assert.ok(error instanceof PurchasePostingDomainError);
      assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.fiscalDateOutOfRange);
      return true;
    },
  );
});

for (const lockScope of ["all", "accounting", "purchases"] as const) {
  test(`rejects active ${lockScope} historical lock covering operation date`, async () => {
    await assert.rejects(
      () => assertPurchasePostingFiscalScope(scope, deps({
        lockedScopes: [lockScope],
        lockedThroughDate: "2026-09-23",
      })),
      (error: unknown) => {
        assert.ok(error instanceof PurchasePostingDomainError);
        assert.equal(error.code, PURCHASE_POSTING_DOMAIN_ERROR_CODES.historicalLockBlocked);
        return true;
      },
    );
  });
}

test("allows date after historical lock boundary", async () => {
  const resolved = await assertPurchasePostingFiscalScope(scope, deps({
    lockedScopes: ["accounting"],
    lockedThroughDate: "2026-09-22",
  }));
  assert.equal(resolved.fiscalPeriodStatus, "open");
});

test("reversal can resolve destination fiscal period without original fiscal ids", async () => {
  const resolved = await assertPurchasePostingFiscalScope({
    companyId: "company-001",
    branchId: "branch-001",
    fiscalYearId: null,
    fiscalPeriodId: null,
    operationDate: "2026-09-23",
  }, deps());

  assert.equal(resolved.fiscalYearId, "fy-1405");
  assert.equal(resolved.fiscalPeriodId, "fp-07");
});
