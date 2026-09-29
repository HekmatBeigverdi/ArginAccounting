import assert from "node:assert/strict";
import test from "node:test";

import {
  oncePerPurchaseSubmission,
  purchaseWorkflowKey,
  withPurchaseWorkflowLock,
} from "../src/composition/purchase-workflow-hardening.ts";

test("purchase workflow lock serializes mutations for the same invoice", async () => {
  const events: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });

  const first = withPurchaseWorkflowLock("company:invoice", async () => {
    events.push("first:start");
    await firstGate;
    events.push("first:end");
    return 1;
  });

  await Promise.resolve();

  const second = withPurchaseWorkflowLock("company:invoice", async () => {
    events.push("second:start");
    events.push("second:end");
    return 2;
  });

  await Promise.resolve();
  assert.deepEqual(events, ["first:start"]);

  releaseFirst();
  assert.equal(await first, 1);
  assert.equal(await second, 2);
  assert.deepEqual(events, [
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("different purchase documents do not block each other", async () => {
  const events: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });

  const first = withPurchaseWorkflowLock("company:invoice-1", async () => {
    events.push("one");
    await gate;
  });
  const second = withPurchaseWorkflowLock("company:invoice-2", async () => {
    events.push("two");
  });

  await second;
  assert.deepEqual(events.sort(), ["one", "two"]);
  release();
  await first;
});

test("same submission token reuses the same in-flight and successful result", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });

  const first = oncePerPurchaseSubmission("receipt-submission-1", async () => {
    calls += 1;
    await gate;
    return { id: "receipt-1" };
  });
  const duplicate = oncePerPurchaseSubmission("receipt-submission-1", async () => {
    calls += 1;
    return { id: "receipt-2" };
  });

  assert.equal(first, duplicate);
  assert.equal(calls, 1);
  release();

  assert.deepEqual(await first, { id: "receipt-1" });
  assert.deepEqual(await oncePerPurchaseSubmission(
    "receipt-submission-1",
    async () => ({ id: "receipt-3" }),
  ), { id: "receipt-1" });
  assert.equal(calls, 1);
});

test("failed submission is released so an explicit retry can execute again", async () => {
  let calls = 0;
  await assert.rejects(
    () => oncePerPurchaseSubmission("receipt-failure", async () => {
      calls += 1;
      throw new Error("boom");
    }),
    /boom/u,
  );

  // Let the rejection cleanup microtask run.
  await Promise.resolve();

  const result = await oncePerPurchaseSubmission("receipt-failure", async () => {
    calls += 1;
    return "recovered";
  });
  assert.equal(result, "recovered");
  assert.equal(calls, 2);
});

test("workflow identity rejects blank company/document ids", () => {
  assert.equal(purchaseWorkflowKey(" company ", " invoice "), "company:invoice");
  assert.throws(() => purchaseWorkflowKey("", "invoice"), /identity_required/u);
  assert.throws(() => purchaseWorkflowKey("company", " "), /identity_required/u);
});

test("Step 31 desktop composition uses submission tokens, serialization and deterministic posting recovery", async () => {
  const { readFile } = await import("node:fs/promises");
  const purchase = await readFile(
    new URL("../src/composition/purchase/create-purchase-workspace-services.ts", import.meta.url),
    "utf8",
  );
  const posting = await readFile(
    new URL("../src/composition/purchase-posting/create-purchase-posting-workspace-services.ts", import.meta.url),
    "utf8",
  );
  const page = await readFile(
    new URL("../src/pages/purchase/purchase-documents-page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(purchase, /oncePerPurchaseSubmission/u);
  assert.match(purchase, /withPurchaseWorkflowLock/u);
  assert.match(purchase, /submissionId/u);
  assert.match(purchase, /PURCHASE_APP_VERSION_CONFLICT/u);
  assert.match(posting, /withPurchaseWorkflowLock/u);
  assert.match(posting, /const raced = await context\.postings\.findById/u);
  assert.match(page, /receiptSubmissionId/u);
  assert.match(page, /crypto\.randomUUID\(\)/u);
  assert.match(page, /\|\| saving\) return/u);
});
