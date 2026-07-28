export const PLUGIN_API_VERSION = "1" as const;

export type PluginApiVersion =
  typeof PLUGIN_API_VERSION;

export interface PluginCapability {
  /**
   * A stable, module-prefixed capability name.
   *
   * Examples:
   * - reporting.financial-statements
   * - taxpayer.invoice-submission
   * - inventory.barcode-import
   */
  readonly capabilityId: string;

  readonly description?: string;
}

export interface PluginDependency {
  readonly pluginId: string;

  /**
   * Lowest compatible version accepted by the plugin.
   */
  readonly minimumVersion: string;

  /**
   * Optional dependencies do not prevent registration.
   */
  readonly optional?: boolean;
}

export interface PluginManifest {
  readonly pluginId: string;
  readonly displayName: string;
  readonly version: string;
  readonly apiVersion: PluginApiVersion;
  readonly description?: string;
  readonly vendor?: string;

  readonly capabilities:
    readonly PluginCapability[];

  readonly dependencies:
    readonly PluginDependency[];
}

export interface PluginContribution {
  /**
   * Stable platform extension point.
   *
   * Examples:
   * - reports.provider
   * - taxpayer.transport
   * - import.format
   */
  readonly extensionPoint: string;

  /**
   * Identifier unique inside the plugin.
   */
  readonly contributionId: string;

  /**
   * Declarative metadata only.
   *
   * Runtime callbacks, executable source code,
   * secrets, and native handles must not be
   * stored here.
   */
  readonly metadata?:
    Readonly<Record<string, unknown>>;
}

export interface PluginDefinition {
  readonly manifest: PluginManifest;

  readonly contributions:
    readonly PluginContribution[];
}

export interface PluginQuery {
  readonly capabilityId?: string;
  readonly extensionPoint?: string;
}
