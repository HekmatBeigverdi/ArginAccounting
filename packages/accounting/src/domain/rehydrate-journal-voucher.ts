import {
  createJournalVoucher,
  type CreateJournalVoucherInput,
  type JournalVoucher,
} from "./journal-voucher.ts";
import { JournalVoucherValidationError } from "./journal-voucher-validation-error.ts";

export interface RehydrateJournalVoucherInput extends CreateJournalVoucherInput {
  readonly updatedAt: string;
}

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
  return Object.freeze({ ...voucher, updatedAt });
}
