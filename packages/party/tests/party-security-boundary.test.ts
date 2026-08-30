import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyApplicationError,
  PartyApplicationService,
  SecuredPartyApplicationService,
  partyPermissions,
  type Party,
  type PartyAuditEvent,
  type PartyAuthorizationContext,
  type PartyAuthorizationPolicy,
  type PartyDuplicateLookup,
  type PartyPermission,
  type PartyRepository,
  type PartyUnitOfWork
} from "../src/index.ts";

class MemoryRepository implements PartyRepository {
  readonly values = new Map<string, Party>();
  async findById(companyId: string, partyId: string): Promise<Party | null> {
    return this.values.get(`${companyId}:${partyId}`) ?? null;
  }
  async findByCode(companyId: string, code: string): Promise<Party | null> {
    return [...this.values.values()].find((party) => party.companyId === companyId && party.code === code) ?? null;
  }
  async add(party: Party): Promise<void> {
    this.values.set(`${party.companyId}:${party.id}`, party);
  }
  async update(party: Party): Promise<void> {
    this.values.set(`${party.companyId}:${party.id}`, party);
  }
}

function createInner(repository: MemoryRepository): PartyApplicationService {
  const unitOfWork: PartyUnitOfWork = {
    run: async (operation) => operation({ parties: repository })
  };
  const duplicates: PartyDuplicateLookup = {
    findHardCandidates: async () => [],
    findAdvisoryCandidates: async () => []
  };
  return new PartyApplicationService(unitOfWork, duplicates);
}

const context = {
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-1",
  requestId: "req-1",
  occurredAt: "2026-08-30T12:00:00.000Z"
} as const;

test("authorization is enforced before mutation", async () => {
  const repository = new MemoryRepository();
  const policy: PartyAuthorizationPolicy = {
    require: async (_context: PartyAuthorizationContext, permission: PartyPermission) => {
      assert.equal(permission, partyPermissions.create);
      throw new PartyApplicationError("party.permissionDenied", "denied");
    }
  };
  const secured = new SecuredPartyApplicationService(
    createInner(repository),
    policy,
    { record: async () => undefined }
  );

  await assert.rejects(
    secured.create({
      classification: "natural-person",
      partyId: "party-1",
      code: "1001",
      firstName: "علی",
      lastName: "رضایی",
      context
    }),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.permissionDenied"
  );
  assert.equal(repository.values.size, 0);
});

test("successful create records one correlated audit event", async () => {
  const repository = new MemoryRepository();
  const events: PartyAuditEvent[] = [];
  const secured = new SecuredPartyApplicationService(
    createInner(repository),
    { require: async () => undefined },
    { record: async (event) => { events.push(event); } }
  );

  await secured.create({
    classification: "legal-entity",
    partyId: "party-2",
    code: "2001",
    legalName: "شرکت آزمون",
    context
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.action, "party.create");
  assert.equal(events[0]?.partyId, "party-2");
  assert.equal(events[0]?.correlationId, context.correlationId);
  assert.equal(events[0]?.requestId, context.requestId);
});
