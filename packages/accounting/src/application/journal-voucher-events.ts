import type { DomainEvent } from "@argin/platform";
import type { JournalVoucher } from "../domain/journal-voucher.ts";
import type {
  JournalVoucherCommandContext,
} from "./journal-voucher-contracts.ts";
import type { JournalVoucherPermission } from "./journal-voucher-permissions.ts";

export type JournalVoucherSuccessEventType =
  | "accounting.journal-voucher.created"
  | "accounting.journal-voucher.draft-updated"
  | "accounting.journal-voucher.draft-deleted";

export type JournalVoucherAuditEventType =
  | JournalVoucherSuccessEventType
  | "accounting.journal-voucher.authorization-denied";

export interface JournalVoucherSuccessEventPayload {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly voucherId: string;
  readonly voucherNumber: string;
  readonly voucherDate: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly version: number;
}

export interface JournalVoucherAuthorizationDeniedPayload {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly permission: JournalVoucherPermission;
  readonly voucherId: string | null;
}

export type JournalVoucherSuccessEvent = DomainEvent<
  JournalVoucherSuccessEventPayload,
  JournalVoucherSuccessEventType
>;

export type JournalVoucherAuthorizationDeniedEvent = DomainEvent<
  JournalVoucherAuthorizationDeniedPayload,
  "accounting.journal-voucher.authorization-denied"
>;

interface JournalEventDependencies {
  readonly now: () => Date;
  readonly generateId: () => string;
}

export function createJournalVoucherSuccessEvent(
  dependencies: JournalEventDependencies,
  context: JournalVoucherCommandContext,
  voucher: JournalVoucher,
  eventType: JournalVoucherSuccessEventType,
): JournalVoucherSuccessEvent {
  return Object.freeze({
    eventId: dependencies.generateId(),
    eventType,
    occurredAt: dependencies.now().toISOString(),
    aggregateId: voucher.id,
    aggregateType: "journal-voucher",
    aggregateVersion: voucher.version,
    ...(context.correlationId?.trim()
      ? { correlationId: context.correlationId.trim() }
      : {}),
    ...(context.causationId?.trim()
      ? { causationId: context.causationId.trim() }
      : {}),
    payload: Object.freeze({
      actorId: context.actorId,
      companyId: voucher.companyId,
      branchId: voucher.branchId,
      voucherId: voucher.id,
      voucherNumber: voucher.number,
      voucherDate: voucher.voucherDate,
      fiscalYearId: voucher.fiscalYearId,
      fiscalPeriodId: voucher.fiscalPeriodId,
      version: voucher.version,
    }),
    metadata: Object.freeze({
      module: "accounting",
      audit: true,
      integration: true,
    }),
  });
}

export function createJournalVoucherAuthorizationDeniedEvent(
  dependencies: JournalEventDependencies,
  context: JournalVoucherCommandContext,
  permission: JournalVoucherPermission,
  voucherId: string | null = null,
): JournalVoucherAuthorizationDeniedEvent {
  return Object.freeze({
    eventId: dependencies.generateId(),
    eventType: "accounting.journal-voucher.authorization-denied",
    occurredAt: dependencies.now().toISOString(),
    aggregateType: "journal-voucher",
    ...(voucherId ? { aggregateId: voucherId } : {}),
    ...(context.correlationId?.trim()
      ? { correlationId: context.correlationId.trim() }
      : {}),
    ...(context.causationId?.trim()
      ? { causationId: context.causationId.trim() }
      : {}),
    payload: Object.freeze({
      actorId: context.actorId,
      companyId: context.companyId,
      branchId: context.branchId ?? null,
      permission,
      voucherId,
    }),
    metadata: Object.freeze({
      module: "accounting",
      audit: true,
      security: true,
      integration: false,
      outcome: "denied",
    }),
  });
}
