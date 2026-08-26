import type {
  AuditAction,
  AuditCommandContext,
  AuditSource,
} from "@argin/audit";
import { recordAuditEntry } from "@argin/audit";
import type {
  JournalVoucherLifecycleAuditEvidence,
  JournalVoucherLifecycleAuditRecorder,
} from "./journal-voucher-lifecycle-effects.ts";

export function createJournalVoucherLifecycleAuditRecorder(
  context: AuditCommandContext & { readonly auditSource: AuditSource },
): JournalVoucherLifecycleAuditRecorder {
  return Object.freeze({
    async record(evidence: JournalVoucherLifecycleAuditEvidence): Promise<void> {
      await recordAuditEntry(context, {
        occurredAt: evidence.occurredAt,
        action: auditAction(evidence),
        outcome: evidence.outcome === "denied" ? "denied" : "success",
        source: context.auditSource,
        actor: {
          type: "user",
          id: evidence.actorId,
          displayName: evidence.actorId,
        },
        scope: {
          companyId: evidence.companyId,
          branchId: evidence.branchId,
        },
        target: {
          entityType: "accounting.journal-voucher",
          entityId: evidence.voucherId,
          entityDisplayName: null,
        },
        message: `Journal lifecycle action: ${evidence.action}`,
        reason: evidence.reason,
        before: evidence.previousStatus === null
          ? null
          : {
              status: evidence.previousStatus,
              version: evidence.previousVersion,
            },
        after: evidence.newStatus === null
          ? null
          : {
              status: evidence.newStatus,
              version: evidence.newVersion,
            },
        correlationId: evidence.correlationId,
        metadata: {
          requestId: evidence.requestId,
          causationId: evidence.causationId,
          approvalRequestId: evidence.approvalRequestId,
          postingReference: evidence.postingReference,
          reversalVoucherId: evidence.reversalVoucherId,
          replacementVoucherId: evidence.replacementVoucherId,
          lifecycleAction: evidence.action,
        },
      });
    },
  });
}

function auditAction(evidence: JournalVoucherLifecycleAuditEvidence): AuditAction {
  switch (evidence.action) {
    case "submit_for_approval":
      return "submit";
    case "approve":
      return "approve";
    case "reject":
      return "reject";
    case "cancel_approval":
      return "cancel";
    case "return_to_draft":
    case "post":
    case "reopen_for_amendment":
    case "reverse":
    case "authorization_denied":
      return "status-change";
  }
}
