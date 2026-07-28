export type PluginErrorCode =
  | "plugin.not-found"
  | "plugin.duplicate"
  | "plugin.dependency-missing"
  | "plugin.dependency-version"
  | "plugin.dependency-cycle";

export class PluginNotFoundError extends Error {
  readonly code = "plugin.not-found" as const;

  constructor(
    readonly pluginId: string,
  ) {
    super(`Plugin "${pluginId}" was not found.`);
    this.name = "PluginNotFoundError";
  }
}

export class DuplicatePluginError extends Error {
  readonly code = "plugin.duplicate" as const;

  constructor(
    readonly pluginId: string,
  ) {
    super(
      `Plugin "${pluginId}" is already registered.`,
    );

    this.name = "DuplicatePluginError";
  }
}

export class PluginDependencyMissingError
  extends Error {
  readonly code =
    "plugin.dependency-missing" as const;

  constructor(
    readonly pluginId: string,
    readonly dependencyId: string,
  ) {
    super(
      `Plugin "${pluginId}" requires missing ` +
      `plugin "${dependencyId}".`,
    );

    this.name =
      "PluginDependencyMissingError";
  }
}

export class PluginDependencyVersionError
  extends Error {
  readonly code =
    "plugin.dependency-version" as const;

  constructor(
    readonly pluginId: string,
    readonly dependencyId: string,
    readonly minimumVersion: string,
    readonly actualVersion: string,
  ) {
    super(
      `Plugin "${pluginId}" requires ` +
      `"${dependencyId}" version ` +
      `${minimumVersion} or later, but ` +
      `${actualVersion} is registered.`,
    );

    this.name =
      "PluginDependencyVersionError";
  }
}

export class PluginDependencyCycleError
  extends Error {
  readonly code =
    "plugin.dependency-cycle" as const;

  constructor(
    readonly pluginIds: readonly string[],
  ) {
    super(
      "Plugin dependency cycle detected: " +
      pluginIds.join(" -> "),
    );

    this.name =
      "PluginDependencyCycleError";
  }
}
