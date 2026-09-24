import {
  createPurchasePostingIdempotencyKey,
  type PurchasePostingPurpose,
} from "../../domain/purchase-posting-idempotency.ts";
import {
  createPurchasePostingSourceIdentity,
  createPurchasePostingTraceContext,
  type PurchasePostingSourceIdentity,
  type PurchasePostingTraceContext,
} from "../../domain/purchase-posting-source-reference.ts";
import {
  createPurchasePostingRule,
  type PurchasePostingRule,
} from "../../domain/purchase-posting-rules.ts";
import {
  rehydratePurchasePosting,
  type PurchasePostingAggregate,
} from "../../domain/purchase-posting.ts";
import type {
  PurchasePostingReversalRecord,
} from "../controlled-posting-reversal.ts";

export const PURCHASE_POSTING_SYNC_CONTRACT_VERSION = 1 as const;
export const PURCHASE_POSTING_SYNC_SCHEMA_VERSION = 1 as const;

export const PURCHASE_POSTING_SYNC_ENTITIES = Object.freeze([
  "purchase-posting",
  "purchase-posting-rule",
  "purchase-posting-reversal",
] as const);

export type PurchasePostingSyncEntity =
  (typeof PURCHASE_POSTING_SYNC_ENTITIES)[number];

export interface PurchasePostingSyncOrigin {
  readonly sourceSystem: string;
  readonly sourceInstanceId: string | null;
}

export type PurchasePostingSyncDependency =
  | Readonly<{ entity: "branch"; id: string }>
  | Readonly<{ entity: "purchase-document"; id: string }>
  | Readonly<{ entity: "journal-voucher"; id: string }>
  | Readonly<{ entity: "account"; id: string }>
  | Readonly<{ entity: "purchase-posting"; id: string }>;

export interface PurchasePostingSyncMetadataInput {
  readonly operationId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId?: string | null;
  readonly payloadFingerprint: string;
  readonly occurredAt: string;
  readonly effectiveAt: string;
  readonly changedAt: string;
  readonly origin: PurchasePostingSyncOrigin;
  readonly serverRevision?: number | null;
}

export interface PurchasePostingSyncMetadata {
  readonly contractVersion: typeof PURCHASE_POSTING_SYNC_CONTRACT_VERSION;
  readonly schemaVersion: typeof PURCHASE_POSTING_SYNC_SCHEMA_VERSION;
  readonly operationId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly payloadFingerprint: string;
  readonly occurredAt: string;
  readonly effectiveAt: string;
  readonly changedAt: string;
  readonly origin: Readonly<PurchasePostingSyncOrigin>;
  readonly serverRevision: number | null;
}

export interface PurchasePostingStateSyncEnvelope extends PurchasePostingSyncMetadata {
  readonly entity: "purchase-posting";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly branchId: string;
  readonly postingId: string;
  readonly localVersion: number;
  readonly source: Readonly<PurchasePostingSourceIdentity>;
  readonly postingPurpose: PurchasePostingPurpose;
  readonly idempotencyKey: string;
  readonly snapshot: Readonly<PurchasePostingAggregate>;
  readonly dependencies: readonly PurchasePostingSyncDependency[];
}

export interface PurchasePostingRuleSyncSnapshot {
  readonly rule: Readonly<PurchasePostingRule>;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PurchasePostingRuleSyncEnvelope extends PurchasePostingSyncMetadata {
  readonly entity: "purchase-posting-rule";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly branchId: string | null;
  readonly ruleId: string;
  readonly localVersion: number;
  readonly snapshot: Readonly<PurchasePostingRuleSyncSnapshot>;
  readonly dependencies: readonly PurchasePostingSyncDependency[];
}

export interface PurchasePostingReversalSyncEnvelope extends PurchasePostingSyncMetadata {
  readonly entity: "purchase-posting-reversal";
  readonly changeKind: "upsert";
  readonly companyId: string;
  readonly postingId: string;
  readonly localRevision: 1;
  readonly snapshot: Readonly<PurchasePostingReversalRecord>;
  readonly dependencies: readonly PurchasePostingSyncDependency[];
}

export interface CreatePurchasePostingStateSyncInput extends PurchasePostingSyncMetadataInput {
  readonly source: PurchasePostingSourceIdentity;
  readonly postingPurpose: PurchasePostingPurpose;
  readonly snapshot: PurchasePostingAggregate;
}

export interface CreatePurchasePostingRuleSyncInput extends PurchasePostingSyncMetadataInput {
  readonly snapshot: PurchasePostingRuleSyncSnapshot;
}

export interface CreatePurchasePostingReversalSyncInput extends PurchasePostingSyncMetadataInput {
  readonly companyId: string;
  readonly snapshot: PurchasePostingReversalRecord;
}

export type PurchasePostingSyncContractErrorCode =
  | "purchase-posting.sync.text-required"
  | "purchase-posting.sync.timestamp-invalid"
  | "purchase-posting.sync.version-invalid"
  | "purchase-posting.sync.server-revision-invalid"
  | "purchase-posting.sync.fingerprint-invalid"
  | "purchase-posting.sync.snapshot-mismatch"
  | "purchase-posting.sync.trace-invalid"
  | "purchase-posting.sync.reversal-invalid";

export class PurchasePostingSyncContractError extends Error {
  constructor(readonly code: PurchasePostingSyncContractErrorCode) {
    super(code);
    this.name = "PurchasePostingSyncContractError";
  }
}

const fail = (code: PurchasePostingSyncContractErrorCode): never => {
  throw new PurchasePostingSyncContractError(code);
};

const text = (value: string): string => {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > 128) {
    return fail("purchase-posting.sync.text-required");
  }
  return value.trim();
};

const timestamp = (value: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail("purchase-posting.sync.timestamp-invalid");
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return fail("purchase-posting.sync.timestamp-invalid");
  }
  return parsed.toISOString();
};

const positiveVersion = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 1) {
    return fail("purchase-posting.sync.version-invalid");
  }
  return value;
};

const fingerprint = (value: string): string => {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    return fail("purchase-posting.sync.fingerprint-invalid");
  }
  return value;
};

const origin = (value: PurchasePostingSyncOrigin): Readonly<PurchasePostingSyncOrigin> => {
  if (!value || typeof value !== "object") {
    return fail("purchase-posting.sync.text-required");
  }
  return Object.freeze({
    sourceSystem: text(value.sourceSystem),
    sourceInstanceId: value.sourceInstanceId == null ? null : text(value.sourceInstanceId),
  });
};

const metadata = (input: PurchasePostingSyncMetadataInput): PurchasePostingSyncMetadata => {
  const serverRevision = input.serverRevision ?? null;
  if (serverRevision !== null && (!Number.isSafeInteger(serverRevision) || serverRevision < 1)) {
    return fail("purchase-posting.sync.server-revision-invalid");
  }

  let trace: PurchasePostingTraceContext;
  try {
    trace = createPurchasePostingTraceContext({
      requestId: input.requestId,
      operationId: input.operationId,
      correlationId: input.correlationId,
      causationId: input.causationId,
    });
  } catch {
    return fail("purchase-posting.sync.trace-invalid");
  }

  const occurredAt = timestamp(input.occurredAt);
  const effectiveAt = timestamp(input.effectiveAt);
  const changedAt = timestamp(input.changedAt);
  if (
    Date.parse(effectiveAt) > Date.parse(changedAt)
    || Date.parse(occurredAt) > Date.parse(changedAt)
  ) {
    return fail("purchase-posting.sync.timestamp-invalid");
  }

  return Object.freeze({
    contractVersion: PURCHASE_POSTING_SYNC_CONTRACT_VERSION,
    schemaVersion: PURCHASE_POSTING_SYNC_SCHEMA_VERSION,
    operationId: trace.operationId,
    requestId: trace.requestId,
    correlationId: trace.correlationId,
    causationId: trace.causationId,
    payloadFingerprint: fingerprint(input.payloadFingerprint),
    occurredAt,
    effectiveAt,
    changedAt,
    origin: origin(input.origin),
    serverRevision,
  });
};

const dependencies = (
  items: readonly PurchasePostingSyncDependency[],
): readonly PurchasePostingSyncDependency[] => {
  const seen = new Set<string>();
  const normalized: PurchasePostingSyncDependency[] = [];
  for (const item of items) {
    const value = Object.freeze({ entity: item.entity, id: text(item.id) }) as PurchasePostingSyncDependency;
    const key = `${value.entity}\u0000${value.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  normalized.sort((left, right) =>
    left.entity === right.entity
      ? left.id.localeCompare(right.id)
      : left.entity.localeCompare(right.entity)
  );
  return Object.freeze(normalized);
};

export function createPurchasePostingStateSyncEnvelope(
  input: CreatePurchasePostingStateSyncInput,
): Readonly<PurchasePostingStateSyncEnvelope> {
  const meta = metadata(input);

  let source: PurchasePostingSourceIdentity;
  let snapshot: PurchasePostingAggregate;
  try {
    source = createPurchasePostingSourceIdentity(input.source);
    snapshot = rehydratePurchasePosting(input.snapshot);
  } catch {
    return fail("purchase-posting.sync.snapshot-mismatch");
  }

  if (
    snapshot.companyId !== source.companyId
    || snapshot.branchId !== source.branchId
    || Date.parse(snapshot.updatedAt) > Date.parse(meta.changedAt)
  ) {
    return fail("purchase-posting.sync.snapshot-mismatch");
  }

  const idempotencyKey = createPurchasePostingIdempotencyKey(
    source,
    input.postingPurpose,
  );

  const refs: PurchasePostingSyncDependency[] = [
    { entity: "branch", id: snapshot.branchId },
    { entity: "purchase-document", id: source.sourceId },
  ];
  if (snapshot.journalVoucherId !== null) {
    refs.push({ entity: "journal-voucher", id: snapshot.journalVoucherId });
  }

  return Object.freeze({
    ...meta,
    entity: "purchase-posting",
    changeKind: "upsert",
    companyId: snapshot.companyId,
    branchId: snapshot.branchId,
    postingId: snapshot.postingId,
    localVersion: positiveVersion(snapshot.version),
    source,
    postingPurpose: input.postingPurpose,
    idempotencyKey,
    snapshot,
    dependencies: dependencies(refs),
  });
}

export function createPurchasePostingRuleSyncEnvelope(
  input: CreatePurchasePostingRuleSyncInput,
): Readonly<PurchasePostingRuleSyncEnvelope> {
  const meta = metadata(input);
  const raw = input.snapshot;

  let rule: PurchasePostingRule;
  try {
    rule = createPurchasePostingRule(raw.rule);
  } catch {
    return fail("purchase-posting.sync.snapshot-mismatch");
  }

  const version = positiveVersion(raw.version);
  const createdAt = timestamp(raw.createdAt);
  const updatedAt = timestamp(raw.updatedAt);
  if (
    Date.parse(updatedAt) < Date.parse(createdAt)
    || Date.parse(updatedAt) > Date.parse(meta.changedAt)
  ) {
    return fail("purchase-posting.sync.timestamp-invalid");
  }

  const refs: PurchasePostingSyncDependency[] = [
    { entity: "account", id: rule.accountId },
  ];
  if (rule.branchId !== null) {
    refs.push({ entity: "branch", id: rule.branchId });
  }

  return Object.freeze({
    ...meta,
    entity: "purchase-posting-rule",
    changeKind: "upsert",
    companyId: rule.companyId,
    branchId: rule.branchId,
    ruleId: rule.ruleId,
    localVersion: version,
    snapshot: Object.freeze({
      rule,
      version,
      createdAt,
      updatedAt,
    }),
    dependencies: dependencies(refs),
  });
}

export function createPurchasePostingReversalSyncEnvelope(
  input: CreatePurchasePostingReversalSyncInput,
): Readonly<PurchasePostingReversalSyncEnvelope> {
  const meta = metadata(input);
  const companyId = text(input.companyId);
  const raw = input.snapshot;

  if (
    !raw
    || typeof raw !== "object"
    || raw.originalJournalVoucherId === raw.reversalJournalVoucherId
    || !Number.isSafeInteger(raw.committedPostingVersion)
    || raw.committedPostingVersion < 2
  ) {
    return fail("purchase-posting.sync.reversal-invalid");
  }

  const snapshot = Object.freeze({
    postingId: text(raw.postingId),
    originalJournalVoucherId: text(raw.originalJournalVoucherId),
    reversalJournalVoucherId: text(raw.reversalJournalVoucherId),
    requestId: text(raw.requestId),
    reversedBy: text(raw.reversedBy),
    reversedAt: timestamp(raw.reversedAt),
    reason: (() => {
      if (typeof raw.reason !== "string") return fail("purchase-posting.sync.reversal-invalid");
      const normalized = raw.reason.trim().replace(/\s+/gu, " ");
      if (normalized.length === 0 || normalized.length > 500) {
        return fail("purchase-posting.sync.reversal-invalid");
      }
      return normalized;
    })(),
    committedPostingVersion: positiveVersion(raw.committedPostingVersion),
  });

  if (Date.parse(snapshot.reversedAt) > Date.parse(meta.changedAt)) {
    return fail("purchase-posting.sync.timestamp-invalid");
  }

  return Object.freeze({
    ...meta,
    entity: "purchase-posting-reversal",
    changeKind: "upsert",
    companyId,
    postingId: snapshot.postingId,
    localRevision: 1,
    snapshot,
    dependencies: dependencies([
      { entity: "purchase-posting", id: snapshot.postingId },
      { entity: "journal-voucher", id: snapshot.originalJournalVoucherId },
      { entity: "journal-voucher", id: snapshot.reversalJournalVoucherId },
    ]),
  });
}
