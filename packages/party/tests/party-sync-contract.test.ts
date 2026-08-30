import assert from "node:assert/strict";
import test from "node:test";

import {
  PartySyncContractError,
  createPartySyncTombstoneEnvelope,
  createPartySyncUpsertEnvelope,
  type PartySyncSnapshot
} from "../src/index.ts";

const snapshot: PartySyncSnapshot = Object.freeze({
  id: "party-1",
  companyId: "company-1",
  code: "P-001",
  classification: "natural-person",
  status: "active",
  displayName: "علی رضایی",
  firstName: "علی",
  lastName: "رضایی",
  legalName: null,
  tradeName: null,
  roles: Object.freeze(["customer"] as const),
  identity: Object.freeze({
    nationalCode: null,
    nationalId: null,
    registrationNumber: null,
    economicNumber: null,
    legacyEconomicCode: null,
    taxFileNumber: null
  }),
  contacts: Object.freeze([]),
  addresses: Object.freeze([]),
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-08-30T10:05:00.000Z"
});

test("upsert envelope keeps durable id separate from display code", () => {
  const envelope = createPartySyncUpsertEnvelope({
    operationId: "op-1",
    idempotencyKey: "retry-1",
    reference: { companyId: "company-1", partyId: "party-1", displayCode: "P-001" },
    version: 3,
    changedAt: snapshot.updatedAt,
    externalReferences: [{ sourceSystem: "legacy-erp", externalId: "CUST-44" }],
    snapshot
  });

  assert.equal(envelope.reference.partyId, "party-1");
  assert.equal(envelope.reference.displayCode, "P-001");
  assert.equal(envelope.version, 3);
  assert.equal(envelope.changeKind, "upsert");
  assert.equal(envelope.snapshot, snapshot);
  assert.ok(Object.isFrozen(envelope.externalReferences));
});

test("snapshot cannot target a different durable Party", () => {
  assert.throws(
    () => createPartySyncUpsertEnvelope({
      operationId: "op-2",
      idempotencyKey: "retry-2",
      reference: { companyId: "company-1", partyId: "party-other", displayCode: "P-001" },
      version: 1,
      changedAt: snapshot.updatedAt,
      snapshot
    }),
    (error: unknown) => error instanceof PartySyncContractError && error.code === "party.sync.snapshot.mismatch"
  );
});

test("tombstone has no business snapshot and preserves version ordering metadata", () => {
  const envelope = createPartySyncTombstoneEnvelope({
    operationId: "op-3",
    idempotencyKey: "retry-3",
    reference: { companyId: "company-1", partyId: "party-1", displayCode: "P-001" },
    version: 4,
    deletedAt: "2026-08-30T10:10:00.000Z",
    changedAt: "2026-08-30T10:10:00.000Z"
  });

  assert.equal(envelope.changeKind, "tombstone");
  assert.equal(envelope.snapshot, null);
  assert.equal(envelope.deletedAt, "2026-08-30T10:10:00.000Z");
  assert.equal(envelope.version, 4);
});

test("duplicate external references are rejected deterministically", () => {
  assert.throws(
    () => createPartySyncUpsertEnvelope({
      operationId: "op-4",
      idempotencyKey: "retry-4",
      reference: { companyId: "company-1", partyId: "party-1", displayCode: "P-001" },
      version: 2,
      changedAt: snapshot.updatedAt,
      externalReferences: [
        { sourceSystem: "legacy", externalId: "42" },
        { sourceSystem: "legacy", externalId: "42" }
      ],
      snapshot
    }),
    (error: unknown) => error instanceof PartySyncContractError && error.code === "party.sync.externalReference.duplicate"
  );
});

test("sync version must be a positive safe integer", () => {
  assert.throws(
    () => createPartySyncTombstoneEnvelope({
      operationId: "op-5",
      idempotencyKey: "retry-5",
      reference: { companyId: "company-1", partyId: "party-1", displayCode: "P-001" },
      version: 0,
      deletedAt: "2026-08-30T10:10:00.000Z",
      changedAt: "2026-08-30T10:10:00.000Z"
    }),
    (error: unknown) => error instanceof PartySyncContractError && error.code === "party.sync.version.invalid"
  );
});
