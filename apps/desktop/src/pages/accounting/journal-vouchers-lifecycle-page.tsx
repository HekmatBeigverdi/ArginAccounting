import { JournalVouchersPage } from "./journal-vouchers-page";
import { JournalVoucherLifecycleOverview } from "./journal-voucher-lifecycle-overview";

export function JournalVouchersLifecyclePage() {
  return (
    <div dir="rtl" lang="fa">
      <JournalVoucherLifecycleOverview />
      <JournalVouchersPage />
    </div>
  );
}
