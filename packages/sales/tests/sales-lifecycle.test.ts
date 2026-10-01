import assert from "node:assert/strict";
import test from "node:test";
import {
  SalesDomainError,
  createSalesLifecycle,
  transitionSalesLifecycle,
} from "../src/index.ts";

const change = (transitionId: string, action: "submit" | "approve" | "reject" | "finalize" | "cancel", reason?: string) => ({
  transitionId, action, actorId: "user-1", occurredAt: "2026-10-01T12:00:00Z", reason,
});

test("runs the canonical draft to finalized lifecycle with audit history", () => {
  let state = createSalesLifecycle("inv-1", "sales-invoice");
  assert.equal(state.status, "draft");
  state = transitionSalesLifecycle(state, change("t1", "submit"));
  state = transitionSalesLifecycle(state, change("t2", "approve"));
  state = transitionSalesLifecycle(state, change("t3", "finalize"));
  assert.equal(state.status, "finalized");
  assert.deepEqual(state.transitions.map((x) => [x.fromStatus, x.action, x.toStatus]), [
    ["draft", "submit", "submitted"],
    ["submitted", "approve", "approved"],
    ["approved", "finalize", "finalized"],
  ]);
});

test("supports rejection back to draft while preserving reason", () => {
  let state = createSalesLifecycle("so-1", "sales-order");
  state = transitionSalesLifecycle(state, change("t1", "submit"));
  state = transitionSalesLifecycle(state, change("t2", "reject", "price requires review"));
  assert.equal(state.status, "draft");
  assert.equal(state.transitions[1]?.reason, "price requires review");
});

test("supports cancellation before finalization", () => {
  let state = createSalesLifecycle("ret-1", "sales-return");
  state = transitionSalesLifecycle(state, change("t1", "submit"));
  state = transitionSalesLifecycle(state, change("t2", "cancel", "customer withdrew return"));
  assert.equal(state.status, "cancelled");
});

test("rejects invalid skips and transitions from terminal states", () => {
  const draft = createSalesLifecycle("cor-1", "sales-correction");
  assert.throws(() => transitionSalesLifecycle(draft, change("t1", "approve")),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.lifecycle_transition_invalid");

  let finalized = transitionSalesLifecycle(draft, change("t2", "submit"));
  finalized = transitionSalesLifecycle(finalized, change("t3", "approve"));
  finalized = transitionSalesLifecycle(finalized, change("t4", "finalize"));
  assert.throws(() => transitionSalesLifecycle(finalized, change("t5", "cancel")),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.lifecycle_transition_invalid");
});

test("rejects duplicate transition identity", () => {
  let state = createSalesLifecycle("inv-2", "sales-invoice");
  state = transitionSalesLifecycle(state, change("same-id", "submit"));
  assert.throws(() => transitionSalesLifecycle(state, change("same-id", "approve")),
    (e: unknown) => e instanceof SalesDomainError && e.code === "sales.lifecycle_transition_duplicate");
});

test("rejects invalid transition timestamps", () => {
  const state = createSalesLifecycle("inv-3", "sales-invoice");
  assert.throws(() => transitionSalesLifecycle(state, {
    transitionId: "t1", action: "submit", actorId: "user-1", occurredAt: "bad-date",
  }), (e: unknown) => e instanceof SalesDomainError && e.code === "sales.lifecycle_timestamp_invalid");
});
