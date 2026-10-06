import type {
  CreateSalesCommercialTermsInput,
  SalesCommercialTerms,
} from "../../domain/sales-commercial-terms.ts";
import { createSalesDocument, type SalesDocumentSnapshot } from "../../domain/sales-document.ts";
import type { SalesPersistedDocument } from "../sales-persistence.ts";
import type { SalesMutationContext } from "../sales-replay-safety.ts";

export const SALES_SYNC_CONTRACT_VERSION = 1 as const;
export const SALES_SYNC_CHANGE_KINDS = Object.freeze(["upsert", "tombstone"] as const);

export interface SalesSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export interface SalesSyncExternalReference {
  readonly sourceSystem: string;
  readonly externalId: string;
}

export type SalesSyncDependency = Readonly<{
  entity: "branch" | "fiscal-year" | "party" | "product" | "sales-document" | "sales-line";
  id: string;
}>;

interface MetadataInput {
  readonly mutation: SalesMutationContext;
  readonly changedAt: string;
  readonly origin: SalesSyncOrigin;
  readonly serverRevision?: number | null;
  readonly externalReferences?: readonly SalesSyncExternalReference[];
}

interface Metadata {
  readonly contractVersion: typeof SALES_SYNC_CONTRACT_VERSION;
  readonly requestId: string;
  readonly operationId: string;
  readonly operation: string;
  readonly payloadFingerprint: string;
  readonly actorUserId: string;
  readonly changedAt: string;
  readonly origin: Readonly<SalesSyncOrigin>;
  readonly serverRevision: number | null;
  readonly externalReferences: readonly Readonly<SalesSyncExternalReference>[];
}

export interface SalesSyncDocumentReference {
  readonly companyId: string;
  readonly branchId: string;
  readonly documentId: string;
  readonly documentNumber: string | null;
}

interface SalesDocumentSyncBase extends Metadata {
  readonly entity: "sales-document";
  readonly reference: Readonly<SalesSyncDocumentReference>;
  readonly localVersion: number;
  readonly dependencies: readonly SalesSyncDependency[];
}

export interface SalesDocumentSyncUpsertEnvelope extends SalesDocumentSyncBase {
  readonly changeKind: "upsert";
  readonly deletedAt: null;
  readonly lifecycleStatus: SalesPersistedDocument["lifecycle"]["status"];
  readonly snapshot: Readonly<SalesDocumentSnapshot>;
}

export interface SalesDocumentSyncTombstoneEnvelope extends SalesDocumentSyncBase {
  readonly changeKind: "tombstone";
  readonly deletedAt: string;
  readonly lifecycleStatus: "draft";
  readonly snapshot: null;
}

export type SalesDocumentSyncEnvelope =
  | SalesDocumentSyncUpsertEnvelope
  | SalesDocumentSyncTombstoneEnvelope;

interface UpsertEnvelopeInput extends MetadataInput {
  readonly state: SalesPersistedDocument;
  readonly reference: SalesSyncDocumentReference;
}

interface TombstoneEnvelopeInput extends MetadataInput {
  readonly reference: SalesSyncDocumentReference;
  readonly localVersion: number;
  readonly lastKnownStatus: string;
  readonly deletedAt: string;
}

export class SalesSyncContractError extends Error {
  constructor(
    public readonly code:
      | "sales.sync.text-required"
      | "sales.sync.timestamp-invalid"
      | "sales.sync.version-invalid"
      | "sales.sync.reference-invalid"
      | "sales.sync.snapshot-mismatch"
      | "sales.sync.metadata-mismatch"
      | "sales.sync.tombstone-invalid"
      | "sales.sync.external-reference-invalid"
      | "sales.sync.external-reference-duplicate",
  ) {
    super(code);
    this.name = "SalesSyncContractError";
  }
}

function fail(code: SalesSyncContractError["code"]): never {
  throw new SalesSyncContractError(code);
}

function requiredText(value: string): string {
  if (typeof value !== "string" || !value.trim()) return fail("sales.sync.text-required");
  return value.trim();
}

function normalizeTimestamp(value: string): string {
  const milliseconds = Date.parse(value);
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(milliseconds)) {
    return fail("sales.sync.timestamp-invalid");
  }
  return new Date(milliseconds).toISOString();
}

function positiveVersion(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) return fail("sales.sync.version-invalid");
  return value;
}

function normalizeExternalReferences(
  references: readonly SalesSyncExternalReference[],
): readonly Readonly<SalesSyncExternalReference>[] {
  if (!Array.isArray(references)) return fail("sales.sync.external-reference-invalid");

  const seen = new Set<string>();
  const normalized = references.map((reference) => {
    if (!reference || typeof reference !== "object") {
      return fail("sales.sync.external-reference-invalid");
    }
    const normalizedReference = Object.freeze({
      sourceSystem: requiredText(reference.sourceSystem),
      externalId: requiredText(reference.externalId),
    });
    const key = normalizedReference.sourceSystem.toUpperCase() + "\0" + normalizedReference.externalId;
    if (seen.has(key)) return fail("sales.sync.external-reference-duplicate");
    seen.add(key);
    return normalizedReference;
  });
  return Object.freeze(normalized);
}

function createMetadata(input: MetadataInput): Metadata {
  const { mutation } = input;
  if (!mutation || typeof mutation !== "object") return fail("sales.sync.metadata-mismatch");

  const changedAt = normalizeTimestamp(input.changedAt);
  if (Date.parse(mutation.occurredAt) > Date.parse(changedAt)) {
    return fail("sales.sync.timestamp-invalid");
  }
  const serverRevision = input.serverRevision ?? null;
  if (serverRevision !== null) positiveVersion(serverRevision);
  const externalReferences = normalizeExternalReferences(input.externalReferences ?? []);

  return Object.freeze({
    contractVersion: SALES_SYNC_CONTRACT_VERSION,
    requestId: requiredText(mutation.requestId),
    operationId: requiredText(mutation.operationId),
    operation: requiredText(mutation.operation),
    payloadFingerprint: requiredText(mutation.payloadFingerprint),
    actorUserId: requiredText(mutation.actorUserId),
    changedAt,
    origin: Object.freeze({
      sourceSystem: requiredText(input.origin.sourceSystem),
      sourceInstanceId: input.origin.sourceInstanceId == null
        ? null
        : requiredText(input.origin.sourceInstanceId),
    }),
    serverRevision,
    externalReferences,
  });
}

function normalizeReference(reference: SalesSyncDocumentReference): Readonly<SalesSyncDocumentReference> {
  if (!reference || typeof reference !== "object") return fail("sales.sync.reference-invalid");
  return Object.freeze({
    companyId: requiredText(reference.companyId),
    branchId: requiredText(reference.branchId),
    documentId: requiredText(reference.documentId),
    documentNumber: reference.documentNumber == null ? null : requiredText(reference.documentNumber),
  });
}

function collectDependencies(snapshot: SalesDocumentSnapshot): readonly SalesSyncDependency[] {
  const dependencies: SalesSyncDependency[] = [
    { entity: "branch", id: snapshot.scope.branchId },
    { entity: "fiscal-year", id: snapshot.scope.fiscalYearId },
    { entity: "party", id: snapshot.customer.partyId },
    ...snapshot.lines.map((line) => ({ entity: "product" as const, id: line.item.productId })),
  ];
  if (snapshot.relatedDocumentReference) {
    dependencies.push({ entity: "sales-document", id: snapshot.relatedDocumentReference.documentId });
  }
  for (const line of snapshot.lines) {
    const source = line.sourceReference;
    if (source?.sourceSystem !== "sales") continue;

    dependencies.push({ entity: "sales-document", id: source.sourceDocumentId });
    if (source.sourceLineId) {
      dependencies.push({ entity: "sales-line", id: source.sourceLineId });
    }
  }

  const seen = new Set<string>();
  const uniqueDependencies = dependencies.filter((dependency) => {
    const key = dependency.entity + "\0" + dependency.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return Object.freeze(uniqueDependencies.map((dependency) => Object.freeze(dependency)));
}

function toCommercialTermsInput(
  terms: SalesCommercialTerms | null,
): CreateSalesCommercialTermsInput | null {
  if (terms == null) return null;

  // Stored adjustments use specific identity fields; constructors accept `id`.
  return {
    ...terms,
    discounts: terms.discounts.map(({ discountId, ...adjustment }) => ({
      id: discountId,
      ...adjustment,
    })),
    charges: terms.charges.map(({ chargeId, ...adjustment }) => ({
      id: chargeId,
      ...adjustment,
    })),
  };
}

function rehydrateDocument(snapshot: SalesDocumentSnapshot): SalesDocumentSnapshot {
  return createSalesDocument({
    documentId: snapshot.documentId,
    documentType: snapshot.documentType,
    companyId: snapshot.scope.companyId,
    branchId: snapshot.scope.branchId,
    fiscalYearId: snapshot.scope.fiscalYearId,
    customer: snapshot.customer,
    documentNumber: snapshot.documentNumber,
    businessDate: snapshot.businessDate,
    description: snapshot.description,
    sourceReference: snapshot.sourceReference,
    relatedDocumentReference: snapshot.relatedDocumentReference,
    lines: snapshot.lines.map((line) => ({
      lineId: line.lineId,
      position: line.position,
      lineKind: line.lineKind,
      productId: line.item.productId,
      itemType: line.item.itemType,
      description: line.description,
      sourceReference: line.sourceReference,
      commercialTerms: toCommercialTermsInput(line.commercialTerms),
    })),
  });
}

export function createSalesDocumentSyncUpsertEnvelope(
  input: UpsertEnvelopeInput,
): Readonly<SalesDocumentSyncUpsertEnvelope> {
  const metadata = createMetadata(input);
  const reference = normalizeReference(input.reference);
  const { state, mutation } = input;
  let snapshot: SalesDocumentSnapshot;
  try {
    snapshot = rehydrateDocument(state.document);
  } catch {
    return fail("sales.sync.snapshot-mismatch");
  }

  if (
    snapshot.scope.companyId !== reference.companyId ||
    snapshot.scope.branchId !== reference.branchId ||
    snapshot.documentId !== reference.documentId ||
    snapshot.documentNumber !== reference.documentNumber ||
    mutation.companyId !== reference.companyId ||
    mutation.branchId !== reference.branchId
  ) {
    return fail("sales.sync.snapshot-mismatch");
  }
  if (Date.parse(state.updatedAt) > Date.parse(metadata.changedAt)) {
    return fail("sales.sync.timestamp-invalid");
  }

  return Object.freeze({
    ...metadata,
    entity: "sales-document",
    changeKind: "upsert",
    reference,
    localVersion: positiveVersion(state.version),
    dependencies: collectDependencies(snapshot),
    deletedAt: null,
    lifecycleStatus: state.lifecycle.status,
    snapshot,
  });
}

export function createSalesDocumentSyncTombstoneEnvelope(
  input: TombstoneEnvelopeInput,
): Readonly<SalesDocumentSyncTombstoneEnvelope> {
  const metadata = createMetadata(input);
  const reference = normalizeReference(input.reference);
  const deletedAt = normalizeTimestamp(input.deletedAt);
  if (
    input.lastKnownStatus !== "draft" ||
    Date.parse(deletedAt) > Date.parse(metadata.changedAt) ||
    input.mutation.companyId !== reference.companyId ||
    input.mutation.branchId !== reference.branchId
  ) {
    return fail("sales.sync.tombstone-invalid");
  }

  return Object.freeze({
    ...metadata,
    entity: "sales-document",
    changeKind: "tombstone",
    reference,
    localVersion: positiveVersion(input.localVersion),
    dependencies: Object.freeze([{ entity: "branch", id: reference.branchId }] as const),
    deletedAt,
    lifecycleStatus: "draft",
    snapshot: null,
  });
}
