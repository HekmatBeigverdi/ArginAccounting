import type {
  JournalVoucherRepository,
  JournalVoucherSearchQuery,
} from "../contracts/journal-voucher-repository.ts";
import { normalizeJournalVoucherSearchQuery } from "../contracts/normalize-journal-voucher-query.ts";
import {
  JournalVoucherApplicationError,
} from "./journal-voucher-application-error.ts";
import type {
  GetJournalVoucherQuery,
  JournalVoucherDto,
  JournalVoucherPageDto,
  ListJournalVouchersQuery,
} from "./journal-voucher-contracts.ts";
import {
  projectJournalVoucherDetail,
  projectJournalVoucherPage,
} from "./journal-voucher-read-model.ts";

export async function getJournalVoucher(
  query: GetJournalVoucherQuery,
  repository: JournalVoucherRepository,
): Promise<JournalVoucherDto> {
  const companyId = requireQueryIdentifier(query.companyId, "companyId");
  const voucherId = requireQueryIdentifier(query.voucherId, "voucherId");
  const voucher = await repository.findById(voucherId);

  if (!voucher || voucher.companyId !== companyId) {
    throw new JournalVoucherApplicationError(
      "journal.not-found",
      "سند حسابداری موردنظر پیدا نشد.",
      { companyId, voucherId },
    );
  }

  return projectJournalVoucherDetail(voucher);
}

export async function listJournalVouchers(
  query: ListJournalVouchersQuery,
  repository: JournalVoucherRepository,
): Promise<JournalVoucherPageDto> {
  return searchJournalVouchers(query, repository);
}

export async function searchJournalVouchers(
  query: JournalVoucherSearchQuery,
  repository: JournalVoucherRepository,
): Promise<JournalVoucherPageDto> {
  const normalized = normalizeJournalVoucherSearchQuery(query);
  const page = await repository.search(normalized);
  return projectJournalVoucherPage(page);
}

function requireQueryIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new JournalVoucherApplicationError(
      "journal.invalid-query",
      "شناسه الزامی جستجوی سند حسابداری وارد نشده است.",
      { field },
    );
  }
  return normalized;
}
