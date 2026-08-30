import assert from "node:assert/strict";
import test from "node:test";

import {
  diffTaxpayerUnitReferenceDataset,
  normalizeTaxpayerUnitReferenceDataset,
} from "../src/index.ts";

test("normalizes versioned taxpayer unit reference data", () => {
  const dataset = normalizeTaxpayerUnitReferenceDataset({
    datasetVersion: " 2026-01 ",
    sourceName: " Taxpayer reference ",
    entries: [
      { code: "1627", title: " عدد ", isActive: true },
      { code: "164", title: "کیلوگرم", isActive: true },
    ],
  });

  assert.equal(dataset.datasetVersion, "2026-01");
  assert.equal(dataset.entries[0]?.title, "عدد");
  assert.equal(Object.isFrozen(dataset.entries), true);
});

test("rejects duplicate official unit codes", () => {
  assert.throws(() =>
    normalizeTaxpayerUnitReferenceDataset({
      datasetVersion: "v2",
      sourceName: "Taxpayer reference",
      entries: [
        { code: "1627", title: "عدد", isActive: true },
        { code: "1627", title: "عدد جدید", isActive: true },
      ],
    }),
  );
});

test("produces an update diff without deleting missing historical codes", () => {
  const diff = diffTaxpayerUnitReferenceDataset(
    [
      { code: "1627", title: "عدد", isActive: true },
      { code: "164", title: "کیلوگرم", isActive: true },
    ],
    [
      { code: "1627", title: "عدد", isActive: true },
      { code: "165", title: "متر", isActive: true },
    ],
  );

  assert.deepEqual(diff.added, [{ code: "165", title: "متر", isActive: true }]);
  assert.deepEqual(diff.deactivated, [
    { code: "164", title: "کیلوگرم", isActive: false },
  ]);
});
