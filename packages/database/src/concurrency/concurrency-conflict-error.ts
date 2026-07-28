import type {
  EntityVersion,
} from "./entity-version";

export class ConcurrencyConflictError
  extends Error {
  readonly code =
    "data.concurrency-conflict" as const;

  constructor(
    readonly entityType: string,
    readonly entityId: string,
    readonly expectedVersion: EntityVersion,
  ) {
    super(
      `The ${entityType} "${entityId}" was changed ` +
      `after version ${expectedVersion} was read.`,
    );

    this.name = "ConcurrencyConflictError";
  }
}
