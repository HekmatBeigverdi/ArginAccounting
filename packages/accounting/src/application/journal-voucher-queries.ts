import type {
  JournalVoucherAuthorizer,
} from "../contracts/journal-voucher-runtime.ts";
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
  journalVoucherPermissions,
} from "./journal-voucher-permissions.ts";
import {
  projectJournalVoucherDetail,
  projectJournalVoucherPage,
} from "./journal-voucher-read-model.ts";

export async function getJournalVoucher(
  query: GetJournalVoucherQuery,
  repository: JournalVoucherRepository,
  authorizer: JournalVoucherAuthorizer,
): Promise<JournalVoucherDto> {
  await requireViewPermission(authorizer);
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
  authorizer: JournalVoucherAuthorizer,
): Promise<JournalVoucherPageDto> {
  return searchJournalVouchers(query, repository, authorizer);
}

export async function searchJournalVouchers(
  query: JournalVoucherSearchQuery,
  repository: JournalVoucherRepository,
  authorizer: JournalVoucherAuthorizer,
): Promise<JournalVoucherPageDto> {
  await requireViewPermission(authorizer);
  const normalized = normalizeJournalVoucherSearchQuery(query);
  const page = await repository.search(normalized);
  return projectJournalVoucherPage(page);
}

async function requireViewPermission(
  authorizer: JournalVoucherAuthorizer,
): Promise<void> {
  const permission = journalVoucherPermissions.view;
  if (await authorizer.hasPermission(permission)) return;

  throw new JournalVoucherApplicationError(
    "journal.unauthorized",
    "شما مجوز مشاهده اسناد حسابداری را ندارید.",
    { permission },
  );
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
