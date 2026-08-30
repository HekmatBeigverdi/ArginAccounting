import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyApplicationError,
  PartyApplicationService,
  SecuredPartyReader,
  createParty,
  partyPermissions,
  type PageResult,
  type Party,
  type PartyAuthorizationContext,
  type PartyAuthorizationPolicy,
  type PartyDuplicateCandidate,
  type PartyDuplicateLookup,
  type PartyDuplicateProbe,
  type PartyReader,
  type PartyRepository,
  type PartySelectorDto,
  type PartySummaryDto,
  type PartyUnitOfWork
} from "../src/index.ts";

class MemoryRepository implements PartyRepository {
  readonly items = new Map<string, Party>();
  updateCalls: Array<{ party: Party; expectedVersion: number | null | undefined }> = [];

  async findById(companyId: string, partyId: string): Promise<Party | null> {
    const party = this.items.get(partyId) ?? null;
    return party?.companyId === companyId ? party : null;
  }

  async findByCode(companyId: string, code: string): Promise<Party | null> {
    return [...this.items.values()].find((party) => party.companyId === companyId && party.code === code) ?? null;
  }

  async add(party: Party): Promise<void> {
    this.items.set(party.id, party);
  }

  async update(party: Party, expectedVersion?: number | null): Promise<void> {
    this.updateCalls.push({ party, expectedVersion });
    this.items.set(party.id, party);
  }
}

class DuplicateLookup implements PartyDuplicateLookup {
  hard: readonly PartyDuplicateCandidate[] = [];
  advisory: readonly PartyDuplicateCandidate[] = [];
  probe: PartyDuplicateProbe | null = null;

  async findHardCandidates(probe: PartyDuplicateProbe) {
    this.probe = probe;
    return this.hard;
  }

  async findAdvisoryCandidates(probe: PartyDuplicateProbe) {
    this.probe = probe;
    return this.advisory;
  }
}

const context = {
  companyId: "company-1",
  actorId: "user-1",
  correlationId: "corr-step16",
  requestId: "req-step16",
  occurredAt: "2026-08-30T15:45:00.000Z"
} as const;

function setup() {
  const repository = new MemoryRepository();
  const duplicates = new DuplicateLookup();
  const unitOfWork: PartyUnitOfWork = {
    run: async (operation) => operation({ parties: repository })
  };
  return {
    repository,
    duplicates,
    service: new PartyApplicationService(unitOfWork, duplicates)
  };
}

function naturalParty(id = "party-1"): Party {
  return createParty({
    classification: "natural-person",
    id,
    companyId: "company-1",
    code: "P-1",
    firstName: "علی",
    lastName: "رضایی",
    roles: ["customer"],
    createdAt: "2026-08-30T14:00:00.000Z"
  });
}

test("create reports company-scoped code conflicts before duplicate lookup", async () => {
  const { service, repository, duplicates } = setup();
  repository.items.set("existing", naturalParty("existing"));

  await assert.rejects(
    service.create({
      classification: "natural-person",
      context,
      partyId: "party-new",
      code: "P-1",
      firstName: "رضا",
      lastName: "محمدی"
    }),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.code.conflict"
  );
  assert.equal(duplicates.probe, null);
});

test("missing Party yields the stable not-found error for every mutation boundary", async () => {
  const { service } = setup();
  const commands = [
    () => service.setStatus({ context, partyId: "missing", status: "inactive" }),
    () => service.addRole({ context, partyId: "missing", role: "supplier" }),
    () => service.removeRole({ context, partyId: "missing", role: "customer" })
  ];

  for (const execute of commands) {
    await assert.rejects(
      execute(),
      (error: unknown) => error instanceof PartyApplicationError && error.code === "party.notFound"
    );
  }
});

test("expectedVersion is forwarded for status and role mutations that actually change state", async () => {
  const { service, repository } = setup();
  repository.items.set("party-1", naturalParty());

  await service.setStatus({
    context,
    partyId: "party-1",
    status: "inactive",
    expectedVersion: 11
  });
  await service.addRole({
    context: { ...context, occurredAt: "2026-08-30T15:46:00.000Z" },
    partyId: "party-1",
    role: "supplier",
    expectedVersion: 12
  });
  await service.removeRole({
    context: { ...context, occurredAt: "2026-08-30T15:47:00.000Z" },
    partyId: "party-1",
    role: "customer",
    expectedVersion: 13
  });

  assert.deepEqual(repository.updateCalls.map((call) => call.expectedVersion), [11, 12, 13]);
});

test("duplicate assessment preserves hard and advisory evidence independently", async () => {
  const { service, duplicates } = setup();
  duplicates.hard = [{
    partyId: "hard-1",
    code: "P-2",
    displayName: "شخص قطعی",
    classification: "natural-person",
    reason: "nationalCode",
    severity: "hard"
  }];
  duplicates.advisory = [{
    partyId: "advisory-1",
    code: "P-3",
    displayName: "شخص مشابه",
    classification: "natural-person",
    reason: "displayName",
    severity: "advisory"
  }];

  const assessment = await service.assessDuplicates(naturalParty(), "party-1");
  assert.equal(assessment.hardConflicts[0]?.partyId, "hard-1");
  assert.equal(assessment.advisoryMatches[0]?.partyId, "advisory-1");
  assert.equal(duplicates.probe?.excludePartyId, "party-1");
});

test("secured reader enforces view permission with the queried company scope before delegating", async () => {
  let delegated = false;
  let authorizationContext: PartyAuthorizationContext | null = null;
  const inner: PartyReader = {
    getById: async () => null,
    list: async (): Promise<PageResult<PartySummaryDto>> => {
      delegated = true;
      return { items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
    },
    select: async (): Promise<readonly PartySelectorDto[]> => []
  };
  const policy: PartyAuthorizationPolicy = {
    require: async (ctx, permission) => {
      authorizationContext = ctx;
      assert.equal(permission, partyPermissions.view);
      throw new PartyApplicationError("party.permissionDenied", "denied");
    }
  };
  const reader = new SecuredPartyReader(inner, policy, {
    actorId: "reader-user",
    correlationId: "reader-corr",
    requestId: "reader-req"
  });

  await assert.rejects(
    reader.list({
      filter: { companyId: "company-2" },
      page: { page: 1, pageSize: 20 },
      sort: { field: "displayName", direction: "asc" }
    }),
    (error: unknown) => error instanceof PartyApplicationError && error.code === "party.permissionDenied"
  );

  assert.equal(delegated, false);
  assert.equal(authorizationContext?.companyId, "company-2");
  assert.equal(authorizationContext?.actorId, "reader-user");
});
