import type {
  DatabaseExecuteResult,
} from "../contracts/database-execute-result.ts";
import {
  ConcurrencyConflictError,
} from "./concurrency-conflict-error.ts";
import {
  assertEntityVersion,
  type EntityVersion,
} from "./entity-version.ts";

export interface VersionedUpdateTarget {
  readonly entityType: string;
  readonly entityId: string;
  readonly expectedVersion: EntityVersion;
}

export function assertVersionedUpdate(
  result: DatabaseExecuteResult,
  target: VersionedUpdateTarget,
): void {
  assertEntityVersion(target.expectedVersion);

  if (result.rowsAffected === 1) {
    return;
  }

  if (result.rowsAffected === 0) {
    throw new ConcurrencyConflictError(
      target.entityType,
      target.entityId,
      target.expectedVersion,
    );
  }

  throw new Error(
    `Versioned update for ${target.entityType} ` +
    `"${target.entityId}" affected ` +
    `${result.rowsAffected} rows; expected exactly one.`,
  );
}
