import type {
  PartyClassification,
  PartyRole,
  PartyStatus
} from "../../domain/party.ts";
import type { PartyAddress } from "../../domain/party-address.ts";
import type { PartyContact } from "../../domain/party-contact.ts";
import type { PartyIdentityDto } from "./party-dto.ts";

export const partySyncChangeKinds = ["upsert", "tombstone"] as const;
export type PartySyncChangeKind = (typeof partySyncChangeKinds)[number];

export interface PartyExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export interface PartySyncEntityReference {
  readonly companyId: string;
  readonly partyId: string;
  readonly displayCode: string;
}

export interface PartySyncSnapshot {
  readonly id: string;
  readonly companyId: string;
  readonly code: string;
  readonly classification: PartyClassification;
  readonly status: PartyStatus;
  readonly displayName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly legalName: string | null;
  readonly tradeName: string | null;
  readonly roles: readonly PartyRole[];
  readonly identity: PartyIdentityDto;
  readonly contacts: readonly PartyContact[];
  readonly addresses: readonly PartyAddress[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PartySyncEnvelopeBase {
  readonly entity: "party";
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly reference: PartySyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences: readonly PartyExternalReference[];
}

export interface PartySyncUpsertEnvelope extends PartySyncEnvelopeBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly snapshot: PartySyncSnapshot;
}

export interface PartySyncTombstoneEnvelope extends PartySyncEnvelopeBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly snapshot: null;
}

export type PartySyncChangeEnvelope =
  | PartySyncUpsertEnvelope
  | PartySyncTombstoneEnvelope;

export interface CreatePartySyncUpsertInput {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly reference: PartySyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences?: readonly PartyExternalReference[];
  readonly snapshot: PartySyncSnapshot;
}

export interface CreatePartySyncTombstoneInput {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly reference: PartySyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly deletedAt: string;
  readonly externalReferences?: readonly PartyExternalReference[];
}

export type PartySyncContractErrorCode =
  | "party.sync.operationId.required"
  | "party.sync.idempotencyKey.required"
  | "party.sync.reference.invalid"
  | "party.sync.version.invalid"
  | "party.sync.timestamp.invalid"
  | "party.sync.snapshot.mismatch"
  | "party.sync.externalReference.invalid"
  | "party.sync.externalReference.duplicate";

export class PartySyncContractError extends Error {
  constructor(readonly code: PartySyncContractErrorCode, message: string) {
    super(message);
    this.name = "PartySyncContractError";
  }
}

export function createPartySyncUpsertEnvelope(
  input: CreatePartySyncUpsertInput
): PartySyncUpsertEnvelope {
  const base = normalizeBase(input);
  if (
    input.snapshot.id !== base.reference.partyId ||
    input.snapshot.companyId !== base.reference.companyId ||
    input.snapshot.code !== base.reference.displayCode
  ) {
    throw new PartySyncContractError(
      "party.sync.snapshot.mismatch",
      "Party sync snapshot must match the durable entity reference and display code."
    );
  }

  return Object.freeze({
    ...base,
    entity: "party",
    changeKind: "upsert",
    deletedAt: null,
    snapshot: input.snapshot
  });
}

export function createPartySyncTombstoneEnvelope(
  input: CreatePartySyncTombstoneInput
): PartySyncTombstoneEnvelope {
  const base = normalizeBase(input);
  const deletedAt = requireTimestamp(input.deletedAt);
  if (Date.parse(deletedAt) > Date.parse(base.changedAt)) {
    throw new PartySyncContractError(
      "party.sync.timestamp.invalid",
      "Party tombstone deletedAt cannot be later than changedAt."
    );
  }

  return Object.freeze({
    ...base,
    entity: "party",
    changeKind: "tombstone",
    deletedAt,
    snapshot: null
  });
}

function normalizeBase(input: {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly reference: PartySyncEntityReference;
  readonly version: number;
  readonly changedAt: string;
  readonly externalReferences?: readonly PartyExternalReference[];
}) {
  const operationId = requireText(
    input.operationId,
    "party.sync.operationId.required",
    "Party sync operation id is required."
  );
  const idempotencyKey = requireText(
    input.idempotencyKey,
    "party.sync.idempotencyKey.required",
    "Party sync idempotency key is required."
  );
  const reference = normalizeReference(input.reference);
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new PartySyncContractError(
      "party.sync.version.invalid",
      "Party sync version must be a positive safe integer."
    );
  }

  return Object.freeze({
    operationId,
    idempotencyKey,
    reference,
    version: input.version,
    changedAt: requireTimestamp(input.changedAt),
    externalReferences: normalizeExternalReferences(input.externalReferences ?? [])
  });
}

function normalizeReference(reference: PartySyncEntityReference): PartySyncEntityReference {
  const companyId = reference.companyId.trim();
  const partyId = reference.partyId.trim();
  const displayCode = reference.displayCode.trim();
  if (!companyId || !partyId || !displayCode) {
    throw new PartySyncContractError(
      "party.sync.reference.invalid",
      "Party sync reference requires companyId, durable partyId, and displayCode."
    );
  }
  return Object.freeze({ companyId, partyId, displayCode });
}

function normalizeExternalReferences(
  references: readonly PartyExternalReference[]
): readonly PartyExternalReference[] {
  const normalized: PartyExternalReference[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    const sourceSystem = reference.sourceSystem.trim();
    const externalId = reference.externalId.trim();
    if (!sourceSystem || !externalId) {
      throw new PartySyncContractError(
        "party.sync.externalReference.invalid",
        "Party external reference requires sourceSystem and externalId."
      );
    }
    const key = `${sourceSystem}\u0000${externalId}`;
    if (seen.has(key)) {
      throw new PartySyncContractError(
        "party.sync.externalReference.duplicate",
        "Duplicate Party external reference."
      );
    }
    seen.add(key);
    normalized.push(Object.freeze({ sourceSystem, externalId }));
  }
  return Object.freeze(normalized);
}

function requireText(
  value: string,
  code: PartySyncContractErrorCode,
  message: string
): string {
  const normalized = value.trim();
  if (!normalized) throw new PartySyncContractError(code, message);
  return normalized;
}

function requireTimestamp(value: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new PartySyncContractError(
      "party.sync.timestamp.invalid",
      "Party sync timestamps must be valid ISO-compatible timestamps."
    );
  }
  return normalized;
}
