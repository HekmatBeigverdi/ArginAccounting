import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyAddressError,
  PartyContactError,
  PartyDomainError,
  createParty,
  createPartyAddress,
  createPartyContact
} from "../src/index.ts";

test("normalizes phone, mobile, email and website contacts", () => {
  assert.equal(createPartyContact({ id: "c1", type: "phone", value: "۰۲۱-۸۸۷۷ ۶۶۵۵" }).value, "02188776655");
  assert.equal(createPartyContact({ id: "c2", type: "mobile", value: "+۹۸ ۹۱۲-۱۲۳-۴۵۶۷" }).value, "+989121234567");
  assert.equal(createPartyContact({ id: "c3", type: "email", value: " SALES@EXAMPLE.COM " }).value, "sales@example.com");
  assert.equal(createPartyContact({ id: "c4", type: "website", value: "example.com" }).value, "https://example.com");
});

test("supports contact person metadata and explicit purposes", () => {
  const contact = createPartyContact({
    id: "accounting-contact",
    type: "phone",
    value: "02188776655",
    purpose: "accounting",
    isPrimary: true,
    contactPerson: "  مریم کریمی ",
    title: " مدیر مالی "
  });

  assert.deepEqual(contact, {
    id: "accounting-contact",
    type: "phone",
    value: "02188776655",
    purpose: "accounting",
    isPrimary: true,
    contactPerson: "مریم کریمی",
    title: "مدیر مالی"
  });
  assert.equal(Object.isFrozen(contact), true);
});

test("rejects invalid contact values", () => {
  assert.throws(
    () => createPartyContact({ id: "bad", type: "email", value: "not-an-email" }),
    (error: unknown) => error instanceof PartyContactError && error.code === "party.contact.value.invalid"
  );
});

test("normalizes Iranian Party address and postal code", () => {
  const address = createPartyAddress({
    id: "addr-1",
    purpose: "billing",
    province: " تهران ",
    city: " تهران ",
    district: " منطقه ۳ ",
    addressLine: " خیابان نمونه، پلاک ۱۲ ",
    postalCode: "۱۲۳۴۵-۶۷۸۹۰",
    isPrimary: true
  });

  assert.deepEqual(address, {
    id: "addr-1",
    purpose: "billing",
    countryCode: "IR",
    province: "تهران",
    city: "تهران",
    district: "منطقه ۳",
    addressLine: "خیابان نمونه، پلاک ۱۲",
    postalCode: "1234567890",
    isPrimary: true
  });
});

test("rejects invalid Iranian postal code", () => {
  assert.throws(
    () => createPartyAddress({ id: "bad-address", addressLine: "تهران", postalCode: "123" }),
    (error: unknown) => error instanceof PartyAddressError && error.code === "party.address.postalCode.invalid"
  );
});

test("Party supports multiple normalized contacts and addresses", () => {
  const party = createParty({
    classification: "legal-entity",
    id: "party-contact-address",
    companyId: "company-001",
    code: "P-6001",
    legalName: "شرکت نمونه",
    contacts: [
      { id: "phone-1", type: "phone", value: "02188776655", purpose: "general", isPrimary: true },
      { id: "phone-2", type: "phone", value: "02188776666", purpose: "accounting", isPrimary: true },
      { id: "email-1", type: "email", value: "INFO@EXAMPLE.COM", purpose: "general", isPrimary: true }
    ],
    addresses: [
      { id: "a1", purpose: "registered", addressLine: "نشانی ثبتی", postalCode: "1234567890", isPrimary: true },
      { id: "a2", purpose: "shipping", addressLine: "نشانی ارسال", isPrimary: true }
    ],
    createdAt: "2026-08-29T12:00:00.000Z"
  });

  assert.equal(party.contacts.length, 3);
  assert.equal(party.addresses.length, 2);
  assert.equal(party.contacts[2]?.value, "info@example.com");
  assert.equal(Object.isFrozen(party.contacts), true);
  assert.equal(Object.isFrozen(party.addresses), true);
});

test("Party rejects duplicate child ids and multiple primaries for the same purpose", () => {
  assert.throws(
    () => createParty({
      classification: "natural-person",
      id: "party-dup-contact",
      companyId: "company-001",
      code: "P-6002",
      firstName: "علی",
      lastName: "رضایی",
      contacts: [
        { id: "same", type: "phone", value: "02188776655" },
        { id: "same", type: "mobile", value: "09121234567" }
      ],
      createdAt: "2026-08-29T12:00:00.000Z"
    }),
    (error: unknown) => error instanceof PartyDomainError && error.code === "party.contact.duplicateId"
  );

  assert.throws(
    () => createParty({
      classification: "legal-entity",
      id: "party-primary-address",
      companyId: "company-001",
      code: "P-6003",
      legalName: "شرکت نمونه",
      addresses: [
        { id: "a1", purpose: "billing", addressLine: "نشانی یک", isPrimary: true },
        { id: "a2", purpose: "billing", addressLine: "نشانی دو", isPrimary: true }
      ],
      createdAt: "2026-08-29T12:00:00.000Z"
    }),
    (error: unknown) => error instanceof PartyDomainError && error.code === "party.address.multiplePrimary"
  );
});
