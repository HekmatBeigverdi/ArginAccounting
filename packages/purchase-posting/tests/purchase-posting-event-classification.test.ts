import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPurchasePostingEvent,
  isPurchasePostingEventEligible,
} from "../src/index.ts";

test("classifies confirmed supplier invoice as posting event", () => {
  const classification = classifyPurchasePostingEvent({
    documentType: "supplier-invoice",
    sourceStatus: "confirmed",
  });

  assert.equal(classification.disposition, "posting");
  assert.equal(classification.eventKind, "supplier-invoice-recognition");
  assert.equal(classification.reasonCode, "supplier_invoice_confirmed");
  assert.equal(classification.requiresJournalPosting, true);
  assert.equal(isPurchasePostingEventEligible(classification), true);
});

test("classifies purchase order as non-posting under the frozen Phase 23 baseline", () => {
  for (const sourceStatus of ["confirmed", "returned", "corrected"] as const) {
    const classification = classifyPurchasePostingEvent({
      documentType: "purchase-order",
      sourceStatus,
    });
    assert.equal(classification.disposition, "non-posting");
    assert.equal(classification.eventKind, "none");
    assert.equal(classification.reasonCode, "purchase_order_has_no_accounting_effect");
    assert.equal(classification.requiresJournalPosting, false);
  }
});

test("does not create a second event from returned/corrected original supplier invoice", () => {
  const returned = classifyPurchasePostingEvent({
    documentType: "supplier-invoice",
    sourceStatus: "returned",
  });
  assert.equal(returned.disposition, "non-posting");
  assert.equal(returned.reasonCode, "supplier_invoice_compensated_by_return_document");

  const corrected = classifyPurchasePostingEvent({
    documentType: "supplier-invoice",
    sourceStatus: "corrected",
  });
  assert.equal(corrected.disposition, "non-posting");
  assert.equal(corrected.reasonCode, "supplier_invoice_compensated_by_correction_document");
});

test("classifies confirmed purchase return as independent posting event", () => {
  const classification = classifyPurchasePostingEvent({
    documentType: "purchase-return",
    sourceStatus: "confirmed",
  });
  assert.equal(classification.disposition, "posting");
  assert.equal(classification.eventKind, "purchase-return-recognition");
  assert.equal(classification.reasonCode, "purchase_return_confirmed");
});

test("classifies confirmed purchase correction as independent posting event", () => {
  const classification = classifyPurchasePostingEvent({
    documentType: "purchase-correction",
    sourceStatus: "confirmed",
  });
  assert.equal(classification.disposition, "posting");
  assert.equal(classification.eventKind, "purchase-correction-recognition");
  assert.equal(classification.reasonCode, "purchase_correction_confirmed");
});

test("rejects non-confirmed compensating documents from posting eligibility", () => {
  for (const documentType of ["purchase-return", "purchase-correction"] as const) {
    for (const sourceStatus of ["returned", "corrected"] as const) {
      const classification = classifyPurchasePostingEvent({
        documentType,
        sourceStatus,
      });
      assert.equal(classification.disposition, "ineligible");
      assert.equal(classification.eventKind, "none");
      assert.equal(classification.reasonCode, "compensating_document_must_be_confirmed");
      assert.equal(classification.requiresJournalPosting, false);
    }
  }
});

test("classification is deterministic for the full Step 3 type/status matrix", () => {
  const documentTypes = [
    "purchase-order",
    "supplier-invoice",
    "purchase-return",
    "purchase-correction",
  ] as const;
  const sourceStatuses = ["confirmed", "returned", "corrected"] as const;

  const first = documentTypes.flatMap(documentType =>
    sourceStatuses.map(sourceStatus =>
      classifyPurchasePostingEvent({ documentType, sourceStatus }),
    ),
  );
  const second = documentTypes.flatMap(documentType =>
    sourceStatuses.map(sourceStatus =>
      classifyPurchasePostingEvent({ documentType, sourceStatus }),
    ),
  );

  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
});
