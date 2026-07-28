export type EntityVersion = number;

export function assertEntityVersion(
  version: number,
): asserts version is EntityVersion {
  if (
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    throw new TypeError(
      "Entity version must be a positive safe integer.",
    );
  }
}

export function nextEntityVersion(
  currentVersion: EntityVersion,
): EntityVersion {
  assertEntityVersion(currentVersion);

  const nextVersion = currentVersion + 1;

  assertEntityVersion(nextVersion);

  return nextVersion;
}
