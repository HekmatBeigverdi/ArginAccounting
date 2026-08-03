import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCodingTemplate,
  CodingTemplateApplicationError,
  createCodingTemplate,
  createCodingTemplatePreview,
  IRAN_SERVICE_CODING_CATALOG,
  publishCodingTemplate,
  type AccountingUnitOfWorkRepositories,
  type CodingTemplateApplicationHistory,
  type CodingTemplateApplicationItemMapping,
  type CodingTemplateCompanyBaseline,
} from "../src/index.ts";

const companyId = "company-1";
const emptyBaseline = (): CodingTemplateCompanyBaseline => ({ companyId, accounts: [], dimensionTypes: [], dimensionMembers: [], accountDimensionPolicies: [] });

function fixture(failPolicy = false) {
  const draft = createCodingTemplate({ id: "template-1", code: "service", persianName: "خدماتی", activityType: "service", ownership: "built_in", createdAt: "2026-08-03T10:00:00.000Z" });
  const published = publishCodingTemplate(draft, { id: "version-1", source: { type: "catalog", reference: "service", contractVersion: "1.0", contentFingerprint: "a".repeat(64) }, publishedAt: "2026-08-03T10:00:00.000Z", publishedBy: "admin" });
  const applications: CodingTemplateApplicationHistory[] = [];
  const mappings: CodingTemplateApplicationItemMapping[] = [];
  const accounts: unknown[] = [];
  const types: unknown[] = [];
  const members: unknown[] = [];
  const policies: unknown[] = [];
  const events: unknown[] = [];
  let sequence = 0;
  const repositoryState = () => [accounts.length, types.length, members.length, policies.length, applications.length, mappings.length] as const;
  const repositories = {
    accounts: { create: async (value: unknown) => { accounts.push(value); } },
    codingSettings: {},
    dimensionTypes: { create: async (value: unknown) => { types.push(value); } },
    dimensionMembers: { create: async (value: unknown) => { members.push(value); } },
    dimensionPolicies: { create: async (value: unknown) => { if (failPolicy) throw new Error("policy write failed"); policies.push(value); } },
    codingTemplates: { findById: async (id: string) => id === published.template.id ? published.template : null },
    codingTemplateVersions: { findById: async (id: string) => id === published.version.id ? { version: published.version, content: IRAN_SERVICE_CODING_CATALOG.content } : null },
    codingTemplateApplications: {
      create: async (value: CodingTemplateApplicationHistory) => { applications.push(value); },
      findByRequestKey: async (scope: string, key: string) => applications.find((value) => value.companyId === scope && value.requestKey === key) ?? null,
    },
    codingTemplateApplicationMappings: {
      createMany: async (values: readonly CodingTemplateApplicationItemMapping[]) => { mappings.push(...values); },
      findByApplicationId: async (id: string) => mappings.filter((value) => value.applicationId === id),
    },
    codingTemplateBaselines: { read: async () => emptyBaseline() },
  } as unknown as AccountingUnitOfWorkRepositories;
  const unitOfWork = {
    async run<T>(operation: (r: AccountingUnitOfWorkRepositories) => Promise<T>): Promise<T> {
      const before = repositoryState();
      try { return await operation(repositories); }
      catch (error) {
        accounts.length = before[0]; types.length = before[1]; members.length = before[2]; policies.length = before[3]; applications.length = before[4]; mappings.length = before[5];
        throw error;
      }
    },
  };
  const dependencies = {
    unitOfWork,
    authorizer: { hasPermission: async () => true },
    clock: { now: () => new Date("2026-08-03T12:00:00.000Z") },
    idGenerator: { generate: () => `id-${++sequence}` },
    eventPublisher: { publish: async (event: unknown) => { events.push(event); }, publishMany: async () => undefined },
  };
  const baselineFingerprint = createCodingTemplatePreview({ companyId, templateVersionId: String(published.version.id), content: IRAN_SERVICE_CODING_CATALOG.content, baseline: emptyBaseline() }).baselineFingerprint;
  const command = { companyId, templateId: String(published.template.id), templateVersionId: String(published.version.id), baselineFingerprint, requestKey: "request-1", confirmed: true, actorId: "admin" } as const;
  return { applications, mappings, accounts, types, members, policies, events, dependencies, command, repositoryState };
}

test("applies all operational items, mappings, and history atomically", async () => {
  const f = fixture();
  const result = await applyCodingTemplate(f.command, f.dependencies);
  assert.equal(result.idempotentReplay, false);
  assert.equal(f.accounts.length, IRAN_SERVICE_CODING_CATALOG.content.accounts.length);
  assert.equal(f.types.length, IRAN_SERVICE_CODING_CATALOG.content.dimensionTypes.length);
  assert.equal(f.members.length, IRAN_SERVICE_CODING_CATALOG.content.dimensionMembers.length);
  assert.equal(f.policies.length, IRAN_SERVICE_CODING_CATALOG.content.accountDimensionPolicies.length);
  assert.equal(f.mappings.length, result.mappings.length);
  assert.equal(f.applications.length, 1);
  assert.equal(f.events.length, 1);
});

test("returns the recorded result for an idempotent retry", async () => {
  const f = fixture();
  const first = await applyCodingTemplate(f.command, f.dependencies);
  const state = f.repositoryState();
  const second = await applyCodingTemplate(f.command, f.dependencies);
  assert.equal(second.idempotentReplay, true);
  assert.equal(second.application.id, first.application.id);
  assert.deepEqual(f.repositoryState(), state);
  assert.equal(f.events.length, 1);
});

test("rejects an unconfirmed or stale preview without writes", async () => {
  const f = fixture();
  await assert.rejects(() => applyCodingTemplate({ ...f.command, confirmed: false }, f.dependencies), (error: unknown) => error instanceof CodingTemplateApplicationError && error.code === "confirmation_required");
  await assert.rejects(() => applyCodingTemplate({ ...f.command, baselineFingerprint: "fnv1a32:stale" }, f.dependencies), (error: unknown) => error instanceof CodingTemplateApplicationError && error.code === "stale_preview");
  assert.deepEqual(f.repositoryState(), [0, 0, 0, 0, 0, 0]);
  assert.equal(f.events.length, 0);
});

test("rolls back every write and emits no event when one item fails", async () => {
  const f = fixture(true);
  await assert.rejects(() => applyCodingTemplate(f.command, f.dependencies), /policy write failed/);
  assert.deepEqual(f.repositoryState(), [0, 0, 0, 0, 0, 0]);
  assert.equal(f.events.length, 0);
});
