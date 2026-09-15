import assert from "node:assert/strict";
import test from "node:test";

import {
  PURCHASE_DOCUMENT_TYPES,
  PURCHASE_DOCUMENT_STATUSES,
  PURCHASE_DOCUMENT_TRANSITIONS,
  PURCHASE_DOMAIN_ERROR_CODES,
  PurchaseDomainError,
  approvePurchaseLifecycle,
  cancelPurchaseLifecycle,
  confirmPurchaseLifecycle,
  correctPurchaseLifecycle,
  createPurchaseLifecycle,
  returnPurchaseLifecycle,
  submitPurchaseLifecycle,
} from "../src/index.ts";

const createdAt = "2026-09-15T05:30:00.000Z";

function action(occurredAt: string, reason?: string) {
  return { occurredAt, actorUserId: "user-001", reason };
}

function assertDomainError(actionFn: () => unknown, code: string, field: string): void {
  assert.throws(actionFn, (error: unknown) => {
    assert.ok(error instanceof PurchaseDomainError);
    assert.equal(error.code, code);
    assert.equal(error.field, field);
    return true;
  });
}

test("freezes supported Purchase document types, statuses and transition matrix", () => {
  assert.deepEqual(PURCHASE_DOCUMENT_TYPES, [
    "purchase-order",
    "supplier-invoice",
    "purchase-return",
    "purchase-correction",
  ]);
  assert.deepEqual(PURCHASE_DOCUMENT_STATUSES, [
    "draft",
    "submitted",
    "approved",
    "confirmed",
    "cancelled",
    "returned",
    "corrected",
  ]);
  assert.deepEqual(PURCHASE_DOCUMENT_TRANSITIONS.confirmed, ["returned", "corrected"]);
});

test("moves a Purchase document through draft -> submitted -> approved -> confirmed", () => {
  let lifecycle = createPurchaseLifecycle({
    documentId: "purchase-doc-001",
    documentType: "supplier-invoice",
    createdAt,
  });

  lifecycle = submitPurchaseLifecycle(lifecycle, action("2026-09-15T05:31:00.000Z"));
  lifecycle = approvePurchaseLifecycle(lifecycle, action("2026-09-15T05:32:00.000Z"));
  lifecycle = confirmPurchaseLifecycle(lifecycle, action("2026-09-15T05:33:00.000Z"));

  assert.equal(lifecycle.status, "confirmed");
  assert.equal(lifecycle.version, 4);
  assert.equal(lifecycle.history.length, 3);
  assert.equal(lifecycle.history[2]?.toStatus, "confirmed");
});

test("requires explicit linked compensating document for returned or corrected confirmed Purchase facts", () => {
  let lifecycle = createPurchaseLifecycle({
    documentId: "purchase-doc-002",
    documentType: "supplier-invoice",
    createdAt,
  });
  lifecycle = submitPurchaseLifecycle(lifecycle, action("2026-09-15T05:31:00.000Z"));
  lifecycle = approvePurchaseLifecycle(lifecycle, action("2026-09-15T05:32:00.000Z"));
  lifecycle = confirmPurchaseLifecycle(lifecycle, action("2026-09-15T05:33:00.000Z"));

  const returned = returnPurchaseLifecycle(lifecycle, {
    ...action("2026-09-15T05:34:00.000Z", "supplier return"),
    relatedDocumentId: "purchase-return-001",
  });
  assert.equal(returned.status, "returned");
  assert.equal(returned.history.at(-1)?.relatedDocumentId, "purchase-return-001");

  assertDomainError(
    () => correctPurchaseLifecycle(lifecycle, {
      ...action("2026-09-15T05:34:00.000Z", "correction"),
      relatedDocumentId: "purchase-doc-002",
    }),
    PURCHASE_DOMAIN_ERROR_CODES.relatedDocumentInvalid,
    "relatedDocumentId",
  );
});

test("rejects invalid lifecycle transitions and requires a reason when reopening an approved document", () => {
  const draft = createPurchaseLifecycle({
    documentId: "purchase-doc-003",
    documentType: "purchase-order",
    createdAt,
  });

  assertDomainError(
    () => confirmPurchaseLifecycle(draft, action("2026-09-15T05:31:00.000Z")),
    PURCHASE_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid,
    "status",
  );

  let approved = submitPurchaseLifecycle(draft, action("2026-09-15T05:31:00.000Z"));
  approved = approvePurchaseLifecycle(approved, action("2026-09-15T05:32:00.000Z"));

  assertDomainError(
    () => createPurchaseLifecycle({
      ...approved,
      history: [
        ...approved.history,
        {
          fromStatus: "approved",
          toStatus: "draft",
          occurredAt: "2026-09-15T05:33:00.000Z",
          actorUserId: "user-001",
          reason: null,
          relatedDocumentId: null,
        },
      ],
      status: "draft",
      updatedAt: "2026-09-15T05:33:00.000Z",
      version: 4,
    }),
    PURCHASE_DOMAIN_ERROR_CODES.lifecycleMetadataInvalid,
    "history.reason",
  );
});

test("allows cancellation only before confirmation and records immutable chronological history", () => {
  const draft = createPurchaseLifecycle({
    documentId: "purchase-doc-004",
    documentType: "purchase-order",
    createdAt,
  });
  const cancelled = cancelPurchaseLifecycle(draft, action("2026-09-15T05:31:00.000Z", "supplier withdrew"));
  assert.equal(cancelled.status, "cancelled");
  assert.ok(Object.isFrozen(cancelled));
  assert.ok(Object.isFrozen(cancelled.history));
  assert.ok(cancelled.history.every(Object.isFrozen));

  assertDomainError(
    () => submitPurchaseLifecycle(cancelled, action("2026-09-15T05:32:00.000Z")),
    PURCHASE_DOMAIN_ERROR_CODES.lifecycleTransitionInvalid,
    "status",
  );
});
