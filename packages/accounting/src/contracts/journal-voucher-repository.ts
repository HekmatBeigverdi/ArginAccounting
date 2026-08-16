import type { PagedResult } from "@argin/platform";
import type { JournalVoucher } from "../domain/journal-voucher.ts";

export interface JournalVoucherSearchQuery {
  readonly companyId: string;
  readonly branchId?: string | null;
  readonly fiscalYearId?: string;
  readonly fiscalPeriodId?: string;
  readonly accountId?: string;
  readonly sourceType?: string;
  readonly reference?: string;
  readonly number?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
  readonly text?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface NormalizedJournalVoucherSearchQuery {
  readonly companyId: string;
  readonly branchId: string | null | undefined;
  readonly fiscalYearId: string | undefined;
  readonly fiscalPeriodId: string | undefined;
  readonly accountId: string | undefined;
  readonly sourceType: string | undefined;
  readonly reference: string | undefined;
  readonly number: string | undefined;
  readonly dateFrom: string | undefined;
  readonly dateTo: string | undefined;
  readonly text: string | undefined;
  readonly page: number;
  readonly pageSize: number;
  readonly offset: number;
}

export interface JournalVoucherRepository {
  create(voucher: JournalVoucher): Promise<void>;
  findById(id: string): Promise<JournalVoucher | null>;
  findByRequestId(
    companyId: string,
    requestId: string,
  ): Promise<JournalVoucher | null>;
  findByNumber(
    companyId: string,
    fiscalYearId: string,
    branchId: string | null,
    number: string,
  ): Promise<JournalVoucher | null>;
  search(
    query: NormalizedJournalVoucherSearchQuery,
  ): Promise<PagedResult<JournalVoucher>>;
  update(
    voucher: JournalVoucher,
    expectedVersion: number,
  ): Promise<void>;
  deleteDraft(
    id: string,
    companyId: string,
    expectedVersion: number,
  ): Promise<void>;
}

export interface JournalVoucherUsageReader {
  isAccountUsed(accountId: string): Promise<boolean>;
  isDimensionTypeUsed(dimensionTypeId: string): Promise<boolean>;
  isDimensionMemberUsed(dimensionMemberId: string): Promise<boolean>;
}
