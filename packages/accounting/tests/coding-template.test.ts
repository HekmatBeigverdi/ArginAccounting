import assert from "node:assert/strict";
import test from "node:test";

import {
  CodingTemplateValidationError,
  createCodingTemplate,
  createCodingTemplateCode,
  createCodingTemplateVersion,
  publishCodingTemplate,
  retireCodingTemplate,
} from "../src/index.ts";

const fingerprint = "a".repeat(64);

test("normalizes a stable company-independent template code", () => {
  assert.equal(
    createCodingTemplateCode("  IRAN_Service__Default "),
    "iran-service-default",
  );
});

test("rejects invalid template codes and missing Persian names", () => {
  assert.throws(
    () => createCodingTemplateCode("الگوی-خدماتی"),
    CodingTemplateValidationError,
  );
  assert.throws(
    () => createCodingTemplate({
      id: "template-1",
      code: "service-default",
      persianName: " ",
      activityType: "service",
      ownership: "built_in",
      createdAt: "2026-08-02T08:00:00.000Z",
    }),
    CodingTemplateValidationError,
  );
  assert.throws(
    () => createCodingTemplate({
      id: "template-1",
      code: "service-default",
      persianName: "الگوی خدماتی",
      activityType: "unsupported" as "service",
      ownership: "built_in",
      createdAt: "2026-08-02T08:00:00.000Z",
    }),
    (error: unknown) => error instanceof CodingTemplateValidationError &&
      error.code === "activity_type_invalid",
  );
});

test("creates a company-independent draft template", () => {
  const template = createCodingTemplate({
    id: "template-1",
    code: " IRAN_Service_Default ",
    persianName: "  الگوی   خدماتی ایران ",
    englishName: " Iranian Service Template ",
    activityType: "service",
    ownership: "built_in",
    createdAt: "2026-08-02T08:00:00.000Z",
  });

  assert.equal(template.code, "iran-service-default");
  assert.equal(template.persianName, "الگوی خدماتی ایران");
  assert.equal(template.lifecycle, "draft");
  assert.equal(template.latestPublishedVersion, null);
  assert.equal("companyId" in template, false);
  assert.equal(Object.isFrozen(template), true);
});

test("publishes sequential immutable version metadata", () => {
  const draft = createCodingTemplate({
    id: "template-1",
    code: "iran-service-default",
    persianName: "الگوی خدماتی ایران",
    activityType: "service",
    ownership: "built_in",
    createdAt: "2026-08-02T08:00:00.000Z",
  });

  const published = publishCodingTemplate(draft, {
    id: "template-version-1",
    source: {
      type: "catalog",
      reference: "catalogs/service/v1",
      contractVersion: "1.0",
      contentFingerprint: fingerprint,
    },
    publishedAt: "2026-08-02T09:00:00.000Z",
    publishedBy: "system-admin-1",
  });

  assert.equal(draft.lifecycle, "draft");
  assert.equal(published.template.lifecycle, "published");
  assert.equal(published.template.latestPublishedVersion, 1);
  assert.equal(published.version.versionNumber, 1);
  assert.equal(published.version.templateCode, "iran-service-default");
  assert.equal(Object.isFrozen(published.version), true);
  assert.equal(Object.isFrozen(published.version.source), true);

  const next = publishCodingTemplate(published.template, {
    id: "template-version-2",
    source: {
      type: "catalog",
      reference: "catalogs/service/v2",
      contractVersion: "1.0",
      contentFingerprint: "b".repeat(64),
    },
    publishedAt: "2026-08-02T10:00:00.000Z",
    publishedBy: "system-admin-1",
  });

  assert.equal(next.version.versionNumber, 2);
  assert.equal(published.version.versionNumber, 1);
});

test("only retires a published template and blocks republishing it", () => {
  const draft = createCodingTemplate({
    id: "template-1",
    code: "iran-trading-default",
    persianName: "الگوی بازرگانی ایران",
    activityType: "trading",
    ownership: "built_in",
    createdAt: "2026-08-02T08:00:00.000Z",
  });

  assert.throws(
    () => retireCodingTemplate(draft, "2026-08-02T09:00:00.000Z"),
    (error: unknown) => error instanceof CodingTemplateValidationError &&
      error.code === "published_version_required",
  );

  const { template: published } = publishCodingTemplate(draft, {
    id: "template-version-1",
    source: {
      type: "catalog",
      reference: null,
      contractVersion: "1.0",
      contentFingerprint: fingerprint,
    },
    publishedAt: "2026-08-02T09:00:00.000Z",
    publishedBy: "system-admin-1",
  });
  const retired = retireCodingTemplate(
    published,
    "2026-08-02T10:00:00.000Z",
  );

  assert.equal(retired.lifecycle, "retired");
  assert.throws(
    () => publishCodingTemplate(retired, {
      id: "template-version-2",
      source: {
        type: "catalog",
        reference: null,
        contractVersion: "1.0",
        contentFingerprint: "b".repeat(64),
      },
      publishedAt: "2026-08-02T11:00:00.000Z",
      publishedBy: "system-admin-1",
    }),
    (error: unknown) => error instanceof CodingTemplateValidationError &&
      error.code === "invalid_lifecycle_transition",
  );
});

test("rejects non-positive versions and malformed fingerprints", () => {
  assert.throws(
    () => createCodingTemplateVersion({
      id: "template-version-1",
      templateId: "template-1",
      templateCode: "iran-manufacturing-default",
      versionNumber: 0,
      persianName: "الگوی تولیدی ایران",
      activityType: "manufacturing",
      ownership: "built_in",
      source: {
        type: "catalog",
        reference: null,
        contractVersion: "1.0",
        contentFingerprint: fingerprint,
      },
      publishedAt: "2026-08-02T09:00:00.000Z",
      publishedBy: "system-admin-1",
    }),
    CodingTemplateValidationError,
  );

  assert.throws(
    () => createCodingTemplateVersion({
      id: "template-version-1",
      templateId: "template-1",
      templateCode: "iran-manufacturing-default",
      versionNumber: 1,
      persianName: "الگوی تولیدی ایران",
      activityType: "manufacturing",
      ownership: "built_in",
      source: {
        type: "catalog",
        reference: null,
        contractVersion: "1.0",
        contentFingerprint: "not-a-sha256",
      },
      publishedAt: "2026-08-02T09:00:00.000Z",
      publishedBy: "system-admin-1",
    }),
    (error: unknown) => error instanceof CodingTemplateValidationError &&
      error.code === "fingerprint_invalid",
  );
});
