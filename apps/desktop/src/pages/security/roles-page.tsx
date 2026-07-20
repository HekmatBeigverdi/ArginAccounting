import { Link } from "react-router";
import {
  RoleManagement
} from "../../features/security/role-management";

export function RolesPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            مدیریت سیستم
          </p>

          <h1>نقش‌ها</h1>

          <p>
            نقش‌های سازمانی و گروه‌های دسترسی را
            تعریف کنید.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="temporary-page__back"
        >
          بازگشت به داشبورد
        </Link>
      </header>

      <RoleManagement />
    </section>
  );
}
