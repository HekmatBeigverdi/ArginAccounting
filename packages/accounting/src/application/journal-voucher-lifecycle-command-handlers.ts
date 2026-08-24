import type { JournalVoucherApprovalIntegrationDependencies } from "./journal-voucher-approval-integration.ts";
import {
  decideJournalVoucherApproval,
  submitJournalVoucherForApproval,
} from "./journal-voucher-approval-integration.ts";
import type { JournalVoucherAmendmentDependencies } from "./journal-voucher-locking.ts";
import { reopenApprovedJournalVoucherForAmendment } from "./journal-voucher-locking.ts";
import type { JournalVoucherPostingDependencies } from "./journal-voucher-posting.ts";
import { postJournalVoucher } from "./journal-voucher-posting.ts";
import type { JournalVoucherReversalDependencies } from "./journal-voucher-reversal.ts";
import { reverseJournalVoucher } from "./journal-voucher-reversal.ts";
import type {
  JournalVoucherLifecycleAuthorizationDependencies,
  JournalVoucherLifecycleAuthorizedAction,
} from "./journal-voucher-lifecycle-authorization.ts";
import { assertJournalVoucherLifecycleAuthorized } from "./journal-voucher-lifecycle-authorization.ts";
import type {
  DecideJournalVoucherLifecycleApprovalCommand,
  PostJournalVoucherLifecycleCommand,
  ReopenJournalVoucherLifecycleCommand,
  ReverseJournalVoucherLifecycleCommand,
  SubmitJournalVoucherLifecycleCommand,
} from "./journal-voucher-lifecycle-contracts.ts";
import { JournalVoucherLifecycleApplicationError } from "./journal-voucher-lifecycle-contracts.ts";
import type { JournalVoucherLifecycleEffects } from "./journal-voucher-lifecycle-effects.ts";
import {
  emitJournalVoucherAuthorizationDenied,
  emitJournalVoucherLifecycleSuccess,
} from "./journal-voucher-lifecycle-effects.ts";

export interface JournalVoucherLifecycleCommandDependencies {
  readonly authorization: JournalVoucherLifecycleAuthorizationDependencies;
  readonly approval: JournalVoucherApprovalIntegrationDependencies;
  readonly posting: JournalVoucherPostingDependencies;
  readonly amendment: JournalVoucherAmendmentDependencies;
  readonly reversal: JournalVoucherReversalDependencies;
  readonly effects?: JournalVoucherLifecycleEffects;
}

export async function handleSubmitJournalVoucherLifecycleCommand(
  command: SubmitJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "authorization" | "approval" | "effects">,
) {
  await authorizeWithAudit("submit", command.voucherId, command.context, dependencies.authorization, dependencies.effects);
  const result = await submitJournalVoucherForApproval({
    voucherId: command.voucherId,
    companyId: command.context.companyId,
    expectedVersion: command.expectedVersion,
    actor: command.actor,
    occurredAt: command.context.occurredAt,
    correlationId: normalizeOptional(command.context.correlationId),
  }, dependencies.approval);

  if (dependencies.effects) {
    await emitJournalVoucherLifecycleSuccess(dependencies.effects, {
      action: "submit_for_approval",
      context: command.context,
      voucher: result.voucher,
      previousStatus: "draft",
      previousVersion: command.expectedVersion,
      approvalRequestId: result.approvalRequest.id,
    });
  }
  return result;
}

export async function handleDecideJournalVoucherLifecycleApprovalCommand(
  command: DecideJournalVoucherLifecycleApprovalCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "authorization" | "approval" | "effects">,
) {
  const action = actionForDecision(command.decision);
  await authorizeWithAudit(action, command.voucherId, command.context, dependencies.authorization, dependencies.effects);
  const result = await decideJournalVoucherApproval({
    voucherId: command.voucherId,
    companyId: command.context.companyId,
    expectedVoucherVersion: command.expectedVersion,
    expectedApprovalVersion: command.expectedApprovalVersion,
    decision: command.decision,
    actor: command.actor,
    occurredAt: command.context.occurredAt,
    comment: normalizeOptional(command.comment),
    correlationId: normalizeOptional(command.context.correlationId),
  }, dependencies.approval);

  if (dependencies.effects) {
    await emitJournalVoucherLifecycleSuccess(dependencies.effects, {
      action: effectActionForDecision(command.decision),
      context: command.context,
      voucher: result.voucher,
      previousStatus: "pending_approval",
      previousVersion: command.expectedVersion,
      approvalRequestId: result.approvalRequest.id,
      approvalRequesterId: result.approvalRequest.requestedBy.id,
      reason: normalizeOptional(command.comment),
    });
  }
  return result;
}

export async function handlePostJournalVoucherLifecycleCommand(
  command: PostJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "authorization" | "posting" | "effects">,
) {
  await authorizeWithAudit("post", command.voucherId, command.context, dependencies.authorization, dependencies.effects);
  const result = await postJournalVoucher({
    voucherId: command.voucherId,
    companyId: command.context.companyId,
    expectedVersion: command.expectedVersion,
    actorId: command.context.actorId,
    occurredAt: command.context.occurredAt,
    postingReference: normalizeOptional(command.postingReference),
  }, dependencies.posting);

  if (dependencies.effects) {
    await emitJournalVoucherLifecycleSuccess(dependencies.effects, {
      action: "post",
      context: command.context,
      voucher: result.voucher,
      previousStatus: "approved",
      previousVersion: command.expectedVersion,
      approvalRequestId: result.evidence.approvalRequestId,
      postingReference: result.evidence.postingReference,
    });
  }
  return result;
}

export async function handleReopenJournalVoucherLifecycleCommand(
  command: ReopenJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "authorization" | "amendment" | "effects">,
) {
  await authorizeWithAudit("reopen-for-amendment", command.voucherId, command.context, dependencies.authorization, dependencies.effects);
  const result = await reopenApprovedJournalVoucherForAmendment({
    voucherId: command.voucherId,
    companyId: command.context.companyId,
    expectedVersion: command.expectedVersion,
    actor: command.actor,
    occurredAt: command.context.occurredAt,
    reason: command.reason,
  }, dependencies.amendment);

  if (dependencies.effects) {
    await emitJournalVoucherLifecycleSuccess(dependencies.effects, {
      action: "reopen_for_amendment",
      context: command.context,
      voucher: result.voucher,
      previousStatus: "approved",
      previousVersion: command.expectedVersion,
      approvalRequestId: result.evidence.approvalRequestId,
      reason: result.evidence.reason,
    });
  }
  return result;
}

export async function handleReverseJournalVoucherLifecycleCommand(
  command: ReverseJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "authorization" | "reversal" | "effects">,
) {
  await authorizeWithAudit("reverse", command.voucherId, command.context, dependencies.authorization, dependencies.effects);
  const requestId = requireRequestId(command.context.requestId);
  const result = await reverseJournalVoucher({
    originalVoucherId: command.voucherId,
    companyId: command.context.companyId,
    expectedVersion: command.expectedVersion,
    actorId: command.context.actorId,
    occurredAt: command.context.occurredAt,
    reversalDate: command.reversalDate,
    requestId,
    correlationId: normalizeOptional(command.context.correlationId),
    causationId: normalizeOptional(command.context.causationId),
    reason: command.reason,
    replacementVoucherId: normalizeOptional(command.replacementVoucherId),
  }, dependencies.reversal);

  if (dependencies.effects && !result.replayed) {
    await emitJournalVoucherLifecycleSuccess(dependencies.effects, {
      action: "reverse",
      context: command.context,
      voucher: result.originalVoucher,
      previousStatus: "posted",
      previousVersion: command.expectedVersion,
      reversalVoucherId: result.reversalVoucher.id,
      replacementVoucherId: result.lineage.replacementVoucherId,
      reason: result.lineage.reason,
    });
  }
  return result;
}

async function authorizeWithAudit(
  action: JournalVoucherLifecycleAuthorizedAction,
  voucherId: string,
  context: SubmitJournalVoucherLifecycleCommand["context"],
  authorization: JournalVoucherLifecycleAuthorizationDependencies,
  effects?: JournalVoucherLifecycleEffects,
): Promise<void> {
  try {
    await assertJournalVoucherLifecycleAuthorized({ action, voucherId, actorId: context.actorId, dependencies: authorization });
  } catch (error) {
    if (effects) {
      await emitJournalVoucherAuthorizationDenied(effects, {
        action,
        voucherId,
        companyId: context.companyId,
        actorId: context.actorId,
        occurredAt: context.occurredAt,
        requestId: normalizeOptional(context.requestId),
        correlationId: normalizeOptional(context.correlationId),
        causationId: normalizeOptional(context.causationId),
        reason: error instanceof Error ? error.message : "authorization denied",
      });
    }
    throw error;
  }
}

function actionForDecision(decision: DecideJournalVoucherLifecycleApprovalCommand["decision"]): JournalVoucherLifecycleAuthorizedAction {
  switch (decision) {
    case "approve": return "approve";
    case "reject": return "reject";
    case "return-to-draft": return "return-to-draft";
    case "cancel": return "cancel-approval";
  }
}

function effectActionForDecision(decision: DecideJournalVoucherLifecycleApprovalCommand["decision"]): "approve" | "reject" | "return_to_draft" | "cancel_approval" {
  switch (decision) {
    case "approve": return "approve";
    case "reject": return "reject";
    case "return-to-draft": return "return_to_draft";
    case "cancel": return "cancel_approval";
  }
}

function requireRequestId(value: string | null | undefined): string {
  const requestId = normalizeOptional(value);
  if (!requestId) {
    throw new JournalVoucherLifecycleApplicationError("journal.idempotency-conflict", "عملیات برگشت سند به شناسه درخواست پایدار نیاز دارد.");
  }
  return requestId;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
