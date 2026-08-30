import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyIdentityError,
  createLegalEntityIdentity,
  createNaturalPersonIdentity,
  createParty,
  isValidIranianLegalEntityNationalId,
  isValidIranianNationalCode,
  normalizeIranianIdentifier
} from "../src/index.ts";

test("normalizes Persian and Arabic digits for Iranian identifiers", () => {
  assert.equal(normalizeIranianIdentifier(" ۰۰۸-۴۵۷-۵۹۴۸ "), "0084575948");
  assert.equal(normalizeIranianIdentifier("١٤٠٠١٢٣٤٥٦٢"), "14001234562");
});

test("validates Iranian natural-person national code checksum", () => {
  assert.equal(isValidIranianNationalCode("0084575948"), true);
  assert.equal(isValidIranianNationalCode("۰۰۸۴۵۷۵۹۴۸"), true);
  assert.equal(isValidIranianNationalCode("1234567890"), false);
  assert.equal(isValidIranianNationalCode("1111111111"), false);
});

test("validates Iranian legal-entity national identifier checksum", () => {
  assert.equal(isValidIranianLegalEntityNationalId("14001234562"), true);
  assert.equal(isValidIranianLegalEntityNationalId("۱۴۰۰۱۲۳۴۵۶۲"), true);
  assert.equal(isValidIranianLegalEntityNationalId("14001234561"), false);
  assert.equal(isValidIranianLegalEntityNationalId("11111111111"), false);
});

test("creates normalized natural-person identity and enforces current economic-number relation", () => {
  const identity = createNaturalPersonIdentity({
    nationalCode: "۰۰۸۴۵۷۵۹۴۸",
    economicNumber: "۰۰۸۴۵۷۵۹۴۸۰۰۰۱",
    taxFileNumber: " ۱۲۳۴۵ "
  });

  assert.deepEqual(identity, {
    nationalCode: "0084575948",
    economicNumber: "00845759480001",
    taxFileNumber: "12345"
  });
  assert.equal(Object.isFrozen(identity), true);

  assert.throws(
    () => createNaturalPersonIdentity({
      nationalCode: "0084575948",
      economicNumber: "13600000030001"
    }),
    (error: unknown) =>
      error instanceof PartyIdentityError &&
      error.code === "party.identity.economicNumber.mismatch"
  );
});

test("creates legal-entity identity with current and legacy economic identifiers kept distinct", () => {
  const identity = createLegalEntityIdentity({
    nationalId: "۱۴۰۰۱۲۳۴۵۶۲",
    registrationNumber: " ۱۲۳۴۵۶ ",
    economicNumber: "14001234562",
    legacyEconomicCode: "411111111111",
    taxFileNumber: "987654"
  });

  assert.deepEqual(identity, {
    nationalId: "14001234562",
    registrationNumber: "123456",
    economicNumber: "14001234562",
    legacyEconomicCode: "411111111111",
    taxFileNumber: "987654"
  });

  assert.throws(
    () => createLegalEntityIdentity({
      nationalId: "14001234562",
      economicNumber: "10101234565"
    }),
    (error: unknown) =>
      error instanceof PartyIdentityError &&
      error.code === "party.identity.economicNumber.mismatch"
  );
});

test("rejects malformed registration, economic, legacy, and tax identifiers", () => {
  const cases = [
    {
      run: () => createLegalEntityIdentity({ registrationNumber: "12A34" }),
      code: "party.identity.registrationNumber.invalid"
    },
    {
      run: () => createNaturalPersonIdentity({ economicNumber: "123" }),
      code: "party.identity.economicNumber.invalid"
    },
    {
      run: () => createLegalEntityIdentity({ legacyEconomicCode: "123456" }),
      code: "party.identity.legacyEconomicCode.invalid"
    },
    {
      run: () => createNaturalPersonIdentity({ taxFileNumber: "A-123" }),
      code: "party.identity.taxFileNumber.invalid"
    }
  ];

  for (const item of cases) {
    assert.throws(
      item.run,
      (error: unknown) =>
        error instanceof PartyIdentityError && error.code === item.code
    );
  }
});

test("attaches classification-specific identity profile to the Party aggregate", () => {
  const naturalPerson = createParty({
    classification: "natural-person",
    id: "party-identity-natural",
    companyId: "company-001",
    code: "P-6001",
    firstName: "علی",
    lastName: "رضایی",
    identity: {
      nationalCode: "0084575948",
      economicNumber: "00845759480001"
    },
    createdAt: "2026-08-29T11:30:00.000Z"
  });

  const legalEntity = createParty({
    classification: "legal-entity",
    id: "party-identity-legal",
    companyId: "company-001",
    code: "P-6002",
    legalName: "شرکت نمونه",
    identity: {
      nationalId: "14001234562",
      registrationNumber: "12345",
      economicNumber: "14001234562"
    },
    createdAt: "2026-08-29T11:31:00.000Z"
  });

  assert.equal(naturalPerson.identity.nationalCode, "0084575948");
  assert.equal(legalEntity.identity.nationalId, "14001234562");
  assert.equal(Object.isFrozen(naturalPerson.identity), true);
  assert.equal(Object.isFrozen(legalEntity.identity), true);
});
