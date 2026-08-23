import type { JournalVoucher } from "./journal-voucher.ts";

export type JournalVoucherLifecycleStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "posted"
  | "reversed";

export type JournalVoucherLifecycleAction =
  | "submit_for_approval"
  | "approval_approved"
  | "approval_returned"
  | "approval_rejected"
  | "approval_cancelled"
  | "reopen_for_amendment"
  | "post"
  | "reverse";

export type JournalVoucherLifecycleErrorCode =
  | "invalid_transition"
  | "actor_required"
  | "actor_too_long"
  | "occurred_at_invalid"
  | "version_overflow";

export type JournalVoucherLifecycleSnapshot = Omit<JournalVoucher, "status"> & {
  readonly status: JournalVoucherLifecycleStatus;
};

export interface JournalVoucherTransitionCommand {
  readonly action: JournalVoucherLifecycleAction;
  readonly actorId: string;
  readonly occurredAt: string;
}

export interface JournalVoucherTransitionEvidence {
  readonly action: JournalVoucherLifecycleAction;
  readonly previousStatus: JournalVoucherLifecycleStatus;
  readonly newStatus: JournalVoucherLifecycleStatus;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly previousVersion: number;
  readonly newVersion: number;
}

export interface JournalVoucherTransitionResult {
  readonly voucher: JournalVoucherLifecycleSnapshot;
  readonly evidence: JournalVoucherTransitionEvidence;
}

export class JournalVoucherLifecycleError extends Error {
  readonly code: JournalVoucherLifecycleErrorCode;
  readonly currentStatus: JournalVoucherLifecycleStatus;
  readonly action: JournalVoucherLifecycleAction | null;

  constructor(
    code: JournalVoucherLifecycleErrorCode,
    message: string,
    currentStatus: JournalVoucherLifecycleStatus,
    action: JournalVoucherLifecycleAction | null = null,
  ) {
    super(message);
    this.name = "JournalVoucherLifecycleError";
    this.code = code;
    this.currentStatus = currentStatus;
    this.action = action;
  }
}

const TRANSITIONS: Readonly<
  Record<
    JournalVoucherLifecycleStatus,
    Readonly<
      Partial<Record<JournalVoucherLifecycleAction, JournalVoucherLifecycleStatus>>
    >
  >
> = Object.freeze({
  draft: Object.freeze({
    submit_for_approval: "pending_approval",
  }),
  pending_approval: Object.freeze({
    approval_approved: "approved",
    approval_returned: "draft",
    approval_rejected: "draft",
    approval_cancelled: "draft",
  }),
  approved: Object.freeze({
    reopen_for_amendment: "draft",
    post: "posted",
  }),
  posted: Object.freeze({
    reverse: "reversed",
  }),
  reversed: Object.freeze({}),
});

export function getAllowedJournalVoucherLifecycleActions(
  status: JournalVoucherLifecycleStatus,
): readonly JournalVoucherLifecycleAction[] {
  return Object.freeze(
    Object.keys(TRANSITIONS[status]) as JournalVoucherLifecycleAction[],
  );
}

export function canTransitionJournalVoucher(
  status: JournalVoucherLifecycleStatus,
  action: JournalVoucherLifecycleAction,
): boolean {
  return TRANSITIONS[status][action] !== undefined;
}

export function transitionJournalVoucher(
  voucher: JournalVoucherLifecycleSnapshot,
  command: JournalVoucherTransitionCommand,
): JournalVoucherTransitionResult {
  const nextStatus = TRANSITIONS[voucher.status][command.action];

  if (!nextStatus) {
    throw new JournalVoucherLifecycleError(
      "invalid_transition",
      `انتقال وضعیت ${voucher.status} با عملیات ${command.action} مجاز نیست.`,
      voucher.status,
      command.action,
    );
  }

  const actorId = normalizeActorId(command.actorId, voucher.status, command.action);
  const occurredAt = normalizeOccurredAt(
    command.occurredAt,
    voucher.status,
    command.action,
  );

  if (voucher.version >= Number.MAX_SAFE_INTEGER) {
    throw new JournalVoucherLifecycleError(
      "version_overflow",
      "نسخه سند حسابداری قابل افزایش نیست.",
      voucher.status,
      command.action,
    );
  }

  const newVersion = voucher.version + 1;
  const transitionedVoucher: JournalVoucherLifecycleSnapshot = Object.freeze({
    ...voucher,
    status: nextStatus,
    updatedAt: occurredAt,
    version: newVersion,
  });

  const evidence: JournalVoucherTransitionEvidence = Object.freeze({
    action: command.action,
    previousStatus: voucher.status,
    newStatus: nextStatus,
    actorId,
    occurredAt,
    previousVersion: voucher.version,
    newVersion,
  });

  return Object.freeze({
    voucher: transitionedVoucher,
    evidence,
  });
}

function normalizeActorId(
  value: string,
  currentStatus: JournalVoucherLifecycleStatus,
  action: JournalVoucherLifecycleAction,
): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new JournalVoucherLifecycleError(
      "actor_required",
      "عامل انجام‌دهنده انتقال وضعیت سند حسابداری الزامی است.",
      currentStatus,
      action,
    );
  }

  if (normalized.length > 128) {
    throw new JournalVoucherLifecycleError(
      "actor_too_long",
      "شناسه عامل انتقال وضعیت سند حسابداری بیش از حد مجاز است.",
      currentStatus,
      action,
    );
  }

  return normalized;
}

function normalizeOccurredAt(
  value: string,
  currentStatus: JournalVoucherLifecycleStatus,
  action: JournalVoucherLifecycleAction,
): string {
  const normalized = value.trim();
  const parsed = new Date(normalized);

  if (normalized.length === 0 || Number.isNaN(parsed.getTime())) {
    throw new JournalVoucherLifecycleError(
      "occurred_at_invalid",
      "زمان انتقال وضعیت سند حسابداری معتبر نیست.",
      currentStatus,
      action,
    );
  }

  return parsed.toISOString();
}
