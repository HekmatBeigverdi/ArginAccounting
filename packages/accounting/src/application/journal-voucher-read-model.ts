import type { PagedResult } from "@argin/platform";
import type { JournalVoucher } from "../domain/journal-voucher.ts";
import type {
  JournalVoucherDto,
  JournalVoucherLineDto,
  JournalVoucherListItemDto,
  JournalVoucherPageDto,
} from "./journal-voucher-contracts.ts";

export function projectJournalVoucherDetail(
  voucher: JournalVoucher,
): JournalVoucherDto {
  return Object.freeze({
    id: voucher.id,
    companyId: voucher.companyId,
    branchId: voucher.branchId,
    number: voucher.number,
    reference: voucher.reference,
    voucherDate: voucher.voucherDate,
    fiscalYearId: voucher.fiscalYearId,
    fiscalPeriodId: voucher.fiscalPeriodId,
    description: voucher.description,
    status: voucher.status,
    currency: voucher.currency,
    sourceType: voucher.source.type,
    sourceId: voucher.source.sourceId,
    lines: Object.freeze(voucher.lines.map(projectJournalVoucherLine)),
    totalDebit: Object.freeze({ ...voucher.totalDebit }),
    totalCredit: Object.freeze({ ...voucher.totalCredit }),
    createdAt: voucher.createdAt,
    updatedAt: voucher.updatedAt,
    version: voucher.version,
  });
}

export function projectJournalVoucherListItem(
  voucher: JournalVoucher,
): JournalVoucherListItemDto {
  return Object.freeze({
    id: voucher.id,
    branchId: voucher.branchId,
    number: voucher.number,
    reference: voucher.reference,
    voucherDate: voucher.voucherDate,
    description: voucher.description,
    totalDebit: Object.freeze({ ...voucher.totalDebit }),
    totalCredit: Object.freeze({ ...voucher.totalCredit }),
    version: voucher.version,
  });
}

export function projectJournalVoucherPage(
  page: PagedResult<JournalVoucher>,
): JournalVoucherPageDto {
  return Object.freeze({
    items: Object.freeze(page.items.map(projectJournalVoucherListItem)),
    page: page.page,
    pageSize: page.pageSize,
    totalItems: page.totalItems,
    totalPages: page.totalPages,
    hasPreviousPage: page.hasPreviousPage,
    hasNextPage: page.hasNextPage,
  });
}

function projectJournalVoucherLine(
  line: JournalVoucher["lines"][number],
): JournalVoucherLineDto {
  return Object.freeze({
    id: line.id,
    order: line.order,
    accountId: line.accountId,
    description: line.description,
    debit: Object.freeze({ ...line.debit }),
    credit: Object.freeze({ ...line.credit }),
    dimensionAssignments: Object.freeze(
      line.dimensionAssignments.map((assignment) =>
        Object.freeze({
          dimensionTypeId: assignment.dimensionTypeId,
          memberIds: Object.freeze([...assignment.memberIds]),
        }),
      ),
    ),
  });
}
