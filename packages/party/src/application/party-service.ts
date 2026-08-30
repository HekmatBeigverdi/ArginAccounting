import {
  activateParty,
  addPartyRole,
  createParty,
  deactivateParty,
  removePartyRole,
  type Party
} from "../domain/party.ts";
import {
  PartyProfileError,
  updatePartyProfile
} from "../domain/party-profile.ts";
import { PartyApplicationError } from "./contracts/party-errors.ts";
import type {
  AddPartyRoleCommand,
  CreatePartyCommand,
  RemovePartyRoleCommand,
  SetPartyStatusCommand,
  UpdatePartyCommand
} from "./contracts/party-commands.ts";
import type {
  PartyDuplicateAssessment,
  PartyDuplicateCandidate,
  PartyDuplicateLookup,
  PartyDuplicateProbe
} from "./contracts/party-duplicate.ts";
import type { PartyUnitOfWork } from "./contracts/party-unit-of-work.ts";

export interface PartyMutationResult {
  readonly party: Party;
  readonly advisoryMatches: readonly PartyDuplicateCandidate[];
  readonly idempotentReplay: boolean;
}

export class PartyApplicationService {
  constructor(
    private readonly unitOfWork: PartyUnitOfWork,
    private readonly duplicateLookup: PartyDuplicateLookup
  ) {}

  async create(command: CreatePartyCommand): Promise<PartyMutationResult> {
    return this.unitOfWork.run(async ({ parties }) => {
      const existingById = await parties.findById(
        command.context.companyId,
        command.partyId
      );
      const candidate = createPartyFromCommand(command);

      if (existingById !== null) {
        if (isSameCreatePayload(existingById, candidate)) {
          return Object.freeze({
            party: existingById,
            advisoryMatches: Object.freeze([]),
            idempotentReplay: true
          });
        }
        throw new PartyApplicationError(
          "party.id.conflict",
          "Party durable id is already assigned to different master data."
        );
      }

      const existingByCode = await parties.findByCode(
        command.context.companyId,
        candidate.code
      );
      if (existingByCode !== null) {
        throw new PartyApplicationError(
          "party.code.conflict",
          "Party code is already in use in this company."
        );
      }

      const assessment = await this.assessDuplicates(candidate);
      throwOnHardConflict(assessment.hardConflicts);
      await parties.add(candidate);

      return Object.freeze({
        party: candidate,
        advisoryMatches: Object.freeze([...assessment.advisoryMatches]),
        idempotentReplay: false
      });
    });
  }

  async update(command: UpdatePartyCommand): Promise<PartyMutationResult> {
    return this.unitOfWork.run(async ({ parties }) => {
      const current = await requireParty(
        parties.findById(command.context.companyId, command.partyId)
      );
      if (current.classification !== command.classification) {
        throw new PartyApplicationError(
          "party.classification.mismatch",
          "Party classification cannot be changed by update."
        );
      }

      let updated: Party;
      try {
        updated = updatePartyProfile(
          current,
          command.classification === "natural-person"
            ? {
                classification: "natural-person",
                firstName: command.firstName,
                lastName: command.lastName,
                identity: command.identity,
                contacts: command.contacts,
                addresses: command.addresses
              }
            : {
                classification: "legal-entity",
                legalName: command.legalName,
                tradeName: command.tradeName ?? null,
                identity: command.identity,
                contacts: command.contacts,
                addresses: command.addresses
              },
          command.context.occurredAt
        );
      } catch (error) {
        if (error instanceof PartyProfileError) {
          throw new PartyApplicationError(error.code, error.message);
        }
        throw error;
      }

      const assessment = await this.assessDuplicates(updated, current.id);
      throwOnHardConflict(assessment.hardConflicts);
      await parties.update(updated, command.expectedVersion);

      return Object.freeze({
        party: updated,
        advisoryMatches: Object.freeze([...assessment.advisoryMatches]),
        idempotentReplay: false
      });
    });
  }

  async setStatus(command: SetPartyStatusCommand): Promise<Party> {
    return this.unitOfWork.run(async ({ parties }) => {
      const current = await requireParty(
        parties.findById(command.context.companyId, command.partyId)
      );
      const updated = command.status === "active"
        ? activateParty(current, command.context.occurredAt)
        : deactivateParty(current, command.context.occurredAt);
      if (updated !== current) {
        await parties.update(updated, command.expectedVersion);
      }
      return updated;
    });
  }

  async addRole(command: AddPartyRoleCommand): Promise<Party> {
    return this.unitOfWork.run(async ({ parties }) => {
      const current = await requireParty(
        parties.findById(command.context.companyId, command.partyId)
      );
      const updated = addPartyRole(
        current,
        command.role,
        command.context.occurredAt
      );
      if (updated !== current) {
        await parties.update(updated, command.expectedVersion);
      }
      return updated;
    });
  }

  async removeRole(command: RemovePartyRoleCommand): Promise<Party> {
    return this.unitOfWork.run(async ({ parties }) => {
      const current = await requireParty(
        parties.findById(command.context.companyId, command.partyId)
      );
      const updated = removePartyRole(
        current,
        command.role,
        command.context.occurredAt
      );
      if (updated !== current) {
        await parties.update(updated, command.expectedVersion);
      }
      return updated;
    });
  }

  async assessDuplicates(
    party: Party,
    excludePartyId?: string | null
  ): Promise<PartyDuplicateAssessment> {
    const probe = buildDuplicateProbe(party, excludePartyId);
    const [hardConflicts, advisoryMatches] = await Promise.all([
      this.duplicateLookup.findHardCandidates(probe),
      this.duplicateLookup.findAdvisoryCandidates(probe)
    ]);
    return Object.freeze({
      hardConflicts: Object.freeze([...hardConflicts]),
      advisoryMatches: Object.freeze([...advisoryMatches])
    });
  }
}

function createPartyFromCommand(command: CreatePartyCommand): Party {
  if (command.classification === "natural-person") {
    return createParty({
      classification: "natural-person",
      id: command.partyId,
      companyId: command.context.companyId,
      code: command.code,
      firstName: command.firstName,
      lastName: command.lastName,
      roles: command.roles ?? [],
      identity: command.identity ?? {},
      contacts: command.contacts ?? [],
      addresses: command.addresses ?? [],
      createdAt: command.context.occurredAt
    });
  }
  return createParty({
    classification: "legal-entity",
    id: command.partyId,
    companyId: command.context.companyId,
    code: command.code,
    legalName: command.legalName,
    tradeName: command.tradeName ?? null,
    roles: command.roles ?? [],
    identity: command.identity ?? {},
    contacts: command.contacts ?? [],
    addresses: command.addresses ?? [],
    createdAt: command.context.occurredAt
  });
}

function buildDuplicateProbe(
  party: Party,
  excludePartyId?: string | null
): PartyDuplicateProbe {
  return Object.freeze({
    companyId: party.companyId,
    excludePartyId: excludePartyId ?? null,
    code: party.code,
    classification: party.classification,
    displayName: party.displayName,
    nationalCode: party.classification === "natural-person"
      ? party.identity.nationalCode
      : null,
    nationalId: party.classification === "legal-entity"
      ? party.identity.nationalId
      : null,
    economicNumber: party.identity.economicNumber
  });
}

function throwOnHardConflict(
  conflicts: readonly PartyDuplicateCandidate[]
): void {
  if (conflicts.length === 0) return;
  const first = conflicts[0];
  if (first?.reason === "code") {
    throw new PartyApplicationError(
      "party.code.conflict",
      "Party code is already in use in this company."
    );
  }
  throw new PartyApplicationError(
    "party.identity.conflict",
    "An official Party identity is already in use in this company."
  );
}

async function requireParty(promise: Promise<Party | null>): Promise<Party> {
  const party = await promise;
  if (party === null) {
    throw new PartyApplicationError("party.notFound", "Party was not found.");
  }
  return party;
}

function isSameCreatePayload(existing: Party, candidate: Party): boolean {
  return JSON.stringify(toCreateFingerprint(existing)) ===
    JSON.stringify(toCreateFingerprint(candidate));
}

function toCreateFingerprint(party: Party): object {
  if (party.classification === "natural-person") {
    return {
      classification: party.classification,
      id: party.id,
      companyId: party.companyId,
      code: party.code,
      firstName: party.firstName,
      lastName: party.lastName,
      roles: party.roles,
      identity: party.identity,
      contacts: party.contacts,
      addresses: party.addresses
    };
  }
  return {
    classification: party.classification,
    id: party.id,
    companyId: party.companyId,
    code: party.code,
    legalName: party.legalName,
    tradeName: party.tradeName,
    roles: party.roles,
    identity: party.identity,
    contacts: party.contacts,
    addresses: party.addresses
  };
}
