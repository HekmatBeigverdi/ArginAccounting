import { UserAccessManagement } from "../../features/security/user-access-management";
import { UserManagement } from "../../features/security/user-management";
import { SecurityWorkspace } from "./security-workspace";

export function UsersPage() {
  return (
    <SecurityWorkspace
      title="کاربران"
      description="حساب‌های کاربری محلی را ایجاد کنید و نقش‌ها و شعب قابل دسترس هر کاربر را مدیریت کنید."
    >
      <div className="security-feature-stack">
        <UserManagement />
        <UserAccessManagement />
      </div>
    </SecurityWorkspace>
  );
}
