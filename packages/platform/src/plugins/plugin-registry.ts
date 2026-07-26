import type {
  PluginDefinition,
  PluginQuery,
} from "./plugin.ts";

export interface PluginRegistry {
  register(
    definition: PluginDefinition,
  ): void;

  get(
    pluginId: string,
  ): PluginDefinition | undefined;

  require(
    pluginId: string,
  ): PluginDefinition;

  has(
    pluginId: string,
  ): boolean;

  list(
    query?: PluginQuery,
  ): readonly PluginDefinition[];

  validateDependencies(): void;
}
