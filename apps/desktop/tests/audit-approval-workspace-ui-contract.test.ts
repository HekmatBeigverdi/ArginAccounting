import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const approvalList = read("../src/pages/approval/approval-requests-page.tsx");
const approvalDetails = read("../src/pages/approval/approval-request-details-page.tsx");
const auditList = read("../src/pages/audit/audit-entries-page.tsx");
const auditDetails = read("../src/pages/audit/audit-entry-details-page.tsx");
const styles = read("../src/pages/governance/governance-workspace.css");
const sources = [approvalList, approvalDetails, auditList, auditDetails];

test("audit and approval pages use shared Phase 14 primitives", () => {
  assert.match(approvalList, /<Page className="governance-page"/u);
  assert.match(approvalList, /<DataTable/u);
  assert.match(approvalList, /<Badge/u);
  assert.match(approvalList, /<Feedback/u);
  assert.match(auditList, /<DataTable/u);
  assert.match(auditList, /<Field/u);
  assert.match(auditDetails, /<Card/u);
  assert.match(approvalDetails, /<Textarea/u);
});

test("legacy temporary and feature-specific page shells are removed from touched governance pages", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /temporary-page/u);
    assert.doesNotMatch(source, /approval-card|approval-table|audit-card|audit-table/u);
    assert.doesNotMatch(source, /console\.(log|error|debug)/u);
  }
});

test("approval workflow semantics remain delegated to existing audit services", () => {
  assert.match(approvalDetails, /submitApprovalRequest/u);
  assert.match(approvalDetails, /approveApprovalRequest/u);
  assert.match(approvalDetails, /rejectApprovalRequest/u);
  assert.match(approvalDetails, /returnApprovalRequestToDraft/u);
  assert.match(approvalDetails, /cancelApprovalRequest/u);
  assert.match(approvalDetails, /commentOnApprovalRequest/u);
  assert.match(approvalDetails, /approval\.requests\.approve/u);
});

test("audit remains read-only and uses existing search/detail contracts", () => {
  assert.match(auditList, /searchAuditEntries/u);
  assert.match(auditDetails, /getAuditEntry/u);
  assert.doesNotMatch(auditList, /createAudit|updateAudit|deleteAudit/u);
  assert.doesNotMatch(auditDetails, /createAudit|updateAudit|deleteAudit/u);
});

test("governance status and timestamps have consistent Persian presentation", () => {
  assert.match(approvalList, /statusTone/u);
  assert.match(approvalDetails, /statusTone/u);
  assert.match(auditList, /outcomeTone/u);
  assert.match(auditDetails, /outcomeTone/u);
  for (const source of sources) assert.match(source, /fa-IR-u-ca-persian/u);
});

test("governance workspace is token based responsive and focus visible", () => {
  assert.match(styles, /var\(--ui-/u);
  assert.match(styles, /:focus-visible/u);
  assert.match(styles, /@media \(max-width: 1100px\)/u);
  assert.match(styles, /@media \(max-width: 720px\)/u);
});
