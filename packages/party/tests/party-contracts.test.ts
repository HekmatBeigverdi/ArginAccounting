import assert from "node:assert/strict";
import test from "node:test";

import {
  PartyApplicationError,
  type ListPartiesQuery,
  type PartyReader,
  type PartyRepository,
  type PartySummaryDto,
  type PartyUnitOfWork
} from "../src/index.ts";

test("party application errors expose stable codes", () => {
  const error = new PartyApplicationError(
    "party.concurrentModification",
    "Party was modified by another operation."
  );

  assert.equal(error.name, "PartyApplicationError");
  assert.equal(error.code, "party.concurrentModification");
});

test("list query contract is company-scoped and page-based", () => {
  const query: ListPartiesQuery = {
    filter: {
      companyId: "company-001",
      search: "آرگین",
      roles: ["customer"],
      statuses: ["active"]
    },
    page: { page: 1, pageSize: 25 },
    sort: { field: "displayName", direction: "asc" }
  };

  assert.equal(query.filter.companyId, "company-001");
  assert.equal(query.page.pageSize, 25);
});

test("repository, reader, and unit-of-work contracts are adapter-neutral", async () => {
  const repository: PartyRepository = {
    async findById() { return null; },
    async findByCode() { return null; },
    async add() {},
    async update() {}
  };

  const summary: PartySummaryDto = {
    id: "party-001",
    companyId: "company-001",
    code: "P-1001",
    classification: "natural-person",
    displayName: "علی رضایی",
    status: "active",
    roles: ["customer"],
    primaryPhone: null,
    primaryMobile: "09120000000",
    primaryEmail: null,
    updatedAt: "2026-08-29T12:00:00.000Z"
  };

  const reader: PartyReader = {
    async getById() { return null; },
    async list(query) {
      return {
        items: [summary],
        page: query.page.page,
        pageSize: query.page.pageSize,
        totalItems: 1,
        totalPages: 1
      };
    },
    async select() { return []; }
  };

  const unitOfWork: PartyUnitOfWork = {
    async run(operation) {
      return operation({ parties: repository });
    }
  };

  const result = await reader.list({
    filter: { companyId: "company-001" },
    page: { page: 1, pageSize: 25 }
  });
  assert.equal(result.items[0]?.id, "party-001");

  const persisted = await unitOfWork.run(async ({ parties }) =>
    parties.findById("company-001", "party-001")
  );
  assert.equal(persisted, null);
});
