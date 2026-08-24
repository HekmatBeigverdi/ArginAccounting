import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

const migration = readFileSync(
  new URL("../src-tauri/migrations/0014_journal_lifecycle.sql", import.meta.url),
  "utf8",
);

function database(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE journal_vouchers (
      id TEXT NOT NULL,
      company_id TEXT NOT NULL,
      voucher_date TEXT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE (company_id, id)
    );
    CREATE TABLE approval_requests (id TEXT PRIMARY KEY NOT NULL);
  `);
  db.exec(migration);
  for (const id of ["original-1", "original-2", "reversal-1", "reversal-2", "replacement-1"]) {
    db.prepare("INSERT INTO journal_vouchers (id, company_id, voucher_date) VALUES (?, 'company-1', '2026-08-24')").run(id);
  }
  for (const id of ["approval-1", "approval-2"]) {
    db.prepare("INSERT INTO approval_requests (id) VALUES (?)").run(id);
  }
  return db;
}

function addApprovalCycle(
  db: DatabaseSync,
  approvalId: string,
  voucherId: string,
  current = 1,
): void {
  db.prepare(`INSERT INTO journal_voucher_approval_cycles (
      approval_request_id, voucher_id, company_id, submitted_content_version,
      is_current, created_at, closed_at
    ) VALUES (?, ?, 'company-1', 1, ?, '2026-08-24T10:00:00.000Z', ?)`)
    .run(approvalId, voucherId, current, current === 1 ? null : "2026-08-24T11:00:00.000Z");
}

describe("journal lifecycle relational protections", () => {
  it("allows at most one current approval cycle for a voucher", () => {
    const db = database();
    addApprovalCycle(db, "approval-1", "original-1");
    assert.throws(() => addApprovalCycle(db, "approval-2", "original-1"));
  });

  it("allows only one posting evidence record per voucher", () => {
    const db = database();
    db.prepare(`INSERT INTO journal_voucher_posting_evidence (
      voucher_id, company_id, approval_request_id, submitted_content_version,
      posted_version, posted_by, posted_at, posting_reference
    ) VALUES ('original-1', 'company-1', 'approval-1', 1, 3, 'poster-1',
      '2026-08-24T10:00:00.000Z', 'POST-1')`).run();

    assert.throws(() => db.prepare(`INSERT INTO journal_voucher_posting_evidence (
      voucher_id, company_id, approval_request_id, submitted_content_version,
      posted_version, posted_by, posted_at
    ) VALUES ('original-1', 'company-1', 'approval-2', 1, 4, 'poster-2',
      '2026-08-24T11:00:00.000Z')`).run());
  });

  it("protects reversal original, reversal voucher, and request id uniqueness", () => {
    const db = database();
    const insert = (original: string, reversal: string, request: string) =>
      db.prepare(`INSERT INTO journal_voucher_reversal_lineage (
        original_voucher_id, reversal_voucher_id, replacement_voucher_id,
        company_id, request_id, reversed_by, reversed_at, reason
      ) VALUES (?, ?, NULL, 'company-1', ?, 'user-1',
        '2026-08-24T12:00:00.000Z', 'Correction')`).run(original, reversal, request);

    insert("original-1", "reversal-1", "request-1");
    assert.throws(() => insert("original-1", "reversal-2", "request-2"));
    assert.throws(() => insert("original-2", "reversal-1", "request-2"));
    assert.throws(() => insert("original-2", "reversal-2", "request-1"));
  });

  it("rejects malformed amendment evidence and invalid reversal self-lineage", () => {
    const db = database();
    assert.throws(() => db.prepare(`INSERT INTO journal_voucher_amendment_evidence (
      voucher_id, company_id, approval_request_id, previous_version,
      reopened_version, reopened_by, reopened_at, reason
    ) VALUES ('original-1', 'company-1', 'approval-1', 3, 5, 'user-1',
      '2026-08-24T12:00:00.000Z', 'Correction')`).run());

    assert.throws(() => db.prepare(`INSERT INTO journal_voucher_reversal_lineage (
      original_voucher_id, reversal_voucher_id, replacement_voucher_id,
      company_id, request_id, reversed_by, reversed_at, reason
    ) VALUES ('original-1', 'original-1', NULL, 'company-1', 'request-self',
      'user-1', '2026-08-24T12:00:00.000Z', 'Correction')`).run());
  });
});
