import assert from "node:assert/strict";
import test from "node:test";

import {
  JournalBackedAccountingDimensionUsageReader,
  JournalBackedAccountUsageReader,
} from "../src/application/journal-backed-usage-readers.ts";
import type { AccountUsageReader } from "../src/contracts/account-usage-reader.ts";
import type { AccountingDimensionUsageReader } from "../src/contracts/accounting-dimension-usage-reader.ts";
import type { JournalVoucherUsageReader } from "../src/contracts/journal-voucher-repository.ts";

function createJournalUsage(overrides: Partial<JournalVoucherUsageReader> = {}): JournalVoucherUsageReader {
  return {
    isAccountUsed: async () => false,
    isDimensionTypeUsed: async () => false,
    isDimensionMemberUsed: async () => false,
    ...overrides,
  };
}

test("account usage is true when journal lines reference the account", async () => {
  const reader = new JournalBackedAccountUsageReader(
    createJournalUsage({ isAccountUsed: async (id) => id === "account-1" }),
  );

  assert.equal(await reader.hasFinancialActivity("company-1", "account-1"), true);
  assert.equal(await reader.hasFinancialActivity("company-1", "account-2"), false);
});

test("account usage preserves existing fallback activity checks", async () => {
  const fallback: AccountUsageReader = {
    hasFinancialActivity: async (_companyId, accountId) => accountId === "legacy-used",
  };
  const reader = new JournalBackedAccountUsageReader(createJournalUsage(), fallback);

  assert.equal(await reader.hasFinancialActivity("company-1", "legacy-used"), true);
});

test("dimension type usage is true when journal assignments reference the type", async () => {
  const reader = new JournalBackedAccountingDimensionUsageReader(
    createJournalUsage({
      isDimensionTypeUsed: async (id) => id === "type-1",
    }),
  );

  assert.equal(await reader.isDimensionTypeInUse("company-1", "type-1"), true);
  assert.equal(await reader.isDimensionTypeInUse("company-1", "type-2"), false);
});

test("dimension member usage is true when journal assignments reference the member", async () => {
  const reader = new JournalBackedAccountingDimensionUsageReader(
    createJournalUsage({
      isDimensionMemberUsed: async (id) => id === "member-1",
    }),
  );

  assert.equal(await reader.isMemberInUse("company-1", "member-1"), true);
  assert.equal(await reader.isMemberInUse("company-1", "member-2"), false);
});

test("dimension usage preserves structural Phase 11 checks", async () => {
  const structural: AccountingDimensionUsageReader = {
    isDimensionTypeInUse: async (_companyId, id) => id === "type-with-members",
    isMemberInUse: async (_companyId, id) => id === "parent-member",
  };
  const reader = new JournalBackedAccountingDimensionUsageReader(
    createJournalUsage(),
    structural,
  );

  assert.equal(
    await reader.isDimensionTypeInUse("company-1", "type-with-members"),
    true,
  );
  assert.equal(await reader.isMemberInUse("company-1", "parent-member"), true);
});

test("journal usage short-circuits fallback readers", async () => {
  let fallbackCalls = 0;
  const fallback: AccountUsageReader = {
    hasFinancialActivity: async () => {
      fallbackCalls += 1;
      return false;
    },
  };
  const reader = new JournalBackedAccountUsageReader(
    createJournalUsage({ isAccountUsed: async () => true }),
    fallback,
  );

  assert.equal(await reader.hasFinancialActivity("company-1", "account-1"), true);
  assert.equal(fallbackCalls, 0);
});
