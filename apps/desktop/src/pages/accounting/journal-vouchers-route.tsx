import { useSearchParams } from "react-router";

import { JournalVoucherTracePage } from "./journal-voucher-trace-page";
import { JournalVouchersLifecyclePage } from "./journal-vouchers-lifecycle-page";

export function JournalVouchersRoute() {
  const [searchParams] = useSearchParams();
  const tracedVoucherId = searchParams.get("voucherId")?.trim() ?? "";
  const fromReports = searchParams.get("from") === "accounting-reports";

  if (fromReports && tracedVoucherId) {
    return <JournalVoucherTracePage />;
  }

  return <JournalVouchersLifecyclePage />;
}
