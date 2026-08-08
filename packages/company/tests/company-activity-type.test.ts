import assert from "node:assert/strict";
import test from "node:test";

import {
  companyActivityTypeLabels,
  isCompanyActivityType,
  recommendCodingTemplate
} from "../src/domain/company-activity-type.ts";

test("supports the four explicit company activity types", () => {
  assert.deepEqual(Object.keys(companyActivityTypeLabels), [
    "service",
    "trading",
    "manufacturing",
    "custom"
  ]);
  assert.equal(isCompanyActivityType("manufacturing"), true);
  assert.equal(isCompanyActivityType("unset"), false);
});

test("activity only recommends a template and custom recommends none", () => {
  assert.deepEqual(recommendCodingTemplate("trading"), {
    activityType: "trading",
    templateCode: "iran-trading-default"
  });
  assert.equal(recommendCodingTemplate("custom"), null);
});
