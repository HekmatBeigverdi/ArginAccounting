import assert from "node:assert/strict";
import test from "node:test";

import {
  PartySelectionContractError,
  buildPartySelectorQuery,
  isPartySelectionEligible,
  toPartySelectionReference,
  type PartySelectorDto
} from "../src/index.ts";

const activeCustomer: PartySelectorDto = Object.freeze({
  id: "party-1",
  companyId: "company-1",
  code: "1001",
  displayName: "شرکت نمونه",
  classification: "legal-entity",
  status: "active",
  roles: Object.freeze(["customer"] as const)
});

test("selector query defaults to active parties and bounded results", () => {
  const query = buildPartySelectorQuery(" company-1 ", " نمونه ");

  assert.equal(query.companyId, "company-1");
  assert.equal(query.search, "نمونه");
  assert.deepEqual(query.statuses, ["active"]);
  assert.equal(query.limit, 20);
});

test("selector query keeps consumer role/status policy without duplicate filters", () => {
  const query = buildPartySelectorQuery("company-1", null, {
    roles: ["supplier", "supplier"],
    statuses: ["active", "inactive", "active"],
    limit: 50
  });

  assert.deepEqual(query.roles, ["supplier"]);
  assert.deepEqual(query.statuses, ["active", "inactive"]);
  assert.equal(query.limit, 50);
});

test("selector contract rejects empty company scope and unsafe limits", () => {
  assert.throws(
    () => buildPartySelectorQuery("   ", null),
    (error: unknown) => error instanceof PartySelectionContractError &&
      error.code === "party.selection.companyId.required"
  );

  assert.throws(
    () => buildPartySelectorQuery("company-1", null, { limit: 101 }),
    (error: unknown) => error instanceof PartySelectionContractError &&
      error.code === "party.selection.limit.invalid"
  );
});

test("selection reference preserves stable identity and display metadata", () => {
  const reference = toPartySelectionReference(activeCustomer);

  assert.deepEqual(reference, {
    partyId: "party-1",
    code: "1001",
    displayName: "شرکت نمونه",
    classification: "legal-entity",
    roles: ["customer"]
  });
  assert.equal(Object.isFrozen(reference), true);
  assert.equal(Object.isFrozen(reference.roles), true);
});

test("eligibility uses active-by-default and any requested commercial role", () => {
  assert.equal(isPartySelectionEligible(activeCustomer), true);
  assert.equal(isPartySelectionEligible(activeCustomer, { roles: ["customer"] }), true);
  assert.equal(isPartySelectionEligible(activeCustomer, { roles: ["supplier"] }), false);

  const inactive = Object.freeze({ ...activeCustomer, status: "inactive" as const });
  assert.equal(isPartySelectionEligible(inactive), false);
  assert.equal(isPartySelectionEligible(inactive, { statuses: ["inactive"] }), true);
});
