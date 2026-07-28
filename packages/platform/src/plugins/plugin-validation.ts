import {
  PLUGIN_API_VERSION,
  type PluginCapability,
  type PluginContribution,
  type PluginDefinition,
  type PluginDependency,
  type PluginManifest,
  type PluginQuery,
} from "./plugin.ts";

const identifierPattern =
  /^[a-z][a-z0-9-]*$/;

const namespacedIdentifierPattern =
  /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

const semanticVersionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function normalizePluginDefinition(
  definition: PluginDefinition,
): PluginDefinition {
  const manifest = normalizePluginManifest(
    definition.manifest,
  );

  const contributionIds = new Set<string>();

  const contributions =
    definition.contributions.map(
      (contribution) => {
        const normalized =
          normalizePluginContribution(
            contribution,
          );

        if (
          contributionIds.has(
            normalized.contributionId,
          )
        ) {
          throw new TypeError(
            `Plugin contribution ` +
            `"${normalized.contributionId}" ` +
            "is duplicated.",
          );
        }

        contributionIds.add(
          normalized.contributionId,
        );

        return normalized;
      },
    );

  return Object.freeze({
    manifest,
    contributions:
      Object.freeze(contributions),
  });
}

export function normalizePluginManifest(
  manifest: PluginManifest,
): PluginManifest {
  const pluginId =
    normalizePluginId(manifest.pluginId);

  if (
    manifest.apiVersion !==
    PLUGIN_API_VERSION
  ) {
    throw new TypeError(
      `Unsupported plugin API version ` +
      `"${String(manifest.apiVersion)}".`,
    );
  }

  const capabilityIds = new Set<string>();

  const capabilities =
    manifest.capabilities.map(
      (capability) => {
        const normalized =
          normalizePluginCapability(
            capability,
          );

        if (
          capabilityIds.has(
            normalized.capabilityId,
          )
        ) {
          throw new TypeError(
            `Plugin capability ` +
            `"${normalized.capabilityId}" ` +
            "is duplicated.",
          );
        }

        capabilityIds.add(
          normalized.capabilityId,
        );

        return normalized;
      },
    );

  const dependencyIds = new Set<string>();

  const dependencies =
    manifest.dependencies.map(
      (dependency) => {
        const normalized =
          normalizePluginDependency(
            dependency,
          );

        if (
          normalized.pluginId === pluginId
        ) {
          throw new TypeError(
            `Plugin "${pluginId}" cannot ` +
            "depend on itself.",
          );
        }

        if (
          dependencyIds.has(
            normalized.pluginId,
          )
        ) {
          throw new TypeError(
            `Plugin dependency ` +
            `"${normalized.pluginId}" ` +
            "is duplicated.",
          );
        }

        dependencyIds.add(
          normalized.pluginId,
        );

        return normalized;
      },
    );
  const description = normalizeOptionalText(
    manifest.description,
  );
  const vendor = normalizeOptionalText(
    manifest.vendor,
  );

  return Object.freeze({
    pluginId,
    displayName: normalizeRequiredText(
      manifest.displayName,
      "displayName",
    ),
    version: normalizeSemanticVersion(
      manifest.version,
      "version",
    ),
    apiVersion: PLUGIN_API_VERSION,
    capabilities:
      Object.freeze(capabilities),
    dependencies:
      Object.freeze(dependencies),
    ...(description === undefined
      ? {}
      : { description }),
    ...(vendor === undefined ? {} : { vendor }),
  });
}

export function normalizePluginQuery(
  query: PluginQuery,
): PluginQuery {
  const capabilityId =
    query.capabilityId === undefined
      ? undefined
      : normalizeNamespacedIdentifier(
          query.capabilityId,
          "capabilityId",
        );

  const extensionPoint =
    query.extensionPoint === undefined
      ? undefined
      : normalizeNamespacedIdentifier(
          query.extensionPoint,
          "extensionPoint",
        );

  return Object.freeze({
    ...(capabilityId === undefined
      ? {}
      : { capabilityId }),
    ...(extensionPoint === undefined
      ? {}
      : { extensionPoint }),
  });
}

export function normalizePluginId(
  pluginId: string,
): string {
  const normalized = pluginId.trim();

  if (!identifierPattern.test(normalized)) {
    throw new TypeError(
      "Plugin ID must use lowercase " +
      "kebab-case notation.",
    );
  }

  return normalized;
}

export function normalizeSemanticVersion(
  version: string,
  fieldName = "version",
): string {
  const normalized = version.trim();

  if (
    !semanticVersionPattern.test(normalized)
  ) {
    throw new TypeError(
      `Plugin ${fieldName} must use ` +
      "MAJOR.MINOR.PATCH notation.",
    );
  }

  return normalized;
}

export function compareSemanticVersions(
  left: string,
  right: string,
): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);

  const differences = [
    leftParts[0] - rightParts[0],
    leftParts[1] - rightParts[1],
    leftParts[2] - rightParts[2],
  ];

  for (const difference of differences) {
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function normalizePluginCapability(
  capability: PluginCapability,
): PluginCapability {
  const description = normalizeOptionalText(
    capability.description,
  );

  return Object.freeze({
    capabilityId:
      normalizeNamespacedIdentifier(
        capability.capabilityId,
        "capabilityId",
      ),
    ...(description === undefined
      ? {}
      : { description }),
  });
}

function normalizePluginDependency(
  dependency: PluginDependency,
): PluginDependency {
  return Object.freeze({
    pluginId: normalizePluginId(
      dependency.pluginId,
    ),
    minimumVersion:
      normalizeSemanticVersion(
        dependency.minimumVersion,
        "dependency minimumVersion",
      ),
    optional: dependency.optional ?? false,
  });
}

function normalizePluginContribution(
  contribution: PluginContribution,
): PluginContribution {
  const metadata =
    contribution.metadata === undefined
      ? undefined
      : Object.freeze({
          ...contribution.metadata,
        });

  return Object.freeze({
    extensionPoint:
      normalizeNamespacedIdentifier(
        contribution.extensionPoint,
        "extensionPoint",
      ),
    contributionId:
      normalizeSimpleIdentifier(
        contribution.contributionId,
        "contributionId",
      ),
    ...(metadata === undefined
      ? {}
      : { metadata }),
  });
}

function normalizeNamespacedIdentifier(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (
    !namespacedIdentifierPattern.test(
      normalized,
    )
  ) {
    throw new TypeError(
      `Plugin ${fieldName} must use ` +
      "lowercase module-prefixed " +
      "dot-separated notation.",
    );
  }

  return normalized;
}

function normalizeSimpleIdentifier(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (!identifierPattern.test(normalized)) {
    throw new TypeError(
      `Plugin ${fieldName} must use ` +
      "lowercase kebab-case notation.",
    );
  }

  return normalized;
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new TypeError(
      `Plugin ${fieldName} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeOptionalText(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0
    ? undefined
    : normalized;
}

function parseVersion(
  version: string,
): readonly [number, number, number] {
  const normalized =
    normalizeSemanticVersion(version);

  const parts = normalized
    .split(".")
    .map(Number);

  return [
    parts[0] ?? 0,
    parts[1] ?? 0,
    parts[2] ?? 0,
  ];
}
