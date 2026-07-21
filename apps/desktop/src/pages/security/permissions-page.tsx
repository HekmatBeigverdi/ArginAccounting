import { Link } from "react-router";
import {
  PermissionList
} from "../../features/security/permission-list";

export function PermissionsPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            مدیریت سیستم
          </p>

          <h1>مجوزها</h1>

          <p>
            فهرست مجوزهای تعریف‌شده برای ماژول‌های
            نرم‌افزار.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="temporary-page__back"
        >
          بازگشت به داشبورد
        </Link>
      </header>

      <PermissionList />
    </section>
  );
}
