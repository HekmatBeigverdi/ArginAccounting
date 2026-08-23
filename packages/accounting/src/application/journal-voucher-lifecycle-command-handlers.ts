import type {
  JournalVoucherApprovalIntegrationDependencies,
} from "./journal-voucher-approval-integration.ts";
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
  DecideJournalVoucherLifecycleApprovalCommand,
  PostJournalVoucherLifecycleCommand,
  ReopenJournalVoucherLifecycleCommand,
  ReverseJournalVoucherLifecycleCommand,
  SubmitJournalVoucherLifecycleCommand,
} from "./journal-voucher-lifecycle-contracts.ts";
import { JournalVoucherLifecycleApplicationError } from "./journal-voucher-lifecycle-contracts.ts";

export interface JournalVoucherLifecycleCommandDependencies {
  readonly approval: JournalVoucherApprovalIntegrationDependencies;
  readonly posting: JournalVoucherPostingDependencies;
  readonly amendment: JournalVoucherAmendmentDependencies;
  readonly reversal: JournalVoucherReversalDependencies;
}

export async function handleSubmitJournalVoucherLifecycleCommand(
  command: SubmitJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "approval">,
) {
  return submitJournalVoucherForApproval(
    {
      voucherId: command.voucherId,
      companyId: command.context.companyId,
      expectedVersion: command.expectedVersion,
      actor: command.actor,
      occurredAt: command.context.occurredAt,
      correlationId: normalizeOptional(command.context.correlationId),
    },
    dependencies.approval,
  );
}

export async function handleDecideJournalVoucherLifecycleApprovalCommand(
  command: DecideJournalVoucherLifecycleApprovalCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "approval">,
) {
  return decideJournalVoucherApproval(
    {
      voucherId: command.voucherId,
      companyId: command.context.companyId,
      expectedVoucherVersion: command.expectedVersion,
      expectedApprovalVersion: command.expectedApprovalVersion,
      decision: command.decision,
      actor: command.actor,
      occurredAt: command.context.occurredAt,
      comment: normalizeOptional(command.comment),
      correlationId: normalizeOptional(command.context.correlationId),
    },
    dependencies.approval,
  );
}

export async function handlePostJournalVoucherLifecycleCommand(
  command: PostJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "posting">,
) {
  return postJournalVoucher(
    {
      voucherId: command.voucherId,
      companyId: command.context.companyId,
      expectedVersion: command.expectedVersion,
      actorId: command.context.actorId,
      occurredAt: command.context.occurredAt,
      postingReference: normalizeOptional(command.postingReference),
    },
    dependencies.posting,
  );
}

export async function handleReopenJournalVoucherLifecycleCommand(
  command: ReopenJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "amendment">,
) {
  return reopenApprovedJournalVoucherForAmendment(
    {
      voucherId: command.voucherId,
      companyId: command.context.companyId,
      expectedVersion: command.expectedVersion,
      actor: command.actor,
      occurredAt: command.context.occurredAt,
      reason: command.reason,
    },
    dependencies.amendment,
  );
}

export async function handleReverseJournalVoucherLifecycleCommand(
  command: ReverseJournalVoucherLifecycleCommand,
  dependencies: Pick<JournalVoucherLifecycleCommandDependencies, "reversal">,
) {
  const requestId = requireRequestId(command.context.requestId);
  return reverseJournalVoucher(
    {
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
    },
    dependencies.reversal,
  );
}

function requireRequestId(value: string | null | undefined): string {
  const requestId = normalizeOptional(value);
  if (!requestId) {
    throw new JournalVoucherLifecycleApplicationError(
      "journal.idempotency-conflict",
      "عملیات برگشت سند به شناسه درخواست پایدار نیاز دارد.",
    );
  }
  return requestId;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
