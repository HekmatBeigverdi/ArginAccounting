import {
  PartyDomainError,
  createParty,
  type Party
} from "./party.ts";
import type {
  LegalEntityIdentityInput,
  NaturalPersonIdentityInput
} from "./party-identity.ts";
import type { PartyContactInput } from "./party-contact.ts";
import type { PartyAddressInput } from "./party-address.ts";

export interface UpdateNaturalPersonProfileInput {
  readonly classification: "natural-person";
  readonly firstName: string;
  readonly lastName: string;
  readonly identity: NaturalPersonIdentityInput;
  readonly contacts: readonly PartyContactInput[];
  readonly addresses: readonly PartyAddressInput[];
}

export interface UpdateLegalEntityProfileInput {
  readonly classification: "legal-entity";
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly identity: LegalEntityIdentityInput;
  readonly contacts: readonly PartyContactInput[];
  readonly addresses: readonly PartyAddressInput[];
}

export type UpdatePartyProfileInput =
  | UpdateNaturalPersonProfileInput
  | UpdateLegalEntityProfileInput;

export class PartyProfileError extends Error {
  constructor(
    readonly code: "party.classification.mismatch",
    message: string
  ) {
    super(message);
    this.name = "PartyProfileError";
  }
}

export function updatePartyProfile(
  party: Party,
  input: UpdatePartyProfileInput,
  updatedAt: string
): Party {
  if (party.classification !== input.classification) {
    throw new PartyProfileError(
      "party.classification.mismatch",
      "Party classification cannot be changed by profile update."
    );
  }

  const normalizedUpdatedAt = updatedAt.trim();
  if (
    normalizedUpdatedAt.length === 0 ||
    Number.isNaN(Date.parse(normalizedUpdatedAt))
  ) {
    throw new PartyDomainError(
      "party.updatedAt.invalid",
      "Party updatedAt must be a valid timestamp."
    );
  }
  if (Date.parse(normalizedUpdatedAt) < Date.parse(party.updatedAt)) {
    throw new PartyDomainError(
      "party.updatedAt.beforeCurrent",
      "Party updatedAt cannot move backwards."
    );
  }

  const rebuilt = input.classification === "natural-person"
    ? createParty({
        classification: "natural-person",
        id: party.id,
        companyId: party.companyId,
        code: party.code,
        firstName: input.firstName,
        lastName: input.lastName,
        roles: party.roles,
        identity: input.identity,
        contacts: input.contacts,
        addresses: input.addresses,
        createdAt: party.createdAt
      })
    : createParty({
        classification: "legal-entity",
        id: party.id,
        companyId: party.companyId,
        code: party.code,
        legalName: input.legalName,
        tradeName: input.tradeName,
        roles: party.roles,
        identity: input.identity,
        contacts: input.contacts,
        addresses: input.addresses,
        createdAt: party.createdAt
      });

  return Object.freeze({
    ...rebuilt,
    status: party.status,
    createdAt: party.createdAt,
    updatedAt: normalizedUpdatedAt
  }) as Party;
}
