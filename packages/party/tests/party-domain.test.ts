import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyDomainError,
  createParty,
  isPartyClassification,
  partyClassifications
} from "../src/index.ts";

test("supports only natural-person and legal-entity classifications", () => {
  assert.deepEqual(partyClassifications, ["natural-person", "legal-entity"]);
  assert.equal(isPartyClassification("natural-person"), true);
  assert.equal(isPartyClassification("legal-entity"), true);
  assert.equal(isPartyClassification("customer"), false);
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
    firstName: "علی",
    lastName: "رضایی",
    displayName: "علی رضایی",
    createdAt: "2026-08-29T07:00:00.000Z",
    updatedAt: "2026-08-29T07:00:00.000Z"
  });
  assert.equal(Object.isFrozen(party), true);
});

test("creates a legal entity and prefers a normalized trade name for display", () => {
  const party = createParty({
    classification: "legal-entity",
    id: "party-002",
    companyId: "company-001",
    code: "P-1002",
    legalName: " شرکت نمونه آرگین ",
    tradeName: " آرگین نمونه ",
    createdAt: "2026-08-29T07:05:00.000Z"
  });

  assert.equal(party.classification, "legal-entity");
  assert.equal(party.status, "active");
  assert.equal(party.legalName, "شرکت نمونه آرگین");
  assert.equal(party.tradeName, "آرگین نمونه");
  assert.equal(party.displayName, "آرگین نمونه");
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
