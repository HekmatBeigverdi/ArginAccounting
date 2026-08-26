import type { CurrencyCode, MoneyValue, PagedResult } from "@argin/platform";
import type { AccountingDimensionAssignment } from "../domain/accounting-dimension-assignment.ts";
import type {
  JournalVoucherSourceType,
  JournalVoucherStatus,
} from "../domain/journal-voucher.ts";
import type { JournalVoucherSearchQuery } from "../contracts/journal-voucher-repository.ts";

export interface JournalVoucherCommandContext {
  readonly actorId: string;
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly requestId?: string | null;
  readonly correlationId?: string | null;
  readonly causationId?: string | null;
}

export interface JournalVoucherLineInput {
  readonly id?: string;
  readonly order: number;
  readonly accountId: string;
  readonly description?: string | null;
  readonly debit: number;
  readonly credit: number;
  readonly dimensionAssignments?: readonly AccountingDimensionAssignment[];
}

export interface CreateJournalVoucherCommand {
  readonly context: JournalVoucherCommandContext;
  readonly voucherDate: string;
  readonly reference?: string | null;
  readonly description?: string | null;
  readonly currency?: CurrencyCode;
  readonly sourceType?: JournalVoucherSourceType;
  readonly sourceId?: string | null;
  readonly lines: readonly JournalVoucherLineInput[];
}

export interface UpdateJournalVoucherDraftCommand {
  readonly context: JournalVoucherCommandContext;
  readonly voucherId: string;
  readonly expectedVersion: number;
  readonly voucherDate: string;
  readonly reference?: string | null;
  readonly description?: string | null;
  readonly lines: readonly JournalVoucherLineInput[];
}

export interface DeleteJournalVoucherDraftCommand {
  readonly context: JournalVoucherCommandContext;
  readonly voucherId: string;
  readonly expectedVersion: number;
}

export interface GetJournalVoucherQuery {
  readonly companyId: string;
  readonly voucherId: string;
}

export type ListJournalVouchersQuery = JournalVoucherSearchQuery;

export interface JournalVoucherLineDto {
  readonly id: string;
  readonly order: number;
  readonly accountId: string;
  readonly description: string | null;
  readonly debit: MoneyValue;
  readonly credit: MoneyValue;
  readonly dimensionAssignments: readonly AccountingDimensionAssignment[];
}

export interface JournalVoucherDto {
  readonly id: string;
  readonly companyId: string;
  readonly branchId: string | null;
  readonly number: string;
  readonly reference: string | null;
  readonly voucherDate: string;
  readonly fiscalYearId: string;
  readonly fiscalPeriodId: string;
  readonly description: string | null;
  readonly status: JournalVoucherStatus;
  readonly currency: CurrencyCode;
  readonly sourceType: JournalVoucherSourceType;
  readonly sourceId: string | null;
  readonly lines: readonly JournalVoucherLineDto[];
  readonly totalDebit: MoneyValue;
  readonly totalCredit: MoneyValue;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface JournalVoucherListItemDto {
  readonly id: string;
  readonly branchId: string | null;
  readonly number: string;
  readonly reference: string | null;
  readonly voucherDate: string;
  readonly description: string | null;
  readonly status: JournalVoucherStatus;
  readonly totalDebit: MoneyValue;
  readonly totalCredit: MoneyValue;
  readonly version: number;
}

export type JournalVoucherPageDto = PagedResult<JournalVoucherListItemDto>;
