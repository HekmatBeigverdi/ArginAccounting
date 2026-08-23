import type { JournalVoucher } from "../domain/journal-voucher.ts";
import type { JournalVoucherApprovalCycle } from "./journal-voucher-approval-integration.ts";
import type { JournalVoucherAmendmentEvidence } from "./journal-voucher-locking.ts";
import type { JournalVoucherPostingEvidence } from "./journal-voucher-posting.ts";
import type { JournalVoucherReversalLineage } from "./journal-voucher-reversal.ts";
import type {
  GetJournalVoucherLifecycleQuery,
  JournalVoucherApprovalTraceDto,
  JournalVoucherLifecycleActionCapability,
  JournalVoucherLifecycleDto,
} from "./journal-voucher-lifecycle-contracts.ts";
import { JournalVoucherLifecycleApplicationError } from "./journal-voucher-lifecycle-contracts.ts";

export interface JournalVoucherLifecycleReader {
  findVoucher(voucherId: string): Promise<JournalVoucher | null>;
  findCurrentApprovalCycle(voucherId: string): Promise<JournalVoucherApprovalCycle | null>;
  findPostingEvidence(voucherId: string): Promise<JournalVoucherPostingEvidence | null>;
  findLatestAmendmentEvidence(voucherId: string): Promise<JournalVoucherAmendmentEvidence | null>;
  findReversalLineage(voucherId: string): Promise<JournalVoucherReversalLineage | null>;
}

export async function getJournalVoucherLifecycle(
  query: GetJournalVoucherLifecycleQuery,
  reader: JournalVoucherLifecycleReader,
): Promise<JournalVoucherLifecycleDto> {
  const voucher = await reader.findVoucher(query.voucherId);
  if (!voucher || voucher.companyId !== query.companyId) {
    throw new JournalVoucherLifecycleApplicationError(
      "journal.not-found",
      "سند حسابداری موردنظر پیدا نشد.",
      { voucherId: query.voucherId, companyId: query.companyId },
    );
  }

  const [approvalCycle, posting, latestAmendment, reversal] = await Promise.all([
    reader.findCurrentApprovalCycle(voucher.id),
    reader.findPostingEvidence(voucher.id),
    reader.findLatestAmendmentEvidence(voucher.id),
    reader.findReversalLineage(voucher.id),
  ]);

  return Object.freeze({
    voucherId: voucher.id,
    companyId: voucher.companyId,
    status: voucher.status,
    version: voucher.version,
    capabilities: Object.freeze({
      editable: voucher.status === "draft",
      deletable: voucher.status === "draft",
      actions: Object.freeze(stateActions(voucher.status, Boolean(approvalCycle?.isCurrent))),
    }),
    approval: projectApprovalTrace(voucher, approvalCycle),
    posting: posting ? Object.freeze({ ...posting }) : null,
    latestAmendment: latestAmendment ? Object.freeze({ ...latestAmendment }) : null,
    reversal: reversal ? Object.freeze({ ...reversal }) : null,
  });
}

function stateActions(
  status: JournalVoucher["status"],
  hasCurrentApproval: boolean,
): JournalVoucherLifecycleActionCapability[] {
  switch (status) {
    case "draft":
      return ["edit", "delete", "submit_for_approval"];
    case "pending_approval":
      return hasCurrentApproval
        ? ["approve", "reject", "return_to_draft", "cancel_approval"]
        : [];
    case "approved":
      return hasCurrentApproval
        ? ["reopen_for_amendment", "post"]
        : ["reopen_for_amendment"];
    case "posted":
      return ["reverse"];
    case "reversed":
      return [];
  }
}

function projectApprovalTrace(
  voucher: JournalVoucher,
  cycle: JournalVoucherApprovalCycle | null,
): JournalVoucherApprovalTraceDto | null {
  if (!cycle) return null;

  const status: JournalVoucherApprovalTraceDto["status"] =
    !cycle.isCurrent
      ? "closed"
      : voucher.status === "pending_approval"
        ? "pending"
        : voucher.status === "approved" || voucher.status === "posted"
          ? "approved"
          : "closed";

  return Object.freeze({
    approvalRequestId: cycle.approvalRequestId,
    submittedContentVersion: cycle.submittedContentVersion,
    status,
    isCurrent: cycle.isCurrent,
  });
}
