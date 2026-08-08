import assert from "node:assert/strict";
import test from "node:test";

import { InvalidQueryError } from "@argin/platform";
import {
  normalizeCodingTemplateApplicationHistoryQuery,
  normalizeCodingTemplateImportHistoryQuery,
  normalizeCodingTemplateRecommendationQuery,
  normalizeCodingTemplateSearchQuery,
  normalizeCodingTemplateVersionSearchQuery,
  type AccountingUnitOfWorkRepositories,
  type CodingTemplateApplicationHistoryRepository,
  type CodingTemplateCatalogProvider,
  type CodingTemplateImportHistoryRepository,
  type CodingTemplateRepository,
  type CodingTemplateVersionRepository,
} from "../src/index.ts";

test("normalizes the public template search with stable ordering", () => {
  const query = normalizeCodingTemplateSearchQuery({
    text: "  خدماتی  ",
    activityType: "service",
    lifecycle: "published",
  });

  assert.equal(query.text, "خدماتی");
  assert.deepEqual(query.pagination, { page: 1, pageSize: 50, offset: 0 });
  assert.deepEqual(query.sorts, [
    { field: "code", direction: "ascending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("normalizes versions with newest published version first", () => {
  const query = normalizeCodingTemplateVersionSearchQuery({
    templateId: " template-service ",
    pagination: { page: 2, pageSize: 10 },
  });

  assert.equal(query.templateId, "template-service");
  assert.deepEqual(query.pagination, { page: 2, pageSize: 10, offset: 10 });
  assert.deepEqual(query.sorts, [
    { field: "versionNumber", direction: "descending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("keeps application history company-scoped", () => {
  const query = normalizeCodingTemplateApplicationHistoryQuery({
    companyId: " company-1 ",
    templateId: " template-1 ",
    status: "applied",
  });

  assert.equal(query.companyId, "company-1");
  assert.equal(query.templateId, "template-1");
  assert.deepEqual(query.sorts, [
    { field: "createdAt", direction: "descending" },
    { field: "id", direction: "ascending" },
  ]);
});

test("supports global import history filters", () => {
  const query = normalizeCodingTemplateImportHistoryQuery({ status: "rejected" });
  assert.equal(query.status, "rejected");
  assert.equal("companyId" in query, false);
});

test("normalizes recommendation input without auto-apply semantics", () => {
  const query = normalizeCodingTemplateRecommendationQuery({
    companyId: " company-7 ",
    activityType: "manufacturing",
  });

  assert.deepEqual(query, {
    companyId: "company-7",
    activityType: "manufacturing",
    includeCustom: false,
  });
});

test("rejects missing required scopes and invalid sort fields", () => {
  assert.throws(
    () => normalizeCodingTemplateApplicationHistoryQuery({ companyId: " " }),
    (error: unknown) => error instanceof InvalidQueryError &&
      error.code === "accounting.coding-template-query.companyId-required",
  );
  assert.throws(
    () => normalizeCodingTemplateSearchQuery({ sorts: [{ field: "unknown" as "code" }] }),
    (error: unknown) => error instanceof InvalidQueryError &&
      error.code === "query.sort-field-not-allowed",
  );
});

test("unit of work exposes infrastructure-neutral Phase 12 repositories", () => {
  const repositories = {
    codingTemplates: {} as CodingTemplateRepository,
    codingTemplateVersions: {} as CodingTemplateVersionRepository,
    codingTemplateApplications: {} as CodingTemplateApplicationHistoryRepository,
    codingTemplateImports: {} as CodingTemplateImportHistoryRepository,
  } satisfies Partial<AccountingUnitOfWorkRepositories>;

  assert.deepEqual(Object.keys(repositories), [
    "codingTemplates",
    "codingTemplateVersions",
    "codingTemplateApplications",
    "codingTemplateImports",
  ]);
});

test("catalog provider remains asynchronous and adapter-neutral", async () => {
  const provider: CodingTemplateCatalogProvider = {
    async findByCode() { return null; },
    async listPublished() { return []; },
    async recommendForActivityType() { return []; },
  };

  assert.equal(await provider.findByCode("iran-service-default"), null);
  assert.deepEqual(await provider.recommendForActivityType("custom"), []);
});
