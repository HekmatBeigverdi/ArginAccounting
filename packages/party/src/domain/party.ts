import {
  createLegalEntityIdentity,
  createNaturalPersonIdentity,
  type LegalEntityIdentity,
  type LegalEntityIdentityInput,
  type NaturalPersonIdentity,
  type NaturalPersonIdentityInput
} from "./party-identity.ts";

export const partyClassifications = [
  "natural-person",
  "legal-entity"
] as const;

export type PartyClassification =
  (typeof partyClassifications)[number];

export type PartyStatus = "active" | "inactive";

export const partyRoles = [
  "customer",
  "supplier"
] as const;

export type PartyRole = (typeof partyRoles)[number];

export interface PartyBase {
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly status: PartyStatus;
  readonly roles: readonly PartyRole[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NaturalPersonParty extends PartyBase {
  readonly classification: "natural-person";
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly identity: NaturalPersonIdentity;
}

export interface LegalEntityParty extends PartyBase {
  readonly classification: "legal-entity";
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly displayName: string;
  readonly identity: LegalEntityIdentity;
}

export type Party = NaturalPersonParty | LegalEntityParty;

export interface CreateNaturalPersonPartyInput {
  readonly classification: "natural-person";
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: string;
  readonly roles?: readonly PartyRole[];
  readonly identity?: NaturalPersonIdentityInput;
}

export interface CreateLegalEntityPartyInput {
  readonly classification: "legal-entity";
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly createdAt: string;
  readonly roles?: readonly PartyRole[];
  readonly identity?: LegalEntityIdentityInput;
}

export type CreatePartyInput =
  | CreateNaturalPersonPartyInput
  | CreateLegalEntityPartyInput;

export interface PartyMergeBoundary {
  readonly allowed: boolean;
  readonly reason: "same-party" | "cross-company" | null;
}

export class PartyDomainError extends Error {
  constructor(
    readonly code:
      | "party.id.required"
      | "party.companyId.required"
      | "party.code.required"
      | "party.firstName.required"
      | "party.lastName.required"
      | "party.legalName.required"
      | "party.createdAt.invalid"
      | "party.updatedAt.invalid"
      | "party.updatedAt.beforeCurrent"
      | "party.role.invalid",
    message: string
  ) {
    super(message);
    this.name = "PartyDomainError";
  }
}

export function isPartyClassification(
  value: unknown
): value is PartyClassification {
  return typeof value === "string" &&
    partyClassifications.includes(value as PartyClassification);
}

export function isPartyRole(value: unknown): value is PartyRole {
  return typeof value === "string" &&
    partyRoles.includes(value as PartyRole);
}

export function createParty(
  input: CreateNaturalPersonPartyInput
): NaturalPersonParty;
export function createParty(
  input: CreateLegalEntityPartyInput
): LegalEntityParty;
export function createParty(input: CreatePartyInput): Party;
export function createParty(input: CreatePartyInput): Party {
  const id = requireText(input.id, "party.id.required", "Party id is required.");
  const companyId = requireText(
    input.companyId,
    "party.companyId.required",
    "Party company scope is required."
  );
  const code = requireText(
    input.code,
    "party.code.required",
    "Party display code is required."
  );
  const createdAt = requireTimestamp(input.createdAt, "createdAt");
  const roles = normalizeRoles(input.roles ?? []);

  if (input.classification === "natural-person") {
    const firstName = requireText(
      input.firstName,
      "party.firstName.required",
      "Natural-person first name is required."
    );
    const lastName = requireText(
      input.lastName,
      "party.lastName.required",
      "Natural-person last name is required."
    );

    return freezeParty({
      id,
      companyId,
      code,
      status: "active",
      roles,
      classification: input.classification,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      identity: createNaturalPersonIdentity(input.identity),
      createdAt,
      updatedAt: createdAt
    });
  }

  const legalName = requireText(
    input.legalName,
    "party.legalName.required",
    "Legal-entity name is required."
  );
  const tradeName = normalizeOptionalText(input.tradeName);

  return freezeParty({
    id,
    companyId,
    code,
    status: "active",
    roles,
    classification: input.classification,
    legalName,
    tradeName,
    displayName: tradeName ?? legalName,
    identity: createLegalEntityIdentity(input.identity),
    createdAt,
    updatedAt: createdAt
  });
}

export function addPartyRole(
  party: Party,
  role: PartyRole,
  updatedAt: string
): Party {
  if (!isPartyRole(role)) {
    throw new PartyDomainError(
      "party.role.invalid",
      `Unsupported Party role: ${String(role)}`
    );
  }

  if (party.roles.includes(role)) {
    return party;
  }

  return replaceParty(party, {
    roles: normalizeRoles([...party.roles, role]),
    updatedAt: requireMutationTimestamp(party, updatedAt)
  });
}

export function removePartyRole(
  party: Party,
  role: PartyRole,
  updatedAt: string
): Party {
  if (!isPartyRole(role)) {
    throw new PartyDomainError(
      "party.role.invalid",
      `Unsupported Party role: ${String(role)}`
    );
  }

  if (!party.roles.includes(role)) {
    return party;
  }

  return replaceParty(party, {
    roles: party.roles.filter((currentRole) => currentRole !== role),
    updatedAt: requireMutationTimestamp(party, updatedAt)
  });
}

export function activateParty(party: Party, updatedAt: string): Party {
  if (party.status === "active") {
    return party;
  }

  return replaceParty(party, {
    status: "active",
    updatedAt: requireMutationTimestamp(party, updatedAt)
  });
}

export function deactivateParty(party: Party, updatedAt: string): Party {
  if (party.status === "inactive") {
    return party;
  }

  return replaceParty(party, {
    status: "inactive",
    updatedAt: requireMutationTimestamp(party, updatedAt)
  });
}

export function assessPartyMergeBoundary(
  source: Party,
  target: Party
): PartyMergeBoundary {
  if (source.id === target.id) {
    return Object.freeze({ allowed: false, reason: "same-party" });
  }

  if (source.companyId !== target.companyId) {
    return Object.freeze({ allowed: false, reason: "cross-company" });
  }

  return Object.freeze({ allowed: true, reason: null });
}

function requireText<TCode extends PartyDomainError["code"]>(
  value: string,
  code: TCode,
  message: string
): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new PartyDomainError(code, message);
  }
  return normalized;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRoles(roles: readonly PartyRole[]): readonly PartyRole[] {
  const normalized: PartyRole[] = [];

  for (const role of roles) {
    if (!isPartyRole(role)) {
      throw new PartyDomainError(
        "party.role.invalid",
        `Unsupported Party role: ${String(role)}`
      );
    }
    if (!normalized.includes(role)) {
      normalized.push(role);
    }
  }

  return Object.freeze(normalized);
}

function requireTimestamp(
  value: string,
  field: "createdAt" | "updatedAt"
): string {
  const normalized = value.trim();
  if (normalized.length === 0 || Number.isNaN(Date.parse(normalized))) {
    throw new PartyDomainError(
      field === "createdAt"
        ? "party.createdAt.invalid"
        : "party.updatedAt.invalid",
      `Party ${field} must be a valid timestamp.`
    );
  }
  return normalized;
}

function requireMutationTimestamp(party: Party, value: string): string {
  const updatedAt = requireTimestamp(value, "updatedAt");
  if (Date.parse(updatedAt) < Date.parse(party.updatedAt)) {
    throw new PartyDomainError(
      "party.updatedAt.beforeCurrent",
      "Party updatedAt cannot move backwards."
    );
  }
  return updatedAt;
}

function replaceParty(
  party: Party,
  patch: Partial<Pick<PartyBase, "status" | "roles" | "updatedAt">>
): Party {
  return freezeParty({ ...party, ...patch } as Party);
}

function freezeParty<TParty extends Party>(party: TParty): TParty {
  if (!Object.isFrozen(party.roles)) {
    Object.freeze(party.roles);
  }
  return Object.freeze(party);
}
