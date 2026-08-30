import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyApplicationError,
  PartyApplicationService,
  createParty,
  type Party,
  type PartyDuplicateCandidate,
  type PartyDuplicateLookup,
  type PartyDuplicateProbe,
  type PartyRepository,
  type PartyUnitOfWork
} from "../src/index.ts";

class MemoryPartyRepository implements PartyRepository {
  readonly items = new Map<string, Party>();
  addCalls = 0;
  updateCalls = 0;
  lastExpectedVersion: number | null | undefined;

  async findById(companyId: string, partyId: string): Promise<Party | null> {
    const item = this.items.get(partyId) ?? null;
    return item?.companyId === companyId ? item : null;
  }

  async findByCode(companyId: string, code: string): Promise<Party | null> {
    for (const item of this.items.values()) {
      if (item.companyId === companyId && item.code === code) return item;
    }
    return null;
  }

  async add(party: Party): Promise<void> {
    this.addCalls += 1;
    this.items.set(party.id, party);
  }

  async update(party: Party, expectedVersion?: number | null): Promise<void> {
    this.updateCalls += 1;
    this.lastExpectedVersion = expectedVersion;
    this.items.set(party.id, party);
  }
}

class MemoryUnitOfWork implements PartyUnitOfWork {
  constructor(readonly repository: MemoryPartyRepository) {}

  async run<T>(
    operation: (repositories: { readonly parties: PartyRepository }) => Promise<T>
  ): Promise<T> {
    return operation({ parties: this.repository });
  }
}

class StubDuplicateLookup implements PartyDuplicateLookup {
  hard: readonly PartyDuplicateCandidate[] = [];
  advisory: readonly PartyDuplicateCandidate[] = [];
  lastProbe: PartyDuplicateProbe | null = null;

  async findHardCandidates(
    probe: PartyDuplicateProbe
  ): Promise<readonly PartyDuplicateCandidate[]> {
    this.lastProbe = probe;
    return this.hard;
  }

  async findAdvisoryCandidates(
    probe: PartyDuplicateProbe
  ): Promise<readonly PartyDuplicateCandidate[]> {
    this.lastProbe = probe;
    return this.advisory;
  }
}

const context = {
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-1",
  requestId: "req-1",
  occurredAt: "2026-08-29T12:00:00.000Z"
} as const;

function createService() {
  const repository = new MemoryPartyRepository();
  const lookup = new StubDuplicateLookup();
  const service = new PartyApplicationService(
    new MemoryUnitOfWork(repository),
    lookup
  );
  return { service, repository, lookup };
}

test("creates Party when only advisory duplicate matches exist", async () => {
  const { service, repository, lookup } = createService();
  lookup.advisory = [{
    partyId: "party-similar",
    code: "P-99",
    displayName: "علی رضایی",
    classification: "natural-person",
    reason: "displayName",
    severity: "advisory"
  }];

  const result = await service.create({
    classification: "natural-person",
    context,
    partyId: "party-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    identity: { nationalCode: "0084575948" }
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(repository.addCalls, 1);
  assert.equal(result.advisoryMatches.length, 1);
  assert.equal(lookup.lastProbe?.nationalCode, "0084575948");
});

test("blocks hard official-identity duplicates", async () => {
  const { service, repository, lookup } = createService();
  lookup.hard = [{
    partyId: "party-existing",
    code: "P-2",
    displayName: "علی دیگر",
    classification: "natural-person",
    reason: "nationalCode",
    severity: "hard"
  }];

  await assert.rejects(
    service.create({
      classification: "natural-person",
      context,
      partyId: "party-1",
      code: "P-1",
      firstName: "علی",
      lastName: "رضایی",
      identity: { nationalCode: "0084575948" }
    }),
    (error: unknown) =>
      error instanceof PartyApplicationError &&
      error.code === "party.identity.conflict"
  );
  assert.equal(repository.addCalls, 0);
});

test("treats an identical durable-id create retry as idempotent", async () => {
  const { service, repository } = createService();
  const existing = createParty({
    classification: "natural-person",
    id: "party-1",
    companyId: "company-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    identity: { nationalCode: "0084575948" },
    createdAt: "2026-08-29T11:00:00.000Z"
  });
  repository.items.set(existing.id, existing);

  const result = await service.create({
    classification: "natural-person",
    context,
    partyId: "party-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    identity: { nationalCode: "0084575948" }
  });

  assert.equal(result.party, existing);
  assert.equal(result.idempotentReplay, true);
  assert.equal(repository.addCalls, 0);
});

test("rejects a durable-id retry whose semantic payload differs", async () => {
  const { service, repository } = createService();
  repository.items.set("party-1", createParty({
    classification: "natural-person",
    id: "party-1",
    companyId: "company-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    createdAt: "2026-08-29T11:00:00.000Z"
  }));

  await assert.rejects(
    service.create({
      classification: "natural-person",
      context,
      partyId: "party-1",
      code: "P-1",
      firstName: "علی",
      lastName: "محمدی"
    }),
    (error: unknown) =>
      error instanceof PartyApplicationError && error.code === "party.id.conflict"
  );
});

test("updates profile, excludes itself from duplicate lookup, and forwards expectedVersion", async () => {
  const { service, repository, lookup } = createService();
  const existing = createParty({
    classification: "legal-entity",
    id: "party-legal",
    companyId: "company-1",
    code: "P-10",
    legalName: "شرکت قدیم",
    roles: ["supplier"],
    createdAt: "2026-08-29T10:00:00.000Z"
  });
  repository.items.set(existing.id, existing);

  const result = await service.update({
    classification: "legal-entity",
    context: { ...context, occurredAt: "2026-08-29T13:00:00.000Z" },
    partyId: "party-legal",
    legalName: "شرکت جدید",
    tradeName: "برند جدید",
    identity: {},
    contacts: [],
    addresses: [],
    expectedVersion: 7
  });

  assert.equal(result.party.displayName, "برند جدید");
  assert.deepEqual(result.party.roles, ["supplier"]);
  assert.equal(repository.lastExpectedVersion, 7);
  assert.equal(lookup.lastProbe?.excludePartyId, "party-legal");
});

test("rejects classification changes through update", async () => {
  const { service, repository } = createService();
  repository.items.set("party-1", createParty({
    classification: "natural-person",
    id: "party-1",
    companyId: "company-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    createdAt: "2026-08-29T10:00:00.000Z"
  }));

  await assert.rejects(
    service.update({
      classification: "legal-entity",
      context: { ...context, occurredAt: "2026-08-29T13:00:00.000Z" },
      partyId: "party-1",
      legalName: "شرکت تبدیل‌شده",
      identity: {},
      contacts: [],
      addresses: []
    }),
    (error: unknown) =>
      error instanceof PartyApplicationError &&
      error.code === "party.classification.mismatch"
  );
});

test("status and role no-ops do not issue redundant repository updates", async () => {
  const { service, repository } = createService();
  repository.items.set("party-1", createParty({
    classification: "natural-person",
    id: "party-1",
    companyId: "company-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    roles: ["customer"],
    createdAt: "2026-08-29T10:00:00.000Z"
  }));

  await service.setStatus({
    context,
    partyId: "party-1",
    status: "active"
  });
  await service.addRole({
    context,
    partyId: "party-1",
    role: "customer"
  });
  await service.removeRole({
    context,
    partyId: "party-1",
    role: "supplier"
  });

  assert.equal(repository.updateCalls, 0);
});
