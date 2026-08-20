import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Card } from "../../components/layout";
import { useDatabaseStatus } from "./use-database-status";

export function DatabaseStatusCard() {
  const status = useDatabaseStatus();

  if (status.state === "loading") {
    return <Feedback tone="info">در حال آماده‌سازی پایگاه داده محلی...</Feedback>;
  }

  if (status.state === "error") {
    return <Feedback tone="error">{status.message}</Feedback>;
  }

  return (
    <Card header={<><div><strong>پایگاه داده آفلاین</strong><small>زیرساخت ذخیره‌سازی محلی Desktop</small></div><Badge tone="success">آماده</Badge></>}>
      <dl className="system-diagnostics__definition-list">
        <div><dt>موتور</dt><dd>SQLite</dd></div>
        <div><dt>نسخه</dt><dd dir="ltr">{status.health.databaseVersion}</dd></div>
        <div><dt>کلیدهای خارجی</dt><dd><Badge tone={status.health.foreignKeysEnabled ? "success" : "danger"}>{status.health.foreignKeysEnabled ? "فعال" : "غیرفعال"}</Badge></dd></div>
      </dl>
    </Card>
  );
}
