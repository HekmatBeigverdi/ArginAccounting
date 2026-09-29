import assert from "node:assert/strict";
import test from "node:test";

import { defaultPermissions } from "../src/index.ts";

test("default Security catalog includes independent Purchase Posting permissions", () => {
  const codes = new Set(defaultPermissions.map(item => item.code));
  for (const code of [
    "purchases.posting.view",
    "purchases.posting.execute",
    "purchases.posting.reverse",
    "purchases.posting.rules.manage",
    "purchases.posting.trace.view",
  ]) {
    assert.equal(codes.has(code), true, code);
  }
});
