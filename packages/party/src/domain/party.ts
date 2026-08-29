export const partyClassifications = [
  "natural-person",
  "legal-entity"
] as const;

export type PartyClassification =
  (typeof partyClassifications)[number];

export type PartyStatus = "active" | "inactive";

export interface PartyBase {
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly status: PartyStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NaturalPersonParty extends PartyBase {
  readonly classification: "natural-person";
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
}

export interface LegalEntityParty extends PartyBase {
  readonly classification: "legal-entity";
  readonly legalName: string;
  readonly tradeName: string | null;
  readonly displayName: string;
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
}

export interface CreateLegalEntityPartyInput {
  readonly classification: "legal-entity";
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName?: string | null;
  readonly createdAt: string;
}

export type CreatePartyInput =
  | CreateNaturalPersonPartyInput
  | CreateLegalEntityPartyInput;

export class PartyDomainError extends Error {
  constructor(
    readonly code:
      | "party.id.required"
      | "party.companyId.required"
      | "party.code.required"
      | "party.firstName.required"
      | "party.lastName.required"
      | "party.legalName.required"
      | "party.createdAt.invalid",
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
  const createdAt = requireTimestamp(input.createdAt);

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

    return Object.freeze({
      id,
      companyId,
      code,
      status: "active",
      classification: input.classification,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
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

  return Object.freeze({
    id,
    companyId,
    code,
    status: "active",
    classification: input.classification,
    legalName,
    tradeName,
    displayName: tradeName ?? legalName,
    createdAt,
    updatedAt: createdAt
  });
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

function requireTimestamp(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || Number.isNaN(Date.parse(normalized))) {
    throw new PartyDomainError(
      "party.createdAt.invalid",
      "Party createdAt must be a valid timestamp."
    );
  }
  return normalized;
}
