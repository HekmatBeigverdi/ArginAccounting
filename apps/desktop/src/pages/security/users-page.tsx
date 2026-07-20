import { Link } from "react-router";
import {
  UserManagement
} from "../../features/security/user-management";

export function UsersPage() {
  return (
    <section className="temporary-page">
      <header className="temporary-page__header">
        <div>
          <p className="temporary-page__eyebrow">
            مدیریت سیستم
          </p>

          <h1>کاربران</h1>

          <p>
            ایجاد کاربران محلی و مدیریت وضعیت
            حساب‌های کاربری.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="temporary-page__back"
        >
          بازگشت به داشبورد
        </Link>
      </header>

      <UserManagement />
    </section>
  );
}
