import assert from "node:assert/strict";
import test from "node:test";

import {
  CodingTemplateLifecycleError,
  codingTemplatePermissions,
  createCodingTemplateDraft,
  publishCodingTemplateCommand,
  retireCodingTemplateCommand,
  updateCodingTemplateDraftCommand,
  IRAN_SERVICE_CODING_CATALOG,
  type AccountingUnitOfWorkRepositories,
  type CodingTemplate,
  type CodingTemplateVersionRecord,
} from "../src/index.ts";

function fixture(permissions: readonly string[], failVersion = false) {
  const templates: CodingTemplate[] = [];
  const versions: CodingTemplateVersionRecord[] = [];
  const events: Array<{
    eventType: string;
    correlationId?: string;
    causationId?: string;
    payload: Record<string, unknown>;
  }> = [];
  let sequence = 0;

  const state = () => [templates.length, versions.length] as const;

  const repositories = createFixtureRepositories(
    templates,
    versions,
    failVersion,
  ) as unknown as AccountingUnitOfWorkRepositories;

  const dependencies = createFixtureDependencies(
    permissions,
    templates,
    versions,
    events,
    () => ++sequence,
    failVersion,
  );

  return { templates, versions, events, dependencies, state };
}

function createFixtureRepositories(
  templates: CodingTemplate[],
  versions: CodingTemplateVersionRecord[],
  failVersion: boolean,
) {
  return {
    accounts: {},
    codingSettings: {},
    codingTemplates: {
      create: async (value: CodingTemplate) => {
        templates.push(value);
      },
      update: async (value: CodingTemplate) => {
        const index = templates.findIndex((item) => item.id === value.id);
        templates[index] = value;
      },
      findById: async (id: string) =>
        templates.find((item) => item.id === id) ?? null,
      findByCode: async (code: string) =>
        templates.find((item) => String(item.code) === code) ?? null,
    },
    codingTemplateVersions: {
      create: async (value: CodingTemplateVersionRecord) => {
        if (failVersion) throw new Error("version failed");
        versions.push(value);
      },
    },
  };
}

function createFixtureDependencies(
  permissions: readonly string[],
  templates: CodingTemplate[],
  versions: CodingTemplateVersionRecord[],
  events: Array<{
    eventType: string;
    correlationId?: string;
    causationId?: string;
    payload: Record<string, unknown>;
  }>,
  nextSequence: () => number,
  failVersion: boolean,
) {
  return {
    unitOfWork: {
      async run<T>(
        operation: (repositories: AccountingUnitOfWorkRepositories) => Promise<T>,
      ) {
        const beforeTemplates = [...templates];
        const beforeVersions = [...versions];
        try {
          return await operation(
            createFixtureRepositories(templates, versions, failVersion) as unknown as AccountingUnitOfWorkRepositories,
          );
        } catch (error) {
          templates.splice(0, templates.length, ...beforeTemplates);
          versions.splice(0, versions.length, ...beforeVersions);
          throw error;
        }
      },
    },
    authorizer: {
      hasPermission: async (permission: string) =>
        permissions.includes(permission),
    },
    clock: {
      now: () => new Date("2026-08-03T16:00:00.000Z"),
    },
    idGenerator: {
      generate: () => `id-${nextSequence()}`,
    },
    eventPublisher: {
      publish: async (event: typeof events[number]) => {
        events.push(event);
      },
      publishMany: async () => undefined,
    },
  };
}

test("authorizes custom lifecycle actions and emits correlated audit snapshots after commit", async () => {
  const f = fixture([
    codingTemplatePermissions.create,
    codingTemplatePermissions.updateDraft,
    codingTemplatePermissions.publish,
    codingTemplatePermissions.retire,
  ]);

  const created = await createCodingTemplateDraft(
    {
      code: "custom-service",
      persianName: "خدماتی",
      activityType: "service",
      ownership: "custom",
      actorId: "user-1",
      correlation: {
        correlationId: "corr-1",
        causationId: "cause-1",
      },
    },
    f.dependencies,
  );

  const updated = await updateCodingTemplateDraftCommand(
    {
      templateId: String(created.id),
      expectedOptimisticVersion: created.optimisticVersion,
      persianName: "خدماتی سفارشی",
      activityType: "service",
      actorId: "user-1",
    },
    f.dependencies,
  );

  const published = await publishCodingTemplateCommand(
    {
      templateId: String(updated.id),
      expectedOptimisticVersion: updated.optimisticVersion,
      content: IRAN_SERVICE_CODING_CATALOG.content,
      source: {
        type: "manual",
        reference: "phase-12",
        contractVersion: "1.0",
        contentFingerprint: "a".repeat(64),
      },
      actorId: "user-1",
    },
    f.dependencies,
  );

  await retireCodingTemplateCommand(
    {
      templateId: String(published.template.id),
      expectedOptimisticVersion: published.template.optimisticVersion,
      actorId: "user-1",
    },
    f.dependencies,
  );

  const eventTypes = f.events.map((event) => event.eventType);
  assert.deepEqual(eventTypes, [
    "accounting.coding-template.created",
    "accounting.coding-template.draft-updated",
    "accounting.coding-template.published",
    "accounting.coding-template.retired",
  ]);

  assert.equal(f.events[0]?.correlationId, "corr-1");
  assert.equal(f.events[0]?.causationId, "cause-1");
  assert.equal(f.events[1]?.payload.before !== null, true);
  assert.equal(f.events[1]?.payload.after !== null, true);
});

test("reserves built-in mutation for system template administrators", async () => {
  const denied = fixture([codingTemplatePermissions.create]);

  await assert.rejects(
    () =>
      createCodingTemplateDraft(
        {
          code: "built-in",
          persianName: "سیستمی",
          activityType: "service",
          ownership: "built_in",
          actorId: "admin",
        },
        denied.dependencies,
      ),
    (error: unknown) =>
      error instanceof CodingTemplateLifecycleError &&
      error.code === "built_in_permission_required",
  );
  assert.deepEqual(denied.state(), [0, 0]);
  assert.equal(denied.events.length, 0);

  const allowed = fixture([
    codingTemplatePermissions.create,
    codingTemplatePermissions.manageBuiltIn,
  ]);

  await createCodingTemplateDraft(
    {
      code: "built-in",
      persianName: "سیستمی",
      activityType: "service",
      ownership: "built_in",
      actorId: "admin",
    },
    allowed.dependencies,
  );
  assert.deepEqual(allowed.state(), [1, 0]);
});

test("publishes no success event when a lifecycle transaction rolls back", async () => {
  const f = fixture(
    [codingTemplatePermissions.create, codingTemplatePermissions.publish],
    true,
  );

  const created = await createCodingTemplateDraft(
    {
      code: "rollback",
      persianName: "بازگشت",
      activityType: "service",
      ownership: "custom",
      actorId: "admin",
    },
    f.dependencies,
  );

  f.events.length = 0;

  await assert.rejects(
    () =>
      publishCodingTemplateCommand(
        {
          templateId: String(created.id),
          expectedOptimisticVersion: created.optimisticVersion,
          content: IRAN_SERVICE_CODING_CATALOG.content,
          source: {
            type: "manual",
            reference: "test",
            contractVersion: "1.0",
            contentFingerprint: "b".repeat(64),
          },
          actorId: "admin",
        },
        f.dependencies,
      ),
    /version failed/,
  );

  assert.deepEqual(f.state(), [1, 0]);
  assert.equal(f.events.length, 0);
});
