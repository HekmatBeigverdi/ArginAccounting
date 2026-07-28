import {
  DuplicatePluginError,
  PluginDependencyCycleError,
  PluginDependencyMissingError,
  PluginDependencyVersionError,
  PluginNotFoundError,
} from "./plugin-errors.ts";
import type {
  PluginRegistry,
} from "./plugin-registry.ts";
import type {
  PluginDefinition,
  PluginQuery,
} from "./plugin.ts";
import {
  compareSemanticVersions,
  normalizePluginDefinition,
  normalizePluginId,
  normalizePluginQuery,
} from "./plugin-validation.ts";

export class InMemoryPluginRegistry
  implements PluginRegistry {
  readonly #plugins =
    new Map<string, PluginDefinition>();

  register(
    definition: PluginDefinition,
  ): void {
    const normalized =
      normalizePluginDefinition(definition);

    const pluginId =
      normalized.manifest.pluginId;

    if (this.#plugins.has(pluginId)) {
      throw new DuplicatePluginError(
        pluginId,
      );
    }

    this.#plugins.set(
      pluginId,
      normalized,
    );
  }

  get(
    pluginId: string,
  ): PluginDefinition | undefined {
    return this.#plugins.get(
      normalizePluginId(pluginId),
    );
  }

  require(
    pluginId: string,
  ): PluginDefinition {
    const normalizedId =
      normalizePluginId(pluginId);

    const plugin =
      this.#plugins.get(normalizedId);

    if (plugin === undefined) {
      throw new PluginNotFoundError(
        normalizedId,
      );
    }

    return plugin;
  }

  has(
    pluginId: string,
  ): boolean {
    return this.#plugins.has(
      normalizePluginId(pluginId),
    );
  }

  list(
    query: PluginQuery = {},
  ): readonly PluginDefinition[] {
    const normalized =
      normalizePluginQuery(query);

    return Object.freeze(
      [...this.#plugins.values()]
        .filter(
          (plugin) =>
            normalized.capabilityId ===
              undefined ||
            plugin.manifest.capabilities.some(
              (capability) =>
                capability.capabilityId ===
                normalized.capabilityId,
            ),
        )
        .filter(
          (plugin) =>
            normalized.extensionPoint ===
              undefined ||
            plugin.contributions.some(
              (contribution) =>
                contribution.extensionPoint ===
                normalized.extensionPoint,
            ),
        )
        .sort((left, right) =>
          left.manifest.pluginId.localeCompare(
            right.manifest.pluginId,
          ),
        ),
    );
  }

  validateDependencies(): void {
    for (
      const plugin
      of this.#plugins.values()
    ) {
      this.#validatePluginDependencies(
        plugin,
      );
    }

    this.#validateDependencyCycles();
  }

  #validatePluginDependencies(
    plugin: PluginDefinition,
  ): void {
    for (
      const dependency
      of plugin.manifest.dependencies
    ) {
      const registered =
        this.#plugins.get(
          dependency.pluginId,
        );

      if (registered === undefined) {
        if (dependency.optional === true) {
          continue;
        }

        throw new PluginDependencyMissingError(
          plugin.manifest.pluginId,
          dependency.pluginId,
        );
      }

      if (
        compareSemanticVersions(
          registered.manifest.version,
          dependency.minimumVersion,
        ) < 0
      ) {
        throw new PluginDependencyVersionError(
          plugin.manifest.pluginId,
          dependency.pluginId,
          dependency.minimumVersion,
          registered.manifest.version,
        );
      }
    }
  }

  #validateDependencyCycles(): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];

    const visit = (
      pluginId: string,
    ): void => {
      if (visiting.has(pluginId)) {
        const cycleStart =
          path.indexOf(pluginId);

        throw new PluginDependencyCycleError(
          Object.freeze([
            ...path.slice(cycleStart),
            pluginId,
          ]),
        );
      }

      if (visited.has(pluginId)) {
        return;
      }

      visiting.add(pluginId);
      path.push(pluginId);

      const plugin =
        this.#plugins.get(pluginId);

      for (
        const dependency
        of plugin?.manifest.dependencies ?? []
      ) {
        if (
          dependency.optional !== true &&
          this.#plugins.has(
            dependency.pluginId,
          )
        ) {
          visit(dependency.pluginId);
        }
      }

      path.pop();
      visiting.delete(pluginId);
      visited.add(pluginId);
    };

    for (
      const pluginId
      of this.#plugins.keys()
    ) {
      visit(pluginId);
    }
  }

  get pluginCount(): number {
    return this.#plugins.size;
  }

  clear(): void {
    this.#plugins.clear();
  }
}
