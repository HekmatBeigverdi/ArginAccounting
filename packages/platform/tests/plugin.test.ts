import assert from "node:assert/strict";
import test from "node:test";

import {
  DuplicatePluginError,
  InMemoryPluginRegistry,
  PLUGIN_API_VERSION,
  PluginDependencyCycleError,
  PluginDependencyMissingError,
  PluginDependencyVersionError,
  PluginNotFoundError,
  compareSemanticVersions,
  type PluginDefinition,
} from "../src/index.ts";

function createPlugin(
  pluginId: string,
  options: {
    readonly version?: string;
    readonly capabilities?: readonly string[];
    readonly dependencies?: readonly {
      readonly pluginId: string;
      readonly minimumVersion: string;
      readonly optional?: boolean;
    }[];
    readonly extensionPoints?: readonly string[];
  } = {},
): PluginDefinition {
  return {
    manifest: {
      pluginId,
      displayName: pluginId,
      version: options.version ?? "1.0.0",
      apiVersion: PLUGIN_API_VERSION,
      capabilities:
        (options.capabilities ?? []).map(
          (capabilityId) => ({
            capabilityId,
          }),
        ),
      dependencies:
        options.dependencies ?? [],
    },
    contributions:
      (options.extensionPoints ?? []).map(
        (extensionPoint, index) => ({
          extensionPoint,
          contributionId:
            `contribution-${index + 1}`,
        }),
      ),
  };
}

test("plugin can be registered and retrieved", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("taxpayer-connector", {
      capabilities: [
        "taxpayer.invoice-submission",
      ],
    }),
  );

  const plugin = registry.require(
    "taxpayer-connector",
  );

  assert.equal(
    plugin.manifest.pluginId,
    "taxpayer-connector",
  );

  assert.equal(registry.pluginCount, 1);
});

test("plugin identifiers use lowercase kebab-case", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register(
        createPlugin("TaxpayerConnector"),
      ),
    TypeError,
  );
});

test("plugin versions use semantic version notation", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register(
        createPlugin("invalid-version", {
          version: "1.0",
        }),
      ),
    TypeError,
  );
});

test("duplicate plugin identifiers are rejected", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("report-provider"),
  );

  assert.throws(
    () =>
      registry.register(
        createPlugin("report-provider"),
      ),
    (error: unknown) =>
      error instanceof DuplicatePluginError &&
      error.code === "plugin.duplicate",
  );
});

test("missing plugin is reported", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () => registry.require("missing-plugin"),
    (error: unknown) =>
      error instanceof PluginNotFoundError &&
      error.code === "plugin.not-found",
  );
});

test("plugins can be queried by capability", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("taxpayer-connector", {
      capabilities: [
        "taxpayer.invoice-submission",
      ],
    }),
  );

  registry.register(
    createPlugin("inventory-importer", {
      capabilities: [
        "inventory.barcode-import",
      ],
    }),
  );

  const plugins = registry.list({
    capabilityId:
      "taxpayer.invoice-submission",
  });

  assert.equal(plugins.length, 1);
  assert.equal(
    plugins[0]?.manifest.pluginId,
    "taxpayer-connector",
  );
});

test("plugins can be queried by extension point", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("financial-reports", {
      extensionPoints: [
        "reports.provider",
      ],
    }),
  );

  registry.register(
    createPlugin("csv-importer", {
      extensionPoints: [
        "import.format",
      ],
    }),
  );

  const plugins = registry.list({
    extensionPoint: "reports.provider",
  });

  assert.equal(plugins.length, 1);
  assert.equal(
    plugins[0]?.manifest.pluginId,
    "financial-reports",
  );
});

test("required dependencies must be registered", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("advanced-reporting", {
      dependencies: [
        {
          pluginId: "reporting-core",
          minimumVersion: "1.0.0",
        },
      ],
    }),
  );

  assert.throws(
    () => registry.validateDependencies(),
    (error: unknown) =>
      error instanceof
        PluginDependencyMissingError &&
      error.code ===
        "plugin.dependency-missing" &&
      error.dependencyId ===
        "reporting-core",
  );
});

test("optional dependencies may be absent", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("csv-importer", {
      dependencies: [
        {
          pluginId: "spreadsheet-tools",
          minimumVersion: "1.0.0",
          optional: true,
        },
      ],
    }),
  );

  assert.doesNotThrow(
    () => registry.validateDependencies(),
  );
});

test("dependency minimum version is enforced", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("reporting-core", {
      version: "1.5.0",
    }),
  );

  registry.register(
    createPlugin("advanced-reporting", {
      dependencies: [
        {
          pluginId: "reporting-core",
          minimumVersion: "2.0.0",
        },
      ],
    }),
  );

  assert.throws(
    () => registry.validateDependencies(),
    (error: unknown) =>
      error instanceof
        PluginDependencyVersionError &&
      error.code ===
        "plugin.dependency-version" &&
      error.actualVersion === "1.5.0",
  );
});

test("dependency registration order does not matter", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("advanced-reporting", {
      dependencies: [
        {
          pluginId: "reporting-core",
          minimumVersion: "1.0.0",
        },
      ],
    }),
  );

  registry.register(
    createPlugin("reporting-core", {
      version: "1.2.0",
    }),
  );

  assert.doesNotThrow(
    () => registry.validateDependencies(),
  );
});

test("dependency cycles are rejected", () => {
  const registry =
    new InMemoryPluginRegistry();

  registry.register(
    createPlugin("plugin-a", {
      dependencies: [
        {
          pluginId: "plugin-b",
          minimumVersion: "1.0.0",
        },
      ],
    }),
  );

  registry.register(
    createPlugin("plugin-b", {
      dependencies: [
        {
          pluginId: "plugin-a",
          minimumVersion: "1.0.0",
        },
      ],
    }),
  );

  assert.throws(
    () => registry.validateDependencies(),
    (error: unknown) =>
      error instanceof
        PluginDependencyCycleError &&
      error.code ===
        "plugin.dependency-cycle",
  );
});

test("plugin cannot depend on itself", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register(
        createPlugin("self-dependent", {
          dependencies: [
            {
              pluginId: "self-dependent",
              minimumVersion: "1.0.0",
            },
          ],
        }),
      ),
    TypeError,
  );
});

test("duplicate capabilities are rejected", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register(
        createPlugin("duplicate-capability", {
          capabilities: [
            "reports.financial-statements",
            "reports.financial-statements",
          ],
        }),
      ),
    TypeError,
  );
});

test("capability identifiers require module prefix", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register(
        createPlugin("invalid-capability", {
          capabilities: ["reporting"],
        }),
      ),
    TypeError,
  );
});

test("duplicate contribution identifiers are rejected", () => {
  const registry =
    new InMemoryPluginRegistry();

  assert.throws(
    () =>
      registry.register({
        manifest: {
          pluginId: "report-provider",
          displayName: "Report Provider",
          version: "1.0.0",
          apiVersion: PLUGIN_API_VERSION,
          capabilities: [],
          dependencies: [],
        },
        contributions: [
          {
            extensionPoint:
              "reports.provider",
            contributionId:
              "financial-report",
          },
          {
            extensionPoint:
              "reports.provider",
            contributionId:
              "financial-report",
          },
        ],
      }),
    TypeError,
  );
});

test("semantic versions are compared numerically", () => {
  assert.equal(
    compareSemanticVersions(
      "1.10.0",
      "1.9.0",
    ),
    1,
  );

  assert.equal(
    compareSemanticVersions(
      "2.0.0",
      "2.0.0",
    ),
    0,
  );

  assert.equal(
    compareSemanticVersions(
      "1.9.9",
      "2.0.0",
    ),
    -1,
  );
});
