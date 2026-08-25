import type { DomainEvent, NotificationService } from "@argin/platform";
import type { JournalVoucher } from "../domain/journal-voucher.ts";
import {
  JournalVoucherLifecycleApplicationError,
  type JournalVoucherLifecycleCommandContext,
} from "./journal-voucher-lifecycle-contracts.ts";

export type JournalVoucherLifecycleEffectAction =
  | "submit_for_approval"
  | "approve"
  | "reject"
  | "return_to_draft"
  | "cancel_approval"
  | "post"
  | "reopen_for_amendment"
  | "reverse"
  | "authorization_denied";

export type JournalVoucherLifecycleEffectStage = "audit" | "event" | "notification";

export interface JournalVoucherLifecycleAuditEvidence {
  readonly action: JournalVoucherLifecycleEffectAction;
  readonly voucherId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly previousStatus: JournalVoucher["status"] | null;
  readonly newStatus: JournalVoucher["status"] | null;
  readonly previousVersion: number | null;
  readonly newVersion: number | null;
  readonly requestId: string | null;
  readonly correlationId: string | null;
  readonly causationId: string | null;
  readonly approvalRequestId: string | null;
  readonly postingReference: string | null;
  readonly reversalVoucherId: string | null;
  readonly replacementVoucherId: string | null;
  readonly outcome: "success" | "denied";
  readonly reason: string | null;
}

export interface JournalVoucherLifecycleAuditRecorder {
  record(evidence: JournalVoucherLifecycleAuditEvidence): Promise<void>;
}

export interface JournalVoucherLifecycleEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface JournalVoucherLifecycleEffects {
  readonly audit: JournalVoucherLifecycleAuditRecorder;
  readonly events: JournalVoucherLifecycleEventPublisher;
  readonly notifications?: NotificationService;
}

export interface EmitJournalVoucherLifecycleSuccessInput {
  readonly action: Exclude<JournalVoucherLifecycleEffectAction, "authorization_denied">;
  readonly context: JournalVoucherLifecycleCommandContext;
  readonly voucher: JournalVoucher;
  readonly previousStatus: JournalVoucher["status"];
  readonly previousVersion: number;
  readonly approvalRequestId?: string | null;
  readonly postingReference?: string | null;
  readonly reversalVoucherId?: string | null;
  readonly replacementVoucherId?: string | null;
  readonly approvalRequesterId?: string | null;
  readonly reason?: string | null;
}

export async function emitJournalVoucherLifecycleSuccess(
  effects: JournalVoucherLifecycleEffects,
  input: EmitJournalVoucherLifecycleSuccessInput,
): Promise<void> {
  const evidence = createEvidence(input);

  // The business transaction has already committed when the handler calls this function.
  await runPostCommitStage("audit", evidence, () => effects.audit.record(evidence));
  await runPostCommitStage("event", evidence, () =>
    effects.events.publish(createIntegrationEvent(evidence)),
  );

  const notifications = effects.notifications;
  const approvalRequesterId = input.approvalRequesterId;
  if (notifications && approvalRequesterId) {
    const notification = approvalNotification(input.action);
    if (notification) {
      await runPostCommitStage("notification", evidence, async () => {
        await notifications.create({
          notificationType: notification.type,
          recipient: { recipientType: "user", recipientId: approvalRequesterId },
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
          channels: ["in-app"],
          ...(evidence.correlationId ? { correlationId: evidence.correlationId } : {}),
          sourceModule: "accounting",
          data: {
            voucherId: evidence.voucherId,
            status: evidence.newStatus,
            approvalRequestId: evidence.approvalRequestId,
          },
        });
      });
    }
  }
}

export async function emitJournalVoucherAuthorizationDenied(
  effects: JournalVoucherLifecycleEffects,
  input: {
    readonly action: string;
    readonly voucherId: string;
    readonly companyId: string;
    readonly actorId: string;
    readonly occurredAt: string;
    readonly requestId?: string | null;
    readonly correlationId?: string | null;
    readonly causationId?: string | null;
    readonly reason: string;
  },
): Promise<void> {
  await effects.audit.record(Object.freeze({
    action: "authorization_denied",
    voucherId: input.voucherId,
    companyId: input.companyId,
    branchId: null,
    actorId: input.actorId,
    occurredAt: input.occurredAt,
    previousStatus: null,
    newStatus: null,
    previousVersion: null,
    newVersion: null,
    requestId: normalize(input.requestId),
    correlationId: normalize(input.correlationId),
    causationId: normalize(input.causationId),
    approvalRequestId: null,
    postingReference: null,
    reversalVoucherId: null,
    replacementVoucherId: null,
    outcome: "denied",
    reason: `${input.action}: ${input.reason}`,
  }));
}

async function runPostCommitStage(
  stage: JournalVoucherLifecycleEffectStage,
  evidence: JournalVoucherLifecycleAuditEvidence,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (cause) {
    throw new JournalVoucherLifecycleApplicationError(
      "journal.post-commit-effects-failed",
      `عملیات اصلی سند انجام شده است، اما مرحله ${stage} پس از Commit کامل نشد.`,
      Object.freeze({
        committed: true,
        stage,
        action: evidence.action,
        voucherId: evidence.voucherId,
        newVersion: evidence.newVersion,
        cause: describeCause(cause),
      }),
      { cause },
    );
  }
}

function describeCause(cause: unknown): string {
  if (cause instanceof AggregateError) {
    return `${cause.name}: ${cause.message}; errors=${cause.errors.map(describeCause).join(" | ")}`;
  }
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}${cause.stack ? `\n${cause.stack}` : ""}`;
  }
  return String(cause);
}

function createEvidence(input: EmitJournalVoucherLifecycleSuccessInput): JournalVoucherLifecycleAuditEvidence {
  return Object.freeze({
    action: input.action,
    voucherId: input.voucher.id,
    companyId: input.voucher.companyId,
    branchId: input.voucher.branchId,
    actorId: input.context.actorId,
    occurredAt: input.context.occurredAt,
    previousStatus: input.previousStatus,
    newStatus: input.voucher.status,
    previousVersion: input.previousVersion,
    newVersion: input.voucher.version,
    requestId: normalize(input.context.requestId),
    correlationId: normalize(input.context.correlationId),
    causationId: normalize(input.context.causationId),
    approvalRequestId: normalize(input.approvalRequestId),
    postingReference: normalize(input.postingReference),
    reversalVoucherId: normalize(input.reversalVoucherId),
    replacementVoucherId: normalize(input.replacementVoucherId),
    outcome: "success",
    reason: normalize(input.reason),
  });
}

function createIntegrationEvent(evidence: JournalVoucherLifecycleAuditEvidence): DomainEvent {
  return Object.freeze({
    eventId: eventId(evidence),
    eventType: `accounting.journal-voucher.${eventSuffix(evidence.action)}`,
    occurredAt: evidence.occurredAt,
    aggregateId: evidence.voucherId,
    aggregateType: "accounting.journal-voucher",
    ...(evidence.newVersion === null ? {} : { aggregateVersion: evidence.newVersion }),
    ...(evidence.correlationId ? { correlationId: evidence.correlationId } : {}),
    ...(evidence.causationId ? { causationId: evidence.causationId } : {}),
    payload: Object.freeze({ ...evidence }),
    metadata: Object.freeze({ schemaVersion: 1, sourceModule: "accounting" }),
  });
}

function eventId(evidence: JournalVoucherLifecycleAuditEvidence): string {
  return [evidence.voucherId, evidence.newVersion ?? "na", evidence.action, evidence.requestId ?? evidence.occurredAt].join(":");
}

function eventSuffix(action: JournalVoucherLifecycleEffectAction): string {
  return action.replaceAll("_", "-");
}

function approvalNotification(action: JournalVoucherLifecycleEffectAction): {
  type: string;
  title: string;
  message: string;
  severity: "information" | "success" | "warning";
} | null {
  switch (action) {
    case "approve":
      return { type: "journal-voucher.approved", title: "تأیید سند حسابداری", message: "سند حسابداری شما تأیید شد و آماده ثبت نهایی است.", severity: "success" };
    case "reject":
      return { type: "journal-voucher.rejected", title: "رد سند حسابداری", message: "سند حسابداری شما رد و برای اصلاح به پیش‌نویس بازگردانده شد.", severity: "warning" };
    case "return_to_draft":
      return { type: "journal-voucher.returned", title: "بازگشت سند برای اصلاح", message: "سند حسابداری برای اصلاح به پیش‌نویس بازگردانده شد.", severity: "information" };
    case "cancel_approval":
      return { type: "journal-voucher.approval-cancelled", title: "لغو گردش تأیید", message: "گردش تأیید سند حسابداری لغو شد.", severity: "information" };
    default:
      return null;
  }
}

function normalize(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}
