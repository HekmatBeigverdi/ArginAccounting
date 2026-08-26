import {
  createJournalVoucher,
  type CreateJournalVoucherInput,
  type JournalVoucher,
  type JournalVoucherStatus,
} from "./journal-voucher.ts";
import { JournalVoucherValidationError } from "./journal-voucher-validation-error.ts";

export interface RehydrateJournalVoucherInput extends CreateJournalVoucherInput {
  readonly status?: JournalVoucherStatus;
  readonly updatedAt: string;
}

const journalVoucherStatuses = new Set<JournalVoucherStatus>([
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "reversed",
]);

export function rehydrateJournalVoucher(
  input: RehydrateJournalVoucherInput,
): JournalVoucher {
  const voucher = createJournalVoucher(input);
  const updatedAt = input.updatedAt.trim();
  if (updatedAt.length === 0 || updatedAt.length > 128) {
    throw new JournalVoucherValidationError(
      "identifier_required",
      "updatedAt",
      "زمان آخرین تغییر سند حسابداری معتبر نیست.",
    );
  }

  const status = input.status ?? "draft";
  if (!journalVoucherStatuses.has(status)) {
    throw new JournalVoucherValidationError(
      "identifier_required",
      "status",
      "وضعیت چرخه عمر سند حسابداری معتبر نیست.",
    );
  }

  return Object.freeze({ ...voucher, status, updatedAt });
}
