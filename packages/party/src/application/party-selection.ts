import type {
  PartyRole,
  PartyStatus
} from "../domain/party.ts";
import type {
  PartySelectorDto
} from "./contracts/party-dto.ts";
import type {
  PartySelectorQuery
} from "./contracts/party-queries.ts";

export interface PartySelectionPolicy {
  readonly roles?: readonly PartyRole[];
  readonly statuses?: readonly PartyStatus[];
  readonly limit?: number;
}

export interface PartySelectionReference {
  readonly partyId: string;
  readonly code: string;
  readonly displayName: string;
  readonly classification: PartySelectorDto["classification"];
  readonly roles: readonly PartyRole[];
}

export type PartySelectionContractErrorCode =
  | "party.selection.companyId.required"
  | "party.selection.limit.invalid";

export class PartySelectionContractError extends Error {
  constructor(
    readonly code: PartySelectionContractErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PartySelectionContractError";
  }
}

export function buildPartySelectorQuery(
  companyId: string,
  search: string | null | undefined,
  policy: PartySelectionPolicy = {}
): PartySelectorQuery {
  const normalizedCompanyId = companyId.trim();
  if (!normalizedCompanyId) {
    throw new PartySelectionContractError(
      "party.selection.companyId.required",
      "Party selector company scope is required."
    );
  }

  const limit = policy.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new PartySelectionContractError(
      "party.selection.limit.invalid",
      "Party selector limit must be an integer between 1 and 100."
    );
  }

  const normalizedSearch = search?.trim();
  const roles = normalizeValues(policy.roles ?? []);
  const statuses = normalizeValues(policy.statuses ?? ["active"]);

  return Object.freeze({
    companyId: normalizedCompanyId,
    ...(normalizedSearch ? { search: normalizedSearch } : {}),
    ...(roles.length > 0 ? { roles } : {}),
    ...(statuses.length > 0 ? { statuses } : {}),
    limit
  });
}

export function toPartySelectionReference(
  party: PartySelectorDto
): PartySelectionReference {
  return Object.freeze({
    partyId: party.id,
    code: party.code,
    displayName: party.displayName,
    classification: party.classification,
    roles: Object.freeze([...party.roles])
  });
}

export function isPartySelectionEligible(
  party: PartySelectorDto,
  policy: PartySelectionPolicy = {}
): boolean {
  const allowedStatuses = policy.statuses ?? ["active"];
  if (allowedStatuses.length > 0 && !allowedStatuses.includes(party.status)) {
    return false;
  }

  const requiredRoles = policy.roles ?? [];
  return requiredRoles.length === 0 ||
    requiredRoles.some((role) => party.roles.includes(role));
}

function normalizeValues<TValue extends string>(
  values: readonly TValue[]
): readonly TValue[] {
  return Object.freeze([...new Set(values)]);
}
