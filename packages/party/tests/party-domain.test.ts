import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyDomainError,
  activateParty,
  addPartyRole,
  assessPartyMergeBoundary,
  createParty,
  deactivateParty,
  isPartyClassification,
  isPartyRole,
  partyClassifications,
  partyRoles,
  removePartyRole
} from "../src/index.ts";

test("supports only natural-person and legal-entity classifications", () => {
  assert.deepEqual(partyClassifications, ["natural-person", "legal-entity"]);
  assert.equal(isPartyClassification("natural-person"), true);
  assert.equal(isPartyClassification("legal-entity"), true);
  assert.equal(isPartyClassification("customer"), false);
});

test("supports reusable customer and supplier roles independently from classification", () => {
  assert.deepEqual(partyRoles, ["customer", "supplier"]);
  assert.equal(isPartyRole("customer"), true);
  assert.equal(isPartyRole("supplier"), true);
  assert.equal(isPartyRole("natural-person"), false);
});

test("creates a company-scoped natural-person party with normalized name and active initial status", () => {
  const party = createParty({
    classification: "natural-person",
    id: "party-001",
    companyId: "company-001",
    code: " P-1001 ",
    firstName: "  علی ",
    lastName: " رضایی  ",
    createdAt: "2026-08-29T07:00:00.000Z"
  });

  assert.deepEqual(party, {
    classification: "natural-person",
    id: "party-001",
    companyId: "company-001",
    code: "P-1001",
    status: "active",
    roles: [],
    firstName: "علی",
    lastName: "رضایی",
    displayName: "علی رضایی",
    identity: {
      nationalCode: null,
      economicNumber: null,
      taxFileNumber: null
    },
    createdAt: "2026-08-29T07:00:00.000Z",
    updatedAt: "2026-08-29T07:00:00.000Z"
  });
  assert.equal(Object.isFrozen(party), true);
  assert.equal(Object.isFrozen(party.roles), true);
  assert.equal(Object.isFrozen(party.identity), true);
});

test("creates one legal Party with multiple commercial roles instead of duplicate masters", () => {
  const party = createParty({
    classification: "legal-entity",
    id: "party-002",
    companyId: "company-001",
    code: "P-1002",
    legalName: " شرکت نمونه آرگین ",
    tradeName: " آرگین نمونه ",
    roles: ["customer", "supplier", "customer"],
    createdAt: "2026-08-29T07:05:00.000Z"
  });

  assert.equal(party.classification, "legal-entity");
  assert.equal(party.status, "active");
  assert.deepEqual(party.roles, ["customer", "supplier"]);
  assert.equal(party.legalName, "شرکت نمونه آرگین");
  assert.equal(party.tradeName, "آرگین نمونه");
  assert.equal(party.displayName, "آرگین نمونه");
  assert.deepEqual(party.identity, {
    nationalId: null,
    registrationNumber: null,
    economicNumber: null,
    legacyEconomicCode: null,
    taxFileNumber: null
  });
});

test("legal entity falls back to legal name when trade name is blank", () => {
  const party = createParty({
    classification: "legal-entity",
    id: "party-003",
    companyId: "company-001",
    code: "P-1003",
    legalName: "شرکت بدون نام تجاری",
    tradeName: "   ",
    createdAt: "2026-08-29T07:10:00.000Z"
  });

  assert.equal(party.tradeName, null);
  assert.equal(party.displayName, "شرکت بدون نام تجاری");
});

test("adds and removes roles immutably while keeping duplicate operations safe", () => {
  const original = createParty({
    classification: "natural-person",
    id: "party-role-1",
    companyId: "company-001",
    code: "P-2001",
    firstName: "مریم",
    lastName: "کریمی",
    roles: ["customer"],
    createdAt: "2026-08-29T08:00:00.000Z"
  });

  const withSupplier = addPartyRole(
    original,
    "supplier",
    "2026-08-29T08:10:00.000Z"
  );
  assert.notEqual(withSupplier, original);
  assert.deepEqual(withSupplier.roles, ["customer", "supplier"]);
  assert.equal(withSupplier.updatedAt, "2026-08-29T08:10:00.000Z");
  assert.deepEqual(original.roles, ["customer"]);

  const duplicateAdd = addPartyRole(
    withSupplier,
    "supplier",
    "2026-08-29T08:20:00.000Z"
  );
  assert.equal(duplicateAdd, withSupplier);

  const withoutCustomer = removePartyRole(
    withSupplier,
    "customer",
    "2026-08-29T08:30:00.000Z"
  );
  assert.deepEqual(withoutCustomer.roles, ["supplier"]);
  assert.equal(withoutCustomer.updatedAt, "2026-08-29T08:30:00.000Z");

  const missingRemove = removePartyRole(
    withoutCustomer,
    "customer",
    "2026-08-29T08:40:00.000Z"
  );
  assert.equal(missingRemove, withoutCustomer);
});

test("deactivates and reactivates Party with safe repeated transitions", () => {
  const active = createParty({
    classification: "natural-person",
    id: "party-status-1",
    companyId: "company-001",
    code: "P-3001",
    firstName: "رضا",
    lastName: "محمدی",
    createdAt: "2026-08-29T09:00:00.000Z"
  });

  const inactive = deactivateParty(active, "2026-08-29T09:10:00.000Z");
  assert.equal(inactive.status, "inactive");
  assert.equal(inactive.updatedAt, "2026-08-29T09:10:00.000Z");

  const duplicateDeactivate = deactivateParty(
    inactive,
    "2026-08-29T09:20:00.000Z"
  );
  assert.equal(duplicateDeactivate, inactive);

  const reactivated = activateParty(
    inactive,
    "2026-08-29T09:30:00.000Z"
  );
  assert.equal(reactivated.status, "active");
  assert.equal(reactivated.updatedAt, "2026-08-29T09:30:00.000Z");

  const duplicateActivate = activateParty(
    reactivated,
    "2026-08-29T09:40:00.000Z"
  );
  assert.equal(duplicateActivate, reactivated);
});

test("prevents mutation timestamps from moving backwards", () => {
  const party = createParty({
    classification: "natural-person",
    id: "party-time-1",
    companyId: "company-001",
    code: "P-4001",
    firstName: "ندا",
    lastName: "اکبری",
    createdAt: "2026-08-29T10:00:00.000Z"
  });

  assert.throws(
    () => addPartyRole(party, "customer", "2026-08-29T09:59:59.000Z"),
    (error: unknown) =>
      error instanceof PartyDomainError &&
      error.code === "party.updatedAt.beforeCurrent"
  );
});

test("defines merge boundaries without performing destructive merge", () => {
  const source = createParty({
    classification: "natural-person",
    id: "party-merge-source",
    companyId: "company-001",
    code: "P-5001",
    firstName: "علی",
    lastName: "واحدی",
    createdAt: "2026-08-29T11:00:00.000Z"
  });
  const sameCompanyTarget = createParty({
    classification: "legal-entity",
    id: "party-merge-target",
    companyId: "company-001",
    code: "P-5002",
    legalName: "شرکت هدف",
    createdAt: "2026-08-29T11:01:00.000Z"
  });
  const otherCompanyTarget = createParty({
    classification: "legal-entity",
    id: "party-other-company",
    companyId: "company-002",
    code: "P-5003",
    legalName: "شرکت دیگر",
    createdAt: "2026-08-29T11:02:00.000Z"
  });

  assert.deepEqual(assessPartyMergeBoundary(source, source), {
    allowed: false,
    reason: "same-party"
  });
  assert.deepEqual(assessPartyMergeBoundary(source, otherCompanyTarget), {
    allowed: false,
    reason: "cross-company"
  });
  assert.deepEqual(assessPartyMergeBoundary(source, sameCompanyTarget), {
    allowed: true,
    reason: null
  });
});

test("rejects missing aggregate identity, company scope, display code, and type-specific names", () => {
  const cases = [
    {
      input: {
        classification: "natural-person" as const,
        id: " ",
        companyId: "company-001",
        code: "P-1",
        firstName: "علی",
        lastName: "رضایی",
        createdAt: "2026-08-29T07:00:00.000Z"
      },
      code: "party.id.required"
    },
    {
      input: {
        classification: "natural-person" as const,
        id: "party-1",
        companyId: " ",
        code: "P-1",
        firstName: "علی",
        lastName: "رضایی",
        createdAt: "2026-08-29T07:00:00.000Z"
      },
      code: "party.companyId.required"
    },
    {
      input: {
        classification: "natural-person" as const,
        id: "party-1",
        companyId: "company-001",
        code: " ",
        firstName: "علی",
        lastName: "رضایی",
        createdAt: "2026-08-29T07:00:00.000Z"
      },
      code: "party.code.required"
    },
    {
      input: {
        classification: "natural-person" as const,
        id: "party-1",
        companyId: "company-001",
        code: "P-1",
        firstName: " ",
        lastName: "رضایی",
        createdAt: "2026-08-29T07:00:00.000Z"
      },
      code: "party.firstName.required"
    },
    {
      input: {
        classification: "legal-entity" as const,
        id: "party-2",
        companyId: "company-001",
        code: "P-2",
        legalName: " ",
        createdAt: "2026-08-29T07:00:00.000Z"
      },
      code: "party.legalName.required"
    }
  ];

  for (const item of cases) {
    assert.throws(
      () => createParty(item.input),
      (error: unknown) =>
        error instanceof PartyDomainError && error.code === item.code
    );
  }
});

test("rejects invalid createdAt timestamps", () => {
  assert.throws(
    () => createParty({
      classification: "natural-person",
      id: "party-004",
      companyId: "company-001",
      code: "P-1004",
      firstName: "سارا",
      lastName: "احمدی",
      createdAt: "not-a-date"
    }),
    (error: unknown) =>
      error instanceof PartyDomainError &&
      error.code === "party.createdAt.invalid"
  );
});
