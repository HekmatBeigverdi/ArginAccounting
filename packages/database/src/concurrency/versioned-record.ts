import type {
  EntityVersion,
} from "./entity-version";

export interface VersionedRecord {
  readonly version: EntityVersion;
}

export interface VersionedUpdate {
  readonly expectedVersion: EntityVersion;
}
